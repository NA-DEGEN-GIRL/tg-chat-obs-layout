const { app, BrowserView, BrowserWindow, Menu, ipcMain, powerSaveBlocker, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
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
const LOG_FILE = path.join(APP_DATA_ROOT, "videochat_app.log");

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
let userFullscreenMode = false;
let saveWindowTimer = null;
let powerSaveBlockerId = null;
let showingUnavailable = false;
const browserViews = new Map();
let browserPermissionHandlerReady = false;
let nativeChatWindow = null;
let nativeChatVisible = false;
let nativeChatContentBounds = null;
let nativeChatCssInjected = false;
let nativeChatLoadedTarget = "";
let nativeChatMouseInteractive = false;
let nativeChatActionState = null;
let nativeChatRaiseTimer = null;
let nativeChatForceRaiseTimer = null;
let nativeChatMouseTimer = null;
let lastResizeDebugLogAt = 0;

function appLog(message, extra = {}) {
  try {
    fs.mkdirSync(APP_DATA_ROOT, { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({
        ts: new Date().toISOString(),
        message: String(message || ""),
        ...extra,
      }) + "\n",
      "utf8",
    );
  } catch (_) {}
}

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

function composeChatUrl() {
  const explicit = normalizeUrl(argValue("chat-url") || process.env.TG_VIDEOCHAT_CHAT_URL || "");
  if (explicit) return explicit;
  try {
    const url = new URL(currentBaseUrl || DEFAULT_BASE_URL);
    url.port = argValue("chat-port") || process.env.TG_VIDEOCHAT_CHAT_PORT || "9292";
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch (_) {
    return "http://127.0.0.1:9292/";
  }
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
    const youtubeFullscreen = [...browserViews.values()]
      .find((entry) => entry?.id === "youtube" && entry.htmlFullscreen && !userFullscreenMode && entry.youtubeRestoreBounds);
    const bounds = youtubeFullscreen?.youtubeRestoreBounds || mainWindow.getBounds();
    const state = {
      ...bounds,
      maximized: mainWindow.isMaximized(),
      fullscreen: userFullscreenMode && mainWindow.isFullScreen(),
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

function isEscapeInput(input) {
  return input?.key === "Escape" || input?.key === "Esc" || input?.code === "Escape";
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

function isNativeChatIpc(event) {
  return !!nativeChatWindow && !nativeChatWindow.isDestroyed() && event.sender === nativeChatWindow.webContents;
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

function restoreWindowedYoutubeFullscreen(entry) {
  if (!mainWindow || mainWindow.isDestroyed() || userFullscreenMode) return;
  const applyRestore = () => {
    if (!mainWindow || mainWindow.isDestroyed() || userFullscreenMode) return;
    try {
      if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    } catch (_) {}
  };
  for (const delay of [0, 40, 120]) {
    setTimeout(applyRestore, delay);
  }
}

function exitBrowserHtmlFullscreen(entry, options = {}) {
  if (!entry) return;
  entry.ignoreFullscreenLeaveUntil = 0;
  entry.htmlFullscreen = false;
  entry.widgetFullscreen = false;
  if (!options.skipScript) {
    try {
      entry.view.webContents.executeJavaScript(
        "if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();",
        true,
      ).catch(() => {});
    } catch (_) {}
  }
  if (entry.id === "youtube" && !userFullscreenMode) {
    restoreWindowedYoutubeFullscreen(entry);
  }
  sendBrowserEvent({ type: "fullscreen", id: entry.id, active: false });
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
  wc.on("before-input-event", (event, input) => {
    if (id !== "youtube") return;
    if (!isEscapeInput(input)) return;
    appLog("youtube escape input", {
      source: "browser-view",
      type: input?.type,
      key: input?.key,
      code: input?.code,
      widgetFullscreen: !!entry.widgetFullscreen,
      htmlFullscreen: !!entry.htmlFullscreen,
    });
    sendBrowserEvent({ type: "escape", id: "youtube", source: "browser-view", inputType: input?.type || "" });
    if (input?.type === "keyDown" && (entry.widgetFullscreen || entry.htmlFullscreen)) {
      event.preventDefault();
      exitBrowserHtmlFullscreen(entry);
    }
  });
  wc.on("enter-html-full-screen", () => {
    entry.htmlFullscreen = true;
    if (id === "youtube") {
      entry.widgetFullscreen = true;
      if (!userFullscreenMode) {
        restoreWindowedYoutubeFullscreen(entry);
      }
      entry.ignoreFullscreenLeaveUntil = Date.now() + 1200;
      setTimeout(() => {
        try {
          entry.view.webContents.executeJavaScript(
            "if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();",
            true,
          ).catch(() => {});
        } catch (_) {}
      }, 40);
    }
    sendBrowserEvent({ type: "fullscreen", id, active: true });
  });
  wc.on("leave-html-full-screen", () => {
    if (id === "youtube" && Date.now() < (Number(entry.ignoreFullscreenLeaveUntil) || 0)) {
      entry.htmlFullscreen = false;
      entry.ignoreFullscreenLeaveUntil = 0;
      if (!userFullscreenMode) restoreWindowedYoutubeFullscreen(entry);
      return;
    }
    exitBrowserHtmlFullscreen(entry, { skipScript: true });
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      wc.loadURL(url).catch((exc) => sendBrowserLog(id, "error", `popup navigation failed: ${exc.message || exc}`));
    }
    return { action: "deny" };
  });
  wc.on("console-message", (...args) => handleBrowserConsole(id, ...args));
  wc.on("focus", () => sendBrowserEvent({ type: "focus", id }));
  wc.on("before-input-event", () => {
    sendBrowserEvent({ type: "focus", id });
  });
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
  reorderBrowserViews();
  return entry;
}

function reorderBrowserViews() {
  if (!mainWindow || mainWindow.isDestroyed() || typeof mainWindow.setTopBrowserView !== "function") return;
  const attached = Array.from(browserViews.values())
    .filter((entry) => entry?.attached)
    .sort((a, b) => {
      const az = Number(a.z) || 0;
      const bz = Number(b.z) || 0;
      if (az !== bz) return az - bz;
      return (Number(a.updatedAt) || 0) - (Number(b.updatedAt) || 0);
    });
  for (const entry of attached) {
    try { mainWindow.setTopBrowserView(entry.view); } catch (_) {}
  }
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
  reorderBrowserViews();
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
  entry.z = Number(payload.z) || 0;
  if (id === "youtube" && Object.prototype.hasOwnProperty.call(payload, "fullscreen")) {
    entry.widgetFullscreen = !!payload.fullscreen;
  }
  entry.updatedAt = Date.now();
  view.setBounds(sanitizeBrowserBounds(payload.bounds));
  view.setAutoResize({ width: false, height: false, horizontal: false, vertical: false });
  reorderBrowserViews();
  if (view.webContents.getURL() !== targetUrl) {
    view.webContents.loadURL(targetUrl).catch((exc) => {
      sendBrowserLog(id, "error", `load failed: ${exc.message || exc}`, { source: targetUrl });
      sendBrowserStatus(id, { loading: false, url: targetUrl });
    });
  } else {
    sendBrowserStatus(id);
  }
  bumpNativeChatView();
}

function nativeChatWebContents() {
  if (!nativeChatWindow || nativeChatWindow.isDestroyed()) return null;
  const wc = nativeChatWindow.webContents;
  return wc && !wc.isDestroyed() ? wc : null;
}

function nativeChatFrame(contentBounds) {
  const bounds = sanitizeBrowserBounds(contentBounds);
  const mainContent = mainWindow?.getContentBounds() || { x: 0, y: 0, width: 1600, height: 900 };
  const right = Math.max(0, mainContent.width - bounds.x - bounds.width);
  const bottom = Math.max(0, mainContent.height - bounds.y - bounds.height);
  return {
    screen: {
      x: Math.round(mainContent.x),
      y: Math.round(mainContent.y),
      width: Math.max(1, Math.round(mainContent.width)),
      height: Math.max(1, Math.round(mainContent.height)),
    },
    chat: {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    },
    right,
    bottom,
  };
}

function updateNativeChatLayoutVars(frame) {
  const wc = nativeChatWebContents();
  if (!wc || !frame?.chat) return;
  const vars = {
    "--tg-native-chat-x": `${Math.max(0, Math.round(frame.chat.x))}px`,
    "--tg-native-chat-y": `${Math.max(0, Math.round(frame.chat.y))}px`,
    "--tg-native-chat-w": `${Math.max(1, Math.round(frame.chat.width))}px`,
    "--tg-native-chat-h": `${Math.max(1, Math.round(frame.chat.height))}px`,
    "--tg-native-chat-right": `${Math.max(0, Math.round(frame.right))}px`,
    "--tg-native-chat-bottom": `${Math.max(0, Math.round(frame.bottom))}px`,
  };
  const script = `(() => {
    const style = document.documentElement.style;
    ${Object.entries(vars).map(([key, value]) => `style.setProperty(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join("\n    ")}
  })();`;
  wc.executeJavaScript(script, true).catch(() => {});
}

function sendNativeChatActionState() {
  const wc = nativeChatWebContents();
  if (!wc || !nativeChatActionState) return;
  wc.send("electron-chat:action-state", nativeChatActionState);
}

function setNativeChatMouseInteractive(active) {
  const win = nativeChatWindow;
  if (!win || win.isDestroyed()) return;
  const enabled = !!(nativeChatVisible && active);
  if (nativeChatMouseTimer) {
    clearTimeout(nativeChatMouseTimer);
    nativeChatMouseTimer = null;
  }
  const apply = () => {
    if (!nativeChatWindow || nativeChatWindow.isDestroyed()) return;
    if (nativeChatMouseInteractive === enabled) return;
    nativeChatMouseInteractive = enabled;
    try {
      nativeChatWindow.setIgnoreMouseEvents(!enabled, { forward: true });
    } catch (_) {}
  };
  if (enabled) {
    apply();
  } else {
    nativeChatMouseTimer = setTimeout(() => {
      nativeChatMouseTimer = null;
      apply();
    }, 140);
  }
}

function nativeChatUnavailableHtml(targetUrl, reason = "") {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; height: 100%; background: transparent; color: rgba(255,255,255,.8); font: 13px/1.45 system-ui, "Segoe UI", sans-serif; overflow: hidden; }
    body { display: grid; place-items: end stretch; box-sizing: border-box; padding: 8px; }
    .box { border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 10px 12px; background: rgba(8,11,16,.76); box-shadow: 0 10px 24px rgba(0,0,0,.28); }
    b { color: #ffe38c; }
    code { color: rgba(255,255,255,.72); word-break: break-all; }
  </style>
</head>
<body>
  <div class="box">
    <b>9292 chat server is not available</b><br>
    <code>${escapeHtml(targetUrl)}</code>${reason ? `<br><code>${escapeHtml(reason)}</code>` : ""}
  </div>
</body>
</html>`;
}

function ensureNativeChatView() {
  if (nativeChatWindow && !nativeChatWindow.isDestroyed()) return nativeChatWindow;
  nativeChatCssInjected = false;
  nativeChatLoadedTarget = "";
  nativeChatWindow = new BrowserWindow({
    width: 360,
    height: 420,
    minWidth: 100,
    minHeight: 100,
    title: "TG 9292 Chat",
    modal: false,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:tg-native-chat",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: !keepRendering,
    },
  });
  try {
    nativeChatWindow.setBackgroundColor("#00000000");
    nativeChatWindow.setAlwaysOnTop(!!mainWindow?.isAlwaysOnTop(), "screen-saver");
    nativeChatWindow.setIgnoreMouseEvents(true, { forward: true });
    nativeChatMouseInteractive = false;
  } catch (_) {}
  nativeChatWindow.on("closed", () => {
    stopNativeChatRaiseGuard();
    if (nativeChatForceRaiseTimer) {
      clearTimeout(nativeChatForceRaiseTimer);
      nativeChatForceRaiseTimer = null;
    }
    nativeChatWindow = null;
    nativeChatVisible = false;
    nativeChatCssInjected = false;
    nativeChatLoadedTarget = "";
    nativeChatMouseInteractive = false;
  });
  const wc = nativeChatWindow.webContents;
  try {
    wc.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(["media", "microphone"].includes(permission));
    });
  } catch (_) {}
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("did-start-loading", () => {
    nativeChatCssInjected = false;
  });
  wc.on("did-finish-load", () => {
    injectNativeChatCss().catch((exc) => appLog("native chat css failed", { error: exc.message || String(exc) }));
    if (nativeChatContentBounds) updateNativeChatLayoutVars(nativeChatFrame(nativeChatContentBounds));
    sendNativeChatActionState();
  });
  wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || !nativeChatWindow || nativeChatWindow.isDestroyed()) return;
    const targetUrl = validatedURL || nativeChatLoadedTarget || composeChatUrl();
    appLog("native chat load failed", { errorCode, errorDescription, targetUrl });
    wc.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(nativeChatUnavailableHtml(targetUrl, `${errorCode}: ${errorDescription}`))}`).catch(() => {});
  });
  return nativeChatWindow;
}

async function injectNativeChatCss() {
  const wc = nativeChatWebContents();
  if (!wc || nativeChatCssInjected) return;
  nativeChatCssInjected = true;
  await wc.insertCSS(`
    html, body {
      background: transparent !important;
      overflow: hidden !important;
      pointer-events: auto !important;
    }
    #chat {
      left: calc(var(--tg-native-chat-x, 0px) + 4px) !important;
      right: calc(var(--tg-native-chat-right, 0px) + 4px) !important;
      bottom: calc(var(--tg-native-chat-bottom, 0px) + 112px) !important;
      max-height: calc(var(--tg-native-chat-h, 100vh) - 112px) !important;
      padding-top: 0 !important;
      align-items: flex-end !important;
      justify-content: flex-start !important;
      pointer-events: auto !important;
    }
    body.native-send-panel-visible #chat,
    body.native-send-panel-focused #chat,
    body.native-send-panel-draft #chat,
    body.send-panel-has-draft #chat {
      bottom: calc(var(--tg-native-chat-bottom, 0px) + 112px) !important;
      max-height: calc(var(--tg-native-chat-h, 100vh) - 112px) !important;
    }
    #send-panel {
      left: calc(var(--tg-native-chat-x, 0px) + 4px) !important;
      right: calc(var(--tg-native-chat-right, 0px) + 4px) !important;
      bottom: calc(var(--tg-native-chat-bottom, 0px) + 4px) !important;
      width: auto !important;
      max-width: none !important;
      box-sizing: border-box !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transform: translateY(14px) !important;
      transition: opacity 160ms ease, transform 160ms ease !important;
    }
    body.native-send-panel-visible #send-panel,
    body.native-send-panel-focused #send-panel,
    body.native-send-panel-draft #send-panel,
    body.send-panel-has-draft #send-panel {
      pointer-events: auto !important;
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    #chat-tools {
      display: flex !important;
    }
    #font-down,
    #font-up,
    #stt-mic {
      display: none !important;
    }
    #message-menu,
    #mention-menu,
    #media-lightbox,
    .emoji-picker {
      z-index: 999999 !important;
      pointer-events: auto !important;
    }
    .msg,
    .msg .text,
    .msg .reply-quote,
    .msg .reply-quote * {
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    .msg .name,
    .msg .name *,
    .comment-prefix,
    .comment-prefix * {
      user-select: none !important;
      -webkit-user-select: none !important;
    }
  `);
  await wc.executeJavaScript(`
    (() => {
      if (window.__tgNativeChatHitTestBound) return;
      window.__tgNativeChatHitTestBound = true;
      const interactiveSelector = [
        "#send-panel",
        "#message-menu:not([hidden])",
        "#mention-menu:not([hidden])",
        "#media-lightbox:not([hidden])",
        ".emoji-picker:not([hidden])",
        ".msg",
        ".msg a",
        ".msg button",
        ".clickable-media"
      ].join(",");
      let last = null;
      let lastPointer = null;
      let pointerInsideMessage = false;
      const pointerEventLike = (ev) => !!(ev && Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY));
      const focusedInteractive = () => {
        const el = document.activeElement;
        return !!(el && el.closest && el.closest("#send-panel, .emoji-picker, #message-menu, #mention-menu, #media-lightbox"));
      };
      const hasSelection = () => {
        const sel = window.getSelection && window.getSelection();
        return !!(sel && !sel.isCollapsed && String(sel.toString() || "").trim());
      };
      const composerHasDraft = () => {
        const text = document.getElementById("send-text");
        const preview = document.getElementById("send-preview");
        const reply = document.getElementById("reply-preview");
        const rich = document.getElementById("send-rich-preview");
        return !!(
          (text && String(text.value || "").trim()) ||
          (preview && !preview.hidden) ||
          (reply && !reply.hidden) ||
          (rich && !rich.hidden) ||
          document.body.classList.contains("send-panel-has-draft")
        );
      };
      const isNearSendPanel = (point) => {
        if (!point || !Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) return false;
        const panel = document.getElementById("send-panel");
        if (!panel || panel.hidden) return false;
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const padX = 22;
        const padTop = 42;
        const padBottom = 18;
        return point.clientX >= rect.left - padX
          && point.clientX <= rect.right + padX
          && point.clientY >= rect.top - padTop
          && point.clientY <= rect.bottom + padBottom;
      };
      const report = (ev) => {
        if (pointerEventLike(ev)) {
          lastPointer = { clientX: ev.clientX, clientY: ev.clientY };
        }
        const point = pointerEventLike(ev) ? ev : lastPointer;
        const nearSendPanel = isNearSendPanel(point);
        const focused = focusedInteractive();
        const draft = composerHasDraft();
        const visible = nearSendPanel || draft;
        document.body.classList.toggle("native-send-panel-focused", focused && visible);
        document.body.classList.toggle("native-send-panel-draft", draft);
        document.body.classList.toggle("native-send-panel-visible", visible);
        const el = point
          ? document.elementFromPoint(point.clientX, point.clientY)
          : null;
        const active = !!(nearSendPanel || draft || pointerInsideMessage || hasSelection() || (focused && visible) || (el && el.closest && el.closest(interactiveSelector)));
        if (active === last) return;
        last = active;
        try { window.tgNativeChatHost?.setMouseInteractive(active); } catch (_) {}
      };
      document.addEventListener("pointerdown", (ev) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        pointerInsideMessage = !!(el && el.closest && el.closest(".msg"));
        report(ev);
      }, true);
      document.addEventListener("contextmenu", (ev) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        pointerInsideMessage = !!(el && el.closest && el.closest(".msg"));
        report(ev);
      }, true);
      const clearPointer = () => {
        setTimeout(() => {
          pointerInsideMessage = false;
          report();
        }, 80);
      };
      document.addEventListener("mouseleave", () => {
        lastPointer = null;
        report();
      }, true);
      document.addEventListener("mousemove", report, true);
      document.addEventListener("pointermove", report, true);
      document.addEventListener("focusin", report, true);
      document.addEventListener("focusout", () => setTimeout(report, 0), true);
      document.addEventListener("selectionchange", report, true);
      document.addEventListener("pointerup", clearPointer, true);
      document.addEventListener("pointercancel", clearPointer, true);
      setInterval(report, 300);
      report();
    })();
  `, true).catch(() => {});
}

function raiseNativeChatView(options = {}) {
  if (!mainWindow || !nativeChatVisible || !nativeChatWindow || nativeChatWindow.isDestroyed()) return;
  try {
    nativeChatWindow.setAlwaysOnTop(options.force ? true : !!mainWindow.isAlwaysOnTop(), "screen-saver");
    if (nativeChatVisible && !mainWindow.isMinimized() && !nativeChatWindow.isVisible()) {
      nativeChatWindow.showInactive();
    }
    nativeChatWindow.moveTop();
  } catch (_) {}
}

function forceNativeChatView(durationMs = 700) {
  if (!mainWindow || !nativeChatVisible || !nativeChatWindow || nativeChatWindow.isDestroyed()) return;
  const delays = [0, 16, 50, 110, 220, 420];
  for (const delay of delays) {
    setTimeout(() => raiseNativeChatView({ force: true }), delay);
  }
  if (nativeChatForceRaiseTimer) clearTimeout(nativeChatForceRaiseTimer);
  nativeChatForceRaiseTimer = setTimeout(() => {
    nativeChatForceRaiseTimer = null;
    raiseNativeChatView({ force: false });
  }, Math.max(120, Math.min(2000, Number(durationMs) || 700)));
}

function bumpNativeChatView(options = {}) {
  if (options.force) {
    forceNativeChatView(options.durationMs);
    return;
  }
  raiseNativeChatView();
  setTimeout(raiseNativeChatView, 16);
  setTimeout(raiseNativeChatView, 80);
  setTimeout(raiseNativeChatView, 180);
}

function startNativeChatRaiseGuard() {
  if (nativeChatRaiseTimer) return;
  nativeChatRaiseTimer = setInterval(() => {
    if (!nativeChatVisible || !nativeChatWindow || nativeChatWindow.isDestroyed()) {
      stopNativeChatRaiseGuard();
      return;
    }
    raiseNativeChatView();
  }, 120);
  try { nativeChatRaiseTimer.unref?.(); } catch (_) {}
}

function stopNativeChatRaiseGuard() {
  if (!nativeChatRaiseTimer) return;
  clearInterval(nativeChatRaiseTimer);
  nativeChatRaiseTimer = null;
}

function positionNativeChatWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !nativeChatWindow || nativeChatWindow.isDestroyed() || !nativeChatContentBounds) return;
  try {
    const frame = nativeChatFrame(nativeChatContentBounds);
    nativeChatWindow.setBounds(frame.screen, false);
    updateNativeChatLayoutVars(frame);
    if (nativeChatVisible && !mainWindow.isMinimized() && !nativeChatWindow.isVisible()) {
      nativeChatWindow.showInactive();
    }
    raiseNativeChatView();
  } catch (_) {}
}

function scheduleNativeChatPosition() {
  positionNativeChatWindow();
  for (const delay of [40, 120, 260]) {
    setTimeout(positionNativeChatWindow, delay);
  }
}

function attachNativeChatView() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const win = ensureNativeChatView();
  if (!win) return null;
  nativeChatVisible = true;
  scheduleNativeChatPosition();
  if (!mainWindow.isMinimized() && !win.isVisible()) {
    try {
      win.showInactive();
      setNativeChatMouseInteractive(false);
    } catch (_) {}
  }
  raiseNativeChatView();
  startNativeChatRaiseGuard();
  return win;
}

function detachNativeChatView(destroy = false) {
  nativeChatVisible = false;
  stopNativeChatRaiseGuard();
  if (nativeChatForceRaiseTimer) {
    clearTimeout(nativeChatForceRaiseTimer);
    nativeChatForceRaiseTimer = null;
  }
  if (!nativeChatWindow) return;
  try {
    if (!nativeChatWindow.isDestroyed()) {
      nativeChatWindow.setIgnoreMouseEvents(true, { forward: true });
      nativeChatWindow.hide();
    }
    nativeChatMouseInteractive = false;
  } catch (_) {}
  if (!destroy) return;
  try {
    if (!nativeChatWindow.isDestroyed()) nativeChatWindow.destroy();
  } catch (_) {}
  nativeChatWindow = null;
  nativeChatCssInjected = false;
  nativeChatLoadedTarget = "";
  nativeChatContentBounds = null;
}

function updateNativeChatView(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!payload || payload.visible === false) {
    nativeChatContentBounds = null;
    detachNativeChatView(false);
    return;
  }
  const bounds = sanitizeBrowserBounds(payload.bounds);
  if (bounds.width < 80 || bounds.height < 80) {
    nativeChatContentBounds = null;
    detachNativeChatView(false);
    return;
  }
  nativeChatContentBounds = bounds;
  const win = attachNativeChatView();
  if (!win) return;
  const targetUrl = composeChatUrl();
  const wc = win.webContents;
  const currentUrl = wc.getURL();
  if (nativeChatLoadedTarget !== targetUrl || !currentUrl || currentUrl.startsWith("data:")) {
    nativeChatLoadedTarget = targetUrl;
    nativeChatCssInjected = false;
    wc.loadURL(targetUrl).catch((exc) => {
      appLog("native chat load exception", { error: exc.message || String(exc), targetUrl });
    });
  } else {
    injectNativeChatCss().catch(() => {});
  }
  raiseNativeChatView();
}

function unavailableHtml(targetUrl, reason = "") {
  const escaped = escapeHtml(targetUrl);
  const escapedReason = escapeHtml(reason);
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
    ${escapedReason ? `<p>Reason: <code>${escapedReason}</code></p>` : ""}
    <button onclick="location.href='${escaped}'">Reconnect</button>
  </main>
</body>
</html>`;
}

function probeOverlayUrl(targetUrl, timeoutMs = 1400) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok, reason = "") => {
      if (done) return;
      done = true;
      resolve({ ok, reason });
    };
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (exc) {
      finish(false, `invalid_url:${exc.message || exc}`);
      return;
    }
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      parsed,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: {
          "Cache-Control": "no-cache",
          "User-Agent": "TG-9393-Overlay-App-Probe",
        },
      },
      (res) => {
        res.resume();
        finish(true, `http_${res.statusCode || 0}`);
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (exc) => {
      finish(false, exc.code || exc.message || String(exc));
    });
    req.end();
  });
}

async function loadUnavailable(targetUrl, reason = "") {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showingUnavailable = true;
  appLog("overlay unavailable", { targetUrl, reason });
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(unavailableHtml(targetUrl, reason))}`);
}

async function injectToolbar() {
  if (!mainWindow) return;
  try {
    await mainWindow.webContents.insertCSS(`
      body.tg-app-ui-hidden #topic-controls,
      body.tg-app-ui-hidden #chat-controls,
      body.tg-app-ui-hidden .topic-resize-handle,
      body.tg-app-ui-hidden .toast-resize-handle {
        display: none !important;
      }
      body.tg-app-ui-hidden.app-settings-open #avatar-controls {
        display: flex !important;
        visibility: visible !important;
        opacity: .96 !important;
        pointer-events: auto !important;
        transform: translateY(0) !important;
      }
      body.tg-app-ui-hidden.app-settings-open #avatar-controls * {
        pointer-events: auto !important;
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
      body.tg-app-ui-hidden #tg-app-toolbar {
        display: flex !important;
        opacity: 1 !important;
        pointer-events: auto !important;
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
        const syncSettingsPanel = (open) => {
          const next = !!open;
          document.body.classList.toggle("app-settings-open", next);
          document.getElementById("tg-app-settings")?.classList.toggle("active", next);
          const panel = document.getElementById("avatar-controls");
          if (panel) {
            panel.hidden = !next;
            panel.inert = !next;
            panel.setAttribute("aria-hidden", next ? "false" : "true");
          }
          const staticToggle = document.getElementById("app-settings-toggle");
          staticToggle?.classList.toggle("active", next);
          staticToggle?.setAttribute("aria-expanded", next ? "true" : "false");
          try {
            if (next) {
              window.tgElectronBrowser?.upsert?.({ id: "youtube", visible: false, pause: false });
              window.tgElectronBrowser?.upsert?.({ id: "web", visible: false, pause: false });
            } else {
              window.dispatchEvent(new Event("resize"));
            }
          } catch (_) {}
        };
        bindOnce("tg-app-settings", () => {
            const next = !document.body.classList.contains("app-settings-open");
            syncSettingsPanel(next);
            try { localStorage.setItem(settingsKey, next ? "1" : "0"); } catch (_) {}
        });
        bindOnce("tg-app-reload", () => location.reload());
        document.body.classList.toggle("tg-app-ui-hidden", ${overlayUiHidden ? "true" : "false"});
        try { syncSettingsPanel(localStorage.getItem(settingsKey) === "1"); } catch (_) { syncSettingsPanel(false); }
        document.getElementById("tg-app-toggle-ui")?.classList.toggle("active", document.body.classList.contains("tg-app-ui-hidden"));
      })();
    `);
  } catch (_) {}
}

async function loadOverlay() {
  if (!mainWindow) return;
  const targetUrl = composeOverlayUrl();
  showingUnavailable = false;
  const probe = await probeOverlayUrl(targetUrl);
  if (!probe.ok) {
    await loadUnavailable(targetUrl, probe.reason);
    return;
  }
  try {
    await mainWindow.loadURL(targetUrl);
  } catch (exc) {
    await loadUnavailable(targetUrl, exc.message || String(exc));
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
        {
          label: "Fullscreen",
          accelerator: "F11",
          click: () => {
            if (!mainWindow) return;
            const next = !mainWindow.isFullScreen();
            userFullscreenMode = next;
            mainWindow.setFullScreen(next);
          },
        },
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

ipcMain.on("electron-browser:fullscreen", (event, payload) => {
  const entry = getBrowserEntry(browserIdFromPayload(payload));
  if (!isOverlayIpc(event) || !entry) return;
  appLog("browser fullscreen ipc", {
    id: entry.id,
    active: payload?.active,
    widgetFullscreen: !!entry.widgetFullscreen,
    htmlFullscreen: !!entry.htmlFullscreen,
  });
  if (payload?.active === true) {
    entry.widgetFullscreen = true;
    entry.htmlFullscreen = false;
    entry.ignoreFullscreenLeaveUntil = 0;
    sendBrowserEvent({ type: "fullscreen", id: entry.id, active: true });
    return;
  }
  if (payload?.active === false) {
    exitBrowserHtmlFullscreen(entry);
  }
});

ipcMain.on("electron-browser:open-external", (event, url) => {
  if (!isOverlayIpc(event)) return;
  const targetUrl = normalizeUrl(url);
  if (/^https?:\/\//i.test(targetUrl)) shell.openExternal(targetUrl);
});

ipcMain.on("electron-chat:upsert", (event, payload) => {
  if (!isOverlayIpc(event)) return;
  updateNativeChatView(payload || {});
});

ipcMain.on("electron-chat:close", (event) => {
  if (!isOverlayIpc(event)) return;
  detachNativeChatView(false);
});

ipcMain.on("electron-chat:reload", (event) => {
  const wc = nativeChatWebContents();
  if (!isOverlayIpc(event) || !wc) return;
  nativeChatCssInjected = false;
  wc.reload();
});

ipcMain.on("electron-chat:devtools", (event) => {
  const wc = nativeChatWebContents();
  if (!isOverlayIpc(event) || !wc) return;
  wc.openDevTools({ mode: "detach" });
});

ipcMain.on("electron-chat:raise", (event, payload = {}) => {
  if (!isOverlayIpc(event)) return;
  bumpNativeChatView({
    force: !!payload.force,
    durationMs: Number(payload.duration_ms || payload.durationMs) || 700,
  });
});

ipcMain.on("electron-chat:mouse-interactive", (event, payload) => {
  if (!isNativeChatIpc(event)) return;
  setNativeChatMouseInteractive(!!payload?.active);
});

ipcMain.on("electron-chat:action-state", (event, payload) => {
  if (!isOverlayIpc(event)) return;
  nativeChatActionState = payload || {};
  sendNativeChatActionState();
});

ipcMain.on("electron-chat:native-action", (event, payload) => {
  if (!isNativeChatIpc(event)) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("electron-chat:native-action", payload || {});
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
  userFullscreenMode = !!(saved.fullscreen && !hasArg("reset-window"));
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
  mainWindow.webContents.on("did-start-loading", () => {
    detachAllBrowserViews(false);
    detachNativeChatView(false);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || showingUnavailable) return;
    const targetUrl = validatedURL || composeOverlayUrl();
    if (/^data:/i.test(targetUrl)) return;
    loadUnavailable(targetUrl, `${errorCode}: ${errorDescription}`).catch((exc) => {
      appLog("unavailable fallback failed", { error: exc.message || String(exc) });
    });
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appLog("render process gone", details || {});
  });
  mainWindow.webContents.on("unresponsive", () => {
    appLog("window unresponsive");
  });
  mainWindow.webContents.on("did-finish-load", injectToolbar);
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (isEscapeInput(input)) {
      const youtubeEntry = getBrowserEntry("youtube");
      if (youtubeEntry) {
        appLog("youtube escape input", {
          source: "main-window",
          type: input?.type,
          key: input?.key,
          code: input?.code,
          widgetFullscreen: !!youtubeEntry.widgetFullscreen,
          htmlFullscreen: !!youtubeEntry.htmlFullscreen,
        });
      }
      if (youtubeEntry) {
        sendBrowserEvent({ type: "escape", id: "youtube", source: "main-window", inputType: input?.type || "" });
      }
      if (input?.type === "keyDown" && (youtubeEntry?.widgetFullscreen || youtubeEntry?.htmlFullscreen)) {
        event.preventDefault();
        exitBrowserHtmlFullscreen(youtubeEntry);
        return;
      }
    }
    bumpNativeChatView();
  });
  mainWindow.on("focus", bumpNativeChatView);
  mainWindow.on("show", bumpNativeChatView);
  mainWindow.on("resize", () => {
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
    const now = Date.now();
    if (now - lastResizeDebugLogAt > 700) {
      lastResizeDebugLogAt = now;
      appLog("main window resize", {
        bounds: mainWindow?.getBounds?.(),
        youtubeWidgetFullscreen: !!getBrowserEntry("youtube")?.widgetFullscreen,
        youtubeHtmlFullscreen: !!getBrowserEntry("youtube")?.htmlFullscreen,
      });
    }
    sendBrowserEvent({ type: "window-resize", id: "window" });
  });
  mainWindow.on("move", () => {
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
  });
  mainWindow.on("maximize", () => {
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
  });
  mainWindow.on("unmaximize", () => {
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
  });
  mainWindow.on("enter-full-screen", () => {
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
  });
  mainWindow.on("leave-full-screen", () => {
    if (![...browserViews.values()].some((entry) => entry?.htmlFullscreen)) {
      userFullscreenMode = false;
    }
    scheduleWindowStateSave();
    scheduleNativeChatPosition();
  });
  mainWindow.on("minimize", () => {
    try {
      nativeChatWindow?.hide();
    } catch (_) {}
  });
  mainWindow.on("restore", () => {
    scheduleNativeChatPosition();
    bumpNativeChatView();
  });
  mainWindow.on("always-on-top-changed", () => {
    scheduleWindowStateSave();
    bumpNativeChatView();
  });
  mainWindow.on("close", writeWindowState);
  mainWindow.on("closed", () => {
    detachNativeChatView(true);
    detachAllBrowserViews(true);
    mainWindow = null;
  });
  Menu.setApplicationMenu(createMenu());
  if (saved.maximized && !hasArg("reset-window")) mainWindow.maximize();
  if (saved.fullscreen && !hasArg("reset-window")) mainWindow.setFullScreen(true);
  if (hasArg("always-on-top") || (saved.alwaysOnTop && !hasArg("reset-window"))) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  }
  loadOverlay();
}

app.whenReady().then(createWindow);
app.on("browser-window-focus", (_event, win) => {
  if (win === mainWindow) bumpNativeChatView();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  detachAllBrowserViews(true);
  detachNativeChatView(true);
  stopKeepRenderingGuards();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
