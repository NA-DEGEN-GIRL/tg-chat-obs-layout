const { app, BrowserWindow, Menu, powerSaveBlocker, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:9393/";
const WINDOW_STATE_FILE = path.join(REPO_ROOT, "data", "videochat_app_window.json");
const KEEP_RENDERING_DEFAULT = !process.argv.includes("--allow-throttle");

app.setPath("userData", path.join(REPO_ROOT, "data", "videochat_app_profile"));
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (KEEP_RENDERING_DEFAULT) {
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
  app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
}

let mainWindow = null;
let currentBaseUrl = DEFAULT_BASE_URL;
let controlMode = true;
let overlayUiHidden = false;
let keepRendering = KEEP_RENDERING_DEFAULT;
let saveWindowTimer = null;
let powerSaveBlockerId = null;

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `http://${raw}`;
}

function initializeMode() {
  const explicit = normalizeUrl(argValue("url"));
  if (explicit) currentBaseUrl = explicit;
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!explicit && positional) {
    const positionalUrl = normalizeUrl(positional);
    if (positionalUrl) currentBaseUrl = positionalUrl;
  }
  if (hasArg("viewer")) controlMode = false;
  if (hasArg("control")) controlMode = true;
  if (hasArg("hide-ui")) overlayUiHidden = true;
  if (hasArg("allow-throttle")) keepRendering = false;
}

function composeOverlayUrl() {
  const url = new URL(currentBaseUrl || DEFAULT_BASE_URL);
  if (controlMode) {
    url.searchParams.set("control", "1");
  } else {
    url.searchParams.delete("control");
  }
  return url.href;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[ch]));
}

function readWindowState() {
  if (hasArg("reset-window")) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch (_) {
    return {};
  }
}

function writeWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    fs.mkdirSync(path.dirname(WINDOW_STATE_FILE), { recursive: true });
    const bounds = mainWindow.getBounds();
    const state = {
      ...bounds,
      maximized: mainWindow.isMaximized(),
      fullscreen: mainWindow.isFullScreen(),
      alwaysOnTop: mainWindow.isAlwaysOnTop(),
      controlMode,
      overlayUiHidden,
    };
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

function scheduleWindowStateSave() {
  if (saveWindowTimer) clearTimeout(saveWindowTimer);
  saveWindowTimer = setTimeout(() => {
    saveWindowTimer = null;
    writeWindowState();
  }, 450);
}

function sameOverlayOrigin(rawUrl) {
  try {
    const target = new URL(rawUrl);
    if (target.protocol === "data:" || target.protocol === "about:") return true;
    const base = new URL(composeOverlayUrl());
    return target.protocol === base.protocol && target.host === base.host;
  } catch (_) {
    return false;
  }
}

function startKeepRenderingGuards() {
  if (!keepRendering || powerSaveBlockerId !== null) return;
  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
}

function stopKeepRenderingGuards() {
  if (powerSaveBlockerId === null) return;
  try {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
    }
  } catch (_) {}
  powerSaveBlockerId = null;
}

function unavailableHtml(targetUrl) {
  const escaped = escapeHtml(targetUrl);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>9393 unavailable</title>
  <style>
    html, body { margin: 0; height: 100%; background: #07111f; color: #f4f7fb; font: 16px/1.55 system-ui, "Segoe UI", sans-serif; }
    body { display: grid; place-items: center; }
    main { width: min(720px, calc(100vw - 40px)); border: 1px solid rgba(255, 220, 120, .24); border-radius: 16px; padding: 24px; background: rgba(12, 19, 31, .92); box-shadow: 0 22px 70px rgba(0,0,0,.38); }
    h1 { margin: 0 0 10px; font-size: 24px; }
    code { color: #ffe08a; word-break: break-all; }
    button { margin-top: 18px; border: 1px solid rgba(255, 220, 120, .4); border-radius: 10px; background: rgba(255, 220, 120, .16); color: #fff2bd; font-weight: 850; padding: 10px 14px; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>9393 server is not available</h1>
    <p>Start <code>videochat_overlay.py</code> first, then reconnect.</p>
    <p>Target: <code>${escaped}</code></p>
    <button onclick="location.href='${escaped}'">Reconnect</button>
  </main>
</body>
</html>`;
}

async function injectToolbar() {
  if (!mainWindow) return;
  try {
    await mainWindow.webContents.insertCSS(`
      body.tg-app-ui-hidden #topic-controls,
      body.tg-app-ui-hidden #avatar-controls,
      body.tg-app-ui-hidden #chat-controls,
      body.tg-app-ui-hidden #chat-send-panel,
      body.tg-app-ui-hidden .effect-control,
      body.tg-app-ui-hidden .topic-resize-handle,
      body.tg-app-ui-hidden .toast-resize-handle {
        display: none !important;
      }
      #tg-app-toolbar {
        position: fixed;
        right: 12px;
        top: 12px;
        z-index: 2147483647;
        display: flex;
        gap: 6px;
        padding: 7px;
        border: 1px solid rgba(255, 224, 130, .24);
        border-radius: 999px;
        background: rgba(5, 10, 18, .72);
        color: #fff4c0;
        box-shadow: 0 14px 38px rgba(0,0,0,.32);
        backdrop-filter: blur(8px);
        font: 800 12px/1 system-ui, "Segoe UI", sans-serif;
      }
      #tg-app-toolbar button {
        height: 28px;
        min-width: 34px;
        border: 1px solid rgba(255, 224, 130, .3);
        border-radius: 999px;
        background: rgba(255, 224, 130, .12);
        color: #fff4c0;
        font: inherit;
        cursor: pointer;
      }
      #tg-app-toolbar button.active {
        background: rgba(255, 224, 130, .42);
        color: #181100;
      }
    `);
    await mainWindow.webContents.executeJavaScript(`
      (() => {
        let toolbar = document.getElementById("tg-app-toolbar");
        if (!toolbar) {
          toolbar = document.createElement("div");
          toolbar.id = "tg-app-toolbar";
          toolbar.innerHTML = '<button id="tg-app-toggle-ui" type="button" title="hide/show overlay UI">UI</button><button id="tg-app-reload" type="button" title="reload">R</button>';
          document.body.appendChild(toolbar);
          document.getElementById("tg-app-toggle-ui").addEventListener("click", () => {
            document.body.classList.toggle("tg-app-ui-hidden");
            document.getElementById("tg-app-toggle-ui").classList.toggle("active", document.body.classList.contains("tg-app-ui-hidden"));
          });
          document.getElementById("tg-app-reload").addEventListener("click", () => location.reload());
        }
        document.body.classList.toggle("tg-app-ui-hidden", ${overlayUiHidden ? "true" : "false"});
        document.getElementById("tg-app-toggle-ui")?.classList.toggle("active", document.body.classList.contains("tg-app-ui-hidden"));
      })();
    `);
  } catch (_) {}
}

async function loadOverlay() {
  if (!mainWindow) return;
  const targetUrl = composeOverlayUrl();
  try {
    await mainWindow.loadURL(targetUrl);
  } catch (_) {
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(unavailableHtml(targetUrl))}`);
  }
}

function createMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Overlay",
      submenu: [
        {
          label: "Toggle Control Mode",
          accelerator: "F9",
          click: () => {
            controlMode = !controlMode;
            loadOverlay();
          },
        },
        {
          label: "Toggle UI Hidden",
          accelerator: "F10",
          click: async () => {
            overlayUiHidden = !overlayUiHidden;
            await injectToolbar();
            await mainWindow?.webContents.executeJavaScript(`document.body.classList.toggle("tg-app-ui-hidden", ${overlayUiHidden ? "true" : "false"});`);
          },
        },
        { label: "Reconnect 9393", accelerator: "F5", click: () => loadOverlay() },
        { type: "separator" },
        { label: "Reload", accelerator: "CommandOrControl+R", click: () => mainWindow?.reload() },
        { label: "Hard Reload", accelerator: "CommandOrControl+Shift+R", click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { label: "DevTools", accelerator: "CommandOrControl+Shift+I", click: () => mainWindow?.webContents.openDevTools({ mode: "detach" }) },
      ],
    },
    {
      label: "Window",
      submenu: [
        { label: "Fullscreen", accelerator: "F11", click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { label: "Always On Top", accelerator: "CommandOrControl+Shift+T", click: () => mainWindow?.setAlwaysOnTop(!mainWindow.isAlwaysOnTop(), "screen-saver") },
        { label: "Open Current URL Externally", click: () => shell.openExternal(mainWindow?.webContents.getURL() || composeOverlayUrl()) },
      ],
    },
  ]);
}

function createWindow() {
  initializeMode();
  startKeepRenderingGuards();
  const saved = readWindowState();
  if (!hasArg("viewer") && !hasArg("control") && typeof saved.controlMode === "boolean") {
    controlMode = saved.controlMode;
  }
  if (!hasArg("hide-ui") && typeof saved.overlayUiHidden === "boolean") {
    overlayUiHidden = saved.overlayUiHidden;
  }
  const width = Number(argValue("width")) || Number(saved.width) || 1600;
  const height = Number(argValue("height")) || Number(saved.height) || 900;
  const x = Number.isFinite(Number(saved.x)) ? Number(saved.x) : undefined;
  const y = Number.isFinite(Number(saved.y)) ? Number(saved.y) : undefined;
  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 960,
    minHeight: 540,
    title: "TG 9393 Overlay App",
    backgroundColor: "#07111f",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !keepRendering,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (sameOverlayOrigin(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  mainWindow.webContents.on("did-finish-load", injectToolbar);
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("maximize", scheduleWindowStateSave);
  mainWindow.on("unmaximize", scheduleWindowStateSave);
  mainWindow.on("enter-full-screen", scheduleWindowStateSave);
  mainWindow.on("leave-full-screen", scheduleWindowStateSave);
  mainWindow.on("always-on-top-changed", scheduleWindowStateSave);
  mainWindow.on("close", writeWindowState);
  Menu.setApplicationMenu(createMenu());
  if (saved.maximized && !hasArg("reset-window")) mainWindow.maximize();
  if (saved.fullscreen && !hasArg("reset-window")) mainWindow.setFullScreen(true);
  if (hasArg("always-on-top") || (saved.alwaysOnTop && !hasArg("reset-window"))) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  }
  loadOverlay();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopKeepRenderingGuards);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
