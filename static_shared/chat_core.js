(function () {
  function ensureFloatingElement(id, tagName = "div") {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tagName);
      el.id = id;
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function messageKey(ref) {
    if (!ref?.chat_id || !ref?.message_id) return "";
    return `${ref.chat_id}:${ref.message_id}`;
  }

  function normalizeQuoteText(value, maxLength = 500) {
    return String(value || "").replace(/\r/g, "").slice(0, maxLength);
  }

  function nodeInside(root, node) {
    if (!root || !node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!el && (el === root || root.contains(el));
  }

  function selectedTextWithin(root, maxLength = 500) {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !root) return "";
    if (!nodeInside(root, selection.anchorNode) || !nodeInside(root, selection.focusNode)) return "";
    const text = normalizeQuoteText(selection.toString(), maxLength);
    return text.trim() ? text : "";
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

  function createMediaLightbox(id = "media-lightbox") {
    const box = ensureFloatingElement(id);
    let body = box.querySelector(".media-lightbox-body");
    if (!body) {
      body = document.createElement("div");
      body.className = "media-lightbox-body";
      box.appendChild(body);
    }

    function close() {
      box.hidden = true;
      body.replaceChildren();
    }

    function open(media) {
      if (!media?.src) return;
      const full = document.createElement(media.tagName === "VIDEO" ? "video" : "img");
      full.src = media.src;
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
      body.replaceChildren(full);
      box.hidden = false;
    }

    if (!box.dataset.chatCoreBound) {
      box.addEventListener("click", close);
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !box.hidden) close();
      });
      box.dataset.chatCoreBound = "1";
    }

    return { box, body, open, close };
  }

  function createLinkPreview(id = "link-preview") {
    const box = ensureFloatingElement(id);
    let toolbar = box.querySelector(".link-preview-toolbar");
    let title = box.querySelector(".link-preview-url");
    let openExternal = box.querySelector(".link-preview-open");
    let proxyButton = box.querySelector(".link-preview-proxy");
    let closeButton = box.querySelector(".link-preview-close");
    let resizeHandle = box.querySelector(".link-preview-resize");
    let status = box.querySelector(".link-preview-status");
    let frame = box.querySelector("iframe");
    function makeProxyButton() {
      const btn = document.createElement("button");
      btn.className = "link-preview-proxy";
      btn.type = "button";
      btn.textContent = "proxy";
      return btn;
    }

    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "link-preview-toolbar";
      title = document.createElement("span");
      title.className = "link-preview-url";
      openExternal = document.createElement("a");
      openExternal.className = "link-preview-open";
      openExternal.target = "_blank";
      openExternal.rel = "noreferrer";
      openExternal.textContent = "open";
      proxyButton = makeProxyButton();
      closeButton = document.createElement("button");
      closeButton.className = "link-preview-close";
      closeButton.type = "button";
      closeButton.textContent = "x";
      toolbar.append(title, openExternal, proxyButton, closeButton);
      frame = document.createElement("iframe");
      frame.referrerPolicy = "no-referrer";
      frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
      status = document.createElement("div");
      status.className = "link-preview-status";
      status.hidden = true;
      resizeHandle = document.createElement("div");
      resizeHandle.className = "link-preview-resize";
      resizeHandle.title = "resize";
      box.replaceChildren(toolbar, frame, status, resizeHandle);
    } else {
      if (!proxyButton) {
        proxyButton = makeProxyButton();
        toolbar.insertBefore(proxyButton, closeButton || null);
      }
      if (!status) {
        status = document.createElement("div");
        status.className = "link-preview-status";
        status.hidden = true;
        box.appendChild(status);
      }
      if (!resizeHandle) {
        resizeHandle = document.createElement("div");
        resizeHandle.className = "link-preview-resize";
        resizeHandle.title = "resize";
        box.appendChild(resizeHandle);
      }
    }

    const stateKey = `${id}.state.v1`;
    let currentUrl = "";
    let currentProxyUrl = "";
    let usingProxy = false;

    function defaultState() {
      const width = Math.min(Math.round(window.innerWidth * 0.86), 1280);
      const height = Math.min(Math.round(window.innerHeight * 0.82), 900);
      return {
        x: Math.max(12, Math.round((window.innerWidth - width) / 2)),
        y: Math.max(12, Math.round((window.innerHeight - height) / 2)),
        width,
        height,
      };
    }

    function loadState() {
      try {
        return { ...defaultState(), ...JSON.parse(localStorage.getItem(stateKey) || "{}") };
      } catch (_) {
        return defaultState();
      }
    }

    function saveState(state) {
      try {
        localStorage.setItem(stateKey, JSON.stringify(state));
      } catch (_) {}
    }

    function applyState(state) {
      const minWidth = 360;
      const minHeight = 240;
      const width = clamp(Number(state.width) || minWidth, minWidth, Math.max(minWidth, window.innerWidth - 12));
      const height = clamp(Number(state.height) || minHeight, minHeight, Math.max(minHeight, window.innerHeight - 12));
      const x = clamp(Number(state.x) || 12, 6, Math.max(6, window.innerWidth - width - 6));
      const y = clamp(Number(state.y) || 12, 6, Math.max(6, window.innerHeight - height - 6));
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      box.style.right = "auto";
      box.style.bottom = "auto";
      return { x, y, width, height };
    }

    function proxyUrlFor(url) {
      return `/api/link/proxy?url=${encodeURIComponent(url)}`;
    }

    function xPreviewUrlFor(url) {
      return `/api/link/x-preview?url=${encodeURIComponent(url)}`;
    }

    function isXHost(parsed) {
      const host = parsed.hostname.toLowerCase();
      return host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
    }

    function setPreviewState(url, useProxy) {
      currentUrl = url;
      currentProxyUrl = proxyUrlFor(url);
      usingProxy = !!useProxy;
      box._linkPreviewCurrentUrl = currentUrl;
      box._linkPreviewProxyUrl = currentProxyUrl;
      box._linkPreviewUsingProxy = usingProxy;
      if (proxyButton) proxyButton.classList.toggle("active", usingProxy);
      if (proxyButton) proxyButton.textContent = usingProxy ? "raw" : "proxy";
      if (proxyButton) proxyButton.title = usingProxy ? "using local proxy" : "retry through local proxy";
    }

    function clearStatus() {
      if (!status) return;
      status.hidden = true;
      status.replaceChildren();
    }

    function showStatus(message, actions = []) {
      if (!status) return;
      status.replaceChildren();
      const card = document.createElement("div");
      card.className = "link-preview-status-card";
      const text = document.createElement("div");
      text.className = "link-preview-status-text";
      text.textContent = message;
      card.appendChild(text);
      if (actions.length) {
        const actionRow = document.createElement("div");
        actionRow.className = "link-preview-status-actions";
        for (const action of actions) {
          const button = document.createElement(action.href ? "a" : "button");
          button.className = action.primary ? "primary" : "";
          button.textContent = action.label;
          if (action.href) {
            button.href = action.href;
            button.target = "_blank";
            button.rel = "noreferrer";
          } else {
            button.type = "button";
            button.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              action.run?.();
            });
          }
          actionRow.appendChild(button);
        }
        card.appendChild(actionRow);
      }
      status.appendChild(card);
      status.hidden = false;
    }

    function setFrameSource(url, useProxy = false) {
      setPreviewState(url, useProxy);
      clearStatus();
      const nextSrc = usingProxy ? currentProxyUrl : currentUrl;
      frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
      frame.removeAttribute("src");
      requestAnimationFrame(() => {
        frame.src = nextSrc;
      });
    }

    function setXPreviewSource(url) {
      setPreviewState(url, false);
      clearStatus();
      frame.sandbox = "allow-scripts allow-popups allow-popups-to-escape-sandbox";
      frame.removeAttribute("src");
      requestAnimationFrame(() => {
        frame.src = xPreviewUrlFor(url);
      });
      if (proxyButton) proxyButton.textContent = "proxy";
      if (proxyButton) proxyButton.title = "try full-page local proxy";
    }

    function close() {
      box.hidden = true;
      if (frame) frame.removeAttribute("src");
      clearStatus();
    }

    function open(url) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (_) {
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      title.textContent = parsed.href;
      openExternal.href = parsed.href;
      applyState(loadState());
      box.hidden = false;
      if (isXHost(parsed)) {
        setXPreviewSource(parsed.href);
        return;
      }
      if (isXHost(parsed)) {
        setPreviewState(parsed.href, false);
        frame.removeAttribute("src");
        showStatus("X는 로그인 앱과 API가 자체 origin을 전제로 동작해서 내부 iframe/단순 프록시에서는 깨질 수 있습니다. 외부 브라우저에서 여는 방식이 가장 안정적입니다.", [
          { label: "open external", href: parsed.href, primary: true },
          { label: "try proxy", run: () => setFrameSource(parsed.href, true) },
          { label: "try raw", run: () => setFrameSource(parsed.href, false) },
        ]);
        return;
      }
      setFrameSource(parsed.href, false);
    }

    closeButton.onclick = close;

    if (proxyButton) {
      proxyButton.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const url = box._linkPreviewCurrentUrl || currentUrl;
        if (!url) return;
        const nextUseProxy = !(box._linkPreviewUsingProxy ?? usingProxy);
        setFrameSource(url, nextUseProxy);
      };
    }

    if (!toolbar.dataset.linkPreviewDragBound) {
      toolbar.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0 || ev.target.closest("button,a")) return;
        ev.preventDefault();
        const rect = box.getBoundingClientRect();
        const start = { x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        toolbar.setPointerCapture?.(ev.pointerId);
        const move = (moveEv) => {
          const state = applyState({
            x: start.left + moveEv.clientX - start.x,
            y: start.top + moveEv.clientY - start.y,
            width: start.width,
            height: start.height,
          });
          saveState(state);
        };
        const up = () => {
          toolbar.removeEventListener("pointermove", move);
          toolbar.removeEventListener("pointerup", up);
          toolbar.removeEventListener("pointercancel", up);
        };
        toolbar.addEventListener("pointermove", move);
        toolbar.addEventListener("pointerup", up);
        toolbar.addEventListener("pointercancel", up);
      });
      toolbar.dataset.linkPreviewDragBound = "1";
    }

    if (resizeHandle && !resizeHandle.dataset.linkPreviewBound) {
      resizeHandle.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const rect = box.getBoundingClientRect();
        const start = { x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        resizeHandle.setPointerCapture?.(ev.pointerId);
        const move = (moveEv) => {
          const state = applyState({
            x: start.left,
            y: start.top,
            width: start.width + moveEv.clientX - start.x,
            height: start.height + moveEv.clientY - start.y,
          });
          saveState(state);
        };
        const up = () => {
          resizeHandle.removeEventListener("pointermove", move);
          resizeHandle.removeEventListener("pointerup", up);
          resizeHandle.removeEventListener("pointercancel", up);
        };
        resizeHandle.addEventListener("pointermove", move);
        resizeHandle.addEventListener("pointerup", up);
        resizeHandle.addEventListener("pointercancel", up);
      });
      resizeHandle.dataset.linkPreviewBound = "1";
    }

    if (!box.dataset.linkPreviewChromeBound) {
      box.addEventListener("click", (ev) => {
        if (ev.target === box) close();
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape" && !box.hidden) close();
      });
      box.dataset.linkPreviewChromeBound = "1";
    }

    return { box, open, close };
  }

  const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

  function trimUrlPunctuation(value) {
    let url = value;
    let suffix = "";
    while (/[),.!?;:\]]$/.test(url)) {
      suffix = url.slice(-1) + suffix;
      url = url.slice(0, -1);
    }
    return { url, suffix };
  }

  function appendLinkedText(container, text, options, linkPreview) {
    const value = String(text || "");
    let lastIndex = 0;
    for (const match of value.matchAll(URL_RE)) {
      const raw = match[0];
      const index = match.index || 0;
      if (index > lastIndex) {
        container.append(document.createTextNode(value.slice(lastIndex, index)));
      }
      const { url, suffix } = trimUrlPunctuation(raw);
      const link = document.createElement("a");
      link.className = options.linkClass || "chat-link";
      link.href = url;
      link.textContent = url;
      link.rel = "noreferrer";
      link.target = "_blank";
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        linkPreview.open(url);
      });
      container.append(link);
      if (suffix) container.append(document.createTextNode(suffix));
      lastIndex = index + raw.length;
    }
    if (lastIndex < value.length) {
      container.append(document.createTextNode(value.slice(lastIndex)));
    }
  }

  function entityElement(container, entity, segment, options, linkPreview) {
    const type = String(entity?.type || "").toLowerCase();
    let el = null;
    if (type === "bold") {
      el = document.createElement("strong");
    } else if (type === "italic") {
      el = document.createElement("i");
    } else if (type === "underline") {
      el = document.createElement("u");
    } else if (type === "strikethrough" || type === "strike") {
      el = document.createElement("s");
    } else if (type === "code" || type === "pre") {
      el = document.createElement("code");
    } else if (type === "spoiler") {
      el = document.createElement("span");
      el.className = "chat-spoiler";
    } else if (type === "url") {
      const href = /^https?:\/\//i.test(segment) ? segment : `https://${segment}`;
      el = document.createElement("a");
      el.className = options.linkClass || "chat-link";
      el.href = href;
      el.rel = "noreferrer";
      el.target = "_blank";
      el.textContent = segment;
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        linkPreview.open(href);
      });
      container.append(el);
      return;
    } else if (type === "text_link" && entity.url) {
      const href = String(entity.url || "");
      if (!/^https?:\/\//i.test(href)) {
        appendLinkedText(container, segment, options, linkPreview);
        return;
      }
      el = document.createElement("a");
      el.className = options.linkClass || "chat-link";
      el.href = href;
      el.rel = "noreferrer";
      el.target = "_blank";
      el.textContent = segment;
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        linkPreview.open(href);
      });
      container.append(el);
      return;
    }
    if (!el) {
      appendLinkedText(container, segment, options, linkPreview);
      return;
    }
    appendLinkedText(el, segment, options, linkPreview);
    container.append(el);
  }

  function appendRichText(container, text, options = {}) {
    const value = String(text || "");
    const linkPreview = options.linkPreview || createLinkPreview();
    const entities = Array.isArray(options.entities)
      ? options.entities
          .map((entity) => ({
            ...entity,
            offset: Number(entity.offset),
            length: Number(entity.length),
          }))
          .filter((entity) => (
            Number.isFinite(entity.offset)
            && Number.isFinite(entity.length)
            && entity.offset >= 0
            && entity.length > 0
            && entity.offset < value.length
          ))
          .sort((a, b) => a.offset - b.offset || b.length - a.length)
      : [];
    if (!entities.length) {
      appendLinkedText(container, value, options, linkPreview);
      return;
    }
    let cursor = 0;
    for (const entity of entities) {
      const start = Math.max(cursor, entity.offset);
      const end = Math.min(value.length, entity.offset + entity.length);
      if (end <= cursor) continue;
      if (start > cursor) {
        appendLinkedText(container, value.slice(cursor, start), options, linkPreview);
      }
      entityElement(container, entity, value.slice(start, end), options, linkPreview);
      cursor = end;
    }
    if (cursor < value.length) {
      appendLinkedText(container, value.slice(cursor), options, linkPreview);
    }
  }

  function createMediaTools(options = {}) {
    const lightbox = options.lightbox || createMediaLightbox(options.lightboxId || "media-lightbox");

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
        lightbox.open(media);
      });
      return media;
    }

    return { lightbox, createMediaElement };
  }

  function isAtBottom(container, threshold = 48) {
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }

  function scrollToBottom(container) {
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    });
  }

  function keepBottomAfterMediaLoad(media, container, shouldStickToBottom) {
    if (!media || !shouldStickToBottom) return;
    const settle = () => scrollToBottom(container);
    media.addEventListener("load", settle, { once: true });
    media.addEventListener("loadedmetadata", settle, { once: true });
    media.addEventListener("loadeddata", settle, { once: true });
    setTimeout(settle, 120);
    setTimeout(settle, 500);
  }

  function createReplyQuote(reply, options = {}) {
    if (!reply || (!reply.name && !reply.text)) return null;
    const quote = document.createElement("div");
    quote.className = options.className || "reply-quote";
    const key = messageKey(reply.message);
    if (key) {
      quote.dataset.replyTargetKey = key;
      quote.title = options.title || "Go to replied message";
    }
    const name = document.createElement("span");
    name.className = options.nameClass || "reply-name";
    name.textContent = reply.name || "Unknown";
    const text = document.createElement("span");
    text.className = options.textClass || "reply-text";
    text.textContent = reply.quote_text || reply.text || options.emptyText || "message";
    quote.append(name, text);
    if (options.onClick) {
      quote.addEventListener("click", (ev) => {
        ev.stopPropagation();
        options.onClick(quote.dataset.replyTargetKey, reply, ev);
      });
    }
    return quote;
  }

  function createMentionController(options) {
    const menu = options.menu;
    const textarea = options.textarea;
    const panel = options.panel;
    const search = options.search;
    const onChange = options.onChange || function () {};
    const debounceMs = options.debounceMs || 180;
    let token = null;
    let timer = null;
    let selected = 0;

    function hide() {
      if (menu) {
        menu.hidden = true;
        menu.replaceChildren();
      }
      token = null;
      selected = 0;
    }

    function tokenAtCaret() {
      if (!textarea) return null;
      const pos = textarea.selectionStart;
      const before = textarea.value.slice(0, pos);
      const match = before.match(/(^|\s)@([^\s@]{1,32})$/);
      if (!match) return null;
      return {
        query: match[2],
        start: pos - match[2].length - 1,
        end: pos,
      };
    }

    function position() {
      if (!menu || !panel) return;
      const rect = panel.getBoundingClientRect();
      menu.style.left = `${rect.left}px`;
      menu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 6)}px`;
      menu.style.width = `${Math.min(320, rect.width)}px`;
    }

    function choose(user) {
      if (!textarea || !token || !user?.can_tag) return;
      const insert = `${user.insert} `;
      const value = textarea.value;
      textarea.value = value.slice(0, token.start) + insert + value.slice(token.end);
      const pos = token.start + insert.length;
      textarea.setSelectionRange(pos, pos);
      hide();
      onChange();
      textarea.focus();
    }

    function render(users) {
      if (!menu) return;
      menu.replaceChildren();
      if (!users.length || !token) {
        hide();
        return;
      }
      users.forEach((user, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `mention-item${index === selected ? " active" : ""}`;
        btn.disabled = !user.can_tag;
        const name = document.createElement("span");
        name.className = "mention-name";
        name.textContent = user.name || "Unknown";
        const handle = document.createElement("span");
        handle.className = "mention-handle";
        handle.textContent = user.username ? `@${user.username}` : options.emptyHandleText || "no username";
        btn.append(name, handle);
        btn.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          choose(user);
        });
        menu.appendChild(btn);
      });
      position();
      menu.hidden = false;
    }

    function schedule() {
      clearTimeout(timer);
      const next = tokenAtCaret();
      if (!next) {
        hide();
        return;
      }
      token = next;
      timer = setTimeout(async () => {
        try {
          const users = await search(next.query);
          if (!token || token.query !== next.query) return;
          selected = 0;
          render(Array.isArray(users) ? users : []);
        } catch (_) {
          hide();
        }
      }, debounceMs);
    }

    function move(delta) {
      if (!menu) return false;
      const items = Array.from(menu.querySelectorAll(".mention-item:not(:disabled)"));
      if (!items.length) return false;
      selected = (selected + delta + items.length) % items.length;
      for (const item of menu.querySelectorAll(".mention-item")) {
        item.classList.remove("active");
      }
      items[selected].classList.add("active");
      return true;
    }

    function chooseSelected() {
      if (!menu) return false;
      const items = Array.from(menu.querySelectorAll(".mention-item:not(:disabled)"));
      if (!items.length) return false;
      items[Math.min(selected, items.length - 1)].dispatchEvent(new MouseEvent("mousedown"));
      return true;
    }

    return { hide, schedule, move, chooseSelected, position };
  }

  function showFloatingMenu(menu, ev, options = {}) {
    if (!menu) return;
    const width = menu.offsetWidth || options.width || 120;
    const height = menu.offsetHeight || options.height || 80;
    menu.hidden = false;
    menu.style.left = `${clamp(ev.clientX, 6, window.innerWidth - width - 6)}px`;
    menu.style.top = `${clamp(ev.clientY, 6, window.innerHeight - height - 6)}px`;
  }

  window.TgChatCore = {
    clamp,
    ensureFloatingElement,
    messageKey,
    normalizeQuoteText,
    selectedTextWithin,
    createMediaLightbox,
    createLinkPreview,
    createMediaTools,
    appendRichText,
    createReplyQuote,
    createMentionController,
    isAtBottom,
    scrollToBottom,
    keepBottomAfterMediaLoad,
    showFloatingMenu,
  };
})();
