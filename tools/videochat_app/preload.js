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
