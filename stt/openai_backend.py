import asyncio
import base64
import json
import os
from typing import Awaitable, Callable

import websockets

REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription"


def _debug() -> bool:
    return os.getenv("STT_DEBUG", "") not in ("", "0", "false", "False")


class OpenAIBackend:
    sample_rate = 24000  # Realtime API pcm16 default

    def __init__(
        self,
        api_key: str,
        model: str,
        language: str,
        on_final: Callable[[str], Awaitable[None]],
    ):
        self.api_key = api_key
        self.model = model
        self.language = language
        self.on_final = on_final
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._reader_task: asyncio.Task | None = None

    async def connect(self) -> None:
        self._ws = await websockets.connect(
            REALTIME_URL,
            additional_headers={
                "Authorization": f"Bearer {self.api_key}",
                "OpenAI-Beta": "realtime=v1",
            },
            max_size=None,
            ping_interval=20,
            ping_timeout=20,
        )
        await self._ws.send(json.dumps({
            "type": "transcription_session.update",
            "session": {
                "input_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": self.model,
                    "language": self.language,
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
            },
        }))
        self._reader_task = asyncio.create_task(self._reader(), name="stt-openai-reader")

    async def _reader(self) -> None:
        assert self._ws is not None
        try:
            async for raw in self._ws:
                try:
                    ev = json.loads(raw)
                except Exception:
                    continue
                t = ev.get("type", "")
                if _debug():
                    s = json.dumps(ev, ensure_ascii=False)
                    print(f"[STT OpenAI] <- {s[:400]}{'...' if len(s)>400 else ''}", flush=True)
                if t == "conversation.item.input_audio_transcription.completed":
                    text = (ev.get("transcript") or "").strip()
                    if text:
                        try:
                            await self.on_final(text)
                        except Exception as e:
                            print(f"[STT OpenAI] on_final callback error: {e}", flush=True)
                elif t == "error":
                    print(f"[STT OpenAI] error: {ev.get('error')}", flush=True)
        except websockets.ConnectionClosed as e:
            print(f"[STT OpenAI] connection closed: code={e.code} reason={e.reason!r}", flush=True)
        except Exception as e:
            print(f"[STT OpenAI] reader crashed: {e}", flush=True)

    async def send_audio(self, pcm16: bytes) -> None:
        if self._ws is None:
            return
        try:
            await self._ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm16).decode(),
            }))
        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[STT OpenAI] send_audio error: {e}", flush=True)

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
