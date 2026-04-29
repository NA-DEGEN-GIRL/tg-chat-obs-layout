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
        self._supervisor_task: asyncio.Task | None = None
        self._running: bool = False
        self._ws_ready = asyncio.Event()

    async def connect(self) -> None:
        """Supervisor 태스크 시작. 내부적으로 연결·재연결 영구 루프."""
        self._running = True
        self._ws_ready.clear()
        self._supervisor_task = asyncio.create_task(
            self._supervisor(), name="stt-openai-supervisor"
        )
        # 첫 연결 성공까지 최대 10초 대기 (매니저에 결과 보고용)
        try:
            await asyncio.wait_for(self._ws_ready.wait(), timeout=10.0)
        except asyncio.TimeoutError:
            print("[STT OpenAI] 첫 연결 10초 내 못 붙음 — 백그라운드에서 계속 시도", flush=True)

    async def _supervisor(self) -> None:
        backoff = 1.0
        while self._running:
            try:
                await self._session_once()
                if not self._running:
                    break
                print("[STT OpenAI] 세션 종료 — 자동 재연결", flush=True)
                backoff = 1.0
            except Exception as e:
                print(f"[STT OpenAI] 연결 실패: {e} (재시도 {backoff:.1f}s 후)", flush=True)
            if not self._running:
                break
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
        print("[STT OpenAI] supervisor 종료", flush=True)

    async def _session_once(self) -> None:
        ws = await websockets.connect(
            REALTIME_URL,
            additional_headers={
                "Authorization": f"Bearer {self.api_key}",
                "OpenAI-Beta": "realtime=v1",
            },
            max_size=None,
            ping_interval=20,
            ping_timeout=20,
        )
        self._ws = ws
        self._ws_ready.set()
        try:
            await ws.send(json.dumps({
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
            async for raw in ws:
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
                    print(f"[STT OpenAI] server error: {ev.get('error')}", flush=True)
        except websockets.ConnectionClosed as e:
            print(
                f"[STT OpenAI] connection closed: code={e.code} reason={e.reason!r}",
                flush=True,
            )
        finally:
            self._ws = None

    async def send_audio(self, pcm16: bytes) -> None:
        ws = self._ws
        if ws is None:
            return  # 재연결 구간의 오디오는 버림 (지연 최소화)
        try:
            await ws.send(json.dumps({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm16).decode(),
            }))
        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[STT OpenAI] send_audio error: {e}", flush=True)

    async def close(self) -> None:
        self._running = False
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
        if self._supervisor_task is not None:
            self._supervisor_task.cancel()
            try:
                await self._supervisor_task
            except (asyncio.CancelledError, Exception):
                pass
        self._ws = None
        self._supervisor_task = None
