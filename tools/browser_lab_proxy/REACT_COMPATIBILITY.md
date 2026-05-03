# Browser Lab React Compatibility Audit

This document maps the open-ended goal "make React-based apps work well" to
concrete Browser Lab evidence. It is a coverage guide, not a guarantee that
every real React site will accept automation, login risk checks, media policies,
or site-specific defenses.

## One-Command Gate

Run the complete local React compatibility gate:

```bash
/tmp/tg-browser-lab-venv/bin/python tools/browser_lab_proxy/run_react_smoke_suite.py
```

The suite keeps browser profiles, screenshots, cache, and runtime files under
`/tmp/tg-browser-lab-*`. It does not need existing user sessions or
repository-local browser profiles.

## Coverage Matrix

| Area | Evidence | What It Proves |
| --- | --- | --- |
| Python and JS syntax | `run_react_smoke_suite.py` compile step and `node --check static_videochat/browser_lab.js` | Browser Lab server/client code parses before runtime smoke tests begin. |
| Direct WebSocket React path | `react_smoke_test.py` | Server-side Playwright/CDP input forwarding updates React state without the static host page in the loop. |
| Full static-client canvas path | `react_client_smoke_test.py` | `browser_lab.html` canvas streaming, hidden text sink, WebSocket commands, coordinate mapping, and React state all work together. |
| React 18 controlled forms | `react_smoke_test.py`, `react_client_smoke_test.py` | Controlled input, textarea, select, checkbox, radio, range, contenteditable, reset, validation, and submit flows update React state. |
| React 19 ESM | `react19_smoke_test.py` | Modern ESM React 19 pages loaded from a CDN receive Browser Lab input and update state. |
| SSR hydration | `react_hydration_smoke_test.py` | Server-rendered markup hydrated with `hydrateRoot` under `StrictMode` accepts Browser Lab input after hydration. |
| Suspense and lazy rendering | `react_suspense_smoke_test.py` | Events still reach React delegated handlers after a Suspense fallback is replaced by a lazy form. |
| React 19 form actions | `react_action_state_smoke_test.py` | Function-valued form `action`, `useActionState`, `FormData`, async action updates, `useFormStatus().pending`, and `useOptimistic` are exercised. |
| IME and non-ASCII text | `react_smoke_test.py`, `react_client_smoke_test.py`, hydration/action/React 19 smokes | Korean composition and non-ASCII insertion reach React `onComposition*`, `onInput`, and controlled state. |
| Clipboard | `react_client_smoke_test.py` | Paste button, `Ctrl+V`, `Ctrl+C`, `Ctrl+X`, selected text, contenteditable, and React clipboard payload reads are covered for non-sensitive fields. |
| Pointer and mouse | `react_client_smoke_test.py` | Click, double-click, right-click, middle-click, drag, wheel, exact `button`/`buttons`, pointer metadata, pointer capture, and event ordering are covered. |
| Touch | `react_client_smoke_test.py` | Touch drag, `touchend.changedTouches`, and two-finger payloads are covered. |
| UI-library patterns | `react_client_smoke_test.py` | `onMouseDown.preventDefault()` combobox selection with focus retention, roving tabindex menus, `aria-activedescendant`, custom role buttons, and custom sliders are covered. |
| Portals, iframes, Shadow DOM | `react_smoke_test.py`, `react_client_smoke_test.py` | React portals, cross-origin local iframe input/composition/paste, and open Shadow DOM React roots are covered. |
| SPA navigation | `react_client_smoke_test.py` | `pushState`, `replaceState`, `popstate`, hash changes, and Browser Lab status URL updates are covered. |
| File input and dropzones | `react_client_smoke_test.py` | User-selected file upload and canvas file drop into a React dropzone are covered without arbitrary local file reads. |

## Latest Known Passing Results

The current local suite has passed with these representative result strings:

```text
ok:react:한글:b:fast:92:multi|line:done:del:clip:notes:portal:pointer:keyboard:1:1
ok:frame:frame한글clip
ok:shadow:shadow한글clip
ok:hydrate:hydrated한글:b:1:submitted
ok:react19:react19한글:b:1:submitted
ok:suspense:suspense한글:b:1:submitted
ok:actionstate:action한글:b:agree:pending:optimistic
```

The full static-client result is intentionally long because it acts as a compact
signature for many React controls and event paths. Rerun the suite rather than
copying the string by hand.

## What This Does Not Prove

- It does not prove every production React site will allow login or automation.
- It does not bypass site-side risk decisions such as X login API `code 399`.
- It does not prove closed Shadow DOM internals, proprietary widgets, DRM, or
  site-specific anti-bot checks.
- It does not replace a real failing URL/workflow. If a specific React site
  fails, add that scenario as a targeted smoke or fix.

## When To Add A New React Smoke

Add a new smoke when a real app exposes a distinct failure mode not already
covered by the matrix above. Keep runtime paths under `/tmp/tg-browser-lab-*`,
avoid reading user secrets or local sessions, and add the new test to
`run_react_smoke_suite.py` only after it is deterministic.
