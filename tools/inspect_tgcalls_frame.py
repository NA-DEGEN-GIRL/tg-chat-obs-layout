import argparse
import binascii
import html
import json
import struct
import zlib
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DEBUG_DIR = BASE_DIR / "data" / "debug_tgcalls_videochat"


def clamp(value: int) -> int:
    return max(0, min(255, value))


def yuv_to_rgb(y: int, u: int, v: int) -> tuple[int, int, int]:
    c = y - 16
    d = u - 128
    e = v - 128
    return (
        clamp((298 * c + 409 * e + 128) >> 8),
        clamp((298 * c - 100 * d - 208 * e + 128) >> 8),
        clamp((298 * c + 516 * d + 128) >> 8),
    )


def convert_yuv420(data: bytes, width: int, height: int, mode: str, max_width: int) -> tuple[int, int, bytearray]:
    out_w = min(width, max(1, max_width))
    out_h = max(1, round(height * out_w / width))
    y_size = width * height
    uv_w = width // 2
    uv_size = uv_w * (height // 2)
    rgb = bytearray(out_w * out_h * 3)
    for oy in range(out_h):
        sy = min(height - 1, oy * height // out_h)
        for ox in range(out_w):
            sx = min(width - 1, ox * width // out_w)
            y_value = data[sy * width + sx]
            if mode == "nv12":
                uv_index = y_size + (sy // 2) * width + (sx // 2) * 2
                u_value = data[uv_index] if uv_index < len(data) else 128
                v_value = data[uv_index + 1] if uv_index + 1 < len(data) else 128
            else:
                uv_index = (sy // 2) * uv_w + (sx // 2)
                u_value = data[y_size + uv_index] if y_size + uv_index < len(data) else 128
                v_offset = y_size + uv_size + uv_index
                v_value = data[v_offset] if v_offset < len(data) else 128
            r, g, b = yuv_to_rgb(y_value, u_value, v_value)
            out = (oy * out_w + ox) * 3
            rgb[out:out + 3] = bytes((r, g, b))
    return out_w, out_h, rgb


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, width: int, height: int, rgb: bytes) -> None:
    rows = bytearray()
    stride = width * 3
    for y in range(height):
        rows.append(0)
        start = y * stride
        rows.extend(rgb[start:start + stride])
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + png_chunk(b"IEND", b"")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert a saved PyTgCalls raw frame into previewable PPM files.")
    parser.add_argument("raw", nargs="?", default="")
    parser.add_argument("--width", type=int, default=0)
    parser.add_argument("--height", type=int, default=0)
    parser.add_argument("--max-width", type=int, default=640)
    args = parser.parse_args()

    debug_dir = DEFAULT_DEBUG_DIR
    raw_path = Path(args.raw) if args.raw else next(debug_dir.glob("camera_*x*.raw"), None)
    if not raw_path:
        raise SystemExit("No raw frame found. Run tgcalls_videochat_probe.py first.")
    raw_path = raw_path.resolve()
    width, height = args.width, args.height
    if not width or not height:
        stem = raw_path.stem
        try:
            size = stem.rsplit("_", 1)[1]
            width, height = [int(part) for part in size.lower().split("x", 1)]
        except Exception as exc:
            raise SystemExit("Pass --width and --height for this raw file.") from exc
    data = raw_path.read_bytes()
    output_dir = raw_path.parent / "frame_preview"
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    for mode in ("yuv420p", "nv12"):
        out_w, out_h, rgb = convert_yuv420(data, width, height, mode, max(1, args.max_width))
        target = output_dir / f"{raw_path.stem}_{mode}.png"
        write_png(target, out_w, out_h, rgb)
        outputs.append({"mode": mode, "path": target.name, "width": out_w, "height": out_h})
    report = {
        "raw": str(raw_path),
        "bytes": len(data),
        "source_width": width,
        "source_height": height,
        "outputs": outputs,
    }
    (output_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    items = "\n".join(
        f"<section><h2>{html.escape(item['mode'])}</h2><img src='{html.escape(item['path'])}' width='{item['width']}' height='{item['height']}'></section>"
        for item in outputs
    )
    (output_dir / "index.html").write_text(
        "<!doctype html><meta charset='utf-8'><title>TgCalls Frame Preview</title>"
        "<style>body{font-family:sans-serif;background:#101820;color:white}section{margin:24px}img{max-width:90vw;height:auto;border:1px solid #778}</style>"
        f"<h1>{html.escape(raw_path.name)}</h1>{items}",
        encoding="utf-8",
    )
    print(output_dir / "index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
