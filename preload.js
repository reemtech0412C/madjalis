const { contextBridge, ipcRenderer } = require("electron");
const call = async (ch, ...a) => { const r = await ipcRenderer.invoke(ch, ...a); if (r && r.__error) throw new Error(r.__error); return r; };
contextBridge.exposeInMainWorld("minbar", {
  call,
  on: (ch, fn) => { const f = (_e, d) => fn(d); ipcRenderer.on(ch, f); return () => ipcRenderer.removeListener(ch, f); },
});
