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
  const MAX_MESSAGES = 50;
  let fadeAfterSec = 30;
  let userSendEnabled = false;
  let selectedPhoto = null;
  let maxPhotoBytes = 8 * 1024 * 1024;

  function selectedTargets() {
    return sendTargets
      .filter((btn) => btn.classList.contains("active") && !btn.disabled)
      .map((btn) => btn.dataset.target);
  }

  function updateSendButton() {
    if (!sendButton || !sendText) return;
    const hasBody = !!sendText.value.trim() || !!selectedPhoto;
    sendButton.disabled = !userSendEnabled || !hasBody || selectedTargets().length === 0;
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
      document.documentElement.style.setProperty(
        "--msg-font-size",
        cfg.chat_font_size + "px"
      );
    }
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

  async function sendMessage(text, targets, photo) {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targets, photo }),
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

  for (const btn of sendTargets) {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      btn.classList.toggle("active");
      updateSendButton();
    });
  }

  sendFile?.addEventListener("change", () => setPhoto(sendFile.files?.[0]));
  previewClear?.addEventListener("click", clearPhoto);
  sendText?.addEventListener("input", updateSendButton);

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

  sendPanel?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!userSendEnabled || !sendText || !sendButton) return;
    const text = sendText.value.trim();
    const targets = selectedTargets();
    if ((!text && !selectedPhoto) || !targets.length) return;
    sendButton.disabled = true;
    sendPanel.classList.remove("send-error");
    try {
      await sendMessage(text, targets, selectedPhoto);
      sendText.value = "";
      clearPhoto();
    } catch (err) {
      sendPanel.classList.add("send-error");
      sendText.title = err?.message || "send failed";
    } finally {
      updateSendButton();
      sendText.focus();
    }
  });

  sendText?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      sendPanel?.requestSubmit();
    }
  });

  function append(data) {
    if (!data) return;
    const type = data.type || "text";
    const el = document.createElement("div");
    el.className = "msg" + (type === "photo" ? " msg-photo" : "");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = data.name || "Unknown";
    if (data.color) name.style.color = data.color;
    el.appendChild(name);

    if (type === "photo") {
      if (!data.url) return;
      const img = document.createElement("img");
      img.src = data.url;
      img.alt = "";
      img.decoding = "async";
      el.appendChild(img);
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

    chat.appendChild(el);

    while (chat.children.length > MAX_MESSAGES) {
      chat.removeChild(chat.firstChild);
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
