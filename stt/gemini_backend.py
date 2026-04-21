import asyncio
import base64
import json
import os
from typing import Awaitable, Callable

import websockets

GEMINI_WS_TMPL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
    "?key={key}"
)


def _debug() -> bool:
    return os.getenv("STT_DEBUG", "") not in ("", "0", "false", "False")


class GeminiBackend:
    sample_rate = 16000  # Gemini Live input audio

    def __init__(
        self,
        api_key: str,
        model: str,
        language: str,
        on_final: Callable[[str], Awaitable[None]],
    ):
        self.api_key = api_key
        self.model = model
        self.language = language  # Gemini Live는 언어 코드 자동 감지, 설정은 힌트용
        self.on_final = on_final
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._reader_task: asyncio.Task | None = None
        self._partial_buf: list[str] = []
        self._setup_complete: bool = False

    async def connect(self) -> None:
        url = GEMINI_WS_TMPL.format(key=self.api_key)
        self._ws = await websockets.connect(
            url,
            max_size=None,
            ping_interval=20,
            ping_timeout=20,
        )
        setup_msg = {
            "setup": {
                "model": f"models/{self.model}",
                "generationConfig": {"responseModalities": ["TEXT"]},
                "inputAudioTranscription": {},
            }
        }
        if _debug():
            print(f"[STT Gemini] -> setup: {json.dumps(setup_msg, ensure_ascii=False)}", flush=True)
        await self._ws.send(json.dumps(setup_msg))
        self._reader_task = asyncio.create_task(self._reader(), name="stt-gemini-reader")

    async def _reader(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                if isinstance(raw, (bytes, bytearray)):
                    try:
                        raw = raw.decode("utf-8")
                    except Exception:
                        if _debug():
                            print(f"[STT Gemini] <- (binary, {len(raw)} bytes)", flush=True)
                        continue
                try:
                    data = json.loads(raw)
                except Exception:
                    if _debug():
                        print(f"[STT Gemini] <- (non-json): {raw[:200]}", flush=True)
                    continue

                if _debug():
                    # 너무 크면 앞부분만
                    s = json.dumps(data, ensure_ascii=False)
                    print(f"[STT Gemini] <- {s[:500]}{'...' if len(s)>500 else ''}", flush=True)

                if "setupComplete" in data:
                    self._setup_complete = True
                    print("[STT Gemini] setupComplete", flush=True)
                    continue

                if "error" in data:
                    print(f"[STT Gemini] server error: {data['error']}", flush=True)
                    continue

                sc = data.get("serverContent") or {}
                it = sc.get("inputTranscription")
                if it and isinstance(it, dict):
                    text = (it.get("text") or "").strip()
                    if text:
                        self._partial_buf.append(text)

                if sc.get("turnComplete"):
                    full = "".join(self._partial_buf).strip()
                    self._partial_buf.clear()
                    if full:
                        try:
                            await self.on_final(full)
                        except Exception as e:
                            print(f"[STT Gemini] on_final cb error: {e}", flush=True)
        except websockets.ConnectionClosed as e:
            print(f"[STT Gemini] connection closed: code={e.code} reason={e.reason!r}", flush=True)
        except Exception as e:
            print(f"[STT Gemini] reader crashed: {e}", flush=True)

    async def send_audio(self, pcm16: bytes) -> None:
        if self._ws is None:
            return
        try:
            msg = {
                "realtimeInput": {
                    "audio": {
                        "mimeType": f"audio/pcm;rate={self.sample_rate}",
                        "data": base64.b64encode(pcm16).decode(),
                    }
                }
            }
            await self._ws.send(json.dumps(msg))
        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[STT Gemini] send_audio error: {e}", flush=True)

    async def close(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
        if self._reader_task is not None:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except (asyncio.CancelledError, Exception):
                pass
        self._ws = None
        self._reader_task = None
