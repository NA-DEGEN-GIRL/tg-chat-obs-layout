(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const el = {
    addressForm: $("addressForm"),
    addressInput: $("addressInput"),
    backBtn: $("backBtn"),
    forwardBtn: $("forwardBtn"),
    reloadBtn: $("reloadBtn"),
    stopBtn: $("stopBtn"),
    connectBtn: $("connectBtn"),
    healthBtn: $("healthBtn"),
    resetProfileBtn: $("resetProfileBtn"),
    applyStreamBtn: $("applyStreamBtn"),
    copyBtn: $("copyBtn"),
    pasteBtn: $("pasteBtn"),
    uploadInput: $("uploadInput"),
    clearLogBtn: $("clearLogBtn"),
    serverOrigin: $("serverOrigin"),
    connectionDot: $("connectionDot"),
    connectionStatus: $("connectionStatus"),
    healthText: $("healthText"),
    titleText: $("titleText"),
    currentUrl: $("currentUrl"),
    loadingText: $("loadingText"),
    httpStatus: $("httpStatus"),
    navState: $("navState"),
    profilePath: $("profilePath"),
    runtimePath: $("runtimePath"),
    viewportWidth: $("viewportWidth"),
    viewportHeight: $("viewportHeight"),
    targetFps: $("targetFps"),
    jpegQuality: $("jpegQuality"),
    scaleSelect: $("scaleSelect"),
    textMode: $("textMode"),
    fpsText: $("fpsText"),
    latencyText: $("latencyText"),
    captureText: $("captureText"),
    frameText: $("frameText"),
    debugLog: $("debugLog"),
    viewportShell: $("viewportShell"),
    viewportCanvas: $("viewportCanvas"),
    textSink: $("textSink"),
    emptyState: $("emptyState"),
  };

  const ignoredRemoteKeys = new Set([
    "HangulMode",
    "HanjaMode",
    "JunjaMode",
    "KanaMode",
    "KanjiMode",
    "Eisu",
    "Convert",
    "NonConvert",
    "Process",
    "Unidentified",
    "Dead",
  ]);

  const modifierKeys = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);
  const maxUploadFileBytes = 10 * 1024 * 1024;
  const maxUploadFiles = 8;

  const state = {
    ws: null,
    connected: false,
    frameSeq: 0,
    lastMouseMoveAt: 0,
    mouseDown: false,
    renderBusy: false,
    pendingFrame: null,
    pingTimer: 0,
    healthTimer: 0,
    localFrameCount: 0,
    localFpsTimer: 0,
    composingText: false,
    lastStatusError: "",
    touchId: 1,
    touchActive: false,
    suppressedKeyUps: new Set(),
  };

  const ctx = el.viewportCanvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, el.viewportCanvas.width, el.viewportCanvas.height);

  function timestamp() {
    return new Date().toLocaleTimeString();
  }

  function addLog(level, message) {
    const line = document.createElement("div");
    line.className = `bl-log-line is-${level || "info"}`;
    line.textContent = `[${timestamp()}] ${(level || "info").toUpperCase()} ${message}`;
    el.debugLog.appendChild(line);
    while (el.debugLog.children.length > 300) {
      el.debugLog.removeChild(el.debugLog.firstChild);
    }
    el.debugLog.scrollTop = el.debugLog.scrollHeight;
  }

  function safeUrlForLog(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch (_err) {
      return rawUrl || "";
    }
  }

  function normalizeAddress(rawAddress) {
    const value = rawAddress.trim();
    if (!value || value === "about:blank") {
      return value;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
      return value;
    }
    return `https://${value}`;
  }

  function normalizeServerOrigin() {
    const raw = el.serverOrigin.value.trim() || "http://127.0.0.1:9494";
    const url = new URL(raw);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    const clean = url.toString().replace(/\/$/, "");
    el.serverOrigin.value = clean;
    return clean;
  }

  function wsUrlFromOrigin(origin) {
    const url = new URL(origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";
    return url.toString();
  }

  function setConnection(status, ok) {
    state.connected = Boolean(ok);
    el.connectionStatus.textContent = status;
    el.connectionDot.classList.toggle("is-ok", Boolean(ok));
    el.connectionDot.classList.toggle("is-bad", status === "Error" || status === "Disconnected");
    el.connectBtn.textContent = ok ? "Disconnect" : "Connect";
  }

  function send(message) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      addLog("warn", "WebSocket is not connected");
      return false;
    }
    state.ws.send(JSON.stringify(message));
    return true;
  }

  async function checkHealth() {
    let origin;
    try {
      origin = normalizeServerOrigin();
    } catch (err) {
      el.healthText.textContent = "bad origin";
      addLog("error", `invalid proxy origin: ${err.message}`);
      return;
    }
    try {
      const response = await fetch(`${origin}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      el.healthText.textContent = payload.ok ? "ok" : "not ok";
      el.profilePath.textContent = payload.profile_dir || "-";
      el.runtimePath.textContent = payload.runtime_dir || "-";
    } catch (err) {
      el.healthText.textContent = "offline";
      addLog("warn", `health check failed: ${err.message}`);
    }
  }

  function connect() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.close(1000, "client disconnect");
      return;
    }

    let target;
    try {
      target = wsUrlFromOrigin(normalizeServerOrigin());
    } catch (err) {
      addLog("error", `invalid proxy origin: ${err.message}`);
      return;
    }

    setConnection("Connecting", false);
    addLog("info", `connecting to ${target}`);
    state.ws = new WebSocket(target);

    state.ws.addEventListener("open", () => {
      setConnection("Connected", true);
      addLog("info", "WebSocket connected");
      applyStreamSettings();
      startPing();
    });

    state.ws.addEventListener("message", (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_err) {
        addLog("warn", "received non-JSON message");
        return;
      }
      handleServerMessage(payload);
    });

    state.ws.addEventListener("close", () => {
      setConnection("Disconnected", false);
      stopPing();
      addLog("info", "WebSocket disconnected");
    });

    state.ws.addEventListener("error", () => {
      setConnection("Error", false);
      addLog("error", "WebSocket error");
    });
  }

  function handleServerMessage(payload) {
    if (!payload || typeof payload.type !== "string") {
      return;
    }
    switch (payload.type) {
      case "hello":
        el.profilePath.textContent = payload.profile_dir || "-";
        el.runtimePath.textContent = payload.runtime_dir || "-";
        addLog("info", "remote Chromium session ready");
        break;
      case "status":
        updateStatus(payload);
        break;
      case "frame":
        queueFrame(payload);
        break;
      case "metrics":
        el.fpsText.textContent = String(payload.fps ?? "0");
        el.captureText.textContent = payload.screenshot_ms ? `${payload.screenshot_ms} ms` : "-";
        break;
      case "pong":
        if (payload.client_ts) {
          el.latencyText.textContent = `${Date.now() - Number(payload.client_ts)} ms rtt`;
        }
        break;
      case "clipboard":
        writeClipboardFromRemote(payload);
        break;
      case "log":
        if (payload.message && payload.message === state.lastStatusError) {
          break;
        }
        if (payload.level === "error" || payload.level === "warn") {
          state.lastStatusError = payload.message || state.lastStatusError;
        }
        addLog(payload.level || "info", payload.message || "");
        break;
      default:
        addLog("warn", `unknown server message: ${payload.type}`);
        break;
    }
  }

  async function writeClipboardFromRemote(payload) {
    const text = typeof payload.text === "string" ? payload.text : "";
    if (!text) {
      addLog("info", "copy returned no readable text");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      addLog("info", `copy received (${text.length} chars)`);
    } catch (err) {
      addLog("warn", `clipboard write failed: ${err.message}`);
    }
  }

  function updateStatus(payload) {
    const url = payload.url || "about:blank";
    el.currentUrl.textContent = url;
    el.titleText.textContent = payload.title || "-";
    el.loadingText.textContent = payload.loading ? "loading" : "idle";
    el.httpStatus.textContent = payload.http_status == null ? "-" : String(payload.http_status);
    el.navState.textContent = payload.nav_state || "idle";
    el.profilePath.textContent = payload.profile_dir || el.profilePath.textContent || "-";
    el.runtimePath.textContent = payload.runtime_dir || el.runtimePath.textContent || "-";
    if (document.activeElement !== el.addressInput) {
      el.addressInput.value = url;
    }
    if (payload.viewport) {
      const streamControlFocused = [
        el.viewportWidth,
        el.viewportHeight,
        el.targetFps,
        el.jpegQuality,
      ].includes(document.activeElement);
      if (!streamControlFocused) {
        el.viewportWidth.value = payload.viewport.width || el.viewportWidth.value;
        el.viewportHeight.value = payload.viewport.height || el.viewportHeight.value;
      }
    }
    if (payload.last_error && payload.last_error !== state.lastStatusError) {
      state.lastStatusError = payload.last_error;
      addLog("warn", payload.last_error);
    }
  }

  function queueFrame(frame) {
    state.pendingFrame = frame;
    if (!state.renderBusy) {
      renderNextFrame();
    }
  }

  function renderNextFrame() {
    const frame = state.pendingFrame;
    if (!frame) {
      state.renderBusy = false;
      return;
    }
    state.pendingFrame = null;
    state.renderBusy = true;

    const image = new Image();
    image.onload = () => {
      const width = Number(frame.width) || image.width || 1280;
      const height = Number(frame.height) || image.height || 720;
      if (el.viewportCanvas.width !== width || el.viewportCanvas.height !== height) {
        el.viewportCanvas.width = width;
        el.viewportCanvas.height = height;
        applyScale();
      }
      ctx.drawImage(image, 0, 0, el.viewportCanvas.width, el.viewportCanvas.height);
      el.emptyState.classList.add("is-hidden");
      state.frameSeq = frame.seq || state.frameSeq + 1;
      state.localFrameCount += 1;
      el.frameText.textContent = `#${state.frameSeq}`;
      if (frame.screenshot_ms) {
        el.captureText.textContent = `${frame.screenshot_ms} ms`;
      }
      if (frame.sent_at) {
        el.latencyText.textContent = `${Math.max(0, Date.now() - Number(frame.sent_at))} ms frame`;
      }
      state.renderBusy = false;
      if (state.pendingFrame) {
        requestAnimationFrame(renderNextFrame);
      }
    };
    image.onerror = () => {
      state.renderBusy = false;
      addLog("warn", "failed to decode frame");
      if (state.pendingFrame) {
        requestAnimationFrame(renderNextFrame);
      }
    };
    image.src = `data:${frame.mime || "image/jpeg"};base64,${frame.data}`;
  }

  function applyScale() {
    const raw = el.scaleSelect.value;
    let scale;
    if (raw === "fit") {
      const shellRect = el.viewportShell.getBoundingClientRect();
      const fitWidth = shellRect.width > 0 ? shellRect.width / el.viewportCanvas.width : 1;
      const fitHeight = shellRect.height > 0 ? shellRect.height / el.viewportCanvas.height : 1;
      scale = Math.min(fitWidth, fitHeight);
      if (!Number.isFinite(scale) || scale <= 0) {
        scale = 1;
      }
    } else {
      scale = Number(raw) || 1;
    }
    const width = Math.max(1, Math.round(el.viewportCanvas.width * scale));
    const height = Math.max(1, Math.round(el.viewportCanvas.height * scale));
    el.viewportCanvas.style.width = `${width}px`;
    el.viewportCanvas.style.height = `${height}px`;
  }

  function navigateToAddress() {
    const url = normalizeAddress(el.addressInput.value);
    if (!url) {
      return;
    }
    el.addressInput.value = url;
    if (send({ type: "navigate", url })) {
      addLog("info", `navigate: ${safeUrlForLog(url)}`);
      focusRemoteInput();
    }
  }

  function applyStreamSettings() {
    const width = Number(el.viewportWidth.value) || 1280;
    const height = Number(el.viewportHeight.value) || 720;
    const fps = Number(el.targetFps.value) || 8;
    const quality = Number(el.jpegQuality.value) || 70;
    send({ type: "resize", width, height, deviceScaleFactor: 1 });
    send({ type: "stream_settings", fps, quality });
    applyScale();
  }

  function focusRemoteInput() {
    if (el.textSink) {
      el.textSink.value = "";
      el.textSink.focus({ preventScroll: true });
      return;
    }
    el.viewportCanvas.focus({ preventScroll: true });
  }

  function buttonName(buttonCode) {
    if (buttonCode === 1) {
      return "middle";
    }
    if (buttonCode === 2) {
      return "right";
    }
    return "left";
  }

  function viewportPointFromClient(clientX, clientY) {
    const rect = el.viewportCanvas.getBoundingClientRect();
    const scaleX = el.viewportCanvas.width / Math.max(1, rect.width);
    const scaleY = el.viewportCanvas.height / Math.max(1, rect.height);
    const maxX = Math.max(0, el.viewportCanvas.width - 1);
    const maxY = Math.max(0, el.viewportCanvas.height - 1);
    const x = Math.max(0, Math.min(maxX, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(maxY, (clientY - rect.top) * scaleY));
    return { x: Math.round(x), y: Math.round(y) };
  }

  function viewportPoint(event) {
    return viewportPointFromClient(event.clientX, event.clientY);
  }

  function sendMouse(event, kind) {
    const point = viewportPoint(event);
    const payload = {
      type: "mouse",
      event: kind,
      x: point.x,
      y: point.y,
      button: buttonName(event.button),
      clickCount: event.detail || 1,
      modifiers: {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      },
    };
    if (kind === "wheel") {
      payload.deltaX = event.deltaX;
      payload.deltaY = event.deltaY;
    }
    send(payload);
  }

  function sendTouch(event, kind) {
    event.preventDefault();
    if (kind === "start") {
      state.touchActive = true;
    }
    const sourceTouches = kind === "end" || kind === "cancel" ? event.changedTouches : event.touches;
    const points = Array.from(sourceTouches || []).map((touch) => {
      const point = viewportPointFromClient(touch.clientX, touch.clientY);
      return {
        id: Number(touch.identifier) || state.touchId,
        x: point.x,
        y: point.y,
        radiusX: Math.max(1, Math.round(Number(touch.radiusX) || 1)),
        radiusY: Math.max(1, Math.round(Number(touch.radiusY) || 1)),
        force: Number.isFinite(touch.force) ? touch.force : 1,
      };
    });
    if (points.length === 0 && event.changedTouches && event.changedTouches.length) {
      const touch = event.changedTouches[0];
      const point = viewportPointFromClient(touch.clientX, touch.clientY);
      points.push({
        id: Number(touch.identifier) || state.touchId,
        x: point.x,
        y: point.y,
        radiusX: 1,
        radiusY: 1,
        force: 1,
      });
    }
    send({ type: "touch", event: kind, points });
    if (kind === "end" || kind === "cancel") {
      state.touchActive = false;
    }
  }

  function sendActiveTouch(event, kind) {
    if (!state.touchActive) {
      return;
    }
    sendTouch(event, kind);
  }

  function normalizeKey(event) {
    if (event.key === " ") {
      return "Space";
    }
    return event.key;
  }

  function shouldIgnoreRemoteKey(event) {
    return ignoredRemoteKeys.has(event.key);
  }

  function shouldLetTextSinkHandle(event) {
    if (document.activeElement !== el.textSink) {
      return false;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    return event.isComposing || (event.key.length === 1 && event.key !== " ") || event.key === "Process" || event.key === "Dead";
  }

  function isPasteShortcut(event) {
    if (document.activeElement !== el.textSink || event.altKey) {
      return false;
    }
    const key = String(event.key || "").toLowerCase();
    return ((event.ctrlKey || event.metaKey) && key === "v") || (event.shiftKey && key === "insert");
  }

  function isCopyShortcut(event) {
    if (document.activeElement !== el.textSink || event.altKey || event.shiftKey) {
      return false;
    }
    const key = String(event.key || "").toLowerCase();
    return ((event.ctrlKey || event.metaKey) && key === "c") || (event.ctrlKey && key === "insert");
  }

  function isCutShortcut(event) {
    if (document.activeElement !== el.textSink || event.altKey || event.shiftKey) {
      return false;
    }
    return (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "x";
  }

  function sendKey(event, kind) {
    send({
      type: "key",
      event: kind,
      key: normalizeKey(event),
      code: event.code,
      repeat: event.repeat,
      modifiers: {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      },
    });
  }

  function sendKeyPress(event) {
    send({
      type: "key",
      event: "press",
      key: normalizeKey(event),
      code: event.code,
      repeat: event.repeat,
      modifiers: {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
      },
    });
  }

  function sendComposition(event, kind) {
    send({
      type: "composition",
      event: kind,
      data: event.data || el.textSink.value || "",
    });
  }

  function flushTextSink() {
    if (!el.textSink) {
      return;
    }
    const text = el.textSink.value;
    el.textSink.value = "";
    if (text) {
      send({ type: "key", event: "type", text, mode: el.textMode ? el.textMode.value : "hybrid" });
    }
  }

  function handleRemoteKeyDown(event) {
    if (shouldIgnoreRemoteKey(event)) {
      return;
    }
    if (isPasteShortcut(event)) {
      event.preventDefault();
      pasteClipboard();
      return;
    }
    if (isCopyShortcut(event)) {
      event.preventDefault();
      send({ type: "copy" });
      focusRemoteInput();
      return;
    }
    if (isCutShortcut(event)) {
      event.preventDefault();
      send({ type: "cut" });
      return;
    }
    if (document.activeElement === el.textSink && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === " ") {
      event.preventDefault();
      state.suppressedKeyUps.add(event.code || event.key);
      sendKeyPress(event);
      return;
    }
    if (shouldLetTextSinkHandle(event)) {
      return;
    }
    event.preventDefault();
    sendKey(event, "down");
  }

  function handleRemoteKeyUp(event) {
    if (shouldIgnoreRemoteKey(event)) {
      return;
    }
    const suppressKey = event.code || event.key;
    if (state.suppressedKeyUps.has(suppressKey)) {
      state.suppressedKeyUps.delete(suppressKey);
      event.preventDefault();
      return;
    }
    if (
      document.activeElement === el.textSink &&
      !modifierKeys.has(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (event.isComposing || event.key.length === 1 || event.key === "Process" || event.key === "Dead")
    ) {
      return;
    }
    event.preventDefault();
    sendKey(event, "up");
  }

  function handleViewportWheel(event) {
    event.preventDefault();
    sendMouse(event, "wheel");
  }

  function startPing() {
    stopPing();
    state.pingTimer = window.setInterval(() => {
      send({ type: "ping", client_ts: Date.now() });
    }, 1000);
  }

  function stopPing() {
    if (state.pingTimer) {
      window.clearInterval(state.pingTimer);
      state.pingTimer = 0;
    }
  }

  async function resetProfile() {
    const ok = window.confirm("Clear the remote browser profile under /tmp and restart the browser session?");
    if (!ok) {
      return;
    }
    if (state.ws) {
      state.ws.close(1000, "reset profile");
    }
    try {
      const origin = normalizeServerOrigin();
      const response = await fetch(`${origin}/browser/reset-profile`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || `HTTP ${response.status}`);
      }
      addLog("info", payload.message || "profile cleared");
      await checkHealth();
    } catch (err) {
      addLog("error", `profile reset failed: ${err.message}`);
    }
  }

  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        addLog("info", "clipboard is empty");
        return;
      }
      send({ type: "paste", text, mode: el.textMode ? el.textMode.value : "hybrid" });
      addLog("info", `paste sent (${text.length} chars)`);
      focusRemoteInput();
    } catch (err) {
      addLog("warn", `clipboard read failed: ${err.message}`);
    }
  }

  function handleTextSinkPaste(event) {
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    if (!text) {
      window.setTimeout(flushTextSink, 0);
      return;
    }
    event.preventDefault();
    send({ type: "paste", text, mode: el.textMode ? el.textMode.value : "hybrid" });
    addLog("info", `paste sent (${text.length} chars)`);
    focusRemoteInput();
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function filesPayloadFromList(fileList) {
    const selected = Array.from(fileList || []).slice(0, maxUploadFiles);
    const tooLarge = selected.find((file) => file.size > maxUploadFileBytes);
    if (tooLarge) {
      throw new Error(`file exceeds ${Math.round(maxUploadFileBytes / 1024 / 1024)} MB limit`);
    }
    const files = [];
    for (const file of selected) {
      files.push({
        name: file.name || "upload.bin",
        mime: file.type || "application/octet-stream",
        size: file.size,
        data: await readFileAsBase64(file),
      });
    }
    return files;
  }

  async function uploadSelectedFiles() {
    const input = el.uploadInput;
    if (!input || !input.files || input.files.length === 0) {
      return;
    }
    try {
      const files = await filesPayloadFromList(input.files);
      if (send({ type: "files", files })) {
        addLog("info", `upload sent (${files.length} file${files.length === 1 ? "" : "s"})`);
      }
    } catch (err) {
      addLog("error", `upload failed: ${err.message}`);
    } finally {
      input.value = "";
      focusRemoteInput();
    }
  }

  async function dropFilesIntoViewport(event) {
    const fileList = event.dataTransfer && event.dataTransfer.files;
    if (!fileList || fileList.length === 0) {
      return;
    }
    event.preventDefault();
    const point = viewportPoint(event);
    try {
      const files = await filesPayloadFromList(fileList);
      if (send({ type: "file_drop", x: point.x, y: point.y, files })) {
        addLog("info", `file drop sent (${files.length} file${files.length === 1 ? "" : "s"})`);
      }
    } catch (err) {
      addLog("error", `file drop failed: ${err.message}`);
    } finally {
      focusRemoteInput();
    }
  }

  function bindEvents() {
    el.addressForm.addEventListener("submit", (event) => {
      event.preventDefault();
      navigateToAddress();
    });
    el.backBtn.addEventListener("click", () => send({ type: "back" }));
    el.forwardBtn.addEventListener("click", () => send({ type: "forward" }));
    el.reloadBtn.addEventListener("click", () => send({ type: "reload" }));
    el.stopBtn.addEventListener("click", () => send({ type: "stop" }));
    el.connectBtn.addEventListener("click", connect);
    el.healthBtn.addEventListener("click", checkHealth);
    el.resetProfileBtn.addEventListener("click", resetProfile);
    el.applyStreamBtn.addEventListener("click", applyStreamSettings);
    el.scaleSelect.addEventListener("change", applyScale);
    el.copyBtn.addEventListener("click", () => {
      send({ type: "copy" });
      focusRemoteInput();
    });
    el.pasteBtn.addEventListener("click", pasteClipboard);
    if (el.uploadInput) {
      el.uploadInput.addEventListener("change", uploadSelectedFiles);
    }
    el.clearLogBtn.addEventListener("click", () => {
      el.debugLog.textContent = "";
    });

    el.viewportCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
    el.viewportCanvas.addEventListener("mousedown", (event) => {
      event.preventDefault();
      state.mouseDown = true;
      focusRemoteInput();
      sendMouse(event, "down");
    });
    const handleMouseUp = (event) => {
      if (!state.mouseDown) {
        return;
      }
      event.preventDefault();
      state.mouseDown = false;
      sendMouse(event, "up");
    };
    const handleMouseMove = (event) => {
      if (!state.mouseDown && event.target !== el.viewportCanvas) {
        return;
      }
      const now = performance.now();
      if (now - state.lastMouseMoveAt < 25 && !state.mouseDown) {
        return;
      }
      state.lastMouseMoveAt = now;
      sendMouse(event, "move");
    };
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("mouseup", handleMouseUp);
    el.viewportCanvas.addEventListener(
      "wheel",
      handleViewportWheel,
      { passive: false },
    );
    el.viewportCanvas.addEventListener("dragover", (event) => event.preventDefault());
    el.viewportCanvas.addEventListener("drop", dropFilesIntoViewport);
    el.viewportCanvas.addEventListener("touchstart", (event) => sendTouch(event, "start"), { passive: false });
    el.viewportCanvas.addEventListener("touchmove", (event) => sendTouch(event, "move"), { passive: false });
    window.addEventListener("touchmove", (event) => sendActiveTouch(event, "move"), { passive: false });
    window.addEventListener("touchend", (event) => sendActiveTouch(event, "end"), { passive: false });
    window.addEventListener("touchcancel", (event) => sendActiveTouch(event, "cancel"), { passive: false });
    el.viewportShell.addEventListener(
      "wheel",
      (event) => {
        if (event.target === el.viewportCanvas) {
          return;
        }
        handleViewportWheel(event);
      },
      { passive: false },
    );

    el.viewportCanvas.addEventListener("keydown", handleRemoteKeyDown);
    el.viewportCanvas.addEventListener("keyup", handleRemoteKeyUp);
    if (el.textSink) {
      el.textSink.addEventListener("keydown", handleRemoteKeyDown);
      el.textSink.addEventListener("keyup", handleRemoteKeyUp);
      el.textSink.addEventListener("compositionstart", () => {
        state.composingText = true;
        send({ type: "composition", event: "start", data: "" });
      });
      el.textSink.addEventListener("compositionupdate", (event) => {
        sendComposition(event, "update");
      });
      el.textSink.addEventListener("compositionend", (event) => {
        state.composingText = false;
        sendComposition(event, "end");
        window.setTimeout(flushTextSink, 0);
      });
      el.textSink.addEventListener("input", (event) => {
        if (state.composingText || event.isComposing) {
          return;
        }
        flushTextSink();
      });
      el.textSink.addEventListener("paste", handleTextSinkPaste);
    }

    window.addEventListener("resize", applyScale);
  }

  function startLocalFpsCounter() {
    state.localFpsTimer = window.setInterval(() => {
      if (!state.connected) {
        return;
      }
      if (el.fpsText.textContent === "0") {
        el.fpsText.textContent = String(state.localFrameCount);
      }
      state.localFrameCount = 0;
    }, 1000);
  }

  function applyUrlOptions() {
    const params = new URLSearchParams(window.location.search);
    const proxy = params.get("proxy");
    if (proxy) {
      el.serverOrigin.value = proxy;
    }
    const initialUrl = params.get("url");
    if (initialUrl) {
      el.addressInput.value = normalizeAddress(initialUrl);
    }
  }

  function init() {
    bindEvents();
    applyUrlOptions();
    applyScale();
    checkHealth();
    state.healthTimer = window.setInterval(checkHealth, 5000);
    startLocalFpsCounter();
    connect();
    addLog("info", "Browser Lab UI loaded");
  }

  window.addEventListener("beforeunload", () => {
    if (state.ws) {
      state.ws.close(1000, "page unload");
    }
    if (state.healthTimer) {
      window.clearInterval(state.healthTimer);
    }
    if (state.localFpsTimer) {
      window.clearInterval(state.localFpsTimer);
    }
  });

  init();
})();
