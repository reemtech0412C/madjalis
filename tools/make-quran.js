// يبني assets/quran/quran.json من نصّ Tanzil العثماني (إصدار quran-uthmani) مع التحقّق:
//  - 114 سورة و6236 آية، وأعداد آيات كل سورة تطابق بيانات Tanzil الوصفيّة
//  - البسملة تُفصَل عن أوّل آية في كل سورة (عدا الفاتحة حيث هي آية، والتوبة بلا بسملة) بعد التحقّق من أنّها هي
// المصدر: Tanzil Quran Text (Uthmani) — رخصة CC BY 3.0: يجب ذكر المصدر وعدم تعديل النصّ.
const fs = require("fs"), path = require("path");
const src = JSON.parse(fs.readFileSync(path.join(__dirname, "_quran-src.json"), "utf8")).data.surahs;
const metaTxt = fs.readFileSync(path.join(__dirname, "_quran-meta.js"), "utf8");
const meta = new Function(metaTxt + "; return QuranData;")().Sura.filter(x => x.length > 4);
if (src.length !== 114 || meta.length !== 114) throw new Error("عدد السور خاطئ");
const norm = t => t.replace(/[ً-ٰٟۖ-ۭـ࣓-ࣿ]/g, "").replace(/ٱ/g, "ا").replace(/\s+/g, " ").trim();
const BSM = "بسم الله الرحمن الرحيم";
let BSM_TXT = "", total = 0; const out = [];
src.forEach((s, i) => {
  const m = meta[i];
  if (s.ayahs.length !== m[1]) throw new Error(`عدد آيات السورة ${i + 1}: ${s.ayahs.length} ≠ ${m[1]}`);
  const ayas = s.ayahs.map(a => a.text.replace(/^﻿/, "").trim());
  if (i + 1 !== 1 && i + 1 !== 9) {
    const tk = ayas[0].split(/\s+/), head = tk.slice(0, 4).join(" ");
    if (norm(head) !== BSM) throw new Error(`لا بسملة في أوّل آية السورة ${i + 1}: ${ayas[0].slice(0, 40)}`);
    BSM_TXT = BSM_TXT || head; ayas[0] = tk.slice(4).join(" ");
    if (!ayas[0]) throw new Error("آية أولى فارغة " + (i + 1));
  } else if (i + 1 === 9 && norm(ayas[0]).startsWith(BSM)) throw new Error("بسملة في التوبة");
  total += ayas.length;
  out.push({ n: i + 1, name: m[4], type: m[7] === "Meccan" ? "مكية" : "مدنية", ayas, page: s.ayahs.map(a => a.page), juz: s.ayahs.map(a => a.juz), sajda: s.ayahs.map(a => a.sajda ? 1 : 0) });
});
if (total !== 6236) throw new Error("المجموع " + total);
fs.writeFileSync(path.join(__dirname, "..", "assets", "quran", "quran.json"), JSON.stringify({ v: 1, source: "Tanzil Quran Text (Uthmani) — tanzil.net — CC BY 3.0", basmala: BSM_TXT, suras: out }));
console.log("ok", out.length, total);
