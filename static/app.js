(async function () {
  const chat = document.getElementById("chat");
  const sendPanel = document.getElementById("send-panel");
  const sendText = document.getElementById("send-text");
  const sendButton = document.getElementById("send-button");
  const sendFile = document.getElementById("send-file");
  const sendTargets = Array.from(document.querySelectorAll(".send-target"));
  const preview = document.getElementById("send-preview");
  const previewImg = document.getElementById("send-preview-img");
  const previewName = document.getElementById("send-preview-name");
  const previewClear = document.getElementById("send-preview-clear");
  const fontDown = document.getElementById("font-down");
  const fontUp = document.getElementById("font-up");
  const messageMenu = document.getElementById("message-menu");
  const menuReply = document.getElementById("menu-reply");
  const menuDelete = document.getElementById("menu-delete");
  const mentionMenu = document.createElement("div");
  mentionMenu.id = "mention-menu";
  mentionMenu.hidden = true;
  document.body.appendChild(mentionMenu);
  const MAX_MESSAGES = 50;
  const FONT_SIZE_KEY = "tg-chat-overlay.fontSize.v1";
  let fadeAfterSec = 30;
  let chatFontSize = null;
  let userSendEnabled = false;
  let selectedPhoto = null;
  let replyTo = null;
  let menuTarget = null;
  let mentionTimer = null;
  let mentionToken = null;
  let mentionSelected = 0;
  let maxPhotoBytes = 8 * 1024 * 1024;

  function selectedTargets() {
    return sendTargets
      .filter((btn) => btn.classList.contains("active") && !btn.disabled)
      .map((btn) => btn.dataset.target);
  }

  function updateSendButton() {
    if (!sendButton || !sendText) return;
    const hasBody = !!sendText.value.trim() || !!selectedPhoto;
    sendButton.disabled = !userSendEnabled || !hasBody || (!replyTo && selectedTargets().length === 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function applyFontSize(size) {
    chatFontSize = clamp(Number(size) || 22, 12, 64);
    document.documentElement.style.setProperty("--msg-font-size", chatFontSize + "px");
    try { localStorage.setItem(FONT_SIZE_KEY, String(chatFontSize)); } catch (_) {}
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
      if (sendTargets.length && !selectedTargets().length && !sendTargets[0].disabled) {
        sendTargets[0].classList.add("active");
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
    if (!file.type.startsWith("image/")) return;
    if (file.size > maxPhotoBytes) {
      sendPanel?.classList.add("send-error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      selectedPhoto = {
        name: file.name || "image.jpg",
        mime: file.type || "image/jpeg",
        data: String(reader.result || ""),
      };
      if (previewImg) previewImg.src = selectedPhoto.data;
      if (previewName) previewName.textContent = selectedPhoto.name;
      if (preview) preview.hidden = false;
      sendPanel?.classList.remove("send-error");
      updateSendButton();
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    selectedPhoto = null;
    if (previewImg) previewImg.removeAttribute("src");
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

  function setReply(data) {
    if (!data?.message?.chat_id || !data?.message?.message_id) return;
    replyTo = data.message;
    const box = ensureReplyPreview();
    const label = document.getElementById("reply-preview-label");
    if (label) label.textContent = `↩ ${data.name || "Unknown"}`;
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
      body: JSON.stringify({ text, targets, photo, reply_to: reply }),
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
    text.textContent = reply.text || "메시지";
    quote.append(name, text);
    quote.addEventListener("click", (ev) => {
      ev.stopPropagation();
      focusMessageByKey(quote.dataset.replyTargetKey);
    });
    return quote;
  }

  function hideMessageMenu() {
    if (messageMenu) messageMenu.hidden = true;
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
    menuTarget = { data, el };
    messageMenu.hidden = false;
    const w = messageMenu.offsetWidth || 120;
    const h = messageMenu.offsetHeight || 80;
    messageMenu.style.left = clamp(ev.clientX, 6, window.innerWidth - w - 6) + "px";
    messageMenu.style.top = clamp(ev.clientY, 6, window.innerHeight - h - 6) + "px";
  }

  function removeMessageByRef(ref) {
    if (!ref?.chat_id || !ref?.message_id) return;
    const key = `${ref.chat_id}:${ref.message_id}`;
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
  previewClear?.addEventListener("click", clearPhoto);
  sendText?.addEventListener("input", () => {
    updateSendButton();
    scheduleMentionSearch();
  });
  fontDown?.addEventListener("click", () => applyFontSize((chatFontSize || 22) - 2));
  fontUp?.addEventListener("click", () => applyFontSize((chatFontSize || 22) + 2));
  menuReply?.addEventListener("click", () => {
    if (menuTarget) setReply(menuTarget.data);
    hideMessageMenu();
  });
  menuDelete?.addEventListener("click", async () => {
    const target = menuTarget;
    hideMessageMenu();
    if (!target) return;
    try {
      await deleteMessage(target.data.message);
      removeMessageElement(target.el);
    } catch (err) {
      sendPanel?.classList.add("send-error");
      if (sendText) sendText.title = err?.message || "delete failed";
    }
  });
  document.addEventListener("click", hideMessageMenu);
  window.addEventListener("resize", positionMentionMenu);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      hideMessageMenu();
      hideMentionMenu();
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
    const file = Array.from(ev.dataTransfer?.files || []).find((f) => f.type.startsWith("image/"));
    setPhoto(file);
  });

  sendPanel?.addEventListener("paste", (ev) => {
    const file = Array.from(ev.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .find((f) => f && f.type.startsWith("image/"));
    if (!file) return;
    setPhoto(file);
    if (!ev.clipboardData?.getData("text/plain")) {
      ev.preventDefault();
    }
  });

  sendPanel?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!userSendEnabled || !sendText || !sendButton) return;
    const text = sendText.value.trim();
    const targets = selectedTargets();
    if ((!text && !selectedPhoto) || (!replyTo && !targets.length)) return;
    sendButton.disabled = true;
    sendPanel.classList.remove("send-error");
    try {
      await sendMessage(text, targets, selectedPhoto, replyTo);
      sendText.value = "";
      clearPhoto();
      clearReply();
    } catch (err) {
      sendPanel.classList.add("send-error");
      sendText.title = err?.message || "send failed";
    } finally {
      updateSendButton();
      sendText.focus();
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
    name.textContent = `${data.is_host ? "♛ " : ""}${data.name || "Unknown"}`;
    if (data.color) name.style.color = data.color;
    el.appendChild(name);

    if (isMedia) {
      if (!data.url) return;
      el.appendChild(createMediaElement(data));
      if (typeof data.text === "string" && data.text.trim()) {
        const text = document.createElement("span");
        text.className = "text photo-caption";
        text.textContent = data.text;
        el.appendChild(text);
      }
    } else {
      if (typeof data.text !== "string") return;
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = data.text;
      el.appendChild(text);
      if (data.stt_label) {
        const label = document.createElement("span");
        label.className = "stt-label";
        label.textContent = " " + data.stt_label;
        el.appendChild(label);
      }
    }

    const shouldStickToBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 48;
    chat.appendChild(el);

    while (chat.children.length > MAX_MESSAGES) {
      chat.removeChild(chat.firstChild);
    }

    if (shouldStickToBottom) {
      requestAnimationFrame(() => {
        chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
      });
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
    ws.onmessage = (ev) => {
      try { append(JSON.parse(ev.data)); } catch (_) {}
    };
    ws.onclose = () => setTimeout(connect, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  connect();
})();
