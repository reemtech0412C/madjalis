const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("lic", {
  info: () => ipcRenderer.invoke("lic:info"), activate: k => ipcRenderer.invoke("lic:activate", k),
  copy: () => ipcRenderer.invoke("lic:copy"), mail: () => ipcRenderer.invoke("lic:mail"), wa: () => ipcRenderer.invoke("lic:wa"), quit: () => ipcRenderer.invoke("lic:quit"),
});
