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
  const entryEffect = document.getElementById("entry-effect");
  const exitEffect = document.getElementById("exit-effect");
  const lifecycleSec = document.getElementById("lifecycle-sec");
  const fireUserCooldown = document.getElementById("fire-user-cooldown");
  const fireGlobalCooldown = document.getElementById("fire-global-cooldown");
  const toastStyle = document.getElementById("toast-style");
  const entryMessageTemplate = document.getElementById("entry-message-template");
  const exitMessageTemplate = document.getElementById("exit-message-template");
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
      <button id="stream-preview-toggle" type="button" title="preview show/hide">hide</button>
    </div>
    <div id="stream-preview-list"></div>
    <div id="stream-preview-resize" title="preview resize"></div>
  `;
  document.body.appendChild(streamPreviewPanel);
  const streamPreviewControls = streamPreviewPanel.querySelector("#stream-preview-controls");
  const streamPreviewDrag = streamPreviewPanel.querySelector("#stream-preview-drag");
  const streamPreviewToggle = streamPreviewPanel.querySelector("#stream-preview-toggle");
  const streamPreviewList = streamPreviewPanel.querySelector("#stream-preview-list");
  const streamPreviewResize = streamPreviewPanel.querySelector("#stream-preview-resize");
  const streamPreviewViewer = document.createElement("div");
  streamPreviewViewer.id = "stream-preview-viewer";
  streamPreviewViewer.hidden = true;
  streamPreviewViewer.innerHTML = `
    <div id="stream-viewer-bar">
      <button id="stream-viewer-drag" type="button" title="viewer move">M</button>
      <button id="stream-viewer-close" type="button" title="close">x</button>
    </div>
    <div id="stream-viewer-body"></div>
    <div id="stream-viewer-resize" title="viewer resize"></div>
  `;
  document.body.appendChild(streamPreviewViewer);
  const streamViewerBar = streamPreviewViewer.querySelector("#stream-viewer-bar");
  const streamViewerDrag = streamPreviewViewer.querySelector("#stream-viewer-drag");
  const streamViewerClose = streamPreviewViewer.querySelector("#stream-viewer-close");
  const streamViewerBody = streamPreviewViewer.querySelector("#stream-viewer-body");
  const streamViewerResize = streamPreviewViewer.querySelector("#stream-viewer-resize");
  const CHAT_SETTINGS_KEY = "videochat.chatPanelSettings.v2";
  const TOPIC_SETTINGS_KEY = "videochat.topicSettings.v1";
  const AVATAR_SETTINGS_KEY = "videochat.avatarSettings.v1";
  const CAMERA_SETTINGS_KEY = "videochat.cameraSettings.v1";
  const EFFECT_SETTINGS_KEY = "videochat.effectSettings.v1";
  const TOAST_SETTINGS_KEY = "videochat.toastSettings.v1";
  const STREAM_PREVIEW_SETTINGS_KEY = "videochat.streamPreviewSettings.v1";
  const EMOJI_PICKER_POS_KEY = "videochat.emojiPicker.v1";

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
  function richTextOptions(options = {}) {
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
    return Array.from(state.participants.values())
      .filter((p) => (!!p.video || !!p.screen) && !isSelfParticipant(p))
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
    return stream && typeof stream.url === "string" ? stream.url : "";
  }

  function fillStreamSurface(target, p, large = false) {
    target.innerHTML = "";
    const color = participantColor(p);
    const surface = document.createElement("div");
    surface.className = `stream-preview-surface ${streamPreviewKind(p)}${large ? " large" : ""}`;
    surface.style.setProperty("--stream-color", color);
    const visual = document.createElement("div");
    visual.className = "stream-preview-visual";
    const streamUrl = streamPreviewUrl(p);
    if (streamUrl) {
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
    label.textContent = streamPreviewLabel(p);
    visual.append(avatar, camera, label);
    const footer = document.createElement("div");
    footer.className = "stream-preview-footer";
    const name = document.createElement("span");
    name.className = "stream-preview-name";
    name.textContent = p.name || p.username || "Unknown";
    name.style.color = color;
    const status = document.createElement("span");
    status.className = "stream-preview-status";
    status.textContent = streamPreviewLabel(p);
    footer.append(name, status);
    surface.append(visual, footer);
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
      .map((p) => [streamParticipantKey(p), p.name, p.username, p.avatar_url, p.video ? 1 : 0, p.screen ? 1 : 0, streamPreviewUrl(p), participantColor(p)].join(":"))
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

  function applyStreamPreviewSettings() {
    if (!state.streamPreviewSettings || !streamPreviewPanel) return;
    clampStreamPreviewSettings(state.streamPreviewSettings);
    const s = state.streamPreviewSettings;
    streamPreviewPanel.style.left = `${s.x}px`;
    streamPreviewPanel.style.top = `${s.y}px`;
    streamPreviewPanel.style.width = `${s.w}px`;
    streamPreviewPanel.style.height = `${s.h}px`;
    streamPreviewPanel.classList.toggle("preview-hidden", !!s.hidden);
    if (streamPreviewToggle) streamPreviewToggle.textContent = s.hidden ? "show" : "hide";
    const viewer = s.viewer || {};
    streamPreviewViewer.style.left = `${viewer.x}px`;
    streamPreviewViewer.style.top = `${viewer.y}px`;
    streamPreviewViewer.style.width = `${viewer.w}px`;
    streamPreviewViewer.style.height = `${viewer.h}px`;
    renderStreamPreviews(true);
  }

  function setupStreamPreviewControls() {
    state.streamPreviewSettings = loadStreamPreviewSettings();
    applyStreamPreviewSettings();
    streamPreviewToggle?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.streamPreviewSettings.hidden = !state.streamPreviewSettings.hidden;
      applyStreamPreviewSettings();
      saveStreamPreviewSettings();
    });
    streamViewerClose?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      state.streamPreviewSettings.viewer.open = false;
      state.streamPreviewSettings.viewer.key = "";
      applyStreamPreviewSettings();
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
    streamViewerResize?.addEventListener("pointerdown", (ev) => begin(ev, "viewer", "resize"));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("resize", () => {
      applyStreamPreviewSettings();
      saveStreamPreviewSettings();
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
    return !!target.closest("input, textarea, select, button, [contenteditable='true'], #chat-panel");
  }

  function blurEditableFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']")) {
      active.blur();
    }
    hideMentionMenu();
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
      return Object.assign(defaultToastSettings(), raw ? JSON.parse(raw) : {}, settingSection("toast") || {});
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
        applyStreamPreviewSettings();
        storageSet(STREAM_PREVIEW_SETTINGS_KEY, JSON.stringify(state.streamPreviewSettings));
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
      el.classList.toggle("role-girl", hasRole(p, "girl"));
      el.classList.toggle("video-on", !!p.video);
      el.classList.toggle("screen-on", !!p.screen);
      el.classList.toggle("broadcasting", !!p.video || !!p.screen);
      el.classList.toggle("has-photo", !!p.avatar_url);
      el.classList.toggle("no-photo", !p.avatar_url);
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
    renderStreamPreviews();
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
    if (type === "text" && String(data.text || "").trim().toLowerCase() === "/fire") {
      return;
    }
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
      item.append(document.createTextNode(": "), msg);
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

  function triggerLevelEffect(data) {
    if (!state.three?.scene || !window.THREE) return;
    const key = speakerKey(data, true) || speakerKey(data);
    if (!key) return;
    const char = state.characters.get(key);
    if (!char) return;
    const participant = state.participants.get(key);
    const nextLevel = Number(data.new_level);
    if (participant && Number.isFinite(nextLevel)) {
      participant.level = nextLevel;
      participant.level_label = data.level_label || (participant.is_host ? "Lv. 99" : `Lv. ${nextLevel}`);
      renderParticipants();
    }
    const origin = (char.userData.target || char.position).clone();
    const upward = String(data.direction || "").toLowerCase() !== "down" && Number(data.new_level || 0) >= Number(data.old_level || 0);
    const color = upward ? new THREE.Color(0xffd45c) : new THREE.Color(0x7fb6ff);
    const group = new THREE.Group();
    group.position.copy(origin);
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
    const char = state.characters.get(key);
    if (!char) return;
    const now = performance.now();
    char.userData.fireHopStart = now;
    char.userData.fireHopUntil = now + 1300;
    const origin = (char.userData.target || char.position).clone();
    const group = new THREE.Group();
    group.position.copy(origin);
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

    state.three = { renderer, scene, camera, fireLight, effects: [] };

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
      if (isEditableTarget(ev.target)) {
        state.keys.clear();
        return;
      }
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
      if (isEditableTarget(ev.target)) {
        state.keys.delete(ev.key.toLowerCase());
        return;
      }
      const key = ev.key.toLowerCase();
      if (key === "q" || key === "e" || key === "a" || key === "d" || key === "w" || key === "s") {
        state.keys.delete(key);
        ev.preventDefault();
      }
    });

    window.addEventListener("wheel", (ev) => {
      if (isEditableTarget(ev.target)) return;
      const pitch = Math.atan2(state.view.height - state.view.target.y, state.view.distance);
      state.view.distance = Math.min(13, Math.max(4.8, state.view.distance + ev.deltaY * 0.004));
      state.view.height = clamp(state.view.target.y + Math.tan(pitch) * state.view.distance, 1.4, 8);
      updateCamera();
      saveCameraSettings();
    }, { passive: true });

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
      for (const group of state.characters.values()) {
        const speaking = (group.userData.speakingUntil || 0) > now;
        const fireHopping = (group.userData.fireHopUntil || 0) > now;
        const levelMotion = levelCharacterMotion(group, now);
        const characterActive = speaking || fireHopping;
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
          const duration = entryDurationForMode(mode);
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
          const bob = Math.sin(t * 0.003 + hashString(group.userData.key)) * 0.018 + (characterActive ? Math.sin(t * 0.02) * 0.035 : 0);
          group.position.y = (enteringDropY ?? 0) + hop + bob + levelMotion.offsetY;
          group.rotation.z = levelMotion.tiltZ;
          group.scale.setScalar(characterScale(state.participants.size, characterActive) * levelMotion.scale);
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
            if (group.userData.pendingLeave) beginCharacterLeave(group.userData.key, group, now);
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
          group.scale.setScalar(characterScale(state.participants.size, characterActive) * levelMotion.scale);
          group.rotation.z = levelMotion.tiltZ;
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
  setupChatSender();
  initThree();
  startDebugSpeech();
})();
