import asyncio
import json
import os
import random
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import telebot
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
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

STT_PROVIDER = os.getenv("STT_PROVIDER", "openai").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
STT_MODEL_OPENAI = os.getenv("STT_MODEL_OPENAI", "gpt-4o-mini-transcribe").strip()
STT_MODEL_GEMINI = os.getenv("STT_MODEL_GEMINI", "gemini-3.1-flash-live-preview").strip()
STT_LANGUAGE = os.getenv("STT_LANGUAGE", "ko").strip()
STT_INPUT_DEVICE = os.getenv("STT_INPUT_DEVICE", "").strip()

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

# 어두운 반투명 배경에서 가독성 좋은 색만 추려낸 팔레트
USER_COLOR_PALETTE = [
    "#FF7676", "#FF9F5C", "#FFD166", "#C8E66B", "#72D978",
    "#5EE3C1", "#5EBFE3", "#7D9EFF", "#A88CFF", "#DF8CFF",
    "#FF8CD1", "#FFA3B8", "#F08A5D", "#E0C074", "#B5D46C",
    "#6FDB9C", "#6FDBD4", "#6FA7DB", "#9B8FD4", "#D49BC9",
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

_colors_lock = threading.Lock()
_user_colors: dict[str, str] = {}


def load_user_colors() -> None:
    global _user_colors
    try:
        if COLORS_FILE.exists():
            _user_colors = json.loads(COLORS_FILE.read_text(encoding="utf-8"))
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
            _user_colors[key] = random.choice(USER_COLOR_PALETTE)
            save_user_colors()
        return _user_colors[key]


def display_name(user) -> str:
    if user is None:
        return "Unknown"
    name = user.first_name or ""
    if user.last_name:
        name = f"{name} {user.last_name}".strip()
    if not name:
        name = user.username or "Unknown"
    return name


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


async def stt_on_text(text: str) -> None:
    print(f"[STT] {bot_display_name}: {text}", flush=True)

    color = color_for(bot_user_id or 0)
    overlay = broadcast({"name": bot_display_name, "text": text, "color": color})
    send_tg = asyncio.to_thread(bot.send_message, CHAT_ID, text)
    results = await asyncio.gather(overlay, send_tg, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            print(f"[STT] dispatch error: {r}", flush=True)


@bot.message_handler(commands=["tts_on"])
def cmd_tts_on(message):
    if not _is_owner_in_target_chat(message):
        return
    if stt_manager is None or main_loop is None:
        bot.reply_to(message, "STT 매니저 초기화 전")
        return
    fut = asyncio.run_coroutine_threadsafe(stt_manager.start(), main_loop)
    try:
        ok = fut.result(timeout=15)
        if ok:
            bot.reply_to(
                message,
                f"TTS 시작 (드라이런): {STT_PROVIDER} 백엔드로 CMD에 출력 중",
            )
        else:
            bot.reply_to(message, "이미 실행 중이거나 시작 실패 — 콘솔 로그 확인")
    except Exception as e:
        bot.reply_to(message, f"시작 실패: {e}")
        print(f"[ERROR] tts_on: {e}", flush=True)


@bot.message_handler(commands=["tts_off"])
def cmd_tts_off(message):
    if not _is_owner_in_target_chat(message):
        return
    if stt_manager is None or main_loop is None:
        return
    fut = asyncio.run_coroutine_threadsafe(stt_manager.stop(), main_loop)
    try:
        ok = fut.result(timeout=10)
        bot.reply_to(message, "TTS 종료" if ok else "이미 중지 상태")
    except Exception as e:
        bot.reply_to(message, f"중지 실패: {e}")
        print(f"[ERROR] tts_off: {e}", flush=True)


@bot.message_handler(
    func=lambda m: m.chat.id == CHAT_ID and not (m.text or "").startswith("/"),
    content_types=["text"],
)
def on_text(message):
    name = display_name(message.from_user)
    text = message.text
    color = color_for(message.from_user.id) if message.from_user else USER_COLOR_PALETTE[0]
    print(f"{name}: {text}", flush=True)
    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            broadcast({"name": name, "text": text, "color": color}),
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
    global main_loop, stt_manager, bot_user_id, bot_display_name
    main_loop = asyncio.get_running_loop()
    load_user_colors()

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

    yield

    try:
        if stt_manager and stt_manager.active:
            await stt_manager.stop()
    except Exception:
        pass
    try:
        bot.stop_polling()
    except Exception:
        pass


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/config")
async def get_config():
    return {"fade_after_sec": FADE_AFTER_SEC}


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
