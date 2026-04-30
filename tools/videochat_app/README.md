# TG 9393 Overlay App

Electron wrapper for `http://127.0.0.1:9393/?control=1`.

Use it when OBS Browser Source is inconvenient or when the in-overlay link browser does not repaint correctly in OBS Browser Source. Run the normal 9393 server, open this app, then capture this app window with OBS Window Capture.

## Install

```powershell
cd tools/videochat_app
npm install
```

## Run

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
npm start -- --width=1920 --height=1080
```

The app opens in control mode by default. Window size, position, fullscreen, always-on-top, control mode, and hidden UI state are saved under the repo-local `data/` directory.

By default the app asks Chromium to keep rendering while the window is covered or backgrounded. This is meant to reduce frozen OBS Window Capture frames when another fullscreen program is active. Use `--allow-throttle` only if you want Electron/Chromium to use its normal background throttling behavior.

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
