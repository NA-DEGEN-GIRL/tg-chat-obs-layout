# Browser Lab Limitations

This prototype uses a real Chromium browser through Playwright, but the pixels
are transported as JPEG screenshots over WebSocket. It is much closer to a
remote BrowserView than an iframe or HTML rewrite proxy, but it is not yet an
unbounded embedded browser.

## Current Fidelity

Works in the first version:

- Real Chromium navigation and rendering.
- JavaScript, SPA routing, redirects, cookies, and persistent profile state.
- React/SPA `pushState`, `replaceState`, `popstate`, `hashchange`, and title
  changes are observed through a small injected status bridge so the lab URL and
  navigation state do not depend only on polling.
- Link clicks, form input, submit, Back, Forward, Reload, Stop.
- Mouse move, click, drag, wheel.
- React-style custom `onWheel` handlers on non-scroll elements and normal
  overflow-container scrolling are covered by the static client smoke test.
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
- Printable text insertion releases stale remote modifier keys first so a
  shortcut such as `Ctrl+Enter` cannot poison later typing if Chromium misses a
  modifier keyup.
- React-controlled range drags use a DOM value/event fallback when native CDP
  mouse drag does not move the Chromium slider thumb in headless mode.
- Clipboard copy/cut sends `Control+C`/`Control+X` to the remote browser and also bridges
  full and partial selected non-sensitive text back to the host page clipboard.
  Password, file, and hidden inputs are intentionally not bridged.
- File upload through focused or recently clicked `input[type=file]` is
  implemented by forwarding files selected in the Browser Lab side panel to
  Playwright `set_input_files`. The proxy does not read arbitrary local paths.
  File drop onto the streamed canvas is also implemented for React dropzones by
  recreating `DataTransfer.files` in the remote page. Directory drops are not
  implemented.
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
- On the current WSL environment, Windows Chrome was detected at
  `C:\Program Files\Google\Chrome\Application\chrome.exe`, but direct WSL
  execution was unavailable (`cmd.exe`/`powershell.exe` were not on PATH and
  launching the `.exe` returned `Exec format error`). Use
  `run_real_chrome.py --print-windows-command` and start Chrome from Windows
  Terminal, then attach with `--no-launch --cdp-url http://127.0.0.1:9222`.

React interaction retest:

- A local React 18 controlled-input page was served from `/tmp` and exercised
  through the WebSocket/canvas path.
- Verified controlled text input, React `onBeforeInput`,
  `beforeinput.preventDefault()` masking, Backspace editing,
  controlled textarea with Enter/newline, non-ASCII text insertion, `Ctrl+A`
  replacement, Delete editing, paste event handling through both the Paste
  button and `Ctrl+V`, React `clipboardData` payload reads in `onPaste`,
  checkbox state, select state, radio state,
  password/number/search/email/tel/url/date/time/datetime-local/month/week/color input types,
  label-driven focus, contenteditable input, React button `onClick`, input
  `onKeyDown`/`onKeyUp`/`onInput`/`onBlur`, `InputEvent.inputType`
  for insert/delete/paste, trusted native key/input/pointer/click events,
  pointer/mouse/focus/click event ordering,
  React capture-phase synthetic
  key/pointer/click events, React composition events, React pointer drag events
  with exact `PointerEvent.button`/`buttons` state and stable
  `pointerId`/`pointerType`/`isPrimary` metadata,
  React touch events including `touchend.changedTouches`, modifier mouse events, double-click, context menu/right-click,
  middle-click `onAuxClick`, Tab focus
  traversal, keyboard button activation by Enter and Space, Space insertion in
  text inputs, Space activation for custom switch-style controls,
  hover enter/move/leave, controlled range slider updates, custom combobox option selection through
  `onMouseDown.preventDefault()` with focus retention, keyboard-driven `aria-activedescendant` combobox selection,
  roving tabindex ARIA menu focus movement and item selection,
  and form submit by Enter through React state. Portal-rendered controlled
  inputs/buttons and menu/dialog-style portal controls with focus transfer,
  Escape close, outside pointer-down close, and portal dialog Tab/Shift+Tab
  focus trapping are covered as well.
- Copy and Cut now bridge selected non-sensitive text from the remote page to
  the host browser clipboard; the end-to-end client smoke verifies this through
  the Copy button, keyboard `Ctrl+C`, keyboard `Ctrl+X`, selected
  React-controlled text inputs, and contenteditable fields. Password, file, and
  hidden inputs are intentionally excluded from that bridge.
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
  remote React state, Backspace, `Ctrl+A` replacement, Shift+Arrow partial
  selection replacement, Shift+Arrow selected-range Backspace deletion,
  mouse-drag selection replacement in controlled inputs, double-click word
  selection replacement in controlled inputs, caret move plus Delete,
  native `Ctrl+Z` undo and `Ctrl+Y` redo reflected through React state,
  input-field Enter form submit, focus/blur validation, React
  `onBlur.relatedTarget` focus-transfer tracking, debounced async state,
  native required-field constraint validation with React `onInvalid`, valid
  resubmit through React `onSubmit`, password/number/search/email/tel/url input
  types, date/time/datetime-local/month/week native input values in default
  `React-safe` mode, color native input value through the Paste command,
  label-driven focus, React
  `onInput`, text `onKeyUp`, React `InputEvent.inputType` values for insert
  text, backward delete, and paste, React `nativeEvent.isTrusted` for
  key/input/pointer/click, pointer/mouse/focus/click event ordering, custom combobox `onMouseDown.preventDefault()` option
  selection with focus retention, `beforeinput.preventDefault()` masking, React form `onReset`
  controlled state reset, selected text copy/cut back to the host clipboard
  through button and keyboard shortcut paths,
  keyboard-driven
  `aria-activedescendant` combobox selection,
  roving tabindex ARIA menu keyboard focus movement and item selection,
  keyboard Space checkbox toggling and Arrow-key radio selection,
  keyboard `End` updates for React-controlled range inputs, React-controlled
  range drag fallback,
  capture-phase React synthetic key/pointer/click events, Paste button,
  `Ctrl+V` React `onPaste`, `clipboardData.getData('text/plain')` payload
  reads, selected-range `Ctrl+V` paste replacement,
  checkbox/select/radio/contenteditable controls, contenteditable IME
  composition, contenteditable selected-range replacement, contenteditable
  mouse-drag partial-selection replacement, contenteditable `Ctrl+V`/`Ctrl+X`
  clipboard events including contenteditable `clipboardData` payload reads,
  selected-file upload,
  selected-file drop into a React dropzone,
  pointer drag, pointer capture, wheel handling, hover enter/move/leave,
  React `onPointerEnter`/`onPointerMove`/`onPointerLeave`, React SPA `pushState`/`replaceState` URL/status
  updates, Browser Lab Back to React `popstate`, HashRouter-style `hashchange`,
  global `Ctrl+K`/`Escape` shortcuts, `event.code` plus legacy `keyCode`/`which`
  shortcuts with multiple modifiers, HTML5 `dragstart`/`dragenter`/`dragover`/`drop`/`dragend`, 75% scaled canvas
  coordinate mapping, custom React `onWheel`, overflow-container `onScroll`,
  virtualized-list wheel scrolling with React-rerendered row click handling,
  remote React `<canvas>` and SVG pointer coordinate mapping, remote React
  CSS-transformed button click coordinates,
  custom `role=slider` pointer drag and keyboard Home/End updates,
  pointer-driven React reorder/sort state changes,
  remote page wheel scrolling followed by a visible React button click without
  Playwright scroll correction, cross-origin iframe text/composition/paste, open Shadow DOM
  focus/composition/paste, touch drag with `touchend.changedTouches`,
  two-finger touch payloads, drag continuation after the host pointer leaves
  the Browser Lab canvas,
  textarea `Ctrl+Enter` shortcut handling,
  textarea `Shift+Enter` soft newline handling, Enter and Space keyboard button activation,
  custom `role=button` click/Enter/Space activation, portal menu/dialog-style focus transfer, Escape
  close, outside pointer-down close, portal dialog Tab/Shift+Tab focus trapping,
  middle-click `onAuxClick`, Shift-click modifier handling, Shift+Arrow
  partial-selection copy, Shift+Arrow partial-selection replacement, Shift+Arrow selected-range deletion,
  mouse-drag text-control selection replacement, and mouse-drag contenteditable
  partial-selection replacement, double-click text-control word replacement, and
  double-click contenteditable word replacement. That
  client-path result was
  `ok:react:\uD55C\uAE00:composition:multi|line:space:hello world:1:edit:keep:done:del:partialreplace:abcXYZ:partialdelete:abc:mousereplace:mouse:doublereplace:hello there:enter:enter:ctrlenter:1:send:shiftenter:1:soft|line:focusblur:focus:related:relatedSecond:debounce:query:validation:1:1:special:6:42:1:label:contact:1:5550100:https://example.test:datetime:2026-05-02:13:45:2026-05-02T13:45:2026-05:2026-W18:#336699:file:react_upload_fixture.txt:filedrop:react_drop_fixture.txt:input:input:keyup:25:inputtype:1:trusted:1:mask:MASK:undo:undo:reset:1:copy:2:partialcopy:1:cut:1:combo:Beta:keyboardcombo:Beta:rovingmenu:Export:capture:3:clip:pastekey:abcXYZ:pastedata:clipdata:controls:b:fast:notes:nativekeys:1:right:100:richclip:1:1:richclip:richime:\uD55C\uAE00:richreplace:abcXYZ:richmousereplace:1:richdoublereplace:hello there:spa:shortcut:1:dragdrop:scroll:virtual:Row 42:customslider:100:pagescroll:shadow:scaled:transform:range:92:dragrange:95:pointerreorder:BAC:rolebutton:3:portal:portalmenu:Save:portaltrap:1:canvasdraw:1:svgpointer:1:pointer:pointerbuttons:1:pointermeta:1:touchend:1:multitouch:1:edgedrag:1:capture:pointerhover:modifier:gestures:keyboard:1`
  with iframe result `ok:frame:frame\uD55C\uAE00clip`, and is captured as
  `tools/browser_lab_proxy/react_client_smoke_test.py`.
- A focused hydration-path smoke test now covers SSR markup that later hydrates
  through `ReactDOM.hydrateRoot` under `React.StrictMode`. It verifies a
  hydrated controlled input, composition events, checkbox, select, button
  click, and form submit through the static canvas client. The expected result
  is `ok:hydrate:hydrated\uD55C\uAE00:b:1:submitted`, captured as
  `tools/browser_lab_proxy/react_hydration_smoke_test.py`.
- A React 19 ESM smoke test now covers modern ESM/CDN-style React pages through
  the static canvas client path. It imports from `https://esm.sh/react@19`,
  verifies a controlled input, composition events, checkbox, select, button
  click, transition/deferred state, and form submit. The expected result is
  `ok:react19:react19\uD55C\uAE00:b:1:submitted`, captured as
  `tools/browser_lab_proxy/react19_smoke_test.py`.
- A React Suspense/lazy smoke test now covers delayed rendering after a
  fallback. It verifies that React's delegated event handling still works for a
  controlled form that appears after the initial page render. The expected
  result is `ok:suspense:suspense\uD55C\uAE00:b:1:submitted`, captured as
  `tools/browser_lab_proxy/react_suspense_smoke_test.py`.
- A React 19 `useActionState` smoke test now covers function-valued form
  actions. It verifies that Browser Lab input and submit events deliver
  `FormData` into a React action, that `useFormStatus().pending` becomes
  observable during the async submit, that `useOptimistic` receives the
  submitted value, and that action state updates after the async step. The
  expected result is
  `ok:actionstate:action\uD55C\uAE00:b:agree:pending:optimistic`, captured as
  `tools/browser_lab_proxy/react_action_state_smoke_test.py`.
- The React coverage can be rerun as one gate with
  `tools/browser_lab_proxy/run_react_smoke_suite.py`. That suite compiles the
  Browser Lab Python files, checks `browser_lab.js`, then runs the direct
  WebSocket smoke, full static-client smoke, hydration smoke, React 19 ESM
  smoke, Suspense/lazy smoke, and React 19 action-state smoke.
- `tools/browser_lab_proxy/REACT_COMPATIBILITY.md` maps each React
  compatibility area to the specific smoke file that covers it and calls out
  the cases that still require a real failing URL or workflow.

## Recommended Next Steps

1. Replace JPEG screenshot streaming with WebRTC video transport or a Chromium
   compositor capture path.
2. Add audio forwarding from Chromium to the static page.
3. Add a real tab model for new windows and popups.
4. Add permission prompt UI for camera, microphone, geolocation, notifications,
   and clipboard.
5. Add optional system Chrome profile import/export with explicit user consent.
6. Add a dedicated automated smoke test client for `/ws`.
