(async function () {
  const participantLayer = document.getElementById("participants");
  const chatPanel = document.getElementById("chat-panel");
  const chatLog = document.getElementById("chat-log");
  const chatControls = document.getElementById("chat-controls");
  const chatDrag = document.getElementById("chat-drag");
  const chatResize = document.getElementById("chat-resize");
  const chatFontDown = document.getElementById("chat-font-down");
  const chatFontUp = document.getElementById("chat-font-up");
  const chatFade = document.getElementById("chat-fade");
  const chatToggle = document.getElementById("chat-toggle");
  const topicTitle = document.getElementById("topic-title");
  const topicEditor = document.getElementById("topic-editor");
  const topicResize = document.getElementById("topic-resize");
  const topicControls = document.getElementById("topic-controls");
  const topicMove = document.getElementById("topic-move");
  const topicEdit = document.getElementById("topic-edit");
  const avatarSizeDown = document.getElementById("avatar-size-down");
  const avatarSizeUp = document.getElementById("avatar-size-up");
  const bubbleSizeDown = document.getElementById("bubble-size-down");
  const bubbleSizeUp = document.getElementById("bubble-size-up");
  const entryEffect = document.getElementById("entry-effect");
  const exitEffect = document.getElementById("exit-effect");
  const lifecycleSec = document.getElementById("lifecycle-sec");
  const toastStyle = document.getElementById("toast-style");
  const entryMessageTemplate = document.getElementById("entry-message-template");
  const exitMessageTemplate = document.getElementById("exit-message-template");
  const toastSizeDown = document.getElementById("toast-size-down");
  const toastSizeUp = document.getElementById("toast-size-up");
  const toastHandle = document.getElementById("toast-handle");
  const eventToasts = document.getElementById("event-toasts");
  const canvas = document.getElementById("scene");
  const MAX_CHAT_LINES = 50;
  const CHAT_SETTINGS_KEY = "videochat.chatPanelSettings.v2";
  const TOPIC_SETTINGS_KEY = "videochat.topicSettings.v1";
  const AVATAR_SETTINGS_KEY = "videochat.avatarSettings.v1";
  const CAMERA_SETTINGS_KEY = "videochat.cameraSettings.v1";
  const EFFECT_SETTINGS_KEY = "videochat.effectSettings.v1";
  const TOAST_SETTINGS_KEY = "videochat.toastSettings.v1";

  const state = {
    participants: new Map(),
    elements: new Map(),
    characters: new Map(),
    debugMessages: [
      { type: "text", text: "안녕하세요?" },
      { type: "text", text: "오늘은 시장 분위기랑 주요 뉴스 흐름을 같이 보면서 천천히 이야기해보려고 합니다." },
      { type: "text", text: "이 문장은 일부러 길게 넣은 테스트입니다. 말풍선과 오른쪽 채팅 내역에서 줄바꿈이 자연스럽게 되는지 확인합니다." },
      { type: "photo" },
      { type: "sticker" },
      { type: "text", text: "사진 메시지 다음에도 일반 대사가 계속 잘 쌓이는지 확인하는 중입니다." },
    ],
    cfg: {
      chat_ws_url: "ws://127.0.0.1:9292/ws",
      host_user_id: "",
      host_username: "",
      host_name: "",
      mock_avatar_urls: [],
      debug_speech: false,
    },
    view: {
      yaw: 0,
      distance: 9.4,
      height: 3.7,
      target: new THREE.Vector3(0, 1.05, 0.2),
      screenOffsetX: 0,
      screenOffsetY: 0,
      dragging: false,
      dragLast: null,
    },
    keys: new Set(),
    mockCount: 0,
    mockBaseCount: 0,
    mockRoster: [],
    leaving: new Map(),
    pendingEntrants: new Set(),
    hasSnapshot: false,
    layoutSettlingUntil: 0,
    speechOrder: 0,
    chatSettings: null,
    topicSettings: null,
    avatarSettings: null,
    effectSettings: null,
    toastSettings: null,
    cameraUpdate: null,
    three: null,
  };

  const DEFAULT_CAMERA_VIEW = {
    yaw: state.view.yaw,
    distance: state.view.distance,
    height: state.view.height,
    target: { x: state.view.target.x, y: state.view.target.y, z: state.view.target.z },
    screenOffsetX: 0,
    screenOffsetY: 0,
  };

  const LEVEL_TIERS = [
    { min: 1, max: 9, name: "Seed", color: "#b7c6d8", glow: "rgba(183,198,216,0.22)" },
    { min: 10, max: 19, name: "Sprout", color: "#78d98e", glow: "rgba(120,217,142,0.28)" },
    { min: 20, max: 34, name: "Aqua", color: "#60d4ff", glow: "rgba(96,212,255,0.32)" },
    { min: 35, max: 49, name: "Violet", color: "#b08cff", glow: "rgba(176,140,255,0.34)" },
    { min: 50, max: 69, name: "Gold", color: "#ffd86a", glow: "rgba(255,216,106,0.36)" },
    { min: 70, max: 89, name: "Crimson", color: "#ff7a74", glow: "rgba(255,122,116,0.4)" },
    { min: 90, max: 99, name: "Mythic", color: "#ff4b5f", glow: "rgba(255,75,95,0.58)" },
  ];
  const SPEAKER_PALETTE = [
    "#ff6b6b", "#4dabf7", "#ffd43b", "#69db7c", "#b197fc", "#ff922b",
    "#66d9e8", "#f783ac", "#a9e34b", "#ffa8a8", "#74c0fc", "#e599f7",
    "#8ce99a", "#ffc078", "#91a7ff", "#f06595", "#c0eb75", "#63e6be",
    "#ffe066", "#da77f2", "#5c7cfa", "#ff8787", "#94d82d", "#faa2c1",
    "#22b8cf", "#fab005", "#9775fa", "#51cf66", "#ff9f1c", "#e64980",
  ];

  try {
    state.cfg = Object.assign(state.cfg, await fetch("/config").then((r) => r.json()));
  } catch (_) {}
  const params = new URLSearchParams(location.search);
  if (params.get("debug_speech") === "1") state.cfg.debug_speech = true;
  state.mockCount = Math.min(120, Math.max(0, Number(params.get("mock_participants") || params.get("mock") || 0) || 0));
  state.mockBaseCount = state.mockCount;
  if (state.mockCount > 0 && params.get("debug_speech") !== "0") state.cfg.debug_speech = true;

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function loadCameraSettings() {
    try {
      const raw = localStorage.getItem(CAMERA_SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return;
      if (Number.isFinite(Number(s.yaw))) state.view.yaw = Number(s.yaw);
      if (Number.isFinite(Number(s.distance))) state.view.distance = Number(s.distance);
      if (Number.isFinite(Number(s.height))) state.view.height = Number(s.height);
      if (Number.isFinite(Number(s.screenOffsetX))) state.view.screenOffsetX = Number(s.screenOffsetX);
      if (Number.isFinite(Number(s.screenOffsetY))) state.view.screenOffsetY = Number(s.screenOffsetY);
      if (s.target && typeof s.target === "object") {
        const x = Number(s.target.x);
        const y = Number(s.target.y);
        const z = Number(s.target.z);
        if (Number.isFinite(x)) state.view.target.x = x;
        if (Number.isFinite(y)) state.view.target.y = y;
        if (Number.isFinite(z)) state.view.target.z = z;
      }
      if (Number.isFinite(Number(s.fov))) state.view.fov = Number(s.fov);
    } catch (_) {}
  }

  function saveCameraSettings() {
    const camera = state.three?.camera;
    storageSet(CAMERA_SETTINGS_KEY, JSON.stringify({
      yaw: state.view.yaw,
      distance: state.view.distance,
      height: state.view.height,
      target: {
        x: state.view.target.x,
        y: state.view.target.y,
        z: state.view.target.z,
      },
      screenOffsetX: state.view.screenOffsetX,
      screenOffsetY: state.view.screenOffsetY,
      fov: camera?.fov || state.view.fov || 45,
    }));
  }

  loadCameraSettings();

  function applySceneScreenOffset() {
    const x = Math.round(state.view.screenOffsetX || 0);
    const y = Math.round(state.view.screenOffsetY || 0);
    if (canvas) canvas.style.transform = `translate(${x}px, ${y}px)`;
    if (participantLayer) participantLayer.style.transform = `translate(${x}px, ${y}px)`;
  }

  function defaultChatSettings() {
    const w = Math.min(360, Math.max(280, Math.round(window.innerWidth * 0.26)));
    const marginY = 72;
    return {
      x: Math.max(16, window.innerWidth - w - 28),
      y: marginY,
      w,
      h: Math.max(260, window.innerHeight - marginY * 2),
      fontSize: 18,
      fadeSec: -1,
      hidden: false,
    };
  }

  function loadChatSettings() {
    try {
      const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
      return raw ? Object.assign(defaultChatSettings(), JSON.parse(raw)) : defaultChatSettings();
    } catch (_) {
      return defaultChatSettings();
    }
  }

  function saveChatSettings() {
    if (!state.chatSettings) return;
    storageSet(CHAT_SETTINGS_KEY, JSON.stringify(state.chatSettings));
  }

  function clampChatSettings(s) {
    const minW = 260;
    const minH = 180;
    const viewportPad = 6;
    s.w = Math.min(window.innerWidth - viewportPad * 2, Math.max(minW, Number(s.w) || minW));
    s.h = Math.min(window.innerHeight - viewportPad * 2, Math.max(minH, Number(s.h) || minH));
    s.x = Math.min(window.innerWidth - s.w - 6, Math.max(6, Number(s.x) || 6));
    s.y = Math.min(window.innerHeight - s.h - 6, Math.max(6, Number(s.y) || 6));
    s.fontSize = Math.min(34, Math.max(10, Number(s.fontSize) || 18));
    s.fadeSec = Number.isFinite(Number(s.fadeSec)) ? Number(s.fadeSec) : -1;
  }

  function applyChatSettings() {
    if (!chatPanel || !state.chatSettings) return;
    clampChatSettings(state.chatSettings);
    const s = state.chatSettings;
    chatPanel.style.left = `${s.x}px`;
    chatPanel.style.top = `${s.y}px`;
    chatPanel.style.width = `${s.w}px`;
    chatPanel.style.height = `${s.h}px`;
    document.documentElement.style.setProperty("--videochat-chat-font-size", `${s.fontSize}px`);
    if (chatFade) chatFade.value = String(s.fadeSec);
    chatPanel.classList.toggle("chat-hidden", !!s.hidden);
    if (chatToggle) chatToggle.textContent = s.hidden ? "show" : "hide";
  }

  function setupChatControls() {
    state.chatSettings = loadChatSettings();
    applyChatSettings();

    chatFontDown?.addEventListener("click", () => {
      state.chatSettings.fontSize -= 1;
      applyChatSettings();
      saveChatSettings();
    });
    chatFontUp?.addEventListener("click", () => {
      state.chatSettings.fontSize += 1;
      applyChatSettings();
      saveChatSettings();
    });
    chatFade?.addEventListener("change", () => {
      const value = Number(chatFade.value);
      if (!Number.isFinite(value)) return;
      state.chatSettings.fadeSec = value;
      applyChatSettings();
      saveChatSettings();
    });
    chatFade?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
    });
    chatToggle?.addEventListener("click", () => {
      state.chatSettings.hidden = !state.chatSettings.hidden;
      applyChatSettings();
      saveChatSettings();
    });

    let dragMode = null;
    let start = null;
    function begin(ev, mode) {
      if (!state.chatSettings) return;
      ev.preventDefault();
      dragMode = mode;
      start = {
        x: ev.clientX,
        y: ev.clientY,
        settings: { ...state.chatSettings },
      };
      chatControls?.classList.add("dragging");
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    }
    function move(ev) {
      if (!dragMode || !start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (dragMode === "move") {
        state.chatSettings.x = start.settings.x + dx;
        state.chatSettings.y = start.settings.y + dy;
      } else {
        state.chatSettings.w = start.settings.w + dx;
        state.chatSettings.h = start.settings.h + dy;
      }
      applyChatSettings();
    }
    function end() {
      if (!dragMode) return;
      dragMode = null;
      start = null;
      chatControls?.classList.remove("dragging");
      saveChatSettings();
    }
    chatDrag?.addEventListener("pointerdown", (ev) => begin(ev, "move"));
    chatResize?.addEventListener("pointerdown", (ev) => begin(ev, "resize"));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("resize", () => {
      applyChatSettings();
      saveChatSettings();
    });
  }

  function defaultTopicSettings() {
    const w = Math.min(820, Math.max(360, Math.round(window.innerWidth * 0.5)));
    return {
      text: "",
      x: Math.round((window.innerWidth - w) / 2),
      y: 22,
      w,
      fontSize: 28,
    };
  }

  function loadTopicSettings() {
    try {
      const raw = localStorage.getItem(TOPIC_SETTINGS_KEY);
      return raw ? Object.assign(defaultTopicSettings(), JSON.parse(raw)) : defaultTopicSettings();
    } catch (_) {
      return defaultTopicSettings();
    }
  }

  function saveTopicSettings() {
    if (!state.topicSettings) return;
    storageSet(TOPIC_SETTINGS_KEY, JSON.stringify(state.topicSettings));
  }

  function clampTopicSettings(s) {
    const minW = 220;
    s.w = Math.min(window.innerWidth - 12, Math.max(minW, Number(s.w) || minW));
    s.x = Math.min(window.innerWidth - s.w - 6, Math.max(6, Number(s.x) || 6));
    s.y = Math.min(window.innerHeight - 80, Math.max(6, Number(s.y) || 6));
    s.fontSize = Math.min(140, Math.max(16, Number(s.fontSize) || 28));
    s.text = String(s.text || "");
  }

  function applyTopicSettings(editing = false) {
    if (!topicTitle || !state.topicSettings) return;
    clampTopicSettings(state.topicSettings);
    const s = state.topicSettings;
    const visible = !!s.text.trim() || editing;
    topicTitle.textContent = s.text;
    topicTitle.classList.toggle("show", visible && !editing);
    topicTitle.style.left = `${s.x}px`;
    topicTitle.style.top = `${s.y}px`;
    topicTitle.style.width = "max-content";
    topicTitle.style.fontSize = `${s.fontSize}px`;
    if (topicEditor) {
      topicEditor.wrap = "off";
      topicEditor.value = s.text;
      topicEditor.style.left = `${s.x}px`;
      topicEditor.style.top = `${s.y}px`;
      topicEditor.style.width = `${s.w}px`;
      topicEditor.style.fontSize = `${s.fontSize}px`;
      topicEditor.classList.toggle("editing", editing);
    }
    const box = editing ? topicEditor : topicTitle;
    const rect = box?.getBoundingClientRect();
    if (topicResize) {
      const right = rect?.right ?? (s.x + s.w);
      const bottom = rect?.bottom ?? (s.y + 52);
      topicResize.style.left = `${right - 18}px`;
      topicResize.style.top = `${bottom - 18}px`;
      topicResize.classList.toggle("show", visible || editing);
    }
    if (topicControls) {
      const right = rect?.right ?? (s.x + s.w);
      const top = rect?.top ?? s.y;
      topicControls.style.left = `${right + 8}px`;
      topicControls.style.top = `${top + 8}px`;
    }
  }

  function refreshTopicLayout(editing = false) {
    applyTopicSettings(editing);
    requestAnimationFrame(() => applyTopicSettings(editing));
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => applyTopicSettings(editing)).catch(() => {});
    }
  }

  function startTopicEdit() {
    if (!topicEditor || !state.topicSettings) return;
    applyTopicSettings(true);
    topicEditor.focus();
    topicEditor.setSelectionRange(topicEditor.value.length, topicEditor.value.length);
  }

  function commitTopicEdit() {
    if (!topicEditor || !state.topicSettings) return;
    state.topicSettings.text = topicEditor.value;
    applyTopicSettings(false);
    saveTopicSettings();
  }

  function setupTopicControls() {
    state.topicSettings = loadTopicSettings();
    if (params.has("title")) state.topicSettings.text = params.get("title") || "";
    refreshTopicLayout(false);

    topicEdit?.addEventListener("click", startTopicEdit);
    topicTitle?.addEventListener("dblclick", startTopicEdit);
    topicEditor?.addEventListener("input", () => {
      state.topicSettings.text = topicEditor.value;
      refreshTopicLayout(true);
      saveTopicSettings();
    });
    topicEditor?.addEventListener("blur", commitTopicEdit);
    topicEditor?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") {
        topicEditor.value = state.topicSettings.text;
        refreshTopicLayout(false);
      }
    });

    let mode = null;
    let start = null;
    function begin(ev, nextMode) {
      ev.preventDefault();
      mode = nextMode;
      start = {
        x: ev.clientX,
        y: ev.clientY,
        settings: { ...state.topicSettings },
      };
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    }
    function move(ev) {
      if (!mode || !start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (mode === "move") {
        state.topicSettings.x = start.settings.x + dx;
        state.topicSettings.y = start.settings.y + dy;
      } else {
        state.topicSettings.fontSize = start.settings.fontSize + (dx + dy) * 0.1;
      }
      refreshTopicLayout(topicEditor?.classList.contains("editing"));
    }
    function end() {
      if (!mode) return;
      mode = null;
      start = null;
      saveTopicSettings();
    }
    topicMove?.addEventListener("pointerdown", (ev) => begin(ev, "move"));
    topicTitle?.addEventListener("pointerdown", (ev) => {
      if (topicEditor?.classList.contains("editing")) return;
      begin(ev, "move");
    });
    topicResize?.addEventListener("pointerdown", (ev) => begin(ev, "resize"));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("resize", () => {
      refreshTopicLayout(topicEditor?.classList.contains("editing"));
      saveTopicSettings();
    });
  }

  function defaultAvatarSettings() {
    return {
      avatarScale: 1,
      bubbleScale: 1,
    };
  }

  function loadAvatarSettings() {
    try {
      const raw = localStorage.getItem(AVATAR_SETTINGS_KEY);
      return raw ? Object.assign(defaultAvatarSettings(), JSON.parse(raw)) : defaultAvatarSettings();
    } catch (_) {
      return defaultAvatarSettings();
    }
  }

  function saveAvatarSettings() {
    if (!state.avatarSettings) return;
    storageSet(AVATAR_SETTINGS_KEY, JSON.stringify(state.avatarSettings));
  }

  function applyAvatarSettings() {
    if (!state.avatarSettings) return;
    state.avatarSettings.avatarScale = Math.min(1.8, Math.max(0.55, Number(state.avatarSettings.avatarScale) || 1));
    state.avatarSettings.bubbleScale = Math.min(1.8, Math.max(0.55, Number(state.avatarSettings.bubbleScale) || 1));
    document.documentElement.style.setProperty("--avatar-ui-scale", String(state.avatarSettings.avatarScale));
    document.documentElement.style.setProperty("--bubble-ui-scale", String(state.avatarSettings.bubbleScale));
    renderParticipants();
  }

  function setupAvatarControls() {
    state.avatarSettings = loadAvatarSettings();
    applyAvatarSettings();
    avatarSizeDown?.addEventListener("click", () => {
      state.avatarSettings.avatarScale -= 0.08;
      applyAvatarSettings();
      saveAvatarSettings();
    });
    avatarSizeUp?.addEventListener("click", () => {
      state.avatarSettings.avatarScale += 0.08;
      applyAvatarSettings();
      saveAvatarSettings();
    });
    bubbleSizeDown?.addEventListener("click", () => {
      state.avatarSettings.bubbleScale -= 0.08;
      applyAvatarSettings();
      saveAvatarSettings();
    });
    bubbleSizeUp?.addEventListener("click", () => {
      state.avatarSettings.bubbleScale += 0.08;
      applyAvatarSettings();
      saveAvatarSettings();
    });
  }

  function defaultEffectSettings() {
    return {
      entryEffect: "drop",
      exitEffect: "ascend",
      lifecycleSec: 6.5,
    };
  }

  function loadEffectSettings() {
    try {
      const raw = localStorage.getItem(EFFECT_SETTINGS_KEY);
      return raw ? Object.assign(defaultEffectSettings(), JSON.parse(raw)) : defaultEffectSettings();
    } catch (_) {
      return defaultEffectSettings();
    }
  }

  function saveEffectSettings() {
    if (!state.effectSettings) return;
    storageSet(EFFECT_SETTINGS_KEY, JSON.stringify(state.effectSettings));
  }

  function applyEffectSettings() {
    if (!state.effectSettings) return;
    const entryValues = new Set(["drop", "walk", "fade", "none"]);
    const exitValues = new Set(["ascend", "fade", "none"]);
    if (!entryValues.has(state.effectSettings.entryEffect)) state.effectSettings.entryEffect = "drop";
    if (!exitValues.has(state.effectSettings.exitEffect)) state.effectSettings.exitEffect = "ascend";
    state.effectSettings.lifecycleSec = clamp(Number(state.effectSettings.lifecycleSec) || 6.5, 1, 60);
    if (entryEffect) entryEffect.value = state.effectSettings.entryEffect;
    if (exitEffect) exitEffect.value = state.effectSettings.exitEffect;
    if (lifecycleSec) lifecycleSec.value = String(state.effectSettings.lifecycleSec);
  }

  function setupEffectControls() {
    state.effectSettings = loadEffectSettings();
    if (params.has("entry_effect")) state.effectSettings.entryEffect = params.get("entry_effect") || "drop";
    if (params.has("exit_effect")) state.effectSettings.exitEffect = params.get("exit_effect") || "ascend";
    if (params.has("debug_lifecycle_sec")) state.effectSettings.lifecycleSec = Number(params.get("debug_lifecycle_sec"));
    if (params.has("debug_lifecycle_interval")) state.effectSettings.lifecycleSec = Number(params.get("debug_lifecycle_interval"));
    applyEffectSettings();
    entryEffect?.addEventListener("change", () => {
      state.effectSettings.entryEffect = entryEffect.value;
      applyEffectSettings();
      saveEffectSettings();
    });
    exitEffect?.addEventListener("change", () => {
      state.effectSettings.exitEffect = exitEffect.value;
      applyEffectSettings();
      saveEffectSettings();
    });
    lifecycleSec?.addEventListener("change", () => {
      state.effectSettings.lifecycleSec = Number(lifecycleSec.value);
      applyEffectSettings();
      saveEffectSettings();
    });
    lifecycleSec?.addEventListener("keydown", (ev) => ev.stopPropagation());
  }

  function showEventToast(text, kind = "enter", color = "") {
    if (!eventToasts || !text) return;
    const el = document.createElement("div");
    el.className = `event-toast ${kind}`;
    if (color) el.style.setProperty("--event-name-color", color);
    if (typeof text === "object") {
      if (text.before) el.append(document.createTextNode(text.before));
      const name = document.createElement("span");
      name.className = "event-name";
      name.textContent = text.name || "누군가";
      el.append(name, document.createTextNode(text.after || ""));
    } else {
      el.textContent = String(text);
    }
    eventToasts.appendChild(el);
    while (eventToasts.children.length > 3) {
      const first = eventToasts.firstElementChild;
      first?.classList.add("pushing");
      setTimeout(() => first?.remove(), 360);
      break;
    }
    setTimeout(() => el.remove(), 4300);
  }

  function toastMessageParts(template, name, fallback) {
    const displayName = String(name || "누군가");
    const value = String(template || fallback || "{name}").trim() || fallback || "{name}";
    if (!value.includes("{name}")) {
      return { before: "", name: displayName, after: ` ${value}` };
    }
    const index = value.indexOf("{name}");
    return {
      before: value.slice(0, index),
      name: displayName,
      after: value.slice(index + "{name}".length),
    };
  }

  function defaultToastSettings() {
    return {
      x: 18,
      y: 18,
      scale: 1,
      style: "ember",
      entryTemplate: "{name} \uB4F1\uC7A5",
      exitTemplate: "{name} \uC548\uB155 \uB2E4\uC74C\uC5D0 \uB610\uBD10\uC694",
    };
  }

  function loadToastSettings() {
    try {
      const raw = localStorage.getItem(TOAST_SETTINGS_KEY);
      return raw ? Object.assign(defaultToastSettings(), JSON.parse(raw)) : defaultToastSettings();
    } catch (_) {
      return defaultToastSettings();
    }
  }

  function saveToastSettings() {
    if (!state.toastSettings) return;
    storageSet(TOAST_SETTINGS_KEY, JSON.stringify(state.toastSettings));
  }

  function applyToastSettings() {
    if (!state.toastSettings) return;
    const s = state.toastSettings;
    s.scale = clamp(Number(s.scale) || 1, 0.55, 3);
    s.x = clamp(Number(s.x) || 18, 0, Math.max(0, window.innerWidth - 80));
    s.y = clamp(Number(s.y) || 18, 0, Math.max(0, window.innerHeight - 80));
    const styles = new Set(["ember", "glass", "label", "signal"]);
    if (!styles.has(s.style)) s.style = "ember";
    s.entryTemplate = String(s.entryTemplate || "{name} \uB4F1\uC7A5");
    s.exitTemplate = String(s.exitTemplate || "{name} \uC548\uB155 \uB2E4\uC74C\uC5D0 \uB610\uBD10\uC694");
    if (toastStyle) toastStyle.value = s.style;
    if (entryMessageTemplate) entryMessageTemplate.value = s.entryTemplate;
    if (exitMessageTemplate) exitMessageTemplate.value = s.exitTemplate;
    if (toastHandle) {
      toastHandle.style.left = `${s.x}px`;
      toastHandle.style.top = `${s.y}px`;
    }
    if (eventToasts) {
      eventToasts.style.left = `${s.x}px`;
      eventToasts.style.top = `${s.y + 30}px`;
      eventToasts.style.setProperty("--event-toast-scale", String(s.scale));
      eventToasts.dataset.style = s.style;
    }
  }

  function setupToastControls() {
    state.toastSettings = loadToastSettings();
    applyToastSettings();
    toastSizeDown?.addEventListener("click", () => {
      state.toastSettings.scale -= 0.08;
      applyToastSettings();
      saveToastSettings();
    });
    toastSizeUp?.addEventListener("click", () => {
      state.toastSettings.scale += 0.08;
      applyToastSettings();
      saveToastSettings();
    });
    toastStyle?.addEventListener("change", () => {
      state.toastSettings.style = toastStyle.value;
      applyToastSettings();
      saveToastSettings();
    });
    entryMessageTemplate?.addEventListener("input", () => {
      state.toastSettings.entryTemplate = entryMessageTemplate.value;
      applyToastSettings();
      saveToastSettings();
    });
    exitMessageTemplate?.addEventListener("input", () => {
      state.toastSettings.exitTemplate = exitMessageTemplate.value;
      applyToastSettings();
      saveToastSettings();
    });
    entryMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
    exitMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
    let start = null;
    toastHandle?.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      start = {
        x: ev.clientX,
        y: ev.clientY,
        settings: { ...state.toastSettings },
      };
      toastHandle.setPointerCapture?.(ev.pointerId);
    });
    window.addEventListener("pointermove", (ev) => {
      if (!start || !state.toastSettings) return;
      state.toastSettings.x = start.settings.x + ev.clientX - start.x;
      state.toastSettings.y = start.settings.y + ev.clientY - start.y;
      applyToastSettings();
    });
    window.addEventListener("pointerup", () => {
      if (!start) return;
      start = null;
      saveToastSettings();
    });
    window.addEventListener("resize", () => {
      applyToastSettings();
      saveToastSettings();
    });
  }

  function setTopicTitle(text) {
    const value = String(text || "").trim();
    if (!topicTitle) return;
    topicTitle.textContent = value;
    topicTitle.classList.toggle("show", !!value);
    storageSet("videochat.topicTitle", value);
  }

  setupTopicControls();
  setupChatControls();
  setupAvatarControls();
  setupEffectControls();
  setupToastControls();

  function keyFor(p) {
    return String(p.id || p.username || p.name || "");
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededColor(key, offset) {
    const hue = (hashString(key) + offset) % 360;
    return new THREE.Color(`hsl(${hue}, 64%, 58%)`);
  }

  function speakerColor(key) {
    const idx = hashString(String(key || "unknown")) % SPEAKER_PALETTE.length;
    return SPEAKER_PALETTE[idx];
  }

  function colorForParticipantIndex(index) {
    if (index < SPEAKER_PALETTE.length) return SPEAKER_PALETTE[index];
    const hue = (index * 137.508 + 23) % 360;
    const saturation = index % 2 ? 84 : 68;
    const lightness = index % 3 === 0 ? 68 : 74;
    return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
  }

  function assignParticipantColors(rows) {
    let colorIndex = 0;
    for (const p of rows) {
      if (p.is_host) {
        p._displayColor = "#ffe889";
      } else {
        p._displayColor = colorForParticipantIndex(colorIndex);
        colorIndex += 1;
      }
    }
  }

  function participantColor(p) {
    if (p.is_host) return "#ffe889";
    return p._displayColor || speakerColor(keyFor(p));
  }

  function levelTier(level, isHost = false) {
    if (isHost) return LEVEL_TIERS[LEVEL_TIERS.length - 1];
    const value = Number(level);
    if (!Number.isFinite(value)) return null;
    return LEVEL_TIERS.find((tier) => value >= tier.min && value <= tier.max) || LEVEL_TIERS[0];
  }

  function speechColor(data, participantKey) {
    if (data.color) return data.color;
    if (participantKey && state.participants.has(participantKey)) {
      return participantColor(state.participants.get(participantKey));
    }
    return speakerColor(data.speaker_id || data.username || data.name || "offcall");
  }

  function speakerKey(data) {
    const id = String(data.speaker_id || "");
    if (id && state.participants.has(id)) return id;
    const username = String(data.username || "").replace(/^@/, "");
    if (username) {
      for (const p of state.participants.values()) {
        if (String(p.username || "").toLowerCase() === username.toLowerCase()) {
          return keyFor(p);
        }
      }
    }
    const name = String(data.name || "");
    for (const p of state.participants.values()) {
      if (String(p.name || "").toLowerCase() === name.toLowerCase()) return keyFor(p);
    }
    return "";
  }

  function layoutWorld(index, count, key = "") {
    const jitterKey = key || `${index}:${count}`;
    const jitterA = ((hashString(`${jitterKey}:a`) % 1000) / 1000 - 0.5);
    const jitterR = ((hashString(`${jitterKey}:r`) % 1000) / 1000 - 0.5);
    if (count > 8) {
      let ring = 0;
      let offset = 0;
      let capacity = count <= 14 ? 14 : 12;
      while (index >= offset + capacity) {
        offset += capacity;
        ring += 1;
        capacity = 14 + ring * 10;
      }
      const ringCount = Math.min(capacity, count - offset);
      const t = (index - offset + 0.5) / Math.max(1, ringCount);
      const baseRadius = count <= 14 ? 3.15 : count <= 28 ? 2.78 : 2.55;
      const radius = baseRadius + ring * 1.02 + jitterR * 0.34;
      const a = -Math.PI / 2 + t * Math.PI * 2 + ring * 0.23 + jitterA * 0.2;
      return {
        x: Math.cos(a) * radius,
        z: Math.sin(a) * radius + 0.25 + jitterR * 0.14,
        a,
      };
    }
    const radius = (count <= 2 ? 2.85 : count <= 5 ? 3.15 : 3.45) + jitterR * 0.28;
    const start = count <= 4 ? Math.PI * 0.12 : Math.PI * 0.1;
    const end = count <= 4 ? Math.PI * 0.88 : Math.PI * 0.9;
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const a = start + (end - start) * t + jitterA * 0.18;
    return {
      x: Math.cos(a) * radius,
      z: Math.sin(a) * radius + 0.05 + jitterR * 0.12,
      a,
    };
  }

  function characterScale(count, speaking) {
    const base = count >= 40 ? 0.46 : count >= 20 ? 0.56 : 0.72;
    return speaking ? base * 1.12 : base;
  }

  function avatarAnchorY(count) {
    if (count >= 40) return 1.16;
    if (count >= 20) return 1.3;
    return 1.5;
  }

  function avatarScreenLift(count) {
    if (count >= 40) return -6;
    if (count >= 20) return -14;
    return -28;
  }

  function initials(name) {
    return String(name || "?").trim().slice(0, 2).toUpperCase();
  }

  function eventDisplayName(name) {
    const value = String(name || "누군가").trim() || "누군가";
    return value.length > 14 ? `${value.slice(0, 13)}...` : value;
  }

  function ensureAvatar(p) {
    const key = keyFor(p);
    let el = state.elements.get(key);
    if (el) return el;
    el = document.createElement("div");
    el.className = "avatar";
    el.innerHTML = `
      <div class="bubble"></div>
      <div class="identity-card">
        <div class="crown"><span></span><span></span><span></span></div>
        <div class="entering-badge">입장중</div>
        <div class="portrait"><span class="initial"></span></div>
        <div class="text-stack">
          <div class="name"></div>
          <div class="level"></div>
        </div>
        <div class="status"></div>
      </div>
    `;
    participantLayer.appendChild(el);
    state.elements.set(key, el);
    return el;
  }

  function screenFromWorld(pos) {
    const { camera, renderer } = state.three;
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
    };
  }

  function facePointYawOnly(group, x, z, centerX = 0, centerZ = 0.25) {
    group.rotation.set(0, Math.atan2(centerX - x, centerZ - z), 0);
  }

  function setChildWorldPose(child, parent, worldPosition, worldQuaternion = null) {
    parent.updateMatrixWorld(true);
    child.position.copy(parent.worldToLocal(worldPosition.clone()));
    const parentQuat = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    child.quaternion.copy(parentQuat);
    if (worldQuaternion) child.quaternion.multiply(worldQuaternion);
  }

  function createCharacter(p) {
    const key = keyFor(p);
    const group = new THREE.Group();
    group.userData.key = key;
    group.userData.baseY = 0;
    group.userData.enterStartedAt = performance.now();
    group.userData.enterFrom = null;
    group.userData.enterDone = false;
    group.userData.entryEffect = state.effectSettings?.entryEffect || "drop";
    group.userData.exitEffect = state.effectSettings?.exitEffect || "ascend";

    const skin = seededColor(key, 34);
    const cloth = p.is_host ? new THREE.Color(0x63d8ff) : seededColor(key, 147);
    const accent = seededColor(key, 271);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.46, 5, 12),
      new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.72 })
    );
    body.position.y = 0.58;
    body.scale.x = 0.92 + (hashString(key) % 18) / 100;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 20, 16),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 })
    );
    head.position.y = 1.08;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101018 });
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.075, 1.1, 0.205);
    eyeR.position.set(0.075, 1.1, 0.205);
    group.add(eyeL, eyeR);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.245, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 0.82 })
    );
    hair.position.y = 1.16;
    hair.rotation.x = -0.18;
    group.add(hair);

    if (p.is_host) {
      const crown = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({
        color: 0xffd25a,
        emissive: 0x7a4a00,
        emissiveIntensity: 0.18,
        roughness: 0.45,
      });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.235, 0.08, 5), gold);
      band.position.y = 1.36;
      crown.add(band);
      const spikeGeo = new THREE.ConeGeometry(0.07, 0.24, 5);
      [-0.13, 0, 0.13].forEach((x, idx) => {
        const spike = new THREE.Mesh(spikeGeo, gold);
        spike.position.set(x, 1.51 + (idx === 1 ? 0.045 : 0), 0.01);
        crown.add(spike);
      });
      group.add(crown);
    }

    const armGeo = new THREE.CapsuleGeometry(0.055, 0.32, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
    const armL = new THREE.Mesh(armGeo, armMat);
    const armR = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.33, 0.69, 0.06);
    armR.position.set(0.33, 0.69, 0.06);
    armL.rotation.set(0.14, 0, -0.56);
    armR.rotation.set(0.14, 0, 0.56);
    group.add(armL, armR);

    const legGeo = new THREE.CapsuleGeometry(0.065, 0.3, 4, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x29334a, roughness: 0.78 });
    const legL = new THREE.Mesh(legGeo, legMat);
    const legR = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.12, 0.22, 0);
    legR.position.set(0.12, 0.22, 0);
    group.add(legL, legR);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    shadow.userData.isGroundShadow = true;
    group.add(shadow);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 2.9, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf4fbff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    beam.position.y = 1.3;
    beam.userData.isEffectBeam = true;
    beam.visible = false;
    group.add(beam);

    const flare = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 40),
      new THREE.MeshBasicMaterial({
        color: 0xeef8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    flare.rotation.x = -Math.PI / 2;
    flare.position.y = 0.035;
    flare.userData.isEffectFlare = true;
    flare.visible = false;
    group.add(flare);

    state.three.scene.add(group);
    state.characters.set(key, group);
    return group;
  }

  function removeMissingCharacters(liveKeys) {
    const now = performance.now();
    for (const [key, group] of state.characters) {
      if (!liveKeys.has(key) && !group.userData.leavingUntil) {
        const mode = state.effectSettings?.exitEffect || "ascend";
        const duration = mode === "none" ? 1 : mode === "fade" ? 1400 : 2600;
        const lift = mode === "ascend" ? 1.9 : 0.35;
        group.userData.leavingStartedAt = now;
        group.userData.leavingUntil = now + duration;
        group.userData.leaveFrom = group.position.clone();
        group.userData.leaveTo = group.position.clone().add(new THREE.Vector3(0, lift, 0));
        group.userData.exitEffect = mode;
        const p = group.userData.participant || {};
        const name = eventDisplayName(p.name || p.username);
        if (mode !== "none") {
          showEventToast(
            toastMessageParts(state.toastSettings?.exitTemplate, name, "{name} \uC548\uB155 \uB2E4\uC74C\uC5D0 \uB610\uBD10\uC694"),
            "leave",
            participantColor(p)
          );
        }
        state.leaving.set(key, {
          key,
          until: group.userData.leavingUntil,
          screen: { x: 0, y: 0 },
        });
      }
    }
  }

  function resolveAvatarOverlaps(liveKeys) {
    const items = [];
    for (const key of liveKeys) {
      const el = state.elements.get(key);
      if (!el || el.classList.contains("leaving")) continue;
      const card = el.querySelector(".identity-card");
      if (!card) continue;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      items.push({
        key,
        el,
        baseLeft: parseFloat(el.style.left) || 0,
        baseTop: parseFloat(el.style.top) || 0,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        startCx: rect.left + rect.width / 2,
        startCy: rect.top + rect.height / 2,
        w: rect.width,
        h: rect.height,
        speaking: el.classList.contains("speaking"),
      });
    }
    const pad = 10;
    for (let iter = 0; iter < 8; iter += 1) {
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i];
          const b = items[j];
          let dx = b.cx - a.cx;
          let dy = b.cy - a.cy;
          if (Math.abs(dx) < 0.001) dx = (hashString(`${a.key}:${b.key}`) % 2 ? 1 : -1) * 0.001;
          if (Math.abs(dy) < 0.001) dy = (hashString(`${b.key}:${a.key}`) % 2 ? 1 : -1) * 0.001;
          const overlapX = (a.w + b.w) / 2 + pad - Math.abs(dx);
          const overlapY = (a.h + b.h) / 2 + pad - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const lockA = a.speaking ? 0.25 : 1;
          const lockB = b.speaking ? 0.25 : 1;
          const total = lockA + lockB;
          const moveA = total ? lockA / total : 0.5;
          const moveB = total ? lockB / total : 0.5;

          if (overlapX < overlapY) {
            const push = Math.sign(dx) * overlapX;
            a.cx -= push * moveA;
            b.cx += push * moveB;
          } else {
            const push = Math.sign(dy) * overlapY;
            a.cy -= push * moveA;
            b.cy += push * moveB;
          }
        }
      }
      for (const item of items) {
        item.cx = clamp(item.cx, item.w / 2 + 8, window.innerWidth - item.w / 2 - 8);
        item.cy = clamp(item.cy, item.h / 2 + 8, window.innerHeight - item.h / 2 - 8);
      }
    }
    for (const item of items) {
      const dx = item.cx - item.startCx;
      const dy = item.cy - item.startCy;
      item.el.style.left = `${item.baseLeft + dx}px`;
      item.el.style.top = `${item.baseTop + dy}px`;
    }
  }

  function renderParticipants() {
    if (!state.three) return;
    const rows = Array.from(state.participants.values());
    rows.sort((a, b) => Number(b.is_host || 0) - Number(a.is_host || 0) || String(a.name).localeCompare(String(b.name)));
    assignParticipantColors(rows);
    participantLayer.classList.toggle("crowd", rows.length >= 20);
    participantLayer.classList.toggle("packed", rows.length >= 40);
    const liveKeys = new Set(rows.map(keyFor));
    removeMissingCharacters(liveKeys);
    const holdingLayout = state.leaving.size > 0;

    rows.forEach((p, i) => {
      const key = keyFor(p);
      const char = state.characters.get(key) || createCharacter(p);
      char.userData.participant = p;
      const layoutIndex = holdingLayout && Number.isFinite(char.userData.layoutIndex) ? char.userData.layoutIndex : i;
      const layoutCount = holdingLayout && Number.isFinite(char.userData.layoutCount) ? char.userData.layoutCount : rows.length;
      const wp = layoutWorld(layoutIndex, layoutCount, key);
      const target = new THREE.Vector3(wp.x, 0, wp.z);
      if (!char.userData.enterDone && !char.userData.enterFrom) {
        const mode = char.userData.entryEffect || state.effectSettings?.entryEffect || "drop";
        if (mode === "none") {
          char.userData.enterDone = true;
          char.position.copy(target);
        } else if (mode === "walk") {
          const edge = new THREE.Vector3(Math.cos(wp.a) * 6.15, 0, Math.sin(wp.a) * 6.15 + 0.05);
          char.userData.enterFrom = edge;
          char.position.copy(edge);
        } else if (mode === "fade") {
          char.userData.enterFrom = target.clone();
          char.position.copy(target);
        } else {
          char.userData.enterFrom = target.clone().add(new THREE.Vector3(0, 7.4, 0));
          char.position.copy(char.userData.enterFrom);
        }
      }
      facePointYawOnly(char, wp.x, wp.z);
      char.userData.target = target;
      char.userData.layout = wp;
      char.userData.layoutIndex = layoutIndex;
      char.userData.layoutCount = layoutCount;
      char.userData.leavingUntil = 0;
      state.leaving.delete(key);

      const el = ensureAvatar(p);
      el.classList.toggle("entering", !char.userData.enterDone);
      const anchor = (!char.userData.enterDone && char.userData.target)
        ? char.userData.target.clone()
        : char.position.clone();
      anchor.y = avatarAnchorY(rows.length);
      const sp = screenFromWorld(anchor);
      el.style.left = `${sp.x}px`;
      el.style.top = `${sp.y - avatarScreenLift(rows.length)}px`;
      el.style.zIndex = el.classList.contains("speaking")
        ? (el.dataset.speechZ || "22000")
        : (!char.userData.enterDone ? "21000" : String(Math.round(sp.y)));
      el.classList.remove("leaving");
      el.style.opacity = "";
      el.style.filter = "";
      el.classList.toggle("muted", !!p.muted);
      el.classList.toggle("host", !!p.is_host);
      el.classList.toggle("has-photo", !!p.avatar_url);
      el.classList.toggle("no-photo", !p.avatar_url);
      const levelValue = p.is_host ? 99 : Number(p.level || 1);
      const hasLevelValue = p.is_host || Number.isFinite(levelValue);
      const tier = levelTier(levelValue, !!p.is_host);
      const levelText = String(p.level_label || (hasLevelValue ? `Lv. ${levelValue}` : "")).trim();
      el.classList.toggle("has-level", !!levelText);
      el.style.setProperty("--level-color", tier?.color || "rgba(255,255,255,0.72)");
      el.style.setProperty("--level-glow", tier?.glow || "rgba(255,255,255,0.12)");
      el.style.setProperty("--speaker-color", participantColor(p));
      const displayName = p.name || p.username || "Unknown";
      const nameEl = el.querySelector(".name");
      nameEl.textContent = displayName;
      nameEl.title = displayName;
      el.querySelector(".level").textContent = levelText;
      el.querySelector(".initial").textContent = initials(p.name || p.username);

      const portrait = el.querySelector(".portrait");
      let img = portrait.querySelector("img");
      if (p.avatar_url) {
        if (!img) {
          img = document.createElement("img");
          img.onerror = () => {
            img.remove();
            portrait.classList.remove("has-photo");
          };
          portrait.appendChild(img);
        }
        img.src = p.avatar_url;
        portrait.classList.add("has-photo");
      } else {
        if (img) img.remove();
        portrait.classList.remove("has-photo");
      }
    });

    resolveAvatarOverlaps(liveKeys);

    const now = performance.now();
    for (const [key, leave] of state.leaving) {
      const group = state.characters.get(key);
      const el = state.elements.get(key);
      if (!group || !el) {
        state.leaving.delete(key);
        continue;
      }
      if (now >= leave.until) {
        state.three.scene.remove(group);
        state.characters.delete(key);
        el.remove();
        state.elements.delete(key);
        state.leaving.delete(key);
        state.layoutSettlingUntil = Math.max(state.layoutSettlingUntil || 0, now + 2200);
        continue;
      }
      const anchor = (group.userData.leaveFrom || group.position).clone();
      anchor.y = avatarAnchorY(rows.length) + 0.2;
      const sp = screenFromWorld(anchor);
      const start = group.userData.leavingStartedAt || now;
      const progress = clamp((now - start) / Math.max(1, leave.until - start), 0, 1);
      leave.screen = sp;
      el.style.left = `${sp.x}px`;
      el.style.top = `${sp.y - avatarScreenLift(rows.length)}px`;
      el.style.zIndex = String(20500);
      el.classList.add("leaving");
      el.style.opacity = String(Math.max(0, 1 - progress * 0.86));
      el.style.filter = `brightness(${1 + (1 - progress) * 0.35}) drop-shadow(0 0 ${Math.round(18 + (1 - progress) * 18)}px rgba(235,248,255,${0.38 * (1 - progress)}))`;
    }
  }

  function setSnapshot(data) {
    const previousKeys = new Set(state.participants.keys());
    const entrants = [];
    state.participants.clear();
    for (const p of data.participants || []) {
      const key = keyFor(p);
      state.participants.set(key, p);
      if (state.hasSnapshot && !previousKeys.has(key)) {
        state.pendingEntrants.add(key);
        entrants.push(p);
      }
    }
    const rows = Array.from(state.participants.values());
    rows.sort((a, b) => Number(b.is_host || 0) - Number(a.is_host || 0) || String(a.name).localeCompare(String(b.name)));
    assignParticipantColors(rows);
    for (const p of entrants) {
      showEventToast(
        toastMessageParts(state.toastSettings?.entryTemplate, eventDisplayName(p.name || p.username), "{name} \uB4F1\uC7A5"),
        "enter",
        participantColor(p)
      );
    }
    state.hasSnapshot = true;
    renderParticipants();
  }

  function mockParticipants(count) {
    const hostName = state.cfg.host_name || "NA";
    const hostUsername = state.cfg.host_username || "";
    const avatarUrls = Array.isArray(state.cfg.mock_avatar_urls) ? state.cfg.mock_avatar_urls : [];
    const guestAvatarUrls = avatarUrls.length > 1 ? avatarUrls.slice(1) : avatarUrls;
    const names = [
      "Blue", "Mint", "Echo", "Nova", "Mango", "Dawn", "Pixel", "Wave", "Sunny", "Berry",
      "River", "Cloud", "Night", "Comet", "Stone", "Pine", "Ruby", "Silver", "Orbit", "Lime",
    ];
    return Array.from({ length: count }, (_, i) => {
      const isHost = i === 0;
      const label = i === 1 ? "VeryLongNicknameForLayoutTest" : names[i % names.length];
      return {
        id: isHost ? state.cfg.host_user_id || "mock-host" : `mock-${i}`,
        username: isHost ? hostUsername : `mock_user_${String(i).padStart(2, "0")}`,
        name: isHost ? hostName : `${label} ${String(i).padStart(2, "0")}`,
        muted: !isHost && i % 4 !== 0,
        is_host: isHost,
        level: isHost ? 99 : 1,
        level_label: isHost ? "Lv. 99" : "",
        avatar_url: isHost && avatarUrls.length
          ? avatarUrls[0]
          : guestAvatarUrls.length && i % 3 !== 0
            ? guestAvatarUrls[i % guestAvatarUrls.length]
            : "",
      };
    });
  }

  function startDebugLifecycle() {
    if (state.mockBaseCount <= 0 || params.get("debug_lifecycle") !== "1") return;
    state.mockRoster = mockParticipants(state.mockBaseCount);
    setSnapshot({ type: "videochat_snapshot", participants: state.mockRoster });
    let nextId = state.mockBaseCount + 1;
    let tick = 0;
    const intervalSec = state.effectSettings?.lifecycleSec || 6.5;
    setInterval(() => {
      const minCount = Math.max(1, state.mockBaseCount - Math.min(4, Math.floor(state.mockBaseCount / 5)));
      const maxCount = Math.min(120, state.mockBaseCount + Math.min(8, Math.max(2, Math.floor(state.mockBaseCount / 4))));
      const canLeave = state.mockRoster.length > minCount;
      const canJoin = state.mockRoster.length < maxCount;
      const shouldJoin = !canLeave || (canJoin && tick % 3 !== 1);
      if (shouldJoin) {
        const guest = mockParticipants(nextId + 1).at(-1);
        guest.id = `mock-live-${nextId}`;
        guest.username = `live_user_${String(nextId).padStart(2, "0")}`;
        guest.name = `New ${String(nextId).padStart(2, "0")}`;
        guest.level = 1;
        guest.level_label = "";
        state.mockRoster.push(guest);
        nextId += 1;
      } else {
        const removable = state.mockRoster
          .map((p, index) => ({ p, index }))
          .filter((row) => !row.p.is_host);
        if (removable.length) {
          const row = removable[(tick * 5) % removable.length];
          state.mockRoster.splice(row.index, 1);
        }
      }
      tick += 1;
      setSnapshot({ type: "videochat_snapshot", participants: state.mockRoster });
    }, intervalSec * 1000);
  }

  function startDebugSpeech() {
    if (!state.cfg.debug_speech) return;
    let i = 0;
    const offstageNames = ["가상손님", "채팅테스트", "미참여유저"];
    setInterval(() => {
      const rows = Array.from(state.participants.values());
      const debug = state.debugMessages[i % state.debugMessages.length];
      if (!rows.length || i % 3 === 2) {
        const name = offstageNames[Math.floor(i / 3) % offstageNames.length];
        i += 1;
        showSpeech(debugPayload({ name, username: name }, debug));
        return;
      }
      const p = rows[i % rows.length];
      i += 1;
      showSpeech(debugPayload({
        name: p.name,
        username: p.username,
        speaker_id: p.id,
      }, debug));
    }, 2600);
  }

  function showSpeech(data) {
    if (!data) return;
    const type = data.type || "text";
    const isMedia = type === "photo" || type === "sticker";
    if (type !== "text" && !isMedia) return;
    if (type === "text" && typeof data.text !== "string") return;
    if (isMedia && !data.url) return;
    const key = speakerKey(data);
    addChatLine(data, !!key);
    const el = key ? state.elements.get(key) : null;
    const char = key ? state.characters.get(key) : null;
    if (el) {
      const bubble = el.querySelector(".bubble");
      bubble.replaceChildren();
      bubble.classList.toggle("photo", isMedia);
      bubble.classList.toggle("sticker", type === "sticker");
      if (isMedia) {
        bubble.appendChild(createMediaElement(data));
        if (typeof data.text === "string" && data.text.trim()) {
          const caption = document.createElement("span");
          caption.className = "photo-caption";
          caption.textContent = data.text;
          bubble.appendChild(caption);
        }
      } else {
        bubble.textContent = data.text;
      }
      const z = 22000 + (++state.speechOrder);
      el.dataset.speechZ = String(z);
      el.style.zIndex = String(z);
      el.classList.add("speaking");
      if (char) char.userData.speakingUntil = performance.now() + 5200;
      clearTimeout(el._speechTimer);
      el._speechTimer = setTimeout(() => {
        el.classList.remove("speaking");
        bubble.classList.remove("photo");
        bubble.classList.remove("sticker");
      }, 5200);
    }
  }

  function createMediaElement(data) {
    const media = document.createElement(data.media_type === "video" ? "video" : "img");
    media.src = data.url;
    if (media.tagName === "VIDEO") {
      media.autoplay = true;
      media.loop = true;
      media.muted = true;
      media.playsInline = true;
    } else {
      media.alt = "";
      media.decoding = "async";
    }
    return media;
  }

  function addChatLine(data, isParticipant) {
    if (!chatLog) return;
    const name = String(data.name || data.username || "미참여");
    const type = data.type || "text";
    const isMedia = type === "photo" || type === "sticker";
    const participantKey = speakerKey(data);
    const participant = participantKey ? state.participants.get(participantKey) : null;
    const isHost = !!(participant?.is_host || data.is_host);
    const explicitLevel = Number(data.level);
    const levelValue = participant
      ? (participant.is_host ? 99 : Number(participant.level || data.level || 1))
      : (isHost ? 99 : (Number.isFinite(explicitLevel) ? explicitLevel : 1));
    const tier = Number.isFinite(levelValue) ? levelTier(levelValue, isHost) : null;
    const item = document.createElement("div");
    item.className = `chat-line ${isParticipant ? "incall" : "offcall"}${isMedia ? ` photo ${type}` : ""}`;
    item.style.setProperty("--speaker-color", speechColor(data, participantKey));
    if (tier) {
      item.style.setProperty("--level-color", tier.color);
      item.style.setProperty("--level-glow", tier.glow);
    }
    const header = document.createElement("span");
    header.className = "chat-header";
    if (isHost) {
      const crown = document.createElement("span");
      crown.className = "chat-crown";
      crown.textContent = "♛";
      header.append(crown);
    }
    const who = document.createElement("span");
    who.className = "chat-name";
    who.textContent = name;
    header.append(who);
    if (Number.isFinite(levelValue)) {
      const level = document.createElement("span");
      level.className = "chat-level";
      level.textContent = data.level_label || `Lv. ${levelValue}`;
      header.append(level);
    }
    item.append(header);
    if (isMedia) {
      item.appendChild(createMediaElement(data));
      if (typeof data.text === "string" && data.text.trim()) {
        const msg = document.createElement("span");
        msg.className = "chat-text photo-caption";
        msg.textContent = data.text;
        item.appendChild(msg);
      }
    } else {
      const msg = document.createElement("span");
      msg.className = "chat-text";
      msg.textContent = String(data.text || "");
      item.append(document.createTextNode(": "), msg);
      if (data.stt_label) {
        const label = document.createElement("span");
        label.className = "stt-label";
        label.textContent = ` ${data.stt_label}`;
        item.appendChild(label);
      }
    }
    chatLog.appendChild(item);
    while (chatLog.children.length > MAX_CHAT_LINES) {
      chatLog.removeChild(chatLog.firstChild);
    }
    requestAnimationFrame(() => item.classList.add("show"));
    const fadeSec = state.chatSettings ? state.chatSettings.fadeSec : -1;
    if (fadeSec >= 0) {
      setTimeout(() => {
        item.classList.add("fade-out");
        setTimeout(() => item.remove(), 700);
      }, fadeSec * 1000);
    }
  }

  function debugPayload(base, debug) {
    if (debug.type === "photo" || debug.type === "sticker") {
      const urls = Array.isArray(state.cfg.mock_avatar_urls) ? state.cfg.mock_avatar_urls : [];
      return {
        type: debug.type,
        ...base,
        url: urls.length ? urls[(hashString(base.name || base.username || "photo") + 1) % urls.length] : fallbackPhotoUrl(),
        text: debug.type === "sticker" ? "✨" : "사진 캡션 테스트입니다.",
      };
    }
    return { type: "text", ...base, text: debug.text };
  }

  function fallbackPhotoUrl() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
        <rect width="640" height="360" fill="#18202d"/>
        <circle cx="146" cy="122" r="46" fill="#ffd56a"/>
        <path d="M70 300 226 172 320 250 392 196 570 300Z" fill="#3e8f68"/>
        <path d="M0 318H640V360H0Z" fill="#101722"/>
        <text x="320" y="326" text-anchor="middle" font-family="Segoe UI, Arial" font-size="34" font-weight="700" fill="#f8f8fb">photo debug</text>
      </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function asFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function angleFromPayload(data, key, keyDeg) {
    const deg = asFiniteNumber(data?.[keyDeg]);
    if (deg != null) return deg * Math.PI / 180;
    return asFiniteNumber(data?.[key]);
  }

  function applyCameraTarget(target, delta = false) {
    if (!target || typeof target !== "object") return;
    const x = asFiniteNumber(target.x);
    const y = asFiniteNumber(target.y);
    const z = asFiniteNumber(target.z);
    if (delta) {
      if (x != null) state.view.target.x += x;
      if (y != null) state.view.target.y += y;
      if (z != null) state.view.target.z += z;
    } else {
      if (x != null) state.view.target.x = x;
      if (y != null) state.view.target.y = y;
      if (z != null) state.view.target.z = z;
    }
    state.view.target.x = clamp(state.view.target.x, -4.5, 4.5);
    state.view.target.y = clamp(state.view.target.y, 0.3, 2.6);
    state.view.target.z = clamp(state.view.target.z, -4.5, 4.5);
  }

  function applyPitch(pitch) {
    if (pitch == null) return;
    const p = clamp(pitch, 8 * Math.PI / 180, 58 * Math.PI / 180);
    state.view.height = state.view.target.y + Math.tan(p) * state.view.distance;
  }

  function applyCameraControl(data) {
    if (!data || (data.type !== "camera" && data.type !== "videochat_camera")) return;
    if (data.reset) {
      state.view.yaw = DEFAULT_CAMERA_VIEW.yaw;
      state.view.distance = DEFAULT_CAMERA_VIEW.distance;
      state.view.height = DEFAULT_CAMERA_VIEW.height;
      state.view.target.set(DEFAULT_CAMERA_VIEW.target.x, DEFAULT_CAMERA_VIEW.target.y, DEFAULT_CAMERA_VIEW.target.z);
      state.view.screenOffsetX = DEFAULT_CAMERA_VIEW.screenOffsetX;
      state.view.screenOffsetY = DEFAULT_CAMERA_VIEW.screenOffsetY;
      state.view.fov = 45;
    }

    applyCameraTarget(data.target, false);

    const distance = asFiniteNumber(data.distance);
    if (distance != null) state.view.distance = distance;
    state.view.distance = clamp(state.view.distance, 3.8, 18);

    const yaw = angleFromPayload(data, "yaw", "yaw_deg");
    if (yaw != null) state.view.yaw = yaw;

    const height = asFiniteNumber(data.height);
    if (height != null) state.view.height = height;
    const screenX = asFiniteNumber(data.screen_x ?? data.screenOffsetX);
    const screenY = asFiniteNumber(data.screen_y ?? data.screenOffsetY);
    if (screenX != null) state.view.screenOffsetX = screenX;
    if (screenY != null) state.view.screenOffsetY = screenY;

    const pitch = angleFromPayload(data, "pitch", "pitch_deg");
    applyPitch(pitch);

    const delta = data.delta && typeof data.delta === "object" ? data.delta : null;
    if (delta) {
      applyCameraTarget(delta.target, true);
      const dDistance = asFiniteNumber(delta.distance);
      if (dDistance != null) state.view.distance += dDistance;
      state.view.distance = clamp(state.view.distance, 3.8, 18);
      const dYaw = angleFromPayload(delta, "yaw", "yaw_deg");
      if (dYaw != null) state.view.yaw += dYaw;
      const dHeight = asFiniteNumber(delta.height);
      if (dHeight != null) state.view.height += dHeight;
      const dScreenX = asFiniteNumber(delta.screen_x ?? delta.screenOffsetX);
      const dScreenY = asFiniteNumber(delta.screen_y ?? delta.screenOffsetY);
      if (dScreenX != null) state.view.screenOffsetX += dScreenX;
      if (dScreenY != null) state.view.screenOffsetY += dScreenY;
      const dPitch = angleFromPayload(delta, "pitch", "pitch_deg");
      if (dPitch != null) {
        const currentPitch = Math.atan2(state.view.height - state.view.target.y, state.view.distance);
        applyPitch(currentPitch + dPitch);
      }
    }

    state.view.height = clamp(state.view.height, 1.4, 8);
    state.view.screenOffsetX = clamp(state.view.screenOffsetX || 0, -window.innerWidth, window.innerWidth);
    state.view.screenOffsetY = clamp(state.view.screenOffsetY || 0, -window.innerHeight, window.innerHeight);
    applySceneScreenOffset();
    const fov = asFiniteNumber(data.fov);
    const dFov = asFiniteNumber(delta?.fov);
    if (state.three?.camera && (fov != null || dFov != null)) {
      state.three.camera.fov = clamp((fov != null ? fov : state.three.camera.fov) + (dFov || 0), 28, 70);
      state.three.camera.updateProjectionMatrix();
      state.view.fov = state.three.camera.fov;
    }
    state.cameraUpdate?.();
    saveCameraSettings();
  }

  function connectVideochat() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "videochat_snapshot" && state.mockCount <= 0) setSnapshot(data);
        if (data.type === "videochat_camera" || data.type === "camera") applyCameraControl(data);
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connectVideochat, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  function connectChatSpeech() {
    const ws = new WebSocket(state.cfg.chat_ws_url);
    ws.onmessage = (ev) => {
      try { showSpeech(JSON.parse(ev.data)); } catch (_) {}
    };
    ws.onclose = () => setTimeout(connectChatSpeech, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  function initThree() {
    if (!window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    if (Number.isFinite(Number(state.view.fov))) camera.fov = Number(state.view.fov);
    scene.add(camera);

    const hemi = new THREE.HemisphereLight(0x6f88c8, 0x183c28, 1.05);
    scene.add(hemi);
    const fireLight = new THREE.PointLight(0xff9a35, 3.8, 8.5, 1.6);
    fireLight.position.set(0, 1.15, 0.35);
    scene.add(fireLight);
    const moon = new THREE.DirectionalLight(0x9bbcff, 1.1);
    moon.position.set(-3.4, 6.2, 3.6);
    scene.add(moon);

    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(5.9, 96),
      new THREE.MeshStandardMaterial({ color: 0x316f3e, roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    scene.add(grass);

    const grassRing = new THREE.Mesh(
      new THREE.CircleGeometry(6.05, 96),
      new THREE.MeshBasicMaterial({ color: 0x17351f, transparent: true, opacity: 0.22 })
    );
    grassRing.rotation.x = -Math.PI / 2;
    grassRing.position.y = -0.025;
    scene.add(grassRing);

    const tuftGroup = new THREE.Group();
    const tuftMatA = new THREE.MeshStandardMaterial({ color: 0x4b9b52, roughness: 0.9 });
    const tuftMatB = new THREE.MeshStandardMaterial({ color: 0x276836, roughness: 0.95 });
    const tuftGeo = new THREE.ConeGeometry(0.025, 0.16, 5);
    for (let i = 0; i < 160; i++) {
      const r = Math.sqrt(Math.random()) * 5.25;
      const a = Math.random() * Math.PI * 2;
      if (r < 1.15) continue;
      const tuft = new THREE.Mesh(tuftGeo, Math.random() > 0.5 ? tuftMatA : tuftMatB);
      tuft.position.set(Math.cos(a) * r, 0.065, Math.sin(a) * r);
      tuft.rotation.x = (Math.random() - 0.5) * 0.45;
      tuft.rotation.z = (Math.random() - 0.5) * 0.45;
      tuft.scale.setScalar(0.75 + Math.random() * 0.8);
      tuftGroup.add(tuft);
    }
    scene.add(tuftGroup);

    const stars = new THREE.Group();
    for (let i = 0; i < 80; i++) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.012 + Math.random() * 0.012, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xe8f1ff,
          transparent: true,
          opacity: 0.55 + Math.random() * 0.45,
          depthTest: false,
          depthWrite: false,
        })
      );
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 9;
      star.position.set(Math.cos(a) * r, 5.8 + Math.random() * 7.0, Math.sin(a) * r);
      star.renderOrder = -10;
      stars.add(star);
    }
    scene.add(stars);

    const meteors = [];
    function spawnMeteor() {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-0.55, -0.13, 0),
      ]);
      const mat = new THREE.LineBasicMaterial({ color: 0xcfe7ff, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, mat);
      const yaw = state.view.yaw || 0;
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      line.position.copy(state.view.target)
        .addScaledVector(forward, -18)
        .addScaledVector(right, 3.5 + Math.random() * 2.2);
      line.position.y = 7.2 + Math.random() * 2.5;
      line.userData.life = 1;
      line.renderOrder = -9;
      meteors.push(line);
      scene.add(line);
    }

    const logs = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3826, roughness: 0.75 });
    const logGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.35, 12);
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(0, 0.12, 0.25);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (Math.PI / 3) * i;
      logs.add(log);
    }
    scene.add(logs);

    const fireGroup = new THREE.Group();
    fireGroup.position.set(0, 0.05, 0.25);
    scene.add(fireGroup);
    const flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.05, 28),
      new THREE.MeshStandardMaterial({ color: 0xff8a24, emissive: 0xff6618, emissiveIntensity: 1.4, transparent: true, opacity: 0.94 })
    );
    const flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.72, 24),
      new THREE.MeshStandardMaterial({ color: 0xffe37c, emissive: 0xffd95d, emissiveIntensity: 1.5, transparent: true, opacity: 0.96 })
    );
    flameOuter.position.y = 0.55;
    flameInner.position.y = 0.48;
    fireGroup.add(flameOuter, flameInner);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.42, 48),
      new THREE.MeshBasicMaterial({ color: 0xff8b2d, transparent: true, opacity: 0.18 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.012;
    glow.position.z = 0.25;
    scene.add(glow);

    state.three = { renderer, scene, camera, fireLight };

    function updateCamera() {
      const v = state.view;
      const x = Math.sin(v.yaw) * v.distance;
      const z = Math.cos(v.yaw) * v.distance;
      camera.position.set(v.target.x + x, v.height, v.target.z + z);
      camera.lookAt(v.target);
      renderParticipants();
    }
    state.cameraUpdate = updateCamera;

    window.addEventListener("keydown", (ev) => {
      const key = ev.key.toLowerCase();
      if (ev.shiftKey && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        const step = ev.ctrlKey ? 3 : 18;
        if (key === "arrowleft") state.view.screenOffsetX -= step;
        if (key === "arrowright") state.view.screenOffsetX += step;
        if (key === "arrowup") state.view.screenOffsetY -= step;
        if (key === "arrowdown") state.view.screenOffsetY += step;
        state.view.screenOffsetX = clamp(state.view.screenOffsetX, -window.innerWidth, window.innerWidth);
        state.view.screenOffsetY = clamp(state.view.screenOffsetY, -window.innerHeight, window.innerHeight);
        applySceneScreenOffset();
        saveCameraSettings();
        ev.preventDefault();
        return;
      }
      if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
        state.keys.add(key);
        ev.preventDefault();
      }
    });

    window.addEventListener("keyup", (ev) => {
      const key = ev.key.toLowerCase();
      if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
        state.keys.delete(key);
        ev.preventDefault();
      }
    });

    window.addEventListener("wheel", (ev) => {
      const pitch = Math.atan2(state.view.height - state.view.target.y, state.view.distance);
      state.view.distance = Math.min(13, Math.max(4.8, state.view.distance + ev.deltaY * 0.004));
      state.view.height = clamp(state.view.target.y + Math.tan(pitch) * state.view.distance, 1.4, 8);
      updateCamera();
      saveCameraSettings();
    }, { passive: true });

    window.addEventListener("mousedown", (ev) => {
      if (ev.button !== 1) return;
      ev.preventDefault();
      state.view.dragging = true;
      state.view.dragLast = { x: ev.clientX, y: ev.clientY };
    });

    window.addEventListener("mouseup", (ev) => {
      if (ev.button === 1) {
        state.view.dragging = false;
        state.view.dragLast = null;
      }
    });

    window.addEventListener("mousemove", (ev) => {
      if (!state.view.dragging || !state.view.dragLast) return;
      const dx = ev.clientX - state.view.dragLast.x;
      const dy = ev.clientY - state.view.dragLast.y;
      state.view.dragLast = { x: ev.clientX, y: ev.clientY };
      const right = new THREE.Vector3(Math.cos(state.view.yaw), 0, -Math.sin(state.view.yaw));
      const forward = new THREE.Vector3(Math.sin(state.view.yaw), 0, Math.cos(state.view.yaw));
      const scale = state.view.distance * 0.0018;
      state.view.target.addScaledVector(right, -dx * scale);
      state.view.target.addScaledVector(forward, -dy * scale);
      updateCamera();
      saveCameraSettings();
    });

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
      camera.updateProjectionMatrix();
      updateCamera();
    }
    window.addEventListener("resize", resize);
    resize();
    applySceneScreenOffset();
    updateCamera();

    function frame(t) {
      if (
        state.keys.has("q") || state.keys.has("e") ||
        state.keys.has("a") || state.keys.has("d") ||
        state.keys.has("w") || state.keys.has("s")
      ) {
        const yawDir =
          (state.keys.has("e") || state.keys.has("d") ? 1 : 0) -
          (state.keys.has("q") || state.keys.has("a") ? 1 : 0);
        const pitchDir = (state.keys.has("w") ? 1 : 0) - (state.keys.has("s") ? 1 : 0);
        state.view.yaw += yawDir * 0.018;
        state.view.height = clamp(state.view.height + pitchDir * 0.035, 1.4, 8);
        updateCamera();
        saveCameraSettings();
      }
      const now = performance.now();
      flameOuter.scale.set(1 + Math.sin(t * 0.009) * 0.08, 1 + Math.sin(t * 0.012) * 0.12, 1);
      flameInner.scale.set(1 + Math.cos(t * 0.013) * 0.07, 1 + Math.cos(t * 0.011) * 0.1, 1);
      fireLight.intensity = 3.5 + Math.sin(t * 0.017) * 0.55;
      glow.scale.setScalar(1 + Math.sin(t * 0.005) * 0.045);
      stars.children.forEach((s, i) => {
        s.material.opacity = 0.48 + Math.sin(t * 0.0015 + i) * 0.22;
      });
      if (Math.random() < 0.004) spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.position.x -= 0.045;
        m.position.y -= 0.012;
        m.userData.life -= 0.012;
        m.material.opacity = Math.max(0, m.userData.life);
        if (m.userData.life <= 0) {
          scene.remove(m);
          meteors.splice(i, 1);
        }
      }
      for (const group of state.characters.values()) {
        const speaking = (group.userData.speakingUntil || 0) > now;
        if (group.userData.leavingUntil) {
          const start = group.userData.leavingStartedAt || now;
          const progress = clamp((now - start) / Math.max(1, group.userData.leavingUntil - start), 0, 1);
          const from = group.userData.leaveFrom || group.position;
          const to = group.userData.leaveTo || group.position;
          const mode = group.userData.exitEffect || "ascend";
          const eased = mode === "ascend" ? 1 - Math.pow(1 - progress, 2.5) : progress;
          group.position.lerpVectors(from, to, eased);
          if (mode === "ascend") group.position.y += Math.sin(progress * Math.PI) * 0.24;
          const ghost = 1 - progress;
          const exitScale = characterScale(state.participants.size, false) * (mode === "ascend" ? (1 - progress * 0.38) : 1);
          group.scale.setScalar(Math.max(0.18, exitScale));
          group.traverse((obj) => {
            if (!obj.material) return;
            if (obj.userData.isGroundShadow) {
              obj.visible = true;
              setChildWorldPose(
                obj,
                group,
                new THREE.Vector3(from.x, 0.015, from.z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
              );
              obj.material.opacity = mode === "none" ? 0 : Math.max(0, ghost * 0.22);
              return;
            }
            if (obj.userData.isEffectBeam) {
              obj.visible = mode === "ascend";
              obj.material.color.setHex(0xf4fbff);
              obj.material.opacity = mode === "ascend" ? (1 - progress) * 0.42 : 0;
              setChildWorldPose(obj, group, new THREE.Vector3(from.x, 1.3, from.z));
              const inv = 1 / Math.max(0.001, group.scale.x);
              obj.scale.setScalar(1.08 * inv);
              return;
            }
            if (obj.userData.isEffectFlare) {
              obj.visible = mode === "ascend";
              obj.material.color.setHex(0xf4fbff);
              obj.material.opacity = mode === "ascend" ? (1 - progress) * 0.28 : 0;
              setChildWorldPose(
                obj,
                group,
                new THREE.Vector3(from.x, 0.035, from.z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
              );
              const inv = 1 / Math.max(0.001, group.scale.x);
              obj.scale.setScalar(1.25 * inv);
              return;
            }
            if (obj.material.color) {
              if (!obj.material.userData.originalColor) obj.material.userData.originalColor = obj.material.color.clone();
              obj.material.color.copy(obj.material.userData.originalColor).lerp(new THREE.Color(0xddeeff), mode === "ascend" ? 0.72 : 0);
            }
            obj.material.transparent = true;
            obj.material.opacity = mode === "none" ? 0 : Math.max(0, ghost * 0.58);
            if ("emissive" in obj.material) {
              obj.material.emissive = obj.material.emissive || new THREE.Color(0x000000);
              obj.material.emissive.setHex(0xddeeff);
              obj.material.emissiveIntensity = mode === "ascend" ? Math.sin(progress * Math.PI) * 0.45 : 0;
            }
          });
          continue;
        }
        const target = group.userData.target;
        if (target) {
          const enterStart = group.userData.enterStartedAt || now;
          const mode = group.userData.entryEffect || "drop";
          const duration = mode === "drop" ? 2100 : mode === "fade" ? 1200 : 3200;
          const progress = clamp((now - enterStart) / duration, 0, 1);
          const entering = !group.userData.enterDone && progress < 1;
          const eased = mode === "drop" ? progress * progress : 1 - Math.pow(1 - progress, 2.4);
          const hop = mode === "drop" ? 0 : Math.sin(progress * Math.PI * 5) * (1 - progress) * 0.075;
          let enteringDropY = null;
          if (entering && group.userData.enterFrom) {
            group.position.lerpVectors(group.userData.enterFrom, target, eased);
            if (mode === "drop") enteringDropY = group.position.y;
          } else {
            const settleAlpha = now < (state.layoutSettlingUntil || 0) ? 0.045 : 0.18;
            group.position.lerp(target, settleAlpha);
          }
          const bob = Math.sin(t * 0.003 + hashString(group.userData.key)) * 0.018 + (speaking ? Math.sin(t * 0.02) * 0.035 : 0);
          group.position.y = (enteringDropY ?? 0) + hop + bob;
          group.scale.setScalar(characterScale(state.participants.size, speaking));
          group.traverse((obj) => {
            if (!obj.material) return;
            if (obj.userData.isGroundShadow) {
              obj.visible = true;
              setChildWorldPose(
                obj,
                group,
                new THREE.Vector3(target.x, 0.015, target.z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
              );
              obj.material.opacity = 0.22;
              return;
            }
            if (obj.userData.isEffectBeam) {
              obj.visible = entering && mode === "drop" && progress < 0.96;
              obj.material.color.setHex(0xffd36b);
              obj.material.opacity = obj.visible ? (0.82 - progress * 0.32) : 0;
              const inv = 1 / Math.max(0.001, group.scale.x);
              const radius = (0.52 / 0.34) * inv;
              const worldHeight = 3.35;
              setChildWorldPose(obj, group, new THREE.Vector3(target.x, worldHeight / 2, target.z));
              const length = worldHeight * inv;
              obj.scale.set(radius, length, radius);
            } else if (obj.userData.isEffectFlare) {
              obj.visible = false;
              obj.material.color.setHex(0xffcf4a);
              obj.material.opacity = 0;
            } else if (entering && mode === "fade") {
              obj.material.transparent = true;
              obj.material.opacity = progress;
            }
          });
          if (progress >= 1) {
            group.userData.enterDone = true;
            group.userData.enterFrom = null;
          }
        }
        const stillEntering = !group.userData.enterDone;
        group.traverse((obj) => {
          if (!obj.material) return;
          if (obj.userData.isGroundShadow) {
            if (target) {
              setChildWorldPose(
                obj,
                group,
                new THREE.Vector3(target.x, 0.015, target.z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
              );
            }
            obj.visible = true;
            obj.material.opacity = 0.22;
            return;
          }
          if (obj.userData.isEffectBeam || obj.userData.isEffectFlare) {
            if (!stillEntering) {
              obj.visible = false;
              obj.material.opacity = 0;
            }
            return;
          }
          if (obj.material.userData.originalColor && obj.material.color) {
            obj.material.color.copy(obj.material.userData.originalColor);
          }
          if (obj.material.opacity !== 1) obj.material.opacity = 1;
          if ("emissiveIntensity" in obj.material) obj.material.emissiveIntensity = 0;
        });
        if (!stillEntering) {
          group.scale.setScalar(characterScale(state.participants.size, speaking));
        }
      }
      renderer.render(scene, camera);
      renderParticipants();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (state.mockCount > 0) {
    if (params.get("debug_lifecycle") === "1") {
      startDebugLifecycle();
    } else {
      setSnapshot({ type: "videochat_snapshot", participants: mockParticipants(state.mockCount) });
    }
  }
  connectVideochat();
  connectChatSpeech();
  initThree();
  startDebugSpeech();
})();
