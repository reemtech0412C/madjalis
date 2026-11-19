// «معمل المجالس» — مشهد الكتاب: اختيار كتاب من مكتبتك أو من الشاملة أو ملفّ PDF، ومشهد (كاميرا في إطار + صفحة الكتاب) مع التنقّل بين الصفحات.
// صفحة الكتاب تُرسَم بنفس صفحة البثّ book.html (بطاقة) كصورة PNG بمقاس البطاقة وتُركَّب في موضعها.
const LAB_BOOK = { card: [64, 128, 1188, 784], cam: [1280, 128, 576, 784] };
const labBookBox = side => side === "left" ? { book: [1920 - 64 - 1188, 128, 1188, 784], cam: [1920 - 1280 - 576, 128, 576, 784] } : { book: LAB_BOOK.card, cam: LAB_BOOK.cam };
function labBookSpec(o) {
  const b = o.book; const [x, y, w, h] = o.box || LAB_BOOK.card;
  return { page: "book.html", params: { mode: o.bmode || "card", w, h }, ovr: { book: { id: b.id, v: 1 }, bookState: { page: o.page || 1, focus: false, band: null, step: .042 } }, size: [w, h], tag: "book", wait: 2600 };
}
async function labBookDialog() {
  return new Promise(async resolve => {
    const ov = lmk("div", "lab-dlg", null, document.body), card = lmk("div", "card", null, ov);
    const done = v => { ov.remove(); resolve(v); };
    lmk("h3", "", "اختيار كتاب للمشهد", card);
    const tabs = lmk("div", "lab-tabs", null, card), body = lmk("div", "lab-dbody", null, card);
    let tab = "mine";
    const paint = async () => { tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.t === tab)); body.innerHTML = ""; if (tab === "mine") await paintMine(); else if (tab === "sh") paintShamela(); else paintPdf(); };
    [["mine", "مكتبتي"], ["sh", "البحث في الشاملة"], ["pdf", "ملفّ PDF من الحاسوب"]].forEach(([k, n]) => { const b = lmk("button", "", n, tabs); b.dataset.t = k; b.onclick = () => { tab = k; paint(); }; });
    lmk("button", "mid", "إغلاق", card).onclick = () => done(null);
    const pick = m => done({ id: m.id, title: m.title, pages: m.pages, kind: m.kind });
    async function paintMine() {
      const list = (await api.call("lib:list")).filter(m => m.ready !== false && m.pages);
      if (!list.length) lmk("p", "hint", "مكتبتك فارغة. ابحث في الشاملة أو أضف ملفّ PDF.", body);
      list.forEach(m => { const r = lmk("div", "lab-brow", null, body); r.innerHTML = `<b>${esc(m.title)}</b><small>${esc(m.author || "")} · ${m.pages} ص · ${m.kind === "pdf" ? "مصوَّر" : "نصّ مرتّب"}</small>`; const b = lmk("button", "mid pri", "اختيار", r); b.onclick = () => pick(m); });
    }
    function paintShamela() {
      const q = lmk("input", "", null, body); q.placeholder = "ابحث باسم الكتاب أو المؤلّف…"; const res = lmk("div", "", null, body);
      let cat = null; const prog = lmk("p", "hint", "", body);
      api.call("lib:catalog").then(c => { cat = c; draw(); }).catch(e => { prog.textContent = e.message; });
      const draw = () => {
        res.innerHTML = ""; if (!cat) { res.textContent = "جارٍ تحميل فهرس الشاملة…"; return; } const t = norm(q.value); if (t.length < 2) { res.innerHTML = '<p class="hint">اكتب حرفين على الأقلّ.</p>'; return; }
        cat.books.filter(b => norm(b[1] + " " + b[2]).includes(t)).slice(0, 30).forEach(b => {
          const r = lmk("div", "lab-brow", null, res); r.innerHTML = `<b>${esc(b[1])}</b><small>${esc(b[2])}</small>`;
          const act = lmk("span", "", null, r);
          const get = async (pdf) => { prog.textContent = "جارٍ التحميل…"; const h = api.on("lib:progress", p => { prog.textContent = p.phase + (p.total ? " " + Math.round(p.got / 1048576) + "/" + Math.round(p.total / 1048576) + " م.ب" : ""); });
            try { const m = await api.call(pdf ? "lib:shamelaPdf" : "lib:shamelaText", b[0]); if (pdf) { await labConvertPdf(m, t2 => { prog.textContent = t2; }); const ms = await api.call("lib:list"); pick(ms.find(x => x.id === m.id) || m); } else pick(m); } catch (e) { prog.textContent = e.message; } };
          lmk("button", "mid pri", "نصّ مرتّب", act).onclick = () => get(false);
          if (b[4]) lmk("button", "mid", "صفحات مصوّرة", act).onclick = () => get(true);
        });
      };
      let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(draw, 250); };
    }
    function paintPdf() {
      lmk("p", "hint", "اختر ملفّ PDF لكتاب؛ تُحوَّل صفحاته إلى صور داخل المكتبة (قد يستغرق دقائق للكتب الكبيرة).", body);
      const st = lmk("p", "hint", "", body);
      lmk("button", "mid pri", "اختيار ملفّ PDF…", body).onclick = async () => { const m = await api.call("lib:importPdf"); if (!m) return; try { await labConvertPdf(m, t => { st.textContent = t; }); const ms = await api.call("lib:list"); pick(ms.find(x => x.id === m.id) || m); } catch (e) { st.textContent = e.message; } };
    }
    paint();
  });
}
// تحويل صفحات PDF إلى صور دون جعله «الكتاب الحاليّ» في غرفة التحكّم
async function labConvertPdf(meta, say) {
  if (!window.renderPdfBook) throw new Error("محوّل PDF غير جاهز بعد");
  const info = await window.renderPdfBook(meta, (n, total, label) => say(`تجهيز الصفحات ${n} من ${total}${label ? " · " + label : ""}`));
  await api.call("lib:finishPdf", meta.id, info); say("تمّ");
}
async function labBookScene(side) { return labScene("card"); }
// الصفحة التالية/السابقة عند المؤشّر: تُقسَّم طبقة الكتاب الحاليّة وتبدأ الصفحة الجديدة من لحظة المؤشّر
async function labBookTurn(d) {
  const t = LAB.t, cur = LAB.p.ov.find(o => o.type === "book" && t >= o.start && t < o.end); if (!cur) { toast("ضع المؤشّر داخل مشهد كتاب"); return; }
  const meta = (await api.call("lib:list")).find(m => m.id === cur.book.id), max = meta ? meta.pages : 9999, np = Math.max(1, Math.min(max, (cur.page || 1) + d * 2));   // البطاقة تعرض صفحتين متقابلتين: التقليب بصفحتين
  if (np === cur.page) { toast("لا توجد صفحة أخرى"); return; }
  const o = Object.assign({}, JSON.parse(JSON.stringify(cur)), { id: lid("o"), page: np, start: t, end: cur.end }); try { o.png = await labPng(labBookSpec(o)); } catch (e) { toast(e.message); return; }
  labDo(p => { const c = p.ov.find(x => x.id === cur.id); c.end = t; p.ov.push(o); LAB.sel = { type: "ov", id: o.id }; LAB.p.bookPage = np; });
}
