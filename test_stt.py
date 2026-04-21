"""STT 단독 테스트 스크립트.

텔레그램/오버레이 없이 마이크 입력만 받아서 인식된 텍스트를 CMD에 출력한다.
실행:
  uv run python test_stt.py                    # .env 의 STT_PROVIDER 사용
  uv run python test_stt.py --provider openai  # OpenAI 강제
  uv run python test_stt.py --provider gemini  # Gemini 강제
  uv run python test_stt.py --device RODE      # 마이크 일시 지정
  uv run python test_stt.py --debug            # 백엔드 raw 이벤트 로깅
종료: Ctrl+C
"""
import argparse
import asyncio
import os
import sys

from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

from stt import STTManager  # noqa: E402


parser = argparse.ArgumentParser()
parser.add_argument("--provider", choices=["openai", "gemini"], default=None)
parser.add_argument("--device", default=None, help="마이크 지정(이름 일부 또는 인덱스)")
parser.add_argument("--debug", action="store_true", help="백엔드 raw 이벤트 전체 출력")
args = parser.parse_args()


def _clean(v: str) -> str:
    # python-dotenv는 unquoted 값의 인라인 `#` 주석을 제거하지 않으므로 방어
    if "#" in v:
        v = v.split("#", 1)[0]
    return v.strip()


STT_PROVIDER = _clean(args.provider or os.getenv("STT_PROVIDER", "openai"))
OPENAI_API_KEY = _clean(os.getenv("OPENAI_API_KEY", ""))
GEMINI_API_KEY = _clean(os.getenv("GEMINI_API_KEY", ""))
STT_MODEL_OPENAI = _clean(os.getenv("STT_MODEL_OPENAI", "gpt-4o-mini-transcribe"))
STT_MODEL_GEMINI = _clean(os.getenv("STT_MODEL_GEMINI", "gemini-3.1-flash-live-preview"))
STT_LANGUAGE = _clean(os.getenv("STT_LANGUAGE", "ko"))
STT_INPUT_DEVICE = _clean(
    args.device if args.device is not None else os.getenv("STT_INPUT_DEVICE", "")
)

if args.debug:
    os.environ["STT_DEBUG"] = "1"


async def on_text(text: str) -> None:
    print(f">>> {text}", flush=True)


async def main() -> None:
    loop = asyncio.get_running_loop()
    mgr = STTManager(
        cfg={
            "provider": STT_PROVIDER,
            "openai_api_key": OPENAI_API_KEY,
            "gemini_api_key": GEMINI_API_KEY,
            "openai_model": STT_MODEL_OPENAI,
            "gemini_model": STT_MODEL_GEMINI,
            "language": STT_LANGUAGE,
            "input_device": STT_INPUT_DEVICE,
        },
        loop=loop,
        on_text=on_text,
    )

    print(f"[TEST] provider={STT_PROVIDER}", flush=True)
    print(
        f"[TEST] model={STT_MODEL_OPENAI if STT_PROVIDER=='openai' else STT_MODEL_GEMINI}",
        flush=True,
    )
    print(f"[TEST] device={STT_INPUT_DEVICE or '(OS default)'}", flush=True)
    print(f"[TEST] debug={args.debug}", flush=True)
    print("[TEST] 시작 중... 연결 뜨면 말해보세요. 종료는 Ctrl+C", flush=True)

    ok = await mgr.start()
    if not ok:
        print("[TEST] 시작 실패 — 위 로그 확인", flush=True)
        return

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        print("\n[TEST] 종료 중...", flush=True)
        await mgr.stop()
        print("[TEST] 종료 완료", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
