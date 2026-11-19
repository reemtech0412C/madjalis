// خادم محلّيّ صغير: يخدم طبقات البثّ والخطوط والكتب والشعارات للمحرّك، ويدفع التحديثات لحظيّاً (SSE).
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".pdf": "application/pdf", ".mjs": "text/javascript; charset=utf-8", ".wasm": "application/wasm" };

class Server {
  constructor({ roots, getState }) {
    this.roots = roots;          // { ov, assets, books, media, pdfjs }
    this.getState = getState;
    this.clients = new Set();
  }
  start(port = 47800) {
    this.port = port;
    this.srv = http.createServer((req, res) => this.handle(req, res));
    // التحديثات الحيّة عبر WebSocket: كروميوم يسمح بـ6 اتّصالات HTTP فقط لنفس العنوان، فـSSE لكل طبقة كان يحجب البقيّة
    const { WebSocketServer } = require("ws");
    this.wss = new WebSocketServer({ noServer: true });
    this.srv.on("upgrade", (req, sock, head) => {
      if (req.url.startsWith("/pv") && this.onUpgrade) return this.onUpgrade(req, sock, head);     // بثّ الهاتف إلى صفحة العرض
      if (!req.url.startsWith("/ws")) return sock.destroy();
      this.wss.handleUpgrade(req, sock, head, ws => { this.clients.add(ws); ws.on("close", () => this.clients.delete(ws)); ws.on("error", () => {}); });
    });
    return new Promise((resolve, reject) => {
      this.srv.once("error", e => { if (e.code === "EADDRINUSE" && port < 47830) { this.start(port + 1).then(resolve, reject); } else reject(e); });
      this.srv.listen(port, "127.0.0.1", () => resolve(port));
    });
  }
  get base() { return `http://127.0.0.1:${this.port}`; }
  handle(req, res) {
    const u = new URL(req.url, this.base);
    const p = decodeURIComponent(u.pathname);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (p === "/state") { res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" }); return res.end(JSON.stringify(this.getState())); }
    if (p === "/log") { console.log("[overlay]", u.searchParams.get("m")); res.writeHead(204); return res.end(); }
    const m = p.match(/^\/(ov|assets|books|media|pdfjs|ui|faceapi|qr|luma|rec|reels|audio|mp|lab)\/(.+)$/);
    if (!m) { res.writeHead(404); return res.end(); }
    const root = this.roots[m[1]], f = path.normalize(path.join(root, m[2]));
    if (!f.startsWith(path.normalize(root))) { res.writeHead(403); return res.end(); }
    fs.stat(f, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
      const type = TYPES[path.extname(f).toLowerCase()] || "application/octet-stream";
      const range = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
      const cache = m[1] === "assets" || m[1] === "pdfjs" || m[1] === "faceapi" || m[1] === "qr" ? "max-age=3600" : "no-cache";
      if (range) {
        const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${a}-${b}/${st.size}`, "Content-Length": b - a + 1, "Accept-Ranges": "bytes" });
        return fs.createReadStream(f, { start: a, end: b }).pipe(res);
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": cache });
      fs.createReadStream(f).pipe(res);
    });
  }
  push(event, data = {}) {
    const msg = JSON.stringify({ event, data });
    for (const c of this.clients) { try { c.readyState === 1 && c.send(msg); } catch {} }
  }
}
module.exports = { Server };
