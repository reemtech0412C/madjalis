// «المجالس» — بحث عربيّ متسامح (مشترك بين البرنامج والطبقات): يتجاهل التشكيل والتطويل، ويوحّد الألف والياء والتاء المربوطة والهمزات.
(function (G) {
  const DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/;
  const FOLD = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ک": "ك", "ی": "ي" };
  const LETTER = /[\u0621-\u064A\u066E-\u06D3a-zA-Z0-9]/;
  // يرجع النصّ المطبَّع + مصفوفة تربط كل حرف مطبَّع بموضعه في الأصل (لنأخذ مقتطفاً من الأصل بتشكيله)
  function normMap(src) {
    src = String(src || "");
    let s = "", map = [], lastSpace = true;
    for (let i = 0; i < src.length; i++) {
      let c = src[i];
      if (DIAC.test(c)) continue;
      const code = c.charCodeAt(0);
      if (code >= 0x660 && code <= 0x669) c = String(code - 0x660);        // أرقام هنديّة → غربيّة
      else if (code >= 0x6F0 && code <= 0x6F9) c = String(code - 0x6F0);
      else c = FOLD[c] || c;
      if (!LETTER.test(c) && !/[0-9]/.test(c)) c = " ";
      if (c === " ") { if (lastSpace) continue; lastSpace = true; } else lastSpace = false;
      s += c.toLowerCase(); map.push(i);
    }
    if (s.endsWith(" ")) { s = s.slice(0, -1); map.pop(); }
    return { s, map };
  }
  const stripHtml = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
  // pages: [{ plain, n: normMap(plain) }]  → نتائج مرتّبة: العبارة كاملةً أوّلاً، ثمّ الصفحات التي فيها كل الكلمات
  function search(pages, query, limit = 300) {
    const q = normMap(query).s; if (!q) return { results: [], total: 0 };
    const words = q.split(" "), exact = [], loose = [];
    pages.forEach((pg, i) => {
      const t = pg.n.s; if (!t) return;
      let at = t.indexOf(q), cnt = 0;
      if (at >= 0) { let k = at; while (k >= 0) { cnt++; k = t.indexOf(q, k + q.length); } }
      else if (words.length > 1 && words.every(w => t.includes(w))) at = t.indexOf(words[0]);
      else if (words.length === 1) return; else return;
      const len = cnt ? q.length : words[0].length, a = pg.n.map[at], b = pg.n.map[Math.min(at + len, pg.n.map.length) - 1] + 1;
      const from = Math.max(0, a - 70), to = Math.min(pg.plain.length, b + 110);
      (cnt ? exact : loose).push({ page: i + 1, count: cnt || 1, exact: !!cnt, before: (from > 0 ? "… " : "") + pg.plain.slice(from, a), hit: pg.plain.slice(a, b), after: pg.plain.slice(b, to) + (to < pg.plain.length ? " …" : "") });
    });
    const all = exact.concat(loose);
    return { results: all.slice(0, limit), total: all.length, exact: exact.length };
  }
  const API = { normMap, stripHtml, search };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else G.ARSEARCH = API;
})(typeof window !== "undefined" ? window : globalThis);
