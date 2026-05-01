# TG 9393 Overlay App

Electron wrapper for `http://127.0.0.1:9393/?control=1`.

Use it when OBS Browser Source is inconvenient or when the in-overlay link browser does not repaint correctly in OBS Browser Source. Run the normal 9393 server, open this app, then capture this app window with OBS Window Capture.

## Install

```powershell
cd tools/videochat_app
npm install
```

## Run On Windows

```powershell
npm start
```

Options:

```powershell
npm start -- --url=http://127.0.0.1:9393/
npm start -- --viewer
npm start -- --control
npm start -- --hide-ui
npm start -- --always-on-top
npm start -- --allow-throttle
npm start -- --reset-window
npm start -- --data-dir=C:\Users\you\AppData\Roaming\tg-chat-obs-layout\videochat_app
npm start -- --width=1920 --height=1080
```

The app opens in control mode by default. Window size, position, fullscreen, always-on-top, control mode, hidden UI state, and Electron browser login cookies are saved in a stable app data directory. Development runs use the repo-local `data/` directory. Packaged Windows builds use `%APPDATA%\tg-chat-obs-layout\videochat_app` so rebuilding or replacing the portable exe does not reset login state. Set `TG_VIDEOCHAT_APP_DATA_DIR` or pass `--data-dir=...` to force a different shared data directory.

By default the app asks Chromium to keep rendering while the window is covered or backgrounded. This is meant to reduce frozen OBS Window Capture frames when another fullscreen program is active. Use `--allow-throttle` only if you want Electron/Chromium to use its normal background throttling behavior.

## Native Web Widget

The overlay still requires the local 9393 server. The Electron app is the Windows-native display shell that loads that server.

The `web` widget in the overlay uses an Electron `BrowserView`, so it only renders inside this app. The old iframe browser code is kept for fallback work, but its toolbar button is hidden. In Chrome or OBS Browser Source, native web browsing is excluded and the widget shows a fallback message. Use the Windows Electron app as the broadcast/capture surface when testing this widget.

Chat links open in this native web widget when the overlay is running inside Electron. YouTube search results stay inside the dedicated `youtube` widget, but the player area also uses the Electron browser profile so logged-in YouTube sessions and Premium can be reused after signing in once.

Widget controls:

- `go`: load the URL in the native browser view.
- `<` / `>` / `R`: back, forward, reload.
- `open`: open the current URL in the external default browser.
- `dev`: open DevTools for the native browser view.
- `debug`: show console/load logs inside the widget so errors can be copied from the overlay.
- `hide`: detach the native view without destroying the page.
- `x`: close and destroy the native view. The generic `web` widget also clears its URL so the next open starts blank.

Regular overlay changes under `static_videochat/` only need a page refresh. Rebuild the Windows app only when files under `tools/videochat_app/` change.

## Run From WSLg

WSLg can run the Linux Electron development window if the WSL environment exposes `DISPLAY` or `WAYLAND_DISPLAY`.

```bash
cd tools/videochat_app
npm install
npm run start:wslg
```

This uses the normal WSLg renderer path plus Electron's `--no-sandbox` switch. WSLg runs ignore the saved window position by default because WSLg can report odd virtual desktop coordinates after a window is closed. Set `TG_VIDEOCHAT_WSLG_KEEP_WINDOW=1` only if you explicitly want to reuse the saved WSLg position.

If the app starts but no usable window appears, try the fallback renderer:

```bash
npm run start:wslg:fallback
```

The fallback forces X11 plus SwiftShader WebGL. Use it only when the normal WSLg path fails; on some machines it can be worse than the native WSLg renderer.

This is useful for development while `videochat_overlay.py` runs in WSL2. It is not the recommended broadcast capture path, because Windows OBS captures a WSLg window through an extra compositor layer and repaint/window-capture behavior can differ from a native Windows window.

If you want a Linux unpacked app for WSLg testing:

```bash
npm run pack:linux
```

That output runs inside WSLg/Linux only; it is not a Windows executable.

Run the unpacked WSLg build directly:

```bash
TG_VIDEOCHAT_WSLG_PACKED=1 ./run-wslg.sh --url=http://127.0.0.1:9393/ --control
```

If the WSLg window still does not appear, treat it as a WSLg compositor issue and use the Windows-native Electron app for broadcast testing.

## Recommended Broadcast Setup

For broadcast use on Windows, keep the Electron app Windows-native and point it at the 9393 server, even if the Python server is running in WSL2:

```powershell
npm start -- --url=http://127.0.0.1:9393/ --control
```

If Windows cannot reach the WSL2 service through localhost, start `videochat_overlay.py` with `VIDEOCHAT_WEB_HOST=0.0.0.0` and use the WSL2 IP address in `--url`.

## Build Windows Portable EXE

```powershell
npm run build:win
```

The portable executable is written to `tools/videochat_app/dist/`. That directory is intentionally ignored by git.

Shortcuts:

- `F9`: toggle `?control=1`
- `F10`: hide/show overlay UI controls
- `F5`: reconnect 9393
- `Ctrl+R`: reload
- `Ctrl+Shift+R`: hard reload
- `F11`: fullscreen
- `Ctrl+Shift+T`: always on top
- `Ctrl+Shift+I`: DevTools
