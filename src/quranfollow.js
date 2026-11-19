// تتبّع التلاوة: يطابق ما سمعه التفريغ الصوتيّ (Whisper) مع نصّ المصحف ويحدّد الآية التي وصل إليها القارئ.
// يُستدعى لكل مقطع كلام (ينتهي عند وقفة القارئ): إن أتمّ آيةً انتقلنا للتالية، وإن كان في وسطها بقينا فيها (أو في جزئها الصحيح).
const fs = require("fs"), path = require("path");
let QU = null;
function qu() {
  if (QU) return QU;
  require("../overlays/quranlib.js"); QU = globalThis.QU;
  QU.setData(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "quran", "quran.json"), "utf8")));
  return QU;
}
// توحيد الكتابة للمقارنة: بلا تشكيل ولا علامات قرآنيّة، وتوحيد الألف والياء والتاء المربوطة والهمزات، وحذف الألف (تختلف بين الرسم العثماني والإملائيّ)
const norm = t => String(t || "")
  .replace(/[ً-ٰٟۖ-ۭـ࣓-ࣿ‌-‏]/g, "")
  .replace(/[آأإٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/[ءا]/g, "").replace(/[^؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim();
const words = t => norm(t).split(" ").filter(Boolean);
function lev(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
const sim = (a, b) => { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; };
const same = (a, b) => (a.length <= 2 || b.length <= 2) ? a === b : sim(a, b) >= 0.66;

// عناصر النافذة: كل آية (والبسملة قبل أوّل آية في السور) مع كلماتها المطبَّعة وأماكنها في الأجزاء
function windowItems(ref, back, fwd) {
  const U = qu(), items = []; let s = ref.s, a = ref.a;
  for (let i = 0; i < back; i++) { if (a > 1) a--; else if (s > 1) { s--; a = U.N(s); } }
  for (let i = 0; i < back + fwd + 1 && s <= 114; i++) {
    if (a === 1 && s !== 1 && s !== 9) items.push({ s, a: 1, bsm: true, w: words(U.db.basmala), parts: 1 });
    const toks = U.ayahText(s, a).split(" ").filter(Boolean), w = [], map = [];
    toks.forEach((t, ti) => { const n = norm(t); if (n) { w.push(n); map.push(ti); } });
    items.push({ s, a, w, map, toks: toks.length });
    if (a < U.N(s)) a++; else { s++; a = 1; }
  }
  return items;
}
/**
 * heard: النصّ المسموع. cur: { s, a, p }. يعيد { ref, score, at } أو null إن لم يطابق.
 * at: "end" أتمّ الآية فنقلنا للتالية، "mid" في وسطها.
 */
function advance(cur, heard, opts = {}) {
  const U = qu(), T = words(heard); if (T.length < 2) return null;
  const items = windowItems(cur, 1, opts.fwd || 8), W = [], owner = [];
  items.forEach((it, k) => it.w.forEach(w => { W.push(w); owner.push(k); }));
  const m = T.length, n = W.length; if (!n) return null;
  // محاذاة شبه عامّة: بداية حرّة في النافذة، ونهاية حرّة
  const D = Array.from({ length: m + 1 }, () => new Float32Array(n + 1));
  for (let i = 1; i <= m; i++) D[i][0] = i;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const sub = same(T[i - 1], W[j - 1]) ? 0 : 1;
    D[i][j] = Math.min(D[i - 1][j - 1] + sub, D[i - 1][j] + 1, D[i][j - 1] + 0.8);
  }
  let bj = 1, bv = 1e9; for (let j = 1; j <= n; j++) if (D[m][j] < bv - 1e-6) { bv = D[m][j]; bj = j; }
  const score = Math.max(0, 1 - bv / m);
  if (score < (opts.min || 0.5)) return { ref: null, score };
  const k = owner[bj - 1], it = items[k], firstJ = owner.indexOf(k), inItem = bj - firstJ;        // عدد كلمات الآية التي تمّ بلوغها
  let ref, at;
  if (inItem >= it.w.length - 1) {                                                              // أتمّ الآية (أو بقيت كلمة واحدة)
    const nx = items[k + 1];
    if (!nx) ref = { s: it.s, a: it.a, p: it.bsm ? 1 : Math.max(0, U.parts(it.s, it.a).length - 1) };
    else ref = { s: nx.s, a: nx.bsm ? 1 : nx.a, p: 0 };
    at = "end";
    if (it.bsm) ref = { s: it.s, a: 1, p: 1 };
  } else {
    if (it.bsm) ref = { s: it.s, a: 1, p: 0 };
    else {
      // الجزء الذي فيه الكلمة الأخيرة المسموعة (+1 لو الآية يسبقها جزء البسملة)
      const tokIdx = it.map[Math.min(inItem, it.map.length - 1)], pts = U.parts(it.s, it.a).filter(x => !x.bsm); let acc = 0, pi = 0;
      for (let i = 0; i < pts.length; i++) { acc += pts[i].t.split(" ").filter(Boolean).length; if (tokIdx < acc) { pi = i; break; } pi = i; }
      const hasB = U.parts(it.s, it.a)[0].bsm; ref = { s: it.s, a: it.a, p: pi + (hasB ? 1 : 0) };
    }
    at = "mid";
  }
  return { ref: U.clampRef(ref), score, at, matched: { s: it.s, a: it.a } };
}
// نصّ المساعدة لنموذج التفريغ: الآية الحاليّة والتالية (يزيد دقّة التعرّف على ألفاظ القرآن)
function hint(cur) {
  const U = qu(), r = U.clampRef(cur), strip = t => t.replace(/[ۖ-ۭ]/g, "");
  const nx = r.a < U.N(r.s) ? { s: r.s, a: r.a + 1 } : r.s < 114 ? { s: r.s + 1, a: 1 } : null;
  return ("تلاوة من القرآن الكريم: " + strip(U.ayahText(r.s, r.a)) + (nx ? " " + strip(U.ayahText(nx.s, nx.a)) : "")).slice(-420);
}
module.exports = { advance, hint, norm, words };
