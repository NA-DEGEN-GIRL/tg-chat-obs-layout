import asyncio
import argparse
import getpass
import html
import ipaddress
import json
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote, urlparse

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

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
TD_API_ID = os.getenv("TD_API_ID", "").strip()
TD_API_HASH = os.getenv("TD_API_HASH", "").strip()
TD_PHONE = os.getenv("TD_PHONE", "").strip()


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
level_store: dict[str, dict] = {}
level_store_mtime = 0.0
resolved_videochat_entity = None
invite_flood_wait_until = 0.0


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
    if value is None:
        raw = []
    elif isinstance(value, str):
        raw = value.replace(";", ",").split(",")
    elif isinstance(value, (list, tuple, set)):
        raw = value
    else:
        raw = [str(value)]
    roles: list[str] = []
    for item in raw:
        for part in str(item or "").replace(";", ",").split(","):
            role = part.strip().lower()
            if role and role not in roles:
                roles.append(role)
    return roles


def primary_role(roles: list[str]) -> str:
    return roles[0] if roles else ""


def merge_roles(*role_sets) -> list[str]:
    roles: list[str] = []
    for role_set in role_sets:
        for role in normalize_roles(role_set):
            if role not in roles:
                roles.append(role)
    return roles


def load_level_store() -> dict[str, dict]:
    try:
        raw = json.loads(LEVELS_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:
        print(f"[videochat] failed to load level store: {exc}", flush=True)
        return {}
    if not isinstance(raw, dict):
        return {}
    if isinstance(raw.get("users"), dict):
        source = raw["users"]
    else:
        # Backward-compatible import from the old {"id:123": 1} shape.
        source = raw
    users: dict[str, dict] = {}
    for key, value in source.items():
        if isinstance(value, dict):
            record = dict(value)
            try:
                record["level"] = max(1, min(99, int(record.get("level", 1))))
            except (TypeError, ValueError):
                record["level"] = 1
            roles = normalize_roles(record.get("roles"))
            legacy = str(record.get("role") or "").strip().lower()
            if legacy and legacy not in roles:
                roles.append(legacy)
            record["roles"] = roles
            record["role"] = primary_role(roles)
        else:
            try:
                level = max(1, min(99, int(value)))
            except (TypeError, ValueError):
                continue
            record = {"level": level, "role": "", "roles": []}
        users[str(key)] = record
    return users


def reload_level_store_if_changed() -> None:
    global level_store, level_store_mtime
    try:
        mtime = LEVELS_FILE.stat().st_mtime
    except FileNotFoundError:
        return
    if mtime <= level_store_mtime:
        return
    loaded = load_level_store()
    if not loaded and level_store:
        print("[videochat] ignored empty level store reload", flush=True)
        level_store_mtime = mtime
        return
    level_store = loaded
    level_store_mtime = mtime


def save_level_store() -> None:
    LEVELS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEVELS_FILE.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(
            {
                "version": 1,
                "users": level_store,
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    if LEVELS_FILE.exists() and LEVELS_FILE.stat().st_size > 0:
        backup = LEVELS_FILE.with_suffix(".bak")
        backup.write_text(LEVELS_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    tmp.replace(LEVELS_FILE)
    global level_store_mtime
    level_store_mtime = LEVELS_FILE.stat().st_mtime


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
    if user_id:
        return f"id:{user_id}"
    if username:
        return f"username:{username.lower()}"
    return f"name:{name}"


def level_for_participant(user_id: str, username: str, name: str, is_host: bool, explicit_level=None, roles=None) -> int:
    key = participant_level_key(user_id, username, name)
    stored = level_store.get(key)
    stored_roles = normalize_roles(stored.get("roles")) if isinstance(stored, dict) else []
    role_list = merge_roles(stored_roles, roles)
    if is_host:
        role_list = ["king"] + [role for role in role_list if role != "king"]
    role = primary_role(role_list)
    now = time.time()
    changed = False
    if key not in level_store:
        if role == "king":
            level = 99
        else:
            try:
                level = max(1, min(99, int(explicit_level)))
            except (TypeError, ValueError):
                level = 1
        level_store[key] = {
            "id": user_id,
            "username": username,
            "name": name,
            "role": role,
            "roles": role_list,
            "level": level,
            "first_seen_at": now,
            "updated_at": now,
        }
        changed = True
    else:
        record = level_store[key]
        if not isinstance(record, dict):
            record = {"level": 1}
            level_store[key] = record
            changed = True
        updates = {
            "id": user_id,
            "username": username,
            "name": name,
            "role": role,
            "roles": role_list,
        }
        for field, value in updates.items():
            if record.get(field) != value:
                record[field] = value
                changed = True
        if "first_seen_at" not in record:
            record["first_seen_at"] = now
            changed = True
        if role == "king":
            if record.get("level") != 99:
                record["level"] = 99
                changed = True
        else:
            try:
                record["level"] = max(1, min(99, int(record.get("level", 1))))
            except (TypeError, ValueError):
                record["level"] = 1
                changed = True
    if changed:
        level_store[key]["updated_at"] = now
        save_level_store()
    return int(level_store[key].get("level", 1))


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


def normalize_participants(items) -> list[dict]:
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
        level = level_for_participant(user_id, username, name, is_host, p.get("level"), roles=roles)
        rows.append({
            "id": user_id,
            "name": name,
            "username": username,
            "muted": bool(p.get("muted")),
            "video": bool(p.get("video")),
            "screen": bool(p.get("screen")),
            "avatar_url": str(p.get("avatar_url") or ""),
            "level": level,
            "level_label": str(p.get("level_label") or ""),
            "is_host": is_host,
            "role": role,
            "roles": roles,
        })
    return rows


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


async def set_videochat_snapshot(participants: list[dict], source: str = "telethon") -> None:
    global videochat_state
    videochat_state = {
        "type": "videochat_snapshot",
        "participants": normalize_participants(participants),
        "updated_at": time.time(),
        "source": source,
    }
    await broadcast(videochat_state)


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

    full = await client(functions.channels.GetFullChannelRequest(entity))
    call = getattr(full.full_chat, "call", None)
    if call is None:
        print("[videochat] no active call/livestream in ChannelFull.call", flush=True)
        return None
    print(
        f"[videochat] call found: id={getattr(call, 'id', None)} "
        f"access_hash={'yes' if getattr(call, 'access_hash', None) else 'no'}",
        flush=True,
    )
    return call


async def collect_participants(client, call, limit: int = 100) -> list[dict]:
    from telethon.tl import functions

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
            photo_path = ""
            if VIDEOCHAT_DOWNLOAD_PHOTOS and user is not None:
                photo_path = await download_profile_photo(client, user)
            rows.append({
                "id": str(user_id or ""),
                "name": name,
                "username": username,
                "muted": bool(getattr(participant, "muted", False)),
                "video": bool(getattr(participant, "video_joined", False)),
                "screen": bool(getattr(participant, "presentation", None)),
                "avatar_url": f"/avatars/{user_id}.jpg" if photo_path else "",
            })

        next_offset = getattr(result, "next_offset", "") or ""
        if not next_offset:
            break
        offset = next_offset
    return rows


async def run_telethon_watcher() -> None:
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

    last_snapshot = ""
    call = None
    while True:
        try:
            if call is None:
                call = await resolve_call(client, VIDEOCHAT_LINK)
                if call is None:
                    await set_videochat_snapshot([], source="telethon")
                    await asyncio.sleep(VIDEOCHAT_WATCH_INTERVAL)
                    continue
            rows = await collect_participants(client, call)
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
            await asyncio.sleep(max(VIDEOCHAT_WATCH_INTERVAL, 5.0))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global watcher_task, level_store, level_store_mtime, overlay_settings_state
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    level_store = load_level_store()
    overlay_settings_state = load_overlay_settings_state()
    try:
        level_store_mtime = LEVELS_FILE.stat().st_mtime
    except FileNotFoundError:
        level_store_mtime = 0.0
    watcher_task = asyncio.create_task(run_telethon_watcher(), name="videochat-telethon-watcher")
    try:
        yield
    finally:
        if watcher_task is not None:
            watcher_task.cancel()
            try:
                await watcher_task
            except asyncio.CancelledError:
                pass


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


@app.get("/api/send/status")
async def proxy_send_status(request: Request):
    return await proxy_chat_api("GET", "/api/send/status", request)


@app.get("/api/users/search")
async def proxy_user_search(request: Request):
    return await proxy_chat_api("GET", "/api/users/search", request)


@app.post("/api/send")
async def proxy_send(request: Request):
    return await proxy_chat_api("POST", "/api/send", request)


@app.post("/api/message/delete")
async def proxy_delete(request: Request):
    return await proxy_chat_api("POST", "/api/message/delete", request)


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
    global videochat_state
    payload = await request.json()
    videochat_state = {
        "type": "videochat_snapshot",
        "participants": normalize_participants(payload.get("participants")),
        "updated_at": time.time(),
        "source": payload.get("source", "telethon"),
    }
    await broadcast(videochat_state)
    return {"ok": True, "participants": len(videochat_state["participants"])}


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
