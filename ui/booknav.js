// «المجالس» — تصفّح الكتاب في غرفة التحكّم: أسطر الصفحة بدقّة، الانتقال إلى صفحة برقمها، قائمة الأبواب، التكبير، أزرار العرض الكبير، وإعدادات مشهد «سطور الكتاب».
// تعتمد على overlays/bookcore.js (تُحمَّل قبلها) ودوال app.js (S, api, META, book, $, AR, esc, toast, patch, tsRange, tsSwitch).
const BNK = { texts: {}, lines: new Map(), pmap: null, host: null };
const cleanTitle = t => String(t || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const clipText = (t, n = 96) => t.length > n ? t.slice(0, n - 1).trim() + "…" : t;
const normDigits = s => String(s || "").replace(/[0-9]/g, d => "0123456789".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const readingCfg = () => Object.assign({ pos: "front", lines: 3, step: "line", size: 1, bg: .55, fade: true }, (S().design || {}).reading || {});
const inReadingScene = () => /سطور/.test((typeof ST !== "undefined" && ST && ST.program) || "");

// ---------- تهيئة عند تغيّر الكتاب ----------
async function bnPrepare() {
  BNK.lines.clear(); BNK.pmap = null;
  if (META && META.kind === "text") {
    if (!BNK.texts[META.id]) BNK.texts[META.id] = await (await fetch("/books/" + encodeURIComponent(META.id) + "/text.json")).json();
    BNK.pmap = BNK.texts[META.id].map(p => p.p);
  }
}
const pageLabel = i => BNK.pmap && BNK.pmap[i - 1] != null ? BNK.pmap[i - 1] : i;
// رقم الصفحة المعروض: المطبوع للشاملة (والترتيب من إجماليّ الصفحات بخطّ صغير)، والترتيب للـPDF
function bnNumHTML(i) { return BNK.pmap ? `ص ${AR(pageLabel(i))}<small style="opacity:.6;font-size:.72em"> · ${AR(i)}/${AR(META.pages)}</small>` : AR(`${i} / ${META.pages}`); }

// ---------- أسطر الصفحة (دقيقة): DOM لصفحات النصّ، وبصمة الحبر لصور PDF ----------
function bnHost() {
  if (!BNK.host) { const h = document.createElement("div"); h.style.cssText = "position:fixed;left:-99999px;top:0;width:3000px;visibility:hidden;pointer-events:none"; document.body.appendChild(h); BNK.host = h; }
  return BNK.host;
}
async function getLines(page) {
  if (!META) return [];
  const key = META.id + ":" + page; if (BNK.lines.has(key)) return BNK.lines.get(key);
  let L = [];
  try {
    if (META.kind === "text") {
      const pg = (BNK.texts[META.id] || [])[page - 1];
      if (pg) { await document.fonts.load("20px Amiri"); const box = BookCore.textBox(pg, META); bnHost().appendChild(box); box.fit(); L = BookCore.textLines(box); box.remove(); }
    } else L = await BookCore.imageLines("/books/" + encodeURIComponent(META.id) + "/pages/" + String(page).padStart(4, "0") + ".jpg");
  } catch { L = []; }
  if (BNK.lines.size > 400) BNK.lines.delete(BNK.lines.keys().next().value);
  BNK.lines.set(key, L); return L;
}

// يكمّل حالة الكتاب: السطر الحاليّ ln، موضع الشريط وارتفاعه الدقيقين، ومقطع «سطور الكتاب» (sel)
async function bnDecorate(b) {
  if (!META) return b;
  const lines = await getLines(b.page), R = readingCfg();
  if (!lines.length) { b.ln = 0; b.sel = null; b.bh = null; return b; }
  const ln = Math.max(0, Math.min(lines.length - 1, Number.isFinite(b.ln) ? b.ln : 0)); b.ln = ln;
  const cur = lines[ln];
  if (b.band != null) { b.band = +Math.max(0, cur.t - .002).toFixed(4); b.bh = +(cur.b - cur.t + .004).toFixed(4); } else b.bh = null;
  const last = Math.min(lines.length - 1, ln + R.lines - 1); let l = 1, r = 0; lines.forEach(x => { l = Math.min(l, x.l); r = Math.max(r, x.r); });
  b.sel = { page: b.page, t: +cur.t.toFixed(4), b: +lines[last].b.toFixed(4), l: +l.toFixed(4), r: +r.toFixed(4) };
  return b;
}

// ---------- الانتقال إلى صفحة برقمها ----------
async function goPageInput() {
  const inp = $("pGoto"), n = parseInt(normDigits(inp.value).replace(/\D/g, ""), 10);
  if (!META) return toast("اختر كتاباً أوّلاً");
  if (!n) return toast("اكتب رقم الصفحة");
  let idx;
  if (BNK.pmap) {                              // كتب الشاملة: الرقم هو رقم الصفحة المطبوعة
    idx = BNK.pmap.findIndex(p => Number(p) === n);
    if (idx < 0) { const near = BNK.pmap.findIndex(p => Number(p) >= n); idx = near < 0 ? BNK.pmap.length - 1 : near; toast("لا توجد الصفحة " + AR(n) + " — انتقلتُ إلى أقربها: ص " + AR(BNK.pmap[idx])); }
  } else { idx = Math.max(0, Math.min(META.pages - 1, n - 1)); if (n > META.pages) toast("الكتاب " + AR(META.pages) + " صفحة"); }
  inp.value = ""; inp.blur();
  await book({ page: idx + 1, ln: 0 });
}

// ---------- قائمة الأبواب ----------
function bnToc() {
  let ov = $("tocView");
  if (!ov) { ov = document.createElement("div"); ov.id = "tocView"; document.body.appendChild(ov); }
  const toc = (META && META.toc || []).filter(t => (t.level || 1) <= 4).map(t => ({ page: t.page, level: t.level || 1, title: cleanTitle(t.title) })).filter(t => t.title);
  ov.innerHTML = `<div class="tv-box"><div class="tv-head"><b>أبواب الكتاب</b><span class="hint">${toc.length ? AR(toc.length) + " باب" : ""}</span><div class="grow"></div><button id="tvClose" class="iconbtn" title="إغلاق (Esc)"><span class="ic" data-i="close"></span></button></div>
    <input id="tvQ" placeholder="ابحث في الأبواب…" autocomplete="off"><div id="tvList"></div></div>`;
  ov.hidden = false; if (typeof icons === "function") icons(ov);
  const cur = chapterOf(BS().page), list = $("tvList");
  const draw = q => {
    const nq = typeof norm === "function" ? norm(q) : q, rows = toc.filter(t => !nq || (typeof norm === "function" ? norm(t.title) : t.title).includes(nq));
    list.innerHTML = "";
    if (!toc.length) { list.innerHTML = `<p class="hint" style="padding:18px;line-height:2">لا تتوفّر أبواب لهذا الكتاب. استعمل خانة «الانتقال إلى صفحة» برقم الصفحة، أو ابحث بكلمة من الكتاب.</p>`; return; }
    if (!rows.length) { list.innerHTML = `<p class="hint" style="padding:18px">لا نتيجة.</p>`; return; }
    rows.forEach(t => {
      const b = document.createElement("button"); b.className = "tv-row" + (cur && cur.page === t.page && cur.title && cleanTitle(cur.title) === t.title ? " on" : "");
      b.style.paddingRight = (14 + (t.level - 1) * 20) + "px"; b.dataset.l = t.level;
      b.innerHTML = `<span class="tt">${esc(clipText(t.title, 130))}</span><span class="tpg">${BNK.pmap && BNK.pmap[t.page - 1] != null ? "ص " + AR(BNK.pmap[t.page - 1]) : AR(t.page)}</span>`;
      b.title = t.title; b.onclick = () => { close(); book({ page: t.page, ln: 0 }); };
      list.appendChild(b);
    });
    const on = list.querySelector(".tv-row.on"); if (on && !q) on.scrollIntoView({ block: "center" });
  };
  const close = () => { ov.hidden = true; document.removeEventListener("keydown", esc2, true); };
  const esc2 = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("keydown", esc2, true);
  $("tvClose").onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
  $("tvQ").oninput = e => draw(e.target.value); draw(""); $("tvQ").focus();
}

// ---------- أزرار جانبَي الشاشة المكبَّرة ----------
function bnSideState() { const s = $("sideNav"); if (s) s.classList.toggle("has", !!META); }

// ---------- إعدادات مشهد «سطور الكتاب» ----------
function renderReadingCfg() {
  const box = $("readingCfg"); if (!box) return; box.innerHTML = "";
  const R = readingCfg(), set = (o, redo = true) => patch({ design: { reading: Object.assign({}, readingCfg(), o) } }).then(() => { if (redo) book({}); });
  const h = document.createElement("h3"); h.innerHTML = "سطور الكتاب <small>مشهد: سطران أو ثلاثة من الصفحة مع الشيخ</small>"; box.appendChild(h);
  const seg = (label, opts, cur, fn) => {
    const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>";
    const w = document.createElement("div"); w.className = "chips";
    opts.forEach(([v, t]) => { const b = document.createElement("button"); b.textContent = t; if (String(v) === String(cur)) b.classList.add("on"); b.onclick = () => fn(v).then(renderReadingCfg); w.appendChild(b); });
    r.appendChild(w); box.appendChild(r);
  };
  seg("موضع الشريط", [["front", "أمام الشيخ"], ["side", "بجانب الشيخ"]], R.pos, v => set({ pos: v }, false));
  seg("عدد الأسطر", [[2, "سطران"], [3, "ثلاثة أسطر"]], R.lines, v => set({ lines: v }));
  seg("التقديم والتأخير", [["line", "سطراً سطراً"], ["all", "بعدد الأسطر المعروضة"]], R.step, v => set({ step: v }, false));
  box.appendChild(tsRange("حجم الشريط", 0.5, 1.1, 0.05, R.size, v => Math.round(v * 100) + "٪", v => set({ size: v }, false)));
  box.appendChild(tsRange("قوّة الخلفيّة التدرّجيّة", 0, 1, 0.05, R.bg, v => Math.round(v * 100) + "٪", v => set({ bg: v }, false)));
  box.appendChild(tsSwitch("تعتيم خفيف على طرفَي الشريط", R.fade !== false, on => set({ fade: on }, false)));
  const two = document.createElement("div"); two.className = "two";
  const back = document.createElement("button"); back.className = "mid"; back.innerHTML = '<span class="ic" data-i="up"></span>تأخير'; back.onclick = () => line(-1);
  const fwd = document.createElement("button"); fwd.className = "mid pri"; fwd.innerHTML = 'تقديم<span class="ic" data-i="down"></span>'; fwd.onclick = () => line(1);
  two.append(fwd, back); box.appendChild(two); if (typeof icons === "function") icons(box);
  const p = document.createElement("p"); p.className = "hint"; p.textContent = "اختر مشهد «سطور الكتاب» من الأزرار ثمّ قدِّم الأسطر بالأسهم (↑ ↓) أو بأزرار الجانبين في العرض الكبير. يتبدّل الموضع والعدد فوراً دون إعادة بناء."; box.appendChild(p);
}
