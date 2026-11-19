// «معمل المجالس» — تبويبا «المشروع» (اسم الدرس والشيخ…) و«القوالب» (الألوان والخطّ والإطار + قوالب جاهزة).
const LAB_FIELDS = {
  lesson: [["halaqa", "اسم الحلقة", ""], ["mosque", "المسجد / الجهة", ""], ["program", "الدورة / البرنامج", ""], ["book", "الكتاب", ""], ["scope", "الباب / المقطع", ""], ["session", "المجلس", ""], ["date", "التاريخ", ""], ["start", "وقت البدء", ""], ["next", "موعد المجلس القادم", ""], ["sheikh-title", "لقب الشيخ", "فضيلة الشيخ"], ["sheikh", "اسم الشيخ", ""], ["sheikh-post", "منصب الشيخ (سطر ثانٍ)", ""]],
  khutba: [["program", "عنوان الخطبة", "خطبة الجمعة"], ["scope", "المسجد / المكان", ""], ["session", "التاريخ", ""], ["sheikh-title", "لقب الخطيب", "فضيلة الشيخ"], ["sheikh", "اسم الخطيب", ""]],
  quran: [["program", "العنوان", "معرض القرآن الكريم"], ["scope", "الجهة / المكان", ""], ["session", "التاريخ / المناسبة", ""], ["sheikh-title", "لقب القارئ", "القارئ"], ["sheikh", "اسم القارئ", ""]],
  reply: [["program", "عنوان الردّ", ""], ["scope", "الجهة / القناة", ""], ["session", "التاريخ", ""], ["sheikh-title", "لقب المجيب", "فضيلة الشيخ"], ["sheikh", "اسم المجيب", ""]],
};
const LAB_MODE_LESSONS = ["lesson", "reply", "free", "audio"];
const labFieldsOf = k => LAB_FIELDS[k] || [["program", "العنوان", ""], ["scope", "الجهة / المكان", ""], ["session", "التاريخ", ""], ["sheikh-title", "اللقب / الصفة", ""], ["sheikh", "الاسم", ""]];
const labShape = () => (LAB.live && LAB.live.frame) || "arch";
function labDesignObj() { const d = {}, o = {}; if (d.theme) { o.theme = d.theme; o.custom = null; } if (d.font) o.font = d.font; if (d.frame) o.frame = d.frame; return Object.keys(o).length ? o : null; }
function labPngRaw(spec) { const d = labDesignObj(); if (d) spec.ovr = Object.assign({}, spec.ovr, { design: d }); return api.call("lab:png", LAB.p.id, spec); }

// ---------- تبويب «المشروع» ----------
// نوع المقطع يحدّد قسم الإعدادات (الدروس / الخطب / المحاضرات / القرآن) ومشاهده وقوالبه وحقوله
const LAB_KINDS = [["lesson", "درس", "حلقة وكتاب ومجلس"], ["khutba", "خطبة", "مسجد وخطيب"], ["lecture", "محاضرة", "محاضر وجهة"], ["quran", "قرآن كريم", "آيات وقارئ"], ["free", "مقطع حرّ", "بلا قالب جاهز"]];
async function labSetKind(k) {
  if (LAB.p.kind === k) return;
  const mode = LKMODE[k] || "lessons";
  labDo(p => { p.kind = k; }, true);
  ST.settings = await api.call("lab:sbx:patch", LAB.p.id, { mode });
  const t = lq(".lab-kind"); if (t) t.textContent = LK[k];
  LAB.live = await api.call("lab:live", k, LAB.p.id);
  labLeftPaint(); labApplySbx(); toast("طُبّقت إعدادات «" + LK[k] + "»", 3500);
}
function labProjectTab(box) {
  const k = LAB.p.kind, lt = labLiveTexts(), T = labTexts();
  lmk("h4", "lab-h4", "ما نوع هذا المقطع؟", box);
  const kg = lmk("div", "lab-kinds", null, box);
  LAB_KINDS.forEach(([key, n, sub]) => { const b = lmk("button", "lab-kd" + ((k === key || (key === "lesson" && (k === "reply" || k === "audio"))) ? " on" : ""), null, kg); lmk("b", "", n, b); lmk("small", "", sub, b); b.onclick = () => labSetKind(key); });
  lmk("p", "hint", "يطبّق النوع إعدادات قسمه (نصوص الحلقة أو الخطبة أو المحاضرة أو التلاوة) ومشاهده وقوالبه. عدّل التفاصيل من «ضبط الحلقة» و«ضبط الدرس» و«الشكل».", box);
  const card = lmk("div", "lab-live", null, box);
  lmk("b", "", lt.program || "— لم يُضبط العنوان —", card); lmk("small", "", [lt["sheikh-title"], lt.sheikh].filter(Boolean).join(" ") || "— لم يُضبط الاسم —", card); lmk("small", "", [lt.scope, lt.session].filter(Boolean).join(" · "), card);
  const rr = lmk("div", "lab-btnrow", null, box);
  lmk("button", "mid pri", "↻ تطبيق على كل الطبقات", rr).onclick = labRefreshLive;
  lmk("button", "mid", "مزامنة من إعدادات البثّ", rr).onclick = async () => { if (!confirm("استبدال إعدادات هذا المشروع بنسخة جديدة من البثّ الحاليّ؟ (تُفقد تعديلات المشروع)")) return; await api.call("lab:sbx:resync", LAB.p.id); ST.settings = await api.call("lab:sbx:patch", LAB.p.id, { mode: LKMODE[LAB.p.kind] || "lessons" }); await labApplySbx(); labLeftPaint(); };
  if (k !== "quran" && k !== "free") {
    lmk("h4", "lab-h4", "مشهد الجزء المحدّد", box);
    const sc = lmk("div", "lab-scenes", null, box);
    [["sheikh", k === "khutba" ? "الخطيب" : "المتحدّث"], ["card", "الكتاب + المتحدّث"], ["page", "صفحة + المتحدّث"], ["open", "الكتاب مفتوح"]].filter(([key]) => k !== "khutba" || key === "sheikh").forEach(([key, n]) => { const b = lmk("button", "lab-sc", n, sc); b.onclick = () => labScene(key, LAB.scMode || "sel"); });
    const md = lmk("div", "podchips", null, box); LAB.scMode = LAB.scMode || "all";
    [["all", "كل الفيديو"], ["sel", "الجزء المحدّد"], ["cursor", "من المؤشّر"]].forEach(([m, n]) => { const b = lmk("button", LAB.scMode === m ? "on" : "", n, md); b.onclick = () => { LAB.scMode = m; labLeftPaint(); }; });
    lmk("p", "hint", "اسم الخطيب وعنوان الخطبة (من ضبط الدرس) يظهران طوال المشهد. «كل الفيديو» يطبّق المشهد على كل الأجزاء، و«من المؤشّر» يقسم عنده ويبدّل مشهد ما بعده، فتنتقل بين المشاهد على طول الفيديو. تتبع الطبقات الأجزاء تلقائياً عند القصّ والتقسيم وحذف السكتات.", box);
  }
  lmk("h4", "lab-h4", "الشاشات والبطاقات", box);
  const row = lmk("div", "lab-btnrow", null, box);
  if (k !== "free") {
    lmk("button", "mid pri", "＋ قبل البثّ (في البداية)", row).onclick = () => labToolScreen("intro", true);
    if (k !== "khutba" && k !== "quran") lmk("button", "mid", "＋ استراحة (عند المؤشّر)", row).onclick = () => labToolScreen("break", false, true);
    lmk("button", "mid", "＋ الختام (في النهاية)", row).onclick = () => labToolScreen("outro", false);
  }
  lmk("button", "mid", "＋ بطاقة اسم عند المؤشّر", row).onclick = () => labAddOv({ type: "lower", name: T.sheikh, role: T["sheikh-title"], side: "right" }, 6);
  lmk("button", "mid", "＋ عنوان عند المؤشّر", row).onclick = () => labAddOv({ type: "title", t: T.program || LAB.p.name, s: T.session }, 5);
  if (k !== "free") {
    lmk("h4", "lab-h4", "قوالب جاهزة", box);
    const tp = (title, desc, fn) => { const b = lmk("button", "lab-tpl", null, box); lmk("b", "", title, b); lmk("small", "", desc, b); b.onclick = fn; };
    tp("مقدّمة + بطاقة الاسم + ختام", "شاشة مقدّمة ثمّ بطاقة اسم وشاشة ختام ببيانات المشروع", () => labTemplate("classic"));
    tp("بطاقة الاسم + العنوان", "بطاقة اسم وعنوان في أوّل الفيديو بلا شاشات", () => labTemplate("lite"));
  }
  const ex = lmk("details", "acc", null, box); ex.open = k === "quran"; const sm = lmk("summary", "", null, ex); lmk("span", "", k === "quran" ? "الآيات على التلاوة" : "أنواع خاصّة: ردّ على مقطع / صوتيّ", sm);
  const inn = lmk("div", "in lab-in", null, ex);
  const acc = (title) => { const d = lmk("details", "acc", null, inn); d.open = true; lmk("summary", "", null, d).appendChild(lmk("span", "", title)); return lmk("div", "in lab-in", null, d); };
  const btn = (par, t, fn, tip, cls) => { const b = lmk("button", "mid " + (cls || ""), t, par); if (tip) b.title = tip; b.onclick = fn; return b; };
  if (k === "quran") labQuranPanel(acc, btn);
  else { labReplyPanel(acc, btn); }
}
async function labRefreshLive() { LAB.live = await api.call("lab:live", LAB.p.kind, LAB.p.id); await labRerenderAll(); labLeftPaint(); }
function labInsertStill(p, s) {
  const T = ltl(), cur = lsegAt(T, LAB.t), d = lsegDur(s); let at = p.seq.length;
  if (cur) { const i = p.seq.findIndex(x => x.id === cur.s.id), sg = cur.s; if (sg.type !== "still" && LAB.t > cur.start + .3 && LAB.t < cur.end - .3) { const cutAt = sg.in + (LAB.t - cur.start) * (sg.speed || 1), b = Object.assign(JSON.parse(JSON.stringify(sg)), { id: lid("s"), in: cutAt, trans: null }); sg.out = cutAt; p.seq.splice(i + 1, 0, b); at = i + 1; } else at = LAB.t <= cur.start + .3 ? i : i + 1; }
  p.seq.splice(at, 0, s); s.trans = { type: "fade", d: .5 }; const t0 = LAB.t;
  p.ov.forEach(o => { if (o.start >= t0 - .01) { o.start += d; o.end += d; } });
  LAB.sel = { type: "seg", id: s.id };
}

// ---------- مشاهد الدرس الحيّة ----------
// نفس تخطيطات غرفة التحكّم (الشيخ، الكتاب+الشيخ، صفحة+الشيخ، الكتاب مفتوح): فيديو الجزء المحدّد + إطار البثّ وبطاقة الشيخ (frame.html) + الكتاب
// يطبّق مشهداً على جزء: إطار البثّ (اسم الخطيب/الشيخ + عنوان الخطبة أو الدرس) + الكتاب إن لزم. الطبقات مرتبطة بالجزء فتتبعه عند القصّ والتقسيم
async function labSceneSeg(s, key, ctx) {
  const { lv, bk, bmode } = ctx, Ly = lv.layout, side = lv.side, shape = labShape();
  let bookR = null, cam = null, pageR = null;
  if (key === "card") { bookR = Ly.card.book; cam = Ly.card.cam; } else if (key === "open") { bookR = Ly.open.book; cam = Ly.open.cam; }
  else if (key === "page") { bookR = Ly.page.page; pageR = Ly.page.page; cam = side === "left" ? [1920 - 820 - 1044, 40, 1044, 1000] : [820, 40, 1044, 1000]; }
  const fr = { type: "frame", l: key, side, z: 8, start: 0, end: 1, scn: s.id };
  if (key === "card") { fr.bookR = bookR; fr.camR = cam; } else if (key === "open") fr.camR = cam; else if (key === "page") fr.pageR = pageR;
  fr.id = lid("o"); fr.png = await labPngRaw(labSpec(fr));
  let bo = null;
  if (bmode) { bo = { id: lid("o"), type: "book", book: bk, bmode, page: LAB.p.bookPage || 1, box: bookR, at: [bookR[0], bookR[1]], size: [bookR[2], bookR[3]], start: 0, end: 1, z: 3, scn: s.id }; bo.png = await labPngRaw(labBookSpec(bo)); }
  return { fr, bo, layout: key === "sheikh" ? { mode: "full", fit: "cover", scene: key } : { mode: "box", box: cam, shape, bg: LAB.p.bgPng, scene: key } };
}
const LAB_SCN_NAME = { sheikh: "المتحدّث", card: "الكتاب + المتحدّث", page: "صفحة + المتحدّث", open: "الكتاب مفتوح" };
// mode: "sel" الجزء المحدّد | "all" كل الفيديو | "cursor" من المؤشّر (يُقسَّم الجزء عنده ويُبدَّل مشهد ما بعده)
async function labScene(key, mode = "sel") {
  const vids = () => LAB.p.seq.filter(x => x.type !== "still");
  if (!vids().length) { toast("أضف مقطعاً أوّلاً"); return; }
  if (mode === "cursor") { const it = lsegAt(ltl(), LAB.t); if (it && it.s.type !== "still" && LAB.t > it.start + .2 && LAB.t < it.end - .2) { labSplit(); await new Promise(r => setTimeout(r, 50)); } else if (!it || it.s.type === "still") { toast("ضع المؤشّر داخل جزء فيديو"); return; } }
  let targets;
  if (mode === "all") targets = vids();
  else if (mode === "cursor") { const it = lsegAt(ltl(), LAB.t + .01); targets = it && it.s.type !== "still" ? [it.s] : []; }
  else { const sel = LAB.sel && LAB.sel.type === "seg" ? LAB.p.seq.find(x => x.id === LAB.sel.id) : null; targets = [sel && sel.type !== "still" ? sel : vids()[0]]; }
  if (!targets.length) return;
  const lv = LAB.live || await api.call("lab:live", LAB.p.kind, LAB.p.id); LAB.live = lv;
  const bmode = { card: "card", open: "open", page: "page" }[key] || null; let bk = null;
  if (bmode) { bk = LAB.p.book; if (!bk) { bk = await labBookDialog(); if (!bk) return; LAB.p.book = bk; } }
  if (key !== "sheikh") await labEnsureBg();
  const res = []; let k = 0;
  for (const s of targets) { labProg(k++ / targets.length, "تطبيق المشهد " + k + " / " + targets.length); try { res.push([s.id, await labSceneSeg(s, key, { lv, bk, bmode })]); } catch (e) { toast("تعذّر رسم المشهد: " + e.message); labProg(1); return; } }
  labProg(1);
  labDo(p => {
    for (const [sid, r] of res) { const s = p.seq.find(x => x.id === sid); if (!s) continue; p.ov = p.ov.filter(o => o.scn !== sid); s.layout = r.layout; p.ov.push(r.fr); if (r.bo) p.ov.push(r.bo); }
    LAB.sel = { type: "seg", id: res[0][0] };
  });
  toast("طُبّق مشهد «" + LAB_SCN_NAME[key] + "» على " + (mode === "all" ? "كل الفيديو" : mode === "cursor" ? "ما بعد المؤشّر" : "الجزء") + " — يظهر الاسم والعنوان طوال المشهد", 4500);
}

// ---------- تبويب «القوالب» ----------
function labDesignTab(box) {
  const B = MINBAR_THEMES.BASE, d = LAB.p.design || {};
  lmk("h4", "lab-h4", "قالب الألوان", box);
  lmk("p", "hint", d.theme ? "قالب المشروع: " + (B[d.theme] ? B[d.theme].name : d.theme) : "بلا قالب خاصّ: يستعمل تصميم البثّ الحاليّ.", box);
  const g = lmk("div", "lab-swatches", null, box);
  const sw = (k, name, bg, ac) => { const b = lmk("button", "lab-sw" + ((d.theme || "") === k ? " on" : ""), null, g); b.title = name; b.style.background = `linear-gradient(135deg, ${bg} 60%, ${ac} 60%)`; lmk("span", "", name, b); b.onclick = () => labSetDesign({ theme: k }); return b; };
  sw("", "تصميم البثّ", "#222", "#888");
  Object.entries(B).forEach(([k, v]) => sw(k, v.name, v.bg, v.accent));
  lmk("h4", "lab-h4", "الخطّ", box);
  const fs = lmk("select", "", null, box); fs.innerHTML = '<option value="">خطّ البثّ الحاليّ</option>' + Object.entries(MINBAR_THEMES.FONTS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join(""); fs.value = d.font || ""; fs.onchange = () => labSetDesign({ font: fs.value });
  lmk("h4", "lab-h4", "شكل إطار الفيديو", box);
  const sh = lmk("div", "podchips", null, box); [["", "حسب البثّ"], ["round", "مستدير"], ["arch", "محراب"], ["oval", "بيضاويّ"], ["rect", "مستطيل"]].forEach(([k, n]) => { const b = lmk("button", (d.frame || "") === k ? "on" : "", n, sh); b.onclick = () => labSetDesign({ frame: k }); });
  lmk("button", "mid pri", "↻ تطبيق القالب على كلّ الطبقات الموجودة", box).onclick = labRerenderAll;
  lmk("p", "hint", "تغيير القالب يُطبَّق على الطبقات التي تُنشأ بعده. اضغط الزرّ أعلاه لإعادة رسم ما أُنشئ قبله (المقدّمة، الآيات، البطاقات، صفحات الكتاب…).", box);
  lmk("h4", "lab-h4", "قوالب جاهزة", box);
  const tp = (title, desc, fn) => { const b = lmk("button", "lab-tpl", null, box); lmk("b", "", title, b); lmk("small", "", desc, b); b.onclick = fn; };
  tp("مقدّمة + بطاقة الشيخ + ختام", "شاشة مقدّمة ثمّ بطاقة اسم أوّل الكلام وشاشة ختام، ببيانات المشروع", () => labTemplate("classic"));
  tp("بطاقة الشيخ + عنوان الدرس", "بطاقة اسم وعنوان في أوّل الفيديو بلا شاشات", () => labTemplate("lite"));
  if (LAB.p.kind === "quran") tp("بطاقة القارئ + آيات أسفل الشاشة", "بطاقة اسم القارئ ثمّ مطابقة الآيات تلقائياً (من تبويب المشروع)", () => labTemplate("quran"));
}
async function labSetDesign(o) {
  labDo(p => { p.design = Object.assign({}, p.design, o); for (const k of Object.keys(p.design)) if (!p.design[k]) delete p.design[k]; p.bgPng = null; }, true); labLeftPaint();
}
async function labRerenderAll() {
  const items = LAB.p.ov.filter(o => o.png && labSpec(o)), stills = LAB.p.seq.filter(s => s.type === "still");
  const total = items.length + stills.length + 1; let k = 0; const say = () => labProg(k / total, `إعادة رسم الطبقات ${k} / ${total}`);
  LAB.p.bgPng = null; await labEnsureBg(); k++; say();
  for (const o of items) { try { o.png = await labPngRaw(labSpec(o)); o.rev = (o.rev || 0) + 1; } catch {} k++; say(); }
  for (const s of stills) { try { s.png = await labPngRaw(labSpec({ type: "screen", kind: s.kind || "intro" })); } catch {} k++; say(); }
  LAB.p.seq.forEach(s => { if (s.layout && s.layout.mode === "box") { s.layout.bg = LAB.p.bgPng; s.layout.shape = labShape(); } });
  labProg(1); labSaveSoon(); labPaintAll(); toast("أُعيد رسم " + items.length + " طبقة بالقالب الجديد");
}
async function labTemplate(id) {
  const T = labTexts(); if (!T.sheikh && !T.program) { toast("املأ اسم الدرس واسم الشيخ أوّلاً من تبويب «المشروع»", 5000); LAB.tab = "project"; labLeftPaint(); return; }
  if (!LAB.p.seq.length) { toast("أضف مقطعاً إلى التسلسل أوّلاً من «الوسائط»"); LAB.tab = "media"; labLeftPaint(); return; }
  if (id === "classic") { await labToolScreen("intro", true); }
  const off = id === "classic" ? LAB.p.seq[0].dur - .6 : 0;
  await labAddOv({ type: "lower", name: T.sheikh, role: T["sheikh-title"], side: "right", start: off + .6, end: off + 7 });
  if (id === "lite" || id === "quran") await labAddOv({ type: "title", t: T.program, s: T.session, start: off + 0, end: off + 4.5 });
  if (id === "classic") await labToolScreen("outro", false);
  toast("طُبّق القالب — عدّل الأزمنة بالسحب في الخطّ الزمنيّ", 5000);
}
