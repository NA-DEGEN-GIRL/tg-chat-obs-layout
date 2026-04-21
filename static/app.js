(async function () {
  const chat = document.getElementById("chat");
  const MAX_MESSAGES = 50;
  let fadeAfterSec = 30;

  try {
    const cfg = await fetch("/config").then((r) => r.json());
    if (typeof cfg.fade_after_sec === "number") {
      fadeAfterSec = cfg.fade_after_sec;
    }
  } catch (_) {}

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
