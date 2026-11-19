// مكتبة المصحف (تُحمَّل في الواجهة وفي طبقات البثّ): نصّ Tanzil العثماني المتحقَّق منه (assets/quran/quran.json)
// ref = { s: السورة، a: الآية، p: الجزء } — الآية الطويلة تُقسَم إلى أجزاء عند علامات الوقف حتى تتّسع في الشاشة؛
// وأوّل آية في السور (عدا الفاتحة والتوبة) يسبقها جزء «البسملة» كما في المصحف.
(function (G) {
  let DB = null, PR = null;
  const load = () => PR || (PR = fetch("/assets/quran/quran.json").then(r => { if (!r.ok) throw new Error("تعذّر تحميل المصحف"); return r.json(); }).then(d => (DB = d)));
  const AR = s => String(s).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const sura = n => DB.suras[n - 1];
  const ayahText = (s, a) => sura(s).ayas[a - 1];
  const isWaqf = w => /^[ۖ-ۜ]+$/.test(w);
  const cache = new Map();
  // أجزاء الآية: ≤ maxW كلمة للجزء، والقطع بعد علامة وقف إن وُجدت قريباً من موضع القطع المثاليّ
  function split(text, maxW = 24) {
    const w = text.split(" ").filter(Boolean); if (w.length <= maxW) return [text];
    const n = Math.ceil(w.length / maxW), tgt = w.length / n, cuts = [];
    for (let k = 1; k < n; k++) {
      const ideal = Math.round(k * tgt), lo = Math.max((cuts[cuts.length - 1] || 0) + 4, ideal - Math.round(tgt * .35)), hi = Math.min(w.length - 4, ideal + Math.round(tgt * .35));
      let best = -1, bd = 1e9;
      for (let i = lo; i <= hi; i++) if (isWaqf(w[i - 1] || "") && Math.abs(i - ideal) < bd) { best = i; bd = Math.abs(i - ideal); }
      cuts.push(best > 0 ? best : ideal);
    }
    const out = []; let st = 0; for (const c of cuts.concat(w.length)) { out.push(w.slice(st, c).join(" ")); st = c; } return out.filter(Boolean);
  }
  // [{ t: النصّ, bsm: true للبسملة }]
  function parts(s, a) {
    const key = s + ":" + a; if (cache.has(key)) return cache.get(key);
    let r = split(ayahText(s, a)).map(t => ({ t }));
    if (a === 1 && s !== 1 && s !== 9) r = [{ t: DB.basmala, bsm: true }].concat(r);
    cache.set(key, r); return r;
  }
  const N = s => sura(s).ayas.length;
  const clampRef = (r) => { let s = Math.min(114, Math.max(1, r.s | 0 || 1)), a = Math.min(N(s), Math.max(1, r.a | 0 || 1)), pc = parts(s, a).length; return { s, a, p: Math.min(pc - 1, Math.max(0, r.p | 0)) }; };
  // حدود التنقّل: all | sura | range (من rf إلى rt في السورة الحاليّة)
  function bounds(q) {
    if (q.scope === "sura") return { lo: { s: q.s, a: 1 }, hi: { s: q.s, a: N(q.s) } };
    if (q.scope === "range") return { lo: { s: q.s, a: Math.max(1, Math.min(q.rf || 1, N(q.s))) }, hi: { s: q.s, a: Math.max(q.rf || 1, Math.min(q.rt || N(q.s), N(q.s))) } };
    return { lo: { s: 1, a: 1 }, hi: { s: 114, a: N(114) } };
  }
  const cmp = (x, y) => x.s - y.s || x.a - y.a;
  function step(q, d) {
    const r = clampRef(q), b = bounds(Object.assign({}, q, { s: r.s })), pc = parts(r.s, r.a).length;
    if (d > 0) {
      if (r.p + 1 < pc) return { s: r.s, a: r.a, p: r.p + 1 };
      if (cmp(r, b.hi) >= 0) return r;
      const nx = r.a < N(r.s) ? { s: r.s, a: r.a + 1 } : { s: r.s + 1, a: 1 };
      return { s: nx.s, a: nx.a, p: 0 };
    }
    if (r.p > 0) return { s: r.s, a: r.a, p: r.p - 1 };
    if (cmp(r, b.lo) <= 0) return r;
    const pv = r.a > 1 ? { s: r.s, a: r.a - 1 } : { s: r.s - 1, a: N(r.s - 1) };
    return { s: pv.s, a: pv.a, p: parts(pv.s, pv.a).length - 1 };
  }
  const firstOfJuz = j => { for (const s of DB.suras) { const i = s.juz.indexOf(j); if (i >= 0) return { s: s.n, a: i + 1, p: 0 }; } return null; };
  const firstOfPage = pg => { for (const s of DB.suras) { const i = s.page.indexOf(pg); if (i >= 0) return { s: s.n, a: i + 1, p: 0 }; } return null; };
  const info = (s, a) => ({ juz: sura(s).juz[a - 1], page: sura(s).page[a - 1], sajda: !!sura(s).sajda[a - 1] });
  G.QU = { setData: d => { DB = d; PR = Promise.resolve(d); cache.clear(); }, load, AR, sura, N, ayahText, parts, split, clampRef, step, bounds, firstOfJuz, firstOfPage, info, get db() { return DB; } };
})(typeof window !== "undefined" ? window : globalThis);
