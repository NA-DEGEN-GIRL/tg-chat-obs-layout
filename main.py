import asyncio
import base64
import colorsys
import getpass
import hashlib
import html
import io
import json
import math
import os
import ipaddress
import re
import socket
import secrets
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any
from contextlib import asynccontextmanager
from html.parser import HTMLParser
from pathlib import Path

import telebot
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from telebot.types import ChatPermissions, ReplyParameters

import level_system as level_core
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
VIDEOCHAT_LEVEL_SYSTEM_ENABLED = level_core.env_bool(os.getenv("VIDEOCHAT_LEVEL_SYSTEM_ENABLED"), True)
VIDEOCHAT_WEB_HOST = os.getenv("VIDEOCHAT_WEB_HOST", "127.0.0.1")
VIDEOCHAT_WEB_PORT = int(os.getenv("VIDEOCHAT_WEB_PORT", "9393") or "9393")
VIDEOCHAT_API_BASE = os.getenv("VIDEOCHAT_API_BASE", f"http://{VIDEOCHAT_WEB_HOST}:{VIDEOCHAT_WEB_PORT}").rstrip("/")
LEVEL_REASONS_FILE_ENV = os.getenv("LEVEL_REASONS_FILE", "").strip()
LEVEL_UP_TEMPLATE = os.getenv(
    "LEVEL_UP_TEMPLATE",
    "{name}(@{username}) 레벨 업! 현재 Lv. {level} - {reason}",
).strip() or "{name}(@{username}) 레벨 업! 현재 Lv. {level} - {reason}"
LEVEL_DOWN_TEMPLATE = os.getenv(
    "LEVEL_DOWN_TEMPLATE",
    "{name}(@{username}) 레벨 다운. 현재 Lv. {level}",
).strip() or "{name}(@{username}) 레벨 다운. 현재 Lv. {level}"
FORCE_LEVEL_UP_TEMPLATE = os.getenv(
    "FORCE_LEVEL_UP_TEMPLATE",
    "관리자가 {name}(@{username}) 레벨을 강제로 +{delta} 올렸습니다. 현재 Lv. {level}",
).strip() or "관리자가 {name}(@{username}) 레벨을 강제로 +{delta} 올렸습니다. 현재 Lv. {level}"
FORCE_LEVEL_DOWN_TEMPLATE = os.getenv(
    "FORCE_LEVEL_DOWN_TEMPLATE",
    "관리자가 {name}(@{username}) 레벨을 강제로 {delta} 내렸습니다. 현재 Lv. {level}",
).strip() or "관리자가 {name}(@{username}) 레벨을 강제로 {delta} 내렸습니다. 현재 Lv. {level}"
VIDEOCHAT_FIRE_USER_COOLDOWN_SEC = float(os.getenv("VIDEOCHAT_FIRE_USER_COOLDOWN_SEC", "3") or "3")
VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC = float(os.getenv("VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC", "1") or "1")
VIDEOCHAT_CHEER_DEFAULT_SEC = 5.0
VIDEOCHAT_CHEER_MAX_SEC = 600.0
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
TELEGRAM_USER_SEND_MAX_MEDIA_MB = float(os.getenv("TELEGRAM_USER_SEND_MAX_MEDIA_MB", "50") or "50")

if not BOT_TOKEN:
    print("[ERROR] .env 의 BOT_TOKEN 이 비어 있습니다.", flush=True)
    sys.exit(1)
if CHAT_ID == 0:
    print("[ERROR] .env 의 CHAT_ID 가 설정되지 않았습니다.", flush=True)
    sys.exit(1)

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
SHARED_STATIC_DIR = BASE_DIR / "static_shared"
DATA_DIR = BASE_DIR / "data"
COLORS_FILE = DATA_DIR / "user_colors.json"
STATE_FILE = DATA_DIR / "state.json"
VIDEOCHAT_LEVELS_FILE = DATA_DIR / "videochat_levels.json"
LEVEL_REASONS_FILE = Path(LEVEL_REASONS_FILE_ENV) if LEVEL_REASONS_FILE_ENV else DATA_DIR / "level_reasons.json"
PHOTOS_DIR = DATA_DIR / "photos"
STICKERS_DIR = DATA_DIR / "stickers"
ANIMATIONS_DIR = DATA_DIR / "animations"
EMOJI_CACHE_FILE = DATA_DIR / "emoji_cache.json"
MAX_PHOTOS = 10
MAX_STICKERS = 30
MAX_ANIMATIONS = 20
MAX_EMOJI_CACHE_ITEMS = 80

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
bot_username: str = ""
stt_user_client = None
telegram_user_sender_id: str = ""
telegram_delete_listener_registered = False
telegram_message_listener_registered = False
telegram_peer_cache: dict[int, Any] = {}

# 활성 댓글창 (한 번에 하나만). (chat_id, message_thread_id)
active_thread: tuple[int, int] | None = None
# STT 출력 목적지 목록. 각 항목: {"chat_id": int, "thread_id": int | None}
tts_destinations: list[dict] = []

_colors_lock = threading.Lock()
_user_colors: dict[str, str] = {}
_levels_lock = threading.Lock()
_level_store: dict[str, dict[str, Any]] = {}
_level_system = level_core.LevelStore(
    VIDEOCHAT_LEVELS_FILE,
    enabled=VIDEOCHAT_LEVEL_SYSTEM_ENABLED,
    minimum=0,
    maximum=99,
)
_fire_lock = threading.Lock()
_fire_last_global = 0.0
_fire_last_by_user: dict[str, float] = {}
_videochat_reload_warned = False
_emoji_cache_lock = threading.Lock()
_emoji_cache: dict[str, list[dict[str, Any]]] = {"stickers": [], "custom_emoji": []}
_recent_stickers_cache_lock = threading.Lock()
_recent_stickers_cache: list[dict[str, Any]] = []
_recent_stickers_cache_at = 0.0
RECENT_STICKERS_CACHE_TTL_SEC = 45.0
_custom_emoji_meta_cache_lock = threading.Lock()
_custom_emoji_meta_cache: dict[str, dict[str, Any]] = {}
_send_dedupe_lock = threading.Lock()
_send_dedupe: dict[tuple[str, str, str], dict[str, float | int]] = {}
SEND_DEDUPE_TTL_SEC = 8.0
_seen_message_lock = threading.Lock()
_seen_message_ids: dict[tuple[str, int], float] = {}
SEEN_MESSAGE_TTL_SEC = 300.0
DEFAULT_LEVEL_REASONS: dict[int, str] = {
    0: "기본 방문자",
    1: "커뮤니티 말하기 조건 만족",
    2: "비디오챗 접속 조건 만족",
    3: "비디오챗 응원 효과 사용",
    4: "응원봉과 폭죽 효과 모두 사용",
    99: "방장 고정 레벨",
}
_level_reasons: dict[int, str] = dict(DEFAULT_LEVEL_REASONS)


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
    _level_store = _level_system.load()


def reload_level_store_if_changed() -> None:
    global _level_store
    if _level_system.reload_if_changed():
        _level_store = _level_system.users


def save_level_store() -> None:
    try:
        _level_system.save()
    except Exception as e:
        print(f"[WARN] videochat_levels.json save failed: {e}", flush=True)


def load_level_reasons() -> None:
    global _level_reasons
    try:
        raw = json.loads(LEVEL_REASONS_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        _level_reasons = dict(DEFAULT_LEVEL_REASONS)
        return
    except Exception as e:
        print(f"[WARN] level_reasons.json load failed: {e}", flush=True)
        _level_reasons = dict(DEFAULT_LEVEL_REASONS)
        return
    source = raw.get("levels") if isinstance(raw, dict) and isinstance(raw.get("levels"), dict) else raw
    reasons = dict(DEFAULT_LEVEL_REASONS)
    if isinstance(source, dict):
        for key, value in source.items():
            try:
                level = int(key)
            except (TypeError, ValueError):
                continue
            if isinstance(value, dict):
                text = str(value.get("reason") or value.get("message") or "").strip()
            else:
                text = str(value or "").strip()
            if text:
                reasons[level] = text
    _level_reasons = reasons


def level_reason(level: int) -> str:
    return _level_reasons.get(int(level), "")


def ensure_level_reasons_file() -> None:
    if LEVEL_REASONS_FILE.exists():
        return
    try:
        LEVEL_REASONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        LEVEL_REASONS_FILE.write_text(
            json.dumps(
                {"version": 1, "levels": {str(k): {"reason": v} for k, v in DEFAULT_LEVEL_REASONS.items()}},
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[WARN] level_reasons.json init failed: {e}", flush=True)


def level_key(user_id: str, username: str, name: str) -> str:
    return level_core.level_key(user_id, username, name)


def normalize_roles(value) -> list[str]:
    return level_core.normalize_roles(value)


def primary_role(roles: list[str]) -> str:
    return level_core.primary_role(roles)


def roles_for_profile(profile: dict) -> list[str]:
    roles = normalize_roles(profile.get("roles"))
    legacy = str(profile.get("role") or "").strip().lower()
    if legacy and legacy not in roles:
        roles.append(legacy)
    auto_roles = auto_roles_for_profile(profile)
    return merge_roles(auto_roles, roles)


def is_host_profile(profile: dict) -> bool:
    if profile.get("is_bot"):
        return False
    username = str(profile.get("username") or "")
    name = str(profile.get("name") or "")
    speaker_id = str(profile.get("speaker_id") or "")
    return (
        bool(VIDEOCHAT_HOST_USER_ID and speaker_id == str(VIDEOCHAT_HOST_USER_ID))
        or bool(VIDEOCHAT_HOST_USERNAME and username.lower().lstrip("@") == VIDEOCHAT_HOST_USERNAME.lower())
        or bool(VIDEOCHAT_HOST_NAME and name.lower() == VIDEOCHAT_HOST_NAME.lower())
    )


def is_bot_profile(profile: dict) -> bool:
    username = str(profile.get("username") or "").lower().lstrip("@")
    name = str(profile.get("name") or "").lower()
    return bool(
        profile.get("is_bot")
        or (username and (username in VIDEOCHAT_BOT_NAMES or username.endswith("bot")))
        or (name and name in VIDEOCHAT_BOT_NAMES)
    )


def auto_roles_for_profile(profile: dict) -> list[str]:
    roles: list[str] = []
    if is_host_profile(profile):
        roles.append("king")
    if is_bot_profile(profile) and "bot" not in roles:
        roles.append("bot")
    return roles


def merge_roles(*role_sets) -> list[str]:
    return level_core.merge_roles(*role_sets)


def observe_level_for_profile(profile: dict, explicit_level=None) -> tuple[dict, int | None, int, int]:
    reload_level_store_if_changed()
    profile = dict(profile)
    profile["roles"] = roles_for_profile(profile)
    profile["role"] = primary_role(profile["roles"])
    key = _level_system.key_for_profile(profile)
    stored = _level_system.users.get(key)
    old_level = None
    last_notified_level = 0
    if isinstance(stored, dict):
        try:
            old_level = int(stored.get("level", 0) or 0)
        except (TypeError, ValueError):
            old_level = None
        try:
            last_notified_level = int(stored.get("last_notified_level", 0) or 0)
        except (TypeError, ValueError):
            last_notified_level = 0
    elif explicit_level is None:
        old_level = 0
    record, _changed = _level_system.observe_profile(profile, source="chat", explicit_level=explicit_level)
    return record, old_level, int(record.get("level", 0) or 0), last_notified_level


def level_for_profile(profile: dict, explicit_level=None) -> int:
    record, _old_level, _new_level, _last_notified_level = observe_level_for_profile(profile, explicit_level=explicit_level)
    return int(record.get("level", 0) or 0)


def enrich_profile_level(profile: dict) -> dict:
    profile = dict(profile)
    if profile.get("is_host") is None:
        profile["is_host"] = is_host_profile(profile)
    if profile.get("is_bot") is None:
        profile["is_bot"] = is_bot_profile(profile)
    profile["roles"] = roles_for_profile(profile)
    profile["role"] = primary_role(profile["roles"])
    record, old_level, stored_level, last_notified_level = observe_level_for_profile(profile)
    if not VIDEOCHAT_LEVEL_SYSTEM_ENABLED:
        profile["level"] = None
        profile["level_label"] = ""
        return profile
    if "bot" in profile["roles"] and "king" not in profile["roles"]:
        profile["level"] = None
        profile["level_label"] = "Bot"
        return profile
    profile["level"] = stored_level
    profile["level_label"] = "Lv. 99" if profile.get("is_host") else f"Lv. {profile['level']}"
    if (
        old_level is not None
        and stored_level > old_level
        and stored_level > last_notified_level
        and "bot" not in profile["roles"]
        and "king" not in profile["roles"]
    ):
        first_notice_level = max(old_level + 1, last_notified_level + 1)
        profile["_level_notices"] = [
            {
                "old_level": max(old_level, level - 1),
                "new_level": level,
                "level_key": _level_system.key_for_profile(profile),
                "record": record,
            }
            for level in range(first_notice_level, stored_level + 1)
        ]
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


def cleanup_animations() -> None:
    cleanup_media_dir(ANIMATIONS_DIR, MAX_ANIMATIONS, "animation")


def load_emoji_cache() -> None:
    global _emoji_cache
    try:
        raw = json.loads(EMOJI_CACHE_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        _emoji_cache = {"stickers": [], "custom_emoji": []}
        return
    except Exception as exc:
        print(f"[WARN] emoji cache load failed: {exc}", flush=True)
        _emoji_cache = {"stickers": [], "custom_emoji": []}
        return
    if not isinstance(raw, dict):
        raw = {}
    with _emoji_cache_lock:
        _emoji_cache = {
            "stickers": [x for x in raw.get("stickers", []) if isinstance(x, dict)][:MAX_EMOJI_CACHE_ITEMS],
            "custom_emoji": [x for x in raw.get("custom_emoji", []) if isinstance(x, dict)][:MAX_EMOJI_CACHE_ITEMS],
        }


def save_emoji_cache() -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = EMOJI_CACHE_FILE.with_suffix(".tmp")
        with _emoji_cache_lock:
            payload = {
                "version": 1,
                "stickers": _emoji_cache.get("stickers", [])[:MAX_EMOJI_CACHE_ITEMS],
                "custom_emoji": _emoji_cache.get("custom_emoji", [])[:MAX_EMOJI_CACHE_ITEMS],
            }
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(EMOJI_CACHE_FILE)
    except Exception as exc:
        print(f"[WARN] emoji cache save failed: {exc}", flush=True)


def upsert_emoji_cache(section: str, key: str, item: dict) -> None:
    if not key:
        return
    now = time.time()
    item = dict(item)
    item["key"] = key
    item["updated_at"] = now
    with _emoji_cache_lock:
        rows = [x for x in _emoji_cache.setdefault(section, []) if str(x.get("key") or "") != key]
        rows.insert(0, item)
        _emoji_cache[section] = rows[:MAX_EMOJI_CACHE_ITEMS]
    save_emoji_cache()


def cache_sticker_item(sticker, target: Path, media_type: str) -> None:
    file_unique_id = str(getattr(sticker, "file_unique_id", "") or "")
    if not file_unique_id:
        return
    upsert_emoji_cache("stickers", file_unique_id, {
        "type": "sticker",
        "file_unique_id": file_unique_id,
        "file_id": str(getattr(sticker, "file_id", "") or ""),
        "emoji": str(getattr(sticker, "emoji", "") or ""),
        "set_name": str(getattr(sticker, "set_name", "") or ""),
        "url": f"/stickers/{target.name}",
        "media_type": media_type,
    })


def custom_emoji_id_for_entity(entity) -> str:
    value = getattr(entity, "custom_emoji_id", None)
    if value is None:
        value = getattr(entity, "document_id", None)
    return str(value or "")


def slice_by_utf16_units(value: str, offset: int, length: int) -> str:
    text = str(value or "")
    if length <= 0:
        return ""
    raw = text.encode("utf-16-le", errors="surrogatepass")
    start = max(0, offset) * 2
    end = max(start, max(0, offset + length) * 2)
    return raw[start:end].decode("utf-16-le", errors="ignore")


def cache_custom_emoji_entities(entities, text: str) -> None:
    for entity in entities or []:
        if entity_kind(entity) != "custom_emoji":
            continue
        custom_id = custom_emoji_id_for_entity(entity)
        if not custom_id:
            continue
        try:
            offset = int(getattr(entity, "offset", 0))
            length = int(getattr(entity, "length", 1))
        except (TypeError, ValueError):
            offset, length = 0, 1
        label = slice_by_utf16_units(str(text or ""), offset, length) or "?"
        upsert_emoji_cache("custom_emoji", custom_id, {
            "type": "custom_emoji",
            "custom_emoji_id": custom_id,
            "emoji": label,
        })


def emoji_cache_snapshot() -> dict:
    with _emoji_cache_lock:
        return {
            "stickers": list(_emoji_cache.get("stickers", [])),
            "custom_emoji": list(_emoji_cache.get("custom_emoji", [])),
        }


def normalized_sticker_item(item: dict) -> dict:
    row = dict(item or {})
    key = str(row.get("key") or row.get("file_unique_id") or row.get("document_id") or "").strip()
    if key:
        row["key"] = key
    row["file_unique_id"] = str(row.get("file_unique_id") or "").strip()
    row["file_id"] = str(row.get("file_id") or "").strip()
    row["document_id"] = str(row.get("document_id") or "").strip()
    row["access_hash"] = str(row.get("access_hash") or "").strip()
    row["file_reference"] = str(row.get("file_reference") or "").strip()
    row["emoji"] = str(row.get("emoji") or "").strip()
    row["media_type"] = str(row.get("media_type") or "image").strip() or "image"
    url = str(row.get("url") or "").strip()
    if url.startswith("/stickers/"):
        path = STICKERS_DIR / Path(url).name
        if not path.exists():
            url = ""
            row["preview_missing"] = True
    row["url"] = url
    row["can_send_as_user"] = bool(row["document_id"] and row["access_hash"] and row["file_reference"])
    row["can_send_as_bot"] = bool(row["file_id"])
    return row


def ensure_bot_sticker_preview(item: dict) -> dict:
    row = normalized_sticker_item(item)
    if row.get("url") or not row.get("file_id"):
        return row
    try:
        class StickerRef:
            pass

        sticker = StickerRef()
        sticker.file_id = row["file_id"]
        sticker.file_unique_id = row.get("file_unique_id") or hashlib.sha256(row["file_id"].encode("utf-8")).hexdigest()[:24]
        sticker.is_video = row.get("media_type") == "video"
        sticker.is_animated = row.get("media_type") == "tgs"
        downloaded = download_sticker_display(sticker)
        if downloaded is not None:
            target, media_type = downloaded
            row["url"] = f"/stickers/{target.name}"
            row["media_type"] = media_type
            if row.get("file_unique_id") or row.get("key"):
                cache_key = row.get("file_unique_id") or row.get("key")
                upsert_emoji_cache("stickers", str(cache_key), row)
    except Exception as exc:
        print(f"[WARN] cached sticker preview unavailable: {exc}", flush=True)
    return normalized_sticker_item(row)


def sticker_media_type_from_mime(mime: str) -> str:
    mime = str(mime or "").lower()
    if mime == "application/x-tgsticker":
        return "tgs"
    if mime.startswith("video/"):
        return "video"
    return "image"


def sticker_alt_from_document(document) -> str:
    for attr in getattr(document, "attributes", []) or []:
        if attr.__class__.__name__ == "DocumentAttributeSticker":
            return str(getattr(attr, "alt", "") or "")
    return ""


async def telethon_sticker_preview_url(client, document, media_type: str, allow_download: bool = True) -> str:
    document_id = str(getattr(document, "id", "") or "")
    if not document_id:
        return ""
    STICKERS_DIR.mkdir(parents=True, exist_ok=True)
    for existing in STICKERS_DIR.glob(f"td_sticker_{document_id}.*"):
        if existing.is_file():
            return f"/stickers/{existing.name}"
    if not allow_download:
        return ""
    try:
        if document.__class__.__name__ == "InputDocument":
            from telethon import types

            suffix = ".tgs" if media_type == "tgs" else (".webm" if media_type == "video" else ".webp")
            target = STICKERS_DIR / f"td_sticker_{document_id}{suffix}"
            location = types.InputDocumentFileLocation(
                id=int(getattr(document, "id")),
                access_hash=int(getattr(document, "access_hash")),
                file_reference=getattr(document, "file_reference", b"") or b"",
                thumb_size="",
            )
            await client.download_file(location, file=str(target))
            saved = str(target) if target.exists() else ""
        else:
            saved = await client.download_media(document, file=str(STICKERS_DIR / f"td_sticker_{document_id}"))
    except Exception as exc:
        print(f"[WARN] recent sticker preview download failed id={document_id}: {type(exc).__name__}: {exc}", flush=True)
        return ""
    if not saved:
        return ""
    cleanup_stickers()
    return f"/stickers/{Path(saved).name}"


async def telegram_recent_sticker_items(limit: int = 30) -> list[dict[str, Any]]:
    global _recent_stickers_cache, _recent_stickers_cache_at
    if not TELEGRAM_USER_SEND_ENABLED or not TD_API_ID or not TD_API_HASH:
        return []
    now = time.time()
    with _recent_stickers_cache_lock:
        if _recent_stickers_cache and now - _recent_stickers_cache_at < RECENT_STICKERS_CACHE_TTL_SEC:
            return [dict(item) for item in _recent_stickers_cache[:limit]]
    try:
        client = await ensure_telegram_user_client()
        from telethon.tl import functions

        result = await client(functions.messages.GetRecentStickersRequest(attached=False, hash=0))
    except Exception as exc:
        print(f"[WARN] Telegram recent stickers unavailable: {exc}", flush=True)
        return []
    documents = list(getattr(result, "stickers", []) or [])[:limit]
    rows: list[dict[str, Any]] = []
    for document in documents:
        document_id = str(getattr(document, "id", "") or "")
        access_hash = str(getattr(document, "access_hash", "") or "")
        file_reference = getattr(document, "file_reference", b"") or b""
        if not document_id or not access_hash or not file_reference:
            continue
        media_type = sticker_media_type_from_mime(getattr(document, "mime_type", ""))
        url = await telethon_sticker_preview_url(client, document, media_type, allow_download=False)
        emoji = sticker_alt_from_document(document)
        rows.append({
            "type": "sticker",
            "source": "telegram_recent",
            "key": f"td:{document_id}",
            "document_id": document_id,
            "access_hash": access_hash,
            "file_reference": file_reference.hex(),
            "emoji": emoji,
            "url": url,
            "media_type": media_type,
            "can_send_as_user": True,
            "label": "recent sticker",
        })
    with _recent_stickers_cache_lock:
        _recent_stickers_cache = [dict(item) for item in rows]
        _recent_stickers_cache_at = now
    return rows


def update_recent_sticker_preview_cache(item: dict) -> None:
    key = str(item.get("key") or item.get("document_id") or "").strip()
    if not key or not item.get("url"):
        return
    with _recent_stickers_cache_lock:
        for row in _recent_stickers_cache:
            row_key = str(row.get("key") or row.get("document_id") or "").strip()
            if row_key == key:
                row["url"] = item["url"]
                row["media_type"] = item.get("media_type") or row.get("media_type") or "image"
                break


async def custom_emoji_meta(custom_id: str) -> dict[str, Any]:
    custom_id = str(custom_id or "").strip()
    if not custom_id.isdigit():
        raise HTTPException(status_code=400, detail="invalid custom emoji id")
    print(f"[EMOJI] custom preview request id={custom_id}", flush=True)
    with _custom_emoji_meta_cache_lock:
        cached = _custom_emoji_meta_cache.get(custom_id)
        if cached:
            path = STICKERS_DIR / Path(str(cached.get("url") or "")).name
            if path.exists():
                print(f"[EMOJI] custom preview ready id={custom_id} route=memory url={cached.get('url')}", flush=True)
                return dict(cached)
    STICKERS_DIR.mkdir(parents=True, exist_ok=True)
    for existing in STICKERS_DIR.glob(f"custom_emoji_{custom_id}.*"):
        if existing.is_file():
            media_type = "video" if existing.suffix.lower() == ".webm" else ("tgs" if existing.suffix.lower() == ".tgs" else "image")
            meta = {"custom_emoji_id": custom_id, "url": f"/stickers/{existing.name}", "media_type": media_type}
            with _custom_emoji_meta_cache_lock:
                _custom_emoji_meta_cache[custom_id] = dict(meta)
            print(f"[EMOJI] custom preview ready id={custom_id} route=file url={meta['url']}", flush=True)
            return meta
    try:
        client = await ensure_telegram_user_client()
        from telethon.tl import functions

        docs = await client(functions.messages.GetCustomEmojiDocumentsRequest(document_id=[int(custom_id)]))
        document = list(docs or [])[0] if docs else None
    except Exception as exc:
        print(f"[WARN] custom emoji fetch failed: {exc}", flush=True)
        raise HTTPException(status_code=404, detail="custom emoji unavailable")
    if document is None:
        raise HTTPException(status_code=404, detail="custom emoji not found")
    media_type = sticker_media_type_from_mime(getattr(document, "mime_type", ""))
    try:
        saved = await client.download_media(document, file=str(STICKERS_DIR / f"custom_emoji_{custom_id}"))
    except Exception as exc:
        print(f"[WARN] custom emoji download failed: {exc}", flush=True)
        raise HTTPException(status_code=404, detail="custom emoji download failed")
    if not saved:
        print(f"[EMOJI] custom preview failed id={custom_id} empty-download", flush=True)
        raise HTTPException(status_code=404, detail="custom emoji download failed")
    meta = {"custom_emoji_id": custom_id, "url": f"/stickers/{Path(saved).name}", "media_type": media_type}
    with _custom_emoji_meta_cache_lock:
        _custom_emoji_meta_cache[custom_id] = dict(meta)
    print(f"[EMOJI] custom preview ready id={custom_id} route=telethon url={meta['url']}", flush=True)
    return meta


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
            "is_bot": False,
        }
    user = getattr(message, "from_user", None)
    if user is None:
        return {"name": "Unknown", "speaker_id": "", "username": "", "is_bot": False}
    username = (getattr(user, "username", None) or "").strip()
    is_bot = bool(getattr(user, "is_bot", False))
    return {
        "name": username if is_bot and username else display_name(user),
        "speaker_id": str(user.id),
        "username": username,
        "is_bot": is_bot,
    }


def host_speaker_payload() -> dict:
    return {
        "name": VIDEOCHAT_HOST_NAME or bot_display_name,
        "speaker_id": str(VIDEOCHAT_HOST_USER_ID) if VIDEOCHAT_HOST_USER_ID else "",
        "username": VIDEOCHAT_HOST_USERNAME,
        "is_host": True,
        "is_bot": False,
        "role": "king",
        "roles": ["king"],
    }


def bot_speaker_payload() -> dict:
    return {
        "name": bot_username or bot_display_name or "Bot",
        "speaker_id": str(bot_user_id or ""),
        "username": bot_username,
        "is_host": False,
        "is_bot": True,
        "role": "bot",
        "roles": ["bot"],
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


def mark_message_seen(chat_id, message_id) -> bool:
    if chat_id is None or message_id is None:
        return False
    key = (str(chat_id), int(message_id))
    now = time.monotonic()
    with _seen_message_lock:
        expired = [k for k, ts in _seen_message_ids.items() if now - ts > SEEN_MESSAGE_TTL_SEC]
        for k in expired:
            _seen_message_ids.pop(k, None)
        if key in _seen_message_ids:
            return True
        _seen_message_ids[key] = now
        return False


def mark_message_seen_from_message(message) -> bool:
    return mark_message_seen(
        getattr(getattr(message, "chat", None), "id", None),
        getattr(message, "message_id", None),
    )


def mark_message_seen_from_payload(payload: dict) -> bool:
    message = payload.get("message") or {}
    return mark_message_seen(message.get("chat_id"), message.get("message_id"))


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


def message_overlay_payload(message, text: str | None = None) -> dict | None:
    profile = enrich_profile_level(message_profile(message))
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    body = str(text if text is not None else getattr(message, "text", "") or "")
    body, stt_label = split_stt_label_from_text(body, profile)
    if not body:
        return None
    cache_custom_emoji_entities(getattr(message, "entities", None), body)
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    payload = {
        "type": "text",
        "name": name,
        "text": body,
        "entities": text_entities_payload(getattr(message, "entities", None), body),
        "message": message_ref_payload(message),
        "reply": reply_summary_payload(message),
        "color": color,
        "speaker_id": profile["speaker_id"],
        "username": profile["username"],
        "is_host": profile["is_host"],
        "is_bot": profile.get("is_bot", False),
        "role": profile.get("role", ""),
        "roles": profile.get("roles", []),
        "level": profile["level"],
        "level_label": profile["level_label"],
    }
    if stt_label:
        payload["stt_label"] = stt_label
        if profile.get("is_bot"):
            payload["videochat_alias"] = host_speaker_payload()
    return payload


def _log_overlay_broadcast_result(fut) -> None:
    try:
        fut.result()
    except Exception as exc:
        print(f"[WARN] overlay broadcast failed: {exc}", flush=True)


def schedule_overlay_broadcast(payload: dict, *, wait: bool = False, timeout: float = 2.0) -> bool:
    if main_loop is None:
        return False
    fut = asyncio.run_coroutine_threadsafe(broadcast(payload), main_loop)
    running_loop = None
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        pass
    if wait and running_loop is not main_loop:
        try:
            fut.result(timeout=timeout)
        except TimeoutError:
            fut.add_done_callback(_log_overlay_broadcast_result)
        except Exception as exc:
            print(f"[WARN] overlay broadcast failed: {exc}", flush=True)
            return False
        return True
    fut.add_done_callback(_log_overlay_broadcast_result)
    return True


def overlay_payload_once(message, text: str | None = None, extra: dict | None = None) -> dict | None:
    if mark_message_seen_from_message(message):
        return None
    payload = message_overlay_payload(message, text)
    if payload is None:
        return None
    if extra:
        payload.update(extra)
    return payload


def emit_text_overlay(message, text: str | None = None, extra: dict | None = None) -> None:
    payload = overlay_payload_once(message, text, extra)
    if payload is None:
        return
    schedule_overlay_broadcast(payload)


def reply_to_with_overlay(message, text: str):
    sent = bot.reply_to(message, text)
    emit_text_overlay(sent, text)
    return sent


def send_message_with_overlay(chat_id: int, text: str, **kwargs):
    sent = bot.send_message(chat_id, text, **kwargs)
    payload = overlay_payload_once(sent, text)
    if payload is not None:
        schedule_overlay_broadcast(payload, wait=True)
    return sent


def telethon_display_name(sender) -> str:
    if sender is None:
        return "Unknown"
    username = (getattr(sender, "username", None) or "").strip()
    if bool(getattr(sender, "bot", False)) and username:
        return username
    first = getattr(sender, "first_name", None) or ""
    last = getattr(sender, "last_name", None) or ""
    name = f"{first} {last}".strip()
    if name:
        return name
    return getattr(sender, "title", None) or username or "Unknown"


def telethon_profile(sender) -> dict:
    if sender is None:
        return {"name": "Unknown", "speaker_id": "", "username": "", "is_bot": False}
    username = (getattr(sender, "username", None) or "").strip()
    sender_id = str(getattr(sender, "id", "") or "")
    return {
        "name": telethon_display_name(sender),
        "speaker_id": sender_id,
        "username": username,
        "is_bot": bool(getattr(sender, "bot", False)),
    }


def telethon_reply_quote_text(source_msg) -> str:
    reply_to = getattr(source_msg, "reply_to", None)
    quote_text = str(getattr(reply_to, "quote_text", None) or "").replace("\r", "").strip()
    return quote_text[:160] if quote_text else ""


def telethon_reply_summary(reply, source_msg=None) -> dict | None:
    if reply is None:
        return None
    sender = getattr(reply, "sender", None)
    profile = telethon_profile(sender)
    quote_text = telethon_reply_quote_text(source_msg) if source_msg is not None else ""
    text = str(getattr(reply, "message", None) or getattr(reply, "text", None) or "").strip()
    if not text:
        if getattr(reply, "photo", None):
            text = "사진"
        elif getattr(reply, "sticker", None):
            text = "스티커"
        elif getattr(reply, "gif", None) or getattr(reply, "document", None):
            text = "GIF/파일"
        else:
            text = "메시지"
    return {
        "name": profile.get("name") or "Unknown",
        "text": quote_text or text[:160],
        "quote_text": quote_text,
        "message": {
            "chat_id": str(getattr(reply, "chat_id", "") or ""),
            "message_id": getattr(reply, "id", None),
            "thread_id": getattr(reply, "reply_to_msg_id", None),
        },
    }


def is_external_telethon_bot(sender) -> bool:
    if sender is None or not bool(getattr(sender, "bot", False)):
        return False
    sender_id = str(getattr(sender, "id", "") or "")
    if bot_user_id is not None and sender_id == str(bot_user_id):
        return False
    return True


def telethon_media_kind(message) -> str:
    if getattr(message, "photo", None):
        return "photo"
    if getattr(message, "gif", None) or getattr(message, "video", None):
        return "animation"
    document = getattr(message, "document", None)
    mime = str(getattr(document, "mime_type", "") or "").lower()
    for attr in getattr(document, "attributes", []) or []:
        if attr.__class__.__name__ == "DocumentAttributeSticker":
            return "sticker"
    if mime in {"application/x-tgsticker", "application/x-bad-tgsticker"}:
        return "sticker"
    if mime.startswith("video/") or mime == "image/gif":
        return "animation"
    return ""


async def download_telethon_media(event, message, kind: str) -> tuple[str, str]:
    chat_id = str(getattr(event, "chat_id", "") or "")
    message_id = str(getattr(message, "id", "") or "")
    if not chat_id or not message_id:
        return "", ""
    digest = hashlib.sha256(f"telethon-{kind}:{chat_id}:{message_id}".encode("utf-8")).hexdigest()[:24]
    if kind == "photo":
        target_dir = PHOTOS_DIR
        url_prefix = "/photos"
        file_prefix = "telethon_photo"
    elif kind == "sticker":
        target_dir = STICKERS_DIR
        url_prefix = "/stickers"
        file_prefix = "telethon_sticker"
    else:
        target_dir = ANIMATIONS_DIR
        url_prefix = "/animations"
        file_prefix = "telethon_anim"
    target_dir.mkdir(parents=True, exist_ok=True)
    for existing in target_dir.glob(f"{file_prefix}_{digest}.*"):
        if existing.is_file():
            if kind == "photo":
                return f"{url_prefix}/{existing.name}", "image"
            if kind == "sticker":
                suffix = existing.suffix.lower()
                media_type = "tgs" if suffix == ".tgs" else ("video" if suffix == ".webm" else "image")
                return f"{url_prefix}/{existing.name}", media_type
            media_type = "image" if existing.suffix.lower() == ".gif" else "video"
            return f"{url_prefix}/{existing.name}", media_type
    try:
        saved = await event.client.download_media(message, file=str(target_dir / f"{file_prefix}_{digest}"))
    except Exception as exc:
        print(f"[WARN] telethon media download failed: {exc}", flush=True)
        return "", ""
    if not saved:
        return "", ""
    path = Path(saved)
    if kind == "photo":
        cleanup_photos()
        return f"{url_prefix}/{path.name}", "image"
    if kind == "sticker":
        cleanup_stickers()
        media_type = "tgs" if path.suffix.lower() == ".tgs" else ("video" if path.suffix.lower() == ".webm" else "image")
        return f"{url_prefix}/{path.name}", media_type
    cleanup_animations()
    media_type = "image" if path.suffix.lower() == ".gif" else "video"
    return f"{url_prefix}/{path.name}", media_type


async def telethon_message_payload(event, sender=None) -> dict | None:
    msg = getattr(event, "message", None)
    if msg is None:
        return None
    chat_id = getattr(event, "chat_id", None)
    message_id = getattr(msg, "id", None)
    text = str(getattr(msg, "message", None) or getattr(msg, "text", None) or "").strip()
    media_kind = telethon_media_kind(msg)
    if not text and not media_kind:
        return None
    if sender is None:
        sender = await event.get_sender()
    profile = enrich_profile_level(telethon_profile(sender))
    text, stt_label = split_stt_label_from_text(text, profile)
    entities = text_entities_payload(getattr(msg, "entities", None), text)
    cache_custom_emoji_entities(getattr(msg, "entities", None), text)
    identity_id = int(profile["speaker_id"]) if str(profile["speaker_id"]).lstrip("-").isdigit() else 0
    reply = None
    try:
        reply = await msg.get_reply_message()
    except Exception:
        reply = None
    common = {
        "name": profile["name"],
        "entities": entities,
        "message": {
            "chat_id": str(chat_id or ""),
            "message_id": message_id,
            "thread_id": getattr(msg, "reply_to_msg_id", None),
        },
        "reply": telethon_reply_summary(reply, msg),
        "color": color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0],
        "speaker_id": profile["speaker_id"],
        "username": profile["username"],
        "is_host": profile["is_host"],
        "is_bot": profile.get("is_bot", False),
        "role": profile.get("role", ""),
        "roles": profile.get("roles", []),
        "level": profile["level"],
        "level_label": profile["level_label"],
    }
    if stt_label:
        common["stt_label"] = stt_label
        if profile.get("is_bot"):
            common["videochat_alias"] = host_speaker_payload()
    if media_kind:
        url, media_type = await download_telethon_media(event, msg, media_kind)
        if url:
            payload = {
                "type": "photo" if media_kind == "photo" else ("sticker" if media_kind == "sticker" else "animation"),
                "url": url,
                "text": text,
                **common,
            }
            if media_kind != "photo":
                payload["media_type"] = media_type or "video"
            return payload
        if not text:
            return None
    return {
        "type": "text",
        "text": text,
        **common,
    }


async def broadcast_telethon_bot_message(event, replace: bool = False) -> None:
    if main_loop is None:
        return
    if not telethon_overlay_source(event):
        return
    sender = await event.get_sender()
    if not is_external_telethon_bot(sender):
        return
    message = getattr(event, "message", None)
    chat_id = getattr(event, "chat_id", None)
    message_id = getattr(message, "id", None)
    payload = await telethon_message_payload(event, sender)
    if payload is None:
        return
    if replace:
        await broadcast({
            "type": "delete",
            "message": {"chat_id": str(chat_id or ""), "message_id": message_id},
        })
    elif mark_message_seen(chat_id, message_id):
        return
    await broadcast(payload)


def telethon_thread_id(message) -> int | None:
    reply_to = getattr(message, "reply_to", None)
    if reply_to is None:
        return None
    for attr in ("reply_to_top_id", "reply_to_msg_id"):
        value = getattr(reply_to, attr, None)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    return None


def telethon_overlay_source(event) -> bool:
    chat_id = getattr(event, "chat_id", None)
    try:
        chat_id_int = int(chat_id)
    except (TypeError, ValueError):
        return False
    if chat_id_int == CHAT_ID:
        return True
    if VIDEOCHAT_LEVEL_CHAT_ID != 0 and chat_id_int == VIDEOCHAT_LEVEL_CHAT_ID:
        return True
    at = active_thread
    if at is None or chat_id_int != at[0]:
        return False
    return telethon_thread_id(getattr(event, "message", None)) == at[1]


@bot.message_handler(commands=["stream_on"])
def cmd_stream_on(message):
    if not _is_owner_in_target_chat(message):
        return
    emit_text_overlay(message)
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_STREAM_ON, use_independent_chat_permissions=True
        )
        reply_to_with_overlay(message, "방송 시작: 텍스트/사진만 전송 가능")
        print("[INFO] stream_on: permissions opened", flush=True)
    except Exception as e:
        reply_to_with_overlay(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] stream_on failed: {e}", flush=True)


@bot.message_handler(commands=["stream_off"])
def cmd_stream_off(message):
    if not _is_owner_in_target_chat(message):
        return
    emit_text_overlay(message)
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_STREAM_OFF, use_independent_chat_permissions=True
        )
        reply_to_with_overlay(message, "방송 종료: 호스트 외 메시지 전송 제한")
        print("[INFO] stream_off: permissions locked", flush=True)
    except Exception as e:
        reply_to_with_overlay(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] stream_off failed: {e}", flush=True)


@bot.message_handler(commands=["text_on"])
def cmd_text_on(message):
    if not _is_owner_in_target_chat(message):
        return
    emit_text_overlay(message)
    try:
        bot.set_chat_permissions(
            CHAT_ID, PERMS_TEXT_ON, use_independent_chat_permissions=True
        )
        reply_to_with_overlay(message, "텍스트 전용 모드: 사진·미디어 차단, 텍스트만 허용")
        print("[INFO] text_on: text-only permissions applied", flush=True)
    except Exception as e:
        reply_to_with_overlay(message, f"권한 변경 실패: {e}")
        print(f"[ERROR] text_on failed: {e}", flush=True)


TG_DISPATCH_GAP_SEC = 0.15  # 텔레그램 flood control 회피용 송신 간 간격


def stt_label_payload() -> str:
    return STT_AI_LABEL_TEXT if STT_AI_LABEL else ""


def split_stt_label_from_text(text: str, profile: dict | None = None) -> tuple[str, str]:
    body = str(text or "")
    label = stt_label_payload()
    if not label:
        return body, ""
    if profile is not None:
        is_stt_sender = bool(
            profile.get("is_bot")
            or profile.get("is_host")
            or (bot_user_id is not None and str(profile.get("speaker_id") or "") == str(bot_user_id))
            or (VIDEOCHAT_HOST_USER_ID and str(profile.get("speaker_id") or "") == str(VIDEOCHAT_HOST_USER_ID))
        )
        if not is_stt_sender:
            return body, ""
    stripped = body.rstrip()
    if not stripped.endswith(label):
        return body, ""
    without_label = stripped[:-len(label)].rstrip()
    if not without_label:
        return body, ""
    return without_label, label


def stt_telegram_message(text: str) -> tuple[str, str | None]:
    if not STT_AI_LABEL:
        return text, None
    return (
        f"{html.escape(text)} <i>{html.escape(STT_AI_LABEL_TEXT)}</i>",
        "HTML",
    )


async def ensure_telegram_user_client():
    global stt_user_client, telegram_user_sender_id, telegram_delete_listener_registered, telegram_message_listener_registered
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
    if not telegram_delete_listener_registered:
        try:
            from telethon import events

            @stt_user_client.on(events.MessageDeleted)
            async def _on_telegram_message_deleted(event):
                chat_id = getattr(event, "chat_id", None)
                if chat_id is None:
                    return
                for message_id in getattr(event, "deleted_ids", []) or []:
                    await broadcast({
                        "type": "delete",
                        "message": {"chat_id": str(chat_id), "message_id": message_id},
                    })

            telegram_delete_listener_registered = True
            print("[INFO] Telegram delete listener enabled", flush=True)
        except Exception as exc:
            print(f"[WARN] Telegram delete listener setup failed: {exc}", flush=True)
    if not telegram_message_listener_registered:
        try:
            from telethon import events

            @stt_user_client.on(events.NewMessage)
            async def _on_telegram_user_message(event):
                await broadcast_telethon_bot_message(event, replace=False)

            @stt_user_client.on(events.MessageEdited)
            async def _on_telegram_user_message_edited(event):
                await broadcast_telethon_bot_message(event, replace=True)

            telegram_message_listener_registered = True
            print("[INFO] Telegram message listener enabled", flush=True)
        except Exception as exc:
            print(f"[WARN] Telegram message listener setup failed: {exc}", flush=True)
    return stt_user_client


async def ensure_stt_user_client():
    if STT_SEND_AS != "user":
        return None
    return await ensure_telegram_user_client()


async def telegram_peer_for_dest(client, chat_id: int):
    chat_id = int(chat_id)
    cached = telegram_peer_cache.get(chat_id)
    if cached is not None:
        return cached
    try:
        peer = await client.get_input_entity(chat_id)
        telegram_peer_cache[chat_id] = peer
        return peer
    except Exception:
        pass
    async for dialog in client.iter_dialogs():
        if int(getattr(dialog, "id", 0) or 0) != chat_id:
            continue
        peer = await client.get_input_entity(dialog.entity)
        telegram_peer_cache[chat_id] = peer
        return peer
    if str(chat_id).startswith("-100"):
        try:
            peer = await client.get_input_entity(int(str(chat_id)[4:]))
            telegram_peer_cache[chat_id] = peer
            return peer
        except Exception:
            pass
    peer = await client.get_input_entity(chat_id)
    telegram_peer_cache[chat_id] = peer
    return peer


async def send_stt_by_bot(dest: dict, text: str, emit_overlay: bool = True) -> None:
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
    sent = await asyncio.to_thread(bot.send_message, dest["chat_id"], message, **kwargs)
    seen = mark_message_seen_from_message(sent)
    if emit_overlay and main_loop is not None and not seen:
        payload = message_overlay_payload(sent, text)
        if payload is not None:
            payload["stt_label"] = stt_label_payload()
            payload["videochat_alias"] = host_speaker_payload()
            await broadcast(payload)


async def send_stt_by_user(dest: dict, text: str) -> None:
    client = await ensure_telegram_user_client()
    message, parse_mode = stt_telegram_message(text)
    kwargs = {}
    if parse_mode:
        kwargs["parse_mode"] = "html"
    if dest.get("thread_id") is not None:
        kwargs["reply_to"] = dest["thread_id"]
    await client.send_message(dest["chat_id"], message, **kwargs)


async def dispatch_stt_message(dest: dict, text: str, emit_overlay: bool = True) -> None:
    if STT_SEND_AS == "user":
        try:
            await send_stt_by_user(dest, text)
            return
        except Exception as exc:
            print(f"[STT] user dispatch failed dest={dest}: {exc}", flush=True)
            if not STT_SEND_AS_USER_FALLBACK_BOT:
                raise
    await send_stt_by_bot(dest, text, emit_overlay=emit_overlay)


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


def detect_video_mime(data: bytes) -> str | None:
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "video/mp4"
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return "video/webm"
    return None


def normalize_send_media_name(name: str, mime: str) -> str:
    clean = (name or "media").replace("\\", "_").replace("/", "_").strip() or "media"
    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
    }.get(mime, ".bin")
    if clean.lower().endswith(ext):
        return clean[:120]
    stem = clean.rsplit(".", 1)[0] if "." in clean else clean
    return f"{stem[:100] or 'media'}{ext}"


def telegram_file_suffix(file_path: str, fallback: str) -> str:
    suffix = Path(str(file_path or "")).suffix.lower()
    if suffix and len(suffix) <= 12:
        return suffix
    return fallback


def decode_send_media(value) -> dict | None:
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
        raise HTTPException(status_code=400, detail="invalid media data") from exc
    client_mime = str(value.get("mime") or "").split(";", 1)[0].lower()
    if client_mime and not (client_mime.startswith("image/") or client_mime.startswith("video/")):
        raise HTTPException(status_code=400, detail="media must be an image or video")
    mime = detect_image_mime(data) or detect_video_mime(data)
    if not mime:
        raise HTTPException(status_code=400, detail="unsupported media")
    if mime == "image/gif":
        kind = "animation"
    elif mime.startswith("video/"):
        kind = "video"
    else:
        kind = "photo"
    max_mb = TELEGRAM_USER_SEND_MAX_MEDIA_MB if kind == "video" else TELEGRAM_USER_SEND_MAX_PHOTO_MB
    max_bytes = max(1, int(max_mb * 1024 * 1024))
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail="media too large")
    name = normalize_send_media_name(str(value.get("name") or "media"), mime)
    return {
        "kind": kind,
        "bytes": data,
        "name": name,
        "mime": mime,
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def decode_send_photo(value) -> dict | None:
    return decode_send_media(value)


def decode_send_sticker(value) -> dict | None:
    if not isinstance(value, dict):
        return None
    inline = normalized_sticker_item(value)
    if inline.get("can_send_as_user") or inline.get("can_send_as_bot"):
        return inline
    key = str(value.get("key") or value.get("file_unique_id") or value.get("document_id") or "").strip()
    if not key:
        return None
    for item in emoji_cache_snapshot().get("stickers", []):
        row = normalized_sticker_item(item)
        if str(row.get("key") or row.get("file_unique_id") or row.get("document_id") or "") == key:
            return row
    raise HTTPException(status_code=400, detail="unknown sticker")


def decode_send_custom_emoji(value) -> dict | None:
    if not isinstance(value, dict):
        return None
    custom_id = str(value.get("custom_emoji_id") or value.get("key") or "").strip()
    if not custom_id:
        return None
    emoji = str(value.get("emoji") or "✨")[:8] or "✨"
    return {"type": "custom_emoji", "custom_emoji_id": custom_id, "emoji": emoji}


def decode_send_custom_entities(value, text: str) -> list[dict]:
    if not isinstance(value, list) or not text:
        return []
    limit = utf16_units(text)
    rows = []
    for raw in value[:32]:
        if not isinstance(raw, dict):
            continue
        custom_id = str(raw.get("custom_emoji_id") or "").strip()
        if not custom_id.isdigit():
            continue
        try:
            offset = int(raw.get("offset", 0))
            length = int(raw.get("length", 0))
        except (TypeError, ValueError):
            continue
        if offset < 0 or length <= 0 or offset + length > limit:
            continue
        rows.append({
            "type": "custom_emoji",
            "offset": offset,
            "length": length,
            "custom_emoji_id": custom_id,
        })
    rows.sort(key=lambda item: (item["offset"], -item["length"]))
    return rows


def message_ref_payload(message) -> dict:
    return {
        "chat_id": str(getattr(getattr(message, "chat", None), "id", "")),
        "message_id": getattr(message, "message_id", None),
        "thread_id": getattr(message, "message_thread_id", None),
    }


def message_preview_text(message) -> str:
    text = str(getattr(message, "text", None) or getattr(message, "caption", None) or "").strip()
    if text:
        return text[:160]
    if getattr(message, "photo", None):
        return "사진"
    if getattr(message, "sticker", None):
        return "스티커"
    if getattr(message, "animation", None):
        return "GIF"
    if getattr(message, "video", None):
        return "영상"
    if getattr(message, "document", None):
        return "파일"
    return "메시지"


def message_quote_text(message) -> str:
    quote = getattr(message, "quote", None)
    text = str(getattr(quote, "text", None) or "").replace("\r", "").strip()
    return text[:160] if text else ""


def entity_kind(entity) -> str:
    value = str(getattr(entity, "type", "") or "")
    if value:
        return "custom_emoji" if value == "customEmoji" else value
    name = entity.__class__.__name__
    if name.startswith("MessageEntity"):
        name = name[len("MessageEntity"):]
    mapping = {
        "Bold": "bold",
        "Italic": "italic",
        "Underline": "underline",
        "Strike": "strikethrough",
        "StrikeThrough": "strikethrough",
        "Code": "code",
        "Pre": "pre",
        "Spoiler": "spoiler",
        "TextUrl": "text_link",
        "Url": "url",
        "Mention": "mention",
        "Hashtag": "hashtag",
        "BotCommand": "bot_command",
        "CustomEmoji": "custom_emoji",
    }
    return mapping.get(name, name[:1].lower() + name[1:])


def text_entities_payload(entities, text: str) -> list[dict]:
    limit = utf16_units(text or "")
    rows = []
    for entity in entities or []:
        try:
            offset = int(getattr(entity, "offset", 0))
            length = int(getattr(entity, "length", 0))
        except (TypeError, ValueError):
            continue
        if length <= 0 or offset < 0 or offset >= limit:
            continue
        length = min(length, limit - offset)
        item = {
            "type": entity_kind(entity),
            "offset": offset,
            "length": length,
        }
        url = getattr(entity, "url", None)
        if url:
            item["url"] = str(url)
        custom_emoji_id = custom_emoji_id_for_entity(entity)
        if custom_emoji_id:
            item["custom_emoji_id"] = custom_emoji_id
        rows.append(item)
    rows.sort(key=lambda item: (item["offset"], -item["length"]))
    return rows


def reply_summary_payload(message) -> dict | None:
    reply = getattr(message, "reply_to_message", None)
    if reply is None:
        return None
    profile = message_profile(reply)
    quote_text = message_quote_text(message)
    return {
        "name": profile.get("name") or "Unknown",
        "text": quote_text or message_preview_text(reply),
        "quote_text": quote_text,
        "message": message_ref_payload(reply),
    }


def reply_ref_from_payload(value) -> dict | None:
    if not isinstance(value, dict):
        return None
    try:
        chat_id = int(str(value.get("chat_id") or "0"))
        message_id = int(str(value.get("message_id") or "0"))
    except ValueError:
        return None
    if chat_id == 0 or message_id <= 0:
        return None
    thread_id = value.get("thread_id")
    try:
        thread_id = int(thread_id) if thread_id is not None else None
    except (TypeError, ValueError):
        thread_id = None
    result = {"chat_id": chat_id, "message_id": message_id, "thread_id": thread_id}
    quote_text = str(value.get("quote_text") or "").replace("\r", "")
    if quote_text:
        result["quote_text"] = quote_text[:1024]
    return result


def overlay_send_dest_for_reply(reply_to: dict) -> dict:
    return {
        "chat_id": reply_to["chat_id"],
        "thread_id": reply_to.get("thread_id"),
        "reply_to_id": reply_to["message_id"],
        "quote_text": reply_to.get("quote_text", ""),
        "target": "reply",
    }


async def send_plain_by_bot(dest: dict, text: str, custom_entities: list[dict] | None = None) -> None:
    kwargs, fallback = bot_reply_kwargs(dest)
    entities = bot_custom_entities(custom_entities)
    if entities:
        kwargs["entities"] = entities
        if fallback is not None:
            fallback["entities"] = entities
    try:
        await asyncio.to_thread(send_message_with_overlay, dest["chat_id"], text, **kwargs)
    except Exception:
        if not fallback:
            raise
        await asyncio.to_thread(send_message_with_overlay, dest["chat_id"], text, **fallback)


def _named_bytes(data: bytes, filename: str) -> io.BytesIO:
    fp = io.BytesIO(data)
    fp.name = filename or "image.jpg"
    return fp


def quote_text_for_reply(dest: dict) -> str:
    if not dest.get("reply_to_id"):
        return ""
    quote_text = str(dest.get("quote_text") or "").replace("\r", "")
    return quote_text[:1024] if quote_text.strip() else ""


def bot_reply_kwargs(dest: dict) -> tuple[dict, dict | None]:
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    if reply_id is None:
        return {}, None
    fallback = {
        "reply_to_message_id": reply_id,
        "allow_sending_without_reply": True,
    }
    quote_text = quote_text_for_reply(dest)
    if not quote_text:
        return fallback, None
    return {
        "reply_parameters": ReplyParameters(
            message_id=reply_id,
            chat_id=dest["chat_id"],
            allow_sending_without_reply=True,
            quote=quote_text,
        )
    }, fallback


def telethon_reply_to(dest: dict):
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    if reply_id is None:
        return None
    from telethon import types

    quote_text = quote_text_for_reply(dest)
    if quote_text:
        kwargs = {"quote_text": quote_text}
        if dest.get("thread_id") and dest.get("thread_id") != reply_id:
            kwargs["top_msg_id"] = int(dest["thread_id"])
        return types.InputReplyToMessage(int(reply_id), **kwargs)
    return types.InputReplyToMessage(int(reply_id))


async def send_photo_by_bot(dest: dict, photo: dict, caption: str) -> None:
    kwargs, fallback = bot_reply_kwargs(dest)
    try:
        await asyncio.to_thread(
            bot.send_photo,
            dest["chat_id"],
            _named_bytes(photo["bytes"], photo["name"]),
            caption=caption or None,
            **kwargs,
        )
    except Exception:
        if not fallback:
            raise
        await asyncio.to_thread(
            bot.send_photo,
            dest["chat_id"],
            _named_bytes(photo["bytes"], photo["name"]),
            caption=caption or None,
            **fallback,
        )


async def send_animation_by_bot(dest: dict, media: dict, caption: str) -> None:
    kwargs, fallback = bot_reply_kwargs(dest)
    try:
        await asyncio.to_thread(
            bot.send_animation,
            dest["chat_id"],
            _named_bytes(media["bytes"], media["name"]),
            caption=caption or None,
            **kwargs,
        )
    except Exception:
        if not fallback:
            raise
        await asyncio.to_thread(
            bot.send_animation,
            dest["chat_id"],
            _named_bytes(media["bytes"], media["name"]),
            caption=caption or None,
            **fallback,
        )


async def send_video_by_bot(dest: dict, media: dict, caption: str) -> None:
    kwargs, fallback = bot_reply_kwargs(dest)
    try:
        await asyncio.to_thread(
            bot.send_video,
            dest["chat_id"],
            _named_bytes(media["bytes"], media["name"]),
            caption=caption or None,
            supports_streaming=True,
            **kwargs,
        )
    except Exception:
        if not fallback:
            raise
        await asyncio.to_thread(
            bot.send_video,
            dest["chat_id"],
            _named_bytes(media["bytes"], media["name"]),
            caption=caption or None,
            supports_streaming=True,
            **fallback,
        )


async def send_plain_by_user(dest: dict, text: str, custom_entities: list[dict] | None = None) -> None:
    client = await ensure_telegram_user_client()
    peer = await telegram_peer_for_dest(client, dest["chat_id"])
    reply_to = telethon_reply_to(dest)
    entities = telethon_custom_entities(custom_entities)
    if reply_to is not None and quote_text_for_reply(dest):
        from telethon import functions

        await client(functions.messages.SendMessageRequest(
            peer=peer,
            message=text,
            entities=entities,
            reply_to=reply_to,
        ))
        return
    kwargs = {}
    if entities:
        kwargs["formatting_entities"] = entities
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    if reply_id is not None:
        kwargs["reply_to"] = reply_id
    await client.send_message(peer, text, **kwargs)


async def send_file_by_user(dest: dict, media: dict, caption: str, *, supports_streaming: bool = False) -> None:
    client = await ensure_telegram_user_client()
    peer = await telegram_peer_for_dest(client, dest["chat_id"])
    reply_to = telethon_reply_to(dest)
    if reply_to is not None and quote_text_for_reply(dest):
        from telethon import functions

        parsed_caption, entities = await client._parse_message_text(caption or "", ())
        _handle, input_media, _image = await client._file_to_media(
            _named_bytes(media["bytes"], media["name"]),
            supports_streaming=supports_streaming,
            mime_type=media.get("mime") or None,
        )
        await client(functions.messages.SendMediaRequest(
            peer=peer,
            media=input_media,
            message=parsed_caption or "",
            entities=entities,
            reply_to=reply_to,
        ))
        return
    kwargs = {}
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    if reply_id is not None:
        kwargs["reply_to"] = reply_id
    await client.send_file(
        peer,
        _named_bytes(media["bytes"], media["name"]),
        caption=caption or None,
        supports_streaming=supports_streaming,
        **kwargs,
    )


async def send_photo_by_user(dest: dict, photo: dict, caption: str) -> None:
    await send_file_by_user(dest, photo, caption)


async def send_animation_by_user(dest: dict, media: dict, caption: str) -> None:
    await send_file_by_user(dest, media, caption)


async def send_video_by_user(dest: dict, media: dict, caption: str) -> None:
    await send_file_by_user(dest, media, caption, supports_streaming=media.get("mime") == "video/mp4")


def cached_sticker_path(sticker: dict) -> Path | None:
    url = str(sticker.get("url") or "")
    if not url.startswith("/stickers/"):
        return None
    name = Path(url).name
    path = STICKERS_DIR / name
    return path if path.exists() else None


def sticker_input_document(sticker: dict):
    document_id = str(sticker.get("document_id") or "").strip()
    access_hash = str(sticker.get("access_hash") or "").strip()
    file_reference = str(sticker.get("file_reference") or "").strip()
    if not document_id or not access_hash or not file_reference:
        return None
    from telethon import types

    try:
        return types.InputDocument(
            id=int(document_id),
            access_hash=int(access_hash),
            file_reference=bytes.fromhex(file_reference),
        )
    except (TypeError, ValueError):
        return None


async def send_sticker_by_user(dest: dict, sticker: dict) -> None:
    client = await ensure_telegram_user_client()
    peer = await telegram_peer_for_dest(client, dest["chat_id"])
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    kwargs = {}
    if reply_id is not None:
        kwargs["reply_to"] = reply_id
    input_document = sticker_input_document(sticker)
    if input_document is None:
        raise RuntimeError("cached Bot API sticker cannot be sent as a user sticker")
    await client.send_file(peer, input_document, **kwargs)


async def send_sticker_by_best_route(dest: dict, sticker: dict, caption: str = "") -> str:
    if sticker_input_document(sticker) is None and sticker.get("file_id"):
        await send_sticker_by_bot(dest, sticker)
        if caption:
            await send_plain_by_bot(dest, caption)
        return "bot"
    await send_sticker_by_user(dest, sticker)
    if caption:
        await send_plain_by_user(dest, caption)
    return "user"


async def send_sticker_by_bot(dest: dict, sticker: dict) -> None:
    file_id = str(sticker.get("file_id") or "")
    if not file_id:
        raise RuntimeError("sticker file_id missing")
    kwargs, fallback = bot_reply_kwargs(dest)
    try:
        await asyncio.to_thread(bot.send_sticker, dest["chat_id"], file_id, **kwargs)
    except Exception:
        if not fallback:
            raise
        await asyncio.to_thread(bot.send_sticker, dest["chat_id"], file_id, **fallback)


def custom_emoji_base(item: dict) -> str:
    return str(item.get("emoji") or "✨")[:8] or "✨"


def custom_emoji_message_text(item: dict, caption: str = "") -> str:
    emoji = custom_emoji_base(item)
    caption = str(caption or "").strip()
    return f"{emoji} {caption}" if caption else emoji


def utf16_units(value: str) -> int:
    return len(str(value).encode("utf-16-le")) // 2


def telethon_custom_entities(custom_entities: list[dict] | None):
    if not custom_entities:
        return []
    from telethon import types

    rows = []
    for item in custom_entities:
        try:
            rows.append(types.MessageEntityCustomEmoji(
                offset=int(item["offset"]),
                length=int(item["length"]),
                document_id=int(str(item["custom_emoji_id"])),
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return rows


def bot_custom_entities(custom_entities: list[dict] | None):
    if not custom_entities:
        return []
    from telebot.types import MessageEntity

    rows = []
    for item in custom_entities:
        try:
            rows.append(MessageEntity(
                "custom_emoji",
                int(item["offset"]),
                int(item["length"]),
                custom_emoji_id=str(item["custom_emoji_id"]),
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return rows


async def send_custom_emoji_by_user(dest: dict, item: dict, caption: str = "") -> None:
    client = await ensure_telegram_user_client()
    peer = await telegram_peer_for_dest(client, dest["chat_id"])
    from telethon import types

    emoji = custom_emoji_base(item)
    text = custom_emoji_message_text(item, caption)
    custom_id = int(str(item.get("custom_emoji_id") or "0"))
    entity = types.MessageEntityCustomEmoji(offset=0, length=utf16_units(emoji), document_id=custom_id)
    kwargs = {"formatting_entities": [entity]}
    reply_id = dest.get("reply_to_id") or dest.get("thread_id")
    if reply_id is not None:
        kwargs["reply_to"] = reply_id
    await client.send_message(peer, text, **kwargs)


async def send_custom_emoji_by_bot(dest: dict, item: dict, caption: str = "") -> None:
    from telebot.types import MessageEntity

    emoji = custom_emoji_base(item)
    text = custom_emoji_message_text(item, caption)
    custom_id = str(item.get("custom_emoji_id") or "")
    if not custom_id:
        raise RuntimeError("custom emoji id missing")
    kwargs, fallback = bot_reply_kwargs(dest)
    kwargs["entities"] = [MessageEntity("custom_emoji", 0, utf16_units(emoji), custom_emoji_id=custom_id)]
    try:
        await asyncio.to_thread(send_message_with_overlay, dest["chat_id"], text, **kwargs)
    except Exception:
        if not fallback:
            raise
        fallback["entities"] = kwargs["entities"]
        await asyncio.to_thread(send_message_with_overlay, dest["chat_id"], text, **fallback)


async def dispatch_overlay_user_message(
    text: str,
    targets: list[str],
    media: dict | None = None,
    reply_to: dict | None = None,
    sticker: dict | None = None,
    custom_emoji: dict | None = None,
    custom_entities: list[dict] | None = None,
) -> list[dict]:
    results = []
    dests = [overlay_send_dest_for_reply(reply_to)] if reply_to else overlay_send_destinations(targets)
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
    if media:
        mark_overlay_send_for_dedupe(media.get("kind", "media"), media["sha256"], len(dests))
    if sticker:
        mark_overlay_send_for_dedupe("sticker", str(sticker.get("file_unique_id") or sticker.get("key") or ""), len(dests))
    for i, dest in enumerate(dests):
        if i > 0:
            await asyncio.sleep(TG_DISPATCH_GAP_SEC)
        try:
            if sticker:
                via = await send_sticker_by_best_route(dest, sticker, text)
            elif custom_emoji:
                await send_custom_emoji_by_user(dest, custom_emoji, text)
                via = "user"
            elif media and media.get("kind") == "video":
                await send_video_by_user(dest, media, text)
                via = "user"
            elif media and media.get("kind") == "animation":
                await send_animation_by_user(dest, media, text)
                via = "user"
            elif media:
                await send_photo_by_user(dest, media, text)
                via = "user"
            else:
                await send_plain_by_user(dest, text, custom_entities)
                via = "user"
            results.append({"dest": dest, "ok": True, "via": via})
        except Exception as exc:
            print(f"[SEND] user dispatch failed dest={dest}: {exc}", flush=True)
            if not TELEGRAM_USER_SEND_FALLBACK_BOT:
                results.append({"dest": dest, "ok": False, "via": "user", "error": str(exc)})
                continue
            try:
                if sticker:
                    await send_sticker_by_bot(dest, sticker)
                    if text:
                        await send_plain_by_bot(dest, text)
                elif custom_emoji:
                    await send_custom_emoji_by_bot(dest, custom_emoji, text)
                elif media and media.get("kind") == "video":
                    await send_video_by_bot(dest, media, text)
                elif media and media.get("kind") == "animation":
                    await send_animation_by_bot(dest, media, text)
                elif media:
                    await send_photo_by_bot(dest, media, text)
                else:
                    await send_plain_by_bot(dest, text, custom_entities)
                results.append({"dest": dest, "ok": True, "via": "bot"})
            except Exception as bot_exc:
                results.append({"dest": dest, "ok": False, "via": "bot", "error": str(bot_exc)})
    return results


async def notify_owner_delete_failed(chat_id: int, message_id: int, error: str) -> None:
    if OWNER_ID == 0:
        return
    try:
        await asyncio.to_thread(
            bot.send_message,
            OWNER_ID,
            f"삭제 불가: chat_id={chat_id}, message_id={message_id}\n{error}",
        )
    except Exception as exc:
        print(f"[WARN] delete failure notice failed: {exc}", flush=True)


async def delete_telegram_message(chat_id: int, message_id: int) -> dict:
    try:
        await asyncio.to_thread(bot.delete_message, chat_id, message_id)
        return {"ok": True, "via": "bot"}
    except Exception as bot_exc:
        bot_error = str(bot_exc)
        try:
            client = await ensure_telegram_user_client()
            await client.delete_messages(chat_id, [message_id])
            return {"ok": True, "via": "user", "bot_error": bot_error}
        except Exception as user_exc:
            error = f"bot: {bot_error}; user: {user_exc}"
            await notify_owner_delete_failed(chat_id, message_id, error)
            return {"ok": False, "error": error}


async def stt_on_text(text: str) -> None:
    host = enrich_profile_level(host_speaker_payload())
    if STT_SEND_AS == "bot":
        profile = enrich_profile_level(bot_speaker_payload())
    else:
        profile = host
    print(f"[STT] {profile['name']}: {text}", flush=True)

    color_identity = profile.get("speaker_id") or VIDEOCHAT_HOST_USER_ID or bot_user_id or 0
    try:
        color_seed = int(str(color_identity).lstrip("-") or "0")
    except ValueError:
        color_seed = VIDEOCHAT_HOST_USER_ID or bot_user_id or 0
    payload = {
        "type": "text",
        "name": profile["name"],
        "text": text,
        "color": color_for(color_seed),
        "speaker_id": profile["speaker_id"],
        "username": profile["username"],
        "is_host": profile["is_host"],
        "is_bot": profile.get("is_bot", False),
        "role": profile.get("role", ""),
        "roles": profile.get("roles", []),
        "level": profile["level"],
        "level_label": profile["level_label"],
        "stt_label": stt_label_payload(),
    }
    if STT_SEND_AS == "bot":
        payload["videochat_alias"] = host_speaker_payload()
    dests = list(tts_destinations)
    for i, dest in enumerate(dests):
        if i > 0:
            await asyncio.sleep(TG_DISPATCH_GAP_SEC)
        try:
            await dispatch_stt_message(dest, text, emit_overlay=(i == 0))
        except Exception as e:
            print(f"[STT] dispatch error dest={dest}: {e}", flush=True)


@bot.message_handler(commands=["stt_on"])
def cmd_stt_on(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    if stt_manager is None or main_loop is None:
        reply_to_with_overlay(message, "STT 매니저 초기화 전")
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
                reply_to_with_overlay(message, "STT 시작 실패 - 콘솔 로그 확인")
                return
        except Exception as e:
            if dest in tts_destinations:
                tts_destinations.remove(dest)
            reply_to_with_overlay(message, f"시작 실패: {e}")
            print(f"[ERROR] stt_on: {e}", flush=True)
            return

    if dest["thread_id"] is None:
        update_state(stt_on=True, tts_on=False)

    reply_to_with_overlay(message, f"STT 시작: {scope} 출력 활성")
    print(f"[INFO] stt_on dest={dest}", flush=True)


@bot.message_handler(commands=["stt_off"])
def cmd_stt_off(message):
    if not _is_owner(message):
        return
    if not (_is_main_chat(message) or _matches_active_thread(message)):
        return
    emit_text_overlay(message)
    if stt_manager is None or main_loop is None:
        return

    tts_destinations.clear()
    update_state(stt_on=False, tts_on=False)

    if stt_manager.active:
        fut = asyncio.run_coroutine_threadsafe(stt_manager.stop(), main_loop)
        try:
            fut.result(timeout=10)
        except Exception as e:
            print(f"[ERROR] stt_off stop: {e}", flush=True)

    reply_to_with_overlay(message, "STT 종료 (양쪽 모두 off)")
    print("[INFO] stt_off", flush=True)


@bot.message_handler(commands=["here_on"])
def cmd_here_on(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    thread_id = getattr(message, "message_thread_id", None)
    if thread_id is None:
        reply_to_with_overlay(message, "댓글창(thread) 안에서만 사용 가능합니다")
        return
    if _is_main_chat(message):
        reply_to_with_overlay(message, "메인 그룹은 이미 표시 중 - here_on 불필요")
        return

    global active_thread
    new_thread = (message.chat.id, thread_id)

    # 이전 thread 와 다르면 이전 thread의 STT 출력 정리
    if active_thread is not None and active_thread != new_thread:
        _clear_thread_tts_destinations()

    active_thread = new_thread
    reply_to_with_overlay(
        message,
        f"이 댓글창 오버레이 활성화 (chat_id={message.chat.id}, thread={thread_id})",
    )
    print(f"[INFO] here_on: {new_thread}", flush=True)


@bot.message_handler(commands=["here_off"])
def cmd_here_off(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    global active_thread
    if active_thread is None:
        reply_to_with_overlay(message, "활성화된 댓글창 없음")
        return

    _clear_thread_tts_destinations()

    # thread 만 STT 켜져 있던 상태였다면 STT 자체도 종료
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
        update_state(stt_on=False, tts_on=False)

    cleared = active_thread
    active_thread = None
    reply_to_with_overlay(message, f"댓글창 해제 (이전: {cleared})")
    print(f"[INFO] here_off (cleared {cleared})", flush=True)


def role_command_args(message) -> list[str]:
    text = str(getattr(message, "text", None) or "")
    return [part.strip() for part in text.split()[1:] if part.strip()]


def profile_from_level_record(record: dict) -> dict:
    roles = normalize_roles(record.get("roles"))
    legacy_role = str(record.get("role") or "").strip().lower()
    if legacy_role and legacy_role not in roles:
        roles.append(legacy_role)
    username = str(record.get("username") or "").lstrip("@")
    name = str(record.get("name") or username or record.get("id") or "Unknown")
    return {
        "name": name,
        "speaker_id": str(record.get("id") or ""),
        "username": username,
        "is_host": "king" in roles,
        "is_bot": "bot" in roles,
        "role": primary_role(roles),
        "roles": roles,
    }


def stored_profile_by_username(username: str) -> dict | None:
    reload_level_store_if_changed()
    record = _level_system.find_by_username(username)
    return profile_from_level_record(record) if record else None


def stored_level_record_for_profile(profile: dict) -> dict | None:
    reload_level_store_if_changed()
    key = _level_system.key_for_profile(profile)
    record = _level_system.users.get(key)
    if isinstance(record, dict):
        return dict(record)
    username = str(profile.get("username") or "").lstrip("@")
    if username:
        return _level_system.find_by_username(username)
    return None


async def telethon_profile_by_username(username: str) -> dict | None:
    client = await ensure_telegram_user_client()
    entity = await client.get_entity(username.strip().lstrip("@"))
    return telethon_profile(entity)


def lookup_profile_by_username(username: str) -> dict:
    username = username.strip().lstrip("@")
    stored = stored_profile_by_username(username)
    if stored is not None:
        return stored
    if main_loop is not None:
        try:
            fut = asyncio.run_coroutine_threadsafe(telethon_profile_by_username(username), main_loop)
            profile = fut.result(timeout=8)
            if profile is not None:
                return profile
        except Exception as exc:
            print(f"[WARN] role user lookup failed @{username}: {exc}", flush=True)
    return {
        "name": f"@{username}",
        "speaker_id": "",
        "username": username,
        "is_host": False,
        "is_bot": username.lower() in VIDEOCHAT_BOT_NAMES or username.lower().endswith("bot"),
    }


def role_target_from_message(message, args: list[str]) -> tuple[dict | None, list[str]]:
    remaining = list(args)
    if remaining and remaining[0].startswith("@"):
        return lookup_profile_by_username(remaining.pop(0)), remaining
    reply = getattr(message, "reply_to_message", None)
    if reply is not None:
        return message_profile(reply), remaining
    return None, remaining


def role_target_label(profile: dict) -> str:
    name = str(profile.get("name") or profile.get("username") or profile.get("speaker_id") or "Unknown")
    username = str(profile.get("username") or "").lstrip("@")
    if username and f"@{username}".lower() not in name.lower():
        return f"{name} (@{username})"
    return name


def ensure_role_record(profile: dict) -> tuple[str, dict]:
    profile = dict(profile)
    profile["is_host"] = is_host_profile(profile)
    profile["is_bot"] = is_bot_profile(profile)
    profile["roles"] = roles_for_profile(profile)
    profile["role"] = primary_role(profile["roles"])
    key = level_key(
        str(profile.get("speaker_id") or ""),
        str(profile.get("username") or "").lstrip("@"),
        str(profile.get("name") or profile.get("username") or profile.get("speaker_id") or "Unknown"),
    )
    record, _changed = _level_system.observe_profile(profile, source="chat", roles=profile["roles"])
    return key, record


def set_record_roles(profile: dict, mode: str, role_args: list[str] | None = None) -> tuple[dict, list[str]]:
    _key, record = ensure_role_record(profile)
    auto_roles = auto_roles_for_profile(profile_from_level_record(record) | profile)
    return _level_system.set_roles(profile, mode, role_args or [], auto_roles=auto_roles)


def format_roles(roles: list[str]) -> str:
    return ", ".join(roles) if roles else "(없음)"


def role_usage(command: str) -> str:
    if command == "remove_role":
        return "사용법: 답글로 /remove_role role1 role2 또는 /remove_role @username role1 role2"
    if command == "add_role":
        return "사용법: 답글로 /add_role role1 role2 또는 /add_role @username role1 role2"
    if command == "reset_role":
        return "사용법: 답글로 /reset_role 또는 /reset_role @username"
    return "사용법: 답글로 /check_role 또는 /check_role @username"


@bot.message_handler(commands=["check_role"])
def cmd_check_role(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, _remaining = role_target_from_message(message, role_command_args(message))
    if profile is None:
        reply_to_with_overlay(message, role_usage("check_role"))
        return
    record, roles = set_record_roles(profile, "check")
    reply_to_with_overlay(message, f"{role_target_label(profile)} roles: {format_roles(roles)}")


@bot.message_handler(commands=["add_role"])
def cmd_add_role(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, role_args = role_target_from_message(message, role_command_args(message))
    roles_to_add = normalize_roles(role_args)
    if profile is None or not roles_to_add:
        reply_to_with_overlay(message, role_usage("add_role"))
        return
    _record, roles = set_record_roles(profile, "add", roles_to_add)
    reply_to_with_overlay(message, f"{role_target_label(profile)} roles: {format_roles(roles)}")


@bot.message_handler(commands=["remove_role"])
def cmd_remove_role(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, role_args = role_target_from_message(message, role_command_args(message))
    roles_to_remove = normalize_roles(role_args)
    if profile is None or not roles_to_remove:
        reply_to_with_overlay(message, role_usage("remove_role"))
        return
    _record, roles = set_record_roles(profile, "remove", roles_to_remove)
    reply_to_with_overlay(message, f"{role_target_label(profile)} roles: {format_roles(roles)}")


@bot.message_handler(commands=["reset_role"])
def cmd_reset_role(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, _remaining = role_target_from_message(message, role_command_args(message))
    if profile is None:
        reply_to_with_overlay(message, role_usage("reset_role"))
        return
    _record, roles = set_record_roles(profile, "reset")
    reply_to_with_overlay(message, f"{role_target_label(profile)} roles 초기화: {format_roles(roles)}")


def format_level_notice(template: str, profile: dict, level: int, old_level: int, *, delta: int | None = None) -> str:
    username = str(profile.get("username") or "").lstrip("@")
    text = template.format(
        name=str(profile.get("name") or username or "Unknown"),
        username=username or "-",
        level=level,
        old_level=old_level,
        delta=delta if delta is not None else level - old_level,
        reason=level_reason(level),
    )
    return text.replace("(@-)", "")


def level_usage(command: str) -> str:
    if command == "level_up":
        return "사용법: 답글로 /level_up 숫자 또는 /level_up @username 숫자"
    if command == "level_scan":
        return "사용법: /level_scan, /level_scan 20, 답글로 /level_scan, 또는 /level_scan @username"
    return "사용법: 답글로 /check_level 또는 /check_level @username"


def command_list(*, include_owner: bool = False) -> str:
    lines = [
        "명령어",
        "",
        "일반 명령어",
        "/commands, /help - 이 도움말을 표시합니다.",
        "/fire - 비디오챗 캐릭터 위치에서 폭죽 효과를 실행합니다. 쿨다운이 적용됩니다.",
        f"/cheer [초] - 응원봉을 흔듭니다. 기본 {VIDEOCHAT_CHEER_DEFAULT_SEC:g}초, 최대 {VIDEOCHAT_CHEER_MAX_SEC:g}초입니다.",
        "/cheer off - 응원봉 효과를 멈춥니다.",
    ]
    if include_owner:
        lines.extend([
            "",
            "관리자 전용 명령어",
            "/stream_on - 채팅을 텍스트와 사진 허용 상태로 전환합니다.",
            "/text_on - 텍스트만 허용하고 사진 등 미디어를 차단합니다.",
            "/stream_off - 일반 사용자의 채팅 권한을 음소거 상태로 전환합니다.",
            "/stt_on, /stt_off - STT 송출을 켜거나 끕니다.",
            "/here_on, /here_off - 현재 스레드를 STT/응답 대상 위치로 지정하거나 해제합니다.",
            "/check_role - 대상의 역할을 확인합니다. 답글 또는 @username 사용 가능.",
            "/add_role - 대상에게 역할을 추가합니다. 예: /add_role @username bot",
            "/remove_role - 대상의 역할을 제거합니다. 예: /remove_role @username bot",
            "/reset_role - 대상의 역할을 기본값으로 되돌립니다.",
            "/check_level - 대상의 레벨과 역할을 확인합니다.",
            "/level_scan [개수] - 레벨 목록을 확인합니다. @username 또는 답글 대상도 가능.",
            "/level_up - 대상 레벨을 수동 조정합니다. 예: /level_up @username 1 또는 답글로 /level_up -1",
        ])
    return "\n".join(lines)


# Legacy manual stream-watch helpers. The bot commands are intentionally no longer
# registered because the sub-account receiver auto-joins and keeps receiving.
def videochat_tgcalls_api_request(action: str, *, method: str = "POST", timeout: float = 5.0) -> dict:
    if action not in {"start", "stop", "status"}:
        raise ValueError("unsupported tgcalls action")
    api_method = "GET" if action == "status" else method.upper()
    data = None if api_method == "GET" else b"{}"
    req = urllib.request.Request(
        f"{VIDEOCHAT_API_BASE}/api/videochat/tgcalls/{action}",
        data=data,
        method=api_method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read().decode("utf-8")
    if not body:
        return {}
    return json.loads(body)


def videochat_tgcalls_status_after_start(payload: dict) -> dict:
    reason = str(payload.get("reason") or "")
    if not reason.startswith("starting"):
        return payload
    time.sleep(1.0)
    try:
        return videochat_tgcalls_api_request("status", method="GET", timeout=3)
    except Exception:
        return payload


def format_stream_watch_status(payload: dict) -> str:
    reason = str(payload.get("reason") or "")
    running = bool(payload.get("running"))
    joined = bool(payload.get("joined"))
    requested = bool(payload.get("requested"))
    sources = int(payload.get("sources") or 0)
    login_command = str(payload.get("login_command") or "").strip()
    if reason == "login_required":
        lines = [
            "stream watcher: sub-account login required.",
            "Run this in the repo terminal, then enter the login code for the sub-account:",
        ]
        if login_command:
            lines.append(login_command)
        lines.append("Set TGCALLS_PHONE to the sub-account phone if you want to skip the phone prompt.")
        return "\n".join(lines)
    if joined:
        return f"stream watcher: joined. sources={sources} reason={reason or '-'}"
    if running:
        return f"stream watcher: starting/searching. sources={sources} reason={reason or '-'}"
    if requested:
        return f"stream watcher: requested but not running. reason={reason or '-'}"
    return f"stream watcher: stopped. reason={reason or '-'}"


def format_stream_watch_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code == 404:
            return "stream watcher API not found. Restart the 9393 videochat overlay server after updating code."
        return f"stream watcher API error: HTTP {exc.code}"
    if isinstance(exc, urllib.error.URLError):
        return f"stream watcher API unavailable: {exc.reason}"
    return f"stream watcher failed: {exc.__class__.__name__}: {exc}"


def legacy_cmd_stream_watch(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    try:
        payload = videochat_tgcalls_api_request("start", timeout=8)
        payload = videochat_tgcalls_status_after_start(payload)
    except Exception as exc:
        reply_to_with_overlay(message, format_stream_watch_error(exc))
        return
    reply_to_with_overlay(message, format_stream_watch_status(payload))


def legacy_cmd_stream_unwatch(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    try:
        payload = videochat_tgcalls_api_request("stop", timeout=8)
    except Exception as exc:
        reply_to_with_overlay(message, format_stream_watch_error(exc))
        return
    reply_to_with_overlay(message, format_stream_watch_status(payload))


def profile_level_label(record: dict) -> str:
    roles = normalize_roles(record.get("roles"))
    if "bot" in roles and "king" not in roles:
        return "Bot"
    return f"Lv. {int(record.get('level', 0) or 0)}"


def format_level_scan_line(record: dict) -> str:
    profile = profile_from_level_record(record)
    reason = level_reason(int(record.get("level", 0) or 0))
    suffix = f" - {reason}" if reason else ""
    return f"{role_target_label(profile)}: {profile_level_label(record)}{suffix}"


def notify_videochat_level_reload() -> None:
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({"type": "videochat_levels_updated", "updated_at": time.time()}),
            main_loop,
        )

    def run_request():
        global _videochat_reload_warned
        try:
            req = urllib.request.Request(
                f"{VIDEOCHAT_API_BASE}/api/videochat/levels/reload",
                data=b"{}",
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=2) as res:
                res.read()
        except Exception as exc:
            if not _videochat_reload_warned:
                print(f"[WARN] videochat level reload failed: {exc}", flush=True)
                _videochat_reload_warned = True

    threading.Thread(target=run_request, daemon=True).start()


def notify_videochat_level_effect(profile: dict, old_level: int, new_level: int, *, forced: bool = False, delta: int | None = None) -> None:
    if main_loop is None or new_level == old_level:
        return
    profile = dict(profile or {})
    speaker_id = str(profile.get("speaker_id") or profile.get("id") or "")
    username = str(profile.get("username") or "").lstrip("@")
    name = str(profile.get("name") or username or speaker_id or "Unknown")
    is_host = bool(profile.get("is_host")) or is_host_profile({
        "speaker_id": speaker_id,
        "username": username,
        "name": name,
        "is_bot": profile.get("is_bot", False),
    })
    is_bot = bool(profile.get("is_bot")) or is_bot_profile({
        "speaker_id": speaker_id,
        "username": username,
        "name": name,
        "is_bot": profile.get("is_bot", False),
    })
    roles = roles_for_profile({
        "speaker_id": speaker_id,
        "username": username,
        "name": name,
        "is_host": is_host,
        "is_bot": is_bot,
        "roles": profile.get("roles"),
        "role": profile.get("role"),
    })
    try:
        color_seed = int(speaker_id.lstrip("-") or "0")
    except ValueError:
        color_seed = 0
    asyncio.run_coroutine_threadsafe(
        broadcast({
            "type": "videochat_effect",
            "effect": "level",
            "direction": "up" if new_level > old_level else "down",
            "old_level": old_level,
            "new_level": new_level,
            "delta": delta if delta is not None else new_level - old_level,
            "forced": forced,
            "name": name,
            "speaker_id": speaker_id,
            "username": username,
            "is_host": is_host,
            "is_bot": is_bot,
            "role": primary_role(roles),
            "roles": roles,
            "level": new_level,
            "level_label": "Lv. 99" if is_host else f"Lv. {new_level}",
            "reason": level_reason(new_level),
            "color": color_for(color_seed) if color_seed else USER_COLOR_PALETTE[0],
        }),
        main_loop,
    )


def maybe_emit_level_notice(profile: dict) -> None:
    notices = profile.pop("_level_notices", None)
    legacy_notice = profile.pop("_level_notice", None)
    if not isinstance(notices, list):
        notices = []
    if isinstance(legacy_notice, dict):
        notices.append(legacy_notice)
    if not notices:
        return
    for notice in notices:
        if not isinstance(notice, dict):
            continue
        old_level = int(notice.get("old_level", 0) or 0)
        new_level = int(notice.get("new_level", 0) or 0)
        if new_level <= old_level:
            continue
        text = format_level_notice(LEVEL_UP_TEMPLATE, profile, new_level, old_level)
        key = str(notice.get("level_key") or "")
        try:
            print(f"[LEVEL] notice emitted: {old_level}->{new_level}", flush=True)
            send_message_with_overlay(CHAT_ID, text)
        except Exception as exc:
            print(f"[WARN] level notice failed: {exc}", flush=True)
            return
        if key:
            _level_system.mark_notified_level(key, new_level)
        notify_videochat_level_effect(profile, old_level, new_level)


def maybe_emit_videochat_effect_level_notice(profile: dict, effect: str) -> None:
    if not VIDEOCHAT_LEVEL_SYSTEM_ENABLED or profile.get("is_bot"):
        return
    record, old_level, new_level = _level_system.observe_videochat_effect(profile, effect)
    if new_level <= old_level:
        return
    try:
        last_notified = int(record.get("last_notified_level", 0) or 0)
    except (TypeError, ValueError):
        last_notified = 0
    if new_level <= last_notified:
        return
    notice_profile = profile_from_level_record(record)
    text = format_level_notice(LEVEL_UP_TEMPLATE, notice_profile, new_level, old_level)
    key = str(record.get("key") or _level_system.key_for_profile(notice_profile))
    try:
        print(f"[LEVEL] videochat effect notice emitted: {old_level}->{new_level} ({effect})", flush=True)
        send_message_with_overlay(CHAT_ID, text)
    except Exception as exc:
        print(f"[WARN] videochat effect level notice failed: {exc}", flush=True)
        return
    if key:
        _level_system.mark_notified_level(key, new_level)
    notify_videochat_level_reload()
    notify_videochat_level_effect(notice_profile, old_level, new_level)


@bot.message_handler(commands=["commands", "help"])
def cmd_commands(message):
    is_owner = _is_owner(message)
    if not is_owner and not _is_overlay_source(message):
        return
    emit_text_overlay(message)
    reply_to_with_overlay(message, command_list(include_owner=is_owner))


@bot.message_handler(commands=["check_level"])
def cmd_check_level(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, _remaining = role_target_from_message(message, role_command_args(message))
    if profile is None:
        reply_to_with_overlay(message, level_usage("check_level"))
        return
    profile = dict(profile)
    profile["is_host"] = is_host_profile(profile)
    profile["is_bot"] = is_bot_profile(profile)
    profile["roles"] = roles_for_profile(profile)
    record = stored_level_record_for_profile(profile)
    if record is None:
        reply_to_with_overlay(message, f"{role_target_label(profile)} 레벨 기록이 없습니다.")
        return
    reply_to_with_overlay(
        message,
        f"{role_target_label(profile)} {profile_level_label(record)} roles: {format_roles(normalize_roles(record.get('roles')))}",
    )


@bot.message_handler(commands=["level_scan"])
def cmd_level_scan(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    args = role_command_args(message)
    if args and args[0].startswith("@"):
        profile = lookup_profile_by_username(args[0])
        record = stored_level_record_for_profile(profile)
        if record is None:
            reply_to_with_overlay(message, f"{role_target_label(profile)} 레벨 기록이 없습니다.")
            return
        reply_to_with_overlay(message, format_level_scan_line(record))
        return
    reply = getattr(message, "reply_to_message", None)
    if reply is not None and not args:
        profile = message_profile(reply)
        record = stored_level_record_for_profile(profile)
        if record is None:
            reply_to_with_overlay(message, f"{role_target_label(profile)} 레벨 기록이 없습니다.")
            return
        reply_to_with_overlay(message, format_level_scan_line(record))
        return
    try:
        limit = max(1, min(50, int(args[0]))) if args else 15
    except ValueError:
        reply_to_with_overlay(message, level_usage("level_scan"))
        return
    reload_level_store_if_changed()
    rows = []
    for record in _level_system.users.values():
        if not isinstance(record, dict):
            continue
        roles = normalize_roles(record.get("roles"))
        if "bot" in roles and "king" not in roles:
            continue
        rows.append(record)
    rows.sort(key=lambda r: (int(r.get("level", 0) or 0), float(r.get("updated_at", 0) or 0)), reverse=True)
    if not rows:
        reply_to_with_overlay(message, "레벨 기록이 없습니다.")
        return
    lines = [format_level_scan_line(record) for record in rows[:limit]]
    reply_to_with_overlay(message, "\n".join(lines))


@bot.message_handler(commands=["level_up"])
def cmd_level_up(message):
    if not _is_owner(message):
        return
    emit_text_overlay(message)
    profile, args = role_target_from_message(message, role_command_args(message))
    if profile is None or not args:
        reply_to_with_overlay(message, level_usage("level_up"))
        return
    try:
        delta = int(args[0])
    except ValueError:
        reply_to_with_overlay(message, level_usage("level_up"))
        return
    profile = dict(profile)
    profile["is_host"] = is_host_profile(profile)
    profile["is_bot"] = is_bot_profile(profile)
    profile["roles"] = roles_for_profile(profile)
    record, old_level, new_level = _level_system.adjust_level(profile, delta)
    if new_level > old_level:
        text = format_level_notice(FORCE_LEVEL_UP_TEMPLATE, profile_from_level_record(record), new_level, old_level, delta=delta)
    elif new_level < old_level:
        text = format_level_notice(FORCE_LEVEL_DOWN_TEMPLATE, profile_from_level_record(record), new_level, old_level, delta=delta)
    else:
        text = f"{role_target_label(profile)} 레벨 변화 없음. 현재 {profile_level_label(record)}"
    notify_videochat_level_reload()
    notify_videochat_level_effect(profile_from_level_record(record), old_level, new_level, forced=True, delta=delta)
    reply_to_with_overlay(message, text)


def fire_cooldown_allowed(profile: dict) -> bool:
    global _fire_last_global
    now = time.monotonic()
    speaker_id = str(profile.get("speaker_id") or profile.get("username") or profile.get("name") or "")
    with _fire_lock:
        if VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC > 0 and now - _fire_last_global < VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC:
            return False
        last_user = _fire_last_by_user.get(speaker_id, 0.0)
        if VIDEOCHAT_FIRE_USER_COOLDOWN_SEC > 0 and now - last_user < VIDEOCHAT_FIRE_USER_COOLDOWN_SEC:
            return False
        _fire_last_global = now
        if speaker_id:
            _fire_last_by_user[speaker_id] = now
        return True


def parse_cheer_command(args: list[str]) -> tuple[str, float]:
    if args:
        token = str(args[0] or "").strip().lower()
        if token in {"off", "stop"}:
            return "stop", 0.0
        try:
            seconds = float(token)
        except ValueError:
            seconds = VIDEOCHAT_CHEER_DEFAULT_SEC
    else:
        seconds = VIDEOCHAT_CHEER_DEFAULT_SEC
    if seconds <= 0:
        return "stop", 0.0
    return "start", max(1.0, min(VIDEOCHAT_CHEER_MAX_SEC, seconds))


def videochat_effect_profile_payload(profile: dict) -> dict:
    return {
        "name": profile["name"],
        "speaker_id": profile["speaker_id"],
        "username": profile["username"],
        "is_host": profile["is_host"],
        "is_bot": profile.get("is_bot", False),
        "role": profile.get("role", ""),
        "roles": profile.get("roles", []),
        "color": color_for(int(profile["speaker_id"])) if profile["speaker_id"].lstrip("-").isdigit() else USER_COLOR_PALETTE[0],
    }


@bot.message_handler(commands=["cheer"])
def cmd_cheer(message):
    if not _is_overlay_source(message):
        return
    emit_text_overlay(message)
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
    action, duration_sec = parse_cheer_command(role_command_args(message))
    payload = {
        "type": "videochat_effect",
        "effect": "cheer",
        "action": action,
        **videochat_effect_profile_payload(profile),
    }
    if action == "start":
        payload["duration_sec"] = duration_sec
        maybe_emit_videochat_effect_level_notice(profile, "cheer")
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(broadcast(payload), main_loop)


@bot.message_handler(commands=["fire"])
def cmd_fire(message):
    if not _is_overlay_source(message):
        return
    emit_text_overlay(message)
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
    if not fire_cooldown_allowed(profile):
        return
    maybe_emit_videochat_effect_level_notice(profile, "fire")
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "videochat_effect",
                "effect": "fireworks",
                **videochat_effect_profile_payload(profile),
                "cooldown": {
                    "user_sec": VIDEOCHAT_FIRE_USER_COOLDOWN_SEC,
                    "global_sec": VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC,
                },
            }),
            main_loop,
        )


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["text"],
)
def on_text(message):
    if mark_message_seen_from_message(message):
        return
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    text = message.text
    text, stt_label = split_stt_label_from_text(text, profile)
    cache_custom_emoji_entities(getattr(message, "entities", None), text)
    if should_skip_overlay_duplicate(profile, "text", text):
        print(f"[SEND] duplicate overlay echo skipped: {name}", flush=True)
        return
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    print(f"{name}: {text}", flush=True)
    if main_loop is not None:
        payload = {
                "type": "text",
                "name": name,
                "text": text,
                "entities": text_entities_payload(getattr(message, "entities", None), text),
                "message": message_ref_payload(message),
                "reply": reply_summary_payload(message),
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "is_bot": profile.get("is_bot", False),
                "role": profile.get("role", ""),
                "roles": profile.get("roles", []),
                "level": profile["level"],
                "level_label": profile["level_label"],
            }
        if stt_label:
            payload["stt_label"] = stt_label
            if profile.get("is_bot"):
                payload["videochat_alias"] = host_speaker_payload()
        asyncio.run_coroutine_threadsafe(broadcast(payload), main_loop)


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["photo"],
)
def on_photo(message):
    if not message.photo:
        return
    if mark_message_seen_from_message(message):
        return
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
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
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    caption = str(getattr(message, "caption", None) or "").strip()
    caption_entities = text_entities_payload(getattr(message, "caption_entities", None), caption)
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
                "entities": caption_entities,
                "message": message_ref_payload(message),
                "reply": reply_summary_payload(message),
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "is_bot": profile.get("is_bot", False),
                "role": profile.get("role", ""),
                "roles": profile.get("roles", []),
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
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
        suffix = ".tgs"
    target = STICKERS_DIR / f"{unique_id}{suffix}"
    if not target.exists():
        target.write_bytes(bot.download_file(file_path))
    if is_tgs and not getattr(message_sticker, "is_video", False):
        media_type = "tgs"
    else:
        media_type = "video" if suffix == ".webm" or getattr(message_sticker, "is_video", False) else "image"
    return target, media_type


def download_animation_display(animation) -> tuple[Path, str] | None:
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    unique_id = getattr(animation, "file_unique_id", None) or hashlib.sha256(
        str(getattr(animation, "file_id", "")).encode("utf-8")
    ).hexdigest()[:24]
    info = bot.get_file(animation.file_id)
    file_path = getattr(info, "file_path", "") or ""
    suffix = telegram_file_suffix(file_path, ".mp4")
    target = ANIMATIONS_DIR / f"{unique_id}{suffix}"
    if not target.exists():
        target.write_bytes(bot.download_file(file_path))
    media_type = "image" if suffix == ".gif" else "video"
    return target, media_type


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["sticker"],
)
def on_sticker(message):
    sticker = getattr(message, "sticker", None)
    if sticker is None:
        return
    if mark_message_seen_from_message(message):
        return
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
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
    cache_sticker_item(sticker, target, media_type)
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    url = f"/stickers/{target.name}"
    print(f"{name}: [sticker] {url}", flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "sticker",
                "name": name,
                "url": url,
                "media_type": media_type,
                "text": "",
                "message": message_ref_payload(message),
                "reply": reply_summary_payload(message),
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "is_bot": profile.get("is_bot", False),
                "role": profile.get("role", ""),
                "roles": profile.get("roles", []),
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
        )


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["animation"],
)
def on_animation(message):
    animation = getattr(message, "animation", None)
    if animation is None:
        return
    if mark_message_seen_from_message(message):
        return
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
    try:
        downloaded = download_animation_display(animation)
        cleanup_animations()
    except Exception as e:
        print(f"[WARN] animation download failed: {e}", flush=True)
        return
    if downloaded is None:
        return

    target, media_type = downloaded
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    try:
        media_hash = hashlib.sha256(target.read_bytes()).hexdigest()
    except Exception:
        media_hash = getattr(animation, "file_unique_id", "") or target.name
    if should_skip_overlay_duplicate(profile, "animation", media_hash):
        print(f"[SEND] duplicate animation overlay echo skipped: {name}", flush=True)
        return
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    caption = str(getattr(message, "caption", None) or "").strip()
    caption_entities = text_entities_payload(getattr(message, "caption_entities", None), caption)
    url = f"/animations/{target.name}"
    print(f"{name}: [animation] {url}" + (f" {caption}" if caption else ""), flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "animation",
                "name": name,
                "url": url,
                "media_type": media_type,
                "text": caption,
                "entities": caption_entities,
                "message": message_ref_payload(message),
                "reply": reply_summary_payload(message),
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "is_bot": profile.get("is_bot", False),
                "role": profile.get("role", ""),
                "roles": profile.get("roles", []),
                "level": profile["level"],
                "level_label": profile["level_label"],
            }),
            main_loop,
        )


@bot.message_handler(
    func=lambda m: _is_overlay_source(m),
    content_types=["video"],
)
def on_video(message):
    video = getattr(message, "video", None)
    if video is None:
        return
    if mark_message_seen_from_message(message):
        return
    profile = enrich_profile_level(message_profile(message))
    maybe_emit_level_notice(profile)
    try:
        downloaded = download_animation_display(video)
        cleanup_animations()
    except Exception as e:
        print(f"[WARN] video download failed: {e}", flush=True)
        return
    if downloaded is None:
        return

    target, media_type = downloaded
    name = profile["name"]
    identity_id = int(profile["speaker_id"]) if profile["speaker_id"].lstrip("-").isdigit() else 0
    try:
        media_hash = hashlib.sha256(target.read_bytes()).hexdigest()
    except Exception:
        media_hash = getattr(video, "file_unique_id", "") or target.name
    if should_skip_overlay_duplicate(profile, "animation", media_hash):
        print(f"[SEND] duplicate video overlay echo skipped: {name}", flush=True)
        return
    color = color_for(identity_id) if identity_id else USER_COLOR_PALETTE[0]
    caption = str(getattr(message, "caption", None) or "").strip()
    caption_entities = text_entities_payload(getattr(message, "caption_entities", None), caption)
    url = f"/animations/{target.name}"
    print(f"{name}: [video] {url}" + (f" {caption}" if caption else ""), flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({
                "type": "animation",
                "name": name,
                "url": url,
                "media_type": media_type,
                "text": caption,
                "entities": caption_entities,
                "message": message_ref_payload(message),
                "reply": reply_summary_payload(message),
                "color": color,
                "speaker_id": profile["speaker_id"],
                "username": profile["username"],
                "is_host": profile["is_host"],
                "is_bot": profile.get("is_bot", False),
                "role": profile.get("role", ""),
                "roles": profile.get("roles", []),
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
    global main_loop, stt_manager, bot_user_id, bot_display_name, bot_username, stt_user_client
    main_loop = asyncio.get_running_loop()
    load_user_colors()
    load_level_store()
    load_level_reasons()
    ensure_level_reasons_file()
    load_emoji_cache()

    t = threading.Thread(target=run_bot, daemon=True)
    t.start()

    try:
        me = await asyncio.to_thread(bot.get_me)
        bot_user_id = me.id
        bot_username = me.username or ""
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

    if TELEGRAM_USER_SEND_ENABLED or STT_SEND_AS == "user":
        try:
            await ensure_telegram_user_client()
        except Exception as e:
            print(f"[WARN] Telegram user listener startup skipped: {e}", flush=True)

    state = load_state()
    if state.get("stt_on") or state.get("tts_on"):
        print("[INFO] 이전 세션 상태 복구: stt_on (메인) 자동 재시작", flush=True)
        try:
            ok = await stt_manager.start()
            if ok:
                tts_destinations.append({"chat_id": CHAT_ID, "thread_id": None})
                update_state(stt_on=True, tts_on=False)
            else:
                print("[WARN] stt_on 자동 재시작 실패 - 상태 초기화", flush=True)
                update_state(stt_on=False, tts_on=False)
        except Exception as e:
            print(f"[WARN] stt_on 자동 재시작 예외: {e}", flush=True)
            update_state(stt_on=False, tts_on=False)

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
ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/shared", StaticFiles(directory=str(SHARED_STATIC_DIR)), name="shared")
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
        "fade_after_sec": FADE_AFTER_SEC,
        "chat_font_size": CHAT_FONT_SIZE,
        "user_send_enabled": TELEGRAM_USER_SEND_ENABLED,
        "user_send_panel": TELEGRAM_USER_SEND_PANEL,
        "user_send_max_chars": TELEGRAM_USER_SEND_MAX_CHARS,
        "user_send_max_photo_mb": TELEGRAM_USER_SEND_MAX_PHOTO_MB,
        "user_send_max_media_mb": TELEGRAM_USER_SEND_MAX_MEDIA_MB,
        "level_system_enabled": VIDEOCHAT_LEVEL_SYSTEM_ENABLED,
        "fire_user_cooldown_sec": VIDEOCHAT_FIRE_USER_COOLDOWN_SEC,
        "fire_global_cooldown_sec": VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC,
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
        "max_media_mb": TELEGRAM_USER_SEND_MAX_MEDIA_MB,
    }


@app.get("/api/fire/settings")
async def api_fire_settings(request: Request):
    require_local_request(request)
    return {
        "ok": True,
        "user_cooldown_sec": VIDEOCHAT_FIRE_USER_COOLDOWN_SEC,
        "global_cooldown_sec": VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC,
    }


@app.post("/api/fire/settings")
async def api_fire_settings_update(request: Request):
    require_local_request(request)
    global VIDEOCHAT_FIRE_USER_COOLDOWN_SEC, VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC
    payload = await request.json()
    try:
        user_sec = max(0.0, min(60.0, float(payload.get("user_cooldown_sec", VIDEOCHAT_FIRE_USER_COOLDOWN_SEC))))
        global_sec = max(0.0, min(60.0, float(payload.get("global_cooldown_sec", VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC))))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid cooldown") from exc
    VIDEOCHAT_FIRE_USER_COOLDOWN_SEC = user_sec
    VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC = global_sec
    return {
        "ok": True,
        "user_cooldown_sec": VIDEOCHAT_FIRE_USER_COOLDOWN_SEC,
        "global_cooldown_sec": VIDEOCHAT_FIRE_GLOBAL_COOLDOWN_SEC,
    }


@app.post("/api/level/notify")
async def api_level_notify(request: Request):
    require_local_request(request)
    payload = await request.json()
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    level_key = str(payload.get("level_key") or "")
    try:
        old_level = int(payload.get("old_level", 0))
        new_level = int(payload.get("new_level", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="invalid level") from exc
    if new_level == old_level:
        return {"ok": True, "sent": False}
    if level_key and new_level > old_level:
        reload_level_store_if_changed()
        stored = _level_system.users.get(level_key)
        if isinstance(stored, dict):
            try:
                last_notified = int(stored.get("last_notified_level", 0) or 0)
            except (TypeError, ValueError):
                last_notified = 0
            if new_level <= last_notified:
                return {"ok": True, "sent": False, "deduped": True}
    template = LEVEL_UP_TEMPLATE if new_level > old_level else LEVEL_DOWN_TEMPLATE
    text = format_level_notice(template, profile, new_level, old_level)
    sent = await asyncio.to_thread(bot.send_message, CHAT_ID, text)
    overlay_payload = overlay_payload_once(sent, text)
    if overlay_payload is not None:
        await broadcast(overlay_payload)
    notify_videochat_level_effect(profile, old_level, new_level)
    if level_key:
        await asyncio.to_thread(_level_system.mark_notified_level, level_key, new_level)
    return {"ok": True, "sent": True}


@app.get("/api/users/search")
async def api_user_search(request: Request, q: str = ""):
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="local requests only")
    query = (q or "").strip().lstrip("@")
    if len(query) < 1:
        return {"ok": True, "users": []}
    try:
        client = await ensure_telegram_user_client()
        users = await client.get_participants(CHAT_ID, search=query, limit=12)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"user search failed: {exc}") from exc
    results = []
    for user in users:
        if getattr(user, "bot", False):
            continue
        username = (getattr(user, "username", None) or "").strip()
        name = display_name(user)
        results.append({
            "id": str(user.id),
            "name": name,
            "username": username,
            "insert": f"@{username}" if username else name,
            "can_tag": bool(username),
        })
    return {"ok": True, "users": results}


@app.get("/api/emoji/recent")
async def api_emoji_recent(request: Request):
    require_local_request(request)
    cache = emoji_cache_snapshot()
    recent_stickers = await telegram_recent_sticker_items()
    stickers = []
    seen: set[str] = set()
    for item in recent_stickers + cache.get("stickers", []):
        item = normalized_sticker_item(item)
        key = str(item.get("key") or item.get("file_unique_id") or item.get("document_id") or "")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        if not item.get("url") and not item.get("emoji") and not item.get("can_send_as_user") and not item.get("can_send_as_bot"):
            continue
        stickers.append(item)
    custom_emoji = []
    for item in cache.get("custom_emoji", []):
        row = dict(item)
        row.setdefault("is_premium", True)
        row.setdefault("label", "premium emoji")
        custom_emoji.append(row)
    return {"ok": True, "stickers": stickers[:MAX_EMOJI_CACHE_ITEMS], "custom_emoji": custom_emoji}


@app.get("/api/custom_emoji/{custom_id}/meta")
async def api_custom_emoji_meta(custom_id: str, request: Request):
    require_local_request(request)
    meta = await custom_emoji_meta(custom_id)
    return {"ok": True, **meta}


@app.post("/api/sticker/preview")
async def api_sticker_preview(request: Request):
    require_local_request(request)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="invalid sticker")
    item = normalized_sticker_item(payload)
    preview_key = str(item.get("key") or item.get("file_unique_id") or item.get("document_id") or item.get("file_id") or "")[:32]
    print(
        f"[EMOJI] preview request key={preview_key or '-'} "
        f"user={bool(item.get('can_send_as_user'))} bot={bool(item.get('file_id'))} "
        f"url={bool(item.get('url'))}",
        flush=True,
    )
    if not item.get("url") and item.get("can_send_as_user"):
        try:
            from telethon import types

            client = await ensure_telegram_user_client()
            document = types.InputDocument(
                id=int(item["document_id"]),
                access_hash=int(item["access_hash"]),
                file_reference=bytes.fromhex(item["file_reference"]),
            )
            url = await telethon_sticker_preview_url(client, document, item.get("media_type") or "image", allow_download=True)
            if url:
                item["url"] = url
                update_recent_sticker_preview_cache(item)
                print(f"[EMOJI] preview ready key={preview_key or '-'} route=telethon url={url}", flush=True)
        except Exception as exc:
            print(f"[WARN] recent sticker preview unavailable: {exc}", flush=True)
    if not item.get("url"):
        item = await asyncio.to_thread(ensure_bot_sticker_preview, item)
        if item.get("url"):
            print(f"[EMOJI] preview ready key={preview_key or '-'} route=bot url={item.get('url')}", flush=True)
    if not item.get("url"):
        print(f"[EMOJI] preview failed key={preview_key or '-'}", flush=True)
        raise HTTPException(status_code=404, detail="sticker preview unavailable")
    return {"ok": True, "url": item["url"], "media_type": item.get("media_type") or "image"}


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


def link_preview_bridge_script(nonce: str = "") -> str:
    nonce_attr = f' nonce="{html.escape(nonce, quote=True)}"' if nonce else ""
    return f"""<script{nonce_attr}>
(() => {{
  const send = (payload) => {{
    try {{ parent.postMessage({{ source: "tg-link-preview", href: location.href, ...payload }}, "*"); }} catch (_) {{}}
  }};
  let cachedScroller = null;
  let scrollerCheckedAt = 0;
  const primaryScroller = () => {{
    const now = performance.now();
    if (cachedScroller && now - scrollerCheckedAt < 1000) return cachedScroller;
    scrollerCheckedAt = now;
    const root = document.scrollingElement || document.documentElement || document.body;
    if (root && root.scrollHeight > root.clientHeight + 4) {{
      cachedScroller = root;
      return cachedScroller;
    }}
    let best = root;
    let bestScore = 0;
    try {{
      for (const el of document.querySelectorAll("body *")) {{
        const style = getComputedStyle(el);
        if (!/(auto|scroll)/.test(style.overflowY + style.overflow)) continue;
        const room = el.scrollHeight - el.clientHeight;
        if (room <= 4) continue;
        const rect = el.getBoundingClientRect();
        const score = room * Math.max(1, rect.width) * Math.max(1, rect.height);
        if (score > bestScore) {{
          best = el;
          bestScore = score;
        }}
      }}
    }} catch (_) {{}}
    cachedScroller = best || root;
    return cachedScroller;
  }};
  const scrollState = () => {{
    const s = primaryScroller();
    return {{ scrollX: window.scrollX || (s && s.scrollLeft) || 0, scrollY: window.scrollY || (s && s.scrollTop) || 0 }};
  }};
  let last = "";
  const reportScroll = () => {{
    const state = scrollState();
    const sig = Math.round(state.scrollX) + ":" + Math.round(state.scrollY);
    if (sig === last) return;
    last = sig;
    send({{ type: "tg_link_preview_scroll", ...state }});
  }};
  window.addEventListener("message", (ev) => {{
    const data = ev.data || {{}};
    if (data.type !== "tg_link_preview_apply_scroll") return;
    const x = Number(data.scrollX) || 0;
    const y = Number(data.scrollY) || 0;
    const s = primaryScroller();
    try {{ window.scrollTo(x, y); }} catch (_) {{}}
    if (s) {{ s.scrollLeft = x; s.scrollTop = y; }}
    last = "";
    setTimeout(reportScroll, 50);
  }});
  document.addEventListener("click", (ev) => {{
    const a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (a.target && a.target !== "_self") return;
    const href = a.href;
    if (!href || !/^https?:/i.test(href)) return;
    ev.preventDefault();
    send({{ type: "tg_link_preview_open", href }});
  }}, true);
  window.addEventListener("scroll", reportScroll, {{ passive: true }});
  document.addEventListener("scroll", reportScroll, {{ passive: true, capture: true }});
  setInterval(reportScroll, 250);
  window.addEventListener("load", () => {{ send({{ type: "tg_link_preview_ready" }}); reportScroll(); }});
  send({{ type: "tg_link_preview_ready" }});
  setTimeout(reportScroll, 80);
}})();
</script>"""


def inject_proxy_base(html_text: str, target_url: str) -> str:
    base = f'<base href="{html.escape(target_url, quote=True)}">'
    nonce = secrets.token_urlsafe(12)
    meta = (
        '<meta name="referrer" content="no-referrer">'
        f'<meta http-equiv="Content-Security-Policy" content="script-src &apos;nonce-{html.escape(nonce, quote=True)}&apos;; object-src &apos;none&apos;">'
        + link_preview_bridge_script(nonce)
    )
    lower = html_text[:4096].lower()
    if "<head" in lower:
        insert_at = html_text.lower().find(">", html_text.lower().find("<head"))
        if insert_at >= 0:
            return html_text[:insert_at + 1] + base + meta + html_text[insert_at + 1:]
    return base + meta + html_text


def fetch_proxy_response(target_url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(
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
        with urllib.request.urlopen(request, timeout=10) as upstream:
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


class ReadableLinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: dict[str, str] = {}
        self.in_title = False
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attr = {str(k).lower(): str(v or "") for k, v in attrs}
        if tag == "title":
            self.in_title = True
        if tag in {"script", "style", "svg", "canvas"}:
            self.skip_depth += 1
        if tag == "meta":
            key = (attr.get("property") or attr.get("name") or "").strip().lower()
            content = attr.get("content", "").strip()
            if key and content and key not in self.meta:
                self.meta[key] = content
        if tag == "link":
            rel = attr.get("rel", "").lower()
            href = attr.get("href", "").strip()
            if href and ("icon" in rel or "apple-touch-icon" in rel):
                self.links.setdefault("icon", href)
        if tag in {"p", "div", "section", "article", "li", "br", "h1", "h2", "h3"}:
            self.text_parts.append("\n")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        if tag in {"script", "style", "svg", "canvas"} and self.skip_depth > 0:
            self.skip_depth -= 1

    def handle_data(self, data):
        text = re.sub(r"\s+", " ", data or "").strip()
        if not text:
            return
        if self.in_title:
            self.title_parts.append(text)
            return
        if self.skip_depth:
            return
        if len(text) < 2:
            return
        if len(self.text_parts) < 120:
            self.text_parts.append(text)


def fetch_readable_link_preview(target_url: str) -> dict:
    request = urllib.request.Request(
        target_url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=10) as upstream:
        content_type = upstream.headers.get("content-type", "text/html; charset=utf-8")
        data = upstream.read(1_500_000)
    charset = "utf-8"
    parsed_charset = content_type.lower().split("charset=", 1)
    if len(parsed_charset) == 2:
        charset = parsed_charset[1].split(";", 1)[0].strip() or "utf-8"
    text = data.decode(charset, errors="replace")
    parser = ReadableLinkParser()
    parser.feed(text)
    title = (
        parser.meta.get("og:title")
        or parser.meta.get("twitter:title")
        or " ".join(parser.title_parts).strip()
        or urllib.parse.urlparse(target_url).hostname
        or target_url
    )
    description = (
        parser.meta.get("og:description")
        or parser.meta.get("twitter:description")
        or parser.meta.get("description")
        or ""
    )
    image = parser.meta.get("og:image") or parser.meta.get("twitter:image") or ""
    icon = parser.links.get("icon", "")
    body_text = "\n".join(part for part in parser.text_parts if part != "\n")
    body_text = re.sub(r"\n{3,}", "\n\n", body_text).strip()[:1800]
    return {
        "title": title.strip(),
        "description": description.strip(),
        "image": urllib.parse.urljoin(target_url, image) if image else "",
        "icon": urllib.parse.urljoin(target_url, icon) if icon else "",
        "text": body_text,
        "url": target_url,
    }


def render_readable_link_preview(info: dict, target_url: str, error: str = "") -> str:
    title = html.escape(str(info.get("title") or urllib.parse.urlparse(target_url).hostname or target_url))
    description = html.escape(str(info.get("description") or ""))
    image = html.escape(str(info.get("image") or ""), quote=True)
    icon = html.escape(str(info.get("icon") or ""), quote=True)
    body = html.escape(str(info.get("text") or ""))
    target = html.escape(target_url, quote=True)
    error_html = f'<div class="notice">{html.escape(error)}</div>' if error else ""
    image_html = f'<img class="hero" src="{image}" alt="">' if image else ""
    icon_html = f'<img class="icon" src="{icon}" alt="">' if icon else ""
    description_html = f"<p>{description}</p>" if description else ""
    body_html = f"<pre>{body}</pre>" if body else ""
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<style>
body{{margin:0;background:#0b1118;color:#eef3f8;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;}}
.wrap{{max-width:920px;margin:0 auto;padding:28px;}}
.top{{display:flex;gap:12px;align-items:center;margin-bottom:16px;}}
.icon{{width:34px;height:34px;border-radius:8px;object-fit:cover;background:#1c2733;}}
h1{{font-size:28px;line-height:1.2;margin:0 0 10px;font-weight:850;}}
p{{margin:0 0 18px;color:#cbd6e2;font-size:16px;}}
.hero{{display:block;max-width:100%;max-height:420px;object-fit:contain;border-radius:12px;margin:18px 0;background:#111b25;}}
pre{{white-space:pre-wrap;word-break:break-word;margin:18px 0 0;padding:18px;border-radius:12px;background:#111b25;color:#dce7f3;font:14px/1.58 system-ui,-apple-system,Segoe UI,sans-serif;}}
.actions{{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;}}
a{{color:#ffe28a;text-decoration:none;font-weight:800;}}
.button{{border:1px solid rgba(255,226,138,.42);border-radius:10px;padding:9px 12px;background:rgba(255,226,138,.12);}}
.url{{color:#8fa1b5;font-size:12px;word-break:break-all;}}
.notice{{margin-bottom:14px;padding:12px 14px;border-radius:10px;background:rgba(255,120,120,.12);border:1px solid rgba(255,120,120,.28);color:#ffd0d0;}}
</style>
</head>
<body>
<main class="wrap">
{error_html}
<div class="top">{icon_html}<div class="url">{target}</div></div>
<h1>{title}</h1>
{description_html}
{image_html}
{body_html}
<div class="actions"><a class="button" href="{target}" target="_blank" rel="noreferrer">open external</a></div>
</main>
{link_preview_bridge_script()}
</body>
</html>"""


X_HOST_SUFFIXES = ("x.com", "twitter.com")
X_STATUS_RE = re.compile(r"/status(?:es)?/(\d+)", re.IGNORECASE)


def is_x_host(host: str | None) -> bool:
    normalized = (host or "").strip().lower()
    return any(normalized == suffix or normalized.endswith(f".{suffix}") for suffix in X_HOST_SUFFIXES)


def validate_x_preview_target(raw_url: str) -> urllib.parse.ParseResult:
    parsed = validate_proxy_target(raw_url)
    if not is_x_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="not an x url")
    return parsed


def base36_float(value: float) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    integer = int(value)
    fraction = value - integer
    if integer == 0:
        prefix = "0"
    else:
        parts = []
        while integer:
            integer, mod = divmod(integer, 36)
            parts.append(digits[mod])
        prefix = "".join(reversed(parts))
    suffix = []
    for _ in range(14):
        if fraction <= 0:
            break
        fraction *= 36
        digit = int(fraction)
        suffix.append(digits[digit])
        fraction -= digit
    return prefix + (("." + "".join(suffix).rstrip("0")) if suffix else "")


def x_status_id(parsed: urllib.parse.ParseResult) -> str:
    match = X_STATUS_RE.search(parsed.path or "")
    return match.group(1) if match else ""


def x_oembed_payload(target_url: str) -> dict[str, Any]:
    params = urllib.parse.urlencode({
        "url": target_url,
        "omit_script": "1",
        "theme": "dark",
        "dnt": "true",
        "maxwidth": "1200",
        "maxheight": "720",
        "chrome": "noheader nofooter noborders transparent",
    })
    req = urllib.request.Request(
        f"https://publish.x.com/oembed?{params}",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=8) as res:
        return json.loads(res.read(1_000_000).decode("utf-8", errors="replace"))


def x_syndication_payload(tweet_id: str) -> dict[str, Any]:
    token = base36_float((int(tweet_id) / 1_000_000_000_000_000) * math.pi)
    params = urllib.parse.urlencode({"id": tweet_id, "token": token, "lang": "ko"})
    req = urllib.request.Request(
        f"https://cdn.syndication.twimg.com/tweet-result?{params}",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/147.0 Safari/537.36"
            ),
            "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
            "Referer": "https://platform.x.com/",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=8) as res:
        return json.loads(res.read(1_500_000).decode("utf-8", errors="replace"))


def x_card_shell(title: str, body: str, target_url: str) -> str:
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<style>
html,body{{margin:0;min-height:100%;background:#08111f;color:#eef3ff;font-family:Inter,Arial,sans-serif;}}
body{{box-sizing:border-box;padding:18px;}}
.card{{max-width:820px;margin:0 auto;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:linear-gradient(180deg,rgba(23,32,48,.96),rgba(8,13,22,.96));box-shadow:0 22px 60px rgba(0,0,0,.36);overflow:hidden;}}
.top{{display:flex;gap:12px;align-items:center;padding:18px 18px 8px;}}
.avatar{{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#1d2938;}}
.name{{font-weight:900;font-size:18px;line-height:1.15;}}
.handle,.meta{{color:#9ba8ba;font-size:13px;margin-top:3px;}}
.text{{padding:10px 18px 16px;white-space:pre-wrap;font-size:18px;line-height:1.45;word-break:break-word;}}
.media{{display:grid;gap:8px;padding:0 18px 18px;}}
.media img,.media video{{width:100%;max-height:520px;object-fit:contain;border-radius:14px;background:#02050a;}}
.media.grid{{grid-template-columns:repeat(2,minmax(0,1fr));}}
.notice{{padding:18px;font-size:15px;line-height:1.55;color:#d5deec;}}
.actions{{display:flex;gap:10px;padding:0 18px 18px;}}
a.button{{display:inline-flex;align-items:center;height:34px;padding:0 13px;border-radius:9px;background:rgba(255,218,112,.16);border:1px solid rgba(255,218,112,.38);color:#ffe38c;font-weight:850;text-decoration:none;}}
.embed{{padding:12px 14px 18px;}}
.embed iframe{{max-width:100%!important;}}
</style>
</head>
<body>
<div class="card">
{body}
<div class="actions"><a class="button" href="{html.escape(target_url, quote=True)}" target="_blank" rel="noreferrer">open on X</a></div>
</div>
{link_preview_bridge_script()}
</body>
</html>"""


def render_x_syndication_card(data: dict[str, Any], target_url: str) -> str:
    if data.get("__typename") == "TweetTombstone":
        text = (((data.get("tombstone") or {}).get("text") or {}).get("text") or "This post is unavailable.")
        return x_card_shell("X post", f'<div class="notice">{html.escape(text)}</div>', target_url)
    user = data.get("user") or {}
    name = html.escape(str(user.get("name") or "X user"))
    handle = html.escape(str(user.get("screen_name") or ""))
    avatar = html.escape(str(user.get("profile_image_url_https") or ""), quote=True)
    text = html.escape(str(data.get("text") or "")).replace("https://t.co/", "https://t.co/")
    created_at = html.escape(str(data.get("created_at") or ""))
    media_parts = []
    for photo in data.get("photos") or []:
        src = photo.get("url") or photo.get("media_url_https")
        if src:
            media_parts.append(f'<img src="{html.escape(str(src), quote=True)}" alt="">')
    video = data.get("video") or {}
    if video:
        poster = html.escape(str(video.get("poster") or ""), quote=True)
        variants = [
            variant for variant in video.get("variants") or []
            if "mp4" in str(variant.get("type") or "") and variant.get("src")
        ]
        src = html.escape(str((variants[-1] if variants else {}).get("src") or ""), quote=True)
        if src:
            media_parts.append(f'<video controls playsinline poster="{poster}"><source src="{src}" type="video/mp4"></video>')
        elif poster:
            media_parts.append(f'<img src="{poster}" alt="">')
    media_class = "media grid" if len(media_parts) > 1 else "media"
    avatar_html = f'<img class="avatar" src="{avatar}" alt="">' if avatar else '<div class="avatar"></div>'
    body = (
        '<div class="top">'
        f'{avatar_html}<div><div class="name">{name}</div>'
        f'<div class="handle">@{handle}</div><div class="meta">{created_at}</div></div></div>'
        f'<div class="text">{text}</div>'
        + (f'<div class="{media_class}">{"".join(media_parts)}</div>' if media_parts else "")
    )
    return x_card_shell("X post", body, target_url)


def render_x_oembed_card(payload: dict[str, Any], target_url: str) -> str:
    embed_html = str(payload.get("html") or "")
    if not embed_html:
        raise ValueError("empty oembed html")
    return x_card_shell("X embed", f'<div class="embed">{embed_html}</div>', target_url)


def render_x_fallback_card(parsed: urllib.parse.ParseResult, target_url: str, error: str = "") -> str:
    if (parsed.path or "").strip("/") == "search":
        query = urllib.parse.parse_qs(parsed.query).get("q", [""])[0]
        detail = f"검색어: {query}" if query else "X 검색 페이지"
        message = (
            "이 링크는 X 검색 페이지입니다. 검색 결과 목록은 X 웹앱 내부 API에서 받아오기 때문에 "
            "내부 미리보기에서는 검색어만 표시합니다."
        )
    else:
        detail = target_url
        message = "X가 이 링크에 대해 내부 표시 가능한 내용을 반환하지 않았습니다."
        if error:
            message += f" ({error})"
    body = (
        f'<div class="notice"><strong>{html.escape(message)}</strong><br>'
        f'{html.escape(detail)}</div>'
    )
    return x_card_shell("X preview", body, target_url)


def build_x_preview_html(target_url: str) -> str:
    parsed = validate_x_preview_target(target_url)
    normalized = urllib.parse.urlunparse(parsed)
    if (parsed.path or "").strip("/") == "search":
        return render_x_fallback_card(parsed, normalized)
    tweet_id = x_status_id(parsed)
    if tweet_id:
        try:
            return render_x_syndication_card(x_syndication_payload(tweet_id), normalized)
        except Exception:
            pass
    try:
        return render_x_oembed_card(x_oembed_payload(normalized), normalized)
    except Exception as exc:
        return render_x_fallback_card(parsed, normalized, str(exc))


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
    html_doc = await asyncio.to_thread(build_x_preview_html, url)
    return HTMLResponse(
        html_doc,
        headers={
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


@app.get("/api/link/readable")
async def api_link_readable(request: Request, url: str = ""):
    require_local_request(request)
    parsed = validate_proxy_target(url)
    target_url = urllib.parse.urlunparse(parsed)
    try:
        info = await asyncio.to_thread(fetch_readable_link_preview, target_url)
        html_doc = render_readable_link_preview(info, target_url)
    except Exception as exc:
        html_doc = render_readable_link_preview({}, target_url, f"Readable preview failed: {exc}")
    return HTMLResponse(
        html_doc,
        headers={
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


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

    text = str(payload.get("text") or "")
    media = decode_send_media(payload.get("media") or payload.get("photo"))
    sticker = decode_send_sticker(payload.get("sticker"))
    custom_emoji = decode_send_custom_emoji(payload.get("custom_emoji"))
    custom_entities = decode_send_custom_entities(payload.get("custom_entities"), text)
    reply_to = reply_ref_from_payload(payload.get("reply_to"))
    if not text.strip() and not media and not sticker and not custom_emoji:
        raise HTTPException(status_code=400, detail="empty message")
    if sum(1 for item in (media, sticker, custom_emoji) if item) > 1:
        raise HTTPException(status_code=400, detail="send one media item at a time")
    if len(text) > TELEGRAM_USER_SEND_MAX_CHARS:
        raise HTTPException(status_code=400, detail="text too long")
    raw_targets = payload.get("targets")
    if not isinstance(raw_targets, list):
        raw_targets = []
    targets = [str(x) for x in raw_targets if str(x) in {"main", "here"}]
    if not targets and not reply_to:
        raise HTTPException(status_code=400, detail="no targets selected")

    results = await dispatch_overlay_user_message(
        text,
        targets,
        media,
        reply_to,
        sticker=sticker,
        custom_emoji=custom_emoji,
        custom_entities=custom_entities,
    )
    ok = [r for r in results if r.get("ok")]
    if not ok:
        raise HTTPException(status_code=502, detail={"message": "send failed", "results": results})
    return {"ok": True, "sent": len(ok), "results": results}


@app.post("/api/message/delete")
async def api_delete_message(request: Request):
    host = request.client.host if request.client else ""
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(status_code=403, detail="local requests only")
    try:
        payload = await request.json()
        chat_id = int(str(payload.get("chat_id") or "0"))
        message_id = int(str(payload.get("message_id") or "0"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid message reference") from exc
    if chat_id == 0 or message_id <= 0:
        raise HTTPException(status_code=400, detail="invalid message reference")
    result = await delete_telegram_message(chat_id, message_id)
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result)
    if main_loop is not None:
        await broadcast({
            "type": "delete",
            "message": {"chat_id": str(chat_id), "message_id": message_id},
        })
    return result


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    async with clients_lock:
        clients.add(ws)
    try:
        while True:
            text = await ws.receive_text()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            if payload.get("type") == "chat_control":
                await broadcast(payload)
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
