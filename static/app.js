(async function () {
  const chat = document.getElementById("chat");
  const sendPanel = document.getElementById("send-panel");
  const sendText = document.getElementById("send-text");
  const sendButton = document.getElementById("send-button");
  const sendFile = document.getElementById("send-file");
  const sendEmojiButton = document.getElementById("send-emoji-button");
  const sendTargets = Array.from(document.querySelectorAll(".send-target"));
  const preview = document.getElementById("send-preview");
  const previewImg = document.getElementById("send-preview-img");
  const previewName = document.getElementById("send-preview-name");
  const previewClear = document.getElementById("send-preview-clear");
  const fontDown = document.getElementById("font-down");
  const fontUp = document.getElementById("font-up");
  const sttMicButton = document.getElementById("stt-mic");
  const messageMenu = document.getElementById("message-menu");
  const menuReply = document.getElementById("menu-reply");
  const menuQuote = document.getElementById("menu-quote");
  const menuMiniJail = document.getElementById("menu-mini-jail");
  const menuRealJail = document.getElementById("menu-real-jail");
  const menuTmute = document.getElementById("menu-tmute");
  const menuDelete = document.getElementById("menu-delete");
  const mentionMenu = document.createElement("div");
  mentionMenu.id = "mention-menu";
  mentionMenu.hidden = true;
  document.body.appendChild(mentionMenu);
  const mediaLightbox = document.createElement("div");
  mediaLightbox.id = "media-lightbox";
  mediaLightbox.hidden = true;
  const mediaLightboxBody = document.createElement("div");
  mediaLightboxBody.id = "media-lightbox-body";
  mediaLightbox.appendChild(mediaLightboxBody);
  document.body.appendChild(mediaLightbox);
  const MAX_MESSAGES = 50;
  const FONT_SIZE_KEY = "tg-chat-overlay.fontSize.v1";
  const EMOJI_PICKER_POS_KEY = "tg-chat-overlay.emojiPicker.v1";
  const COMMENT_THREAD_PREFIX = "(댓) ";
  const TMUTE_DURATION_MS = 60 * 1000;
  let fadeAfterSec = 30;
  let chatFontSize = null;
  let userSendEnabled = false;
  let selectedPhoto = null;
  let selectedSticker = null;
  let selectedCustomEmoji = null;
  let customEmojiEntities = [];
  let replyTo = null;
  let menuTarget = null;
  let menuTmuteRefreshTimer = 0;
  let mentionTimer = null;
  let mentionToken = null;
  let mentionSelected = 0;
  let sendInFlight = false;
  let maxPhotoBytes = 8 * 1024 * 1024;
  let maxMediaBytes = 50 * 1024 * 1024;
  let controlWs = null;
  let sharedLinkPreview = null;
  let emojiPicker = null;
  let emojiCache = { stickers: [], custom_emoji: [] };
  let emojiCacheLoadedAt = 0;
  let remoteStt = null;
  const deletedMessageKeys = new Set();
  let nativeActionState = { users: [] };
  const localTmuteUntilByKey = new Map();
  const stickerPreviewQueue = [];
  let stickerPreviewActive = 0;
  let emojiPickerDragging = false;
  let emojiPickerSuppressClickUntil = 0;
  const clientId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  function appendRichText(target, text, options = {}) {
    if (window.TgChatCore?.appendRichText) {
      window.TgChatCore.appendRichText(target, text, richTextOptions(options));
    } else {
      target.textContent = text;
    }
  }

  function richTextOptions(options = {}) {
    if (!sharedLinkPreview && window.TgChatCore?.createLinkPreview) {
      sharedLinkPreview = window.TgChatCore.createLinkPreview("link-preview", {
        onControl: (payload) => sendControlEvent(payload),
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

  function messageKeyFromRef(ref) {
    if (!ref?.chat_id || !ref?.message_id) return "";
    return `${ref.chat_id}:${ref.message_id}`;
  }

  function splitCommentThreadText(text, entities = []) {
    const raw = String(text || "");
    if (!raw.startsWith(COMMENT_THREAD_PREFIX)) {
      return { prefix: "", text: raw, entities: entities || [] };
    }
    const offset = COMMENT_THREAD_PREFIX.length;
    return {
      prefix: COMMENT_THREAD_PREFIX.trim(),
      text: raw.slice(offset),
      entities: (entities || [])
        .filter((item) => Number(item?.offset) >= offset)
        .map((item) => ({ ...item, offset: Number(item.offset) - offset })),
    };
  }

  function appendMessageText(target, text, options = {}) {
    const split = splitCommentThreadText(text, options.entities || []);
    if (split.prefix) {
      const prefix = document.createElement("span");
      prefix.className = "comment-prefix";
      prefix.dataset.noQuote = "1";
      prefix.textContent = split.prefix;
      target.appendChild(prefix);
    }
    appendRichText(target, split.text, { ...options, entities: split.entities });
  }

  function nativeChatActionUser(data) {
    return {
      name: data?.name || data?.username || "Unknown",
      username: data?.username || "",
      speaker_id: data?.speaker_id || "",
      is_host: !!data?.is_host,
      is_bot: !!data?.is_bot,
      message: data?.message || null,
    };
  }

  function sendNativeChatAction(action, data) {
    try {
      window.tgNativeChatHost?.sendAction?.({
        action,
        user: nativeChatActionUser(data),
      });
    } catch (_) {}
  }

  function actionIdentityCandidates(data) {
    const values = [];
    const add = (prefix, value) => {
      const text = String(value || "").replace(/^@/, "").trim();
      if (text) values.push(`${prefix}:${text.toLowerCase()}`);
    };
    add("id", data?.speaker_id || data?.id);
    add("speaker", data?.speaker_id || data?.id);
    add("username", data?.username);
    add("name", data?.name);
    return [...new Set(values)];
  }

  function nativeUserStateForData(data) {
    const candidates = new Set(actionIdentityCandidates(data));
    for (const user of nativeActionState?.users || []) {
      const userCandidates = actionIdentityCandidates(user);
      userCandidates.push(`key:${String(user.key || "").toLowerCase()}`);
      if (userCandidates.some((candidate) => candidates.has(candidate))) return user;
    }
    return null;
  }

  function localTmuteKey(data) {
    return actionIdentityCandidates(data)[0] || String(data?.name || data?.username || "unknown").toLowerCase();
  }

  function pruneLocalTmuteState(now = Date.now()) {
    for (const [key, until] of localTmuteUntilByKey) {
      if (!Number.isFinite(Number(until)) || Number(until) <= now) localTmuteUntilByKey.delete(key);
    }
  }

  function tmuteUntilForData(data) {
    pruneLocalTmuteState();
    const localUntil = Number(localTmuteUntilByKey.get(localTmuteKey(data))) || 0;
    const remoteUntil = Number(nativeUserStateForData(data)?.tmute_until) || 0;
    return Math.max(localUntil, remoteUntil);
  }

  function setLocalTmuteState(data, active) {
    const key = localTmuteKey(data);
    if (!key) return;
    if (active) localTmuteUntilByKey.set(key, Date.now() + TMUTE_DURATION_MS);
    else localTmuteUntilByKey.delete(key);
    updateMessageMenuButtons();
  }

  function scheduleMessageMenuTmuteRefresh() {
    if (menuTmuteRefreshTimer) {
      clearTimeout(menuTmuteRefreshTimer);
      menuTmuteRefreshTimer = 0;
    }
    const until = tmuteUntilForData(menuTarget?.data);
    if (!until) return;
    menuTmuteRefreshTimer = setTimeout(() => {
      menuTmuteRefreshTimer = 0;
      updateMessageMenuButtons();
    }, Math.max(80, until - Date.now() + 80));
  }

  function setMenuButtonActive(button, active, activeText, inactiveText) {
    if (!button) return;
    button.classList.toggle("active-danger", !!active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    if (activeText && inactiveText) button.textContent = active ? activeText : inactiveText;
  }

  function updateMessageMenuButtons() {
    if (!messageMenu || messageMenu.hidden || !menuTarget) return;
    const userState = nativeUserStateForData(menuTarget.data);
    setMenuButtonActive(menuMiniJail, !!userState?.mini, "난쟁이 해제", "난쟁이");
    setMenuButtonActive(menuRealJail, !!userState?.real, "케이지 해제", "케이지");
    setMenuButtonActive(menuTmute, tmuteUntilForData(menuTarget.data) > Date.now(), "아가리 해제", "아가리");
    scheduleMessageMenuTmuteRefresh();
  }

  window.tgNativeChatHost?.onActionState?.((payload) => {
    nativeActionState = payload && typeof payload === "object" ? payload : { users: [] };
    const chatSettings = nativeActionState.chat;
    if (chatSettings && typeof chatSettings === "object") {
      if (Number.isFinite(Number(chatSettings.fontSize))) {
        applyFontSize(Number(chatSettings.fontSize));
      }
      if (Number.isFinite(Number(chatSettings.fadeSec))) {
        fadeAfterSec = Number(chatSettings.fadeSec);
      }
    }
    updateMessageMenuButtons();
  });

  function selectedTargets() {
    return sendTargets
      .filter((btn) => btn.classList.contains("active") && !btn.disabled)
      .map((btn) => btn.dataset.target);
  }

  function updateSendButton() {
    if (!sendButton || !sendText) return;
    const hasBody = !!sendText.value.trim() || !!selectedPhoto || !!selectedSticker || !!selectedCustomEmoji;
    document.body.classList.toggle("send-panel-has-draft", !!(hasBody || replyTo));
    sendButton.disabled = sendInFlight || !userSendEnabled || !hasBody || (!replyTo && selectedTargets().length === 0);
  }

  function remoteSttTarget() {
    const targets = selectedTargets();
    return targets.includes("here") ? "here" : "main";
  }

  function updateRemoteSttButton(state = "") {
    if (!sttMicButton) return;
    const active = !!remoteStt;
    sttMicButton.classList.toggle("active", active);
    sttMicButton.classList.toggle("connecting", state === "connecting");
    sttMicButton.textContent = active ? "mic on" : (state === "connecting" ? "mic..." : "mic");
  }

  function downsamplePcm16(input, sourceRate, targetRate) {
    if (!input?.length || !sourceRate || !targetRate) return new ArrayBuffer(0);
    const ratio = sourceRate / targetRate;
    const length = Math.max(1, Math.floor(input.length / ratio));
    const output = new Int16Array(length);
    for (let i = 0; i < length; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(input.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j += 1) {
        sum += input[j];
        count += 1;
      }
      const sample = Math.max(-1, Math.min(1, count ? sum / count : input[start] || 0));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output.buffer;
  }

  function stopRemoteStt() {
    const current = remoteStt;
    remoteStt = null;
    updateRemoteSttButton();
    try { current?.processor?.disconnect(); } catch (_) {}
    try { current?.source?.disconnect(); } catch (_) {}
    try { current?.silence?.disconnect(); } catch (_) {}
    try { current?.stream?.getTracks?.().forEach((track) => track.stop()); } catch (_) {}
    try { current?.ws?.close(); } catch (_) {}
    try { current?.ctx?.close(); } catch (_) {}
  }

  function waitForRemoteSttReady(ws) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("remote STT timeout")), 12000);
      ws.addEventListener("message", (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "ready") {
            window.clearTimeout(timer);
            resolve(data);
          } else if (data.type === "error") {
            window.clearTimeout(timer);
            reject(new Error(data.message || "remote STT failed"));
          }
        } catch (_) {}
      });
      ws.addEventListener("close", () => {
        window.clearTimeout(timer);
        reject(new Error("remote STT closed"));
      }, { once: true });
      ws.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new Error("remote STT websocket error"));
      }, { once: true });
    });
  }

  async function startRemoteStt() {
    if (remoteStt || !sttMicButton) return;
    updateRemoteSttButton("connecting");
    let ws = null;
    let stream = null;
    let ctx = null;
    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/api/stt/remote/ws?target=${encodeURIComponent(remoteSttTarget())}`);
      ws.binaryType = "arraybuffer";
      const readyPromise = waitForRemoteSttReady(ws);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const ready = await readyPromise;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") await ctx.resume();
      const targetRate = Number(ready.sample_rate) || 24000;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      processor.onaudioprocess = (ev) => {
        if (!remoteStt || ws.readyState !== WebSocket.OPEN) return;
        const pcm = downsamplePcm16(ev.inputBuffer.getChannelData(0), ctx.sampleRate, targetRate);
        if (pcm.byteLength) ws.send(pcm);
      };
      source.connect(processor);
      processor.connect(silence);
      silence.connect(ctx.destination);
      remoteStt = { ws, stream, ctx, source, processor, silence };
      ws.addEventListener("close", stopRemoteStt, { once: true });
      updateRemoteSttButton();
    } catch (err) {
      try { ws?.close(); } catch (_) {}
      try { stream?.getTracks?.().forEach((track) => track.stop()); } catch (_) {}
      try { ctx?.close(); } catch (_) {}
      remoteStt = null;
      updateRemoteSttButton();
      sttMicButton.title = err?.message || "remote STT failed";
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function applyFontSize(size) {
    chatFontSize = clamp(Number(size) || 22, 12, 96);
    document.documentElement.style.setProperty("--msg-font-size", chatFontSize + "px");
    try { localStorage.setItem(FONT_SIZE_KEY, String(chatFontSize)); } catch (_) {}
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
    return type.startsWith("video/") ? maxMediaBytes : maxPhotoBytes;
  }

  async function refreshSendStatus() {
    if (!userSendEnabled) return;
    try {
      const status = await fetch("/api/send/status").then((r) => r.json());
      for (const btn of sendTargets) {
        const available = !!status.targets?.[btn.dataset.target];
        btn.disabled = !available;
        if (!available) btn.classList.remove("active");
      }
      updateSendButton();
    } catch (_) {}
  }

  try {
    const cfg = await fetch("/config").then((r) => r.json());
    if (typeof cfg.fade_after_sec === "number") {
      fadeAfterSec = cfg.fade_after_sec;
    }
    if (typeof cfg.chat_font_size === "number" && cfg.chat_font_size > 0) {
      chatFontSize = cfg.chat_font_size;
    }
    const savedFontSize = Number(localStorage.getItem(FONT_SIZE_KEY));
    applyFontSize(Number.isFinite(savedFontSize) && savedFontSize > 0 ? savedFontSize : chatFontSize || 22);
    userSendEnabled = !!cfg.user_send_enabled;
    if (typeof cfg.user_send_max_photo_mb === "number") {
      maxPhotoBytes = Math.max(1, cfg.user_send_max_photo_mb) * 1024 * 1024;
    }
    if (typeof cfg.user_send_max_media_mb === "number") {
      maxMediaBytes = Math.max(1, cfg.user_send_max_media_mb) * 1024 * 1024;
    }
    if (sendPanel && cfg.user_send_panel && userSendEnabled) {
      sendPanel.hidden = false;
      document.body.classList.add("send-panel-visible");
      await refreshSendStatus();
      setInterval(refreshSendStatus, 2500);
    }
    if (sendText && typeof cfg.user_send_max_chars === "number") {
      sendText.maxLength = cfg.user_send_max_chars;
    }
  } catch (_) {}

  function setPhoto(file) {
    if (!file) return;
    if (!isSupportedSendFile(file)) return;
    if (file.size > maxBytesForSendFile(file)) {
      sendPanel?.classList.add("send-error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const mime = sendFileMime(file) || "image/jpeg";
      selectedSticker = null;
      selectedCustomEmoji = null;
      selectedPhoto = {
        name: file.name || "image.jpg",
        mime,
        data: String(reader.result || ""),
      };
      setSendPreviewMedia({ url: selectedPhoto.data, media_type: mime.startsWith("image/") ? "image" : "video" });
      if (previewName) previewName.textContent = selectedPhoto.name;
      if (preview) preview.hidden = false;
      sendPanel?.classList.remove("send-error");
      updateSendButton();
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    selectedPhoto = null;
    selectedSticker = null;
    selectedCustomEmoji = null;
    clearSendPreviewMedia();
    if (previewImg) previewImg.removeAttribute("src");
    if (previewImg) previewImg.hidden = false;
    if (previewName) previewName.textContent = "";
    if (preview) preview.hidden = true;
    if (sendFile) sendFile.value = "";
    updateSendButton();
  }

  function ensureReplyPreview() {
    let box = document.getElementById("reply-preview");
    if (box || !sendText?.parentElement) return box;
    box = document.createElement("div");
    box.id = "reply-preview";
    box.hidden = true;
    const label = document.createElement("span");
    label.id = "reply-preview-label";
    const clear = document.createElement("button");
    clear.id = "reply-preview-clear";
    clear.type = "button";
    clear.textContent = "x";
    clear.title = "답장 취소";
    clear.addEventListener("click", clearReply);
    box.append(label, clear);
    sendText.parentElement.insertBefore(box, sendText);
    return box;
  }

  function setReply(data, quoteText = "") {
    if (!data?.message?.chat_id || !data?.message?.message_id) return;
    const quote = window.TgChatCore?.normalizeQuoteText
      ? window.TgChatCore.normalizeQuoteText(quoteText, 1024)
      : String(quoteText || "").replace(/\r/g, "").slice(0, 1024);
    replyTo = { ...data.message };
    if (quote) replyTo.quote_text = quote;
    const box = ensureReplyPreview();
    const label = document.getElementById("reply-preview-label");
    if (label) label.textContent = `${quote ? "인용" : "답장"}: ${data.name || "Unknown"}`;
    if (box) box.hidden = false;
    sendText?.focus();
    updateSendButton();
  }

  function clearReply() {
    replyTo = null;
    const box = document.getElementById("reply-preview");
    if (box) box.hidden = true;
    updateSendButton();
  }

  async function sendMessage(text, targets, photo, reply) {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targets, photo, sticker: selectedSticker, custom_emoji: selectedCustomEmoji, custom_entities: customEmojiEntities, reply_to: reply }),
    });
    if (!res.ok) {
      let detail = "send failed";
      try {
        const body = await res.json();
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  async function deleteMessage(ref) {
    const res = await fetch("/api/message/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!res.ok) {
      let detail = "delete failed";
      try {
        const body = await res.json();
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
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

  function sendControlEvent(payload) {
    try {
      if (controlWs?.readyState === WebSocket.OPEN) {
        controlWs.send(JSON.stringify({ type: "chat_control", client_id: clientId, ...payload }));
      }
    } catch (_) {}
  }

  function closeMediaLightbox(sync = true) {
    mediaLightbox.hidden = true;
    mediaLightboxBody.replaceChildren();
    if (sync) sendControlEvent({ action: "media_lightbox_close" });
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
    if (sync) sendControlEvent({ action: "media_lightbox_open", src, tag: full.tagName });
  }

  function openMediaLightbox(media, sync = true) {
    if (!media?.src) return;
    openMediaLightboxSource(media.src, media.tagName, sync);
  }

  mediaLightbox.addEventListener("click", closeMediaLightbox);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !mediaLightbox.hidden) closeMediaLightbox();
  });

  function chatIsAtBottom() {
    return chat.scrollHeight - chat.scrollTop - chat.clientHeight < 48;
  }

  function scrollChatToBottom() {
    const settle = () => {
      chat.scrollTop = chat.scrollHeight;
      chat.scrollTo({ top: chat.scrollHeight, behavior: "auto" });
    };
    requestAnimationFrame(settle);
    setTimeout(settle, 50);
  }

  function keepBottomAfterMediaLoad(media, shouldStickToBottom) {
    if (!shouldStickToBottom) return;
    const settle = () => scrollChatToBottom();
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

  function clearSendPreviewMedia() {
    preview?.querySelector(".send-preview-media")?.remove();
  }

  function setSendPreviewMedia(item) {
    clearSendPreviewMedia();
    if (!previewImg || !preview) return;
    if (item?.media_type === "image" && item.url) {
      previewImg.hidden = false;
      previewImg.src = item.url;
      return;
    }
    previewImg.hidden = true;
    previewImg.removeAttribute("src");
    if (!item?.url) return;
    const slot = document.createElement("div");
    slot.className = "send-preview-media";
    slot.appendChild(createMediaElement({ url: item.url, media_type: item.media_type || "image" }));
    preview.insertBefore(slot, previewName || previewClear || null);
  }

  async function refreshEmojiCache() {
    if (Date.now() - emojiCacheLoadedAt < 60000 && (emojiCache.stickers.length || emojiCache.custom_emoji.length)) {
      return;
    }
    try {
      const body = await fetch("/api/emoji/recent").then((r) => r.json());
      emojiCache = {
        stickers: Array.isArray(body.stickers) ? body.stickers : [],
        custom_emoji: Array.isArray(body.custom_emoji) ? body.custom_emoji : [],
      };
      emojiCacheLoadedAt = Date.now();
    } catch (_) {
      emojiCache = { stickers: [], custom_emoji: [] };
      emojiCacheLoadedAt = 0;
    }
  }

  function ensureEmojiPicker() {
    if (emojiPicker) return emojiPicker;
    emojiPicker = document.createElement("div");
    emojiPicker.className = "emoji-picker";
    emojiPicker.hidden = true;
    emojiPicker.innerHTML = '<div class="emoji-picker-head"><span>drag</span><span>recent / sticker / premium</span></div><div class="emoji-picker-grid"></div>';
    document.body.appendChild(emojiPicker);
    emojiPicker.addEventListener("click", (ev) => ev.stopPropagation());
    emojiPicker.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    emojiPicker.addEventListener("wheel", (ev) => ev.stopPropagation(), { passive: true });
    bindEmojiPickerDrag(emojiPicker);
    return emojiPicker;
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
        emojiPickerDragging = true;
        const left = Math.min(Math.max(8, start.left + moveEv.clientX - start.x), Math.max(8, window.innerWidth - rect.width - 8));
        const top = Math.min(Math.max(8, start.top + moveEv.clientY - start.y), Math.max(8, window.innerHeight - rect.height - 8));
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
        picker.style.bottom = "auto";
        try { localStorage.setItem(EMOJI_PICKER_POS_KEY, JSON.stringify({ left, top })); } catch (_) {}
      };
      const up = () => {
        if (emojiPickerDragging) emojiPickerSuppressClickUntil = Date.now() + 220;
        emojiPickerDragging = false;
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
    let box = document.getElementById("send-rich-preview");
    if (box || !sendText?.parentElement) return box;
    box = document.createElement("div");
    box.id = "send-rich-preview";
    box.className = "composer-rich-preview";
    box.hidden = true;
    sendText.parentElement.insertBefore(box, sendText.nextSibling);
    return box;
  }

  function updateComposerPreview() {
    const box = ensureComposerPreview();
    if (!box || !sendText) return;
    box.replaceChildren();
    if (!customEmojiEntities.length || !sendText.value) {
      box.hidden = true;
      return;
    }
    appendRichText(box, sendText.value, { entities: customEmojiEntities });
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
      const cached = emojiCache.stickers.find((row) => (row.key || row.file_unique_id || row.document_id) === key);
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
    while (stickerPreviewActive < 3 && stickerPreviewQueue.length) {
      const job = stickerPreviewQueue.shift();
      if (!job?.btn || !job.item || !document.contains(job.btn)) continue;
      delete job.btn.dataset.previewQueued;
      stickerPreviewActive += 1;
      hydrateStickerPreview(job.btn, job.item).finally(() => {
        stickerPreviewActive = Math.max(0, stickerPreviewActive - 1);
        runStickerPreviewQueue();
      });
    }
  }

  function enqueueStickerPreview(btn, item) {
    if (!btn || btn.dataset.previewQueued || btn.dataset.previewLoading) return;
    if (!(item.file_id || item.can_send_as_user || item.document_id)) return;
    btn.dataset.previewQueued = "1";
    stickerPreviewQueue.push({ btn, item });
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

  function selectSticker(item) {
    selectedPhoto = null;
    selectedCustomEmoji = null;
    selectedSticker = stickerSendPayload(item);
    setSendPreviewMedia(item);
    if (previewName) previewName.textContent = item.emoji ? `sticker ${item.emoji}` : "sticker";
    if (preview) preview.hidden = false;
    updateSendButton();
  }

  function selectCustomEmoji(item) {
    if (!sendText || !item.custom_emoji_id) return;
    const emoji = firstEmojiFallback(item.emoji || "*");
    const start = sendText.selectionStart ?? sendText.value.length;
    const end = sendText.selectionEnd ?? start;
    sendText.value = sendText.value.slice(0, start) + emoji + sendText.value.slice(end);
    customEmojiEntities = customEmojiEntities
      .filter((entity) => entity.offset < start || entity.offset >= end)
      .map((entity) => entity.offset >= end ? { ...entity, offset: entity.offset + emoji.length - (end - start) } : entity);
    customEmojiEntities.push({ type: "custom_emoji", offset: start, length: emoji.length, custom_emoji_id: String(item.custom_emoji_id), emoji });
    const pos = start + emoji.length;
    sendText.setSelectionRange(pos, pos);
    sendText.focus();
    updateComposerPreview();
    updateSendButton();
  }

  function reconcileCustomEmojiEntities() {
    if (!sendText || !customEmojiEntities.length) return;
    const value = sendText.value;
    customEmojiEntities = customEmojiEntities.filter((entity) => {
      const offset = Number(entity.offset);
      const length = Number(entity.length);
      if (!Number.isFinite(offset) || !Number.isFinite(length) || offset < 0 || length <= 0) return false;
      return value.slice(offset, offset + length) === (entity.emoji || value.slice(offset, offset + length));
    });
    updateComposerPreview();
  }

  function positionEmojiPicker() {
    if (!emojiPicker || !sendEmojiButton) return;
    try {
      const saved = JSON.parse(localStorage.getItem(EMOJI_PICKER_POS_KEY) || "null");
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        emojiPicker.style.left = `${Math.min(Math.max(8, saved.left), Math.max(8, window.innerWidth - 568))}px`;
        emojiPicker.style.top = `${Math.min(Math.max(8, saved.top), Math.max(8, window.innerHeight - 120))}px`;
        emojiPicker.style.bottom = "auto";
        return;
      }
    } catch (_) {}
    const rect = sendEmojiButton.getBoundingClientRect();
    emojiPicker.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - 568)}px`;
    emojiPicker.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;
    emojiPicker.style.top = "auto";
  }

  async function showEmojiPicker() {
    const picker = ensureEmojiPicker();
    await refreshEmojiCache();
    const grid = picker.querySelector(".emoji-picker-grid");
    grid.replaceChildren();
    const stickerItems = emojiCache.stickers.map((item) => ({ ...item, _kind: "sticker" }));
    const recentItems = stickerItems.filter((item) => item.source === "telegram_recent");
    const cachedItems = stickerItems.filter((item) => item.source !== "telegram_recent");
    const premiumItems = emojiCache.custom_emoji.map((item) => ({ ...item, _kind: "custom_emoji" }));
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
    if (!force && Date.now() < emojiPickerSuppressClickUntil) return;
    if (emojiPicker) emojiPicker.hidden = true;
  }

  function createReplyQuote(reply) {
    if (!reply || (!reply.name && !reply.text)) return null;
    const quote = document.createElement("div");
    quote.className = "reply-quote";
    const targetKey = messageKeyFromRef(reply.message);
    if (reply.message?.chat_id && reply.message?.message_id) {
      quote.dataset.replyTargetKey = targetKey;
      quote.title = "인용 메시지로 이동";
    }
    const deleted = targetKey && deletedMessageKeys.has(targetKey);
    if (deleted) quote.classList.add("deleted-reply");
    const name = document.createElement("span");
    name.className = "reply-name";
    name.textContent = deleted ? "" : (reply.name || "Unknown");
    const text = document.createElement("span");
    text.className = "reply-text";
    text.textContent = deleted ? "삭제된 메시지" : (reply.quote_text || reply.text || "메시지");
    quote.append(name, text);
    quote.addEventListener("click", (ev) => {
      ev.stopPropagation();
      focusMessageByKey(quote.dataset.replyTargetKey);
    });
    return quote;
  }

  function markReplyQuotesDeleted(key) {
    if (!key) return;
    for (const quote of Array.from(document.querySelectorAll(`.reply-quote[data-reply-target-key="${CSS.escape(key)}"]`))) {
      quote.classList.add("deleted-reply");
      const name = quote.querySelector(".reply-name");
      const text = quote.querySelector(".reply-text");
      if (name) name.textContent = "";
      if (text) text.textContent = "삭제된 메시지";
    }
  }

  function hideMessageMenu() {
    if (messageMenu) messageMenu.hidden = true;
    if (menuQuote) menuQuote.hidden = true;
    if (menuTmuteRefreshTimer) {
      clearTimeout(menuTmuteRefreshTimer);
      menuTmuteRefreshTimer = 0;
    }
    menuTarget = null;
  }

  function hideMentionMenu() {
    mentionMenu.hidden = true;
    mentionMenu.replaceChildren();
    mentionToken = null;
    mentionSelected = 0;
  }

  function mentionAtCaret() {
    if (!sendText) return null;
    const pos = sendText.selectionStart;
    const before = sendText.value.slice(0, pos);
    const match = before.match(/(^|\s)@([^\s@]{1,32})$/);
    if (!match) return null;
    const query = match[2];
    return {
      query,
      start: pos - query.length - 1,
      end: pos,
    };
  }

  function positionMentionMenu() {
    if (!sendPanel) return;
    const rect = sendPanel.getBoundingClientRect();
    mentionMenu.style.left = rect.left + "px";
    mentionMenu.style.bottom = Math.max(8, window.innerHeight - rect.top + 6) + "px";
    mentionMenu.style.width = Math.min(320, rect.width) + "px";
  }

  function renderMentionMenu(users) {
    mentionMenu.replaceChildren();
    if (!users.length || !mentionToken) {
      hideMentionMenu();
      return;
    }
    users.forEach((user, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mention-item" + (index === mentionSelected ? " active" : "");
      btn.disabled = !user.can_tag;
      const name = document.createElement("span");
      name.className = "mention-name";
      name.textContent = user.name || "Unknown";
      const handle = document.createElement("span");
      handle.className = "mention-handle";
      handle.textContent = user.username ? `@${user.username}` : "username 없음";
      btn.append(name, handle);
      btn.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        chooseMention(user);
      });
      mentionMenu.appendChild(btn);
    });
    positionMentionMenu();
    mentionMenu.hidden = false;
  }

  async function searchMentions(query) {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.users) ? body.users : [];
  }

  function scheduleMentionSearch() {
    clearTimeout(mentionTimer);
    const token = mentionAtCaret();
    if (!token) {
      hideMentionMenu();
      return;
    }
    mentionToken = token;
    mentionTimer = setTimeout(async () => {
      try {
        const users = await searchMentions(token.query);
        if (!mentionToken || mentionToken.query !== token.query) return;
        mentionSelected = 0;
        renderMentionMenu(users);
      } catch (_) {
        hideMentionMenu();
      }
    }, 180);
  }

  function chooseMention(user) {
    if (!sendText || !mentionToken || !user?.can_tag) return;
    const insert = `${user.insert} `;
    const value = sendText.value;
    sendText.value = value.slice(0, mentionToken.start) + insert + value.slice(mentionToken.end);
    const pos = mentionToken.start + insert.length;
    sendText.setSelectionRange(pos, pos);
    hideMentionMenu();
    updateSendButton();
    sendText.focus();
  }

  function chooseSelectedMention() {
    const items = Array.from(mentionMenu.querySelectorAll(".mention-item:not(:disabled)"));
    if (!items.length) return false;
    items[Math.min(mentionSelected, items.length - 1)].dispatchEvent(new MouseEvent("mousedown"));
    return true;
  }

  function moveMentionSelection(delta) {
    const items = Array.from(mentionMenu.querySelectorAll(".mention-item:not(:disabled)"));
    if (!items.length) return false;
    mentionSelected = (mentionSelected + delta + items.length) % items.length;
    for (const item of mentionMenu.querySelectorAll(".mention-item")) {
      item.classList.remove("active");
    }
    items[mentionSelected].classList.add("active");
    return true;
  }

  function showMessageMenu(ev, data, el) {
    if (!messageMenu || !data?.message?.chat_id || !data?.message?.message_id) return;
    ev.preventDefault();
    ev.stopPropagation();
    const quoteText = selectedTextWithin(el);
    menuTarget = { data, el, quoteText };
    if (menuQuote) menuQuote.hidden = !quoteText;
    messageMenu.hidden = false;
    updateMessageMenuButtons();
    const w = messageMenu.offsetWidth || 120;
    const h = messageMenu.offsetHeight || 80;
    messageMenu.style.left = clamp(ev.clientX, 6, window.innerWidth - w - 6) + "px";
    messageMenu.style.top = clamp(ev.clientY, 6, window.innerHeight - h - 6) + "px";
  }

  function removeMessageByRef(ref) {
    const key = messageKeyFromRef(ref);
    if (!key) return;
    deletedMessageKeys.add(key);
    markReplyQuotesDeleted(key);
    for (const el of Array.from(document.querySelectorAll(".msg[data-message-key]"))) {
      if (el.dataset.messageKey === key) removeMessageElement(el);
    }
  }

  function removeMessageElement(el) {
    if (!el || el.classList.contains("delete-out")) return;
    el.style.maxHeight = `${el.scrollHeight}px`;
    el.classList.add("delete-out");
    setTimeout(() => el.remove(), 520);
  }

  function focusMessageByKey(key) {
    if (!key) return;
    const target = document.querySelector(`.msg[data-message-key="${CSS.escape(key)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    target.classList.remove("jump-highlight");
    requestAnimationFrame(() => target.classList.add("jump-highlight"));
    setTimeout(() => target.classList.remove("jump-highlight"), 1400);
  }

  for (const btn of sendTargets) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      btn.classList.toggle("active");
      updateSendButton();
    });
  }

  sendFile?.addEventListener("change", () => setPhoto(sendFile.files?.[0]));
  sendEmojiButton?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (Date.now() < emojiPickerSuppressClickUntil) return;
    if (emojiPicker && !emojiPicker.hidden) {
      hideEmojiPicker(true);
    } else {
      showEmojiPicker();
    }
  });
  previewClear?.addEventListener("click", clearPhoto);
  sendText?.addEventListener("input", () => {
    if (!sendText.value) customEmojiEntities = [];
    else reconcileCustomEmojiEntities();
    updateComposerPreview();
    updateSendButton();
    scheduleMentionSearch();
  });
  fontDown?.addEventListener("click", () => applyFontSize((chatFontSize || 22) - 2));
  fontUp?.addEventListener("click", () => applyFontSize((chatFontSize || 22) + 2));
  sttMicButton?.addEventListener("click", () => {
    if (remoteStt) stopRemoteStt();
    else startRemoteStt();
  });
  const bindMessageMenuAction = (button, handler) => {
    if (!button) return;
    let handledAt = 0;
    const run = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (button.disabled) return;
      const now = Date.now();
      if (now - handledAt < 220) return;
      handledAt = now;
      handler(ev);
    };
    button.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
    button.addEventListener("pointerup", run, true);
    button.addEventListener("click", run, true);
    button.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") run(ev);
    });
  };
  messageMenu?.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
  }, true);
  messageMenu?.addEventListener("click", (ev) => {
    ev.stopPropagation();
  }, true);
  bindMessageMenuAction(menuReply, () => {
    if (menuTarget) setReply(menuTarget.data);
    hideMessageMenu();
  });
  bindMessageMenuAction(menuQuote, () => {
    if (menuTarget?.quoteText) setReply(menuTarget.data, menuTarget.quoteText);
    hideMessageMenu();
  });
  bindMessageMenuAction(menuMiniJail, () => {
    if (menuTarget) sendNativeChatAction("mini_jail", menuTarget.data);
    hideMessageMenu();
  });
  bindMessageMenuAction(menuRealJail, () => {
    if (menuTarget) sendNativeChatAction("real_jail", menuTarget.data);
    hideMessageMenu();
  });
  bindMessageMenuAction(menuTmute, async () => {
    const target = menuTarget;
    const active = tmuteUntilForData(target?.data) > Date.now();
    hideMessageMenu();
    if (!target) return;
    try {
      await sendMessage(active ? "/unmute" : "/tmute 1m", [], null, target.data.message);
      setLocalTmuteState(target.data, !active);
      sendNativeChatAction(active ? "tmute_clear" : "tmute", target.data);
    } catch (err) {
      sendPanel?.classList.add("send-error");
      if (sendText) sendText.title = err?.message || "tmute failed";
    }
  });
  bindMessageMenuAction(menuDelete, async () => {
    const target = menuTarget;
    hideMessageMenu();
    if (!target) return;
    try {
      await deleteMessage(target.data.message);
      removeMessageByRef(target.data.message);
    } catch (err) {
      sendPanel?.classList.add("send-error");
      if (sendText) sendText.title = err?.message || "delete failed";
    }
  });
  document.addEventListener("click", (ev) => {
    if (messageMenu && !messageMenu.hidden && ev.target instanceof Node && messageMenu.contains(ev.target)) return;
    hideMessageMenu();
  });
  document.addEventListener("click", hideEmojiPicker);
  window.addEventListener("resize", positionMentionMenu);
  window.addEventListener("resize", positionEmojiPicker);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      hideMessageMenu();
      hideMentionMenu();
      hideEmojiPicker(true);
      clearReply();
    }
  });

  sendPanel?.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    sendPanel.classList.add("drag-over");
  });
  sendPanel?.addEventListener("dragleave", () => sendPanel.classList.remove("drag-over"));
  sendPanel?.addEventListener("drop", (ev) => {
    ev.preventDefault();
    sendPanel.classList.remove("drag-over");
    const file = Array.from(ev.dataTransfer?.files || []).find(isSupportedSendFile);
    setPhoto(file);
  });

  sendPanel?.addEventListener("paste", (ev) => {
    const file = Array.from(ev.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .find((f) => f && isSupportedSendFile(f));
    if (!file) return;
    setPhoto(file);
    if (!ev.clipboardData?.getData("text/plain")) {
      ev.preventDefault();
    }
  });

  sendPanel?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (sendInFlight) return;
    if (!userSendEnabled || !sendText || !sendButton) return;
    const text = sendText.value;
    const targets = selectedTargets();
    if ((!text.trim() && !selectedPhoto && !selectedSticker && !selectedCustomEmoji) || (!replyTo && !targets.length)) return;
    sendInFlight = true;
    updateSendButton();
    sendPanel.classList.remove("send-error");
    try {
      await sendMessage(text, targets, selectedPhoto, replyTo);
      sendText.value = "";
      customEmojiEntities = [];
      updateComposerPreview();
      clearPhoto();
      clearReply();
    } catch (err) {
      sendPanel.classList.add("send-error");
      sendText.title = err?.message || "send failed";
    } finally {
      sendInFlight = false;
      updateSendButton();
      if (window.tgNativeChatHost?.setMouseInteractive) {
        sendText.blur();
      } else {
        sendText.focus();
      }
    }
  });

  sendText?.addEventListener("keydown", (ev) => {
    if (!mentionMenu.hidden) {
      if (ev.key === "ArrowDown" && moveMentionSelection(1)) {
        ev.preventDefault();
        return;
      }
      if (ev.key === "ArrowUp" && moveMentionSelection(-1)) {
        ev.preventDefault();
        return;
      }
      if (ev.key === "Enter" && chooseSelectedMention()) {
        ev.preventDefault();
        return;
      }
      if (ev.key === "Tab" && chooseSelectedMention()) {
        ev.preventDefault();
        return;
      }
    }
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      sendPanel?.requestSubmit();
    }
  });

  function append(data) {
    if (!data) return;
    const type = data.type || "text";
    if (type === "delete") {
      removeMessageByRef(data.message);
      return;
    }
    const isMedia = type === "photo" || type === "sticker" || type === "animation";
    const el = document.createElement("div");
    el.className = "msg" + (isMedia ? ` msg-media msg-${type}` : "");
    if (data.message?.chat_id && data.message?.message_id) {
      el.dataset.messageKey = `${data.message.chat_id}:${data.message.message_id}`;
      el.addEventListener("contextmenu", (ev) => showMessageMenu(ev, data, el));
    }

    const quote = createReplyQuote(data.reply);
    if (quote) el.appendChild(quote);

    const name = document.createElement("span");
    name.className = "name" + (data.is_host ? " host" : "");
    name.dataset.noQuote = "1";
    name.textContent = `${data.is_host ? "♛ " : ""}${data.name || "Unknown"}`;
    if (data.color) name.style.color = data.color;
    el.appendChild(name);

    if (isMedia) {
      if (!data.url) return;
      const media = createMediaElement(data);
      el.appendChild(media);
      if (typeof data.text === "string" && data.text.trim()) {
        const text = document.createElement("span");
        text.className = "text photo-caption";
        appendMessageText(text, data.text, { entities: data.entities || [] });
        el.appendChild(text);
      }
    } else {
      if (typeof data.text !== "string") return;
      const text = document.createElement("span");
      text.className = "text";
      appendMessageText(text, data.text, { entities: data.entities || [] });
      el.appendChild(text);
      if (data.stt_label) {
        const label = document.createElement("span");
        label.className = "stt-label";
        label.textContent = " " + data.stt_label;
        el.appendChild(label);
      }
    }

    const shouldStickToBottom = chatIsAtBottom();
    chat.appendChild(el);
    if (isMedia) {
      const media = el.querySelector("img, video");
      if (media) keepBottomAfterMediaLoad(media, shouldStickToBottom);
    }

    while (chat.children.length > MAX_MESSAGES) {
      chat.removeChild(chat.firstChild);
    }

    if (shouldStickToBottom) {
      scrollChatToBottom();
    }

    if (fadeAfterSec >= 0) {
      setTimeout(() => {
        el.classList.add("fade-out");
        setTimeout(() => el.remove(), 700);
      }, fadeAfterSec * 1000);
    }
  }

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    controlWs = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "chat_control") {
          if (data.client_id === clientId) return;
          if (data.action === "media_lightbox_open") openMediaLightboxSource(data.src, data.tag || "IMG", false);
          if (data.action === "media_lightbox_close") closeMediaLightbox(false);
          if (data.target === "link_preview") {
            if (!sharedLinkPreview && window.TgChatCore?.createLinkPreview) {
              sharedLinkPreview = window.TgChatCore.createLinkPreview("link-preview", {
                onControl: (payload) => sendControlEvent(payload),
              });
            }
            sharedLinkPreview?.applyRemote?.(data);
          }
          return;
        }
        append(data);
      } catch (_) {}
    };
    ws.onclose = () => setTimeout(connect, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  connect();
})();
