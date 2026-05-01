import asyncio
import argparse
import base64
import getpass
import html
import ipaddress
import json
import os
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from urllib.parse import quote, urlparse

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

import level_system as level_core

if os.name == "nt":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except AttributeError:
        pass

load_dotenv()

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static_videochat"
SHARED_STATIC_DIR = BASE_DIR / "static_shared"
AVATARS_DIR = BASE_DIR / "data" / "telethon" / "profile_photos"
PHOTOS_DIR = BASE_DIR / "data" / "photos"
STICKERS_DIR = BASE_DIR / "data" / "stickers"
ANIMATIONS_DIR = BASE_DIR / "data" / "animations"
LEVELS_FILE = BASE_DIR / "data" / "videochat_levels.json"
OVERLAY_SETTINGS_FILE = BASE_DIR / "data" / "videochat_overlay_settings.json"
DIAGNOSTIC_LOG_FILE = BASE_DIR / "data" / "videochat_overlay_diag.log"

WEB_HOST = os.getenv("VIDEOCHAT_WEB_HOST", "127.0.0.1")
WEB_PORT = int(os.getenv("VIDEOCHAT_WEB_PORT", "9393"))
CHAT_WS_URL = os.getenv("VIDEOCHAT_CHAT_WS_URL", "ws://127.0.0.1:9292/ws").strip()
HOST_USER_ID = os.getenv("VIDEOCHAT_HOST_USER_ID", "").strip()
HOST_USERNAME = os.getenv("VIDEOCHAT_HOST_USERNAME", "").strip().lstrip("@")
HOST_NAME = os.getenv("VIDEOCHAT_HOST_NAME", "").strip()
HOST_AVATAR_FILE = os.getenv("VIDEOCHAT_HOST_AVATAR_FILE", "").strip()
VIDEOCHAT_LINK = os.getenv("TD_VIDEOCHAT_LINK", "").strip()
VIDEOCHAT_WATCH_ENABLED = os.getenv("VIDEOCHAT_WATCH_ENABLED", "1").strip() not in {
    "0", "false", "False", "no", "off"
}
VIDEOCHAT_WATCH_INTERVAL = max(1.5, float(os.getenv("VIDEOCHAT_WATCH_INTERVAL", "2")))
VIDEOCHAT_DOWNLOAD_PHOTOS = os.getenv("VIDEOCHAT_DOWNLOAD_PHOTOS", "1").strip() not in {
    "0", "false", "False", "no", "off"
}
VIDEOCHAT_DEBUG_SPEECH = os.getenv("VIDEOCHAT_DEBUG_SPEECH", "0").strip() in {
    "1", "true", "True", "yes", "on"
}
VIDEOCHAT_LEVEL_SYSTEM_ENABLED = level_core.env_bool(os.getenv("VIDEOCHAT_LEVEL_SYSTEM_ENABLED"), True)
VIDEOCHAT_STREAM_PREVIEW_ENABLED = level_core.env_bool(os.getenv("VIDEOCHAT_STREAM_PREVIEW_ENABLED"), False)
VIDEOCHAT_TGCALLS_PREVIEW_ENABLED = level_core.env_bool(os.getenv("VIDEOCHAT_TGCALLS_PREVIEW_ENABLED"), False)
VIDEOCHAT_TGCALLS_AUTO_JOIN = level_core.env_bool(os.getenv("VIDEOCHAT_TGCALLS_AUTO_JOIN"), True)
VIDEOCHAT_FORCE_EXIT_ON_SHUTDOWN = level_core.env_bool(os.getenv("VIDEOCHAT_FORCE_EXIT_ON_SHUTDOWN"), True)
VIDEOCHAT_DIAGNOSTICS_ENABLED = level_core.env_bool(os.getenv("VIDEOCHAT_DIAGNOSTICS_ENABLED"), True)
VIDEOCHAT_DIAG_INTERVAL_SEC = max(1.0, float(os.getenv("VIDEOCHAT_DIAG_INTERVAL_SEC", "5") or "5"))
VIDEOCHAT_STREAM_CHUNK_LIMIT = min(
    1_048_576,
    max(65_536, int(os.getenv("VIDEOCHAT_STREAM_CHUNK_LIMIT", "524288"))),
)
TD_API_ID = os.getenv("TD_API_ID", "").strip()
TD_API_HASH = os.getenv("TD_API_HASH", "").strip()
TD_PHONE = os.getenv("TD_PHONE", "").strip()
TGCALLS_SESSION = os.getenv("TGCALLS_SESSION", "data/telethon/videochat_receiver").strip()
TGCALLS_PHONE = os.getenv("TGCALLS_PHONE", "").strip()
TGCALLS_MJPEG_FPS = max(1, min(30, int(os.getenv("TGCALLS_MJPEG_FPS", "30") or "30")))
TGCALLS_MJPEG_QUALITY = max(35, min(95, int(os.getenv("TGCALLS_MJPEG_QUALITY", "82") or "82")))
TGCALLS_MJPEG_WIDTH = max(0, int(os.getenv("TGCALLS_MJPEG_WIDTH", "1280") or "1280"))
TGCALLS_MJPEG_HEIGHT = max(0, int(os.getenv("TGCALLS_MJPEG_HEIGHT", "720") or "720"))
TGCALLS_MJPEG_KEEPALIVE_SEC = max(1.0, min(15.0, float(os.getenv("TGCALLS_MJPEG_KEEPALIVE_SEC", "2.5") or "2.5")))


def chat_api_base() -> str:
    parsed = urlparse(CHAT_WS_URL)
    scheme = "https" if parsed.scheme == "wss" else "http"
    path = parsed.path.rsplit("/", 1)[0].rstrip("/")
    return f"{scheme}://{parsed.netloc}{path}"


CHAT_API_BASE = chat_api_base()

clients: set[WebSocket] = set()
clients_lock = asyncio.Lock()
videochat_state: dict = {
    "type": "videochat_snapshot",
    "participants": [],
    "updated_at": 0.0,
}
camera_state: dict = {
    "type": "videochat_camera",
    "updated_at": 0.0,
}
overlay_settings_state: dict = {
    "type": "videochat_overlay_settings",
    "settings": {},
    "updated_at": 0.0,
}
watcher_task: asyncio.Task | None = None
tgcalls_receiver_task: asyncio.Task | None = None
diagnostic_task: asyncio.Task | None = None
level_store: dict[str, dict] = {}
level_store_mtime = 0.0
level_system = level_core.LevelStore(
    LEVELS_FILE,
    enabled=VIDEOCHAT_LEVEL_SYSTEM_ENABLED,
    minimum=0,
    maximum=99,
)
pending_level_notifications: list[dict] = []
resolved_videochat_entity = None
invite_flood_wait_until = 0.0
telethon_client = None
videochat_call = None
stream_channels_state: dict = {
    "type": "videochat_streams",
    "channels": [],
    "supported": False,
    "reason": "not_checked",
    "updated_at": 0.0,
}
stream_channel_error = ""
stream_channel_supported = False
stream_channel_reason = "not_checked"
tgcalls_frame_state: dict[int, dict] = {}
tgcalls_jpeg_cache: dict[int, dict] = {}
tgcalls_jpeg_locks: dict[int, asyncio.Lock] = {}
tgcalls_mjpeg_active_clients = 0
tgcalls_mjpeg_total_clients = 0
tgcalls_mjpeg_encoded_frames = 0
tgcalls_mjpeg_last_encode_ms = 0.0
tgcalls_mjpeg_max_encode_ms = 0.0
tgcalls_joined_chat_id = 0
tgcalls_receiver_app = None
tgcalls_receiver_client = None
tgcalls_frame_handler_func = None
tgcalls_receiver_requested = VIDEOCHAT_TGCALLS_PREVIEW_ENABLED
tgcalls_receiver_status: dict = {
    "enabled": VIDEOCHAT_TGCALLS_PREVIEW_ENABLED,
    "running": False,
    "joined": False,
    "reason": "not_started",
    "updated_at": 0.0,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--link",
        default=None,
        help="Telegram video chat/live stream link. Overrides TD_VIDEOCHAT_LINK.",
    )
    return parser.parse_args()


def clean_env(value: str | None) -> str:
    if value is None:
        return ""
    if "#" in value:
        value = value.split("#", 1)[0]
    return value.strip().strip('"').strip("'")


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


def tgcalls_session_path() -> Path:
    raw = clean_env(TGCALLS_SESSION) or "data/telethon/videochat_receiver"
    path = Path(raw)
    if not path.is_absolute():
        path = BASE_DIR / path
    return path


def tgcalls_login_command() -> str:
    session = clean_env(TGCALLS_SESSION) or "data/telethon/videochat_receiver"
    return f"uv run python tgcalls_videochat_probe.py --session \"{session}\" --login-only"


def diagnostic_log(event: str, **fields) -> None:
    if not VIDEOCHAT_DIAGNOSTICS_ENABLED:
        return
    try:
        DIAGNOSTIC_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        row = {
            "ts": round(time.time(), 3),
            "event": event,
            **fields,
        }
        with DIAGNOSTIC_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    except Exception:
        pass


async def diagnostic_watchdog() -> None:
    last = time.monotonic()
    while True:
        await asyncio.sleep(VIDEOCHAT_DIAG_INTERVAL_SEC)
        now = time.monotonic()
        expected = last + VIDEOCHAT_DIAG_INTERVAL_SEC
        lag_ms = max(0.0, (now - expected) * 1000)
        last = now
        diagnostic_log(
            "watchdog",
            lag_ms=round(lag_ms, 1),
            tasks=len(asyncio.all_tasks()),
            mjpeg_active=tgcalls_mjpeg_active_clients,
            mjpeg_total=tgcalls_mjpeg_total_clients,
            jpeg_cache=len(tgcalls_jpeg_cache),
            encoded_frames=tgcalls_mjpeg_encoded_frames,
            last_encode_ms=round(tgcalls_mjpeg_last_encode_ms, 1),
            max_encode_ms=round(tgcalls_mjpeg_max_encode_ms, 1),
            tgcalls_requested=tgcalls_receiver_requested,
            tgcalls_joined=bool(tgcalls_joined_chat_id),
            tgcalls_reason=str(tgcalls_receiver_status.get("reason") or ""),
            frame_sources=len(tgcalls_frame_state),
        )
        if lag_ms >= 1000 or tgcalls_mjpeg_active_clients > 8:
            print(
                "[videochat:diag] "
                f"lag_ms={lag_ms:.0f} mjpeg_active={tgcalls_mjpeg_active_clients} "
                f"encoded={tgcalls_mjpeg_encoded_frames} max_encode_ms={tgcalls_mjpeg_max_encode_ms:.1f}",
                flush=True,
            )


def link_to_username(link: str) -> str:
    parsed = urlparse(link)
    host = parsed.netloc.lower()
    if host not in {"t.me", "telegram.me", "www.t.me", "www.telegram.me"}:
        raise RuntimeError(f"Unsupported link host: {parsed.netloc}")
    path = parsed.path.strip("/")
    if not path or path.startswith("+") or path.startswith("joinchat/"):
        raise RuntimeError("Expected a public t.me/<username> link")
    return path.split("/", 1)[0]


def link_to_invite_hash(link: str) -> str:
    parsed = urlparse(link)
    host = parsed.netloc.lower()
    if host not in {"t.me", "telegram.me", "www.t.me", "www.telegram.me"}:
        return ""
    path = parsed.path.strip("/")
    if path.startswith("+"):
        return path[1:]
    if path.startswith("joinchat/"):
        return path.split("/", 1)[1]
    return ""


def mock_avatar_urls() -> list[str]:
    if not AVATARS_DIR.exists():
        return []
    images = [
        path
        for path in AVATARS_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]
    images.sort(key=lambda path: path.name.lower())
    host = AVATARS_DIR / HOST_AVATAR_FILE if HOST_AVATAR_FILE else None
    if host and host.exists() and host.is_file():
        images = [host] + [path for path in images if path.name != host.name]
    return [f"/avatars/{quote(path.name)}" for path in images]


def normalize_roles(value) -> list[str]:
    return level_core.normalize_roles(value)


def primary_role(roles: list[str]) -> str:
    return level_core.primary_role(roles)


def merge_roles(*role_sets) -> list[str]:
    return level_core.merge_roles(*role_sets)


def load_level_store() -> dict[str, dict]:
    return level_system.load()


def reload_level_store_if_changed() -> None:
    global level_store, level_store_mtime
    if level_system.reload_if_changed():
        level_store = level_system.users
        level_store_mtime = level_system.mtime


def save_level_store() -> None:
    level_system.save()
    global level_store_mtime
    level_store_mtime = level_system.mtime


def load_overlay_settings_state() -> dict:
    try:
        raw = json.loads(OVERLAY_SETTINGS_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {
            "type": "videochat_overlay_settings",
            "settings": {},
            "updated_at": 0.0,
        }
    except Exception as exc:
        print(f"[videochat] failed to load overlay settings: {exc}", flush=True)
        return {
            "type": "videochat_overlay_settings",
            "settings": {},
            "updated_at": 0.0,
        }
    if not isinstance(raw, dict):
        raw = {}
    settings = raw.get("settings") if isinstance(raw.get("settings"), dict) else {}
    return {
        "type": "videochat_overlay_settings",
        "settings": settings,
        "updated_at": float(raw.get("updated_at") or 0.0),
        "client_id": str(raw.get("client_id") or ""),
    }


def save_overlay_settings_state() -> None:
    OVERLAY_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = OVERLAY_SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(
            {
                "version": 1,
                "settings": overlay_settings_state.get("settings") or {},
                "updated_at": overlay_settings_state.get("updated_at") or time.time(),
                "client_id": overlay_settings_state.get("client_id") or "",
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    tmp.replace(OVERLAY_SETTINGS_FILE)


async def set_overlay_settings(payload: dict) -> dict | None:
    global overlay_settings_state
    if not isinstance(payload, dict):
        return None
    raw_settings = payload.get("settings")
    if not isinstance(raw_settings, dict):
        return None
    overlay_settings_state = {
        "type": "videochat_overlay_settings",
        "settings": raw_settings,
        "updated_at": time.time(),
        "client_id": str(payload.get("client_id") or ""),
    }
    save_overlay_settings_state()
    await broadcast(overlay_settings_state)
    return overlay_settings_state


def participant_level_key(user_id: str, username: str, name: str) -> str:
    return level_core.level_key(user_id, username, name)


def level_for_participant(
    user_id: str,
    username: str,
    name: str,
    is_host: bool,
    explicit_level=None,
    roles=None,
    *,
    collect_notifications: bool = True,
) -> int:
    key = participant_level_key(user_id, username, name)
    stored = level_store.get(key)
    old_level = None
    last_notified_level = None
    if isinstance(stored, dict):
        try:
            old_level = int(stored.get("level", 0) or 0)
        except (TypeError, ValueError):
            old_level = None
        try:
            last_notified_level = int(stored.get("last_notified_level", 0) or 0)
        except (TypeError, ValueError):
            last_notified_level = 0
    stored_roles = normalize_roles(stored.get("roles")) if isinstance(stored, dict) else []
    role_list = merge_roles(stored_roles, roles)
    if is_host:
        role_list = ["king"] + [role for role in role_list if role != "king"]
    record, _changed = level_system.observe_profile(
        {
            "speaker_id": user_id,
            "username": username,
            "name": name,
            "is_host": is_host,
            "is_bot": "bot" in role_list,
            "roles": role_list,
        },
        source="videochat",
        explicit_level=explicit_level,
    )
    new_level = int(record.get("level", 0) or 0)
    if (
        collect_notifications
        and VIDEOCHAT_LEVEL_SYSTEM_ENABLED
        and old_level is not None
        and new_level > old_level
        and new_level > (last_notified_level or 0)
        and "bot" not in normalize_roles(record.get("roles"))
    ):
        pending_level_notifications.append({
            "level_key": key,
            "old_level": old_level,
            "new_level": new_level,
            "profile": {
                "name": record.get("name") or name,
                "username": record.get("username") or username,
                "speaker_id": record.get("id") or user_id,
                "roles": record.get("roles") or [],
            },
        })
    return new_level


async def broadcast(payload: dict) -> None:
    msg = json.dumps(payload, ensure_ascii=False)
    async with clients_lock:
        dead = []
        for ws in clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            clients.discard(ws)


def normalize_participants(items, *, collect_notifications: bool = True) -> list[dict]:
    reload_level_store_if_changed()
    rows = []
    for p in items or []:
        if not isinstance(p, dict):
            continue
        user_id = str(p.get("id") or p.get("user_id") or "")
        username = str(p.get("username") or "").lstrip("@")
        name = str(p.get("name") or username or user_id or "Unknown")
        is_host = (
            bool(HOST_USER_ID and user_id == HOST_USER_ID)
            or bool(HOST_USERNAME and username.lower() == HOST_USERNAME.lower())
            or bool(HOST_NAME and name.lower() == HOST_NAME.lower())
        )
        roles = normalize_roles(p.get("roles"))
        legacy_role = str(p.get("role") or "").strip().lower()
        if legacy_role and legacy_role not in roles:
            roles.append(legacy_role)
        if is_host:
            roles = ["king"] + [role for role in roles if role != "king"]
        stored = level_store.get(participant_level_key(user_id, username, name))
        if isinstance(stored, dict):
            roles = merge_roles(stored.get("roles"), roles)
            if is_host:
                roles = ["king"] + [role for role in roles if role != "king"]
        role = primary_role(roles)
        level = level_for_participant(
            user_id,
            username,
            name,
            is_host,
            p.get("level"),
            roles=roles,
            collect_notifications=collect_notifications,
        )
        if VIDEOCHAT_LEVEL_SYSTEM_ENABLED:
            level_label = "Lv. 99" if is_host else (f"Lv. {level}" if level > 0 else "")
        else:
            level_label = ""
        rows.append({
            "id": user_id,
            "name": name,
            "username": username,
            "muted": bool(p.get("muted")),
            "video": bool(p.get("video")),
            "screen": bool(p.get("screen")),
            "video_sources": normalize_int_list(p.get("video_sources")),
            "screen_sources": normalize_int_list(p.get("screen_sources")),
            "stream": normalize_stream_info(p.get("stream")),
            "avatar_url": str(p.get("avatar_url") or ""),
            "level": level,
            "level_label": level_label,
            "level_system_enabled": VIDEOCHAT_LEVEL_SYSTEM_ENABLED,
            "is_host": is_host,
            "role": role,
            "roles": roles,
        })
    return rows


def normalize_int_list(value) -> list[int]:
    if not isinstance(value, list):
        return []
    out: list[int] = []
    for item in value:
        try:
            number = int(item)
        except (TypeError, ValueError):
            continue
        if number not in out:
            out.append(number)
    return out


def normalize_stream_info(value) -> dict:
    if not isinstance(value, dict):
        return {}
    if value.get("raw"):
        try:
            ssrc = int(value.get("ssrc"))
        except (TypeError, ValueError):
            return {}
        if ssrc <= 0:
            return {}
        kind = str(value.get("kind") or "video")
        return {
            "raw": True,
            "ssrc": ssrc,
            "kind": "screen" if kind == "screen" else "video",
            "url": str(value.get("url") or f"/api/videochat/tgcalls/frame/{ssrc}.json"),
            "mjpeg_url": str(value.get("mjpeg_url") or f"/api/videochat/tgcalls/mjpeg/{ssrc}"),
            "format": str(value.get("format") or "yuv420p"),
            "updated_at": float(value.get("updated_at") or 0),
        }
    try:
        channel = int(value.get("channel"))
        scale = int(value.get("scale", 0))
        time_ms = int(value.get("time_ms", 0))
    except (TypeError, ValueError):
        return {}
    if channel <= 0 or time_ms <= 0:
        return {}
    kind = str(value.get("kind") or "video")
    return {
        "channel": channel,
        "scale": max(0, scale),
        "time_ms": time_ms,
        "kind": "screen" if kind == "screen" else "video",
        "url": f"/api/videochat/streams/{channel}/chunk.mp4?scale={max(0, scale)}&time_ms={time_ms}",
    }


def participant_name_parts(user) -> tuple[str, str]:
    if user is None:
        return "Unknown", ""
    parts = [getattr(user, "first_name", "") or "", getattr(user, "last_name", "") or ""]
    name = " ".join(part for part in parts if part).strip()
    username = getattr(user, "username", None) or ""
    return name or username or f"user:{getattr(user, 'id', 'unknown')}", username


async def download_profile_photo(client, user) -> str:
    if user is None or getattr(user, "photo", None) is None:
        return ""
    user_id = getattr(user, "id", None)
    if user_id is None:
        return ""
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    target = AVATARS_DIR / f"{user_id}.jpg"
    if target.exists() and target.stat().st_size > 0:
        return str(target)
    saved = await client.download_profile_photo(user, file=str(target))
    return str(saved) if saved else ""


async def set_videochat_snapshot(participants: list[dict], source: str = "telethon", *, notify_levels: bool = True) -> None:
    global videochat_state
    pending_level_notifications.clear()
    normalized = normalize_participants(participants, collect_notifications=notify_levels)
    videochat_state = {
        "type": "videochat_snapshot",
        "participants": normalized,
        "updated_at": time.time(),
        "source": source,
    }
    await broadcast(videochat_state)
    if notify_levels:
        await notify_level_changes()


async def refresh_videochat_levels(source: str = "level_reload") -> None:
    level_system.load()
    await set_videochat_snapshot(videochat_state.get("participants") or [], source=source, notify_levels=False)


async def notify_level_changes() -> None:
    if not pending_level_notifications:
        return
    events = list(pending_level_notifications)
    pending_level_notifications.clear()

    def post_event(event: dict):
        data = json.dumps(event, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            f"{CHAT_API_BASE}/api/level/notify",
            data=data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=4) as res:
            res.read()

    for event in events:
        try:
            await asyncio.to_thread(post_event, event)
            level_key_value = str(event.get("level_key") or "")
            if level_key_value:
                level_system.mark_notified_level(level_key_value, int(event.get("new_level", 0) or 0))
        except Exception as exc:
            print(f"[videochat] level notify failed: {exc}", flush=True)


def normalize_camera_message(payload: dict) -> dict | None:
    if not isinstance(payload, dict):
        return None
    raw_type = str(payload.get("type") or "")
    if raw_type not in {"camera", "videochat_camera"}:
        return None

    out: dict = {
        "type": "videochat_camera",
        "updated_at": time.time(),
    }
    for key in ("reset", "yaw", "yaw_deg", "pitch", "pitch_deg", "distance", "height", "fov", "duration_ms"):
        if key in payload:
            out[key] = payload[key]

    target = payload.get("target")
    if isinstance(target, dict):
        out["target"] = {
            axis: target[axis]
            for axis in ("x", "y", "z")
            if axis in target
        }

    delta = payload.get("delta")
    if isinstance(delta, dict):
        clean_delta = {
            key: delta[key]
            for key in ("yaw", "yaw_deg", "pitch", "pitch_deg", "distance", "height", "fov")
            if key in delta
        }
        delta_target = delta.get("target")
        if isinstance(delta_target, dict):
            clean_delta["target"] = {
                axis: delta_target[axis]
                for axis in ("x", "y", "z")
                if axis in delta_target
            }
        if clean_delta:
            out["delta"] = clean_delta

    return out


async def set_camera_state(payload: dict) -> dict | None:
    global camera_state
    camera = normalize_camera_message(payload)
    if camera is None:
        return None
    camera_state = camera
    print(f"[videochat] camera control: {camera_state}", flush=True)
    await broadcast(camera_state)
    return camera_state


async def get_full_chat_for_call(client, entity):
    from telethon.tl import functions, types

    if isinstance(entity, types.Channel):
        return await client(functions.channels.GetFullChannelRequest(entity)), "ChannelFull.call"
    if isinstance(entity, types.Chat):
        return await client(functions.messages.GetFullChatRequest(entity.id)), "ChatFull.call"

    input_peer = await client.get_input_entity(entity)
    if isinstance(input_peer, types.InputPeerChannel):
        return await client(functions.channels.GetFullChannelRequest(input_peer)), "ChannelFull.call"
    if isinstance(input_peer, types.InputPeerChat):
        return await client(functions.messages.GetFullChatRequest(input_peer.chat_id)), "ChatFull.call"

    raise RuntimeError(f"Unsupported Telegram entity type for videochat: {type(entity).__name__}")


async def resolve_call(client, link: str):
    global invite_flood_wait_until, resolved_videochat_entity
    from telethon.errors import FloodWaitError, UserAlreadyParticipantError
    from telethon.tl import functions

    invite_hash = link_to_invite_hash(link)
    if invite_hash:
        if resolved_videochat_entity is not None:
            entity = resolved_videochat_entity
        else:
            now = time.time()
            if now < invite_flood_wait_until:
                wait_left = int(invite_flood_wait_until - now)
                print(f"[videochat] private invite check is rate-limited; retry in {wait_left}s", flush=True)
                return None
            print("[videochat] checking private invite link", flush=True)
            try:
                invite = await client(functions.messages.CheckChatInviteRequest(invite_hash))
            except FloodWaitError as exc:
                seconds = max(5, int(getattr(exc, "seconds", 60) or 60))
                invite_flood_wait_until = time.time() + seconds
                print(f"[videochat] private invite check rate-limited for {seconds}s", flush=True)
                return None
            entity = getattr(invite, "chat", None)
            if entity is None:
                title = getattr(invite, "title", "(unknown)")
                count = getattr(invite, "participants_count", None)
                print(
                    f"[videochat] invite visible but account is not a member: "
                    f"title={title!r} participants={count}",
                    flush=True,
                )
                return None
            try:
                entity = await client.get_entity(entity)
            except UserAlreadyParticipantError:
                pass
            resolved_videochat_entity = entity
    else:
        if resolved_videochat_entity is not None:
            entity = resolved_videochat_entity
        else:
            username = link_to_username(link)
            print(f"[videochat] resolving @{username}", flush=True)
            entity = await client.get_entity(username)
            resolved_videochat_entity = entity

    full, call_source = await get_full_chat_for_call(client, entity)
    call = getattr(full.full_chat, "call", None)
    if call is None:
        print(f"[videochat] no active call/livestream in {call_source}", flush=True)
        return None
    print(
        f"[videochat] call found: id={getattr(call, 'id', None)} "
        f"access_hash={'yes' if getattr(call, 'access_hash', None) else 'no'}",
        flush=True,
    )
    return call


async def collect_participants(client, call, limit: int = 100) -> list[dict]:
    from telethon.tl import functions

    def media_active(value) -> bool:
        return bool(value) and not bool(getattr(value, "paused", False))

    def video_sources(value) -> list[int]:
        out: list[int] = []
        for group in getattr(value, "source_groups", []) or []:
            for source in getattr(group, "sources", []) or []:
                try:
                    number = int(source)
                except (TypeError, ValueError):
                    continue
                if number not in out:
                    out.append(number)
        return out

    offset = ""
    users_by_id = {}
    rows: list[dict] = []
    while True:
        result = await client(
            functions.phone.GetGroupParticipantsRequest(
                call=call,
                ids=[],
                sources=[],
                offset=offset,
                limit=limit,
            )
        )
        for user in getattr(result, "users", []):
            users_by_id[user.id] = user

        for participant in list(getattr(result, "participants", []) or []):
            peer = getattr(participant, "peer", None)
            user_id = getattr(peer, "user_id", None)
            user = users_by_id.get(user_id)
            name, username = participant_name_parts(user)
            video_info = getattr(participant, "video", None)
            presentation_info = getattr(participant, "presentation", None)
            photo_path = ""
            if VIDEOCHAT_DOWNLOAD_PHOTOS and user is not None:
                photo_path = await download_profile_photo(client, user)
            rows.append({
                "id": str(user_id or ""),
                "name": name,
                "username": username,
                "muted": bool(getattr(participant, "muted", False)),
                "video": media_active(video_info),
                "screen": media_active(presentation_info),
                "video_sources": video_sources(video_info),
                "screen_sources": video_sources(presentation_info),
                "avatar_url": f"/avatars/{user_id}.jpg" if photo_path else "",
            })

        next_offset = getattr(result, "next_offset", "") or ""
        if not next_offset:
            break
        offset = next_offset
    return rows


async def collect_stream_channels(client, call) -> list[dict]:
    global stream_channel_error, stream_channel_supported, stream_channel_reason
    if not VIDEOCHAT_STREAM_PREVIEW_ENABLED or client is None or call is None:
        stream_channel_supported = False
        stream_channel_reason = "disabled_or_not_ready"
        return []
    if not bool(getattr(call, "rtmp_stream", False) or getattr(call, "stream_dc_id", None)):
        reason = "not_rtmp_livestream"
        stream_channel_error = reason
        stream_channel_supported = False
        stream_channel_reason = reason
        return []
    from telethon.tl import functions

    try:
        result = await client(functions.phone.GetGroupCallStreamChannelsRequest(call=call))
    except Exception as exc:
        message = f"{exc.__class__.__name__}: {exc}"
        if message != stream_channel_error:
            stream_channel_error = message
            print(f"[videochat] stream channels unavailable: {message}", flush=True)
        stream_channel_supported = False
        stream_channel_reason = message
        return []
    stream_channel_error = ""
    stream_channel_supported = True
    stream_channel_reason = ""
    channels: list[dict] = []
    for item in getattr(result, "channels", []) or []:
        try:
            channel = int(getattr(item, "channel"))
            scale = int(getattr(item, "scale", 0))
            last_timestamp_ms = int(getattr(item, "last_timestamp_ms", 0))
        except (TypeError, ValueError):
            continue
        if channel <= 0 or last_timestamp_ms <= 0:
            continue
        channels.append({
            "channel": channel,
            "scale": max(0, scale),
            "last_timestamp_ms": last_timestamp_ms,
        })
    if not channels:
        stream_channel_reason = "no_stream_channels"
    return channels


def attach_stream_channels(rows: list[dict], channels: list[dict]) -> None:
    global stream_channels_state
    stream_channels_state = {
        "type": "videochat_streams",
        "channels": channels,
        "supported": stream_channel_supported,
        "reason": stream_channel_reason,
        "updated_at": time.time(),
    }
    if not rows or not channels:
        return
    by_channel = {int(item["channel"]): item for item in channels if item.get("channel")}
    assigned: set[int] = set()
    for row in rows:
        row["stream"] = {}
        candidates: list[tuple[str, int]] = []
        if row.get("screen"):
            candidates.extend(("screen", source) for source in normalize_int_list(row.get("screen_sources")))
        if row.get("video"):
            candidates.extend(("video", source) for source in normalize_int_list(row.get("video_sources")))
        for kind, source in candidates:
            channel = by_channel.get(source)
            if not channel:
                continue
            row["stream"] = {
                "channel": channel["channel"],
                "scale": channel["scale"],
                "time_ms": channel["last_timestamp_ms"],
                "kind": kind,
            }
            assigned.add(channel["channel"])
            break

    active_rows = [row for row in rows if row.get("video") or row.get("screen")]
    unassigned_channels = [item for item in channels if item["channel"] not in assigned]
    if len(active_rows) == 1 and unassigned_channels and not active_rows[0].get("stream"):
        channel = unassigned_channels[0]
        active_rows[0]["stream"] = {
            "channel": channel["channel"],
            "scale": channel["scale"],
            "time_ms": channel["last_timestamp_ms"],
            "kind": "screen" if active_rows[0].get("screen") else "video",
        }


def frame_format_guess(frame_len: int, width: int, height: int) -> str:
    pixels = max(0, width) * max(0, height)
    if pixels <= 0:
        return "unknown"
    if frame_len == pixels * 3 // 2:
        return "yuv420p"
    if frame_len == pixels * 4:
        return "rgba"
    if frame_len == pixels * 3:
        return "rgb24"
    return "unknown"


def attach_tgcalls_streams(rows: list[dict]) -> None:
    if not tgcalls_receiver_requested or not tgcalls_frame_state:
        return
    for row in rows:
        candidates: list[tuple[str, int]] = []
        if row.get("screen"):
            candidates.extend(("screen", source) for source in normalize_int_list(row.get("screen_sources")))
        if row.get("video"):
            candidates.extend(("video", source) for source in normalize_int_list(row.get("video_sources")))
        for kind, source in candidates:
            frame = tgcalls_frame_state.get(int(source))
            if not frame:
                continue
            row["stream"] = {
                "raw": True,
                "ssrc": int(source),
                "kind": kind,
                "format": frame.get("format") or "yuv420p",
                "url": f"/api/videochat/tgcalls/frame/{int(source)}.json",
                "mjpeg_url": f"/api/videochat/tgcalls/mjpeg/{int(source)}",
                "updated_at": frame.get("updated_at", 0),
            }
            break


def encode_tgcalls_frame_jpeg(frame: dict) -> bytes:
    import cv2
    import numpy as np

    width = int(frame.get("width") or 0)
    height = int(frame.get("height") or 0)
    data = bytes(frame.get("data") or b"")
    if width <= 0 or height <= 0 or len(data) < width * height * 3 // 2:
        return b""
    yuv = np.frombuffer(data[: width * height * 3 // 2], dtype=np.uint8).reshape((height * 3 // 2, width))
    fmt = str(frame.get("format") or "yuv420p").lower()
    if fmt == "nv12":
        bgr = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR_NV12)
    else:
        bgr = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR_I420)
    target_w = TGCALLS_MJPEG_WIDTH
    target_h = TGCALLS_MJPEG_HEIGHT
    if target_w > 0 and target_h > 0 and (width != target_w or height != target_h):
        scale = min(target_w / width, target_h / height)
        resized_w = max(1, int(round(width * scale)))
        resized_h = max(1, int(round(height * scale)))
        resized = cv2.resize(bgr, (resized_w, resized_h), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        x = (target_w - resized_w) // 2
        y = (target_h - resized_h) // 2
        canvas[y:y + resized_h, x:x + resized_w] = resized
        bgr = canvas
    ok, encoded = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), TGCALLS_MJPEG_QUALITY])
    return encoded.tobytes() if ok else b""


async def get_cached_tgcalls_jpeg(ssrc: int, frame: dict) -> tuple[int, bytes]:
    global tgcalls_mjpeg_encoded_frames, tgcalls_mjpeg_last_encode_ms, tgcalls_mjpeg_max_encode_ms
    seq = int(frame.get("seq") or 0)
    cached = tgcalls_jpeg_cache.get(ssrc)
    if cached and int(cached.get("seq") or 0) == seq:
        return seq, bytes(cached.get("jpeg") or b"")
    lock = tgcalls_jpeg_locks.setdefault(ssrc, asyncio.Lock())
    async with lock:
        cached = tgcalls_jpeg_cache.get(ssrc)
        if cached and int(cached.get("seq") or 0) == seq:
            return seq, bytes(cached.get("jpeg") or b"")
        started = time.perf_counter()
        jpeg = await asyncio.to_thread(encode_tgcalls_frame_jpeg, dict(frame))
        elapsed_ms = (time.perf_counter() - started) * 1000
        tgcalls_mjpeg_last_encode_ms = elapsed_ms
        tgcalls_mjpeg_max_encode_ms = max(tgcalls_mjpeg_max_encode_ms, elapsed_ms)
        if jpeg:
            tgcalls_mjpeg_encoded_frames += 1
            tgcalls_jpeg_cache[ssrc] = {
                "seq": seq,
                "jpeg": jpeg,
                "updated_at": time.time(),
            }
        return seq, jpeg


async def cleanup_tgcalls_receiver(app, client, joined_chat_id: int = 0) -> None:
    if app is not None:
        if joined_chat_id:
            with suppress(Exception):
                await asyncio.wait_for(app.leave_call(joined_chat_id), timeout=3)
        with suppress(Exception):
            binding = getattr(app, "_binding", None)
            if binding is not None:
                for call_id in await asyncio.wait_for(binding.calls(), timeout=2):
                    with suppress(Exception):
                        await asyncio.wait_for(binding.stop(call_id), timeout=2)
        with suppress(Exception):
            if tgcalls_frame_handler_func is not None:
                app.remove_handler(tgcalls_frame_handler_func)
        with suppress(Exception):
            callbacks = getattr(app, "_callbacks", None)
            if callbacks is not None:
                callbacks.clear()
        with suppress(Exception):
            executor = getattr(app, "executor", None)
            if executor is not None:
                executor.shutdown(wait=False, cancel_futures=True)
    if client is not None:
        with suppress(Exception):
            await asyncio.wait_for(client.disconnect(), timeout=3)


async def run_tgcalls_receiver() -> None:
    global tgcalls_joined_chat_id, tgcalls_receiver_status, tgcalls_receiver_app, tgcalls_receiver_client, tgcalls_frame_handler_func
    if not tgcalls_receiver_requested:
        return
    try:
        from pytgcalls import PyTgCalls
        from pytgcalls import filters
        from pytgcalls.types import Device, Direction, GroupCallConfig, RecordStream, StreamFrames
    except Exception as exc:
        tgcalls_receiver_status = {
            "enabled": True,
            "running": False,
            "joined": False,
            "reason": f"py-tgcalls unavailable: {exc.__class__.__name__}",
            "updated_at": time.time(),
        }
        print(f"[videochat:tgcalls] unavailable: {exc}", flush=True)
        return

    candidates = clean_env_int_list("TGCALLS_CHAT_IDS", "TD_CHAT_ID", "CHAT_ID", "VIDEOCHAT_LEVEL_CHAT_ID")
    if not candidates:
        tgcalls_receiver_status = {
            "enabled": True,
            "running": False,
            "joined": False,
            "reason": "no_chat_candidates",
            "updated_at": time.time(),
        }
        return

    try:
        from telethon import TelegramClient
    except ImportError:
        tgcalls_receiver_status = {
            "enabled": True,
            "running": False,
            "joined": False,
            "reason": "telethon_unavailable",
            "updated_at": time.time(),
        }
        return

    session_path = tgcalls_session_path()
    session_path.parent.mkdir(parents=True, exist_ok=True)
    client = TelegramClient(str(session_path), int(TD_API_ID), TD_API_HASH)
    tgcalls_receiver_client = client
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        tgcalls_receiver_status = {
            "enabled": True,
            "running": False,
            "joined": False,
            "reason": "login_required",
            "login_command": tgcalls_login_command(),
            "updated_at": time.time(),
        }
        print(
            "[videochat:tgcalls] receiver login required. "
            f"Run: {tgcalls_login_command()}",
            flush=True,
        )
        return

    app = PyTgCalls(client)
    tgcalls_receiver_app = app

    @app.on_update(filters.stream_frame(Direction.INCOMING, Device.CAMERA | Device.SCREEN))
    async def on_tgcalls_frame(_, update: StreamFrames):
        changed = False
        device_name = getattr(update.device, "name", str(update.device)).lower()
        kind = "screen" if device_name == "screen" else "video"
        for frame in update.frames:
            width = int(getattr(frame.info, "width", 0) or 0)
            height = int(getattr(frame.info, "height", 0) or 0)
            data = bytes(frame.frame or b"")
            if width <= 0 or height <= 0 or not data:
                continue
            ssrc = int(frame.ssrc)
            previous = tgcalls_frame_state.get(ssrc)
            tgcalls_frame_state[ssrc] = {
                "ssrc": ssrc,
                "seq": int((previous or {}).get("seq", 0) or 0) + 1,
                "kind": kind,
                "width": width,
                "height": height,
                "rotation": int(getattr(frame.info, "rotation", 0) or 0),
                "format": frame_format_guess(len(data), width, height),
                "data": data,
                "updated_at": time.time(),
            }
            if not previous:
                changed = True
        if changed and videochat_state.get("participants"):
            await set_videochat_snapshot(videochat_state.get("participants") or [], source="tgcalls_frame", notify_levels=False)
    tgcalls_frame_handler_func = on_tgcalls_frame

    await app.start()
    tgcalls_receiver_status = {
        "enabled": True,
        "running": True,
        "joined": False,
        "reason": "searching",
        "updated_at": time.time(),
    }
    print("[videochat:tgcalls] receiver started", flush=True)

    while True:
        try:
            if not tgcalls_joined_chat_id:
                last_error = ""
                for idx, candidate in enumerate(candidates, 1):
                    try:
                        await asyncio.wait_for(
                            app.play(candidate, stream=None, config=GroupCallConfig(auto_start=False)),
                            timeout=8,
                        )
                        tgcalls_joined_chat_id = candidate
                        tgcalls_receiver_status = {
                            "enabled": True,
                            "running": True,
                            "joined": True,
                            "reason": f"joined_candidate_{idx}",
                            "updated_at": time.time(),
                        }
                        print(f"[videochat:tgcalls] joined candidate #{idx}", flush=True)
                        break
                    except Exception as exc:
                        last_error = exc.__class__.__name__
                if not tgcalls_joined_chat_id:
                    tgcalls_receiver_status.update({
                        "joined": False,
                        "reason": f"no_active_call:{last_error}",
                        "updated_at": time.time(),
                    })
                    await asyncio.sleep(max(5.0, VIDEOCHAT_WATCH_INTERVAL))
                    continue
                await asyncio.wait_for(
                    app.record(tgcalls_joined_chat_id, RecordStream(audio=False, camera=True, screen=True)),
                    timeout=8,
                )
                print("[videochat:tgcalls] incoming camera/screen recording enabled", flush=True)
            await asyncio.sleep(1.0)
        except asyncio.CancelledError:
            joined_chat_id = tgcalls_joined_chat_id
            tgcalls_joined_chat_id = 0
            await cleanup_tgcalls_receiver(app, client, joined_chat_id)
            tgcalls_receiver_app = None
            tgcalls_receiver_client = None
            tgcalls_frame_handler_func = None
            raise
        except Exception as exc:
            tgcalls_receiver_status.update({
                "joined": False,
                "reason": f"{exc.__class__.__name__}: {exc}",
                "updated_at": time.time(),
            })
            print(f"[videochat:tgcalls] receiver error: {exc}", flush=True)
            tgcalls_joined_chat_id = 0
            await asyncio.sleep(max(5.0, VIDEOCHAT_WATCH_INTERVAL))


async def run_telethon_watcher() -> None:
    global telethon_client, videochat_call, stream_channel_supported, stream_channel_reason, tgcalls_receiver_task
    if not VIDEOCHAT_WATCH_ENABLED or not VIDEOCHAT_LINK:
        print("[videochat] watcher disabled or TD_VIDEOCHAT_LINK empty", flush=True)
        return
    if not TD_API_ID or not TD_API_HASH:
        print("[videochat] TD_API_ID/TD_API_HASH missing; watcher disabled", flush=True)
        return
    try:
        from telethon import TelegramClient
    except ImportError:
        print("[videochat] telethon is not installed; watcher disabled", flush=True)
        return

    session_dir = BASE_DIR / "data" / "telethon"
    session_dir.mkdir(parents=True, exist_ok=True)
    client = TelegramClient(str(session_dir / "videochat_overlay"), int(TD_API_ID), TD_API_HASH)
    await client.connect()
    telethon_client = client
    if not await client.is_user_authorized():
        phone = clean_env(TD_PHONE) or input("Telegram phone number: ").strip()
        await client.send_code_request(phone)
        code = input("Telegram login code: ").strip()
        try:
            await client.sign_in(phone=phone, code=code)
        except Exception as exc:
            if exc.__class__.__name__ != "SessionPasswordNeededError":
                raise
            password = getpass.getpass("Telegram 2FA password: ")
            await client.sign_in(password=password)

    if VIDEOCHAT_TGCALLS_PREVIEW_ENABLED and tgcalls_receiver_task is None:
        tgcalls_receiver_task = asyncio.create_task(run_tgcalls_receiver(), name="videochat-tgcalls-receiver")

    last_snapshot = ""
    call = None
    try:
        while True:
            try:
                if call is None:
                    call = await resolve_call(client, VIDEOCHAT_LINK)
                    videochat_call = call
                    if call is None:
                        await set_videochat_snapshot([], source="telethon")
                        await asyncio.sleep(VIDEOCHAT_WATCH_INTERVAL)
                        continue
                rows = await collect_participants(client, call)
                active_stream_rows = [row for row in rows if row.get("video") or row.get("screen")]
                if active_stream_rows and VIDEOCHAT_TGCALLS_AUTO_JOIN and (
                    tgcalls_receiver_task is None or tgcalls_receiver_task.done()
                ):
                    await start_tgcalls_receiver("auto_active_stream")
                if active_stream_rows:
                    channels = await collect_stream_channels(client, call)
                else:
                    stream_channel_supported = False
                    stream_channel_reason = "no_active_broadcaster"
                    channels = []
                attach_stream_channels(rows, channels)
                attach_tgcalls_streams(rows)
                snapshot = json.dumps(rows, ensure_ascii=False, sort_keys=True)
                if snapshot != last_snapshot:
                    last_snapshot = snapshot
                    print(f"[videochat] participants={len(rows)}", flush=True)
                    await set_videochat_snapshot(rows, source="telethon")
                await asyncio.sleep(VIDEOCHAT_WATCH_INTERVAL)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"[videochat] watcher error: {exc}", flush=True)
                call = None
                videochat_call = None
                await asyncio.sleep(max(VIDEOCHAT_WATCH_INTERVAL, 5.0))
    finally:
        telethon_client = None
        videochat_call = None
        with suppress(Exception):
            await asyncio.wait_for(client.disconnect(), timeout=3)


async def start_tgcalls_receiver(reason: str = "api") -> dict:
    global tgcalls_receiver_task, tgcalls_receiver_requested, tgcalls_receiver_status
    tgcalls_receiver_requested = True
    if tgcalls_receiver_task is not None and not tgcalls_receiver_task.done():
        return tgcalls_receiver_status
    tgcalls_receiver_status = {
        "enabled": True,
        "running": True,
        "joined": False,
        "reason": f"starting:{reason}",
        "updated_at": time.time(),
    }
    tgcalls_receiver_task = asyncio.create_task(run_tgcalls_receiver(), name="videochat-tgcalls-receiver")
    await asyncio.sleep(0)
    return tgcalls_receiver_status


async def stop_tgcalls_receiver(reason: str = "api") -> dict:
    global tgcalls_receiver_task, tgcalls_receiver_requested, tgcalls_receiver_status, tgcalls_joined_chat_id
    global tgcalls_receiver_app, tgcalls_receiver_client, tgcalls_frame_handler_func
    tgcalls_receiver_requested = False
    if tgcalls_receiver_task is not None and not tgcalls_receiver_task.done():
        tgcalls_receiver_task.cancel()
        try:
            await asyncio.wait_for(tgcalls_receiver_task, timeout=5)
        except asyncio.CancelledError:
            pass
        except asyncio.TimeoutError:
            print("[videochat:tgcalls] receiver did not stop within timeout", flush=True)
            await cleanup_tgcalls_receiver(tgcalls_receiver_app, tgcalls_receiver_client, tgcalls_joined_chat_id)
    tgcalls_receiver_task = None
    tgcalls_receiver_app = None
    tgcalls_receiver_client = None
    tgcalls_frame_handler_func = None
    tgcalls_joined_chat_id = 0
    tgcalls_frame_state.clear()
    tgcalls_jpeg_cache.clear()
    tgcalls_jpeg_locks.clear()
    tgcalls_receiver_status = {
        "enabled": False,
        "running": False,
        "joined": False,
        "reason": f"stopped:{reason}",
        "updated_at": time.time(),
    }
    return tgcalls_receiver_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    global watcher_task, tgcalls_receiver_task, diagnostic_task, level_store, level_store_mtime, overlay_settings_state
    global tgcalls_receiver_app, tgcalls_receiver_client, tgcalls_frame_handler_func, tgcalls_joined_chat_id
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    level_store = load_level_store()
    overlay_settings_state = load_overlay_settings_state()
    try:
        level_store_mtime = level_system.mtime or LEVELS_FILE.stat().st_mtime
    except FileNotFoundError:
        level_store_mtime = 0.0
    watcher_task = asyncio.create_task(run_telethon_watcher(), name="videochat-telethon-watcher")
    if VIDEOCHAT_DIAGNOSTICS_ENABLED:
        diagnostic_task = asyncio.create_task(diagnostic_watchdog(), name="videochat-diagnostic-watchdog")
        diagnostic_log("startup", port=WEB_PORT, auto_join=VIDEOCHAT_TGCALLS_AUTO_JOIN)
    try:
        yield
    finally:
        force_exit = False
        diagnostic_log("shutdown_begin")
        if diagnostic_task is not None:
            diagnostic_task.cancel()
            try:
                await asyncio.wait_for(diagnostic_task, timeout=2)
            except asyncio.CancelledError:
                pass
            except asyncio.TimeoutError:
                print("[videochat:diag] watchdog did not stop within timeout", flush=True)
        if watcher_task is not None:
            watcher_task.cancel()
            try:
                await asyncio.wait_for(watcher_task, timeout=5)
            except asyncio.CancelledError:
                pass
            except asyncio.TimeoutError:
                print("[videochat] watcher did not stop within timeout", flush=True)
        if tgcalls_receiver_task is not None:
            tgcalls_receiver_task.cancel()
            try:
                await asyncio.wait_for(tgcalls_receiver_task, timeout=5)
            except asyncio.CancelledError:
                pass
            except asyncio.TimeoutError:
                force_exit = True
                print("[videochat:tgcalls] receiver did not stop within timeout", flush=True)
                await cleanup_tgcalls_receiver(tgcalls_receiver_app, tgcalls_receiver_client, tgcalls_joined_chat_id)
        tgcalls_receiver_app = None
        tgcalls_receiver_client = None
        tgcalls_frame_handler_func = None
        tgcalls_joined_chat_id = 0
        if force_exit and VIDEOCHAT_FORCE_EXIT_ON_SHUTDOWN:
            print("[videochat] forcing process exit after shutdown timeout", flush=True)
            os._exit(0)


CACHE_BUSTER = str(int(time.time()))
_INDEX_HTML = (STATIC_DIR / "index.html").read_text(encoding="utf-8").replace(
    "{{CB}}", CACHE_BUSTER
)

app = FastAPI(lifespan=lifespan)
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
STICKERS_DIR.mkdir(parents=True, exist_ok=True)
ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/shared", StaticFiles(directory=str(SHARED_STATIC_DIR)), name="shared")
app.mount("/avatars", StaticFiles(directory=str(AVATARS_DIR)), name="avatars")
app.mount("/photos", StaticFiles(directory=str(PHOTOS_DIR)), name="photos")
app.mount("/stickers", StaticFiles(directory=str(STICKERS_DIR)), name="stickers")
app.mount("/animations", StaticFiles(directory=str(ANIMATIONS_DIR)), name="animations")


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(
        _INDEX_HTML,
        headers={"Cache-Control": "no-store, must-revalidate"},
    )


@app.get("/config")
async def get_config():
    return {
        "chat_ws_url": CHAT_WS_URL,
        "host_user_id": HOST_USER_ID,
        "host_username": HOST_USERNAME,
        "host_name": HOST_NAME,
        "mock_avatar_urls": mock_avatar_urls(),
        "debug_speech": VIDEOCHAT_DEBUG_SPEECH,
        "level_system_enabled": VIDEOCHAT_LEVEL_SYSTEM_ENABLED,
    }


async def proxy_chat_api(method: str, path: str, request: Request) -> JSONResponse:
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="local requests only")
    query = request.url.query
    url = f"{CHAT_API_BASE}{path}" + (f"?{query}" if query else "")
    body = await request.body() if method == "POST" else None

    def run_request():
        req = urllib.request.Request(
            url,
            data=body,
            method=method,
            headers={"Content-Type": "application/json"} if method == "POST" else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                raw = res.read().decode("utf-8")
                return res.status, json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(raw)
            except Exception:
                detail = raw or str(exc)
            return exc.code, detail
        except TimeoutError:
            return 504, {"ok": False, "detail": "chat API timeout"}
        except urllib.error.URLError as exc:
            return 504, {"ok": False, "detail": str(getattr(exc, "reason", exc))}

    status, payload = await asyncio.to_thread(run_request)
    return JSONResponse(payload, status_code=status)


def require_local_request(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="local requests only")


def validate_proxy_target(raw_url: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse((raw_url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="invalid url")
    host = parsed.hostname.strip().lower()
    if host in {"localhost"} or host.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="local target blocked")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="target lookup failed") from exc
    checked: set[str] = set()
    for info in infos:
        address = info[4][0]
        if address in checked:
            continue
        checked.add(address)
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid target address")
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(status_code=400, detail="private target blocked")
    return parsed


def inject_proxy_base(html_text: str, target_url: str) -> str:
    base = f'<base href="{html.escape(target_url, quote=True)}">'
    meta = '<meta name="referrer" content="no-referrer">'
    lower = html_text[:4096].lower()
    if "<head" in lower:
        full_lower = html_text.lower()
        insert_at = full_lower.find(">", full_lower.find("<head"))
        if insert_at >= 0:
            return html_text[:insert_at + 1] + base + meta + html_text[insert_at + 1:]
    return base + meta + html_text


def fetch_proxy_response(target_url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        target_url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as upstream:
            content_type = upstream.headers.get("content-type", "text/html; charset=utf-8")
            data = upstream.read(2_500_000)
    except urllib.error.HTTPError as exc:
        data = exc.read(256_000)
        content_type = exc.headers.get("content-type", "text/plain; charset=utf-8")
        if not data:
            data = f"upstream returned HTTP {exc.code}".encode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"proxy fetch failed: {exc}") from exc
    if "text/html" in content_type.lower():
        charset = "utf-8"
        parsed = content_type.lower().split("charset=", 1)
        if len(parsed) == 2:
            charset = parsed[1].split(";", 1)[0].strip() or "utf-8"
        text = data.decode(charset, errors="replace")
        data = inject_proxy_base(text, target_url).encode("utf-8")
        content_type = "text/html; charset=utf-8"
    return data, content_type


@app.get("/api/link/proxy")
async def api_link_proxy(request: Request, url: str = ""):
    require_local_request(request)
    parsed = validate_proxy_target(url)
    target_url = urllib.parse.urlunparse(parsed)
    data, content_type = await asyncio.to_thread(fetch_proxy_response, target_url)
    return Response(
        data,
        headers={
            "Content-Type": content_type,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


@app.get("/api/link/x-preview")
async def api_link_x_preview(request: Request, url: str = ""):
    require_local_request(request)
    target = f"{CHAT_API_BASE}/api/link/x-preview?{urllib.parse.urlencode({'url': url})}"

    def run_request():
        req = urllib.request.Request(target, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return res.status, res.headers.get("content-type", "text/html; charset=utf-8"), res.read(2_000_000)
        except urllib.error.HTTPError as exc:
            data = exc.read(512_000)
            return exc.code, exc.headers.get("content-type", "text/plain; charset=utf-8"), data

    status, content_type, data = await asyncio.to_thread(run_request)
    return Response(
        data,
        status_code=status,
        headers={
            "Content-Type": content_type,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


@app.get("/api/link/readable")
async def api_link_readable(request: Request, url: str = ""):
    require_local_request(request)
    target = f"{CHAT_API_BASE}/api/link/readable?{urllib.parse.urlencode({'url': url})}"

    def run_request():
        req = urllib.request.Request(target, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return res.status, res.headers.get("content-type", "text/html; charset=utf-8"), res.read(2_000_000)
        except urllib.error.HTTPError as exc:
            data = exc.read(512_000)
            return exc.code, exc.headers.get("content-type", "text/plain; charset=utf-8"), data

    status, content_type, data = await asyncio.to_thread(run_request)
    return Response(
        data,
        status_code=status,
        headers={
            "Content-Type": content_type,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


@app.get("/api/send/status")
async def proxy_send_status(request: Request):
    return await proxy_chat_api("GET", "/api/send/status", request)


@app.get("/api/users/search")
async def proxy_user_search(request: Request):
    return await proxy_chat_api("GET", "/api/users/search", request)


@app.get("/api/emoji/recent")
async def proxy_emoji_recent(request: Request):
    return await proxy_chat_api("GET", "/api/emoji/recent", request)


@app.get("/api/custom_emoji/{custom_id}/meta")
async def proxy_custom_emoji_meta(custom_id: str, request: Request):
    return await proxy_chat_api("GET", f"/api/custom_emoji/{custom_id}/meta", request)


@app.post("/api/sticker/preview")
async def proxy_sticker_preview(request: Request):
    return await proxy_chat_api("POST", "/api/sticker/preview", request)


@app.post("/api/send")
async def proxy_send(request: Request):
    return await proxy_chat_api("POST", "/api/send", request)


@app.post("/api/message/delete")
async def proxy_delete(request: Request):
    return await proxy_chat_api("POST", "/api/message/delete", request)


@app.get("/api/fire/settings")
async def proxy_fire_settings(request: Request):
    return await proxy_chat_api("GET", "/api/fire/settings", request)


@app.post("/api/fire/settings")
async def proxy_fire_settings_update(request: Request):
    return await proxy_chat_api("POST", "/api/fire/settings", request)


@app.get("/api/videochat/streams")
async def get_videochat_streams(request: Request):
    require_local_request(request)
    return {
        **stream_channels_state,
        "tgcalls": {
            **tgcalls_receiver_status,
            "sources": [
                {
                    "ssrc": key,
                    "kind": value.get("kind"),
                    "width": value.get("width"),
                    "height": value.get("height"),
                    "format": value.get("format"),
                    "updated_at": value.get("updated_at"),
                }
                for key, value in sorted(tgcalls_frame_state.items())
            ],
        },
    }


@app.get("/api/videochat/tgcalls/status")
async def get_tgcalls_status(request: Request):
    require_local_request(request)
    return {
        **tgcalls_receiver_status,
        "requested": tgcalls_receiver_requested,
        "login_command": tgcalls_receiver_status.get("login_command") or tgcalls_login_command(),
        "sources": len(tgcalls_frame_state),
    }


@app.post("/api/videochat/tgcalls/start")
async def post_tgcalls_start(request: Request):
    require_local_request(request)
    status = await start_tgcalls_receiver("api")
    return {
        **status,
        "requested": tgcalls_receiver_requested,
        "login_command": status.get("login_command") or tgcalls_login_command(),
        "sources": len(tgcalls_frame_state),
    }


@app.post("/api/videochat/tgcalls/stop")
async def post_tgcalls_stop(request: Request):
    require_local_request(request)
    status = await stop_tgcalls_receiver("api")
    return {
        **status,
        "requested": tgcalls_receiver_requested,
        "login_command": tgcalls_login_command(),
        "sources": len(tgcalls_frame_state),
    }


async def mjpeg_frame_generator(ssrc: int, request: Request):
    global tgcalls_mjpeg_active_clients, tgcalls_mjpeg_total_clients
    boundary = b"--frame\r\n"
    delay = 1.0 / max(1, TGCALLS_MJPEG_FPS)
    last_seq = -1
    last_sent_at = 0.0
    tgcalls_mjpeg_active_clients += 1
    tgcalls_mjpeg_total_clients += 1
    diagnostic_log(
        "mjpeg_open",
        ssrc=int(ssrc),
        active=tgcalls_mjpeg_active_clients,
        total=tgcalls_mjpeg_total_clients,
    )
    try:
        while True:
            if await request.is_disconnected():
                break
            frame = tgcalls_frame_state.get(int(ssrc))
            if not frame:
                await asyncio.sleep(delay)
                continue
            seq = int(frame.get("seq") or 0)
            now = time.monotonic()
            if seq == last_seq and now - last_sent_at < TGCALLS_MJPEG_KEEPALIVE_SEC:
                await asyncio.sleep(delay)
                continue
            try:
                last_seq, jpeg = await get_cached_tgcalls_jpeg(int(ssrc), frame)
            except Exception as exc:
                print(f"[videochat:tgcalls] mjpeg encode failed: {exc}", flush=True)
                await asyncio.sleep(delay)
                continue
            if not jpeg:
                await asyncio.sleep(delay)
                continue
            yield (
                boundary
                + b"Content-Type: image/jpeg\r\n"
                + f"Content-Length: {len(jpeg)}\r\n".encode("ascii")
                + b"Cache-Control: no-store\r\n\r\n"
                + jpeg
                + b"\r\n"
            )
            last_sent_at = time.monotonic()
            await asyncio.sleep(delay)
    finally:
        tgcalls_mjpeg_active_clients = max(0, tgcalls_mjpeg_active_clients - 1)
        diagnostic_log("mjpeg_close", ssrc=int(ssrc), active=tgcalls_mjpeg_active_clients)


@app.get("/api/videochat/tgcalls/mjpeg/{ssrc}")
async def get_tgcalls_mjpeg(ssrc: int, request: Request):
    require_local_request(request)
    if int(ssrc) not in tgcalls_frame_state:
        raise HTTPException(status_code=404, detail="frame not available")
    return StreamingResponse(
        mjpeg_frame_generator(int(ssrc), request),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )


@app.get("/api/videochat/tgcalls/frame/{ssrc}.json")
async def get_tgcalls_frame(ssrc: int, request: Request):
    require_local_request(request)
    frame = tgcalls_frame_state.get(int(ssrc))
    if not frame:
        raise HTTPException(status_code=404, detail="frame not available")
    return JSONResponse(
        {
            "ssrc": int(ssrc),
            "kind": frame.get("kind") or "video",
            "width": frame.get("width") or 0,
            "height": frame.get("height") or 0,
            "rotation": frame.get("rotation") or 0,
            "format": frame.get("format") or "yuv420p",
            "updated_at": frame.get("updated_at") or 0,
            "data": base64.b64encode(frame.get("data") or b"").decode("ascii"),
        },
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@app.get("/api/videochat/streams/{channel}/chunk.mp4")
async def get_videochat_stream_chunk(channel: int, request: Request, scale: int = 0, time_ms: int = 0):
    require_local_request(request)
    if not VIDEOCHAT_STREAM_PREVIEW_ENABLED:
        raise HTTPException(status_code=404, detail="stream preview disabled")
    if telethon_client is None or videochat_call is None:
        raise HTTPException(status_code=503, detail="videochat watcher not ready")
    if channel <= 0 or time_ms <= 0:
        raise HTTPException(status_code=400, detail="invalid stream position")
    from telethon.tl import functions, types

    location = types.InputGroupCallStream(
        call=videochat_call,
        time_ms=int(time_ms),
        scale=max(0, int(scale)),
        video_channel=int(channel),
    )
    try:
        result = await telethon_client(
            functions.upload.GetFileRequest(
                location=location,
                offset=0,
                limit=VIDEOCHAT_STREAM_CHUNK_LIMIT,
                precise=True,
                cdn_supported=False,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"stream chunk unavailable: {exc}") from exc
    data = getattr(result, "bytes", b"") or b""
    if not data:
        raise HTTPException(status_code=404, detail="empty stream chunk")
    return Response(
        content=data,
        media_type="video/mp4",
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Accept-Ranges": "none",
            "X-Videochat-Stream-Channel": str(channel),
            "X-Videochat-Stream-Time": str(time_ms),
        },
    )


@app.get("/api/videochat/state")
async def get_videochat_state():
    return videochat_state


@app.get("/api/videochat/camera")
async def get_camera_state():
    return camera_state


@app.get("/api/videochat/settings")
async def get_overlay_settings(request: Request):
    require_local_request(request)
    return overlay_settings_state


@app.post("/api/videochat/settings")
async def post_overlay_settings(request: Request):
    require_local_request(request)
    payload = await request.json()
    settings = await set_overlay_settings(payload)
    return {"ok": settings is not None, "settings": settings}


@app.post("/api/videochat/camera")
async def post_camera_state(request: Request):
    payload = await request.json()
    camera = await set_camera_state(payload)
    return {"ok": camera is not None, "camera": camera}


@app.post("/api/videochat/snapshot")
async def post_videochat_snapshot(request: Request):
    payload = await request.json()
    await set_videochat_snapshot(payload.get("participants"), source=payload.get("source", "telethon"))
    return {"ok": True, "participants": len(videochat_state["participants"])}


@app.post("/api/videochat/levels/reload")
async def post_videochat_levels_reload(request: Request):
    require_local_request(request)
    await refresh_videochat_levels()
    return {
        "ok": True,
        "participants": len(videochat_state["participants"]),
        "snapshot": videochat_state,
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    async with clients_lock:
        clients.add(ws)
    if videochat_state["participants"]:
        await ws.send_text(json.dumps(videochat_state, ensure_ascii=False))
    if camera_state.get("updated_at"):
        await ws.send_text(json.dumps(camera_state, ensure_ascii=False))
    if overlay_settings_state.get("settings"):
        await ws.send_text(json.dumps(overlay_settings_state, ensure_ascii=False))
    try:
        while True:
            text = await ws.receive_text()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            if payload.get("type") == "videochat_overlay_settings":
                await set_overlay_settings(payload)
            elif payload.get("type") == "chat_control":
                await broadcast(payload)
            else:
                await set_camera_state(payload)
    except WebSocketDisconnect:
        pass
    finally:
        async with clients_lock:
            clients.discard(ws)


if __name__ == "__main__":
    args = parse_args()
    if args.link:
        VIDEOCHAT_LINK = args.link.strip()
    print(f"[INFO] Videochat overlay: http://{WEB_HOST}:{WEB_PORT}/", flush=True)
    if VIDEOCHAT_LINK:
        print(f"[INFO] Videochat link: {VIDEOCHAT_LINK}", flush=True)
    uvicorn.run(app, host=WEB_HOST, port=WEB_PORT, log_level="warning")
