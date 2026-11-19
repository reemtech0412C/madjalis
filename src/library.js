// مكتبة «منبر»: الشاملة (عبر تراث)، أرشيف الإنترنت، وملفّات PDF من الجهاز.
// كل كتاب مجلّد في books/<id>/ فيه book.json + (pages/*.jpg للمصوّر | text.json للنصّيّ) + src/ للملفّات الأصليّة.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UA = { "User-Agent": "Minbar/0.1 (lessons broadcaster)" };
const TURATH_DATA = "https://files.turath.io/data-v3.json";
const TURATH_BOOK = id => `https://files.turath.io/books-v3/${id}.json`;
const TURATH_INFO = id => `https://api.turath.io/book?id=${id}&include=indexes&ver=3`;
const TURATH_PDF = (root, file) => `https://files.turath.io/pdf/${root}/${file}`;      // مثال: /pdf/shamela/1/41557.pdf

class Library {
  constructor(dataDir) {
    this.dir = path.join(dataDir, "books"); this.cache = path.join(dataDir, "cache");
    fs.mkdirSync(this.dir, { recursive: true }); fs.mkdirSync(this.cache, { recursive: true });
  }
  bookDir(id) { return path.join(this.dir, id); }
  readMeta(id) { try { return JSON.parse(fs.readFileSync(path.join(this.bookDir(id), "book.json"), "utf8")); } catch { return null; } }
  writeMeta(id, meta) { fs.mkdirSync(this.bookDir(id), { recursive: true }); fs.writeFileSync(path.join(this.bookDir(id), "book.json"), JSON.stringify(meta)); return meta; }
  list() {
    return fs.readdirSync(this.dir).map(id => this.readMeta(id)).filter(Boolean)
      .map(m => ({ id: m.id, title: m.title, author: m.author, kind: m.kind, pages: m.pages, source: m.source, ready: m.ready !== false, added: m.added }))
      .sort((a, b) => (b.added || 0) - (a.added || 0));
  }
  /** تعديل بيانات الكتاب (العنوان والمؤلّف) */
  updateMeta(id, f) {
    const m = this.readMeta(id); if (!m) throw new Error("الكتاب غير موجود");
    const title = String(f.title || "").trim() || m.title;
    return this.writeMeta(id, Object.assign(m, { title, short: String(f.short || "").trim() || title.split(" - ")[0].slice(0, 60), author: String(f.author ?? m.author ?? "").trim() }));
  }
  remove(id) { this.idx && this.idx.delete(id); fs.rmSync(this.bookDir(id), { recursive: true, force: true }); }

  // ---------- البحث داخل الكتاب ----------
  // النصّيّ: من text.json. المصوّر (PDF): من search.json الذي تبنيه الواجهة من طبقة النصّ في الملفّ (مرّة واحدة ثمّ يُحفظ).
  searchPages(id) {
    this.idx = this.idx || new Map();
    if (this.idx.has(id)) return this.idx.get(id);
    const AS = require("../overlays/arsearch.js"), dir = this.bookDir(id), meta = this.readMeta(id); if (!meta) return null;
    let plain = null;
    try {
      if (meta.kind === "text") plain = JSON.parse(fs.readFileSync(path.join(dir, "text.json"), "utf8")).map(p => AS.stripHtml((p.body || "") + " " + (p.notes || "")));
      else plain = JSON.parse(fs.readFileSync(path.join(dir, "search.json"), "utf8")).pages;
    } catch { return null; }
    const pages = plain.map(t => ({ plain: t, n: AS.normMap(t) }));
    const ent = { pages, chars: plain.reduce((a, t) => a + t.length, 0) };
    this.idx.set(id, ent); return ent;
  }
  searchBook(id, query) {
    const meta = this.readMeta(id); if (!meta) throw new Error("الكتاب غير موجود");
    const ent = this.searchPages(id);
    if (!ent) return { needIndex: meta.kind !== "text", results: [], total: 0 };
    if (meta.kind !== "text" && ent.chars < 40 * Math.max(1, ent.pages.length) * .2) return { noText: true, results: [], total: 0 };   // مصوّر بلا نصّ
    return Object.assign({ pagesTotal: ent.pages.length }, require("../overlays/arsearch.js").search(ent.pages, query));
  }
  saveSearchIndex(id, pages) {
    fs.writeFileSync(path.join(this.bookDir(id), "search.json"), JSON.stringify({ pages: pages.map(t => String(t || "")) }));
    this.idx && this.idx.delete(id); return true;
  }

  // ---------- التحميل ----------
  async download(url, dest, onProgress) {
    const r = await fetch(url, { headers: UA, redirect: "follow" });
    if (!r.ok) throw new Error(`تعذّر التحميل (${r.status})`);
    const total = +r.headers.get("content-length") || 0;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = dest + ".part", out = fs.createWriteStream(tmp);
    let got = 0;
    for await (const chunk of r.body) { out.write(chunk); got += chunk.length; onProgress && onProgress(got, total); }
    await new Promise(res => out.end(res));
    fs.renameSync(tmp, dest);
    return dest;
  }
  async json(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

  // ---------- الشاملة ----------
  async shamelaCatalog() {
    const f = path.join(this.cache, "turath-data.json");
    let d = null;
    try { const st = fs.statSync(f); if (Date.now() - st.mtimeMs < 7 * 864e5) d = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    if (!d) { try { d = await this.json(TURATH_DATA); fs.writeFileSync(f, JSON.stringify(d)); } catch (e) { if (fs.existsSync(f)) d = JSON.parse(fs.readFileSync(f, "utf8")); else throw e; } }
    const authors = d.authors, cats = Object.values(d.cats).map(c => ({ id: c.id, name: c.name }));
    const books = Object.values(d.books).map(b => [b.id, b.name, (authors[b.author_id] || {}).name || "", b.cat_id, b.has_pdf ? 1 : 0, b.page_count || 0]);
    return { cats, books };
  }
  async shamelaInfo(id) {
    const d = await this.json(TURATH_INFO(id));
    const m = d.meta || {};
    return { id, name: m.name, info: m.info, pdf: m.pdf_links && m.pdf_links.files ? m.pdf_links : null, headings: (d.indexes || {}).headings || [], volumes: (d.indexes || {}).volumes || [] };
  }
  // النسخة النصّيّة: تُصفّ صفحاتها في البرنامج بترقيم المطبوع
  async shamelaText(id, onProgress) {
    const info = await this.shamelaInfo(id);
    const bid = `sh-${id}`, dir = this.bookDir(bid);
    const raw = path.join(dir, "src", "book.json");
    await this.download(TURATH_BOOK(id), raw, (g, t) => onProgress && onProgress({ phase: "تحميل النصّ", got: g, total: t }));
    const d = JSON.parse(fs.readFileSync(raw, "utf8"));
    const pages = d.pages || Object.values(d).find(v => Array.isArray(v)) || [];
    const multi = new Set(pages.map(p => p.vol)).size > 1;
    const text = pages.map(pg => normPage(pg, multi));
    fs.writeFileSync(path.join(dir, "text.json"), JSON.stringify(text));
    const name = info.name || `كتاب ${id}`;
    return this.writeMeta(bid, { id: bid, kind: "text", source: "الشاملة", shamelaId: id, title: name, short: name.split(" - ")[0], author: authorOf(info.info),
      pages: text.length, aspect: .70, toc: info.headings.map(h => ({ title: h.title, level: h.level, page: h.page })), added: Date.now(), ready: true });
  }
  // النسخة المصوّرة (PDF المطبوع): تُحمَّل ملفّاتها، ثمّ الواجهة تحوّلها لصور صفحات
  async shamelaPdf(id, onProgress) {
    const info = await this.shamelaInfo(id);
    if (!info.pdf) throw new Error("ما لهذا الكتاب نسخة مصوّرة");
    const bid = `shp-${id}`, files = [];
    const list = info.pdf.files.map(f => { const [file, label] = f.split("|"); return { file, label: label && label !== "0" ? label : "" }; });
    for (let i = 0; i < list.length; i++) {
      const dest = path.join(this.bookDir(bid), "src", `${String(i + 1).padStart(2, "0")}.pdf`);
      await this.download(TURATH_PDF(info.pdf.root, list[i].file), dest, (g, t) => onProgress && onProgress({ phase: `تحميل الملفّ ${i + 1} من ${list.length}`, got: g, total: t }));
      files.push({ file: path.basename(dest), label: list[i].label });
    }
    const name = info.name || `كتاب ${id}`;
    return this.writeMeta(bid, { id: bid, kind: "pdf", source: "الشاملة (مصوّر)", shamelaId: id, title: name, short: name.split(" - ")[0], author: authorOf(info.info),
      files, pages: 0, aspect: .70, toc: [], added: Date.now(), ready: false });
  }

  // ---------- أرشيف الإنترنت ----------
  async archiveSearch(q) {
    const query = `(${q}) AND mediatype:texts`;
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=downloads&rows=40&sort[]=downloads+desc&output=json`;
    const d = await this.json(u);
    return (d.response && d.response.docs || []).map(x => ({ id: x.identifier, title: [].concat(x.title || "")[0], creator: [].concat(x.creator || "")[0] || "", date: x.date || "", downloads: x.downloads || 0 }));
  }
  async archiveFiles(id) {
    const d = await this.json(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    const files = (d.files || []).filter(f => /\.pdf$/i.test(f.name)).map(f => ({ name: f.name, size: +f.size || 0, format: f.format }));
    return { title: d.metadata && [].concat(d.metadata.title || "")[0], creator: d.metadata && [].concat(d.metadata.creator || "")[0], files };
  }
  async archivePdf(id, files, title, author, onProgress) {
    const bid = "ia-" + id.replace(/[^\w.-]/g, "_").slice(0, 60), out = [];
    for (let i = 0; i < files.length; i++) {
      const dest = path.join(this.bookDir(bid), "src", `${String(i + 1).padStart(2, "0")}.pdf`);
      await this.download(`https://archive.org/download/${encodeURIComponent(id)}/${files[i].split("/").map(encodeURIComponent).join("/")}`, dest,
        (g, t) => onProgress && onProgress({ phase: `تحميل ${i + 1} من ${files.length}`, got: g, total: t }));
      out.push({ file: path.basename(dest), label: files.length > 1 ? files[i].replace(/\.pdf$/i, "") : "" });
    }
    return this.writeMeta(bid, { id: bid, kind: "pdf", source: "أرشيف الإنترنت", archiveId: id, title: title || id, short: (title || id).slice(0, 60), author: author || "",
      files: out, pages: 0, aspect: .70, toc: [], added: Date.now(), ready: false });
  }

  // ---------- ملفّ من الجهاز ----------
  importPdf(filePath, title) {
    const h = crypto.createHash("sha1").update(filePath + fs.statSync(filePath).size).digest("hex").slice(0, 10);
    const bid = "pdf-" + h, dest = path.join(this.bookDir(bid), "src", "01.pdf");
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(filePath, dest);
    const name = title || path.basename(filePath).replace(/\.pdf$/i, "");
    return this.writeMeta(bid, { id: bid, kind: "pdf", source: "ملفّ من جهازك", title: name, short: name.slice(0, 60), author: "", files: [{ file: "01.pdf", label: "" }], pages: 0, aspect: .70, toc: [], added: Date.now(), ready: false });
  }
  // تكتب الواجهة صور الصفحات بعد تحويلها
  writePage(id, n, buf) { const d = path.join(this.bookDir(id), "pages"); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, String(n).padStart(4, "0") + ".jpg"), Buffer.from(buf)); }
  finishPdf(id, { pages, aspect, toc }) { const m = this.readMeta(id); return this.writeMeta(id, Object.assign(m, { pages, aspect, toc: toc || m.toc || [], ready: true })); }
}

// ---------- تنظيف نصّ صفحة من الشاملة ----------
const AR = s => String(s).replace(/[0-9]/g, d => "0123456789"[d]);
function normPage(pg, multi) {
  let t = String(pg.text || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "‹").replace(/&gt;/g, "›").replace(/&amp;/g, "&");
  const cut = t.indexOf("<hr>");
  let body = cut >= 0 ? t.slice(0, cut) : t, notes = cut >= 0 ? t.slice(cut + 4) : "";
  const clean = s => s.replace(/<span[^>]*data-type="title"[^>]*>([\s\S]*?)<\/span>/g, "\u0001$1\u0002").replace(/<[^>]+>/g, "")
    .replace(/[<>]/g, "").replace(/\u0001/g, '<span class="h">').replace(/\u0002/g, "</span>")
    .replace(/\(\^([0-90-9]+)\)/g, (_, n) => `<sup>(${AR(n)})</sup>`);
  const para = s => clean(s).split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => x.startsWith('<span class="h">') && x.endsWith("</span>") ? x : `<p>${x}</p>`).join("");
  const label = pg.page != null ? (multi && pg.vol ? `ج${AR(pg.vol)} · ص${AR(pg.page)}` : `ص${AR(pg.page)}`) : "";
  return { v: pg.vol || null, p: pg.page ?? null, label, body: para(body), notes: notes.trim() ? para(notes) : "" };
}
function authorOf(info) { const m = String(info || "").match(/المؤلف:\s*([^\n]+)/); return m ? m[1].trim() : ""; }

module.exports = { Library };
