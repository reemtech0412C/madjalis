// «المجالس» — ريلز: مقاطع عموديّة 9:16 تُقتطع من تسجيل كاميرا الشيخ العموديّة (المحفوظ تلقائيّاً مع كل بثّ أو تسجيل).
// الشريطان العلويّ والسفليّ (سمكهما وزخرفتهما وخطوطهما ونصوصهما) قابلة للتخصيص، والفيديو في الوسط.
const RL = { vid: null, cv: null, ov: null, ovKey: "", file: "", busy: false, dur: 0, track: null };
const rlCfg = () => S().reels;
const RL_T = { title: "", note: "", foot: "", pos: "low", showName: true, top: 300, bot: 360, deco: true, decoAlpha: 0.2, line: 6, fade: 150, frame: true, frameW: 6, frameInset: 16, bandColor: "theme:deep", lineColor: "theme:accent",
  titleFont: "", titleSize: 70, titleColor: "#FFFFFF", nameFont: "", nameSize: 68, nameColor: "#FFFFFF", noteFont: "", noteSize: 44 };
// ألوان الشريطين والإطار: ألوان الهويّة + ألوان صريحة، ولون مخصّص من منتقي الألوان
const RL_COLORS = [["theme:deep", "لون الهويّة"], ["theme:accent", "اللون البارز"], ["#E53935", "أحمر"], ["#FB8C00", "برتقاليّ"], ["#FDD835", "أصفر"], ["#43A047", "أخضر"], ["#00ACC1", "سماويّ"], ["#1E88E5", "أزرق"], ["#8E24AA", "بنفسجيّ"], ["#EC407A", "وردي"], ["#8D6E63", "بنّيّ"], ["#FFFFFF", "أبيض"], ["#000000", "أسود"]];
const rlCaps = () => Object.assign({ on: false, langs: ["ar"], size: "m", pos: "bottom", box: true }, rlCfg().caps);
const rlText = () => Object.assign({}, RL_T, rlCfg().text);
const rlMid = () => 1920 - (+rlText().top || 0) - (+rlText().bot || 0);
const rlAR = () => 1080 / Math.max(600, rlMid());                // نسبة الفيديو الظاهر بين الشريطين
const RL_FONTS = [["", "الخطّ الافتراضيّ"], ["Amiri", "أميري"], ["Cairo", "القاهرة"], ["Tajawal", "تجوال"], ["Almarai", "المراعي"], ["Alexandria", "الإسكندريّة"], ["El Messiri", "المسيري"], ["Changa", "شنقا"],
  ["Lalezar", "لالزار"], ["Mada", "مدى"], ["Noto Kufi Arabic", "نوتو كوفي"], ["Noto Naskh Arabic", "نوتو نسخ"], ["Reem Kufi", "ريم كوفي"], ["Scheherazade New", "شهرزاد"], ["Aref Ruqaa", "عارف رقعة"], ["IBM Plex Sans Arabic", "IBM Plex"]];
let rlT;
function rlSave(part) { const c = JSON.parse(JSON.stringify(rlCfg())); Object.assign(c, part); return patch({ reels: c }); }
const rlSetText = (o, redraw = true) => rlSave({ text: Object.assign({}, rlCfg().text, o) }).then(() => { if (redraw) rlOverlayRefresh(); });
const rlTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
const rlParse = v => { const p = String(v || "").trim().split(":").map(Number); if (p.some(isNaN)) return null; return p.reduce((a, x) => a * 60 + x, 0); };
const rlRange = () => { const a = rlParse($("rlStart").value), b = rlParse($("rlEnd").value); return a == null || b == null || b <= a ? null : [a, b]; };
const rlUrl = name => "/reels/" + encodeURIComponent("المصادر") + "/" + encodeURIComponent(name);

function rlRow(label, node) { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>"; r.appendChild(node); return r; }
function rlAcc(parent, title, open) { const d = document.createElement("details"); d.className = "acc"; if (open) d.open = true; d.innerHTML = `<summary><span>${title}</span><span class="sum"></span></summary><div class="in tsctl"></div>`; parent.appendChild(d); return d.querySelector(".in"); }
function rlFontSel(val, fn) { const s = document.createElement("select"); s.innerHTML = RL_FONTS.map(([v, t]) => `<option value="${esc(v)}">${t}</option>`).join(""); s.value = val || ""; s.onchange = () => fn(s.value); return s; }

// ---------- حساب مستطيل القصّ (على المصدر العموديّ أو الأفقيّ) ----------
function rlCropPx(iw, ih, z) { const AR = rlAR(), cw = Math.min(iw, ih * AR) / Math.max(1, z); return { cw, ch: cw / AR }; }

// ---------- تتبّع وجه الشيخ ----------
// نأخذ لقطات من المقطع (1٫5 لقطة/ث)، نكشف الوجه بـface-api، ثمّ نبني مساراً ناعماً لمركز القصّ: وسيط لإسقاط الشواذّ، ومنطقة ميتة فلا يهتزّ الإطار، وحدّ لسرعة الحركة.
async function rlTrack(name, a, b, onP) {
  await afLoad();
  const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = rlUrl(name);
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("تعذّر فتح الفيديو للتتبّع")); });
  const W = 1280, H = Math.round(W * v.videoHeight / v.videoWidth), cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const step = 1 / 1.5, ts = []; for (let t = a; t < b; t += step) ts.push(t); ts.push(b - 0.05);
  const raw = [];
  for (let i = 0; i < ts.length; i++) {
    v.currentTime = Math.min(ts[i], (v.duration || ts[i]) - 0.05);
    await new Promise(r => { v.onseeked = r; });
    g.drawImage(v, 0, 0, W, H);
    let best = null;
    try { const dets = await faceapi.detectAllFaces(cv, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: .35 })); for (const d of dets) { const bx = d.box, area = bx.width * bx.height; if (!best || area > best.area) best = { area, x: (bx.x + bx.width / 2) / W, y: (bx.y + bx.height / 2) / H, h: bx.height / H }; } } catch {}
    raw.push({ t: ts[i] - a, f: best });
    if (onP) onP((i + 1) / ts.length);
  }
  v.removeAttribute("src"); v.load();
  return raw;
}
function rlPath(raw, vw, vh, zoom) {
  const ok = raw.filter(r => r.f).length, ratio = ok / raw.length;
  if (ratio < .12) return { kf: null, ratio };
  const px = rlCropPx(vw, vh, zoom), cropWn = px.cw / vw, cropHn = px.ch / vh;
  const firstKnown = raw.find(r => r.f).f; let last = firstKnown;
  const pts = raw.map(r => { if (r.f) last = r.f; return { t: r.t, x: last.x, y: last.y + .10 * cropHn }; });   // الوجه عند 40٪ من ارتفاع الإطار
  const med = (arr, i, k) => { const w = arr.slice(Math.max(0, i - 2), i + 3).map(p => p[k]).sort((p, q) => p - q); return w[Math.floor(w.length / 2)]; };
  const sm = pts.map((p, i) => ({ t: p.t, x: med(pts, i, "x"), y: med(pts, i, "y") }));
  const dzx = Math.max(.012, cropWn * .07), dzy = Math.max(.02, cropHn * .07), maxX = cropWn * .09, maxY = cropHn * .06;
  let cx = sm[0].x, cy = sm[0].y; const kf = [];
  for (const p of sm) {
    const dx = p.x - cx, dy = p.y - cy;
    if (Math.abs(dx) > dzx) cx += Math.sign(dx) * Math.min(Math.abs(dx) - dzx * .5, maxX);
    if (Math.abs(dy) > dzy) cy += Math.sign(dy) * Math.min(Math.abs(dy) - dzy * .5, maxY);
    kf.push([p.t, Math.min(1 - cropWn / 2, Math.max(cropWn / 2, cx)), Math.min(1 - cropHn / 2, Math.max(cropHn / 2, cy))]);
  }
  return { kf, ratio };
}
async function rlAnalyze(name, a, b) {
  const z = rlCfg().layout.zoom || 1, st = $("rlTrackMsg"); if (st) st.textContent = "جارٍ تتبّع الوجه…";
  const raw = await rlTrack(name, a, b, p => { if (st) st.textContent = "تتبّع الوجه… " + Math.round(p * 100) + "٪"; });
  const v = RL.vid, res = rlPath(raw, v.videoWidth || 1080, v.videoHeight || 1920, z);
  if (!res.kf) { RL.track = null; if (st) st.textContent = "لم يُكتشف وجه في هذا المقطع — يُستعمل مركز القصّ اليدويّ"; return null; }
  RL.track = { file: name, a, b, z, bands: rlMid(), kf: res.kf }; if (st) st.textContent = "✓ يتتبّع الوجه (" + Math.round(res.ratio * 100) + "٪ من اللقطات)"; rlDraw(); return res.kf;
}
function rlTrackAt(t) { const T = RL.track; if (!T || T.file !== RL.file || T.z !== (rlCfg().layout.zoom || 1) || T.bands !== rlMid()) return null; const x = t - T.a; const kf = T.kf; if (x <= kf[0][0]) return kf[0]; for (let i = 0; i + 1 < kf.length; i++) if (x < kf[i + 1][0]) { const r = (x - kf[i][0]) / (kf[i + 1][0] - kf[i][0] || 1); return [x, kf[i][1] + (kf[i + 1][1] - kf[i][1]) * r, kf[i][2] + (kf[i + 1][2] - kf[i][2]) * r]; } return kf[kf.length - 1]; }

// ---------- المعاينة: إطار الفيديو الحاليّ بالقصّ المختار بين الشريطين ----------
function rlLayoutBox() {
  const v = RL.vid, c = rlCfg().layout, iw = v.videoWidth || 1080, ih = v.videoHeight || 1920, z = Math.max(1, c.zoom || 1);
  const tk = rlCfg().track !== false ? rlTrackAt(v.currentTime) : null, ccx = tk ? tk[1] : (c.cx ?? .5), ccy = tk ? tk[2] : (c.cy ?? .45);
  const { cw, ch } = rlCropPx(iw, ih, z), x = Math.min(Math.max(ccx * iw - cw / 2, 0), iw - cw), y = Math.min(Math.max(ccy * ih - ch / 2, 0), ih - ch);
  return { x, y, w: cw, h: ch, iw, ih };
}
function rlDraw() {
  const cv = RL.cv, g = cv.getContext("2d"), v = RL.vid, W = cv.width, H = cv.height, T = rlText();
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  if (v.videoWidth) { const b = rlLayoutBox(); g.drawImage(v, b.x, b.y, b.w, b.h, 0, H * T.top / 1920, W, H * rlMid() / 1920); }
  if (RL.ov) g.drawImage(RL.ov, 0, 0, W, H);
  if (RL.capOv && rlCaps().on) g.drawImage(RL.capOv, 0, 0, W, H);
  rlDrawFrame(g, W, H, T);
  const box = $("rlCrop"); if (box) {
    if (!v.videoWidth) box.style.display = "none";
    else { const b = rlLayoutBox(); Object.assign(box.style, { display: "block", left: b.x / b.iw * 100 + "%", top: b.y / b.ih * 100 + "%", width: b.w / b.iw * 100 + "%", height: b.h / b.ih * 100 + "%" }); }
  }
}
// إطار المقطع في المعاينة: يُزال مع عقارب الساعة بحسب موضع المشغّل بين بداية المقطع ونهايته (كما في الريلز النهائيّ)
function rlDrawFrame(g, W, H, T) {
  if (T.frame === false) return;
  const k = W / 1080, ins = (+T.frameInset >= 0 ? +T.frameInset : 16), th = Math.max(1, +T.frameW || 6), top = +T.top || 0, mid = rlMid();
  const x = ins * k, y = (top + ins) * k, w = (1080 - ins * 2) * k, h = (mid - ins * 2) * k, r = rlRange(); let p = 0;
  if (r && RL.vid && RL.vid.duration) p = Math.min(1, Math.max(0, (RL.vid.currentTime - r[0]) / (r[1] - r[0])));
  const tcss = (typeof TH !== "undefined" && TH.col) ? TH.col(T.frameColor || T.lineColor || "theme:accent", TH.theme(S().design.theme, S().design.custom)) : "#D1AA62";
  g.save();
  if (p > 0) { const cx = W / 2, cy = (top + mid / 2) * k, R = 4000, a0 = p * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); for (let a = a0; a <= Math.PI * 2 + .001; a += .05) g.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a)); g.closePath(); g.clip(); }
  g.strokeStyle = tcss; g.lineWidth = th * k; g.strokeRect(x + th * k / 2, y + th * k / 2, w - th * k, h - th * k);
  g.restore();
}
// معاينة الترجمة النصّيّة (جملة تجريبيّة بنفس الشكل المختار) فوق معاينة الريلز
let rlCT;
function rlCapRefresh() {
  clearTimeout(rlCT);
  rlCT = setTimeout(async () => {
    const cc = rlCaps(), t = rlText();
    if (!cc.on) { RL.capOv = null; return rlDraw(); }
    try { const url = await api.call("reels:overlay", { mode: "cap", sample: true, langs: cc.langs, style: { size: cc.size, pos: cc.pos, box: cc.box, top: +t.top || 0, bot: +t.bot || 0, font: t.nameFont || "" } });
      const im = new Image(); im.onload = () => { RL.capOv = im; rlDraw(); }; im.src = url; } catch {}
  }, 350);
}
function rlOverlayRefresh() {
  clearTimeout(rlT); rlCapRefresh();
  rlT = setTimeout(async () => {
    const t = rlText(), key = JSON.stringify(t);
    if (key === RL.ovKey) return rlDraw();
    try { const url = await api.call("reels:overlay", t); const im = new Image(); im.onload = () => { RL.ov = im; RL.ovKey = key; rlDraw(); }; im.src = url; } catch {}
  }, 450);
}

// ---------- المصدر: تسجيلات كاميرا الشيخ فقط ----------
async function rlFiles(keep) {
  const list = await api.call("reels:list"), sel = $("rlFile");
  sel.innerHTML = '<option value="">— اختر التسجيل من القائمة —</option>' + list.map(f => `<option value="${esc(f.name)}">${esc(f.name.replace(/\.[^.]+$/, ""))}  (${(f.size / 1048576).toFixed(0)} م.ب)</option>`).join("");
  $("rlEmpty").hidden = list.length > 0; sel.parentElement.hidden = !list.length;
  if (keep && list.some(f => f.name === keep)) sel.value = keep;
  // لا يُختار أيّ تسجيل افتراضيّاً: المستخدم يختار من القائمة (ويبقى اختياره السابق عند تحديثها)
  if (keep && list.some(f => f.name === keep)) { if (keep !== RL.file || !RL.vid.getAttribute("src")) rlLoad(keep); } else rlClear();
}
// المعاينة (مشغّل المصدر + معاينة الريلز) لا تظهر إلا بعد اختيار المقطع
function rlShowPrev(on) { const p = document.querySelector(".rlplayer"), sd = document.querySelector(".rlside"), cols = document.querySelector(".rlcols"); if (p) p.hidden = !on; if (sd) sd.hidden = !on; if (cols) cols.classList.toggle("noprev", !on); }
function rlClear() { rlShowPrev(false); const sel = $("rlFile"); if (sel) sel.value = ""; RL.file = ""; RL.track = null; RL.dur = 0; RL.vid.removeAttribute("src"); RL.vid.load(); $("rlLen").textContent = ""; try { rlDraw(); } catch {} }
function rlLoad(name) {
  if (!name) return rlClear(); RL.file = name; rlShowPrev(true); RL.track = null;
  RL.vid.src = rlUrl(name); $("rlStart").value = "0:00"; $("rlEnd").value = "1:00";
  api.call("reels:probe", name).then(i => { RL.dur = i.duration; $("rlLen").textContent = "مدّة التسجيل: " + rlTime(i.duration) + " — " + i.w + "×" + i.h; rlLen(); }).catch(e => { $("rlLen").textContent = "⚠ " + e.message; });
}
function rlLen() {
  const r = rlRange(), e = $("rlLen"); if (!r) { e.textContent = "حدّد بداية ونهاية صحيحتين (مثال 1:30)"; return; }
  const len = r[1] - r[0]; e.style.color = len > 120 ? "var(--bad,#FF8A80)" : ""; e.textContent = "طول المقطع المختار: " + rlTime(len) + (len > 120 ? " — أطول من دقيقتين" : "") + (RL.dur ? "  ·  التسجيل " + rlTime(RL.dur) : "");
}
function rlCleanStatus(st) {
  const e = $("rlCleanSt"); if (!e) return;
  const paint = s => { e.textContent = s && s.recording ? "● تُسجَّل الآن كاميرا الشيخ: " + s.file.replace(/\.[^.]+$/, "") : s && s.active ? "الجلسة جارية — بانتظار اتّصال هاتف الشيخ" : ""; };
  if (st) paint(st); else api.call("reels:clean").then(paint).catch(() => {});
}

function initReels() {
  RL.vid = $("rlVid"); RL.cv = $("rlPrev"); RL.cv.width = 360; RL.cv.height = 640;
  RL.vid.addEventListener("loadeddata", rlDraw); RL.vid.addEventListener("seeked", rlDraw); RL.vid.addEventListener("timeupdate", () => { if (RL.vid.paused) return; rlDraw(); });
  rlFiles(); rlCleanStatus();
  $("rlFile").onchange = e => rlLoad(e.target.value);
  $("rlIn").onclick = () => { $("rlStart").value = rlTime(RL.vid.currentTime); rlLen(); };
  $("rlOut").onclick = () => { $("rlEnd").value = rlTime(RL.vid.currentTime); rlLen(); };
  $("rlStart").oninput = $("rlEnd").oninput = rlLen;
  $("rlDur").innerHTML = ""; [60, 90, 120].forEach(s => { const b = document.createElement("button"); b.textContent = s === 60 ? "دقيقة" : s === 90 ? "دقيقة ونصف" : "دقيقتان"; b.onclick = () => { const a = rlParse($("rlStart").value) || 0; $("rlEnd").value = rlTime(Math.min(a + s, RL.dur || a + s)); rlLen(); }; $("rlDur").appendChild(b); });
  $("rlBack").onclick = closeReels;
  $("rlGo").onclick = rlGo; $("rlCancel").onclick = () => api.call("reels:cancel");
  $("rlFolder").onclick = () => api.call("reels:openFolder");
  api.on("reels:progress", d => { $("rlBar").style.width = Math.round(d.p * 100) + "%"; if (d.m) $("rlMsg").textContent = d.m; });
  api.on("clean", s => { rlCleanStatus(s); if (s && !s.active && !s.recording) rlFiles(RL.file); });
  rlPanels(); rlOverlayRefresh();
}

// ---------- لوحات التخصيص ----------
// الريلز قسم مستقلّ: شاشة كاملة تُفتح من الصفحة الرئيسيّة
function openReels() {
  const v = $("reelsView"); v.hidden = false; v.scrollTop = 0;
  rlFiles(RL.file); rlCleanStatus(); rlPanels(); rlOverlayRefresh();
}
function closeReels() { const v = $("reelsView"); v.hidden = true; try { RL.vid.pause(); } catch {} }
function rlPanels() {
  const look = $("rlLook"), open = {}; look.querySelectorAll("details").forEach((d, i) => open[i] = d.open); look.innerHTML = "";
  const T = rlText(), set = o => rlSetText(o), setRe = o => rlSetText(o).then(rlPanels);
  const lay = rlCfg().layout, setLay = o => rlSave({ layout: Object.assign({}, rlCfg().layout, o) }).then(rlDraw);

  // الشريطان: السمك
  let box = rlAcc(look, "الشريطان العلويّ والسفليّ", open[0] ?? true);
  box.appendChild(tsRange("سمك الشريط العلويّ", 0, 560, 10, T.top, v => v + " px" + (v === 0 ? " (بلا شريط)" : ""), v => { set({ top: v }); rlDraw(); setTimeout(rlDraw, 50); }));
  box.appendChild(tsRange("سمك الشريط السفليّ", 0, 560, 10, T.bot, v => v + " px" + (v === 0 ? " (بلا شريط)" : ""), v => { set({ bot: v }); setTimeout(rlDraw, 50); }));
  box.appendChild(rlRow("لون الشريطين", tsColors(T.bandColor, c => setRe({ bandColor: c }), false, RL_COLORS)));
  const p = document.createElement("p"); p.className = "hint"; p.textContent = "كلّما زاد سمك الشريطين صغر الفيديو بينهما. اجعلهما صفراً لريلز بملء الشاشة."; box.appendChild(p);

  // الزخرفة
  box = rlAcc(look, "الزخرفة", open[1] ?? false);
  box.appendChild(tsSwitch("نقش الهويّة على الشريطين", T.deco !== false, on => setRe({ deco: on })));
  if (T.deco !== false) box.appendChild(tsRange("وضوح النقش", 0.05, 0.6, 0.01, T.decoAlpha ?? .2, v => Math.round(v * 100) + "٪", v => set({ decoAlpha: v })));
  box.appendChild(tsRange("تدرّج الشريطين نحو الفيديو", 0, 400, 10, T.fade ?? 150, v => v + " px" + (v === 0 ? " (حافّة حادّة)" : ""), v => { set({ fade: v }); }));
  box.appendChild(tsSwitch("إطار يحيط بالمقطع ويُزال تدريجيّاً حتى نهايته", T.frame !== false, on => setRe({ frame: on })));
  if (T.frame !== false) { box.appendChild(rlRow("لون الإطار", tsColors(T.frameColor || "", c => setRe({ frameColor: c }), true, RL_COLORS))); box.appendChild(tsRange("سمك الإطار", 2, 20, 1, T.frameW ?? 6, v => v + " px", v => { set({ frameW: v }, false); rlDraw(); })); box.appendChild(tsRange("بُعد الإطار عن الحافّة", 0, 60, 2, T.frameInset ?? 16, v => v + " px", v => { set({ frameInset: v }, false); rlDraw(); })); }
  box.appendChild(tsRange("سمك الخطّ الزخرفيّ", 0, 30, 1, T.line ?? 6, v => v + " px" + (v === 0 ? " (بلا خطّ)" : ""), v => set({ line: v })));
  box.appendChild(rlRow("لون الخطّ الزخرفيّ", tsColors(T.lineColor, c => setRe({ lineColor: c }), false, RL_COLORS)));

  // الترجمة النصّيّة الحيّة: كلام الشيخ يُكتب على الريلز جملةً جملةً (يلزم إنترنت، ويُفرَّغ بنموذج Whisper)
  box = rlAcc(look, "الترجمة النصّيّة الحيّة (كلام الشيخ على الفيديو)", open[5] ?? false);
  { const cc = rlCaps(), setC = o => rlSave({ caps: Object.assign({}, rlCaps(), o) }).then(rlCapRefresh);
    box.appendChild(tsSwitch("كتابة كلام الشيخ على الريلز تلقائيّاً", cc.on, on => setC({ on }).then(rlPanels)));
    if (cc.on) {
      const chips = document.createElement("div"); chips.className = "chips";
      [["ar", "العربيّة (الأصل)"], ["fr", "الفرنسيّة (ترجمة)"]].forEach(([code, name]) => { const b = document.createElement("button"); b.textContent = name; b.classList.toggle("on", (cc.langs || []).includes(code));
        b.onclick = () => { if (code === "ar") return; let l = (rlCaps().langs || ["ar"]).slice(); l = l.includes(code) ? l.filter(x => x !== code) : l.concat(code); if (!l.includes("ar")) l.unshift("ar"); setC({ langs: l }).then(rlPanels); }; chips.appendChild(b); });
      box.appendChild(chips);
      const selOf = (opts, val, fn) => { const s = document.createElement("select"); s.innerHTML = opts.map(([v, t]) => '<option value="' + v + '">' + t + "</option>").join(""); s.value = val; s.onchange = () => fn(s.value); return s; };
      box.appendChild(rlRow("حجم الخطّ", selOf([["s", "صغير"], ["m", "متوسّط"], ["l", "كبير"]], cc.size, v => setC({ size: v }))));
      box.appendChild(rlRow("الموضع على الفيديو", selOf([["bottom", "أسفل الفيديو"], ["center", "وسط الفيديو"], ["top", "أعلى الفيديو"]], cc.pos, v => setC({ pos: v }))));
      box.appendChild(tsSwitch("خلفية داكنة خلف النصّ", cc.box !== false, on => setC({ box: on })));
    }
    const hp = document.createElement("p"); hp.className = "hint"; hp.textContent = "يُفرَّغ كلام المقطع ويُكتب جملةً متّصلةً في سطرها (وتُقسَّم المتوازنة لو طالت) ثمّ تبدأ الجملة التالية في سطر جديد، متزامنةً مع الصوت بعد حذف السكتات. يلزم اتّصال بالإنترنت أثناء إنشاء الريلز، ويزيد زمن الإنشاء قليلاً. لو تعذّر التفريغ يُصدَّر الريلز بلا ترجمة مع تنبيه."; box.appendChild(hp); }

  // الخطوط والألوان
  box = rlAcc(look, "الخطوط وأحجامها وألوانها", open[2] ?? false);
  const grp = (label, fk, sk, ck, min, max) => {
    const h = document.createElement("b"); h.textContent = label; h.style.display = "block"; h.style.margin = "10px 0 4px"; box.appendChild(h);
    box.appendChild(rlRow("الخطّ", rlFontSel(T[fk], v => set({ [fk]: v }))));
    box.appendChild(tsRange("الحجم", min, max, 2, T[sk], v => v + " px", v => set({ [sk]: v })));
    if (ck) box.appendChild(rlRow("اللون", tsColors(T[ck], c => setRe({ [ck]: c }))));
  };
  grp("عنوان الدورة (الشريط العلويّ)", "titleFont", "titleSize", "titleColor", 30, 120);
  grp("اسم الشيخ (الشريط السفليّ)", "nameFont", "nameSize", "nameColor", 30, 120);
  grp("النصّ الإضافيّ فوق الفيديو", "noteFont", "noteSize", null, 28, 90);

  // النصوص
  box = rlAcc(look, "النصوص", open[3] ?? true);
  const field = (label, k, multi) => { const l = document.createElement("label"); l.className = "fld"; l.innerHTML = label + (multi ? `<textarea rows="3"></textarea>` : `<input>`); const i = l.querySelector(multi ? "textarea" : "input"); i.value = T[k] || ""; let tm; i.oninput = () => { clearTimeout(tm); tm = setTimeout(() => set({ [k]: i.value }), 350); }; return l; };
  box.append(field("عنوان الشريط العلويّ — اتركه فارغاً ليُكتب اسم الدورة تلقائيّاً", "title"), field("نصّ إضافيّ فوق الفيديو (اختياريّ)", "note", true), field("سطر ختاميّ تحت اسم الشيخ (حسابك أو وسم)", "foot"));
  const pos = document.createElement("select"); pos.innerHTML = '<option value="top">أعلى الفيديو</option><option value="center">وسط الفيديو</option><option value="low">أسفل الفيديو</option>'; pos.value = T.pos || "low"; pos.onchange = () => set({ pos: pos.value }); box.appendChild(rlRow("موضع النصّ الإضافيّ", pos));
  box.appendChild(tsSwitch("إظهار اسم الشيخ في الشريط السفليّ", T.showName !== false, on => set({ showName: on })));
  const clr = document.createElement("button"); clr.className = "mid danger"; clr.textContent = "مقطع جديد (مسح النصوص)"; clr.onclick = () => setRe({ title: "", note: "", foot: "" }); box.appendChild(clr);

  // الإطار
  box = rlAcc(look, "موضع الصورة وتقريبها", open[4] ?? false);
  box.appendChild(tsRange("التقريب", 1, 2.2, 0.05, lay.zoom || 1, v => "×" + v.toFixed(2), v => setLay({ zoom: v })));
  box.appendChild(tsRange("الموضع الرأسيّ للإطار", 0, 1, 0.01, lay.cy ?? .45, v => Math.round(v * 100) + "٪", v => setLay({ cy: v })));
  if (rlCropWide()) box.appendChild(tsRange("الموضع الأفقيّ للإطار", 0, 1, 0.01, lay.cx ?? .5, v => Math.round(v * 100) + "٪", v => setLay({ cx: v })));

  rlOptions();
}
const rlCropWide = () => { const v = RL.vid; return !!(v && v.videoWidth && v.videoWidth / v.videoHeight > rlAR() * 1.02); };

function rlOptions() {
  const box = $("rlOpt"); box.innerHTML = ""; const c = rlCfg(), lg = c.logo || { on: true, secs: 2 }, sc = c.silence, setSil = o => rlSave({ silence: Object.assign({}, rlCfg().silence, o) });
  box.appendChild(tsSwitch("تتبّع وجه الشيخ تلقائيّاً (لا يفلت من الإطار)", c.track !== false, on => rlSave({ track: on }).then(rlDraw)));
  const b = document.createElement("button"); b.className = "mid"; b.textContent = "معاينة التتبّع للمقطع المحدّد"; b.onclick = async () => { const r = rlRange(); if (!r || !RL.file) return toast("حدّد المقطع أوّلاً"); b.disabled = true; try { await rlAnalyze(RL.file, r[0], r[1]); } catch (e) { $("rlTrackMsg").textContent = "⚠ " + e.message; } b.disabled = false; };
  const m = document.createElement("div"); m.id = "rlTrackMsg"; m.className = "hint"; box.append(b, m);
  box.appendChild(tsSwitch("حذف السكتات تلقائيّاً", !!sc.on, on => setSil({ on }).then(rlOptions)));
  if (sc.on) {
    box.appendChild(tsRange("حساسيّة الصمت", -50, -20, 1, sc.noise, v => v + " dB", v => setSil({ noise: v })));
    box.appendChild(tsRange("أقصر سكتة تُحذف", 0.2, 1.5, 0.05, sc.minSil, v => v.toFixed(2) + " ث", v => setSil({ minSil: v })));
    box.appendChild(tsRange("نَفَس يبقى حول الكلام", 0.05, 0.4, 0.01, sc.pad, v => v.toFixed(2) + " ث", v => setSil({ pad: v })));
  }
  box.appendChild(tsSwitch("شعار الحلقة في البداية (يتلاشى) وفي النهاية", !!lg.on, on => rlSave({ logo: Object.assign({}, rlCfg().logo, { on }) }).then(rlOptions)));
  if (lg.on) box.appendChild(tsRange("مدّة ظهور الشعار", 1, 4, 0.25, lg.secs || 2, v => v + " ث", v => rlSave({ logo: Object.assign({}, rlCfg().logo, { secs: v }) })));
  box.appendChild(tsSwitch("ضبط مستوى الصوت للنشر", c.loud !== false, on => rlSave({ loud: on })));
  box.appendChild(tsSwitch("حفظ كاميرا الشيخ العموديّة تلقائيّاً مع كلّ بثّ أو تسجيل", c.clean ? c.clean.on !== false : true, on => rlSave({ clean: { on } }).then(() => toast(on ? "ستُحفظ كاميرا الشيخ في الجلسة القادمة" : "أُوقف حفظ كاميرا الشيخ"))));
}

async function rlGo() {
  if (RL.busy) return; const r = rlRange(); if (!r) return toast("حدّد بداية المقطع ونهايته");
  if (!RL.file) return toast("اختر التسجيل من القائمة أولاً");
  if (r[1] - r[0] > 125) return toast("الريلز أقصاه دقيقتان — قصّر المقطع");
  RL.busy = true; $("rlGo").disabled = true; $("rlCancel").hidden = false; $("rlBar").style.width = "0"; $("rlMsg").textContent = "بدء…"; $("rlResult").innerHTML = "";
  try {
    const job = { name: RL.file, start: r[0], dur: r[1] - r[0] };
    if (rlCfg().track !== false) {
      let kf = RL.track && RL.track.file === RL.file && RL.track.a === r[0] && RL.track.b === r[1] && RL.track.z === (rlCfg().layout.zoom || 1) && RL.track.bands === rlMid() ? RL.track.kf : null;
      if (!kf) { $("rlMsg").textContent = "تتبّع وجه الشيخ…"; try { kf = await rlAnalyze(RL.file, r[0], r[1]); } catch { kf = null; } }
      job.track = kf || null;
    } else job.track = null;
    const out = await api.call("reels:render", job);
    $("rlMsg").textContent = `✓ تمّ: ${Math.round(out.duration)} ث` + (out.removed > 0.5 ? ` (حُذف ${Math.round(out.removed)} ث من السكتات)` : "") + (out.capsN ? ` · ترجمة نصّيّة: ${out.capsN} جملة` : "") + (out.capsWarn ? " — ⚠ الترجمة النصّيّة: " + out.capsWarn : "");
    $("rlResult").innerHTML = `<video controls preload="metadata" src="/reels/${encodeURIComponent(out.rel)}" style="width:100%;max-width:320px;border-radius:14px;background:#000"></video>`;
  } catch (e) { $("rlMsg").textContent = "⚠ " + e.message; }
  RL.busy = false; $("rlGo").disabled = false; $("rlCancel").hidden = true;
}

