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

  function viewportPoint(event) {
    const rect = el.viewportCanvas.getBoundingClientRect();
    const scaleX = el.viewportCanvas.width / Math.max(1, rect.width);
    const scaleY = el.viewportCanvas.height / Math.max(1, rect.height);
    const x = Math.max(0, Math.min(el.viewportCanvas.width, (event.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(el.viewportCanvas.height, (event.clientY - rect.top) * scaleY));
    return { x: Math.round(x), y: Math.round(y) };
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
    return event.isComposing || event.key.length === 1 || event.key === "Process" || event.key === "Dead";
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
    window.addEventListener("mouseup", (event) => {
      if (!state.mouseDown) {
        return;
      }
      event.preventDefault();
      state.mouseDown = false;
      sendMouse(event, "up");
    });
    el.viewportCanvas.addEventListener("mousemove", (event) => {
      const now = performance.now();
      if (now - state.lastMouseMoveAt < 25 && !state.mouseDown) {
        return;
      }
      state.lastMouseMoveAt = now;
      sendMouse(event, "move");
    });
    el.viewportCanvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        sendMouse(event, "wheel");
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
      el.textSink.addEventListener("paste", () => {
        window.setTimeout(flushTextSink, 0);
      });
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
