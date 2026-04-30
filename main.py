import asyncio
import base64
import colorsys
import getpass
import hashlib
import html
import io
import json
import os
import sys
import threading
import time
from typing import Any
from contextlib import asynccontextmanager
from pathlib import Path

import telebot
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from telebot.types import ChatPermissions

from stt import STTManager

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
CHAT_ID = int(os.getenv("CHAT_ID", "0"))
OWNER_ID = int(os.getenv("OWNER_ID", "0"))
WEB_HOST = os.getenv("WEB_HOST", "127.0.0.1")
WEB_PORT = int(os.getenv("WEB_PORT", "9292"))
FADE_AFTER_SEC = int(os.getenv("FADE_AFTER_SEC", "30"))
CHAT_FONT_SIZE = int(os.getenv("CHAT_FONT_SIZE", "22"))
VIDEOCHAT_HOST_USER_ID = int(os.getenv("VIDEOCHAT_HOST_USER_ID", "0") or "0")
VIDEOCHAT_HOST_USERNAME = os.getenv("VIDEOCHAT_HOST_USERNAME", "").strip().lstrip("@")
VIDEOCHAT_HOST_NAME = os.getenv("VIDEOCHAT_HOST_NAME", "").strip()
VIDEOCHAT_LEVEL_CHAT_ID = int(os.getenv("VIDEOCHAT_LEVEL_CHAT_ID", "0") or "0")
VIDEOCHAT_BOT_NAMES = {
    x.strip().lower()
    for x in os.getenv("VIDEOCHAT_BOT_NAMES", "na_stream_bot").split(",")
    if x.strip()
}
TD_API_ID = os.getenv("TD_API_ID", "").strip()
TD_API_HASH = os.getenv("TD_API_HASH", "").strip()
TD_PHONE = os.getenv("TD_PHONE", "").strip()

STT_PROVIDER = os.getenv("STT_PROVIDER", "openai").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
STT_MODEL_OPENAI = os.getenv("STT_MODEL_OPENAI", "gpt-4o-mini-transcribe").strip()
STT_MODEL_GEMINI = os.getenv("STT_MODEL_GEMINI", "gemini-3.1-flash-live-preview").strip()
STT_LANGUAGE = os.getenv("STT_LANGUAGE", "ko").strip()
STT_INPUT_DEVICE = os.getenv("STT_INPUT_DEVICE", "").strip()
STT_SEND_AS = os.getenv("STT_SEND_AS", "bot").strip().lower()
STT_AI_LABEL = os.getenv("STT_AI_LABEL", "0").strip() in {
    "1", "true", "True", "yes", "on"
}
STT_AI_LABEL_TEXT = os.getenv("STT_AI_LABEL_TEXT", "aiSTT").strip() or "aiSTT"
STT_SEND_AS_USER_FALLBACK_BOT = os.getenv("STT_SEND_AS_USER_FALLBACK_BOT", "1").strip() not in {
    "0", "false", "False", "no", "off"
}
TELEGRAM_USER_SEND_ENABLED = os.getenv("TELEGRAM_USER_SEND_ENABLED", "0").strip() in {
    "1", "true", "True", "yes", "on"
}
TELEGRAM_USER_SEND_PANEL = os.getenv("TELEGRAM_USER_SEND_PANEL", "0").strip() in {
    "1", "true", "True", "yes", "on"
}
TELEGRAM_USER_SEND_FALLBACK_BOT = os.getenv("TELEGRAM_USER_SEND_FALLBACK_BOT", "0").strip() in {
    "1", "true", "True", "yes", "on"
}
TELEGRAM_USER_SEND_MAX_CHARS = int(os.getenv("TELEGRAM_USER_SEND_MAX_CHARS", "1000") or "1000")
TELEGRAM_USER_SEND_MAX_PHOTO_MB = float(os.getenv("TELEGRAM_USER_SEND_MAX_PHOTO_MB", "8") or "8")

if not BOT_TOKEN:
    print("[ERROR] .env 의 BOT_TOKEN 이 비어 있습니다.", flush=True)
    sys.exit(1)
if CHAT_ID == 0:
    print("[ERROR] .env 의 CHAT_ID 가 설정되지 않았습니다.", flush=True)
    sys.exit(1)

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
COLORS_FILE = DATA_DIR / "user_colors.json"
STATE_FILE = DATA_DIR / "state.json"
VIDEOCHAT_LEVELS_FILE = DATA_DIR / "videochat_levels.json"
PHOTOS_DIR = DATA_DIR / "photos"
STICKERS_DIR = DATA_DIR / "stickers"
MAX_PHOTOS = 10
MAX_STICKERS = 30

# 어두운 반투명 배경에서 가독성 좋은 색만 추려낸 팔레트
USER_COLOR_PALETTE = [
    "#FF5C7A", "#35D9A8", "#6AA8FF", "#FFD166", "#C77DFF",
    "#FF8A3D", "#5DE2E7", "#B8E986", "#FF6FD8", "#A0B5FF",
    "#F4A261", "#4ADE80", "#F472B6", "#22D3EE", "#FACC15",
    "#A78BFA", "#FB7185", "#2DD4BF", "#60A5FA", "#C4E538",
    "#FB923C", "#E879F9", "#34D399", "#93C5FD", "#FDE68A",
    "#D946EF", "#F87171", "#10B981", "#38BDF8", "#EAB308",
]

bot = telebot.TeleBot(BOT_TOKEN)

# stream_on: 텍스트 + 사진만 허용, 그 외 전부 차단 (링크 미리보기 포함)
PERMS_STREAM_ON = ChatPermissions(
    can_send_messages=True,
    can_send_photos=True,
    can_send_audios=False,
    can_send_documents=False,
    can_send_videos=False,
    can_send_video_notes=False,
    can_send_voice_notes=False,
    can_send_polls=False,
    can_send_other_messages=False,
    can_add_web_page_previews=False,
)
# text_on: 텍스트만 허용 (사진도 차단). 방송 아닌 일반 대화용
PERMS_TEXT_ON = ChatPermissions(
    can_send_messages=True,
    can_send_photos=False,
    can_send_audios=False,
    can_send_documents=False,
    can_send_videos=False,
    can_send_video_notes=False,
    can_send_voice_notes=False,
    can_send_polls=False,
    can_send_other_messages=False,
    can_add_web_page_previews=False,
)
# stream_off: 모든 전송 차단 (호스트/관리자는 영향 없음)
PERMS_STREAM_OFF = ChatPermissions(
    can_send_messages=False,
    can_send_audios=False,
    can_send_documents=False,
    can_send_photos=False,
    can_send_videos=False,
    can_send_video_notes=False,
    can_send_voice_notes=False,
    can_send_polls=False,
    can_send_other_messages=False,
    can_add_web_page_previews=False,
)

clients: set[WebSocket] = set()
clients_lock = asyncio.Lock()
main_loop: asyncio.AbstractEventLoop | None = None

stt_manager: STTManager | None = None
bot_user_id: int | None = None
bot_display_name: str = "Bot"
stt_user_client = None
telegram_user_sender_id: str = ""

# 활성 댓글창 (한 번에 하나만). (chat_id, message_thread_id)
active_thread: tuple[int, int] | None = None
# STT 출력 목적지 목록. 각 항목: {"chat_id": int, "thread_id": int | None}
tts_destinations: list[dict] = []

_colors_lock = threading.Lock()
_user_colors: dict[str, str] = {}
_levels_lock = threading.Lock()
_level_store: dict[str, dict[str, Any]] = {}
_send_dedupe_lock = threading.Lock()
_send_dedupe: dict[tuple[str, str, str], dict[str, float | int]] = {}
SEND_DEDUPE_TTL_SEC = 8.0


def _hex_rgb(color: str) -> tuple[int, int, int] | None:
    value = str(color or "").strip()
    if not value.startswith("#") or len(value) != 7:
        return None
    try:
        return (
            int(value[1:3], 16),
            int(value[3:5], 16),
            int(value[5:7], 16),
        )
    except ValueError:
        return None


def _rgb_distance(a: str, b: str) -> float:
    ar = _hex_rgb(a)
    br = _hex_rgb(b)
    if ar is None or br is None:
        return 999.0 if a != b else 0.0
    return sum((x - y) ** 2 for x, y in zip(ar, br)) ** 0.5


def _generated_user_color(index: int) -> str:
    hue = ((index * 137.508) + 23) % 360
    saturation = 0.72 if index % 2 else 0.84
    lightness = 0.66 if index % 3 else 0.72
    r, g, b = colorsys.hls_to_rgb(hue / 360, lightness, saturation)
    return f"#{round(r * 255):02X}{round(g * 255):02X}{round(b * 255):02X}"


def _stable_hash(value: str) -> int:
    h = 2166136261
    for ch in str(value):
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _next_user_color(key: str, used: set[str]) -> str:
    for color in USER_COLOR_PALETTE:
        if color not in used and all(_rgb_distance(color, other) >= 72 for other in used):
            return color
    for color in USER_COLOR_PALETTE:
        if color not in used:
            return color

    seed = _stable_hash(key)
    for i in range(len(used), len(used) + 720):
        color = _generated_user_color(i + seed % 37)
        if color not in used and all(_rgb_distance(color, other) >= 48 for other in used):
            return color
    i = len(used)
    while True:
        color = _generated_user_color(i + seed)
        if color not in used:
            return color
        i += 1


def normalize_user_colors() -> bool:
    used: set[str] = set()
    changed = False
    for key in sorted(_user_colors, key=lambda x: (not x.lstrip("-").isdigit(), x)):
        color = str(_user_colors.get(key) or "").strip()
        if not color or color in used:
            color = _next_user_color(key, used)
            _user_colors[key] = color
            changed = True
        used.add(color)
    return changed


def load_user_colors() -> None:
    global _user_colors
    try:
        if COLORS_FILE.exists():
            _user_colors = json.loads(COLORS_FILE.read_text(encoding="utf-8"))
            if normalize_user_colors():
                save_user_colors()
    except Exception as e:
        print(f"[WARN] user_colors.json 로드 실패: {e}", flush=True)
        _user_colors = {}


def save_user_colors() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        COLORS_FILE.write_text(
            json.dumps(_user_colors, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[WARN] user_colors.json 저장 실패: {e}", flush=True)


def color_for(user_id: int) -> str:
    key = str(user_id)
    with _colors_lock:
        if key not in _user_colors:
            _user_colors[key] = _next_user_color(key, set(_user_colors.values()))
            save_user_colors()
        return _user_colors[key]


def load_level_store() -> None:
    global _level_store
    try:
        raw = json.loads(VIDEOCHAT_LEVELS_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        _level_store = {}
        return
    except Exception as e:
        print(f"[WARN] videochat_levels.json load failed: {e}", flush=True)
        _level_store = {}
        return
    source = raw.get("users") if isinstance(raw, dict) and isinstance(raw.get("users"), dict) else raw
    if not isinstance(source, dict):
        _level_store = {}
        return
    next_store: dict[str, dict[str, Any]] = {}
    for key, value in source.items():
        if isinstance(value, dict):
            record = dict(value)
        else:
            record = {"level": value}
        try:
            record["level"] = max(1, min(99, int(record.get("level", 1))))
        except (TypeError, ValueError):
            record["level"] = 1
        next_store[str(key)] = record
    _level_store = next_store


def save_level_store() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = VIDEOCHAT_LEVELS_FILE.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(
                {"version": 1, "users": _level_store},
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        tmp.replace(VIDEOCHAT_LEVELS_FILE)
    except Exception as e:
        print(f"[WARN] videochat_levels.json save failed: {e}", flush=True)


def level_key(user_id: str, username: str, name: str) -> str:
    if user_id:
        return f"id:{user_id}"
    if username:
        return f"username:{username.lower()}"
    return f"name:{name}"


def level_for_profile(profile: dict, explicit_level=None) -> int:
    if profile.get("is_host"):
        return 99
    user_id = str(profile.get("speaker_id") or "")
    username = str(profile.get("username") or "").lstrip("@")
    name = str(profile.get("name") or username or user_id or "Unknown")
    key = level_key(user_id, username, name)
    now = time.time()
    with _levels_lock:
        record = _level_store.get(key)
        changed = False
        if not isinstance(record, dict):
            try:
                level = max(1, min(99, int(explicit_level)))
            except (TypeError, ValueError):
                level = 1
            record = {
                "id": user_id,
                "username": username,
                "name": name,
                "level": level,
                "first_seen_at": now,
                "updated_at": now,
            }
            _level_store[key] = record
            changed = True
        else:
            for field, value in {"id": user_id, "username": username, "name": name}.items():
                if record.get(field) != value:
                    record[field] = value
                    changed = True
            if "first_seen_at" not in record:
                record["first_seen_at"] = now
                changed = True
            try:
                record["level"] = max(1, min(99, int(record.get("level", 1))))
            except (TypeError, ValueError):
                record["level"] = 1
                changed = True
        if changed:
            record["updated_at"] = now
            save_level_store()
        return int(record.get("level", 1))


def enrich_profile_level(profile: dict) -> dict:
    profile = dict(profile)
    if profile.get("is_host") is None:
        username = str(profile.get("username") or "")
        name = str(profile.get("name") or "")
        speaker_id = str(profile.get("speaker_id") or "")
        profile["is_host"] = (
            bool(VIDEOCHAT_HOST_USER_ID and speaker_id == str(VIDEOCHAT_HOST_USER_ID))
            or bool(VIDEOCHAT_HOST_USERNAME and username.lower().lstrip("@") == VIDEOCHAT_HOST_USERNAME.lower())
            or bool(VIDEOCHAT_HOST_NAME and name.lower() == VIDEOCHAT_HOST_NAME.lower())
        )
    profile["level"] = level_for_profile(profile)
    profile["level_label"] = "Lv. 99" if profile.get("is_host") else f"Lv. {profile['level']}"
    return profile


def load_state() -> dict:
    try:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] state.json 로드 실패: {e}", flush=True)
    return {}


def save_state(state: dict) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(
            json.dumps(state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[WARN] state.json 저장 실패: {e}", flush=True)


def update_state(**kwargs) -> None:
    s = load_state()
    s.update(kwargs)
    save_state(s)


def cleanup_media_dir(directory: Path, max_files: int, label: str) -> None:
    try:
        if not directory.exists():
            return
        files = [p for p in directory.iterdir() if p.is_file()]
        files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for old in files[max_files:]:
            try:
                old.unlink()
            except Exception:
                pass
    except Exception as e:
        print(f"[WARN] {label} cleanup failed: {e}", flush=True)


def cleanup_photos() -> None:
    cleanup_media_dir(PHOTOS_DIR, MAX_PHOTOS, "photo")


def cleanup_stickers() -> None:
    cleanup_media_dir(STICKERS_DIR, MAX_STICKERS, "sticker")


def display_name(user) -> str:
    if user is None:
        return "Unknown"
    name = user.first_name or ""
    if user.last_name:
        name = f"{name} {user.last_name}".strip()
    if not name:
        name = user.username or "Unknown"
    return name


def message_identity(message) -> tuple[str, int]:
    """메시지 작성자의 (표시이름, 색상키) 반환.
    채널 명의로 쓴 경우 sender_chat 의 title 사용.
    그룹 anonymous admin 도 동일 (sender_chat = 그룹 자체).
    """
    sc = getattr(message, "sender_chat", None)
    if sc is not None:
        title = (getattr(sc, "title", None) or "").strip()
        username = (getattr(sc, "username", None) or "").strip()
        if title:
            name = title
        elif username:
            name = f"@{username}"
        else:
            name = "Channel"
        return name, sc.id
    user = getattr(message, "from_user", None)
    if user is None:
        return "Unknown", 0
    return display_name(user), user.id


def message_profile(message) -> dict:
    sc = getattr(message, "sender_chat", None)
    if sc is not None:
        return {
            "name": (getattr(sc, "title", None) or getattr(sc, "username", None) or "Channel"),
            "speaker_id": str(sc.id),
            "username": (getattr(sc, "username", None) or ""),
        }
    user = getattr(message, "from_user", None)
    if user is None:
        return {"name": "Unknown", "speaker_id": "", "username": ""}
    username = (getattr(user, "username", None) or "").strip()
    if (
        (bot_user_id is not None and user.id == bot_user_id)
        or (username and username.lower() in VIDEOCHAT_BOT_NAMES)
    ):
        return host_speaker_payload()
    return {
        "name": display_name(user),
        "speaker_id": str(user.id),
        "username": username,
    }


def host_speaker_payload() -> dict:
    return {
        "name": VIDEOCHAT_HOST_NAME or bot_display_name,
        "speaker_id": str(VIDEOCHAT_HOST_USER_ID) if VIDEOCHAT_HOST_USER_ID else "",
        "username": VIDEOCHAT_HOST_USERNAME,
        "is_host": True,
    }


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


def _is_owner_in_target_chat(message) -> bool:
    return (
        message.chat.id == CHAT_ID
        and message.from_user is not None
        and message.from_user.id == OWNER_ID
    )


def _is_owner(message) -> bool:
    return message.from_user is not None and message.from_user.id == OWNER_ID


def _is_main_chat(message) -> bool:
    return message.chat.id == CHAT_ID


def _is_level_chat(message) -> bool:
    return VIDEOCHAT_LEVEL_CHAT_ID != 0 and message.chat.id == VIDEOCHAT_LEVEL_CHAT_ID


def _matches_active_thread(message) -> bool:
    at = active_thread
    if at is None:
        return False
    return (
        message.chat.id == at[0]
        and getattr(message, "message_thread_id", None) == at[1]
    )


def _is_overlay_source(message) -> bool:
    return _is_main_chat(message) or _is_level_chat(message) or _matches_active_thread(message)


def _clear_thread_tts_destinations() -> None:
    """thread 출력 목적지 제거. 메인 목적지는 유지."""
    tts_destinations[:] = [d for d in tts_destinations if d.get("thread_id") is None]


def _has_main_tts_destination() -> bool:
    return any(d.get("thread_id") is None for d in tts_destinations)


def mark_overlay_send_for_dedupe(kind: str, marker: str, count: int) -> None:
    sender_id = telegram_user_sender_id or str(VIDEOCHAT_HOST_USER_ID or "")
    key = (sender_id, kind, marker)
    if not sender_id or not marker or count <= 1:
        return
    now = time.monotonic()
    with _send_dedupe_lock:
        _send_dedupe[key] = {"remaining": count - 1, "expires": now + SEND_DEDUPE_TTL_SEC}


def should_skip_overlay_duplicate(profile: dict, kind: str, marker: str) -> bool:
    key = (str(profile.get("speaker_id") or ""), kind, marker)
    if not key[0]:
        return False
    now = time.monotonic()
    with _send_dedupe_lock:
        # Keep this tiny; it only tracks local web sends for a few seconds.
        expired = [k for k, v in _send_dedupe.items() if float(v.get("expires", 0)) <= now]
        for k in expired:
            _send_dedupe.pop(k, None)
        state = _send_dedupe.get(key)
        if not state:
            return False
        remaining = int(state.get("remaining", 0))
        if remaining <= 0:
            _send_dedupe.pop(key, None)
            return False
        remaining -= 1
        if remaining <= 0:
            _send_dedupe.pop(key, None)
        else:
            state["remaining"] = remaining
        return True


@bot.message_handler(commands=["stream_on"])
def cmd_stream_on(message):
    if not _is_owner_in_target_chat(message):
        return
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_STREAM_ON, use_independent_chat_permissions=True
        )
        bot.reply_to(message, "방송 시작: 텍스트/사진만 전송 가능")
        print("[INFO] stream_on: permissions opened", flush=True)
    except Exception as e:
        bot.reply_to(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] stream_on failed: {e}", flush=True)


@bot.message_handler(commands=["stream_off"])
def cmd_stream_off(message):
    if not _is_owner_in_target_chat(message):
        return
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_STREAM_OFF, use_independent_chat_permissions=True
        )
        bot.reply_to(message, "방송 종료: 호스트 외 메시지 전송 제한")
        print("[INFO] stream_off: permissions locked", flush=True)
    except Exception as e:
        bot.reply_to(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] stream_off failed: {e}", flush=True)


@bot.message_handler(commands=["text_on"])
def cmd_text_on(message):
    if not _is_owner_in_target_chat(message):
        return
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_TEXT_ON, use_independent_chat_permissions=True
        )
        bot.reply_to(message, "텍스트 전용 모드: 사진·미디어 차단, 텍스트만 허용")
        print("[INFO] text_on: text-only permissions applied", flush=True)
    except Exception as e:
        bot.reply_to(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] text_on failed: {e}", flush=True)


TG_DISPATCH_GAP_SEC = 0.15  # 텔레그램 flood control 회피용 송신 간 간격


def stt_label_payload() -> str:
    return STT_AI_LABEL_TEXT if STT_AI_LABEL else ""


def stt_telegram_message(text: str) -> tuple[str, str | None]:
    if not STT_AI_LABEL:
        return text, None
    return (
        f"{html.escape(text)} <i>{html.escape(STT_AI_LABEL_TEXT)}</i>",
        "HTML",
    )


async def ensure_telegram_user_client():
    global stt_user_client, telegram_user_sender_id
    if stt_user_client is not None and stt_user_client.is_connected():
        return stt_user_client
    if not TD_API_ID or not TD_API_HASH:
        raise RuntimeError("Telegram user send requires TD_API_ID and TD_API_HASH")
    try:
        from telethon import TelegramClient
    except ImportError as exc:
        raise RuntimeError("Telegram user send requires telethon") from exc

    session_dir = DATA_DIR / "telethon"
    session_dir.mkdir(parents=True, exist_ok=True)
    stt_user_client = TelegramClient(
        str(session_dir / "stt_sender"),
        int(TD_API_ID),
        TD_API_HASH,
    )
    await stt_user_client.connect()
    if not await stt_user_client.is_user_authorized():
        phone = TD_PHONE or input("Telegram phone number for STT sender: ").strip()
        await stt_user_client.send_code_request(phone)
        code = input("Telegram login code for STT sender: ").strip()
        try:
            await stt_user_client.sign_in(phone=phone, code=code)
        except Exception as exc:
            if exc.__class__.__name__ != "SessionPasswordNeededError":
                raise
            password = getpass.getpass("Telegram 2FA password for STT sender: ")
            await stt_user_client.sign_in(password=password)
    if not telegram_user_sender_id:
        try:
            me = await stt_user_client.get_me()
            telegram_user_sender_id = str(getattr(me, "id", "") or "")
        except Exception as exc:
            print(f"[WARN] Telegram user id lookup failed: {exc}", flush=True)
    return stt_user_client


async def ensure_stt_user_client():
    if STT_SEND_AS != "user":
        return None
    return await ensure_telegram_user_client()


async def send_stt_by_bot(dest: dict, text: str) -> None:
    message, parse_mode = stt_telegram_message(text)
    kwargs = {}
    if parse_mode:
        kwargs["parse_mode"] = parse_mode
    if dest.get("thread_id") is not None:
        # 채널 연결 토론 그룹의 댓글창은 forum 이 아니라서
        # message_thread_id 만으로는 댓글창에 안 들어감.
        # reply_to_message_id 로 포워딩된 원글에 reply 시키면
        # forum 토픽 / 댓글창 양쪽 모두 정확히 들어감.
        kwargs["reply_to_message_id"] = dest["thread_id"]
        kwargs["allow_sending_without_reply"] = True
    await asyncio.to_thread(bot.send_message, dest["chat_id"], message, **kwargs)


async def send_stt_by_user(dest: dict, text: str) -> None:
    client = await ensure_telegram_user_client()
    message, parse_mode = stt_telegram_message(text)
    kwargs = {}
    if parse_mode:
        kwargs["parse_mode"] = "html"
    if dest.get("thread_id") is not None:
        kwargs["reply_to"] = dest["thread_id"]
    await client.send_message(dest["chat_id"], message, **kwargs)


async def dispatch_stt_message(dest: dict, text: str) -> None:
    if STT_SEND_AS == "user":
        try:
            await send_stt_by_user(dest, text)
            return
        except Exception as exc:
            print(f"[STT] user dispatch failed dest={dest}: {exc}", flush=True)
            if not STT_SEND_AS_USER_FALLBACK_BOT:
                raise
    await send_stt_by_bot(dest, text)


def overlay_send_destinations(targets: list[str] | None = None) -> list[dict]:
    requested = set(targets or ["main"])
    dests = []
    if "main" in requested:
        dests.append({"chat_id": CHAT_ID, "thread_id": None, "target": "main"})
    if "here" in requested and active_thread is not None:
        dest = {"chat_id": active_thread[0], "thread_id": active_thread[1]}
        if dest not in dests:
            dest["target"] = "here"
            dests.append(dest)
    return dests


def detect_image_mime(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def normalize_photo_name(name: str, mime: str) -> str:
    clean = (name or "image").replace("\\", "_").replace("/", "_").strip() or "image"
    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }.get(mime, ".jpg")
    if clean.lower().endswith(ext):
        return clean[:120]
    stem = clean.rsplit(".", 1)[0] if "." in clean else clean
    return f"{stem[:100] or 'image'}{ext}"


def telegram_file_suffix(file_path: str, fallback: str) -> str:
    suffix = Path(str(file_path or "")).suffix.lower()
    if suffix and len(suffix) <= 12:
        return suffix
    return fallback


def decode_send_photo(value) -> dict | None:
    if not isinstance(value, dict):
        return None
    raw = str(value.get("data") or "")
    if not raw:
        return None
    if "," in raw and raw.split(",", 1)[0].startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid photo data") from exc
    max_bytes = max(1, int(TELEGRAM_USER_SEND_MAX_PHOTO_MB * 1024 * 1024))
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail="photo too large")
    client_mime = str(value.get("mime") or "")
    if client_mime and not client_mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="photo must be an image")
    mime = detect_image_mime(data)
    if not mime:
        raise HTTPException(status_code=400, detail="unsupported image")
    name = normalize_photo_name(str(value.get("name") or "image"), mime)
    return {
        "bytes": data,
        "name": name,
        "mime": mime,
        "sha256": hashlib.sha256(data).hexdigest(),
    }


async def send_plain_by_bot(dest: dict, text: str) -> None:
    kwargs = {}
    if dest.get("thread_id") is not None:
        kwargs["reply_to_message_id"] = dest["thread_id"]
        kwargs["allow_sending_without_reply"] = True
    await asyncio.to_thread(bot.send_message, dest["chat_id"], text, **kwargs)


def _named_bytes(data: bytes, filename: str) -> io.BytesIO:
    fp = io.BytesIO(data)
    fp.name = filename or "image.jpg"
    return fp


async def send_photo_by_bot(dest: dict, photo: dict, caption: str) -> None:
    kwargs = {}
    if dest.get("thread_id") is not None:
        kwargs["reply_to_message_id"] = dest["thread_id"]
        kwargs["allow_sending_without_reply"] = True
    await asyncio.to_thread(
        bot.send_photo,
        dest["chat_id"],
        _named_bytes(photo["bytes"], photo["name"]),
        caption=caption or None,
        **kwargs,
    )


async def send_plain_by_user(dest: dict, text: str) -> None:
    client = await ensure_telegram_user_client()
    kwargs = {}
    if dest.get("thread_id") is not None:
        kwargs["reply_to"] = dest["thread_id"]
    await client.send_message(dest["chat_id"], text, **kwargs)


async def send_photo_by_user(dest: dict, photo: dict, caption: str) -> None:
    client = await ensure_telegram_user_client()
    kwargs = {}
    if dest.get("thread_id") is not None:
        kwargs["reply_to"] = dest["thread_id"]
    await client.send_file(
        dest["chat_id"],
        _named_bytes(photo["bytes"], photo["name"]),
        caption=caption or None,
        **kwargs,
    )


async def dispatch_overlay_user_message(text: str, targets: list[str], photo: dict | None = None) -> list[dict]:
    results = []
    dests = overlay_send_destinations(targets)
    if not dests:
        return [{"ok": False, "error": "no selected destinations"}]
    try:
        await ensure_telegram_user_client()
    except Exception as exc:
        print(f"[SEND] user client unavailable: {exc}", flush=True)
        if not TELEGRAM_USER_SEND_FALLBACK_BOT:
            return [{"dest": dest, "ok": False, "via": "user", "error": str(exc)} for dest in dests]
    if text:
        mark_overlay_send_for_dedupe("text", text, len(dests))
    if photo:
        mark_overlay_send_for_dedupe("photo", photo["sha256"], len(dests))
    for i, dest in enumerate(dests):
        if i > 0:
            await asyncio.sleep(TG_DISPATCH_GAP_SEC)
        try:
            if photo:
                await send_photo_by_user(dest, photo, text)
            else:
                await send_plain_by_user(dest, text)
            results.append({"dest": dest, "ok": True, "via": "user"})
        except Exception as exc:
            print(f"[SEND] user dispatch failed dest={dest}: {exc}", flush=True)
            if not TELEGRAM_USER_SEND_FALLBACK_BOT:
                results.append({"dest": dest, "ok": False, "via": "user", "error": str(exc)})
                continue
            try:
                if photo:
                    await send_photo_by_bot(dest, photo, text)
                else:
                    await send_plain_by_bot(dest, text)
                results.append({"dest": dest, "ok": True, "via": "bot"})
            except Exception as bot_exc:
                results.append({"dest": dest, "ok": False, "via": "bot", "error": str(bot_exc)})
    return results


async def stt_on_text(text: str) -> None:
    host = enrich_profile_level(host_speaker_payload())
    print(f"[STT] {host['name']}: {text}", flush=True)

    color = color_for(VIDEOCHAT_HOST_USER_ID or bot_user_id or 0)
    try:
        await broadcast({
            "type": "text",
            "name": host["name"],
            "text": text,
            "color": color,
            "speaker_id": host["speaker_id"],
            "username": host["username"],
            "is_host": True,
            "level": host["level"],
            "level_label": host["level_label"],
            "stt_label": stt_label_payload(),
        })
    except Exception as e:
        print(f"[STT] overlay broadcast error: {e}", flush=True)

    dests = list(tts_destinations)
    for i, dest in enumerate(dests):
        if i > 0:
            await asyncio.sleep(TG_DISPATCH_GAP_SEC)
        try:
            await dispatch_stt_message(dest, text)
        except Exception as e:
            print(f"[STT] dispatch error dest={dest}: {e}", flush=True)


@bot.message_handler(commands=["tts_on"])
def cmd_tts_on(message):
    if not _is_owner(message):
        return
    if stt_manager is None or main_loop is None:
        bot.reply_to(message, "STT 매니저 초기화 전")
        return

    if _is_main_chat(message):
        dest = {"chat_id": CHAT_ID, "thread_id": None}
        scope = "메인 그룹"
    elif _matches_active_thread(message):
        at = active_thread
        dest = {"chat_id": at[0], "thread_id": at[1]}
        scope = "활성 댓글창"
    else:
        return  # 알 수 없는 위치 (메인도 아니고 활성 thread도 아님) — 무시

    if dest not in tts_destinations:
        tts_destinations.append(dest)

    if not stt_manager.active:
        fut = asyncio.run_coroutine_threadsafe(stt_manager.start(), main_loop)
        try:
            ok = fut.result(timeout=15)
            if not ok:
                if dest in tts_destinations:
                    tts_destinations.remove(dest)
                bot.reply_to(message, "STT 시작 실패 — 콘솔 로그 확인")
                return
        except Exception as e:
            if dest in tts_destinations:
                tts_destinations.remove(dest)
            bot.reply_to(message, f"시작 실패: {e}")
            print(f"[ERROR] tts_on: {e}", flush=True)
            return

    if dest["thread_id"] is None:
        update_state(tts_on=True)

    bot.reply_to(message, f"TTS 시작: {scope} 출력 활성")
    print(f"[INFO] tts_on dest={dest}", flush=True)


@bot.message_handler(commands=["tts_off"])
def cmd_tts_off(message):
    if not _is_owner(message):
        return
    if not (_is_main_chat(message) or _matches_active_thread(message)):
        return
    if stt_manager is None or main_loop is None:
        return

    tts_destinations.clear()
    update_state(tts_on=False)

    if stt_manager.active:
        fut = asyncio.run_coroutine_threadsafe(stt_manager.stop(), main_loop)
        try:
            fut.result(timeout=10)
        except Exception as e:
            print(f"[ERROR] tts_off stop: {e}", flush=True)

    bot.reply_to(message, "TTS 종료 (양쪽 모두 off)")
    print("[INFO] tts_off", flush=True)


@bot.message_handler(commands=["here_on"])
def cmd_here_on(message):
    if not _is_owner(message):
        return
    thread_id = getattr(message, "message_thread_id", None)
    if thread_id is None:
        bot.reply_to(message, "댓글창(thread) 안에서만 사용 가능합니다")
        return
    if _is_main_chat(message):
        bot.reply_to(message, "메인 그룹은 이미 표시 중 — here_on 불필요")
        return

    global active_thread
    new_thread = (message.chat.id, thread_id)

    # 이전 thread 와 다르면 이전 thread의 TTS 출력 정리
    if active_thread is not None and active_thread != new_thread:
        _clear_thread_tts_destinations()

    active_thread = new_thread
    bot.reply_to(
        message,
        f"이 댓글창 오버레이 활성화 (chat_id={message.chat.id}, thread={thread_id})",
    )
    print(f"[INFO] here_on: {new_thread}", flush=True)


@bot.message_handler(commands=["here_off"])
def cmd_here_off(message):
    if not _is_owner(message):
        return
    global active_thread
    if active_thread is None:
        bot.reply_to(message, "활성화된 댓글창 없음")
        return

    _clear_thread_tts_destinations()

    # thread 만 TTS 켜져 있던 상태였다면 STT 자체도 종료
    if (
        stt_manager is not None
        and stt_manager.active
        and not _has_main_tts_destination()
        and main_loop is not None
    ):
        fut = asyncio.run_coroutine_threadsafe(stt_manager.stop(), main_loop)
        try:
            fut.result(timeout=10)
        except Exception:
            pass
        update_state(tts_on=False)

    cleared = active_thread
    active_thread = None
    bot.reply_to(message, f"댓글창 해제 (이전: {cleared})")
    print(f"[INFO] here_off (cleared {cleared})", flush=True)


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["text"],
)
def on_text(message):
    profile = enrich_profile_level(message_profile(message))
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    text = message.text
    if should_skip_overlay_duplicate(profile, "text", text):
        print(f"[SEND] duplicate overlay echo skipped: {name}", flush=True)
        return
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    print(f"{name}: {text}", flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "text",
                "name": name,
                "text": text,
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
        )


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["photo"],
)
def on_photo(message):
    if not message.photo:
        return
    chosen = max(
        message.photo,
        key=lambda s: (getattr(s, "width", 0) or 0) * (getattr(s, "height", 0) or 0),
    )
    file_unique_id = chosen.file_unique_id
    try:
        PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
        target = PHOTOS_DIR / f"{file_unique_id}.jpg"
        if not target.exists():
            info = bot.get_file(chosen.file_id)
            data = bot.download_file(info.file_path)
            target.write_bytes(data)
        cleanup_photos()
    except Exception as e:
        print(f"[WARN] photo download failed: {e}", flush=True)
        return

    profile = enrich_profile_level(message_profile(message))
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    caption = str(getattr(message, "caption", None) or "").strip()
    try:
        photo_hash = hashlib.sha256(target.read_bytes()).hexdigest()
    except Exception:
        photo_hash = file_unique_id
    if should_skip_overlay_duplicate(profile, "photo", photo_hash):
        print(f"[SEND] duplicate photo overlay echo skipped: {name}", flush=True)
        return
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    url = f"/photos/{file_unique_id}.jpg"
    print(f"{name}: [photo] {url}" + (f" {caption}" if caption else ""), flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "photo",
                "name": name,
                "url": url,
                "text": caption,
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
        )


def sticker_thumb(message_sticker):
    return (
        getattr(message_sticker, "thumbnail", None)
        or getattr(message_sticker, "thumb", None)
    )


def download_sticker_display(message_sticker) -> tuple[Path, str] | None:
    STICKERS_DIR.mkdir(parents=True, exist_ok=True)
    unique_id = getattr(message_sticker, "file_unique_id", None) or hashlib.sha256(
        str(getattr(message_sticker, "file_id", "")).encode("utf-8")
    ).hexdigest()[:24]
    info = bot.get_file(message_sticker.file_id)
    file_path = getattr(info, "file_path", "") or ""
    suffix = telegram_file_suffix(
        file_path,
        ".webm" if getattr(message_sticker, "is_video", False) else ".webp",
    )
    is_tgs = suffix == ".tgs" or getattr(message_sticker, "is_animated", False)
    if is_tgs and not getattr(message_sticker, "is_video", False):
        thumb = sticker_thumb(message_sticker)
        if thumb is None:
            return None
        thumb_info = bot.get_file(thumb.file_id)
        thumb_suffix = telegram_file_suffix(getattr(thumb_info, "file_path", ""), ".jpg")
        target = STICKERS_DIR / f"{unique_id}_thumb{thumb_suffix}"
        if not target.exists():
            target.write_bytes(bot.download_file(thumb_info.file_path))
        return target, "image"

    target = STICKERS_DIR / f"{unique_id}{suffix}"
    if not target.exists():
        target.write_bytes(bot.download_file(file_path))
    media_type = "video" if suffix == ".webm" or getattr(message_sticker, "is_video", False) else "image"
    return target, media_type


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["sticker"],
)
def on_sticker(message):
    sticker = getattr(message, "sticker", None)
    if sticker is None:
        return
    try:
        downloaded = download_sticker_display(sticker)
        cleanup_stickers()
    except Exception as e:
        print(f"[WARN] sticker download failed: {e}", flush=True)
        return
    if downloaded is None:
        print("[WARN] animated sticker has no displayable thumbnail", flush=True)
        return

    target, media_type = downloaded
    profile = enrich_profile_level(message_profile(message))
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    url = f"/stickers/{target.name}"
    emoji = str(getattr(sticker, "emoji", None) or "").strip()
    print(f"{name}: [sticker] {url}" + (f" {emoji}" if emoji else ""), flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "sticker",
                "name": name,
                "url": url,
                "media_type": media_type,
                "text": emoji,
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
        )


def run_bot() -> None:
    try:
        bot.remove_webhook()
        me = bot.get_me()
        print(f"[INFO] Bot @{me.username} listening chat {CHAT_ID} ...", flush=True)
        bot.infinity_polling(skip_pending=True, timeout=30, long_polling_timeout=25)
    except Exception as e:
        print(f"[ERROR] Telegram polling stopped: {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop, stt_manager, bot_user_id, bot_display_name, stt_user_client
    main_loop = asyncio.get_running_loop()
    load_user_colors()
    load_level_store()

    t = threading.Thread(target=run_bot, daemon=True)
    t.start()

    try:
        me = await asyncio.to_thread(bot.get_me)
        bot_user_id = me.id
        bot_display_name = me.first_name or me.username or "Bot"
    except Exception as e:
        print(f"[WARN] bot.get_me 실패: {e}", flush=True)

    stt_manager = STTManager(
        cfg={
            "provider": STT_PROVIDER,
            "openai_api_key": OPENAI_API_KEY,
            "gemini_api_key": GEMINI_API_KEY,
            "openai_model": STT_MODEL_OPENAI,
            "gemini_model": STT_MODEL_GEMINI,
            "language": STT_LANGUAGE,
            "input_device": STT_INPUT_DEVICE,
        },
        loop=main_loop,
        on_text=stt_on_text,
    )

    state = load_state()
    if state.get("tts_on"):
        print("[INFO] 이전 세션 상태 복구: tts_on (메인) 자동 재시작", flush=True)
        try:
            ok = await stt_manager.start()
            if ok:
                tts_destinations.append({"chat_id": CHAT_ID, "thread_id": None})
            else:
                print("[WARN] tts_on 자동 재시작 실패 — 상태 초기화", flush=True)
                update_state(tts_on=False)
        except Exception as e:
            print(f"[WARN] tts_on 자동 재시작 예외: {e}", flush=True)
            update_state(tts_on=False)

    yield

    try:
        if stt_manager and stt_manager.active:
            await stt_manager.stop()
    except Exception:
        pass
    try:
        if stt_user_client is not None and stt_user_client.is_connected():
            await stt_user_client.disconnect()
    except Exception:
        pass
    try:
        bot.stop_polling()
    except Exception:
        pass


PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

CACHE_BUSTER = str(int(time.time()))
_INDEX_HTML = (STATIC_DIR / "index.html").read_text(encoding="utf-8").replace(
    "{{CB}}", CACHE_BUSTER
)

app = FastAPI(lifespan=lifespan)
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
STICKERS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/photos", StaticFiles(directory=str(PHOTOS_DIR)), name="photos")
app.mount("/stickers", StaticFiles(directory=str(STICKERS_DIR)), name="stickers")


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(
        _INDEX_HTML,
        headers={"Cache-Control": "no-store, must-revalidate"},
    )


@app.get("/config")
async def get_config():
    return {
        "fade_after_sec": FADE_AFTER_SEC,
        "chat_font_size": CHAT_FONT_SIZE,
        "user_send_enabled": TELEGRAM_USER_SEND_ENABLED,
        "user_send_panel": TELEGRAM_USER_SEND_PANEL,
        "user_send_max_chars": TELEGRAM_USER_SEND_MAX_CHARS,
        "user_send_max_photo_mb": TELEGRAM_USER_SEND_MAX_PHOTO_MB,
        "user_send_has_here": active_thread is not None,
        "videochat_host_user_id": str(VIDEOCHAT_HOST_USER_ID) if VIDEOCHAT_HOST_USER_ID else "",
        "videochat_host_username": VIDEOCHAT_HOST_USERNAME,
        "videochat_host_name": VIDEOCHAT_HOST_NAME,
        "videochat_bot_names": sorted(VIDEOCHAT_BOT_NAMES),
    }


@app.get("/api/send/status")
async def api_send_status():
    if not TELEGRAM_USER_SEND_ENABLED:
        raise HTTPException(status_code=404, detail="send disabled")
    return {
        "enabled": True,
        "targets": {
            "main": True,
            "here": active_thread is not None,
        },
        "max_chars": TELEGRAM_USER_SEND_MAX_CHARS,
        "max_photo_mb": TELEGRAM_USER_SEND_MAX_PHOTO_MB,
    }


@app.post("/api/send")
async def api_send_message(request: Request):
    if not TELEGRAM_USER_SEND_ENABLED:
        raise HTTPException(status_code=404, detail="send disabled")
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="local requests only")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid json") from exc

    text = str(payload.get("text") or "").strip()
    photo = decode_send_photo(payload.get("photo"))
    if not text and not photo:
        raise HTTPException(status_code=400, detail="empty message")
    if len(text) > TELEGRAM_USER_SEND_MAX_CHARS:
        raise HTTPException(status_code=400, detail="text too long")
    raw_targets = payload.get("targets")
    if not isinstance(raw_targets, list):
        raw_targets = []
    targets = [str(x) for x in raw_targets if str(x) in {"main", "here"}]
    if not targets:
        raise HTTPException(status_code=400, detail="no targets selected")

    results = await dispatch_overlay_user_message(text, targets, photo)
    ok = [r for r in results if r.get("ok")]
    if not ok:
        raise HTTPException(status_code=502, detail={"message": "send failed", "results": results})
    return {"ok": True, "sent": len(ok), "results": results}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    async with clients_lock:
        clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with clients_lock:
            clients.discard(ws)


if __name__ == "__main__":
    print(
        f"[INFO] Overlay: http://{WEB_HOST}:{WEB_PORT}/  (OBS Browser Source)",
        flush=True,
    )
    uvicorn.run(app, host=WEB_HOST, port=WEB_PORT, log_level="warning")
