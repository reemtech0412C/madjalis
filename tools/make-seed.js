// يجهّز «حزمة البيانات الأوّليّة» التي تُضمَّن في المثبّت: الحلقات وشعاراتها وصور الشيوخ والكتب المرتبطة بالحلقات فقط، دون أيّ بيانات خاصّة (مفاتيح البثّ، رمز الهاتف، الأجهزة، المجلّدات).
//   node tools/make-seed.js           ← ينسخ من %APPDATA%\Minbar إلى مجلّد seed بجانب البرنامج
const fs = require("fs"), path = require("path");
const SRC = path.join(process.env.APPDATA, "Minbar"), OUT = path.join(__dirname, "..", "seed");
const KEEP = ["halaqat", "sel", "book", "bookState", "texts", "design", "logos", "mode", "modes", "modeItems", "breakOn", "captions", "reels", "uiTheme", "autoRec", "audioRec", "duo", "cam2", "quality"];
const s = JSON.parse(fs.readFileSync(path.join(SRC, "settings.json"), "utf8"));
const out = {}; for (const k of KEEP) if (s[k] !== undefined) out[k] = JSON.parse(JSON.stringify(s[k]));
if (out.design) delete out.design.hideSpeaker;
// الكتب: فقط ما تستعمله الحلقات (libId) — لتبقى الحزمة صغيرة؛ والكتب الأخرى تُنزَّل من المكتبة عند الحاجة
const BD = path.join(SRC, "books"), keep = [...new Set((out.halaqat || []).flatMap(h => h.books.map(b => b.libId)).filter(Boolean))].filter(id => fs.existsSync(path.join(BD, id)));
if (out.book && !keep.includes(out.book.id)) out.book = null;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "settings.json"), JSON.stringify(out, null, 1));
fs.cpSync(path.join(SRC, "media"), path.join(OUT, "media"), { recursive: true });
for (const id of keep) fs.cpSync(path.join(BD, id), path.join(OUT, "books", id), { recursive: true });
console.log("حلقات:", (out.halaqat || []).length, "| كتب:", keep.join(", ") || "(لا شيء)");
