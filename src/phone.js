// هاتف «المجالس»: يستقبل بثّ H.264 من تطبيق «كاميرا المجالس» على أندرويد (TCP)، ويمرّره لصفحة العرض داخل المحرّك (WebSocket)،
// ويهيّئ الاقتران (رمز QR) وكابل USB (adb reverse). التفاصيل: D:\madjalis\docs\PROTOCOL.md
const net = require("net");
const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");
const { execFile } = require("child_process");
const { WebSocketServer } = require("ws");

const T = { HELLO: 1, CONFIG: 2, FRAME: 3, STAT: 4, PONG: 5, WELCOME: 0x81, CMD: 0x82, PING: 0x83, LIVE: 0x10 };
const ROLES = ["sheikh", "audience"];
const MAX_PAYLOAD = 16 * 1024 * 1024;

class PhoneHub extends EventEmitter {
  constructor({ store, resources }) {
    super();
    this.store = store; this.resources = resources;
    this.port = 47821;
    this.phones = { sheikh: null, audience: null };           // الجلسة الحاليّة لكل دور
    this.viewers = { sheikh: new Set(), audience: new Set() };   // صفحات العرض (WebSocket)
    this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 1 << 20 });
    this.usbTimer = null; this._chg = null;
    this.ensureToken();
  }

  // ---------- الرمز والإعدادات ----------
  get cfg() { return this.store.get().phone; }
  ensureToken() {
    const p = this.store.get().phone || {};
    if (!p.token) this.store.patch({ phone: { token: crypto.randomBytes(9).toString("base64url") } });
  }
  regenToken() {
    this.store.patch({ phone: { token: crypto.randomBytes(9).toString("base64url") } });
    for (const r of ROLES) if (this.phones[r]) this.drop(this.phones[r], "تغيّر رمز الاقتران");
    this.changed();
    return this.cfg.token;
  }

  // ---------- الخادم ----------
  start(port = 47821) {
    return new Promise((resolve, reject) => {
      this.srv = net.createServer(sock => this.onSocket(sock));
      const tryPort = p => {
        this.srv.once("error", e => { if (e.code === "EADDRINUSE" && p < port + 9) tryPort(p + 1); else reject(e); });
        this.srv.listen(p, "0.0.0.0", () => { this.port = p; this.srv.removeAllListeners("error"); this.srv.on("error", () => {}); resolve(p); });
      };
      tryPort(port);
      if (this.cfg.usb !== false) this.usbAuto(true);          // تهيئة USB تلقائيّة افتراضيّاً
    });
  }
  stop() {
    clearInterval(this.usbTimer);
    for (const r of ROLES) if (this.phones[r]) this.drop(this.phones[r], "إغلاق البرنامج");
    try { this.srv && this.srv.close(); } catch {}
  }

  // ---------- اتصال الهاتف ----------
  onSocket(sock) {
    sock.setNoDelay(true); sock.setKeepAlive(true, 5000);
    const s = { sock, buf: Buffer.alloc(0), authed: false, role: null, name: "", cfg: null, stat: {}, lastFrame: 0, since: Date.now(), key: null, ping: null, frames: 0, bytes: 0, kbps: 0, fps: 0, rtt: 0, tick: Date.now() };
    sock.on("data", d => {
      s.buf = s.buf.length ? Buffer.concat([s.buf, d]) : d;
      try { this.parse(s); } catch (e) { console.error("[phone] parse error", e && e.stack || e); this.drop(s, "بيانات غير صالحة"); }
    });
    sock.on("close", () => this.drop(s));
    sock.on("error", () => this.drop(s));
    s.hello = setTimeout(() => { if (!s.authed) this.drop(s, "لم يُرسل الهاتف بيانات الاقتران"); }, 6000);
  }

  parse(s) {
    for (;;) {
      if (s.buf.length < 5) return;
      const type = s.buf[0], len = s.buf.readUInt32BE(1);
      if (len > MAX_PAYLOAD) throw new Error("big");
      if (s.buf.length < 5 + len) return;
      const payload = s.buf.subarray(5, 5 + len);
      s.buf = s.buf.subarray(5 + len);
      this.onMessage(s, type, payload);
    }
  }

  onMessage(s, type, p) {
    if (!s.authed) {
      if (type !== T.HELLO) return this.drop(s, "الاقتران مطلوب");
      let j; try { j = JSON.parse(p.toString("utf8")); } catch { return this.drop(s, "حزمة اقتران تالفة"); }
      const want = Buffer.from(String(this.cfg.token)), got = Buffer.from(String(j.token || ""));
      // عبر كابل USB (adb reverse) يصل الاتصال من 127.0.0.1: نقبله بلا رمز، فلا حاجة لمسح QR مع الكابل
      const local = /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(String(s.sock.remoteAddress || ""));
      const trusted = local && !got.length && this.cfg.usbNoToken !== false;
      if (!trusted && (want.length !== got.length || !crypto.timingSafeEqual(want, got))) {
        this.send(s, T.WELCOME, Buffer.from(JSON.stringify({ ok: false, err: "رمز الاقتران غير صحيح" })));
        return setTimeout(() => this.drop(s), 200);
      }
      let role = ROLES.includes(j.role) ? j.role : "sheikh";
      // هاتفان معاً: لو لم يحدّد المستخدم الدور بنفسه ودورُ هذا الهاتف مشغول بهاتف آخر متّصل، نعطيه الدور الحرّ الآخر
      if (j.auto && this.phones[role] && !this.phones[role].dead && this.phones[role].name !== String(j.name || "").slice(0, 48)) {
        const free = ROLES.find(r => !this.phones[r]);
        if (free) role = free;
      }
      const old = this.phones[role];
      if (old && old !== s) this.drop(old, "اتّصل هاتف آخر بالدور نفسه");
      s.authed = true; s.role = role; s.name = String(j.name || "هاتف").slice(0, 48); clearTimeout(s.hello);
      this.phones[role] = s;
      console.log("[phone] connected", role, s.name, local ? "(USB)" : "(Wi-Fi)");
      this.send(s, T.WELCOME, Buffer.from(JSON.stringify({ ok: true, pc: os.hostname(), role })));
      s.ping = setInterval(() => this.send(s, T.PING, Buffer.from(String(Date.now()))), 3000);
      this.changed();
      return;
    }
    switch (type) {
      case T.CONFIG: {
        try { s.cfg = JSON.parse(p.toString("utf8")); } catch { return; }
        s.key = null;
        this.relay(s.role, T.CONFIG, p);
        this.emit("config", s.role, s.cfg);
        this.changed();
        break;
      }
      case T.FRAME: {
        s.lastFrame = Date.now(); s.frames++; s.bytes += p.length;
        if (process.env.MAJLIS_PHONE_DUMP && s.cfg) {      // تشخيص: يحفظ أوّل 120 إطاراً من الهاتف في ملفّ
          (this._dump = this._dump || { cfg: s.cfg, frames: [] });
          if (this._dump.frames.length < 120) { this._dump.frames.push({ key: !!(p[0] & 1), b64: Buffer.from(p).toString("base64") }); if (this._dump.frames.length === 120) fs.writeFileSync(process.env.MAJLIS_PHONE_DUMP, JSON.stringify(this._dump)); }
        }
        if (p[0] & 1) s.key = Buffer.from(p);                      // آخر إطار مفتاحيّ: لصفحة تنضمّ متأخّرة
        this.relay(s.role, T.FRAME, p);
        this.emit("frame", s.role, p);
        const now = Date.now();
        if (now - s.tick >= 1000) { s.fps = Math.round(s.frames * 1000 / (now - s.tick)); s.kbps = Math.round(s.bytes * 8 / (now - s.tick)); s.frames = 0; s.bytes = 0; s.tick = now; this.changed(); }
        break;
      }
      case T.STAT: { try { s.stat = JSON.parse(p.toString("utf8")); } catch {} this.changed(); break; }
      case T.PONG: { const t = Number(p.toString()); if (t) s.rtt = Date.now() - t; break; }
    }
  }

  send(s, type, payload) {
    if (!s.sock || s.sock.destroyed) return;
    const h = Buffer.alloc(5); h[0] = type; h.writeUInt32BE(payload.length, 1);
    s.sock.write(Buffer.concat([h, payload]));
  }

  drop(s, why) {
    if (!s || s.dead) return;
    console.log("[phone] drop", s.role || "-", why || "closed", "after", Date.now() - s.since, "ms");
    s.dead = true; clearTimeout(s.hello); clearInterval(s.ping);
    try { s.sock.destroy(); } catch {}
    if (s.role && this.phones[s.role] === s) {
      this.phones[s.role] = null;
      this.relay(s.role, T.LIVE, Buffer.from(JSON.stringify({ live: false })));
      this.emit("lost", s.role, why || "");
      this.changed();
    }
  }

  /** أمر للهاتف: {cmd:"zoom", v:1.5} ... */
  command(role, cmd) {
    const s = this.phones[role]; if (!s) return false;
    this.send(s, T.CMD, Buffer.from(JSON.stringify(cmd))); return true;
  }
  live(role) { const s = this.phones[role]; return !!(s && s.cfg && Date.now() - s.lastFrame < 3000); }

  // ---------- صفحات العرض ----------
  handleUpgrade(req, sock, head) {
    const role = new URL(req.url, "http://x").searchParams.get("role");
    if (!ROLES.includes(role)) return sock.destroy();
    this.wss.handleUpgrade(req, sock, head, ws => {
      this.viewers[role].add(ws);
      ws.on("close", () => this.viewers[role].delete(ws));
      ws.on("error", () => {});
      ws.on("message", (d, isBin) => {                         // طلبات من الصفحة (مثلاً إطار مفتاحيّ)
        if (isBin) return;
        try { const j = JSON.parse(String(d)); if (j.cmd === "keyframe") this.command(role, { cmd: "keyframe" }); } catch {}
      });
      const s = this.phones[role];
      if (s && s.cfg) {                                        // انضمام متأخّر: الإعداد، ثمّ نطلب إطاراً مفتاحيّاً جديداً ونتجاهل الفروق حتى يصل
        ws.needKey = true;
        this.sendWs(ws, T.CONFIG, Buffer.from(JSON.stringify(s.cfg)));
        this.command(role, { cmd: "keyframe" });
      }
    });
  }
  // أيّ إطار يُسقَط لأيّ سبب يُفسد ما بعده من الفروق (صورة مشوّشة)، فبعد الإسقاط لا نرسل إلا إطاراً مفتاحيّاً جديداً
  sendWs(ws, type, payload) {
    if (ws.readyState !== 1) return;
    if (type === T.CONFIG) ws.needKey = true;
    if (type === T.FRAME) {
      const key = (payload[0] & 1) === 1;
      if (ws.needKey && !key) return;
      if (ws.bufferedAmount > 4 * 1024 * 1024) {                // الصفحة أبطأ من البثّ: نتخلّى عن الباقي حتى المفتاحيّ التالي
        if (!ws.needKey) { ws.needKey = true; for (const r of ROLES) if (this.viewers[r].has(ws)) this.command(r, { cmd: "keyframe" }); }
        return;
      }
      if (key) ws.needKey = false;
    }
    ws.send(Buffer.concat([Buffer.from([type]), payload]));
  }
  relay(role, type, payload) { for (const ws of this.viewers[role]) this.sendWs(ws, type, payload); }

  // ---------- الحالة والاقتران ----------
  lanAddresses() {
    const bad = /vethernet|vmware|virtualbox|vbox|wsl|docker|hyper-v|loopback|bluetooth|tailscale|zerotier/i;
    const all = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const priv = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      all.push({ name, ip: a.address, priv, virt: bad.test(name) });
    }
    const good = all.filter(a => a.priv && !a.virt);
    return (good.length ? good : all).map(a => a.ip);
  }
  pairUri(role) {
    const c = this.cfg, h = this.lanAddresses().join(",");
    return `majlis://pair?h=${h}&p=${this.port}&t=${encodeURIComponent(c.token)}&r=${role}&n=${encodeURIComponent(os.hostname())}`;
  }
  status() {
    const out = {};
    for (const r of ROLES) {
      const s = this.phones[r];
      out[r] = s ? { name: s.name, since: s.since, live: this.live(r), w: s.cfg && s.cfg.w, h: s.cfg && s.cfg.h, rot: s.cfg && s.cfg.rot, codec: s.cfg && s.cfg.codec, lens: s.cfg && s.cfg.lens,
        fps: s.fps, kbps: s.kbps, bat: s.stat.bat, drop: s.stat.drop, rtt: s.rtt, portrait: s.stat.portrait, portraitOk: s.stat.portraitOk } : null;
    }
    return { port: this.port, host: os.hostname(), ips: this.lanAddresses(), phones: out, uri: { sheikh: this.pairUri("sheikh"), audience: this.pairUri("audience") }, usbAuto: this.cfg.usb !== false };
  }
  changed() { clearTimeout(this._chg); this._chg = setTimeout(() => this.emit("change", this.status()), 120); }

  // ---------- adb (USB) ----------
  findAdb() {
    const exe = process.platform === "win32" ? "adb.exe" : "adb";
    const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")].filter(Boolean);
    const c = [path.join(this.resources, "adb", exe), ...sdk.map(d => path.join(d, "platform-tools", exe))];
    return c.find(p => fs.existsSync(p)) || null;
  }
  adb(args, timeout = 15000) {
    const bin = this.findAdb();
    return new Promise(res => {
      if (!bin) return res({ ok: false, err: "adb غير موجود. ثبّت Android Platform-Tools أو ضع adb.exe في مجلّد resources\\adb" });
      execFile(bin, args, { timeout, windowsHide: true }, (e, out, err) => res({ ok: !e, out: String(out || ""), err: String(err || (e && e.message) || "") }));
    });
  }
  /** يربط منفذ الهاتف بمنفذ الكمبيوتر عبر الكابل: الهاتف يتّصل بـ127.0.0.1 فيصل إلى «المجالس». */
  async usbSetup() {
    const r = await this.adb(["devices"]);
    if (!r.ok) return { ok: false, err: r.err, devices: [] };
    const devs = r.out.split(/\r?\n/).slice(1).map(l => l.trim().split(/\s+/)).filter(x => x[0] && x[1]).map(([serial, state]) => ({ serial, state }));
    for (const d of devs) {
      if (d.state !== "device") continue;
      const x = await this.adb(["-s", d.serial, "reverse", `tcp:${this.port}`, `tcp:${this.port}`]);
      d.reversed = x.ok; if (!x.ok) d.err = x.err.trim();
    }
    const ready = devs.filter(d => d.reversed);
    const unauth = devs.filter(d => d.state === "unauthorized");
    return { ok: ready.length > 0, devices: devs,
      err: ready.length ? "" : unauth.length ? "الهاتف غير مصرَّح: اقبل نافذة «السماح بتصحيح USB» على الهاتف" : devs.length ? "تعذّر ربط المنفذ" : "لا يوجد هاتف موصول بالكابل (فعّل «تصحيح USB» في خيارات المطوّر)" };
  }
  usbAuto(on) {
    clearInterval(this.usbTimer); this.usbTimer = null;
    this.store.patch({ phone: { usb: !!on } });
    if (on) { this.usbSetup().catch(() => {}); this.usbTimer = setInterval(() => this.usbSetup().catch(() => {}), 6000); }
    this.changed();
  }
  apkPath() {
    const c = [path.join(this.resources, "MajlisCam.apk"), path.join(__dirname, "..", "phone", "MajlisCam.apk"), "D:\\madjalis\\app\\build\\outputs\\apk\\debug\\app-debug.apk"];
    return c.find(p => fs.existsSync(p)) || null;
  }
  async installApk() {
    const apk = this.apkPath(); if (!apk) return { ok: false, err: "ملفّ التطبيق MajlisCam.apk غير موجود" };
    const u = await this.usbSetup(); if (!u.devices.some(d => d.state === "device")) return { ok: false, err: u.err };
    const r = await this.adb(["install", "-r", apk], 120000);
    if (r.ok) await this.adb(["shell", "am", "start", "-n", "org.majlis.cam/.MainActivity"]);
    return { ok: r.ok, err: r.ok ? "" : (r.err || r.out).trim().slice(0, 300) };
  }
}

module.exports = { PhoneHub, ROLES, T };
