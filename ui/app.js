// «المجالس» — واجهة غرفة التحكّم (مصمّمة لغير التقنيّين: أزرار كبيرة وأيقونات واضحة)
const $ = id => document.getElementById(id);
const api = window.minbar;
const AR = s => String(s ?? "").replace(/[0-9]/g, d => "0123456789"[d]);
const TH = window.MINBAR_THEMES;
let ST = null, META = null, CATALOG = null, LIB = [];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function toast(t, ms = 2600) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), ms); }
// داخل معمل المجالس (LABSB) تذهب التعديلات إلى «صندوق» المشروع لا إلى إعدادات البثّ الحيّة
const stateGet = () => window.LABSB ? api.call("lab:sbx:state", LABSB.pid) : api.call("state:get");
const patch = async p => { if (window.LABSB) { ST.settings = await api.call("lab:sbx:patch", LABSB.pid, p); if (LABSB.changed) LABSB.changed(); return ST.settings; } ST.settings = await api.call("settings:patch", p); return ST.settings; };
const S = () => ST.settings;
const icons = (root = document) => root.querySelectorAll("[data-i]").forEach(e => { if (!e.firstChild) e.innerHTML = (ICON(e.dataset.i).match(/<svg[\s\S]*<\/svg>/) || [""])[0]; });
if (navigator.platform.startsWith("Mac")) document.body.classList.add("mac");
icons();

// ---------- البداية ----------
async function init() {
  ST = await stateGet();
  if (typeof applyUiTheme === "function") applyUiTheme(S().uiTheme || "green");
  $("bookOnly").checked = !!S().design.hideSpeaker;
  renderScenes(); renderTabs(); renderTexts(); renderDesign(); renderLogos(); renderLive(); renderFraming(); renderCam2();
  await refreshLib(); await loadMeta();
  engineState(ST.engine === "ready" ? { state: "ready" } : { state: "starting" });
  setScene(ST.program); outputs(ST.outputs); chaptersOut(ST.chapters); if (ST.cams) camUI(ST.cams);
  initLayout(); initAutoFrame(); initBookSearch(); initPhone(); initCaptions(); initReels(); initHub(); initModes();           // أوّل ما يظهر: اختيار الحلقة أو إنشاء حلقة
}
// ---------- المحرّك والمعاينة ----------
function engineState(st) {
  const e = $("eng"), m = $("previewMsg");
  const map = { ready: ["جاهز", "ok"], starting: ["يشتغل…", ""], disconnected: ["يعيد الاتّصال…", "bad"], stopped: ["متوقّف", "bad"], missing: ["يحتاج تثبيت", "bad"], error: ["خطأ", "bad"] };
  const [t, c] = map[st.state] || [st.state, ""];
  e.textContent = "● " + t; e.className = "pill " + c;
  if (st.state === "ready") { m.textContent = ""; loadDevices(); }
  else if (st.state === "missing") {
    // ماك: نزّل نسخة OBS المناسبة لمعالج الجهاز مباشرة (آبل أو إنتل)
    const url = ST && ST.platform === "darwin"
      ? `https://github.com/obsproject/obs-studio/releases/download/33.0.1/OBS-Studio-33.0.1-macOS-${ST.arch === "arm64" ? "Apple" : "Intel"}.dmg`
      : "https://obsproject.com/download";
    m.innerHTML = `خطوة وحدة قبل أوّل استخدام: تثبيت محرّك البثّ المجّانيّ <b>OBS Studio</b>.<br>
      1) اضغط الزرّ ← 2) افتح الملفّ واسحب OBS إلى «التطبيقات» ← 3) أغلق البرنامج وافتحه من جديد.<br>
      <small>ما تحتاج تفتح OBS أبداً — البرنامج يشغّله بنفسه بالخلفيّة.</small><br><br>
      <button class="pri" onclick="api.call('open:external','${url}')">تحميل المحرّك</button>`;
  }
  else if (st.state === "stopped") m.innerHTML = `توقّف المحرّك.<br><br><button class="pri" onclick="api.call('engine:restart')">أعد تشغيله</button>`;
  else if (!$("preview").src) m.textContent = "جارٍ التشغيل…";
}
api.on("engine", engineState);
api.on("preview", d => { $("preview").src = d; });
api.on("busy", t => { $("busy").hidden = !t; $("busy").textContent = t || ""; });
api.on("toast", toast);

// ---------- المشاهد ----------
function breakToggleBtn() {
  let b = $("breakToggle");
  if (!b) { b = document.createElement("button"); b.id = "breakToggle"; b.className = "mid"; b.style.cssText = "font-size:12.5px;padding:5px 12px;min-height:0"; $("camBar").appendChild(b); }
  const on = S().breakOn !== false;
  b.textContent = on ? "الاستراحة: مفعّلة — اضغط لإغلاقها" : "الاستراحة: مغلقة — اضغط لتفعيلها";
  b.classList.toggle("on", on);
  b.onclick = async () => { await patch({ breakOn: !on }); renderScenes(); if (typeof renderScreens === "function") renderScreens(); };
}
function renderScenes() {
  const g = $("scenes"); g.innerHTML = ""; breakToggleBtn();
  const vis = visibleScenes();                       // بحسب القسم: الدروس تعرض كل المشاهد، والخطب والمحاضرات مشاهد المتحدّث والجمهور
  g.style.setProperty("--n", Math.max(8, vis.length));
  vis.forEach((s, i) => {
    const b = document.createElement("button"); b.dataset.name = s.name;
    b.innerHTML = `${ICON("sc_" + (s.icon || "person"))}<span>${s.label}</span><kbd>${AR(i + 1)}</kbd>`;
    b.onclick = () => { setScene(s.name); api.call("scene:set", s.name).catch(e => toast(e.message)); };
    g.appendChild(b);
  });
}
function setScene(n) { ST.program = n; document.querySelectorAll("#scenes button").forEach(b => b.classList.toggle("on", b.dataset.name === n)); }
api.on("scene", setScene);

// ---------- الكاميرا ----------
api.on("cams", c => { ST.cams = c; camUI(c); cam2State(); });
function camUI(c) {
  const live = c.live || {}, el = $("camState");
  el.classList.toggle("on", !!live.sheikh);
  el.querySelector(".tx").textContent = live.sheikh ? (S().design.hideSpeaker ? "الكاميرا شغّالة — والشيخ مخفي" : "الكاميرا شغّالة") : "ما فيه كاميرا — المشاهد مرتّبة بدونها";
}
$("bookOnly").onchange = e => patch({ design: { hideSpeaker: e.target.checked } }).then(() => toast(e.target.checked ? "الكتاب فقط — الشيخ مخفي" : "الشيخ ظاهر"));

// ---------- البثّ والتسجيل ----------
let OUT = {};
function outputs(o) {
  OUT = o || {};
  $("btnLive").classList.toggle("on", !!OUT.stream); $("btnRec").classList.toggle("on", !!OUT.rec);
  $("onair").hidden = !OUT.stream;
  $("btnRec").querySelector("[data-i]").innerHTML = ""; $("btnRec").querySelector("[data-i]").dataset.i = OUT.rec ? "stop" : "rec"; icons($("btnRec"));
}
api.on("outputs", outputs);
const clock = t0 => { const s = Math.max(0, Math.floor((Date.now() - t0) / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
setInterval(() => {
  $("btnLive").querySelector(".lb").textContent = OUT.stream ? AR(clock(OUT.streamT0 || OUT.t0)) : "";
  $("btnRec").querySelector(".lb").textContent = OUT.rec ? AR(clock(OUT.recT0 || OUT.t0)) : "";
}, 500);
$("btnLive").onclick = () => {
  if (OUT.stream && !confirm("إيقاف البثّ المباشر؟")) return;
  api.call("output:stream").then(r => { if (Array.isArray(r)) toast("بدأ البثّ على: " + r.map(k => PLAT[k].n).join(" + "), 3500); }).catch(e => toast(e.message, 4500));
};
$("btnRec").onclick = () => api.call("output:record").then(() => toast(OUT.rec ? "أُوقف التسجيل وحُفظ" : "بدأ التسجيل")).catch(e => toast(e.message));

// ---------- الكتاب ----------
const BS = () => S().bookState;
async function loadMeta() {
  META = S().book ? await api.call("book:meta", S().book.id) : null;
  $("bkName").textContent = META ? META.title : "لا يوجد كتاب — اختر من «الكتب»";
  await bnPrepare().catch(() => {});
  bookUI(); renderCurBook(); renderReadingCfg();
  if (META) book({}).catch(() => {});                  // يهيّئ أسطر الصفحة ومقطع «سطور الكتاب» في الحالة
}
function chapterOf(p) { let c = null; for (const t of (META && META.toc) || []) if (t.page <= p && t.level <= 3) c = t; return c; }
function bookUI() {
  const b = BS();
  $("pNum").innerHTML = META ? bnNumHTML(b.page) : "—";
  const c = chapterOf(b.page); $("bkChap").textContent = c ? clipText(cleanTitle(c.title), 70) : "";
  $("bFocus").classList.toggle("on", !!b.focus); $("bBand").classList.toggle("on", b.band != null);
  $("zoomGrp").hidden = !b.focus; $("zLbl").textContent = AR(Math.round((b.zoom || 1) * 100)) + "٪";
  bnSideState();
}
// الطلبات تُنفَّذ بالتتابع (حساب الأسطر غير متزامن) فلا تتداخل ضغطات متتالية
let bookQ = Promise.resolve();
const bookSeq = fn => { const r = bookQ.then(fn); bookQ = r.catch(() => {}); return r; };
function book(n) { return bookSeq(() => bookDo(n)); }
async function bookDo(n) {
  const prev = BS(), b = Object.assign({}, prev, n);
  if (META) b.page = Math.max(1, Math.min(META.pages || 1, b.page));
  if (b.page !== prev.page && n.ln == null) b.ln = 0;
  await bnDecorate(b);
  S().bookState = b; bookUI();
  await api.call("book:state", b);
}
const twoPages = () => /مفتوح|الكتاب \+/.test(ST.program || "") && !BS().focus;
function page(d) { if (curMode() === "quran") return quranStep(d); return bookSeq(() => { const b = BS(); return bookDo({ page: b.page + d * (twoPages() ? 2 : 1), ln: 0 }); }); }
// سطر واحد (أو بعدد أسطر المشهد): من أسطر الصفحة الفعليّة؛ ينتقل للصفحة التالية/السابقة عند الحدّ
function line(d) { if (curMode() === "quran") return; return bookSeq(() => lineDo(d)); }
async function lineDo(d) {
  if (!META) return;
  const b = BS(), lines = await getLines(b.page);
  if (!lines.length) {                                            // صفحة بلا أسطر معروفة (صورة/فارغة): الخطوة التقريبيّة القديمة
    const o = Object.assign({}, b); if (o.band == null) o.band = .08;
    o.band = +(o.band + d * o.step).toFixed(4);
    if (o.band > .93) { o.page += 1; o.band = .08; } else if (o.band < .03) { if (o.page > 1) { o.page -= 1; o.band = .86; } else o.band = .03; }
    return bookDo(o);
  }
  const R = readingCfg(), k = R.step === "all" && inReadingScene() ? R.lines : 1;
  let ln = (b.ln ?? 0) + d * k, pg = b.page;
  if (ln >= lines.length) { if (pg < META.pages) { pg++; ln = 0; } else ln = lines.length - 1; }
  else if (ln < 0) { if (pg > 1) { pg--; const pl = await getLines(pg); ln = Math.max(0, pl.length - k); } else ln = 0; }
  return bookDo({ page: pg, ln, band: b.band == null ? .1 : b.band });
}
$("pPrev").onclick = () => page(-1); $("pNext").onclick = () => page(1);
$("bUp").onclick = () => line(-1); $("bDown").onclick = () => line(1);
$("bBand").onclick = () => book({ band: BS().band == null ? .1 : null });
$("bFocus").onclick = () => book({ focus: !BS().focus, band: BS().band == null ? .1 : BS().band });
// تكبير/تصغير بخطوات ثابتة دقيقة (يعمل على صفحات الشاملة وصور PDF معاً)
const ZSTEPS = [.5, .6, .7, .8, .9, 1, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.2];
function zoomBy(d) { return bookSeq(() => { const z = BS().zoom || 1; let i = ZSTEPS.findIndex(v => v >= z - .001); if (i < 0) i = ZSTEPS.length - 1; i = Math.max(0, Math.min(ZSTEPS.length - 1, i + d)); return bookDo({ focus: true, zoom: ZSTEPS[i], band: BS().band == null ? .1 : BS().band }); }); }
$("bZoomIn").onclick = () => zoomBy(1); $("bZoomOut").onclick = () => zoomBy(-1);
$("zLbl").onclick = () => book({ zoom: 1 });
$("bToc").onclick = () => { if (!META) return toast("اختر كتاباً أوّلاً"); bnToc(); };
$("pGo").onclick = goPageInput; $("pGoto").onkeydown = e => { if (e.key === "Enter") goPageInput(); e.stopPropagation(); };
// أزرار جانبَي الشاشة المكبَّرة
[["snPrev", () => page(-1)], ["snNext", () => page(1)], ["snUpR", () => line(-1)], ["snUpL", () => line(-1)], ["snDownR", () => line(1)], ["snDownL", () => line(1)]].forEach(([id, fn]) => { const e = $(id); if (e) e.onclick = fn; });
addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (!$("libView").hidden) { if (e.key === "Escape") closeLib(); return; }
  const k = e.key;
  if (k === "ArrowLeft") page(1); else if (k === "ArrowRight") page(-1);
  else if (k === "ArrowDown") line(1); else if (k === "ArrowUp") line(-1);
  else if (k === "f" || k === "F") $("bFocus").click(); else if (k === "b" || k === "B") $("bBand").click();
  else if (k === "+" || k === "=") zoomBy(1); else if (k === "-" || k === "_") zoomBy(-1);
  else if (k === "g" || k === "G") { $("pGoto").focus(); }
  else if (/^[1-9]$/.test(k)) { const s = visibleScenes()[+k - 1]; if (s) api.call("scene:set", s.name).catch(e => toast(e.message)); }
  else return;
  e.preventDefault();
});

// ---------- التبويبات ----------
function renderTabs() {
  document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "t-" + b.dataset.t));
    if (b.dataset.t === "dev") loadDevices();
    if (b.dataset.t === "halaqa") { renderScreens(); renderLogos(); }
    if (b.dataset.t === "podcast") renderPodcast();
    if (b.dataset.t === "quran") renderQuran();
  });
}

// ---------- أغلفة الكتب (تُرسم بالـCSS بنقش وألوان) ----------
const COVERS = ["#123A30", "#14284A", "#4A1622", "#0E3B46", "#4A3720", "#2B2240", "#1F2A2E", "#3A2A12"];
const ACC = ["#D1AA62", "#D9B46E", "#E2C07A", "#7FD1C4", "#EDD3A0", "#D9B46E", "#C9A15A", "#E8C989"];
function cover(b, { badge } = {}) {
  const n = Math.abs(String(b.id).split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), i = n % COVERS.length;
  const pat = ["khatam", "zellige", "sudasi", "muayyan"][n % 4];
  const [pw, ph] = TH.patternSize(pat, .45);
  const title = String(b.title || "").split(" - ")[0];
  return `<div class="cover" style='color:${ACC[i]};background:${TH.patternURI(pat, ACC[i], .28, .45)} 0 0/${pw}px ${ph}px, radial-gradient(120% 90% at 50% 30%, ${TH.mix(COVERS[i], "#fff", .12)}, ${COVERS[i]} 70%)'>
    ${badge ? `<span class="bdg">${badge}</span>` : ""}<div class="ct">${esc(title)}</div><div class="orn"></div><div class="ca">${esc(b.author || "")}</div></div>`;
}

// ---------- الكتب (التبويب) ----------
async function refreshLib() { LIB = await api.call("lib:list"); renderShelf(); }
function renderCurBook() {
  const box = $("curBook");
  if (!META) { box.innerHTML = `<div class="cur"><div class="tx"><span class="lbl">الكتاب المعروض</span><b>لم تختر كتاباً بعد</b><small>تصفّح المكتبة واختر كتاب الدرس</small></div></div>`; return; }
  box.innerHTML = `<div class="cur"><div style="width:70px;flex:none;font-size:9px">${cover(META)}</div><div class="tx"><span class="lbl">الكتاب المعروض الآن</span><b>${esc(META.title)}</b><small>${esc(META.source || "")} · ${AR(META.pages)} صفحة</small></div></div>`;
}
function renderShelf() {
  const box = $("myBooks"), cur = S().book && S().book.id;
  box.innerHTML = LIB.length ? "" : `<p class="hint" style="grid-column:1/-1">ما فيه كتب بعد. اضغط «تصفّح المكتبة الشاملة».</p>`;
  LIB.forEach(b => {
    const d = document.createElement("div"); d.className = "bk"; d.title = b.title;
    d.innerHTML = `<div style="font-size:11px">${cover(b, { badge: b.id === cur ? "معروض" : (!b.ready ? "غير مكتمل" : "") })}</div><div class="cap">${esc(b.title.split(" - ")[0])}</div>`;
    const del = document.createElement("button"); del.className = "del"; del.innerHTML = ICON("trash"); del.title = "حذف";
    del.onclick = async ev => { ev.stopPropagation(); if (!confirm("حذف الكتاب من جهازك؟")) return; await api.call("lib:remove", b.id); ST = await stateGet(); await refreshLib(); await loadMeta(); };
    const edt = document.createElement("button"); edt.className = "del edt"; edt.textContent = "✎"; edt.title = "تعديل اسم الكتاب والمؤلّف";
    edt.onclick = async ev => { ev.stopPropagation(); const f = await askForm("تعديل الكتاب", [{ k: "title", label: "اسم الكتاب", val: b.title }, { k: "author", label: "المؤلّف", val: b.author }]); if (!f || !f.title) return; await api.call("lib:update", b.id, f); ST = await stateGet(); await refreshLib(); await loadMeta(); renderTexts(); toast("حُفظ التعديل"); };
    d.appendChild(edt); d.appendChild(del);
    d.onclick = () => useBook(b.id);
    box.appendChild(d);
  });
}
async function useBook(id) {
  const b = LIB.find(x => x.id === id);
  if (b && !b.ready) { const m = await api.call("book:meta", id); return convertPdf(m); }
  await api.call("book:select", id); ST = await stateGet(); await loadMeta(); renderShelf(); renderTexts();
  toast("الكتاب الآن في البثّ ✓"); closeLib();
}
$("pdfPick").onclick = async () => { const m = await api.call("lib:importPdf"); if (m) { await refreshLib(); convertPdf(m); } };
$("openLib").onclick = () => openLib("shamela");
$("openArchive").onclick = () => openLib("archive");

// مهامّ التحميل (شريط في التبويب وفي بطاقة الكتاب)
let JOB = null;
function jobUI(t, frac) {
  for (const id of ["job", "shJob"]) { const e = $(id); e.hidden = !t; if (t) { e.querySelector(".jt").textContent = t; e.querySelector(".bar i").style.width = Math.round((frac || 0) * 100) + "%"; } }
}
async function job(title, fn) {
  if (JOB) { toast("انتظر حتى يكتمل التحميل الحاليّ"); return null; }
  JOB = { title }; jobUI(`${title}: يبدأ…`, 0);
  try { return await fn(); } catch (e) { toast(e.message, 4500); return null; }
  finally { JOB = null; jobUI(null); refreshLib(); }
}
api.on("lib:progress", p => { if (JOB) jobUI(`${p.phase}${p.total ? "  " + AR(Math.round(p.got / 1048576)) + " / " + AR(Math.round(p.total / 1048576)) + " م.ب" : ""}`, p.total ? p.got / p.total : .3); });
async function convertPdf(meta) {
  if (!window.renderPdfBook) { toast("لحظة… المحوّل يجهز"); return; }
  const ok = await job(meta.title, async () => {
    const info = await window.renderPdfBook(meta, (n, total, label) => jobUI(`تجهيز الصفحات ${AR(n)} من ${AR(total)}${label ? " · " + label : ""}`, n / total));
    await api.call("lib:finishPdf", meta.id, info); return true;
  });
  if (ok) { await refreshLib(); await useBook(meta.id); }
}

// ---------- المكتبة: تصفّح مثل نتفليكس ----------
const norm = s => String(s || "").replace(/[ً-ْـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").toLowerCase();
const MUTUN = ["زاد المستقنع", "عمدة الفقه", "دليل الطالب", "منهج السالكين", "الأصول الثلاثة", "كتاب التوحيد", "كشف الشبهات", "القواعد الأربع", "العقيدة الواسطية", "العقيدة الطحاوية",
  "الأربعين النووية", "عمدة الأحكام", "بلوغ المرام", "رياض الصالحين", "نخبة الفكر", "البيقونية", "الورقات", "الآجرومية", "ألفية ابن مالك", "قطر الندى", "تحفة الأطفال", "المقدمة الجزرية", "الرحبية", "آداب المشي إلى الصلاة"];
let LV = { src: "shamela" };
async function catalog() {
  if (CATALOG) return CATALOG;
  CATALOG = await api.call("lib:catalog");
  CATALOG.idx = CATALOG.books.map(b => norm(b[1] + " " + b[2]));
  CATALOG.byId = new Map(CATALOG.books.map(b => [b[0], b]));
  return CATALOG;
}
const asBook = b => ({ id: "c" + b[0], sid: b[0], title: b[1], author: b[2], cat: b[3], pdf: !!b[4], pages: b[5] });
function card(b, onClick) {
  const d = document.createElement("div"); d.className = "bk";
  d.innerHTML = `${cover(b, { badge: b.pdf ? "مصوّر" : "" })}<div class="cap">${esc(b.title.split(" - ")[0])}</div>`;
  d.onclick = () => onClick(b);
  return d;
}
function row(title, sub, books, onClick) {
  const r = document.createElement("div"); r.className = "row";
  r.innerHTML = `<h4>${esc(title)} <small>${sub || ""}</small></h4>`;
  const st = document.createElement("div"); st.className = "strip"; r.appendChild(st);
  books.forEach(b => st.appendChild(card(b, onClick)));
  return r;
}
async function openLib(src = "shamela") {
  $("libView").hidden = false; $("sheet").hidden = true; LV.src = src;
  document.querySelectorAll("#lvSrc button").forEach(b => b.classList.toggle("on", b.dataset.s === src));
  $("lvQ").value = ""; $("lvQ").placeholder = src === "shamela" ? "ابحث في 8500 كتاب بالاسم أو المؤلّف…" : "ابحث في أرشيف الإنترنت ثمّ اضغط Enter…";
  setTimeout(() => $("lvQ").focus(), 50);
  if (src === "shamela") browseHome(); else $("lvBody").innerHTML = `<div class="lv-empty">اكتب اسم الكتاب واضغط Enter — النتائج كتب مصوّرة (PDF) من أرشيف الإنترنت.</div>`;
}
function closeLib() { $("libView").hidden = true; }
$("lvClose").onclick = closeLib;
document.querySelectorAll("#lvSrc button").forEach(b => b.onclick = () => openLib(b.dataset.s));
async function browseHome() {
  const body = $("lvBody"); body.innerHTML = `<div class="lv-empty">جارٍ فتح المكتبة الشاملة…</div>`;
  try { await catalog(); } catch (e) { body.innerHTML = `<div class="lv-empty">تعذّر الوصول للمكتبة — تأكّد من الإنترنت.<br><small>${esc(e.message)}</small></div>`; return; }
  body.innerHTML = "";
  if (LIB.length) body.appendChild(row("كتبي", "على جهازك", LIB.map(b => Object.assign({}, b, { mine: true })), b => useBook(b.id)));
  // متون طالب العلم: أقرب كتاب لكل اسم
  const mutun = [];
  for (const m of MUTUN) {
    // نفضّل المتن نفسه (يبدأ باسمه) على شروحه وحواشيه، ثمّ الأقصر
    const q = norm(m); let best = null, bs = 1e9;
    CATALOG.books.forEach((b, i) => {
      const n = norm(b[1]); if (!n.includes(q)) return;
      const sc = (n.startsWith(q) ? 0 : 1000) + (/^(شرح|حاشيه|تعليق|التعليق|الشرح)/.test(n) ? 500 : 0) + b[1].length;
      if (sc < bs) { bs = sc; best = b; }
    });
    if (best && !mutun.includes(best)) mutun.push(best);
  }
  body.appendChild(row("متون طالب العلم", "الأكثر طلباً للدروس", mutun.map(asBook), openSheet));
  body.appendChild(row("كتب مصوّرة", "بصفحات الطبعة الحقيقيّة", CATALOG.books.filter(b => b[4]).slice(0, 40).map(asBook), openSheet));
  // صفّ لكل قسم، يُرسم عند الوصول إليه
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || e.target.dataset.done) return; e.target.dataset.done = 1; io.unobserve(e.target);
    const c = +e.target.dataset.cat, list = CATALOG.books.filter(b => b[3] === c).sort((a, b) => b[4] - a[4]).slice(0, 30).map(asBook);
    e.target.replaceWith(row(e.target.dataset.name, AR(CATALOG.books.filter(b => b[3] === c).length) + " كتاباً", list, openSheet));
  }), { root: body, rootMargin: "400px" });
  CATALOG.cats.forEach(c => { const ph = document.createElement("div"); ph.className = "row"; ph.style.height = "300px"; ph.dataset.cat = c.id; ph.dataset.name = c.name; body.appendChild(ph); io.observe(ph); });
}
let qT = null;
$("lvQ").oninput = () => { if (LV.src !== "shamela") return; clearTimeout(qT); qT = setTimeout(searchShamela, 220); };
$("lvQ").onkeydown = e => { if (e.key === "Enter" && LV.src === "archive") searchArchive(); if (e.key === "Escape") closeLib(); };
async function searchShamela() {
  const q = norm($("lvQ").value.trim()); if (!q) return browseHome();
  await catalog();
  const words = q.split(/\s+/), res = [];
  for (let i = 0; i < CATALOG.books.length && res.length < 150; i++) if (words.every(w => CATALOG.idx[i].includes(w))) res.push(CATALOG.books[i]);
  res.sort((a, b) => a[1].length - b[1].length);
  const body = $("lvBody"); body.innerHTML = res.length ? `<div class="row"><h4>نتائج البحث <small>${AR(res.length)}${res.length >= 150 ? "+" : ""}</small></h4></div>` : `<div class="lv-empty">ما لقيت كتاباً بهذا الاسم.</div>`;
  const g = document.createElement("div"); g.className = "grid"; res.forEach(b => g.appendChild(card(asBook(b), openSheet))); body.appendChild(g);
}
async function searchArchive() {
  const q = $("lvQ").value.trim(); if (!q) return;
  const body = $("lvBody"); body.innerHTML = `<div class="lv-empty">جارٍ البحث في أرشيف الإنترنت…</div>`;
  try {
    const r = await api.call("lib:archiveSearch", q);
    body.innerHTML = r.length ? "" : `<div class="lv-empty">ما لقيت نتائج.</div>`;
    const g = document.createElement("div"); g.className = "grid";
    r.forEach(x => g.appendChild(card({ id: "ia" + x.id, ia: x.id, title: x.title, author: x.creator, pdf: true }, openSheet)));
    body.appendChild(g);
  } catch (e) { body.innerHTML = `<div class="lv-empty">تعذّر البحث: ${esc(e.message)}</div>`; }
}
// بطاقة الكتاب
async function openSheet(b) {
  $("sheet").hidden = false;
  $("sheet").querySelector(".sh-cover").innerHTML = cover(b, { badge: b.pdf ? "مصوّر" : "" });
  $("shTitle").textContent = b.title; $("shAuthor").textContent = b.author || "";
  $("shMeta").textContent = b.pages ? AR(b.pages) + " صفحة" : ""; $("shDesc").textContent = "";
  const btns = $("shBtns"); btns.innerHTML = "";
  const btn = (html, cls, fn) => { const x = document.createElement("button"); x.innerHTML = html; if (cls) x.className = cls; x.onclick = fn; btns.appendChild(x); return x; };
  if (b.ia) {
    btn(`تحميل الكتاب وعرضه في البثّ`, "pri", () => archiveGet(b));
    return;
  }
  const have = id => LIB.find(x => x.id === id && x.ready);
  if (have("shp-" + b.sid)) btn(`اعرضه الآن <small>(الصفحات المصوّرة)</small>`, "pri", () => useBook("shp-" + b.sid));
  if (have("sh-" + b.sid)) btn(`اعرضه الآن <small>(النصّ المرتّب)</small>`, have("shp-" + b.sid) ? "" : "pri", () => useBook("sh-" + b.sid));
  if (b.pdf && !have("shp-" + b.sid)) btn(`اعرض صفحات الطبعة المصوّرة <small>— شكل الكتاب الحقيقيّ</small>`, "pri", async () => {
    const m = await job(b.title, () => api.call("lib:shamelaPdf", b.sid)); if (m) convertPdf(m);
  });
  if (!have("sh-" + b.sid)) btn(`اعرضه كنصّ مرتّب <small>— صفحات واضحة بترقيم المطبوع</small>`, b.pdf ? "" : "pri", async () => {
    const m = await job(b.title, () => api.call("lib:shamelaText", b.sid)); if (m) { await refreshLib(); useBook(m.id); }
  });
  try { const info = await api.call("lib:shamelaInfo", b.sid); $("shDesc").textContent = String(info.info || "").split("\n").filter(l => !/^\[|ترقيم/.test(l)).slice(0, 8).join("\n"); } catch {}
}
async function archiveGet(b) {
  const f = await api.call("lib:archiveFiles", b.ia).catch(e => { toast(e.message); return null; });
  if (!f || !f.files.length) { toast("ما فيه ملفّ PDF في هذا العنصر"); return; }
  let files = f.files.filter(z => !/_text\.pdf$|_bw\.pdf$/i.test(z.name)); if (!files.length) files = f.files;
  const mb = Math.round(files.reduce((a, z) => a + z.size, 0) / 1048576);
  if (!confirm(`تحميل ${AR(files.length)} ملفّ (${AR(mb)} ميغا)؟`)) return;
  const m = await job(b.title, () => api.call("lib:archivePdf", b.ia, files.map(z => z.name), f.title || b.title, f.creator || b.author));
  if (m) convertPdf(m);
}
$("shClose").onclick = () => { $("sheet").hidden = true; };
$("sheet").onclick = e => { if (e.target.id === "sheet") $("sheet").hidden = true; };
window.toast = toast;

// ---------- بيانات الدرس: أقسام تنطوي، الأساسيّ مفتوح ----------
const SECTIONS = [
  { g: "b", t: "الشيخ", open: true, f: [["sheikh-title", "اللقب", "فضيلة الشيخ / الأستاذ"], ["sheikh", "الاسم", "اسم الشيخ"], ["sheikh-post", "الصفة أو المنصب (اختياريّ)", "مثال: أستاذ الحديث بجامعة…", 1]] },
  { g: "h", t: "الحلقة", open: true, f: [["halaqa", "اسم الحلقة", "يُحفظ للحلقة المختارة", 1], ["mosque", "المسجد / المكان", "اسم المسجد", 1]] },
  { g: "b", t: "الدورة والكتاب", open: true, f: [["program", "اسم الدورة", "$1", 1], ["book", "اسم الكتاب", "", 1]] },
  { g: "l", t: "المجلس", open: true, f: [["scope", "الباب", "كتاب الطهارة"], ["session", "رقم المجلس", "المجلس الأوّل"]] },
  { g: "l", t: "الوقت والختام", open: true, f: [["start", "وقت البداية", ""], ["break-min", "الاستراحة (دقائق)", "10"], ["next", "جملة الختام", "موعدنا القادم بإذن الله", 1]] },
];
function renderTexts() {
  if (typeof inLessons === "function" && !inLessons()) { ["hForm", "bForm"].forEach(i => { const x = $(i); if (x) x.innerHTML = ""; }); return renderModeForm(); }
  const hosts = { h: $("hForm"), b: $("bForm"), l: $("textForm") }; Object.values(hosts).forEach(x => { if (x) x.innerHTML = ""; });
  SECTIONS.forEach(sec => {
    const f = hosts[sec.g || "l"];
    const d = document.createElement("details"); d.className = "acc"; if (sec.open) d.open = true;
    const sum = () => sec.f.map(([k]) => S().texts[k]).filter(Boolean).join(" · ");
    d.innerHTML = `<summary><span>${sec.t}</span><span class="sum"></span></summary><div class="in"></div>`;
    const sm = d.querySelector(".sum"); sm.textContent = sec.open ? "" : sum();
    d.ontoggle = () => { sm.textContent = d.open ? "" : sum(); };
    sec.f.forEach(([k, label, ph, full]) => {
      const l = document.createElement("label"); if (full) l.className = "full"; l.textContent = label;
      const inp = document.createElement("input"); inp.value = S().texts[k] || ""; inp.placeholder = ph || "";
      if (k === "start") inp.type = "time"; if (k === "break-min") inp.inputMode = "numeric";
      let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => patch({ texts: { [k]: inp.value } }), 250); };
      l.appendChild(inp); d.querySelector(".in").appendChild(l);
    });
    f.appendChild(d);
  });
}

// ---------- الشكل ----------
// مشهد «الشيخ + الحضور»: النمط (متداخلان / داخل بعض / متجاوران)، من الكبير، جهته، وحجم الصغير
function renderDuo() {
  const d = S().duo || {}, set = o => patch({ duo: o });
  const art = (...r) => '<svg viewBox="0 0 48 30" width="48" height="30" fill="none" stroke="currentColor" stroke-width="1.6">' + r.map(([x, y, w, h]) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3"/>').join("") + '</svg>';
  cards("duoMode", "", [{ v: "overlap", t: "متداخلان", art: art([16, 3, 30, 22], [3, 12, 20, 15]) }, { v: "inset", t: "داخل بعض", art: art([4, 3, 40, 24], [27, 15, 14, 10]) }, { v: "side", t: "متجاوران", art: art([3, 4, 20, 22], [25, 4, 20, 22]) }], d.mode || "overlap", v => set({ mode: v }));
  cards("duoBig", "", [{ v: "sheikh", t: "الشيخ" }, { v: "cam2", t: "الحضور" }], d.big || "sheikh", v => set({ big: v }));
  cards("duoSide", "", [{ v: "right", t: "يمين" }, { v: "left", t: "يسار" }], d.side || "right", v => set({ side: v }));
  const r = $("duoSmall"); r.value = d.small || 1;
  let t; r.oninput = () => { clearTimeout(t); t = setTimeout(() => set({ small: +r.value }), 350); };
}
function cards(id, key, opts, cur, onPick) {
  const box = $(id); box.innerHTML = "";
  opts.forEach(o => {
    const b = document.createElement("button"); b.className = "opt" + (cur === o.v ? " on" : "");
    b.innerHTML = `${o.art || ""}<span>${o.t}</span>${o.s ? `<small>${o.s}</small>` : ""}`;
    b.onclick = () => (onPick ? onPick(o.v) : patch({ design: { [key]: o.v } })).then(renderDesign);
    box.appendChild(b);
  });
}
const mini = (bg, inner) => `<div class="mini" style="background:${bg}">${inner}</div>`;
const shapeSVG = p => `<svg class="shape" viewBox="0 0 34 42"><path d="${p}" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2"/></svg>`;
// الخطّ المختار يُطبَّق على واجهة البرنامج نفسها وعلى البثّ معاً
function applyUiFont(k) { const F = TH.fontOf(k), r = document.documentElement.style; r.setProperty("--f", F.fs + ",system-ui,sans-serif"); r.setProperty("--fd", F.fa); }
function renderDesign() {
  applyUiFont(S().design.font);
  const d = S().design, t = TH.theme(d.theme, d.custom), sw = $("themes"); sw.innerHTML = "";
  [...Object.keys(TH.BASE), "custom"].forEach(k => {
    const x = TH.theme(k, d.custom || { bg: "#20303A", accent: "#D8B36A" });
    const e = document.createElement("div"); e.className = "sw" + (d.theme === k ? " on" : "");
    const [pw, ph] = TH.patternSize(d.pattern || "khatam", .5);
    e.style.background = `${TH.patternURI(d.pattern || "khatam", x.accent, .3, .5)} 0 0/${pw}px ${ph}px, linear-gradient(160deg, ${x.hi}, ${x.deep})`;
    e.style.color = x.light ? x.fg : x.accentHi; e.textContent = k === "custom" ? "ألوان جهتك" : x.name;
    e.onclick = () => patch({ design: { theme: k, custom: k === "custom" ? (d.custom || { bg: "#20303A", accent: "#D8B36A" }) : d.custom } }).then(renderDesign);
    sw.appendChild(e);
  });
  $("customColors").hidden = d.theme !== "custom";
  if (d.custom) { $("cBg").value = d.custom.bg; $("cAc").value = d.custom.accent; }
  const tl = $("patterns"); tl.innerHTML = "";
  Object.entries(TH.PATTERNS).forEach(([k, p]) => {
    const e = document.createElement("div"); e.className = "tile" + ((d.pattern || "khatam") === k ? " on" : "");
    const [pw, ph] = TH.patternSize(k, .55);
    e.style.background = `${TH.patternURI(k, t.accent, .55, .55)} 0 0/${pw}px ${ph}px, ${t.bg}`;
    e.style.color = t.light ? t.fg : "#fff"; e.textContent = p.name;
    e.onclick = () => patch({ design: { pattern: k } }).then(renderDesign);
    tl.appendChild(e);
  });
  const g = c => mini("#3B4A44", `<div style="position:absolute;inset:0;background:linear-gradient(0deg,${c} 0%,${c}00 75%)"></div><div style="position:absolute;right:6px;bottom:6px;width:30px;height:4px;background:#fff;border-radius:2px"></div><div style="position:absolute;right:6px;bottom:13px;width:18px;height:3px;background:${t.accent};border-radius:2px"></div>`);
  cards("fontSeg", "font", Object.entries(TH.FONTS).map(([k, f]) => ({ v: k, t: f.name, s: f.note,
    art: `<b style="font:700 26px ${f.fa};line-height:1.5;direction:rtl">بسم الله الرحمن الرحيم</b>` })), d.font || "default");
  cards("gradSeg", "grad", [{ v: "black", t: "تدرّج أسود", art: g("#000") }, { v: "theme", t: "تدرّج بلون الهويّة", art: g(t.deep) }], d.grad || "black");
  const TN = { soft: "تلاشٍ هادئ", wipe: "من اليمين لليسار", color: "رسميّ", cut: "بدون انتقال", slide: "تنزلق الصورة", slideup: "من الأسفل", swipe: "سحب جانبيّ", iris: "دائرة تتّسع", curtain: "ستارة تنفتح", barn: "بابان", blinds: "شفرات", clock: "عقارب الساعة", cloud: "سحاب ناعم", water: "سينمائيّ ناعم", dipblack: "سينمائيّ", flash: "سريع وحاد" };
  cards("transSeg", "transition", (ST.transitions || []).map(x => ({ v: x.key, t: x.name, s: TN[x.key] || "" })), d.transition || "soft");
  // الوضع السينمائيّ
  const cin = (bars, vig) => { const bh = bars ? Math.max(0, (38 - 64 / bars) / 2) : 0; return mini("#5B6B64", `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,${Math.min(.8, vig * 1.6)}) 100%)"></div><div style="position:absolute;left:0;right:0;top:0;height:${bh}px;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:${bh}px;background:#000"></div>`); };
  cards("cinemaSeg", "cinema", Object.entries(TH.CINEMA).map(([k, m]) => ({ v: k, t: m.name, s: m.note, art: k === "off" ? "" : cin(m.bars, m.vig) })), d.cinema || "off");
  // سرعة الانتقال: شريط أسّيّ من 3 ثوانٍ (بطيء) إلى 0٫12 ثانية (سريع)
  { const tr = (ST.transitions || []).find(x => x.key === (d.transition || "soft")), def = tr && tr.ms;
    const ms0 = d.transitionMs > 0 ? d.transitionMs : null, sp = $("trSpeed");
    const toS = ms => Math.round(Math.log(Math.max(120, Math.min(3000, ms)) / 3000) / Math.log(.04) * 100), toMs = s => Math.round(3000 * Math.pow(.04, s / 100) / 10) * 10;
    sp.value = ms0 ? toS(ms0) : toS(def || 800);
    $("trLbl").textContent = ms0 ? (ms0 / 1000).toFixed(2) + " ث" : "افتراضيّ";
    if (!sp._b) { sp._b = 1; let tt; sp.oninput = () => { $("trLbl").textContent = (toMs(+sp.value) / 1000).toFixed(2) + " ث"; clearTimeout(tt); tt = setTimeout(() => patch({ design: { transitionMs: toMs(+sp.value) } }), 250); };
      $("trReset").onclick = () => patch({ design: { transitionMs: 0 } }).then(renderDesign); } }
  renderTextStyle();
  $("cinemaK").value = d.cinemaK ?? 100; $("cinemaBars").checked = d.cinemaBars !== false;
  if (!$("cinemaK")._b) { $("cinemaK")._b = 1; let ck; $("cinemaK").oninput = e => { clearTimeout(ck); ck = setTimeout(() => patch({ design: { cinemaK: +e.target.value } }), 200); };
    $("cinemaBars").onchange = e => patch({ design: { cinemaBars: e.target.checked } }); }
  const lay = camLeft => mini(t.bg, `<div style="position:absolute;top:6px;bottom:6px;${camLeft ? "left" : "right"}:6px;width:16px;border:1.5px solid ${t.accent};border-radius:3px"></div><div style="position:absolute;top:6px;bottom:6px;${camLeft ? "right" : "left"}:6px;width:30px;background:#F3EAD3;border-radius:2px"></div>`);
  renderDuo();
  cards("sideSeg", "camSide", [{ v: "right", t: "الشيخ يمين", art: lay(false) }, { v: "left", t: "الشيخ يسار", art: lay(true) }], d.camSide);
  const OLD = { arch: "M2,41V17C2,10 8,4 17,1C26,4 32,10 32,17V41Z", round: "M8,1H26A6,6 0 0 1 32,7V35A6,6 0 0 1 26,41H8A6,6 0 0 1 2,35V7A6,6 0 0 1 8,1Z", oval: "M17,1A15,20 0 1 1 16.9,1Z", rect: "M2,1H32V41H2Z" };
  const shp = k => OLD[k] || "M" + TH.shapePoly(k, 30, 40).map(([x, y]) => (x + 2).toFixed(1) + "," + (y + 1).toFixed(1)).join("L") + "Z";
  $("frameSeg").className = "cards4";
  cards("frameSeg", "frame", Object.entries(TH.SHAPES).map(([k, n]) => ({ v: k, t: n, art: shapeSVG(shp(k)) })), d.frame);
  cards("flipSeg", "flip", [{ v: "rtl", t: "عربيّ", s: "من اليسار لليمين" }, { v: "ltr", t: "معكوس", s: "من اليمين لليسار" }], d.flip || "rtl");
}
// ---------- نمط النصوص (الاسم / الدرس) ----------
let TS_G = "name";
const TS_COLORS = [["theme:deep", "لون الهويّة"], ["theme:accent", "اللون البارز"], ["#000000", "أسود"], ["#FFFFFF", "أبيض"], ["#C9A15A", "ذهبيّ"], ["#0E2F27", "أخضر داكن"]];
const tsGet = () => JSON.parse(JSON.stringify((S().design.textStyle || {})[TS_G] || {}));
const tsAll = st => Object.assign({ name: {}, lesson: {} }, S().design.textStyle, { [TS_G]: st });
function tsSave(st, rerender = true) { return patch({ design: { textStyle: tsAll(st) } }).then(() => rerender ? renderTextStyle() : tsPreview()); }
function tsPreview() {
  const d = S().design, t = TH.theme(d.theme, d.custom), st = tsGet(), box = $("tsPrev");
  box.style.background = `${TH.patternURI(d.pattern || "khatam", t.accent, .22, .6)} 0 0/80px, linear-gradient(150deg, ${t.hi}, ${t.deep})`;
  const pv = document.createElement("div"); pv.className = "pv";
  pv.innerHTML = TS_G === "name"
    ? `<div style="font:500 18px var(--fs);color:${t.accentHi}">فضيلة الشيخ العلّامة</div><div style="font:700 34px var(--fa);color:#fff">اسم الشيخ الكريم</div>`
    : `<div style="font:700 28px var(--fa);color:#fff">شرح كتاب الدورة العلميّة</div><div style="font:500 18px var(--fs);color:${t.accentHi};margin-top:4px">كتاب الطهارة · المجلس الأوّل</div>`;
  Object.assign(pv.style, TH.boxCss(st, t));
  const c = TH.textColor(st, t); if (c) pv.querySelectorAll("div").forEach(x => { x.style.color = c; });
  box.innerHTML = ""; box.appendChild(pv);
}
function tsColors(cur, fn, allowNone, palette) {
  const t = TH.theme(S().design.theme, S().design.custom), w = document.createElement("div"); w.className = "tscols";
  if (allowNone) { const n = document.createElement("button"); n.className = "none" + (!cur ? " on" : ""); n.textContent = "افتراضيّ"; n.onclick = () => fn(""); w.appendChild(n); }
  (palette || TS_COLORS).forEach(([c, n]) => { const b = document.createElement("button"); b.title = n; b.style.background = TH.col(c, t); if (cur === c) b.className = "on"; b.onclick = () => fn(c); w.appendChild(b); });
  const p = document.createElement("input"); p.type = "color"; p.value = /^#[0-9a-f]{6}$/i.test(cur || "") ? cur : "#C9A15A"; p.title = "لون مخصّص"; p.onchange = () => fn(p.value); w.appendChild(p);
  return w;
}
function tsRange(label, min, max, step, val, fmt, fn) {
  const l = document.createElement("label"); l.className = "fld"; l.innerHTML = `${label} <b class="v"></b><input type="range" min="${min}" max="${max}" step="${step}">`;
  const i = l.querySelector("input"), v = l.querySelector(".v"); i.value = val; v.textContent = fmt(val); let tm;
  i.oninput = () => { v.textContent = fmt(+i.value); clearTimeout(tm); tm = setTimeout(() => fn(+i.value), 160); };
  return l;
}
function tsSwitch(text, on, fn) {
  const l = document.createElement("label"); l.className = "switch"; l.innerHTML = `<input type="checkbox" ${on ? "checked" : ""}><i></i><span>${text}</span>`;
  l.querySelector("input").onchange = e => fn(e.target.checked); return l;
}
function renderTextStyle() {
  cards("tsGroup", "", [{ v: "name", t: "الاسم", s: "لقب الشيخ واسمه" }, { v: "lesson", t: "الدرس", s: "الدورة والباب والمجلس" }], TS_G, v => { TS_G = v; return Promise.resolve(); });
  const st = tsGet(), ctl = $("tsCtl"); ctl.innerHTML = ""; ctl.className = "capbox tsctl";
  const sec = () => { const s = document.createElement("div"); s.className = "tssec"; ctl.appendChild(s); return s; };
  const upd = (k, o, rerender = false) => { const cur = tsGet(); cur[k] = Object.assign({}, cur[k], o); return tsSave(cur, rerender); };
  // خلفيّة
  { const s = sec(), bg = st.bg || {};
    s.appendChild(tsSwitch("خلفيّة", !!bg.on, on => upd("bg", { on, color: bg.color || "theme:deep", alpha: bg.alpha ?? .6 }, true)));
    if (bg.on) { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>اللون</span>"; r.appendChild(tsColors(bg.color || "theme:deep", c => upd("bg", { color: c }, true))); s.appendChild(r);
      s.appendChild(tsRange("الشفافيّة", 0.1, 1, .05, bg.alpha ?? .6, v => Math.round(v * 100) + "٪", v => upd("bg", { alpha: v }))); } }
  // إطار
  { const s = sec(), bd = st.border || {};
    s.appendChild(tsSwitch("إطار", !!bd.on, on => upd("border", { on, color: bd.color || "theme:accent", width: bd.width || 2, style: bd.style || "solid" }, true)));
    if (bd.on) { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>اللون</span>"; r.appendChild(tsColors(bd.color || "theme:accent", c => upd("border", { color: c }, true))); s.appendChild(r);
      s.appendChild(tsRange("السماكة", 1, 10, 1, bd.width || 2, v => v + " px", v => upd("border", { width: v })));
      const r2 = document.createElement("div"); r2.className = "tsrow"; r2.innerHTML = "<span>النوع</span>";
      const sel = document.createElement("select"); sel.innerHTML = '<option value="solid">متّصل</option><option value="double">مزدوج</option><option value="dashed">متقطّع</option><option value="dotted">منقّط</option>'; sel.value = bd.style || "solid"; sel.onchange = () => upd("border", { style: sel.value });
      r2.appendChild(sel); s.appendChild(r2); } }
  // ظلّ
  { const s = sec(), sh = st.shadow || {};
    s.appendChild(tsSwitch("ظلّ", !!sh.on, on => upd("shadow", { on, alpha: sh.alpha ?? .55, blur: sh.blur ?? 24, y: sh.y ?? 8 }, true)));
    if (sh.on) { s.appendChild(tsRange("القوّة", .1, .95, .05, sh.alpha ?? .55, v => Math.round(v * 100) + "٪", v => upd("shadow", { alpha: v })));
      s.appendChild(tsRange("الانتشار", 2, 70, 1, sh.blur ?? 24, v => v + " px", v => upd("shadow", { blur: v })));
      s.appendChild(tsRange("الإزاحة للأسفل", 0, 30, 1, sh.y ?? 8, v => v + " px", v => upd("shadow", { y: v }))); } }
  // شكل الصندوق + لون النصّ
  { const s = sec(), boxed = (st.bg && st.bg.on) || (st.border && st.border.on);
    if (boxed) { s.appendChild(tsRange("استدارة الزوايا", 0, 44, 1, st.radius ?? 14, v => v + " px", v => { const c = tsGet(); c.radius = v; tsSave(c, false); }));
      s.appendChild(tsRange("الحشوة الداخليّة", 6, 44, 1, st.pad ?? 18, v => v + " px", v => { const c = tsGet(); c.pad = v; tsSave(c, false); })); }
    const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>لون النصّ</span>";
    r.appendChild(tsColors((st.text && st.text.color) || "", c => upd("text", { color: c }, true), true)); s.appendChild(r); }
  tsPreview();
}
$("tsReset").onclick = () => { tsSave({}).then(() => toast("أُعيد ضبط النمط")); };
$("tsCopy").onclick = () => { const o = TS_G === "name" ? "lesson" : "name", all = tsAll(tsGet()); all[o] = tsGet(); patch({ design: { textStyle: all } }).then(() => toast("نُسخ النمط إلى " + (o === "name" ? "الاسم" : "الدرس"))); };

let cT; const cc = () => { clearTimeout(cT); cT = setTimeout(() => patch({ design: { custom: { bg: $("cBg").value, accent: $("cAc").value } } }).then(renderDesign), 300); };
$("cBg").oninput = cc; $("cAc").oninput = cc;

// ---------- إزالة خلفيّة الشعار ----------
// نأخذ لون الخلفيّة من حواف الصورة، ثمّ نمسح كل ما يتّصل بالحواف ويشبهه (فتبقى الأجزاء الداخليّة بنفس اللون كالحروف البيضاء)
async function makeLogoCut(l) {
  const img = new Image(); img.src = "/media/" + encodeURIComponent(l.file);
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, w, h), d = im.data, N = w * h;
  const px = (x, y) => (y * w + x) * 4;
  // لون الخلفيّة = متوسّط الحواف المعتِمة؛ لو الحواف شفّافة أصلاً فلا شيء نزيله
  let r = 0, gg = 0, b = 0, n = 0;
  const edge = (x, y) => { const p = px(x, y); if (d[p + 3] > 200) { r += d[p]; gg += d[p + 1]; b += d[p + 2]; n++; } };
  for (let x = 0; x < w; x++) { edge(x, 0); edge(x, h - 1); }
  for (let y = 0; y < h; y++) { edge(0, y); edge(w - 1, y); }
  if (n < (2 * (w + h)) * .6) return null;
  r /= n; gg /= n; b /= n;
  const dist = p => Math.hypot(d[p] - r, d[p + 1] - gg, d[p + 2] - b);
  const T1 = 38, T2 = 70;                         // تحت T1 خلفيّة تماماً، بين T1 وT2 حافّة ناعمة
  const seen = new Uint8Array(N), stack = [];
  const push = (x, y) => { const i = y * w + x; if (!seen[i] && dist(i * 4) < T2) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  let removed = 0;
  for (let i = 0; i < N; i++) if (seen[i]) {
    const p = i * 4, k = dist(p), a = k <= T1 ? 0 : (k - T1) / (T2 - T1);
    d[p + 3] = Math.round(d[p + 3] * a); if (a < 1) removed++;
  }
  if (removed < N * .01) return null;
  g.putImageData(im, 0, 0);
  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  return api.call("media:saveLogoCut", l.file, await blob.arrayBuffer());
}

// ---------- الشعارات: خانات ----------
const SLOTS = 6;
function renderLogos() {
  $("sponsorsOn").checked = S().design.sponsors !== false;
  $("sponsorsOn").onchange = e => patch({ design: { sponsors: e.target.checked } });
  const posIcon = p => { const [v, h] = p.split("-"); return `<span class="pp">${p === "auto" ? "" : `<i style="${v}:3px;${h}:3px"></i>`}</span>`; };
  cards("logoPosSeg", "logoPos", [
    { v: "auto", t: "حسب التصميم", art: posIcon("auto") }, { v: "top-right", t: "أعلى اليمين", art: posIcon("top-right") },
    { v: "top-left", t: "أعلى اليسار", art: posIcon("top-left") }, { v: "bottom-right", t: "أسفل اليمين", art: posIcon("bottom-right") },
    { v: "bottom-left", t: "أسفل اليسار", art: posIcon("bottom-left") }], S().design.logoPos || "auto",
    v => patch({ design: { logoPos: v } }).then(renderLogos));
  const ls = $("logoScale"), lsv = () => $("logoScaleV").textContent = AR(Math.round(ls.value * 100)) + "٪";
  ls.value = S().design.logoScale || 1; lsv();
  let lt; ls.oninput = () => { lsv(); clearTimeout(lt); lt = setTimeout(() => patch({ design: { logoScale: +ls.value } }), 120); };
  const box = $("logoSlots"); box.innerHTML = "";
  const L = S().logos;
  for (let i = 0; i < SLOTS; i++) {
    const l = L[i], d = document.createElement("div");
    d.innerHTML = `<span class="num">${AR(i + 1)}</span>`;
    if (!l) {
      d.className = "slot"; d.innerHTML += `${ICON("plus")}<span>أضف شعاراً</span>`;
      d.onclick = async () => { ST.settings.logos = await api.call("media:addLogos"); renderLogos(); };
    } else {
      d.className = "slot full" + (l.on === false ? " off" : "");
      d.innerHTML += `<img src="/media/${encodeURIComponent(l.nobg && l.cut ? l.cut : l.file)}" style="${l.mono ? "filter:brightness(0) invert(1)" : ""}">`;
      const acts = document.createElement("div"); acts.className = "acts";
      const upd = ch => { const X = S().logos.slice(); ch(X); patch({ logos: X }).then(renderLogos); };
      const mk = (txt, on, fn, title) => { const b = document.createElement("button"); b.textContent = txt; b.title = title || ""; if (on) b.className = "on"; b.onclick = fn; acts.appendChild(b); };
      mk(l.on === false ? "مخفي" : "ظاهر", l.on !== false, () => upd(X => X[i] = Object.assign({}, l, { on: l.on === false })), "إظهار أو إخفاء هذا الشعار في البثّ");
      mk(l.mono ? "أبيض" : "ألوانه", false, () => upd(X => X[i] = Object.assign({}, l, { mono: !l.mono })), "يبقى الشعار بألوانه الأصليّة، أو يتحوّل للون الأبيض");
      mk(l.nobg ? "بلا خلفيّة" : "بخلفيّته", !!l.nobg, async () => {
        if (l.nobg) return upd(X => X[i] = Object.assign({}, l, { nobg: false }));
        try {
          let cut = l.cut;
          if (!cut) { toast("جارٍ إزالة الخلفيّة…"); cut = await makeLogoCut(l); }
          if (!cut) return toast("الشعار أصلاً بلا خلفيّة مصمتة");
          upd(X => X[i] = Object.assign({}, l, { nobg: true, cut }));
        } catch (e) { toast("تعذّرت إزالة الخلفيّة: " + e.message); }
      }, "إزالة الخلفيّة المصمتة من الشعار (بيضاء أو ملوّنة)");
      mk("حذف", false, () => upd(X => X.splice(i, 1)));
      d.appendChild(acts);
    }
    box.appendChild(d);
  }
}

// ---------- الأجهزة ----------
let DEV = null;
// جودة الكاميرا: الدقّات تأتي من الجهاز نفسه فلا تُعرض دقّة لا يدعمها، ويُعرض الحجم الواصل فعلاً للتحقّق
api.on("camq", async () => { ST = await stateGet(); renderCamQ(); });
async function renderCamQ() {
  const q = Object.assign({ res: "auto", fps: 0, fmt: "auto" }, S().camQ), sel = $("cqRes"), info = $("cqInfo");
  if (!sel) return;
  const dv = S().devices.camSheikh, isPh = !!(dv && dv.phone);
  $("camQ").style.opacity = isPh ? .55 : 1; $("camQ").title = isPh ? "هاتف المجالس يضبط جودته من تطبيق الهاتف" : "";
  let caps = { resolutions: [], actual: null };
  if (!isPh) { try { caps = await api.call("cam:caps", "sheikh"); } catch {} }
  const opts = [["auto", "تلقائي (افتراضيّ الجهاز)"]].concat(caps.resolutions.map(r => [r.value, r.value.replace("x", " × ")])).filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i);
  if (q.res !== "auto" && !opts.some(o => o[0] === q.res)) opts.push([q.res, q.res.replace("x", " × ") + " (محفوظة)"]);
  sel.innerHTML = opts.map(([v, t]) => '<option value="' + v + '">' + t + "</option>").join(""); sel.value = q.res;
  $("cqFps").value = String(q.fps || 0); $("cqFmt").value = q.fmt || "auto";
  const save = () => patch({ camQ: { res: sel.value, fps: +$("cqFps").value, fmt: $("cqFmt").value } }).then(() => { toast("تُطبَّق جودة الكاميرا…"); setTimeout(renderCamQ, 1800); });
  sel.onchange = $("cqFps").onchange = $("cqFmt").onchange = save;
  info.textContent = isPh ? "" : caps.actual && caps.actual.w ? "الصورة الواصلة الآن من الكاميرا: " + caps.actual.w + " × " + caps.actual.h : "الكاميرا غير متّصلة أو لا تُرسل صورة بعد";
}
async function loadDevices() {
  try { DEV = await api.call("devices:list"); } catch { return; }
  const d = S().devices;
  // هاتف المجالس يظهر أوّل قائمة الكاميرات في كل خانة (لكل دور معرّفه)
  DEV.camsSheikh = [{ id: "phone:sheikh", name: "📱 هاتف المجالس (تطبيق الكاميرا)" }, ...DEV.cams];
  DEV.cams2 = [{ id: "phone:audience", name: "📱 هاتف المجالس (تطبيق الكاميرا)" }, ...DEV.cams];
  const fill = (id, list, cur, none) => {
    const s = $(id);
    s.innerHTML = (none ? `<option value="">${none}</option>` : "") + list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    s.value = cur && cur.id ? cur.id : (none ? "" : (list[0] && list[0].id) || "");
    s.onchange = () => { const x = list.find(z => z.id === s.value); patch({ devices: { [id]: x ? Object.assign({ id: x.id, name: x.name }, String(x.id).startsWith("phone:") ? { phone: true } : {}) : null } }); toast("يُطبَّق الجهاز…"); };
  };
  fill("camSheikh", DEV.camsSheikh, d.camSheikh, null);
  renderCamQ();
  fill("cam2", DEV.cams2, d.cam2, "— بلا كاميرا حضور —");
  $("cam2").onchange = async () => {
    const x = DEV.cams2.find(z => z.id === $("cam2").value), dv = S().devices;
    if (x && dv.camSheikh && dv.camSheikh.id === x.id) {
      // الجهاز نفسه لا يخدم كاميرتين: نعرض نقله من كاميرا الشيخ إلى كاميرا الحضور
      const other = DEV.cams.find(z => z.id !== x.id);
      if (!other) { $("cam2").value = (dv.cam2 && dv.cam2.id) || ""; return toast("لا يوجد جهاز كاميرا آخر لكاميرا الشيخ"); }
      if (!confirm(`«${x.name}» مستخدم الآن في كاميرا الشيخ.
هل تنقله إلى كاميرا الحضور وتجعل كاميرا الشيخ على «${other.name}»؟`)) { $("cam2").value = (dv.cam2 && dv.cam2.id) || ""; return; }
      await patch({ devices: { cam2: { id: x.id, name: x.name }, camSheikh: { id: other.id, name: other.name } } });
      await loadDevices(); renderCam2(); return toast("يُطبَّق الجهاز…");
    }
    patch({ devices: { cam2: x ? Object.assign({ id: x.id, name: x.name }, String(x.id).startsWith("phone:") ? { phone: true } : {}) : null } }).then(renderCam2); toast("يُطبَّق الجهاز…");
  };
  fill("micSheikh", DEV.mics, d.micSheikh, null);
  fill("cam3", DEV.cams, d.cam3, "— بلا كاميرا ثالثة —");
  renderCam3();
  micUi();
}
// حالة الميكروفون: غير متّصل / يلتقط صوتاً / لا صوت. التوصيل الفوريّ: ويندوز يخبر الصفحة بأيّ جهاز يُضاف أو يُنزَع فتتحدّث القائمة
const MIC = { t: 0 };
function micUi() {
  const sel = S().devices.micSheikh, list = (DEV && DEV.mics) || [], el = $("micState"); if (!el) return;
  const miss = sel && sel.id && sel.id !== "default" && list.length && !list.some(m => m.id === sel.id);
  el.style.color = miss ? "var(--bad,#FF8A80)" : "";
  el.textContent = miss ? "⚠ «" + sel.name + "» غير متّصل الآن. وصِّله أو اختر جهازاً آخر (يعود تلقائيّاً عند توصيله)." : (Date.now() - MIC.t < 4000 ? "✓ الميكروفون يلتقط الصوت" : "لا صوت واصلاً الآن (صمت، أو الميكروفون غير موصول/مغلق).");
  const dl = $("micDelay"); if (dl && document.activeElement !== dl) { dl.value = (S().audio || {}).delay || 0; $("micDelayV").textContent = dl.value + " م.ث"; }
}
$("micDelay").oninput = e => { $("micDelayV").textContent = e.target.value + " م.ث"; clearTimeout(micDelay.t); micDelay.t = setTimeout(() => patch({ audio: { delay: +e.target.value } }), 200); };
try { let dt; navigator.mediaDevices.addEventListener("devicechange", () => { clearTimeout(dt); dt = setTimeout(() => { if (document.querySelector("#tabs button.on")?.dataset.t === "dev") loadDevices(); else micUi(); }, 800); }); } catch {}
$("devRefresh").onclick = loadDevices;

// ---------- الكاميرا 2 (ثانويّة) ----------
const CAM2_NAMES = new Proxy({}, { get: (_, k) => (MODE_CAM2[curMode()] || {})[k] });
function cam2State() {
  const c = S().cam2, dev = S().devices.cam2, live = (ST.cams && ST.cams.live || {}).cam2, el = $("cam2State");
  const lbl = CAM2_NAMES[c.target] || (c.label || "").trim() || "كاميرا الحضور";
  el.textContent = !c.on ? "كاميرا الحضور مطفأة — الكاميرا مُحرَّرة ولا يظهر مشهدها في القائمة."
    : !(dev && dev.id) ? "مفعّلة، لكن لم تختر جهازاً — اختره من القائمة أعلاه."
    : live ? `كاميرا الحضور شغّالة — تظهر باسم: ${lbl}. اضغط مشهد «كاميرا الحضور» أو المفتاح 9 لعرضها.` : "مفعّلة — بانتظار الكاميرا…";
}
function renderCam2() {
  const c = S().cam2;
  $("cam2On").checked = !!c.on;
  $("cam2On").onchange = async e => {
    const on = e.target.checked;
    if (on && !(S().devices.cam2 && S().devices.cam2.id)) toast("اختر جهاز كاميرا الحضور أوّلاً");
    await patch({ cam2: { on } }); renderScenes(); setScene(ST.program); renderCam2();
    toast(on ? "كاميرا الحضور مفعّلة" : "كاميرا الحضور أُغلقت");
  };
  cards("cam2Target", "cam2", Object.entries(MODE_CAM2[curMode()]).map(([v, t]) => ({ v, t })).concat([{ v: "custom", t: "أخرى…" }]), c.target,
    v => patch({ cam2: { target: v } }).then(renderCam2));
  $("cam2LabelBox").hidden = c.target !== "custom";
  const inp = $("cam2Label"); inp.value = c.label || "";
  let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => patch({ cam2: { label: inp.value } }).then(cam2State), 250); };
  cam2State();
}
// ---------- الكاميرا الثالثة (البودكاست) ----------
function renderCam3() {
  const c = S().cam3 || { on: false }, on = $("cam3On"), st = $("cam3State"); if (!on) return;
  on.checked = !!c.on;
  on.onchange = async e => {
    const v = e.target.checked;
    if (v && !(S().devices.cam3 && S().devices.cam3.id)) toast("اختر جهاز الكاميرا الثالثة أوّلاً");
    await patch({ cam3: { on: v } }); renderScenes(); setScene(ST.program); renderCam3();
    toast(v ? "الكاميرا الثالثة مفعّلة" : "الكاميرا الثالثة أُغلقت");
  };
  const dev = S().devices.cam3, live = (ST.cams && ST.cams.live || {}).cam3;
  st.textContent = !c.on ? "مطفأة — الكاميرا مُحرَّرة ولا يظهر مشهداها «الثالثة» و«ثلاثي»." : !(dev && dev.id) ? "مفعّلة، لكن لم تختر جهازاً — اختره من القائمة." : live ? "شغّالة — يظهر مشهد «الثالثة» ومشهد «ثلاثي» (المقدّم والضيف والثالثة معاً)." : "مفعّلة — بانتظار الكاميرا…";
}
api.on("meters", list => {
  const lv = n => { const x = list.find(i => i.name === n); return x ? Math.min(1, Math.sqrt(x.level) * 1.1) : 0; };
  const v = lv("مايك الشيخ"); $("mtSheikh").style.width = v * 100 + "%"; if (v > .03) MIC.t = Date.now();
  if (Date.now() - (MIC.ui || 0) > 1000) { MIC.ui = Date.now(); micUi(); }
});
function renderFraming() {
  document.querySelectorAll(".sliders").forEach(box => {
    const who = box.dataset.who;
    box.querySelectorAll("input").forEach(inp => {
      inp.value = S().framing[who][inp.dataset.k];
      let t; inp.oninput = () => {
        if (who === "sheikh" && S().design.autoFrame !== false) { patch({ design: { autoFrame: false } }).then(afRender); toast("أُوقف التأطير الذكي لأنك ضبطت يدوياً"); }
        clearTimeout(t); t = setTimeout(() => patch({ framing: Object.assign({}, S().framing, { [who]: Object.assign({}, S().framing[who], { [inp.dataset.k]: +inp.value }) }) }), 120); };
    });
  });
}

// ---------- البثّ ----------
function renderLive() {
  const q = S().quality || "1080";
  $("qBadge").textContent = q === "4k" ? "4K" : "Full HD";
  const qb = $("qualSeg"); qb.innerHTML = "";
  [{ v: "1080", i: "FHD", t: "عالية", s: "الأنسب للبثّ وأغلب الأجهزة" }, { v: "4k", i: "4K", t: "فائقة", s: "تحتاج كاميرا 4K وجهازاً قويّاً" }].forEach(o => {
    const b = document.createElement("button"); b.className = "opt qcard" + (q === o.v ? " on" : "");
    b.innerHTML = `<span class="qi">${o.i}</span><span>${o.t}</span><small>${o.s}</small>`;
    b.onclick = () => { if (q === o.v) return; patch({ quality: o.v }).then(() => { renderLive(); toast(o.v === "4k" ? "يُطبَّق 4K…" : "يُطبَّق Full HD…"); }); };
    qb.appendChild(b);
  });
  renderPlatforms();
  $("recFolder").onclick = () => api.call("output:openFolder");
  $("chCopy").onclick = () => { navigator.clipboard.writeText($("chapters").value); toast("نُسخت الفصول ✓"); };
}
// ---------- فيديوهات «من وين أجيب المفتاح؟» ----------
// الصق هنا روابط فيديوهات إبراهيم (دقيقة لكل منصّة). لو فاضي يفتح صفحة المساعدة الرسميّة للمنصّة.
const HELP_VIDEOS = {
  youtube: "",
  facebook: "",
  telegram: "",
  tiktok: "",
};
const HELP_FALLBACK = {
  youtube: "https://support.google.com/youtube/answer/2907883?hl=ar",
  facebook: "https://www.facebook.com/live/producer",
  telegram: "https://telegram.org/blog/live-streams-forwarding-next-channel",
  tiktok: "https://www.tiktok.com/live",
};

// ---------- منصّات البثّ: بطاقة لكل منصّة بشعارها وخطوات واضحة ----------
const PLAT = {
  youtube: { n: "يوتيوب", d: "الأشهر لحفظ الدروس ومشاهدتها لاحقاً",
    logo: '<svg viewBox="0 0 48 48"><rect x="2" y="9" width="44" height="30" rx="9" fill="#FF0033"/><path d="M20 17l12 7-12 7z" fill="#fff"/></svg>',
    steps: ["افتح يوتيوب ستوديو واضغط «بثّ مباشر» (أيقونة الكاميرا)", "انسخ «مفتاح البثّ» (Stream key)", "الصقه في الخانة هنا — مرّة وحدة يكفي"], url: "https://studio.youtube.com/channel/UC/livestreaming" },
  facebook: { n: "فيسبوك", d: "صفحة الجهة أو المسجد",
    logo: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path d="M26.6 40V27.4h4.2l.7-5h-4.9v-3.1c0-1.4.4-2.4 2.5-2.4h2.6v-4.4a36 36 0 0 0-3.8-.2c-3.7 0-6.3 2.3-6.3 6.5v3.6h-4.2v5h4.2V40z" fill="#fff"/></svg>',
    steps: ["افتح «استوديو البثّ المباشر» في فيسبوك", "اختر «استخدام مفتاح البثّ» (Streaming software)", "انسخ «مفتاح البثّ» والصقه هنا"], url: "https://www.facebook.com/live/producer" },
  telegram: { n: "تيليجرام", d: "قناة أو مجموعة الدروس", server: true,
    logo: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#29A9EB"/><path d="M11 23.4l23.5-9c1-.4 1.9.2 1.6 1.8l-4 18.8c-.3 1.3-1.1 1.6-2.2 1l-6-4.4-2.9 2.8c-.3.3-.6.6-1.2.6l.4-6.2 11.3-10.2c.5-.4-.1-.7-.8-.3l-14 8.8-6-1.9c-1.3-.4-1.3-1.3.3-1.8z" fill="#fff"/></svg>',
    steps: ["افتح القناة أو المجموعة ← اضغط على اسمها", "اختر «بثّ مباشر» ثمّ «البثّ باستخدام…» (Stream with…)", "انسخ «رابط الخادم» و«مفتاح البثّ» والصقهما هنا"] },
  tiktok: { n: "تيك توك", d: "بثّ مباشر على حساب الجهة", server: true, url: "https://www.tiktok.com/live",
    logo: '<svg viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="11" fill="#010101"/><path d="M26.5 11h3.7c.3 2.9 2 4.7 4.8 5v3.9c-1.8 0-3.4-.5-4.8-1.4v8.6a7.7 7.7 0 1 1-7.7-7.7c.4 0 .8 0 1.2.1v4a3.8 3.8 0 1 0 2.8 3.6z" fill="#25F4EE" transform="translate(-1.2 1)"/><path d="M26.5 11h3.7c.3 2.9 2 4.7 4.8 5v3.9c-1.8 0-3.4-.5-4.8-1.4v8.6a7.7 7.7 0 1 1-7.7-7.7c.4 0 .8 0 1.2.1v4a3.8 3.8 0 1 0 2.8 3.6z" fill="#FE2C55" transform="translate(1.2 -1)"/><path d="M26.5 11h3.7c.3 2.9 2 4.7 4.8 5v3.9c-1.8 0-3.4-.5-4.8-1.4v8.6a7.7 7.7 0 1 1-7.7-7.7c.4 0 .8 0 1.2.1v4a3.8 3.8 0 1 0 2.8 3.6z" fill="#fff"/></svg>',
    steps: ["افتح «TikTok LIVE Studio» أو مركز البثّ المباشر في حسابك (يلزم أن يكون البثّ المباشر متاحاً لحسابك)", "اختر «Stream key» وانسخ «رابط الخادم» (Server URL) و«مفتاح البثّ» (Stream key)", "الصقهما هنا. ملاحظة: يتغيّر المفتاح غالباً مع كل بثّ، فحدّثه قبل البدء"] },
  custom: { n: "منصّة أخرى", d: "أي منصّة تعطيك رابط خادم ومفتاح", server: true,
    logo: '<svg viewBox="0 0 48 48" fill="none" stroke="#D1AA62" stroke-width="2.6"><circle cx="24" cy="24" r="19"/><path d="M5 24h38M24 5a29 29 0 0 1 0 38M24 5a29 29 0 0 0 0 38"/></svg>',
    steps: ["من إعدادات البثّ في المنصّة انسخ «رابط الخادم» (RTMP) و«المفتاح»", "الصقهما هنا"] },
};
// مجلّدات الحفظ: الدروس | الريلز | الصوتيّات — كل منها مستقلّ وقابل للتغيير
function dirsBox() {
  const wrap = document.createElement("div"); wrap.className = "capbox tsctl"; wrap.innerHTML = "<b>مجلّدات الحفظ</b>";
  const rows = [["rec", "الدروس والخطب والمحاضرات (فيديو البرنامج)"], ["reels", "الريلز (ومعها كاميرا الشيخ العموديّة في «المصادر»)"], ["audio", "الصوتيّات"]];
  const paint = D => { wrap.querySelectorAll(".dirrow").forEach(e => e.remove()); rows.forEach(([k, n]) => {
    const r = document.createElement("div"); r.className = "dirrow"; r.style.cssText = "margin:8px 0;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)";
    r.innerHTML = '<div style="font-weight:700;font-size:14px">' + n + '</div><div class="hint" dir="ltr" style="text-align:right;word-break:break-all;margin:3px 0">' + esc(D[k]) + '</div><div class="two"><button class="mid">تغيير…</button><button class="mid">فتح</button></div>';
    const [ch, op] = r.querySelectorAll("button");
    ch.onclick = () => api.call("dirs:pick", k).then(paint).catch(e => toast(e.message)); op.onclick = () => api.call("dirs:open", k);
    if (D[k] !== D.def[k]) { const rs = document.createElement("button"); rs.className = "mid"; rs.textContent = "الافتراضيّ"; rs.onclick = () => api.call("dirs:reset", k).then(paint); r.querySelector(".two").appendChild(rs); }
    wrap.appendChild(r); }); };
  api.call("dirs:get").then(paint);
  wrap.appendChild(tsSwitch("استخراج ملفّ صوت عالي الجودة (MP3 320) مع كل تسجيل تلقائيّاً", S().audioRec !== false, on => patch({ audioRec: on })));
  return wrap;
}
function renderPlatforms() {
  const box = $("platforms"); box.innerHTML = "";
  Object.entries(PLAT).forEach(([k, pl]) => {
    const cur = Object.assign({ on: false, key: "", server: "" }, (S().platforms || {})[k]);
    const d = document.createElement("div"); d.className = "plat" + (cur.on ? " on" : "");
    d.innerHTML = `<div class="hd"><span class="logo">${pl.logo}</span><span class="nm"><b>${pl.n}</b><small>${pl.d}</small></span>
      <label class="switch"><input type="checkbox" ${cur.on ? "checked" : ""}><i></i></label></div>
      <div class="body">${pl.server ? `<input class="srv" dir="ltr" placeholder="رابط الخادم  rtmps://…" value="${esc(cur.server)}">` : ""}
      <input class="key" type="password" dir="ltr" placeholder="مفتاح البثّ" value="${esc(cur.key)}">
      ${cur.key ? `<div class="ok">✓ المفتاح محفوظ</div>` : ""}
      <details><summary>من وين أجيب المفتاح؟</summary><ol>${pl.steps.map(x => `<li>${x}</li>`).join("")}</ol>
        ${HELP_VIDEOS[k] || HELP_FALLBACK[k] ? `<button class="mid watch" style="margin-top:8px">${ICON("live")}${HELP_VIDEOS[k] ? "شاهد الشرح (دقيقة)" : "صفحة المساعدة الرسميّة"}</button>` : ""}
        ${pl.url ? `<button class="mid open" style="margin-top:8px">افتح ${pl.n}</button>` : ""}</details></div>`;
    const save = ch => patch({ platforms: { [k]: Object.assign({}, cur, ch) } }).then(renderPlatforms);
    d.querySelector(".switch input").onchange = e => save({ on: e.target.checked });
    d.querySelector(".key").onchange = e => save({ key: e.target.value.trim() }).then(() => toast(`حُفظ مفتاح ${pl.n} ✓`));
    const srv = d.querySelector(".srv"); if (srv) srv.onchange = e => save({ server: e.target.value.trim() });
    const ob = d.querySelector("details button.open"); if (ob) ob.onclick = () => api.call("open:external", pl.url);
    const wb = d.querySelector("details button.watch"); if (wb) wb.onclick = () => api.call("open:external", HELP_VIDEOS[k] || HELP_FALLBACK[k]);
    box.appendChild(d);
  });
}
function chaptersOut(ch) {
  const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  $("chapters").value = (ch || []).map(c => `${ts(c.t)} ${c.title}`).join("\n");
}
api.on("chapters", chaptersOut);

init().catch(e => { $("previewMsg").textContent = "خطأ: " + e.message; console.error(e); });

// ---------- تخطيط الواجهة: طيّ الإطار الجانبي، والعرض الكبير ----------
function initLayout() {
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
  const apply = () => {
    const side = document.body.classList.contains("side-off"), big = document.body.classList.contains("big");
    $("btnSide").classList.toggle("on", side && !big); $("btnBig").classList.toggle("on", big);
    api.call("preview:size", big).catch(() => {});                 // معاينة أدقّ في العرض الكبير
  };
  const setSide = on => { document.body.classList.toggle("side-off", on); ls("sideOff", on ? "1" : "0"); apply(); };
  const setBig = on => { document.body.classList.toggle("big", on); ls("big", on ? "1" : "0"); apply(); };
  $("btnSide").onclick = () => { if (document.body.classList.contains("big")) setBig(false); else setSide(!document.body.classList.contains("side-off")); };
  $("btnBig").onclick = () => setBig(!document.body.classList.contains("big"));
  addEventListener("keydown", e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return;
    if (!$("hub").hidden || !$("bsearch").hidden || !$("libView").hidden) return;
    if (e.key === "v" || e.key === "V") setBig(!document.body.classList.contains("big"));
    else if (e.key === "Escape" && document.body.classList.contains("big")) setBig(false);
  });
  document.body.classList.toggle("side-off", ls("sideOff") === "1");
  document.body.classList.toggle("big", ls("big") === "1");
  apply();
}
