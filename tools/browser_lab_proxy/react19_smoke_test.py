#!/usr/bin/env python3
"""React 19 ESM smoke test through browser_lab.html.

The broader React smoke tests use React 18 UMD fixtures. This test adds a
React 19 ESM fixture to cover modern bundler/CDN-style React pages through the
same static Browser Lab canvas path.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

import uvicorn
from playwright.async_api import async_playwright


HOST = "127.0.0.1"
PROXY_PORT = 9498
STATIC_PORT = 9588
FIXTURE_PORT = 9589
PROFILE_DIR = Path("/tmp/tg-browser-lab-profile-react19-smoke")
RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime-react19-smoke")
FRAME_PATH = RUNTIME_DIR / "react19_smoke_final.jpg"
REPO_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = REPO_ROOT / "static_videochat"


FIXTURE_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React 19 Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 18px; }
    label { display: block; margin: 8px 0; }
    input, select, button { font-size: 20px; padding: 8px; margin: 6px; }
    input[type="checkbox"] { width: auto; }
    #react19Result { margin-top: 16px; font-size: 22px; font-weight: 700; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root">loading react 19...</div>
  <script type="module">
    import React, { StrictMode, useDeferredValue, useState, useTransition } from 'https://esm.sh/react@19?dev';
    import { createRoot } from 'https://esm.sh/react-dom@19/client?dev';

    const e = React.createElement;

    function App() {
      const [ready, setReady] = useState(false);
      const [name, setName] = useState('');
      const [agree, setAgree] = useState(false);
      const [choice, setChoice] = useState('a');
      const [clicks, setClicks] = useState(0);
      const [submitted, setSubmitted] = useState(false);
      const [transitionText, setTransitionText] = useState('');
      const [composition, setComposition] = useState({ start: 0, update: 0, end: 0 });
      const [_pending, startTransition] = useTransition();
      const deferredName = useDeferredValue(name);

      React.useEffect(() => setReady(true), []);

      const compositionOk = composition.start >= 1 && composition.update >= 1 && composition.end >= 1;
      const ok = ready
        && name === 'react19\\uD55C\\uAE00'
        && transitionText === 'react19\\uD55C\\uAE00'
        && deferredName === name
        && compositionOk
        && agree
        && choice === 'b'
        && clicks === 1
        && submitted;
      const state = { ready, name, agree, choice, clicks, submitted, transitionText, deferredName, composition, compositionOk, ok };
      window.__browserLabReact19SmokeState = state;

      const updateName = (event) => {
        const next = event.target.value;
        setName(next);
        startTransition(() => setTransitionText(next));
        setSubmitted(false);
      };

      return e('form', {
        id: 'react19Form',
        onSubmit: (event) => {
          event.preventDefault();
          setSubmitted(true);
        },
      },
        e('h1', null, 'Browser Lab React 19 Smoke'),
        e('label', { htmlFor: 'react19Name' }, 'React 19 name'),
        e('input', {
          id: 'react19Name',
          value: name,
          onChange: updateName,
          onCompositionStart: () => setComposition((prev) => ({ ...prev, start: prev.start + 1 })),
          onCompositionUpdate: () => setComposition((prev) => ({ ...prev, update: prev.update + 1 })),
          onCompositionEnd: () => setComposition((prev) => ({ ...prev, end: prev.end + 1 })),
        }),
        e('label', null,
          e('input', {
            id: 'react19Agree',
            type: 'checkbox',
            checked: agree,
            onChange: (event) => {
              setAgree(event.target.checked);
              setSubmitted(false);
            },
          }),
          ' Agree'
        ),
        e('select', {
          id: 'react19Choice',
          value: choice,
          onChange: (event) => {
            setChoice(event.target.value);
            setSubmitted(false);
          },
        },
          e('option', { value: 'a' }, 'A'),
          e('option', { value: 'b' }, 'B')
        ),
        e('button', {
          id: 'react19Button',
          type: 'button',
          onClick: () => {
            setClicks((value) => value + 1);
            setSubmitted(false);
          },
        }, 'React 19 click'),
        e('button', { id: 'react19Submit', type: 'submit' }, 'Submit'),
        e('div', { id: 'react19Result' },
          ok ? 'ok:react19:' + name + ':' + choice + ':' + clicks + ':' + (submitted ? 'submitted' : 'open')
             : ready ? 'state:' + JSON.stringify(state) : 'state:pending'
        )
      );
    }

    createRoot(document.getElementById('root')).render(e(StrictMode, null, e(App)));
  </script>
</body>
</html>
"""


class FixtureHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(FIXTURE_HTML)))
        self.end_headers()
        self.wfile.write(FIXTURE_HTML)

    def log_message(self, *_args: Any) -> None:
        pass


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        pass


def start_http_server(server: ThreadingHTTPServer) -> threading.Thread:
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return thread


def configure_runtime() -> None:
    os.environ["TG_BROWSER_LAB_HEADLESS"] = "1"
    os.environ["TG_BROWSER_LAB_PROFILE_DIR"] = str(PROFILE_DIR)
    os.environ["TG_BROWSER_LAB_RUNTIME_DIR"] = str(RUNTIME_DIR)
    shutil.rmtree(PROFILE_DIR, ignore_errors=True)
    shutil.rmtree(RUNTIME_DIR, ignore_errors=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


async def wait_for(predicate, label: str, timeout: float = 30.0) -> None:
    started = time.monotonic()
    while time.monotonic() - started < timeout:
        if await predicate():
            return
        await asyncio.sleep(0.1)
    raise TimeoutError(label)


async def react19_state(controller: Any) -> Dict[str, Any]:
    if not controller.page:
        return {}
    state = await controller.page.evaluate("window.__browserLabReact19SmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_react19_state(
    controller: Any,
    expected: Dict[str, Any],
    label: str,
    timeout: float = 12.0,
) -> Dict[str, Any]:
    started = time.monotonic()
    last: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last = await react19_state(controller)
        if all(last.get(key) == value for key, value in expected.items()):
            return last
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last!r}")


async def canvas_point_for_selector(host_page: Any, controller: Any, selector: str) -> tuple[float, float]:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    remote_locator = controller.page.locator(selector)
    await remote_locator.scroll_into_view_if_needed()
    remote_box = await remote_locator.bounding_box()
    await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not remote_box or not canvas_box:
        raise RuntimeError(f"Could not map selector to canvas: {selector}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    x = canvas_box["x"] + (remote_box["x"] + remote_box["width"] / 2) * scale_x
    y = canvas_box["y"] + (remote_box["y"] + remote_box["height"] / 2) * scale_y
    return x, y


async def click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y)
    await asyncio.sleep(0.2)


async def run_smoke() -> None:
    configure_runtime()

    # Import after env setup so BrowserLab picks up /tmp-only test paths.
    from server import app, controller  # pylint: disable=import-error,import-outside-toplevel

    static_handler = partial(QuietStaticHandler, directory=str(STATIC_DIR))
    static_server = ThreadingHTTPServer((HOST, STATIC_PORT), static_handler)
    fixture_server = ThreadingHTTPServer((HOST, FIXTURE_PORT), FixtureHandler)
    start_http_server(static_server)
    start_http_server(fixture_server)

    config = uvicorn.Config(app, host=HOST, port=PROXY_PORT, log_level="warning")
    proxy_server = uvicorn.Server(config)
    proxy_task = asyncio.create_task(proxy_server.serve())

    try:
        await asyncio.sleep(0.5)
        async with async_playwright() as playwright:
            host_browser = await playwright.chromium.launch(headless=True)
            host_context = await host_browser.new_context(viewport={"width": 1300, "height": 900})
            host_page = await host_context.new_page()
            await host_page.goto(
                f"http://{HOST}:{STATIC_PORT}/browser_lab.html?proxy=http://{HOST}:{PROXY_PORT}",
                wait_until="domcontentloaded",
            )
            await host_page.locator("#connectionStatus").wait_for(timeout=20_000)

            async def client_connected() -> bool:
                profile_text = await host_page.locator("#profilePath").inner_text()
                return (
                    await host_page.locator("#connectionStatus").inner_text() == "Connected"
                    and profile_text not in {"", "-"}
                    and controller.page is not None
                )

            await wait_for(client_connected, "Browser Lab client connection", timeout=25)
            await host_page.locator("#scaleSelect").select_option("1")
            await host_page.locator("#viewportWidth").fill("900")
            await host_page.locator("#viewportHeight").fill("620")
            await host_page.locator("#applyStreamBtn").click()

            async def remote_viewport_resized() -> bool:
                if not controller.page:
                    return False
                size = await controller.page.evaluate("({ width: window.innerWidth, height: window.innerHeight })")
                return size == {"width": 900, "height": 620}

            await wait_for(remote_viewport_resized, "Remote viewport resized from static client", timeout=15)
            await host_page.locator("#addressInput").fill(f"http://{HOST}:{FIXTURE_PORT}/")
            await host_page.locator("#addressInput").press("Enter")

            async def remote_fixture_loaded() -> bool:
                return bool(controller.page and controller.page.url.startswith(f"http://{HOST}:{FIXTURE_PORT}"))

            await wait_for(remote_fixture_loaded, "Remote React 19 fixture navigation", timeout=35)
            if not controller.page:
                raise RuntimeError("Remote browser page is not available")
            await controller.page.locator("#react19Name").wait_for(state="visible", timeout=35_000)
            await wait_for_react19_state(controller, {"ready": True}, "React 19 root ready", timeout=20)
            await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()

            await click_remote_selector(host_page, controller, "#react19Name")
            await host_page.keyboard.type("react19")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await wait_for_react19_state(
                controller,
                {"name": "react19\uD55C\uAE00", "compositionOk": True},
                "React 19 controlled input and composition",
            )

            await click_remote_selector(host_page, controller, "#react19Agree")
            await wait_for_react19_state(controller, {"agree": True}, "React 19 checkbox")
            await click_remote_selector(host_page, controller, "#react19Choice")
            await host_page.keyboard.press("ArrowDown")
            await host_page.keyboard.press("Enter")
            await wait_for_react19_state(controller, {"choice": "b"}, "React 19 select")
            await click_remote_selector(host_page, controller, "#react19Button")
            await wait_for_react19_state(controller, {"clicks": 1}, "React 19 button click")
            await click_remote_selector(host_page, controller, "#react19Submit")
            await wait_for_react19_state(controller, {"ok": True}, "React 19 form submit")

            result = await controller.page.locator("#react19Result").inner_text()
            expected = "ok:react19:react19\uD55C\uAE00:b:1:submitted"
            if result != expected:
                raise AssertionError(f"React 19 smoke failed: expected {expected!r}, got {result!r}")

            frame_data = await host_page.locator("#viewportCanvas").screenshot(type="jpeg", quality=80)
            FRAME_PATH.write_bytes(frame_data)
            await host_context.close()
            await host_browser.close()

        print(
            json.dumps(
                {
                    "ok": True,
                    "result": result,
                    "final_frame": str(FRAME_PATH),
                    "profile_dir": str(PROFILE_DIR),
                    "runtime_dir": str(RUNTIME_DIR),
                    "static_url": f"http://{HOST}:{STATIC_PORT}/browser_lab.html",
                    "proxy_url": f"http://{HOST}:{PROXY_PORT}",
                },
                indent=2,
            )
        )
    finally:
        proxy_server.should_exit = True
        await proxy_task
        static_server.shutdown()
        static_server.server_close()
        fixture_server.shutdown()
        fixture_server.server_close()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    asyncio.run(run_smoke())
