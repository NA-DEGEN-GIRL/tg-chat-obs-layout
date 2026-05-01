import argparse
import asyncio
import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient


BASE_DIR = Path(__file__).parent
DEFAULT_SESSION = BASE_DIR / "data" / "telethon" / "videochat_receiver"
DEFAULT_OUTPUT_DIR = BASE_DIR / "data" / "debug_tgcalls_videochat"


def log(message: str) -> None:
    print(message, flush=True)


def clean_env(value: str | None) -> str:
    value = value or ""
    if "#" in value:
        value = value.split("#", 1)[0]
    return value.strip().strip('"').strip("'")


def clean_env_int(*names: str, default: int = 0) -> int:
    for name in names:
        value = clean_env(os.getenv(name))
        if not value:
            continue
        match = re.search(r"-?\d+", value)
        if match:
            return int(match.group(0))
        try:
            return int(value)
        except ValueError:
            continue
    return default


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


def chat_id_candidates(explicit_chat_id: int = 0) -> list[tuple[str, int]]:
    if explicit_chat_id:
        return [("--chat-id", explicit_chat_id)]
    out: list[tuple[str, int]] = []
    seen: set[int] = set()
    for name in ("TGCALLS_CHAT_IDS", "TD_CHAT_ID", "CHAT_ID", "VIDEOCHAT_LEVEL_CHAT_ID"):
        for value in clean_env_int_list(name):
            if value and value not in seen:
                out.append((name, value))
                seen.add(value)
    return out


def frame_format_guess(frame_len: int, width: int, height: int) -> str:
    pixels = max(0, width) * max(0, height)
    if pixels <= 0:
        return "unknown"
    if frame_len == pixels * 4:
        return "rgba_or_bgra"
    if frame_len == pixels * 3:
        return "rgb24_or_bgr24"
    if frame_len == pixels * 3 // 2:
        return "yuv420p_or_nv12"
    if frame_len == pixels:
        return "gray8_or_luma"
    return f"unknown_ratio_{frame_len / pixels:.3f}"


def safe_source_key(device_name: str, ssrc: int) -> str:
    return f"{device_name.lower()}_{int(ssrc)}"


async def run_probe(args) -> int:
    try:
        from pytgcalls import PyTgCalls
        from pytgcalls import filters
        from pytgcalls.types import Device
        from pytgcalls.types import Direction
        from pytgcalls.types import GroupCallConfig
        from pytgcalls.types import RecordStream
        from pytgcalls.types import StreamFrames
    except Exception as exc:
        raise RuntimeError("py-tgcalls[telethon] is required for this probe") from exc

    api_id = int(clean_env(os.getenv("TD_API_ID")) or "0")
    api_hash = clean_env(os.getenv("TD_API_HASH"))
    phone = clean_env(os.getenv("TGCALLS_PHONE"))
    if not api_id or not api_hash:
        raise RuntimeError("TD_API_ID and TD_API_HASH are required.")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "last_probe.json"
    session_path = Path(args.session)

    client = TelegramClient(str(session_path), api_id, api_hash)
    if not phone:
        await client.connect()
        authorized = await client.is_user_authorized()
        await client.disconnect()
        if not authorized:
            phone = input("Telegram phone number for TgCalls receiver/sub-account login: ").strip()
    await client.start(phone=phone or None)
    if args.login_only:
        log(f"[tgcalls] login ready session={session_path}")
        await client.disconnect()
        return 0

    candidates = chat_id_candidates(int(args.chat_id or 0))
    if not candidates:
        raise RuntimeError("Pass --chat-id or set TGCALLS_CHAT_IDS, TD_CHAT_ID, CHAT_ID, or VIDEOCHAT_LEVEL_CHAT_ID.")

    app = PyTgCalls(client)
    done = asyncio.Event()
    started_at = time.time()
    seen: dict[str, dict] = {}
    frame_limit = max(1, int(args.frame_limit))

    @app.on_update(filters.stream_frame(Direction.INCOMING, Device.CAMERA | Device.SCREEN))
    async def on_frame(_, update: StreamFrames):
        device_name = getattr(update.device, "name", str(update.device))
        for frame in update.frames:
            key = safe_source_key(device_name, frame.ssrc)
            width = int(getattr(frame.info, "width", 0) or 0)
            height = int(getattr(frame.info, "height", 0) or 0)
            frame_bytes = bytes(frame.frame or b"")
            meta = seen.setdefault(key, {
                "device": device_name,
                "ssrc": int(frame.ssrc),
                "width": width,
                "height": height,
                "rotation": int(getattr(frame.info, "rotation", 0) or 0),
                "format_guess": frame_format_guess(len(frame_bytes), width, height),
                "frames": 0,
                "first_seen_at": time.time(),
                "last_seen_at": 0,
                "sample_path": "",
                "sample_len": len(frame_bytes),
            })
            meta["frames"] += 1
            meta["last_seen_at"] = time.time()
            if not meta["sample_path"] and len(seen) <= frame_limit:
                sample = output_dir / f"{key}_{width}x{height}.raw"
                sample.write_bytes(frame_bytes)
                meta["sample_path"] = str(sample)
            if sum(item["frames"] for item in seen.values()) >= frame_limit:
                done.set()

    await app.start()
    chat_id = 0
    join_timeout = max(3.0, float(args.join_timeout))
    last_join_error = None
    for label, candidate in candidates:
        try:
            log(f"[tgcalls] started; joining candidate={label}")
            await asyncio.wait_for(
                app.play(candidate, stream=None, config=GroupCallConfig(auto_start=False)),
                timeout=join_timeout,
            )
            chat_id = candidate
            log(f"[tgcalls] joined candidate={label}")
            break
        except asyncio.TimeoutError as exc:
            last_join_error = exc
            log(f"[tgcalls] candidate={label} unavailable: join_timeout")
        except Exception as exc:
            last_join_error = exc
            log(f"[tgcalls] candidate={label} unavailable: {exc.__class__.__name__}")
    if chat_id == 0:
        raise RuntimeError(f"No active group call found in configured chat candidates: {last_join_error}")
    record_stream = RecordStream(
        audio=False,
        camera=args.devices in {"camera", "both"},
        screen=args.devices in {"screen", "both"},
    )
    log(f"[tgcalls] enabling incoming recording devices={args.devices}")
    record_task = asyncio.create_task(app.record(chat_id, record_stream))
    try:
        await asyncio.wait_for(asyncio.shield(record_task), timeout=max(2.0, float(args.record_timeout)))
        log("[tgcalls] incoming recording enabled")
    except asyncio.TimeoutError:
        log("[tgcalls] incoming recording still pending; waiting for frames anyway")
    print("[tgcalls] receiving incoming camera/screen frames", flush=True)

    try:
        try:
            await asyncio.wait_for(done.wait(), timeout=max(1.0, float(args.wait)))
        except asyncio.TimeoutError:
            pass
    finally:
        if args.leave:
            try:
                await app.leave_call(chat_id)
                log("[tgcalls] left call")
            except Exception as exc:
                log(f"[tgcalls] leave failed: {exc}")
        if not record_task.done():
            record_task.cancel()
        await client.disconnect()

    report = {
        "chat_id": str(chat_id),
        "wait_sec": float(args.wait),
        "elapsed_sec": round(time.time() - started_at, 3),
        "sources": list(seen.values()),
        "source_count": len(seen),
        "total_frames": sum(item["frames"] for item in seen.values()),
        "note": "Frame samples are raw decoded bytes; format_guess must be validated before browser rendering.",
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"[tgcalls] sources={report['source_count']} total_frames={report['total_frames']}")
    for source in report["sources"]:
        log(
            "[tgcalls] "
            f"{source['device']} ssrc={source['ssrc']} "
            f"{source['width']}x{source['height']} "
            f"frames={source['frames']} format={source['format_guess']}"
        )
    log(f"[tgcalls] report saved: {report_path}")
    if args.force_exit:
        os._exit(0)
    return 0


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Probe incoming Telegram videochat frames through PyTgCalls.")
    parser.add_argument("--chat-id", type=int, default=0)
    parser.add_argument("--session", default=clean_env(os.getenv("TGCALLS_SESSION")) or str(DEFAULT_SESSION))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--wait", type=float, default=10.0)
    parser.add_argument("--join-timeout", type=float, default=8.0)
    parser.add_argument("--record-timeout", type=float, default=6.0)
    parser.add_argument("--frame-limit", type=int, default=8)
    parser.add_argument("--devices", choices=("camera", "screen", "both"), default="both")
    parser.add_argument("--leave", action="store_true", help="Explicitly leave the group call after probing.")
    parser.add_argument("--no-force-exit", dest="force_exit", action="store_false")
    parser.add_argument("--login-only", action="store_true", help="Only authorize the receiver session, then exit.")
    parser.set_defaults(force_exit=True)
    args = parser.parse_args()
    return asyncio.run(run_probe(args))


if __name__ == "__main__":
    raise SystemExit(main())
