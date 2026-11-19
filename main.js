// «منبر» — برنامج بثّ وتصوير الدروس العلميّة.  العمليّة الرئيسيّة: النافذة + المحرّك + المكتبة + الخادم المحلّيّ.
const { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } = require("electron");
const path = require("path");
const fs = require("fs");
const { Store } = require("./src/store");
const { Server } = require("./src/server");
const { Engine } = require("./src/engine");
const { Library } = require("./src/library");
const Scenes = require("./src/scenes");
const Halaqat = require("./src/halaqat");
const { PhoneHub } = require("./src/phone");

app.setName("Minbar");
const DATA = app.getPath("userData");
const MEDIA = path.join(DATA, "media");
fs.mkdirSync(MEDIA, { recursive: true });
const REC_DIR = path.join(app.getPath("videos"), "بث الدروس العلمية");
// مجلّدات الحفظ الثلاثة منفصلة: الدروس (فيديو البرنامج) | الريلز (وفيها «المصادر» = كاميرا الشيخ العموديّة) | الصوتيّات. كلّها قابلة للتغيير من تبويب «البثّ»
const DEF_DIRS = { rec: REC_DIR, reels: path.join(app.getPath("videos"), "ريلز المجالس"), audio: path.join(app.getPath("music"), "صوتيات الدروس العلمية") };
const dirOf = k => { const d = store && S().dirs && S().dirs[k]; return d && path.isAbsolute(d) ? d : DEF_DIRS[k]; };
const recDir = () => dirOf("rec"), reelsDir = () => dirOf("reels"), audioDir = () => dirOf("audio"), srcDir = () => path.join(reelsDir(), "المصادر");
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, "resources");

// ---------- النسخة المثبَّتة: الحلقات وشعاراتها وكتبها تأتي مع المثبّت (مجلّد seed) وتُزرَع عند أوّل تشغيل ----------
const SEED = path.join(process.resourcesPath || "", "seed"), SEED_MARK = path.join(DATA, ".seeded.json");
const seedMark = () => { try { return JSON.parse(fs.readFileSync(SEED_MARK, "utf8")); } catch { return null; } };
function seedSettings() {                         // الإعدادات والوسائط (صغيرة): تُنسخ فوراً وقبل إنشاء المخزن
  try {
    if (!app.isPackaged || seedMark() || fs.existsSync(path.join(DATA, "settings.json")) || !fs.existsSync(path.join(SEED, "settings.json"))) return;
    if (fs.existsSync(path.join(SEED, "media"))) fs.cpSync(path.join(SEED, "media"), MEDIA, { recursive: true, force: false });
    fs.copyFileSync(path.join(SEED, "settings.json"), path.join(DATA, "settings.json"));
    fs.writeFileSync(SEED_MARK, JSON.stringify({ settings: true, books: false }));
  } catch (e) { console.error("[seed]", e.message); }
}
// الكتب (كبيرة): تُنسخ بعد التفعيل مع نافذة انتظار، وتُستأنف لو انقطعت
async function seedBooks() {
  try {
    const m = seedMark(), src = path.join(SEED, "books");
    if (!app.isPackaged || !m || m.books || !fs.existsSync(src)) return;
    const w = new BrowserWindow({ width: 460, height: 190, frame: false, resizable: false, alwaysOnTop: true, backgroundColor: "#0A1311", webPreferences: { sandbox: true } });
    w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent('<body dir="rtl" style="margin:0;background:#0A1311;color:#EBD29A;font:700 22px Tahoma,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:10px"><div>جارٍ تجهيز مكتبة الكتب…</div><div style="font:400 14px Tahoma;color:#A8BBB3">يحدث هذا مرّة واحدة عند أوّل تشغيل</div></body>'));
    await fs.promises.cp(src, path.join(DATA, "books"), { recursive: true, force: false, errorOnExist: false });
    fs.writeFileSync(SEED_MARK, JSON.stringify({ settings: true, books: true })); try { w.destroy(); } catch {}
  } catch (e) { console.error("[seed books]", e.message); }
}
seedSettings();

const store = new Store(DATA);
const lib = new Library(DATA);
Halaqat.ensure(store);          // أوّل تشغيل: الحلقتان الافتراضيّتان + ترحيل بياناتك القديمة
let phone = null;
let win = null, engine = null, server = null, built = null, programScene = "", breakAt = 0;
let live = { stream: false, rec: false, t0: 0 }, chapters = [], lastChapter = "";

let MODE_OVR = null, SEL_OVR = null, SBXS = null;
const S = () => (MODE_OVR || SEL_OVR || SBXS) ? Object.assign({}, SBXS ? SBXS.get() : store.get(), MODE_OVR ? { mode: MODE_OVR } : {}, SEL_OVR ? { sel: SEL_OVR } : {}) : store.get();
// ---------- الأقسام: خطب الجمع / المحاضرات ----------
// تُترجَم إعدادات القسم إلى نفس مفاتيح النصوص التي تقرؤها الطبقات (البرنامج=العنوان، النطاق=المسجد والمكان، المجلس=التاريخ، الشيخ=الخطيب/المحاضر) فلا يلزم تعديل كل طبقة
function autoDate() {
  const d = new Date(), f = (loc, o) => { try { return new Intl.DateTimeFormat(loc, o).format(d); } catch { return ""; } };
  return [f("ar-SA", { weekday: "long" }), f("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }) + " هـ", "الموافق " + f("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }) + " م"].filter(Boolean).join(" ");
}
const MODE_CAM2 = {
  lessons: { audience: "الحضور", students: "الطلبة", courtyard: "باحة المسجد" },
  khutba: { worshippers: "المصلّون", courtyard: "باحة المسجد", women: "مصلّى النساء", outside: "خارج المسجد" },
  lecture: { listeners: "المستمعون", hall: "القاعة", students: "الطلبة", audience: "الحضور" },
  podcast: { guest: "الضيف", cohost: "مقدّم مشارك", audience: "الحضور" },
  quran: { second: "الكاميرا الثانية", audience: "الحضور" },
};
function effTexts() {
  const s = S(), m = Halaqat.isMode(s) ? s.modes[s.mode] : null; if (!m) return s.texts;
  const date = m.dateAuto === false && m.dateText ? m.dateText : autoDate(), join = a => a.filter(Boolean).join(" · ");
  const o = s.mode === "podcast"
    ? { program: m.title, scope: join([m.episode && "الحلقة " + m.episode, m.topic]), session: date, "sheikh-title": m.hostTitle, sheikh: m.host, guest: m.guest, "guest-title": m.guestTitle, guestRole: m.guestRole, third: m.third, "third-title": m.thirdTitle, topic: m.topic, episode: m.episode, tagline: m.tagline, next: m.next || "", mosque: "", place: "" }
    : s.mode === "khutba"
    ? { program: join([m.title || "خطبة الجمعة", m.topic]).replace(" · ", " — "), scope: join([m.mosque, m.place]), session: date, "sheikh-title": m.khatibTitle, sheikh: m.khatib, mosque: m.mosque, place: m.place }
    : { program: m.title, scope: join([m.org, m.place]), session: date, "sheikh-title": m.lecturerTitle, sheikh: m.lecturer, mosque: m.org, place: m.place };
  return Object.assign({}, s.texts, o, { book: "", "sheikh-post": "", reader: "", halaqa: "", date, start: m.start || s.texts.start });
}
const overlayState = () => {
  const s = S(), lessons = !Halaqat.isMode(s);
  return { mode: s.mode || "lessons", quran: s.mode === "quran" ? (s.quran || null) : null, podcast: s.mode === "podcast" ? (((s.modes || {}).podcast || {}).tpl || { id: "studio" }) : null, bed: s.mode === "podcast" ? ((((s.modes || {}).podcast || {}).music || {}).bed || null) : null, texts: effTexts(), design: s.design, logos: s.logos, book: lessons ? s.book : null, bookState: s.bookState, breakAt, cam: camShow(), cam2: { on: !!s.cam2.on, label: cam2Label() }, cam3: { on: !!(s.cam3 || {}).on, label: ((s.cam3 || {}).label || "").trim() }, photos: s.mode === "podcast" ? (((s.modes || {}).podcast || {}).photos || null) : null, liveSince: (live.stream || live.rec) ? live.t0 : 0, captions: { on: !!s.captions.on, langs: s.captions.langs, size: s.captions.size, pos: s.captions.pos, lift: s.captions.lift }, ...screenState() };
};
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };

// شعار الحلقة في شاشات «قبل البث / الاستراحة / الختام» (مع النسخة بلا خلفيّة لو فُعّلت)
function screenState() {
  const { h, b } = Halaqat.current(MODE_OVR || SBXS ? { get: S } : store), img = o => o && o.file ? (o.nobg && o.cut ? o.cut : o.file) : null, shImg = b ? b.sheikhImg : (Halaqat.isMode(S()) && h ? h.sheikhImg : null), lb = (S().library || []).find(x => S().book && x.id === S().book.id);
  return { screens: h ? h.screens : {}, imgs: { logo: img(h && h.logo), guest: img(Halaqat.isMode(S()) && h ? h.guestImg : null), sheikh: img(shImg), sheikhCut: !!(shImg && shImg.nobg && shImg.cut), logoCut: !!(h && h.logo && h.logo.nobg && h.logo.cut) }, socials: (h && h.socials) || [], bookAuthor: (b && b.author) || (lb && lb.author) || "" };
}
// ---------- المحرّك ----------
function buildCollection() {
  const s = S();
  // الأقنعة يقرأها OBS من القرص مباشرة، فلازم تكون خارج app.asar (asarUnpack)
  const assets = path.join(__dirname, "assets").replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
  built = Scenes.build({ base: server.base, assets, maskDir: path.join(DATA, "masks"), s: Object.assign({ _collName: "منبر" }, s) });
  return built.coll;
}
async function startEngine() {
  engine = new Engine({ dataDir: DATA, resources: RES });
  engine.on("status", st => { console.log("[engine]", st.state, st.error || ""); send("engine", st); if (st.state === "ready") afterReady(); });
  engine.on("event", onObsEvent);
  try {
    const c = buildCollection();
    await engine.start({ collection: c, recDir: recDir(), encoder: process.platform === "darwin" ? "apple_h264" : "x264", res: [built.W, built.H], vbit: built.K > 1 ? 16000 : 6000 });
  } catch (e) { console.error("[engine] start failed", e); send("engine", { state: e.message === "OBS_MISSING" ? "missing" : "error", error: e.message }); }
}
async function afterReady() {
  // websocket يفتح قبل ما تكمل واجهة OBS تحميل المشاهد — ننتظر حتى يجاوب
  for (let i = 0; i < 60; i++) { try { await engine.req("GetCurrentProgramScene"); break; } catch { await new Promise(r => setTimeout(r, 600)); } }
  try {
    const sc = await engine.req("GetCurrentProgramScene"); programScene = sc.currentProgramSceneName || sc.sceneName; send("scene", programScene);
    const [r, l] = await Promise.all([engine.req("GetRecordStatus"), engine.req("GetStreamStatus")]);
    live.rec = r.outputActive; live.stream = l.outputActive; send("outputs", live);
    applyFraming();
    applyTransition(); applyCinema();
    if (S().reels && S().reels.rb && S().reels.rb.on) rbSetup(true, S().reels.rb.secs).catch(e => console.error("[replay]", e.message));
    previewLoop();
    camWatch();
  } catch (e) { console.error("afterReady", e); }
}
// ---------- الكاميرا: هل هي شغّالة فعلاً؟ ----------
let camLive = { sheikh: false, cam2: false, cam3: false }, camApplied = "", sheikhFit = false;
const camShow = () => { const hide = S().design.hideSpeaker; const sh = camLive.sheikh && !hide; return { sheikh: sh, "sheikh:crop": sh && !sheikhFit, "sheikh:fit": sh && sheikhFit, cam2: camLive.cam2 && !!S().cam2.on, cam3: camLive.cam3 && !!(S().cam3 || {}).on }; };
// ---------- الكاميرا 2 (ثانويّة): تفعيل/إغلاق، والوجهة: الطلبة / باحة المسجد / نصّ حرّ ----------
const CAM2_SCENE = (Scenes.SCENES.find(x => x.key === "cam2") || {}).name, CAM2_SRC = "مصدر كاميرا الحضور";
const DUO_SCENE = (Scenes.SCENES.find(x => x.key === "duo") || {}).name, DUO2_SCENE = (Scenes.SCENES.find(x => x.key === "duo2") || {}).name, GALG_SCENE = (Scenes.SCENES.find(x => x.key === "galguest") || {}).name;
const CAM3_SCENE = (Scenes.SCENES.find(x => x.key === "cam3") || {}).name, TRIO_SCENE = (Scenes.SCENES.find(x => x.key === "trio") || {}).name, CAM3_SRC = "مصدر كاميرا ثالثة";
function cam2Label() { const c = S().cam2, T2 = MODE_CAM2[S().mode || "lessons"] || MODE_CAM2.lessons; return T2[c.target] || (c.label || "").trim() || "كاميرا الحضور"; }
const isPhoneCam = who => { if (who === "cam3") return false; const d = who === "cam2" ? S().devices.cam2 : S().devices.camSheikh; return !!(d && d.phone); };
// وصلت إعدادات صورة من الهاتف (حجم/تدوير): نضبط حجم مصدر المتصفّح ليطابقها ثمّ نعيد التأطير
async function onPhoneConfig(role, c) {
  const swap = c.rot === 90 || c.rot === 270, w = swap ? c.h : c.w, h = swap ? c.w : c.h;
  const cur = (S().phone.size || {})[role] || [0, 0];
  if (cur[0] !== w || cur[1] !== h) store.patch({ phone: { size: Object.assign({}, S().phone.size, { [role]: [w, h] }) } });
  if (!engine || !engine.ready) return;
  const name = role === "audience" ? CAM2_SRC : "كاميرا الشيخ";
  if (!isPhoneCam(role === "audience" ? "cam2" : "sheikh")) return;
  await engine.req("SetInputSettings", { inputName: name, inputSettings: { width: w, height: h, fps: Math.min(60, c.fps || 30) }, overlay: true }).catch(() => {});
  setTimeout(() => applyFraming(), 400);
}
// جودة الكاميرا (الدقّة/الإطارات/الصيغة) تُطبَّق لحظيّاً على مصدرَي الكاميرا في ويندوز دون إعادة بناء
// الحجم الواصل الآن من مصدر الكاميرا (٠ = لا صورة)
async function camSize(who) {
  const ci = built && built.camItems.find(c => c.who === who && !/◂/.test(c.scene)); if (!ci) return null;
  const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: ci.scene, sourceName: ci.source });
  const { sceneItemTransform: t } = await engine.req("GetSceneItemTransform", { sceneName: ci.scene, sceneItemId });
  return { w: t.sourceWidth || 0, h: t.sourceHeight || 0 };
}
let camQBusy = false;
async function applyCamQuality() {
  if (!engine || !engine.ready || process.platform !== "win32" || camQBusy) return;
  camQBusy = true;
  try {
    const push = () => { const o = Scenes.camQuality(S().camQ); return Promise.all(["كاميرا الشيخ", CAM2_SRC, CAM3_SRC].map(inputName => {
      const d = inputName === CAM2_SRC ? S().devices.cam2 : inputName === CAM3_SRC ? S().devices.cam3 : S().devices.camSheikh;
      return d && d.phone ? null : engine.req("SetInputSettings", { inputName, inputSettings: o, overlay: true }).catch(() => {}); })); };
    const dv = S().devices.camSheikh, watch = dv && dv.id && !dv.phone;
    const before = watch ? await camSize("sheikh").catch(() => null) : null;
    await push();
    // حماية: إجبار صيغة أو دقّة لا يدعمها الجهاز يقطع الصورة تماماً، فنتراجع تلقائيّاً إلى أقرب إعداد يعمل
    if (watch && before && before.w > 0 && S().camQ.res !== "auto") {
      await sleep(3800);
      let now = await camSize("sheikh").catch(() => null);
      if (now && !(now.w > 0) && S().camQ.fmt !== "auto") { store.patch({ camQ: { fmt: "auto" } }); await push(); send("toast", "الكاميرا لا تدعم هذه الصيغة مع هذه الدقّة — أُعيدت الصيغة إلى «تلقائي»", 5000); await sleep(6500); now = await camSize("sheikh").catch(() => null); }
      if (now && !(now.w > 0)) { store.patch({ camQ: { res: "auto", fps: 0, fmt: "auto" } }); await push(); send("toast", "الكاميرا لا ترسل صورة بهذه الدقّة — أُعيدت الجودة إلى «تلقائي»", 5000); }
      send("camq", true);
    }
  } finally { camQBusy = false; }
}
// الكاميرا الثالثة: مطفأة = تُحرَّر الكاميرا، ولو كنّا في مشهدها أو الثلاثي نعود للمقدّم
async function cam3Apply() {
  if (!engine || !engine.ready) return;
  const on = !!(S().cam3 || {}).on;
  if (process.platform === "win32") await engine.req("SetInputSettings", { inputName: CAM3_SRC, inputSettings: { deactivate_when_not_showing: !on }, overlay: true }).catch(() => {});
  if (!on && (programScene === CAM3_SCENE || programScene === TRIO_SCENE)) { const back = (Scenes.SCENES.find(x => x.key === "sheikh") || {}).name; await engine.req("SetCurrentProgramScene", { sceneName: back }).catch(() => {}); }
  camApplied = ""; applyCam(true);
}
async function cam2Apply() {
  if (!engine || !engine.ready) return;
  const on = !!S().cam2.on;
  // ويندوز: مطفأة = تُحرَّر الكاميرا فعلاً (يفتحها البرنامج فقط لمّا تكون مفعّلة)
  if (process.platform === "win32" && !isPhoneCam("cam2")) await engine.req("SetInputSettings", { inputName: CAM2_SRC, inputSettings: { deactivate_when_not_showing: !on }, overlay: true }).catch(() => {});
  if (!on && programScene === CAM2_SCENE) { const back = (Scenes.SCENES.find(x => x.key === "sheikh") || {}).name; await engine.req("SetCurrentProgramScene", { sceneName: back }).catch(() => {}); }
  camApplied = ""; applyCam(true);
}
let watchOn = false;
async function camWatch() {
  if (watchOn) return; watchOn = true;
  let side = null; const offN = { sheikh: 0, cam2: 0, cam3: 0 };
  while (engine && engine.ready) {
    try {
      if (!side || side.closed) side = await engine.sideClient();
      const check = async who => {
        if (isPhoneCam(who)) return !!(phone && phone.live(who === "cam2" ? "audience" : "sheikh"));      // هاتف المجالس: متّصل ويرسل صورة
        const ci = built && built.camItems.find(c => c.who === who && !/◂/.test(c.scene));
        if (!ci) return false;
        const { sceneItemId } = await side.req("GetSceneItemId", { sceneName: ci.scene, sourceName: ci.source });
        const { sceneItemTransform: tr } = await side.req("GetSceneItemTransform", { sceneName: ci.scene, sceneItemId });
        return tr.sourceWidth > 0;
      };
      const hold = (who, v) => { if (v) { offN[who] = 0; return true; } return ++offN[who] >= 3 ? false : camLive[who]; };
      const sh = hold("sheikh", await check("sheikh"));
      const c2 = built.camItems.some(c => c.who === "cam2") ? hold("cam2", await check("cam2")) : false;
      const c3 = built.camItems.some(c => c.who === "cam3") ? hold("cam3", await check("cam3")) : false;
      if (sh !== camLive.sheikh || c2 !== camLive.cam2 || c3 !== camLive.cam3) { camLive = { sheikh: sh, cam2: c2, cam3: c3 }; if (sh || c2 || c3) applyFraming(); }
      await applyCam();
    } catch { side = null; }
    await new Promise(r => setTimeout(r, 2000));
  }
  watchOn = false;
}
// يخفي الكاميرا والتغبيش ويوسّط الكتاب لو ما فيه متحدّث، ويرجعها لمّا تشتغل الكاميرا
async function applyCam(force) {
  const show = camShow(), key = JSON.stringify(show) + (built && built.coll.name) + (built && built.K);
  if (!force && key === camApplied) return;
  camApplied = key; server.push("state"); send("cams", Object.assign({ live: camLive }, show));
  for (const t of built.camToggles) {
    try { const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: t.scene, sourceName: t.source });
      await engine.req("SetSceneItemEnabled", { sceneName: t.scene, sceneItemId, sceneItemEnabled: !!show[t.who] }); } catch {}
  }
  // مشهد «سطور الكتاب»: عناصر «أمام الشيخ» أو «بجانبه» بحسب الإعداد (تُبدَّل لحظيّاً)
  const rp = ((S().design || {}).reading || {}).pos === "side" ? "side" : "front";
  for (const t of (built.posToggles || [])) {
    try { const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: t.scene, sourceName: t.source });
      await engine.req("SetSceneItemEnabled", { sceneName: t.scene, sceneItemId, sceneItemEnabled: t.pos === rp && (!t.who || !!show[t.who]) }); } catch {}
  }
  for (const m of built.moves) {
    try { const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: m.scene, sourceName: m.source });
      const [x, y] = show.sheikh ? m.on : m.off;
      await engine.req("SetSceneItemTransform", { sceneName: m.scene, sceneItemId, sceneItemTransform: { positionX: x, positionY: y } }); } catch {}
  }
}

// ---------- منصّات البثّ (يوتيوب، فيسبوك، تيليجرام، أخرى) ----------
const PLATFORM_SERVERS = { youtube: "rtmps://a.rtmps.youtube.com:443/live2", facebook: "rtmps://live-api-s.facebook.com:443/rtmp/" };
const activePlatforms = () => Object.entries(S().platforms || {}).filter(([k, p]) => p.on && p.key && (PLATFORM_SERVERS[k] || p.server))
  .map(([k, p]) => ({ k, server: PLATFORM_SERVERS[k] || p.server.trim(), key: p.key.trim() }));
let relay = null;
function findFfmpeg() {
  const os = require("os");
  const c = [path.join(RES, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", path.join(os.homedir(), "bin/ffmpeg")];
  return c.find(p => fs.existsSync(p)) || null;
}
// أكثر من منصّة: المحرّك يبثّ لمرحّل محلّيّ (ffmpeg) ينسخ البثّ لكل المنصّات بدون إعادة ترميز
async function startRelay(list) {
  const ff = findFfmpeg(); if (!ff) throw new Error("البثّ لأكثر من منصّة يحتاج مكوّن ffmpeg — فعّل منصّة وحدة الآن");
  const join = (u, k) => u.replace(/\/?$/, "/") + k;
  const tee = list.map(p => `[f=flv:onfail=ignore]${join(p.server, p.key)}`).join("|");
  const { spawn } = require("child_process");
  relay = spawn(ff, ["-hide_banner", "-loglevel", "error", "-listen", "1", "-i", "rtmp://127.0.0.1:1936/live/minbar", "-c", "copy", "-map", "0", "-f", "tee", tee], { stdio: ["ignore", "ignore", "pipe"] });
  relay.stderr.on("data", d => console.error("[relay]", String(d).trim()));
  relay.on("exit", () => { relay = null; });
  await new Promise(r => setTimeout(r, 800));
}
function stopRelay() { if (relay) { try { relay.kill("SIGTERM"); } catch {} relay = null; } }
async function setStream(server, key) { await engine.req("SetStreamServiceSettings", { streamServiceType: "rtmp_custom", streamServiceSettings: { server, key, use_auth: false } }); }
// قصّ الكاميرا حسب مقاسها الحقيقيّ: الوجه في مكانه من الإطار + التكبير
async function applyFraming(tries = 0) {
  if (!engine || !engine.ready || !built) return;
  let pending = false, fitNow = sheikhFit;
  for (const ci of built.camItems) {
    if ((ci.who === "cam2" && !S().cam2.on) || (ci.who === "cam3" && !(S().cam3 || {}).on)) continue;      // الكاميرا 2 مطفأة (محرّرة): لا مقاس تنتظره
    try {
      const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: ci.scene, sourceName: ci.source });
      const { sceneItemTransform: tr } = await engine.req("GetSceneItemTransform", { sceneName: ci.scene, sceneItemId });
      if (!tr.sourceWidth || !tr.sourceHeight) { pending = true; continue; }
      const f = S().framing[ci.who] || { zoom: 1, fx: .5, fy: .42 };
      // تدوير الصورة (0/90/180/270 باتّجاه عقارب الساعة): للهاتف حين يكون عموديّاً وتصل الصورة جانبيّة.
      // كل الحساب أدناه على الصورة «كما تُرى» بعد التدوير، ثمّ نحوّل هوامش القصّ إلى جهات المصدر الأصليّة.
      const rot = (((Math.round((f.rot || 0) / 90) * 90) % 360) + 360) % 360, swap = rot === 90 || rot === 270;
      const sw = swap ? tr.sourceHeight : tr.sourceWidth, sh = swap ? tr.sourceWidth : tr.sourceHeight;
      const [bx, by, w, h] = ci.box;
      // الهاتف العموديّ قد يصل داخل إطار أفقيّ بأشرطة سوداء على الجانبين: f.box = مستطيل الصورة الفعليّة (نسبةً للإطار) فنقصّ منه فقط
      const nb = Array.isArray(f.box) && f.box.length === 4 ? f.box : [0, 0, 1, 1];
      const cx0 = nb[0] * sw, cy0 = nb[1] * sh, cw = Math.max(1, (nb[2] - nb[0]) * sw), ch = Math.max(1, (nb[3] - nb[1]) * sh);
      if (ci.who === "sheikh" && !ci.mode && !ci.center && !ci.fit) fitNow = S().design.camFit === "fit" && cw / ch < 1.25;      // الصورة الفعليّة عموديّة؟
      const at = ci.center || ci.mode ? [.5, .5] : ci.at;
      const fxp = ci.center || ci.mode ? cx0 + cw / 2 : f.fx * sw, fyp = ci.center || ci.mode ? cy0 + ch / 2 : f.fy * sh;
      let sc, bw = w, bh = h, ox = bx, oy = by, L, T, R, B;
      if (ci.mode === "contain") {
        // الصورة العموديّة كاملة في وسط الشاشة الأفقيّة
        sc = Math.min(w / cw, h / ch); bw = cw * sc; bh = ch * sc; ox = bx + (w - bw) / 2; oy = by + (h - bh) / 2;
        L = Math.round(cx0); T = Math.round(cy0); R = Math.max(0, Math.round(sw - cx0 - cw)); B = Math.max(0, Math.round(sh - cy0 - ch));
      } else {
        const base = Math.max(w / cw, h / ch);
        let z = ci.center ? 1 : (f.zoom || 1);
        // «صفحة + الشيخ»: الشيخ لازم يصل لمكانه بجانب الصفحة. القصّ لا يحرّك الصورة أفقيّاً إلا لو كبّرناها،
        // فنرفع التقريب بالقدر الذي يكفي ليقع وجهه عند النقطة المطلوبة (ci.at) بدل أن يبقى في وسط الشاشة خلف الصفحة
        if (ci.fit) { const vwMax = Math.max(1, Math.min((fxp - cx0) / at[0], (cx0 + cw - fxp) / (1 - at[0]))); z = Math.min(3.2, Math.max(z, (w / vwMax) / base)); }
        sc = base * z; const vw = w / sc, vh = h / sc;
        L = Math.round(Math.min(Math.max(fxp - at[0] * vw, cx0), cx0 + cw - vw)); T = Math.round(Math.min(Math.max(fyp - at[1] * vh, cy0), cy0 + ch - vh));
        R = Math.max(0, Math.round(sw - vw - L)); B = Math.max(0, Math.round(sh - vh - T));
      }
      // هوامش المشهد (يسار/أعلى/يمين/أسفل) ← هوامش المصدر، ونقطة التدوير هي الزاوية العليا اليسرى للعنصر
      const m = { 0: { l: L, t: T, r: R, b: B, x: ox, y: oy }, 90: { l: T, t: R, r: B, b: L, x: ox + bw, y: oy },
        180: { l: R, t: B, r: L, b: T, x: ox + bw, y: oy + bh }, 270: { l: B, t: L, r: T, b: R, x: ox, y: oy + bh } }[rot];
      await engine.req("SetSceneItemTransform", { sceneName: ci.scene, sceneItemId, sceneItemTransform: {
        positionX: m.x, positionY: m.y, rotation: rot, scaleX: sc, scaleY: sc, boundsType: "OBS_BOUNDS_NONE",
        cropLeft: m.l, cropTop: m.t, cropRight: m.r, cropBottom: m.b } });
    } catch (e) { pending = true; }
  }
  if (fitNow !== sheikhFit) { sheikhFit = fitNow; camApplied = ""; applyCam(true); }      // تبديل بين «قصّ» و«عمودي كامل»
  if (pending && tries < 20) setTimeout(() => applyFraming(tries + 1), 1500);
}
// حجم لقطة المعاينة: صغير في الوضع العاديّ، وأكبر في «العرض الكبير» حتى لا تتشوّش عند التكبير
const PREV = { w: 800, h: 450, q: 70 };
ipcMain.handle("preview:size", (_e, big) => { Object.assign(PREV, big ? { w: 1600, h: 900, q: 78 } : { w: 800, h: 450, q: 70 }); return true; });
let previewOn = false;
async function previewLoop() {
  if (previewOn) return; previewOn = true;
  let side = null;
  while (engine && engine.ready) {
    if (Date.now() < previewHold) { await new Promise(r => setTimeout(r, 40)); continue; }
    if (win && !win.isDestroyed() && win.isVisible() && !win.isMinimized() && programScene) {
      try {
        if (!side || side.closed) side = await engine.sideClient();
        const r = await side.req("GetSourceScreenshot", { sourceName: programScene, imageFormat: "jpg", imageWidth: PREV.w, imageHeight: PREV.h, imageCompressionQuality: PREV.q });
        send("preview", r.imageData);
      } catch { side = null; await new Promise(r => setTimeout(r, 500)); }
      await new Promise(r => setTimeout(r, 45));
    } else await new Promise(r => setTimeout(r, 400));
  }
  previewOn = false;
}
let meterT = 0;
function onObsEvent(type, d) {
  if (type === "CurrentProgramSceneChanged") {
    programScene = d.sceneName; send("scene", programScene);
    if (/استراحة/.test(programScene)) { breakAt = Date.now(); server.push("state"); chapter("استراحة"); }
  } else if (type === "StreamStateChanged" || type === "RecordStateChanged") {
    const was = live.stream || live.rec;
    if (type === "StreamStateChanged") { live.stream = d.outputActive; if (d.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED") stopRelay(); } else live.rec = d.outputActive;
    if (d.outputState === "OBS_WEBSOCKET_OUTPUT_STARTED") { if (type === "StreamStateChanged") live.streamT0 = Date.now(); else live.recT0 = Date.now(); }
    if (!was && (live.stream || live.rec)) { live.t0 = Date.now(); chapters = [{ t: 0, title: "البداية" }]; lastChapter = ""; chapterFromBook(); }
    if (d.outputPath) live.lastFile = d.outputPath;
    if (type === "RecordStateChanged" && d.outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED" && d.outputPath) extractAudio(d.outputPath);
    cleanSession(was, live.stream || live.rec);
    if (server) server.push("state");            // طبقة «صور فوق المشهد» تحسب زمنها من بدء البثّ
    if (was && !(live.stream || live.rec)) sessionBase = "";
    send("outputs", live); send("chapters", chapters);
  } else if (type === "CurrentSceneCollectionChanged") { applyFraming(); camApplied = ""; applyCam(true); }
  else if (type === "InputVolumeMeters") {
    const now = Date.now(); if (now - meterT < 80) return; meterT = now;
    const ml = (d.inputs || []).map(i => ({ name: i.inputName, level: i.inputLevelsMul && i.inputLevelsMul[0] ? Math.max(...i.inputLevelsMul.map(c => c[1] || 0)) : 0 }));
    send("meters", ml);
    // مستوى صوت المقدّم/الضيف (الميكروفون) لطبقات البثّ: الخلفيّات وأعمدة الصوت في البودكاست تتفاعل معه
    { const m1 = ml.find(x => x.name === "مايك الشيخ"); if (m1 && server) server.push("level", { v: Math.min(1, Math.sqrt(m1.level) * 1.15) }); }
  } else if (type === "ExitStarted") { send("engine", { state: "stopped" }); }
}
// ---------- فصول يوتيوب التلقائيّة ----------
function chapter(title) {
  if (!(live.stream || live.rec) || !title || title === lastChapter) return;
  const t = Math.round((Date.now() - live.t0) / 1000);
  if (chapters.length && t - chapters[chapters.length - 1].t < 10) chapters[chapters.length - 1].title = title;   // يوتيوب: 10 ثوانٍ على الأقلّ
  else chapters.push({ t, title });
  lastChapter = title; send("chapters", chapters);
}
function chapterFromBook() {
  const b = S().book; if (!b) return;
  const m = lib.readMeta(b.id); if (!m || !m.toc || !m.toc.length) return;
  const p = S().bookState.page; let c = null;
  for (const t of m.toc) if (t.page <= p && t.level >= 1 && t.level <= 3) c = t;
  if (c) chapter(c.title);
}

// ---------- الانتقالات (بلا إعادة بناء) ----------
// الوضع السينمائيّ: التصحيح اللونيّ على الكاميرا حيّ (بلا إعادة بناء)؛ الشريطان والتعتيم والحبيبات في طبقة سينما تقرأ الإعدادات
async function applyCinema() {
  if (!engine || !engine.ready) return;
  const T = require("./overlays/themes.js"), d = S().design, m = T.CINEMA[d.cinema] || T.CINEMA.off, K = Math.max(0, Math.min(100, Number(d.cinemaK ?? 100))) / 100;
  const g = m.grade || { c: 0, s: 0, g: 0, b: 0, m: "#FFFFFF" };
  const fs = { contrast: g.c * K, saturation: g.s * K, gamma: g.g * K, brightness: g.b * K, color_multiply: Scenes.obsColor(T.mix("#FFFFFF", g.m, K)) };
  for (const sourceName of ["كاميرا الشيخ", CAM2_SRC, CAM3_SRC]) await engine.req("SetSourceFilterSettings", { sourceName, filterName: "سينما", filterSettings: fs, overlay: true }).catch(() => {});
}
async function applyTransition() {
  const d = S().design, tr = Scenes.TRANSITIONS[d.transition] || Scenes.TRANSITIONS.soft;
  try {
    if (tr.id === "cut_transition") { await engine.req("SetCurrentSceneTransition", { transitionName: "ناعم" }); await engine.req("SetCurrentSceneTransitionDuration", { transitionDuration: 50 }); return; }
    await engine.req("SetCurrentSceneTransition", { transitionName: tr.name });
    await engine.req("SetCurrentSceneTransitionDuration", { transitionDuration: d.transitionMs > 0 ? Math.round(d.transitionMs) : tr.ms });
    if (tr.id === "fade_to_color_transition") { const t = require("./overlays/themes.js").theme(d.theme, d.custom); await engine.req("SetCurrentSceneTransitionSettings", { transitionSettings: tr === Scenes.TRANSITIONS.color ? { color: Scenes.obsColor(t.deep) } : tr.settings(t), overlay: true }); }
  } catch (e) { console.error("transition", e.message); }
}

// ---------- إعادة البناء عند تغيير التصميم أو الأجهزة ----------
let rebuildT = null, rebuilding = false, rebuildAgain = false;
function scheduleRebuild() {
  clearTimeout(rebuildT);
  rebuildT = setTimeout(async () => {
    if (!engine || !engine.ready) return;
    if (live.stream || live.rec) { send("toast", "التغيير يُطبَّق بعد إيقاف البثّ والتسجيل"); return; }
    if (rebuilding) { rebuildAgain = true; return; }       // تغيير جديد أثناء تطبيق سابق: نكمل الأوّل ثمّ نطبّق الأحدث مرّة واحدة
    rebuilding = true;
    send("busy", "جارٍ تطبيق التصميم…");
    try {
      const prev = programScene;
      const c = buildCollection();
      const vs = await engine.req("GetVideoSettings").catch(() => null);
      if (vs && vs.baseWidth !== built.W) {
        await engine.req("SetVideoSettings", { baseWidth: built.W, baseHeight: built.H, outputWidth: built.W, outputHeight: built.H });
        await engine.req("SetProfileParameter", { parameterCategory: "SimpleOutput", parameterName: "VBitrate", parameterValue: String(built.K > 1 ? 16000 : 6000) }).catch(() => {});
      }
      await engine.applyCollection(c);
      if (prev) await engine.req("SetCurrentProgramScene", { sceneName: prev }).catch(() => {});
      setTimeout(() => { applyFraming(); cam2Apply(); applyCinema(); applyTransition(); }, 1500);
    } catch (e) { console.error("[rebuild]", e.message); send("toast", "تعذّر تطبيق التصميم: " + e.message); }
    send("busy", null);
    rebuilding = false;
    if (rebuildAgain) { rebuildAgain = false; scheduleRebuild(); }
  }, 600);
}
const REBUILD_KEYS = { design: ["camSide", "frame"], devices: null };

// ---------- النافذة ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1180, minHeight: 760, title: "المجالس", icon: path.join(__dirname, process.platform === "win32" ? "build/icon.ico" : "build/icon.png"), backgroundColor: "#0B1512",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.loadURL(server.base + "/ui/index.html");
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

// ---------- IPC ----------
const h = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => { try { return await fn(...a); } catch (e) { return { __error: e.message }; } });
const stateObj = () => ({ settings: S(), scenes: Scenes.SCENES, transitions: Object.entries(Scenes.TRANSITIONS).map(([k, v]) => ({ key: k, name: v.name, ms: v.ms })), base: server.base, library: lib.list(), engine: engine ? (engine.ready ? "ready" : "starting") : "none",
  program: programScene, outputs: live, chapters, cams: Object.assign({ live: camLive }, camShow()), recDir: recDir(), platform: process.platform, arch: process.arch });
h("state:get", () => stateObj());
h("settings:patch", p => {
  const modeChanged = p.mode && p.mode !== S().mode;
  const readingChanged = !!(p.design && p.design.reading);
  const podSig = () => { const s = S(); return s.mode === "podcast" ? require("./overlays/podkit.js").shapeOf((s.modes.podcast || {}).tpl) + "|" + !!((((s.modes.podcast || {}).music || {}).bed) || {}).duck : ""; };
  const modeSig = () => S().mode + "|" + ((S().quran || {}).cam || "");       // تبديل القسم أو كاميرا مشاهد الآيات يعيد بناء المشاهد (مشاهد القرآن لا توجد إلّا في قسمه)
  const before = JSON.stringify({ d: S().design, v: S().devices, q: S().quality, u: S().duo, p: podSig(), m: modeSig() });
  store.patch(p);
  if (p.texts) Halaqat.syncTexts(store, p.texts);
  if (p.logos) Halaqat.syncLogos(store, p.logos);
  if (readingChanged && engine && engine.ready) { camApplied = ""; applyCam(true); }
  if (p.camQ) applyCamQuality();
  if (modeChanged) {
    const T2 = MODE_CAM2[S().mode] || MODE_CAM2.lessons; if (!T2[S().cam2.target] && S().cam2.target !== "custom") store.patch({ cam2: { target: Object.keys(T2)[0] } });
    Halaqat.applySel(store); camApplied = ""; if (engine && engine.ready) applyCam(true);
  }
  server.push("state");
  const after = S();
  if (p.design && "hideSpeaker" in p.design && engine && engine.ready) applyCam();
  if (p.framing || (p.design && "camFit" in p.design)) applyFraming();
  if (p.cam2) { cam2Apply(); server.push("state"); }
  if (p.cam3) { cam3Apply(); server.push("state"); }
  // لون الانتقال يتبع الهويّة بدون إعادة بناء
  if (p.design && (p.design.theme || p.design.custom) && engine && engine.ready) {
    const t = require("./overlays/themes.js").theme(after.design.theme, after.design.custom);
    if ((after.design.transition || "soft") === "color") engine.req("SetCurrentSceneTransitionSettings", { transitionSettings: { color: Scenes.obsColor(t.deep) }, overlay: true }).catch(() => {});
  }
  if (p.design && (p.design.transition || "transitionMs" in p.design) && engine && engine.ready) applyTransition();
  if (p.design && ("cinema" in p.design || "cinemaK" in p.design)) applyCinema();
  if (p.audio && "delay" in p.audio && engine && engine.ready) engine.req("SetInputAudioSyncOffset", { inputName: "مايك الشيخ", inputAudioSyncOffset: Math.round(Math.max(0, Math.min(1500, Number(p.audio.delay) || 0))) }).catch(() => {});
  const needs = (p.design && Object.keys(p.design).some(k => REBUILD_KEYS.design.includes(k))) || p.devices || p.quality || p.duo || p.mode || p.modes || p.quran;
  if (needs && before !== JSON.stringify({ d: after.design, v: after.devices, q: after.quality, u: after.duo, p: podSig(), m: modeSig() })) scheduleRebuild();
  return after;
});
// معاينة الانتقال داخل البرنامج: لقطة المشهد الحاليّ ولقطة المشهد الهدف تُرسَلان للواجهة لتحاكي الانتقال المختار طوال مدّته
// (المحرّك ينفّذ الانتقال الحقيقيّ في البثّ/التسجيل؛ لقطات المعاينة وحدها لا تُظهر الانتقال لأنّها تعرض المشهد الهدف فقط)
let previewHold = 0, trSide = null;
function transitionSpec() {
  const d = S().design, key = d.transition || "soft", tr = Scenes.TRANSITIONS[key];
  if (!tr || tr.id === "cut_transition") return null;
  const t = require("./overlays/themes.js").theme(d.theme, d.custom), st = tr.settings(t) || {};
  const hex = tr === Scenes.TRANSITIONS.color ? t.deep : tr === Scenes.TRANSITIONS.flash ? "#FFFFFF" : "#000000";
  return { key, id: tr.id, ms: d.transitionMs > 0 ? Math.round(d.transitionMs) : tr.ms, direction: st.direction, swipeIn: !!st.swipe_in, luma: st.luma_image, invert: !!st.luma_invert, soft: st.luma_softness ?? .4, sp: (st.switch_point || 50) / 100, hex };
}
async function previewTransition(from, to, spec) {
  const t0 = Date.now(); previewHold = t0 + spec.ms + 300;
  if (!trSide || trSide.closed) trSide = await engine.sideClient();
  const shot = n => trSide.req("GetSourceScreenshot", { sourceName: n, imageFormat: "jpg", imageWidth: 800, imageHeight: 450, imageCompressionQuality: 74 });
  const [a, b] = await Promise.all([shot(from), shot(to)]);
  send("transition", Object.assign({ a: a.imageData, b: b.imageData, elapsed: Date.now() - t0 }, spec));
}
h("scene:set", name => {
  if ((name === CAM2_SCENE || name === DUO_SCENE || name === DUO2_SCENE || name === GALG_SCENE) && !S().cam2.on) throw new Error("كاميرا الحضور مطفأة — فعّلها من تبويب «الأجهزة»");
  if ((name === CAM3_SCENE || name === TRIO_SCENE) && !(S().cam3 || {}).on) throw new Error("الكاميرا الثالثة مطفأة — فعّلها من تبويب «الأجهزة»");
  const from = programScene, spec = transitionSpec();
  const r = engine.req("SetCurrentProgramScene", { sceneName: name });
  { const pm = S().mode === "podcast" && (S().modes.podcast || {}).music, fx = pm && pm.fx;       // صوت التنقّل بين المشاهد (البودكاست)
    if (fx && fx.on && fx.file && from !== name) server.push("sfx", { file: fx.file, vol: fx.vol ?? 70, t: Date.now() }); }
  if (from && from !== name && spec && spec.ms > 80) previewTransition(from, name, spec).catch(e => { console.error("[transition-preview]", e.message); trSide = null; previewHold = 0; });
  return r;
});
h("book:state", st => {
  store.patch({ bookState: Object.assign({}, S().bookState, st) });
  Halaqat.syncBook(store);
  server.push("book", S().bookState);
  chapterFromBook();
  return S().bookState;
});
h("book:select", id => {
  const m = lib.readMeta(id); if (!m) throw new Error("الكتاب غير موجود");
  const first = m.toc && m.toc.find(t => t.level >= 2) || null;
  store.patch({ book: { id, v: Date.now() }, bookState: { page: 1, focus: false, band: null, step: .042 } });
  if (m.title) { store.patch({ texts: Object.assign({}, S().texts, { book: m.short || m.title }) }); Halaqat.syncTexts(store, { book: m.short || m.title }); }
  Halaqat.syncBook(store);
  server.push("state");
  return { meta: m, first };
});
h("book:meta", id => lib.readMeta(id));
h("output:stream", async () => {
  if (live.stream) { await engine.req("StopStream"); setTimeout(stopRelay, 3000); return; }
  const P = activePlatforms();
  if (!P.length) throw new Error("فعّل منصّة وضع مفتاحها من تبويب «البثّ» أوّلاً");
  if (P.length === 1) await setStream(P[0].server, P[0].key);
  else { await startRelay(P); await setStream("rtmp://127.0.0.1:1936/live", "minbar"); }
  await engine.req("StartStream");
  if (S().autoRec && !live.rec) prepRecord().then(() => engine.req("StartRecord")).catch(e => console.error("[autoRec]", e.message));
  return P.map(p => p.k);
});
// اسم كلّ تسجيل = اسم الدرس كاملاً (الحلقة - الكتاب - المجلس) أو الخطبة أو المحاضرة، مع التاريخ
const safeName = s => String(s || "").replace(/[\\/:*?"<>|%\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim();
function sessionTitle() {
  const s = S(), day = new Date().toISOString().slice(0, 10);
  let parts;
  if (Halaqat.isMode(s)) {
    const m = s.modes[s.mode];
    parts = s.mode === "khutba" ? [m.title || "خطبة الجمعة", m.topic, m.mosque, m.khatib] : s.mode === "podcast" ? [m.title || "بودكاست", m.episode && "الحلقة " + m.episode, m.topic, m.guest] : s.mode === "quran" ? [m.title || "معرض القرآن الكريم", m.lecturer] : [m.title || "محاضرة", m.lecturer, m.org];
  } else { const { h, b, s: ss } = Halaqat.current(store); parts = [h && h.name, b && b.title, ss && ss.scope, ss && ss.session]; }
  const seen = new Set(), name = safeName(parts.filter(x => x && !seen.has(x) && seen.add(x)).join(" - ")) || "تسجيل";
  return name.slice(0, 170) + " - " + day;
}
let sessionBase = "";
async function prepRecord() {
  if (!(live.stream || live.rec) || !sessionBase) sessionBase = sessionTitle();
  try { fs.mkdirSync(recDir(), { recursive: true }); } catch {}
  await engine.req("SetProfileParameter", { parameterCategory: "Output", parameterName: "FilenameFormatting", parameterValue: sessionBase }).catch(() => {});
  await engine.req("SetRecordDirectory", { recordDirectory: recDir() }).catch(() => {});
}
h("output:record", async () => { if (!live.rec) await prepRecord(); return engine.req("ToggleRecord"); });

// ---------- ملفّ الصوت: مع كلّ تسجيل يُستخرج تلقائيّاً صوتٌ عالي الجودة (MP3 بمعدّل 320 ك.ب/ث) إلى مجلّد الصوتيّات ----------
function extractAudio(file) {
  if (S().audioRec === false || !file || !fs.existsSync(file)) return;
  let ff; try { ff = ffTool("ffmpeg"); } catch { return; }
  const base = path.basename(file).replace(/\.[^.]+$/, ""), dir = audioDir(); fs.mkdirSync(dir, { recursive: true });
  let out = path.join(dir, base + ".mp3"); for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, base + " (" + i + ").mp3");
  const T = effTexts(), meta = ["-metadata", "title=" + base, "-metadata", "artist=" + (T.sheikh || ""), "-metadata", "album=" + (T.program || T.book || "")];
  require("child_process").execFile(ff, ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vn", "-map", "0:a:0", "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "48000", ...meta, out],
    { windowsHide: true, timeout: 3 * 3600 * 1000, maxBuffer: 1 << 20 }, (e, so, se) => {
      if (e) { console.error("[audio]", String(se || e.message).slice(-300)); try { fs.unlinkSync(out); } catch {} send("toast", "تعذّر استخراج ملفّ الصوت"); return; }
      send("toast", "حُفظ ملفّ الصوت: " + path.basename(out), 4000);
    });
}
// تغيير مجلّدات الحفظ
function applyDirs() {
  if (server && server.roots) { server.roots.rec = recDir(); server.roots.reels = reelsDir(); server.roots.audio = audioDir(); }
  if (caps) caps.dir = recDir();
  for (const d of [recDir(), reelsDir(), srcDir(), audioDir()]) { try { fs.mkdirSync(d, { recursive: true }); } catch {} }
}
const dirsState = () => ({ rec: recDir(), reels: reelsDir(), audio: audioDir(), def: DEF_DIRS });
h("dirs:get", () => dirsState());
h("dirs:pick", async k => {
  if (!DEF_DIRS[k]) return dirsState();
  if (live.rec && k === "rec") throw new Error("أوقف التسجيل أوّلاً ثمّ غيّر المجلّد");
  const r = await dialog.showOpenDialog(win, { title: "اختر مجلّد الحفظ", defaultPath: dirOf(k), properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return dirsState();
  store.patch({ dirs: Object.assign({}, S().dirs, { [k]: r.filePaths[0] }) }); applyDirs(); return dirsState();
});
h("dirs:reset", k => { store.patch({ dirs: { [k]: "" } }); applyDirs(); return dirsState(); });
h("dirs:open", k => { const d = k === "reels" ? reelsDir() : k === "audio" ? audioDir() : recDir(); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });
h("output:openFolder", () => { fs.mkdirSync(recDir(), { recursive: true }); return shell.openPath(recDir()); });
// مصدر كاميرا مؤقّت (غير ظاهر) لقراءة ما يدعمه الجهاز: يُنشأ ثمّ يُحذف
async function tempCam(deviceId, fn) {
  const sc = (await engine.req("GetSceneList")).scenes[0].sceneName, name = "__scan" + Date.now();
  await engine.req("CreateInput", { sceneName: sc, inputName: name, inputKind: "dshow_input", inputSettings: Object.assign({ res_type: 0 }, deviceId ? { video_device_id: deviceId } : {}), sceneItemEnabled: false });
  try { await sleep(deviceId ? 2200 : 1200); return await fn(name); } finally { await engine.req("RemoveInput", { inputName: name }).catch(() => {}); }
}
// ما تدعمه الكاميرا فعلاً (قائمة الدقّات من الجهاز نفسه) والحجم الواصل الآن
h("cam:caps", async role => {
  if (!engine || !engine.ready) throw new Error("المحرّك غير جاهز");
  const dv = role === "cam2" ? S().devices.cam2 : S().devices.camSheikh;
  const it = r => (r.propertyItems || []).map(x => ({ name: x.itemName, value: x.itemValue }));
  let res = { propertyItems: [] }, fmt = { propertyItems: [] };
  if (dv && dv.id && !dv.phone && process.platform === "win32") await tempCam(dv.id, async inputName => {
    res = await engine.req("GetInputPropertiesListPropertyItems", { inputName, propertyName: "resolution" }).catch(() => res);
    fmt = await engine.req("GetInputPropertiesListPropertyItems", { inputName, propertyName: "video_format" }).catch(() => fmt);
  }).catch(() => {});
  let actual = null;
  try { const ci = built && built.camItems.find(c => c.who === (role === "cam2" ? "cam2" : "sheikh") && !/◂/.test(c.scene));
    if (ci) { const { sceneItemId } = await engine.req("GetSceneItemId", { sceneName: ci.scene, sourceName: ci.source }); const { sceneItemTransform: t } = await engine.req("GetSceneItemTransform", { sceneName: ci.scene, sceneItemId }); actual = { w: t.sourceWidth, h: t.sourceHeight }; } } catch {}
  return { resolutions: it(res).filter(x => /^\d+x\d+$/.test(String(x.value))), formats: it(fmt), actual };
});
h("devices:list", async () => {
  if (!engine || !engine.ready) throw new Error("المحرّك غير جاهز");
  const mac = process.platform === "darwin";
  let cams = await engine.req("GetInputPropertiesListPropertyItems", { inputName: "مسح الأجهزة", propertyName: mac ? "device" : "video_device_id" }).catch(() => ({ propertyItems: [] }));
  if (!mac && !(cams.propertyItems || []).length) cams = await tempCam(null, n => engine.req("GetInputPropertiesListPropertyItems", { inputName: n, propertyName: "video_device_id" })).catch(() => ({ propertyItems: [] }));
  const mics = await engine.req("GetInputPropertiesListPropertyItems", { inputName: "مايك الشيخ", propertyName: "device_id" }).catch(() => ({ propertyItems: [] }));
  const it = r => (r.propertyItems || []).filter(x => x.itemValue && x.itemEnabled !== false).map(x => ({ id: x.itemValue, name: x.itemName }));
  return { cams: it(cams), mics: it(mics) };
});
// ---------- الإعدادات العامة: الترخيص والمعلومات ----------
h("lic:status", () => {
  const code = License.deviceCode();
  if (!app.isPackaged) return { dev: true, code };
  const r = License.load(DATA);
  return { dev: false, ok: !!r.ok, err: r.err || "", name: r.name || "", devices: r.devs ? r.devs.length : 0, exp: r.exp || 0, code };
});
h("lic:set", key => { const r = License.save(DATA, key); return r.ok ? { ok: true, name: r.name, exp: r.exp } : { ok: false, err: r.err }; });
// التحديث: تحقّق من آخر إصدار في GitHub، وتحميل وتطبيق (حزمة خفيفة أو مثبّت)
const Updater = require("./src/update");
let updInfo = null;
h("update:check", async () => { updInfo = await Updater.check(app.getVersion()); return updInfo; });
h("update:install", async () => {
  if (!app.isPackaged) throw new Error("التحديث يعمل في النسخة المثبّتة فقط");
  if (!updInfo || !updInfo.available) throw new Error("لا يوجد تحديث متاح — اضغط «تحقّق من التحديث» أوّلاً");
  if (live.stream || live.rec) throw new Error("يوجد بثّ أو تسجيل جارٍ — أوقفه قبل التحديث");
  return Updater.install(updInfo, { resourcesDir: process.resourcesPath, exePath: process.execPath, pid: process.pid, quit: () => app.quit() }, (m, p) => send("update:progress", { m, p }));
});
h("app:about", () => ({ name: "المجالس", version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform + " " + require("os").release(), data: DATA, packaged: app.isPackaged, phone: License.SUPPORT_PHONE, email: License.SUPPORT_EMAIL }));
h("data:open", () => shell.openPath(DATA));
h("engine:restart", async () => { if (engine) engine.stop(); await new Promise(r => setTimeout(r, 2500)); return startEngine(); });
// المكتبة
const prog = id => p => send("lib:progress", Object.assign({ id }, p));
h("lib:list", () => lib.list());
h("lib:search", (id, q) => lib.searchBook(id, q));
// هاتف المجالس: الحالة والاقتران، تهيئة USB، تثبيت التطبيق، أوامر عن بُعد
const { Captions } = require("./src/captions");
let caps = null;
// مفتاح Groq: واحد فقط، مدمج في البرنامج (ملفّ groq.key في مجلّده)، لا يُسأل عنه المستخدم في كل مرّة
const KEY_FILES = [path.join(__dirname, "groq.key"), path.join(DATA, "groq.key")];
const readKey = () => { if (process.env.MAJLIS_GROQ_KEY) return process.env.MAJLIS_GROQ_KEY.trim(); for (const f of KEY_FILES) { try { const k = fs.readFileSync(f, "utf8").trim(); if (k) return k; } catch {} } return ""; };
// تتبّع التلاوة: كل نصّ مسموع يُطابَق مع المصحف فتنتقل الآية تلقائياً عندما يُتمّ القارئ آيةً ويدخل في التالية
const qFollow = () => S().mode === "quran" && !!(S().quran || {}).follow;
function quranHeard(text) {
  if (!qFollow()) return;
  const QF = require("./src/quranfollow.js"), q = S().quran, r = QF.advance(q, text);
  send("quran:heard", { text, score: r ? +r.score.toFixed(2) : 0, ok: !!(r && r.ref), at: r && r.at });
  if (!r || !r.ref) return;
  const b = require("./overlays/quranlib.js") && globalThis.QU.bounds(q);                       // لا نتجاوز حدود التنقّل المختارة
  const cmp = (x, y) => x.s - y.s || x.a - y.a;
  let ref = r.ref; if (cmp(ref, b.hi) > 0) ref = { s: b.hi.s, a: b.hi.a, p: globalThis.QU.parts(b.hi.s, b.hi.a).length - 1 }; if (cmp(ref, b.lo) < 0) return;
  if (ref.s === q.s && ref.a === q.a && ref.p === q.p) return;
  store.patch({ quran: Object.assign({}, q, { s: ref.s, a: ref.a, p: ref.p }) }); server.push("state"); send("quran:ref", ref);
}
const getCaps = () => caps || (caps = new Captions({ cfg: () => S().captions, key: readKey, terms: () => S().texts, dir: recDir(), follow: qFollow, onText: quranHeard, qhint: () => require("./src/quranfollow.js").hint(S().quran),
  emit: d => { server.push("caption", d); send("cap:line", d); }, status: d => send("cap:status", d) }));
h("cap:audio", (buf, sec) => { getCaps().enqueue(Buffer.from(buf), sec); return true; });
h("cap:test", () => getCaps().testKey());
h("cap:hasKey", () => !!readKey());
h("cap:setKey", k => {
  k = String(k || "").trim();
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(k)) throw new Error("هذا ليس مفتاح Groq صحيحاً (يبدأ بـ gsk_)");
  let err; for (const f of KEY_FILES) { try { fs.writeFileSync(f, k); return true; } catch (e) { err = e; } }
  throw new Error("تعذّر حفظ المفتاح: " + err.message);
});
h("cap:preview", () => getCaps().preview());
h("phone:info", () => phone.status());
h("phone:usb", () => phone.usbSetup());
h("phone:usbAuto", on => { phone.usbAuto(on); return phone.status(); });
h("phone:install", () => phone.installApk());
h("phone:regen", () => { phone.regenToken(); return phone.status(); });
h("phone:cmd", (role, cmd) => phone.command(role, cmd));
h("lib:saveIndex", (id, pages) => lib.saveSearchIndex(id, pages));
h("lib:catalog", () => lib.shamelaCatalog());
h("lib:shamelaInfo", id => lib.shamelaInfo(id));
h("lib:shamelaText", id => lib.shamelaText(id, prog("sh-" + id)));
h("lib:shamelaPdf", id => lib.shamelaPdf(id, prog("shp-" + id)));
h("lib:archiveSearch", q => lib.archiveSearch(q));
h("lib:archiveFiles", id => lib.archiveFiles(id));
h("lib:archivePdf", (id, files, title, author) => lib.archivePdf(id, files, title, author, prog("ia-" + id)));
h("lib:importPdf", async () => {
  const r = await dialog.showOpenDialog(win, { title: "اختر ملفّ الكتاب", filters: [{ name: "PDF", extensions: ["pdf"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return lib.importPdf(r.filePaths[0]);
});
h("lib:writePage", (id, n, buf) => lib.writePage(id, n, buf));
h("lib:finishPdf", (id, info) => { const m = lib.finishPdf(id, info); if (S().book && S().book.id === id) { store.patch({ book: { id, v: Date.now() } }); server.push("state"); } return m; });
h("lib:update", (id, f) => { const m = lib.updateMeta(id, f); if (S().book && S().book.id === id) { store.patch({ book: { id, v: Date.now() } }); Halaqat.syncBook(store); server.push("state"); } return m; });
h("lib:remove", id => { lib.remove(id); if (S().book && S().book.id === id) { store.patch({ book: null }); Halaqat.syncBook(store); server.push("state"); } return lib.list(); });
// الشعارات والباركود
h("media:addLogos", async () => {
  const r = await dialog.showOpenDialog(win, { title: "اختر الشعارات", filters: [{ name: "صور", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }], properties: ["openFile", "multiSelections"] });
  if (r.canceled) return S().logos;
  const logos = S().logos.slice();
  for (const f of r.filePaths) {
    const name = Date.now().toString(36) + "-" + path.basename(f).replace(/[^\w.؀-ۿ-]/g, "_");
    fs.copyFileSync(f, path.join(MEDIA, name)); logos.push({ file: name, name: path.basename(f).replace(/\.\w+$/, ""), on: true });
  }
  store.patch({ logos }); Halaqat.syncLogos(store, logos); server.push("state"); return logos;
});
// أيّ صورة (شيخ / غلاف كتاب): تُنسخ لمجلّد الوسائط ويرجع اسمها
h("media:pickImage", async title => {
  const r = await dialog.showOpenDialog(win, { title: title || "اختر صورة", filters: [{ name: "صور", extensions: ["png", "jpg", "jpeg", "webp"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const name = "img-" + Date.now().toString(36) + path.extname(r.filePaths[0]).toLowerCase();
  fs.copyFileSync(r.filePaths[0], path.join(MEDIA, name)); return name;
});
// ملفّ صوت لشاشات قبل البثّ/الاستراحة/الختام: يُنسخ لمجلّد الوسائط ويرجع اسمه
// مكتبة الأصوات الجاهزة (assets/sounds): أصوات تنقّل وموسيقى خلفيّة هادئة مولَّدة داخليّاً. «إضافة» تنسخ الملفّ إلى وسائط البرنامج ليُعامَل كأيّ ملفّ مستورد
h("sounds:list", () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "assets", "sounds", "index.json"), "utf8")); } catch { return []; } });
h("sounds:add", id => {
  const it = (JSON.parse(fs.readFileSync(path.join(__dirname, "assets", "sounds", "index.json"), "utf8")) || []).find(x => x.id === id); if (!it) throw new Error("صوت غير معروف");
  const name = "snd-" + it.id + ".mp3", dst = path.join(MEDIA, name); if (!fs.existsSync(dst)) fs.copyFileSync(path.join(__dirname, "assets", "sounds", it.file), dst);
  return { file: name, name: it.name, kind: it.kind };
});
// عدّة صور دفعة واحدة (معرض الصور): تُنسخ كلّها لمجلّد الوسائط ويرجع [{file,name}]
// أوامر التنقّل في معرض الصور (السابقة/التالية) تُرسَل لطبقة المعرض على الهواء
h("gal:cmd", c => { if (server) server.push("gal", { cmd: String(c), t: Date.now() }); return true; });
h("media:pickImages", async title => {
  const r = await dialog.showOpenDialog(win, { title: title || "اختر صوراً", filters: [{ name: "صور", extensions: ["png", "jpg", "jpeg", "webp"] }], properties: ["openFile", "multiSelections"] });
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.map((f, i) => { const name = "img-" + Date.now().toString(36) + i + path.extname(f).toLowerCase(); fs.copyFileSync(f, path.join(MEDIA, name)); return { file: name, name: path.basename(f).replace(/\.\w+$/, "") }; });
});
h("media:pickAudio", async title => {
  const r = await dialog.showOpenDialog(win, { title: title || "اختر ملفّ صوت", filters: [{ name: "صوت", extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const name = "snd-" + Date.now().toString(36) + path.extname(r.filePaths[0]).toLowerCase();
  fs.copyFileSync(r.filePaths[0], path.join(MEDIA, name)); return { file: name, name: path.basename(r.filePaths[0]) };
});
// ===================== ريلز =====================
const { Reels } = require("./src/reels");
let reels = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function ffTool(name) { const ff = findFfmpeg(); if (!ff) throw new Error("مكوّن ffmpeg غير موجود في مجلّد resources/bin"); return path.join(path.dirname(ff), name + (process.platform === "win32" ? ".exe" : "")); }
const getReels = () => reels || (reels = new Reels({ ffmpeg: ffTool("ffmpeg"), ffprobe: ffTool("ffprobe") }));
const VIDEO_EXT = /\.(mp4|mkv|mov|flv|webm)$/i;

// ---------- كاميرا الشيخ النظيفة: تُسجَّل طوال الجلسة (بثّ أو تسجيل) بلا أيّ طبقات ثمّ تُقطَّع ريلز لاحقاً ----------
const { CleanRecorder } = require("./src/cleanrec");
let clean = null, cleanSince = 0;
function getClean() {
  if (clean) return clean;
  try { clean = new CleanRecorder({ ffmpeg: ffTool("ffmpeg"), dir: srcDir, log: (...a) => console.log("[clean]", ...a) }); clean.onChange = () => send("clean", clean.status()); } catch (e) { console.error("[clean]", e.message); }
  return clean;
}
function cleanOn() { return !(S().reels && S().reels.clean && S().reels.clean.on === false); }
function cleanSession(was, now) {
  if (!was && now && cleanOn()) { cleanSince = Date.now(); if (!sessionBase) sessionBase = sessionTitle(); const c = getClean(); if (c) c.begin(phone, sessionBase); }
  else if (was && !now && clean && clean.active) {
    const rec = live.recT0 && live.recT0 >= cleanSince - 2000 ? live.lastFile : null, rt = live.recT0;
    clean.end(rec, rt).then(list => { if (list.length) send("toast", "حُفظت كاميرا الشيخ النظيفة للريلز: " + list.length + " ملفّ"); }).catch(e => console.error("[clean]", e.message));
  }
}
// النصّ التوضيحيّ الخاصّ بالمقطع: تُرسم صفحة reel.html في نافذة مخفيّة وتُلتقط كصورة PNG شفّافة (الخطوط العربيّة الصحيحة)
async function renderReelOverlay(d) {
  const w = new BrowserWindow({ show: false, width: 1080, height: 1920, useContentSize: true, enableLargerThanScreen: true, transparent: true, frame: false, backgroundColor: "#00000000", webPreferences: { offscreen: true, backgroundThrottling: false } });
  try {
    w.webContents.setZoomFactor(1);
    await w.loadURL(server.base + "/ov/reel.html?d=" + encodeURIComponent(JSON.stringify(d)));
    for (let i = 0; i < 50; i++) { if (await w.webContents.executeJavaScript("!!window.__ready")) break; await sleep(150); }
    await sleep(200);
    // لقطة بمقاس 1080×1920 بالضبط وبشفافيّة: نافذة الشاشة قد تُقصّ ارتفاعها، فنستعمل بروتوكول التصحيح (CDP) مع تجاوز أبعاد العرض
    const dbg = w.webContents.debugger; dbg.attach("1.3");
    try {
      await dbg.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
      await dbg.sendCommand("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      await sleep(250);
      const shot = await dbg.sendCommand("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
      return Buffer.from(shot.data, "base64");
    } finally { try { dbg.detach(); } catch {} }
  } finally { w.destroy(); }
}
// إطارات الترجمة النصّيّة للريلز: نافذة واحدة تُرسَم فيها كل جملة وتُلتقط صورة شفّافة 1080×1920 (الإطار الفارغ = null)
async function renderReelCaps(frames, style, dir, tag = "f") {
  const w = new BrowserWindow({ show: false, width: 1080, height: 1920, useContentSize: true, enableLargerThanScreen: true, transparent: true, frame: false, backgroundColor: "#00000000", webPreferences: { offscreen: true, backgroundThrottling: false } });
  const out = [];
  try {
    w.webContents.setZoomFactor(1);
    await w.loadURL(server.base + "/ov/reel.html?d=" + encodeURIComponent(JSON.stringify({ mode: "cap", style })));
    for (let i = 0; i < 50; i++) { if (await w.webContents.executeJavaScript("!!window.__ready")) break; await sleep(150); }
    const dbg = w.webContents.debugger; dbg.attach("1.3");
    try {
      await dbg.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
      await dbg.sendCommand("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      for (let i = 0; i < frames.length; i++) {
        await w.webContents.executeJavaScript("window.__showCap(" + JSON.stringify(frames[i]) + ")");
        await sleep(70);
        const shot = await dbg.sendCommand("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
        const p = path.join(dir, tag + "-" + i + ".png"); fs.writeFileSync(p, Buffer.from(shot.data, "base64")); out.push(p);
      }
    } finally { try { dbg.detach(); } catch {} }
  } finally { w.destroy(); }
  return out;
}
const hasText = t => t && (String(t.title || "").trim() || String(t.note || "").trim() || String(t.foot || "").trim() || t.showName);

// تتبّع الوجه يجري في الواجهة (face-api في كروميوم): نطلبه منها ونمهلها حتى 5 دقائق
const trackWait = new Map();
h("reels:trackDone", (id, kf) => { const r = trackWait.get(id); if (r) { trackWait.delete(id); r(kf); } return true; });
function askTrack(file, start, dur) {
  if (!win || win.isDestroyed()) return Promise.resolve(null);
  const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
  return new Promise(res => { trackWait.set(id, res); send("reels:track", { id, name: path.basename(file), start, dur }); setTimeout(() => { if (trackWait.delete(id)) res(null); }, 300000); });
}
function reelLogoFile() { const { h } = Halaqat.current(store); const l = h && h.logo; return l && l.file ? (l.nobg && l.cut ? l.cut : l.file) : null; }

async function makeReel(job) {
  const R = getReels(), cfg = S().reels, t = job.text || cfg.text;
  let overlay = null, tmp = null, tmpLogo = null, logo = null;
  // ترجمة نصّيّة تلقائيّة على الريلز (إعداد «الترجمة النصّيّة الحيّة» في قسم الريلز)
  const cc = Object.assign({ on: false, langs: ["ar"], size: "m", pos: "bottom", box: true }, cfg.caps, job.caps || {});
  const capStyle = { size: cc.size, pos: cc.pos, box: cc.box, top: bandTop(t), bot: bandBot(t), font: t.nameFont || "", langs: cc.langs };
  const makeCaps = cc.on ? ctx => require("./src/reelcaps").buildReelCaps(ctx, cc, { ffmpeg: ffTool("ffmpeg"), caps: getCaps(), hasKey: () => !!readKey(), tmpDir: app.getPath("temp"), style: capStyle, renderFrames: renderReelCaps }) : null;
  const wantText = String(t.title || "").trim() || String(t.note || "").trim() || String(t.foot || "").trim() || t.showName !== false || S().texts.program || S().texts.book;
  if (wantText) { tmp = path.join(app.getPath("temp"), "reel-" + Date.now() + ".png"); fs.writeFileSync(tmp, await renderReelOverlay(t)); overlay = tmp; }
  const lg = job.logo !== undefined ? job.logo : cfg.logo, lf = reelLogoFile();
  if (lg && lg.on && lf) { tmpLogo = path.join(app.getPath("temp"), "reel-logo-" + Date.now() + ".png"); fs.writeFileSync(tmpLogo, await renderReelOverlay({ mode: "logo", logoFile: lf, bandColor: t.bandColor, lineColor: t.lineColor })); logo = { png: tmpLogo, secs: lg.secs || 2 }; }
  let track = job.track;
  if (track === undefined && (job.useTrack ?? cfg.track) && (job.layout || cfg.layout).mode !== "fit") { send("reels:progress", { p: 0.01, m: "تتبّع وجه الشيخ…" }); track = await askTrack(job.file, job.start, job.dur); }
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19), out = path.join(reelsDir(), safeName(path.basename(job.file).replace(/\.[^.]+$/, "")).slice(0, 120) + " - ريل " + stamp.slice(11) + ".mp4");
  const THm = require("./overlays/themes.js"), frame = t.frame !== false ? { hex: THm.col(t.frameColor || t.lineColor || "theme:accent", THm.theme(S().design.theme, S().design.custom)), w: t.frameW ?? 6, inset: t.frameInset ?? 16 } : null;
  try {
    const r = await R.render({ file: job.file, start: job.start, dur: job.dur, silence: job.silence || cfg.silence, layout: Object.assign({}, cfg.layout, { mode: "crop", top: bandTop(t), mid: 1920 - bandTop(t) - bandBot(t) }), loud: job.loud ?? cfg.loud, overlay, logo, frame, makeCaps, track: track || null,
      out }, (p, m) => send("reels:progress", { p, m }));
    return Object.assign(r, { rel: path.basename(out) });
  } finally { if (tmp) fs.unlink(tmp, () => {}); if (tmpLogo) fs.unlink(tmpLogo, () => {}); }
}

const bandTop = t => Math.max(0, Math.min(700, Math.round(t.top ?? 300))), bandBot = t => Math.max(0, Math.min(700, Math.round(t.bot ?? 360)));
h("reels:list", () => {
  const out = [];
  try { for (const f of fs.readdirSync(srcDir())) { if (!VIDEO_EXT.test(f)) continue; const st = fs.statSync(path.join(srcDir(), f)); out.push({ name: f, size: st.size, mtime: st.mtimeMs }); } } catch {}
  return out.sort((a, b) => b.mtime - a.mtime);
});
h("reels:clean", () => clean ? clean.status() : { active: false, recording: false, file: null, since: 0, segments: 0 });
h("reels:outputs", () => { const out = []; try { for (const f of fs.readdirSync(reelsDir())) { if (!VIDEO_EXT.test(f)) continue; const st = fs.statSync(path.join(reelsDir(), f)); out.push({ name: f, size: st.size, mtime: st.mtimeMs }); } } catch {} return out.sort((a, b) => b.mtime - a.mtime); });
h("reels:probe", name => getReels().probe(path.join(srcDir(), path.basename(name))));
h("reels:silences", async (name, start, dur, sil) => {
  const R = getReels(), file = path.join(srcDir(), path.basename(name)), s = await R.silences(file, start, dur, sil.noise, sil.minSil), segs = R.plan(dur, s, { pad: sil.pad });
  const kept = segs.reduce((a, [x, y]) => a + (y - x), 0);
  return { silences: s.length, kept, removed: dur - kept, segments: segs.length };
});
h("reels:overlay", async d => "data:image/png;base64," + (await renderReelOverlay(d)).toString("base64"));
h("reels:render", job => makeReel(Object.assign({}, job, { file: path.join(srcDir(), path.basename(job.name)) })));
// ---------- معمل المجالس: استوديو تعديل المقاطع ----------
const { Lab } = require("./src/lab");
let lab = null;
const getLab = () => lab || (lab = new Lab({ dir: path.join(DATA, "lab"), ffmpeg: ffTool("ffmpeg"), ffprobe: ffTool("ffprobe"), reels: getReels() }));
const labOut = () => path.join(app.getPath("videos"), "معمل المجالس");
// يرسم صفحة بثّ (من /ov) إلى صورة PNG بمقاس 1920×1080، شفّافة ما لم تكن الصفحة معتمة. التخزين مؤقّتاً بحسب العنوان
async function labPng(pid, spec) {
  const crypto = require("crypto"); let ovr = spec.ovr;
  if (spec.live) { const st = labLive(spec.live, spec.sbx); st.cam = { sheikh: true, "sheikh:crop": true, "sheikh:fit": false, cam2: false, cam3: false }; st.breakAt = 0; ovr = Object.assign(st, spec.ovr || {}, spec.ovr && spec.ovr.texts ? { texts: Object.assign({}, st.texts, spec.ovr.texts) } : {}, spec.ovr && spec.ovr.design ? { design: Object.assign({}, st.design, spec.ovr.design) } : {}); }
  if (spec.look && ovr) {      // تعديلات الشعار والشاشات لهذا المشروع فوق ضبط الحلقة
    const lk = spec.look, dm = (a, b) => { const o = Object.assign({}, a); for (const k in b) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? dm(a && a[k] || {}, b[k]) : b[k]; return o; };
    if (lk.screens) { ovr.screens = Object.assign({}, ovr.screens); for (const k of Object.keys(lk.screens)) ovr.screens[k] = dm(ovr.screens[k] || {}, lk.screens[k]); }
    if (lk.imgs) ovr.imgs = Object.assign({}, ovr.imgs, lk.imgs); if (lk.logos) ovr.logos = lk.logos; if (lk.socials) ovr.socials = lk.socials;
  }
  const q = new URLSearchParams(Object.assign({}, spec.params || {}, ovr ? { ovr: JSON.stringify(ovr) } : {})).toString();
  const url = server.base + "/ov/" + spec.page + (q ? "?" + q : "") + (spec.size ? "#" + spec.size.join("x") : ""), name = (spec.tag || "ov") + "-" + crypto.createHash("sha1").update(url).digest("hex").slice(0, 12) + ".png", rel = "ov/" + name, file = path.join(DATA, "lab", pid, rel);
  if (fs.existsSync(file)) return rel;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const [SW, SH] = (spec.size || [1920, 1080]).map(Math.round);
  const w = new BrowserWindow({ show: false, width: SW, height: SH, useContentSize: true, enableLargerThanScreen: true, transparent: true, frame: false, backgroundColor: "#00000000", webPreferences: { offscreen: true, backgroundThrottling: false } });
  try {
    w.webContents.setZoomFactor(1);
    await w.loadURL(url); await sleep(spec.wait || 1500);
    await w.webContents.executeJavaScript("document.getAnimations().forEach(a=>{try{a.finish()}catch(e){}}); 1").catch(() => {});
    await sleep(300);
    const dbg = w.webContents.debugger; dbg.attach("1.3");
    try {
      await dbg.sendCommand("Emulation.setDeviceMetricsOverride", { width: SW, height: SH, deviceScaleFactor: 1, mobile: false });
      if (!spec.opaque) await dbg.sendCommand("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      await sleep(250);
      const shot = await dbg.sendCommand("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: SW, height: SH, scale: 1 } });
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    } finally { try { dbg.detach(); } catch {} }
  } finally { w.destroy(); }
  return rel;
}
// ضبط الحلقة المطبَّق على المعمل: نصوص الحلقة والشعارات والتصميم والشاشات كما هي في غرفة التحكّم لقسم المشروع
const LAB_MODE = { lesson: "lessons", reply: "lessons", free: "lessons", audio: "lessons", khutba: "khutba", lecture: "lecture", quran: "quran" };
// «صندوق المشروع»: نسخة كاملة من إعدادات البثّ (الحلقات والتصميم والشعارات والشاشات…) لكل مشروع في المعمل، تُعدَّل من الإطار الجانبي دون المساس بإعدادات البثّ الحيّة
const SBX = new Map();
function sbxStore(pid) {
  let st = SBX.get(pid); if (st) return st;
  const dir = path.join(DATA, "lab", pid); fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, "settings.json"))) fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(store.get()));
  st = new Store(dir); SBX.set(pid, st); return st;
}
function labLive(kind, pid) {
  MODE_OVR = LAB_MODE[kind] || "lessons"; SBXS = pid ? sbxStore(pid) : null;
  try { return JSON.parse(JSON.stringify(overlayState())); } finally { MODE_OVR = null; SBXS = null; }
}
h("lab:live", (kind, pid) => { const st = labLive(kind, pid), d = (pid ? sbxStore(pid) : store).get().design || {}, side = d.camSide || "left"; return { state: st, side, layout: Scenes.layout(side), frame: d.frame || "arch" }; });
h("lab:sbx:open", pid => sbxStore(pid).get());
h("lab:sbx:resync", pid => { const st = sbxStore(pid); st.s = JSON.parse(JSON.stringify(store.get())); st.flush(); return st.get(); });
h("lab:sbx:patch", (pid, p) => { const st = sbxStore(pid); st.patch(p); if (p.texts) Halaqat.syncTexts(st, p.texts); if (p.logos) Halaqat.syncLogos(st, p.logos); return st.get(); });
h("lab:sbx:op", (pid, op, ...args) => { if (!HOPS.includes(op)) throw new Error("أمر غير مسموح"); const st = sbxStore(pid), result = Halaqat.run(st, op, args); return { settings: st.get(), result }; });
h("lab:sbx:state", pid => Object.assign({}, stateObj(), { settings: sbxStore(pid).get() }));
h("lab:sbx:drop", pid => { SBX.delete(pid); return true; });
// شجرة الحلقات (للتوافق)
h("lab:halaqat", () => ({ sel: store.get().sel || null, list: (store.get().halaqat || []).map(x => ({ id: x.id, name: x.name, books: (x.books || []).map(bk => ({ id: bk.id, title: bk.title, program: bk.program, sessions: (bk.sessions || []).map(ss => ({ id: ss.id, session: ss.session, scope: ss.scope, date: ss.date })) })) })) }));
h("lab:list", () => getLab().list());
h("lab:create", (kind, name) => getLab().create(kind, name));
h("lab:get", id => getLab().get(id));
h("lab:save", p => { getLab().save(p); return true; });
h("lab:remove", id => { SBX.delete(id); getLab().remove(id); return true; });
h("lab:png", (pid, spec) => labPng(pid, spec));
h("lab:import", async (pid, kind) => {
  const ex = kind === "image" ? ["png", "jpg", "jpeg", "webp"] : kind === "audio" ? ["mp3", "wav", "m4a", "aac", "ogg", "flac"] : ["mp4", "mkv", "mov", "webm", "avi", "flv", "m4v", "mp3", "wav", "m4a", "aac", "ogg", "flac", "png", "jpg", "jpeg", "webp"];
  const r = await dialog.showOpenDialog(win, { title: "استيراد إلى المعمل", filters: [{ name: "وسائط", extensions: ex }], properties: ["openFile", "multiSelections"] });
  if (r.canceled) return [];
  const L = getLab(), out = [];
  for (const f of r.filePaths) {
    try { const c = await L.addClip(pid, f); out.push(c); L.makeProxy(pid, c.id, p => send("lab:proxy", { pid, cid: c.id, p })).then(c2 => send("lab:proxy", { pid, cid: c.id, p: 1, clip: c2 })).catch(e => send("lab:proxy", { pid, cid: c.id, err: e.message })); }
    catch (e) { send("toast", f.split(/[\/]/).pop() + ": " + e.message); }
  }
  return out;
});
h("lab:reproxy", (pid, cid) => { getLab().makeProxy(pid, cid, p => send("lab:proxy", { pid, cid, p })).then(c2 => send("lab:proxy", { pid, cid, p: 1, clip: c2 })).catch(e => send("lab:proxy", { pid, cid, err: e.message })); return true; });
h("lab:silence", async (pid, cid, a, b, opt) => { const L = getLab(), c = L.get(pid).clips.find(x => x.id === cid); if (!c) throw new Error("مقطع غير موجود"); return L.silenceCuts(c, a, b, opt || {}); });
h("lab:export", async (pid, name) => {
  const L = getLab(), p = L.get(pid), { maskFile } = require("./src/masks"), md = path.join(DATA, "lab", "masks");
  const safe = String(name || p.name || "مشروع").replace(/[\/:*?"<>|]/g, "_").trim() || "مشروع", out = path.join(labOut(), safe + "-" + Date.now().toString(36) + ".mp4");
  let ctx = { maskFor: (shape, w, h) => maskFile(md, shape, w, h) };
  if (p.clips.some(c => c.kind === "audio") && p.seq.some(s => (p.clips.find(c => c.id === s.clip) || {}).kind === "audio")) { try { const dz = p.design || {}, dd = {}; if (dz.theme) { dd.theme = dz.theme; dd.custom = null; } if (dz.font) dd.font = dz.font; if (dz.frame) dd.frame = dz.frame; ctx.audioBg = await labPng(pid, { page: "bg.html", opaque: true, tag: "bg", wait: 900, ovr: Object.keys(dd).length ? { design: dd } : undefined }); } catch {} }
  const r = await L.render(p, out, ctx, (pr, m) => send("lab:progress", { pid, p: pr, m }));
  return r;
});
h("lab:cancel", () => { getLab().cancel(); return true; });
h("lab:openOut", () => { fs.mkdirSync(labOut(), { recursive: true }); return shell.openPath(labOut()); });
// مطابقة آيات التلاوة مع المصحف وتوقيتها: Whisper يفرّغ المقطع بأزمنة، والمطابِق يحدّد الآية التي يتلوها القارئ في كلّ مقطع كلام
h("lab:quranAlign", async (pid, cid, a, b, start) => {
  const L = getLab(), c = L.get(pid).clips.find(x => x.id === cid); if (!c) throw new Error("مقطع غير موجود");
  if (!readKey()) throw new Error("احفظ مفتاح Groq أوّلاً (تبويب البثّ ← الترجمة)");
  const QF = require("./src/quranfollow.js"), { run } = require("./src/reels"), tmp = path.join(app.getPath("temp"), "qa-" + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  const CH = 540, segs = [];
  try {
    for (let t = a, i = 0; t < b - 0.5; t += CH, i++) {
      const wav = path.join(tmp, i + ".wav"), len = Math.min(CH, b - t);
      await run(ffTool("ffmpeg"), ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-t", String(len), "-i", c.file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
      send("lab:progress", { pid, m: "تفريغ التلاوة… " + Math.round((t - a) / (b - a) * 100) + "٪", p: (t - a) / (b - a) });
      const part = await getCaps().segmentsOf(fs.readFileSync(wav), "ar");
      for (const s of part) segs.push({ start: t + s.start, end: t + s.end, text: s.text });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  let cur = { s: start.s, a: start.a, p: 0 }; const out = [];
  for (const s of segs) {
    const r = QF.advance(cur, s.text, { min: .42 }); if (!r || !r.ref || !r.matched) continue;
    const m = r.matched, last = out[out.length - 1];
    if (last && last.s === m.s && last.a === m.a) last.end = s.end; else out.push({ s: m.s, a: m.a, start: s.start, end: s.end, score: r.score });
    cur = r.ref;
  }
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].start : out[i].end + .6;     // تبقى الآية حتى تبدأ التالية
  return { segments: segs.length, verses: out };
});

h("reels:cancel", () => { getReels().cancel(); return true; });
h("reels:openFolder", () => { fs.mkdirSync(reelsDir(), { recursive: true }); return shell.openPath(reelsDir()); });

// الحلقات والكتب والمجالس: أوامر الإنشاء والتعديل والحذف والاختيار (انظر src/halaqat.js)
const HOPS = ["createHalaqa", "updateHalaqa", "removeHalaqa", "createBook", "updateBook", "removeBook", "createSession", "updateSession", "removeSession", "select"];
h("halaqat:op", (op, ...args) => {
  if (!HOPS.includes(op)) throw new Error("أمر غير مسموح");
  const result = Halaqat.run(store, op, args);
  server.push("state"); if (op === "select" || op.startsWith("remove")) { chapters = []; lastChapter = ""; send("chapters", chapters); }
  return { settings: S(), result };
});
// لقطة من كاميرا الشيخ (الصورة الكاملة قبل القصّ) للتأطير الذكي: الواجهة تكشف الوجه وتضبط مركز القصّ والتقريب
let snapSide = null;
h("cam:snap", async () => {
  if (!engine || !engine.ready) return null;
  try {
    if (!snapSide || snapSide.closed) snapSide = await engine.sideClient();
    const r = await snapSide.req("GetSourceScreenshot", { sourceName: "كاميرا الشيخ", imageFormat: "jpg", imageWidth: 640, imageCompressionQuality: 70 });
    return { img: r.imageData };
  } catch { snapSide = null; return null; }
});
h("media:saveLogoCut", (name, buf) => {
  const safe = path.basename(String(name)).replace(/[^\w.؀-ۿ-]/g, "_").replace(/\.\w+$/, "") + "-cut.png";
  fs.writeFileSync(path.join(MEDIA, safe), Buffer.from(buf)); return safe;
});
h("media:setQr", async clear => {
  if (clear) { store.patch({ qr: null }); server.push("state"); return null; }
  const r = await dialog.showOpenDialog(win, { title: "صورة الباركود (QR)", filters: [{ name: "صور", extensions: ["png", "jpg", "jpeg"] }], properties: ["openFile"] });
  if (r.canceled) return S().qr;
  const name = "qr-" + Date.now().toString(36) + path.extname(r.filePaths[0]);
  fs.copyFileSync(r.filePaths[0], path.join(MEDIA, name)); store.patch({ qr: name }); server.push("state"); return name;
});
h("open:external", url => shell.openExternal(url));

// ---------- التشغيل ----------
// ---------- الترخيص: النسخة المثبّتة لا تعمل إلا بكود تفعيل خاصّ بالجهاز (انظر src/license.js) ----------
const License = require("./src/license");
let licenseFlow = false;
function ensureLicensed() {
  if (!app.isPackaged) return Promise.resolve(true);                  // التطوير (npm start) بلا ترخيص
  const cur = License.load(DATA);
  if (cur.ok) return Promise.resolve(true);
  licenseFlow = true;
  return new Promise(resolve => {
    const w = new BrowserWindow({ width: 760, height: 780, resizable: false, autoHideMenuBar: true, title: "تفعيل المجالس", backgroundColor: "#0A1311",
      icon: path.join(__dirname, "build/icon.ico"), webPreferences: { preload: path.join(__dirname, "activate-preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    w.setMenu(null);
    let done = false;
    const finish = ok => { if (done) return; done = true; for (const c of ["lic:info", "lic:activate", "lic:copy", "lic:mail", "lic:wa", "lic:quit"]) ipcMain.removeHandler(c); licenseFlow = false; try { w.destroy(); } catch {} resolve(ok); };
    ipcMain.handle("lic:info", () => ({ code: License.deviceCode(), email: License.SUPPORT_EMAIL, phone: License.SUPPORT_PHONE, prev: cur.err || "" }));
    ipcMain.handle("lic:copy", () => { require("electron").clipboard.writeText(License.deviceCode()); return true; });
    ipcMain.handle("lic:mail", () => shell.openExternal("mailto:" + License.SUPPORT_EMAIL + "?subject=" + encodeURIComponent("طلب كود تفعيل المجالس") + "&body=" + encodeURIComponent("رمز الجهاز: " + License.deviceCode() + String.fromCharCode(10, 10) + "الاسم: ")));
    ipcMain.handle("lic:wa", () => shell.openExternal("https://wa.me/" + License.SUPPORT_PHONE.replace(/D/g, "") + "?text=" + encodeURIComponent("السلام عليكم، أرغب في تفعيل برنامج المجالس." + String.fromCharCode(10) + "رمز الجهاز: " + License.deviceCode())));
    ipcMain.handle("lic:activate", (_e, key) => { const r = License.save(DATA, key); if (r.ok) setTimeout(() => finish(true), 900); return r.ok ? { ok: true } : { ok: false, err: r.err }; });
    ipcMain.handle("lic:quit", () => finish(false));
    w.on("closed", () => finish(false));
    w.loadFile(path.join(__dirname, "ui/activate.html"));
  });
}
app.whenReady().then(async () => {
  if (!(await ensureLicensed())) { app.quit(); return; }
  await seedBooks();
  server = new Server({ roots: { mp: path.join(__dirname, "node_modules/@mediapipe/tasks-vision"), rec: recDir(), reels: reelsDir(), audio: audioDir(), luma: path.join(RES, "engine/obs-studio/core/obs-transitions/data/luma_wipes"), ov: path.join(__dirname, "overlays"), assets: path.join(__dirname, "assets"), books: lib.dir, media: MEDIA, lab: path.join(DATA, "lab"),
    pdfjs: path.join(__dirname, "node_modules/pdfjs-dist"), qr: path.join(__dirname, "node_modules/qrcode-generator"), faceapi: path.join(__dirname, "node_modules/@vladmandic/face-api"), ui: path.join(__dirname, "ui") }, getState: overlayState });
  await server.start(47800);
  applyDirs();
  { const c = getClean(); if (c) c.recover(); }
  // هاتف «المجالس»: خادم الاستقبال (TCP 47821) + نقل الصورة إلى صفحة العرض داخل المحرّك
  phone = new PhoneHub({ store, resources: RES });
  server.onUpgrade = (req, sock, head) => phone.handleUpgrade(req, sock, head);
  phone.on("change", st => send("phone", st));
  phone.on("config", (role, cfg) => { onPhoneConfig(role, cfg); if (role === "sheikh" && clean && clean.seg) clean.cut(); });
  phone.on("frame", (role, p) => { if (role !== "sheikh" || !clean || !clean.active) return; if (clean.seg) clean.frame(p); else if (p[0] & 1) clean.tryStart(phone); });
  phone.on("lost", role => { camApplied = ""; applyCam(true); if (role === "sheikh" && clean) clean.cut(); });
  phone.start(47821).catch(e => console.error("[phone] start failed", e.message));
  // أيّ تعديل في ملفّات الطبقات يعيد تحميلها في المحرّك فوراً (للتحديثات والتطوير)
  let rl = null; try { fs.watch(path.join(__dirname, "overlays"), () => { clearTimeout(rl); rl = setTimeout(() => server.push("reload"), 400); }); } catch {}
  createWindow();
  powerSaveBlocker.start("prevent-app-suspension");
  if (process.platform === "darwin" && app.dock) app.dock.setIcon(path.join(__dirname, "build/icon.png"));
  if (!process.argv.includes("--no-engine")) startEngine();
});
app.on("window-all-closed", () => { if (!licenseFlow) app.quit(); });
app.on("before-quit", () => { store.flush(); if (clean && clean.seg) { try { clean.seg.ws.end(); } catch {} } stopRelay(); if (phone) phone.stop(); if (engine) engine.stop(); });
