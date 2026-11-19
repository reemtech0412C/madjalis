// الحلقات العلميّة ← الكتب المدرَّسة ← المجالس (الباب والتاريخ والوقت).
// النظام يحتفظ بكل شيء في settings.json، والبثّ يقرأ «النسخة الحيّة» (texts / book / bookState) التي تُملأ من المجلس المختار.
//   halaqa : { id, name, mosque, screens:{intro|break|outro:{logo}}, logo:{file,cut,nobg}|null, books:[...] }
//   book   : { id, title, program, sheikhTitle, sheikh, reader, libId, bookState, sessions:[...], lastSession }
//   session: { id, scope, session, date, start, next, breakMin }
const crypto = require("crypto");
const uid = () => crypto.randomBytes(5).toString("hex");

const DEFAULT_HALAQAT = [
  "حلقة عبدالله بن عباس للعلوم الإسلامية بجمهورية تشاد",
  "حلقة مجمع الإمام القرافي للعلوم الإسلامية بجمهورية تشاد",
];
const SCREENS = () => ({ intro: { logo: false }, break: { logo: false }, outro: { logo: false } });
const BOOKSTATE = () => ({ page: 1, focus: false, band: null, step: .042 });
const ORD = ["الأوّل", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const AR = s => String(s).replace(/[0-9]/g, d => "0123456789"[d]);
const sessionLabel = n => "المجلس " + (ORD[n - 1] || AR(n));

const mkHalaqa = (name, mosque = "") => ({ id: uid(), name, mosque, screens: SCREENS(), logo: null, sponsors: [], books: [] });
const mkBook = (o = {}) => ({ id: uid(), title: "", program: "", sheikhTitle: "فضيلة الشيخ", sheikh: "", reader: "", libId: null, bookState: BOOKSTATE(), sessions: [], lastSession: null, ...o });
const mkSession = (o = {}) => ({ id: uid(), scope: "", session: "", date: "", start: "20:00", next: "", breakMin: "10", ...o });

// ---------- الوصول ----------
// القسم غير «الدروس»: كائن القسم نفسه يعمل كحلقة (له sponsors وlogo وscreens وsocials وsheikhImg)
const isMode = S => S.mode && S.mode !== "lessons" && S.modes && S.modes[S.mode];
function modeHalaqa(S) { const m = S.modes[S.mode]; m.id = "mode:" + S.mode; if (!m.screens) m.screens = SCREENS(); if (!Array.isArray(m.sponsors)) m.sponsors = []; m.books = m.books || []; return m; }
function find(s, hid, bid, sid) {
  if (typeof hid === "string" && hid.startsWith("mode:") && s.modes && s.modes[hid.slice(5)]) { const m = s.modes[hid.slice(5)]; m.id = hid; if (!m.screens) m.screens = SCREENS(); return { h: m, b: null, s: null }; }
  const h = s.halaqat.find(x => x.id === hid) || null;
  const b = h && bid ? h.books.find(x => x.id === bid) || null : null;
  const ss = b && sid ? b.sessions.find(x => x.id === sid) || null : null;
  return { h, b, s: ss };
}
function current(store) { const S = store.get(); if (isMode(S)) return { h: modeHalaqa(S), b: null, s: null }; const q = S.sel || {}; const r = find(S, q.h, q.b, q.s); return { h: r.h, b: r.b, s: r.s }; }

// ---------- شجرة ← النسخة الحيّة ----------
function applySel(store) {
  const S = store.get(); if (isMode(S)) { store.patch({ logos: (modeHalaqa(S).sponsors || []).map(x => Object.assign({}, x)) }); return; }
  const { h, b, s } = current(store);
  if (!h) { S.sel = null; store.patch({ logos: [] }); return; }
  const texts = Object.assign({}, S.texts, { halaqa: h.name, mosque: h.mosque || "" });
  if (b) Object.assign(texts, { program: b.program, book: b.title, "sheikh-title": b.sheikhTitle, sheikh: b.sheikh, "sheikh-post": b.sheikhPost || "", reader: b.reader });
  if (s) Object.assign(texts, { scope: s.scope, session: s.session, date: s.date, start: s.start, next: s.next, "break-min": s.breakMin });
  store.patch({ texts, logos: Array.isArray(h.sponsors) ? h.sponsors.map(x => Object.assign({}, x)) : [], book: b && b.libId ? { id: b.libId, v: Date.now() } : null, bookState: b ? Object.assign(BOOKSTATE(), b.bookState) : BOOKSTATE() });
}

// ---------- النسخة الحيّة ← شجرة (أيّ تعديل في «الدرس» يُحفظ للحلقة/الكتاب/المجلس المختار) ----------
const HK = { halaqa: ["h", "name"], mosque: ["h", "mosque"],
  program: ["b", "program"], book: ["b", "title"], "sheikh-title": ["b", "sheikhTitle"], sheikh: ["b", "sheikh"], "sheikh-post": ["b", "sheikhPost"], reader: ["b", "reader"],
  scope: ["s", "scope"], session: ["s", "session"], date: ["s", "date"], start: ["s", "start"], next: ["s", "next"], "break-min": ["s", "breakMin"] };
function syncTexts(store, tp) {
  if (isMode(store.get())) return;
  const c = current(store);
  for (const [k, v] of Object.entries(tp || {})) { const m = HK[k]; if (m && c[m[0]]) c[m[0]][m[1]] = v; }
  store.save();
}
// شعارات الجهة والرعاة خاصّة بكل حلقة: أيّ تعديل في «الشعارات» يُحفظ للحلقة المختارة فقط
function syncLogos(store, logos) {
  const { h } = current(store); if (!h) return;
  h.sponsors = (logos || []).map(x => Object.assign({}, x));
  store.save();
}
// الكتاب المعروض وصفحته يبقيان مع كتاب الحلقة (لا يعاد ضبطه في كل تسجيل)
function syncBook(store) {
  const S = store.get(), { b } = current(store); if (!b) return;
  b.libId = S.book ? S.book.id : null; b.bookState = Object.assign({}, S.bookState);
  store.save();
}

// ---------- أوامر الواجهة ----------
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
const OPS = {
  createHalaqa(store, f) { const h = mkHalaqa(String(f.name || "").trim() || "حلقة جديدة", String(f.mosque || "").trim()); store.get().halaqat.push(h); return h.id; },
  updateHalaqa(store, hid, f) { const { h } = find(store.get(), hid); if (h) Object.assign(h, pick(f, ["name", "mosque", "screens", "logo", "socials", "sheikhImg", "guestImg"])); },
  removeHalaqa(store, hid) { const S = store.get(); S.halaqat = S.halaqat.filter(x => x.id !== hid); if (S.sel && S.sel.h === hid) S.sel = null; },
  createBook(store, hid, f) {
    const { h } = find(store.get(), hid); if (!h) return null;
    const prev = h.books[h.books.length - 1];
    const b = mkBook({ title: String(f.title || "").trim() || "كتاب جديد", program: String(f.program || "").trim(), sheikhTitle: f.sheikhTitle ?? (prev ? prev.sheikhTitle : "فضيلة الشيخ"), sheikh: f.sheikh ?? (prev ? prev.sheikh : ""), reader: f.reader || "" });
    b.sessions.push(mkSession({ session: sessionLabel(1) })); h.books.push(b); return b.id;
  },
  updateBook(store, hid, bid, f) { const { b } = find(store.get(), hid, bid); if (b) Object.assign(b, pick(f, ["title", "program", "sheikhTitle", "sheikh", "reader", "sheikhImg", "sheikhPost"])); },
  removeBook(store, hid, bid) { const { h } = find(store.get(), hid); if (!h) return; h.books = h.books.filter(x => x.id !== bid); const S = store.get(); if (S.sel && S.sel.b === bid) S.sel = null; },
  createSession(store, hid, bid, f) {
    const { b } = find(store.get(), hid, bid); if (!b) return null;
    const prev = b.sessions[b.sessions.length - 1] || {};
    const s = mkSession({ scope: f.scope ?? prev.scope ?? "", session: String(f.session || "").trim() || sessionLabel(b.sessions.length + 1), date: f.date || "", start: f.start || prev.start || "20:00", next: f.next ?? prev.next ?? "", breakMin: prev.breakMin || "10" });
    b.sessions.push(s); return s.id;
  },
  updateSession(store, hid, bid, sid, f) { const { s } = find(store.get(), hid, bid, sid); if (s) Object.assign(s, pick(f, ["scope", "session", "date", "start", "next", "breakMin"])); },
  removeSession(store, hid, bid, sid) { const { b } = find(store.get(), hid, bid); if (!b) return; b.sessions = b.sessions.filter(x => x.id !== sid); const S = store.get(); if (S.sel && S.sel.s === sid) S.sel = null; },
  // اختيار مجلس = اختيار حلقته وكتابه معه (لو الكتاب بلا مجالس يُنشأ له مجلس)
  select(store, hid, bid, sid) {
    const S = store.get(), { h, b } = find(S, hid, bid); if (!h || !b) return false;
    if (!sid) { sid = b.lastSession && b.sessions.some(x => x.id === b.lastSession) ? b.lastSession : (b.sessions[b.sessions.length - 1] || {}).id; }
    if (!sid) { const s = mkSession({ session: sessionLabel(1) }); b.sessions.push(s); sid = s.id; }
    b.lastSession = sid; S.sel = { h: hid, b: bid, s: sid }; return true;
  },
};

// يُنفَّذ أمر ثمّ نعيد ملء النسخة الحيّة (لو تغيّر المختار) ونحفظ
function run(store, op, args) {
  if (!OPS[op]) throw new Error("أمر غير معروف: " + op);
  const r = OPS[op](store, ...args);
  applySel(store); store.save();
  return r;
}

// ---------- أوّل تشغيل / ترحيل: بياناتك الحاليّة تصير كتاباً داخل أوّل حلقة، وتُضاف الحلقتان الافتراضيّتان ----------
// ترحيل: صورة الشيخ وغلاف الكتاب أُلغيا، وصارت صورة الحلقة «شعار الحلقة» (لا يضيع ما رفعته سابقاً)
function migrate(S) {
  for (const h of S.halaqat || []) {
    if (h.logo === undefined) h.logo = h.sheikhImg || null;
    delete h.sheikhImg;
    h.screens = h.screens || SCREENS();
    for (const k of ["intro", "break", "outro"]) { const o = h.screens[k] || {}; h.screens[k] = Object.assign({}, o, { logo: o.logo !== undefined ? !!o.logo : !!o.sheikh }); }
    for (const b of h.books || []) delete b.cover;
  }
}
// ترحيل: الشعارات القديمة كانت عامّة لكل الحلقات؛ تصير للحلقة المختارة (أو الأولى) وتبدأ البقيّة بلا شعارات
function migrateSponsors(S) {
  const hs = S.halaqat || []; if (!hs.length || hs.every(h => Array.isArray(h.sponsors))) return;
  const target = hs.find(h => S.sel && h.id === S.sel.h) || hs[0];
  for (const h of hs) h.sponsors = Array.isArray(h.sponsors) ? h.sponsors : (h === target ? (S.logos || []).map(x => Object.assign({}, x)) : []);
}
function ensure(store) {
  const S = store.get();
  migrate(S); migrateSponsors(S);
  if (Array.isArray(S.halaqat) && S.halaqat.length) { applySel(store); return; }
  S.halaqat = DEFAULT_HALAQAT.map(n => mkHalaqa(n));
  const t = S.texts || {}, h = S.halaqat[0];
  h.mosque = t.mosque || "";
  const b = mkBook({ title: t.book || "", program: t.program || "", sheikhTitle: t["sheikh-title"] || "فضيلة الشيخ", sheikh: t.sheikh || "", reader: t.reader || "", libId: S.book ? S.book.id : null, bookState: Object.assign(BOOKSTATE(), S.bookState) });
  const s = mkSession({ scope: t.scope || "", session: t.session || sessionLabel(1), date: t.date || "", start: t.start || "20:00", next: t.next || "", breakMin: t["break-min"] || "10" });
  b.sessions.push(s); b.lastSession = s.id;
  if (b.title || b.program || b.sheikh) h.books.push(b);
  S.sel = null;            // الاختيار يتمّ من شاشة الحلقات عند الفتح
  store.save();
  if (h.books.length) { S.sel = { h: h.id, b: b.id, s: s.id }; applySel(store); }
  else applySel(store);
}

module.exports = { isMode, modeHalaqa, ensure, run, current, syncTexts, syncBook, syncLogos, applySel, DEFAULT_HALAQAT, sessionLabel };
