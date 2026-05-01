(async function () {
  const participantLayer = document.getElementById("participants");
  const chatPanel = document.getElementById("chat-panel");
  const chatLog = document.getElementById("chat-log");
  const chatControls = document.getElementById("chat-controls");
  const chatSendPanel = document.getElementById("chat-send-panel");
  const chatSendText = document.getElementById("chat-send-text");
  const chatSendButton = document.getElementById("chat-send-button");
  const chatSendFile = document.getElementById("chat-send-file");
  const chatSendEmojiButton = document.getElementById("chat-send-emoji-button");
  const chatSendTargets = Array.from(document.querySelectorAll(".chat-send-target"));
  const chatSendPreview = document.getElementById("chat-send-preview");
  const chatSendPreviewImg = document.getElementById("chat-send-preview-img");
  const chatSendPreviewName = document.getElementById("chat-send-preview-name");
  const chatSendPreviewClear = document.getElementById("chat-send-preview-clear");
  const chatReplyPreview = document.getElementById("chat-reply-preview");
  const chatReplyPreviewLabel = document.getElementById("chat-reply-preview-label");
  const chatReplyPreviewClear = document.getElementById("chat-reply-preview-clear");
  const chatMessageMenu = document.getElementById("chat-message-menu");
  const chatMenuReply = document.getElementById("chat-menu-reply");
  const chatMenuQuote = document.getElementById("chat-menu-quote");
  const chatMenuDelete = document.getElementById("chat-menu-delete");
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
  const avatarHeadGap = document.getElementById("avatar-head-gap");
  const bubbleCardGap = document.getElementById("bubble-card-gap");
  const subaccountToggle = document.getElementById("subaccount-toggle");
  const subaccountAutoToggle = document.getElementById("subaccount-auto-toggle");
  const entryEffect = document.getElementById("entry-effect");
  const exitEffect = document.getElementById("exit-effect");
  const lifecycleSec = document.getElementById("lifecycle-sec");
  const fireUserCooldown = document.getElementById("fire-user-cooldown");
  const fireGlobalCooldown = document.getElementById("fire-global-cooldown");
  const toastStyle = document.getElementById("toast-style");
  const entryMessageTemplate = document.getElementById("entry-message-template");
  const exitMessageTemplate = document.getElementById("exit-message-template");
  const levelUpMessageTemplate = document.getElementById("level-up-message-template");
  const levelDownMessageTemplate = document.getElementById("level-down-message-template");
  const toastSizeDown = document.getElementById("toast-size-down");
  const toastSizeUp = document.getElementById("toast-size-up");
  const toastHandle = document.getElementById("toast-handle");
  const eventToasts = document.getElementById("event-toasts");
  const canvas = document.getElementById("scene");
  const MAX_CHAT_LINES = 50;
  const mentionMenu = document.createElement("div");
  mentionMenu.id = "chat-mention-menu";
  mentionMenu.hidden = true;
  document.body.appendChild(mentionMenu);
  const mediaLightbox = document.createElement("div");
  mediaLightbox.id = "media-lightbox";
  mediaLightbox.hidden = true;
  const mediaLightboxBody = document.createElement("div");
  mediaLightboxBody.id = "media-lightbox-body";
  mediaLightbox.appendChild(mediaLightboxBody);
  document.body.appendChild(mediaLightbox);
  const streamPreviewPanel = document.createElement("div");
  streamPreviewPanel.id = "stream-preview-panel";
  streamPreviewPanel.innerHTML = `
    <div id="stream-preview-controls">
      <button id="stream-preview-drag" type="button" title="preview move">M</button>
      <button id="stream-preview-refresh" type="button" title="refresh preview">R</button>
      <button id="stream-preview-toggle" type="button" title="preview show/hide">hide</button>
    </div>
    <div id="stream-preview-list"></div>
    <div id="stream-preview-resize" title="preview resize"></div>
  `;
  document.body.appendChild(streamPreviewPanel);
  const streamPreviewControls = streamPreviewPanel.querySelector("#stream-preview-controls");
  const streamPreviewDrag = streamPreviewPanel.querySelector("#stream-preview-drag");
  const streamPreviewRefresh = streamPreviewPanel.querySelector("#stream-preview-refresh");
  const streamPreviewToggle = streamPreviewPanel.querySelector("#stream-preview-toggle");
  const streamPreviewList = streamPreviewPanel.querySelector("#stream-preview-list");
  const streamPreviewResize = streamPreviewPanel.querySelector("#stream-preview-resize");
  const streamPreviewViewer = document.createElement("div");
  streamPreviewViewer.id = "stream-preview-viewer";
  streamPreviewViewer.hidden = true;
  streamPreviewViewer.innerHTML = `
    <div id="stream-viewer-bar">
      <button id="stream-viewer-drag" type="button" title="viewer move">M</button>
      <button id="stream-viewer-refresh" type="button" title="refresh preview">R</button>
      <button id="stream-viewer-close" type="button" title="close">x</button>
    </div>
    <div id="stream-viewer-body"></div>
    <div id="stream-viewer-resize" title="viewer resize"></div>
  `;
  document.body.appendChild(streamPreviewViewer);
  const streamViewerBar = streamPreviewViewer.querySelector("#stream-viewer-bar");
  const streamViewerDrag = streamPreviewViewer.querySelector("#stream-viewer-drag");
  const streamViewerRefresh = streamPreviewViewer.querySelector("#stream-viewer-refresh");
  const streamViewerClose = streamPreviewViewer.querySelector("#stream-viewer-close");
  const streamViewerBody = streamPreviewViewer.querySelector("#stream-viewer-body");
  const streamViewerResize = streamPreviewViewer.querySelector("#stream-viewer-resize");
  const widgetControls = document.createElement("div");
  widgetControls.id = "widget-controls";
  widgetControls.innerHTML = `
    <button id="widget-controls-drag" type="button" title="move widget menu">M</button>
    <button id="widget-add-price" type="button" title="show price widget">price</button>
    <button id="widget-add-memo" type="button" title="add memo widget">memo</button>
    <button id="widget-add-character-move" type="button" title="move characters">이동</button>
    <button id="widget-add-mini-jail" type="button" title="manage dwarf characters">난쟁이</button>
    <button id="widget-add-real-jail" type="button" title="manage cage characters">케이지</button>
    <button id="widget-add-game" type="button" title="show internal game widget">game</button>
    <button id="widget-add-electron-browser" type="button" title="show native web widget">web</button>
    <button id="widget-add-youtube" type="button" title="show YouTube widget">youtube</button>
  `;
  document.body.appendChild(widgetControls);
  const widgetControlsDrag = widgetControls.querySelector("#widget-controls-drag");
  const widgetAddPrice = widgetControls.querySelector("#widget-add-price");
  const widgetAddMemo = widgetControls.querySelector("#widget-add-memo");
  const widgetAddCharacterMove = widgetControls.querySelector("#widget-add-character-move");
  const widgetAddBrowser = widgetControls.querySelector("#widget-add-browser");
  const widgetAddMiniJail = widgetControls.querySelector("#widget-add-mini-jail");
  const widgetAddRealJail = widgetControls.querySelector("#widget-add-real-jail");
  const widgetAddGame = widgetControls.querySelector("#widget-add-game");
  const widgetAddElectronBrowser = widgetControls.querySelector("#widget-add-electron-browser");
  const widgetAddYoutube = widgetControls.querySelector("#widget-add-youtube");
  const widgetLayer = document.createElement("div");
  widgetLayer.id = "widget-layer";
  document.body.appendChild(widgetLayer);
  const CHAT_SETTINGS_KEY = "videochat.chatPanelSettings.v2";
  const TOPIC_SETTINGS_KEY = "videochat.topicSettings.v1";
  const AVATAR_SETTINGS_KEY = "videochat.avatarSettings.v1";
  const CAMERA_SETTINGS_KEY = "videochat.cameraSettings.v1";
  const EFFECT_SETTINGS_KEY = "videochat.effectSettings.v1";
  const TOAST_SETTINGS_KEY = "videochat.toastSettings.v1";
  const STREAM_PREVIEW_SETTINGS_KEY = "videochat.streamPreviewSettings.v1";
  const WIDGET_SETTINGS_KEY = "videochat.widgetSettings.v1";
  const EMOJI_PICKER_POS_KEY = "videochat.emojiPicker.v1";
  const STREAM_PREVIEW_MJPEG_RECYCLE_MS = 4 * 60 * 1000;
  const STREAM_PREVIEW_MJPEG_RETRY_MIN_MS = 1200;
  const STREAM_PREVIEW_MJPEG_RETRY_MAX_MS = 10000;
  const PRICE_REFRESH_MS = 45 * 1000;
  const LEVEL_UP_TEMPLATE_DEFAULT = "{name} 레벨 업 Lv. {old_level} → {new_level} · {reason}";
  const LEVEL_DOWN_TEMPLATE_DEFAULT = "{name} 레벨 다운 Lv. {old_level} → {new_level}";
  const CAMERA_DISTANCE_MIN = 2.2;
  const CAMERA_DISTANCE_MAX = 34;
  const CAMERA_HEIGHT_MIN = 0.2;
  const CAMERA_HEIGHT_MAX = 16;
  const CAMERA_PITCH_MIN = -10 * Math.PI / 180;
  const CAMERA_PITCH_MAX = 78 * Math.PI / 180;
  const CAMERA_FOV_MIN = 18;
  const CAMERA_FOV_MAX = 90;
  const CHEER_DEFAULT_SEC = 5;
  const CHEER_MAX_SEC = 600;
  const CAMPFIRE_CENTER = { x: 0, z: 0.25 };
  const WORLD_BOUNDS = {
    xMin: -7.2,
    xMax: 7.2,
    zMin: CAMPFIRE_CENTER.z - 4.55,
    zMax: CAMPFIRE_CENTER.z + 4.55,
  };

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
      level_system_enabled: true,
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
    streamPreviewSettings: null,
    widgetSettings: null,
    streamPreviewSignature: "",
    overlaySettings: {},
    overlaySettingsPushTimer: null,
    controlMode: false,
    remoteApplying: false,
    clientId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    cameraUpdate: null,
    videochatWs: null,
    three: null,
    userSendEnabled: false,
    sendInFlight: false,
    selectedPhoto: null,
    selectedSticker: null,
    selectedCustomEmoji: null,
    customEmojiEntities: [],
    maxPhotoBytes: 8 * 1024 * 1024,
    maxMediaBytes: 50 * 1024 * 1024,
    replyTo: null,
    menuTarget: null,
    mentionToken: null,
    mentionTimer: null,
    mentionSelected: 0,
    emojiPicker: null,
    emojiCache: { stickers: [], custom_emoji: [] },
    emojiCacheLoadedAt: 0,
    stickerPreviewQueue: [],
    stickerPreviewActive: 0,
    emojiPickerDragging: false,
    emojiPickerSuppressClickUntil: 0,
    priceWidgetTimer: 0,
    priceWidgetLoading: false,
    priceWidgetData: null,
    youtubeSearchLoading: false,
      youtubeSearchResults: [],
      youtubeSearchError: "",
      gameRomList: [],
      gameRomLoading: false,
      gameRomLoaded: false,
      gameLogs: [],
      gameButtonTimers: new Map(),
      gameWidgetSaveTimer: 0,
    gameLocalOverrideUntil: 0,
    gameLocalClosedAt: 0,
    gameClosePending: null,
    gameCloseTimer: 0,
    gameVoteBuffer: null,
    electronBrowserBridgeBound: false,
    electronBrowserLogs: [],
    electronNativeViewsSuppressedForDrag: false,
    widgetDragDepth: 0,
    widgetInteractionDepth: 0,
    widgetRenderPending: false,
    prisonScaleAdjusting: false,
    prisonTransformAdjusting: false,
    prisonWidgetRefreshPending: false,
    prisonPlaceMode: false,
    prisonTransformRenderFrame: 0,
    characterMoveAdjusting: false,
    characterPlaceMode: false,
    characterDriveMode: false,
    characterDriveKey: "",
    characterDriveLastT: 0,
    characterDriveLastSave: 0,
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

  function appendRichText(target, text, options = {}) {
    if (window.TgChatCore?.appendRichText) {
      window.TgChatCore.appendRichText(target, text, richTextOptions(options));
    } else {
      target.textContent = text;
    }
  }

  let sharedLinkPreview = null;
  let sharedElectronLinkPreview = null;
  function richTextOptions(options = {}) {
    const electronPreview = electronBrowserLinkPreview();
    if (electronPreview) return { ...options, linkPreview: electronPreview };
    if (!sharedLinkPreview && window.TgChatCore?.createLinkPreview) {
      sharedLinkPreview = window.TgChatCore.createLinkPreview("link-preview", {
        onControl: (payload) => sendVideochatControlEvent(payload),
      });
    }
    return sharedLinkPreview ? { ...options, linkPreview: sharedLinkPreview } : options;
  }

  function selectedTextWithin(el) {
    if (window.TgChatCore?.selectedTextWithin) {
      return window.TgChatCore.selectedTextWithin(el);
    }
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed) return "";
    return selection.toString().trim().slice(0, 500).trim();
  }
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
  state.controlMode = ["1", "true", "yes", "on"].includes(String(params.get("control") || "").toLowerCase());
  document.body.classList.toggle("control-mode", state.controlMode);
  document.body.classList.toggle("viewer-mode", !state.controlMode);
  if (params.get("debug_speech") === "1") state.cfg.debug_speech = true;
  state.mockCount = Math.min(120, Math.max(0, Number(params.get("mock_participants") || params.get("mock") || 0) || 0));
  state.mockBaseCount = state.mockCount;
  if (state.mockCount > 0 && params.get("debug_speech") !== "0") state.cfg.debug_speech = true;
    try {
      const overlayState = await fetch("/api/videochat/settings").then((r) => r.json());
    if (overlayState?.settings && typeof overlayState.settings === "object") {
      state.overlaySettings = adaptOverlaySettings(overlayState.settings);
    }
  } catch (_) {}
  try {
    const fireSettings = await fetch("/api/fire/settings").then((r) => r.json());
    if (fireUserCooldown && typeof fireSettings.user_cooldown_sec === "number") fireUserCooldown.value = String(fireSettings.user_cooldown_sec);
    if (fireGlobalCooldown && typeof fireSettings.global_cooldown_sec === "number") fireGlobalCooldown.value = String(fireSettings.global_cooldown_sec);
  } catch (_) {}

  function selectedSendTargets() {
    return chatSendTargets
      .filter((btn) => btn.classList.contains("active") && !btn.disabled)
      .map((btn) => btn.dataset.target);
  }

  function updateSendButton() {
    if (!chatSendButton || !chatSendText) return;
    const hasBody = !!chatSendText.value.trim() || !!state.selectedPhoto || !!state.selectedSticker || !!state.selectedCustomEmoji;
    chatSendButton.disabled = state.sendInFlight || !state.userSendEnabled || !hasBody || (!state.replyTo && selectedSendTargets().length === 0);
  }

  function sendFileMime(file) {
    const type = String(file?.type || "").toLowerCase();
    if (type) return type;
    const name = String(file?.name || "").toLowerCase();
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".png")) return "image/png";
    return name.endsWith(".jpg") || name.endsWith(".jpeg") ? "image/jpeg" : "";
  }

  function isSupportedSendFile(file) {
    const type = sendFileMime(file);
    return type.startsWith("image/") || type === "video/mp4" || type === "video/webm";
  }

  function maxBytesForSendFile(file) {
    const type = sendFileMime(file);
    return type.startsWith("video/") ? state.maxMediaBytes : state.maxPhotoBytes;
  }

  async function refreshSendStatus() {
    try {
      const status = await fetch("/api/send/status").then((r) => r.json());
      state.userSendEnabled = !!status.enabled;
      if (typeof status.max_photo_mb === "number") state.maxPhotoBytes = Math.max(1, status.max_photo_mb) * 1024 * 1024;
      if (typeof status.max_media_mb === "number") state.maxMediaBytes = Math.max(1, status.max_media_mb) * 1024 * 1024;
      for (const btn of chatSendTargets) {
        const available = !!status.targets?.[btn.dataset.target];
        btn.disabled = !available;
        if (!available) btn.classList.remove("active");
      }
      if (chatSendPanel) chatSendPanel.hidden = false;
    } catch (_) {
      state.userSendEnabled = false;
    }
    updateSendButton();
  }

  function setSendPhoto(file) {
    if (!file || !isSupportedSendFile(file)) return;
    if (file.size > maxBytesForSendFile(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const mime = sendFileMime(file) || "image/jpeg";
      state.selectedSticker = null;
      state.selectedCustomEmoji = null;
      state.selectedPhoto = { name: file.name || "image.jpg", mime, data: String(reader.result || "") };
      setSendPreviewMedia({ url: state.selectedPhoto.data, media_type: mime.startsWith("image/") ? "image" : "video" });
      if (chatSendPreviewName) chatSendPreviewName.textContent = state.selectedPhoto.name;
      if (chatSendPreview) chatSendPreview.hidden = false;
      updateSendButton();
    };
    reader.readAsDataURL(file);
  }

  function clearSendPhoto() {
    state.selectedPhoto = null;
    state.selectedSticker = null;
    state.selectedCustomEmoji = null;
    clearSendPreviewMedia();
    if (chatSendPreviewImg) chatSendPreviewImg.removeAttribute("src");
    if (chatSendPreviewImg) chatSendPreviewImg.hidden = false;
    if (chatSendPreviewName) chatSendPreviewName.textContent = "";
    if (chatSendPreview) chatSendPreview.hidden = true;
    if (chatSendFile) chatSendFile.value = "";
    updateSendButton();
  }

  function setSendReply(data, quoteText = "") {
    if (!data?.message?.chat_id || !data?.message?.message_id) return;
    const quote = window.TgChatCore?.normalizeQuoteText
      ? window.TgChatCore.normalizeQuoteText(quoteText, 1024)
      : String(quoteText || "").replace(/\r/g, "").slice(0, 1024);
    state.replyTo = { ...data.message };
    if (quote) state.replyTo.quote_text = quote;
    if (chatReplyPreviewLabel) chatReplyPreviewLabel.textContent = `${quote ? "인용" : "답장"}: ${data.name || "Unknown"}`;
    if (chatReplyPreview) chatReplyPreview.hidden = false;
    chatSendText?.focus();
    updateSendButton();
  }

  function clearSendReply() {
    state.replyTo = null;
    if (chatReplyPreview) chatReplyPreview.hidden = true;
    updateSendButton();
  }

  async function sendOverlayMessage(text, targets, photo, replyTo) {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targets, photo, sticker: state.selectedSticker, custom_emoji: state.selectedCustomEmoji, custom_entities: state.customEmojiEntities, reply_to: replyTo }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function deleteOverlayMessage(ref) {
    const res = await fetch("/api/message/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function hideChatMessageMenu() {
    if (chatMessageMenu) chatMessageMenu.hidden = true;
    if (chatMenuQuote) chatMenuQuote.hidden = true;
    state.menuTarget = null;
  }

  function showChatMessageMenu(ev, data, el) {
    if (!chatMessageMenu || !data?.message?.chat_id || !data?.message?.message_id) return;
    ev.preventDefault();
    ev.stopPropagation();
    const quoteText = selectedTextWithin(el);
    state.menuTarget = { data, el, quoteText };
    if (chatMenuQuote) chatMenuQuote.hidden = !quoteText;
    chatMessageMenu.hidden = false;
    const w = chatMessageMenu.offsetWidth || 126;
    const h = chatMessageMenu.offsetHeight || 96;
    chatMessageMenu.style.left = `${Math.min(Math.max(ev.clientX, 6), window.innerWidth - w - 6)}px`;
    chatMessageMenu.style.top = `${Math.min(Math.max(ev.clientY, 6), window.innerHeight - h - 6)}px`;
  }

  function showChatMessageMenuFromEvent(ev) {
    const line = ev.target instanceof Element ? ev.target.closest(".chat-line[data-message-key]") : null;
    if (!line || !line._chatData) return false;
    showChatMessageMenu(ev, line._chatData, line);
    return true;
  }

  function hideMentionMenu() {
    mentionMenu.hidden = true;
    mentionMenu.replaceChildren();
    state.mentionToken = null;
  }

  function mentionAtCaret() {
    if (!chatSendText) return null;
    const pos = chatSendText.selectionStart;
    const before = chatSendText.value.slice(0, pos);
    const match = before.match(/(^|\s)@([^\s@]{1,32})$/);
    if (!match) return null;
    return { query: match[2], start: pos - match[2].length - 1, end: pos };
  }

  async function searchMentions(query) {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.users) ? body.users : [];
  }

  function chooseMention(user) {
    if (!chatSendText || !state.mentionToken || !user?.can_tag) return;
    const insert = `${user.insert} `;
    const value = chatSendText.value;
    chatSendText.value = value.slice(0, state.mentionToken.start) + insert + value.slice(state.mentionToken.end);
    const pos = state.mentionToken.start + insert.length;
    chatSendText.setSelectionRange(pos, pos);
    hideMentionMenu();
    updateSendButton();
    chatSendText.focus();
  }

  function renderMentionMenu(users) {
    mentionMenu.replaceChildren();
    if (!users.length || !state.mentionToken) return hideMentionMenu();
    const rect = chatSendPanel.getBoundingClientRect();
    mentionMenu.style.left = `${rect.left}px`;
    mentionMenu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 6)}px`;
    mentionMenu.style.width = `${Math.min(320, rect.width)}px`;
    users.forEach((user, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `mention-item${index === state.mentionSelected ? " active" : ""}`;
      btn.disabled = !user.can_tag;
      btn.innerHTML = `<span class="mention-name"></span><span class="mention-handle"></span>`;
      btn.querySelector(".mention-name").textContent = user.name || "Unknown";
      btn.querySelector(".mention-handle").textContent = user.username ? `@${user.username}` : "username 없음";
      btn.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        chooseMention(user);
      });
      mentionMenu.appendChild(btn);
    });
    mentionMenu.hidden = false;
  }

  function scheduleMentionSearch() {
    clearTimeout(state.mentionTimer);
    const token = mentionAtCaret();
    if (!token) return hideMentionMenu();
    state.mentionToken = token;
    state.mentionTimer = setTimeout(async () => {
      const users = await searchMentions(token.query);
      if (!state.mentionToken || state.mentionToken.query !== token.query) return;
      state.mentionSelected = 0;
      renderMentionMenu(users);
    }, 180);
  }

  function moveMentionSelection(delta) {
    const items = Array.from(mentionMenu.querySelectorAll(".mention-item:not(:disabled)"));
    if (!items.length) return false;
    state.mentionSelected = (state.mentionSelected + delta + items.length) % items.length;
    for (const item of mentionMenu.querySelectorAll(".mention-item")) {
      item.classList.remove("active");
    }
    items[state.mentionSelected].classList.add("active");
    return true;
  }

  function chooseSelectedMention() {
    const items = Array.from(mentionMenu.querySelectorAll(".mention-item:not(:disabled)"));
    if (!items.length) return false;
    items[Math.min(state.mentionSelected, items.length - 1)].dispatchEvent(new MouseEvent("mousedown"));
    return true;
  }

  async function refreshEmojiCache() {
    if (Date.now() - state.emojiCacheLoadedAt < 60000 && (state.emojiCache.stickers.length || state.emojiCache.custom_emoji.length)) {
      return;
    }
    try {
      const body = await fetch("/api/emoji/recent").then((r) => r.json());
      state.emojiCache = {
        stickers: Array.isArray(body.stickers) ? body.stickers : [],
        custom_emoji: Array.isArray(body.custom_emoji) ? body.custom_emoji : [],
      };
      state.emojiCacheLoadedAt = Date.now();
    } catch (_) {
      state.emojiCache = { stickers: [], custom_emoji: [] };
      state.emojiCacheLoadedAt = 0;
    }
  }

  function ensureEmojiPicker() {
    if (state.emojiPicker) return state.emojiPicker;
    const picker = document.createElement("div");
    picker.className = "emoji-picker";
    picker.hidden = true;
    picker.innerHTML = '<div class="emoji-picker-head"><span>drag</span><span>recent / sticker / premium</span></div><div class="emoji-picker-grid"></div>';
    document.body.appendChild(picker);
    picker.addEventListener("click", (ev) => ev.stopPropagation());
    picker.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    picker.addEventListener("wheel", (ev) => ev.stopPropagation(), { passive: true });
    bindEmojiPickerDrag(picker);
    state.emojiPicker = picker;
    return picker;
  }

  function bindEmojiPickerDrag(picker) {
    const head = picker.querySelector(".emoji-picker-head");
    if (!head || head.dataset.dragBound) return;
    head.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = picker.getBoundingClientRect();
      const start = { x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top };
      head.setPointerCapture?.(ev.pointerId);
      const move = (moveEv) => {
        state.emojiPickerDragging = true;
        const left = Math.min(Math.max(8, start.left + moveEv.clientX - start.x), Math.max(8, window.innerWidth - rect.width - 8));
        const top = Math.min(Math.max(8, start.top + moveEv.clientY - start.y), Math.max(8, window.innerHeight - rect.height - 8));
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
        picker.style.bottom = "auto";
        try { localStorage.setItem(EMOJI_PICKER_POS_KEY, JSON.stringify({ left, top })); } catch (_) {}
      };
      const up = () => {
        if (state.emojiPickerDragging) state.emojiPickerSuppressClickUntil = Date.now() + 220;
        state.emojiPickerDragging = false;
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", up);
        head.removeEventListener("pointercancel", up);
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", up);
      head.addEventListener("pointercancel", up);
    });
    head.dataset.dragBound = "1";
  }

  function stickerSendPayload(item) {
    return {
      key: item.key || item.file_unique_id || item.document_id || "",
      file_unique_id: item.file_unique_id || "",
      file_id: item.file_id || "",
      document_id: item.document_id || "",
      access_hash: item.access_hash || "",
      file_reference: item.file_reference || "",
      emoji: item.emoji || "",
      media_type: item.media_type || "image",
      source: item.source || "",
    };
  }

  function firstEmojiFallback(value) {
    const text = String(value || "*");
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      const first = segmenter.segment(text)[Symbol.iterator]().next().value;
      return first?.segment || "*";
    } catch (_) {
      return Array.from(text)[0] || "*";
    }
  }

  function ensureComposerPreview() {
    let box = document.getElementById("chat-send-rich-preview");
    if (box || !chatSendText?.parentElement) return box;
    box = document.createElement("div");
    box.id = "chat-send-rich-preview";
    box.className = "composer-rich-preview";
    box.hidden = true;
    chatSendText.parentElement.insertBefore(box, chatSendText.nextSibling);
    return box;
  }

  function updateComposerPreview() {
    const box = ensureComposerPreview();
    if (!box || !chatSendText) return;
    box.replaceChildren();
    if (!state.customEmojiEntities.length || !chatSendText.value) {
      box.hidden = true;
      return;
    }
    appendRichText(box, chatSendText.value, { entities: state.customEmojiEntities });
    box.hidden = false;
  }

  function emojiFallbackText(item) {
    if (item._kind === "custom_emoji") return firstEmojiFallback(item.emoji || "*");
    if (item.emoji) return item.emoji;
    return item.source === "telegram_recent" ? "recent" : "sticker";
  }

  function showEmojiFallback(btn, item) {
    btn.classList.add("no-preview");
    if (btn.querySelector(".emoji-picker-fallback")) return;
    const fallback = document.createElement("span");
    fallback.className = "emoji-picker-fallback";
    fallback.textContent = emojiFallbackText(item);
    btn.appendChild(fallback);
  }

  async function hydrateStickerPreview(btn, item) {
    if (!(item.file_id || item.can_send_as_user || item.document_id) || btn.dataset.previewLoading) return;
    btn.dataset.previewLoading = "1";
    btn.classList.add("loading-preview");
    const badge = btn.querySelector(".emoji-picker-badge");
    if (badge) badge.textContent = "loading";
    try {
      const meta = await fetch("/api/sticker/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stickerSendPayload(item)),
      }).then((r) => {
        if (!r.ok) throw new Error("preview unavailable");
        return r.json();
      });
      if (!meta?.url) return;
      item.url = meta.url;
      item.media_type = meta.media_type || item.media_type || "image";
      item.preview_checked = true;
      const key = item.key || item.file_unique_id || item.document_id;
      const cached = state.emojiCache.stickers.find((row) => (row.key || row.file_unique_id || row.document_id) === key);
      if (cached) {
        cached.url = item.url;
        cached.media_type = item.media_type;
        cached.preview_checked = true;
      }
      btn.classList.remove("loading-preview", "preview-failed");
      btn.classList.add("preview-ready");
      btn.replaceChildren();
      appendEmojiPreview(btn, item);
      appendEmojiBadge(btn, item);
    } catch (_) {
      btn.dataset.previewFailed = "1";
      btn.classList.remove("loading-preview");
      btn.classList.add("preview-failed");
      const failedBadge = btn.querySelector(".emoji-picker-badge");
      if (failedBadge) failedBadge.textContent = "no preview";
    } finally {
      delete btn.dataset.previewLoading;
    }
  }

  function runStickerPreviewQueue() {
    while (state.stickerPreviewActive < 3 && state.stickerPreviewQueue.length) {
      const job = state.stickerPreviewQueue.shift();
      if (!job?.btn || !job.item || !document.contains(job.btn)) continue;
      delete job.btn.dataset.previewQueued;
      state.stickerPreviewActive += 1;
      hydrateStickerPreview(job.btn, job.item).finally(() => {
        state.stickerPreviewActive = Math.max(0, state.stickerPreviewActive - 1);
        runStickerPreviewQueue();
      });
    }
  }

  function enqueueStickerPreview(btn, item) {
    if (!btn || btn.dataset.previewQueued || btn.dataset.previewLoading) return;
    if (!(item.file_id || item.can_send_as_user || item.document_id)) return;
    btn.dataset.previewQueued = "1";
    state.stickerPreviewQueue.push({ btn, item });
    runStickerPreviewQueue();
  }

  function appendEmojiBadge(btn, item) {
    const badge = document.createElement("span");
    badge.className = "emoji-picker-badge";
    badge.textContent = item._kind === "sticker" ? (item.source === "telegram_recent" ? "recent" : "sticker") : "premium";
    btn.appendChild(badge);
  }

  function appendEmojiPreview(btn, item) {
    if (item._kind === "custom_emoji") {
      const preview = document.createElement("span");
      preview.className = "chat-custom-emoji emoji-picker-custom-preview";
      btn.appendChild(preview);
      if (window.TgChatCore?.loadCustomEmoji && item.custom_emoji_id) {
        window.TgChatCore.loadCustomEmoji(preview, item.custom_emoji_id, firstEmojiFallback(item.emoji || "*"));
      } else {
        preview.textContent = firstEmojiFallback(item.emoji || "*");
      }
      return;
    }
    if (item._kind === "sticker" && item.url && item.media_type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.emoji || "sticker";
      img.addEventListener("error", () => {
        img.hidden = true;
        showEmojiFallback(btn, item);
        if (!item.preview_checked && (item.file_id || item.can_send_as_user || item.document_id)) {
          item.url = "";
          enqueueStickerPreview(btn, item);
        }
      });
      btn.appendChild(img);
      return;
    }
    if (item._kind === "sticker" && item.url && item.media_type === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("error", () => {
        video.hidden = true;
        showEmojiFallback(btn, item);
        if (!item.preview_checked && (item.file_id || item.can_send_as_user || item.document_id)) {
          item.url = "";
          enqueueStickerPreview(btn, item);
        }
      });
      btn.appendChild(video);
      return;
    }
    showEmojiFallback(btn, item);
    if (item._kind === "sticker" && (item.file_id || item.can_send_as_user || item.document_id)) {
      setTimeout(() => enqueueStickerPreview(btn, item), 0);
    }
  }

  function clearSendPreviewMedia() {
    chatSendPreview?.querySelector(".chat-send-preview-media")?.remove();
  }

  function setSendPreviewMedia(item) {
    clearSendPreviewMedia();
    if (!chatSendPreviewImg || !chatSendPreview) return;
    if (item?.media_type === "image" && item.url) {
      chatSendPreviewImg.hidden = false;
      chatSendPreviewImg.src = item.url;
      return;
    }
    chatSendPreviewImg.hidden = true;
    chatSendPreviewImg.removeAttribute("src");
    if (!item?.url) return;
    const slot = document.createElement("div");
    slot.className = "chat-send-preview-media";
    slot.appendChild(createMediaElement({ url: item.url, media_type: item.media_type || "image" }));
    chatSendPreview.insertBefore(slot, chatSendPreviewName || chatSendPreviewClear || null);
  }

  function selectSticker(item) {
    state.selectedPhoto = null;
    state.selectedCustomEmoji = null;
    state.selectedSticker = stickerSendPayload(item);
    setSendPreviewMedia(item);
    if (chatSendPreviewName) chatSendPreviewName.textContent = item.emoji ? `sticker ${item.emoji}` : "sticker";
    if (chatSendPreview) chatSendPreview.hidden = false;
    updateSendButton();
  }

  function selectCustomEmoji(item) {
    if (!chatSendText || !item.custom_emoji_id) return;
    const emoji = firstEmojiFallback(item.emoji || "*");
    const start = chatSendText.selectionStart ?? chatSendText.value.length;
    const end = chatSendText.selectionEnd ?? start;
    chatSendText.value = chatSendText.value.slice(0, start) + emoji + chatSendText.value.slice(end);
    state.customEmojiEntities = state.customEmojiEntities
      .filter((entity) => entity.offset < start || entity.offset >= end)
      .map((entity) => entity.offset >= end ? { ...entity, offset: entity.offset + emoji.length - (end - start) } : entity);
    state.customEmojiEntities.push({ type: "custom_emoji", offset: start, length: emoji.length, custom_emoji_id: String(item.custom_emoji_id), emoji });
    const pos = start + emoji.length;
    chatSendText.setSelectionRange(pos, pos);
    chatSendText.focus();
    updateComposerPreview();
    updateSendButton();
  }

  function reconcileCustomEmojiEntities() {
    if (!chatSendText || !state.customEmojiEntities.length) return;
    const value = chatSendText.value;
    state.customEmojiEntities = state.customEmojiEntities.filter((entity) => {
      const offset = Number(entity.offset);
      const length = Number(entity.length);
      if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length <= 0) return false;
      return value.slice(offset, offset + length) === (entity.emoji || value.slice(offset, offset + length));
    });
    updateComposerPreview();
  }

  function positionEmojiPicker() {
    const picker = state.emojiPicker;
    if (!picker || !chatSendEmojiButton) return;
    try {
      const saved = JSON.parse(localStorage.getItem(EMOJI_PICKER_POS_KEY) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        picker.style.left = `${Math.min(Math.max(8, saved.left), Math.max(8, window.innerWidth - 568))}px`;
        picker.style.top = `${Math.min(Math.max(8, saved.top), Math.max(8, window.innerHeight - 120))}px`;
        picker.style.bottom = "auto";
        return;
      }
    } catch (_) {}
    const rect = chatSendEmojiButton.getBoundingClientRect();
    picker.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - 568)}px`;
    picker.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;
    picker.style.top = "auto";
  }

  async function showEmojiPicker() {
    const picker = ensureEmojiPicker();
    await refreshEmojiCache();
    const grid = picker.querySelector(".emoji-picker-grid");
    grid.replaceChildren();
    const stickerItems = state.emojiCache.stickers.map((item) => ({ ...item, _kind: "sticker" }));
    const recentItems = stickerItems.filter((item) => item.source === "telegram_recent");
    const cachedItems = stickerItems.filter((item) => item.source !== "telegram_recent");
    const premiumItems = state.emojiCache.custom_emoji.map((item) => ({ ...item, _kind: "custom_emoji" }));
    const items = [...recentItems, ...cachedItems, ...premiumItems];
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "emoji-picker-empty";
      empty.textContent = "채팅에서 받은 스티커나 premium emoji가 아직 없습니다.";
      grid.appendChild(empty);
    }
    const appendSection = (title, sectionItems) => {
      if (!sectionItems.length) return;
      const section = document.createElement("div");
      section.className = "emoji-picker-section";
      section.textContent = title;
      grid.appendChild(section);
      for (const item of sectionItems) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `emoji-picker-item ${item._kind === "sticker" ? "sticker" : "premium-emoji"}`;
      const canSend = item._kind === "custom_emoji" || item.can_send_as_user || item.can_send_as_bot || item.file_id || item.document_id;
      btn.disabled = !canSend;
      btn.classList.toggle("disabled", !canSend);
      btn.title = item._kind === "sticker"
        ? (item.source === "telegram_recent" ? "Telegram recent sticker" : "cached sticker")
        : "premium custom emoji";
      if (!canSend) btn.title += " (preview only)";
      appendEmojiPreview(btn, item);
      appendEmojiBadge(btn, item);
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (btn.disabled) return;
        if (item._kind === "sticker") {
          selectSticker(item);
          picker.hidden = true;
        } else {
          selectCustomEmoji(item);
        }
      });
      grid.appendChild(btn);
      }
    };
    appendSection("Telegram recent", recentItems);
    appendSection("Cached stickers", cachedItems);
    appendSection("Premium emoji", premiumItems);
    positionEmojiPicker();
    picker.hidden = false;
  }

  function hideEmojiPicker(force = false) {
    if (!force && Date.now() < state.emojiPickerSuppressClickUntil) return;
    if (state.emojiPicker) state.emojiPicker.hidden = true;
  }

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

  function settingSection(name) {
    const value = state.overlaySettings?.[name];
    return value && typeof value === "object" ? value : null;
  }

  function cloneSettings(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_) {
      return {};
    }
  }

  function viewportSettings() {
    return {
      w: Math.max(1, window.innerWidth || 1),
      h: Math.max(1, window.innerHeight || 1),
    };
  }

  function scaleValue(value, ratio) {
    const n = Number(value);
    return Number.isFinite(n) ? n * ratio : value;
  }

  function adaptOverlaySettings(settings) {
    const out = cloneSettings(settings);
    const source = out.viewport && typeof out.viewport === "object" ? out.viewport : null;
    const sourceW = Number(source?.w);
    const sourceH = Number(source?.h);
    if (!Number.isFinite(sourceW) || !Number.isFinite(sourceH) || sourceW <= 0 || sourceH <= 0) {
      return out;
    }
    const current = viewportSettings();
    const sx = current.w / sourceW;
    const sy = current.h / sourceH;
    const sm = Math.min(sx, sy);
    const sameLayoutClass = Math.abs(sx - 1) < 0.12 && Math.abs(sy - 1) < 0.12;
    if (sameLayoutClass) {
      out.viewport = current;
      return out;
    }
    if (out.chat) {
      out.chat.x = scaleValue(out.chat.x, sx);
      out.chat.y = scaleValue(out.chat.y, sy);
      out.chat.w = scaleValue(out.chat.w, sx);
      out.chat.h = scaleValue(out.chat.h, sy);
      out.chat.fontSize = scaleValue(out.chat.fontSize, sm);
    }
    if (out.topic) {
      out.topic.x = scaleValue(out.topic.x, sx);
      out.topic.y = scaleValue(out.topic.y, sy);
      out.topic.w = scaleValue(out.topic.w, sx);
      out.topic.fontSize = scaleValue(out.topic.fontSize, sm);
    }
    if (out.avatar) {
      out.avatar.headGapPx = scaleValue(out.avatar.headGapPx, sm);
      out.avatar.bubbleGapPx = scaleValue(out.avatar.bubbleGapPx, sm);
    }
    if (out.toast) {
      out.toast.x = scaleValue(out.toast.x, sx);
      out.toast.y = scaleValue(out.toast.y, sy);
      out.toast.scale = scaleValue(out.toast.scale, sm);
    }
    if (out.streamPreview) {
      out.streamPreview.x = scaleValue(out.streamPreview.x, sx);
      out.streamPreview.y = scaleValue(out.streamPreview.y, sy);
      out.streamPreview.w = scaleValue(out.streamPreview.w, sx);
      out.streamPreview.h = scaleValue(out.streamPreview.h, sy);
      if (out.streamPreview.viewer) {
        out.streamPreview.viewer.x = scaleValue(out.streamPreview.viewer.x, sx);
        out.streamPreview.viewer.y = scaleValue(out.streamPreview.viewer.y, sy);
        out.streamPreview.viewer.w = scaleValue(out.streamPreview.viewer.w, sx);
        out.streamPreview.viewer.h = scaleValue(out.streamPreview.viewer.h, sy);
      }
    }
    if (out.widgets) {
      if (out.widgets.controls) {
        out.widgets.controls.x = scaleValue(out.widgets.controls.x, sx);
        out.widgets.controls.y = scaleValue(out.widgets.controls.y, sy);
      }
      if (out.widgets.price) {
        out.widgets.price.x = scaleValue(out.widgets.price.x, sx);
        out.widgets.price.y = scaleValue(out.widgets.price.y, sy);
        out.widgets.price.w = scaleValue(out.widgets.price.w, sx);
        out.widgets.price.h = scaleValue(out.widgets.price.h, sy);
      }
      if (out.widgets.youtube) {
        out.widgets.youtube.x = scaleValue(out.widgets.youtube.x, sx);
        out.widgets.youtube.y = scaleValue(out.widgets.youtube.y, sy);
        out.widgets.youtube.w = scaleValue(out.widgets.youtube.w, sx);
        out.widgets.youtube.h = scaleValue(out.widgets.youtube.h, sy);
      }
      if (out.widgets.electronBrowser) {
        out.widgets.electronBrowser.x = scaleValue(out.widgets.electronBrowser.x, sx);
        out.widgets.electronBrowser.y = scaleValue(out.widgets.electronBrowser.y, sy);
        out.widgets.electronBrowser.w = scaleValue(out.widgets.electronBrowser.w, sx);
        out.widgets.electronBrowser.h = scaleValue(out.widgets.electronBrowser.h, sy);
      }
      if (out.widgets.game) {
        out.widgets.game.x = scaleValue(out.widgets.game.x, sx);
        out.widgets.game.y = scaleValue(out.widgets.game.y, sy);
        out.widgets.game.w = scaleValue(out.widgets.game.w, sx);
        out.widgets.game.h = scaleValue(out.widgets.game.h, sy);
      }
      if (out.widgets.characterMove) {
        out.widgets.characterMove.x = scaleValue(out.widgets.characterMove.x, sx);
        out.widgets.characterMove.y = scaleValue(out.widgets.characterMove.y, sy);
        out.widgets.characterMove.w = scaleValue(out.widgets.characterMove.w, sx);
        out.widgets.characterMove.h = scaleValue(out.widgets.characterMove.h, sy);
      }
      for (const key of ["miniJail", "realJail"]) {
        if (!out.widgets[key]) continue;
        out.widgets[key].x = scaleValue(out.widgets[key].x, sx);
        out.widgets[key].y = scaleValue(out.widgets[key].y, sy);
        out.widgets[key].w = scaleValue(out.widgets[key].w, sx);
        out.widgets[key].h = scaleValue(out.widgets[key].h, sy);
      }
      if (Array.isArray(out.widgets.memos)) {
        for (const memo of out.widgets.memos) {
          if (!memo || typeof memo !== "object") continue;
          memo.x = scaleValue(memo.x, sx);
          memo.y = scaleValue(memo.y, sy);
          memo.w = scaleValue(memo.w, sx);
          memo.h = scaleValue(memo.h, sy);
          memo.fontSize = scaleValue(memo.fontSize, sm);
        }
      }
      if (Array.isArray(out.widgets.browsers)) {
        for (const browser of out.widgets.browsers) {
          if (!browser || typeof browser !== "object") continue;
          browser.x = scaleValue(browser.x, sx);
          browser.y = scaleValue(browser.y, sy);
          browser.w = scaleValue(browser.w, sx);
          browser.h = scaleValue(browser.h, sy);
        }
      }
    }
    if (out.camera) {
      out.camera.screenOffsetX = scaleValue(out.camera.screenOffsetX, sx);
      out.camera.screenOffsetY = scaleValue(out.camera.screenOffsetY, sy);
    }
    out.viewport = current;
    return out;
  }

  function settingsSnapshot() {
    const camera = state.three?.camera;
    return {
      viewport: viewportSettings(),
      chat: state.chatSettings ? { ...state.chatSettings } : loadChatSettings(),
      topic: state.topicSettings ? { ...state.topicSettings } : loadTopicSettings(),
      avatar: state.avatarSettings ? { ...state.avatarSettings } : loadAvatarSettings(),
      effect: state.effectSettings ? { ...state.effectSettings } : loadEffectSettings(),
      toast: state.toastSettings ? { ...state.toastSettings } : loadToastSettings(),
      streamPreview: state.streamPreviewSettings ? cloneSettings(state.streamPreviewSettings) : loadStreamPreviewSettings(),
      widgets: state.widgetSettings ? cloneSettings(state.widgetSettings) : loadWidgetSettings(),
      camera: {
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
      },
    };
  }

  function scheduleOverlaySettingsPush(delay = 120) {
    if (!state.controlMode || state.remoteApplying) return;
    if (state.overlaySettingsPushTimer) return;
    state.overlaySettingsPushTimer = window.setTimeout(async () => {
      state.overlaySettingsPushTimer = null;
      const payload = {
        type: "videochat_overlay_settings",
        client_id: state.clientId,
        settings: settingsSnapshot(),
      };
      try {
        await fetch("/api/videochat/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (_) {}
    }, delay);
  }

  function persistSetting(key, value) {
    storageSet(key, JSON.stringify(value));
    scheduleOverlaySettingsPush();
  }

  function loadCameraSettings() {
    try {
      const raw = localStorage.getItem(CAMERA_SETTINGS_KEY);
      const s = Object.assign(
        {},
        raw ? JSON.parse(raw) : {},
        settingSection("camera") || {}
      );
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
    persistSetting(CAMERA_SETTINGS_KEY, {
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
    });
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
      return Object.assign(defaultChatSettings(), raw ? JSON.parse(raw) : {}, settingSection("chat") || {});
    } catch (_) {
      return defaultChatSettings();
    }
  }

  function saveChatSettings() {
    if (!state.chatSettings) return;
    persistSetting(CHAT_SETTINGS_KEY, state.chatSettings);
  }

  function clampChatSettings(s) {
    const minW = 260;
    const minH = 180;
    const viewportPad = 6;
    s.w = Math.min(window.innerWidth - viewportPad * 2, Math.max(minW, Number(s.w) || minW));
    s.h = Math.min(window.innerHeight - viewportPad * 2, Math.max(minH, Number(s.h) || minH));
    s.x = Math.min(window.innerWidth - s.w - 6, Math.max(6, Number(s.x) || 6));
    s.y = Math.min(window.innerHeight - s.h - 6, Math.max(6, Number(s.y) || 6));
    s.fontSize = Math.min(96, Math.max(10, Number(s.fontSize) || 18));
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

  function defaultStreamPreviewSettings() {
    const panelW = Math.min(300, Math.max(230, Math.round(window.innerWidth * 0.14)));
    const panelH = Math.min(360, Math.max(220, Math.round(window.innerHeight * 0.28)));
    const viewerW = Math.min(760, Math.max(440, Math.round(window.innerWidth * 0.34)));
    const viewerH = Math.round(viewerW * 0.58);
    return {
      x: 18,
      y: 92,
      w: panelW,
      h: panelH,
      hidden: false,
      viewer: {
        open: false,
        key: "",
        x: Math.max(16, Math.round((window.innerWidth - viewerW) / 2)),
        y: Math.max(16, Math.round((window.innerHeight - viewerH) / 2)),
        w: viewerW,
        h: viewerH,
      },
    };
  }

  function loadStreamPreviewSettings() {
    try {
      const raw = localStorage.getItem(STREAM_PREVIEW_SETTINGS_KEY);
      const base = defaultStreamPreviewSettings();
      const saved = raw ? JSON.parse(raw) : {};
      const remote = settingSection("streamPreview") || {};
      return Object.assign(base, saved, remote, {
        viewer: Object.assign(base.viewer, saved.viewer || {}, remote.viewer || {}),
      });
    } catch (_) {
      return defaultStreamPreviewSettings();
    }
  }

  function saveStreamPreviewSettings() {
    if (!state.streamPreviewSettings) return;
    persistSetting(STREAM_PREVIEW_SETTINGS_KEY, state.streamPreviewSettings);
  }

  function clampStreamPreviewSettings(s) {
    const minW = 176;
    const minH = 136;
    const pad = 6;
    s.w = Math.min(window.innerWidth - pad * 2, Math.max(minW, Number(s.w) || minW));
    s.h = Math.min(window.innerHeight - pad * 2, Math.max(minH, Number(s.h) || minH));
    s.x = Math.min(window.innerWidth - s.w - pad, Math.max(pad, Number(s.x) || pad));
    s.y = Math.min(window.innerHeight - s.h - pad, Math.max(pad, Number(s.y) || pad));
    const viewer = s.viewer || {};
    viewer.w = Math.min(window.innerWidth - pad * 2, Math.max(280, Number(viewer.w) || 480));
    viewer.h = Math.min(window.innerHeight - pad * 2, Math.max(180, Number(viewer.h) || 280));
    viewer.x = Math.min(window.innerWidth - viewer.w - pad, Math.max(pad, Number(viewer.x) || pad));
    viewer.y = Math.min(window.innerHeight - viewer.h - pad, Math.max(pad, Number(viewer.y) || pad));
    viewer.open = !!viewer.open;
    viewer.key = String(viewer.key || "");
    s.viewer = viewer;
  }

  function streamParticipantKey(p) {
    return keyFor(p);
  }

  function isSubaccountParticipant(p) {
    return !!(p && typeof p === "object" && p.is_subaccount);
  }

  function shouldHideSubaccountParticipant(p) {
    return !!state.avatarSettings?.hideSubaccount && isSubaccountParticipant(p);
  }

  function displayedParticipants() {
    return Array.from(state.participants.values()).filter((p) => !shouldHideSubaccountParticipant(p));
  }

  function displayedParticipantCount() {
    return displayedParticipants().length;
  }

  function cleanUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
  }

  function isSelfParticipant(p) {
    if (!p || typeof p !== "object") return false;
    if (p.is_host || hasRole(p, "king")) return true;
    const hostId = String(state.cfg.host_user_id || "").trim();
    const id = String(p.id || p.speaker_id || "").trim();
    if (hostId && id && hostId === id) return true;
    const hostUsername = cleanUsername(state.cfg.host_username);
    const username = cleanUsername(p.username);
    if (hostUsername && username && hostUsername === username) return true;
    const hostName = String(state.cfg.host_name || "").trim().toLowerCase();
    const name = String(p.name || "").trim().toLowerCase();
    return !!(hostName && name && hostName === name);
  }

  function streamPreviewRows() {
    return displayedParticipants()
      .filter((p) => !!p.video || !!p.screen)
      .sort((a, b) => Number(b.screen || 0) - Number(a.screen || 0) || String(a.name).localeCompare(String(b.name)));
  }

  function streamPreviewLabel(p) {
    return p.screen ? "SCREEN" : "LIVE";
  }

  function streamPreviewKind(p) {
    return p.screen ? "screen" : "video";
  }

  function streamPreviewUrl(p) {
    const stream = p?.stream && typeof p.stream === "object" ? p.stream : null;
    if (!stream) return "";
    if (typeof stream.mjpeg_url === "string" && stream.mjpeg_url) return stream.mjpeg_url;
    return typeof stream.url === "string" ? stream.url : "";
  }

  function streamPreviewStream(p) {
    return p?.stream && typeof p.stream === "object" ? p.stream : null;
  }

  function cacheBustStreamUrl(url, key = "_") {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(key)}=${Date.now()}`;
  }

  function refreshStreamPreviews() {
    state.streamPreviewSignature = "";
    renderStreamPreviews(true);
  }

  function clampByte(value) {
    return Math.max(0, Math.min(255, value));
  }

  function decodeBase64Bytes(value) {
    const raw = atob(String(value || ""));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  function renderYuv420Frame(canvas, payload) {
    const width = Number(payload?.width || 0);
    const height = Number(payload?.height || 0);
    if (!width || !height || !payload?.data) return false;
    const bytes = decodeBase64Bytes(payload.data);
    const maxWidth = canvas.classList.contains("large") ? 720 : 320;
    const outW = Math.max(1, Math.min(width, maxWidth));
    const outH = Math.max(1, Math.round((height / width) * outW));
    if (canvas.width !== outW || canvas.height !== outH) {
      canvas.width = outW;
      canvas.height = outH;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    const image = ctx.createImageData(outW, outH);
    const ySize = width * height;
    const uvW = Math.floor(width / 2);
    const uvSize = uvW * Math.floor(height / 2);
    const isNv12 = String(payload.format || "").toLowerCase() === "nv12";
    for (let y = 0; y < outH; y += 1) {
      const sy = Math.min(height - 1, Math.floor((y * height) / outH));
      for (let x = 0; x < outW; x += 1) {
        const sx = Math.min(width - 1, Math.floor((x * width) / outW));
        const yValue = bytes[sy * width + sx] || 0;
        let uValue = 128;
        let vValue = 128;
        if (isNv12) {
          const uvIndex = ySize + Math.floor(sy / 2) * width + Math.floor(sx / 2) * 2;
          uValue = bytes[uvIndex] ?? 128;
          vValue = bytes[uvIndex + 1] ?? 128;
        } else {
          const uvIndex = Math.floor(sy / 2) * uvW + Math.floor(sx / 2);
          uValue = bytes[ySize + uvIndex] ?? 128;
          vValue = bytes[ySize + uvSize + uvIndex] ?? 128;
        }
        const c = yValue - 16;
        const d = uValue - 128;
        const e = vValue - 128;
        const offset = (y * outW + x) * 4;
        image.data[offset] = clampByte((298 * c + 409 * e + 128) >> 8);
        image.data[offset + 1] = clampByte((298 * c - 100 * d - 208 * e + 128) >> 8);
        image.data[offset + 2] = clampByte((298 * c + 516 * d + 128) >> 8);
        image.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return true;
  }

  function attachRawStreamCanvas(canvas, url, large = false) {
    const token = `${url}:${Date.now()}:${Math.random()}`;
    canvas.dataset.rawToken = token;
    canvas.classList.toggle("large", !!large);
    const tick = async () => {
      if (!canvas.isConnected || canvas.dataset.rawToken !== token) return;
      try {
        const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (renderYuv420Frame(canvas, payload)) {
            canvas.closest(".stream-preview-surface")?.classList.add("has-real-stream");
          }
        }
      } catch {
        canvas.closest(".stream-preview-surface")?.classList.remove("has-real-stream");
      }
      window.setTimeout(tick, large ? 120 : 240);
    };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(tick);
    } else {
      window.setTimeout(tick, 0);
    }
  }

  function attachMjpegStreamImage(media, surface, url) {
    const token = `${url}:${Date.now()}:${Math.random()}`;
    media.dataset.mjpegToken = token;
    let retryCount = 0;
    let retryTimer = 0;
    let recycleTimer = 0;

    const isCurrent = () => media.isConnected && media.dataset.mjpegToken === token;
    const clearTimers = () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      if (recycleTimer) window.clearTimeout(recycleTimer);
      retryTimer = 0;
      recycleTimer = 0;
    };
    const connect = (reason = "open") => {
      if (!isCurrent()) {
        clearTimers();
        return;
      }
      if (recycleTimer) window.clearTimeout(recycleTimer);
      recycleTimer = window.setTimeout(() => connect("cycle"), STREAM_PREVIEW_MJPEG_RECYCLE_MS);
      media.src = cacheBustStreamUrl(url, `mjpeg_${reason}`);
    };
    const scheduleRetry = () => {
      if (!isCurrent() || retryTimer) return;
      const delay = Math.min(
        STREAM_PREVIEW_MJPEG_RETRY_MAX_MS,
        STREAM_PREVIEW_MJPEG_RETRY_MIN_MS * Math.max(1, 2 ** Math.min(retryCount, 3))
      );
      retryTimer = window.setTimeout(() => {
        retryTimer = 0;
        retryCount += 1;
        connect("retry");
      }, delay);
    };

    media.addEventListener("load", () => {
      if (!isCurrent()) return;
      retryCount = 0;
      surface.classList.add("has-real-stream");
    });
    media.addEventListener("error", () => {
      if (!isCurrent()) return;
      surface.classList.remove("has-real-stream");
      scheduleRetry();
    });
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(() => connect());
    } else {
      window.setTimeout(() => connect(), 0);
    }
  }

  function fillStreamSurface(target, p, large = false) {
    target.innerHTML = "";
    const color = participantColor(p);
    const surface = document.createElement("div");
    surface.className = `stream-preview-surface ${streamPreviewKind(p)}${large ? " large" : ""}`;
    surface.style.setProperty("--stream-color", color);
    const visual = document.createElement("div");
    visual.className = "stream-preview-visual";
    const stream = streamPreviewStream(p);
    const streamUrl = streamPreviewUrl(p);
    if (streamUrl) {
      if (stream?.mjpeg_url) {
        const media = document.createElement("img");
        media.className = "stream-preview-media mjpeg";
        media.alt = "";
        media.decoding = "async";
        visual.appendChild(media);
        attachMjpegStreamImage(media, surface, stream.mjpeg_url);
      } else if (stream?.raw) {
        const media = document.createElement("canvas");
        media.className = "stream-preview-media raw";
        attachRawStreamCanvas(media, streamUrl, large);
        visual.appendChild(media);
      } else {
        const media = document.createElement("video");
        media.className = "stream-preview-media";
        media.src = streamUrl;
        media.autoplay = true;
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.controls = large;
        media.addEventListener("loadeddata", () => {
          surface.classList.add("has-real-stream");
        });
        media.addEventListener("error", () => {
          surface.classList.remove("has-real-stream");
        });
        visual.appendChild(media);
      }
    }
    const avatar = document.createElement("div");
    avatar.className = "stream-preview-avatar";
    if (p.avatar_url) {
      const img = document.createElement("img");
      img.src = p.avatar_url;
      img.alt = "";
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(p.name || p.username);
    }
    const camera = document.createElement("div");
    camera.className = "stream-preview-camera";
    const label = document.createElement("div");
    label.className = "stream-preview-live";
    const liveText = document.createElement("span");
    liveText.className = "stream-preview-live-text";
    liveText.textContent = streamPreviewLabel(p);
    const mic = document.createElement("span");
    mic.className = "stream-preview-mic";
    mic.classList.toggle("muted", !!p.muted);
    mic.title = p.muted ? "mic off" : "mic on";
    mic.setAttribute("aria-label", p.muted ? "mic off" : "mic on");
    const inlineName = document.createElement("span");
    inlineName.className = "stream-preview-inline-name";
    inlineName.textContent = p.name || p.username || "Unknown";
    inlineName.style.color = color;
    label.append(liveText, mic, inlineName);
    visual.append(avatar, camera, label);
    surface.append(visual);
    target.appendChild(surface);
  }

  function renderStreamPreviews(force = false) {
    if (!state.streamPreviewSettings || !streamPreviewPanel || !streamPreviewList) return;
    const rows = streamPreviewRows();
    const activeKeys = new Set(rows.map(streamParticipantKey));
    const viewer = state.streamPreviewSettings.viewer || {};
    if (viewer.key && !activeKeys.has(viewer.key)) {
      viewer.key = "";
      viewer.open = false;
    }
    const signature = rows
      .map((p) => [streamParticipantKey(p), p.name, p.username, p.avatar_url, p.video ? 1 : 0, p.screen ? 1 : 0, p.muted ? 1 : 0, streamPreviewUrl(p), participantColor(p)].join(":"))
      .join("|") + `|${viewer.key}|${viewer.open ? 1 : 0}`;
    const changed = force || signature !== state.streamPreviewSignature;
    if (changed) {
      state.streamPreviewSignature = signature;
      streamPreviewList.innerHTML = "";
      for (const p of rows) {
        const key = streamParticipantKey(p);
        const item = document.createElement("button");
        item.type = "button";
        item.className = `stream-preview-item ${streamPreviewKind(p)}`;
        item.classList.toggle("active", viewer.open && viewer.key === key);
        item.style.setProperty("--stream-color", participantColor(p));
        item.dataset.key = key;
        const thumb = document.createElement("div");
        thumb.className = "stream-preview-thumb";
        fillStreamSurface(thumb, p, false);
        item.append(thumb);
        item.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          state.streamPreviewSettings.viewer.open = true;
          state.streamPreviewSettings.viewer.key = key;
          applyStreamPreviewSettings();
          renderStreamPreviews(true);
          saveStreamPreviewSettings();
        });
        streamPreviewList.appendChild(item);
      }
    }
    streamPreviewPanel.classList.toggle("empty", rows.length === 0);
    const active = rows.find((p) => streamParticipantKey(p) === viewer.key);
    streamPreviewViewer.hidden = !(viewer.open && active);
    if (active && streamViewerBody && (changed || streamViewerBody.dataset.key !== streamParticipantKey(active))) {
      streamViewerBody.dataset.key = streamParticipantKey(active);
      fillStreamSurface(streamViewerBody, active, true);
    } else if (!active && streamViewerBody) {
      streamViewerBody.dataset.key = "";
    }
  }

  function applyStreamPreviewSettings(render = false) {
    if (!state.streamPreviewSettings || !streamPreviewPanel) return;
    clampStreamPreviewSettings(state.streamPreviewSettings);
    const s = state.streamPreviewSettings;
    streamPreviewPanel.style.left = `${s.x}px`;
    streamPreviewPanel.style.top = `${s.y}px`;
    streamPreviewPanel.style.width = `${s.w}px`;
    streamPreviewPanel.style.height = `${s.h}px`;
    streamPreviewPanel.classList.toggle("preview-hidden", !!s.hidden);
    if (streamPreviewToggle) {
      streamPreviewToggle.textContent = s.hidden ? "show" : "hide";
      streamPreviewToggle.title = s.hidden ? "show preview" : "hide preview";
      streamPreviewToggle.setAttribute("aria-label", s.hidden ? "show preview" : "hide preview");
    }
    const viewer = s.viewer || {};
    streamPreviewViewer.style.left = `${viewer.x}px`;
    streamPreviewViewer.style.top = `${viewer.y}px`;
    streamPreviewViewer.style.width = `${viewer.w}px`;
    streamPreviewViewer.style.height = `${viewer.h}px`;
    if (render) renderStreamPreviews(true);
  }

  function setupStreamPreviewControls() {
    state.streamPreviewSettings = loadStreamPreviewSettings();
    applyStreamPreviewSettings(true);
    streamPreviewToggle?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.streamPreviewSettings.hidden = !state.streamPreviewSettings.hidden;
      applyStreamPreviewSettings();
      saveStreamPreviewSettings();
    });
    streamPreviewRefresh?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      refreshStreamPreviews();
    });
    streamViewerRefresh?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      refreshStreamPreviews();
    });
    streamViewerClose?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.streamPreviewSettings.viewer.open = false;
      state.streamPreviewSettings.viewer.key = "";
      applyStreamPreviewSettings(true);
      saveStreamPreviewSettings();
    });

    let dragMode = null;
    let start = null;
    function begin(ev, target, mode) {
      if (!state.streamPreviewSettings) return;
      ev.preventDefault();
      ev.stopPropagation();
      dragMode = { target, mode };
      start = {
        x: ev.clientX,
        y: ev.clientY,
        panel: { ...state.streamPreviewSettings },
        viewer: { ...(state.streamPreviewSettings.viewer || {}) },
      };
      streamPreviewControls?.classList.toggle("dragging", target === "panel");
      streamViewerBar?.classList.toggle("dragging", target === "viewer");
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    }
    function move(ev) {
      if (!dragMode || !start) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (dragMode.target === "panel") {
        if (dragMode.mode === "move") {
          state.streamPreviewSettings.x = start.panel.x + dx;
          state.streamPreviewSettings.y = start.panel.y + dy;
        } else {
          state.streamPreviewSettings.w = start.panel.w + dx;
          state.streamPreviewSettings.h = start.panel.h + dy;
        }
      } else {
        const viewer = state.streamPreviewSettings.viewer;
        if (dragMode.mode === "move") {
          viewer.x = start.viewer.x + dx;
          viewer.y = start.viewer.y + dy;
        } else {
          viewer.w = start.viewer.w + dx;
          viewer.h = start.viewer.h + dy;
        }
      }
      applyStreamPreviewSettings();
    }
    function end() {
      if (!dragMode) return;
      dragMode = null;
      start = null;
      streamPreviewControls?.classList.remove("dragging");
      streamViewerBar?.classList.remove("dragging");
      saveStreamPreviewSettings();
    }
    streamPreviewDrag?.addEventListener("pointerdown", (ev) => begin(ev, "panel", "move"));
    streamPreviewResize?.addEventListener("pointerdown", (ev) => begin(ev, "panel", "resize"));
    streamViewerDrag?.addEventListener("pointerdown", (ev) => begin(ev, "viewer", "move"));
    streamViewerBody?.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      begin(ev, "viewer", "move");
    });
    streamViewerResize?.addEventListener("pointerdown", (ev) => begin(ev, "viewer", "resize"));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("resize", () => {
      applyStreamPreviewSettings(false);
      saveStreamPreviewSettings();
    });
  }

  function defaultWidgetSettings() {
    return {
      controls: {
        x: 18,
        y: Math.max(18, window.innerHeight - 64),
      },
      price: {
        x: 18,
        y: Math.max(18, window.innerHeight - 355),
        w: 420,
        h: 245,
        hidden: false,
        textScale: 1,
      },
      youtube: {
        x: Math.max(18, window.innerWidth - 650),
        y: 120,
        w: 620,
        h: 410,
        open: false,
        hidden: true,
        query: "",
        url: "",
        videoId: "",
      },
      electronBrowser: {
        x: Math.max(18, Math.round(window.innerWidth * 0.5) - 430),
        y: 96,
        w: Math.min(860, Math.max(520, window.innerWidth - 80)),
        h: Math.min(560, Math.max(340, window.innerHeight - 160)),
        open: false,
        hidden: true,
        debug: false,
        url: "",
      },
      game: {
        x: Math.max(18, Math.round(window.innerWidth * 0.5) - 320),
        y: 110,
        w: 720,
        h: 590,
        open: false,
        hidden: true,
        selected: "pokemon-gold",
        rom: "pk_gold.gb",
        groupPlay: true,
        debug: false,
        speed: 1,
        volume: 0.75,
        layoutDebug: false,
        manualOpen: false,
        manualX: null,
        manualY: null,
        manualDragged: false,
        manualCoordMode: "local-guide",
        manualScale: 1,
        closedAt: 0,
        lastCommand: "",
      },
      characterMove: {
        x: Math.max(18, window.innerWidth - 430),
        y: 170,
        w: 390,
        h: 430,
        open: false,
        hidden: true,
        selectedKey: "",
        placements: {},
      },
      miniJail: {
        x: Math.max(18, window.innerWidth - 430),
        y: 96,
        w: 390,
        h: 460,
        open: false,
        hidden: true,
        scale: 0.45,
        active: [],
        pending: [],
      },
      realJail: {
        x: Math.max(18, window.innerWidth - 455),
        y: 128,
        w: 410,
        h: 480,
        worldX: 5.65,
        worldZ: CAMPFIRE_CENTER.z,
        worldYaw: 0,
        open: false,
        hidden: true,
        scale: 0.36,
        active: [],
        pending: [],
        signText: "개집",
        signColor: "#ffd36a",
      },
      memos: [],
      browsers: [],
    };
  }

  function loadWidgetSettings() {
    try {
      const base = defaultWidgetSettings();
      const raw = localStorage.getItem(WIDGET_SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      const remote = settingSection("widgets") || {};
      const merged = Object.assign(base, saved, remote);
      merged.controls = Object.assign(base.controls, saved.controls || {}, remote.controls || {});
      merged.price = Object.assign(base.price, saved.price || {}, remote.price || {});
      merged.youtube = Object.assign(base.youtube, saved.youtube || {}, remote.youtube || {});
      merged.electronBrowser = normalizeElectronBrowserWidget(Object.assign(base.electronBrowser, saved.electronBrowser || {}, remote.electronBrowser || {}));
      merged.game = normalizeGameWidget(Object.assign(base.game, saved.game || {}, remote.game || {}));
      merged.characterMove = normalizeCharacterMoveWidget(Object.assign(base.characterMove, saved.characterMove || {}, remote.characterMove || {}));
      merged.miniJail = normalizePrisonWidget(Object.assign(base.miniJail, saved.miniJail || {}, remote.miniJail || {}), "mini");
      merged.realJail = normalizePrisonWidget(Object.assign(base.realJail, saved.realJail || {}, remote.realJail || {}), "real");
      const memoSource = Array.isArray(remote.memos) ? remote.memos : (Array.isArray(saved.memos) ? saved.memos : []);
      merged.memos = memoSource.map(normalizeMemoWidget).filter(Boolean);
      const browserSource = Array.isArray(remote.browsers) ? remote.browsers : (Array.isArray(saved.browsers) ? saved.browsers : []);
      merged.browsers = browserSource.map(normalizeBrowserWidget).filter(Boolean);
      return merged;
    } catch (_) {
      return defaultWidgetSettings();
    }
  }

  function saveWidgetSettings() {
    if (!state.widgetSettings) return;
    persistSetting(WIDGET_SETTINGS_KEY, state.widgetSettings);
  }

  function saveWidgetSettingsSoon(delay = 300) {
    if (!state.widgetSettings) return;
    if (state.gameWidgetSaveTimer) window.clearTimeout(state.gameWidgetSaveTimer);
    state.gameWidgetSaveTimer = window.setTimeout(() => {
      state.gameWidgetSaveTimer = 0;
      saveWidgetSettings();
    }, delay);
  }

  function applyWidgetControlsPosition() {
    if (!widgetControls || !state.widgetSettings) return;
    const controls = state.widgetSettings.controls || {};
    const pad = 6;
    const rect = widgetControls.getBoundingClientRect();
    const w = rect.width || 160;
    const h = rect.height || 44;
    controls.x = Math.min(window.innerWidth - w - pad, Math.max(pad, Number(controls.x) || pad));
    controls.y = Math.min(window.innerHeight - h - pad, Math.max(pad, Number(controls.y) || pad));
    state.widgetSettings.controls = controls;
    widgetControls.style.left = `${controls.x}px`;
    widgetControls.style.top = `${controls.y}px`;
    widgetControls.style.bottom = "auto";
  }

  function setupWidgetControlsDrag() {
    if (!widgetControls) return;
    let start = null;
    let suppressClickUntil = 0;
    widgetControls.addEventListener("click", (ev) => {
      const dragClick = ev.target === widgetControls || !!ev.target.closest("#widget-controls-drag");
      if (dragClick && Date.now() < suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
    widgetControls.addEventListener("pointerdown", (ev) => {
      if (!state.controlMode || !state.widgetSettings?.controls || ev.button !== 0) return;
      const dragTarget = ev.target === widgetControls || !!ev.target.closest("#widget-controls-drag");
      if (!dragTarget) return;
      ev.preventDefault();
      ev.stopPropagation();
      start = {
        x: ev.clientX,
        y: ev.clientY,
        controls: { ...state.widgetSettings.controls },
        dragging: false,
      };
      widgetControls.setPointerCapture?.(ev.pointerId);
    });
    widgetControls.addEventListener("pointermove", (ev) => {
      if (!start || !state.widgetSettings?.controls) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!start.dragging && Math.hypot(dx, dy) < 4) return;
      start.dragging = true;
      suppressClickUntil = Date.now() + 350;
      ev.preventDefault();
      ev.stopPropagation();
      widgetControls.classList.add("dragging");
      state.widgetSettings.controls.x = start.controls.x + dx;
      state.widgetSettings.controls.y = start.controls.y + dy;
      applyWidgetControlsPosition();
    });
    widgetControls.addEventListener("pointerup", () => {
      if (!start) return;
      const dragged = start.dragging;
      start = null;
      widgetControls.classList.remove("dragging");
      if (dragged) {
        suppressClickUntil = Date.now() + 350;
        saveWidgetSettings();
      }
    });
    widgetControls.addEventListener("pointercancel", () => {
      start = null;
      widgetControls.classList.remove("dragging");
    });
    widgetControlsDrag?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
  }

  function normalizeMemoWidget(memo) {
    if (!memo || typeof memo !== "object") return null;
    return {
      id: String(memo.id || `memo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
      text: String(memo.text || ""),
      x: Number(memo.x),
      y: Number(memo.y),
      w: Number(memo.w),
      h: Number(memo.h),
      fontSize: Number(memo.fontSize) || 18,
      hidden: !!memo.hidden,
    };
  }

  function normalizeBrowserWidget(browser) {
    if (!browser || typeof browser !== "object") return null;
    return {
      id: String(browser.id || `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`),
      url: String(browser.url || ""),
      proxy: !!browser.proxy,
      x: Number(browser.x),
      y: Number(browser.y),
      w: Number(browser.w),
      h: Number(browser.h),
      hidden: !!browser.hidden,
    };
  }

  function normalizeElectronBrowserWidget(browser) {
    const defaults = defaultWidgetSettings().electronBrowser;
    if (!browser || typeof browser !== "object") return { ...defaults };
    return {
      x: Number(browser.x),
      y: Number(browser.y),
      w: Number(browser.w),
      h: Number(browser.h),
      open: !!browser.open,
      hidden: !!browser.hidden,
      debug: !!browser.debug,
      url: String(browser.url || defaults.url),
      title: String(browser.title || ""),
      canGoBack: !!browser.canGoBack,
      canGoForward: !!browser.canGoForward,
      loading: !!browser.loading,
    };
  }

  function clampPrisonScale(value, fallback = 0.45) {
    const number = Number(value);
    return Math.round(Math.min(0.9, Math.max(0.1, Number.isFinite(number) ? number : fallback)) * 100) / 100;
  }

  function clampJailWorldValue(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.round(Math.min(max, Math.max(min, number)) * 100) / 100;
  }

  function clampWorldX(value, fallback = 0) {
    return clampJailWorldValue(value, fallback, WORLD_BOUNDS.xMin, WORLD_BOUNDS.xMax);
  }

  function clampWorldZ(value, fallback = CAMPFIRE_CENTER.z) {
    return clampJailWorldValue(value, fallback, WORLD_BOUNDS.zMin, WORLD_BOUNDS.zMax);
  }

  function normalizeJailYaw(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const fullTurn = Math.PI * 2;
    let normalized = number % fullTurn;
    if (normalized > Math.PI) normalized -= fullTurn;
    if (normalized < -Math.PI) normalized += fullTurn;
    return Math.round(normalized * 1000) / 1000;
  }

  function normalizeCharacterPlacement(value) {
    if (!value || typeof value !== "object") return null;
    const space = String(value.space || "").toLowerCase() === "jail" ? "jail" : "world";
    const x = space === "jail"
      ? clampJailWorldValue(value.x, NaN, -1.08, 1.08)
      : clampWorldX(value.x, NaN);
    const z = space === "jail"
      ? clampJailWorldValue(value.z, NaN, -0.78, 0.78)
      : clampWorldZ(value.z, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const yawMode = String(value.yawMode || "").toLowerCase() === "manual" ? "manual" : "auto";
    return {
      x,
      z,
      space,
      yawMode,
      yaw: normalizeJailYaw(value.yaw, 0),
    };
  }

  function normalizeCharacterPlacements(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [rawKey, rawPlacement] of Object.entries(value)) {
      const key = String(rawKey || "").trim();
      const placement = normalizeCharacterPlacement(rawPlacement);
      if (key && placement) out[key] = placement;
    }
    return out;
  }

  function normalizeCharacterMoveWidget(widget) {
    const defaults = defaultWidgetSettings().characterMove;
    if (!widget || typeof widget !== "object") return { ...defaults, placements: {} };
    return {
      x: Number(widget.x),
      y: Number(widget.y),
      w: Number(widget.w),
      h: Number(widget.h),
      open: !!widget.open,
      hidden: !!widget.hidden,
      selectedKey: String(widget.selectedKey || ""),
      placements: normalizeCharacterPlacements(widget.placements),
    };
  }

  function normalizeGameWidget(widget) {
    const defaults = defaultWidgetSettings().game;
    if (!widget || typeof widget !== "object") return { ...defaults };
    const selected = String(widget.selected || defaults.selected);
    return {
      x: Number(widget.x),
      y: Number(widget.y),
      w: Number(widget.w),
      h: Number(widget.h),
      open: !!widget.open,
      hidden: !!widget.hidden,
      selected: selected === "pokemon-gold" ? selected : defaults.selected,
      rom: safeFilename(widget.rom || defaults.rom) || defaults.rom,
      groupPlay: widget.groupPlay !== false,
      debug: false,
      speed: normalizeGameSpeed(widget.speed || defaults.speed),
      volume: normalizeGameVolume(widget.volume ?? defaults.volume),
      layoutDebug: !!widget.layoutDebug,
      manualOpen: !!widget.manualOpen,
      manualX: widget.manualX === null || widget.manualX === undefined ? NaN : Number(widget.manualX),
      manualY: widget.manualY === null || widget.manualY === undefined ? NaN : Number(widget.manualY),
      manualDragged: widget.manualCoordMode === "local-guide" && !!widget.manualDragged,
      manualCoordMode: "local-guide",
      manualScale: clampGameManualScale(widget.manualScale ?? defaults.manualScale),
      closedAt: Math.max(0, Number(widget.closedAt) || 0),
      lastCommand: String(widget.lastCommand || "").slice(0, 80),
    };
  }

  function normalizeGameSpeed(value) {
    const speeds = [1, 1.5, 2, 3, 4];
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return speeds.reduce((best, speed) => (
      Math.abs(speed - number) < Math.abs(best - number) ? speed : best
    ), 1);
  }

  function shiftGameSpeed(value, delta) {
    const speeds = [1, 1.5, 2, 3, 4];
    const current = normalizeGameSpeed(value);
    const index = Math.max(0, speeds.indexOf(current));
    return speeds[Math.min(speeds.length - 1, Math.max(0, index + delta))];
  }

  function gameSpeedLabel(value) {
    const speed = normalizeGameSpeed(value);
    return `x${Number.isInteger(speed) ? speed : speed.toFixed(1)}`;
  }

  function normalizeGameVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.75;
    return clamp(number, 0, 1);
  }

  function gameVolumeLabel(value) {
    return `${Math.round(normalizeGameVolume(value) * 100)}%`;
  }

  function safeFilename(value) {
    return String(value || "").split(/[\\/]/).pop().replace(/[^\w .()+@-]/g, "").trim().slice(0, 160);
  }

  function normalizeKeyList(value) {
    const out = [];
    const push = (item) => {
      const key = String(typeof item === "object" && item ? (item.key || item.id || item.username || item.name || "") : item || "").trim();
      if (key && !out.includes(key)) out.push(key);
    };
    if (Array.isArray(value)) value.forEach(push);
    return out;
  }

  function normalizePrisonWidget(widget, kind = "mini") {
    const defaults = kind === "real" ? defaultWidgetSettings().realJail : defaultWidgetSettings().miniJail;
    const scale = clampPrisonScale(widget?.scale, defaults.scale);
    const active = normalizeKeyList(widget?.active);
    const pending = normalizeKeyList(widget?.pending?.length ? widget.pending : active);
    const normalized = {
      x: Number(widget?.x),
      y: Number(widget?.y),
      w: Number(widget?.w),
      h: Number(widget?.h),
      open: !!widget?.open,
      hidden: !!widget?.hidden,
      scale,
      active,
      pending,
    };
    if (kind === "real") {
      normalized.worldX = clampWorldX(widget?.worldX, defaults.worldX);
      normalized.worldZ = clampWorldZ(widget?.worldZ, defaults.worldZ);
      normalized.worldYaw = normalizeJailYaw(widget?.worldYaw, defaults.worldYaw);
      normalized.signText = normalizeJailSignText(widget?.signText, defaults.signText);
      normalized.signColor = normalizeJailSignColor(widget?.signColor, defaults.signColor);
    }
    return normalized;
  }

  function normalizeJailSignText(value, fallback = "개집") {
    if (value === undefined || value === null) return fallback;
    return String(value).replace(/[\r\n\t]+/g, " ").trim().slice(0, 14);
  }

  function normalizeJailSignColor(value, fallback = "#ffd36a") {
    const raw = String(value || "").trim();
    const short = raw.match(/^#([0-9a-f]{3})$/i);
    if (short) {
      return `#${short[1].split("").map((ch) => `${ch}${ch}`).join("")}`.toLowerCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    return fallback;
  }

  function clampWidgetBox(box, minW = 180, minH = 110, displayW = 0, displayH = 0) {
    const pad = 6;
    box.w = Math.min(window.innerWidth - pad * 2, Math.max(minW, Number(box.w) || minW));
    box.h = Math.min(window.innerHeight - pad * 2, Math.max(minH, Number(box.h) || minH));
    const effectiveW = Number(displayW) || box.w;
    const effectiveH = Number(displayH) || box.h;
    box.x = Math.min(window.innerWidth - effectiveW - pad, Math.max(pad, Number(box.x) || pad));
    box.y = Math.min(window.innerHeight - effectiveH - pad, Math.max(pad, Number(box.y) || pad));
  }

  function applyWidgetBox(el, box, minW, minH) {
    const hiddenW = box.hidden ? 128 : 0;
    const hiddenH = box.hidden ? 36 : 0;
    clampWidgetBox(box, minW, minH, hiddenW, hiddenH);
    el.style.left = `${box.x}px`;
    el.style.top = `${box.y}px`;
    el.style.width = `${box.w}px`;
    el.style.height = `${box.h}px`;
    el.classList.toggle("hidden-widget", !!box.hidden);
  }

  function isWidgetDragBlockedTarget(target, currentTarget) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("button, input, textarea, select, [contenteditable='true'], .widget-resize");
  }

  function beginWidgetDragSession() {
    state.widgetDragDepth = (Number(state.widgetDragDepth) || 0) + 1;
    document.body.classList.add("widget-drag-active");
    setElectronNativeViewDragSuppressed(true);
  }

  function flushPendingWidgetRender() {
    if (state.widgetDragDepth > 0 || state.widgetInteractionDepth > 0 || !state.widgetRenderPending) return;
    window.requestAnimationFrame(() => {
      if (state.widgetDragDepth > 0 || state.widgetInteractionDepth > 0 || !state.widgetRenderPending) return;
      renderWidgets({ force: true });
    });
  }

  function endWidgetDragSession() {
    state.widgetDragDepth = Math.max(0, (Number(state.widgetDragDepth) || 0) - 1);
    if (state.widgetDragDepth > 0) return;
    document.body.classList.remove("widget-drag-active");
    setElectronNativeViewDragSuppressed(false);
    flushPendingWidgetRender();
  }

  function beginWidgetInteractionSession() {
    state.widgetInteractionDepth = (Number(state.widgetInteractionDepth) || 0) + 1;
  }

  function endWidgetInteractionSession() {
    state.widgetInteractionDepth = Math.max(0, (Number(state.widgetInteractionDepth) || 0) - 1);
    flushPendingWidgetRender();
  }

  function bindWidgetFrame(el, handles, resize, box, apply, save, minW, minH) {
    const moveHandles = (Array.isArray(handles) ? handles : [handles]).filter(Boolean);
    const protectLocalWidgetDrag = () => {
      if (el?.id === "game-widget") {
        state.gameLocalOverrideUntil = Date.now() + 5000;
      }
    };
    function begin(ev, mode) {
      if (!state.controlMode) return;
      if (mode === "move" && isWidgetDragBlockedTarget(ev.target, ev.currentTarget)) return;
      ev.preventDefault();
      ev.stopPropagation();
      protectLocalWidgetDrag();
      const pointerId = ev.pointerId;
      const target = ev.currentTarget;
      const start = {
        x: ev.clientX,
        y: ev.clientY,
        box: { ...box },
      };
      el.classList.add("dragging");
      beginWidgetDragSession();
      try { target.setPointerCapture?.(pointerId); } catch (_) {}
      const move = (moveEv) => {
        if (moveEv.pointerId !== undefined && moveEv.pointerId !== pointerId) return;
        if (moveEv.buttons !== undefined && (moveEv.buttons & 1) === 0) {
          finish();
          return;
        }
        protectLocalWidgetDrag();
        const dx = moveEv.clientX - start.x;
        const dy = moveEv.clientY - start.y;
        if (mode === "move") {
          box.x = start.box.x + dx;
          box.y = start.box.y + dy;
        } else {
          box.w = start.box.w + dx;
          box.h = start.box.h + dy;
        }
        apply();
      };
      const finish = () => {
        el.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        target.removeEventListener("lostpointercapture", finish);
        try { target.releasePointerCapture?.(pointerId); } catch (_) {}
        apply();
        save();
        endWidgetDragSession();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish, { once: true });
      window.addEventListener("pointercancel", finish, { once: true });
      target.addEventListener("lostpointercapture", finish, { once: true });
    }
    for (const handle of moveHandles) {
      handle?.addEventListener("pointerdown", (ev) => begin(ev, "move"));
    }
    resize?.addEventListener("pointerdown", (ev) => begin(ev, "resize"));
  }

  function widgetHideText(hidden, label) {
    return hidden ? `show ${label}` : "hide";
  }

  function consumeHiddenShowPointerClick(button) {
    if (button?.dataset.hiddenShowPointerHandled !== "1") return false;
    delete button.dataset.hiddenShowPointerHandled;
    return true;
  }

  function bindHiddenShowHandle(el, button, box, apply, save, show) {
    if (!el || !button || !box) return;
    let dragState = null;
    const markPointerHandled = () => {
      button.dataset.hiddenShowPointerHandled = "1";
      window.setTimeout(() => {
        if (button.dataset.hiddenShowPointerHandled === "1") {
          delete button.dataset.hiddenShowPointerHandled;
        }
      }, 450);
    };
    button.addEventListener("pointerdown", (ev) => {
      if (!box.hidden || !state.controlMode || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const pointerId = ev.pointerId;
      const rect = el.getBoundingClientRect();
      const boxX = Number(box.x);
      const boxY = Number(box.y);
      const start = {
        x: ev.clientX,
        y: ev.clientY,
        boxX: Number.isFinite(boxX) ? boxX : (rect.left || 0),
        boxY: Number.isFinite(boxY) ? boxY : (rect.top || 0),
        left: rect.left,
        top: rect.top,
        dragging: false,
      };
      dragState = start;
      beginWidgetDragSession();
      try { button.setPointerCapture?.(pointerId); } catch (_) {}
      const commitPosition = () => {
        const pad = 6;
        const maxX = Math.max(pad, window.innerWidth - 128 - pad);
        const maxY = Math.max(pad, window.innerHeight - 36 - pad);
        box.x = Math.min(maxX, Math.max(pad, Number(box.x) || pad));
        box.y = Math.min(maxY, Math.max(pad, Number(box.y) || pad));
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.transform = "translate3d(0,0,0)";
      };
      const move = (moveEv) => {
        if (dragState !== start) return;
        if (moveEv.pointerId !== undefined && moveEv.pointerId !== pointerId) return;
        if (moveEv.buttons !== undefined && (moveEv.buttons & 1) === 0) {
          end();
          return;
        }
        const dx = moveEv.clientX - start.x;
        const dy = moveEv.clientY - start.y;
        if (!start.dragging && Math.hypot(dx, dy) < 4) return;
        start.dragging = true;
        moveEv.preventDefault();
        box.x = start.boxX + dx;
        box.y = start.boxY + dy;
        commitPosition();
        el.classList.add("dragging");
      };
      const cleanup = () => {
        if (dragState === start) dragState = null;
        try { button.releasePointerCapture?.(pointerId); } catch (_) {}
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", cancel);
        button.removeEventListener("lostpointercapture", cancel);
      };
      const end = () => {
        cleanup();
        el.classList.remove("dragging");
        if (start.dragging) {
          commitPosition();
          markPointerHandled();
          apply();
          save();
        } else {
          markPointerHandled();
          show();
        }
        endWidgetDragSession();
      };
      const cancel = () => {
        cleanup();
        el.classList.remove("dragging");
        if (start.dragging) {
          commitPosition();
          markPointerHandled();
          apply();
          save();
        }
        endWidgetDragSession();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end, { once: true });
      window.addEventListener("pointercancel", cancel, { once: true });
      button.addEventListener("lostpointercapture", cancel, { once: true });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function formatMarketPrice(asset) {
    const price = Number(asset?.price);
    if (!Number.isFinite(price)) return "-";
    if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (price >= 10) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  function formatMarketChange(asset) {
    const change = Number(asset?.change);
    const pct = Number(asset?.change_pct);
    if (!Number.isFinite(change) || !Number.isFinite(pct)) return "-";
    const sign = change >= 0 ? "+" : "";
    const changeText = Math.abs(change) >= 100 ? change.toFixed(0) : change.toFixed(2);
    return `${sign}${changeText} (${sign}${pct.toFixed(2)}%)`;
  }

  function sparklinePath(points, width = 126, height = 34) {
    const values = (points || [])
      .map((item) => Number(Array.isArray(item) ? item[1] : item?.price))
      .filter((value) => Number.isFinite(value));
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(0.000001, max - min);
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function renderPriceRows(body) {
    const assets = Array.isArray(state.priceWidgetData?.assets) ? state.priceWidgetData.assets : [];
    body.innerHTML = "";
    if (!assets.length) {
      const empty = document.createElement("div");
      empty.className = "price-widget-empty";
      empty.textContent = state.priceWidgetLoading ? "loading prices" : "price feed unavailable";
      body.appendChild(empty);
      return;
    }
    for (const asset of assets) {
      const row = document.createElement("div");
      const pct = Number(asset.change_pct);
      row.className = `price-row ${pct > 0 ? "up" : pct < 0 ? "down" : "flat"}`;
      const path = sparklinePath(asset.points);
      row.innerHTML = `
        <div class="price-main">
          <span class="price-symbol">${escapeHtml(asset.label || asset.symbol || "")}</span>
          <span class="price-value">${formatMarketPrice(asset)}</span>
          <span class="price-change">${formatMarketChange(asset)}</span>
        </div>
        <svg class="price-spark" viewBox="0 0 126 34" preserveAspectRatio="none" aria-hidden="true">
          <path d="${path}"></path>
        </svg>
      `;
      body.appendChild(row);
    }
  }

  function updatePriceWidgetBody() {
    const body = widgetLayer?.querySelector("#price-widget .price-widget-body");
    if (body) renderPriceRows(body);
    else renderWidgets();
  }

  async function refreshPriceWidget(force = false) {
    if (!state.widgetSettings?.price || state.widgetSettings.price.hidden) return;
    if (state.priceWidgetLoading && !force) return;
    state.priceWidgetLoading = true;
    updatePriceWidgetBody();
    try {
      const payload = await fetch(`/api/market/prices?_=${Date.now()}`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      state.priceWidgetData = payload;
    } catch (exc) {
      state.priceWidgetData = {
        assets: [],
        error: String(exc?.message || exc || "price feed unavailable"),
        updated_at: Date.now() / 1000,
      };
    } finally {
      state.priceWidgetLoading = false;
      updatePriceWidgetBody();
    }
  }

  function schedulePriceWidgetRefresh(immediate = false) {
    if (state.priceWidgetTimer) window.clearInterval(state.priceWidgetTimer);
    state.priceWidgetTimer = window.setInterval(() => refreshPriceWidget(false), PRICE_REFRESH_MS);
    if (immediate) refreshPriceWidget(true);
  }

  function addMemoWidget() {
    if (!state.widgetSettings) return;
    const count = state.widgetSettings.memos.length;
    state.widgetSettings.memos.push({
      id: `memo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      x: Math.min(window.innerWidth - 300, 80 + count * 24),
      y: Math.min(window.innerHeight - 190, 120 + count * 24),
      w: 300,
      h: 170,
      fontSize: 18,
      hidden: false,
    });
    renderWidgets();
    saveWidgetSettings();
  }

  function addBrowserWidget() {
    if (!state.widgetSettings) return;
    if (!Array.isArray(state.widgetSettings.browsers)) state.widgetSettings.browsers = [];
    const count = state.widgetSettings.browsers.length;
    state.widgetSettings.browsers.push({
      id: `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      url: "",
      proxy: false,
      x: Math.min(window.innerWidth - 520, 130 + count * 28),
      y: Math.min(window.innerHeight - 360, 150 + count * 28),
      w: 520,
      h: 340,
      hidden: false,
    });
    renderWidgets();
    saveWidgetSettings();
  }

  function participantDisplayLabel(p) {
    return String(p?.name || p?.username || p?.id || "Unknown");
  }

  function participantDisplayLevel(p) {
    const levelsEnabled = p?.level_system_enabled !== false && state.cfg.level_system_enabled !== false;
    if (!levelsEnabled) return "";
    if (p?.is_host) return "Lv. 99";
    return String(p?.level_label || (Number.isFinite(Number(p?.level)) ? `Lv. ${Number(p.level)}` : "")).trim();
  }

  function prisonWidgetForKind(kind) {
    return kind === "real" ? state.widgetSettings?.realJail : state.widgetSettings?.miniJail;
  }

  function otherPrisonWidgetForKind(kind) {
    return kind === "real" ? state.widgetSettings?.miniJail : state.widgetSettings?.realJail;
  }

  function isRealJailed(key) {
    return !!state.widgetSettings?.realJail?.active?.includes(String(key || ""));
  }

  function prisonKindForKey(key) {
    const k = String(key || "");
    if (state.widgetSettings?.realJail?.active?.includes(k)) return "real";
    if (state.widgetSettings?.miniJail?.active?.includes(k)) return "mini";
    return "";
  }

  function characterPrisonScale(key) {
    const k = String(key || "");
    if (state.widgetSettings?.realJail?.active?.includes(k)) return clampPrisonScale(state.widgetSettings.realJail.scale, 0.36);
    if (state.widgetSettings?.miniJail?.active?.includes(k)) return clampPrisonScale(state.widgetSettings.miniJail.scale, 0.45);
    return 1;
  }

  function realJailCenter() {
    const defaults = defaultWidgetSettings().realJail;
    const jail = state.widgetSettings?.realJail || {};
    return {
      x: clampWorldX(jail.worldX, defaults.worldX),
      z: clampWorldZ(jail.worldZ, defaults.worldZ),
    };
  }

  function realJailYaw() {
    const defaults = defaultWidgetSettings().realJail;
    const jail = state.widgetSettings?.realJail || {};
    return normalizeJailYaw(jail.worldYaw, defaults.worldYaw);
  }

  function realJailSignConfig() {
    const defaults = defaultWidgetSettings().realJail;
    const jail = state.widgetSettings?.realJail || {};
    return {
      text: normalizeJailSignText(jail.signText, defaults.signText),
      color: normalizeJailSignColor(jail.signColor, defaults.signColor),
    };
  }

  function createJailSignTexture(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = text || "";
    let fontSize = 82;
    const fontFamily = "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif";
    do {
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
      fontSize -= 4;
    } while (fontSize >= 36 && ctx.measureText(label).width > 452);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(27, 17, 11, 0.92)";
    ctx.lineWidth = 12;
    ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.strokeText(label, canvas.width / 2, canvas.height / 2 + 4);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = color;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function createJailSignMaterial({ preview = false } = {}) {
    const config = realJailSignConfig();
    return new THREE.MeshBasicMaterial({
      map: createJailSignTexture(config.text, config.color),
      transparent: true,
      opacity: preview ? 0.62 : 1,
      color: preview ? 0xdff7ff : 0xffffff,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  function updateJailSignLabel(group) {
    if (!group || !window.THREE) return;
    const preview = !!group.userData?.isPlacePreview;
    group.traverse((obj) => {
      if (!obj.userData?.jailSignLabel) return;
      const previous = obj.material;
      obj.material = createJailSignMaterial({ preview });
      if (previous?.map) previous.map.dispose?.();
      previous?.dispose?.();
    });
  }

  function syncRealJailSign({ persist = false } = {}) {
    const widget = state.widgetSettings?.realJail;
    if (!widget) return;
    const defaults = defaultWidgetSettings().realJail;
    widget.signText = normalizeJailSignText(widget.signText, defaults.signText);
    widget.signColor = normalizeJailSignColor(widget.signColor, defaults.signColor);
    updateJailSignLabel(state.three?.jailGroup);
    updateJailSignLabel(state.three?.jailPlacePreview);
    if (persist) saveWidgetSettings();
  }

  function realJailLocalFromWorld(x, z) {
    const center = realJailCenter();
    const yaw = realJailYaw();
    const dx = Number(x) - center.x;
    const dz = Number(z) - center.z;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    return {
      x: dx * cos - dz * sin,
      z: dx * sin + dz * cos,
    };
  }

  function realJailWorldFromLocal(x, z) {
    const center = realJailCenter();
    const yaw = realJailYaw();
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const localX = clampJailWorldValue(x, 0, -1.08, 1.08);
    const localZ = clampJailWorldValue(z, 0, -0.78, 0.78);
    return {
      x: center.x + localX * cos + localZ * sin,
      z: center.z - localX * sin + localZ * cos,
      localX,
      localZ,
    };
  }

  function realJailConstrainedWorldPoint(x, z) {
    const local = realJailLocalFromWorld(x, z);
    return realJailWorldFromLocal(local.x, local.z);
  }

  function applyRealJailPosition() {
    const group = state.three?.jailGroup;
    if (!group) return;
    const center = realJailCenter();
    group.position.set(center.x, 0, center.z);
    group.rotation.y = realJailYaw();
  }

  function setPrisonTransformAdjusting(active) {
    state.prisonTransformAdjusting = !!active;
    if (!state.prisonTransformAdjusting && state.prisonWidgetRefreshPending) {
      window.setTimeout(refreshOpenPrisonWidgets, 0);
    }
  }

  function updateRealJailControlOutput() {
    const widget = state.widgetSettings?.realJail;
    const output = widgetLayer?.querySelector("#real-jail-widget .jail-position-output");
    if (output && widget) output.textContent = formatJailPosition(widget);
    const range = widgetLayer?.querySelector("#real-jail-widget .jail-yaw-range");
    if (range && widget) range.value = String(Math.round(normalizeJailYaw(widget.worldYaw) * 180 / Math.PI));
  }

  function queueRealJailTransformRender() {
    if (state.prisonTransformRenderFrame) return;
    state.prisonTransformRenderFrame = window.requestAnimationFrame(() => {
      state.prisonTransformRenderFrame = 0;
      applyRealJailPosition();
      renderParticipants();
      updateRealJailControlOutput();
    });
  }

  function syncRealJailTransform({ persist = false, render = true } = {}) {
    const widget = state.widgetSettings?.realJail;
    if (!widget) return;
    const defaults = defaultWidgetSettings().realJail;
    widget.worldX = clampWorldX(widget.worldX, defaults.worldX);
    widget.worldZ = clampWorldZ(widget.worldZ, defaults.worldZ);
    widget.worldYaw = normalizeJailYaw(widget.worldYaw, defaults.worldYaw);
    if (render) queueRealJailTransformRender();
    else {
      applyRealJailPosition();
      updateRealJailControlOutput();
    }
    const preview = state.three?.jailPlacePreview;
    if (state.prisonPlaceMode && preview?.visible) preview.rotation.y = widget.worldYaw;
    if (persist) saveWidgetSettings();
  }

  function setRealJailPlaceMode(active) {
    state.prisonPlaceMode = !!active;
    if (state.prisonPlaceMode) {
      state.characterPlaceMode = false;
      hideCharacterPlacePreview();
      document.body.classList.remove("character-place-mode");
      widgetLayer?.querySelector("#character-move-widget .character-place-toggle")?.classList.remove("active");
      setCharacterDriveMode(false);
    } else {
      hideRealJailPlacePreview();
    }
    document.body.classList.toggle("jail-place-mode", state.prisonPlaceMode);
    widgetLayer?.querySelector("#real-jail-widget .jail-place-toggle")?.classList.toggle("active", state.prisonPlaceMode);
    if (!state.prisonPlaceMode && !state.prisonTransformAdjusting && state.prisonWidgetRefreshPending) {
      window.setTimeout(refreshOpenPrisonWidgets, 0);
    }
  }

  function realJailGroundPointFromEvent(ev) {
    if (!state.three?.camera || !canvas || !window.THREE) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    );
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    raycaster.setFromCamera(mouse, state.three.camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return hit;
  }

  function groundPointFromEvent(ev) {
    return realJailGroundPointFromEvent(ev);
  }

  function setRealJailPositionFromEvent(ev) {
    const widget = state.widgetSettings?.realJail;
    const point = groundPointFromEvent(ev);
    if (!widget || !point) return false;
    widget.worldX = clampWorldX(point.x, widget.worldX);
    widget.worldZ = clampWorldZ(point.z, widget.worldZ);
    syncRealJailTransform();
    return true;
  }

  function updateRealJailPlacePreviewFromEvent(ev) {
    const preview = state.three?.jailPlacePreview;
    const point = groundPointFromEvent(ev);
    if (!preview || !point) return false;
    preview.position.set(
      clampWorldX(point.x, preview.position.x),
      0,
      clampWorldZ(point.z, preview.position.z)
    );
    preview.rotation.y = realJailYaw();
    preview.visible = true;
    return true;
  }

  function hideRealJailPlacePreview() {
    const preview = state.three?.jailPlacePreview;
    if (preview) preview.visible = false;
  }

  function isJailPlacementBlockedTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("#widget-layer, #widget-controls, #chat-panel, #topic-title, #topic-controls, #stream-preview-panel, #stream-preview-viewer, #media-lightbox, #chat-message-menu, #chat-mention-menu");
  }

  function characterMoveWidget() {
    return state.widgetSettings?.characterMove;
  }

  function characterPlacementForKey(key) {
    const placement = characterMoveWidget()?.placements?.[String(key || "")];
    return normalizeCharacterPlacement(placement);
  }

  function hasCharacterPlacement(key) {
    return !!characterPlacementForKey(key);
  }

  function characterPlacementWorldPosition(key, placement) {
    const p = normalizeCharacterPlacement(placement);
    if (!p) return null;
    if (isRealJailed(key)) {
      const point = p.space === "jail"
        ? realJailWorldFromLocal(p.x, p.z)
        : realJailConstrainedWorldPoint(p.x, p.z);
      return {
        x: point.x,
        z: point.z,
        a: Math.atan2(realJailCenter().x - point.x, realJailCenter().z - point.z),
        yaw: p.yawMode === "manual" ? normalizeJailYaw(p.yaw, 0) : null,
      };
    }
    return {
      x: p.x,
      z: p.z,
      a: Math.atan2(CAMPFIRE_CENTER.x - p.x, CAMPFIRE_CENTER.z - p.z),
      yaw: p.yawMode === "manual" ? normalizeJailYaw(p.yaw, 0) : null,
    };
  }

  function yawForWorldDirection(x, z) {
    return normalizeJailYaw(Math.atan2(x, z), 0);
  }

  function faceFireYaw(x, z) {
    return yawForWorldDirection(CAMPFIRE_CENTER.x - x, CAMPFIRE_CENTER.z - z);
  }

  function selectedCharacterMoveKey() {
    const widget = characterMoveWidget();
    const selected = String(widget?.selectedKey || "");
    if (selected && state.participants.has(selected)) return selected;
    const first = displayedParticipants()[0];
    return first ? keyFor(first) : "";
  }

  function ensureCharacterPlacement(key) {
    const widget = characterMoveWidget();
    const k = String(key || "");
    if (!widget || !k) return null;
    if (!widget.placements || typeof widget.placements !== "object") widget.placements = {};
    const existing = normalizeCharacterPlacement(widget.placements[k]);
    if (existing) {
      if (isRealJailed(k) && existing.space !== "jail") {
        const point = realJailConstrainedWorldPoint(existing.x, existing.z);
        const converted = {
          ...existing,
          x: point.localX,
          z: point.localZ,
          space: "jail",
        };
        widget.placements[k] = converted;
        return converted;
      }
      widget.placements[k] = existing;
      return existing;
    }
    const group = state.characters.get(k);
    const source = group?.userData?.target || group?.position || new THREE.Vector3(CAMPFIRE_CENTER.x, 0, CAMPFIRE_CENTER.z);
    const realJailed = isRealJailed(k);
    const point = realJailed ? realJailConstrainedWorldPoint(source.x, source.z) : null;
    const placement = {
      x: realJailed ? point.localX : clampWorldX(source.x, CAMPFIRE_CENTER.x),
      z: realJailed ? point.localZ : clampWorldZ(source.z, CAMPFIRE_CENTER.z),
      space: realJailed ? "jail" : "world",
      yawMode: "auto",
      yaw: normalizeJailYaw(group?.rotation?.y || 0, 0),
    };
    widget.placements[k] = placement;
    return placement;
  }

  function setCharacterPlacementWorldPoint(key, placement, x, z) {
    const p = placement || ensureCharacterPlacement(key);
    if (!p) return null;
    if (isRealJailed(key)) {
      const point = realJailConstrainedWorldPoint(x, z);
      p.x = point.localX;
      p.z = point.localZ;
      p.space = "jail";
      return point;
    }
    p.x = clampWorldX(x, CAMPFIRE_CENTER.x);
    p.z = clampWorldZ(z, CAMPFIRE_CENTER.z);
    p.space = "world";
    return { x: p.x, z: p.z };
  }

  function beginCharacterClawMove(key, target) {
    const group = state.characters.get(String(key || ""));
    if (!group || !target || !window.THREE) return;
    const prisonScale = Number(group.userData?.prisonScale) || characterPrisonScale(key);
    const visualScale = Math.max(
      0.18,
      Number(group.scale?.x) || characterScale(displayedParticipantCount(), false) * prisonScale
    );
    const from = group.position.clone();
    from.y = 0;
    const to = target.clone();
    to.y = 0;
    group.userData.clawMove = {
      start: performance.now(),
      duration: 3300,
      from,
      to,
      scale: visualScale,
      sway: ((hashString(`${key}:claw:${Date.now()}`) % 1000) / 1000 - 0.5) * 0.7,
    };
  }

  function setCharacterPlaceMode(active) {
    state.characterPlaceMode = !!active;
    if (state.characterPlaceMode) {
      setRealJailPlaceMode(false);
      setCharacterDriveMode(false);
    } else {
      hideCharacterPlacePreview();
    }
    document.body.classList.toggle("character-place-mode", state.characterPlaceMode);
    widgetLayer?.querySelector("#character-move-widget .character-place-toggle")?.classList.toggle("active", state.characterPlaceMode);
  }

  function setCharacterMoveAdjusting(active) {
    state.characterMoveAdjusting = !!active;
  }

  function setCharacterDriveMode(active, key = "") {
    const nextKey = String(key || selectedCharacterMoveKey() || "");
    if (active && (!nextKey || !state.participants.has(nextKey))) return;
    if (active) {
      setRealJailPlaceMode(false);
      state.characterPlaceMode = false;
      hideCharacterPlacePreview();
      document.body.classList.remove("character-place-mode");
      const placement = ensureCharacterPlacement(nextKey);
      const group = state.characters.get(nextKey);
      if (placement) {
        placement.yawMode = "manual";
        placement.yaw = normalizeJailYaw(group?.rotation?.y ?? placement.yaw ?? 0, 0);
      }
      state.characterDriveMode = true;
      state.characterDriveKey = nextKey;
      state.characterDriveLastT = 0;
      state.characterDriveLastSave = 0;
      state.keys.clear();
      blurEditableFocus();
    } else {
      state.characterDriveMode = false;
      state.characterDriveKey = "";
      state.characterDriveLastT = 0;
      state.keys.clear();
      saveWidgetSettings();
    }
    document.body.classList.toggle("character-drive-mode", state.characterDriveMode);
    widgetLayer?.querySelector("#character-move-widget .character-drive-toggle")?.classList.toggle("active", state.characterDriveMode);
  }

  function updateCharacterDriveFromKeys(t) {
    if (!state.characterDriveMode) return false;
    const key = state.characterDriveKey || selectedCharacterMoveKey();
    const widget = characterMoveWidget();
    if (!key || !widget || !state.participants.has(key)) {
      setCharacterDriveMode(false);
      return true;
    }
    widget.selectedKey = key;
    const placement = ensureCharacterPlacement(key);
    if (!placement) return false;
    const lastT = state.characterDriveLastT || t;
    const dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000));
    state.characterDriveLastT = t;
    let yaw = normalizeJailYaw(placement.yaw, 0);
    const screenForward = new THREE.Vector3(-Math.sin(state.view.yaw), 0, -Math.cos(state.view.yaw));
    const screenRight = new THREE.Vector3(Math.cos(state.view.yaw), 0, -Math.sin(state.view.yaw));
    const move = new THREE.Vector3();
    if (state.keys.has("w")) move.add(screenForward);
    if (state.keys.has("s")) move.sub(screenForward);
    if (state.keys.has("d")) move.add(screenRight);
    if (state.keys.has("a")) move.sub(screenRight);
    if (move.lengthSq() > 0) {
      move.normalize();
      yaw = yawForWorldDirection(move.x, move.z);
      move.multiplyScalar(2.05 * dt);
      const current = characterPlacementWorldPosition(key, placement) || { x: placement.x, z: placement.z };
      setCharacterPlacementWorldPoint(key, placement, current.x + move.x, current.z + move.z);
      const group = state.characters.get(key);
      if (group) group.userData.driveMoveUntil = t + 140;
    } else {
      const turn = ((state.keys.has("q") ? 1 : 0) - (state.keys.has("e") ? 1 : 0)) * 2.4 * dt;
      if (turn) yaw = normalizeJailYaw(yaw + turn, yaw);
    }
    placement.yawMode = "manual";
    placement.yaw = yaw;
    widget.placements[key] = placement;
    if (!state.characterDriveLastSave || t - state.characterDriveLastSave > 500) {
      state.characterDriveLastSave = t;
      saveWidgetSettings();
    }
    return true;
  }

  function triggerCharacterDriveJump(key = "") {
    const k = String(key || state.characterDriveKey || selectedCharacterMoveKey() || "");
    const group = state.characters.get(k);
    if (!group) return;
    const now = performance.now();
    if (now < Number(group.userData.driveJumpUntil || 0) - 140) return;
    group.userData.driveJumpStart = now;
    group.userData.driveJumpUntil = now + 560;
    group.userData.driveMoveUntil = Math.max(Number(group.userData.driveMoveUntil || 0), now + 220);
  }

  function syncCharacterMoveWidget({ persist = false, render = true } = {}) {
    const widget = characterMoveWidget();
    if (!widget) return;
    widget.placements = normalizeCharacterPlacements(widget.placements);
    if (render) renderParticipants();
    if (persist) saveWidgetSettings();
  }

  function setCharacterPlacementFromEvent(ev) {
    const widget = characterMoveWidget();
    const key = selectedCharacterMoveKey();
    const point = groundPointFromEvent(ev);
    if (!widget || !key || !point) return false;
    const placement = ensureCharacterPlacement(key);
    if (!placement) return false;
    const worldPoint = setCharacterPlacementWorldPoint(key, placement, point.x, point.z);
    placement.yawMode = "auto";
    widget.selectedKey = key;
    widget.placements[key] = placement;
    beginCharacterClawMove(key, new THREE.Vector3(worldPoint.x, 0, worldPoint.z));
    syncCharacterMoveWidget();
    return true;
  }

  function updateCharacterPlacePreviewFromEvent(ev) {
    const preview = state.three?.characterPlacePreview;
    const key = selectedCharacterMoveKey();
    const point = groundPointFromEvent(ev);
    if (!preview || !key || !point) return false;
    const constrained = isRealJailed(key)
      ? realJailConstrainedWorldPoint(point.x, point.z)
      : {
        x: clampWorldX(point.x, preview.position.x),
        z: clampWorldZ(point.z, preview.position.z),
      };
    const x = constrained.x;
    const z = constrained.z;
    preview.position.set(x, 0, z);
    preview.rotation.y = faceFireYaw(x, z);
    preview.scale.setScalar(characterPrisonScale(key));
    const participant = state.participants.get(key);
    if (participant) {
      const color = new THREE.Color(participantColor(participant));
      preview.traverse((obj) => {
        if (obj.material?.color && obj.userData.previewTint !== false) obj.material.color.copy(color);
      });
    }
    preview.visible = true;
    return true;
  }

  function hideCharacterPlacePreview() {
    const preview = state.three?.characterPlacePreview;
    if (preview) preview.visible = false;
  }

  function formatCharacterPlacement(widget = null) {
    const key = selectedCharacterMoveKey();
    const placement = key ? characterPlacementForKey(key) : null;
    if (!key) return "선택 없음";
    if (!placement) return "자동 배치";
    const deg = Math.round(normalizeJailYaw(placement.yaw, 0) * 180 / Math.PI);
    const scope = placement.space === "jail" ? "cage " : "";
    return `${scope}x ${placement.x.toFixed(2)} / z ${placement.z.toFixed(2)} / ${placement.yawMode === "manual" ? `${deg}deg` : "auto"}`;
  }

  function pruneCharacterPlacements(liveKeys) {
    const widget = characterMoveWidget();
    if (!widget?.placements || !liveKeys) return false;
    let changed = false;
    for (const key of Object.keys(widget.placements)) {
      if (liveKeys.has(key)) continue;
      delete widget.placements[key];
      changed = true;
    }
    if (widget.selectedKey && !liveKeys.has(widget.selectedKey)) {
      widget.selectedKey = "";
      changed = true;
    }
    if (state.characterDriveMode && state.characterDriveKey && !liveKeys.has(state.characterDriveKey)) {
      setCharacterDriveMode(false);
      changed = true;
    }
    return changed;
  }

  function applyRealJailPresence(hasPrisoner = false) {
    const group = state.three?.jailGroup;
    if (!group) return;
    const active = !!hasPrisoner;
    group.visible = true;
    if (group.userData.presenceActive === active) return;
    group.userData.presenceActive = active;
    const opacityScale = active ? 1 : 0.28;
    group.traverse((obj) => {
      const materials = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const material of materials) {
        if (!material) continue;
        if (!Number.isFinite(material.userData.jailBaseOpacity)) {
          material.userData.jailBaseOpacity = Number.isFinite(material.opacity) ? material.opacity : 1;
        }
        material.opacity = material.userData.jailBaseOpacity * opacityScale;
        material.transparent = material.opacity < 0.999;
        material.depthWrite = active;
        material.needsUpdate = true;
      }
    });
  }

  function formatJailPosition(widget = null) {
    const defaults = defaultWidgetSettings().realJail;
    const x = clampWorldX(widget?.worldX, defaults.worldX);
    const z = clampWorldZ(widget?.worldZ, defaults.worldZ);
    const yaw = normalizeJailYaw(widget?.worldYaw, defaults.worldYaw);
    const deg = Math.round(yaw * 180 / Math.PI);
    return `x ${x.toFixed(2)} / z ${z.toFixed(2)} / ${deg}deg`;
  }

  function removeKeysFromList(list, keys) {
    const remove = new Set((keys || []).map((key) => String(key)));
    return normalizeKeyList(list).filter((key) => !remove.has(key));
  }

  function removeJailLocalPlacements(keys) {
    const placements = state.widgetSettings?.characterMove?.placements;
    if (!placements) return false;
    let changed = false;
    for (const key of (Array.isArray(keys) ? keys : [keys])) {
      const k = String(key || "");
      if (!k) continue;
      const placement = normalizeCharacterPlacement(placements[k]);
      if (placement?.space !== "jail") continue;
      delete placements[k];
      changed = true;
    }
    return changed;
  }

  function removePrisonAssignments(keys, { save = true, render = true } = {}) {
    const remove = (Array.isArray(keys) ? keys : [keys]).map((key) => String(key || "")).filter(Boolean);
    if (!remove.length || !state.widgetSettings) return;
    const real = state.widgetSettings.realJail;
    const removedFromReal = real
      ? remove.filter((key) => normalizeKeyList(real.active).includes(key) || normalizeKeyList(real.pending).includes(key))
      : [];
    for (const widget of [state.widgetSettings.miniJail, state.widgetSettings.realJail]) {
      if (!widget) continue;
      widget.active = removeKeysFromList(widget.active, remove);
      widget.pending = removeKeysFromList(widget.pending, remove);
    }
    if (removedFromReal.length) removeJailLocalPlacements(removedFromReal);
    if (render) {
      renderParticipants();
      renderWidgets();
    }
    if (save) saveWidgetSettings();
  }

  function removeVisualEffectsForKey(key) {
    const k = String(key || "");
    if (!k) return;
    const char = state.characters.get(k);
    if (char?.userData) {
      char.userData.fireHopUntil = 0;
      char.userData.levelEffectKind = "";
      char.userData.levelEffectStart = 0;
      if (char.userData.cheerRig) {
        char.userData.cheerRig.until = 0;
        updateCheerRig(char, performance.now(), performance.now(), true);
      }
    }
    const effects = state.three?.effects || [];
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      if (effect?.key !== k) continue;
      effect.group?.parent?.remove(effect.group);
      effects.splice(i, 1);
    }
  }

  function prunePrisonAssignments(liveKeys) {
    if (!state.widgetSettings || !liveKeys) return false;
    let changed = false;
    const mini = state.widgetSettings.miniJail;
    if (mini) {
      const active = normalizeKeyList(mini.active).filter((key) => liveKeys.has(key));
      const pending = normalizeKeyList(mini.pending).filter((key) => liveKeys.has(key));
      changed = changed || active.length !== mini.active.length || pending.length !== mini.pending.length;
      mini.active = active;
      mini.pending = pending;
    }
    const real = state.widgetSettings.realJail;
    if (real) {
      const active = normalizeKeyList(real.active);
      const pending = normalizeKeyList(real.pending);
      changed = changed || active.length !== real.active.length || pending.length !== real.pending.length;
      real.active = active;
      real.pending = pending;
    }
    return changed;
  }

  function openPrisonWidget(kind) {
    const widget = prisonWidgetForKind(kind);
    if (!widget) return;
    widget.open = true;
    widget.hidden = false;
    widget.pending = normalizeKeyList(widget.active);
    renderWidgets();
    saveWidgetSettings();
  }

  function prisonAvatarMarkup(p) {
    if (p?.avatar_url) {
      return `<img src="${escapeHtml(p.avatar_url)}" alt="" width="34" height="34" loading="lazy" decoding="async" style="width:34px;height:34px;max-width:34px;max-height:34px;object-fit:cover;display:block;">`;
    }
    return `<span>${escapeHtml(initials(p?.name || p?.username))}</span>`;
  }

  function createPrisonParticipantButton(p, widget, kind) {
    const key = keyFor(p);
    const active = widget.pending.includes(key);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `prison-roster-card${active ? " selected" : ""}`;
    row.style.setProperty("--speaker-color", participantColor(p));
    row.innerHTML = `
      <span class="prison-roster-avatar${p.avatar_url ? " has-photo" : ""}">${prisonAvatarMarkup(p)}</span>
      <span class="prison-roster-meta">
        <span class="prison-roster-name">${escapeHtml(participantDisplayLabel(p))}</span>
        <span class="prison-roster-level">${escapeHtml(participantDisplayLevel(p) || (kind === "real" ? "케이지 후보" : "난쟁이 후보"))}</span>
      </span>
    `;
    const img = row.querySelector(".prison-roster-avatar img");
    img?.addEventListener("error", () => {
      const avatar = row.querySelector(".prison-roster-avatar");
      if (!avatar) return;
      avatar.classList.remove("has-photo");
      avatar.textContent = initials(p.name || p.username);
    });
    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (widget.pending.includes(key)) {
        widget.pending = widget.pending.filter((item) => item !== key);
      } else {
        widget.pending = normalizeKeyList([...widget.pending, key]);
      }
      renderWidgets();
      saveWidgetSettings();
    });
    return row;
  }

  function createPrisonChip(key, widget) {
    const p = state.participants.get(key);
    const chip = document.createElement("span");
    chip.className = "prison-chip";
    chip.style.setProperty("--speaker-color", p ? participantColor(p) : "rgba(255,255,255,0.5)");
    const label = document.createElement("span");
    label.className = "prison-chip-label";
    label.textContent = p ? participantDisplayLabel(p) : key;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = "remove";
    remove.textContent = "x";
    remove.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      widget.pending = widget.pending.filter((item) => item !== key);
      renderWidgets();
      saveWidgetSettings();
    });
    chip.append(label, remove);
    return chip;
  }

  function commitPrisonWidget(kind) {
    const widget = prisonWidgetForKind(kind);
    const other = otherPrisonWidgetForKind(kind);
    if (!widget) return;
    const previousReal = normalizeKeyList(state.widgetSettings?.realJail?.active);
    const pending = normalizeKeyList(widget.pending);
    const keys = kind === "real" ? pending : pending.filter((key) => state.participants.has(key));
    widget.active = keys;
    widget.pending = [...keys];
    widget.scale = clampPrisonScale(widget.scale, kind === "real" ? 0.36 : 0.45);
    if (other) {
      other.active = removeKeysFromList(other.active, keys);
      other.pending = removeKeysFromList(other.pending, keys);
    }
    const nextReal = normalizeKeyList(state.widgetSettings?.realJail?.active);
    const removedFromReal = previousReal.filter((key) => !nextReal.includes(key));
    if (removedFromReal.length) removeJailLocalPlacements(removedFromReal);
    if (kind === "real") keys.forEach(removeVisualEffectsForKey);
    renderParticipants();
    renderWidgets();
    saveWidgetSettings();
  }

  function openCharacterMoveWidget() {
    const widget = characterMoveWidget();
    if (!widget) return;
    widget.open = true;
    widget.hidden = false;
    widget.selectedKey = selectedCharacterMoveKey();
    renderWidgets();
    saveWidgetSettings();
  }

  function createCharacterMoveParticipantButton(p, widget) {
    const key = keyFor(p);
    const selected = widget.selectedKey === key;
    const placed = hasCharacterPlacement(key);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `prison-roster-card character-move-card${selected ? " selected" : ""}${placed ? " placed" : ""}`;
    row.style.setProperty("--speaker-color", participantColor(p));
    row.innerHTML = `
      <span class="prison-roster-avatar${p.avatar_url ? " has-photo" : ""}">${prisonAvatarMarkup(p)}</span>
      <span class="prison-roster-meta">
        <span class="prison-roster-name">${escapeHtml(participantDisplayLabel(p))}</span>
        <span class="prison-roster-level">${escapeHtml(placed ? "수동 위치" : (participantDisplayLevel(p) || "자동 배치"))}</span>
      </span>
    `;
    const img = row.querySelector(".prison-roster-avatar img");
    img?.addEventListener("error", () => {
      const avatar = row.querySelector(".prison-roster-avatar");
      if (!avatar) return;
      avatar.classList.remove("has-photo");
      avatar.textContent = initials(p.name || p.username);
    });
    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      widget.selectedKey = key;
      renderWidgets();
      saveWidgetSettings();
    });
    return row;
  }

  function renderCharacterMoveWidget() {
    const widget = characterMoveWidget();
    if (!widget || widget.open === false) return;
    const card = document.createElement("section");
    card.id = "character-move-widget";
    card.className = "overlay-widget character-move-widget";
    const header = document.createElement("div");
    header.className = "widget-header character-move-header";
	    header.innerHTML = `
	      <span class="widget-title">이동</span>
	      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(widget.hidden, "move")}</button>
	      <button class="character-move-close" type="button" title="close">x</button>
	    `;
    const body = document.createElement("div");
    body.className = "character-move-body";
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(header, body, resize);
    widgetLayer.appendChild(card);
    const apply = () => applyWidgetBox(card, widget, 320, 280);
    apply();
    if (!widget.hidden) {
      const rows = displayedParticipants();
      if (!widget.selectedKey || !state.participants.has(widget.selectedKey)) {
        widget.selectedKey = rows[0] ? keyFor(rows[0]) : "";
      }
      const selectedKey = selectedCharacterMoveKey();
      const selectedParticipant = selectedKey ? state.participants.get(selectedKey) : null;
      const control = document.createElement("div");
      control.className = "character-move-control";
      control.innerHTML = `
        <div class="character-move-selected">${escapeHtml(selectedParticipant ? participantDisplayLabel(selectedParticipant) : "선택 없음")}</div>
        <button class="character-place-toggle${state.characterPlaceMode ? " active" : ""}" type="button">place</button>
        <button class="character-drive-toggle${state.characterDriveMode && state.characterDriveKey === selectedKey ? " active" : ""}" type="button">drive</button>
        <button class="character-yaw-auto" type="button" title="rotation auto">rot auto</button>
        <button class="character-placement-reset" type="button" title="reset position and rotation">pos reset</button>
        <output class="character-placement-output">${escapeHtml(formatCharacterPlacement(widget))}</output>
      `;
      const yaw = document.createElement("label");
      yaw.className = "character-yaw-control";
      const placement = selectedKey ? characterPlacementForKey(selectedKey) : null;
      yaw.innerHTML = `
        <span>rot</span>
        <input class="character-yaw-range" type="range" min="-180" max="180" step="1" value="${Math.round(normalizeJailYaw(placement?.yaw, 0) * 180 / Math.PI)}">
      `;
      const roster = document.createElement("div");
      roster.className = "prison-roster character-move-roster";
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "prison-empty";
        empty.textContent = "현재 비디오챗 캐릭터가 없습니다";
        roster.appendChild(empty);
      } else {
        for (const p of rows) roster.appendChild(createCharacterMoveParticipantButton(p, widget));
      }
      const actions = document.createElement("div");
      actions.className = "prison-actions character-move-actions";
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "prison-clear";
      clearButton.textContent = "전체 리셋";
      clearButton.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        widget.placements = {};
        setCharacterPlaceMode(false);
        setCharacterDriveMode(false);
        renderParticipants();
        renderWidgets();
        saveWidgetSettings();
      });
      actions.append(clearButton);
      body.append(control, yaw, roster, actions);

      const output = control.querySelector(".character-placement-output");
      const yawRange = yaw.querySelector(".character-yaw-range");
      const syncLocalOutput = () => {
        if (output) output.textContent = formatCharacterPlacement(widget);
        const p = selectedKey ? characterPlacementForKey(selectedKey) : null;
        if (yawRange) {
          yawRange.value = String(Math.round(normalizeJailYaw(p?.yaw, 0) * 180 / Math.PI));
        }
      };
      const setSelectedYaw = (degrees, { persist = false } = {}) => {
        if (!selectedKey) return;
        const p = ensureCharacterPlacement(selectedKey);
        if (!p) return;
        p.yawMode = "manual";
        p.yaw = normalizeJailYaw(Number(degrees) * Math.PI / 180, p.yaw);
        widget.placements[selectedKey] = p;
        syncLocalOutput();
        syncCharacterMoveWidget({ persist });
      };
      control.querySelector(".character-place-toggle")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!selectedKey) return;
        widget.selectedKey = selectedKey;
        setCharacterPlaceMode(!state.characterPlaceMode);
        saveWidgetSettings();
      });
      control.querySelector(".character-drive-toggle")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!selectedKey) return;
        widget.selectedKey = selectedKey;
        setCharacterDriveMode(!(state.characterDriveMode && state.characterDriveKey === selectedKey), selectedKey);
        renderParticipants();
        saveWidgetSettings();
      });
      control.querySelector(".character-yaw-auto")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!selectedKey) return;
        const p = ensureCharacterPlacement(selectedKey);
        if (!p) return;
        p.yawMode = "auto";
        widget.placements[selectedKey] = p;
        syncLocalOutput();
        syncCharacterMoveWidget({ persist: true });
      });
      control.querySelector(".character-placement-reset")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!selectedKey) return;
        delete widget.placements[selectedKey];
        setCharacterPlaceMode(false);
        if (state.characterDriveKey === selectedKey) setCharacterDriveMode(false);
        renderParticipants();
        renderWidgets();
        saveWidgetSettings();
      });
      yawRange?.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        setCharacterMoveAdjusting(true);
        window.addEventListener("pointerup", () => {
          setCharacterMoveAdjusting(false);
          syncCharacterMoveWidget({ persist: true });
        }, { once: true });
        window.addEventListener("pointercancel", () => {
          setCharacterMoveAdjusting(false);
          syncCharacterMoveWidget({ persist: true });
        }, { once: true });
      });
      yawRange?.addEventListener("input", () => setSelectedYaw(yawRange.value));
      yawRange?.addEventListener("change", () => setSelectedYaw(yawRange.value, { persist: true }));
    }
    const hideButton = header.querySelector(".widget-hide");
    const showCharacterMoveWidget = () => {
      widget.hidden = false;
      widget.open = true;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      widget.hidden = !widget.hidden;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".character-move-close")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      widget.open = false;
      widget.hidden = true;
      setCharacterPlaceMode(false);
      setCharacterDriveMode(false);
      renderWidgets();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, widget, apply, saveWidgetSettings, showCharacterMoveWidget);
    bindWidgetFrame(card, header, resize, widget, apply, saveWidgetSettings, 320, 280);
  }

  function renderPrisonWidget(kind) {
    const widget = prisonWidgetForKind(kind);
    if (!widget || widget.open === false) return;
    const isReal = kind === "real";
    const card = document.createElement("section");
    card.id = isReal ? "real-jail-widget" : "mini-jail-widget";
    card.className = `overlay-widget prison-widget ${isReal ? "real-jail-widget" : "mini-jail-widget"}`;
    const header = document.createElement("div");
    header.className = "widget-header prison-widget-header";
    header.innerHTML = `
      <span class="widget-title">${isReal ? "케이지" : "난쟁이"}</span>
      <label class="prison-scale-control" title="scale">
        <span>scale</span>
        <button class="prison-scale-step" type="button" data-delta="-0.05" title="smaller">-</button>
        <input class="prison-scale-range" type="range" min="0.1" max="0.9" step="0.05" value="${escapeHtml(widget.scale)}">
        <output class="prison-scale-value">${escapeHtml(widget.scale)}</output>
        <button class="prison-scale-step" type="button" data-delta="0.05" title="larger">+</button>
      </label>
	      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(widget.hidden, isReal ? "케이지" : "난쟁이")}</button>
	      <button class="prison-widget-close" type="button" title="close">x</button>
	    `;
    const body = document.createElement("div");
    body.className = "prison-widget-body";
    if (isReal) body.classList.add("has-jail-control");
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(header, body, resize);
    widgetLayer.appendChild(card);
    const apply = () => applyWidgetBox(card, widget, 320, 280);
    apply();
    if (!widget.hidden) {
      const selected = document.createElement("div");
      selected.className = "prison-selected";
      if (widget.pending.length) {
        for (const key of widget.pending) selected.appendChild(createPrisonChip(key, widget));
      } else {
        const empty = document.createElement("div");
        empty.className = "prison-empty";
        empty.textContent = "선택된 캐릭터 없음";
        selected.appendChild(empty);
      }
      let location = null;
      if (isReal) {
        location = document.createElement("div");
        location.className = "prison-jail-control";
        location.innerHTML = `
          <div class="jail-place-control">
            <button class="jail-place-toggle${state.prisonPlaceMode ? " active" : ""}" type="button" title="place cage on the scene">place</button>
            <button class="jail-reset" type="button" title="reset cage">reset</button>
            <output class="jail-position-output">${formatJailPosition(widget)}</output>
          </div>
          <label class="jail-yaw-control" title="rotate jail">
            <span>rot</span>
            <input class="jail-yaw-range" type="range" min="-180" max="180" step="1" value="${Math.round(normalizeJailYaw(widget.worldYaw) * 180 / Math.PI)}">
          </label>
          <label class="jail-sign-control" title="cage sign">
            <span>sign</span>
            <input class="jail-sign-text" type="text" maxlength="14" value="${escapeHtml(widget.signText || "")}">
            <input class="jail-sign-color" type="color" value="${escapeHtml(widget.signColor || "#ffd36a")}">
          </label>
        `;
        const defaults = defaultWidgetSettings().realJail;
        const yawRange = location.querySelector(".jail-yaw-range");
        const signText = location.querySelector(".jail-sign-text");
        const signColor = location.querySelector(".jail-sign-color");
        let signColorEditing = false;
        let signColorEditTimer = 0;
        let signColorFrame = 0;
        const beginSignColorEdit = () => {
          if (!signColorEditing) {
            signColorEditing = true;
            beginWidgetInteractionSession();
          }
          if (signColorEditTimer) window.clearTimeout(signColorEditTimer);
          signColorEditTimer = window.setTimeout(endSignColorEdit, 15000);
        };
        const endSignColorEdit = () => {
          if (signColorEditTimer) window.clearTimeout(signColorEditTimer);
          signColorEditTimer = 0;
          if (!signColorEditing) return;
          signColorEditing = false;
          endWidgetInteractionSession();
        };
        const setYawDeg = (degrees, { persist = false } = {}) => {
          widget.worldYaw = normalizeJailYaw(Number(degrees) * Math.PI / 180, defaults.worldYaw);
          syncRealJailTransform({ persist });
        };
        const setSign = ({ persist = false } = {}) => {
          widget.signText = normalizeJailSignText(signText?.value || "", "");
          widget.signColor = normalizeJailSignColor(signColor?.value, defaults.signColor);
          syncRealJailSign({ persist });
        };
        location.querySelector(".jail-place-toggle")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setRealJailPlaceMode(!state.prisonPlaceMode);
        });
        signText?.addEventListener("keydown", (ev) => ev.stopPropagation());
        signText?.addEventListener("input", () => setSign({ persist: true }));
        signText?.addEventListener("change", () => setSign({ persist: true }));
        signColor?.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          beginSignColorEdit();
        });
        signColor?.addEventListener("focus", beginSignColorEdit);
        signColor?.addEventListener("input", () => {
          if (signColorEditTimer) window.clearTimeout(signColorEditTimer);
          signColorEditTimer = window.setTimeout(endSignColorEdit, 15000);
          if (signColorFrame) return;
          signColorFrame = window.requestAnimationFrame(() => {
            signColorFrame = 0;
            setSign();
          });
        });
        signColor?.addEventListener("change", () => {
          if (signColorFrame) {
            window.cancelAnimationFrame(signColorFrame);
            signColorFrame = 0;
          }
          setSign({ persist: true });
          window.setTimeout(endSignColorEdit, 150);
        });
        signColor?.addEventListener("blur", () => {
          if (signColorEditTimer) window.clearTimeout(signColorEditTimer);
          signColorEditTimer = window.setTimeout(endSignColorEdit, 6000);
        });
        yawRange?.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          setPrisonTransformAdjusting(true);
          window.addEventListener("pointerup", () => {
            setPrisonTransformAdjusting(false);
            syncRealJailTransform({ persist: true });
          }, { once: true });
          window.addEventListener("pointercancel", () => {
            setPrisonTransformAdjusting(false);
            syncRealJailTransform({ persist: true });
          }, { once: true });
        });
        yawRange?.addEventListener("input", () => setYawDeg(yawRange.value));
        yawRange?.addEventListener("change", () => setYawDeg(yawRange.value, { persist: true }));
        location.querySelector(".jail-reset")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          widget.worldX = defaults.worldX;
          widget.worldZ = defaults.worldZ;
          widget.worldYaw = defaults.worldYaw;
          setRealJailPlaceMode(false);
          syncRealJailTransform({ persist: true, render: false });
          renderParticipants();
        });
        syncRealJailTransform({ render: false });
      }
      const roster = document.createElement("div");
      roster.className = "prison-roster";
      const rows = displayedParticipants();
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "prison-empty";
        empty.textContent = "현재 비디오챗 캐릭터가 없습니다";
        roster.appendChild(empty);
      } else {
        for (const p of rows) roster.appendChild(createPrisonParticipantButton(p, widget, kind));
      }
      const actions = document.createElement("div");
      actions.className = "prison-actions";
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "prison-commit";
      applyButton.textContent = "확정";
      applyButton.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        commitPrisonWidget(kind);
      });
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "prison-clear";
      clearButton.textContent = "전체 해제";
      clearButton.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        widget.pending = [];
        widget.active = [];
        renderParticipants();
        renderWidgets();
        saveWidgetSettings();
      });
      actions.append(applyButton, clearButton);
      body.append(selected);
      if (location) body.append(location);
      body.append(roster, actions);
    }
    const range = header.querySelector(".prison-scale-range");
    const valueLabel = header.querySelector(".prison-scale-value");
    let scaleRenderFrame = 0;
    let scaleSaveTimer = 0;
    const formatScale = (value) => String(Math.round(Number(value) * 100) / 100);
    const syncScaleControls = () => {
      if (range) range.value = String(widget.scale);
      if (valueLabel) valueLabel.textContent = formatScale(widget.scale);
    };
    const queueScaleRender = () => {
      if (scaleRenderFrame) return;
      scaleRenderFrame = window.requestAnimationFrame(() => {
        scaleRenderFrame = 0;
        renderParticipants();
      });
    };
    const queueScaleSave = () => {
      if (scaleSaveTimer) window.clearTimeout(scaleSaveTimer);
      scaleSaveTimer = window.setTimeout(() => {
        scaleSaveTimer = 0;
        saveWidgetSettings();
      }, 180);
    };
    const setScale = (value) => {
      widget.scale = clampPrisonScale(value, widget.scale);
      syncScaleControls();
      queueScaleRender();
      queueScaleSave();
    };
    const beginScaleAdjust = () => {
      state.prisonScaleAdjusting = true;
    };
    const endScaleAdjust = () => {
      if (!state.prisonScaleAdjusting) return;
      state.prisonScaleAdjusting = false;
      saveWidgetSettings();
      if (state.prisonWidgetRefreshPending) {
        window.setTimeout(refreshOpenPrisonWidgets, 0);
      }
    };
    syncScaleControls();
    range?.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      beginScaleAdjust();
      window.addEventListener("pointerup", endScaleAdjust, { once: true });
      window.addEventListener("pointercancel", endScaleAdjust, { once: true });
    });
    range?.addEventListener("input", () => setScale(range.value));
    range?.addEventListener("change", () => {
      setScale(range.value);
      endScaleAdjust();
    });
    range?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      beginScaleAdjust();
      window.setTimeout(endScaleAdjust, 0);
    });
    header.querySelectorAll(".prison-scale-step").forEach((button) => {
      button.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setScale((Number(widget.scale) || 0) + (Number(button.dataset.delta) || 0));
      });
    });
    header.querySelector(".prison-scale-control")?.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
    });
    const hideButton = header.querySelector(".widget-hide");
    const showPrisonWidget = () => {
      widget.hidden = false;
      widget.open = true;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      widget.hidden = !widget.hidden;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".prison-widget-close")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      widget.open = false;
      widget.hidden = true;
      renderWidgets();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, widget, apply, saveWidgetSettings, showPrisonWidget);
    bindWidgetFrame(card, header, resize, widget, apply, saveWidgetSettings, 320, 280);
  }

  function normalizeBrowserUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function browserWidgetFrameSrc(browser) {
    const url = normalizeBrowserUrl(browser?.url);
    if (!url) return "";
    return browser.proxy ? `/api/link/proxy?url=${encodeURIComponent(url)}` : url;
  }

  function extractYouTubeVideoId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      }
      if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
        const watchId = parsed.searchParams.get("v") || "";
        if (/^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
        const parts = parsed.pathname.split("/").filter(Boolean);
        const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
        const id = marker >= 0 ? parts[marker + 1] : "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
      }
    } catch (_) {}
    return "";
  }

  function youtubeWatchUrl(videoId) {
    return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "";
  }

  function youtubeEmbedUrl(videoId) {
    if (!videoId) return "";
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  }

  function youtubeNativeEmbedUrl(videoId) {
    if (!videoId) return "";
    return new URL(`/static/youtube_player.html?video_id=${encodeURIComponent(videoId)}`, window.location.href).href;
  }

  function postYoutubeCommand(command, args = []) {
    const frame = widgetLayer?.querySelector("#youtube-widget .youtube-player");
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage(JSON.stringify({
        event: "command",
        func: command,
        args,
      }), "*");
    } catch (_) {}
  }

  function setYoutubeVideo(youtube, videoId, options = {}) {
    if (!youtube || !videoId) return;
    if (options.resetQuery) youtube.query = "";
    const url = youtubeWatchUrl(videoId);
    youtube.url = url;
    youtube.videoId = videoId;
    youtube.open = true;
    youtube.hidden = false;
    renderWidgets();
    saveWidgetSettings();
  }

  async function searchYoutubeWidget(youtube, inputValue = "") {
    const value = String(inputValue || youtube?.query || youtube?.url || "").trim();
    if (!youtube || !value) return;
    const videoId = extractYouTubeVideoId(value);
    if (videoId) {
      setYoutubeVideo(youtube, videoId, { resetQuery: true });
      return;
    }
    youtube.query = value;
    youtube.videoId = "";
    youtube.url = "";
    state.youtubeSearchLoading = true;
    state.youtubeSearchError = "";
    state.youtubeSearchResults = [];
    renderWidgets();
    try {
      const payload = await fetch(`/api/youtube/search?q=${encodeURIComponent(value)}&_=${Date.now()}`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      state.youtubeSearchResults = Array.isArray(payload.results) ? payload.results : [];
      state.youtubeSearchError = state.youtubeSearchResults.length ? "" : "no results";
    } catch (exc) {
      state.youtubeSearchError = String(exc?.message || exc || "search failed");
    } finally {
      state.youtubeSearchLoading = false;
      renderWidgets();
      saveWidgetSettings();
    }
  }

  function renderPriceWidget() {
    const price = state.widgetSettings?.price;
    if (!price) return;
    const card = document.createElement("section");
    card.id = "price-widget";
    card.className = "overlay-widget price-widget";
    const header = document.createElement("div");
    header.className = "widget-header";
    header.innerHTML = `
      <span class="widget-title">Prices</span>
      <button class="widget-refresh" type="button" title="refresh prices">R</button>
      <button class="price-font-down" type="button" title="smaller price text">-</button>
      <button class="price-font-up" type="button" title="larger price text">+</button>
      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(price.hidden, "price")}</button>
    `;
    const body = document.createElement("div");
    body.className = "widget-body price-widget-body";
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(header, body, resize);
    widgetLayer.appendChild(card);
    const apply = () => {
      price.textScale = clamp(Number(price.textScale) || 1, 0.72, 1.55);
      applyWidgetBox(card, price, 300, 215);
      card.style.setProperty("--price-text-scale", String(price.textScale));
    };
    apply();
    renderPriceRows(body);
    const hideButton = header.querySelector(".widget-hide");
    const showPriceWidget = () => {
      price.hidden = false;
      renderWidgets();
      saveWidgetSettings();
      refreshPriceWidget(true);
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      price.hidden = !price.hidden;
      renderWidgets();
      saveWidgetSettings();
      if (!price.hidden) refreshPriceWidget(true);
    });
    header.querySelector(".widget-refresh")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      refreshPriceWidget(true);
    });
    header.querySelector(".price-font-down")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      price.textScale = clamp((Number(price.textScale) || 1) - 0.08, 0.72, 1.55);
      apply();
      saveWidgetSettings();
    });
    header.querySelector(".price-font-up")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      price.textScale = clamp((Number(price.textScale) || 1) + 0.08, 0.72, 1.55);
      apply();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, price, apply, saveWidgetSettings, showPriceWidget);
    bindWidgetFrame(card, header, resize, price, apply, saveWidgetSettings, 300, 215);
  }

  function renderMemoWidget(memo) {
    const card = document.createElement("section");
    card.className = "overlay-widget memo-widget";
    card.dataset.memoId = memo.id;
    const header = document.createElement("div");
    header.className = "widget-header";
    header.innerHTML = `
	      <span class="widget-title">Memo</span>
	      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(memo.hidden, "memo")}</button>
      <button class="widget-delete" type="button" title="delete memo">x</button>
    `;
    const textarea = document.createElement("textarea");
    textarea.className = "memo-widget-text";
    textarea.value = memo.text || "";
    textarea.placeholder = "memo";
    textarea.style.fontSize = `${memo.fontSize || 18}px`;
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(header, textarea, resize);
    widgetLayer.appendChild(card);
    const apply = () => {
      applyWidgetBox(card, memo, 190, 96);
      textarea.style.fontSize = `${Math.min(48, Math.max(12, Number(memo.fontSize) || 18))}px`;
    };
    apply();
    const hideButton = header.querySelector(".widget-hide");
    const showMemoWidget = () => {
      memo.hidden = false;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      memo.hidden = !memo.hidden;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".widget-delete")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.widgetSettings.memos = state.widgetSettings.memos.filter((item) => item.id !== memo.id);
      renderWidgets();
      saveWidgetSettings();
    });
    textarea.addEventListener("input", () => {
      memo.text = textarea.value;
      saveWidgetSettings();
    });
    textarea.addEventListener("keydown", (ev) => ev.stopPropagation());
    bindHiddenShowHandle(card, hideButton, memo, apply, saveWidgetSettings, showMemoWidget);
    bindWidgetFrame(card, header, resize, memo, apply, saveWidgetSettings, 190, 96);
  }

  function renderBrowserWidget(browser) {
    const card = document.createElement("section");
    card.className = "overlay-widget browser-widget";
    card.dataset.browserId = browser.id;
    const dragStrip = document.createElement("div");
    dragStrip.className = "widget-drag-strip browser-widget-drag";
    dragStrip.title = "move browser widget";
    const header = document.createElement("div");
    header.className = "widget-header browser-widget-header";
    header.innerHTML = `
      <input class="browser-widget-url" type="text" placeholder="https://..." value="${escapeHtml(browser.url || "")}">
      <button class="browser-widget-go" type="button" title="load URL">go</button>
      <button class="browser-widget-proxy" type="button" title="toggle local proxy">${browser.proxy ? "raw" : "proxy"}</button>
      <button class="browser-widget-open" type="button" title="open externally">open</button>
	      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(browser.hidden, "web")}</button>
      <button class="widget-delete" type="button" title="delete browser">x</button>
    `;
    const body = document.createElement("div");
    body.className = "browser-widget-body";
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(dragStrip, header, body, resize);
    widgetLayer.appendChild(card);
    const input = header.querySelector(".browser-widget-url");
    const apply = () => applyWidgetBox(card, browser, 320, 220);
    const loadFrame = () => {
      body.innerHTML = "";
      const src = browserWidgetFrameSrc(browser);
      if (!src) {
        const empty = document.createElement("div");
        empty.className = "browser-widget-empty";
        empty.textContent = "enter URL";
        body.appendChild(empty);
        return;
      }
      const frame = document.createElement("iframe");
      frame.className = "browser-widget-frame";
      frame.src = src;
      frame.referrerPolicy = "no-referrer";
      frame.sandbox = "allow-scripts allow-forms allow-popups allow-pointer-lock";
      body.appendChild(frame);
    };
    apply();
    loadFrame();
    const commitUrl = () => {
      const normalized = normalizeBrowserUrl(input?.value || "");
      browser.url = normalized || String(input?.value || "").trim();
      if (input) input.value = browser.url;
      loadFrame();
      saveWidgetSettings();
    };
    input?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        commitUrl();
      }
    });
    input?.addEventListener("change", commitUrl);
    header.querySelector(".browser-widget-go")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      commitUrl();
    });
    header.querySelector(".browser-widget-proxy")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      browser.proxy = !browser.proxy;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".browser-widget-open")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const url = normalizeBrowserUrl(browser.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
    const hideButton = header.querySelector(".widget-hide");
    const showBrowserWidget = () => {
      browser.hidden = false;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      browser.hidden = !browser.hidden;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".widget-delete")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.widgetSettings.browsers = state.widgetSettings.browsers.filter((item) => item.id !== browser.id);
      renderWidgets();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, browser, apply, saveWidgetSettings, showBrowserWidget);
    bindWidgetFrame(card, dragStrip, resize, browser, apply, saveWidgetSettings, 320, 220);
  }

  function gamePlayerUrl(game) {
    const selected = String(game?.selected || "pokemon-gold");
    const rom = safeFilename(game?.rom || "pk_gold.gb") || "pk_gold.gb";
    const speed = gameSpeedLabel(game?.speed || 1).slice(1);
    const volume = Math.round(normalizeGameVolume(game?.volume ?? 0.75) * 100);
    return `/static/game_player.html?game=${encodeURIComponent(selected)}&rom=${encodeURIComponent(rom)}&debug=${game?.debug ? "1" : "0"}&layout=${game?.layoutDebug ? "1" : "0"}&speed=${encodeURIComponent(speed)}&volume=${encodeURIComponent(volume)}&v=21`;
  }

  function gameRomLabel(row) {
    const file = String(row?.file || row || "");
    if (file.toLowerCase() === "pk_gold.gb") return "포켓몬 골드";
    return String(row?.name || file.replace(/\.[^.]+$/, "") || "ROM");
  }

  async function refreshGameRomList(force = false) {
    if (state.gameRomLoading || (state.gameRomLoaded && !force)) return state.gameRomList;
    state.gameRomLoading = true;
    pushGameLog("rom-list", "request /api/game/roms");
    try {
      const payload = await fetch(`/api/game/roms?_=${Date.now()}`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      state.gameRomList = Array.isArray(payload.roms) ? payload.roms : [];
      pushGameLog("rom-list", `${state.gameRomList.length} ROM(s)`);
    } catch (err) {
      state.gameRomList = [];
      pushGameLog("rom-list-error", err?.message || String(err || "unknown error"));
    } finally {
      state.gameRomLoading = false;
      state.gameRomLoaded = true;
    }
    return state.gameRomList;
  }

  function gameWidgetFrame() {
    return widgetLayer?.querySelector("#game-widget .game-widget-frame") || null;
  }

  function postGameWidgetMessage(payload) {
    const frame = gameWidgetFrame();
    if (!frame?.contentWindow) return false;
    try {
      frame.contentWindow.postMessage(payload, window.location.origin);
      return true;
    } catch (_) {
      return false;
    }
  }

  function requestGameWidgetSave(reason = "widget") {
    return postGameWidgetMessage({ type: "tg-game-save", reason });
  }

  function syncGameWidgetViewport() {
    postGameWidgetMessage({ type: "tg-game-resize" });
  }

  function scheduleGameWidgetViewportSync() {
    window.requestAnimationFrame(() => {
      syncGameWidgetViewport();
      for (const delay of [80, 180, 360, 720, 1400]) {
        window.setTimeout(syncGameWidgetViewport, delay);
      }
    });
  }

  function postGameWidgetSpeed(game = state.widgetSettings?.game) {
    return postGameWidgetMessage({ type: "tg-game-speed", speed: normalizeGameSpeed(game?.speed || 1) });
  }

  function postGameWidgetVolume(game = state.widgetSettings?.game) {
    return postGameWidgetMessage({ type: "tg-game-volume", volume: normalizeGameVolume(game?.volume ?? 0.75) });
  }

  function postGameWidgetLayoutDebug(game = state.widgetSettings?.game) {
    return postGameWidgetMessage({ type: "tg-game-layout-debug", enabled: !!game?.layoutDebug });
  }

  function updateGameWidgetStatus(text) {
    const status = widgetLayer?.querySelector("#game-widget .game-widget-status");
    if (status) status.textContent = text;
  }

  function setGameButtonVisual(command, pressed) {
    const button = widgetLayer?.querySelector(`#game-widget [data-game-command="${CSS.escape(String(command || ""))}"]`);
    button?.classList.toggle("is-pressed", !!pressed);
  }

  function setGameButtonPressed(command, pressed, holdMs = 190) {
    command = String(command || "");
    if (!GAME_BUTTON_META[command]) return;
    const timers = state.gameButtonTimers;
    if (timers?.has(command)) {
      window.clearTimeout(timers.get(command));
      timers.delete(command);
    }
    setGameButtonVisual(command, pressed);
    if (pressed && holdMs > 0) {
      timers?.set(command, window.setTimeout(() => {
        timers.delete(command);
        setGameButtonVisual(command, false);
      }, holdMs));
    }
  }

  function flashGamePadButtons(commands, holdMs = 210) {
    for (const command of commands || []) {
      setGameButtonPressed(command, true, holdMs);
    }
  }

  function clearGamePadButtons() {
    for (const [command, timer] of state.gameButtonTimers || []) {
      window.clearTimeout(timer);
      setGameButtonVisual(command, false);
    }
    state.gameButtonTimers?.clear?.();
  }

  function finishGameClose(reason = "done") {
    const pending = state.gameClosePending;
    if (!pending) return;
    if (state.gameCloseTimer) {
      window.clearTimeout(state.gameCloseTimer);
      state.gameCloseTimer = 0;
    }
    pending.card?.remove?.();
    state.gameClosePending = null;
    pushGameLog("close", reason);
    saveWidgetSettingsSoon(80);
  }

  function beginGameClose(card, game) {
    if (!card || !game) return;
    const closedAt = Date.now();
    state.gameLocalOverrideUntil = closedAt + 15000;
    state.gameLocalClosedAt = closedAt;
    game.closedAt = closedAt;
    game.open = false;
    game.hidden = true;
    storageSet(WIDGET_SETTINGS_KEY, JSON.stringify(state.widgetSettings));
    card.style.opacity = "0";
    card.style.pointerEvents = "none";
    state.gameClosePending = { card, startedAt: Date.now() };
    const sent = requestGameWidgetSave("close");
    pushGameLog("close", sent ? "save requested" : "save unavailable");
    state.gameCloseTimer = window.setTimeout(() => finishGameClose("timeout"), sent ? 1500 : 120);
  }

  const GAME_BUTTON_META = {
    up: { label: "▲", hint: "up/u", className: "dpad-up" },
    down: { label: "▼", hint: "down/d", className: "dpad-down" },
    left: { label: "◀", hint: "left/l", className: "dpad-left" },
    right: { label: "▶", hint: "right/r", className: "dpad-right" },
    a: { label: "A", hint: "a", className: "action-a" },
    b: { label: "B", hint: "b", className: "action-b" },
    select: { label: "SELECT", hint: "sel", className: "system-select" },
    start: { label: "START", hint: "start", className: "system-start" },
  };

  function gameCommandLabel(command) {
    return GAME_BUTTON_META[command]?.label || String(command || "").toUpperCase();
  }

  function validManualPosition(value) {
    return Number.isFinite(Number(value));
  }

  function clampGameManualScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.round(clamp(number, 0.72, 1.8) * 100) / 100;
  }

  function gameManualAnchor(card) {
    return card?.querySelector?.(".game-widget-guide") || card;
  }

  function gameManualPanelSize(game = state.widgetSettings?.game) {
    const scale = clampGameManualScale(game?.manualScale ?? 1);
    const panelW = Math.min(440 * scale, Math.max(280, window.innerWidth - 24));
    const panelH = 360 * scale;
    return { w: panelW, h: panelH };
  }

  function clampGameManualPosition(card, x, y, game = state.widgetSettings?.game) {
    const anchorRect = gameManualAnchor(card)?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const panel = gameManualPanelSize(game);
    const minX = 8 - anchorRect.left;
    const maxX = Math.max(minX, window.innerWidth - panel.w - 8 - anchorRect.left);
    const minY = 8 - anchorRect.top;
    const maxY = Math.max(minY, window.innerHeight - panel.h - 8 - anchorRect.top);
    return {
      x: Math.round(clamp(Number(x) || 0, minX, maxX)),
      y: Math.round(clamp(Number(y) || 0, minY, maxY)),
    };
  }

  function defaultGameManualPosition(card) {
    const rect = card?.getBoundingClientRect?.();
    const anchorRect = gameManualAnchor(card)?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const panel = gameManualPanelSize(state.widgetSettings?.game);
    if (!rect) return clampGameManualPosition(card, window.innerWidth - panel.w - 8, 96);
    const gap = 12;
    let x = rect.right + gap;
    if (x + panel.w > window.innerWidth - gap) x = rect.left - panel.w - gap;
    if (x < gap) x = Math.min(window.innerWidth - panel.w - gap, rect.left + gap);
    const y = rect.top + Math.min(96, Math.max(42, rect.height * 0.16));
    return clampGameManualPosition(card, x - anchorRect.left, y - anchorRect.top);
  }

  function ensureGameManualPosition(card, game = state.widgetSettings?.game) {
    if (!game) return null;
    if (game.manualCoordMode !== "local-guide") {
      game.manualCoordMode = "local-guide";
      game.manualDragged = false;
      game.manualX = NaN;
      game.manualY = NaN;
    }
    if (!game.manualDragged || !validManualPosition(game.manualX) || !validManualPosition(game.manualY)) {
      const next = defaultGameManualPosition(card);
      game.manualX = next.x;
      game.manualY = next.y;
    }
    const clamped = clampGameManualPosition(card, game.manualX, game.manualY, game);
    game.manualX = clamped.x;
    game.manualY = clamped.y;
    return clamped;
  }

  function positionGameManualPanel(card, game = state.widgetSettings?.game) {
    const panel = card?.querySelector?.(".gameboy-manual-panel");
    if (!panel || !game) return;
    const pos = ensureGameManualPosition(card, game);
    if (!pos) return;
    panel.style.setProperty("--game-manual-scale", String(clampGameManualScale(game.manualScale ?? 1)));
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
  }

  function positionGameManualTab(card) {
    const tab = card?.querySelector?.(".gameboy-manual-tab");
    if (!tab) return;
    const rect = card.getBoundingClientRect();
    const anchorRect = gameManualAnchor(card)?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const tabW = 118;
    const tabH = 82;
    const gap = 8;
    let x = rect.right + gap;
    if (x + tabW > window.innerWidth - gap) x = rect.right - tabW - gap;
    const preferredY = rect.top + Math.min(210, Math.max(96, rect.height * 0.34));
    const y = clamp(preferredY, gap, Math.max(gap, window.innerHeight - tabH - gap));
    tab.style.left = `${Math.round(x - anchorRect.left)}px`;
    tab.style.top = `${Math.round(y - anchorRect.top)}px`;
  }

  function positionGameManualUi(card, game = state.widgetSettings?.game) {
    positionGameManualTab(card);
    positionGameManualPanel(card, game);
  }

  function gameWidgetGuideHtml(game = state.widgetSettings?.game) {
    const groupPlay = game?.groupPlay !== false;
    const noteTitle = groupPlay ? "집단 플레이 설명서" : "솔로 플레이 설명서";
    const noteText = groupPlay
      ? "채팅으로 up/u down/d left/l right/r a b sel start"
      : "키보드 방향키 Z=A X=B V=SELECT Enter=START";
    return `
      <button class="gameboy-manual-tab" type="button" title="open game controls guide">
        <span>MANUAL</span>
        <strong>?</strong>
      </button>
      <div class="gameboy-manual-panel"${game?.manualOpen ? "" : " hidden"}>
        <div class="gameboy-manual-card">
          <div class="gameboy-manual-drag">drag manual</div>
          <button class="gameboy-manual-close" type="button" title="close manual">x</button>
          <button class="gameboy-manual-resize" type="button" title="resize manual"></button>
          <h3>${escapeHtml(noteTitle)}</h3>
          <p>${escapeHtml(noteText)}</p>
          <div class="gameboy-manual-grid">
            <span>UP</span><b>up / u / ↑</b>
            <span>DOWN</span><b>down / d / ↓</b>
            <span>LEFT</span><b>left / l / ←</b>
            <span>RIGHT</span><b>right / r / →</b>
            <span>A</span><b>a ${groupPlay ? "" : "/ Z"}</b>
            <span>B</span><b>b ${groupPlay ? "" : "/ X"}</b>
            <span>SELECT</span><b>sel ${groupPlay ? "" : "/ V"}</b>
            <span>START</span><b>start ${groupPlay ? "" : "/ Enter"}</b>
          </div>
          <small>비디오챗 참가자만 집단 플레이 가능 · 케이지 안에서는 참여 불가</small>
        </div>
      </div>
      <div class="gameboy-control-deck">
        <div class="gameboy-dpad" aria-label="direction buttons">
          ${["up", "left", "right", "down"].map((command) => {
            const item = GAME_BUTTON_META[command];
            return `<button class="gameboy-btn gameboy-dpad-btn ${item.className}" type="button" data-game-command="${command}" title="${escapeHtml(item.hint)}">${item.label}</button>`;
          }).join("")}
        </div>
        <div class="gameboy-system-buttons" aria-label="system buttons">
          ${["select", "start"].map((command) => {
            const item = GAME_BUTTON_META[command];
            return `<button class="gameboy-btn gameboy-system-btn ${item.className}" type="button" data-game-command="${command}" title="${escapeHtml(item.hint)}">${item.label}</button>`;
          }).join("")}
        </div>
        <div class="gameboy-action-buttons" aria-label="action buttons">
          ${["b", "a"].map((command) => {
            const item = GAME_BUTTON_META[command];
            return `<button class="gameboy-btn gameboy-action-btn ${item.className}" type="button" data-game-command="${command}" title="${escapeHtml(item.hint)}">${item.label}</button>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function gameWidgetDefaultStatus(game = state.widgetSettings?.game) {
    return game?.groupPlay === false
      ? "솔로: 방향키, Z=A, X=B, V=select, Enter=start"
      : "비디오챗 참가자 채팅만 반영 · 케이지 안에서는 참여 불가";
  }

  function updateGameWidgetButtons(game = state.widgetSettings?.game) {
    const card = widgetLayer?.querySelector("#game-widget");
    if (!card || !game) return;
    const group = card.querySelector(".game-widget-group");
    if (group) {
      const active = game.groupPlay !== false;
      group.classList.toggle("active", active);
      group.textContent = `집단 ${active ? "on" : "off"}`;
    }
    const debug = card.querySelector(".game-widget-debug");
    if (debug) {
      debug.classList.toggle("active", !!game.debug);
      debug.textContent = `debug ${game.debug ? "on" : "off"}`;
    }
    const layoutDebug = card.querySelector(".game-widget-layout-debug");
    if (layoutDebug) {
      layoutDebug.classList.toggle("active", !!game.layoutDebug);
      layoutDebug.textContent = `layout ${game.layoutDebug ? "on" : "off"}`;
    }
    const speed = card.querySelector(".game-widget-speed");
    if (speed) speed.textContent = gameSpeedLabel(game.speed || 1);
    const volume = card.querySelector(".game-widget-volume");
    if (volume) volume.value = String(Math.round(normalizeGameVolume(game.volume ?? 0.75) * 100));
    const volumeText = card.querySelector(".game-widget-volume-value");
    if (volumeText) volumeText.textContent = gameVolumeLabel(game.volume ?? 0.75);
    const body = card.querySelector(".game-widget-body");
    body?.classList.toggle("game-widget-debug-on", !!game.debug);
    const guide = card.querySelector(".game-widget-guide");
    if (guide) guide.innerHTML = gameWidgetGuideHtml(game);
    positionGameManualUi(card, game);
    if (!game.lastCommand) updateGameWidgetStatus(gameWidgetDefaultStatus(game));
    card.dataset.groupPlay = String(game.groupPlay !== false);
    card.dataset.debug = String(!!game.debug);
    card.dataset.manualOpen = String(!!game.manualOpen);
  }

  function pushGameLog(kind, message = "") {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const line = `[${time}] ${kind}${message ? `: ${message}` : ""}`;
    state.gameLogs.push(line);
    if (state.gameLogs.length > 80) state.gameLogs.splice(0, state.gameLogs.length - 80);
    const panel = widgetLayer?.querySelector("#game-widget .game-widget-debug-log");
    if (panel) {
      panel.textContent = state.gameLogs.slice(-28).join("\n");
      panel.scrollTop = panel.scrollHeight;
    }
  }

  function gameManualKeyPayload(ev) {
    const key = String(ev?.key || "");
    const lower = key.toLowerCase();
    const code = String(ev?.code || "");
    if (key === "ArrowUp") return { key: "ArrowUp", code: "ArrowUp", command: "up" };
    if (key === "ArrowDown") return { key: "ArrowDown", code: "ArrowDown", command: "down" };
    if (key === "ArrowLeft") return { key: "ArrowLeft", code: "ArrowLeft", command: "left" };
    if (key === "ArrowRight") return { key: "ArrowRight", code: "ArrowRight", command: "right" };
    if (lower === "z" || code === "KeyZ") return { key: "z", code: "KeyZ", command: "a" };
    if (lower === "x" || code === "KeyX") return { key: "x", code: "KeyX", command: "b" };
    if (lower === "v" || code === "KeyV") return { key: "v", code: "KeyV", command: "select" };
    if (key === "Enter" || code === "Enter") return { key: "Enter", code: "Enter", command: "start" };
    return null;
  }

  function shouldForwardGameKeyboard(ev) {
    const game = state.widgetSettings?.game;
    return !!(
      game?.open &&
      !game.hidden &&
      game.groupPlay === false &&
      !state.characterDriveMode &&
      !state.characterPlaceMode &&
      !state.prisonPlaceMode &&
      !isTextInputTarget(ev.target)
    );
  }

  function forwardGameKeyboardEvent(ev, down) {
    const payload = gameManualKeyPayload(ev);
    if (!payload || !shouldForwardGameKeyboard(ev)) return false;
    const sent = postGameWidgetMessage({ type: "tg-game-key", down, ...payload });
    if (sent) {
      setGameButtonPressed(payload.command, down, down ? 0 : 1);
      ev.preventDefault();
      ev.stopPropagation();
    }
    return sent;
  }

  function gameCommandTokens(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return [];
    const normalized = raw
      .replace(/[，,;|/]+/g, " ")
      .replace(/[↑⬆]/g, " up ")
      .replace(/[↓⬇]/g, " down ")
      .replace(/[←⬅]/g, " left ")
      .replace(/[→➡]/g, " right ");
    const map = {
      u: "up",
      up: "up",
      d: "down",
      down: "down",
      l: "left",
      left: "left",
      r: "right",
      right: "right",
      a: "a",
      b: "b",
      sel: "select",
      select: "select",
      start: "start",
    };
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.length > 8) return [];
    const commands = tokens.map((token) => map[token] || "");
    return commands.every(Boolean) ? commands : [];
  }

  function clearGameVoteBuffer() {
    if (state.gameVoteBuffer?.timer) window.clearTimeout(state.gameVoteBuffer.timer);
    state.gameVoteBuffer = null;
    clearGamePadButtons();
  }

  function flushGameVoteBuffer() {
    const buffer = state.gameVoteBuffer;
    state.gameVoteBuffer = null;
    if (!buffer?.votesByUser?.size) return false;
    const candidates = new Map();
    for (const vote of buffer.votesByUser.values()) {
      const signature = vote.commands.join(" ");
      const item = candidates.get(signature) || {
        commands: vote.commands,
        count: 0,
        firstOrder: vote.order,
        names: [],
      };
      item.count += 1;
      item.firstOrder = Math.min(item.firstOrder, vote.order);
      item.names.push(vote.name);
      candidates.set(signature, item);
    }
    const total = buffer.votesByUser.size;
    const chosen = Array.from(candidates.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.commands.length !== b.commands.length) return b.commands.length - a.commands.length;
      return a.firstOrder - b.firstOrder;
    })[0];
    if (!chosen) return false;
    const game = state.widgetSettings?.game;
    if (!game?.open || game.hidden || game.groupPlay === false) return false;
    const sent = postGameWidgetMessage({
      type: "tg-game-input",
      commands: chosen.commands,
      source: "group-input",
      name: `집단 ${chosen.count}/${total}`,
    });
    if (sent) flashGamePadButtons(chosen.commands, 240);
    const text = sent
      ? `집단 입력: ${chosen.commands.join(" ")} (${chosen.count}/${total})`
      : "game frame not ready";
    if (game) game.lastCommand = text;
    updateGameWidgetStatus(text);
    return sent;
  }

  function queueGameGroupVote(key, commands) {
    if (!state.gameVoteBuffer) {
      state.gameVoteBuffer = {
        votesByUser: new Map(),
        order: 0,
        timer: window.setTimeout(flushGameVoteBuffer, 850),
      };
    }
    const buffer = state.gameVoteBuffer;
    const participant = state.participants.get(key);
    buffer.order += 1;
    buffer.votesByUser.set(key, {
      commands,
      name: participantDisplayLabel(participant),
      order: buffer.order,
    });
    flashGamePadButtons(commands, 120);
    const total = buffer.votesByUser.size;
    updateGameWidgetStatus(`집단 입력 수집: ${commands.join(" ")} (${total}명)`);
    return true;
  }

  function handleGameChatCommand(data) {
    const game = state.widgetSettings?.game;
    if (!game?.open || game.hidden || game.groupPlay === false || data?.type !== "text") return false;
    const key = speakerKey(data, true) || speakerKey(data);
    if (!key || !state.participants.has(key) || isRealJailed(key)) return false;
    const commands = gameCommandTokens(data.text);
    if (!commands.length) return false;
    return queueGameGroupVote(key, commands);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const payload = event.data || {};
    if (payload.type !== "tg-game-status") return;
    pushGameLog(payload.status || "iframe", payload.message || payload.rom || "");
    if (
      state.gameClosePending &&
      ["state-saved", "quick-state-saved", "state-save-missing", "state-save-error", "saved"].includes(payload.status)
    ) {
      finishGameClose(payload.status || "save-response");
    }
    if (payload.status === "saved") updateGameWidgetStatus("게임 저장됨");
    else if (payload.status === "state-saved") updateGameWidgetStatus("상태 세이브 저장됨");
    else if (payload.status === "quick-state-saved") updateGameWidgetStatus("임시 quick state 저장됨");
    else if (payload.status === "state-loaded") updateGameWidgetStatus("상태 세이브 로드됨");
    else if (payload.status === "state-load-pending") updateGameWidgetStatus("start 후 상태 세이브 로드");
    else if (payload.status === "state-load-missing") updateGameWidgetStatus("불러올 상태 세이브 없음");
    else if (payload.status === "state-load-failed") updateGameWidgetStatus("상태 세이브 로드 실패");
    else if (payload.status === "state-save-missing") updateGameWidgetStatus("저장할 상태 없음");
    else if (payload.status === "state-save-error") updateGameWidgetStatus(payload.message || "상태 세이브 저장 실패");
    else if (payload.status === "speed") updateGameWidgetStatus(`게임 속도 ${payload.message || ""}`.trim());
    else if (payload.status === "volume") updateGameWidgetStatus(`게임 볼륨 ${payload.message || ""}`.trim());
    else if (payload.status === "started") updateGameWidgetStatus("게임 실행 중");
    else if (payload.status === "ready") updateGameWidgetStatus("게임 준비됨");
    else if (payload.status === "error") updateGameWidgetStatus(payload.message || "게임 오류");
    else if (payload.status === "rom-error") updateGameWidgetStatus(payload.message || "ROM 로드 실패");
    else if (payload.status === "loader-error") updateGameWidgetStatus("EmulatorJS 로드 실패");
  });

  function renderGameWidget() {
    const game = state.widgetSettings?.game;
    if (!game || game.open === false) return;
    const card = document.createElement("section");
    card.id = "game-widget";
    card.className = "overlay-widget game-widget";
    const dragStrip = document.createElement("div");
    dragStrip.className = "widget-drag-strip game-widget-drag";
    dragStrip.title = "move game widget";
    const header = document.createElement("div");
    header.className = "widget-header game-widget-header";
    const romOptions = state.gameRomList.length ? state.gameRomList : [{ file: game.rom || "pk_gold.gb", name: "포켓몬 골드" }];
    if (!romOptions.some((rom) => safeFilename(rom.file || rom) === game.rom)) {
      game.rom = safeFilename(romOptions[0]?.file || romOptions[0] || game.rom) || game.rom;
    }
    header.innerHTML = `
      <span class="widget-title">게임</span>
      <select class="game-widget-select" title="ROM">
        ${romOptions.map((rom) => {
          const file = safeFilename(rom.file || rom);
          return `<option value="${escapeHtml(file)}"${file === game.rom ? " selected" : ""}>${escapeHtml(gameRomLabel(rom))}</option>`;
        }).join("")}
      </select>
      <button class="game-widget-group${game.groupPlay === false ? "" : " active"}" type="button" title="toggle chat group play">집단 ${game.groupPlay === false ? "off" : "on"}</button>
      <div class="game-widget-stepper" title="game speed">
        <button class="game-widget-speed-down" type="button" title="slower game speed">-</button>
        <span class="game-widget-speed">${gameSpeedLabel(game.speed || 1)}</span>
        <button class="game-widget-speed-up" type="button" title="faster game speed">+</button>
      </div>
      <label class="game-widget-volume-wrap" title="game volume">
        <span>vol</span>
        <input class="game-widget-volume" type="range" min="0" max="100" step="5" value="${Math.round(normalizeGameVolume(game.volume ?? 0.75) * 100)}">
        <span class="game-widget-volume-value">${gameVolumeLabel(game.volume ?? 0.75)}</span>
      </label>
      <div class="game-widget-savebar">
        <button class="game-widget-load" type="button" title="load save state">load</button>
        <button class="game-widget-new" type="button" title="restart without state">new</button>
        <button class="game-widget-save" type="button" title="quick save">save</button>
      </div>
      <button class="game-widget-layout-debug${game.layoutDebug ? " active" : ""}" type="button" title="show layout debug">layout ${game.layoutDebug ? "on" : "off"}</button>
      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(game.hidden, "game")}</button>
      <button class="game-widget-stop" type="button" title="close game">x</button>
    `;
    const body = document.createElement("div");
    body.className = "game-widget-body";
    body.classList.toggle("game-widget-debug-on", !!game.debug);
    const consoleShell = document.createElement("div");
    consoleShell.className = "gameboy-console";
    const screen = document.createElement("div");
    screen.className = "gameboy-screen";
    const guide = document.createElement("div");
    guide.className = "game-widget-guide";
    guide.innerHTML = gameWidgetGuideHtml(game);
    const frame = document.createElement("iframe");
    frame.className = "game-widget-frame";
    frame.src = gamePlayerUrl(game);
    frame.referrerPolicy = "no-referrer";
    const status = document.createElement("div");
    status.className = "game-widget-status";
    status.textContent = game.lastCommand || gameWidgetDefaultStatus(game);
    const debugLog = document.createElement("pre");
    debugLog.className = "game-widget-debug-log";
    debugLog.textContent = state.gameLogs.slice(-28).join("\n");
    screen.append(frame, status);
    consoleShell.append(screen, guide);
    body.append(consoleShell, debugLog);
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(dragStrip, header, body, resize);
    widgetLayer.appendChild(card);
    card.dataset.rom = String(game.rom || "");
    card.dataset.groupPlay = String(game.groupPlay !== false);
    card.dataset.debug = String(!!game.debug);
    card.dataset.manualOpen = String(!!game.manualOpen);
    frame.addEventListener("load", () => {
      pushGameLog("iframe-load", frame.src);
      window.setTimeout(() => {
        postGameWidgetSpeed(game);
        postGameWidgetVolume(game);
        postGameWidgetLayoutDebug(game);
        syncGameWidgetViewport();
      }, 320);
      if (game.debug) debugLog.scrollTop = debugLog.scrollHeight;
    });
    frame.addEventListener("error", () => {
      pushGameLog("iframe-error", frame.src);
      updateGameWidgetStatus("game iframe load error");
    });
    const apply = () => {
      applyWidgetBox(card, game, 500, 470);
      positionGameManualUi(card, game);
      scheduleGameWidgetViewportSync();
    };
    apply();
    if (!state.gameRomLoaded && !state.gameRomLoading) {
      refreshGameRomList().then(() => {
        if (state.widgetSettings?.game?.open) renderWidgets();
      });
    }
    const hideButton = header.querySelector(".widget-hide");
    const showGameWidget = () => {
      game.hidden = false;
      game.open = true;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      if (!game.hidden) {
        clearGameVoteBuffer();
        requestGameWidgetSave();
        game.hidden = true;
        apply();
        hideButton.textContent = widgetHideText(true, "game");
        saveWidgetSettings();
        return;
      }
      showGameWidget();
    });
    header.querySelector(".game-widget-save")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ok = requestGameWidgetSave();
      status.textContent = ok ? "save requested" : "game frame not ready";
    });
    header.querySelector(".game-widget-load")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ok = postGameWidgetMessage({ type: "tg-game-load" });
      status.textContent = ok ? "load requested" : "game frame not ready";
    });
    header.querySelector(".game-widget-new")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      clearGameVoteBuffer();
      const ok = postGameWidgetMessage({ type: "tg-game-new" });
      status.textContent = ok ? "new game requested" : "game frame not ready";
    });
    const changeSpeed = (delta) => {
      state.gameLocalOverrideUntil = Date.now() + 5000;
      game.speed = shiftGameSpeed(game.speed || 1, delta);
      updateGameWidgetButtons(game);
      const sent = postGameWidgetSpeed(game);
      updateGameWidgetStatus(sent ? `게임 속도 ${gameSpeedLabel(game.speed)}` : "game frame not ready");
      saveWidgetSettingsSoon();
    };
    header.querySelector(".game-widget-speed-down")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      changeSpeed(-1);
    });
    header.querySelector(".game-widget-speed-up")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      changeSpeed(1);
    });
    header.querySelector(".game-widget-volume")?.addEventListener("input", (ev) => {
      ev.stopPropagation();
      state.gameLocalOverrideUntil = Date.now() + 5000;
      game.volume = normalizeGameVolume(Number(ev.currentTarget.value) / 100);
      updateGameWidgetButtons(game);
      postGameWidgetVolume(game);
      saveWidgetSettingsSoon(220);
    });
    header.querySelector(".game-widget-select")?.addEventListener("change", (ev) => {
      clearGameVoteBuffer();
      const nextRom = safeFilename(ev.currentTarget.value) || game.rom;
      if (nextRom === game.rom) return;
      requestGameWidgetSave();
      game.rom = nextRom;
      game.selected = "pokemon-gold";
      updateGameWidgetStatus("ROM 전환 전 저장 요청...");
      window.setTimeout(() => {
        renderWidgets();
        saveWidgetSettings();
      }, 650);
    });
    header.querySelector(".game-widget-group")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      clearGameVoteBuffer();
      state.gameLocalOverrideUntil = Date.now() + 5000;
      game.groupPlay = game.groupPlay === false;
      updateGameWidgetButtons(game);
      saveWidgetSettingsSoon();
    });
    header.querySelector(".game-widget-layout-debug")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.gameLocalOverrideUntil = Date.now() + 5000;
      game.layoutDebug = !game.layoutDebug;
      updateGameWidgetButtons(game);
      const sent = postGameWidgetLayoutDebug(game);
      updateGameWidgetStatus(sent ? `layout debug ${game.layoutDebug ? "on" : "off"}` : "game frame not ready");
      saveWidgetSettingsSoon();
    });
    body.addEventListener("pointerdown", (ev) => {
      const button = ev.target instanceof Element ? ev.target.closest("[data-game-command]") : null;
      if (!button) return;
      ev.preventDefault();
      ev.stopPropagation();
      const command = String(button.getAttribute("data-game-command") || "");
      const sent = postGameWidgetMessage({ type: "tg-game-input", commands: [command], source: "widget-button", name: "host" });
      if (sent) {
        setGameButtonPressed(command, true, 160);
        updateGameWidgetStatus(`직접 입력: ${gameCommandLabel(command)}`);
      } else {
        updateGameWidgetStatus("game frame not ready");
      }
    });
    const openManual = (ev) => {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      game.manualOpen = true;
      const panel = body.querySelector(".gameboy-manual-panel");
      panel?.removeAttribute("hidden");
      card.dataset.manualOpen = "true";
      positionGameManualUi(card, game);
      saveWidgetSettings();
    };
    const closeManual = (ev) => {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      game.manualOpen = false;
      body.querySelector(".gameboy-manual-panel")?.setAttribute("hidden", "");
      card.dataset.manualOpen = "false";
      positionGameManualUi(card, game);
      saveWidgetSettings();
    };
    body.querySelector(".gameboy-manual-tab")?.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
    body.querySelector(".gameboy-manual-tab")?.addEventListener("click", openManual, true);
    body.querySelector(".gameboy-manual-close")?.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
    body.querySelector(".gameboy-manual-close")?.addEventListener("click", closeManual, true);
    const beginManualResize = (ev, handle) => {
      ev.preventDefault();
      ev.stopPropagation();
      const pointerId = ev.pointerId;
      const start = {
        x: ev.clientX,
        y: ev.clientY,
        scale: clampGameManualScale(game.manualScale ?? 1),
      };
      handle.classList.add("dragging");
      try { handle.setPointerCapture?.(pointerId); } catch (_) {}
      const move = (moveEv) => {
        if (moveEv.pointerId !== undefined && moveEv.pointerId !== pointerId) return;
        const dx = moveEv.clientX - start.x;
        const dy = moveEv.clientY - start.y;
        const mainDelta = Math.abs(dx) > Math.abs(dy) ? dx / 320 : dy / 260;
        game.manualScale = clampGameManualScale(start.scale + mainDelta);
        positionGameManualUi(card, game);
      };
      const finish = () => {
        handle.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        handle.removeEventListener("lostpointercapture", finish);
        saveWidgetSettingsSoon(80);
        try { handle.releasePointerCapture?.(pointerId); } catch (_) {}
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish, { once: true });
      window.addEventListener("pointercancel", finish, { once: true });
      handle.addEventListener("lostpointercapture", finish, { once: true });
    };
    body.querySelector(".gameboy-manual-resize")?.addEventListener("pointerdown", (ev) => {
      beginManualResize(ev, ev.currentTarget);
    }, true);
    card.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      if (target.closest(".gameboy-manual-tab")) {
        openManual(ev);
      } else if (target.closest(".gameboy-manual-close")) {
        closeManual(ev);
      }
    }, true);
    body.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      if (target.closest(".gameboy-manual-tab")) {
        openManual(ev);
        return;
      }
      if (target.closest(".gameboy-manual-close")) {
        closeManual(ev);
        return;
      }
      const panel = target.closest(".gameboy-manual-panel");
      if (panel && ev.target === panel) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    body.addEventListener("pointerdown", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      const resizeHandle = target?.closest(".gameboy-manual-resize");
      if (resizeHandle) {
        beginManualResize(ev, resizeHandle);
        return;
      }
      const manualCard = target?.closest(".gameboy-manual-card");
      if (!manualCard || target.closest("button")) return;
      ev.preventDefault();
      ev.stopPropagation();
      const pointerId = ev.pointerId;
      const start = {
        x: ev.clientX,
        y: ev.clientY,
        manualX: validManualPosition(game.manualX) ? Number(game.manualX) : defaultGameManualPosition(card).x,
        manualY: validManualPosition(game.manualY) ? Number(game.manualY) : defaultGameManualPosition(card).y,
      };
      manualCard.classList.add("dragging");
      try { manualCard.setPointerCapture?.(pointerId); } catch (_) {}
      const move = (moveEv) => {
        if (moveEv.pointerId !== undefined && moveEv.pointerId !== pointerId) return;
        const next = clampGameManualPosition(card,
          start.manualX + moveEv.clientX - start.x,
          start.manualY + moveEv.clientY - start.y,
          game
        );
        game.manualX = next.x;
        game.manualY = next.y;
        game.manualDragged = true;
        game.manualCoordMode = "local-guide";
        positionGameManualUi(card, game);
      };
      const finish = () => {
        manualCard.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        manualCard.removeEventListener("lostpointercapture", finish);
        saveWidgetSettingsSoon(80);
        try { manualCard.releasePointerCapture?.(pointerId); } catch (_) {}
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish, { once: true });
      window.addEventListener("pointercancel", finish, { once: true });
      manualCard.addEventListener("lostpointercapture", finish, { once: true });
    });
    header.querySelector(".game-widget-debug")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.gameLocalOverrideUntil = Date.now() + 5000;
      game.debug = !game.debug;
      pushGameLog("debug", game.debug ? "on" : "off");
      updateGameWidgetButtons(game);
      saveWidgetSettingsSoon();
    });
    header.querySelector(".game-widget-stop")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      clearGameVoteBuffer();
      beginGameClose(card, game);
    });
    const saveGameWidgetBox = () => {
      state.gameLocalOverrideUntil = Date.now() + 5000;
      saveWidgetSettings();
      scheduleGameWidgetViewportSync();
    };
    bindHiddenShowHandle(card, hideButton, game, apply, saveGameWidgetBox, showGameWidget);
    bindWidgetFrame(card, dragStrip, resize, game, apply, saveGameWidgetBox, 500, 470);
  }

  function reusableGameWidget() {
    const game = state.widgetSettings?.game;
    const card = widgetLayer?.querySelector("#game-widget");
    if (!game || !card || game.open === false) return null;
    if (card.dataset.rom !== String(game.rom || "")) return null;
    updateGameWidgetButtons(game);
    applyWidgetBox(card, game, 500, 470);
    card.style.opacity = "";
    card.style.pointerEvents = "";
    const hide = card.querySelector(".widget-hide");
    if (hide) hide.textContent = widgetHideText(game.hidden, "game");
    return card;
  }

  function electronBrowserApi() {
    return window.tgElectronBrowser || null;
  }

  function hasElectronBrowserApi() {
    const api = electronBrowserApi();
    return !!(api && typeof api.upsert === "function");
  }

  function electronBrowserLinkPreview() {
    if (!hasElectronBrowserApi()) return null;
    if (!sharedElectronLinkPreview) {
      sharedElectronLinkPreview = {
        open(url) {
          openUrlInElectronBrowser(url);
        },
      };
    }
    return sharedElectronLinkPreview;
  }

  function openUrlInElectronBrowser(rawUrl) {
    const url = normalizeBrowserUrl(rawUrl);
    if (!url || !hasElectronBrowserApi()) return false;
    if (!state.widgetSettings) state.widgetSettings = loadWidgetSettings();
    const browser = normalizeElectronBrowserWidget(state.widgetSettings.electronBrowser);
    browser.open = true;
    browser.hidden = false;
    browser.url = url;
    state.widgetSettings.electronBrowser = browser;
    renderWidgets();
    saveWidgetSettings();
    return true;
  }

  function electronBrowserBounds(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  function hideElectronNativeView(id, pause = false) {
    const api = electronBrowserApi();
    if (!api || typeof api.upsert !== "function") return false;
    api.upsert({ id, visible: false, pause: !!pause });
    return true;
  }

  function closeElectronNativeView(id) {
    const api = electronBrowserApi();
    if (!api || typeof api.close !== "function") return false;
    api.close({ id });
    return true;
  }

  function setElectronNativeViewDragSuppressed(active) {
    const next = !!active;
    if (state.electronNativeViewsSuppressedForDrag === next) return;
    const api = electronBrowserApi();
    if (!api || typeof api.upsert !== "function") {
      state.electronNativeViewsSuppressedForDrag = false;
      return;
    }
    state.electronNativeViewsSuppressedForDrag = next;
    if (next) {
      api.upsert({ id: "web", visible: false });
      api.upsert({ id: "youtube", visible: false });
      return;
    }
    window.requestAnimationFrame(() => {
      const browser = state.widgetSettings?.electronBrowser;
      const browserViewport = widgetLayer?.querySelector("#electron-browser-widget .electron-browser-viewport");
      if (browser && browserViewport) syncElectronBrowserView(browser, browserViewport);
      const youtube = state.widgetSettings?.youtube;
      const youtubeViewport = widgetLayer?.querySelector("#youtube-widget .youtube-native-player");
      if (youtube && youtubeViewport) syncYoutubeNativeView(youtube, youtubeViewport);
    });
  }

  function appendElectronBrowserLog(entry) {
    const level = String(entry?.level || entry?.type || "info").toLowerCase();
    const message = String(entry?.message || "");
    if (!message) return;
    state.electronBrowserLogs.push({
      level,
      message,
      source: String(entry?.source || ""),
      line: Number(entry?.line) || 0,
      ts: Date.now(),
    });
    state.electronBrowserLogs = state.electronBrowserLogs.slice(-120);
    updateElectronBrowserLogPanel();
  }

  function renderElectronBrowserLogPanel(panel) {
    if (!panel) return;
    panel.innerHTML = "";
    const logs = state.electronBrowserLogs.slice(-80);
    if (!logs.length) {
      const empty = document.createElement("div");
      empty.className = "electron-browser-log-empty";
      empty.textContent = "no logs";
      panel.appendChild(empty);
      return;
    }
    for (const item of logs) {
      const row = document.createElement("div");
      row.className = `electron-browser-log ${item.level}`;
      const time = new Date(item.ts).toLocaleTimeString("ko-KR", { hour12: false });
      const suffix = item.source ? ` ${item.source}${item.line ? `:${item.line}` : ""}` : "";
      row.textContent = `[${time}] ${item.level}${suffix} ${item.message}`;
      panel.appendChild(row);
    }
    panel.scrollTop = panel.scrollHeight;
  }

  function updateElectronBrowserLogPanel() {
    renderElectronBrowserLogPanel(widgetLayer?.querySelector(".electron-browser-debug-log"));
  }

  function setupElectronBrowserBridge() {
    if (state.electronBrowserBridgeBound) return;
    const api = electronBrowserApi();
    if (!api || typeof api.onEvent !== "function") return;
    state.electronBrowserBridgeBound = true;
    api.onEvent((event) => {
      if (!event || typeof event !== "object") return;
      const eventId = String(event.id || "web").toLowerCase();
      if (eventId !== "web") return;
      const browser = state.widgetSettings?.electronBrowser;
      if (event.type === "log") {
        appendElectronBrowserLog(event);
        return;
      }
      if (event.type !== "status" || !browser) return;
      if (event.url) browser.url = String(event.url);
      if (event.title !== undefined) browser.title = String(event.title || "");
      if (event.canGoBack !== undefined) browser.canGoBack = !!event.canGoBack;
      if (event.canGoForward !== undefined) browser.canGoForward = !!event.canGoForward;
      if (event.loading !== undefined) browser.loading = !!event.loading;
      const card = widgetLayer?.querySelector("#electron-browser-widget");
      const input = card?.querySelector(".electron-browser-url");
      if (input && document.activeElement !== input) input.value = browser.url || "";
      const title = card?.querySelector(".electron-browser-title");
      if (title) title.textContent = browser.title || browser.url || "web";
      card?.querySelector(".electron-browser-back")?.toggleAttribute("disabled", !browser.canGoBack);
      card?.querySelector(".electron-browser-forward")?.toggleAttribute("disabled", !browser.canGoForward);
      saveWidgetSettings();
    });
  }

  function syncElectronBrowserView(browser, viewport) {
    const api = electronBrowserApi();
    if (!api || typeof api.upsert !== "function") return;
    if (state.electronNativeViewsSuppressedForDrag) return;
    if (!browser?.open || browser.hidden || !viewport) {
      api.upsert({ id: "web", visible: false });
      return;
    }
    window.requestAnimationFrame(() => {
      if (!browser.open || browser.hidden || !viewport.isConnected) {
        api.upsert({ id: "web", visible: false });
        return;
      }
      const url = normalizeBrowserUrl(browser.url);
      if (!url) return;
      api.upsert({
        id: "web",
        visible: true,
        url,
        debug: !!browser.debug,
        bounds: electronBrowserBounds(viewport),
      });
    });
  }

  function renderElectronBrowserWidget() {
    const browser = state.widgetSettings?.electronBrowser;
    if (!browser || browser.open === false) {
      closeElectronNativeView("web");
      return;
    }
    setupElectronBrowserBridge();
    const card = document.createElement("section");
    card.id = "electron-browser-widget";
    card.className = `overlay-widget electron-browser-widget${browser.debug ? " debug-widget" : ""}`;
    const dragStrip = document.createElement("div");
    dragStrip.className = "widget-drag-strip electron-browser-widget-drag";
    dragStrip.title = "move web widget";
    const header = document.createElement("div");
    header.className = "widget-header electron-browser-widget-header";
    header.innerHTML = `
      <input class="electron-browser-url" type="text" placeholder="https://..." value="${escapeHtml(browser.url || "")}">
      <button class="electron-browser-go" type="button" title="load URL">go</button>
      <button class="electron-browser-back" type="button" title="back"${browser.canGoBack ? "" : " disabled"}>&lt;</button>
      <button class="electron-browser-forward" type="button" title="forward"${browser.canGoForward ? "" : " disabled"}>&gt;</button>
      <button class="electron-browser-refresh" type="button" title="reload">R</button>
      <button class="electron-browser-open" type="button" title="open externally">open</button>
      <button class="electron-browser-devtools" type="button" title="open web DevTools">dev</button>
      <button class="electron-browser-debug-toggle${browser.debug ? " active" : ""}" type="button" title="show console logs">debug</button>
	      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(browser.hidden, "web")}</button>
      <button class="electron-browser-stop" type="button" title="close browser view">x</button>
    `;
    const body = document.createElement("div");
    body.className = "electron-browser-widget-body";
    const viewport = document.createElement("div");
    viewport.className = "electron-browser-viewport";
    const title = document.createElement("div");
    title.className = "electron-browser-title";
    title.textContent = browser.title || browser.url || "web";
    const fallback = document.createElement("div");
    fallback.className = "electron-browser-fallback";
    fallback.textContent = hasElectronBrowserApi()
      ? "Native web view is attached here."
      : "Web browsing works only inside the Windows Electron app.";
    viewport.append(title, fallback);
    const debugPanel = document.createElement("div");
    debugPanel.className = "electron-browser-debug-log";
    body.append(viewport, debugPanel);
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(dragStrip, header, body, resize);
    widgetLayer.appendChild(card);
    renderElectronBrowserLogPanel(debugPanel);
    const input = header.querySelector(".electron-browser-url");
    const apply = () => {
      applyWidgetBox(card, browser, 620, browser.debug ? 390 : 300);
      syncElectronBrowserView(browser, viewport);
    };
    apply();
    const commitUrl = () => {
      const normalized = normalizeBrowserUrl(input?.value || "");
      if (!normalized) return;
      browser.url = normalized;
      browser.open = true;
      browser.hidden = false;
      if (input) input.value = browser.url;
      renderWidgets();
      saveWidgetSettings();
    };
    input?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        commitUrl();
      }
    });
    input?.addEventListener("change", commitUrl);
    header.querySelector(".electron-browser-go")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      commitUrl();
    });
    header.querySelector(".electron-browser-back")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      electronBrowserApi()?.back?.({ id: "web" });
    });
    header.querySelector(".electron-browser-forward")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      electronBrowserApi()?.forward?.({ id: "web" });
    });
    header.querySelector(".electron-browser-refresh")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      electronBrowserApi()?.reload?.({ id: "web" });
    });
    header.querySelector(".electron-browser-open")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const url = normalizeBrowserUrl(input?.value || browser.url);
      if (url) {
        if (electronBrowserApi()?.openExternal) electronBrowserApi().openExternal(url);
        else window.open(url, "_blank", "noopener,noreferrer");
      }
    });
    header.querySelector(".electron-browser-devtools")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      electronBrowserApi()?.devtools?.({ id: "web" });
    });
    header.querySelector(".electron-browser-debug-toggle")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      browser.debug = !browser.debug;
      renderWidgets();
      saveWidgetSettings();
    });
    const hideButton = header.querySelector(".widget-hide");
    const showElectronBrowserWidget = () => {
      browser.hidden = false;
      browser.open = true;
      renderWidgets();
      saveWidgetSettings();
    };
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (consumeHiddenShowPointerClick(hideButton)) return;
      browser.hidden = !browser.hidden;
      renderWidgets();
      saveWidgetSettings();
    });
    header.querySelector(".electron-browser-stop")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      browser.open = false;
      browser.hidden = true;
      browser.url = "";
      browser.title = "";
      browser.canGoBack = false;
      browser.canGoForward = false;
      browser.loading = false;
      state.electronBrowserLogs = [];
      closeElectronNativeView("web");
      renderWidgets();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, browser, apply, saveWidgetSettings, showElectronBrowserWidget);
    bindWidgetFrame(card, dragStrip, resize, browser, apply, saveWidgetSettings, 620, 300);
  }

  function syncYoutubeNativeView(youtube, viewport) {
    const api = electronBrowserApi();
    if (!api || typeof api.upsert !== "function") return false;
    if (state.electronNativeViewsSuppressedForDrag) return true;
    if (!youtube?.open || youtube.hidden || !youtube.videoId || !viewport) {
      api.upsert({ id: "youtube", visible: false, pause: true });
      return true;
    }
    window.requestAnimationFrame(() => {
      if (!youtube.open || youtube.hidden || !youtube.videoId || !viewport.isConnected) {
        api.upsert({ id: "youtube", visible: false, pause: true });
        return;
      }
      const url = youtubeNativeEmbedUrl(youtube.videoId);
      if (!url) return;
      api.upsert({
        id: "youtube",
        visible: true,
        url,
        bounds: electronBrowserBounds(viewport),
      });
    });
    return true;
  }

  function renderYoutubeResults(body, youtube) {
    const results = state.youtubeSearchResults || [];
    const resultsBox = document.createElement("div");
    resultsBox.className = "youtube-widget-results";
    if (state.youtubeSearchLoading) {
      const loading = document.createElement("div");
      loading.className = "youtube-widget-empty";
      loading.textContent = "searching...";
      resultsBox.appendChild(loading);
    } else if (state.youtubeSearchError) {
      const error = document.createElement("div");
      error.className = "youtube-widget-empty";
      error.textContent = state.youtubeSearchError;
      resultsBox.appendChild(error);
    } else if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "youtube-widget-empty";
      empty.textContent = "enter YouTube URL or search";
      resultsBox.appendChild(empty);
    } else {
      for (const item of results) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "youtube-result";
        const thumb = document.createElement("img");
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.referrerPolicy = "no-referrer";
        thumb.src = item.thumbnail || "";
        const meta = document.createElement("span");
        meta.className = "youtube-result-meta";
        const title = document.createElement("span");
        title.className = "youtube-result-title";
        title.textContent = item.title || "Untitled";
        const sub = document.createElement("span");
        sub.className = "youtube-result-sub";
        sub.textContent = [item.channel, item.duration, item.published].filter(Boolean).join(" · ");
        meta.append(title, sub);
        row.append(thumb, meta);
        row.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setYoutubeVideo(youtube, item.video_id);
        });
        resultsBox.appendChild(row);
      }
    }
    body.appendChild(resultsBox);
  }

  function renderYoutubeWidget() {
    const youtube = state.widgetSettings?.youtube;
    if (!youtube || youtube.open === false) {
      closeElectronNativeView("youtube");
      return;
    }
    const card = document.createElement("section");
    card.id = "youtube-widget";
    card.className = "overlay-widget youtube-widget";
    const dragStrip = document.createElement("div");
    dragStrip.className = "widget-drag-strip youtube-widget-drag";
    dragStrip.title = "move YouTube widget";
    const header = document.createElement("div");
    header.className = "widget-header youtube-widget-header";
    header.innerHTML = `
      <input class="youtube-widget-query" type="text" placeholder="YouTube URL or search" value="${escapeHtml(youtube.query || youtube.url || "")}">
      <button class="youtube-widget-search" type="button" title="search or load">go</button>
      <button class="youtube-widget-open" type="button" title="open YouTube">open</button>
      <button class="widget-hide" type="button" title="show/hide">${widgetHideText(youtube.hidden, "youtube")}</button>
      <button class="youtube-widget-stop" type="button" title="close and stop">x</button>
    `;
    const body = document.createElement("div");
    body.className = "youtube-widget-body";
    const resize = document.createElement("div");
    resize.className = "widget-resize";
    resize.title = "resize";
    card.append(dragStrip, header, body, resize);
    widgetLayer.appendChild(card);
    const input = header.querySelector(".youtube-widget-query");
    const currentYoutube = () => state.widgetSettings?.youtube || youtube;
    let nativeViewport = null;
    const apply = () => {
      applyWidgetBox(card, youtube, 360, 260);
      if (nativeViewport) syncYoutubeNativeView(youtube, nativeViewport);
    };
    const renderBody = () => {
      nativeViewport = null;
      body.innerHTML = "";
      if (youtube.hidden) {
        hideElectronNativeView("youtube", true);
        return;
      }
      if (youtube.videoId) {
        if (hasElectronBrowserApi()) {
          const player = document.createElement("div");
          player.className = "youtube-player youtube-native-player";
          const fallback = document.createElement("div");
          fallback.className = "youtube-widget-empty";
          fallback.textContent = "Native YouTube view is attached here.";
          player.appendChild(fallback);
          body.appendChild(player);
          nativeViewport = player;
          syncYoutubeNativeView(youtube, nativeViewport);
        } else {
          const player = document.createElement("iframe");
          player.className = "youtube-player";
          player.src = youtubeEmbedUrl(youtube.videoId);
          player.title = "YouTube player";
          player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          player.allowFullscreen = true;
          body.appendChild(player);
        }
      } else {
        hideElectronNativeView("youtube", true);
        renderYoutubeResults(body, youtube);
      }
    };
    apply();
    renderBody();
    apply();
    const submit = () => {
      const value = String(input?.value || "").trim();
      if (!value) return;
      searchYoutubeWidget(currentYoutube(), value);
    };
    input?.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        submit();
      }
    });
    header.querySelector(".youtube-widget-search")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      submit();
    });
    header.querySelector(".youtube-widget-open")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const active = currentYoutube();
      const raw = String(input?.value || active.url || "").trim();
      const videoId = active.videoId || extractYouTubeVideoId(raw);
      const url = videoId
        ? youtubeWatchUrl(videoId)
        : (raw ? `https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}` : "https://www.youtube.com/");
      if (electronBrowserApi()?.openExternal) electronBrowserApi().openExternal(url);
      else window.open(url, "_blank", "noopener,noreferrer");
    });
    const showYoutubeWidget = () => {
      const active = currentYoutube();
      active.hidden = false;
      active.open = true;
      renderWidgets();
      saveWidgetSettings();
    };
    const hideButton = header.querySelector(".widget-hide");
    hideButton?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (hideButton.dataset.hiddenShowPointerHandled === "1") {
        delete hideButton.dataset.hiddenShowPointerHandled;
        return;
      }
      const active = currentYoutube();
      if (active.hidden) {
        showYoutubeWidget();
        return;
      }
      active.hidden = true;
      active.open = true;
      if (active.hidden) {
        postYoutubeCommand("pauseVideo");
        hideElectronNativeView("youtube", true);
      }
      renderWidgets();
      saveWidgetSettings();
    });
    bindHiddenShowHandle(card, hideButton, youtube, apply, saveWidgetSettings, showYoutubeWidget);
    header.querySelector(".youtube-widget-stop")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const active = currentYoutube();
      active.open = false;
      active.hidden = true;
      active.query = "";
      active.videoId = "";
      active.url = "";
      state.youtubeSearchLoading = false;
      state.youtubeSearchResults = [];
      state.youtubeSearchError = "";
      closeElectronNativeView("youtube");
      renderWidgets();
      saveWidgetSettings();
    });
    body.addEventListener("dblclick", (ev) => {
      const active = currentYoutube();
      if (!active.videoId) return;
      ev.preventDefault();
      active.videoId = "";
      closeElectronNativeView("youtube");
      renderWidgets();
      saveWidgetSettings();
    });
    card.dataset.videoId = youtube.hidden ? "" : String(youtube.videoId || "");
    bindWidgetFrame(card, dragStrip, resize, youtube, apply, saveWidgetSettings, 360, 260);
  }

  function reusableYoutubeWidget() {
    if (hasElectronBrowserApi()) return null;
    const youtube = state.widgetSettings?.youtube;
    const card = widgetLayer?.querySelector("#youtube-widget");
    if (!youtube || !card || youtube.open === false) return null;
    if (!youtube.videoId) return null;
    if (card.dataset.videoId !== String(youtube.videoId || "")) return null;
    applyWidgetBox(card, youtube, 360, 260);
    const hide = card.querySelector(".widget-hide");
    if (hide) hide.textContent = widgetHideText(youtube.hidden, "youtube");
    return card;
  }

  function clearWidgetLayerExcept(preserved = []) {
    const keep = new Set(preserved.filter(Boolean));
    for (const child of Array.from(widgetLayer.children)) {
      if (!keep.has(child)) child.remove();
    }
  }

  function renderWidgets({ force = false } = {}) {
    if (!widgetLayer || !state.widgetSettings) return;
    if ((state.widgetDragDepth > 0 || state.widgetInteractionDepth > 0) && !force) {
      state.widgetRenderPending = true;
      return;
    }
    state.widgetRenderPending = false;
    const preservedYoutube = reusableYoutubeWidget();
    const preservedGame = reusableGameWidget();
    clearWidgetLayerExcept([preservedYoutube, preservedGame]);
    renderPriceWidget();
    if (!preservedYoutube) renderYoutubeWidget();
    renderElectronBrowserWidget();
    if (!preservedGame) renderGameWidget();
    renderCharacterMoveWidget();
    renderPrisonWidget("mini");
    renderPrisonWidget("real");
    for (const memo of state.widgetSettings.memos || []) {
      renderMemoWidget(memo);
    }
    for (const browser of state.widgetSettings.browsers || []) {
      renderBrowserWidget(browser);
    }
  }

  function refreshOpenPrisonWidgets() {
    if (!state.widgetSettings) return;
    const mini = state.widgetSettings.miniJail;
    const real = state.widgetSettings.realJail;
    if (!mini?.open && !real?.open) return;
    if (state.prisonScaleAdjusting || state.prisonTransformAdjusting || state.prisonPlaceMode) {
      state.prisonWidgetRefreshPending = true;
      return;
    }
    state.prisonWidgetRefreshPending = false;
    renderWidgets();
  }

  function refreshOpenCharacterMoveWidget() {
    const widget = characterMoveWidget();
    if (!widget?.open) return;
    if (state.characterMoveAdjusting || state.characterPlaceMode || state.characterDriveMode) return;
    renderWidgets();
  }

  function applyWidgetSettings() {
    if (!state.widgetSettings) return;
    if (!Array.isArray(state.widgetSettings.memos)) state.widgetSettings.memos = [];
    state.widgetSettings.memos = state.widgetSettings.memos.map(normalizeMemoWidget).filter(Boolean);
    if (!Array.isArray(state.widgetSettings.browsers)) state.widgetSettings.browsers = [];
    state.widgetSettings.browsers = state.widgetSettings.browsers.map(normalizeBrowserWidget).filter(Boolean);
    state.widgetSettings.controls = Object.assign(defaultWidgetSettings().controls, state.widgetSettings.controls || {});
    state.widgetSettings.price = Object.assign(defaultWidgetSettings().price, state.widgetSettings.price || {});
    state.widgetSettings.game = normalizeGameWidget(state.widgetSettings.game);
    state.widgetSettings.characterMove = normalizeCharacterMoveWidget(state.widgetSettings.characterMove);
    state.widgetSettings.miniJail = normalizePrisonWidget(state.widgetSettings.miniJail, "mini");
    state.widgetSettings.realJail = normalizePrisonWidget(state.widgetSettings.realJail, "real");
    syncRealJailSign();
    const youtubeSettings = state.widgetSettings.youtube && typeof state.widgetSettings.youtube === "object"
      ? state.widgetSettings.youtube
      : {};
    Object.assign(youtubeSettings, Object.assign(defaultWidgetSettings().youtube, youtubeSettings));
    if (youtubeSettings.open === undefined) youtubeSettings.open = !youtubeSettings.hidden;
    state.widgetSettings.youtube = youtubeSettings;
    state.widgetSettings.electronBrowser = normalizeElectronBrowserWidget(state.widgetSettings.electronBrowser);
    applyWidgetControlsPosition();
    renderWidgets();
  }

  function setupWidgetControls() {
    state.widgetSettings = loadWidgetSettings();
    applyWidgetSettings();
    setupWidgetControlsDrag();
    widgetAddPrice?.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.widgetSettings.price.hidden = false;
      renderWidgets();
      saveWidgetSettings();
      refreshPriceWidget(true);
    });
    widgetAddMemo?.addEventListener("click", (ev) => {
      ev.preventDefault();
      addMemoWidget();
    });
    widgetAddCharacterMove?.addEventListener("click", (ev) => {
      ev.preventDefault();
      openCharacterMoveWidget();
    });
    widgetAddMiniJail?.addEventListener("click", (ev) => {
      ev.preventDefault();
      openPrisonWidget("mini");
    });
    widgetAddRealJail?.addEventListener("click", (ev) => {
      ev.preventDefault();
      openPrisonWidget("real");
    });
    widgetAddGame?.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.gameLocalOverrideUntil = Date.now() + 5000;
      state.gameLocalClosedAt = 0;
      state.widgetSettings.game.closedAt = 0;
      state.widgetSettings.game.open = true;
      state.widgetSettings.game.hidden = false;
      renderWidgets();
      saveWidgetSettings();
    });
    widgetAddBrowser?.addEventListener("click", (ev) => {
      ev.preventDefault();
      addBrowserWidget();
    });
    widgetAddElectronBrowser?.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.widgetSettings.electronBrowser.open = true;
      state.widgetSettings.electronBrowser.hidden = false;
      renderWidgets();
      saveWidgetSettings();
    });
    widgetAddYoutube?.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.widgetSettings.youtube.open = true;
      state.widgetSettings.youtube.hidden = false;
      renderWidgets();
      saveWidgetSettings();
    });
    window.addEventListener("resize", () => {
      applyWidgetSettings();
      saveWidgetSettings();
    });
    schedulePriceWidgetRefresh(true);
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
      return Object.assign(defaultTopicSettings(), raw ? JSON.parse(raw) : {}, settingSection("topic") || {});
    } catch (_) {
      return defaultTopicSettings();
    }
  }

  function saveTopicSettings() {
    if (!state.topicSettings) return;
    persistSetting(TOPIC_SETTINGS_KEY, state.topicSettings);
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
      headGapPx: 0,
      bubbleGapPx: 0,
      subaccountAutoJoin: true,
      hideSubaccount: false,
    };
  }

  function loadAvatarSettings() {
    try {
      const raw = localStorage.getItem(AVATAR_SETTINGS_KEY);
      return Object.assign(defaultAvatarSettings(), raw ? JSON.parse(raw) : {}, settingSection("avatar") || {});
    } catch (_) {
      return defaultAvatarSettings();
    }
  }

  function saveAvatarSettings() {
    if (!state.avatarSettings) return;
    persistSetting(AVATAR_SETTINGS_KEY, state.avatarSettings);
  }

  function applyAvatarSettings() {
    if (!state.avatarSettings) return;
    state.avatarSettings.avatarScale = Math.min(1.8, Math.max(0.55, Number(state.avatarSettings.avatarScale) || 1));
    state.avatarSettings.bubbleScale = Math.min(1.8, Math.max(0.55, Number(state.avatarSettings.bubbleScale) || 1));
    state.avatarSettings.headGapPx = Math.round(Math.min(160, Math.max(-80, Number(state.avatarSettings.headGapPx) || 0)));
    state.avatarSettings.bubbleGapPx = Math.round(Math.min(220, Math.max(-80, Number(state.avatarSettings.bubbleGapPx) || 0)));
    state.avatarSettings.subaccountAutoJoin = state.avatarSettings.subaccountAutoJoin !== false;
    state.avatarSettings.hideSubaccount = !!state.avatarSettings.hideSubaccount;
    document.documentElement.style.setProperty("--avatar-ui-scale", String(state.avatarSettings.avatarScale));
    document.documentElement.style.setProperty("--bubble-ui-scale", String(state.avatarSettings.bubbleScale));
    document.documentElement.style.setProperty("--bubble-card-gap-px", `${state.avatarSettings.bubbleGapPx}px`);
    if (avatarHeadGap) avatarHeadGap.value = String(state.avatarSettings.headGapPx);
    if (bubbleCardGap) bubbleCardGap.value = String(state.avatarSettings.bubbleGapPx);
    if (subaccountToggle) {
      subaccountToggle.textContent = state.avatarSettings.hideSubaccount ? "sub show" : "sub hide";
      subaccountToggle.classList.toggle("active", state.avatarSettings.hideSubaccount);
      subaccountToggle.title = state.avatarSettings.hideSubaccount ? "부계정 캐릭터 보이기" : "부계정 캐릭터 숨기기";
    }
    if (subaccountAutoToggle) {
      subaccountAutoToggle.textContent = state.avatarSettings.subaccountAutoJoin ? "auto on" : "auto off";
      subaccountAutoToggle.classList.toggle("active", state.avatarSettings.subaccountAutoJoin);
      subaccountAutoToggle.title = state.avatarSettings.subaccountAutoJoin
        ? "부계정 리시버 자동 입장 끄기"
        : "부계정 리시버 자동 입장 켜기";
    }
    window.dispatchEvent(new CustomEvent("tg-subaccount-toggle-state", {
      detail: { hidden: state.avatarSettings.hideSubaccount },
    }));
    window.dispatchEvent(new CustomEvent("tg-subaccount-auto-join-state", {
      detail: { enabled: state.avatarSettings.subaccountAutoJoin },
    }));
    renderParticipants();
  }

  function setSubaccountHidden(hidden) {
    if (!state.avatarSettings) return false;
    const previous = !!state.avatarSettings.hideSubaccount;
    const next = !!hidden;
    if (previous === next) return previous;
    state.avatarSettings.hideSubaccount = next;
    applyAvatarSettings();
    if (previous && !next) {
      for (const p of displayedParticipants().filter(isSubaccountParticipant)) {
        showParticipantEntryToast(p);
      }
    }
    saveAvatarSettings();
    return state.avatarSettings.hideSubaccount;
  }

  function toggleSubaccountHidden() {
    return setSubaccountHidden(!state.avatarSettings?.hideSubaccount);
  }

  function setSubaccountAutoJoin(enabled) {
    if (!state.avatarSettings) return true;
    const next = !!enabled;
    if (state.avatarSettings.subaccountAutoJoin === next) return next;
    state.avatarSettings.subaccountAutoJoin = next;
    applyAvatarSettings();
    saveAvatarSettings();
    return state.avatarSettings.subaccountAutoJoin;
  }

  function toggleSubaccountAutoJoin() {
    return setSubaccountAutoJoin(!(state.avatarSettings?.subaccountAutoJoin !== false));
  }

  window.tgVideochatOverlay = Object.assign(window.tgVideochatOverlay || {}, {
    setSubaccountHidden,
    toggleSubaccountHidden,
    isSubaccountHidden: () => !!state.avatarSettings?.hideSubaccount,
    setSubaccountAutoJoin,
    toggleSubaccountAutoJoin,
    isSubaccountAutoJoinEnabled: () => state.avatarSettings?.subaccountAutoJoin !== false,
  });

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
    const updateHeadGap = () => {
      state.avatarSettings.headGapPx = Number(avatarHeadGap.value);
      applyAvatarSettings();
      saveAvatarSettings();
    };
    const updateBubbleGap = () => {
      state.avatarSettings.bubbleGapPx = Number(bubbleCardGap.value);
      applyAvatarSettings();
      saveAvatarSettings();
    };
    avatarHeadGap?.addEventListener("input", updateHeadGap);
    avatarHeadGap?.addEventListener("change", updateHeadGap);
    bubbleCardGap?.addEventListener("input", updateBubbleGap);
    bubbleCardGap?.addEventListener("change", updateBubbleGap);
    avatarHeadGap?.addEventListener("keydown", (ev) => ev.stopPropagation());
    bubbleCardGap?.addEventListener("keydown", (ev) => ev.stopPropagation());
    subaccountToggle?.addEventListener("click", () => {
      toggleSubaccountHidden();
    });
    subaccountAutoToggle?.addEventListener("click", () => {
      toggleSubaccountAutoJoin();
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
      return Object.assign(defaultEffectSettings(), raw ? JSON.parse(raw) : {}, settingSection("effect") || {});
    } catch (_) {
      return defaultEffectSettings();
    }
  }

  function saveEffectSettings() {
    if (!state.effectSettings) return;
    persistSetting(EFFECT_SETTINGS_KEY, state.effectSettings);
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
    async function saveFireCooldown() {
      try {
        await fetch("/api/fire/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_cooldown_sec: Number(fireUserCooldown?.value || 0),
            global_cooldown_sec: Number(fireGlobalCooldown?.value || 0),
          }),
        });
      } catch (_) {}
    }
    fireUserCooldown?.addEventListener("change", saveFireCooldown);
    fireGlobalCooldown?.addEventListener("change", saveFireCooldown);
    fireUserCooldown?.addEventListener("keydown", (ev) => ev.stopPropagation());
    fireGlobalCooldown?.addEventListener("keydown", (ev) => ev.stopPropagation());
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

  function setupChatSender() {
    refreshSendStatus();
    setInterval(refreshSendStatus, 2500);
    for (const btn of chatSendTargets) {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        btn.classList.toggle("active");
        updateSendButton();
      });
    }
    chatSendText?.addEventListener("input", () => {
      if (!chatSendText.value) state.customEmojiEntities = [];
      else reconcileCustomEmojiEntities();
      updateComposerPreview();
      updateSendButton();
      scheduleMentionSearch();
    });
    chatSendText?.addEventListener("keydown", (ev) => {
      if (!mentionMenu.hidden && ev.key === "Enter") {
        if (chooseSelectedMention()) {
          ev.preventDefault();
          return;
        }
      }
      if (!mentionMenu.hidden && ev.key === "Tab") {
        if (chooseSelectedMention()) {
          ev.preventDefault();
          return;
        }
      }
      if (!mentionMenu.hidden && ev.key === "ArrowDown" && moveMentionSelection(1)) {
        ev.preventDefault();
        return;
      }
      if (!mentionMenu.hidden && ev.key === "ArrowUp" && moveMentionSelection(-1)) {
        ev.preventDefault();
        return;
      }
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        chatSendPanel?.requestSubmit();
      }
    });
    chatSendFile?.addEventListener("change", () => setSendPhoto(chatSendFile.files?.[0]));
    chatSendEmojiButton?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (Date.now() < state.emojiPickerSuppressClickUntil) return;
      if (state.emojiPicker && !state.emojiPicker.hidden) hideEmojiPicker(true);
      else showEmojiPicker();
    });
    chatSendPreviewClear?.addEventListener("click", clearSendPhoto);
    chatReplyPreviewClear?.addEventListener("click", clearSendReply);
    chatSendPanel?.addEventListener("dragover", (ev) => ev.preventDefault());
    chatSendPanel?.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const file = Array.from(ev.dataTransfer?.files || []).find(isSupportedSendFile);
      setSendPhoto(file);
    });
    chatSendPanel?.addEventListener("paste", (ev) => {
      const file = Array.from(ev.clipboardData?.items || [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .find((f) => f && isSupportedSendFile(f));
      if (file) setSendPhoto(file);
    });
    chatSendPanel?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (state.sendInFlight) return;
      const text = chatSendText?.value || "";
      const targets = selectedSendTargets();
      if ((!text.trim() && !state.selectedPhoto && !state.selectedSticker && !state.selectedCustomEmoji) || (!state.replyTo && !targets.length)) return;
      state.sendInFlight = true;
      updateSendButton();
      try {
        await sendOverlayMessage(text, targets, state.selectedPhoto, state.replyTo);
        chatSendText.value = "";
        state.customEmojiEntities = [];
        updateComposerPreview();
        clearSendPhoto();
        clearSendReply();
      } finally {
        state.sendInFlight = false;
        updateSendButton();
        chatSendText?.focus();
      }
    });
    chatMenuReply?.addEventListener("click", () => {
      if (state.menuTarget) setSendReply(state.menuTarget.data);
      hideChatMessageMenu();
    });
    chatMenuQuote?.addEventListener("click", () => {
      if (state.menuTarget?.quoteText) setSendReply(state.menuTarget.data, state.menuTarget.quoteText);
      hideChatMessageMenu();
    });
    chatMenuDelete?.addEventListener("click", async () => {
      const target = state.menuTarget;
      hideChatMessageMenu();
      if (!target) return;
      await deleteOverlayMessage(target.data.message);
      removeChatLineElement(target.el);
    });
    document.addEventListener("click", () => {
      hideChatMessageMenu();
      hideMentionMenu();
      hideEmojiPicker(true);
    });
    chatLog?.addEventListener("contextmenu", (ev) => {
      showChatMessageMenuFromEvent(ev);
    }, true);
    chatLog?.addEventListener("mousedown", (ev) => {
      if (ev.button === 2 && showChatMessageMenuFromEvent(ev)) {
        ev.preventDefault();
      }
    }, true);
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("input, textarea, select, button, [contenteditable='true'], #chat-panel, .overlay-widget");
  }

  function isTextInputTarget(target) {
    if (!(target instanceof Element)) return false;
    return !!target.closest("input, textarea, select, [contenteditable='true'], #chat-panel");
  }

  function blurEditableFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("input, textarea, select, button, [contenteditable='true']")) {
      active.blur();
    }
    hideMentionMenu();
  }

  function replaceToastTokens(value, tokens = {}) {
    return String(value).replace(/\{([a-z_]+)\}/gi, (match, key) => {
      const normalized = String(key || "").toLowerCase();
      if (normalized === "name") return match;
      if (!Object.prototype.hasOwnProperty.call(tokens, normalized)) return match;
      const tokenValue = tokens[normalized];
      return tokenValue === undefined || tokenValue === null ? "" : String(tokenValue);
    });
  }

  function toastMessageParts(template, name, fallback, tokens = {}) {
    const displayName = String(name || "누군가");
    const value = replaceToastTokens(String(template || fallback || "{name}").trim() || fallback || "{name}", tokens);
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
      levelUpTemplate: LEVEL_UP_TEMPLATE_DEFAULT,
      levelDownTemplate: LEVEL_DOWN_TEMPLATE_DEFAULT,
    };
  }

  function loadToastSettings() {
    try {
      const raw = localStorage.getItem(TOAST_SETTINGS_KEY);
      const settings = Object.assign(defaultToastSettings(), raw ? JSON.parse(raw) : {}, settingSection("toast") || {});
      if (settings.levelUpTemplate === "{name} 레벨 업 Lv. {old_level} → {new_level}") {
        settings.levelUpTemplate = LEVEL_UP_TEMPLATE_DEFAULT;
      }
      return settings;
    } catch (_) {
      return defaultToastSettings();
    }
  }

  function saveToastSettings() {
    if (!state.toastSettings) return;
    persistSetting(TOAST_SETTINGS_KEY, state.toastSettings);
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
    s.levelUpTemplate = String(s.levelUpTemplate || LEVEL_UP_TEMPLATE_DEFAULT);
    s.levelDownTemplate = String(s.levelDownTemplate || LEVEL_DOWN_TEMPLATE_DEFAULT);
    if (toastStyle) toastStyle.value = s.style;
    if (entryMessageTemplate) entryMessageTemplate.value = s.entryTemplate;
    if (exitMessageTemplate) exitMessageTemplate.value = s.exitTemplate;
    if (levelUpMessageTemplate) levelUpMessageTemplate.value = s.levelUpTemplate;
    if (levelDownMessageTemplate) levelDownMessageTemplate.value = s.levelDownTemplate;
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
    levelUpMessageTemplate?.addEventListener("input", () => {
      state.toastSettings.levelUpTemplate = levelUpMessageTemplate.value;
      applyToastSettings();
      saveToastSettings();
    });
    levelDownMessageTemplate?.addEventListener("input", () => {
      state.toastSettings.levelDownTemplate = levelDownMessageTemplate.value;
      applyToastSettings();
      saveToastSettings();
    });
    entryMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
    exitMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
    levelUpMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
    levelDownMessageTemplate?.addEventListener("keydown", (ev) => ev.stopPropagation());
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
      positionEmojiPicker();
      saveToastSettings();
    });
  }

  function applyOverlaySettings(settings, clientId = "") {
    if (!settings || typeof settings !== "object") return;
    if (clientId && clientId === state.clientId) return;
    const nextSettings = adaptOverlaySettings(settings);
    state.overlaySettings = nextSettings;
    state.remoteApplying = true;
    try {
      if (nextSettings.chat && state.chatSettings) {
        Object.assign(state.chatSettings, nextSettings.chat);
        applyChatSettings();
        storageSet(CHAT_SETTINGS_KEY, JSON.stringify(state.chatSettings));
      }
      if (nextSettings.topic && state.topicSettings) {
        Object.assign(state.topicSettings, nextSettings.topic);
        refreshTopicLayout(topicEditor?.classList.contains("editing"));
        storageSet(TOPIC_SETTINGS_KEY, JSON.stringify(state.topicSettings));
      }
      if (nextSettings.avatar && state.avatarSettings) {
        Object.assign(state.avatarSettings, nextSettings.avatar);
        applyAvatarSettings();
        storageSet(AVATAR_SETTINGS_KEY, JSON.stringify(state.avatarSettings));
      }
      if (nextSettings.effect && state.effectSettings) {
        Object.assign(state.effectSettings, nextSettings.effect);
        applyEffectSettings();
        storageSet(EFFECT_SETTINGS_KEY, JSON.stringify(state.effectSettings));
      }
      if (nextSettings.toast && state.toastSettings) {
        Object.assign(state.toastSettings, nextSettings.toast);
        applyToastSettings();
        storageSet(TOAST_SETTINGS_KEY, JSON.stringify(state.toastSettings));
      }
      if (nextSettings.streamPreview && state.streamPreviewSettings) {
        Object.assign(state.streamPreviewSettings, nextSettings.streamPreview, {
          viewer: Object.assign(
            state.streamPreviewSettings.viewer || {},
            nextSettings.streamPreview.viewer || {}
          ),
        });
        applyStreamPreviewSettings(true);
        storageSet(STREAM_PREVIEW_SETTINGS_KEY, JSON.stringify(state.streamPreviewSettings));
      }
      if (nextSettings.widgets && state.widgetSettings) {
        const { game: incomingGame, ...incomingWidgets } = nextSettings.widgets;
        const localGame = state.widgetSettings.game || {};
        const localGameProtected = Date.now() < (state.gameLocalOverrideUntil || 0);
        const localClosedAt = Math.max(
          Number(state.gameLocalClosedAt || 0),
          Number(localGame.closedAt || 0)
        );
        const incomingClosedAt = Number(incomingGame?.closedAt || 0);
        const incomingReopensClosedGame = !!incomingGame?.open && localClosedAt > 0 && incomingClosedAt < localClosedAt;
        const incomingGameFresh = !localGameProtected && (
          !incomingReopensClosedGame &&
          (!localClosedAt || incomingClosedAt >= localClosedAt)
        );
        Object.assign(state.widgetSettings, incomingWidgets, {
          controls: Object.assign(state.widgetSettings.controls || {}, incomingWidgets.controls || {}),
          price: Object.assign(state.widgetSettings.price || {}, incomingWidgets.price || {}),
          youtube: Object.assign(state.widgetSettings.youtube || {}, incomingWidgets.youtube || {}),
          electronBrowser: Object.assign(state.widgetSettings.electronBrowser || {}, incomingWidgets.electronBrowser || {}),
          game: normalizeGameWidget(Object.assign(
            localGame,
            incomingGameFresh ? (incomingGame || {}) : {}
          )),
          memos: Array.isArray(incomingWidgets.memos) ? incomingWidgets.memos : state.widgetSettings.memos,
          browsers: Array.isArray(incomingWidgets.browsers) ? incomingWidgets.browsers : state.widgetSettings.browsers,
        });
        applyWidgetSettings();
        storageSet(WIDGET_SETTINGS_KEY, JSON.stringify(state.widgetSettings));
        refreshPriceWidget(false);
      }
      if (nextSettings.camera) {
        applyCameraControl({ type: "videochat_camera", ...nextSettings.camera });
      }
    } finally {
      state.remoteApplying = false;
    }
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
  setupStreamPreviewControls();
  setupWidgetControls();
  if (state.controlMode) scheduleOverlaySettingsPush(300);

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

  function rolesOf(value) {
    const out = [];
    const add = (role) => {
      const normalized = String(role || "").trim().toLowerCase();
      if (normalized && !out.includes(normalized)) out.push(normalized);
    };
    if (!value || typeof value !== "object") return out;
    if (Array.isArray(value.roles)) {
      value.roles.forEach(add);
    } else if (typeof value.roles === "string") {
      value.roles.split(/[,\s;]+/).forEach(add);
    }
    if (typeof value.role === "string") value.role.split(/[,\s;]+/).forEach(add);
    if (value.is_host) add("king");
    if (value.is_bot) add("bot");
    return out;
  }

  function hasRole(value, role) {
    return rolesOf(value).includes(String(role || "").trim().toLowerCase());
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

  function speakerKey(data, useVideochatAlias = false) {
    const source = useVideochatAlias && data.videochat_alias ? data.videochat_alias : data;
    const id = String(source.speaker_id || source.id || "");
    if (id && state.participants.has(id)) return id;
    const username = String(source.username || "").replace(/^@/, "");
    if (username) {
      for (const p of state.participants.values()) {
        if (String(p.username || "").toLowerCase() === username.toLowerCase()) {
          return keyFor(p);
        }
      }
    }
    const name = String(source.name || "");
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
        z: Math.sin(a) * radius + CAMPFIRE_CENTER.z + jitterR * 0.14,
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

  function jailWorldPosition(index, count, key = "") {
    const safeCount = Math.max(1, Number(count) || 1);
    const center = realJailCenter();
    const randA = ((hashString(`${key}:jail:a`) % 1000) / 1000 - 0.5);
    const randB = ((hashString(`${key}:jail:b`) % 1000) / 1000 - 0.5);
    let localX = 0;
    let localZ = 0;
    if (safeCount <= 10) {
      const radius = Math.sqrt((index + 0.5) / safeCount);
      const angle = index * 2.39996323 + randA * 0.58;
      localX = Math.cos(angle) * radius * 0.98 + randA * 0.1;
      localZ = Math.sin(angle) * radius * 0.74 + randB * 0.08;
    } else {
      const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.28))));
      const rows = Math.max(1, Math.ceil(safeCount / cols));
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cellW = 2.18 / cols;
      const cellZ = 1.62 / rows;
      localX = -1.09 + cellW * (col + 0.5) + randA * cellW * 0.48;
      localZ = -0.81 + cellZ * (row + 0.5) + randB * cellZ * 0.48;
    }
    localX = Math.min(1.12, Math.max(-1.12, localX));
    localZ = Math.min(0.84, Math.max(-0.84, localZ));
    const yaw = realJailYaw();
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const x = center.x + localX * cos + localZ * sin;
    const z = center.z - localX * sin + localZ * cos;
    return {
      x,
      z,
      a: Math.atan2(center.x - x, center.z - z),
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

  function avatarScreenTop(screenPoint, count) {
    const headGapPx = Number(state.avatarSettings?.headGapPx) || 0;
    return screenPoint.y - avatarScreenLift(count) - headGapPx;
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
      <div class="bubble-stack"></div>
      <div class="identity-card">
        <div class="crown"><span></span><span></span><span></span></div>
        <div class="girl-heart" aria-hidden="true">
          <svg viewBox="0 0 64 58" focusable="false">
            <path class="heart-fill" d="M32 53C20.5 43.5 7 31.7 7 19.1 7 11 12.9 5.5 20.3 5.5c4.8 0 9.1 2.7 11.7 6.8 2.6-4.1 6.9-6.8 11.7-6.8C51.1 5.5 57 11 57 19.1 57 31.7 43.5 43.5 32 53Z"></path>
            <ellipse class="heart-spark" cx="22" cy="15" rx="6" ry="3.3" transform="rotate(-30 22 15)"></ellipse>
          </svg>
        </div>
        <div class="entering-badge">입장중</div>
        <div class="portrait"><span class="initial"></span></div>
        <div class="text-stack">
          <div class="name"></div>
          <div class="level"></div>
        </div>
        <div class="status"></div>
        <div class="broadcast-badge" aria-hidden="true">
          <span class="broadcast-icon"></span>
          <span class="broadcast-label">LIVE</span>
        </div>
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

  function facePointYawOnly(group, x, z, centerX = CAMPFIRE_CENTER.x, centerZ = CAMPFIRE_CENTER.z) {
    group.rotation.set(0, Math.atan2(centerX - x, centerZ - z), 0);
  }

  function setChildWorldPose(child, parent, worldPosition, worldQuaternion = null) {
    parent.updateMatrixWorld(true);
    child.position.copy(parent.worldToLocal(worldPosition.clone()));
    const parentQuat = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    child.quaternion.copy(parentQuat);
    if (worldQuaternion) child.quaternion.multiply(worldQuaternion);
  }

  function entryDurationForMode(mode) {
    if (mode === "drop") return 2100;
    if (mode === "fade") return 1200;
    if (mode === "none") return 1;
    return 3200;
  }

  function exitDurationForMode(mode) {
    if (mode === "none") return 1;
    if (mode === "fade") return 1400;
    return 2600;
  }

  function isEntryStillVisible(group, now = performance.now()) {
    if (!group || group.userData.enterDone) return false;
    const mode = group.userData.entryEffect || "drop";
    const start = group.userData.enterStartedAt || now;
    return now - start < entryDurationForMode(mode);
  }

  function beginCharacterLeave(key, group, now = performance.now()) {
    if (!group || group.userData.leavingUntil) return;
    if (isEntryStillVisible(group, now)) {
      group.userData.pendingLeave = true;
      return;
    }
    group.userData.prisonKind = prisonKindForKey(key) || group.userData.prisonKind || "";
    group.userData.prisonScale = characterPrisonScale(key);
    if (group.userData.prisonKind !== "real") {
      removePrisonAssignments(key, { save: true, render: false });
    }
    const mode = state.effectSettings?.exitEffect || "ascend";
    const duration = exitDurationForMode(mode);
    const lift = mode === "ascend" ? 1.9 : 0.35;
    group.userData.pendingLeave = false;
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

  function showParticipantEntryToast(p) {
    if (!p) return;
    showEventToast(
      toastMessageParts(state.toastSettings?.entryTemplate, eventDisplayName(p.name || p.username), "{name} \uB4F1\uC7A5"),
      "enter",
      participantColor(p)
    );
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
    const isGirl = hasRole(p, "girl");

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.46, 5, 12),
      new THREE.MeshStandardMaterial({ color: isGirl ? cloth.clone().lerp(new THREE.Color(0xff7ec8), 0.32) : cloth, roughness: 0.72 })
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

    if (isGirl) {
      hair.material.color.setHex(0x2a1426);
      const hairBack = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2, 0.62, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0x261421, roughness: 0.82 })
      );
      hairBack.position.set(0, 0.9, -0.13);
      hairBack.scale.set(1.28, 1, 0.76);
      group.add(hairBack);

      const strandGeo = new THREE.CapsuleGeometry(0.055, 0.56, 5, 10);
      const strandMat = new THREE.MeshStandardMaterial({ color: 0x2b1628, roughness: 0.82 });
      const strandL = new THREE.Mesh(strandGeo, strandMat);
      const strandR = new THREE.Mesh(strandGeo, strandMat);
      strandL.position.set(-0.2, 0.9, 0.13);
      strandR.position.set(0.2, 0.9, 0.13);
      strandL.rotation.z = -0.1;
      strandR.rotation.z = 0.1;
      group.add(strandL, strandR);

      const dress = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.5, 0.68, 24),
        new THREE.MeshStandardMaterial({
          color: cloth.clone().lerp(new THREE.Color(0xff5fb8), 0.66),
          roughness: 0.68,
        })
      );
      dress.position.y = 0.46;
      dress.scale.set(0.92, 1, 0.82);
      group.add(dress);

      const headband = new THREE.Mesh(
        new THREE.TorusGeometry(0.235, 0.014, 8, 28),
        new THREE.MeshStandardMaterial({
          color: 0xffd6ef,
          emissive: 0x5c2448,
          emissiveIntensity: 0.16,
          roughness: 0.42,
        })
      );
      headband.position.set(0, 1.2, 0.015);
      headband.rotation.x = Math.PI / 2;
      headband.scale.set(1, 0.72, 1);
      group.add(headband);

    } else {
      const tieMat = new THREE.MeshStandardMaterial({
        color: p.is_host ? 0xff4b5f : 0x17223f,
        emissive: p.is_host ? 0x3c0712 : 0x000000,
        emissiveIntensity: p.is_host ? 0.12 : 0,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });

      const knotShape = new THREE.Shape();
      knotShape.moveTo(0, 0.055);
      knotShape.lineTo(0.065, 0);
      knotShape.lineTo(0, -0.06);
      knotShape.lineTo(-0.065, 0);
      knotShape.lineTo(0, 0.055);
      const tieKnot = new THREE.Mesh(
        new THREE.ExtrudeGeometry(knotShape, { depth: 0.018, bevelEnabled: false }),
        tieMat
      );
      tieKnot.position.set(0, 0.86, 0.282);
      group.add(tieKnot);

      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-0.052, 0.09);
      bladeShape.lineTo(0.052, 0.09);
      bladeShape.lineTo(0.083, -0.07);
      bladeShape.lineTo(0.035, -0.235);
      bladeShape.lineTo(0, -0.315);
      bladeShape.lineTo(-0.035, -0.235);
      bladeShape.lineTo(-0.083, -0.07);
      bladeShape.lineTo(-0.052, 0.09);
      const tieBlade = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bladeShape, { depth: 0.016, bevelEnabled: false }),
        tieMat
      );
      tieBlade.position.set(0, 0.76, 0.286);
      group.add(tieBlade);

    }

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

    if (hasRole(p, "girl")) {
      const heart = new THREE.Group();
      const heartShape = new THREE.Shape();
      heartShape.moveTo(0, 0.055);
      heartShape.bezierCurveTo(-0.085, 0.145, -0.22, 0.055, -0.128, -0.07);
      heartShape.bezierCurveTo(-0.075, -0.142, -0.02, -0.18, 0, -0.215);
      heartShape.bezierCurveTo(0.02, -0.18, 0.075, -0.142, 0.128, -0.07);
      heartShape.bezierCurveTo(0.22, 0.055, 0.085, 0.145, 0, 0.055);
      const heartMat = new THREE.MeshStandardMaterial({
        color: 0xff72c6,
        emissive: 0x691447,
        emissiveIntensity: 0.2,
        roughness: 0.46,
        side: THREE.DoubleSide,
      });
      const heartMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(heartShape, { depth: 0.028, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1 }),
        heartMat
      );
      heartMesh.scale.set(0.42, 0.42, 0.42);
      heartMesh.position.set(0.17, 1.36, 0.205);
      heartMesh.rotation.z = -0.18;
      heart.add(heartMesh);

      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xffa7db,
        emissive: 0x421032,
        emissiveIntensity: 0.12,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      const tailL = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 3), tailMat);
      const tailR = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 3), tailMat);
      tailL.position.set(0.13, 1.27, 0.205);
      tailR.position.set(0.2, 1.27, 0.205);
      tailL.rotation.set(0, 0, 2.78);
      tailR.rotation.set(0, 0, -2.78);
      heart.add(tailL, tailR);
      group.add(heart);
    }

    const armGeo = new THREE.CapsuleGeometry(0.055, 0.32, 4, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
    const armL = new THREE.Mesh(armGeo, armMat);
    const armR = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.33, 0.69, 0.06);
    armR.position.set(0.33, 0.69, 0.06);
    armL.rotation.set(0.14, 0, -0.56);
    armR.rotation.set(0.14, 0, 0.56);
    group.userData.arms = {
      left: armL,
      right: armR,
      leftBase: armL.rotation.clone(),
      rightBase: armR.rotation.clone(),
    };
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

    group.traverse((obj) => {
      if (obj.material?.color && !obj.material.userData.originalColor) {
        obj.material.userData.originalColor = obj.material.color.clone();
      }
    });
    attachCheerRig(group, key);
    state.three.scene.add(group);
    state.characters.set(key, group);
    return group;
  }

  function removeMissingCharacters(liveKeys) {
    const now = performance.now();
    for (const [key, group] of state.characters) {
      if (!liveKeys.has(key) && !group.userData.leavingUntil) {
        beginCharacterLeave(key, group, now);
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
    const allRows = Array.from(state.participants.values());
    const rows = allRows.filter((p) => !shouldHideSubaccountParticipant(p));
    rows.sort((a, b) => Number(b.is_host || 0) - Number(a.is_host || 0) || String(a.name).localeCompare(String(b.name)));
    assignParticipantColors(rows);
    participantLayer.classList.toggle("crowd", rows.length >= 20);
    participantLayer.classList.toggle("packed", rows.length >= 40);
    const liveKeys = new Set(rows.map(keyFor));
    if (state.hasSnapshot) removeMissingCharacters(liveKeys);
    const prisonChanged = state.hasSnapshot ? prunePrisonAssignments(liveKeys) : false;
    const placementChanged = state.hasSnapshot ? pruneCharacterPlacements(liveKeys) : false;
    if (prisonChanged || placementChanged) saveWidgetSettings();
    const realRows = rows.filter((p) => isRealJailed(keyFor(p)));
    const normalRows = rows.filter((p) => !isRealJailed(keyFor(p)) && !hasCharacterPlacement(keyFor(p)));
    const realIndexByKey = new Map(realRows.map((p, index) => [keyFor(p), index]));
    const normalIndexByKey = new Map(normalRows.map((p, index) => [keyFor(p), index]));
    const holdingLayout = state.leaving.size > 0;

    rows.forEach((p, i) => {
      const key = keyFor(p);
      const char = state.characters.get(key) || createCharacter(p);
      const prisonKind = prisonKindForKey(key);
      const realJailed = prisonKind === "real";
      const customPlacement = characterPlacementForKey(key);
      const manuallyPlaced = !!customPlacement;
      const prisonScale = characterPrisonScale(key);
      const targetRows = realJailed ? realRows : normalRows;
      const targetIndexByKey = realJailed ? realIndexByKey : normalIndexByKey;
      const wasLeaving = !!char.userData.leavingUntil;
      if (wasLeaving) {
        char.userData.leavingUntil = 0;
        char.userData.pendingLeave = false;
        char.userData.enterStartedAt = performance.now();
        char.userData.enterFrom = null;
        char.userData.enterDone = false;
        char.userData.entryEffect = state.effectSettings?.entryEffect || "drop";
        state.leaving.delete(key);
      }
      char.userData.participant = p;
      const samePrisonKind = (char.userData.prisonKind || "") === prisonKind;
      const preserveLayout = holdingLayout && samePrisonKind && Number.isFinite(char.userData.layoutIndex) && Number.isFinite(char.userData.layoutCount);
      const layoutIndex = manuallyPlaced
        ? (realJailed ? (targetIndexByKey.get(key) ?? i) : i)
        : (preserveLayout ? char.userData.layoutIndex : (targetIndexByKey.get(key) ?? i));
      const layoutCount = manuallyPlaced
        ? (realJailed ? Math.max(1, targetRows.length || rows.length) : Math.max(1, rows.length))
        : (preserveLayout ? char.userData.layoutCount : Math.max(1, targetRows.length || rows.length));
      const wp = manuallyPlaced
        ? (characterPlacementWorldPosition(key, customPlacement) || (realJailed ? jailWorldPosition(layoutIndex, layoutCount, key) : layoutWorld(layoutIndex, layoutCount, key)))
        : (realJailed ? jailWorldPosition(layoutIndex, layoutCount, key) : layoutWorld(layoutIndex, layoutCount, key));
      const target = new THREE.Vector3(wp.x, 0, wp.z);
      if (!char.userData.enterDone && !char.userData.enterFrom) {
        const mode = realJailed ? "drop" : (char.userData.entryEffect || state.effectSettings?.entryEffect || "drop");
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
      if (Number.isFinite(wp.yaw)) char.rotation.set(0, wp.yaw, 0);
      else facePointYawOnly(char, wp.x, wp.z);
      char.userData.target = target;
      char.userData.layout = wp;
      char.userData.layoutIndex = layoutIndex;
      char.userData.layoutCount = layoutCount;
      char.userData.prisonKind = prisonKind;
      char.userData.prisonScale = prisonScale;
      if (realJailed) {
        char.userData.fireHopUntil = 0;
        char.userData.levelEffectKind = "";
        char.userData.levelEffectStart = 0;
        if (char.userData.cheerRig) char.userData.cheerRig.until = 0;
      }
      char.userData.leavingUntil = 0;
      state.leaving.delete(key);

      const el = ensureAvatar(p);
      el.classList.toggle("entering", !char.userData.enterDone);
      const anchor = (!char.userData.enterDone && char.userData.target)
        ? char.userData.target.clone()
        : char.position.clone();
      anchor.y = avatarAnchorY(layoutCount) * prisonScale;
      const sp = screenFromWorld(anchor);
      el.style.left = `${sp.x}px`;
      el.style.top = `${avatarScreenTop(sp, layoutCount)}px`;
      el.style.zIndex = el.classList.contains("speaking")
        ? (el.dataset.speechZ || "22000")
        : (!char.userData.enterDone ? "21000" : String(Math.round(sp.y)));
      el.classList.remove("leaving");
      el.style.opacity = "";
      el.style.filter = "";
      el.classList.toggle("muted", !!p.muted);
      el.classList.toggle("host", !!p.is_host);
      el.classList.toggle("role-girl", hasRole(p, "girl"));
      el.classList.toggle("video-on", !!p.video);
      el.classList.toggle("screen-on", !!p.screen);
      el.classList.toggle("broadcasting", !!p.video || !!p.screen);
      el.classList.toggle("has-photo", !!p.avatar_url);
      el.classList.toggle("no-photo", !p.avatar_url);
      el.classList.toggle("mini-prisoner", prisonKind === "mini");
      el.classList.toggle("real-prisoner", realJailed);
      el.style.setProperty("--avatar-prison-scale", String(prisonScale));
      el.style.setProperty("--avatar-speaking-prison-scale", String(realJailed ? prisonScale : prisonScale * 1.06));
      const broadcastBadge = el.querySelector(".broadcast-badge");
      const broadcastLabel = broadcastBadge?.querySelector(".broadcast-label");
      if (broadcastBadge && broadcastLabel) {
        const label = p.screen ? "SCREEN" : "LIVE";
        const title = p.screen ? "화면 공유 중" : p.video ? "카메라 방송 중" : "방송 없음";
        broadcastLabel.textContent = label;
        broadcastBadge.title = title;
        broadcastBadge.setAttribute("aria-label", title);
      }
      const levelsEnabled = p.level_system_enabled !== false && state.cfg.level_system_enabled !== false;
      const levelValue = levelsEnabled ? (p.is_host ? 99 : Number(p.level || 0)) : NaN;
      const hasLevelValue = levelsEnabled && (p.is_host || Number.isFinite(levelValue));
      const tier = levelTier(levelValue, !!p.is_host);
      const levelText = levelsEnabled ? String(p.level_label || (hasLevelValue ? `Lv. ${levelValue}` : "")).trim() : "";
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
      const layoutCount = Number(group.userData.layoutCount) || rows.length;
      const prisonScale = Number(group.userData.prisonScale) || 1;
      anchor.y = avatarAnchorY(layoutCount) * prisonScale + 0.2 * prisonScale;
      const sp = screenFromWorld(anchor);
      const start = group.userData.leavingStartedAt || now;
      const progress = clamp((now - start) / Math.max(1, leave.until - start), 0, 1);
      leave.screen = sp;
      el.style.left = `${sp.x}px`;
      el.style.top = `${avatarScreenTop(sp, layoutCount)}px`;
      el.style.zIndex = String(20500);
      el.classList.add("leaving");
      el.style.opacity = String(Math.max(0, 1 - progress * 0.86));
      el.style.filter = `brightness(${1 + (1 - progress) * 0.35}) drop-shadow(0 0 ${Math.round(18 + (1 - progress) * 18)}px rgba(235,248,255,${0.38 * (1 - progress)}))`;
    }
    renderStreamPreviews();
    if (prisonChanged) refreshOpenPrisonWidgets();
    if (placementChanged) refreshOpenCharacterMoveWidget();
  }

  function setSnapshot(data) {
    const initialSnapshot = !state.hasSnapshot;
    const previousKeys = new Set(state.participants.keys());
    const entrants = [];
    state.participants.clear();
    for (const p of data.participants || []) {
      const key = keyFor(p);
      state.participants.set(key, p);
      if (!initialSnapshot && !previousKeys.has(key) && !shouldHideSubaccountParticipant(p)) {
        state.pendingEntrants.add(key);
        entrants.push(p);
      }
    }
    const rows = displayedParticipants();
    rows.sort((a, b) => Number(b.is_host || 0) - Number(a.is_host || 0) || String(a.name).localeCompare(String(b.name)));
    assignParticipantColors(rows);
    for (const p of initialSnapshot ? rows : entrants) {
      showParticipantEntryToast(p);
    }
    state.hasSnapshot = true;
    renderParticipants();
    refreshOpenPrisonWidgets();
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
      const roles = isHost ? ["king"] : (i % 5 === 2 ? ["girl"] : []);
      const label = i === 1 ? "VeryLongNicknameForLayoutTest" : names[i % names.length];
      return {
        id: isHost ? state.cfg.host_user_id || "mock-host" : `mock-${i}`,
        username: isHost ? hostUsername : `mock_user_${String(i).padStart(2, "0")}`,
        name: isHost ? hostName : `${label} ${String(i).padStart(2, "0")}`,
        muted: !isHost && i % 4 !== 0,
        video: isHost || (!isHost && i % 6 === 1),
        screen: !isHost && i % 12 === 5,
        is_host: isHost,
        role: roles[0] || "",
        roles,
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
      const rows = displayedParticipants();
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

  function syncAvatarSpeechState(el) {
    const hasBubbles = !!el?.querySelector(".bubble-stack .bubble:not(.leaving)");
    el?.classList.toggle("speaking", hasBubbles);
    if (!hasBubbles && el) {
      delete el.dataset.bubbleMessageKey;
    }
  }

  function removeSpeechBubble(el, bubble) {
    if (!bubble || bubble.classList.contains("leaving")) return;
    bubble.classList.add("leaving");
    clearTimeout(bubble._removeTimer);
    setTimeout(() => {
      bubble.remove();
      syncAvatarSpeechState(el);
    }, 220);
  }

  function createSpeechBubble(data, type, isMedia) {
    const bubble = document.createElement("div");
    bubble.className = `bubble${isMedia ? " photo" : ""}${type === "sticker" ? " sticker" : ""}`;
    if (data.message?.chat_id && data.message?.message_id) {
      bubble.dataset.messageKey = `${data.message.chat_id}:${data.message.message_id}`;
    }
    const bubbleQuote = createReplyQuote(data.reply);
    if (bubbleQuote) bubble.appendChild(bubbleQuote);
    if (isMedia) {
      bubble.appendChild(createMediaElement(data));
      if (typeof data.text === "string" && data.text.trim()) {
        const caption = document.createElement("span");
        caption.className = "photo-caption";
        appendRichText(caption, data.text, { entities: data.entities || [] });
        bubble.appendChild(caption);
      }
    } else {
      appendRichText(bubble, data.text, { entities: data.entities || [] });
      if (data.stt_label) {
        const label = document.createElement("span");
        label.className = "stt-label";
        label.textContent = ` ${data.stt_label}`;
        bubble.appendChild(label);
      }
    }
    return bubble;
  }

  function showSpeech(data) {
    if (!data) return;
    const type = data.type || "text";
    if (type === "delete") {
      removeChatLineByRef(data.message);
      return;
    }
    const isMedia = type === "photo" || type === "sticker" || type === "animation";
    if (type !== "text" && !isMedia) return;
    if (type === "text" && typeof data.text !== "string") return;
    if (isMedia && !data.url) return;
    const chatKey = speakerKey(data, false);
    const key = speakerKey(data, true);
    addChatLine(data, !!chatKey);
    const effectCommand = String(data.text || "").trim().toLowerCase();
    if (type === "text" && /^\/(?:fire|cheer)(?:@\w+)?(?:\s|$)/.test(effectCommand)) {
      return;
    }
    if (type === "text") handleGameChatCommand(data);
    const el = key ? state.elements.get(key) : null;
    const char = key ? state.characters.get(key) : null;
    if (el) {
      const stack = el.querySelector(".bubble-stack");
      if (!stack) return;
      const bubble = createSpeechBubble(data, type, isMedia);
      if (data.message?.chat_id && data.message?.message_id) {
        el.dataset.bubbleMessageKey = `${data.message.chat_id}:${data.message.message_id}`;
      } else {
        delete el.dataset.bubbleMessageKey;
      }
      stack.appendChild(bubble);
      const visibleBubbles = Array.from(stack.children).filter((child) => !child.classList.contains("leaving"));
      while (visibleBubbles.length > 3) {
        removeSpeechBubble(el, visibleBubbles.shift());
      }
      const z = 22000 + (++state.speechOrder);
      el.dataset.speechZ = String(z);
      el.style.zIndex = String(z);
      el.classList.add("speaking");
      if (char) char.userData.speakingUntil = performance.now() + 7200;
      requestAnimationFrame(() => bubble.classList.add("show"));
      bubble._removeTimer = setTimeout(() => removeSpeechBubble(el, bubble), 7200);
    }
  }

  async function loadTgsSticker(container, url) {
    try {
      if (!window.lottie || !window.DecompressionStream) {
        container.textContent = "sticker";
        return;
      }
      const compressed = await fetch(url).then((r) => r.arrayBuffer());
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
      const json = await new Response(stream).text();
      window.lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: JSON.parse(json),
      });
    } catch (_) {
      container.textContent = "sticker";
    }
  }

  function sendVideochatControlEvent(payload) {
    try {
      if (state.videochatWs?.readyState === WebSocket.OPEN) {
        state.videochatWs.send(JSON.stringify({ type: "chat_control", client_id: state.clientId, ...payload }));
      }
    } catch (_) {}
  }

  function closeMediaLightbox(sync = true) {
    mediaLightbox.hidden = true;
    mediaLightboxBody.replaceChildren();
    if (sync) sendVideochatControlEvent({ action: "media_lightbox_close" });
  }

  function openMediaLightboxSource(src, tagName = "IMG", sync = true) {
    if (!src) return;
    const full = document.createElement(String(tagName).toUpperCase() === "VIDEO" ? "video" : "img");
    full.src = src;
    if (full.tagName === "VIDEO") {
      full.controls = true;
      full.autoplay = true;
      full.loop = true;
      full.muted = true;
      full.playsInline = true;
    } else {
      full.alt = "";
      full.decoding = "async";
    }
    mediaLightboxBody.replaceChildren(full);
    mediaLightbox.hidden = false;
    if (sync) sendVideochatControlEvent({ action: "media_lightbox_open", src, tag: full.tagName });
  }

  function openMediaLightbox(media, sync = true) {
    if (!media?.src) return;
    openMediaLightboxSource(media.src, media.tagName, sync);
  }

  mediaLightbox.addEventListener("click", closeMediaLightbox);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !mediaLightbox.hidden) closeMediaLightbox();
  });

  function chatLogIsAtBottom() {
    return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 48;
  }

  function scrollChatLogToBottom() {
    const settle = () => {
      chatLog.scrollTop = chatLog.scrollHeight;
      chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: "auto" });
    };
    requestAnimationFrame(settle);
    setTimeout(settle, 50);
  }

  function keepChatLogBottomAfterMediaLoad(media, shouldStickToBottom) {
    if (!shouldStickToBottom) return;
    const settle = () => scrollChatLogToBottom();
    media.addEventListener("load", settle, { once: true });
    media.addEventListener("loadedmetadata", settle, { once: true });
    media.addEventListener("loadeddata", settle, { once: true });
    setTimeout(settle, 120);
    setTimeout(settle, 500);
    setTimeout(settle, 1000);
    setTimeout(settle, 1800);
  }

  function createMediaElement(data) {
    if (data.media_type === "tgs") {
      const box = document.createElement("div");
      box.className = "lottie-sticker";
      loadTgsSticker(box, data.url);
      return box;
    }
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
    media.classList.add("clickable-media");
    media.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openMediaLightbox(media);
    });
    return media;
  }

  function createReplyQuote(reply) {
    if (!reply || (!reply.name && !reply.text)) return null;
    const quote = document.createElement("div");
    quote.className = "reply-quote";
    if (reply.message?.chat_id && reply.message?.message_id) {
      quote.dataset.replyTargetKey = `${reply.message.chat_id}:${reply.message.message_id}`;
      quote.title = "인용 메시지로 이동";
    }
    const name = document.createElement("span");
    name.className = "reply-name";
    name.textContent = reply.name || "Unknown";
    const text = document.createElement("span");
    text.className = "reply-text";
    text.textContent = reply.quote_text || reply.text || "메시지";
    quote.append(name, text);
    quote.addEventListener("click", (ev) => {
      ev.stopPropagation();
      focusChatLineByKey(quote.dataset.replyTargetKey);
    });
    return quote;
  }

  function removeChatLineByRef(ref) {
    if (!ref?.chat_id || !ref?.message_id) return;
    const key = `${ref.chat_id}:${ref.message_id}`;
    for (const el of Array.from(chatLog?.querySelectorAll(".chat-line[data-message-key]") || [])) {
      if (el.dataset.messageKey === key) removeChatLineElement(el);
    }
    for (const bubble of Array.from(participantLayer?.querySelectorAll(`.bubble[data-message-key="${CSS.escape(key)}"]`) || [])) {
      const avatar = bubble.closest(".avatar");
      removeSpeechBubble(avatar, bubble);
    }
  }

  function removeChatLineElement(el) {
    if (!el || el.classList.contains("delete-out")) return;
    el.style.maxHeight = `${el.scrollHeight}px`;
    el.classList.add("delete-out");
    setTimeout(() => el.remove(), 560);
  }

  function focusChatLineByKey(key) {
    if (!key || !chatLog) return;
    const target = chatLog.querySelector(`.chat-line[data-message-key="${CSS.escape(key)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    target.classList.remove("jump-highlight");
    requestAnimationFrame(() => target.classList.add("jump-highlight"));
    setTimeout(() => target.classList.remove("jump-highlight"), 1400);
  }

  function addChatLine(data, isParticipant) {
    if (!chatLog) return;
    const name = String(data.name || data.username || "미참여");
    const type = data.type || "text";
    const isMedia = type === "photo" || type === "sticker" || type === "animation";
    const participantKey = speakerKey(data);
    const participant = participantKey ? state.participants.get(participantKey) : null;
    const isHost = !!(participant?.is_host || data.is_host);
    const isBot = !!data.is_bot && !isHost;
    const levelsEnabled = state.cfg.level_system_enabled !== false;
    const explicitLevel = Number(data.level);
    const levelValue = isBot ? null : (participant
      ? (levelsEnabled ? (participant.is_host ? 99 : Number(participant.level || data.level || 0)) : NaN)
      : (levelsEnabled ? (isHost ? 99 : (Number.isFinite(explicitLevel) ? explicitLevel : 0)) : NaN));
    const tier = Number.isFinite(levelValue) ? levelTier(levelValue, isHost) : null;
    const item = document.createElement("div");
    item.className = `chat-line ${isParticipant ? "incall" : "offcall"}${isMedia ? ` photo ${type}` : ""}`;
    if (data.message?.chat_id && data.message?.message_id) {
      item.dataset.messageKey = `${data.message.chat_id}:${data.message.message_id}`;
      item._chatData = data;
      item.addEventListener("contextmenu", (ev) => showChatMessageMenu(ev, data, item));
    }
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
    if (isBot || Number.isFinite(levelValue)) {
      const level = document.createElement("span");
      level.className = `chat-level${isBot ? " bot" : ""}`;
      level.textContent = isBot ? "Bot" : (data.level_label || `Lv. ${levelValue}`);
      header.append(level);
    }
    item.append(header);
    const quote = createReplyQuote(data.reply);
    if (quote) item.appendChild(quote);
    if (isMedia) {
      const media = createMediaElement(data);
      item.appendChild(media);
      if (typeof data.text === "string" && data.text.trim()) {
        const msg = document.createElement("span");
        msg.className = "chat-text photo-caption";
        appendRichText(msg, data.text, { entities: data.entities || [] });
        item.appendChild(msg);
      }
    } else {
      const msg = document.createElement("span");
      msg.className = "chat-text";
      appendRichText(msg, String(data.text || ""), { entities: data.entities || [] });
      const separator = document.createElement("span");
      separator.className = "chat-separator";
      separator.textContent = ": ";
      item.append(separator, msg);
      if (data.stt_label) {
        const label = document.createElement("span");
        label.className = "stt-label";
        label.textContent = ` ${data.stt_label}`;
        item.appendChild(label);
      }
    }
    const shouldStickToBottom = chatLogIsAtBottom();
    chatLog.appendChild(item);
    if (isMedia) {
      const media = item.querySelector("img, video");
      if (media) keepChatLogBottomAfterMediaLoad(media, shouldStickToBottom);
    }
    while (chatLog.children.length > MAX_CHAT_LINES) {
      chatLog.removeChild(chatLog.firstChild);
    }
    requestAnimationFrame(() => item.classList.add("show"));
    if (shouldStickToBottom) {
      scrollChatLogToBottom();
    }
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

  function clampCameraView() {
    state.view.distance = clamp(Number(state.view.distance) || DEFAULT_CAMERA_VIEW.distance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
    state.view.height = clamp(Number(state.view.height) || DEFAULT_CAMERA_VIEW.height, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
  }

  function easeInOut(value) {
    const t = clamp(value, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(value) {
    const t = clamp(value, 0, 1);
    return 1 - Math.pow(1 - t, 3);
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
    const p = clamp(pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
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
    state.view.distance = clamp(state.view.distance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);

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
      state.view.distance = clamp(state.view.distance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
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

    clampCameraView();
    state.view.screenOffsetX = clamp(state.view.screenOffsetX || 0, -window.innerWidth, window.innerWidth);
    state.view.screenOffsetY = clamp(state.view.screenOffsetY || 0, -window.innerHeight, window.innerHeight);
    applySceneScreenOffset();
    const fov = asFiniteNumber(data.fov);
    const dFov = asFiniteNumber(delta?.fov);
    if (state.three?.camera && (fov != null || dFov != null)) {
      state.three.camera.fov = clamp((fov != null ? fov : state.three.camera.fov) + (dFov || 0), CAMERA_FOV_MIN, CAMERA_FOV_MAX);
      state.three.camera.updateProjectionMatrix();
      state.view.fov = state.three.camera.fov;
    }
    state.cameraUpdate?.();
    saveCameraSettings();
  }

  function makeFireworkMaterial(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
  }

  function createCheerStick(color) {
    const stick = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x1b1f28, roughness: 0.46 })
    );
    handle.position.y = -0.07;
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.54, 18, 1, true),
      makeFireworkMaterial(color, 0.22)
    );
    glow.position.y = 0.23;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.52, 16),
      makeFireworkMaterial(color.clone().lerp(new THREE.Color(0xffffff), 0.08), 0.94)
    );
    core.position.y = 0.23;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 10),
      makeFireworkMaterial(color.clone().lerp(new THREE.Color(0xffffff), 0.2), 0.72)
    );
    tip.position.y = 0.51;
    stick.add(handle, glow, core, tip);
    stick.traverse((obj) => {
      obj.userData.isCheerStick = true;
    });
    stick.visible = false;
    return { group: stick, glow, core, tip };
  }

  function attachCheerRig(group, key) {
    const hue = (hashString(`${key}:cheer`) % 360) / 360;
    const left = createCheerStick(new THREE.Color().setHSL(hue, 1, 0.58));
    const right = createCheerStick(new THREE.Color().setHSL((hue + 0.23) % 1, 1, 0.58));
    group.add(left.group, right.group);
    group.userData.cheerRig = {
      left,
      right,
      startedAt: 0,
      until: 0,
    };
  }

  function setCheerStickPose(stick, side, wave, lift, pulse) {
    const dir = side === "left" ? -1 : 1;
    stick.group.traverse((obj) => {
      obj.visible = true;
    });
    stick.group.position.set(dir * (0.49 + wave * 0.035), 0.66 + lift, 0.17);
    stick.group.rotation.set(0.48 + Math.abs(wave) * 0.14, 0.08 * dir, dir * 0.36 + wave * 0.62);
    stick.glow.material.opacity = 0.18 + pulse * 0.18;
    stick.core.material.opacity = 0.72 + pulse * 0.24;
    stick.tip.material.opacity = 0.42 + pulse * 0.38;
    stick.group.scale.setScalar(1 + pulse * 0.08);
  }

  function updateCheerRig(group, now, tick, forceHidden = false) {
    const rig = group.userData.cheerRig;
    const arms = group.userData.arms;
    if (!rig || !arms) return false;
    arms.left.rotation.copy(arms.leftBase);
    arms.right.rotation.copy(arms.rightBase);
    if (forceHidden || (rig.until || 0) <= now) {
      rig.left.group.visible = false;
      rig.right.group.visible = false;
      return false;
    }
    const wave = Math.sin(tick * 0.018);
    const bounce = Math.sin(tick * 0.027);
    const pulse = 0.5 + Math.sin(tick * 0.042) * 0.5;
    arms.left.rotation.set(0.34 + bounce * 0.08, 0.02, -1.08 + wave * 0.48);
    arms.right.rotation.set(0.34 - bounce * 0.08, -0.02, 1.08 + wave * 0.48);
    setCheerStickPose(rig.left, "left", wave, 0.02 + Math.abs(wave) * 0.05, pulse);
    setCheerStickPose(rig.right, "right", wave, 0.02 + Math.abs(wave) * 0.05, 1 - pulse * 0.7);
    return true;
  }

  function spawnFireworkBurst(effect, origin, color, count, power, delay = 0) {
    const birth = performance.now() + delay;
    for (let i = 0; i < count; i++) {
      const sparkColor = color.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.28);
      if (Math.random() < 0.18) sparkColor.lerp(new THREE.Color(0xfff2a6), 0.45);
      const spark = new THREE.Mesh(effect.sparkGeo, makeFireworkMaterial(sparkColor, 0.96));
      spark.position.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const vertical = Math.random() * 2 - 0.42;
      const flat = Math.sqrt(Math.max(0.12, 1 - Math.min(0.95, vertical * vertical * 0.42)));
      const speed = power * (0.58 + Math.random() * 0.72);
      spark.userData.origin = origin.clone();
      spark.userData.velocity = new THREE.Vector3(
        Math.cos(theta) * flat * speed,
        vertical * speed + 0.18,
        Math.sin(theta) * flat * speed
      );
      spark.userData.birth = birth;
      spark.userData.life = 680 + Math.random() * 520;
      spark.userData.gravity = 0.92 + Math.random() * 0.32;
      spark.userData.twinkle = Math.random() * Math.PI * 2;
      spark.userData.baseScale = 0.75 + Math.random() * 0.75;
      spark.visible = delay <= 0;
      effect.group.add(spark);
      effect.particles.push(spark);
    }
  }

  function spawnLevelParticles(effect, color, count, isDown) {
    for (let i = 0; i < count; i++) {
      const sparkColor = color.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.36);
      const spark = new THREE.Mesh(effect.sparkGeo, makeFireworkMaterial(sparkColor, 0.95));
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.16 + Math.random() * 0.44;
      const y = 0.15 + Math.random() * 0.45;
      spark.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      spark.userData.vel = new THREE.Vector3(
        Math.cos(angle) * (0.25 + Math.random() * 0.42),
        (isDown ? -0.15 : 0.62) + Math.random() * 0.62,
        Math.sin(angle) * (0.25 + Math.random() * 0.42)
      );
      effect.group.add(spark);
      effect.particles.push(spark);
    }
  }

  function updateLevelEffect(effect, now, tick) {
    const age = now - effect.start;
    const progress = clamp(age / (effect.duration || effect.life || 1), 0, 1);
    const out = easeOutCubic(progress);
    const pulse = Math.sin(progress * Math.PI);
    const isDown = effect.kind === "down";
    if (effect.beam) {
      effect.beam.visible = true;
      effect.beam.scale.set(1 + pulse * 0.12, 1, 1 + pulse * 0.12);
      effect.beam.material.opacity = pulse * (isDown ? 0.22 : 0.36);
    }
    if (effect.ring) {
      effect.ring.scale.setScalar(1 + out * 2.15);
      effect.ring.material.opacity = (1 - progress) * 0.68;
    }
    for (const spark of effect.particles) {
      spark.position.addScaledVector(spark.userData.vel, 0.018);
      spark.material.opacity = Math.max(0, 1 - progress) * 0.9;
    }
  }

  function levelCharacterMotion(group, now) {
    const start = group.userData.levelEffectStart || 0;
    const kind = group.userData.levelEffectKind;
    const age = now - start;
    if (!kind || age > 1050) {
      return { active: false, kind: "", offsetY: 0, scale: 1, tiltZ: 0, pulse: 0 };
    }
    const t = clamp(age / 1050, 0, 1);
    const pulse = Math.sin(t * Math.PI);
    if (kind === "down") {
      return {
        active: true,
        kind,
        offsetY: 0,
        scale: 1 - pulse * 0.045,
        tiltZ: Math.sin(t * Math.PI * 16) * (1 - t) * 0.055,
        pulse,
      };
    }
    return {
      active: true,
      kind,
      offsetY: pulse * 0.28,
      scale: 1 + pulse * 0.07,
      tiltZ: 0,
      pulse,
    };
  }

  function levelToastTokens(data, upward) {
    const oldLevel = Number(data?.old_level);
    const newLevel = Number(data?.new_level);
    const rawDelta = Number(data?.delta);
    const fallbackDelta = Number.isFinite(oldLevel) && Number.isFinite(newLevel) ? newLevel - oldLevel : NaN;
    const delta = Number.isFinite(rawDelta) ? rawDelta : fallbackDelta;
    return {
      old_level: Number.isFinite(oldLevel) ? oldLevel : "",
      new_level: Number.isFinite(newLevel) ? newLevel : "",
      level: Number.isFinite(newLevel) ? newLevel : "",
      delta: Number.isFinite(delta) && delta > 0 ? `+${delta}` : (Number.isFinite(delta) ? delta : ""),
      direction: upward ? "up" : "down",
      reason: String(data?.reason || ""),
    };
  }

  function showLevelEventToast(data, participant, upward) {
    const name = eventDisplayName(data?.name || participant?.name || data?.username || participant?.username);
    const template = upward ? state.toastSettings?.levelUpTemplate : state.toastSettings?.levelDownTemplate;
    const fallback = upward ? LEVEL_UP_TEMPLATE_DEFAULT : LEVEL_DOWN_TEMPLATE_DEFAULT;
    showEventToast(
      toastMessageParts(template, name, fallback, levelToastTokens(data, upward)),
      upward ? "level-up" : "level-down",
      participant ? participantColor(participant) : (data?.color || "")
    );
  }

  function triggerLevelEffect(data) {
    const key = speakerKey(data, true) || speakerKey(data);
    if (!key) return;
    const participant = state.participants.get(key);
    const nextLevel = Number(data.new_level);
    if (participant && Number.isFinite(nextLevel)) {
      participant.level = nextLevel;
      participant.level_label = data.level_label || (participant.is_host ? "Lv. 99" : `Lv. ${nextLevel}`);
      renderParticipants();
    }
    const upward = String(data.direction || "").toLowerCase() !== "down" && Number(data.new_level || 0) >= Number(data.old_level || 0);
    showLevelEventToast(data, participant, upward);
    if (isRealJailed(key)) return;
    if (!state.three?.scene || !window.THREE) return;
    const char = state.characters.get(key);
    if (!char) return;
    const origin = (char.userData.target || char.position).clone();
    const color = upward ? new THREE.Color(0xffd45c) : new THREE.Color(0x7fb6ff);
    const group = new THREE.Group();
    group.position.copy(origin);
    group.scale.setScalar(characterPrisonScale(key));
    const effects = state.three.effects || [];
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      if (effect.type === "level" && effect.key === key) {
        effect.group?.parent?.remove(effect.group);
        effects.splice(i, 1);
      }
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 2.6, 48, 1, true),
      makeFireworkMaterial(color.clone().lerp(new THREE.Color(0xffffff), 0.45), upward ? 0.28 : 0.18)
    );
    beam.material.side = THREE.DoubleSide;
    beam.position.y = 1.25;
    group.add(beam);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.018, 8, 80),
      makeFireworkMaterial(color, 0.72)
    );
    ring.material.side = THREE.DoubleSide;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    const start = performance.now();
    const effect = {
      type: "level",
      key,
      kind: upward ? "up" : "down",
      direction: upward ? "up" : "down",
      mode: "beam",
      group,
      particles: [],
      sparkGeo: new THREE.SphereGeometry(0.025, 8, 6),
      beam,
      ring,
      start,
      duration: upward ? 1350 : 1050,
      life: upward ? 1350 : 1050,
      variant: upward ? "level-up-beam" : "level-down",
    };
    spawnLevelParticles(effect, color, 42, !upward);
    state.three.scene.add(group);
    state.three.effects = state.three.effects || [];
    state.three.effects.push(effect);
    char.userData.levelEffectStart = start;
    char.userData.levelEffectKind = upward ? "up" : "down";
    while (state.three.effects.length > 8) {
      const old = state.three.effects.shift();
      old?.group?.parent?.remove(old.group);
    }

    const el = state.elements.get(key);
    if (el) {
      el.classList.remove("level-pop", "level-drop");
      void el.offsetWidth;
      el.classList.add(upward ? "level-pop" : "level-drop");
      setTimeout(() => el.classList.remove("level-pop", "level-drop"), upward ? 650 : 560);
    }
  }

  function updateFireworksEffect(effect, now, tick) {
    const age = now - effect.start;
    if (effect.variant === "orbit-pop") {
      const climb = easeInOut(clamp(age / 940, 0, 1));
      for (const orb of effect.orbs || []) {
        const angle = orb.phase + age * 0.0084;
        const radius = orb.radius * (1 - climb * 0.42);
        orb.mesh.position.set(
          Math.cos(angle) * radius,
          1.05 + climb * 2.35 + Math.sin(age * 0.009 + orb.phase) * 0.075,
          Math.sin(angle) * radius
        );
        orb.mesh.scale.setScalar(1 + Math.sin(age * 0.02 + orb.phase) * 0.22);
        orb.material.opacity = 0.92 * (1 - Math.max(0, climb - 0.86) / 0.14);
      }
      while (effect.popStep < effect.popTimes.length && age >= effect.popTimes[effect.popStep]) {
        const step = effect.popStep;
        const theta = step * Math.PI * 0.72 + 0.35;
        const origin = new THREE.Vector3(
          Math.cos(theta) * (0.2 + step * 0.14),
          3.18 + step * 0.28,
          Math.sin(theta) * (0.2 + step * 0.14)
        );
        const color = effect.baseColor.clone().offsetHSL(step * 0.085, 0.16, 0.08);
        spawnFireworkBurst(effect, origin, color, 118 + step * 24, 1.95 + step * 0.24);
        spawnFireworkBurst(effect, origin.clone().add(new THREE.Vector3(0, 0.08, 0)), color.clone().lerp(new THREE.Color(0xffffff), 0.28), 48, 1.05, 110);
        effect.popStep += 1;
      }
      if (age > effect.popTimes[effect.popTimes.length - 1] + 220) {
        for (const orb of effect.orbs || []) {
          orb.mesh.visible = false;
        }
      }
    } else {
      for (const rocket of effect.rockets) {
        const local = age - rocket.delay;
        if (local < 0) {
          rocket.mesh.visible = false;
          continue;
        }
        if (local < rocket.riseMs) {
          const phase = clamp(local / rocket.riseMs, 0, 1);
          const eased = Math.pow(phase, 1.55);
          rocket.mesh.visible = true;
          rocket.mesh.position.lerpVectors(rocket.start, rocket.end, eased);
          rocket.mesh.scale.setScalar(0.82 + eased * 0.42);
          rocket.trailMaterial.opacity = (0.32 + phase * 0.48) * (1 - Math.max(0, phase - 0.86) / 0.14);
          rocket.headMaterial.opacity = 0.72 + Math.sin(tick * 0.038 + rocket.twinkle) * 0.22;
          continue;
        }
        rocket.mesh.visible = false;
        if (!rocket.spawned) {
          rocket.spawned = true;
          spawnFireworkBurst(effect, rocket.end, rocket.color, 44, 1.45);
          for (let i = 0; i < 2; i++) {
            const theta = rocket.twinkle + i * Math.PI + Math.random() * 0.45;
            const popOrigin = rocket.end.clone().add(new THREE.Vector3(
              Math.cos(theta) * (0.22 + Math.random() * 0.24),
              -0.05 + Math.random() * 0.22,
              Math.sin(theta) * (0.22 + Math.random() * 0.24)
            ));
            spawnFireworkBurst(effect, popOrigin, rocket.color.clone().lerp(new THREE.Color(0xfff0a8), 0.24), 16, 0.86, 120 + i * 155);
          }
        }
      }
    }

    for (const spark of effect.particles) {
      const local = now - spark.userData.birth;
      if (local < 0) {
        spark.visible = false;
        continue;
      }
      spark.visible = true;
      const progress = clamp(local / spark.userData.life, 0, 1);
      const sec = local / 1000;
      const v = spark.userData.velocity;
      spark.position.set(
        spark.userData.origin.x + v.x * sec,
        spark.userData.origin.y + v.y * sec - spark.userData.gravity * sec * sec,
        spark.userData.origin.z + v.z * sec
      );
      const pulse = 0.8 + Math.sin(tick * 0.045 + spark.userData.twinkle) * 0.22;
      spark.scale.setScalar(spark.userData.baseScale * (1 + progress * 0.9));
      spark.material.opacity = Math.max(0, Math.pow(1 - progress, 1.45) * pulse);
    }
  }

  function triggerFireworks(data) {
    if (!state.three?.scene || !window.THREE) return;
    const key = speakerKey(data, true) || speakerKey(data);
    if (!key) return;
    if (isRealJailed(key)) return;
    const char = state.characters.get(key);
    if (!char) return;
    const now = performance.now();
    char.userData.fireHopStart = now;
    char.userData.fireHopUntil = now + 1300;
    const origin = (char.userData.target || char.position).clone();
    const group = new THREE.Group();
    group.position.copy(origin);
    group.scale.setScalar(characterPrisonScale(key));
    const participant = state.participants.get(key);
    const baseColor = new THREE.Color(data.color || (participant ? participantColor(participant) : "#ffd66b"));
    const sparkGeo = new THREE.SphereGeometry(0.032, 8, 6);
    const orbGeo = new THREE.SphereGeometry(0.062, 12, 8);
    const orbs = [];
    for (let i = 0; i < 5; i++) {
      const orbColor = baseColor.clone().offsetHSL(i * 0.062, 0.12, 0.05);
      const material = makeFireworkMaterial(orbColor, 0.92);
      const mesh = new THREE.Mesh(orbGeo, material);
      group.add(mesh);
      orbs.push({ mesh, material, phase: i * Math.PI * 0.4, radius: 0.54 + i * 0.034 });
    }
    const popTimes = [980, 1480, 1980];
    state.three.scene.add(group);
    state.three.effects = state.three.effects || [];
    state.three.effects.push({
      type: "fireworks",
      key,
      variant: "orbit-pop",
      group,
      rockets: [],
      orbs,
      particles: [],
      sparkGeo,
      baseColor,
      popTimes,
      popStep: 0,
      start: performance.now(),
      life: popTimes[popTimes.length - 1] + 1450,
    });
    while (state.three.effects.length > 8) {
      const old = state.three.effects.shift();
      old?.group?.parent?.remove(old.group);
    }
  }

  function triggerCheerEffect(data) {
    const key = speakerKey(data, true) || speakerKey(data);
    if (!key) return;
    const char = state.characters.get(key);
    if (!char?.userData?.cheerRig) return;
    const now = performance.now();
    if (String(data.action || "").toLowerCase() === "stop") {
      char.userData.cheerRig.until = 0;
      updateCheerRig(char, now, now, true);
      return;
    }
    if (isRealJailed(key)) {
      char.userData.cheerRig.until = 0;
      updateCheerRig(char, now, now, true);
      return;
    }
    const rawSeconds = Number(data.duration_sec);
    const durationSec = clamp(Number.isFinite(rawSeconds) ? rawSeconds : CHEER_DEFAULT_SEC, 0.1, CHEER_MAX_SEC);
    char.userData.cheerRig.startedAt = now;
    char.userData.cheerRig.until = now + durationSec * 1000;
  }

  function connectVideochat() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    state.videochatWs = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "videochat_snapshot" && state.mockCount <= 0) setSnapshot(data);
        if (data.type === "videochat_camera" || data.type === "camera") applyCameraControl(data);
        if (data.type === "videochat_overlay_settings") applyOverlaySettings(data.settings, data.client_id);
        if (data.type === "chat_control") {
          if (data.client_id === state.clientId) return;
          if (data.action === "media_lightbox_open") openMediaLightboxSource(data.src, data.tag || "IMG", false);
          if (data.action === "media_lightbox_close") closeMediaLightbox(false);
          if (data.target === "link_preview") {
            if (!sharedLinkPreview && window.TgChatCore?.createLinkPreview) {
              sharedLinkPreview = window.TgChatCore.createLinkPreview("link-preview", {
                onControl: (payload) => sendVideochatControlEvent(payload),
              });
            }
            sharedLinkPreview?.applyRemote?.(data);
          }
        }
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connectVideochat, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  function connectChatSpeech() {
    const ws = new WebSocket(state.cfg.chat_ws_url);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "videochat_effect" && data.effect === "fireworks") {
          triggerFireworks(data);
          return;
        }
        if (data.type === "videochat_effect" && data.effect === "cheer") {
          triggerCheerEffect(data);
          return;
        }
        if (data.type === "videochat_effect" && data.effect === "level") {
          triggerLevelEffect(data);
          return;
        }
        if (data.type === "videochat_levels_updated") {
          fetch("/api/videochat/levels/reload", { method: "POST" })
            .then((r) => r.json())
            .then((payload) => {
              if (payload?.snapshot?.type === "videochat_snapshot") {
                setSnapshot(payload.snapshot);
              }
            })
            .catch(() => {});
          return;
        }
        showSpeech(data);
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connectChatSpeech, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  function createJailCage() {
    const group = new THREE.Group();
    group.visible = false;
    const center = realJailCenter();
    group.position.set(center.x, 0, center.z);
    group.rotation.y = realJailYaw();

    const steel = new THREE.MeshStandardMaterial({
      color: 0x8a94a6,
      roughness: 0.38,
      metalness: 0.55,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x343b48,
      roughness: 0.58,
      metalness: 0.42,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c2430,
      roughness: 0.82,
      metalness: 0.1,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.08, 2.14), floorMat);
    floor.position.y = 0.02;
    group.add(floor);

    const halfX = 1.34;
    const halfZ = 0.98;
    const barGeo = new THREE.CylinderGeometry(0.026, 0.026, 1.78, 10);
    const barKeys = new Set();
    const addBar = (x, z) => {
      const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
      if (barKeys.has(key)) return;
      barKeys.add(key);
      const bar = new THREE.Mesh(barGeo, steel);
      bar.position.set(x, 0.92, z);
      group.add(bar);
    };
    for (let i = 0; i < 8; i += 1) {
      const x = -halfX + i * ((halfX * 2) / 7);
      addBar(x, -halfZ);
      addBar(x, halfZ);
    }
    for (let i = 0; i < 7; i += 1) {
      const z = -halfZ + i * ((halfZ * 2) / 6);
      addBar(-halfX, z);
      addBar(halfX, z);
    }

    const railGeoX = new THREE.BoxGeometry(2.78, 0.06, 0.06);
    const railGeoZ = new THREE.BoxGeometry(0.06, 0.06, 2.08);
    for (const y of [0.18, 1.72]) {
      const front = new THREE.Mesh(railGeoX, darkSteel);
      front.position.set(0, y, -halfZ);
      const back = new THREE.Mesh(railGeoX, darkSteel);
      back.position.set(0, y, halfZ);
      const left = new THREE.Mesh(railGeoZ, darkSteel);
      left.position.set(-halfX, y, 0);
      const right = new THREE.Mesh(railGeoZ, darkSteel);
      right.position.set(halfX, y, 0);
      group.add(front, back, left, right);
    }

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.3, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x493f35, roughness: 0.7 })
    );
    sign.position.set(0, 1.98, -1.04);
    const signLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.24),
      createJailSignMaterial()
    );
    signLabel.position.set(0, 1.98, -1.075);
    signLabel.rotation.y = Math.PI;
    signLabel.userData.jailSignLabel = true;
    group.add(sign, signLabel);

    return group;
  }

  function createJailPlacePreview() {
    const group = createJailCage();
    group.visible = false;
    group.userData.isPlacePreview = true;
    group.traverse((obj) => {
      if (!obj.material) return;
      obj.material = obj.material.clone();
      if (obj.material.color) obj.material.color.lerp(new THREE.Color(0x83dcff), 0.55);
      obj.material.transparent = true;
      obj.material.opacity = 0.34;
      obj.material.depthWrite = false;
      if ("emissive" in obj.material) {
        obj.material.emissive = new THREE.Color(0x0d6b92);
        obj.material.emissiveIntensity = 0.18;
      }
    });
    updateJailSignLabel(group);
    return group;
  }

  function createCharacterPlacePreview() {
    const group = new THREE.Group();
    group.visible = false;
    group.userData.isPlacePreview = true;
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x76d6ff,
      transparent: true,
      opacity: 0.42,
      roughness: 0.6,
      depthWrite: false,
      emissive: 0x0d536b,
      emissiveIntensity: 0.16,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.44, 5, 12), ghostMat.clone());
    body.position.y = 0.56;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), ghostMat.clone());
    head.position.y = 1.05;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    eyeMat.userData.previewTint = false;
    const eyeGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
    eyeL.userData.previewTint = false;
    eyeR.userData.previewTint = false;
    eyeL.position.set(-0.068, 1.07, 0.195);
    eyeR.position.set(0.068, 1.07, 0.195);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.46, 42),
      new THREE.MeshBasicMaterial({
        color: 0x76d6ff,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.userData.previewTint = false;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.018;
    group.add(body, head, eyeL, eyeR, ring);
    return group;
  }

  function characterClawMetrics(scale = 1) {
    const s = clamp(Number(scale) || 1, 0.18, 1.15);
    const sizeT = clamp((s - 0.18) / 0.97, 0, 1);
    const headTopY = 1.46 * s;
    const grabClearance = 0.28 + s * 0.12;
    return {
      scale: s,
      highHeadY: 3.05,
      grabHeadY: headTopY + grabClearance,
      maxBend: 0.9 + (0.54 - 0.9) * sizeT,
      releaseHop: 0.075 * s,
      sway: 0.018 * Math.max(0.45, s),
    };
  }

  function createCharacterClawRig() {
    const root = new THREE.Group();
    root.visible = false;
    const steel = new THREE.MeshStandardMaterial({
      color: 0xb8c7d8,
      metalness: 0.72,
      roughness: 0.24,
      emissive: 0x15283a,
      emissiveIntensity: 0.08,
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x435061,
      metalness: 0.62,
      roughness: 0.32,
    });
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0xd9e8f5,
      metalness: 0.8,
      roughness: 0.18,
    });
    const glowMat = makeFireworkMaterial(new THREE.Color(0x8bdcff), 0.22);

    const carriage = new THREE.Group();
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 0.12), darkSteel);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.26), steel);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), makeFireworkMaterial(new THREE.Color(0x8bdcff), 0.78));
    block.position.y = -0.08;
    lamp.position.set(0, -0.22, 0.12);
    carriage.add(rail, block, lamp);
    root.add(carriage);

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), cableMat);
    cable.position.y = -0.5;
    root.add(cable);

    const head = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), steel);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 36), darkSteel);
    collar.rotation.x = Math.PI / 2;
    head.add(hub, collar);

    const upperGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.28, 10);
    const lowerGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.28, 10);
    const jointGeo = new THREE.SphereGeometry(0.032, 10, 8);
    const tipGeo = new THREE.SphereGeometry(0.04, 12, 8);
    const prongs = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      const pivot = new THREE.Group();
      pivot.userData.angle = angle;
      pivot.userData.openRadius = 0.34;
      pivot.userData.hingeY = -0.28;
      pivot.userData.fingerLength = 0.28;
      pivot.rotation.y = Math.PI / 2 - angle;
      const arm = new THREE.Mesh(upperGeo, steel);
      arm.position.set(0, -0.14, 0);
      const joint = new THREE.Mesh(jointGeo, darkSteel);
      joint.position.set(0, pivot.userData.hingeY, 0);
      const finger = new THREE.Mesh(lowerGeo, steel);
      const tip = new THREE.Mesh(tipGeo, steel);
      pivot.userData.finger = finger;
      pivot.userData.tip = tip;
      pivot.add(arm, joint, finger, tip);
      head.add(pivot);
      prongs.push(pivot);
    }
    root.add(head);

    const grabRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.016, 8, 72), glowMat);
    grabRing.rotation.x = Math.PI / 2;
    grabRing.visible = false;
    root.add(grabRing);

    root.userData.claw = { cable, head, prongs, grabRing };
    return root;
  }

  function updateCharacterClawRigPose(worldX, worldZ, headY, close, pulse = 0, metrics = characterClawMetrics(1)) {
    const rig = state.three?.characterClawRig;
    const data = rig?.userData?.claw;
    if (!rig || !data) return false;
    const topY = metrics.highHeadY;
    const cableLength = Math.max(0.16, topY - headY);
    rig.visible = true;
    rig.position.set(worldX, topY, worldZ);
    data.cable.position.y = -cableLength / 2;
    data.cable.scale.set(1, cableLength, 1);
    data.head.position.y = -cableLength;
    data.grabRing.position.set(0, -cableLength - 0.4, 0);
    data.grabRing.visible = close > 0.08;
    data.grabRing.scale.setScalar(0.62 + close * 0.28 + Math.sin(pulse) * 0.02);
    data.grabRing.material.opacity = (0.08 + close * 0.2) * (0.8 + Math.sin(pulse * 1.7) * 0.2);
    for (const prong of data.prongs) {
      const angle = prong.userData.angle;
      const hingeY = prong.userData.hingeY;
      const length = prong.userData.fingerLength;
      const bend = 0.03 + (metrics.maxBend - 0.03) * close;
      prong.position.set(Math.cos(angle) * prong.userData.openRadius, 0, Math.sin(angle) * prong.userData.openRadius);
      prong.rotation.set(0, Math.PI / 2 - angle, 0);
      prong.userData.finger.position.set(0, hingeY - Math.cos(bend) * length * 0.5, -Math.sin(bend) * length * 0.5);
      prong.userData.finger.rotation.set(bend, 0, 0);
      prong.userData.tip.position.set(0, hingeY - Math.cos(bend) * length, -Math.sin(bend) * length);
    }
    return true;
  }

  function hideCharacterClawRig() {
    const rig = state.three?.characterClawRig;
    if (rig) rig.visible = false;
  }

  function initThree() {
    if (!window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    if (Number.isFinite(Number(state.view.fov))) {
      camera.fov = clamp(Number(state.view.fov), CAMERA_FOV_MIN, CAMERA_FOV_MAX);
    }
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
    for (let i = 0; i < 230; i++) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.009 + Math.random() * 0.014, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xe8f1ff,
          transparent: true,
          opacity: 0.55 + Math.random() * 0.45,
          depthTest: false,
          depthWrite: false,
        })
      );
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 24;
      star.position.set(Math.cos(a) * r, 4.6 + Math.random() * 13.0, Math.sin(a) * r);
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
      if (Math.random() < 0.55) {
        const side = (Math.random() - 0.5) * 24;
        const depth = -14 - Math.random() * 16;
        line.position.copy(state.view.target)
          .addScaledVector(forward, depth)
          .addScaledVector(right, side);
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 18;
        line.position.set(
          state.view.target.x + Math.cos(a) * r,
          0,
          state.view.target.z + Math.sin(a) * r
        );
      }
      line.position.y = 5.4 + Math.random() * 8.4;
      line.rotation.z = -0.12 + (Math.random() - 0.5) * 0.32;
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

    const jailGroup = createJailCage();
    scene.add(jailGroup);
    const jailPlacePreview = createJailPlacePreview();
    scene.add(jailPlacePreview);
    const characterPlacePreview = createCharacterPlacePreview();
    scene.add(characterPlacePreview);
    const characterClawRig = createCharacterClawRig();
    scene.add(characterClawRig);

    state.three = { renderer, scene, camera, fireLight, jailGroup, jailPlacePreview, characterPlacePreview, characterClawRig, effects: [] };

    function updateCamera() {
      const v = state.view;
      clampCameraView();
      const x = Math.sin(v.yaw) * v.distance;
      const z = Math.cos(v.yaw) * v.distance;
      camera.position.set(v.target.x + x, v.height, v.target.z + z);
      camera.lookAt(v.target);
      renderParticipants();
    }
    state.cameraUpdate = updateCamera;

    window.addEventListener("keydown", (ev) => {
      if (state.characterDriveMode && ev.key === "Escape") {
        setCharacterDriveMode(false);
        ev.preventDefault();
        return;
      }
      if (forwardGameKeyboardEvent(ev, true)) return;
      const key = ev.key.toLowerCase();
      if (state.characterDriveMode) {
        if (isTextInputTarget(ev.target)) {
          state.keys.clear();
          return;
        }
        if (key === " " || ev.code === "Space") {
          if (!ev.repeat) triggerCharacterDriveJump();
          ev.preventDefault();
          return;
        }
        if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
          state.keys.add(key);
          ev.preventDefault();
        }
        return;
      }
      if (state.characterPlaceMode && ev.key === "Escape") {
        setCharacterPlaceMode(false);
        setCharacterMoveAdjusting(false);
        ev.preventDefault();
        return;
      }
      if (state.prisonPlaceMode && ev.key === "Escape") {
        setRealJailPlaceMode(false);
        setPrisonTransformAdjusting(false);
        ev.preventDefault();
        return;
      }
      if (isEditableTarget(ev.target)) {
        state.keys.clear();
        return;
      }
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
      if (forwardGameKeyboardEvent(ev, false)) return;
      const key = ev.key.toLowerCase();
      if (state.characterDriveMode) {
        if (isTextInputTarget(ev.target)) {
          state.keys.delete(key);
          return;
        }
        if (key === " " || ev.code === "Space") {
          ev.preventDefault();
          return;
        }
        if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
          state.keys.delete(key);
          ev.preventDefault();
        }
        return;
      }
      if (isEditableTarget(ev.target)) {
        state.keys.delete(key);
        return;
      }
      if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
        state.keys.delete(key);
        ev.preventDefault();
      }
    });

    window.addEventListener("wheel", (ev) => {
      if (isEditableTarget(ev.target)) return;
      const pitch = Math.atan2(state.view.height - state.view.target.y, state.view.distance);
      state.view.distance = clamp(state.view.distance + ev.deltaY * 0.004, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
      state.view.height = clamp(state.view.target.y + Math.tan(pitch) * state.view.distance, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
      updateCamera();
      saveCameraSettings();
    }, { passive: true });

    window.addEventListener("pointermove", (ev) => {
      if (state.characterPlaceMode) {
        if (isJailPlacementBlockedTarget(ev.target)) hideCharacterPlacePreview();
        else updateCharacterPlacePreviewFromEvent(ev);
        return;
      }
      if (state.prisonPlaceMode) {
        if (isJailPlacementBlockedTarget(ev.target)) hideRealJailPlacePreview();
        else updateRealJailPlacePreviewFromEvent(ev);
      }
    }, true);

    window.addEventListener("pointerdown", (ev) => {
      if (!state.characterPlaceMode || ev.button !== 0) return;
      if (isJailPlacementBlockedTarget(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      setCharacterMoveAdjusting(true);
      setCharacterPlacementFromEvent(ev);
      setCharacterPlaceMode(false);
      setCharacterMoveAdjusting(false);
      syncCharacterMoveWidget({ persist: true, render: false });
      renderParticipants();
      refreshOpenCharacterMoveWidget();
    }, true);

    window.addEventListener("pointerdown", (ev) => {
      if (!state.prisonPlaceMode || ev.button !== 0) return;
      if (isJailPlacementBlockedTarget(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      setPrisonTransformAdjusting(true);
      setRealJailPositionFromEvent(ev);
      setRealJailPlaceMode(false);
      setPrisonTransformAdjusting(false);
      syncRealJailTransform({ persist: true, render: false });
      renderParticipants();
    }, true);

    window.addEventListener("mousedown", (ev) => {
      if (ev.button !== 1) return;
      if (isEditableTarget(ev.target)) {
        blurEditableFocus();
        return;
      }
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

    window.addEventListener("auxclick", (ev) => {
      if (ev.button === 1) {
        blurEditableFocus();
        if (!isEditableTarget(ev.target)) ev.preventDefault();
      }
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
      if (state.characterDriveMode) {
        updateCharacterDriveFromKeys(t);
      } else if (
        state.keys.has("q") || state.keys.has("e") ||
        state.keys.has("a") || state.keys.has("d") ||
        state.keys.has("w") || state.keys.has("s")
      ) {
        const yawDir =
          (state.keys.has("e") || state.keys.has("d") ? 1 : 0) -
          (state.keys.has("q") || state.keys.has("a") ? 1 : 0);
        const pitchDir = (state.keys.has("w") ? 1 : 0) - (state.keys.has("s") ? 1 : 0);
        state.view.yaw += yawDir * 0.018;
        state.view.height = clamp(state.view.height + pitchDir * 0.035, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
        updateCamera();
        saveCameraSettings();
      }
      const now = performance.now();
      const characterCount = displayedParticipantCount();
      flameOuter.scale.set(1 + Math.sin(t * 0.009) * 0.08, 1 + Math.sin(t * 0.012) * 0.12, 1);
      flameInner.scale.set(1 + Math.cos(t * 0.013) * 0.07, 1 + Math.cos(t * 0.011) * 0.1, 1);
      fireLight.intensity = 3.5 + Math.sin(t * 0.017) * 0.55;
      glow.scale.setScalar(1 + Math.sin(t * 0.005) * 0.045);
      stars.children.forEach((s, i) => {
        s.material.opacity = 0.48 + Math.sin(t * 0.0015 + i) * 0.22;
      });
      if (Math.random() < 0.011) spawnMeteor();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.position.x -= 0.052;
        m.position.y -= 0.016;
        m.userData.life -= 0.014;
        m.material.opacity = Math.max(0, m.userData.life);
        if (m.userData.life <= 0) {
          scene.remove(m);
          meteors.splice(i, 1);
        }
      }
      const effects = state.three.effects || [];
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        const age = now - effect.start;
        const progress = clamp(age / effect.life, 0, 1);
        const sec = age / 1000;
        if (effect.type === "fireworks") {
          updateFireworksEffect(effect, now, t);
        } else if (effect.type === "level") {
          updateLevelEffect(effect, now, t);
        } else {
          for (const spark of effect.particles) {
            const v = spark.userData.velocity;
            spark.position.set(v.x * sec, v.y * sec - 0.62 * sec * sec, v.z * sec);
            spark.scale.setScalar(1 + progress * 0.85);
            spark.material.opacity = Math.max(0, (1 - progress) * (0.72 + Math.sin(t * 0.02 + spark.userData.twinkle) * 0.2));
          }
        }
        if (progress >= 1) {
          scene.remove(effect.group);
          effects.splice(i, 1);
        }
      }
      if (state.three.jailGroup) {
        const hasActiveRealJailCharacter = Array.from(state.characters.values())
          .some((group) => group?.userData?.prisonKind === "real" && !group.userData.leavingUntil);
        const hasLeavingRealJail = Array.from(state.characters.values())
          .some((group) => group?.userData?.prisonKind === "real" && group.userData.leavingUntil);
        applyRealJailPosition();
        applyRealJailPresence(hasActiveRealJailCharacter || hasLeavingRealJail);
      }
      let characterClawRigUsed = false;
      for (const group of state.characters.values()) {
        const realJailed = group.userData.prisonKind === "real";
        const prisonScale = Number(group.userData.prisonScale) || 1;
        const groupLayoutCount = Number(group.userData.layoutCount) || characterCount;
        const speaking = !realJailed && (group.userData.speakingUntil || 0) > now;
        const fireHopping = !realJailed && (group.userData.fireHopUntil || 0) > now;
        const leaving = !!group.userData.leavingUntil;
        const cheerActive = realJailed ? updateCheerRig(group, now, t, true) : updateCheerRig(group, now, t, leaving);
        const levelMotion = realJailed
          ? { active: false, kind: "", offsetY: 0, scale: 1, tiltZ: 0, pulse: 0 }
          : levelCharacterMotion(group, now);
        const characterActive = speaking || fireHopping || cheerActive;
        if (leaving) {
          const start = group.userData.leavingStartedAt || now;
          const progress = clamp((now - start) / Math.max(1, group.userData.leavingUntil - start), 0, 1);
          const from = group.userData.leaveFrom || group.position;
          const to = group.userData.leaveTo || group.position;
          const mode = group.userData.exitEffect || "ascend";
          const eased = mode === "ascend" ? 1 - Math.pow(1 - progress, 2.5) : progress;
          group.position.lerpVectors(from, to, eased);
          if (mode === "ascend") group.position.y += Math.sin(progress * Math.PI) * 0.24;
          const ghost = 1 - progress;
          const exitScale = characterScale(groupLayoutCount, false) * prisonScale * (mode === "ascend" ? (1 - progress * 0.38) : 1);
          group.scale.setScalar(Math.max(0.18, exitScale));
          group.traverse((obj) => {
            if (!obj.material) return;
            if (obj.userData.isCheerStick) {
              obj.visible = false;
              return;
            }
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
          const mode = realJailed ? "drop" : (group.userData.entryEffect || "drop");
          const duration = entryDurationForMode(mode);
          const progress = clamp((now - enterStart) / duration, 0, 1);
          const entering = !group.userData.enterDone && progress < 1;
          const eased = mode === "drop" ? progress * progress : 1 - Math.pow(1 - progress, 2.4);
          const hop = mode === "drop" ? 0 : Math.sin(progress * Math.PI * 5) * (1 - progress) * 0.075;
          const claw = group.userData.clawMove;
          let clawActive = false;
          let clawProgress = 0;
          let enteringDropY = null;
          if (claw) {
            clawProgress = clamp((now - claw.start) / Math.max(1, claw.duration || 1), 0, 1);
            const from = claw.from || group.position;
            const to = claw.to || target;
            const metrics = characterClawMetrics(claw.scale || group.scale?.x || 1);
            const highHeadY = metrics.highHeadY;
            const grabHeadY = metrics.grabHeadY;
            const carryY = Math.max(0.45, highHeadY - grabHeadY);
            let x = from.x;
            let z = from.z;
            let y = 0;
            let headY = highHeadY;
            let close = 0;
            if (clawProgress < 0.25) {
              headY = grabHeadY + (highHeadY - grabHeadY) * (1 - easeInOut(clawProgress / 0.25));
            } else if (clawProgress < 0.36) {
              const p = easeOutCubic((clawProgress - 0.25) / 0.11);
              headY = grabHeadY + Math.sin(p * Math.PI) * 0.03;
              close = p;
            } else if (clawProgress < 0.52) {
              const p = easeInOut((clawProgress - 0.36) / 0.16);
              headY = grabHeadY + (highHeadY - grabHeadY) * p;
              close = 1;
              y = carryY * p;
            } else if (clawProgress < 0.74) {
              const p = easeInOut((clawProgress - 0.52) / 0.22);
              x = from.x + (to.x - from.x) * p;
              z = from.z + (to.z - from.z) * p;
              const sway = Math.sin((now - claw.start) * 0.012 + (claw.sway || 0));
              y = carryY + Math.abs(sway) * metrics.sway;
              headY = highHeadY + Math.abs(Math.sin((now - claw.start) * 0.009)) * 0.012;
              close = 1;
            } else if (clawProgress < 0.88) {
              const p = easeInOut((clawProgress - 0.74) / 0.14);
              x = to.x;
              z = to.z;
              y = carryY * (1 - p);
              headY = highHeadY + (grabHeadY - highHeadY) * p;
              close = 1;
            } else if (clawProgress < 0.95) {
              const p = easeOutCubic((clawProgress - 0.88) / 0.07);
              x = to.x;
              z = to.z;
              y = Math.sin(p * Math.PI) * metrics.releaseHop;
              headY = grabHeadY;
              close = 1 - p;
            } else {
              const p = easeOutCubic((clawProgress - 0.95) / 0.05);
              x = to.x;
              z = to.z;
              headY = grabHeadY + (highHeadY - grabHeadY) * p;
              close = 0;
            }
            const clawX = clawProgress < 0.52 ? from.x : (clawProgress < 0.74 ? x : to.x);
            const clawZ = clawProgress < 0.52 ? from.z : (clawProgress < 0.74 ? z : to.z);
            const carryActive = clawProgress > 0.36 && clawProgress < 0.88;
            const subtleSway = carryActive ? Math.sin(now * 0.014 + (claw.sway || 0)) * 0.028 * Math.max(0.55, metrics.scale) : 0;
            characterClawRigUsed = updateCharacterClawRigPose(clawX + subtleSway, clawZ, headY, close, t * 0.02, metrics) || characterClawRigUsed;
            group.position.set(x + subtleSway, y, z);
            clawActive = clawProgress < 1;
            if (!clawActive) {
              group.position.copy(target);
              delete group.userData.clawMove;
            }
          } else if (entering && group.userData.enterFrom) {
            group.position.lerpVectors(group.userData.enterFrom, target, eased);
            if (mode === "drop") enteringDropY = group.position.y;
          } else {
            const settleAlpha = now < (state.layoutSettlingUntil || 0) ? 0.045 : 0.18;
            group.position.lerp(target, settleAlpha);
          }
          const driveMoving = now < Number(group.userData.driveMoveUntil || 0);
          const driveHop = driveMoving ? Math.abs(Math.sin(t * 0.024)) * 0.085 : 0;
          const jumpStart = Number(group.userData.driveJumpStart || 0);
          const jumpUntil = Number(group.userData.driveJumpUntil || 0);
          const jumpProgress = now < jumpUntil && jumpUntil > jumpStart
            ? clamp((now - jumpStart) / (jumpUntil - jumpStart), 0, 1)
            : 1;
          const driveJump = jumpProgress < 1 ? Math.sin(jumpProgress * Math.PI) * 0.38 * Math.max(0.24, prisonScale) : 0;
          const bob = Math.sin(t * 0.003 + hashString(group.userData.key)) * 0.018
            + (characterActive ? Math.sin(t * 0.02) * 0.035 : 0)
            + driveHop
            + driveJump;
          if (clawActive) {
            group.position.y += 0;
          } else {
            group.position.y = (enteringDropY ?? 0) + hop + bob + levelMotion.offsetY;
          }
          const driveTilt = driveMoving ? Math.sin(t * 0.026) * 0.06 : 0;
          group.rotation.z = clawActive ? 0 : levelMotion.tiltZ + driveTilt;
          group.userData.clawActiveFrame = clawActive;
          group.scale.setScalar(characterScale(groupLayoutCount, characterActive) * prisonScale * levelMotion.scale);
          group.traverse((obj) => {
            if (!obj.material) return;
            if (obj.userData.isCheerStick) return;
            if (obj.userData.isGroundShadow) {
              obj.visible = true;
              const shadowX = clawActive ? group.position.x : target.x;
              const shadowZ = clawActive ? group.position.z : target.z;
              setChildWorldPose(
                obj,
                group,
                new THREE.Vector3(shadowX, 0.015, shadowZ),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
              );
              obj.material.opacity = 0.22;
              return;
            }
            if (obj.userData.isEffectBeam) {
              const inv = 1 / Math.max(0.001, group.scale.x);
              if (clawActive) {
                obj.visible = false;
                obj.material.opacity = 0;
                return;
              }
              obj.visible = entering && mode === "drop" && progress < 0.96;
              obj.material.color.setHex(0xffd36b);
              obj.material.opacity = obj.visible ? (0.82 - progress * 0.32) : 0;
              const entryFxScale = realJailed ? prisonScale : 1;
              const radius = (0.52 / 0.34) * entryFxScale * inv;
              const worldHeight = 3.35 * entryFxScale;
              setChildWorldPose(obj, group, new THREE.Vector3(target.x, worldHeight / 2, target.z));
              const length = worldHeight * inv;
              obj.scale.set(radius, length, radius);
            } else if (obj.userData.isEffectFlare) {
              if (clawActive) {
                obj.visible = false;
                obj.material.opacity = 0;
              }
            } else if (entering && mode === "fade") {
              obj.material.transparent = true;
              obj.material.opacity = progress;
            }
          });
          if (progress >= 1) {
            group.userData.enterDone = true;
            group.userData.enterFrom = null;
            if (group.userData.pendingLeave) beginCharacterLeave(group.userData.key, group, now);
          }
        }
        const stillEntering = !group.userData.enterDone || !!group.userData.clawActiveFrame;
        group.traverse((obj) => {
          if (!obj.material) return;
          if (obj.userData.isCheerStick) return;
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
          if (levelMotion.active) {
            if (levelMotion.kind === "down" && obj.material.color && obj.material.userData.originalColor) {
              obj.material.color.copy(obj.material.userData.originalColor).lerp(new THREE.Color(0x7fb6ff), levelMotion.pulse * 0.32);
            } else if (levelMotion.kind !== "down" && obj.material.emissive) {
              obj.material.emissive.setHex(0xffd45c);
              obj.material.emissiveIntensity = levelMotion.pulse * 0.16;
            }
          }
        });
        if (!stillEntering) {
          group.scale.setScalar(characterScale(groupLayoutCount, characterActive) * prisonScale * levelMotion.scale);
          const driveMoving = now < Number(group.userData.driveMoveUntil || 0);
          group.rotation.z = levelMotion.tiltZ + (driveMoving ? Math.sin(t * 0.026) * 0.06 : 0);
        }
      }
      if (!characterClawRigUsed) hideCharacterClawRig();
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
  setupChatSender();
  initThree();
  startDebugSpeech();
})();
