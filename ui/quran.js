// تبويب «المصحف» (معرض القرآن الكريم): التنقّل آيةً آية، القفز لسورة/جزء/صفحة، حدود التنقّل، وخيارات عرض الآية.
// النصّ: assets/quran/quran.json (Tanzil — العثماني). موضع القراءة الحاليّ في settings.quran وتقرؤه طبقات البثّ (quran.html).
let QL = null;                                                     // آخر قيمة محليّة (تنقّل سريع بلا انتظار حفظ الإعدادات)
const QDEF = { s: 1, a: 1, p: 0, size: 100, num: true, head: true, info: true, scope: "all", rf: 1, rt: 7, follow: false, cam: "sheikh" };
const Q = () => QL || Object.assign({}, QDEF, S().quran);
function quranSet(o, repaint = true) {
  QL = Object.assign({}, Q(), o); const mine = QL;
  patch({ quran: QL }).then(() => { if (QL === mine) QL = null; });
  if (repaint) quranPaint();
}
function quranStep(d) {
  if (!QU.db) { QU.load().then(() => quranStep(d)); return; }
  const q = Q(), r = QU.step(q, d);
  if (r.s === q.s && r.a === q.a && r.p === q.p) { toast(d > 0 ? "هذه آخر آية في النطاق" : "هذه أوّل آية في النطاق"); return; }
  quranSet({ s: r.s, a: r.a, p: r.p });
}
// تتبّع التلاوة: استقبال الموضع الذي حدّده البرنامج، وما سُمع
api.on("quran:ref", r => { QL = null; ST.settings.quran = Object.assign({}, ST.settings.quran, { s: r.s, a: r.a, p: r.p }); quranPaint(); });
api.on("quran:heard", d => { const e = $("qHeard"); if (e) { e.textContent = (d.ok ? "✓ " : "· ") + "سُمع: «" + d.text.slice(-90) + "»" + (d.ok ? "" : " — لم يُطابَق مع الآية الحاليّة") + "  (تطابق " + Math.round(d.score * 100) + "٪)"; e.style.opacity = d.ok ? 1 : .6; } });
function renderQuran() {
  const box = $("t-quran"); if (!box) return;
  if (!QU.db) { box.innerHTML = '<p class="hint">جارٍ تحميل المصحف…</p>'; QU.load().then(renderQuran).catch(e => { box.innerHTML = '<p class="hint">' + e.message + "</p>"; }); return; }
  box.innerHTML = "";
  const q = Q(), sec = (t, h) => { const x = document.createElement("h2"); x.className = "tsec"; x.textContent = t; box.appendChild(x); if (h) { const p = document.createElement("p"); p.className = "hint"; p.textContent = h; box.appendChild(p); } };
  const row = (label, node) => { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>"; r.appendChild(node); return r; };
  // ---- بطاقة الآية الحاليّة والتنقّل ----
  sec("الآية الحاليّة");
  const card = document.createElement("div"); card.className = "qcard"; card.id = "qCard"; box.appendChild(card);
  const nav = document.createElement("div"); nav.className = "qnav";
  const mk = (txt, fn, cls = "mid") => { const b = document.createElement("button"); b.className = cls; b.textContent = txt; b.onclick = fn; nav.appendChild(b); return b; };
  mk("◂ الآية السابقة", () => quranStep(-1)); mk("الآية التالية ▸", () => quranStep(1), "mid pri");
  box.appendChild(nav);
  const hint = document.createElement("p"); hint.className = "hint"; hint.textContent = "الأسهم ← → من لوحة المفاتيح تنقل بين الآيات، وللآية الطويلة أجزاء تُعرَض تباعاً عند علامات الوقف. تسبق البسملةُ أوّلَ آية في كل سورة."; box.appendChild(hint);
  // ---- الانتقال ----
  sec("الانتقال إلى");
  const sel = (id, opts, cur, fn) => { const s = document.createElement("select"); s.id = id; s.innerHTML = opts; s.value = cur; s.onchange = () => fn(s.value); return s; };
  const suraOpts = QU.db.suras.map(x => `<option value="${x.n}">${QU.AR(x.n)}. ${x.name}</option>`).join("");
  box.appendChild(row("السورة", sel("qSura", suraOpts, q.s, v => quranSet({ s: +v, a: 1, p: 0 }, true))));
  box.appendChild(row("الآية", sel("qAyah", "", q.a, v => quranSet({ a: +v, p: 0 }))));
  const jOpts = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">الجزء ${QU.AR(i + 1)}</option>`).join("");
  box.appendChild(row("الجزء", sel("qJuz", jOpts, QU.info(q.s, q.a).juz, v => { const r = QU.firstOfJuz(+v); if (r) quranSet(r); })));
  const pg = document.createElement("input"); pg.type = "number"; pg.min = 1; pg.max = 604; pg.id = "qPage"; pg.style.width = "90px";
  pg.onchange = () => { const r = QU.firstOfPage(Math.max(1, Math.min(604, +pg.value || 1))); if (r) quranSet(r); };
  box.appendChild(row("صفحة المصحف", pg));
  // ---- تتبّع التلاوة ----
  sec("تتبّع التلاوة تلقائياً", "يستمع البرنامج لميكروفون القارئ ويطابق ما يسمعه مع المصحف: عندما يُتمّ القارئ آيةً ويدخل في التي بعدها تنتقل الآية وحدها. يحتاج مفتاح Groq (نفسه المستعمل للترجمة الحيّة) واتّصالاً بالإنترنت، ويتأخّر الانتقال ثانيةً أو ثانيتين بعد وقفة القارئ.");
  box.appendChild(tsSwitch("تفعيل التتبّع التلقائي", !!q.follow, async on => { quranSet({ follow: on }, false); await new Promise(r => setTimeout(r, 300)); if (typeof capSync === "function") capSync(); if (on) { try { if (!(await api.call("cap:hasKey"))) toast("احفظ مفتاح Groq أوّلاً من تبويب «البثّ» ← الترجمة", 6000); } catch {} } }));
  { const h = document.createElement("p"); h.id = "qHeard"; h.className = "hint"; h.textContent = q.follow ? "في انتظار صوت القارئ…" : ""; box.appendChild(h); }
  // ---- الكاميرا ----
  sec("الكاميرا", "الكاميرا الأساسيّة هي كاميرا القارئ. يمكن إضافة كاميرا ثانية (زاوية أخرى أو الحضور): تظهر مشاهد «الكاميرا الثانية» و«القارئ + الثانية»، ويمكن اختيارها لمشاهد الآيات.");
  { const on = !!S().cam2.on;
    box.appendChild(tsSwitch("تفعيل كاميرا ثانية", on, async v => { if (v && !(S().devices.cam2 && S().devices.cam2.id)) toast("اختر جهاز الكاميرا الثانية من تبويب «الأجهزة»"); await patch({ cam2: { on: v } }); renderScenes(); setScene(ST.program); renderQuran(); }));
    if (on) { const cw = document.createElement("div"); cw.className = "podchips";
      [["sheikh", "كاميرا القارئ"], ["cam2", "الكاميرا الثانية"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if ((q.cam || "sheikh") === k) b.className = "on"; b.onclick = () => { quranSet({ cam: k }, false); renderQuran(); }; cw.appendChild(b); });
      box.appendChild(row("كاميرا مشاهد الآيات", cw)); } }
  // ---- حدود التنقّل ----
  sec("حدود التنقّل", "حتى لا تتجاوز الآيةَ الأخيرة التي تريدها أثناء التلاوة.");
  const chips = document.createElement("div"); chips.className = "podchips";
  [["all", "المصحف كلّه"], ["sura", "السورة الحاليّة"], ["range", "من آية إلى آية"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if (q.scope === k) b.className = "on"; b.onclick = () => { quranSet({ scope: k }, false); renderQuran(); }; chips.appendChild(b); });
  box.appendChild(chips);
  if (q.scope === "range") {
    const n = QU.N(q.s), rr = document.createElement("div"); rr.className = "ctl";
    const f = document.createElement("input"), t = document.createElement("input"); [f, t].forEach(i => { i.type = "number"; i.min = 1; i.max = n; i.style.width = "80px"; });
    f.value = Math.min(q.rf || 1, n); t.value = Math.min(q.rt || n, n);
    f.onchange = () => quranSet({ rf: Math.max(1, Math.min(n, +f.value || 1)) }, false); t.onchange = () => quranSet({ rt: Math.max(1, Math.min(n, +t.value || n)) }, false);
    rr.append(Object.assign(document.createElement("span"), { textContent: "من الآية" }), f, Object.assign(document.createElement("span"), { textContent: "إلى الآية" }), t);
    box.appendChild(row("النطاق في «" + QU.sura(q.s).name + "»", rr));
  }
  // ---- العرض ----
  sec("عرض الآية في البثّ");
  box.appendChild(tsRange("حجم الخطّ", 60, 140, 5, q.size || 100, v => v + "٪", v => quranSet({ size: v }, false)));
  box.appendChild(tsSwitch("اسم السورة في رأس اللوحة", q.head !== false, on => quranSet({ head: on }, false)));
  box.appendChild(tsSwitch("بيانات السورة (مكية/مدنية، عدد الآيات، الجزء، الصفحة)", q.info !== false, on => quranSet({ info: on }, false)));
  box.appendChild(tsSwitch("علامة رقم الآية", q.num !== false, on => quranSet({ num: on }, false)));
  const cr = document.createElement("p"); cr.className = "hint"; cr.style.marginTop = "18px";
  cr.textContent = "المشاهد: «آية أسفل / بجانب القارئ / أعلى / في إطار» من شريط المشاهد. قالب القارئ (الألوان والخطّ والإطار) من تبويب «الشكل». نصّ المصحف: Tanzil (الرسم العثماني، رواية حفص) — رخصة CC BY 3.0، وقد تُحُقّق من اكتماله: ٦٢٣٦ آية وأعداد آيات السور مطابقة.";
  box.appendChild(cr);
  quranPaint();
}
// يحدّث ما يتغيّر عند التنقّل (بطاقة الآية والقوائم) دون إعادة بناء التبويب
function quranPaint() {
  if (!QU.db) return; const q = QU.clampRef(Q()), su = QU.sura(q.s), pt = QU.parts(q.s, q.a), part = pt[q.p] || pt[0], inf = QU.info(q.s, q.a);
  const card = $("qCard"); if (card) {
    card.innerHTML = "";
    const np = pt.length - (pt[0].bsm ? 1 : 0), pi = q.p + 1 - (pt[0].bsm ? 1 : 0);
    const h = document.createElement("div"); h.className = "qh"; h.textContent = QU.AR(`سورة ${su.name} · الآية ${q.a} من ${su.ayas.length} · الجزء ${inf.juz} · ص${inf.page}`) + (part.bsm ? " · البسملة" : np > 1 ? QU.AR(` · جزء الآية ${pi} من ${np}`) : ""); card.appendChild(h);
    const t = document.createElement("div"); t.className = "qt"; t.textContent = part.t; card.appendChild(t);
  }
  const sa = $("qAyah"); if (sa) { const n = QU.N(q.s); if (sa.options.length !== n) sa.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${QU.AR(i + 1)}</option>`).join(""); sa.value = q.a; }
  const ss = $("qSura"); if (ss) ss.value = q.s; const sj = $("qJuz"); if (sj) sj.value = inf.juz; const sp = $("qPage"); if (sp) sp.value = inf.page;
}
