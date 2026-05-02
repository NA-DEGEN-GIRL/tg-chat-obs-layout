# Browser Lab Proxy

`Browser Lab Proxy` is a local sidecar server for `static_videochat/browser_lab.html`.
It does not integrate with the existing overlay, menu, widget, Electron app, or
the main 9393 server. The static page only opens a WebSocket to this sidecar,
receives JPEG frames from a real Chromium page, and forwards user input back to
that page.

## Architecture

- Static client: `http://127.0.0.1:9393/static/browser_lab.html`
- Sidecar server: FastAPI on `127.0.0.1:9494`
- Browser engine: Playwright persistent Chromium context
- Display path: Chromium screenshot to WebSocket JSON frame to canvas
- Input path: canvas mouse, wheel, keyboard, paste command to Playwright
- Runtime data: outside the repo by default

Default runtime paths:

- Profile/cookies/session: `/tmp/tg-browser-lab-profile`
- Downloads and runtime files: `/tmp/tg-browser-lab-runtime`
- Downloads: `/tmp/tg-browser-lab-runtime/downloads`

## Install

Use a venv outside the repository so generated dependency files do not land in
this repo:

```bash
uv venv /tmp/tg-browser-lab-venv
uv pip install --python /tmp/tg-browser-lab-venv/bin/python fastapi "uvicorn[standard]" playwright
/tmp/tg-browser-lab-venv/bin/python -m playwright install chromium
```

Optional: use system Chrome for better media codec coverage when it is installed:

```bash
export TG_BROWSER_LAB_CHANNEL=chrome
```

If Chrome is installed but Playwright cannot find its channel, point to the
binary explicitly:

```bash
export TG_BROWSER_LAB_EXECUTABLE_PATH=/path/to/google-chrome
```

Optional: force headless or headful mode:

```bash
export TG_BROWSER_LAB_HEADLESS=1
# or
export TG_BROWSER_LAB_HEADLESS=0
```

The server defaults to headful when `DISPLAY` or `WAYLAND_DISPLAY` exists, and
headless otherwise.

For `https://x.com/i/flow/login`, headful mode is closer to normal Chrome than
headless mode:

```bash
TG_BROWSER_LAB_HEADLESS=0 /tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/server.py --host 127.0.0.1 --port 9494
```

In local testing, X login rendered correctly in headful Chromium and the
username field accepted input. Pressing `Next` with a redacted test username
still returned X login API `HTTP 400` / code `399` before the password step.
That means the input and click reached X's onboarding API, but X rejected the
flow for the current Playwright-managed browser/profile/IP.

If the X login form accepts the username but `Next` does not move to the
password step, check the server/client debug logs. In local testing, bundled
Playwright Chromium reached X's login API but X returned `HTTP 400` with a
generic "Could not log you in now" response. That is a site-side login risk
decision, not a canvas click failure. The most realistic next attempt is to
attach Browser Lab to a normal user-launched Chrome instance:

```bash
# Terminal 1: launch Chrome yourself with a temporary remote-debugging profile.
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/tg-browser-lab-real-chrome-profile \
  --no-first-run

# Terminal 2: connect the sidecar to that Chrome.
TG_BROWSER_LAB_CDP_URL=http://127.0.0.1:9222 \
  /tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/server.py --host 127.0.0.1 --port 9494
```

Use a temporary Chrome profile unless you explicitly want the sidecar to access
an existing browser session. Browser Lab does not need your password; you type
credentials only into the remote browser surface.

The same flow is wrapped by a helper:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_real_chrome.py
```

If Chrome is not auto-detected:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_real_chrome.py \
  --chrome-bin /path/to/google-chrome
```

To inspect detected browser candidates:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_real_chrome.py --list-browsers
```

When using Windows Chrome from WSL, the helper converts the `/tmp` profile path
to a Windows path for `--user-data-dir`. If this shell cannot execute Windows
`.exe` files, launch Chrome from Windows manually with
`--remote-debugging-port=9222`, then run the helper with
`--no-launch --cdp-url http://127.0.0.1:9222`.

If Windows Chrome has trouble using a WSL UNC profile path, choose a
Windows-native temp profile path from WSL, for example:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_real_chrome.py \
  --print-windows-command \
  --profile-dir /mnt/c/Temp/tg-browser-lab-real-chrome-profile
```

To print the exact Windows Chrome command:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_real_chrome.py \
  --print-windows-command
```

The helper uses `/tmp/tg-browser-lab-real-chrome-profile` by default and starts
the Browser Lab proxy on `127.0.0.1:9494`.

If a Korean IME is active, `HangulMode`/`HanjaMode` key events are ignored by
the proxy because Playwright does not expose them as valid Chromium keyboard
keys. Actual composed text is forwarded separately through the static page's
hidden text sink.

## Run

Start the sidecar proxy:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/server.py --host 127.0.0.1 --port 9494
```

Start the existing 9393 app separately if it is not already running, then open:

```text
http://127.0.0.1:9393/static/browser_lab.html
```

The page also works if opened directly from disk, but the intended path is the
existing static server URL above.

## API

- `GET /health`
- `GET /status`
- `POST /browser/reset-profile`
- `WebSocket /ws`

Client to server WebSocket messages:

```json
{ "type": "navigate", "url": "https://example.com" }
{ "type": "back" }
{ "type": "forward" }
{ "type": "reload" }
{ "type": "stop" }
{ "type": "resize", "width": 1280, "height": 720, "deviceScaleFactor": 1 }
{ "type": "stream_settings", "fps": 8, "quality": 70 }
{ "type": "mouse", "event": "move", "x": 100, "y": 120 }
{ "type": "mouse", "event": "down", "x": 100, "y": 120, "button": "left" }
{ "type": "mouse", "event": "up", "x": 100, "y": 120, "button": "left" }
{ "type": "mouse", "event": "wheel", "x": 100, "y": 120, "deltaX": 0, "deltaY": 500 }
{ "type": "key", "event": "down", "key": "Control" }
{ "type": "key", "event": "press", "key": "Enter" }
{ "type": "key", "event": "type", "text": "pasted text" }
{ "type": "composition", "event": "start|update|end", "data": "composed text" }
{ "type": "paste", "text": "clipboard text" }
```

Server to client WebSocket messages:

```json
{ "type": "status", "url": "...", "title": "...", "loading": true }
{ "type": "frame", "mime": "image/jpeg", "data": "base64...", "seq": 1 }
{ "type": "log", "level": "info", "message": "..." }
{ "type": "metrics", "fps": 8, "latency_ms": 120 }
```

## Controls

The static UI includes:

- Address bar, Go, Back, Forward, Reload, Stop
- Current URL, title, loading state, navigation state, HTTP status
- Canvas viewport with mouse click, drag, wheel, keyboard, modifier key, and
  IME-safe text input
- Text input modes: `React-safe`, `Keyboard`, and `DOM fallback`
- FPS, capture timing, frame latency, ping latency
- Viewport width/height, JPEG quality, FPS, and scale controls
- Health and connection status
- Profile/runtime path display
- Clear profile button
- Debug log panel

`React-safe` is the default text mode. It uses browser keyboard events for
ASCII text and then emits conservative `input`/`change` events on the focused
remote element so React-controlled fields observe the update. `DOM fallback`
uses the element's native value setter plus `beforeinput`/`input`/`change`; use
it only when a site visibly accepts text but its React state does not update.
Typed text is not written to logs.

Local verification covered a React 18 form with controlled text input,
`onBeforeInput`, Backspace editing, non-ASCII text insertion, controlled
textarea with Enter/newline, `Ctrl+A` replacement, Delete editing, paste event
handling, checkbox, select, radio, contenteditable, React button `onClick`,
input `onKeyDown`/`onBlur`, and form submit by Enter. It also covers React
`onCompositionStart`/
`onCompositionUpdate`/`onCompositionEnd`, React `onPointerDown`/
`onPointerMove`/`onPointerUp` drag handling, modifier mouse events such as
Shift-click, double-click, context menu/right-click, and `onWheel`.
Hover-driven React UI is covered through `onMouseEnter`/`onMouseMove`/
`onMouseLeave`.
Keyboard focus traversal with Tab and button activation with Enter are covered
as well, along with React-controlled `input[type=range]` updates from clicking
the slider track and React portal-rendered inputs/buttons.
The direct WebSocket smoke also covers a React-controlled input inside a
cross-origin iframe, including composition and paste forwarding.
It also covers an open Shadow DOM React root, forcing the DOM fallback,
composition, and paste repair path to find the deep active element instead of
the shadow host.
Site-specific server risk decisions, such as X returning login API `HTTP 400`,
are still outside the input layer.

You can rerun the React interaction smoke test without touching the repo runtime
state:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/react_smoke_test.py
```

The test starts temporary local servers on `9495`, `9581`, and `9584`, uses
`/tmp/tg-browser-lab-profile-react-smoke`, and expects
`ok:react:\uD55C\uAE00:b:fast:<range>:multi|line:done:del:clip:notes:portal:pointer:keyboard:1:1`
plus iframe result `ok:frame:frame\uD55C\uAE00clip` and Shadow DOM result
`ok:shadow:shadow\uD55C\uAE00clip`.

To test the full static client path as well, including `browser_lab.html`, proxy
selection through `?proxy=...`, viewport resize from the UI, canvas coordinate
mapping, and the hidden text sink:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/react_client_smoke_test.py
```

That test starts temporary local servers on `9497`, `9582`, and `9583`, uses
`/tmp/tg-browser-lab-profile-react-client-smoke`, and expects
`ok:react:\uD55C\uAE00:composition:multi|line:clip:controls:b:fast:notes:spa:range:<range>:portal:pointer:modifier:gestures:keyboard:1`.
It covers the real static-client path, including canvas coordinate mapping,
hidden text-sink typing, paste, checkbox, select, radio, contenteditable,
React SPA `pushState` URL/status updates, Browser Lab Back to React `popstate`,
wheel, hover enter/move/leave, modifier clicks, double/right click, keyboard
focus traversal, and portal controls.

## Profile Reset

From the UI, press `Clear profile`, or call:

```bash
curl -X POST http://127.0.0.1:9494/browser/reset-profile
```

Manual cleanup while the server is stopped:

```bash
rm -rf /tmp/tg-browser-lab-profile /tmp/tg-browser-lab-runtime
```

The server refuses to delete runtime paths inside this repository. By default it
also refuses to reset non-`/tmp` paths unless
`TG_BROWSER_LAB_ALLOW_RESET_NON_TMP=1` is set.

## Security Model

This is a local experiment server, not a public browsing gateway.

- Bind to `127.0.0.1` by default.
- Do not expose port `9494` to untrusted networks.
- No generic HTTP fetch proxy is implemented.
- The server blocks `file://`, `chrome://`, `chrome-extension://`, `ftp://`,
  `data:`, `javascript:`, and similar non-web navigation schemes.
- The browser profile, cookies, cache, downloads, and runtime files default to
  `/tmp`, outside this repo.
- Debug logs do not print cookies, Authorization headers, or password values.
- The 9393 origin never executes remote site JavaScript; it only displays
  streamed pixels and forwards input.

For stricter navigation blocking of obvious private/local hosts, set:

```bash
export TG_BROWSER_LAB_BLOCK_PRIVATE_NAV=1
```

That mode blocks direct user navigation to `localhost`, `127.0.0.1`,
`0.0.0.0`, `169.254.x.x`, and RFC1918 IPv4 literals. It does not claim to be a
complete enterprise network egress policy.

## Smoke Test

After the server and static page are open:

1. Navigate to `https://example.com`.
2. Click the `More information...` link.
3. Navigate to `https://news.ycombinator.com`.
4. Use the search link or a story link, then Back/Forward.
5. Navigate to `https://youtube.com`.
6. Search for a video and try playback.

Expected first-version performance is roughly 4-12 FPS depending on viewport,
JPEG quality, CPU, and whether the page contains video.

## Verification

```bash
uv run python -m py_compile tools/browser_lab_proxy/server.py
uv run python -m py_compile tools/browser_lab_proxy/react_smoke_test.py
uv run python -m py_compile tools/browser_lab_proxy/react_client_smoke_test.py
uv run python -m py_compile tools/browser_lab_proxy/run_real_chrome.py
node --check static_videochat/browser_lab.js
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/react_smoke_test.py
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/react_client_smoke_test.py
git diff --check
git diff --name-only
```

Only new Browser Lab files should appear, plus any pre-existing unrelated local
changes that were already in the worktree.
