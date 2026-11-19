// المحرّك: OBS Studio يعمل بالخلفيّة بإعدادات معزولة خاصّة بـ«منبر» (ما يلمس OBS المستخدم إن كان مثبّتاً).
// ماك: CFFIXED_USER_HOME يوجّه مجلّد الإعدادات لمجلّدنا.  ويندوز: نسخة OBS محمولة (--portable) داخل البرنامج.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");

const COLL = ["منبر", "منبر 2"], COLL_FILE = ["Minbar.json", "Minbar_2.json"];
const PROFILE = "منبر", PROFILE_DIR = "Minbar";
const isMac = process.platform === "darwin";

// رقم عمليّة محرّكنا (بروفايل «منبر») — حتى لو OBS المستخدم شغّال بجانبه
function findPid() {
  try {
    const out = require("child_process").execFileSync("pgrep", ["-f", "--", `--profile ${PROFILE}`], { encoding: "utf8" });
    const ids = out.split(/\s+/).filter(Boolean).map(Number);
    return ids.length ? Math.max(...ids) : null;
  } catch { return null; }
}
function ini(obj) { return Object.entries(obj).map(([sec, kv]) => `[${sec}]\n` + Object.entries(kv).map(([k, v]) => `${k}=${v}`).join("\n")).join("\n\n") + "\n"; }

class Engine extends EventEmitter {
  constructor({ dataDir, resources, port = 4466 }) {
    super();
    this.dataDir = dataDir; this.resources = resources; this.port = port;
    this.proc = null; this.ws = null; this.ready = false; this.rid = 0; this.pend = new Map();
    this.collIdx = 0; this.log = [];
    const pw = path.join(dataDir, "engine.key");
    if (!fs.existsSync(pw)) fs.writeFileSync(pw, crypto.randomBytes(12).toString("base64url"), { mode: 0o600 });
    this.password = fs.readFileSync(pw, "utf8").trim();
  }
  // ---------- أين OBS؟ ----------
  findBinary() {
    const c = isMac
      ? [path.join(this.resources, "engine/OBS.app/Contents/MacOS/OBS"), "/Applications/OBS.app/Contents/MacOS/OBS"]
      : [path.join(this.resources, "engine/obs-studio/bin/64bit/obs64.exe"), "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe"];
    return c.find(p => fs.existsSync(p)) || null;
  }
  // مجلّد إعدادات المحرّك
  configRoot(bin) {
    if (isMac) return path.join(this.dataDir, "engine-home", "Library/Application Support/obs-studio");
    return path.join(path.dirname(bin), "../../config/obs-studio");      // OBS المحمول
  }
  // ---------- التجهيز ----------
  prepare(bin, { collection, recDir, encoder, res = [1920, 1080], vbit = 6000 }) {
    const root = this.configRoot(bin);
    const mk = p => fs.mkdirSync(p, { recursive: true });
    mk(path.join(root, "basic/scenes")); mk(path.join(root, `basic/profiles/${PROFILE_DIR}`)); mk(path.join(root, "plugin_config/obs-websocket")); mk(recDir);
    if (!isMac) { const portable = path.join(path.dirname(bin), "../../portable_mode.txt"); if (!fs.existsSync(portable)) fs.writeFileSync(portable, ""); }
    // global.ini: بلا تحديثات ولا شاشة صلاحيّات ولا «ما الجديد»
    const g = path.join(root, "global.ini");
    if (!fs.existsSync(g)) fs.writeFileSync(g, ini({ General: { MaxLogs: 5, InfoIncrement: -1, EnableAutoUpdates: "false", BrowserHWAccel: "true", MacOSPermissionsDialogLastShown: 1, LastVersion: 553648129 } }));
    // user.ini: يبدأ مصغّراً، بلا معالج الإعداد، على مجموعتنا وبروفايلنا
    fs.writeFileSync(path.join(root, "user.ini"), ini({
      General: { Pre19Defaults: "false", Pre21Defaults: "false", Pre23Defaults: "false", "Pre24.1Defaults": "false", ConfirmOnExit: "false", FirstRun: "true", LastVersion: 553648129, HotkeyFocusType: "NeverDisableHotkeys" },
      BasicWindow: { PreviewEnabled: "false", SysTrayEnabled: "true", SysTrayWhenStarted: "true", SysTrayMinimizeToTray: "true", RecordWhenStreaming: "false", KeepRecordingWhenStreamStops: "false", WarnBeforeStartingStream: "false", WarnBeforeStoppingStream: "false", WarnBeforeStoppingRecord: "false" },
      Basic: { Profile: PROFILE, ProfileDir: PROFILE_DIR, SceneCollection: COLL[this.collIdx], SceneCollectionFile: COLL_FILE[this.collIdx], ConfigOnNewProfile: "false" },
    }));
    fs.writeFileSync(path.join(root, "plugin_config/obs-websocket/config.json"), JSON.stringify({ alerts_enabled: false, auth_required: true, first_load: false, server_enabled: true, server_password: this.password, server_port: this.port }, null, 2));
    // البروفايل: 1080p30، تسجيل MP4 هجين، مرمّز العتاد
    fs.writeFileSync(path.join(root, `basic/profiles/${PROFILE_DIR}/basic.ini`), ini({
      General: { Name: PROFILE },
      Output: { Mode: "Simple", FilenameFormatting: "درس %CCYY-%MM-%DD %hh-%mm" },
      SimpleOutput: { FilePath: recDir, RecFormat2: "hybrid_mp4", RecQuality: "HQ", VBitrate: vbit, ABitrate: 192, StreamEncoder: encoder, RecEncoder: encoder, Preset: "veryfast", RecRB: "true", RecRBTime: 120, RecRBSize: 512 },
      Video: { BaseCX: res[0], BaseCY: res[1], OutputCX: res[0], OutputCY: res[1], FPSType: 0, FPSCommon: 30, ScaleType: "lanczos" },
      Audio: { SampleRate: 48000, ChannelSetup: "Stereo" },
    }));
    // المجموعتان: نكتب الحاليّة الآن، والثانية تُستخدم لتطبيق التصميم أثناء التشغيل
    for (let i = 0; i < 2; i++) {
      const c = Object.assign({}, collection, { name: COLL[i] });
      const f = path.join(root, "basic/scenes", COLL_FILE[i]);
      if (i === this.collIdx || !fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(c));
    }
    this.root = root;
  }
  // ---------- التشغيل ----------
  async start(opts) {
    const bin = this.findBinary();
    if (!bin) { this.emit("status", { state: "missing" }); throw new Error("OBS_MISSING"); }
    this.prepare(bin, opts);
    const env = Object.assign({}, process.env);
    if (isMac) env.CFFIXED_USER_HOME = path.join(this.dataDir, "engine-home");
    const args = ["--multi", "--minimize-to-tray", "--disable-updater", "--disable-shutdown-check", "--disable-missing-files-check",
      "--collection", COLL[this.collIdx], "--profile", PROFILE];
    if (!isMac) args.push("--portable");
    this.emit("status", { state: "starting" });
    if (isMac) {
      const stale = findPid(); if (stale) { try { process.kill(stale, "SIGTERM"); } catch {} await new Promise(r => setTimeout(r, 2500)); }
      // نشغّله عبر macOS (open) عشان يكون هو المسؤول عن صلاحيّات الكاميرا والمايك (صلاحيّات OBS نفسه)، لا برنامجنا
      const appPath = bin.replace(/\/Contents\/MacOS\/OBS$/, "");
      spawn("open", ["-n", "-g", "-j", "-a", appPath, "--env", `CFFIXED_USER_HOME=${env.CFFIXED_USER_HOME}`, "--args", ...args], { stdio: "ignore" });
      let pid = null;
      for (let i = 0; i < 40 && !pid; i++) { await new Promise(r => setTimeout(r, 400)); pid = findPid(); }
      if (!pid) throw new Error("ENGINE_NO_PID");
      this.proc = { pid, kill: sig => process.kill(pid, sig) };
      clearInterval(this.watch);
      this.watch = setInterval(() => { try { process.kill(pid, 0); } catch { clearInterval(this.watch); this.proc = null; this.ready = false; this.emit("status", { state: "stopped" }); } }, 2000);
    } else {
      this.proc = spawn(bin, args, { cwd: path.dirname(bin), env, stdio: "ignore", detached: false });
      this.proc.on("exit", code => { this.proc = null; this.ready = false; this.emit("status", { state: "stopped", code }); });
    }
    await this.connect();
  }
  connect(timeout = 45000) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
      const tryOnce = () => {
        if (!this.proc) return reject(new Error("ENGINE_EXITED"));
        let ws, opened = false, retried = false;
        const retry = () => {
          if (retried || opened) return; retried = true;
          if (Date.now() - t0 < timeout) setTimeout(tryOnce, 800); else reject(new Error("ENGINE_TIMEOUT"));
        };
        try { ws = new WebSocket(`ws://127.0.0.1:${this.port}`); } catch (e) { return retry(); }
        ws.onopen = () => { opened = true; };
        ws.onmessage = ev => this.onMessage(ws, JSON.parse(ev.data), resolve);
        ws.onerror = () => retry();
        ws.onclose = () => {
          if (this.ws === ws) { this.ws = null; this.ready = false; this.emit("status", { state: "disconnected" }); if (this.proc) setTimeout(() => this.connect().catch(() => {}), 1500); return; }
          retry();
        };
      };
      tryOnce();
    });
  }
  onMessage(ws, m, resolve) {
    if (m.op === 0) {
      const d = { rpcVersion: 1, eventSubscriptions: (1 << 0) | (1 << 2) | (1 << 3) | (1 << 6) | (1 << 16) };   // general|scenes|inputs|outputs|meters
      if (m.d.authentication) { const h = s => crypto.createHash("sha256").update(s).digest("base64"); d.authentication = h(h(this.password + m.d.authentication.salt) + m.d.authentication.challenge); }
      ws.send(JSON.stringify({ op: 1, d }));
    } else if (m.op === 2) { this.ws = ws; this.ready = true; this.emit("status", { state: "ready" }); resolve && resolve(); }
    else if (m.op === 7) { const p = this.pend.get(m.d.requestId); if (p) { this.pend.delete(m.d.requestId); m.d.requestStatus.result ? p.res(m.d.responseData || {}) : p.rej(new Error(`${m.d.requestType}: ${m.d.requestStatus.comment || m.d.requestStatus.code}`)); } }
    else if (m.op === 5) this.emit("event", m.d.eventType, m.d.eventData || {});
  }
  req(type, data = {}, timeout = 20000) {
    return new Promise((res, rej) => {
      if (!this.ws || !this.ready) return rej(new Error("المحرّك غير متّصل"));
      const id = String(++this.rid); this.pend.set(id, { res, rej });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
      setTimeout(() => { if (this.pend.has(id)) { this.pend.delete(id); rej(new Error(type + ": timeout")); } }, timeout);
    });
  }
  // اتّصال جانبيّ مستقلّ (للمعاينة وفحص الكاميرا) حتى لا تنتظر أوامر المستخدم خلفها
  sideClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`); let rid = 0; const pend = new Map();
      const api = { ws, close: () => { try { ws.close(); } catch {} }, req: (type, data = {}) => new Promise((res, rej) => {
        if (ws.readyState !== 1) return rej(new Error("closed"));
        const id = String(++rid); pend.set(id, { res, rej }); ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }));
        setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error("timeout")); } }, 8000);
      }) };
      ws.onerror = () => reject(new Error("side failed"));
      ws.onclose = () => { for (const p of pend.values()) p.rej(new Error("closed")); pend.clear(); api.closed = true; };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.op === 0) { const d = { rpcVersion: 1, eventSubscriptions: 0 }; if (m.d.authentication) { const h = s => crypto.createHash("sha256").update(s).digest("base64"); d.authentication = h(h(this.password + m.d.authentication.salt) + m.d.authentication.challenge); } ws.send(JSON.stringify({ op: 1, d })); }
        else if (m.op === 2) resolve(api);
        else if (m.op === 7) { const p = pend.get(m.d.requestId); if (p) { pend.delete(m.d.requestId); m.d.requestStatus.result ? p.res(m.d.responseData || {}) : p.rej(new Error(m.d.requestStatus.comment || "err")); } }
      };
    });
  }
  // تطبيق تصميم جديد أثناء التشغيل: نكتب المجموعة البديلة ونتحوّل لها (OBS يحفظ الحاليّة عند الخروج منها)
  async applyCollection(collection) {
    const next = 1 - this.collIdx;
    fs.writeFileSync(path.join(this.root, "basic/scenes", COLL_FILE[next]), JSON.stringify(Object.assign({}, collection, { name: COLL[next] })));
    // تحميل المجموعة مع الكاميرات قد يطول (أكثر من 20 ثانية)، وOBS يرفض الطلب لو كان ما زال يحمّل تحويلاً سابقاً
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; ; i++) {
      try { await this.req("SetCurrentSceneCollection", { sceneCollectionName: COLL[next] }, 120000); break; }
      catch (e) {
        if (/not ready/i.test(e.message) && i < 10) { await sleep(3000); continue; }
        if (/timeout/.test(e.message)) {          // قد يكون التحويل تمّ وتأخّر الردّ فقط
          const cur = await this.req("GetSceneCollectionList").then(r => r.currentSceneCollectionName).catch(() => null);
          if (cur === COLL[next]) break;
        }
        throw e;
      }
    }
    this.collIdx = next;
  }
  stop() {
    clearInterval(this.watch);
    if (!this.proc && isMac) { const pid = findPid(); if (pid) this.proc = { pid, kill: sig => process.kill(pid, sig) }; }
    if (!this.proc) return;
    try { this.ws && this.ws.close(); } catch {}
    const p = this.proc; this.proc = null;
    try { p.kill("SIGTERM"); } catch {}
    setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 4000);
  }
}
module.exports = { Engine, COLL };
