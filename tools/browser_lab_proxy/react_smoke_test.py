#!/usr/bin/env python3
"""React interaction smoke test for Browser Lab.

This test starts:
- a temporary React 18 fixture on 127.0.0.1:9581
- the Browser Lab FastAPI app on 127.0.0.1:9495

It then drives the fixture only through the Browser Lab WebSocket input path and
asserts React state changed as expected. Runtime profile/cache files stay under
/tmp.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import shutil
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

import uvicorn
import websockets


HOST = "127.0.0.1"
FIXTURE_PORT = 9581
FRAME_PORT = 9584
PROXY_PORT = 9495
PROFILE_DIR = Path("/tmp/tg-browser-lab-profile-react-smoke")
RUNTIME_DIR = Path("/tmp/tg-browser-lab-runtime-react-smoke")
FRAME_PATH = RUNTIME_DIR / "react_smoke_final.jpg"


FIXTURE_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 16px; }
    h1 { margin: 0 0 10px; }
    input, textarea, select, [contenteditable] { font-size: 18px; padding: 7px; margin: 3px; width: 300px; }
    textarea { height: 54px; }
    input[type="checkbox"], input[type="radio"] { width: auto; }
    button { font-size: 18px; padding: 9px 18px; margin: 6px; }
    .row { display: flex; align-items: center; gap: 8px; }
    #pointerPad { width: 360px; height: 92px; margin: 8px 0; border: 2px solid #4277c4; display: grid; place-items: center; user-select: none; touch-action: none; }
    #hoverPad { width: 360px; height: 70px; margin: 8px 0; border: 2px solid #9b6b2f; display: grid; place-items: center; user-select: none; }
    #portalRoot { margin-top: 10px; padding: 10px; border: 2px solid #398060; }
    .ok { color: #167347; }
    .bad { color: #9d3030; }
    #result { margin-top: 20px; font-size: 22px; font-weight: 700; white-space: pre-wrap; }
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
      const [bio, setBio] = React.useState('');
      const [replace, setReplace] = React.useState('');
      const [deleteProbe, setDeleteProbe] = React.useState('');
      const [pasteProbe, setPasteProbe] = React.useState('');
      const [checked, setChecked] = React.useState(false);
      const [choice, setChoice] = React.useState('a');
      const [speed, setSpeed] = React.useState('slow');
      const [volume, setVolume] = React.useState('0');
      const [portalText, setPortalText] = React.useState('');
      const [portalClicks, setPortalClicks] = React.useState(0);
      const [rich, setRich] = React.useState('');
      const [submitted, setSubmitted] = React.useState(false);
      const [submitCount, setSubmitCount] = React.useState(0);
      const [buttonClicks, setButtonClicks] = React.useState(0);
      const [shiftClicks, setShiftClicks] = React.useState(0);
      const [doubleClicks, setDoubleClicks] = React.useState(0);
      const [contextMenus, setContextMenus] = React.useState(0);
      const [keyboardClicks, setKeyboardClicks] = React.useState(0);
      const [keyboardFocusCount, setKeyboardFocusCount] = React.useState(0);
      const [pasteCount, setPasteCount] = React.useState(0);
      const [nameBlurCount, setNameBlurCount] = React.useState(0);
      const [nameKeyDownCount, setNameKeyDownCount] = React.useState(0);
      const [beforeInputCount, setBeforeInputCount] = React.useState(0);
      const [aliasComposition, setAliasComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const [pointer, setPointer] = React.useState({ down: 0, move: 0, up: 0, wheel: 0, startX: 0, lastX: 0, totalDx: 0, wheelY: 0 });
      const [hover, setHover] = React.useState({ enter: 0, move: 0, leave: 0 });
      const pointerOk = pointer.down >= 1 && pointer.move >= 2 && pointer.up >= 1 && pointer.totalDx >= 80;
      const hoverOk = hover.enter >= 1 && hover.move >= 1 && hover.leave >= 1;
      const compositionOk = aliasComposition.start >= 1 && aliasComposition.update >= 1 && aliasComposition.end >= 1;
      const pasteOk = pasteProbe === 'clip' && pasteCount === 1;
      const modifierOk = shiftClicks === 1;
      const clickGestureOk = doubleClicks === 1 && contextMenus === 1;
      const keyboardOk = keyboardClicks === 1 && keyboardFocusCount >= 1;
      const rangeOk = Number(volume) >= 80;
      const portalOk = portalText === 'portal' && portalClicks === 1;
      const beforeInputOk = beforeInputCount >= 1;
      const ok = name === 'react' && alias === '\\uD55C\\uAE00' && compositionOk && bio === 'multi\\nline' && replace === 'done' && deleteProbe === 'del' && pasteOk && beforeInputOk && checked && choice === 'b' && speed === 'fast' && rangeOk && portalOk && rich.includes('notes') && pointerOk && hoverOk && modifierOk && clickGestureOk && keyboardOk && buttonClicks === 1 && nameBlurCount >= 1 && nameKeyDownCount >= 7;
      const state = { name, alias, aliasComposition, compositionOk, bio, replace, deleteProbe, pasteProbe, pasteCount, pasteOk, beforeInputCount, beforeInputOk, checked, choice, speed, volume, rangeOk, portalText, portalClicks, portalOk, rich, pointer, pointerOk, hover, hoverOk, shiftClicks, modifierOk, doubleClicks, contextMenus, clickGestureOk, keyboardClicks, keyboardFocusCount, keyboardOk, submitted, submitCount, buttonClicks, nameBlurCount, nameKeyDownCount, ok };
      window.__browserLabSmokeState = state;
      function ShadowApp() {
        const [value, setValue] = React.useState('');
        const [pasteCount, setPasteCount] = React.useState(0);
        const [composition, setComposition] = React.useState({ start: 0, update: 0, end: 0 });
        const compositionOk = composition.start >= 1 && composition.update >= 1 && composition.end >= 1;
        const ok = value === 'shadow\\uD55C\\uAE00clip' && pasteCount === 1 && compositionOk;
        window.__browserLabShadowSmokeState = { value, pasteCount, composition, compositionOk, ok };
        return e('div', null,
          e('label', null, 'Shadow Input ',
            e('input', {
              id: 'shadowInput',
              value,
              onCompositionStart: () => setComposition((prev) => ({ ...prev, start: prev.start + 1 })),
              onCompositionUpdate: () => setComposition((prev) => ({ ...prev, update: prev.update + 1 })),
              onCompositionEnd: () => setComposition((prev) => ({ ...prev, end: prev.end + 1 })),
              onPaste: () => setPasteCount((count) => count + 1),
              onChange: (ev) => setValue(ev.target.value)
            })
          ),
          e('div', { id: 'shadowResult' }, ok ? 'ok:shadow:' + value : 'state:' + JSON.stringify(window.__browserLabShadowSmokeState))
        );
      }
      if (!customElements.get('shadow-react-smoke')) {
        customElements.define('shadow-react-smoke', class extends HTMLElement {
          connectedCallback() {
            if (this.shadowRoot) return;
            const root = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = 'input { font-size: 18px; padding: 7px; width: 330px; } #shadowResult { margin-top: 8px; font-size: 18px; font-weight: 700; }';
            const mount = document.createElement('div');
            root.append(style, mount);
            ReactDOM.createRoot(mount).render(e(ShadowApp));
          }
        });
      }
      const submit = (ev) => {
        ev.preventDefault();
        setSubmitted(true);
        setSubmitCount((count) => count + 1);
      };
      return e('form', { onSubmit: submit },
        e('h1', null, 'Browser Lab React Smoke'),
        e('div', { className: 'row' },
          e('label', null, 'Name'),
          e('input', {
            id: 'name',
            value: name,
            placeholder: 'react',
            onBeforeInput: () => { setBeforeInputCount((count) => count + 1); },
            onKeyDown: () => { setNameKeyDownCount((count) => count + 1); },
            onBlur: () => { setNameBlurCount((count) => count + 1); },
            onChange: (ev) => { setName(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Alias'),
          e('input', {
            id: 'alias',
            value: alias,
            placeholder: '\\uD55C\\uAE00',
            onCompositionStart: () => { setAliasComposition((prev) => ({ ...prev, start: prev.start + 1 })); },
            onCompositionUpdate: () => { setAliasComposition((prev) => ({ ...prev, update: prev.update + 1 })); },
            onCompositionEnd: () => { setAliasComposition((prev) => ({ ...prev, end: prev.end + 1 })); },
            onChange: (ev) => { setAlias(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Bio'),
          e('textarea', {
            id: 'bio',
            value: bio,
            placeholder: 'multi line',
            onChange: (ev) => { setBio(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Replace'),
          e('input', {
            id: 'replace',
            value: replace,
            placeholder: 'ctrl+a',
            onChange: (ev) => { setReplace(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Delete'),
          e('input', {
            id: 'deleteProbe',
            value: deleteProbe,
            placeholder: 'delete key',
            onChange: (ev) => { setDeleteProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Paste'),
          e('input', {
            id: 'pasteProbe',
            value: pasteProbe,
            placeholder: 'paste',
            onPaste: () => { setPasteCount((count) => count + 1); },
            onChange: (ev) => { setPasteProbe(ev.target.value); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Agree'),
          e('input', {
            id: 'agree',
            type: 'checkbox',
            checked,
            onChange: (ev) => { setChecked(ev.target.checked); setSubmitted(false); }
          })
        ),
        e('div', { className: 'row' },
          e('label', null, 'Choice'),
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
        e('div', { className: 'row' },
          e('label', null, 'Range'),
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
        e('div', { className: 'row' },
          e('label', null, 'Rich'),
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
            setPointer((prev) => ({ ...prev, down: prev.down + 1, startX: ev.clientX, lastX: ev.clientX }));
            setSubmitted(false);
          },
          onPointerMove: (ev) => {
            if (!ev.buttons) return;
            setPointer((prev) => ({
              ...prev,
              move: prev.move + 1,
              lastX: ev.clientX,
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
        e('iframe', {
          id: 'reactFrame',
          src: 'http://127.0.0.1:9584/frame',
          title: 'React iframe smoke',
          style: { width: '560px', height: '180px', border: '2px solid #777', display: 'block', marginTop: '8px' }
        }),
        e('shadow-react-smoke', {
          id: 'shadowHost',
          style: { display: 'block', marginTop: '8px', padding: '10px', border: '2px solid #8662b8' }
        }),
        e('button', {
          id: 'countButton',
          type: 'button',
          onClick: () => { setButtonClicks((count) => count + 1); setSubmitted(false); }
        }, 'Count'),
        e('button', {
          id: 'shiftButton',
          type: 'button',
          onClick: (ev) => {
            if (ev.shiftKey) setShiftClicks((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Shift Count'),
        e('button', {
          id: 'doubleButton',
          type: 'button',
          onDoubleClick: () => { setDoubleClicks((count) => count + 1); setSubmitted(false); }
        }, 'Double Count'),
        e('button', {
          id: 'contextButton',
          type: 'button',
          onContextMenu: (ev) => {
            ev.preventDefault();
            setContextMenus((count) => count + 1);
            setSubmitted(false);
          }
        }, 'Context Count'),
        e('button', {
          id: 'keyboardButton',
          type: 'button',
          onFocus: () => { setKeyboardFocusCount((count) => count + 1); },
          onClick: () => { setKeyboardClicks((count) => count + 1); setSubmitted(false); }
        }, 'Keyboard Count'),
        e('button', { id: 'submit', disabled: !ok, type: 'submit' }, 'Submit'),
        e('div', { id: 'result', className: submitted && ok ? 'ok' : 'bad' },
          submitted && ok
            ? 'ok:' + name + ':' + alias + ':' + choice + ':' + speed + ':' + volume + ':' + bio.replace('\\n', '|') + ':' + replace + ':' + deleteProbe + ':' + pasteProbe + ':' + rich + ':portal:pointer:keyboard:' + buttonClicks + ':' + submitCount
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


FRAME_HTML = b"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Browser Lab React Iframe Smoke</title>
  <style>
    body { font-family: sans-serif; padding: 12px; margin: 0; }
    input { font-size: 18px; padding: 7px; width: 330px; }
    #frameResult { margin-top: 12px; font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <div id="frameRoot">loading frame react...</div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script>
    const e = React.createElement;
    function FrameApp() {
      const [value, setValue] = React.useState('');
      const [pasteCount, setPasteCount] = React.useState(0);
      const [composition, setComposition] = React.useState({ start: 0, update: 0, end: 0 });
      const compositionOk = composition.start >= 1 && composition.update >= 1 && composition.end >= 1;
      const ok = value === 'frame\\uD55C\\uAE00clip' && pasteCount === 1 && compositionOk;
      window.__browserLabFrameSmokeState = { value, pasteCount, composition, compositionOk, ok };
      return e('div', null,
        e('label', null, 'Frame Input ',
          e('input', {
            id: 'frameInput',
            value,
            onCompositionStart: () => setComposition((prev) => ({ ...prev, start: prev.start + 1 })),
            onCompositionUpdate: () => setComposition((prev) => ({ ...prev, update: prev.update + 1 })),
            onCompositionEnd: () => setComposition((prev) => ({ ...prev, end: prev.end + 1 })),
            onPaste: () => setPasteCount((count) => count + 1),
            onChange: (ev) => setValue(ev.target.value)
          })
        ),
        e('div', { id: 'frameResult' }, ok ? 'ok:frame:' + value : 'state:' + JSON.stringify(window.__browserLabFrameSmokeState))
      );
    }
    ReactDOM.createRoot(document.getElementById('frameRoot')).render(e(FrameApp));
  </script>
</body>
</html>
"""


class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        body = FIXTURE_HTML
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: Any) -> None:
        pass


class FrameHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(FRAME_HTML)))
        self.end_headers()
        self.wfile.write(FRAME_HTML)

    def log_message(self, *_args: Any) -> None:
        pass


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
        if predicate():
            return
        await asyncio.sleep(0.1)
    raise TimeoutError(label)


async def send_json(ws: websockets.ClientConnection, payload: Dict[str, Any]) -> None:
    await ws.send(json.dumps(payload, separators=(",", ":")))


async def click(ws: websockets.ClientConnection, x: int, y: int, modifiers: Dict[str, bool] | None = None) -> None:
    payload_modifiers = modifiers or {}
    await send_json(ws, {"type": "mouse", "event": "move", "x": x, "y": y, "modifiers": payload_modifiers})
    await asyncio.sleep(0.08)
    await send_json(
        ws,
        {"type": "mouse", "event": "down", "x": x, "y": y, "button": "left", "clickCount": 1, "modifiers": payload_modifiers},
    )
    await asyncio.sleep(0.05)
    await send_json(
        ws,
        {"type": "mouse", "event": "up", "x": x, "y": y, "button": "left", "clickCount": 1, "modifiers": payload_modifiers},
    )


async def click_selector(
    ws: websockets.ClientConnection,
    controller: Any,
    selector: str,
    modifiers: Dict[str, bool] | None = None,
) -> None:
    if not controller.page:
        raise RuntimeError("Browser page is not available")
    locator = controller.page.locator(selector)
    await locator.scroll_into_view_if_needed()
    box = await locator.bounding_box()
    if not box:
        raise RuntimeError(f"Element has no clickable box: {selector}")
    await click(ws, round(box["x"] + box["width"] / 2), round(box["y"] + box["height"] / 2), modifiers)


async def click_selector_at_fraction(
    ws: websockets.ClientConnection,
    controller: Any,
    selector: str,
    x_fraction: float,
) -> None:
    if not controller.page:
        raise RuntimeError("Browser page is not available")
    locator = controller.page.locator(selector)
    await locator.scroll_into_view_if_needed()
    box = await locator.bounding_box()
    if not box:
        raise RuntimeError(f"Element has no clickable box: {selector}")
    x = round(box["x"] + box["width"] * max(0.0, min(1.0, x_fraction)))
    y = round(box["y"] + box["height"] / 2)
    await click(ws, x, y)


def find_frame(controller: Any, path_suffix: str) -> Any:
    page = controller.page
    if not page:
        raise RuntimeError("Browser page is not available")
    for frame in page.frames:
        if frame.url.endswith(path_suffix):
            return frame
    raise RuntimeError(f"Frame not found: {path_suffix}")


async def click_frame_selector(
    ws: websockets.ClientConnection,
    controller: Any,
    frame_path: str,
    selector: str,
) -> None:
    if controller.page:
        await controller.page.locator("#reactFrame").scroll_into_view_if_needed()
    frame = find_frame(controller, frame_path)
    locator = frame.locator(selector)
    box = await locator.bounding_box()
    if not box:
        raise RuntimeError(f"Frame element has no clickable box: {frame_path} {selector}")
    await click(ws, round(box["x"] + box["width"] / 2), round(box["y"] + box["height"] / 2))


async def mouse_click_selector(
    ws: websockets.ClientConnection,
    controller: Any,
    selector: str,
    button: str,
    click_count: int = 1,
) -> None:
    x, y = await element_center(controller, selector)
    await send_json(ws, {"type": "mouse", "event": "move", "x": x, "y": y, "button": button, "clickCount": click_count})
    await asyncio.sleep(0.05)
    await send_json(ws, {"type": "mouse", "event": "down", "x": x, "y": y, "button": button, "clickCount": click_count})
    await asyncio.sleep(0.04)
    await send_json(ws, {"type": "mouse", "event": "up", "x": x, "y": y, "button": button, "clickCount": click_count})
    await asyncio.sleep(0.08)


async def double_click_selector(ws: websockets.ClientConnection, controller: Any, selector: str) -> None:
    await mouse_click_selector(ws, controller, selector, "left", 1)
    await mouse_click_selector(ws, controller, selector, "left", 2)


async def element_center(controller: Any, selector: str) -> tuple[int, int]:
    if not controller.page:
        raise RuntimeError("Browser page is not available")
    locator = controller.page.locator(selector)
    await locator.scroll_into_view_if_needed()
    box = await locator.bounding_box()
    if not box:
        raise RuntimeError(f"Element has no box: {selector}")
    return round(box["x"] + box["width"] / 2), round(box["y"] + box["height"] / 2)


async def move_selector(ws: websockets.ClientConnection, controller: Any, selector: str) -> None:
    x, y = await element_center(controller, selector)
    await send_json(ws, {"type": "mouse", "event": "move", "x": x, "y": y})
    await asyncio.sleep(0.12)


async def drag_selector(ws: websockets.ClientConnection, controller: Any, selector: str, delta_x: int, delta_y: int) -> None:
    x, y = await element_center(controller, selector)
    await send_json(ws, {"type": "mouse", "event": "move", "x": x, "y": y})
    await asyncio.sleep(0.05)
    await send_json(ws, {"type": "mouse", "event": "down", "x": x, "y": y, "button": "left", "clickCount": 1})
    for step in range(1, 5):
        await asyncio.sleep(0.05)
        await send_json(
            ws,
            {
                "type": "mouse",
                "event": "move",
                "x": x + round(delta_x * step / 4),
                "y": y + round(delta_y * step / 4),
                "button": "left",
            },
        )
    await asyncio.sleep(0.05)
    await send_json(
        ws,
        {
            "type": "mouse",
            "event": "up",
            "x": x + delta_x,
            "y": y + delta_y,
            "button": "left",
            "clickCount": 1,
        },
    )


async def press(ws: websockets.ClientConnection, key: str) -> None:
    await send_json(ws, {"type": "key", "event": "down", "key": key})
    await asyncio.sleep(0.04)
    await send_json(ws, {"type": "key", "event": "up", "key": key})
    await asyncio.sleep(0.08)


async def key_down(ws: websockets.ClientConnection, key: str) -> None:
    await send_json(ws, {"type": "key", "event": "down", "key": key})
    await asyncio.sleep(0.04)


async def key_up(ws: websockets.ClientConnection, key: str) -> None:
    await send_json(ws, {"type": "key", "event": "up", "key": key})
    await asyncio.sleep(0.04)


async def read_smoke_state(controller: Any) -> Dict[str, Any]:
    if not controller.page:
        return {}
    state = await controller.page.evaluate("window.__browserLabSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_smoke_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 10.0) -> Dict[str, Any]:
    started = time.monotonic()
    last_state: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last_state = await read_smoke_state(controller)
        if all(last_state.get(key) == value for key, value in expected.items()):
            return last_state
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last_state!r}")


async def read_frame_smoke_state(controller: Any) -> Dict[str, Any]:
    frame = find_frame(controller, "/frame")
    state = await frame.evaluate("window.__browserLabFrameSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_frame_smoke_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 10.0) -> Dict[str, Any]:
    started = time.monotonic()
    last_state: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last_state = await read_frame_smoke_state(controller)
        if all(last_state.get(key) == value for key, value in expected.items()):
            return last_state
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last_state!r}")


async def read_shadow_smoke_state(controller: Any) -> Dict[str, Any]:
    page = controller.page
    if not page:
        return {}
    state = await page.evaluate("window.__browserLabShadowSmokeState || null")
    return state if isinstance(state, dict) else {}


async def wait_for_shadow_smoke_state(controller: Any, expected: Dict[str, Any], label: str, timeout: float = 10.0) -> Dict[str, Any]:
    started = time.monotonic()
    last_state: Dict[str, Any] = {}
    while time.monotonic() - started < timeout:
        last_state = await read_shadow_smoke_state(controller)
        if all(last_state.get(key) == value for key, value in expected.items()):
            return last_state
        await asyncio.sleep(0.1)
    raise TimeoutError(f"{label}: expected {expected!r}, last state {last_state!r}")


async def run_smoke() -> None:
    configure_runtime()

    # Import after env setup so BrowserLab picks up /tmp-only test paths.
    from server import app, controller  # pylint: disable=import-error,import-outside-toplevel

    fixture_server = ThreadingHTTPServer((HOST, FIXTURE_PORT), FixtureHandler)
    frame_server = ThreadingHTTPServer((HOST, FRAME_PORT), FrameHandler)
    fixture_thread = threading.Thread(target=fixture_server.serve_forever, daemon=True)
    frame_thread = threading.Thread(target=frame_server.serve_forever, daemon=True)
    fixture_thread.start()
    frame_thread.start()

    config = uvicorn.Config(app, host=HOST, port=PROXY_PORT, log_level="warning")
    proxy_server = uvicorn.Server(config)
    proxy_task = asyncio.create_task(proxy_server.serve())

    status: Dict[str, Any] = {}
    frames = 0
    last_frame = ""
    logs: list[tuple[str, str]] = []

    try:
        await asyncio.sleep(0.5)
        async with websockets.connect(f"ws://{HOST}:{PROXY_PORT}/ws", max_size=30_000_000) as ws:
            async def reader() -> None:
                nonlocal status, frames, last_frame
                async for raw in ws:
                    msg = json.loads(raw)
                    msg_type = msg.get("type")
                    if msg_type == "status":
                        status = msg
                    elif msg_type == "log":
                        logs.append((str(msg.get("level")), str(msg.get("message"))))
                    elif msg_type == "frame":
                        frames += 1
                        last_frame = msg.get("data", "")

            reader_task = asyncio.create_task(reader())
            await wait_for(lambda: bool(status), "initial Browser Lab status")

            await send_json(ws, {"type": "resize", "width": 1000, "height": 1200, "deviceScaleFactor": 1})
            await send_json(ws, {"type": "stream_settings", "fps": 8, "quality": 75})
            await send_json(ws, {"type": "navigate", "url": f"http://{HOST}:{FIXTURE_PORT}/"})
            await wait_for(
                lambda: status.get("url", "").startswith(f"http://{HOST}:{FIXTURE_PORT}") and not status.get("loading"),
                "React fixture navigation",
                timeout=35,
            )
            await wait_for(
                lambda: bool(controller.page),
                "Browser page availability",
                timeout=10,
            )
            if not controller.page:
                raise RuntimeError("Browser page is not available")
            await controller.page.locator("#name").wait_for(state="visible", timeout=20_000)

            await click_selector(ws, controller, "#name")
            await send_json(ws, {"type": "key", "event": "type", "text": "reactx", "mode": "hybrid"})
            await press(ws, "Backspace")
            await wait_for_smoke_state(controller, {"name": "react", "beforeInputOk": True}, "controlled input with beforeinput and backspace")

            await click_selector(ws, controller, "#alias")
            await send_json(ws, {"type": "composition", "event": "start", "data": ""})
            await send_json(ws, {"type": "composition", "event": "update", "data": "\uD55C"})
            await send_json(ws, {"type": "key", "event": "type", "text": "\uD55C\uAE00", "mode": "hybrid"})
            await send_json(ws, {"type": "composition", "event": "end", "data": "\uD55C\uAE00"})
            await wait_for_smoke_state(
                controller,
                {"alias": "\uD55C\uAE00", "nameBlurCount": 1, "compositionOk": True},
                "controlled non-ASCII composition input and blur",
            )

            await click_selector(ws, controller, "#bio")
            await send_json(ws, {"type": "key", "event": "type", "text": "multi", "mode": "hybrid"})
            await press(ws, "Enter")
            await send_json(ws, {"type": "key", "event": "type", "text": "line", "mode": "hybrid"})
            await wait_for_smoke_state(controller, {"bio": "multi\nline"}, "controlled textarea with Enter")

            await click_selector(ws, controller, "#replace")
            await send_json(ws, {"type": "key", "event": "type", "text": "bad", "mode": "hybrid"})
            await key_down(ws, "Control")
            await press(ws, "A")
            await key_up(ws, "Control")
            await send_json(ws, {"type": "key", "event": "type", "text": "done", "mode": "hybrid"})
            await wait_for_smoke_state(controller, {"replace": "done"}, "controlled input Ctrl+A replacement")

            await click_selector(ws, controller, "#deleteProbe")
            await send_json(ws, {"type": "key", "event": "type", "text": "delx", "mode": "hybrid"})
            await press(ws, "ArrowLeft")
            await press(ws, "Delete")
            await wait_for_smoke_state(controller, {"deleteProbe": "del"}, "controlled input Delete editing")

            await click_selector(ws, controller, "#pasteProbe")
            await send_json(ws, {"type": "paste", "text": "clip"})
            await wait_for_smoke_state(controller, {"pasteOk": True}, "controlled input paste event")

            await click_selector(ws, controller, "#agree")
            await wait_for_smoke_state(controller, {"checked": True}, "controlled checkbox")

            await click_selector(ws, controller, "#choice")
            await press(ws, "ArrowDown")
            await press(ws, "Enter")
            await wait_for_smoke_state(controller, {"choice": "b"}, "controlled select")

            await click_selector(ws, controller, "#speedFast")
            await wait_for_smoke_state(controller, {"speed": "fast"}, "controlled radio")

            await click_selector_at_fraction(ws, controller, "#rangeProbe", 0.92)
            await wait_for_smoke_state(controller, {"rangeOk": True}, "controlled range slider")

            await click_selector(ws, controller, "#portalInput")
            await send_json(ws, {"type": "key", "event": "type", "text": "portal", "mode": "hybrid"})
            await click_selector(ws, controller, "#portalButton")
            await wait_for_smoke_state(controller, {"portalOk": True}, "React portal controlled input and click")

            await click_selector(ws, controller, "#rich")
            await send_json(ws, {"type": "key", "event": "type", "text": "notes", "mode": "hybrid"})
            await wait_for_smoke_state(controller, {"rich": "notes"}, "contenteditable input")

            await drag_selector(ws, controller, "#pointerPad", 140, 0)
            await wait_for_smoke_state(controller, {"pointerOk": True}, "React pointer drag")

            await move_selector(ws, controller, "#hoverPad")
            await move_selector(ws, controller, "#name")
            await wait_for_smoke_state(controller, {"hoverOk": True}, "React hover enter/move/leave")

            await click_selector(ws, controller, "#countButton")
            await wait_for_smoke_state(controller, {"buttonClicks": 1}, "React button click")

            await click_selector(ws, controller, "#shiftButton", {"shift": True})
            await wait_for_smoke_state(controller, {"modifierOk": True}, "React shift-click modifier")

            await double_click_selector(ws, controller, "#doubleButton")
            await wait_for_smoke_state(controller, {"doubleClicks": 1}, "React double-click")

            await mouse_click_selector(ws, controller, "#contextButton", "right")
            await wait_for_smoke_state(controller, {"clickGestureOk": True}, "React context menu")

            await click_selector(ws, controller, "#contextButton")
            await press(ws, "Tab")
            await press(ws, "Enter")
            await wait_for_smoke_state(controller, {"keyboardOk": True, "ok": True}, "React Tab focus and Enter activation")

            await click_selector(ws, controller, "#name")
            await press(ws, "Enter")
            await wait_for_smoke_state(controller, {"submitted": True, "submitCount": 1}, "form submit with Enter")

            await controller.page.frame_locator("#reactFrame").locator("#frameInput").wait_for(state="visible", timeout=20_000)
            await click_frame_selector(ws, controller, "/frame", "#frameInput")
            await send_json(ws, {"type": "key", "event": "type", "text": "frame", "mode": "hybrid"})
            await send_json(ws, {"type": "composition", "event": "start", "data": ""})
            await send_json(ws, {"type": "composition", "event": "update", "data": "\uD55C"})
            await send_json(ws, {"type": "key", "event": "type", "text": "\uD55C\uAE00", "mode": "hybrid"})
            await send_json(ws, {"type": "composition", "event": "end", "data": "\uD55C\uAE00"})
            await send_json(ws, {"type": "paste", "text": "clip"})
            await wait_for_frame_smoke_state(controller, {"ok": True}, "React iframe input/composition/paste")
            frame_result = find_frame(controller, "/frame").locator("#frameResult")
            iframe_result = await frame_result.inner_text()

            await controller.page.locator("#shadowInput").wait_for(state="visible", timeout=20_000)
            await click_selector(ws, controller, "#shadowInput")
            await send_json(ws, {"type": "key", "event": "type", "text": "shadow", "mode": "dom"})
            await send_json(ws, {"type": "composition", "event": "start", "data": ""})
            await send_json(ws, {"type": "composition", "event": "update", "data": "\uD55C"})
            await send_json(ws, {"type": "key", "event": "type", "text": "\uD55C\uAE00", "mode": "dom"})
            await send_json(ws, {"type": "composition", "event": "end", "data": "\uD55C\uAE00"})
            await send_json(ws, {"type": "paste", "text": "clip"})
            await wait_for_shadow_smoke_state(controller, {"ok": True}, "React Shadow DOM input/composition/paste")
            shadow_result = await controller.page.locator("#shadowResult").inner_text()

            result = await controller.page.locator("#result").inner_text() if controller.page else ""
            if last_frame:
                FRAME_PATH.write_bytes(base64.b64decode(last_frame))
            reader_task.cancel()

        expected_prefix = "ok:react:\uD55C\uAE00:b:fast:"
        expected_suffix = ":multi|line:done:del:clip:notes:portal:pointer:keyboard:1:1"
        if not (result.startswith(expected_prefix) and result.endswith(expected_suffix)):
            raise AssertionError(f"React smoke failed: expected prefix/suffix {expected_prefix!r}/{expected_suffix!r}, got {result!r}; logs={logs[-8:]}")
        expected_iframe = "ok:frame:frame\uD55C\uAE00clip"
        if iframe_result != expected_iframe:
            raise AssertionError(f"React iframe smoke failed: expected {expected_iframe!r}, got {iframe_result!r}")
        expected_shadow = "ok:shadow:shadow\uD55C\uAE00clip"
        if shadow_result != expected_shadow:
            raise AssertionError(f"React Shadow DOM smoke failed: expected {expected_shadow!r}, got {shadow_result!r}")
        if frames < 5:
            raise AssertionError(f"React smoke produced too few frames: {frames}")
        print(
            json.dumps(
                {
                    "ok": True,
                    "result": result,
                    "iframe_result": iframe_result,
                    "shadow_result": shadow_result,
                    "frames": frames,
                    "final_frame": str(FRAME_PATH),
                    "profile_dir": str(PROFILE_DIR),
                    "runtime_dir": str(RUNTIME_DIR),
                },
                indent=2,
            )
        )
    finally:
        proxy_server.should_exit = True
        await proxy_task
        fixture_server.shutdown()
        fixture_server.server_close()
        frame_server.shutdown()
        frame_server.server_close()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    asyncio.run(run_smoke())
