const { contextBridge, ipcRenderer } = require("electron");

function send(channel, payload) {
  ipcRenderer.send(channel, payload);
}

contextBridge.exposeInMainWorld("tgElectronBrowser", {
  available: true,
  upsert(payload) {
    send("electron-browser:upsert", payload || {});
  },
  close(payload) {
    send("electron-browser:close", payload || {});
  },
  back(payload) {
    send("electron-browser:back", payload || {});
  },
  forward(payload) {
    send("electron-browser:forward", payload || {});
  },
  reload(payload) {
    send("electron-browser:reload", payload || {});
  },
  devtools(payload) {
    send("electron-browser:devtools", payload || {});
  },
  fullscreen(payload) {
    send("electron-browser:fullscreen", payload || {});
  },
  openExternal(url) {
    send("electron-browser:open-external", String(url || ""));
  },
  onEvent(callback) {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("electron-browser:event", handler);
    return () => ipcRenderer.removeListener("electron-browser:event", handler);
  },
});

contextBridge.exposeInMainWorld("tgElectronChat", {
  available: true,
  upsert(payload) {
    send("electron-chat:upsert", payload || {});
  },
  close() {
    send("electron-chat:close", {});
  },
  reload() {
    send("electron-chat:reload", {});
  },
  devtools() {
    send("electron-chat:devtools", {});
  },
  raise(payload) {
    send("electron-chat:raise", payload || {});
  },
  sendActionState(payload) {
    send("electron-chat:action-state", payload || {});
  },
  onNativeAction(callback) {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("electron-chat:native-action", handler);
    return () => ipcRenderer.removeListener("electron-chat:native-action", handler);
  },
});

contextBridge.exposeInMainWorld("tgNativeChatHost", {
  setMouseInteractive(active) {
    send("electron-chat:mouse-interactive", { active: !!active });
  },
  sendAction(payload) {
    send("electron-chat:native-action", payload || {});
  },
  onActionState(callback) {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("electron-chat:action-state", handler);
    return () => ipcRenderer.removeListener("electron-chat:action-state", handler);
  },
});
