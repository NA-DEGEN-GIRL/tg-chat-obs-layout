(async function () {
  const chat = document.getElementById("chat");
  const sendPanel = document.getElementById("send-panel");
  const sendText = document.getElementById("send-text");
  const sendButton = document.getElementById("send-button");
  const MAX_MESSAGES = 50;
  let fadeAfterSec = 30;
  let userSendEnabled = false;

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
    if (sendPanel && cfg.user_send_panel && userSendEnabled) {
      sendPanel.hidden = false;
    }
    if (sendText && typeof cfg.user_send_max_chars === "number") {
      sendText.maxLength = cfg.user_send_max_chars;
    }
  } catch (_) {}

  async function sendMessage(text) {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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

  sendPanel?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!userSendEnabled || !sendText || !sendButton) return;
    const text = sendText.value.trim();
    if (!text) return;
    sendButton.disabled = true;
    sendPanel.classList.remove("send-error");
    try {
      await sendMessage(text);
      sendText.value = "";
    } catch (err) {
      sendPanel.classList.add("send-error");
      sendText.title = err?.message || "send failed";
    } finally {
      sendButton.disabled = false;
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
