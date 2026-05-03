#!/usr/bin/env python3
"""React 19 useActionState/form action smoke test through browser_lab.html.

This covers modern React form actions used by React 19 and often surfaced
through framework form flows. It verifies that Browser Lab forwards input and
submit events well enough for a function-valued React form action to receive
FormData and update React state.
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
PROXY_PORT = 9500
STATIC_PORT = 9592
FIXTURE_PORT = 9593
PROFILE_DIR = Path("/tmp/tg-browser-lab-profile-react-action-state-smoke")
RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime-react-action-state-smoke")
FRAME_PATH = RUNTIME_DIR / "react_action_state_smoke_final.jpg"
REPO_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = REPO_ROOT / "static_videochat"


FIXTURE_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Action State Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 18px; }
    label { display: block; margin: 8px 0; }
    input, select, button { font-size: 20px; padding: 8px; margin: 6px; }
    input[type="checkbox"] { width: auto; }
    #actionStateResult { margin-top: 16px; font-size: 22px; font-weight: 700; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root">loading react action state...</div>
  <script type="module">
    import React, { StrictMode, useActionState, useDeferredValue, useOptimistic, useState, useTransition } from 'https://esm.sh/react@19?dev';
    import { useFormStatus } from 'https://esm.sh/react-dom@19?dev';
    import { createRoot } from 'https://esm.sh/react-dom@19/client?dev';

    const e = React.createElement;

    function SubmitButton({ onPending }) {
      const status = useFormStatus();
      React.useEffect(() => {
        if (status.pending) onPending();
      }, [status.pending, onPending]);
      return e('button', {
        id: 'actionSubmit',
        type: 'submit',
        disabled: status.pending,
      }, status.pending ? 'Submitting...' : 'Submit action');
    }

    function App() {
      const [ready, setReady] = useState(false);
      const [draft, setDraft] = useState('');
      const [choice, setChoice] = useState('a');
      const [agree, setAgree] = useState(false);
      const [transitionText, setTransitionText] = useState('');
      const [formStatusPendingSeen, setFormStatusPendingSeen] = useState(false);
      const [optimisticSeen, setOptimisticSeen] = useState(false);
      const [composition, setComposition] = useState({ start: 0, update: 0, end: 0 });
      const [_transitionPending, startTransition] = useTransition();
      const deferredDraft = useDeferredValue(draft);
      const [optimisticName, setOptimisticName] = useOptimistic('', (_previous, next) => next);
      const [actionState, formAction, actionPending] = useActionState(async (_previous, formData) => {
        setOptimisticName(String(formData.get('actionName') || ''));
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        return {
          submitted: true,
          name: String(formData.get('actionName') || ''),
          choice: String(formData.get('actionChoice') || ''),
          agree: formData.get('actionAgree') === 'yes',
        };
      }, { submitted: false, name: '', choice: '', agree: false });

      React.useEffect(() => setReady(true), []);
      React.useEffect(() => {
        if (optimisticName === 'action\\uD55C\\uAE00') setOptimisticSeen(true);
      }, [optimisticName]);

      const compositionOk = composition.start >= 1 && composition.update >= 1 && composition.end >= 1;
      const ok = ready
        && draft === 'action\\uD55C\\uAE00'
        && transitionText === 'action\\uD55C\\uAE00'
        && deferredDraft === draft
        && compositionOk
        && agree
        && choice === 'b'
        && actionState.submitted
        && actionState.name === 'action\\uD55C\\uAE00'
        && actionState.choice === 'b'
        && actionState.agree === true
        && formStatusPendingSeen
        && optimisticSeen
        && !actionPending;
      const state = { ready, draft, choice, agree, transitionText, deferredDraft, composition, compositionOk, actionPending, formStatusPendingSeen, optimisticName, optimisticSeen, actionState, ok };
      window.__browserLabActionStateSmokeState = state;

      const updateDraft = (event) => {
        const next = event.target.value;
        setDraft(next);
        startTransition(() => setTransitionText(next));
      };

      return e('form', {
        id: 'actionStateForm',
        action: formAction,
      },
        e('h1', null, 'Browser Lab React Action State Smoke'),
        e('label', { htmlFor: 'actionName' }, 'Action name'),
        e('input', {
          id: 'actionName',
          name: 'actionName',
          value: draft,
          onChange: updateDraft,
          onCompositionStart: () => setComposition((prev) => ({ ...prev, start: prev.start + 1 })),
          onCompositionUpdate: () => setComposition((prev) => ({ ...prev, update: prev.update + 1 })),
          onCompositionEnd: () => setComposition((prev) => ({ ...prev, end: prev.end + 1 })),
        }),
        e('label', null,
          e('input', {
            id: 'actionAgree',
            name: 'actionAgree',
            type: 'checkbox',
            value: 'yes',
            checked: agree,
            onChange: (event) => setAgree(event.target.checked),
          }),
          ' Agree'
        ),
        e('select', {
          id: 'actionChoice',
          name: 'actionChoice',
          value: choice,
          onChange: (event) => setChoice(event.target.value),
        },
          e('option', { value: 'a' }, 'A'),
          e('option', { value: 'b' }, 'B')
        ),
        e(SubmitButton, { onPending: () => setFormStatusPendingSeen(true) }),
        e('div', { id: 'actionStateResult' },
          ok ? 'ok:actionstate:' + actionState.name + ':' + actionState.choice + ':' + (actionState.agree ? 'agree' : 'no') + ':pending:optimistic'
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


async def action_state(controller: Any) -> Dict[str, Any]:
    if not controller.page:
        return {}
    state = await controller.page.evaluate("window.__browserLabActionStateSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_action_state(
    controller: Any,
    expected: Dict[str, Any],
    label: str,
    timeout: float = 12.0,
) -> Dict[str, Any]:
    started = time.monotonic()
    last: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last = await action_state(controller)
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

            await wait_for(remote_fixture_loaded, "Remote React action-state fixture navigation", timeout=35)
            if not controller.page:
                raise RuntimeError("Remote browser page is not available")
            await controller.page.locator("#actionName").wait_for(state="visible", timeout=35_000)
            await wait_for_action_state(controller, {"ready": True}, "React action-state root ready", timeout=20)
            await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()

            await click_remote_selector(host_page, controller, "#actionName")
            await host_page.keyboard.type("action")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await wait_for_action_state(
                controller,
                {"draft": "action\uD55C\uAE00", "compositionOk": True},
                "React action-state controlled input and composition",
            )

            await click_remote_selector(host_page, controller, "#actionAgree")
            await wait_for_action_state(controller, {"agree": True}, "React action-state checkbox")
            await click_remote_selector(host_page, controller, "#actionChoice")
            await host_page.keyboard.press("ArrowDown")
            await host_page.keyboard.press("Enter")
            await wait_for_action_state(controller, {"choice": "b"}, "React action-state select")
            await click_remote_selector(host_page, controller, "#actionSubmit")
            await wait_for_action_state(controller, {"ok": True}, "React action-state form action")

            result = await controller.page.locator("#actionStateResult").inner_text()
            expected = "ok:actionstate:action\uD55C\uAE00:b:agree:pending:optimistic"
            if result != expected:
                raise AssertionError(f"React action-state smoke failed: expected {expected!r}, got {result!r}")

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
