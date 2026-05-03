import asyncio
from typing import Any, Awaitable, Callable

import sounddevice as sd

from .gemini_backend import GeminiBackend
from .openai_backend import OpenAIBackend


def _resolve_device(spec: str | None) -> int | str | None:
    if not spec:
        return None
    spec = spec.strip()
    if not spec:
        return None
    try:
        return int(spec)
    except ValueError:
        pass
    try:
        devices = sd.query_devices()
    except Exception as e:
        print(f"[STT] device enumeration failed: {e}", flush=True)
        return None
    needle = spec.lower()
    for i, d in enumerate(devices):
        if d.get("max_input_channels", 0) > 0 and needle in d.get("name", "").lower():
            return i
    print(f"[STT] input device '{spec}' not found, using OS default", flush=True)
    return None


class STTManager:
    def __init__(
        self,
        cfg: dict[str, Any],
        loop: asyncio.AbstractEventLoop,
        on_text: Callable[[str], Awaitable[None]],
    ):
        self.cfg = cfg
        self.loop = loop
        self.on_text = on_text
        self._backend: Any = None
        self._audio_stream: sd.RawInputStream | None = None
        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=200)
        self._consumer_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self.active: bool = False

    def _make_backend(self):
        provider = (self.cfg.get("provider") or "openai").lower()
        if provider == "openai":
            key = self.cfg.get("openai_api_key", "")
            if not key:
                raise RuntimeError("OPENAI_API_KEY 가 비어 있습니다")
            return OpenAIBackend(
                api_key=key,
                model=self.cfg.get("openai_model", "gpt-4o-mini-transcribe"),
                language=self.cfg.get("language", "ko"),
                on_final=self.on_text,
            )
        if provider == "gemini":
            key = self.cfg.get("gemini_api_key", "")
            if not key:
                raise RuntimeError("GEMINI_API_KEY 가 비어 있습니다")
            return GeminiBackend(
                api_key=key,
                model=self.cfg.get("gemini_model", "gemini-3.1-flash-live-preview"),
                language=self.cfg.get("language", "ko"),
                on_final=self.on_text,
            )
        raise RuntimeError(f"알 수 없는 STT_PROVIDER: {provider}")

    async def start_remote(self) -> bool:
        async with self._lock:
            if self.active:
                return True
            try:
                self._backend = self._make_backend()
                await self._backend.connect()
                self._consumer_task = asyncio.create_task(
                    self._audio_consumer(), name="stt-audio-consumer"
                )
                self.active = True
                print(
                    f"[STT] remote input started provider={self.cfg.get('provider')} "
                    f"model={self._backend.__class__.__name__} sample_rate={self._backend.sample_rate}",
                    flush=True,
                )
                return True
            except Exception as e:
                print(f"[STT] remote start failed: {e}", flush=True)
                await self._cleanup_locked()
                return False

    @property
    def sample_rate(self) -> int:
        if self._backend is not None:
            return int(getattr(self._backend, "sample_rate", 24000) or 24000)
        backend = self._make_backend()
        return int(getattr(backend, "sample_rate", 24000) or 24000)

    def feed_audio(self, pcm16: bytes) -> bool:
        if not self.active or not pcm16:
            return False
        try:
            self._audio_queue.put_nowait(bytes(pcm16))
            return True
        except asyncio.QueueFull:
            try:
                self._audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                self._audio_queue.put_nowait(bytes(pcm16))
                return True
            except asyncio.QueueFull:
                return False

    async def start(self) -> bool:
        async with self._lock:
            if self.active:
                return False
            try:
                self._backend = self._make_backend()
                await self._backend.connect()

                sr = self._backend.sample_rate
                blocksize = int(sr * 0.04)  # 40ms frames
                device = _resolve_device(self.cfg.get("input_device"))

                def _enqueue(chunk: bytes) -> None:
                    q = self._audio_queue
                    try:
                        q.put_nowait(chunk)
                    except asyncio.QueueFull:
                        # 오버플로우: 오래된 프레임 하나 버리고 최신 저장
                        try:
                            q.get_nowait()
                        except Exception:
                            pass
                        try:
                            q.put_nowait(chunk)
                        except Exception:
                            pass

                def callback(indata, frames, time_info, status):  # noqa: ARG001
                    try:
                        self.loop.call_soon_threadsafe(_enqueue, bytes(indata))
                    except Exception:
                        pass

                self._audio_stream = sd.RawInputStream(
                    samplerate=sr,
                    channels=1,
                    dtype="int16",
                    blocksize=blocksize,
                    device=device,
                    callback=callback,
                )
                self._audio_stream.start()
                self._consumer_task = asyncio.create_task(
                    self._audio_consumer(), name="stt-audio-consumer"
                )
                self.active = True
                print(
                    f"[STT] started provider={self.cfg.get('provider')} "
                    f"model={self._backend.__class__.__name__} "
                    f"sample_rate={sr} device={device}",
                    flush=True,
                )
                return True
            except Exception as e:
                print(f"[STT] start failed: {e}", flush=True)
                await self._cleanup_locked()
                return False

    async def _audio_consumer(self) -> None:
        try:
            while True:
                chunk = await self._audio_queue.get()
                if self._backend is None:
                    continue
                await self._backend.send_audio(chunk)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[STT] audio consumer error: {e}", flush=True)

    async def stop(self) -> bool:
        async with self._lock:
            if not self.active:
                return False
            await self._cleanup_locked()
            self.active = False
            print("[STT] stopped", flush=True)
            return True

    async def _cleanup_locked(self) -> None:
        if self._audio_stream is not None:
            try:
                self._audio_stream.stop()
                self._audio_stream.close()
            except Exception:
                pass
            self._audio_stream = None
        if self._consumer_task is not None:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except (asyncio.CancelledError, Exception):
                pass
            self._consumer_task = None
        if self._backend is not None:
            try:
                await self._backend.close()
            except Exception:
                pass
            self._backend = None
        try:
            while not self._audio_queue.empty():
                self._audio_queue.get_nowait()
        except Exception:
            pass
