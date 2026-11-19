// «معمل المجالس» — استوديو تعديل مقاطع محمَّلة في الحاسوب (واجهة المحرّر).
// المحرّك والتصدير في src/lab.js (ffmpeg)؛ الطبقات (آيات، بطاقات، صور…) تُرسَم PNG شفّافة من صفحات البثّ نفسها عبر lab:png.
// المعاينة تقريبيّة (نسخة 360p + صور الطبقات)؛ التصدير هو المرجع النهائيّ.
const LAB = { p: null, sel: null, t: 0, playing: false, pps: 28, undo: [], redo: [], tab: "media", prog: {}, raf: 0, seg: null, t0: 0, w0: 0 };
const LK = { free: "مقطع حرّ", lesson: "درس", khutba: "خطبة", lecture: "محاضرة", quran: "قرآن كريم", reply: "ردّ", audio: "صوتيّ" };
const LKMODE = { lesson: "lessons", free: "lessons", reply: "lessons", audio: "lessons", khutba: "khutba", lecture: "lecture", quran: "quran" };
const lq = (s, r = document) => r.querySelector(s);
const lmk = (tag, cls, txt, par) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (par) par.appendChild(e); return e; };
const lfmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); };
const lmedia = (c, rel) => "/lab/" + LAB.p.id + "/" + rel;
const lclip = id => LAB.p.clips.find(c => c.id === id);
const lid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ---------- الزمن (نفس منطق src/lab.js) ----------
const lsegDur = s => s.type === "still" ? Math.max(.5, s.dur || 3) : Math.max(.05, (s.out - s.in) / (s.speed || 1));
function ltl() {
  let t = 0; const items = [];
  (LAB.p.seq || []).forEach((s, i) => { const d = lsegDur(s), tr = i > 0 && s.trans && s.trans.d > 0 ? Math.min(s.trans.d, d / 2, items[i - 1].dur / 2) : 0; const st = t - tr; items.push({ s, start: st, dur: d, end: st + d }); t = st + d; });
  return { items, total: t };
}
const lsegAt = (T, t) => { let r = T.items[0] || null; for (const it of T.items) if (t >= it.start - 1e-6) r = it; return r; };

// ---------- فتح/إغلاق ----------
function openLab() {
  let v = $("labView");
  if (!v) { v = document.createElement("div"); v.id = "labView"; document.body.appendChild(v); }
  v.hidden = false; $("modeHub").hidden = true; labList();
  if (!LAB.bound) {
    LAB.bound = true;
    api.on("lab:proxy", d => { if (!LAB.p || d.pid !== LAB.p.id) return; if (d.clip) { const i = LAB.p.clips.findIndex(c => c.id === d.cid); if (i >= 0) LAB.p.clips[i] = d.clip; } LAB.prog[d.cid] = d.err ? -1 : d.p; labMediaPaint(); if (d.p === 1 && d.clip) { LAB.vkey = ""; LAB.cur = ""; labTimelinePaint(); labShow(LAB.t); } });
    api.on("lab:progress", d => { if (LAB.p && d.pid === LAB.p.id) labProg(d.p, d.m); });
    addEventListener("keydown", labKeys);
  }
}
function closeLab() { labLeave(); labPause(); const v = $("labView"); if (v) v.hidden = true; openModes(); }

// ---------- قائمة المشاريع ----------
async function labList() {
  labLeave(); const v = $("labView"); labPause(); LAB.p = null; v.className = "lab-list";
  const list = await api.call("lab:list");
  v.innerHTML = `<div class="lab-top"><button class="mid" id="lbBack">‹ الأقسام</button><b class="lab-h">معمل المجالس</b><span class="grow"></span><button class="mid" id="lbOut">📁 مجلّد المخرجات</button></div>
    <p class="hint lab-sub">استوديو لتعديل مقاطع محمَّلة في الحاسوب: قصّ، حذف السكتات، دمج، مشاهد، آيات، مقدّمات، صور مصادر، ردّ على مقطع، وإضافة إطار وصور إلى صوت.</p>
    <div class="lab-grid"></div>`;
  $("lbBack").onclick = closeLab; $("lbOut").onclick = () => api.call("lab:openOut");
  const g = lq(".lab-grid", v);
  const nw = lmk("div", "lcard add", null, g); nw.innerHTML = '<span class="plus">＋</span><b>مشروع جديد</b>'; nw.onclick = labNew;
  list.forEach(p => {
    const c = lmk("div", "lcard", null, g);
    c.innerHTML = `<b>${esc(p.name)}</b><small>${LK[p.kind] || ""} · ${lfmt(p.dur)}</small><div class="cact"><button class="mid" data-a="op">فتح</button><button class="mid danger" data-a="dl">حذف</button></div>`;
    c.onclick = e => { if (!e.target.closest("[data-a=dl]")) labOpen(p.id); };
    lq("[data-a=dl]", c).onclick = async e => { e.stopPropagation(); if (!confirm("حذف المشروع «" + p.name + "»؟ (ملفّاتك الأصليّة لا تُحذف)")) return; await api.call("lab:remove", p.id); labList(); };
  });
}
async function labNew() {
  const f = await askForm("مشروع جديد في المعمل", [{ k: "name", label: "اسم المشروع", val: "" }], "إنشاء"); if (!f) return;
  const p = await api.call("lab:create", "lesson", f.name || "مشروع جديد"); labOpen(p.id);
}
// الإطار الجانبي الكامل (ضبط الحلقة / ضبط الدرس / الشكل) يُنقَل إلى المعمل ويعمل على «صندوق» المشروع بدل إعدادات البثّ الحيّة
const LAB_SIDE = ["halaqa", "lesson", "design"];
async function labEnter(id) {
  if (!LAB.in) { LAB.in = true; document.body.classList.add("lab-open"); if (!$("labSideHold")) { const h = document.createElement("div"); h.id = "labSideHold"; document.body.appendChild(h); } LAB.sideOrig = {}; for (const k of LAB_SIDE) { const e = $("t-" + k); if (e && !LAB.sideOrig[k]) LAB.sideOrig[k] = { parent: e.parentNode, next: e.nextSibling }; } }
  let sbx = await api.call("lab:sbx:open", id); if (sbx.mode !== LKMODE[LAB.p.kind]) sbx = await api.call("lab:sbx:patch", id, { mode: LKMODE[LAB.p.kind] || "lessons" }); window.LABSB = { pid: id, changed: labSbxChanged }; ST.settings = sbx;
  for (const k of LAB_SIDE) { const e = $("t-" + k); if (e) { e.classList.remove("on"); $("labSideHold").appendChild(e); } }
}
function labLeave() {
  if (!LAB.in) return; LAB.in = false; window.LABSB = null; document.body.classList.remove("lab-open");
  for (const k of LAB_SIDE) { const e = $("t-" + k), o = LAB.sideOrig && LAB.sideOrig[k]; if (e && o) { e.classList.remove("on"); o.parent.insertBefore(e, o.next && o.next.parentNode === o.parent ? o.next : null); } }
  const first = document.querySelector("#tabs button.on"); if (first) document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "t-" + first.dataset.t));
  api.call("state:get").then(st => { ST = st; try { applyModeUI(); renderTexts(); renderDesign(); } catch {} });
}
let labSbxT = 0;
function labSbxChanged() { clearTimeout(labSbxT); labSbxT = setTimeout(labApplySbx, 1600); }
// بعد أيّ تعديل في الإطار الجانبي: إعادة رسم الشاشات والبطاقات والإطارات (الخفيفة) بالتصميم الجديد
async function labApplySbx() {
  if (!LAB.p || !window.LABSB) return;
  LAB.live = await api.call("lab:live", LAB.p.kind, LAB.p.id);
  const light = LAB.p.ov.filter(o => o.png && ["frame", "lower", "title", "text", "tag", "side"].includes(o.type)), stills = LAB.p.seq.filter(s => s.type === "still"), boxed = LAB.p.seq.filter(s => s.layout && s.layout.mode === "box");
  const total = light.length + stills.length + (boxed.length ? 1 : 0); let k = 0; if (!total) { LAB.dirty = LAB.p.ov.some(o => o.png); labLeftPaint(false); return; }
  const say = () => labProg(k / total, "تطبيق التعديل على الطبقات…");
  if (boxed.length) { LAB.p.bgPng = null; await labEnsureBg(); boxed.forEach(s => { s.layout.bg = LAB.p.bgPng; s.layout.shape = labShape(); }); k++; say(); }
  for (const o of light) { try { o.png = await labPngRaw(labSpec(o)); o.rev = (o.rev || 0) + 1; } catch {} k++; say(); }
  for (const s of stills) { try { s.png = await labPngRaw(labSpec({ type: "screen", kind: s.kind || "intro" })); } catch {} k++; say(); }
  labProg(1); labSaveSoon(); LAB.vkey = ""; labOverlaysRebuild(); labTimelinePaint(); labShow(LAB.t);
}
async function labOpen(id) { LAB.p = await api.call("lab:get", id); await labEnter(id); LAB.live = await api.call("lab:live", LAB.p.kind, LAB.p.id); LAB.p.clips.forEach(c => { if ((c.kind === "video" || c.kind === "audio") && c.proxyV !== 2) { LAB.prog[c.id] = 0; api.call("lab:reproxy", LAB.p.id, c.id); } }); LAB.sel = null; LAB.t = 0; LAB.undo = []; LAB.redo = []; LAB.tab = LAB.p.seq.length ? "project" : "media"; labEditor(); }

// ---------- حفظ وتراجع ----------
let labSaveT = 0;
const labSaveSoon = () => { clearTimeout(labSaveT); labSaveT = setTimeout(() => api.call("lab:save", LAB.p), 350); };
function labSyncScn() {
  const p = LAB.p, T = ltl(), by = Object.fromEntries(T.items.map(i => [i.s.id, i]));
  p.ov = p.ov.filter(o => !o.scn || by[o.scn]); p.ov.forEach(o => { if (o.scn) { const i = by[o.scn]; o.start = i.start; o.end = i.end; } });
}
function labCloneScn(p, oldId, newId) { p.ov.filter(o => o.scn === oldId).forEach(o => p.ov.push(Object.assign(JSON.parse(JSON.stringify(o)), { id: lid("o"), scn: newId }))); }
function labDo(fn, quiet) {
  LAB.undo.push(JSON.stringify(LAB.p)); if (LAB.undo.length > 60) LAB.undo.shift(); LAB.redo = [];
  fn(LAB.p); labSyncScn(); labSaveSoon(); if (!quiet) labPaintAll();
}
function labUndo(redo) {
  const from = redo ? LAB.redo : LAB.undo, to = redo ? LAB.undo : LAB.redo; if (!from.length) return;
  to.push(JSON.stringify(LAB.p)); const q = JSON.parse(from.pop()); LAB.p = q; labSaveSoon(); labPaintAll();
}
function labKeys(e) {
  const v = $("labView"); if (!v || v.hidden || !LAB.p || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); LAB.playing ? labPause() : labPlay(); }
  else if (e.key === "s" || e.key === "S") labSplit();
  else if (e.key === "Delete") labDelete();
  else if (e.key === "]") labBookTurn(1); else if (e.key === "[") labBookTurn(-1);
  else if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); labUndo(e.shiftKey); }
  else if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); labUndo(true); }
  else if (e.key === "ArrowLeft") labSeek(LAB.t - (e.shiftKey ? 5 : 1)); else if (e.key === "ArrowRight") labSeek(LAB.t + (e.shiftKey ? 5 : 1));
}

// ---------- المحرّر ----------
function labEditor() {
  const v = $("labView"); v.className = "lab-ed"; const p = LAB.p;
  v.innerHTML = `<div class="lab-top"><button class="mid" id="leBack">‹ المشاريع</button><input id="leName" class="lab-name" value="${esc(p.name)}"><span class="lab-kind">${LK[p.kind] || ""}</span><span class="grow"></span>
      <button class="mid" id="leUndo" title="تراجع (Ctrl+Z)">↶</button><button class="mid" id="leRedo" title="إعادة">↷</button>
      <span id="leProg" class="lab-prog" hidden><i></i><em></em></span><button class="mid" id="leCancel" hidden>إيقاف</button>
      <button class="mid pri" id="leExp">⬇ تصدير الفيديو</button><button class="mid" id="leOut" title="مجلّد المخرجات">📁</button></div>
    <div class="lab-main">
      <aside class="lab-left"><button id="leFold" class="lab-fold" title="طيّ الإطار الجانبي"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M12 4v12"/></svg></button><div class="lab-tabs"><button data-t="project">المشروع</button><button data-t="media">الوسائط</button><button data-t="halaqa">ضبط الحلقة</button><button data-t="lesson">ضبط الدرس</button><button data-t="design">الشكل</button><button data-t="tools">الأدوات</button></div><div id="leLeft" class="lab-pane"></div></aside>
      <section class="lab-center"><button id="leUnfold" class="lab-fold lab-unfold" title="فتح الإطار الجانبي" hidden><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M12 4v12"/></svg></button>
        <div class="lab-stage" id="leStage"><div class="lab-scale" id="leScale"></div></div>
        <div class="lab-tr"><button class="mid" id="lePlay">▶</button><button class="mid" id="leSplit" title="تقسيم عند المؤشّر (S)">✂ تقسيم</button><button class="mid danger" id="leDel" title="حذف المحدّد (Del)">🗑</button>
          <span id="leTime" class="lab-time">0:00.0 / 0:00.0</span><span class="grow"></span><label class="lab-zoom">تقريب <input type="range" id="leZoom" min="6" max="140" value="${LAB.pps}"></label></div>
        <div class="lab-tl" id="leTl"></div>
      </section>
      <aside class="lab-right" id="leInsp"></aside>
    </div>`;
  $("leBack").onclick = async () => { labPause(); await api.call("lab:save", LAB.p); labList(); };
  $("leName").oninput = e => { LAB.p.name = e.target.value; labSaveSoon(); };
  $("leFold").onclick = () => labFold(true); $("leUnfold").onclick = () => labFold(false);
  $("leUndo").onclick = () => labUndo(false); $("leRedo").onclick = () => labUndo(true);
  $("lePlay").onclick = () => LAB.playing ? labPause() : labPlay();
  $("leSplit").onclick = labSplit; $("leDel").onclick = labDelete; $("leExp").onclick = labExport; $("leOut").onclick = () => api.call("lab:openOut");
  $("leCancel").onclick = () => api.call("lab:cancel");
  $("leZoom").oninput = e => { LAB.pps = +e.target.value; labTimelinePaint(); };
  v.querySelectorAll(".lab-tabs button").forEach(b => b.onclick = () => { LAB.tab = b.dataset.t; labLeftPaint(); }); labFold(!!LAB.fold);
  LAB.vid = lmk("video", "lab-v", null, $("leScale")); LAB.vid.playsInline = true; LAB.vid.preload = "auto";
  LAB.vid.addEventListener("error", () => { const src = LAB.vid.getAttribute("src"); if (!src) return; if (!LAB.retry || LAB.retry.src !== src) { LAB.retry = { src, n: 0 }; } if (LAB.retry.n++ < 2) { setTimeout(() => { LAB.vid.src = src.split("?")[0] + "?r=" + Date.now(); }, 600); } else toast("تعذّر تشغيل معاينة هذا المقطع — أعد فتح المشروع ليُعاد تجهيزها", 6000); });
  LAB.vid2 = lmk("video", "lab-v2", null, $("leScale")); LAB.vid2.muted = true; LAB.vid2.hidden = true;
  LAB.cur = null; LAB.vkey = ""; new ResizeObserver(labFit).observe($("leStage")); labPaintAll(); labSeek(0);
}
function labFold(on) { LAB.fold = on; lq(".lab-main").classList.toggle("fold", on); $("leUnfold").hidden = !on; setTimeout(labFit, 60); }
function labFit() { const st = $("leStage"), sc = $("leScale"); if (!st || !sc) return; sc.style.transform = `scale(${st.clientWidth / 1920})`; }
function labPaintAll() { labLeftPaint(); labInspPaint(); labTimelinePaint(); labOverlaysRebuild(); labShow(LAB.t); const u = $("leUndo"); if (u) { u.disabled = !LAB.undo.length; $("leRedo").disabled = !LAB.redo.length; } }
function labProg(p, m) { const b = $("leProg"); if (!b) return; b.hidden = p >= 1 || p == null; lq("i", b).style.width = Math.round((p || 0) * 100) + "%"; lq("em", b).textContent = m || Math.round((p || 0) * 100) + "٪"; $("leCancel").hidden = b.hidden; }

// ---------- المعاينة ----------
function labOverlaysRebuild() {
  const sc = $("leScale"); if (!sc) return;
  sc.querySelectorAll(".lab-ovi").forEach(e => e.remove());
  LAB.ovEls = [];
  (LAB.p.ov || []).forEach(o => { if (!o.png) return; const im = lmk("img", "lab-ovi"); im.src = lmedia(null, o.png) + "?" + (o.rev || 0); im.dataset.id = o.id; if (o.at && o.size) Object.assign(im.style, { left: o.at[0] + "px", top: o.at[1] + "px", width: o.size[0] + "px", height: o.size[1] + "px" }); sc.appendChild(im); LAB.ovEls.push([o, im]); });
}
function labLayout(seg) { return (seg && seg.layout) || { mode: "full" }; }
// عناصر المشهد الثابتة (خلفيّة/شاشة) تُبنى مرّة عند تغيّر الجزء أو تخطيطه — لا في كل إطار — ليبقى التشغيل سلساً
function labStatic(it, c) {
  const sc = $("leScale"), v = LAB.vid, s = it.s, L = labLayout(s);
  ["leStill", "leBg"].forEach(id => { const e = $(id); if (e) e.remove(); });
  if (s.type === "still") { v.hidden = true; const im = lmk("img", "lab-still", null, sc); im.id = "leStill"; im.src = lmedia(null, s.png); sc.insertBefore(im, v); return; }
  if (!c) { v.hidden = true; return; }
  if (c.kind === "image") { v.hidden = true; const im = lmk("img", "lab-still", null, sc); im.id = "leStill"; im.src = lmedia(null, c.local); im.style.objectFit = "contain"; sc.insertBefore(im, v); return; }
  v.hidden = c.kind === "audio";
  if (c.kind === "audio" && LAB.p.bgPng) { const b = lmk("img", "lab-still", null, sc); b.id = "leBg"; b.src = lmedia(null, LAB.p.bgPng); sc.insertBefore(b, v); }
  if (L.mode === "box" && L.box) {
    if (L.bg) { const b = lmk("img", "lab-still", null, sc); b.id = "leBg"; b.src = lmedia(null, L.bg); sc.insertBefore(b, v); }
    Object.assign(v.style, { left: L.box[0] + "px", top: L.box[1] + "px", width: L.box[2] + "px", height: L.box[3] + "px", borderRadius: "34px", objectFit: "cover" });
  } else Object.assign(v.style, { left: 0, top: 0, width: "1920px", height: "1080px", borderRadius: 0, objectFit: L.fit === "cover" ? "cover" : "contain" });
  const rel = c.proxy; if (!rel) { v.removeAttribute("src"); LAB.cur = ""; return; }
  const src = lmedia(null, rel); if (LAB.cur !== src) { LAB.cur = src; v.src = src; }
  v.muted = !!s.mute; v.volume = Math.max(0, Math.min(1, s.vol ?? 1)); v.playbackRate = s.speed || 1;
}
function labShow(t) {
  const sc = $("leScale"); if (!sc || !LAB.p) return; const T = ltl(), it = lsegAt(T, t), tot = T.total, now = performance.now();
  $("leTime").textContent = lfmt(t) + " / " + lfmt(tot);
  const ph = $("lePh"); if (ph) ph.style.left = (t * LAB.pps) + "px";
  (LAB.ovEls || []).forEach(([o, im]) => { const on = t >= o.start && t < o.end; im.style.opacity = on ? 1 : 0; });
  // مقطع «المشهد» (B-roll)
  const br = (LAB.p.ov || []).find(o => o.type === "broll" && t >= o.start && t < o.end), v2 = LAB.vid2;
  if (br && lclip(br.clip) && lclip(br.clip).proxy) {
    const c = lclip(br.clip), src = lmedia(null, c.proxy); if (v2.dataset.src !== src) { v2.dataset.src = src; v2.src = src; }
    const want = (br.in || 0) + (t - br.start); if (Math.abs(v2.currentTime - want) > (LAB.playing ? .7 : .08)) { try { v2.currentTime = want; } catch {} }
    v2.hidden = false; const box = br.mode === "box" && br.box ? br.box : [0, 0, 1920, 1080];
    Object.assign(v2.style, { left: box[0] + "px", top: box[1] + "px", width: box[2] + "px", height: box[3] + "px", borderRadius: br.mode === "box" ? "34px" : "0", objectFit: br.mode === "box" ? "cover" : "contain" });
    v2.muted = !br.audio; LAB.playing ? v2.play().catch(() => {}) : v2.pause();
  } else if (!v2.hidden) { v2.hidden = true; v2.pause(); }
  const v = LAB.vid; if (!it) { v.hidden = true; LAB.seg = null; return; }
  const s = it.s, c = s.clip && lclip(s.clip), key = s.id + "|" + JSON.stringify(s.layout || null) + "|" + (s.png || "") + "|" + (s.mute ? 1 : 0) + (s.vol ?? 1) + (s.speed || 1) + "|" + (c && c.proxy) + "|" + (LAB.p.bgPng || "");
  LAB.seg = it;
  if (key !== LAB.vkey) { LAB.vkey = key; labStatic(it, c); LAB.seekLock = 0; }
  if (!c || c.kind === "image" || s.type === "still") { try { v.pause(); } catch {} return; }
  const want = s.in + (t - it.start) * (s.speed || 1);
  if (!LAB.playing) { if (v.readyState && Math.abs(v.currentTime - want) > .04) { try { v.currentTime = want; } catch {} } }
  else if (Math.abs(v.currentTime - want) > .7 && now > (LAB.seekLock || 0)) { try { v.currentTime = want; } catch {} LAB.seekLock = now + 800; }
}
function labSeek(t) { const T = ltl(); LAB.t = Math.max(0, Math.min(T.total, t)); LAB.t0 = performance.now(); LAB.w0 = LAB.t; labShow(LAB.t); }
function labPlay() {
  const T = ltl(); if (!T.total) return; if (LAB.t >= T.total - .05) LAB.t = 0;
  LAB.playing = true; $("lePlay").textContent = "⏸"; LAB.t0 = performance.now(); LAB.w0 = LAB.t; LAB.seekLock = 0; LAB.vkey = ""; labShow(LAB.t);
  const v = LAB.vid; v.muted = !!(LAB.seg && LAB.seg.s.mute); v.play().catch(() => {});
  const tick = () => {
    if (!LAB.playing) return; const T2 = ltl(), it = LAB.seg, now = performance.now();
    let t = LAB.t;
    const vid = it && it.s.type !== "still" && lclip(it.s.clip) && lclip(it.s.clip).kind !== "image" && lclip(it.s.clip).proxy;
    if (vid) { if (v.readyState >= 2 && !v.seeking && !v.paused) t = it.start + (v.currentTime - it.s.in) / (it.s.speed || 1); else if (v.paused) v.play().catch(() => {}); }   // الفيديو هو الساعة الرئيسيّة ما دام يعمل
    else t = LAB.w0 + (now - LAB.t0) / 1000;
    if (t >= T2.total - .02) { labPause(); LAB.t = T2.total; labShow(LAB.t); return; }
    if (it && t >= it.end - .03) { const nx = T2.items.find(x => x.start >= it.end - .05 && x.s.id !== it.s.id) || lsegAt(T2, it.end + .01); LAB.t = nx && nx.s.id !== it.s.id ? nx.start + .001 : t; LAB.t0 = now; LAB.w0 = LAB.t; LAB.vkey = ""; LAB.seekLock = now + 500; labShow(LAB.t); const nv = LAB.seg && lclip(LAB.seg.s.clip); if (nv && nv.kind !== "image") v.play().catch(() => {}); }
    else { LAB.t = t; labShow(t); const tl = $("leTl"); if (tl) { const x = t * LAB.pps; if (x > tl.scrollLeft + tl.clientWidth - 60 || x < tl.scrollLeft) tl.scrollLeft = Math.max(0, x - 80); } }
    LAB.raf = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(LAB.raf); LAB.raf = requestAnimationFrame(tick);
}
function labPause() { LAB.playing = false; cancelAnimationFrame(LAB.raf); try { LAB.vid && LAB.vid.pause(); LAB.vid2 && LAB.vid2.pause(); } catch {} const b = $("lePlay"); if (b) b.textContent = "▶"; }

// ---------- الخطّ الزمنيّ ----------
function labTimelinePaint() {
  const tl = $("leTl"); if (!tl) return; const keep = tl.scrollLeft, T = ltl(), px = LAB.pps, W = Math.max(tl.clientWidth, (T.total + 12) * px);
  tl.innerHTML = ""; const inner = lmk("div", "lab-tin", null, tl); inner.style.width = W + "px";
  const ru = lmk("div", "lab-ruler", null, inner); const step = px >= 80 ? 1 : px >= 40 ? 2 : px >= 18 ? 5 : px >= 10 ? 10 : 30;
  for (let s = 0; s * px < W; s += step) { const k = lmk("i", "", null, ru); k.style.left = s * px + "px"; k.textContent = lfmt(s).replace(/\.0$/, ""); }
  ru.onpointerdown = e => { const f = ev => labSeek((ev.clientX - ru.getBoundingClientRect().left) / px); labPause(); f(e); const mv = ev => f(ev), up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); };
  // مسار الفيديو
  const tv = lmk("div", "lab-track v", null, inner); lmk("span", "lab-tl", "فيديو", tv);
  T.items.forEach((it, i) => {
    const s = it.s, b = lmk("div", "lab-blk seg" + (LAB.sel && LAB.sel.id === s.id ? " sel" : "") + (s.type === "still" ? " still" : ""), null, tv), c = s.clip && lclip(s.clip);
    b.style.left = it.start * px + "px"; b.style.width = Math.max(10, it.dur * px) + "px"; b.dataset.id = s.id;
    if (c && c.thumb) b.style.backgroundImage = `url(${lmedia(null, c.thumb)})`;
    lmk("em", "", s.type === "still" ? "شاشة" : (c ? c.name : "؟") + (s.speed && s.speed !== 1 ? " ×" + s.speed : ""), b);
    if (c && c.peaks && s.type !== "still") { const cv = lmk("canvas", "lab-wave", null, b); const w = Math.max(10, Math.round(it.dur * px)); cv.width = w; cv.height = 34; const g = cv.getContext("2d"); g.fillStyle = "rgba(255,255,255,.55)"; const n = c.peaks.length, per = n / c.dur; for (let x = 0; x < w; x += 2) { const ts = s.in + (x / px) * (s.speed || 1), pk = c.peaks[Math.min(n - 1, Math.floor(ts * per))] || 0, hh = Math.max(1, pk * 32); g.fillRect(x, 17 - hh / 2, 1.5, hh); } }
    if (s.trans && s.trans.d > 0 && i > 0) lmk("u", "", "⇄", b);
    b.onpointerdown = e => { if (e.target.classList.contains("h")) return; LAB.sel = { type: "seg", id: s.id }; labTimelinePaint(); labInspPaint(); labPause(); labSeek(Math.max(it.start, (e.clientX - tl.getBoundingClientRect().left + tl.scrollLeft) / px)); };
    if (s.type !== "still") for (const side of ["l", "r"]) { const h = lmk("s", "h " + side, null, b); h.onpointerdown = e => labTrim(e, s, side, it); }
  });
  // مسار الطبقات (أسطر حسب التداخل)
  const lanes = []; (LAB.p.ov || []).slice().sort((a, b) => a.start - b.start).forEach(o => { let k = lanes.findIndex(e => e <= o.start + 1e-6); if (k < 0) { k = lanes.length; lanes.push(0); } lanes[k] = o.end; o._lane = k; });
  const to = lmk("div", "lab-track o", null, inner); to.style.height = Math.max(1, lanes.length) * 28 + 8 + "px"; lmk("span", "lab-tl", "طبقات", to);
  (LAB.p.ov || []).forEach(o => {
    const b = lmk("div", "lab-blk ov " + o.type + (LAB.sel && LAB.sel.id === o.id ? " sel" : ""), null, to); b.style.left = o.start * px + "px"; b.style.width = Math.max(10, (o.end - o.start) * px) + "px"; b.style.top = 4 + (o._lane || 0) * 28 + "px";
    lmk("em", "", labOvName(o), b);
    b.onpointerdown = e => { if (e.target.classList.contains("h")) return; LAB.sel = { type: "ov", id: o.id }; labTimelinePaint(); labInspPaint(); labDragOv(e, o, "move"); };
    for (const side of ["l", "r"]) { const h = lmk("s", "h " + side, null, b); h.onpointerdown = e => { LAB.sel = { type: "ov", id: o.id }; labDragOv(e, o, side); }; }
  });
  // الصوت الإضافيّ
  const ta = lmk("div", "lab-track a", null, inner); lmk("span", "lab-tl", "صوت", ta);
  (LAB.p.audio || []).forEach((a, i) => { const c = lclip(a.clip); if (!c) return; const b = lmk("div", "lab-blk aud" + (LAB.sel && LAB.sel.id === a.id ? " sel" : ""), null, ta); b.style.left = (a.at || 0) * px + "px"; b.style.width = Math.max(10, Math.min(T.total - (a.at || 0), c.dur - (a.in || 0)) * px) + "px"; lmk("em", "", "♪ " + c.name, b); b.onpointerdown = () => { LAB.sel = { type: "aud", id: a.id }; labTimelinePaint(); labInspPaint(); }; });
  const ph = lmk("div", "lab-ph", null, inner); ph.id = "lePh"; ph.style.left = LAB.t * px + "px";
  tl.scrollLeft = keep;
}
const labOvName = o => ({ lower: "بطاقة: " + (o.name || ""), title: "عنوان: " + (o.t || ""), text: "نصّ: " + (o.t || ""), image: "صورة" + (o.cap ? ": " + o.cap : ""), book: "كتاب ص " + (o.page || 1), frame: "إطار البثّ", verse: "آية " + (o.s || "") + ":" + (o.a || ""), broll: "مقطع آخر", tag: "شارة", side: "جانب", screen: "شاشة" }[o.type] || o.type);
function labDragOv(e, o, mode) {
  e.preventDefault(); const x0 = e.clientX, s0 = o.start, e0 = o.end, px = LAB.pps; let moved = false; LAB.undo.push(JSON.stringify(LAB.p)); LAB.redo = [];
  const mv = ev => { moved = true; const dx = (ev.clientX - x0) / px; if (mode === "move") { o.start = Math.max(0, s0 + dx); o.end = o.start + (e0 - s0); } else if (mode === "l") o.start = Math.max(0, Math.min(e0 - .3, s0 + dx)); else o.end = Math.max(s0 + .3, e0 + dx); labTimelinePaint(); };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); if (!moved) LAB.undo.pop(); else labSaveSoon(); labInspPaint(); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up);
}
function labTrim(e, s, side, it) {
  e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, in0 = s.in, out0 = s.out, px = LAB.pps, c = lclip(s.clip), sp = s.speed || 1; LAB.undo.push(JSON.stringify(LAB.p)); LAB.redo = []; let moved = false;
  const mv = ev => { moved = true; const dt = (ev.clientX - x0) / px * sp; if (side === "r") s.out = Math.max(s.in + .2, Math.min(c.dur, out0 + dt)); else s.in = Math.max(0, Math.min(out0 - .2, in0 + dt)); labTimelinePaint(); labShow(LAB.t); };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); if (!moved) LAB.undo.pop(); else labSaveSoon(); labPaintAll(); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up);
}
function labSplit() {
  const T = ltl(), it = lsegAt(T, LAB.t); if (!it || it.s.type === "still") return; const s = it.s, sp = s.speed || 1, at = s.in + (LAB.t - it.start) * sp;
  if (at <= s.in + .15 || at >= s.out - .15) { toast("ضع المؤشّر داخل الجزء بعيداً عن حافّتيه"); return; }
  labDo(p => { const i = p.seq.findIndex(x => x.id === s.id), b = Object.assign({}, JSON.parse(JSON.stringify(s)), { id: lid("s"), in: at, trans: null }); p.seq[i].out = at; p.seq.splice(i + 1, 0, b); labCloneScn(p, s.id, b.id); LAB.sel = { type: "seg", id: b.id }; });
}
function labDelete() {
  const sel = LAB.sel; if (!sel) return;
  labDo(p => {
    if (sel.type === "seg") {
      // حذف جزء = سحب ما بعده: الطبقات اللاحقة تتقدّم بمدّته (والتي تتقاطع معه تُقصَّر) حتى لا تبقى في غير مكانها
      const it = ltl().items.find(i => i.s.id === sel.id);
      if (it) { const a = it.start, b = it.end, d = b - a; p.ov.forEach(o => { if (o.start >= b - .01) { o.start -= d; o.end -= d; } else if (o.end > a && o.start < b) { if (o.start >= a) { o.start = a; o.end = Math.max(a + .3, o.end - d); } else o.end = Math.max(o.start + .3, o.end - Math.min(d, o.end - a)); } }); p.audio.forEach(x => { if ((x.at || 0) >= b - .01) x.at -= d; }); }
      p.seq = p.seq.filter(s => s.id !== sel.id); if (p.seq[0]) p.seq[0].trans = null;
    }
    else if (sel.type === "ov") p.ov = p.ov.filter(o => o.id !== sel.id);
    else if (sel.type === "aud") p.audio = p.audio.filter(a => a.id !== sel.id);
  }); LAB.sel = null; labPaintAll(); labSeek(Math.min(LAB.t, ltl().total));
}

// ---------- التصدير ----------
async function labExport() {
  if (!LAB.p.seq.length) { toast("أضف مقطعاً إلى التسلسل أوّلاً"); return; }
  labPause(); await api.call("lab:save", LAB.p); labProg(.01, "بدء التصدير…");
  try { const r = await api.call("lab:export", LAB.p.id, LAB.p.name); toast("تمّ التصدير: " + lfmt(r.duration), 6000); labProg(1); api.call("lab:openOut"); }
  catch (e) { labProg(1); toast(e.message, 9000); }
}
