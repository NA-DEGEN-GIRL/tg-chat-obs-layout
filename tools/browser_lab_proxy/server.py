#!/usr/bin/env python3
"""Remote Chromium sidecar for static_videochat/browser_lab.html.

This is intentionally separate from the existing app. It exposes a local
WebSocket that streams screenshots from a real Playwright Chromium page and
forwards mouse/keyboard/navigation commands back into that page.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import re
import shutil
import sys
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse, urlunparse

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import (
    BrowserContext,
    Download,
    Error as PlaywrightError,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9494
DEFAULT_PROFILE_DIR = Path("/tmp/tg-browser-lab-profile")
DEFAULT_RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime")
REPO_ROOT = Path(__file__).resolve().parents[2]

MIN_VIEWPORT_WIDTH = 320
MIN_VIEWPORT_HEIGHT = 240
MAX_VIEWPORT_WIDTH = 3840
MAX_VIEWPORT_HEIGHT = 2160
MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024
MAX_UPLOAD_TOTAL_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_FILES = 8

PRIVATE_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
BLOCKED_SCHEMES = {
    "file",
    "ftp",
    "chrome",
    "chrome-extension",
    "devtools",
    "view-source",
    "javascript",
    "data",
}
IGNORED_KEY_VALUES = {
    "HangulMode",
    "HanjaMode",
    "JunjaMode",
    "KanaMode",
    "KanjiMode",
    "Eisu",
    "Convert",
    "NonConvert",
    "Process",
    "Unidentified",
    "Dead",
}
KEY_ALIASES = {
    " ": "Space",
    "Esc": "Escape",
    "Del": "Delete",
    "Win": "Meta",
    "OS": "Meta",
}
ASCII_KEYBOARD_TEXT_RE = re.compile(r"^[\x09\x0a\x0d\x20-\x7e]+$")
HISTORY_STATUS_BRIDGE_SCRIPT = """
(() => {
  if (window.__browserLabHistoryStatusBridgeInstalled) return;
  window.__browserLabHistoryStatusBridgeInstalled = true;

  const notify = (navState) => {
    try {
      if (typeof window.__browserLabStatusChanged !== 'function') return;
      window.__browserLabStatusChanged({
        url: window.location.href,
        title: document.title || '',
        nav_state: navState,
      });
    } catch (_err) {}
  };

  const wrapHistory = (name) => {
    const original = history[name];
    if (typeof original !== 'function' || original.__browserLabWrapped) return;
    const wrapped = function browserLabHistoryWrapper(...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => notify(name));
      return result;
    };
    try {
      Object.defineProperty(wrapped, '__browserLabWrapped', { value: true });
      history[name] = wrapped;
    } catch (_err) {}
  };

  wrapHistory('pushState');
  wrapHistory('replaceState');
  window.addEventListener('popstate', () => notify('popstate'), true);
  window.addEventListener('hashchange', () => notify('hashchange'), true);
  window.addEventListener('pageshow', () => notify('pageshow'), true);

  const watchTitle = () => {
    const title = document.querySelector('title');
    if (!title || title.__browserLabObserved) return;
    try {
      title.__browserLabObserved = true;
      new MutationObserver(() => notify('title')).observe(title, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    } catch (_err) {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchTitle, { once: true });
  } else {
    watchTitle();
  }
})();
"""


def _parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _resolve_runtime_path(env_name: str, default: Path) -> Path:
    raw = os.environ.get(env_name)
    path = Path(raw).expanduser() if raw else default
    return path.resolve(strict=False)


def _is_under(child: Path, parent: Path) -> bool:
    try:
        child.resolve(strict=False).relative_to(parent.resolve(strict=False))
        return True
    except ValueError:
        return False


def _assert_outside_repo(path: Path) -> None:
    resolved = path.resolve(strict=False)
    if resolved == REPO_ROOT or _is_under(resolved, REPO_ROOT):
        raise RuntimeError(f"Runtime path must be outside the repo: {resolved}")


def _assert_safe_delete_path(path: Path) -> None:
    resolved = path.resolve(strict=False)
    _assert_outside_repo(resolved)
    tmp_root = Path("/tmp").resolve()
    allow_non_tmp = _parse_bool(os.environ.get("TG_BROWSER_LAB_ALLOW_RESET_NON_TMP"), False)
    if not allow_non_tmp and (resolved == tmp_root or not _is_under(resolved, tmp_root)):
        raise RuntimeError(
            "Refusing to delete a non-/tmp runtime path. Set "
            "TG_BROWSER_LAB_ALLOW_RESET_NON_TMP=1 only if you know the path is safe."
        )


def _clamp_int(value: Any, minimum: int, maximum: int, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _clamp_float(value: Any, minimum: float, maximum: float, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _sanitize_filename(name: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return (clean or "download.bin")[:120]


def _safe_url_for_log(url: str) -> str:
    try:
        parsed = urlparse(url)
    except ValueError:
        return "<invalid-url>"
    if parsed.scheme == "about":
        return "about:blank"
    path = parsed.path or "/"
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def _normalize_key_value(raw_key: Any) -> str:
    key = str(raw_key or "")
    return KEY_ALIASES.get(key, key)


def _is_keyboard_typable_text(text: str) -> bool:
    return bool(text) and bool(ASCII_KEYBOARD_TEXT_RE.fullmatch(text))


def _mouse_modifier_bitmask(modifiers: Any) -> int:
    if not isinstance(modifiers, dict):
        return 0
    bitmask = 0
    if modifiers.get("alt"):
        bitmask |= 1
    if modifiers.get("ctrl"):
        bitmask |= 2
    if modifiers.get("meta"):
        bitmask |= 4
    if modifiers.get("shift"):
        bitmask |= 8
    return bitmask


def _mouse_button_bit(button: str) -> int:
    if button == "left":
        return 1
    if button == "right":
        return 2
    if button == "middle":
        return 4
    return 0


def _cdp_mouse_button(button: str) -> str:
    return button if button in {"left", "right", "middle"} else "none"


def _sanitize_debug_message(message: Any, limit: int = 500) -> str:
    text = str(message or "")
    text = re.sub(r"(?i)(password|passwd|authorization|cookie|token|secret)=([^\s&]+)", r"\1=<redacted>", text)
    text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+", r"\1<redacted>", text)
    text = re.sub(r"g;[0-9][^\s\"']+", "<x-flow-token>", text)
    text = " ".join(text.split())
    return text[:limit]


def _hostname_is_obviously_private(hostname: Optional[str]) -> bool:
    if not hostname:
        return False
    host = hostname.strip("[]").lower()
    if host in PRIVATE_HOSTS:
        return True
    parts = host.split(".")
    if len(parts) == 4 and all(part.isdigit() for part in parts):
        nums = [int(part) for part in parts]
        if nums[0] == 10:
            return True
        if nums[0] == 172 and 16 <= nums[1] <= 31:
            return True
        if nums[0] == 192 and nums[1] == 168:
            return True
        if nums[0] == 169 and nums[1] == 254:
            return True
    return False


def normalize_navigation_url(raw_url: str, block_private: bool) -> str:
    raw = (raw_url or "").strip()
    if not raw:
        raise ValueError("URL is empty")
    if raw == "about:blank":
        return raw
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    scheme = parsed.scheme.lower()
    if scheme in BLOCKED_SCHEMES or scheme not in {"http", "https"}:
        raise ValueError(f"Blocked URL scheme: {scheme or '<none>'}")
    if not parsed.netloc:
        raise ValueError("URL must include a host")
    if block_private and _hostname_is_obviously_private(parsed.hostname):
        raise ValueError("Private/local navigation is blocked by policy")
    return urlunparse((scheme, parsed.netloc, parsed.path or "/", parsed.params, parsed.query, parsed.fragment))


@dataclass
class LabState:
    url: str = "about:blank"
    title: str = ""
    loading: bool = False
    nav_state: str = "idle"
    http_status: Optional[int] = None
    last_error: str = ""
    profile_dir: str = ""
    runtime_dir: str = ""
    downloads_dir: str = ""
    viewport_width: int = 1280
    viewport_height: int = 720
    device_scale_factor: float = 1.0
    browser_started: bool = False
    headless: bool = True
    channel: str = ""
    cdp_url: str = ""
    executable_path: str = ""
    started_at: float = field(default_factory=time.time)

    def payload(self) -> Dict[str, Any]:
        return {
            "type": "status",
            "url": self.url,
            "title": self.title,
            "loading": self.loading,
            "nav_state": self.nav_state,
            "http_status": self.http_status,
            "last_error": self.last_error,
            "profile_dir": self.profile_dir,
            "runtime_dir": self.runtime_dir,
            "downloads_dir": self.downloads_dir,
            "viewport": {
                "width": self.viewport_width,
                "height": self.viewport_height,
                "deviceScaleFactor": self.device_scale_factor,
            },
            "browser_started": self.browser_started,
            "headless": self.headless,
            "channel": self.channel,
            "cdp_url": self.cdp_url,
            "executable_path": self.executable_path,
            "uptime_sec": round(time.time() - self.started_at, 1),
        }


class BrowserLab:
    def __init__(self) -> None:
        self.profile_dir = _resolve_runtime_path("TG_BROWSER_LAB_PROFILE_DIR", DEFAULT_PROFILE_DIR)
        self.runtime_dir = _resolve_runtime_path("TG_BROWSER_LAB_RUNTIME_DIR", DEFAULT_RUNTIME_DIR)
        self.downloads_dir = self.runtime_dir / "downloads"
        self.block_private_nav = _parse_bool(os.environ.get("TG_BROWSER_LAB_BLOCK_PRIVATE_NAV"), False)

        display_available = bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
        self.headless = _parse_bool(os.environ.get("TG_BROWSER_LAB_HEADLESS"), not display_available)
        self.channel = os.environ.get("TG_BROWSER_LAB_CHANNEL", "").strip()
        self.cdp_url = os.environ.get("TG_BROWSER_LAB_CDP_URL", "").strip()
        self.executable_path = os.environ.get("TG_BROWSER_LAB_EXECUTABLE_PATH", "").strip()

        self.playwright: Any = None
        self.browser: Any = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.start_lock = asyncio.Lock()
        self.page_lock = asyncio.Lock()
        self.log_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=200)
        self.attached_pages: set[int] = set()
        self.status_bridge_installed = False
        self.mouse_buttons = 0
        self.last_mouse_x = 0.0
        self.last_mouse_y = 0.0
        self.last_touch_points: list[Dict[str, Any]] = []
        self.dom_drag_candidate: Optional[Dict[str, float]] = None
        self.range_drag_candidate = False
        self.text_selection_drag_candidate: Optional[Dict[str, float]] = None
        self.frame_seq = 0
        self.state = LabState(
            profile_dir=str(self.profile_dir),
            runtime_dir=str(self.runtime_dir),
            downloads_dir=str(self.downloads_dir),
            headless=self.headless,
            channel=self.channel,
            cdp_url=self.cdp_url,
            executable_path=self.executable_path,
        )

    async def ensure_started(self) -> None:
        async with self.start_lock:
            if self.context and self.page and not self.page.is_closed():
                return

            _assert_outside_repo(self.profile_dir)
            _assert_outside_repo(self.runtime_dir)
            self.profile_dir.mkdir(parents=True, exist_ok=True)
            self.downloads_dir.mkdir(parents=True, exist_ok=True)

            self.playwright = await async_playwright().start()
            if self.cdp_url:
                self.browser = await self.playwright.chromium.connect_over_cdp(self.cdp_url)
                self.context = self.browser.contexts[0] if self.browser.contexts else await self.browser.new_context()
                await self._install_status_bridge()
                self.context.on("page", lambda page: asyncio.create_task(self._adopt_page(page, "new-page")))
                pages = [page for page in self.context.pages if not page.is_closed()]
                self.page = pages[-1] if pages else await self.context.new_page()
                await self._attach_page_handlers(self.page)
                await self._set_viewport(
                    self.state.viewport_width,
                    self.state.viewport_height,
                    self.state.device_scale_factor,
                )
                self.state.browser_started = True
                self.state.nav_state = "connected over CDP"
                await self.refresh_status()
                return

            launch_args = [
                "--disable-dev-shm-usage",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
            ]
            launch_kwargs: Dict[str, Any] = {
                "headless": self.headless,
                "viewport": {
                    "width": self.state.viewport_width,
                    "height": self.state.viewport_height,
                },
                "device_scale_factor": self.state.device_scale_factor,
                "accept_downloads": True,
                "downloads_path": str(self.downloads_dir),
                "args": launch_args,
            }
            if self.channel:
                launch_kwargs["channel"] = self.channel
            if self.executable_path:
                launch_kwargs.pop("channel", None)
                launch_kwargs["executable_path"] = self.executable_path

            self.context = await self.playwright.chromium.launch_persistent_context(
                str(self.profile_dir),
                **launch_kwargs,
            )
            self.context.set_default_timeout(15_000)
            self.context.set_default_navigation_timeout(45_000)
            await self._install_status_bridge()
            self.context.on("page", lambda page: asyncio.create_task(self._adopt_page(page, "new-page")))

            pages = [page for page in self.context.pages if not page.is_closed()]
            self.page = pages[-1] if pages else await self.context.new_page()
            await self._attach_page_handlers(self.page)
            await self._set_viewport(
                self.state.viewport_width,
                self.state.viewport_height,
                self.state.device_scale_factor,
            )
            self.state.browser_started = True
            self.state.nav_state = "ready"
            await self.refresh_status()

    async def shutdown(self) -> None:
        async with self.start_lock:
            if self.context and not self.cdp_url:
                await self.context.close()
            if self.browser and not self.cdp_url:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            self.context = None
            self.page = None
            self.browser = None
            self.playwright = None
            self.attached_pages.clear()
            self.status_bridge_installed = False
            self.state.browser_started = False
            self.state.loading = False
            self.state.nav_state = "stopped"

    async def reset_profile(self) -> Dict[str, Any]:
        await self.shutdown()
        for path in (self.profile_dir, self.runtime_dir):
            _assert_safe_delete_path(path)
            if path.exists():
                shutil.rmtree(path)
        return {
            "ok": True,
            "profile_dir": str(self.profile_dir),
            "runtime_dir": str(self.runtime_dir),
            "message": "Profile and runtime directories removed. Reconnect to start a fresh browser.",
        }

    async def _attach_page_handlers(self, page: Page) -> None:
        page_id = id(page)
        if page_id in self.attached_pages:
            return
        self.attached_pages.add(page_id)
        page.on("console", lambda msg: self._on_console(page, msg))
        page.on("pageerror", lambda exc: self._queue_log("error", f"page error: {_sanitize_debug_message(exc)}"))
        page.on("popup", lambda popup: asyncio.create_task(self._adopt_page(popup, "popup")))
        page.on("download", lambda download: asyncio.create_task(self._handle_download(download)))
        page.on("request", lambda request: self._on_request(page, request))
        page.on("response", lambda response: self._on_response(page, response))
        page.on("framenavigated", lambda frame: self._on_frame_navigated(page, frame))
        page.on("load", lambda: self._on_load(page))
        page.on("close", lambda: self._on_page_close(page))
        asyncio.create_task(self._inject_status_bridge(page))

    async def _install_status_bridge(self) -> None:
        if not self.context or self.status_bridge_installed:
            return
        try:
            await self.context.expose_function("__browserLabStatusChanged", self._handle_status_bridge_payload)
        except PlaywrightError as exc:
            if "already registered" not in str(exc):
                raise
        await self.context.add_init_script(HISTORY_STATUS_BRIDGE_SCRIPT)
        self.status_bridge_installed = True

    async def _inject_status_bridge(self, page: Page) -> None:
        if page.is_closed():
            return
        try:
            await page.evaluate(HISTORY_STATUS_BRIDGE_SCRIPT)
        except PlaywrightError:
            pass

    async def _handle_status_bridge_payload(self, payload: Any) -> None:
        if not self.page or self.page.is_closed() or not isinstance(payload, dict):
            return
        url = str(payload.get("url") or "")
        if url:
            self.state.url = url
        self.state.title = str(payload.get("title") or self.state.title)
        nav_state = str(payload.get("nav_state") or "spa")
        if nav_state == "title":
            return
        self.state.nav_state = f"spa {nav_state}"
        self.state.loading = False

    def _queue_log(self, level: str, message: str) -> None:
        payload = {
            "type": "log",
            "level": level if level in {"info", "warn", "error"} else "info",
            "message": _sanitize_debug_message(message),
            "ts": int(time.time() * 1000),
        }
        if not payload["message"]:
            return
        try:
            self.log_queue.put_nowait(payload)
        except asyncio.QueueFull:
            try:
                self.log_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                self.log_queue.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    def _on_console(self, page: Page, message: Any) -> None:
        if page is not self.page:
            return
        msg_type = getattr(message, "type", "")
        if msg_type not in {"error", "warning", "warn"}:
            return
        text = getattr(message, "text", "")
        if "was preloaded using link preload but not used" in text:
            return
        level = "error" if msg_type == "error" else "warn"
        self._queue_log(level, f"browser console {msg_type}: {text}")

    async def _adopt_page(self, page: Page, reason: str) -> None:
        if page.is_closed():
            return
        await self._attach_page_handlers(page)
        self.page = page
        await self._set_viewport(
            self.state.viewport_width,
            self.state.viewport_height,
            self.state.device_scale_factor,
        )
        try:
            await page.bring_to_front()
        except PlaywrightError:
            pass
        self.state.nav_state = reason
        await self.refresh_status()

    def _on_request(self, page: Page, request: Any) -> None:
        if page is not self.page:
            return
        try:
            is_nav = request.is_navigation_request()
            is_main = request.frame == page.main_frame
        except PlaywrightError:
            return
        if is_nav and is_main:
            self.state.loading = True
            self.state.nav_state = "request"
            self.state.url = request.url
            self.state.http_status = None

    def _on_response(self, page: Page, response: Any) -> None:
        if page is not self.page:
            return
        status = response.status
        if status >= 400:
            self.state.last_error = f"HTTP {status} {_safe_url_for_log(response.url)}"
            if "onboarding/task.json" in response.url:
                self.state.nav_state = f"login API rejected HTTP {status}"
            try:
                resource_type = response.request.resource_type
            except PlaywrightError:
                resource_type = ""
            should_log = (
                status >= 500
                or resource_type == "document"
                or "/api/" in response.url
                or "graphql" in response.url
                or "onboarding" in response.url
            )
            if should_log:
                self._queue_log("warn", f"HTTP {status} {_safe_url_for_log(response.url)}")
        if "api.x.com/1.1/onboarding/task.json" in response.url:
            asyncio.create_task(self._inspect_x_onboarding_response(response))
        try:
            is_main = response.request.frame == page.main_frame
            is_document = response.request.resource_type == "document"
        except PlaywrightError:
            return
        if is_main and is_document:
            self.state.http_status = status
            self.state.nav_state = f"response {status}"
            self.state.url = response.url

    async def _inspect_x_onboarding_response(self, response: Any) -> None:
        try:
            payload = await response.json()
        except Exception as exc:  # noqa: BLE001
            if response.status >= 400:
                self._queue_log("warn", f"X login API HTTP {response.status}; body unavailable: {exc}")
            return

        errors = payload.get("errors") if isinstance(payload, dict) else None
        if errors:
            parts = []
            saw_x_code_399 = False
            for error in errors[:3]:
                if not isinstance(error, dict):
                    continue
                code = error.get("code", "unknown")
                saw_x_code_399 = saw_x_code_399 or str(code) == "399"
                message = _sanitize_debug_message(error.get("message", ""))
                parts.append(f"code {code}: {message}")
            detail = "; ".join(parts) or "unknown X login error"
            self.state.last_error = f"X login API HTTP {response.status}: {detail}"
            self.state.nav_state = f"X login rejected HTTP {response.status}"
            self._queue_log("error", self.state.last_error)
            if saw_x_code_399:
                self._queue_log(
                    "warn",
                    "X login reached the onboarding API, but X rejected the flow before the password step. "
                    "This is usually a site-side login risk decision for the current browser/profile/IP; "
                    "try real Chrome CDP mode with a user-launched Chrome profile.",
                )
            return

        subtasks = []
        for subtask in payload.get("subtasks", []) if isinstance(payload, dict) else []:
            if isinstance(subtask, dict) and subtask.get("subtask_id"):
                subtasks.append(str(subtask["subtask_id"]))
        if subtasks:
            self._queue_log("info", f"X login API HTTP {response.status}; subtasks: {', '.join(subtasks[:4])}")

    def _on_frame_navigated(self, page: Page, frame: Any) -> None:
        if page is self.page and frame == page.main_frame:
            if frame.url == self.state.url and self.state.nav_state.startswith("spa "):
                return
            self.state.url = frame.url
            self.state.nav_state = "navigated"

    def _on_load(self, page: Page) -> None:
        if page is self.page:
            self.state.loading = False
            self.state.nav_state = "load"

    def _on_page_close(self, page: Page) -> None:
        if page is self.page:
            self.state.loading = False
            self.state.nav_state = "page-closed"

    async def _handle_download(self, download: Download) -> None:
        self.downloads_dir.mkdir(parents=True, exist_ok=True)
        base = _sanitize_filename(download.suggested_filename)
        target = self.downloads_dir / base
        stem = target.stem
        suffix = target.suffix
        index = 1
        while target.exists():
            target = self.downloads_dir / f"{stem}-{index}{suffix}"
            index += 1
        try:
            await download.save_as(str(target))
            self.state.nav_state = f"download saved: {target.name}"
        except PlaywrightError as exc:
            self.state.last_error = f"download failed: {exc}"

    async def refresh_status(self) -> Dict[str, Any]:
        page = self.page
        if page and not page.is_closed():
            self.state.url = page.url
            try:
                self.state.title = await page.title()
            except PlaywrightError:
                self.state.title = ""
        return self.state.payload()

    async def status_payload(self) -> Dict[str, Any]:
        return await self.refresh_status()

    async def navigate(self, raw_url: str) -> Dict[str, Any]:
        await self.ensure_started()
        url = normalize_navigation_url(raw_url, self.block_private_nav)
        page = self._active_page()
        self.state.loading = True
        self.state.nav_state = f"goto {_safe_url_for_log(url)}"
        self.state.last_error = ""
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
        except PlaywrightTimeoutError:
            self.state.nav_state = "navigation timeout; page may still be loading"
        except PlaywrightError as exc:
            self.state.loading = False
            self.state.last_error = str(exc)
            raise
        return await self.refresh_status()

    async def back(self) -> Dict[str, Any]:
        page = self._active_page()
        self.state.loading = True
        self.state.nav_state = "back"
        await page.go_back(wait_until="domcontentloaded", timeout=30_000)
        return await self.refresh_status()

    async def forward(self) -> Dict[str, Any]:
        page = self._active_page()
        self.state.loading = True
        self.state.nav_state = "forward"
        await page.go_forward(wait_until="domcontentloaded", timeout=30_000)
        return await self.refresh_status()

    async def reload(self) -> Dict[str, Any]:
        page = self._active_page()
        self.state.loading = True
        self.state.nav_state = "reload"
        await page.reload(wait_until="domcontentloaded", timeout=30_000)
        return await self.refresh_status()

    async def stop(self) -> Dict[str, Any]:
        page = self._active_page()
        try:
            await page.evaluate("window.stop()")
        finally:
            self.state.loading = False
            self.state.nav_state = "stopped"
        return await self.refresh_status()

    async def resize(self, width: Any, height: Any, device_scale_factor: Any) -> Dict[str, Any]:
        await self.ensure_started()
        width_int = _clamp_int(width, MIN_VIEWPORT_WIDTH, MAX_VIEWPORT_WIDTH, self.state.viewport_width)
        height_int = _clamp_int(height, MIN_VIEWPORT_HEIGHT, MAX_VIEWPORT_HEIGHT, self.state.viewport_height)
        dsf = _clamp_float(device_scale_factor, 0.5, 3.0, self.state.device_scale_factor)
        await self._set_viewport(width_int, height_int, dsf)
        self.state.nav_state = "viewport resized"
        return await self.refresh_status()

    async def _set_viewport(self, width: int, height: int, device_scale_factor: float) -> None:
        page = self._active_page(required=False)
        self.state.viewport_width = width
        self.state.viewport_height = height
        self.state.device_scale_factor = device_scale_factor
        if not page or page.is_closed():
            return
        await page.set_viewport_size({"width": width, "height": height})
        try:
            cdp = await self.context.new_cdp_session(page) if self.context else None
            if cdp:
                await cdp.send(
                    "Emulation.setDeviceMetricsOverride",
                    {
                        "width": width,
                        "height": height,
                        "deviceScaleFactor": device_scale_factor,
                        "mobile": False,
                    },
                )
                await cdp.detach()
        except PlaywrightError:
            pass

    async def screenshot(self, quality: int) -> Dict[str, Any]:
        page = self._active_page()
        start = time.perf_counter()
        data = await page.screenshot(
            type="jpeg",
            quality=quality,
            full_page=False,
            scale="css",
            animations="allow",
            timeout=8_000,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        self.frame_seq += 1
        return {
            "type": "frame",
            "mime": "image/jpeg",
            "data": base64.b64encode(data).decode("ascii"),
            "width": self.state.viewport_width,
            "height": self.state.viewport_height,
            "seq": self.frame_seq,
            "screenshot_ms": round(elapsed_ms, 1),
            "sent_at": int(time.time() * 1000),
        }

    async def mouse(self, message: Dict[str, Any]) -> None:
        page = self._active_page()
        event = message.get("event")
        max_x = max(0, self.state.viewport_width - 1)
        max_y = max(0, self.state.viewport_height - 1)
        x = _clamp_float(message.get("x"), 0, max_x, 0)
        y = _clamp_float(message.get("y"), 0, max_y, 0)
        self.last_mouse_x = x
        self.last_mouse_y = y
        button = message.get("button") if message.get("button") in {"left", "right", "middle"} else "left"
        click_count = _clamp_int(message.get("clickCount"), 1, 3, 1)
        modifiers = _mouse_modifier_bitmask(message.get("modifiers"))
        if event == "move":
            await self._dispatch_mouse_event(page, "mouseMoved", x, y, "none", self.mouse_buttons, 0, modifiers)
            if self.range_drag_candidate and self.mouse_buttons & _mouse_button_bit("left"):
                await self._dom_range_drag_update(page, x, y)
            if self.text_selection_drag_candidate and self.mouse_buttons & _mouse_button_bit("left"):
                await self._dom_text_selection_drag_update(page, x, y, finish=False)
            if self.dom_drag_candidate and self.mouse_buttons & _mouse_button_bit("left"):
                await self._dom_drag_move(page, x, y)
        elif event == "down":
            self.mouse_buttons |= _mouse_button_bit(button)
            await self._dispatch_mouse_event(page, "mousePressed", x, y, button, self.mouse_buttons, click_count, modifiers)
            if button == "left":
                self.range_drag_candidate = await self._prepare_dom_range_drag_candidate(page, x, y)
                self.text_selection_drag_candidate = await self._prepare_dom_text_selection_drag_candidate(page, x, y)
                await self._prepare_dom_drag_candidate(page, x, y)
        elif event == "up":
            dom_drag_candidate = self.dom_drag_candidate
            range_drag_candidate = self.range_drag_candidate
            text_selection_drag_candidate = self.text_selection_drag_candidate
            self.mouse_buttons &= ~_mouse_button_bit(button)
            await self._dispatch_mouse_event(page, "mouseReleased", x, y, button, self.mouse_buttons, click_count, modifiers)
            if button == "left" and range_drag_candidate:
                await self._dom_range_drag_update(page, x, y)
                self.range_drag_candidate = False
            if button == "left" and text_selection_drag_candidate:
                await self._dom_text_selection_drag_update(page, x, y, finish=True)
                self.text_selection_drag_candidate = None
            if button == "left" and dom_drag_candidate:
                await self._dom_drag_drop(page, x, y)
                self.dom_drag_candidate = None
        elif event == "wheel":
            delta_x = _clamp_float(message.get("deltaX"), -3000, 3000, 0)
            delta_y = _clamp_float(message.get("deltaY"), -3000, 3000, 0)
            await self._dispatch_mouse_event(
                page,
                "mouseWheel",
                x,
                y,
                "none",
                self.mouse_buttons,
                0,
                modifiers,
                delta_x=delta_x,
                delta_y=delta_y,
            )
            await self._dispatch_dom_wheel_if_non_scrollable(page, x, y, delta_x, delta_y, message.get("modifiers"))
        else:
            raise ValueError(f"Unsupported mouse event: {event}")

    async def _dispatch_mouse_event(
        self,
        page: Page,
        event_type: str,
        x: float,
        y: float,
        button: str,
        buttons: int,
        click_count: int,
        modifiers: int,
        delta_x: float = 0,
        delta_y: float = 0,
    ) -> None:
        try:
            cdp = await self.context.new_cdp_session(page) if self.context else None
            if not cdp:
                raise RuntimeError("CDP session is not available")
            payload: Dict[str, Any] = {
                "type": event_type,
                "x": x,
                "y": y,
                "modifiers": modifiers,
                "button": _cdp_mouse_button(button),
                "buttons": buttons,
            }
            if click_count:
                payload["clickCount"] = click_count
            if event_type == "mouseWheel":
                payload["deltaX"] = delta_x
                payload["deltaY"] = delta_y
            await cdp.send("Input.dispatchMouseEvent", payload)
            await cdp.detach()
        except Exception:
            if event_type == "mouseMoved":
                await page.mouse.move(x, y)
            elif event_type == "mousePressed":
                await page.mouse.move(x, y)
                await page.mouse.down(button=button, click_count=click_count)
            elif event_type == "mouseReleased":
                await page.mouse.move(x, y)
                await page.mouse.up(button=button, click_count=click_count)
            elif event_type == "mouseWheel":
                await page.mouse.move(x, y)
                await page.mouse.wheel(delta_x, delta_y)

    async def touch(self, message: Dict[str, Any]) -> None:
        page = self._active_page()
        event = str(message.get("event") or "")
        event_type = {
            "start": "touchStart",
            "move": "touchMove",
            "end": "touchEnd",
            "cancel": "touchCancel",
        }.get(event)
        if not event_type:
            raise ValueError(f"Unsupported touch event: {event}")
        incoming_points = []
        raw_points = message.get("points") if isinstance(message.get("points"), list) else []
        max_x = max(0, self.state.viewport_width - 1)
        max_y = max(0, self.state.viewport_height - 1)
        for raw_point in raw_points[:10]:
            if not isinstance(raw_point, dict):
                continue
            x = _clamp_float(raw_point.get("x"), 0, max_x, self.last_mouse_x)
            y = _clamp_float(raw_point.get("y"), 0, max_y, self.last_mouse_y)
            incoming_points.append(
                {
                    "x": x,
                    "y": y,
                    "id": _clamp_int(raw_point.get("id"), 1, 2_147_483_647, 1),
                    "radiusX": _clamp_float(raw_point.get("radiusX"), 1, 200, 1),
                    "radiusY": _clamp_float(raw_point.get("radiusY"), 1, 200, 1),
                    "force": _clamp_float(raw_point.get("force"), 0, 1, 1),
                }
            )
        points = [] if event_type in {"touchEnd", "touchCancel"} else incoming_points
        if points:
            self.last_touch_points = points
        dom_points = incoming_points if incoming_points else self.last_touch_points
        cdp_error: Optional[Exception] = None
        try:
            cdp = await self.context.new_cdp_session(page) if self.context else None
            if not cdp:
                raise RuntimeError("CDP session is not available")
            await cdp.send("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 10})
            await cdp.send("Input.dispatchTouchEvent", {"type": event_type, "touchPoints": points})
            await cdp.detach()
        except Exception as exc:  # noqa: BLE001 - DOM fallback is more important than CDP diagnostics here.
            cdp_error = exc
        await self._dispatch_dom_touch_event(page, event, dom_points)
        if event_type in {"touchEnd", "touchCancel"}:
            self.last_touch_points = []
        if cdp_error and not dom_points:
            raise cdp_error

    async def _dispatch_dom_touch_event(self, page: Page, event: str, raw_points: Any) -> None:
        await page.evaluate(
            """
            ({ event, points }) => {
              const first = points && points[0] || { x: 0, y: 0, id: 1 };
              const target = document.elementFromPoint(first.x || 0, first.y || 0);
              if (!target) return false;
              const type = event === 'start'
                ? 'touchstart'
                : event === 'move'
                  ? 'touchmove'
                  : event === 'cancel'
                    ? 'touchcancel'
                    : 'touchend';
              const makeTouch = (point) => ({
                identifier: point.id || 1,
                target,
                clientX: point.x || 0,
                clientY: point.y || 0,
                pageX: point.x || 0,
                pageY: point.y || 0,
                screenX: point.x || 0,
                screenY: point.y || 0,
                radiusX: point.radiusX || 1,
                radiusY: point.radiusY || 1,
                force: point.force == null ? 1 : point.force,
              });
              const active = Array.isArray(points) ? points.map(makeTouch) : [];
              const init = {
                bubbles: true,
                cancelable: true,
                composed: true,
                touches: type === 'touchend' || type === 'touchcancel' ? [] : active,
                targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : active,
                changedTouches: active.length ? active : [makeTouch(first)],
              };
              try {
                target.dispatchEvent(new TouchEvent(type, init));
              } catch (_err) {
                const ev = new Event(type, { bubbles: true, cancelable: true, composed: true });
                Object.defineProperty(ev, 'touches', { value: init.touches });
                Object.defineProperty(ev, 'targetTouches', { value: init.targetTouches });
                Object.defineProperty(ev, 'changedTouches', { value: init.changedTouches });
                target.dispatchEvent(ev);
              }
              return true;
            }
            """,
            {"event": event, "points": raw_points if isinstance(raw_points, list) else []},
        )

    async def _dispatch_dom_wheel_if_non_scrollable(
        self,
        page: Page,
        x: float,
        y: float,
        delta_x: float,
        delta_y: float,
        modifiers: Any,
    ) -> None:
        modifier_map = modifiers if isinstance(modifiers, dict) else {}
        try:
            await page.evaluate(
                """
                ({ x, y, deltaX, deltaY, modifiers }) => {
                  const target = document.elementFromPoint(x, y);
                  if (!target) return false;

                  const canScroll = (el) => {
                    if (!el) return false;
                    const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
                    const maxX = Math.max(0, el.scrollWidth - el.clientWidth);
                    const yScroll = maxY > 1 && (
                      (deltaY > 0 && el.scrollTop < maxY - 1) ||
                      (deltaY < 0 && el.scrollTop > 1)
                    );
                    const xScroll = maxX > 1 && (
                      (deltaX > 0 && el.scrollLeft < maxX - 1) ||
                      (deltaX < 0 && el.scrollLeft > 1)
                    );
                    return yScroll || xScroll;
                  };

                  let el = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
                  while (el && el !== document.documentElement) {
                    if (canScroll(el)) return false;
                    el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
                  }

                  const event = new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: x,
                    clientY: y,
                    deltaX,
                    deltaY,
                    deltaMode: 0,
                    altKey: Boolean(modifiers && modifiers.alt),
                    ctrlKey: Boolean(modifiers && modifiers.ctrl),
                    metaKey: Boolean(modifiers && modifiers.meta),
                    shiftKey: Boolean(modifiers && modifiers.shift),
                  });
                  target.dispatchEvent(event);
                  return true;
                }
                """,
                {
                    "x": x,
                    "y": y,
                    "deltaX": delta_x,
                    "deltaY": delta_y,
                    "modifiers": modifier_map,
                },
            )
        except PlaywrightError:
            pass

    async def _prepare_dom_range_drag_candidate(self, page: Page, x: float, y: float) -> bool:
        try:
            return bool(
                await page.evaluate(
                    """
                    ({ x, y }) => {
                      const node = document.elementFromPoint(x, y);
                      const el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
                      if (!el || el.tagName !== 'INPUT' || String(el.type || '').toLowerCase() !== 'range') {
                        window.__browserLabRangeDrag = null;
                        return false;
                      }
                      window.__browserLabRangeDrag = { el };
                      return true;
                    }
                    """,
                    {"x": x, "y": y},
                )
            )
        except PlaywrightError:
            return False

    async def _dom_range_drag_update(self, page: Page, x: float, y: float) -> None:
        try:
            await page.evaluate(
                """
                ({ x }) => {
                  const session = window.__browserLabRangeDrag;
                  const el = session && session.el;
                  if (!el || el.tagName !== 'INPUT' || String(el.type || '').toLowerCase() !== 'range') return false;
                  const rect = el.getBoundingClientRect();
                  if (!rect.width) return false;
                  const min = Number.isFinite(Number(el.min)) ? Number(el.min) : 0;
                  const max = Number.isFinite(Number(el.max)) ? Number(el.max) : 100;
                  const stepAttr = String(el.step || '');
                  const step = stepAttr && stepAttr !== 'any' && Number.isFinite(Number(stepAttr)) ? Number(stepAttr) : 1;
                  const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
                  let value = min + ratio * (max - min);
                  if (step > 0) value = min + Math.round((value - min) / step) * step;
                  value = Math.max(min, Math.min(max, value));
                  const before = String(el.value);
                  const proto = HTMLInputElement.prototype;
                  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                  descriptor.set.call(el, String(value));
                  if (String(el.value) === before) return true;
                  try {
                    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertReplacementText', data: null }));
                  } catch (_err) {
                    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                  }
                  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                  return true;
                }
                """,
                {"x": x, "y": y},
            )
        except PlaywrightError:
            self.range_drag_candidate = False

    async def _prepare_dom_text_selection_drag_candidate(
        self,
        page: Page,
        x: float,
        y: float,
    ) -> Optional[Dict[str, float]]:
        try:
            found = await page.evaluate(
                """
                ({ x, y }) => {
                  const textInputTypes = new Set([
                    '', 'text', 'search', 'url', 'tel', 'email', 'password', 'number'
                  ]);
                  const node = document.elementFromPoint(x, y);
                  const el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
                  const contentEditableAncestor = (candidate) => {
                    let current = candidate;
                    while (current && current !== document.documentElement) {
                      if (current.isContentEditable) return current;
                      current = current.parentElement || (current.getRootNode && current.getRootNode().host) || null;
                    }
                    return null;
                  };
                  const isTextControl = (candidate) => {
                    if (!candidate) return false;
                    if (candidate.tagName === 'TEXTAREA') return true;
                    if (candidate.tagName !== 'INPUT') return false;
                    return textInputTypes.has(String(candidate.type || '').toLowerCase());
                  };
                  if (isTextControl(el)) {
                    window.__browserLabTextSelectDrag = { el, startX: x, startY: y, mode: 'control' };
                    return true;
                  }
                  const rich = contentEditableAncestor(el);
                  if (rich) {
                    const doc = rich.ownerDocument || document;
                    const pointRange = (clientX, clientY) => {
                      if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(clientX, clientY);
                      if (doc.caretPositionFromPoint) {
                        const pos = doc.caretPositionFromPoint(clientX, clientY);
                        if (!pos) return null;
                        const range = doc.createRange();
                        range.setStart(pos.offsetNode, pos.offset);
                        range.collapse(true);
                        return range;
                      }
                      return null;
                    };
                    const range = pointRange(x, y);
                    window.__browserLabTextSelectDrag = {
                      el: rich,
                      startX: x,
                      startY: y,
                      mode: 'contenteditable',
                      startNode: range ? range.startContainer : null,
                      startOffset: range ? range.startOffset : 0
                    };
                    return true;
                  }
                  if (!isTextControl(el)) {
                    window.__browserLabTextSelectDrag = null;
                    return false;
                  }
                }
                """,
                {"x": x, "y": y},
            )
            return {"start_x": x, "start_y": y, "active": 0.0} if found else None
        except PlaywrightError:
            return None

    async def _dom_text_selection_drag_update(self, page: Page, x: float, y: float, finish: bool) -> None:
        if not self.text_selection_drag_candidate:
            return
        distance = abs(x - self.text_selection_drag_candidate["start_x"]) + abs(
            y - self.text_selection_drag_candidate["start_y"]
        )
        if not self.text_selection_drag_candidate["active"] and distance < 6:
            return
        self.text_selection_drag_candidate["active"] = 1.0
        try:
            await page.evaluate(
                """
                ({ x, y, finish }) => {
                  const session = window.__browserLabTextSelectDrag;
                  const el = session && session.el;
                  if (!el) return false;
                  if (document.activeElement !== el) {
                    try { el.focus({ preventScroll: true }); } catch (_err) { el.focus(); }
                  }
                  if (el.isContentEditable || session.mode === 'contenteditable') {
                    const doc = el.ownerDocument || document;
                    const selection = doc.getSelection && doc.getSelection();
                    if (!selection || !session.startNode) return false;
                    const pointRange = (clientX, clientY) => {
                      if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(clientX, clientY);
                      if (doc.caretPositionFromPoint) {
                        const pos = doc.caretPositionFromPoint(clientX, clientY);
                        if (!pos) return null;
                        const range = doc.createRange();
                        range.setStart(pos.offsetNode, pos.offset);
                        range.collapse(true);
                        return range;
                      }
                      return null;
                    };
                    const endRange = pointRange(x, y);
                    if (!endRange) return false;
                    const range = doc.createRange();
                    try {
                      range.setStart(session.startNode, session.startOffset);
                      range.setEnd(endRange.startContainer, endRange.startOffset);
                    } catch (_err) {
                      return false;
                    }
                    if (range.collapsed && !finish) return true;
                    const forward = range.startContainer === session.startNode && range.startOffset === session.startOffset;
                    if (!forward) {
                      try {
                        range.setStart(endRange.startContainer, endRange.startOffset);
                        range.setEnd(session.startNode, session.startOffset);
                      } catch (_err) {
                        return false;
                      }
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return true;
                  }
                  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
                  const value = String(el.value || '');
                  const rect = el.getBoundingClientRect();
                  if (!rect.width || value.length === 0) return false;
                  const style = window.getComputedStyle(el);
                  const borderLeft = parseFloat(style.borderLeftWidth || '0') || 0;
                  const borderRight = parseFloat(style.borderRightWidth || '0') || 0;
                  const paddingLeft = parseFloat(style.paddingLeft || '0') || 0;
                  const paddingRight = parseFloat(style.paddingRight || '0') || 0;
                  const innerLeft = rect.left + borderLeft + paddingLeft;
                  const innerWidth = Math.max(1, rect.width - borderLeft - borderRight - paddingLeft - paddingRight);
                  const indexAt = (clientX) => {
                    const ratio = Math.max(0, Math.min(1, (clientX - innerLeft) / innerWidth));
                    return Math.max(0, Math.min(value.length, Math.round(ratio * value.length)));
                  };
                  const start = indexAt(session.startX);
                  const end = indexAt(x);
                  if (start === end && !finish) return true;
                  try {
                    el.setSelectionRange(Math.min(start, end), Math.max(start, end), start <= end ? 'forward' : 'backward');
                  } catch (_err) {
                    return false;
                  }
                  return true;
                }
                """,
                {"x": x, "y": y, "finish": finish},
            )
        except PlaywrightError:
            self.text_selection_drag_candidate = None

    async def _prepare_dom_drag_candidate(self, page: Page, x: float, y: float) -> None:
        try:
            found = await page.evaluate(
                """
                ({ x, y }) => {
                  const draggableAncestor = (node) => {
                    let el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
                    while (el && el !== document.documentElement) {
                      if (el.draggable || el.getAttribute('draggable') === 'true') return el;
                      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
                    }
                    return null;
                  };
                  const source = draggableAncestor(document.elementFromPoint(x, y));
                  if (!source) {
                    window.__browserLabDomDrag = null;
                    return false;
                  }
                  let dataTransfer = null;
                  try {
                    dataTransfer = new DataTransfer();
                  } catch (_err) {}
                  window.__browserLabDomDrag = {
                    source,
                    dataTransfer,
                    started: false,
                    lastTarget: null,
                  };
                  return true;
                }
                """,
                {"x": x, "y": y},
            )
            self.dom_drag_candidate = {"start_x": x, "start_y": y, "active": 0.0} if found else None
        except PlaywrightError:
            self.dom_drag_candidate = None

    async def _dom_drag_move(self, page: Page, x: float, y: float) -> None:
        if not self.dom_drag_candidate:
            return
        distance = abs(x - self.dom_drag_candidate["start_x"]) + abs(y - self.dom_drag_candidate["start_y"])
        if not self.dom_drag_candidate["active"] and distance < 8:
            return
        try:
            active = await page.evaluate(
                """
                ({ x, y }) => {
                  const session = window.__browserLabDomDrag;
                  if (!session || !session.source) return false;
                  const makeEvent = (type, target) => {
                    const init = {
                      bubbles: true,
                      cancelable: true,
                      composed: true,
                      clientX: x,
                      clientY: y,
                      dataTransfer: session.dataTransfer,
                    };
                    try {
                      return new DragEvent(type, init);
                    } catch (_err) {
                      const ev = new Event(type, init);
                      for (const [key, value] of Object.entries(init)) {
                        try { Object.defineProperty(ev, key, { value }); } catch (_inner) {}
                      }
                      return ev;
                    }
                  };
                  const dispatch = (target, type) => {
                    if (!target) return true;
                    return target.dispatchEvent(makeEvent(type, target));
                  };
                  if (!session.started) {
                    const allowed = dispatch(session.source, 'dragstart');
                    if (!allowed) {
                      window.__browserLabDomDrag = null;
                      return false;
                    }
                    session.started = true;
                  }
                  const target = document.elementFromPoint(x, y);
                  if (target && target !== session.lastTarget) {
                    if (session.lastTarget) dispatch(session.lastTarget, 'dragleave');
                    dispatch(target, 'dragenter');
                    session.lastTarget = target;
                  }
                  dispatch(target, 'dragover');
                  return true;
                }
                """,
                {"x": x, "y": y},
            )
            self.dom_drag_candidate["active"] = 1.0 if active else 0.0
            if not active:
                self.dom_drag_candidate = None
        except PlaywrightError:
            self.dom_drag_candidate = None

    async def _dom_drag_drop(self, page: Page, x: float, y: float) -> None:
        try:
            await page.evaluate(
                """
                ({ x, y }) => {
                  const session = window.__browserLabDomDrag;
                  if (!session || !session.source) return false;
                  const makeEvent = (type, target) => {
                    const init = {
                      bubbles: true,
                      cancelable: true,
                      composed: true,
                      clientX: x,
                      clientY: y,
                      dataTransfer: session.dataTransfer,
                    };
                    try {
                      return new DragEvent(type, init);
                    } catch (_err) {
                      const ev = new Event(type, init);
                      for (const [key, value] of Object.entries(init)) {
                        try { Object.defineProperty(ev, key, { value }); } catch (_inner) {}
                      }
                      return ev;
                    }
                  };
                  const dispatch = (target, type) => {
                    if (!target) return true;
                    return target.dispatchEvent(makeEvent(type, target));
                  };
                  const target = document.elementFromPoint(x, y);
                  if (session.started) {
                    if (target) dispatch(target, 'drop');
                    dispatch(session.source, 'dragend');
                  }
                  window.__browserLabDomDrag = null;
                  return true;
                }
                """,
                {"x": x, "y": y},
            )
        except PlaywrightError:
            pass

    async def key(self, message: Dict[str, Any]) -> None:
        page = self._active_page()
        event = message.get("event")
        key = _normalize_key_value(message.get("key"))
        if event == "type":
            text = str(message.get("text") or "")
            if text:
                text = text[:20_000]
                await self._release_text_modifiers(page)
                mode = str(message.get("mode") or "hybrid")
                if mode == "dom":
                    await self._dom_insert_text(text)
                elif mode == "hybrid" and await self._active_element_is_inside_shadow_root():
                    await self._dom_insert_text(text)
                elif mode == "hybrid" and await self._active_element_requires_dom_value_set():
                    await self._dom_insert_text(text)
                elif _is_keyboard_typable_text(text):
                    await page.keyboard.type(text, delay=8)
                    if mode == "hybrid":
                        await self._dispatch_active_input_events()
                else:
                    await page.keyboard.insert_text(text)
                    if mode == "hybrid":
                        await self._dispatch_active_input_events()
            return
        if key in IGNORED_KEY_VALUES:
            return
        if not key:
            raise ValueError("Key event missing key")
        try:
            if event == "down":
                await page.keyboard.down(key)
            elif event == "up":
                await page.keyboard.up(key)
            elif event == "press":
                await page.keyboard.press(key)
            else:
                raise ValueError(f"Unsupported key event: {event}")
        except PlaywrightError as exc:
            if "Unknown key" in str(exc):
                return
            raise

    async def _release_text_modifiers(self, page: Page) -> None:
        for modifier in ("Alt", "Control", "Meta", "Shift"):
            try:
                await page.keyboard.up(modifier)
            except PlaywrightError:
                pass

    async def composition(self, message: Dict[str, Any]) -> None:
        frame = await self._active_element_frame()
        event = str(message.get("event") or "")
        if event not in {"start", "update", "end"}:
            raise ValueError(f"Unsupported composition event: {event}")
        data = str(message.get("data") or "")[:10_000]
        await frame.evaluate(
            """
            ({ event, data }) => {
              const deepActiveElement = () => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                  el = el.shadowRoot.activeElement;
                }
                return el;
              };
              const el = deepActiveElement();
              if (!el || el === document.body || el === document.documentElement) return false;
              const type = event === 'start'
                ? 'compositionstart'
                : event === 'update'
                  ? 'compositionupdate'
                  : 'compositionend';
              const init = { bubbles: true, cancelable: true, composed: true, data };
              try {
                el.dispatchEvent(new CompositionEvent(type, init));
              } catch (_err) {
                el.dispatchEvent(new Event(type, init));
              }
              return true;
            }
            """,
            {"event": event, "data": data},
        )

    async def _dispatch_active_input_events(self) -> None:
        frame = await self._active_element_frame()
        await frame.evaluate(
            """
            () => {
              const deepActiveElement = () => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                  el = el.shadowRoot.activeElement;
                }
                return el;
              };
              const el = deepActiveElement();
              if (!el || el === document.body || el === document.documentElement) return false;
              const opts = { bubbles: true, composed: true };
              try {
                el.dispatchEvent(new InputEvent('input', { ...opts, inputType: 'insertText' }));
              } catch (_err) {
                el.dispatchEvent(new Event('input', opts));
              }
              el.dispatchEvent(new Event('change', opts));
              return true;
            }
            """
        )

    async def _dom_insert_text(self, text: str) -> None:
        await self._insert_text_with_dom_events(text, "insertText", dispatch_beforeinput=True)

    async def _active_element_is_inside_shadow_root(self) -> bool:
        frame = await self._active_element_frame()
        try:
            return bool(
                await frame.evaluate(
                    """
                    () => {
                      const active = document.activeElement;
                      return Boolean(active && active.shadowRoot && active.shadowRoot.activeElement);
                    }
                    """
                )
            )
        except PlaywrightError:
            return False

    async def _active_element_requires_dom_value_set(self) -> bool:
        frame = await self._active_element_frame()
        try:
            return bool(
                await frame.evaluate(
                    """
                    ({ x, y }) => {
                      const deepActiveElement = () => {
                        let el = document.activeElement;
                        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                          el = el.shadowRoot.activeElement;
                        }
                        return el;
                      };
                      const needsDomValueSet = (el) => {
                        if (!el || el.tagName !== 'INPUT') return false;
                        const type = String(el.type || '').toLowerCase();
                        return ['date', 'time', 'datetime-local', 'month', 'week', 'color'].includes(type);
                      };
                      const active = deepActiveElement();
                      if (needsDomValueSet(active)) return true;
                      if (Number.isFinite(x) && Number.isFinite(y)) {
                        return needsDomValueSet(document.elementFromPoint(x, y));
                      }
                      return false;
                    }
                    """,
                    {"x": self.last_mouse_x, "y": self.last_mouse_y},
                )
            )
        except PlaywrightError:
            return False

    async def paste(self, message: Dict[str, Any]) -> None:
        text = str(message.get("text") or "")[:20_000]
        if not text:
            return
        frame = await self._active_element_frame()
        allowed = await frame.evaluate(
            """
            (text) => {
              const deepActiveElement = () => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                  el = el.shadowRoot.activeElement;
                }
                return el;
              };
              const el = deepActiveElement();
              if (!el || el === document.body || el === document.documentElement) return false;
              let clipboardData = null;
              try {
                clipboardData = new DataTransfer();
                clipboardData.setData('text/plain', text);
              } catch (_err) {}
              try {
                const ev = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  clipboardData,
                });
                return el.dispatchEvent(ev);
              } catch (_err) {
                return el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true, composed: true }));
              }
            }
            """,
            text,
        )
        if allowed:
            await self._insert_text_with_dom_events(text, "insertFromPaste", dispatch_beforeinput=True)

    async def upload_files(self, message: Dict[str, Any]) -> int:
        payloads = self._decode_file_payloads(message.get("files"))
        element = await self._file_input_element_for_upload()
        if not element:
            raise ValueError("No focused or recently clicked file input found")
        await element.set_input_files(payloads)
        return len(payloads)

    def _decode_file_payloads(self, raw_files: Any) -> list[Dict[str, Any]]:
        if not isinstance(raw_files, list) or not raw_files:
            raise ValueError("No files provided")
        if len(raw_files) > MAX_UPLOAD_FILES:
            raise ValueError(f"Too many files; max {MAX_UPLOAD_FILES}")

        payloads = []
        total_bytes = 0
        for item in raw_files:
            if not isinstance(item, dict):
                raise ValueError("Invalid file payload")
            raw_name = str(item.get("name") or "upload.bin")
            safe_name = Path(raw_name).name.replace("\x00", "")[:255] or "upload.bin"
            mime = str(item.get("mime") or "application/octet-stream")[:200] or "application/octet-stream"
            data_text = str(item.get("data") or "")
            try:
                data = base64.b64decode(data_text, validate=True)
            except Exception as exc:  # noqa: BLE001
                raise ValueError("Invalid file encoding") from exc
            if len(data) > MAX_UPLOAD_FILE_BYTES:
                raise ValueError(f"File exceeds {MAX_UPLOAD_FILE_BYTES // 1024 // 1024} MB limit")
            total_bytes += len(data)
            if total_bytes > MAX_UPLOAD_TOTAL_BYTES:
                raise ValueError(f"Upload exceeds {MAX_UPLOAD_TOTAL_BYTES // 1024 // 1024} MB total limit")
            payloads.append({"name": safe_name, "mimeType": mime, "buffer": data})
        return payloads

    async def drop_files(self, message: Dict[str, Any]) -> int:
        page = self._active_page()
        payloads = self._decode_file_payloads(message.get("files"))
        max_x = max(0, self.state.viewport_width - 1)
        max_y = max(0, self.state.viewport_height - 1)
        x = _clamp_float(message.get("x"), 0, max_x, self.last_mouse_x)
        y = _clamp_float(message.get("y"), 0, max_y, self.last_mouse_y)
        serializable_files = [
            {
                "name": item["name"],
                "mimeType": item["mimeType"],
                "data": base64.b64encode(item["buffer"]).decode("ascii"),
            }
            for item in payloads
        ]
        dropped = await page.evaluate(
            """
            ({ x, y, files }) => {
              const target = document.elementFromPoint(x, y);
              if (!target) return false;
              let dataTransfer = null;
              try {
                dataTransfer = new DataTransfer();
                for (const file of files) {
                  const binary = atob(file.data);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i += 1) {
                    bytes[i] = binary.charCodeAt(i);
                  }
                  dataTransfer.items.add(new File([bytes], file.name, {
                    type: file.mimeType || 'application/octet-stream',
                    lastModified: Date.now(),
                  }));
                }
              } catch (_err) {
                return false;
              }
              const makeEvent = (type) => {
                const init = {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  clientX: x,
                  clientY: y,
                  dataTransfer,
                };
                try {
                  return new DragEvent(type, init);
                } catch (_err) {
                  const ev = new Event(type, init);
                  for (const [key, value] of Object.entries(init)) {
                    try { Object.defineProperty(ev, key, { value }); } catch (_inner) {}
                  }
                  return ev;
                }
              };
              target.dispatchEvent(makeEvent('dragenter'));
              target.dispatchEvent(makeEvent('dragover'));
              target.dispatchEvent(makeEvent('drop'));
              return true;
            }
            """,
            {"x": x, "y": y, "files": serializable_files},
        )
        if not dropped:
            raise ValueError("No drop target accepted the file payload")
        return len(payloads)

    async def _file_input_element_for_upload(self) -> Any:
        frame = await self._active_element_frame()
        handle = await frame.evaluate_handle(
            """
            ({ x, y }) => {
              const fileInputFrom = (node) => {
                let el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
                if (!el) return null;
                if (el.tagName === 'INPUT' && String(el.type || '').toLowerCase() === 'file') return el;
                if (el.tagName === 'LABEL') {
                  if (el.control && String(el.control.type || '').toLowerCase() === 'file') return el.control;
                  const nested = el.querySelector && el.querySelector('input[type="file"]');
                  if (nested) return nested;
                }
                const label = el.closest && el.closest('label');
                if (label) {
                  if (label.control && String(label.control.type || '').toLowerCase() === 'file') return label.control;
                  const nested = label.querySelector && label.querySelector('input[type="file"]');
                  if (nested) return nested;
                }
                return null;
              };
              const deepActiveElement = () => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                  el = el.shadowRoot.activeElement;
                }
                return el;
              };
              const activeInput = fileInputFrom(deepActiveElement());
              if (activeInput) return activeInput;
              if (Number.isFinite(x) && Number.isFinite(y)) {
                const pointedInput = fileInputFrom(document.elementFromPoint(x, y));
                if (pointedInput) return pointedInput;
              }
              const visibleInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((input) => {
                const style = window.getComputedStyle(input);
                return !input.disabled && style.display !== 'none' && style.visibility !== 'hidden';
              });
              return visibleInputs.length === 1 ? visibleInputs[0] : null;
            }
            """,
            {"x": self.last_mouse_x, "y": self.last_mouse_y},
        )
        element = handle.as_element()
        if not element:
            await handle.dispose()
            return None
        return element

    async def _insert_text_with_dom_events(self, text: str, input_type: str, dispatch_beforeinput: bool) -> None:
        frame = await self._active_element_frame()
        await frame.evaluate(
            """
            ({ text, inputType, dispatchBeforeinput, payloadX, payloadY }) => {
              const replaceValueTypes = ['date', 'time', 'datetime-local', 'month', 'week', 'color'];
              const needsDomValueSet = (node) => {
                const el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
                if (!el || el.tagName !== 'INPUT') return false;
                return replaceValueTypes.includes(String(el.type || '').toLowerCase()) ? el : null;
              };
              const deepActiveElement = () => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                  el = el.shadowRoot.activeElement;
                }
                return el;
              };
              let el = deepActiveElement();
              if (!el || el === document.body || el === document.documentElement) {
                el = needsDomValueSet(document.elementFromPoint(payloadX, payloadY));
              }
              if (!el || el === document.body || el === document.documentElement) return false;
              const opts = { bubbles: true, composed: true, cancelable: true };
              if (dispatchBeforeinput) {
                try {
                  const before = new InputEvent('beforeinput', { ...opts, inputType, data: text });
                  if (!el.dispatchEvent(before)) return false;
                } catch (_err) {}
              }

              if (el.isContentEditable) {
                document.execCommand('insertText', false, text);
                return true;
              }

              const tag = el.tagName;
              if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
              const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
              const dispatchValueEvents = () => {
                try {
                  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType, data: text }));
                } catch (_err) {
                  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                }
                el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
              };
              const controlType = tag === 'INPUT' ? String(el.type || '').toLowerCase() : '';
              if (!replaceValueTypes.includes(controlType)) {
                const pointed = needsDomValueSet(document.elementFromPoint(payloadX, payloadY));
                if (pointed) el = pointed;
              }
              const effectiveTag = el.tagName;
              const effectiveType = effectiveTag === 'INPUT' ? String(el.type || '').toLowerCase() : '';
              if (replaceValueTypes.includes(effectiveType)) {
                window.__browserLabPendingSpecialInput = window.__browserLabPendingSpecialInput || new WeakMap();
                const pendingMap = window.__browserLabPendingSpecialInput;
                const pending = pendingMap.get(el) || String(el.value || '');
                const incoming = String(text || '');
                const candidate = incoming.length > 1 ? incoming : pending + incoming;
                const normalizeSpecialValue = (type, value) => {
                  const clean = String(value || '').trim();
                  const digits = clean.replace(/\\D+/g, '');
                  if (type === 'date') {
                    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(clean)) return clean;
                    if (/^\\d{8}$/.test(digits)) {
                      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
                    }
                    return '';
                  }
                  if (type === 'time') {
                    const timeMatch = clean.match(/^(\\d{2}:\\d{2})(?::\\d{2})?/);
                    if (timeMatch) return timeMatch[1];
                    if (/^\\d{4}$/.test(digits)) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
                    return '';
                  }
                  if (type === 'datetime-local') {
                    const datetimeMatch = clean.match(/^(\\d{4}-\\d{2}-\\d{2})[T\\s](\\d{2}:\\d{2})/);
                    if (datetimeMatch) return `${datetimeMatch[1]}T${datetimeMatch[2]}`;
                    if (/^\\d{12}$/.test(digits)) {
                      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
                    }
                    return '';
                  }
                  if (type === 'month') {
                    if (/^\\d{4}-\\d{2}$/.test(clean)) return clean;
                    if (/^\\d{6}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
                    return '';
                  }
                  if (type === 'week') {
                    const weekMatch = clean.match(/^(\\d{4}-W\\d{2})$/i);
                    if (weekMatch) return weekMatch[1].toUpperCase();
                    if (/^\\d{6}$/.test(digits)) return `${digits.slice(0, 4)}-W${digits.slice(4, 6)}`;
                    return '';
                  }
                  if (type === 'color') {
                    const colorMatch = clean.match(/^#[0-9a-f]{6}$/i);
                    if (colorMatch) return colorMatch[0].toLowerCase();
                    const hexMatch = clean.match(/^[0-9a-f]{6}$/i);
                    return hexMatch ? `#${hexMatch[0].toLowerCase()}` : '';
                  }
                  return clean;
                };
                pendingMap.set(el, candidate.slice(-64));
                const nextValue = normalizeSpecialValue(effectiveType, candidate);
                if (!nextValue) return true;
                descriptor.set.call(el, nextValue);
                pendingMap.delete(el);
                dispatchValueEvents();
                return true;
              }
              const oldValue = String(el.value || '');
              const start = typeof el.selectionStart === 'number' ? el.selectionStart : oldValue.length;
              const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
              const nextValue = oldValue.slice(0, start) + text + oldValue.slice(end);
              descriptor.set.call(el, nextValue);
              const cursor = start + text.length;
              try {
                el.setSelectionRange(cursor, cursor);
              } catch (_err) {}
              dispatchValueEvents();
              return true;
            }
            """,
            {
                "text": text,
                "inputType": input_type,
                "dispatchBeforeinput": dispatch_beforeinput,
                "payloadX": self.last_mouse_x,
                "payloadY": self.last_mouse_y,
            },
        )

    async def copy(self) -> Optional[str]:
        page = self._active_page()
        text = await self._selected_text_for_copy()
        await page.keyboard.press("Control+C")
        return text

    async def cut(self) -> Optional[str]:
        page = self._active_page()
        text = await self._selected_text_for_copy()
        await page.keyboard.press("Control+X")
        return text

    async def _selected_text_for_copy(self) -> Optional[str]:
        frame = await self._active_element_frame()
        try:
            text = await frame.evaluate(
                """
                () => {
                  const deepActiveElement = () => {
                    let el = document.activeElement;
                    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                      el = el.shadowRoot.activeElement;
                    }
                    return el;
                  };
                  const el = deepActiveElement();
                  const isInput = el && el.tagName === 'INPUT';
                  const isTextArea = el && el.tagName === 'TEXTAREA';
                  if (isInput || isTextArea) {
                    const type = String(el.type || '').toLowerCase();
                    const autocomplete = String(el.autocomplete || '').toLowerCase();
                    if (type === 'password' || autocomplete.includes('password')) return null;
                    if (type === 'file' || type === 'hidden') return null;
                    const start = typeof el.selectionStart === 'number' ? el.selectionStart : null;
                    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : null;
                    if (start === null || end === null || end <= start) return '';
                    return String(el.value || '').slice(start, end);
                  }

                  const selection = window.getSelection && window.getSelection();
                  if (!selection || selection.rangeCount === 0) return '';
                  const selected = selection.toString();
                  if (!selected) return '';
                  if (el && el.isContentEditable) {
                    const range = selection.getRangeAt(0);
                    if (!el.contains(range.commonAncestorContainer)) return '';
                  }
                  return selected;
                }
                """
            )
        except PlaywrightError:
            return None
        if not isinstance(text, str):
            return None
        text = text[:100_000]
        return text if text else None

    async def _active_element_frame(self) -> Any:
        page = self._active_page()
        frames = list(page.frames)
        for frame in reversed(frames):
            try:
                has_active_element = await frame.evaluate(
                    """
                    () => {
                      const deepActiveElement = () => {
                        let el = document.activeElement;
                        while (el && el.shadowRoot && el.shadowRoot.activeElement) {
                          el = el.shadowRoot.activeElement;
                        }
                        return el;
                      };
                      const el = deepActiveElement();
                      return Boolean(
                        document.hasFocus() &&
                        el &&
                        el !== document.body &&
                        el !== document.documentElement
                      );
                    }
                    """
                )
            except PlaywrightError:
                continue
            if has_active_element:
                return frame
        return page.main_frame

    def _active_page(self, required: bool = True) -> Optional[Page]:
        if self.page and not self.page.is_closed():
            return self.page
        if required:
            raise RuntimeError("Browser page is not available")
        return None


controller = BrowserLab()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        yield
    finally:
        await controller.shutdown()


app = FastAPI(title="TG Browser Lab Proxy", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "tg-browser-lab-proxy",
        "profile_dir": str(controller.profile_dir),
        "runtime_dir": str(controller.runtime_dir),
        "browser_started": controller.state.browser_started,
        "headless": controller.headless,
        "channel": controller.channel,
        "cdp_url": controller.cdp_url,
        "executable_path": controller.executable_path,
        "block_private_nav": controller.block_private_nav,
    }


@app.get("/status")
async def status() -> Dict[str, Any]:
    return await controller.status_payload()


@app.post("/browser/reset-profile")
async def reset_profile() -> Dict[str, Any]:
    try:
        return await controller.reset_profile()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def _send_json(ws: WebSocket, send_lock: asyncio.Lock, payload: Dict[str, Any]) -> None:
    async with send_lock:
        await ws.send_text(json.dumps(payload, separators=(",", ":")))


async def _send_log(ws: WebSocket, send_lock: asyncio.Lock, level: str, message: str) -> None:
    await _send_json(ws, send_lock, {"type": "log", "level": level, "message": message, "ts": int(time.time() * 1000)})


async def _stream_frames(ws: WebSocket, send_lock: asyncio.Lock, settings: Dict[str, Any], stop_event: asyncio.Event) -> None:
    sent = 0
    window_start = time.perf_counter()
    last_error_log = 0.0
    while not stop_event.is_set():
        fps = _clamp_float(settings.get("fps"), 1.0, 30.0, 8.0)
        quality = _clamp_int(settings.get("quality"), 30, 95, 70)
        frame_start = time.perf_counter()
        try:
            frame = await controller.screenshot(quality)
            await _send_json(ws, send_lock, frame)
            sent += 1
        except Exception as exc:  # noqa: BLE001 - stream must survive transient browser errors.
            now = time.perf_counter()
            if now - last_error_log > 2.0:
                await _send_log(ws, send_lock, "warn", f"frame capture failed: {exc}")
                last_error_log = now
            await asyncio.sleep(0.5)
            continue

        now = time.perf_counter()
        if now - window_start >= 1.0:
            measured_fps = sent / (now - window_start)
            await _send_json(
                ws,
                send_lock,
                {
                    "type": "metrics",
                    "fps": round(measured_fps, 1),
                    "target_fps": fps,
                    "screenshot_ms": frame.get("screenshot_ms"),
                    "seq": frame.get("seq"),
                    "ts": int(time.time() * 1000),
                },
            )
            sent = 0
            window_start = now

        elapsed = time.perf_counter() - frame_start
        await asyncio.sleep(max(0.0, (1.0 / fps) - elapsed))


async def _stream_status(ws: WebSocket, send_lock: asyncio.Lock, stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await _send_json(ws, send_lock, await controller.status_payload())
        except Exception as exc:  # noqa: BLE001
            await _send_log(ws, send_lock, "warn", f"status update failed: {exc}")
        await asyncio.sleep(1.0)


async def _stream_browser_logs(ws: WebSocket, send_lock: asyncio.Lock, stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            payload = await asyncio.wait_for(controller.log_queue.get(), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        try:
            await _send_json(ws, send_lock, payload)
        except Exception:
            return


async def _handle_command(
    ws: WebSocket,
    send_lock: asyncio.Lock,
    message: Dict[str, Any],
    settings: Dict[str, Any],
) -> None:
    msg_type = message.get("type")
    try:
        if msg_type == "ping":
            await _send_json(ws, send_lock, {"type": "pong", "client_ts": message.get("client_ts"), "server_ts": int(time.time() * 1000)})
        elif msg_type == "navigate":
            asyncio.create_task(_run_navigation_task(ws, send_lock, "navigate", message.get("url") or ""))
        elif msg_type in {"back", "forward", "reload"}:
            asyncio.create_task(_run_navigation_task(ws, send_lock, msg_type, ""))
        elif msg_type == "stop":
            await _send_json(ws, send_lock, await controller.stop())
        elif msg_type == "resize":
            status_payload = await controller.resize(
                message.get("width"),
                message.get("height"),
                message.get("deviceScaleFactor", 1),
            )
            await _send_json(ws, send_lock, status_payload)
        elif msg_type == "stream_settings":
            settings["fps"] = _clamp_float(message.get("fps"), 1.0, 30.0, settings.get("fps", 8.0))
            settings["quality"] = _clamp_int(message.get("quality"), 30, 95, settings.get("quality", 70))
            await _send_log(ws, send_lock, "info", f"stream settings applied: {settings['fps']} fps, JPEG {settings['quality']}")
        elif msg_type == "mouse":
            await controller.mouse(message)
        elif msg_type == "touch":
            await controller.touch(message)
        elif msg_type == "key":
            await controller.key(message)
        elif msg_type == "composition":
            await controller.composition(message)
        elif msg_type == "paste":
            await controller.paste(message)
        elif msg_type == "files":
            file_count = await controller.upload_files(message)
            await _send_log(ws, send_lock, "info", f"uploaded {file_count} file(s) to remote file input")
        elif msg_type == "file_drop":
            file_count = await controller.drop_files(message)
            await _send_log(ws, send_lock, "info", f"dropped {file_count} file(s) into remote page")
        elif msg_type == "copy":
            copied_text = await controller.copy()
            if copied_text:
                await _send_json(ws, send_lock, {"type": "clipboard", "text": copied_text})
                await _send_log(ws, send_lock, "info", f"copy sent {len(copied_text)} chars to host clipboard")
            else:
                await _send_log(ws, send_lock, "info", "copy shortcut sent; no readable non-sensitive selection")
        elif msg_type == "cut":
            cut_text = await controller.cut()
            if cut_text:
                await _send_json(ws, send_lock, {"type": "clipboard", "text": cut_text})
                await _send_log(ws, send_lock, "info", f"cut sent {len(cut_text)} chars to host clipboard")
            else:
                await _send_log(ws, send_lock, "info", "cut shortcut sent; no readable non-sensitive selection")
        else:
            await _send_log(ws, send_lock, "warn", f"unknown command: {msg_type}")
    except Exception as exc:  # noqa: BLE001
        controller.state.last_error = str(exc)
        await _send_log(ws, send_lock, "error", f"{msg_type or 'command'} failed: {exc}")
        await _send_json(ws, send_lock, await controller.status_payload())


async def _run_navigation_task(ws: WebSocket, send_lock: asyncio.Lock, command: str, url: str) -> None:
    try:
        if command == "navigate":
            payload = await controller.navigate(url)
        elif command == "back":
            payload = await controller.back()
        elif command == "forward":
            payload = await controller.forward()
        elif command == "reload":
            payload = await controller.reload()
        else:
            raise ValueError(f"Unknown navigation command: {command}")
        await _send_json(ws, send_lock, payload)
    except Exception as exc:  # noqa: BLE001
        controller.state.loading = False
        controller.state.last_error = str(exc)
        await _send_log(ws, send_lock, "error", f"{command} failed: {exc}")
        await _send_json(ws, send_lock, await controller.status_payload())


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    send_lock = asyncio.Lock()
    stop_event = asyncio.Event()
    settings: Dict[str, Any] = {"fps": 8.0, "quality": 70}
    try:
        await _send_log(ws, send_lock, "info", "starting Chromium")
        await controller.ensure_started()
        await _send_json(
            ws,
            send_lock,
            {
                "type": "hello",
                "protocol": 1,
                "server": "tg-browser-lab-proxy",
                "profile_dir": str(controller.profile_dir),
                "runtime_dir": str(controller.runtime_dir),
            },
        )
        await _send_json(ws, send_lock, await controller.status_payload())
        frame_task = asyncio.create_task(_stream_frames(ws, send_lock, settings, stop_event))
        status_task = asyncio.create_task(_stream_status(ws, send_lock, stop_event))
        log_task = asyncio.create_task(_stream_browser_logs(ws, send_lock, stop_event))
        while True:
            raw = await ws.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await _send_log(ws, send_lock, "warn", "invalid JSON command")
                continue
            await _handle_command(ws, send_lock, message, settings)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        try:
            await _send_log(ws, send_lock, "error", f"websocket failed: {exc}")
        except Exception:
            pass
    finally:
        stop_event.set()
        for task_name in ("frame_task", "status_task", "log_task"):
            task = locals().get(task_name)
            if task:
                task.cancel()
        await asyncio.sleep(0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the TG Browser Lab proxy server.")
    parser.add_argument("--host", default=os.environ.get("TG_BROWSER_LAB_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("TG_BROWSER_LAB_PORT", DEFAULT_PORT)))
    parser.add_argument("--reload", action="store_true", help="Enable uvicorn reload for server development.")
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError as exc:
        raise SystemExit("Missing dependency: install uvicorn with `uv pip install \"uvicorn[standard]\"`.") from exc

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload, log_level="info")


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    main()
