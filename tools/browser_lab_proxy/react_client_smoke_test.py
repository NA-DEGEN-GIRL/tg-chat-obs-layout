#!/usr/bin/env python3
"""End-to-end React smoke test through browser_lab.html.

This test opens the static Browser Lab client in a host Playwright browser,
clicks the streamed canvas, types through the hidden text sink, and verifies
that the remote React page state changed. It complements react_smoke_test.py,
which talks directly to the sidecar WebSocket.
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
PROXY_PORT = 9497
STATIC_PORT = 9582
FIXTURE_PORT = 9583
PROFILE_DIR = Path("/tmp/tg-browser-lab-profile-react-client-smoke")
RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime-react-client-smoke")
FRAME_PATH = RUNTIME_DIR / "react_client_smoke_final.jpg"
REPO_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = REPO_ROOT / "static_videochat"


FIXTURE_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Client Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 18px; }
    label { display: block; margin: 6px 0; }
    input, textarea, select, button, [contenteditable] { font-size: 20px; padding: 8px; margin: 6px; }
    textarea { width: 360px; height: 70px; }
    input[type="checkbox"], input[type="radio"] { width: auto; }
    #pointerPad { width: 340px; height: 88px; margin: 8px 0; border: 2px solid #4277c4; display: grid; place-items: center; user-select: none; touch-action: none; }
    #hoverPad { width: 340px; height: 70px; margin: 8px 0; border: 2px solid #9b6b2f; display: grid; place-items: center; user-select: none; }
    #portalRoot { margin-top: 10px; padding: 10px; border: 2px solid #398060; }
    #result { margin-top: 16px; font-size: 22px; font-weight: 700; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root">loading react...</div>
  <div id="portalRoot"></div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script>
    const e = React.createElement;
    function App() {
      const [name, setName] = React.useState('');
      const [alias, setAlias] = React.useState('');
      const [notes, setNotes] = React.useState('');
      const [pasteProbe, setPasteProbe] = React.useState('');
      const [checked, setChecked] = React.useState(false);
      const [choice, setChoice] = React.useState('a');
      const [speed, setSpeed] = React.useState('slow');
      const [volume, setVolume] = React.useState('0');
      const [portalText, setPortalText] = React.useState('');
      const [portalClicks, setPortalClicks] = React.useState(0);
      const [rich, setRich] = React.useState('');
      const [route, setRoute] = React.useState(window.location.pathname || '/');
      const [routeDetailSeen, setRouteDetailSeen] = React.useState(false);
      const [routeHomeReturned, setRouteHomeReturned] = React.useState(false);
      const [pasteCount, setPasteCount] = React.useState(0);
      const [clicks, setClicks] = React.useState(0);
      const [shiftClicks, setShiftClicks] = React.useState(0);
      const [doubleClicks, setDoubleClicks] = React.useState(0);
      const [contextMenus, setContextMenus] = React.useState(0);
      const [keyboardClicks, setKeyboardClicks] = React.useState(0);
      const [keyboardFocusCount, setKeyboardFocusCount] = React.useState(0);
      const [beforeInputCount, setBeforeInputCount] = React.useState(0);
      const [submitted, setSubmitted] = React.useState(false);
      const [pointer, setPointer] = React.useState({ down: 0, move: 0, up: 0, wheel: 0, startX: 0, totalDx: 0, wheelY: 0 });
      const [hover, setHover] = React.useState({ enter: 0, move: 0, leave: 0 });
      const [aliasComposition, setAliasComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const pointerOk = pointer.down >= 1 && pointer.move >= 2 && pointer.up >= 1 && pointer.totalDx >= 80 && pointer.wheel >= 1 && pointer.wheelY >= 40;
      const hoverOk = hover.enter >= 1 && hover.move >= 1 && hover.leave >= 1;
      const compositionOk = aliasComposition.start >= 1 && aliasComposition.update >= 1 && aliasComposition.end >= 1;
      const pasteOk = pasteProbe === 'clip' && pasteCount === 1;
      const modifierOk = shiftClicks === 1;
      const clickGestureOk = doubleClicks === 1 && contextMenus === 1;
      const keyboardOk = keyboardClicks === 1 && keyboardFocusCount >= 1;
      const rangeOk = Number(volume) >= 80;
      const portalOk = portalText === 'portal' && portalClicks === 1;
      const beforeInputOk = beforeInputCount >= 1;
      const controlsOk = checked && choice === 'b' && speed === 'fast' && rich === 'notes';
      const routeOk = route === '/' && routeDetailSeen && routeHomeReturned;
      const ok = name === 'react' && alias === '\\uD55C\\uAE00' && compositionOk && notes === 'multi\\nline' && pasteOk && beforeInputOk && controlsOk && routeOk && rangeOk && portalOk && pointerOk && hoverOk && modifierOk && clickGestureOk && keyboardOk && clicks === 1;
      const state = { name, alias, aliasComposition, compositionOk, notes, pasteProbe, checked, choice, speed, rich, controlsOk, route, routeDetailSeen, routeHomeReturned, routeOk, volume, rangeOk, portalText, portalClicks, portalOk, pasteCount, pasteOk, beforeInputCount, beforeInputOk, pointer, pointerOk, hover, hoverOk, clicks, shiftClicks, modifierOk, doubleClicks, contextMenus, clickGestureOk, keyboardClicks, keyboardFocusCount, keyboardOk, submitted, ok };
      window.__browserLabClientSmokeState = state;
      React.useEffect(() => {
        const syncRoute = () => {
          const nextRoute = window.location.pathname || '/';
          setRoute(nextRoute);
          if (nextRoute === '/') setRouteHomeReturned(true);
        };
        window.addEventListener('popstate', syncRoute);
        return () => window.removeEventListener('popstate', syncRoute);
      }, []);
      React.useEffect(() => {
        document.title = 'Browser Lab React Client Smoke ' + route;
      }, [route]);
      const openDetail = (ev) => {
        ev.preventDefault();
        window.history.pushState({ screen: 'detail' }, '', '/spa/detail?from=client#section');
        setRoute('/spa/detail');
        setRouteDetailSeen(true);
        setSubmitted(false);
      };
      return e('form', {
        onSubmit: (ev) => { ev.preventDefault(); setSubmitted(true); }
      },
        e('h1', null, 'Browser Lab React Client Smoke'),
        e('nav', { id: 'spaNav' },
          e('a', { id: 'spaDetailLink', href: '/spa/detail?from=client#section', onClick: openDetail }, 'Detail route'),
          e('span', { id: 'routeState' }, routeOk ? 'ok:spa' : 'state:spa:' + route + ':' + routeDetailSeen + ':' + routeHomeReturned)
        ),
        e('label', null, 'Name',
          e('input', {
            id: 'name',
            value: name,
            onBeforeInput: () => { setBeforeInputCount((count) => count + 1); },
            onChange: (ev) => { setName(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Alias',
          e('input', {
            id: 'alias',
            value: alias,
            onCompositionStart: () => { setAliasComposition((prev) => ({ ...prev, start: prev.start + 1 })); },
            onCompositionUpdate: () => { setAliasComposition((prev) => ({ ...prev, update: prev.update + 1 })); },
            onCompositionEnd: () => { setAliasComposition((prev) => ({ ...prev, end: prev.end + 1 })); },
            onChange: (ev) => { setAlias(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Notes',
          e('textarea', {
            id: 'notes',
            value: notes,
            onChange: (ev) => { setNotes(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Paste',
          e('input', {
            id: 'pasteProbe',
            value: pasteProbe,
            onPaste: () => { setPasteCount((count) => count + 1); },
            onChange: (ev) => { setPasteProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('label', null, 'Agree',
          e('input', {
            id: 'agree',
            type: 'checkbox',
            checked,
            onChange: (ev) => { setChecked(ev.target.checked); setSubmitted(false); }
          })
        ),
        e('label', null, 'Choice',
          e('select', {
            id: 'choice',
            value: choice,
            onChange: (ev) => { setChoice(ev.target.value); setSubmitted(false); }
          },
            e('option', { value: 'a' }, 'Alpha'),
            e('option', { value: 'b' }, 'Beta')
          )
        ),
        e('fieldset', null,
          e('legend', null, 'Speed'),
          e('label', null,
            e('input', {
              id: 'speedSlow',
              name: 'speed',
              type: 'radio',
              value: 'slow',
              checked: speed === 'slow',
              onChange: (ev) => { setSpeed(ev.target.value); setSubmitted(false); }
            }),
            'Slow'
          ),
          e('label', null,
            e('input', {
              id: 'speedFast',
              name: 'speed',
              type: 'radio',
              value: 'fast',
              checked: speed === 'fast',
              onChange: (ev) => { setSpeed(ev.target.value); setSubmitted(false); }
            }),
            'Fast'
          )
        ),
        e('label', null, 'Range',
          e('input', {
            id: 'rangeProbe',
            type: 'range',
            min: '0',
            max: '100',
            value: volume,
            onChange: (ev) => { setVolume(ev.target.value); setSubmitted(false); }
          }),
          e('span', { id: 'rangeValue' }, volume)
        ),
        e('label', null, 'Rich',
          e('div', {
            id: 'rich',
            contentEditable: true,
            suppressContentEditableWarning: true,
            onInput: (ev) => { setRich(ev.currentTarget.textContent); setSubmitted(false); }
          }, '')
        ),
        e('div', {
          id: 'pointerPad',
          onPointerDown: (ev) => {
            setPointer((prev) => ({ ...prev, down: prev.down + 1, startX: ev.clientX }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            setPointer((prev) => ({
              ...prev,
              move: prev.move + 1,
              totalDx: Math.max(prev.totalDx, Math.abs(ev.clientX - prev.startX))
            }));
            setSubmitted(false);
          },
          onPointerUp: () => {
            setPointer((prev) => ({ ...prev, up: prev.up + 1 }));
            setSubmitted(false);
          },
          onWheel: (ev) => {
            ev.preventDefault();
            setPointer((prev) => ({ ...prev, wheel: prev.wheel + 1, wheelY: prev.wheelY + Math.abs(ev.deltaY) }));
            setSubmitted(false);
          }
        }, 'Pointer target'),
        e('div', {
          id: 'hoverPad',
          onMouseEnter: () => { setHover((prev) => ({ ...prev, enter: prev.enter + 1 })); setSubmitted(false); },
          onMouseMove: () => { setHover((prev) => ({ ...prev, move: prev.move + 1 })); setSubmitted(false); },
          onMouseLeave: () => { setHover((prev) => ({ ...prev, leave: prev.leave + 1 })); setSubmitted(false); }
        }, 'Hover target'),
        e('button', {
          id: 'count',
          type: 'button',
          onClick: () => { setClicks((count) => count + 1); setSubmitted(false); }
        }, 'Count'),
        e('button', {
          id: 'shiftCount',
          type: 'button',
          onClick: (ev) => {
            if (ev.shiftKey) setShiftClicks((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Shift Count'),
        e('button', {
          id: 'doubleCount',
          type: 'button',
          onDoubleClick: () => { setDoubleClicks((count) => count + 1); setSubmitted(false); }
        }, 'Double Count'),
        e('button', {
          id: 'contextCount',
          type: 'button',
          onContextMenu: (ev) => {
            ev.preventDefault();
            setContextMenus((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Context Count'),
        e('button', {
          id: 'keyboardCount',
          type: 'button',
          onFocus: () => { setKeyboardFocusCount((count) => count + 1); },
          onClick: () => { setKeyboardClicks((count) => count + 1); setSubmitted(false); }
        }, 'Keyboard Count'),
        e('button', { id: 'submit', type: 'submit', disabled: !ok }, 'Submit'),
        e('div', { id: 'result' },
          submitted && ok
            ? 'ok:' + name + ':' + alias + ':composition:' + notes.replace('\\n', '|') + ':' + pasteProbe + ':controls:' + choice + ':' + speed + ':' + rich + ':spa:range:' + volume + ':portal:pointer:modifier:gestures:keyboard:' + clicks
            : 'state:' + JSON.stringify(state)
        ),
        ReactDOM.createPortal(
          e('div', { id: 'portalPanel' },
            e('strong', null, 'Portal'),
            e('input', {
              id: 'portalInput',
              value: portalText,
              onChange: (ev) => { setPortalText(ev.target.value); setSubmitted(false); }
            }),
            e('button', {
              id: 'portalButton',
              type: 'button',
              onClick: () => { setPortalClicks((count) => count + 1); setSubmitted(false); }
            }, 'Portal Count'),
            e('span', { id: 'portalResult' }, portalOk ? 'ok:portal:' + portalText : 'state:portal:' + portalText + ':' + portalClicks)
          ),
          document.getElementById('portalRoot')
        )
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(e(App));
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


async def remote_state(controller: Any) -> Dict[str, Any]:
    if not controller.page:
        return {}
    state = await controller.page.evaluate("window.__browserLabClientSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 12.0) -> Dict[str, Any]:
    started = time.monotonic()
    last: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last = await remote_state(controller)
        if all(last.get(key) == value for key, value in expected.items()):
            return last
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last!r}")


async def canvas_point_for_selector(
    host_page: Any,
    controller: Any,
    selector: str,
    x_fraction: float = 0.5,
    y_fraction: float = 0.5,
) -> tuple[float, float]:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    remote_locator = controller.page.locator(selector)
    await remote_locator.scroll_into_view_if_needed()
    remote_box = await remote_locator.bounding_box()
    canvas_box = await host_page.locator("#viewportCanvas").bounding_box()
    if not remote_box or not canvas_box:
        raise RuntimeError(f"Could not map selector to canvas: {selector}")
    canvas_size = await host_page.locator("#viewportCanvas").evaluate(
        "(canvas) => ({ width: canvas.width, height: canvas.height })"
    )
    scale_x = canvas_box["width"] / canvas_size["width"]
    scale_y = canvas_box["height"] / canvas_size["height"]
    bounded_x = max(0.0, min(1.0, x_fraction))
    bounded_y = max(0.0, min(1.0, y_fraction))
    x = canvas_box["x"] + (remote_box["x"] + remote_box["width"] * bounded_x) * scale_x
    y = canvas_box["y"] + (remote_box["y"] + remote_box["height"] * bounded_y) * scale_y
    return x, y


async def click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y)
    await asyncio.sleep(0.2)


async def click_remote_selector_at_fraction(host_page: Any, controller: Any, selector: str, x_fraction: float) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector, x_fraction=x_fraction)
    await host_page.mouse.click(x, y)
    await asyncio.sleep(0.2)


async def double_click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.dblclick(x, y)
    await asyncio.sleep(0.2)


async def right_click_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.click(x, y, button="right")
    await asyncio.sleep(0.2)


async def drag_remote_selector(host_page: Any, controller: Any, selector: str, delta_x: int, delta_y: int) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.down()
    for step in range(1, 5):
        await asyncio.sleep(0.05)
        await host_page.mouse.move(x + delta_x * step / 4, y + delta_y * step / 4)
    await asyncio.sleep(0.05)
    await host_page.mouse.up()
    await asyncio.sleep(0.2)


async def move_remote_selector(host_page: Any, controller: Any, selector: str) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.15)


async def wheel_remote_selector(host_page: Any, controller: Any, selector: str, delta_y: int) -> None:
    x, y = await canvas_point_for_selector(host_page, controller, selector)
    await host_page.mouse.move(x, y)
    await asyncio.sleep(0.05)
    await host_page.mouse.wheel(0, delta_y)
    await asyncio.sleep(0.2)


async def assert_remote_focus(controller: Any, expected_id: str) -> None:
    if not controller.page:
        raise RuntimeError("Remote browser page is not available")
    active_id = await controller.page.evaluate("document.activeElement && document.activeElement.id")
    if active_id != expected_id:
        raise AssertionError(f"Expected remote focus on #{expected_id}, got #{active_id}")


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
            host_context = await host_browser.new_context(viewport={"width": 1600, "height": 1100})
            await host_context.grant_permissions(
                ["clipboard-read", "clipboard-write"],
                origin=f"http://{HOST}:{STATIC_PORT}",
            )
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

            await wait_for(
                client_connected,
                "Browser Lab client connection",
                timeout=25,
            )
            await host_page.locator("#scaleSelect").select_option("1")
            await host_page.locator("#viewportWidth").fill("900")
            await host_page.locator("#viewportHeight").fill("760")
            await host_page.locator("#applyStreamBtn").click()

            async def remote_viewport_resized() -> bool:
                if not controller.page:
                    return False
                size = await controller.page.evaluate("({ width: window.innerWidth, height: window.innerHeight })")
                return size == {"width": 900, "height": 760}

            await wait_for(remote_viewport_resized, "Remote viewport resized from static client", timeout=15)
            await host_page.locator("#addressInput").fill(f"http://{HOST}:{FIXTURE_PORT}/")
            await host_page.locator("#addressInput").press("Enter")

            async def remote_fixture_loaded() -> bool:
                return bool(controller.page and controller.page.url.startswith(f"http://{HOST}:{FIXTURE_PORT}"))

            await wait_for(
                remote_fixture_loaded,
                "Remote React fixture navigation",
                timeout=35,
            )
            if not controller.page:
                raise RuntimeError("Remote browser page is not available")
            await controller.page.locator("#name").wait_for(state="visible", timeout=20_000)
            await wait_for(
                lambda: host_page.locator("#viewportCanvas").evaluate(
                    "(canvas) => canvas.width === 900 && canvas.height === 760"
                ),
                "Browser Lab canvas resized",
                timeout=15,
            )
            await host_page.locator("#viewportCanvas").scroll_into_view_if_needed()

            await click_remote_selector(host_page, controller, "#spaDetailLink")
            await wait_for_state(
                controller,
                {"route": "/spa/detail", "routeDetailSeen": True},
                "client canvas React SPA pushState route",
            )

            async def client_url_contains_detail() -> bool:
                current_url = await host_page.locator("#currentUrl").inner_text()
                return "/spa/detail?from=client#section" in current_url

            await wait_for(
                client_url_contains_detail,
                "Browser Lab status follows React SPA pushState URL",
                timeout=15,
            )
            await host_page.locator("#backBtn").click()
            await wait_for_state(
                controller,
                {"route": "/", "routeOk": True},
                "client Browser Lab Back triggers React popstate",
            )

            await click_remote_selector(host_page, controller, "#name")
            await assert_remote_focus(controller, "name")
            await host_page.keyboard.type("react")
            await wait_for_state(controller, {"name": "react", "beforeInputOk": True}, "client text sink ASCII beforeinput")

            await click_remote_selector(host_page, controller, "#alias")
            await assert_remote_focus(controller, "alias")
            await host_page.locator("#textSink").dispatch_event("compositionstart", {"data": ""})
            await host_page.locator("#textSink").dispatch_event("compositionupdate", {"data": "\uD55C"})
            await host_page.keyboard.type("\uD55C\uAE00")
            await host_page.locator("#textSink").dispatch_event("compositionend", {"data": "\uD55C\uAE00"})
            await wait_for_state(
                controller,
                {"alias": "\uD55C\uAE00", "compositionOk": True},
                "client text sink non-ASCII composition input",
            )

            await click_remote_selector(host_page, controller, "#notes")
            await assert_remote_focus(controller, "notes")
            await host_page.keyboard.type("multi")
            await host_page.keyboard.press("Enter")
            await host_page.keyboard.type("line")
            await wait_for_state(controller, {"notes": "multi\nline"}, "client textarea Enter input")

            await click_remote_selector(host_page, controller, "#pasteProbe")
            await assert_remote_focus(controller, "pasteProbe")
            await host_page.evaluate("(text) => navigator.clipboard.writeText(text)", "clip")
            await host_page.locator("#pasteBtn").click()
            await wait_for_state(controller, {"pasteOk": True}, "client paste button React onPaste")

            await click_remote_selector(host_page, controller, "#agree")
            await wait_for_state(controller, {"checked": True}, "client canvas React checkbox")

            await click_remote_selector(host_page, controller, "#choice")
            await host_page.keyboard.press("ArrowDown")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"choice": "b"}, "client canvas React select")

            await click_remote_selector(host_page, controller, "#speedFast")
            await wait_for_state(controller, {"speed": "fast"}, "client canvas React radio")

            await click_remote_selector_at_fraction(host_page, controller, "#rangeProbe", 0.92)
            await wait_for_state(controller, {"rangeOk": True}, "client canvas React range input")

            await click_remote_selector(host_page, controller, "#rich")
            await assert_remote_focus(controller, "rich")
            await host_page.keyboard.type("notes")
            await wait_for_state(controller, {"rich": "notes", "controlsOk": True}, "client canvas React contenteditable")

            await click_remote_selector(host_page, controller, "#portalInput")
            await assert_remote_focus(controller, "portalInput")
            await host_page.keyboard.type("portal")
            await click_remote_selector(host_page, controller, "#portalButton")
            await wait_for_state(controller, {"portalOk": True}, "client canvas React portal input and click")

            await drag_remote_selector(host_page, controller, "#pointerPad", 140, 0)
            await wheel_remote_selector(host_page, controller, "#pointerPad", 120)
            await wait_for_state(controller, {"pointerOk": True}, "client canvas React pointer drag and wheel")

            await move_remote_selector(host_page, controller, "#hoverPad")
            await move_remote_selector(host_page, controller, "#name")
            await wait_for_state(controller, {"hoverOk": True}, "client canvas React hover enter/move/leave")

            await click_remote_selector(host_page, controller, "#count")
            await wait_for_state(controller, {"clicks": 1}, "client canvas React button click")

            await host_page.keyboard.down("Shift")
            await click_remote_selector(host_page, controller, "#shiftCount")
            await host_page.keyboard.up("Shift")
            await wait_for_state(controller, {"modifierOk": True}, "client canvas React shift-click")

            await double_click_remote_selector(host_page, controller, "#doubleCount")
            await wait_for_state(controller, {"doubleClicks": 1}, "client canvas React double-click")

            await right_click_remote_selector(host_page, controller, "#contextCount")
            await wait_for_state(controller, {"clickGestureOk": True}, "client canvas React context menu")

            await click_remote_selector(host_page, controller, "#contextCount")
            await host_page.keyboard.press("Tab")
            await host_page.keyboard.press("Enter")
            await wait_for_state(controller, {"keyboardOk": True, "ok": True}, "client canvas React Tab focus and Enter activation")

            await click_remote_selector(host_page, controller, "#submit")
            await wait_for_state(controller, {"submitted": True}, "client canvas React submit click")
            result = await controller.page.locator("#result").inner_text()
            expected_prefix = "ok:react:\uD55C\uAE00:composition:multi|line:clip:controls:b:fast:notes:spa:range:"
            expected_suffix = ":portal:pointer:modifier:gestures:keyboard:1"
            if not (result.startswith(expected_prefix) and result.endswith(expected_suffix)):
                raise AssertionError(
                    f"React client smoke failed: expected prefix/suffix {expected_prefix!r}/{expected_suffix!r}, got {result!r}"
                )

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
