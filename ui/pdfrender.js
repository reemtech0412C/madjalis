// تحويل كتاب PDF (ملفّ أو عدّة مجلّدات) إلى صور صفحات JPG + فهرس من علامات الملفّ
import * as pdfjs from "/pdfjs/build/pdf.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/build/pdf.worker.mjs";

const TARGET_H = 1700;   // ارتفاع الصفحة بالبكسل (حادّة حتى في وضع التكبير)

async function outlineToc(doc, offset) {
  const out = [], ol = await doc.getOutline().catch(() => null);
  if (!ol) return out;
  const walk = async (items, level) => {
    for (const it of items) {
      try {
        const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest;
        if (dest && dest[0]) { const idx = await doc.getPageIndex(dest[0]); out.push({ title: it.title, level, page: offset + idx + 1 }); }
      } catch {}
      if (it.items && it.items.length && level < 4) await walk(it.items, level + 1);
    }
  };
  await walk(ol, 2);
  return out;
}

window.renderPdfBook = async (meta, progress) => {
  const docs = [];
  for (const f of meta.files) {
    const doc = await pdfjs.getDocument({ url: `/books/${encodeURIComponent(meta.id)}/src/${encodeURIComponent(f.file)}`,
      cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
    docs.push({ doc, label: f.label });
  }
  const total = docs.reduce((a, d) => a + d.doc.numPages, 0);
  let n = 0, aspect = .7; const toc = [];
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { alpha: false });
  for (let k = 0; k < docs.length; k++) {
    const { doc, label } = docs[k];
    if (docs.length > 1) toc.push({ title: label || `المجلّد ${k + 1}`, level: 1, page: n + 1 });
    toc.push(...await outlineToc(doc, n));
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: TARGET_H / v1.height });
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      n++;
      if (n === 1 || n === 3) aspect = vp.width / vp.height;     // نتجاهل الغلاف لو مختلف
      const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", .84));
      await window.minbar.call("lib:writePage", meta.id, n, await blob.arrayBuffer());
      pg.cleanup();
      progress(n, total, label);
    }
    await doc.destroy();
  }
  return { pages: n, aspect: +aspect.toFixed(4), toc };
};

// نصّ كل صفحة من ملفّات PDF (من طبقة النصّ إن وُجدت) لبناء فهرس البحث؛ الترتيب نفسه ترقيم صفحات الكتاب
window.extractPdfText = async (meta, progress) => {
  const pages = [];
  for (const f of meta.files) {
    const doc = await pdfjs.getDocument({ url: `/books/${encodeURIComponent(meta.id)}/src/${encodeURIComponent(f.file)}`,
      cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), tc = await pg.getTextContent().catch(() => ({ items: [] }));
      pages.push(tc.items.map(x => x.str).join(" ").replace(/\s+/g, " ").trim());
      if (progress && i % 10 === 0) progress(pages.length);
    }
  }
  return pages;
};
