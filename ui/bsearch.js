// «المجالس» — البحث داخل الكتاب (بكلمة أو عبارة) والقفز إلى الصفحة مع إبراز الكلمة في البثّ.
const BSR = { id: null, q: "", data: null, seen: new Set() };
const bsInfo = t => { $("bsInfo").textContent = t || ""; };
function bsOpen() {
  if (!S().book) return toast("اختر كتاباً أوّلاً");
  if (BSR.id !== S().book.id) { BSR.id = S().book.id; BSR.q = ""; BSR.data = null; BSR.seen.clear(); $("bsQ").value = ""; $("bsList").innerHTML = ""; bsInfo(""); }
  $("bsearch").hidden = false; const i = $("bsQ"); i.focus(); i.select();
}
const bsClose = () => { $("bsearch").hidden = true; };
function bsRender() {
  const d = BSR.data, box = $("bsList"); box.innerHTML = "";
  if (!d) return;
  const mk = r => {
    const b = document.createElement("button"); b.className = "bs-item" + (BSR.seen.has(r.page) ? " seen" : "");
    b.innerHTML = `<b class="pg">ص ${AR(r.page)}${r.count > 1 ? ` · ${AR(r.count)}×` : ""}</b>${esc(r.before)}<mark>${esc(r.hit)}</mark>${esc(r.after)}`;
    b.onclick = () => bsGo(r, b); return b;
  };
  const ex = d.results.filter(r => r.exact), lo = d.results.filter(r => !r.exact);
  if (ex.length) { const h = document.createElement("h4"); h.textContent = `العبارة كما كتبتها — ${AR(ex.length)} صفحة`; box.appendChild(h); ex.forEach(r => box.appendChild(mk(r))); }
  if (lo.length) { const h = document.createElement("h4"); h.textContent = `الكلمات متفرّقة في الصفحة — ${AR(lo.length)} صفحة`; box.appendChild(h); lo.forEach(r => box.appendChild(mk(r))); }
}
async function bsGo(r, btn) {
  BSR.seen.add(r.page); if (btn) btn.classList.add("seen");
  const hl = $("bsHl").checked && META && META.kind === "text" ? BSR.q : null;
  await book({ page: r.page, hl, band: null });
  bsClose(); toast(`ص ${AR(r.page)}${hl ? " — الكلمة مُبرَزة في البثّ" : ""}`);
}
async function bsRun() {
  const q = $("bsQ").value.trim(); if (!q) return;
  const id = S().book.id; BSR.q = q; BSR.data = null; $("bsList").innerHTML = ""; bsInfo("جارٍ البحث…");
  try {
    let r = await api.call("lib:search", id, q);
    if (r.needIndex) {
      // كتاب مصوّر (PDF): نقرأ طبقة النصّ من الملفّ مرّة واحدة ونحفظ الفهرس، فتكون عمليّات البحث التالية فوريّة
      bsInfo("أوّل بحث في هذا الكتاب: جارٍ تجهيز فهرس النصّ…");
      if (!window.extractPdfText) throw new Error("محرّك PDF لم يُحمَّل بعد، أعد المحاولة");
      const meta = await api.call("book:meta", id);
      const pages = await window.extractPdfText(meta, n => bsInfo(`جارٍ تجهيز فهرس النصّ… ${AR(n)} صفحة`));
      await api.call("lib:saveIndex", id, pages); r = await api.call("lib:search", id, q);
    }
    if (r.noText) return bsInfo("هذا الكتاب مصوَّر بلا طبقة نصّ (صور ممسوحة)، لذا لا يمكن البحث داخله. جرّب نسخة نصّيّة من «الشاملة».");
    BSR.data = r;
    bsInfo(r.total ? `${AR(r.total)} صفحة من ${AR(r.pagesTotal || "")} — اضغط نتيجة للانتقال إليها` : "لا نتائج. جرّب كلمة أقصر أو بدون تشكيل.");
    bsRender();
  } catch (e) { bsInfo("تعذّر البحث: " + e.message); }
}
function initBookSearch() {
  $("bSearch").onclick = bsOpen; $("bsX").onclick = bsClose; $("bsGo").onclick = bsRun;
  $("bsQ").onkeydown = e => { if (e.key === "Enter") bsRun(); };
  $("bsearch").onclick = e => { if (e.target.id === "bsearch") bsClose(); };
  $("bsClear").onclick = () => { book({ hl: null }); toast("أُلغي الإبراز"); };
  addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F") && $("hub").hidden) { e.preventDefault(); bsOpen(); }
    else if (e.key === "Escape" && !$("bsearch").hidden) bsClose();
  });
}
