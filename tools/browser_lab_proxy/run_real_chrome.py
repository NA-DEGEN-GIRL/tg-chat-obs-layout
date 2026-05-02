#!/usr/bin/env python3
"""Launch a real Chrome instance and attach Browser Lab over CDP.

This helper is for sites that behave differently in Playwright-managed
Chromium, especially React-heavy login flows with bot/risk checks. It keeps the
Chrome profile outside the repository by default.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Iterable, Optional
from urllib.error import URLError
from urllib.request import urlopen


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PROXY_PORT = 9494
DEFAULT_CDP_PORT = 9222
DEFAULT_PROFILE_DIR = Path("/tmp/tg-browser-lab-real-chrome-profile")
DEFAULT_RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime")
REPO_ROOT = Path(__file__).resolve().parents[2]


def is_under(child: Path, parent: Path) -> bool:
    try:
        child.resolve(strict=False).relative_to(parent.resolve(strict=False))
        return True
    except ValueError:
        return False


def assert_outside_repo(path: Path) -> None:
    resolved = path.resolve(strict=False)
    if resolved == REPO_ROOT or is_under(resolved, REPO_ROOT):
        raise SystemExit(f"Refusing to use a runtime path inside this repo: {resolved}")


def candidate_binaries() -> Iterable[str]:
    env_bin = os.environ.get("TG_BROWSER_LAB_CHROME_BIN") or os.environ.get("TG_BROWSER_LAB_EXECUTABLE_PATH")
    if env_bin:
        yield env_bin
    for name in ("google-chrome", "google-chrome-stable", "chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            yield found
    for path in (
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
        "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
    ):
        if Path(path).exists():
            yield path


def resolve_chrome_bin(explicit: Optional[str]) -> str:
    if explicit:
        path = Path(explicit).expanduser()
        if path.exists() or shutil.which(explicit):
            return str(path if path.exists() else explicit)
        raise SystemExit(f"Chrome executable not found: {explicit}")
    for candidate in candidate_binaries():
        path = Path(candidate).expanduser()
        if path.exists() or shutil.which(candidate):
            return str(path if path.exists() else candidate)
    raise SystemExit(
        "Could not find a Chrome/Chromium executable. Install Chrome or pass "
        "`--chrome-bin /path/to/google-chrome`."
    )


def is_windows_exe_path(path: str) -> bool:
    return path.lower().endswith(".exe") or path.startswith("/mnt/")


def chrome_path_arg(chrome_bin: str, path: Path) -> str:
    if not is_windows_exe_path(chrome_bin):
        return str(path)
    try:
        result = subprocess.run(
            ["wslpath", "-w", str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return str(path)


def windows_path_text(path: str) -> str:
    if not (path.startswith("/mnt/") or path.startswith("/")):
        return path
    try:
        result = subprocess.run(
            ["wslpath", "-w", path],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return path


def wait_for_cdp(cdp_url: str, timeout: float) -> None:
    endpoint = f"{cdp_url.rstrip('/')}/json/version"
    started = time.monotonic()
    while time.monotonic() - started < timeout:
        try:
            with urlopen(endpoint, timeout=1.0) as response:  # noqa: S310 - local CDP endpoint only.
                if response.status == 200:
                    return
        except URLError:
            pass
        except TimeoutError:
            pass
        time.sleep(0.25)
    raise SystemExit(f"Timed out waiting for Chrome CDP endpoint: {endpoint}")


def launch_chrome(chrome_bin: str, cdp_port: int, profile_dir: Path, start_url: str) -> subprocess.Popen:
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_arg = chrome_path_arg(chrome_bin, profile_dir)
    args = [
        chrome_bin,
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={profile_arg}",
        "--no-first-run",
        "--no-default-browser-check",
        start_url,
    ]
    try:
        return subprocess.Popen(args)  # noqa: S603 - executable is explicit user/local Chrome path.
    except OSError as exc:
        if is_windows_exe_path(chrome_bin):
            raise SystemExit(
                "Failed to launch Windows Chrome from this shell. If this is WSL, "
                "enable Windows interop or launch Chrome manually from Windows:\n"
                f"  chrome.exe --remote-debugging-port={cdp_port} "
                f"--user-data-dir=\"{profile_arg}\" --no-first-run\n"
                "Then run this helper with:\n"
                f"  {sys.executable} tools/browser_lab_proxy/run_real_chrome.py "
                f"--no-launch --cdp-url http://127.0.0.1:{cdp_port}"
            ) from exc
        raise


def chrome_command_text(chrome_bin: str, cdp_port: int, profile_dir: Path, start_url: str) -> str:
    profile_arg = chrome_path_arg(chrome_bin, profile_dir)
    chrome_arg = windows_path_text(chrome_bin) if is_windows_exe_path(chrome_bin) else chrome_bin
    return (
        f'"{chrome_arg}" '
        f"--remote-debugging-port={cdp_port} "
        f'--user-data-dir="{profile_arg}" '
        "--no-first-run "
        "--no-default-browser-check "
        f"{start_url}"
    )


def print_candidates() -> None:
    seen: set[str] = set()
    for candidate in candidate_binaries():
        if candidate in seen:
            continue
        seen.add(candidate)
        print(candidate)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Browser Lab attached to a real Chrome over CDP.")
    parser.add_argument("--chrome-bin", default="", help="Path to Chrome/Chromium. Defaults to auto-detection.")
    parser.add_argument("--host", default=os.environ.get("TG_BROWSER_LAB_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("TG_BROWSER_LAB_PORT", DEFAULT_PROXY_PORT)))
    parser.add_argument("--cdp-port", type=int, default=int(os.environ.get("TG_BROWSER_LAB_CDP_PORT", DEFAULT_CDP_PORT)))
    parser.add_argument("--cdp-url", default=os.environ.get("TG_BROWSER_LAB_CDP_URL", ""))
    parser.add_argument("--profile-dir", default=os.environ.get("TG_BROWSER_LAB_REAL_CHROME_PROFILE_DIR", str(DEFAULT_PROFILE_DIR)))
    parser.add_argument("--runtime-dir", default=os.environ.get("TG_BROWSER_LAB_RUNTIME_DIR", str(DEFAULT_RUNTIME_DIR)))
    parser.add_argument("--start-url", default="about:blank")
    parser.add_argument("--no-launch", action="store_true", help="Do not launch Chrome; connect to --cdp-url instead.")
    parser.add_argument("--list-browsers", action="store_true", help="Print detected Chrome/Chromium candidates and exit.")
    parser.add_argument("--print-windows-command", action="store_true", help="Print a Chrome command for Windows Terminal and exit.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.list_browsers:
        print_candidates()
        return
    profile_dir = Path(args.profile_dir).expanduser().resolve(strict=False)
    runtime_dir = Path(args.runtime_dir).expanduser().resolve(strict=False)
    assert_outside_repo(profile_dir)
    assert_outside_repo(runtime_dir)
    runtime_dir.mkdir(parents=True, exist_ok=True)

    if args.print_windows_command:
        chrome_bin = resolve_chrome_bin(args.chrome_bin)
        print(chrome_command_text(chrome_bin, args.cdp_port, profile_dir, args.start_url))
        print()
        print("After Chrome is running, start Browser Lab with:")
        print(
            f"{sys.executable} tools/browser_lab_proxy/run_real_chrome.py "
            f"--no-launch --cdp-url http://127.0.0.1:{args.cdp_port}"
        )
        return

    cdp_url = args.cdp_url or f"http://127.0.0.1:{args.cdp_port}"
    chrome_proc: Optional[subprocess.Popen] = None
    if not args.no_launch:
        chrome_bin = resolve_chrome_bin(args.chrome_bin)
        print(f"Launching Chrome: {chrome_bin}", flush=True)
        print(f"Chrome profile: {profile_dir}", flush=True)
        chrome_proc = launch_chrome(chrome_bin, args.cdp_port, profile_dir, args.start_url)
    else:
        if not args.cdp_url:
            raise SystemExit("--no-launch requires --cdp-url")

    wait_for_cdp(cdp_url, timeout=15.0)
    os.environ["TG_BROWSER_LAB_CDP_URL"] = cdp_url
    os.environ["TG_BROWSER_LAB_PROFILE_DIR"] = str(profile_dir)
    os.environ["TG_BROWSER_LAB_RUNTIME_DIR"] = str(runtime_dir)

    # Import after env setup because server.controller reads env at import time.
    import uvicorn  # pylint: disable=import-outside-toplevel
    from server import app  # pylint: disable=import-error,import-outside-toplevel

    print(f"Browser Lab proxy: http://{args.host}:{args.port}", flush=True)
    print(f"Connected CDP: {cdp_url}", flush=True)
    try:
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    finally:
        if chrome_proc and chrome_proc.poll() is None:
            chrome_proc.terminate()
            try:
                chrome_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                chrome_proc.kill()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    main()
