const { app, BrowserView, BrowserWindow, Menu, ipcMain, powerSaveBlocker, shell } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BASE_URL = "http://127.0.0.1:9393/";
const KEEP_RENDERING_DEFAULT = !process.argv.includes("--allow-throttle");

function earlyArgValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function platformAppDataDir() {
  if (process.platform === "win32" && process.env.APPDATA) return process.env.APPDATA;
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  return path.join(os.homedir(), ".config");
}

function resolveAppDataRoot() {
  const explicit = earlyArgValue("data-dir") || process.env.TG_VIDEOCHAT_APP_DATA_DIR || "";
  if (explicit.trim()) return path.resolve(explicit.trim());
  if (app.isPackaged) {
    return path.join(platformAppDataDir(), "tg-chat-obs-layout", "videochat_app");
  }
  return path.join(REPO_ROOT, "data");
}

function copyIfMissing(source, target) {
  try {
    if (!source || !target || source === target) return;
    if (!fs.existsSync(source) || fs.existsSync(target)) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  } catch (_) {}
}

const LEGACY_APP_DATA_ROOT = path.join(REPO_ROOT, "data");
const APP_DATA_ROOT = resolveAppDataRoot();
const USER_DATA_DIR = path.join(APP_DATA_ROOT, "profile");
const WINDOW_STATE_FILE = path.join(APP_DATA_ROOT, "videochat_app_window.json");

copyIfMissing(path.join(LEGACY_APP_DATA_ROOT, "videochat_app_profile"), USER_DATA_DIR);
copyIfMissing(path.join(LEGACY_APP_DATA_ROOT, "videochat_app_window.json"), WINDOW_STATE_FILE);
fs.mkdirSync(USER_DATA_DIR, { recursive: true });
app.setPath("userData", USER_DATA_DIR);
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
const browserViews = new Map();
let browserPermissionHandlerReady = false;

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function numericArg(name) {
  const raw = argValue(name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function isWslgRuntime() {
  return process.platform === "linux" && !!process.env.WSL_DISTRO_NAME;
}

function useWindowState() {
  return !isWslgRuntime() || hasArg("keep-window-state");
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
  if (!useWindowState()) return {};
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
  if (!useWindowState()) return;
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

function sendBrowserEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send("electron-browser:event", payload);
  } catch (_) {}
}

function normalizeBrowserId(value) {
  const id = String(value || "web").trim().toLowerCase();
  return id === "youtube" ? "youtube" : "web";
}

function browserIdFromPayload(payload) {
  if (typeof payload === "string") return normalizeBrowserId(payload);
  return normalizeBrowserId(payload?.id);
}

function getBrowserEntry(rawId = "web") {
  const id = normalizeBrowserId(rawId);
  const entry = browserViews.get(id);
  if (!entry) return null;
  if (!entry.view || entry.view.webContents.isDestroyed()) {
    browserViews.delete(id);
    return null;
  }
  return entry;
}

function sendBrowserLog(rawId, level, message, extra = {}) {
  const id = normalizeBrowserId(rawId);
  sendBrowserEvent({
    type: "log",
    id,
    level,
    message: String(message || ""),
    ...extra,
  });
}

function sendBrowserStatus(rawId, extra = {}) {
  const id = normalizeBrowserId(rawId);
  const entry = getBrowserEntry(id);
  if (!entry) return;
  const wc = entry.view.webContents;
  sendBrowserEvent({
    type: "status",
    id,
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    loading: wc.isLoading(),
    ...extra,
  });
}

function isOverlayIpc(event) {
  return !!mainWindow && event.sender === mainWindow.webContents;
}

function sanitizeBrowserBounds(bounds) {
  const source = bounds && typeof bounds === "object" ? bounds : {};
  const content = mainWindow?.getContentBounds() || { width: 1600, height: 900 };
  const x = Math.max(0, Math.round(Number(source.x) || 0));
  const y = Math.max(0, Math.round(Number(source.y) || 0));
  const width = Math.max(1, Math.round(Number(source.width) || 1));
  const height = Math.max(1, Math.round(Number(source.height) || 1));
  return {
    x: Math.min(x, Math.max(0, content.width - 1)),
    y: Math.min(y, Math.max(0, content.height - 1)),
    width: Math.min(width, Math.max(1, content.width - x)),
    height: Math.min(height, Math.max(1, content.height - y)),
  };
}

function configureBrowserSession(view) {
  if (browserPermissionHandlerReady) return;
  browserPermissionHandlerReady = true;
  view.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["clipboard-read", "media", "fullscreen", "display-capture"].includes(permission));
  });
}

function handleBrowserConsole(rawId, _event, levelOrDetails, message, line, sourceId) {
  const id = normalizeBrowserId(rawId);
  const details = typeof levelOrDetails === "object" && levelOrDetails
    ? levelOrDetails
    : { level: levelOrDetails, message, lineNumber: line, sourceId };
  const levels = ["verbose", "info", "warning", "error"];
  const level = typeof details.level === "number" ? levels[details.level] || String(details.level) : String(details.level || "info");
  sendBrowserLog(id, level, details.message || "", {
    source: details.sourceId || details.source || "",
    line: Number(details.lineNumber || details.line || 0) || 0,
  });
}

function ensureBrowserView(rawId = "web") {
  const id = normalizeBrowserId(rawId);
  const current = getBrowserEntry(id);
  if (current) return current;
  const view = new BrowserView({
    webPreferences: {
      partition: "persist:tg-native-browser",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !keepRendering,
    },
  });
  const entry = { id, view, attached: false };
  browserViews.set(id, entry);
  configureBrowserSession(view);
  const wc = view.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      wc.loadURL(url).catch((exc) => sendBrowserLog(id, "error", `popup navigation failed: ${exc.message || exc}`));
    }
    return { action: "deny" };
  });
  wc.on("console-message", (...args) => handleBrowserConsole(id, ...args));
  wc.on("did-start-loading", () => sendBrowserStatus(id, { loading: true }));
  wc.on("did-stop-loading", () => sendBrowserStatus(id, { loading: false }));
  wc.on("page-title-updated", (_event, title) => sendBrowserStatus(id, { title }));
  wc.on("did-navigate", () => sendBrowserStatus(id));
  wc.on("did-navigate-in-page", () => sendBrowserStatus(id));
  wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      sendBrowserLog(id, "error", `load failed ${errorCode}: ${errorDescription}`, { source: validatedURL || "" });
      sendBrowserStatus(id, { loading: false, url: validatedURL || wc.getURL() });
    }
  });
  return entry;
}

function attachBrowserView(rawId = "web") {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const entry = ensureBrowserView(rawId);
  if (!entry) return null;
  if (!entry.attached) {
    mainWindow.addBrowserView(entry.view);
    entry.attached = true;
  }
  if (typeof mainWindow.setTopBrowserView === "function") {
    mainWindow.setTopBrowserView(entry.view);
  }
  return entry;
}

function pauseBrowserMedia(rawId = "web") {
  const entry = getBrowserEntry(rawId);
  if (!entry) return;
  entry.view.webContents.executeJavaScript(
    "window.postMessage({ type: 'tg-youtube-command', command: 'pauseVideo', args: [] }, '*'); document.querySelectorAll('video,audio').forEach((el) => { try { el.pause(); } catch (_) {} });",
    true,
  ).catch(() => {});
}

function detachBrowserView(rawId = "web", destroy = false) {
  const id = normalizeBrowserId(rawId);
  const entry = getBrowserEntry(id);
  if (!entry) return;
  if (mainWindow && entry.attached) {
    try {
      mainWindow.removeBrowserView(entry.view);
    } catch (_) {}
  }
  entry.attached = false;
  if (!destroy) return;
  try {
    if (!entry.view.webContents.isDestroyed()) {
      if (typeof entry.view.webContents.destroy === "function") entry.view.webContents.destroy();
      else entry.view.webContents.close();
    }
  } catch (_) {}
  browserViews.delete(id);
}

function detachAllBrowserViews(destroy = false) {
  for (const id of Array.from(browserViews.keys())) {
    detachBrowserView(id, destroy);
  }
}

function updateBrowserView(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const id = browserIdFromPayload(payload);
  if (!payload || payload.visible === false) {
    if (payload?.pause) pauseBrowserMedia(id);
    detachBrowserView(id, false);
    return;
  }
  const targetUrl = normalizeUrl(payload.url);
  if (!targetUrl) return;
  const entry = attachBrowserView(id);
  if (!entry) return;
  const view = entry.view;
  view.setBounds(sanitizeBrowserBounds(payload.bounds));
  view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
  if (view.webContents.getURL() !== targetUrl) {
    view.webContents.loadURL(targetUrl).catch((exc) => {
      sendBrowserLog(id, "error", `load failed: ${exc.message || exc}`, { source: targetUrl });
      sendBrowserStatus(id, { loading: false, url: targetUrl });
    });
  } else {
    sendBrowserStatus(id);
  }
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
      body.tg-app-ui-hidden .effect-control,
      body.tg-app-ui-hidden .topic-resize-handle,
      body.tg-app-ui-hidden .toast-resize-handle {
        display: none !important;
      }
      body.tg-app-ui-hidden #chat-panel:not(.chat-hidden) #chat-send-panel:not([hidden]) {
        display: flex !important;
        opacity: 0;
        transform: translateY(14px);
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      body.tg-app-ui-hidden #chat-panel:not(.chat-hidden):hover #chat-send-panel:not([hidden]),
      body.tg-app-ui-hidden #chat-panel:not(.chat-hidden) #chat-send-panel:not([hidden]):focus-within {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #app-settings-toggle {
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
        const settingsKey = "videochat.appSettingsOpen.v1";
        const toolbarHtml = '<button id="tg-app-toggle-ui" type="button" title="hide/show overlay UI">UI</button><button id="tg-app-reload" type="button" title="reload">R</button><button id="tg-app-settings" type="button" title="settings">⚙</button>';
        if (!toolbar) {
          toolbar = document.createElement("div");
          toolbar.id = "tg-app-toolbar";
          document.body.appendChild(toolbar);
        }
        toolbar.innerHTML = toolbarHtml;
        const bindOnce = (id, handler) => {
          const button = document.getElementById(id);
          if (!button || button.dataset.tgAppBound === "1") return;
          button.dataset.tgAppBound = "1";
          button.addEventListener("click", handler);
        };
        bindOnce("tg-app-toggle-ui", () => {
            document.body.classList.toggle("tg-app-ui-hidden");
            document.getElementById("tg-app-toggle-ui").classList.toggle("active", document.body.classList.contains("tg-app-ui-hidden"));
        });
        bindOnce("tg-app-settings", () => {
            const next = !document.body.classList.contains("app-settings-open");
            document.body.classList.toggle("app-settings-open", next);
            document.getElementById("tg-app-settings").classList.toggle("active", next);
            try { localStorage.setItem(settingsKey, next ? "1" : "0"); } catch (_) {}
        });
        bindOnce("tg-app-reload", () => location.reload());
        document.body.classList.toggle("tg-app-ui-hidden", ${overlayUiHidden ? "true" : "false"});
        try { document.body.classList.toggle("app-settings-open", localStorage.getItem(settingsKey) === "1"); } catch (_) {}
        document.getElementById("tg-app-toggle-ui")?.classList.toggle("active", document.body.classList.contains("tg-app-ui-hidden"));
        document.getElementById("tg-app-settings")?.classList.toggle("active", document.body.classList.contains("app-settings-open"));
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

ipcMain.on("electron-browser:upsert", (event, payload) => {
  if (!isOverlayIpc(event)) return;
  updateBrowserView(payload || {});
});

ipcMain.on("electron-browser:close", (event, payload) => {
  if (!isOverlayIpc(event)) return;
  detachBrowserView(browserIdFromPayload(payload), true);
});

ipcMain.on("electron-browser:back", (event, payload) => {
  const entry = getBrowserEntry(browserIdFromPayload(payload));
  if (!isOverlayIpc(event) || !entry) return;
  if (entry.view.webContents.canGoBack()) entry.view.webContents.goBack();
});

ipcMain.on("electron-browser:forward", (event, payload) => {
  const entry = getBrowserEntry(browserIdFromPayload(payload));
  if (!isOverlayIpc(event) || !entry) return;
  if (entry.view.webContents.canGoForward()) entry.view.webContents.goForward();
});

ipcMain.on("electron-browser:reload", (event, payload) => {
  const entry = getBrowserEntry(browserIdFromPayload(payload));
  if (!isOverlayIpc(event) || !entry) return;
  entry.view.webContents.reload();
});

ipcMain.on("electron-browser:devtools", (event, payload) => {
  const entry = getBrowserEntry(browserIdFromPayload(payload));
  if (!isOverlayIpc(event) || !entry) return;
  entry.view.webContents.openDevTools({ mode: "detach" });
});

ipcMain.on("electron-browser:open-external", (event, url) => {
  if (!isOverlayIpc(event)) return;
  const targetUrl = normalizeUrl(url);
  if (/^https?:\/\//i.test(targetUrl)) shell.openExternal(targetUrl);
});

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
  const argX = numericArg("x");
  const argY = numericArg("y");
  const x = argX ?? (Number.isFinite(Number(saved.x)) ? Number(saved.x) : undefined);
  const y = argY ?? (Number.isFinite(Number(saved.y)) ? Number(saved.y) : undefined);
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
      preload: path.join(__dirname, "preload.js"),
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
  mainWindow.webContents.on("did-start-loading", () => detachAllBrowserViews(false));
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

app.on("before-quit", () => {
  detachAllBrowserViews(true);
  stopKeepRenderingGuards();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
