# Browser Lab Limitations

This prototype uses a real Chromium browser through Playwright, but the pixels
are transported as JPEG screenshots over WebSocket. It is much closer to a
remote BrowserView than an iframe or HTML rewrite proxy, but it is not yet an
unbounded embedded browser.

## Current Fidelity

Works in the first version:

- Real Chromium navigation and rendering.
- JavaScript, SPA routing, redirects, cookies, and persistent profile state.
- Link clicks, form input, submit, Back, Forward, Reload, Stop.
- Mouse move, click, drag, wheel.
- Keyboard down/up/press through Playwright.
- Modifier keys when the canvas has focus.
- Basic paste by reading the local clipboard from the static page and inserting
  text into the remote page.
- `window.open` and `target=_blank` adoption as the active lab page.
- Download saving under `/tmp/tg-browser-lab-runtime/downloads`.

## Known Gaps

- No audio forwarding. Video may render, but audio is not streamed to the
  browser_lab page.
- No WebRTC media forwarding. Sites may render WebRTC UI, but camera/mic output
  is not bridged into the static page.
- Screenshot streaming is CPU-heavy and latency-sensitive. It is not equivalent
  to native compositor sharing.
- Text input uses a hidden static-page text sink for printable/composed text,
  then forwards it with Playwright `insert_text`. This avoids errors for IME
  toggle keys such as `HangulMode`, but full IME fidelity still depends on the
  host browser and OS composition behavior.
- React-controlled inputs are handled with a default `React-safe` text mode
  that uses keyboard events and a conservative `input`/`change` event repair.
  A `DOM fallback` mode is available for fields where the value is visible but
  the app state does not update. This improves React/SPA compatibility, but it
  cannot bypass server-side login risk checks or bot detection.
- Clipboard copy is only sent as `Control+C`; reading the remote Chromium
  clipboard back into the host page is not implemented.
- Drag-and-drop file upload is not implemented.
- Browser permission prompts are not surfaced as first-class UI.
- Multiple tabs are not modeled in the client UI. New pages are adopted into the
  same viewport.
- Device scale factor can be emulated with Chromium CDP, but the screenshot
  stream uses CSS pixel scale for input coordinate stability.
- DRM/EME playback is not expected to work with Playwright bundled Chromium.
- Playwright bundled Chromium may lack proprietary codecs. System Chrome
  (`TG_BROWSER_LAB_CHANNEL=chrome`) can improve media support.
- Some sites may detect automation, headless mode, missing codecs, or the
  unusual remote-control environment.

## YouTube-Specific Notes

YouTube is the hardest target in this prototype because it combines a large SPA,
bot/automation detection, media codecs, autoplay policy, DRM/EME paths, login
flows, and audio/video playback.

Likely outcomes:

- Main page load: expected to work when network and Google services are
  reachable.
- Search: expected to work through remote keyboard/mouse input.
- Video page navigation: expected to work as normal Chromium navigation.
- Video playback: may work visually for non-DRM videos if the selected Chromium
  has the required codec and the page accepts the session.
- Audio: not forwarded in this implementation.
- DRM/EME: not expected to work in Playwright bundled Chromium.
- Login: the flow can be attempted and cookies persist, but success depends on
  Google account risk checks, browser channel, headless/headful mode, and local
  environment.

Failure causes to check when playback does not work:

- Playwright bundled Chromium lacks the required codec.
- Site requires DRM/EME.
- Autoplay policy requires a user gesture.
- Google/YouTube flags automation or headless mode.
- Audio forwarding is not implemented.
- The browser process is running without a working display/audio stack.
- Network policy or DNS blocks YouTube subresources.

## WebRTC Notes

WebRTC pages can load in Chromium, but this prototype does not bridge local
camera, microphone, or remote audio/video tracks into the static 9393 page.
Screenshot streaming can show the rendered page surface, but it is not a media
transport. A real next step is WebRTC or WebCodecs streaming from the sidecar
browser process to the static page.

## Performance Notes

The UI exposes FPS, JPEG quality, viewport size, and scale because screenshot
streaming is the main bottleneck.

Typical tuning:

- Lower FPS to 4-8 for heavy SPAs or video sites.
- Lower JPEG quality to 50-70 for responsiveness.
- Use 1280x720 or smaller for first tests.
- Increase only after input latency is acceptable.

## Local Test Record

Test environment for this patch:

- Server: `tools/browser_lab_proxy/server.py` on `127.0.0.1:9494`.
- Browser: Playwright bundled Chromium in headless mode.
- Profile/runtime: `/tmp/tg-browser-lab-profile` and
  `/tmp/tg-browser-lab-runtime`.
- Viewport: `1280x720`.
- Stream tuning: mostly `4 FPS`, JPEG quality `60`; YouTube later reported
  roughly `7.5-7.9 FPS` after settings/status updates.

| URL | Load | Link click | Input | Scroll | Login attempt | Media playback | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://example.com` | Success, HTTP 200, title `Example Domain`. | Success: clicked `Learn more`, navigated to `https://www.iana.org/help/example-domains`. | Not applicable; page has no form. | Not meaningful; page is shorter than viewport. | Not applicable. | Not applicable. | Frame stream worked at about 4 FPS in the smoke test. |
| `https://news.ycombinator.com` | Success, HTTP 200, title `Hacker News`. | Success: clicked first story and navigated to the external story URL. | Partially tested through `/login`; first login page load worked, but repeated test hit HTTP 429. No credentials were used. | Wheel command was sent and frames continued; visual scroll was limited by the short top-page capture and repeated tests. | Credentialed login was not attempted. Later `/login` test returned HTTP 429 from HN. | Not applicable. | HN is otherwise a good low-complexity test for navigation and link input. |
| `https://youtube.com` | Success after redirect to `https://www.youtube.com/`, HTTP 200, title `YouTube`. | Success for visible Shorts result after search: navigated to `https://www.youtube.com/shorts/TXEgpKxBDiw`. | Success: clicked the search box, typed `openai`, pressed Enter, navigated to `/results?search_query=openai`. | Not separately measured; YouTube page rendered and frame stream continued. | Login button was visible; credentialed login was not attempted. | Playback was attempted by clicking the Shorts page. Title updated and frames continued, but audio is not forwarded and automated visual playback assertion was not implemented. | Headless bundled Chromium ran muted; codec/DRM/audio limitations still apply. |
| `https://x.com/i/flow/login` | Success in headless and Xvfb headful Chromium, HTTP 200, title `X. It’s what’s happening / X`. | Login modal controls were visible and clickable. | Success with a redacted test username in the phone/email/username field; screenshot confirmed the value before pressing `Next`. | Not applicable to the modal test. | Password step did not appear in Playwright-managed Chromium. X returned onboarding API `HTTP 400`, code `399`, before the password step. No password was used. | Not applicable. | This is not a canvas click/input failure: the request reached `https://api.x.com/1.1/onboarding/task.json`. The remaining path is real Chrome CDP mode with a user-launched Chrome profile. |

Additional X login retest:

- Bundled Playwright Chromium in headless mode and Xvfb headful mode both
  reached X's login API with a redacted test username, then received
  `HTTP 400` with code `399` and a generic "Could not log you in now" response
  after pressing `Next`.
- A pre-Next screenshot confirmed the username field contained the redacted
  test value, so the failing part is X's server-side onboarding decision,
  not missing text input.
- ASCII text input now uses Playwright `keyboard.type()` so React-controlled
  fields receive keydown/input/keyup-like events. This fixes the earlier
  `insert_text`-only weakness, but it does not override X's server-side login
  risk decision.
- For X, the practical next step is attaching to a normal user-launched Chrome
  instance through `TG_BROWSER_LAB_CDP_URL` or running with a real Chrome binary
  through `TG_BROWSER_LAB_EXECUTABLE_PATH`/`TG_BROWSER_LAB_CHANNEL=chrome`.
- `tools/browser_lab_proxy/run_real_chrome.py` wraps that Chrome/CDP workflow.
  This can reduce Playwright-managed browser differences, but it still cannot
  guarantee that X or any other site will accept a login attempt from a fresh
  temporary browser profile.

React interaction retest:

- A local React 18 controlled-input page was served from `/tmp` and exercised
  through the WebSocket/canvas path.
- Verified controlled text input, React `onBeforeInput`, Backspace editing,
  controlled textarea with Enter/newline, non-ASCII text insertion, `Ctrl+A`
  replacement, Delete editing, paste event handling, checkbox state, select
  state, radio state, contenteditable input, React button `onClick`, input
  `onKeyDown`/`onBlur`, React composition events, React pointer drag events,
  modifier mouse events, double-click, context menu/right-click, Tab focus
  traversal, keyboard button activation by Enter, hover enter/move/leave,
  controlled range slider updates, and form submit by Enter through React state. Portal-rendered
  controlled inputs and buttons are covered as well.
- Final visual result was
  `ok:react:\uD55C\uAE00:b:fast:96:multi|line:done:del:clip:notes:portal:pointer:keyboard:1:1`,
  confirming that the default `React-safe` mode updates React state for common
  form controls, pointer handlers, and keyboard focus flows.
- The same run also verified a React-controlled input inside a cross-origin
  iframe on another local port. That iframe result was
  `ok:frame:frame\uD55C\uAE00clip`, covering iframe text, composition, and paste
  forwarding.
- It also verified an open Shadow DOM React root. That result was
  `ok:shadow:shadow\uD55C\uAE00clip`, covering deep active-element lookup for
  DOM fallback, composition, and paste forwarding inside a shadow root.
- The same scenario is captured as `tools/browser_lab_proxy/react_smoke_test.py`
  for repeatable verification.
- A second end-to-end smoke test opens `browser_lab.html` in a host browser,
  selects the proxy through `?proxy=...`, applies viewport resize through the UI,
  clicks the streamed canvas, types through the hidden text sink, and verifies
  remote React state, checkbox/select/radio/contenteditable controls, pointer
  drag, wheel handling, hover enter/move/leave, React SPA `pushState` URL/status
  updates, Browser Lab Back to React `popstate`, and Shift-click modifier
  handling. That client-path result was
  `ok:react:\uD55C\uAE00:composition:multi|line:clip:controls:b:fast:notes:spa:range:100:portal:pointer:modifier:gestures:keyboard:1`
  and is captured as `tools/browser_lab_proxy/react_client_smoke_test.py`.

## Recommended Next Steps

1. Replace JPEG screenshot streaming with WebRTC video transport or a Chromium
   compositor capture path.
2. Add audio forwarding from Chromium to the static page.
3. Add a real tab model for new windows and popups.
4. Add permission prompt UI for camera, microphone, geolocation, notifications,
   and clipboard.
5. Add optional system Chrome profile import/export with explicit user consent.
6. Add a dedicated automated smoke test client for `/ws`.
