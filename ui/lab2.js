// «معمل المجالس» — اللوحات الجانبيّة والأدوات (الوسائط، الأدوات العامّة، أدوات النوع) والمفتّش.
const labMode0 = () => ({ khutba: "khutba", quran: "quran", reply: "lessons", lesson: "lessons" }[LAB.p.kind] || "lessons");
const labLiveTexts = () => (LAB.live && LAB.live.state && LAB.live.state.texts) || {};
const labOverrides = () => { const o = {}; for (const [k, v] of Object.entries(LAB.p.texts || {})) if (String(v || "").trim()) o[k] = v; return o; };
const labTexts = () => Object.assign({ program: "", scope: "", session: "", "sheikh-title": "", sheikh: "" }, labLiveTexts());
async function labPng(spec) { labProg(.02, "رسم الطبقة…"); try { return await labPngRaw(spec); } finally { labProg(1); } }
// مواصفات رسم كل نوع طبقة
function labSpec0(o) {
  const T = labTexts(), pid = LAB.p.id;
  if (o.type === "lower") return { page: "lab.html", params: { kind: "lower", name: o.name || "", role: o.role || "", side: o.side || "right" }, tag: "lower" };
  if (o.type === "title") return { page: "lab.html", params: { kind: "title", t: o.t || "", s: o.s || "" }, tag: "title" };
  if (o.type === "text") return { page: "lab.html", params: { kind: "text", t: o.t || "", pos: o.pos || "bottom" }, tag: "text" };
  if (o.type === "tag") return { page: "lab.html", params: { kind: "tag", t: o.t || "" }, tag: "tag" };
  if (o.type === "side") return { page: "lab.html", params: { kind: "side", l: o.l || "", t: o.t || "", s: o.s || "" }, tag: "side" };
  if (o.type === "book") return labBookSpec(o);
  if (o.type === "image") { const c = lclip(o.clip); return { page: "photos.html", ovr: { photos: { frame: o.frame || "paper", items: [{ id: "i", file: "/lab/" + pid + "/" + c.local, cap: o.cap || "", ov: { on: true, pos: o.pos || "br", w: o.w || 28 } }] } }, tag: "img", wait: 1800 }; }
  if (o.type === "verse") return { page: "quran.html", params: { pos: o.pos || "bottom", box: (o.pos === "frame" || o.pos === "side") ? "70,140,1020,800" : "" }, ovr: { quran: { s: o.s, a: o.a, p: o.p || 0, size: o.size || 100, num: true, head: true, info: true } }, tag: "ayah", wait: 1100 };
  if (o.type === "screen") return { page: "screen.html", params: { kind: o.kind || "intro" }, opaque: true, tag: "scr", wait: 2200 };
  if (o.type === "frame") { const prm = { l: o.l, side: o.side || "left" }; for (const k of ["book", "cam", "page"]) if (o[k + "R"]) prm[k] = o[k + "R"].join(","); return { page: "frame.html", params: prm, tag: "frm", wait: 1700 }; }
  return null;
}
// كل الطبقات تُرسَم بحالة البثّ الحيّة (ضبط الحلقة: النصوص والشعارات والتصميم) مع تخصيص المشروع إن وُجد
function labSpec(o) {
  const sp = labSpec0(o); if (!sp) return sp; sp.live = LAB.p.kind; sp.sbx = LAB.p.id;
  const ov = Object.assign({}, sp.ovr || {});
  delete ov.mode; delete ov.texts; if (Object.keys(ov).length) sp.ovr = ov; else delete sp.ovr; return sp;
}
async function labRedraw(o) { const sp = labSpec(o); if (!sp) return; o.png = await labPng(sp); o.rev = (o.rev || 0) + 1; labSaveSoon(); labOverlaysRebuild(); labTimelinePaint(); labShow(LAB.t); }
async function labAddOv(o, dur = 4) {
  o.id = lid("o"); o.start = o.start ?? LAB.t; o.end = o.end ?? o.start + dur;
  const sp = labSpec(o); if (sp) { try { o.png = await labPng(sp); } catch (e) { toast("تعذّر رسم الطبقة: " + e.message); return null; } }
  labDo(p => { p.ov.push(o); LAB.sel = { type: "ov", id: o.id }; }); return o;
}
async function labEnsureBg() { if (LAB.p.bgPng) return; LAB.p.bgPng = await labPngRaw({ page: "bg.html", opaque: true, tag: "bg", wait: 900 }); labSaveSoon(); }

// ---------- لوحة الوسائط ----------
function labMediaPaint() { if (LAB.tab === "media") labLeftPaint(); }
async function labImport(kind) {
  const r = await api.call("lab:import", LAB.p.id, kind); if (!r.length) return;
  LAB.p = await api.call("lab:get", LAB.p.id);
  // أوّل مقطع فيديو/صوت يُضاف تلقائياً للتسلسل لو كان فارغاً
  if (!LAB.p.seq.length) { const c = LAB.p.clips.find(x => x.id === r[0].id); if (c && c.kind !== "image") { labDo(p => p.seq.push({ id: lid("s"), clip: c.id, in: 0, out: c.dur })); } }
  labPaintAll();
}
function labAddToSeq(c) {
  labDo(p => { const s = { id: lid("s"), clip: c.id, in: 0, out: c.dur }; if (c.kind === "image") { s.out = 5; } if (p.seq.length && !p.seq.at(-1).trans && p.opts.autoTrans) s.trans = { type: "fade", d: .5 }; p.seq.push(s); LAB.sel = { type: "seg", id: s.id }; });
  if (c.kind === "audio") labEnsureBg().then(() => labShow(LAB.t));
}
function labSidePark() { const h = $("labSideHold"); if (!h) return; for (const k of LAB_SIDE) { const e = $("t-" + k); if (e && e.parentNode !== h) { e.classList.remove("on"); h.appendChild(e); } } }
function labLeftPaint(keepSide) {
  const box = $("leLeft"); if (!box) return; const keep = box.scrollTop; labSidePark(); box.innerHTML = "";
  if (LAB_SIDE.includes(LAB.tab)) {
    document.querySelectorAll(".lab-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === LAB.tab));
    const e = $("t-" + LAB.tab); if (e) { e.classList.add("on"); box.appendChild(e); }
    try { if (LAB.tab === "halaqa") { renderTexts(); renderScreens(); renderLogos(); renderCrumb(); } else if (LAB.tab === "lesson") renderTexts(); else if (LAB.tab === "design") { renderDesign(); } } catch (err) { console.error(err); }
    box.scrollTop = keep; return;
  }
  document.querySelectorAll(".lab-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === LAB.tab));
  if (LAB.tab === "media") labMediaTab(box); else if (LAB.tab === "tools") labToolsTab(box); else if (LAB.tab === "design") labDesignTab(box); else if (LAB.tab === "look") labLookTab(box); else labProjectTab(box);
  box.scrollTop = keep;
}
function labMediaTab(box) {
  const row = lmk("div", "lab-btnrow", null, box);
  const b1 = lmk("button", "mid pri", "＋ فيديو / صوت", row); b1.onclick = () => labImport("any"); const b2 = lmk("button", "mid", "＋ صور", row); b2.onclick = () => labImport("image");
  if (!LAB.p.clips.length) lmk("p", "hint", "استورد مقاطع من حاسوبك. تبقى ملفّاتها الأصليّة كما هي، والمعمل يحفظ التعديلات فقط.", box);
  LAB.p.clips.forEach(c => {
    const d = lmk("div", "lab-clip", null, box), th = lmk("div", "th", null, d); if (c.thumb) th.style.backgroundImage = `url(${lmedia(null, c.thumb)})`; else th.textContent = c.kind === "audio" ? "♪" : "";
    const inf = lmk("div", "inf", null, d); lmk("b", "", c.name, inf); lmk("small", "", { video: "فيديو", audio: "صوت", image: "صورة" }[c.kind] + (c.kind !== "image" ? " · " + lfmt(c.dur) : "") + (c.w ? " · " + c.w + "×" + c.h : ""), inf);
    const pr = LAB.prog[c.id]; if (pr === -1) lmk("small", "bad", "تعذّر إنشاء المعاينة", inf); else if (c.kind !== "image" && !c.proxy) lmk("small", "", "تجهيز المعاينة " + Math.round((pr || 0) * 100) + "٪", inf);
    const act = lmk("div", "act", null, d), add = (t, tip, fn, cls) => { const b = lmk("button", "mid " + (cls || ""), t, act); b.title = tip; b.onclick = fn; };
    if (c.kind !== "image") add("＋ للتسلسل", "أضفه في نهاية التسلسل (دمج)", () => labAddToSeq(c)); else add("＋ شريحة", "أضفها كجزء في التسلسل", () => labAddToSeq(c));
    if (c.kind === "video" || c.kind === "image") add("مشهد", "ضعه فوق المشهد الحاليّ كمشهد (حضور/مصدر) عند المؤشّر", () => labAddBroll(c));
    if (c.kind === "image") add("صورة مصدر", "ركّبها كصورة بإطار فوق الفيديو عند المؤشّر", () => labAddImage(c));
    if (c.audio) add("♪ موسيقى", "أضفه كصوت خلفيّ", () => labDo(p => { const t = { id: lid("a"), clip: c.id, in: 0, at: 0, vol: .22, duck: true, loop: true, fadeOut: 2 }; p.audio.push(t); LAB.sel = { type: "aud", id: t.id }; }));
    add("✕", "إزالة من المشروع", () => { if (!confirm("إزالة «" + c.name + "» من المشروع؟ (يُحذف ما يستعمله من أجزاء وطبقات)")) return; labDo(p => { p.clips = p.clips.filter(x => x.id !== c.id); p.seq = p.seq.filter(s => s.clip !== c.id); p.ov = p.ov.filter(o => o.clip !== c.id); p.audio = p.audio.filter(a => a.clip !== c.id); }); }, "danger");
  });
}
async function labAddBroll(c) { labDo(p => { const o = { id: lid("o"), type: "broll", clip: c.id, in: 0, start: LAB.t, end: LAB.t + Math.min(6, c.dur || 5), mode: "box", box: [90, 190, 820, 462], shape: labShape(), audio: false }; p.ov.push(o); LAB.sel = { type: "ov", id: o.id }; }); }
async function labAddImage(c) { return labAddOv({ type: "image", clip: c.id, cap: "", pos: "br", w: 28, frame: "paper" }, 5); }

// ---------- الأدوات العامّة ----------
function labToolsTab(box) {
  const acc = (title, open = true) => { const d = lmk("details", "acc", null, box); d.open = open; const s = lmk("summary", "", null, d); lmk("span", "", title, s); return lmk("div", "in lab-in", null, d); };
  const btn = (par, t, fn, tip, cls) => { const b = lmk("button", "mid " + (cls || ""), t, par); if (tip) b.title = tip; b.onclick = fn; return b; };
  let a = acc("القصّ والتحرير");
  btn(a, "✂ تقسيم عند المؤشّر (S)", labSplit); btn(a, "🗑 حذف المحدّد (Del)", labDelete, null, "danger");
  btn(a, "🔇 إزالة السكتات من الجزء المحدّد", () => labSilence(false), "يقصّ الصمت الطويل ويُبقي نَفَساً طبيعياً بين الجمل");
  btn(a, "🔇 إزالة السكتات من كل التسلسل", () => labSilence(true));
  const sl = lmk("div", "lab-sil", null, a);
  lmk("label", "", "حساسيّة الصمت (dB)", sl); const n = lmk("input", "", null, sl); n.type = "number"; n.value = LAB.p.opts.silDb ?? -34; n.onchange = () => labDo(p => p.opts.silDb = +n.value, true);
  lmk("label", "", "أقلّ مدّة للسكتة (ث)", sl); const m = lmk("input", "", null, sl); m.type = "number"; m.step = ".1"; m.value = LAB.p.opts.silMin ?? .5; m.onchange = () => labDo(p => p.opts.silMin = +m.value, true);
  a = acc("إضافة عناصر عند المؤشّر");
  btn(a, "＋ بطاقة اسم", labToolLower); btn(a, "＋ عنوان", labToolTitle); btn(a, "＋ نصّ", labToolText); btn(a, "＋ صور مصادر…", labToolImages, "اختر صوراً من الحاسوب فتُركَّب بإطار ورقة ممزّقة أو بشكل القالب");
  a = acc("صفحات الكتاب (بعد تطبيق مشهد كتاب من «المشروع»)");
  btn(a, "الصفحة التالية عند المؤشّر (])", () => labBookTurn(1)); btn(a, "الصفحة السابقة عند المؤشّر ([)", () => labBookTurn(-1));
  btn(a, "تغيير الكتاب (مكتبتي / الشاملة / PDF)…", async () => { const bk = await labBookDialog(); if (bk) { LAB.p.book = bk; LAB.p.bookPage = 1; labSaveSoon(); toast("اختير: " + bk.title); } });
  a = acc("موسيقى وصوت");
  btn(a, "＋ موسيقى/صوت من الحاسوب…", async () => { const r = await api.call("lab:import", LAB.p.id, "audio"); if (!r.length) return; LAB.p = await api.call("lab:get", LAB.p.id); labDo(p => { const c = r[0], t = { id: lid("a"), clip: c.id, in: 0, at: 0, vol: .22, duck: true, loop: true, fadeOut: 2 }; p.audio.push(t); LAB.sel = { type: "aud", id: t.id }; }); });
  a = acc("الانتقال والإطار");
  lmk("p", "hint", "حدّد جزءاً في الخطّ الزمنيّ ثم اختر انتقاله وتخطيطه من اللوحة اليمنى. «إطار جانبيّ» يضع الفيديو في إطار بشكل فوق خلفيّة القالب.", a);
  const f = lmk("label", "lab-chk", null, a); const ck = lmk("input", "", null, f); ck.type = "checkbox"; ck.checked = !!LAB.p.opts.autoTrans; ck.onchange = () => labDo(p => p.opts.autoTrans = ck.checked, true); lmk("span", "", "انتقال تلاشٍ تلقائيّ عند دمج مقطع جديد", f);
}
async function labSilence(all) {
  const T = ltl(), targets = all ? T.items.map(i => i.s).filter(s => s.type !== "still" && (lclip(s.clip) || {}).audio) : [LAB.sel && LAB.sel.type === "seg" ? LAB.p.seq.find(s => s.id === LAB.sel.id) : null].filter(Boolean);
  if (!targets.length) { toast("حدّد جزءاً فيه صوت"); return; }
  const opt = { noise: LAB.p.opts.silDb ?? -34, minSil: LAB.p.opts.silMin ?? .5 }; let removed = 0; const res = [];
  for (const s of targets) { labProg(.1, "كشف السكتات…"); try { const r = await api.call("lab:silence", LAB.p.id, s.clip, s.in, s.out, opt); res.push([s, r]); } catch (e) { toast(e.message); } }
  labProg(1);
  labDo(p => {
    for (const [s0, r] of res) { const i = p.seq.findIndex(x => x.id === s0.id); if (i < 0 || !r.keep.length) continue; const base = p.seq[i], parts = r.keep.map((k, j) => Object.assign(JSON.parse(JSON.stringify(base)), { id: j ? lid("s") : base.id, in: k[0], out: k[1], trans: j ? null : base.trans })); removed += (base.out - base.in) - r.keep.reduce((a, k) => a + k[1] - k[0], 0); p.seq.splice(i, 1, ...parts); parts.slice(1).forEach(q => labCloneScn(p, base.id, q.id)); }
  });
  toast("حُذف " + Math.round(removed) + " ثانية من السكتات", 5000);
}
async function labToolLower() { const T = labTexts(); const f = await askForm("بطاقة اسم", [{ k: "name", label: "الاسم", val: T.sheikh }, { k: "role", label: "اللقب / الصفة", val: T["sheikh-title"] }, { k: "dur", label: "المدّة (ث)", val: "6", type: "number" }], "إضافة"); if (f) labAddOv({ type: "lower", name: f.name, role: f.role, side: "right" }, +f.dur || 6); }
async function labToolTitle() { const f = await askForm("عنوان", [{ k: "t", label: "العنوان", val: LAB.p.name }, { k: "s", label: "سطر فرعيّ (اختياريّ)", val: "" }, { k: "dur", label: "المدّة (ث)", val: "5", type: "number" }], "إضافة"); if (f) labAddOv({ type: "title", t: f.t, s: f.s }, +f.dur || 5); }
async function labToolText() { const f = await askForm("نصّ على الفيديو", [{ k: "t", label: "النصّ", val: "" }, { k: "dur", label: "المدّة (ث)", val: "5", type: "number" }], "إضافة"); if (f && f.t) labAddOv({ type: "text", t: f.t, pos: "bottom" }, +f.dur || 5); }
async function labToolImages() {
  const r = await api.call("lab:import", LAB.p.id, "image"); if (!r.length) return; LAB.p = await api.call("lab:get", LAB.p.id);
  let t = LAB.t; for (const c of r) { await labAddOv({ type: "image", clip: c.id, cap: "", pos: "br", w: 28, frame: "paper", start: t, end: t + 5 }); t += 5.4; }
}
async function labToolScreen(kind, atStart, mid) {
  labProg(.05, "رسم الشاشة…"); let png; try { png = await labPngRaw(labSpec({ type: "screen", kind })); } finally { labProg(1); }
  labDo(p => { const s = { id: lid("s"), type: "still", png, kind, dur: kind === "intro" ? 8 : 6, layout: { mode: "full" } }; if (atStart) { p.seq.unshift(s); if (p.seq[1]) p.seq[1].trans = { type: "fade", d: .6 }; } else if (mid) labInsertStill(p, s); else p.seq.push(Object.assign(s, { trans: { type: "fade", d: .6 } })); LAB.sel = { type: "seg", id: s.id }; });
  if (atStart) { /* الطبقات بأزمنة مطلقة: نزيحها بمقدار الشاشة المضافة */ labDo(p => p.ov.forEach(o => { o.start += 8 - .6; o.end += 8 - .6; })); }
}

// ---------- أدوات النوع ----------
function labKindTab(box) {
  const k = LAB.p.kind, acc = (title, open = true) => { const d = lmk("details", "acc", null, box); d.open = open; const s = lmk("summary", "", null, d); lmk("span", "", title, s); return lmk("div", "in lab-in", null, d); };
  const btn = (par, t, fn, tip, cls) => { const b = lmk("button", "mid " + (cls || ""), t, par); if (tip) b.title = tip; b.onclick = fn; return b; };
  if (k === "quran") labQuranPanel(acc, btn);
  if (k === "reply") labReplyPanel(acc, btn);
  if (k === "audio") { const a = acc("مشروع صوتيّ"); lmk("p", "hint", "أضف ملفّ الصوت من الوسائط ثم «＋ للتسلسل»: يُنشأ فيديو بخلفيّة القالب، ثم أضف بطاقات الاسم والعناوين والصور المصادر والانتقالات. للإضافة عند الزمن: ضع المؤشّر ثم اضغط الزرّ.", a); btn(a, "＋ بطاقة اسم", labToolLower); btn(a, "＋ عنوان", labToolTitle); btn(a, "＋ صور مصادر…", labToolImages); btn(a, "＋ شاشة مقدّمة", () => labToolScreen("intro", true)); }
}
function labSetLayout(L) { const s = LAB.sel && LAB.sel.type === "seg" ? LAB.p.seq.find(x => x.id === LAB.sel.id) : null; if (!s) { toast("حدّد جزءاً في الخطّ الزمنيّ أوّلاً"); return; } labDo(() => { s.layout = L; }); }
async function labBox(side) {
  await labEnsureBg(); labSetLayout({ mode: "box", box: side === "right" ? [1170, 140, 680, 800] : [70, 140, 680, 800], shape: labShape(), bg: LAB.p.bgPng });
}

// ---------- القرآن ----------
function labQuranPanel(acc, btn) {
  const q = LAB.p.quran || (LAB.p.quran = { s: 1, a: 1, pos: "bottom" });
  const a = acc("الآيات على التلاوة");
  const render = () => { };
  QU.load().then(() => {
    const selS = lmk("select", "", null, a); selS.innerHTML = QU.db.suras.map(x => `<option value="${x.n}">${QU.AR(x.n)}. ${x.name}</option>`).join(""); selS.value = q.s;
    const selA = lmk("select", "", null, a), fillA = () => { const n = QU.N(+selS.value); selA.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">الآية ${QU.AR(i + 1)}</option>`).join(""); selA.value = Math.min(q.a, n); };
    fillA(); selS.onchange = () => { q.s = +selS.value; q.a = 1; fillA(); labSaveSoon(); }; selA.onchange = () => { q.a = +selA.value; labSaveSoon(); };
    lmk("p", "hint", "اختر السورة والآية التي يبدأ منها المقطع، ثم «مطابقة تلقائيّة»: يفرّغ البرنامج التلاوة بخدمة Groq ويطابقها مع المصحف فيضع كلّ آية في وقتها. راجع الأزمنة بعدها وعدّلها بالسحب.", a);
    btn(a, "⚡ مطابقة الآيات تلقائياً مع التلاوة", async () => {
      const s = LAB.sel && LAB.sel.type === "seg" ? LAB.p.seq.find(x => x.id === LAB.sel.id) : LAB.p.seq.find(x => x.clip && (lclip(x.clip) || {}).audio); if (!s || s.type === "still") { toast("حدّد جزءاً من التلاوة"); return; }
      labProg(.02, "تفريغ التلاوة…"); let r; try { r = await api.call("lab:quranAlign", LAB.p.id, s.clip, s.in, s.out, { s: +selS.value, a: +selA.value }); } catch (e) { labProg(1); toast(e.message, 8000); return; } labProg(1);
      if (!r.verses.length) { toast("لم تُطابَق آيات — تأكّد من السورة والآية الأولى ووضوح الصوت"); return; }
      const T = ltl().items.find(i => i.s.id === s.id), toOut = t => T.start + (t - s.in) / (s.speed || 1);
      const made = []; for (const v of r.verses) {
        const n = QU.parts(v.s, v.a).filter(x => !x.bsm).length, hasB = QU.parts(v.s, v.a)[0].bsm ? 1 : 0, st = toOut(v.start), en = toOut(v.end), dur = en - st; if (dur <= .2) continue;
        const words = QU.parts(v.s, v.a).filter(x => !x.bsm).map(x => x.t.split(" ").length), tot = words.reduce((x, y) => x + y, 0); let t0 = st;
        for (let i = 0; i < n; i++) { const d = dur * words[i] / tot; made.push({ type: "verse", s: v.s, a: v.a, p: i + hasB, pos: q.pos || "bottom", start: t0, end: t0 + d, z: 5 }); t0 += d; }
      }
      toast("وُضعت " + made.length + " طبقة آية — يجري رسمها…", 4000);
      let k = 0; for (const o of made) { o.id = lid("o"); labProg(k++ / made.length, `رسم الآيات ${k} / ${made.length}`); try { o.png = await labPngRaw(labSpec(o)); } catch {} }
      labProg(1); labDo(p => { p.ov = p.ov.filter(o => o.type !== "verse" || o.end <= T.start || o.start >= T.end).concat(made.filter(o => o.png)); }); toast("تمّت مطابقة " + r.verses.length + " آية", 5000);
    }, "يحتاج مفتاح Groq واتّصالاً بالإنترنت", "pri");
    btn(a, "＋ آية يدويّاً عند المؤشّر", async () => { const t = QU.clampRef({ s: +selS.value, a: +selA.value, p: 0 }); await labAddOv({ type: "verse", s: t.s, a: t.a, p: QU.parts(t.s, t.a)[0].bsm ? 1 : 0, pos: q.pos || "bottom", z: 5 }, 5); });
    const st = acc("نمط عرض الآيات ومشهد الفيديو");
    const pos = lmk("div", "podchips", null, st); [["bottom", "أسفل"], ["top", "أعلى"], ["side", "بجانب القارئ"], ["frame", "في إطار"]].forEach(([k, n]) => { const b = lmk("button", (q.pos || "bottom") === k ? "on" : "", n, pos); b.onclick = async () => { q.pos = k; labSaveSoon(); await labApplyVersePos(k); labLeftPaint(); }; });
    lmk("p", "hint", "يغيّر موضع كل الآيات الموجودة ويضبط مشهد الفيديو: «أسفل/أعلى» الفيديو بملء الشاشة، و«بجانب/في إطار» الفيديو في إطار جانبيّ والآية بجانبه.", st);
  });
}
async function labApplyVersePos(pos) {
  const vs = LAB.p.ov.filter(o => o.type === "verse"); if (!vs.length) return;
  let k = 0; for (const o of vs) { o.pos = pos; labProg(k++ / vs.length, `إعادة رسم الآيات ${k} / ${vs.length}`); try { o.png = await labPngRaw(labSpec(o)); o.rev = (o.rev || 0) + 1; } catch {} }
  labProg(1);
  if (pos === "side" || pos === "frame") await labEnsureBg();
  labDo(p => p.seq.forEach(s => { if (s.type === "still") return; s.layout = pos === "side" || pos === "frame" ? { mode: "box", box: [1170, 140, 680, 800], shape: labShape(), bg: p.bgPng } : { mode: "full", fit: "cover" }; }));
}

// ---------- الردّ ----------
function labReplyPanel(acc, btn) {
  const a = acc("إنشاء مقطع ردّ");
  lmk("p", "hint", "المقطع المردود عليه يُعرض في إطار جانبيّ بجانب العنوان، ثم يبدأ الردّ بملء الشاشة. بعدها أضف صور المصادر أثناء الردّ من «الأدوات ← صور مصادر».", a);
  const vids = LAB.p.clips.filter(c => c.kind !== "image");
  if (vids.length < 2) { lmk("p", "hint bad", "استورد مقطعين على الأقلّ: المردود عليه ومقطع الردّ.", a); return; }
  const sel = (label, def) => { const l = lmk("label", "fld", label, a), s = lmk("select", "", null, l); s.innerHTML = vids.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""); s.value = def; return s; };
  const sq = sel("المقطع المردود عليه", vids[0].id), sr = sel("مقطع الردّ", vids[1].id);
  const num = (label, v) => { const l = lmk("label", "fld", label, a), i = lmk("input", "", null, l); i.type = "number"; i.value = v; i.step = ".5"; return i; };
  const qa = num("بداية المردود عليه (ث)", 0), qb = num("نهايته (ث)", Math.min(30, vids[0].dur || 30));
  const tt = lmk("label", "fld", "عنوان الردّ", a), ti = lmk("input", "", null, tt); ti.value = "ردّ على مقطع";
  const sub = lmk("label", "fld", "المردود عليه (اسم/وصف)", a), si = lmk("input", "", null, sub);
  btn(a, "⚡ إنشاء التسلسل", async () => {
    const cq = lclip(sq.value), cr = lclip(sr.value); await labEnsureBg();
    const side = await labPng({ page: "lab.html", params: { kind: "side", l: "المقطع المردود عليه", t: ti.value, s: si.value }, tag: "reply" });
    const o = { id: lid("o"), type: "side", png: side };
    labDo(p => {
      const s1 = { id: lid("s"), clip: cq.id, in: +qa.value || 0, out: Math.min(cq.dur, +qb.value || 30), layout: { mode: "box", box: [90, 250, 820, 462], shape: labShape(), bg: p.bgPng } };
      const s2 = { id: lid("s"), clip: cr.id, in: 0, out: cr.dur, layout: { mode: "full" }, trans: { type: "fade", d: .6 } };
      p.seq = [s1, s2]; const d1 = s1.out - s1.in; o.start = 0; o.end = d1 - .3; p.ov = p.ov.filter(x => x.type !== "side").concat([o]); LAB.sel = { type: "seg", id: s1.id };
    }); toast("أُنشئ التسلسل: المردود عليه ثمّ الردّ", 5000);
  }, null, "pri");
}

// ---------- المفتّش ----------
function labInspPaint() {
  const box = $("leInsp"); if (!box) return; box.innerHTML = ""; const sel = LAB.sel, p = LAB.p;
  const fld = (par, label, node) => { const l = lmk("label", "fld", label, par); l.appendChild(node); return l; };
  const num = (par, label, v, fn, step = .1) => { const i = lmk("input"); i.type = "number"; i.step = step; i.value = +(+v).toFixed(2); i.onchange = () => fn(+i.value); fld(par, label, i); return i; };
  const txt = (par, label, v, fn) => { const i = lmk("input"); i.value = v || ""; let t; i.oninput = () => { clearTimeout(t); t = setTimeout(() => fn(i.value), 650); }; fld(par, label, i); return i; };
  const selc = (par, label, opts, v, fn) => { const s = lmk("select"); s.innerHTML = opts.map(([k, n]) => `<option value="${k}">${n}</option>`).join(""); s.value = v; s.onchange = () => fn(s.value); fld(par, label, s); return s; };
  lmk("h3", "", sel ? { seg: "الجزء المحدّد", ov: "الطبقة المحدّدة", aud: "الصوت المحدّد" }[sel.type] : "المفتّش", box);
  if (!sel) { lmk("p", "hint", "حدّد جزءاً أو طبقة في الخطّ الزمنيّ لتعديل خصائصها. اسحب حافّة الجزء لقصّه، واسحب الطبقة لنقلها أو تغيير مدّتها. المسافة تشغيل/إيقاف، S تقسيم، Del حذف.", box); return; }
  if (sel.type === "seg") {
    const s = p.seq.find(x => x.id === sel.id); if (!s) return; const c = s.clip && lclip(s.clip);
    if (s.type === "still") { num(box, "المدّة (ث)", s.dur, v => labDo(() => s.dur = Math.max(.5, v)), .5); }
    else {
      num(box, "من (ث)", s.in, v => labDo(() => s.in = Math.max(0, Math.min(s.out - .2, v)))); num(box, "إلى (ث)", s.out, v => labDo(() => s.out = Math.max(s.in + .2, Math.min(c.dur, v))));
      num(box, "السرعة ×", s.speed || 1, v => labDo(() => s.speed = Math.max(.25, Math.min(4, v))), .05);
      if (c && c.audio) { num(box, "مستوى الصوت", s.vol ?? 1, v => labDo(() => s.vol = Math.max(0, Math.min(2, v))), .1); const l = lmk("label", "lab-chk", null, box), k = lmk("input", "", null, l); k.type = "checkbox"; k.checked = !!s.mute; k.onchange = () => labDo(() => s.mute = k.checked); lmk("span", "", "كتم", l); }
      const L = s.layout || { mode: "full" };
      selc(box, "التخطيط", [["full", "ملء الشاشة (مع خلفيّة مغبّشة)"], ["cover", "ملء الشاشة بالقصّ"], ["box", "إطار جانبيّ"]], L.mode === "box" ? "box" : L.fit === "cover" ? "cover" : "full", v => { if (v === "box") labBox("right"); else labSetLayout(v === "cover" ? { mode: "full", fit: "cover" } : { mode: "full" }); });
    }
    const T = ltl().items; const idx = p.seq.findIndex(x => x.id === s.id);
    if (idx > 0) { selc(box, "الانتقال من السابق", [["", "قصّ مباشر"], ["fade", "تلاشٍ"], ["dissolve", "ذوبان"], ["dip", "عبر الأسود"], ["wipe", "مسح"], ["slide", "انزلاق"]], (s.trans && s.trans.type) || "", v => labDo(() => { s.trans = v ? { type: v, d: (s.trans && s.trans.d) || .6 } : null; })); if (s.trans) num(box, "مدّة الانتقال (ث)", s.trans.d, v => labDo(() => s.trans.d = Math.max(.1, Math.min(2, v)))); }
    const row = lmk("div", "lab-btnrow", null, box);
    const mv = lmk("button", "mid", "◂ تقديم", row); mv.onclick = () => labDo(() => { if (idx > 0) { [p.seq[idx - 1], p.seq[idx]] = [p.seq[idx], p.seq[idx - 1]]; } }); const mb = lmk("button", "mid", "تأخير ▸", row); mb.onclick = () => labDo(() => { if (idx < p.seq.length - 1) { [p.seq[idx + 1], p.seq[idx]] = [p.seq[idx], p.seq[idx + 1]]; } });
    const sp = lmk("button", "mid", "✂ تقسيم", row); sp.onclick = labSplit; const dl = lmk("button", "mid danger", "🗑 حذف", row); dl.onclick = labDelete;
  } else if (sel.type === "ov") {
    const o = p.ov.find(x => x.id === sel.id); if (!o) return;
    lmk("p", "hint", labOvName(o), box);
    num(box, "يبدأ (ث)", o.start, v => labDo(() => { const d = o.end - o.start; o.start = Math.max(0, v); o.end = o.start + d; })); num(box, "ينتهي (ث)", o.end, v => labDo(() => o.end = Math.max(o.start + .3, v)));
    const redo = () => labRedraw(o);
    if (o.type === "lower") { txt(box, "الاسم", o.name, v => { o.name = v; redo(); }); txt(box, "اللقب", o.role, v => { o.role = v; redo(); }); selc(box, "الجهة", [["right", "يمين"], ["left", "يسار"]], o.side || "right", v => { o.side = v; redo(); }); }
    if (o.type === "title") { txt(box, "العنوان", o.t, v => { o.t = v; redo(); }); txt(box, "السطر الفرعيّ", o.s, v => { o.s = v; redo(); }); }
    if (o.type === "text" || o.type === "tag") { txt(box, "النصّ", o.t, v => { o.t = v; redo(); }); if (o.type === "text") selc(box, "الموضع", [["bottom", "أسفل"], ["top", "أعلى"]], o.pos || "bottom", v => { o.pos = v; redo(); }); }
    if (o.type === "image") {
      txt(box, "التعليق (تحت الصورة)", o.cap, v => { o.cap = v; redo(); });
      selc(box, "الموضع", [["tl", "أعلى يسار"], ["tc", "أعلى وسط"], ["tr", "أعلى يمين"], ["ml", "وسط يسار"], ["mc", "الوسط"], ["mr", "وسط يمين"], ["bl", "أسفل يسار"], ["bc", "أسفل وسط"], ["br", "أسفل يمين"]], o.pos || "br", v => { o.pos = v; redo(); });
      num(box, "الحجم ٪", o.w || 28, v => { o.w = Math.max(10, Math.min(70, v)); redo(); }, 1);
      selc(box, "الإطار", [["paper", "ورقة ممزّقة"], ["shape", "بشكل القالب"]], o.frame || "paper", v => { o.frame = v; redo(); });
    }
    if (o.type === "book") {
      lmk("p", "hint", "📖 " + ((o.book && o.book.title) || ""), box);
      num(box, "رقم الصفحة", o.page || 1, v => { o.page = Math.max(1, Math.round(v)); LAB.p.bookPage = o.page; redo(); }, 1);
      const sw = lmk("div", "lab-btnrow", null, box); lmk("button", "mid", "◂ الصفحة السابقة", sw).onclick = () => { o.page = Math.max(1, (o.page || 1) - 2); LAB.p.bookPage = o.page; redo().then(labInspPaint); }; lmk("button", "mid", "الصفحة التالية ▸", sw).onclick = () => { o.page = (o.page || 1) + 2; LAB.p.bookPage = o.page; redo().then(labInspPaint); };
      lmk("button", "mid", "تبديل الكتاب…", box).onclick = async () => { const bk = await labBookDialog(); if (!bk) return; labDo(() => { LAB.p.book = bk; p.ov.filter(x => x.type === "book").forEach(x => { x.book = bk; x.page = 1; }); }); for (const x of p.ov.filter(x => x.type === "book")) await labRedraw(x); labInspPaint(); };
    }
    if (o.type === "verse") {
      selc(box, "الموضع", [["bottom", "أسفل"], ["top", "أعلى"], ["side", "بجانب القارئ"], ["frame", "في إطار"]], o.pos || "bottom", v => { o.pos = v; redo(); });
      const sw = lmk("div", "lab-btnrow", null, box); const pv = lmk("button", "mid", "◂ الآية السابقة", sw), nx = lmk("button", "mid", "الآية التالية ▸", sw);
      const step = d => { const r = QU.step({ s: o.s, a: o.a, p: o.p || 0, scope: "all" }, d); o.s = r.s; o.a = r.a; o.p = r.p; redo(); labInspPaint(); }; pv.onclick = () => step(-1); nx.onclick = () => step(1);
    }
    if (o.type === "broll") {
      selc(box, "العرض", [["full", "ملء الشاشة"], ["box", "في إطار"]], o.mode || "box", v => labDo(() => o.mode = v)); num(box, "يبدأ المقطع من (ث)", o.in || 0, v => labDo(() => o.in = Math.max(0, v)));
      const l = lmk("label", "lab-chk", null, box), k = lmk("input", "", null, l); k.type = "checkbox"; k.checked = !!o.audio; k.onchange = () => labDo(() => o.audio = k.checked); lmk("span", "", "تشغيل صوت هذا المقطع", l);
    }
    const dl = lmk("button", "mid danger", "🗑 حذف الطبقة", box); dl.onclick = labDelete;
  } else if (sel.type === "aud") {
    const a = p.audio.find(x => x.id === sel.id); if (!a) return; const c = lclip(a.clip);
    lmk("p", "hint", "♪ " + (c ? c.name : ""), box);
    num(box, "يبدأ عند (ث)", a.at || 0, v => labDo(() => a.at = Math.max(0, v))); num(box, "من (ث) داخل الملفّ", a.in || 0, v => labDo(() => a.in = Math.max(0, v)));
    num(box, "مستوى الصوت", a.vol ?? .22, v => labDo(() => a.vol = Math.max(0, Math.min(2, v))), .05); num(box, "تلاشي النهاية (ث)", a.fadeOut || 0, v => labDo(() => a.fadeOut = Math.max(0, v)), .5);
    const l = lmk("label", "lab-chk", null, box), k = lmk("input", "", null, l); k.type = "checkbox"; k.checked = !!a.duck; k.onchange = () => labDo(() => a.duck = k.checked); lmk("span", "", "تخفيض تلقائيّ تحت الكلام", l);
    const l2 = lmk("label", "lab-chk", null, box), k2 = lmk("input", "", null, l2); k2.type = "checkbox"; k2.checked = !!a.loop; k2.onchange = () => labDo(() => a.loop = k2.checked); lmk("span", "", "تكرار حتى النهاية", l2);
    const dl = lmk("button", "mid danger", "🗑 حذف", box); dl.onclick = labDelete;
  }
}
