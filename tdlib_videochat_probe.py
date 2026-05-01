import argparse
import base64
import ctypes
import getpass
import json
import os
import platform
import re
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


BASE_DIR = Path(__file__).parent
DEFAULT_DLL = BASE_DIR / "vendor" / "tdlib" / "tdjson.dll"
DEFAULT_DB_DIR = BASE_DIR / "data" / "tdlib" / "videochat_probe"
DEFAULT_FILES_DIR = BASE_DIR / "data" / "tdlib" / "videochat_probe_files"
DEFAULT_OUTPUT_DIR = BASE_DIR / "data" / "debug_tdlib_videochat"


def clean_env(value: str | None) -> str:
    value = value or ""
    if "#" in value:
        value = value.split("#", 1)[0]
    return value.strip().strip('"').strip("'")


def clean_env_int(*names: str, default: int = 0) -> int:
    for name in names:
        value = clean_env(os.getenv(name))
        if not value:
            continue
        match = re.search(r"-?\d+", value)
        if match:
            return int(match.group(0))
        try:
            return int(value)
        except ValueError:
            continue
    return default


def clean_env_int_list(*names: str) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for name in names:
        value = clean_env(os.getenv(name))
        for match in re.finditer(r"-?\d+", value):
            number = int(match.group(0))
            if number not in seen:
                out.append(number)
                seen.add(number)
    return out


def prompt_required(prompt: str) -> str:
    try:
        value = input(prompt).strip()
    except EOFError as exc:
        raise RuntimeError(
            "TDLib login requires interactive console input. "
            "Run this command directly in a terminal once, enter the Telegram login code, "
            "then rerun the probe after the session is saved."
        ) from exc
    if not value:
        raise RuntimeError("TDLib login input was empty")
    return value


def password_required(prompt: str) -> str:
    try:
        value = getpass.getpass(prompt)
    except EOFError as exc:
        raise RuntimeError(
            "TDLib 2FA login requires interactive console input. "
            "Run this command directly in a terminal once, enter the password, "
            "then rerun the probe after the session is saved."
        ) from exc
    if not value:
        raise RuntimeError("TDLib 2FA password was empty")
    return value


def td_link_username(link: str) -> str:
    parsed = urlparse(link)
    host = parsed.netloc.lower()
    if host not in {"t.me", "telegram.me", "www.t.me", "www.telegram.me"}:
        return ""
    path = parsed.path.strip("/")
    if not path or path.startswith("+") or path.startswith("joinchat/"):
        return ""
    return path.split("/", 1)[0]


class TdJsonClient:
    def __init__(self, dll_path: Path):
        dll_path = dll_path.resolve()
        if os.name == "nt":
            os.add_dll_directory(str(dll_path.parent))
        self.lib = ctypes.CDLL(str(dll_path))
        self.new_api = hasattr(self.lib, "td_create_client_id")
        if self.new_api:
            self.lib.td_create_client_id.restype = ctypes.c_int
            self.lib.td_send.argtypes = [ctypes.c_int, ctypes.c_char_p]
            self.lib.td_receive.argtypes = [ctypes.c_double]
            self.lib.td_receive.restype = ctypes.c_char_p
            self.lib.td_execute.argtypes = [ctypes.c_char_p]
            self.lib.td_execute.restype = ctypes.c_char_p
            self.client = self.lib.td_create_client_id()
        else:
            self.lib.td_json_client_create.restype = ctypes.c_void_p
            self.lib.td_json_client_send.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
            self.lib.td_json_client_receive.argtypes = [ctypes.c_void_p, ctypes.c_double]
            self.lib.td_json_client_receive.restype = ctypes.c_char_p
            self.lib.td_json_client_execute.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
            self.lib.td_json_client_execute.restype = ctypes.c_char_p
            self.lib.td_json_client_destroy.argtypes = [ctypes.c_void_p]
            self.client = self.lib.td_json_client_create()
        self.updates: list[dict] = []

    def close(self) -> None:
        if not self.new_api and self.client:
            self.lib.td_json_client_destroy(self.client)
            self.client = None

    def _encode(self, payload: dict) -> bytes:
        return json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def send(self, payload: dict) -> None:
        raw = self._encode(payload)
        if self.new_api:
            self.lib.td_send(self.client, raw)
        else:
            self.lib.td_json_client_send(self.client, raw)

    def execute(self, payload: dict) -> dict | None:
        raw = self._encode(payload)
        if self.new_api:
            res = self.lib.td_execute(raw)
        else:
            res = self.lib.td_json_client_execute(self.client, raw)
        return json.loads(res.decode("utf-8")) if res else None

    def receive(self, timeout: float = 1.0) -> dict | None:
        if self.new_api:
            res = self.lib.td_receive(timeout)
        else:
            res = self.lib.td_json_client_receive(self.client, timeout)
        return json.loads(res.decode("utf-8")) if res else None

    def request(self, payload: dict, timeout: float = 20.0) -> dict:
        extra = str(uuid.uuid4())
        payload = dict(payload)
        payload["@extra"] = extra
        self.send(payload)
        deadline = time.time() + timeout
        while time.time() < deadline:
            event = self.receive(1.0)
            if not event:
                continue
            if event.get("@extra") == extra:
                if event.get("@type") == "error":
                    code = event.get("code")
                    message = event.get("message")
                    raise RuntimeError(f"TDLib error {code}: {message}")
                return event
            self.updates.append(event)
        raise TimeoutError(f"TDLib request timed out: {payload.get('@type')}")


def authorize(td: TdJsonClient, api_id: int, api_hash: str, phone: str, db_dir: Path, files_dir: Path) -> None:
    td.execute({"@type": "setLogVerbosityLevel", "new_verbosity_level": 1})
    db_dir.mkdir(parents=True, exist_ok=True)
    files_dir.mkdir(parents=True, exist_ok=True)
    td.send({"@type": "getAuthorizationState"})
    sent_parameters = False
    sent_encryption_key = False
    while True:
        event = td.receive(1.0)
        if not event:
            continue
        state = event.get("authorization_state") if event.get("@type") == "updateAuthorizationState" else event
        state_type = state.get("@type")
        if state_type == "authorizationStateWaitTdlibParameters":
            if sent_parameters:
                continue
            sent_parameters = True
            td.send({
                "@type": "setTdlibParameters",
                "use_test_dc": False,
                "database_directory": str(db_dir),
                "files_directory": str(files_dir),
                "database_encryption_key": "",
                "use_file_database": True,
                "use_chat_info_database": True,
                "use_message_database": True,
                "use_secret_chats": False,
                "api_id": api_id,
                "api_hash": api_hash,
                "system_language_code": "en",
                "device_model": platform.node() or "Windows",
                "system_version": platform.platform(),
                "application_version": "tg-chat-obs-layout tdlib probe",
            })
        elif state_type == "authorizationStateWaitEncryptionKey":
            if sent_encryption_key:
                continue
            sent_encryption_key = True
            td.send({"@type": "checkDatabaseEncryptionKey", "encryption_key": ""})
        elif state_type == "authorizationStateWaitPhoneNumber":
            value = phone or prompt_required("Telegram phone number for TDLib probe: ")
            td.send({"@type": "setAuthenticationPhoneNumber", "phone_number": value})
        elif state_type == "authorizationStateWaitCode":
            code = prompt_required("Telegram login code for TDLib probe: ")
            td.send({"@type": "checkAuthenticationCode", "code": code})
        elif state_type == "authorizationStateWaitPassword":
            password = password_required("Telegram 2FA password for TDLib probe: ")
            td.send({"@type": "checkAuthenticationPassword", "password": password})
        elif state_type == "authorizationStateWaitOtherDeviceConfirmation":
            print("[tdlib] confirm login in another Telegram client")
        elif state_type == "authorizationStateReady":
            return
        elif state_type == "authorizationStateClosed":
            raise RuntimeError("TDLib authorization closed")
        elif event.get("@type") == "error":
            if sent_parameters and event.get("message") == "Unexpected setTdlibParameters":
                td.send({"@type": "getAuthorizationState"})
                continue
            raise RuntimeError(f"TDLib auth error {event.get('code')}: {event.get('message')}")


def resolve_chat(td: TdJsonClient, *, link: str, chat_id: int) -> dict:
    if chat_id:
        return td.request({"@type": "getChat", "chat_id": chat_id})
    username = td_link_username(link)
    if username:
        return td.request({"@type": "searchPublicChat", "username": username})
    if link:
        info = td.request({"@type": "checkChatInviteLink", "invite_link": link})
        resolved = int(info.get("chat_id") or 0)
        if resolved:
            return td.request({"@type": "getChat", "chat_id": resolved})
        raise RuntimeError("Private invite link didn't expose chat_id. Pass --chat-id for a joined chat.")
    raise RuntimeError("Pass a public/private t.me link or --chat-id.")


def resolve_active_chat(td: TdJsonClient, *, link: str, chat_ids: list[int]) -> tuple[dict, int]:
    errors: list[str] = []
    for idx, chat_id in enumerate(chat_ids, 1):
        try:
            chat = resolve_chat(td, link="", chat_id=chat_id)
            group_call_id = get_video_chat_group_call_id(chat)
            print(f"[probe] chat candidate #{idx}: active_call={bool(group_call_id)}")
            if group_call_id:
                return chat, group_call_id
        except Exception as exc:
            errors.append(f"candidate #{idx}: {exc.__class__.__name__}")
            print(f"[probe] chat candidate #{idx}: error={exc.__class__.__name__}")
    if link:
        chat = resolve_chat(td, link=link, chat_id=0)
        return chat, get_video_chat_group_call_id(chat)
    suffix = f" Errors: {', '.join(errors)}" if errors else ""
    raise RuntimeError(f"No active TDLib video_chat.group_call_id found in chat candidates.{suffix}")


def get_video_chat_group_call_id(chat: dict) -> int:
    video_chat = chat.get("video_chat") or chat.get("videoChat") or {}
    return int(video_chat.get("group_call_id") or video_chat.get("groupCallId") or 0)


def collect_group_call_updates(td: TdJsonClient, group_call_id: int, wait_sec: float) -> list[dict]:
    participants: list[dict] = []
    try:
        td.request({"@type": "loadGroupCallParticipants", "group_call_id": group_call_id, "limit": 100}, timeout=5)
    except Exception as exc:
        print(f"[probe] loadGroupCallParticipants failed: {exc}")
    deadline = time.time() + wait_sec
    while time.time() < deadline:
        event = td.receive(0.5)
        if not event:
            continue
        td.updates.append(event)
        kind = event.get("@type")
        if kind == "updateGroupCallParticipant":
            participant = event.get("participant") or {}
            if int(event.get("group_call_id") or 0) == group_call_id:
                participants.append(participant)
        elif kind == "updateGroupCallParticipants":
            if int(event.get("group_call_id") or 0) == group_call_id:
                participants.extend(event.get("participants") or [])
    return participants


def video_summary(participant: dict) -> dict:
    def info(value):
        if not isinstance(value, dict):
            return None
        return {
            "endpoint_id": value.get("endpoint_id") or "",
            "is_paused": bool(value.get("is_paused")),
            "source_groups": value.get("source_groups") or [],
        }

    participant_id = participant.get("participant_id") or {}
    return {
        "participant_type": participant_id.get("@type"),
        "is_current_user": bool(participant.get("is_current_user")),
        "is_speaking": bool(participant.get("is_speaking")),
        "audio_source_id": participant.get("audio_source_id"),
        "video_info": info(participant.get("video_info")),
        "screen_sharing_video_info": info(participant.get("screen_sharing_video_info")),
    }


def save_segment(data_obj: dict, output_dir: Path, channel_id: int) -> Path | None:
    raw = data_obj.get("data")
    if not raw:
        return None
    if isinstance(raw, str):
        try:
            data = base64.b64decode(raw)
        except Exception:
            data = raw.encode("latin-1", errors="ignore")
    else:
        return None
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"tdlib_segment_channel_{channel_id}.bin"
    target.write_bytes(data)
    return target


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Probe TDLib videochat participant stream availability.")
    parser.add_argument("link", nargs="?", default=clean_env(os.getenv("TD_VIDEOCHAT_LINK")))
    parser.add_argument("--chat-id", type=int, default=0)
    parser.add_argument("--group-call-id", type=int, default=0)
    parser.add_argument("--dll", default=clean_env(os.getenv("TDLIB_JSON_DLL")) or str(DEFAULT_DLL))
    parser.add_argument("--db-dir", default=clean_env(os.getenv("TDLIB_DATABASE_DIR")) or str(DEFAULT_DB_DIR))
    parser.add_argument("--files-dir", default=clean_env(os.getenv("TDLIB_FILES_DIR")) or str(DEFAULT_FILES_DIR))
    parser.add_argument("--wait", type=float, default=5.0)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    api_id = int(clean_env(os.getenv("TD_API_ID")) or "0")
    api_hash = clean_env(os.getenv("TD_API_HASH"))
    phone = clean_env(os.getenv("TD_PHONE"))
    if not api_id or not api_hash:
        raise SystemExit("TD_API_ID and TD_API_HASH are required.")

    dll_path = Path(args.dll)
    if not dll_path.exists():
        raise SystemExit(f"tdjson DLL not found: {dll_path}")

    td = TdJsonClient(dll_path)
    try:
        authorize(td, api_id, api_hash, phone, Path(args.db_dir), Path(args.files_dir))
        print("[probe] TDLib authorized")
        group_call_id = int(args.group_call_id or 0)
        chat = None
        if not group_call_id:
            chat_ids = [int(args.chat_id)] if args.chat_id else clean_env_int_list("TD_CHAT_ID", "CHAT_ID", "VIDEOCHAT_LEVEL_CHAT_ID")
            chat, group_call_id = resolve_active_chat(td, link=args.link, chat_ids=chat_ids)
        if not group_call_id:
            raise RuntimeError("No active TDLib video_chat.group_call_id found.")
        print(f"[probe] group_call_id={group_call_id}")

        group_call = td.request({"@type": "getGroupCall", "group_call_id": group_call_id})
        print(
            "[probe] group_call "
            f"active={group_call.get('is_active')} "
            f"video_chat={group_call.get('is_video_chat')} "
            f"rtmp={group_call.get('is_rtmp_stream')} "
            f"joined={group_call.get('is_joined')} "
            f"need_rejoin={group_call.get('need_rejoin')} "
            f"participants={group_call.get('participant_count')}"
        )

        participants = collect_group_call_updates(td, group_call_id, args.wait)
        summaries = [video_summary(p) for p in participants]
        active = [s for s in summaries if s.get("video_info") or s.get("screen_sharing_video_info")]
        print(f"[probe] participant_updates={len(participants)} active_video_updates={len(active)}")
        for idx, item in enumerate(active[:10], 1):
            print(
                f"  - #{idx} current_user={item['is_current_user']} "
                f"video={bool(item['video_info'])} screen={bool(item['screen_sharing_video_info'])}"
            )

        streams = None
        try:
            streams = td.request({"@type": "getGroupCallStreams", "group_call_id": group_call_id}, timeout=8)
            stream_items = streams.get("streams") or []
            print(f"[probe] getGroupCallStreams returned {len(stream_items)} stream(s)")
        except Exception as exc:
            print(f"[probe] getGroupCallStreams failed: {exc}")

        segment_saved = None
        stream_items = streams.get("streams") if isinstance(streams, dict) else []
        if stream_items:
            first = stream_items[0]
            channel_id = int(first.get("channel_id") or first.get("channel") or 0)
            scale = int(first.get("scale") or 0)
            time_offset = int(first.get("time_offset") or first.get("time_offset_ms") or int(time.time() * 1000))
            if channel_id:
                for method in ("getGroupCallStreamSegment", "getVideoChatStreamSegment"):
                    try:
                        data_obj = td.request({
                            "@type": method,
                            "group_call_id": group_call_id,
                            "time_offset": time_offset,
                            "scale": scale,
                            "channel_id": channel_id,
                            "video_quality": {"@type": "groupCallVideoQualityThumbnail"},
                        }, timeout=10)
                        segment_saved = save_segment(data_obj, Path(args.output_dir), channel_id)
                        print(f"[probe] {method} saved={segment_saved}")
                        break
                    except Exception as exc:
                        print(f"[probe] {method} failed: {exc}")

        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        report = {
            "chat": {
                "id": chat.get("id") if chat else args.chat_id,
                "title": chat.get("title") if chat else "",
            },
            "group_call": group_call,
            "active_video_update_count": len(active),
            "active_video_summaries": active,
            "streams": streams,
            "segment_saved": str(segment_saved) if segment_saved else "",
        }
        report_path = output_dir / "last_probe.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[probe] report saved: {report_path}")
        if active and not stream_items:
            print("[probe] TDLib sees participant video info, but no stream segment channel was exposed.")
        return 0
    finally:
        td.close()


if __name__ == "__main__":
    raise SystemExit(main())
