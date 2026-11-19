// «المجالس» — نواة الكتاب المشتركة بين شاشة العرض (book.html) وغرفة التحكّم:
//  1) صفحة النصّ (الشاملة) تُصفّ على «ورقة قياسيّة» ثابتة العرض (W0) ثمّ تُكبَّر/تُصغَّر بـtransform، فتتطابق مواضع الأسطر في كل المشاهد.
//  2) استخراج أسطر الصفحة بدقّة: من DOM لصفحات النصّ، ومن تحليل بصمة الحبر على صورة الصفحة لملفّات PDF.
//  كل سطر = { t, b, l, r } كنسب (0–1) من عرض الصفحة وارتفاعها.
(function (G) {
  const W0 = 1000, ASP0 = .70, H0 = W0 / ASP0;
  const CSS = `
  .tp{position:absolute;left:0;top:0;box-sizing:border-box;width:${W0}px;height:${H0}px;transform-origin:0 0;padding:${W0 * .075}px ${W0 * .09}px ${W0 * .06}px;color:var(--ink,#1b1a17);font-family:"Amiri",serif;display:flex;flex-direction:column;direction:rtl}
  .tp .hd{display:flex;justify-content:space-between;align-items:baseline;font:500 .62em var(--fs,"Cairo",sans-serif);color:#7a6a4c;border-bottom:1px solid #cdbb91;padding-bottom:.35em;margin-bottom:.7em;flex:none}
  .tp .bd{flex:1;overflow:hidden;line-height:1.85;text-align:justify}
  .tp .bd p{margin:0 0 .25em}
  .tp .bd .h{display:block;text-align:center;font-weight:700;color:#5b3f12;margin:.35em 0}
  .tp .ft{flex:none;border-top:1px solid #cdbb91;margin-top:.5em;padding-top:.4em;font-size:.72em;line-height:1.7;color:#3c3a33;max-height:42%;overflow:hidden}
  .tp sup{font-size:.62em;color:#8a6a2c}
  .tp .no{flex:none;text-align:center;font:500 .6em var(--fs,"Cairo",sans-serif);color:#7a6a4c;margin-top:.5em}`;
  let cssIn = false;
  const css = () => { if (cssIn) return; cssIn = true; const s = document.createElement("style"); s.id = "bookcore-css"; s.textContent = CSS; document.head.appendChild(s); };
  const ar = n => String(n).replace(/[0-9]/g, d => "0123456789"[d]);

  /** صفحة نصّ على الورقة القياسيّة (W0×H0)، بخطّ مصغَّر حتى تدخل كاملة. ‎fit‎ تُعاد بعد تحميل الخطّ. */
  const lat = x => String(x ?? "").replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632);          // أرقام الكتب المحفوظة سابقاً بالهنديّة تُعرض عربيّة (1234)
  function textBox(pg, meta) {
    css(); pg = Object.assign({}, pg, { label: lat(pg.label), body: lat(pg.body), notes: lat(pg.notes) });
    const box = document.createElement("div"); box.className = "tp";
    box.innerHTML = `<div class="hd"><span>${meta.short || meta.title || ""}</span><span>${pg.label || ""}</span></div><div class="bd">${pg.body}</div>${pg.notes ? `<div class="ft">${pg.notes}</div>` : ""}<div class="no">${ar(pg.p ?? "")}</div>`;
    box.fit = () => {
      let fs = Math.min(W0 * .055, H0 * .036); const bd = box.querySelector(".bd"), ft = box.querySelector(".ft");
      box.style.fontSize = fs + "px";
      const over = () => bd.scrollHeight > bd.clientHeight + 1 || (ft && ft.scrollHeight > ft.clientHeight + 1);
      for (let k = 0; k < 60 && over() && fs > 9; k++) { fs *= .95; box.style.fontSize = fs + "px"; }
    };
    return box;
  }

  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  /** أسطر صفحة نصّ موضوعة في DOM (بلا transform): تجمع قطع النصّ بحسب مركزها الرأسيّ */
  function textLines(box) {
    const bd = box.querySelector(".bd"); if (!bd) return [];
    const B = box.getBoundingClientRect(), bw = B.width || W0, bh = B.height || H0;
    const rects = [], tw = document.createTreeWalker(bd, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const n = tw.currentNode; if (!n.data.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) rects.push({ c: (r.top + r.bottom) / 2, h: r.height, l: r.left, r: r.right });
    }
    if (!rects.length) return [];
    rects.sort((a, b) => a.c - b.c);
    const hh = median(rects.map(r => r.h)), tol = hh * .55, groups = [];
    for (const r of rects) { const g = groups[groups.length - 1]; if (g && Math.abs(r.c - g.c) <= tol) { g.c = (g.c * g.n + r.c) / (g.n + 1); g.n++; g.l = Math.min(g.l, r.l); g.r = Math.max(g.r, r.r); } else groups.push({ c: r.c, n: 1, l: r.l, r: r.r }); }
    const pitch = groups.length > 1 ? median(groups.slice(1).map((g, i) => g.c - groups[i].c).filter(d => d > hh * .6)) || hh * 1.5 : hh * 1.6;
    let L = Infinity, R = -Infinity; groups.forEach(g => { L = Math.min(L, g.l); R = Math.max(R, g.r); });
    return groups.map(g => ({ t: Math.max(0, (g.c - pitch / 2 - B.top) / bh), b: Math.min(1, (g.c + pitch / 2 - B.top) / bh), l: (L - B.left) / bw, r: (R - B.left) / bw }));
  }

  const loadImg = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("img")); im.src = url; });

  /** أسطر صورة صفحة (PDF/مسح ضوئيّ): بصمة الحبر على الصفوف ثمّ دمج الفجوات الصغيرة (التشكيل والنقاط) وحذف الحدود والضجيج */
  async function imageLines(url) {
    const im = await loadImg(url), W = 360, H = Math.max(40, Math.round(W * im.naturalHeight / im.naturalWidth));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, lum = new Uint8Array(W * H), hist = new Uint32Array(256);
    for (let i = 0; i < W * H; i++) { const v = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) | 0; lum[i] = v; hist[v]++; }
    let acc = 0, bg = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= W * H * .8) { bg = v; break; } }
    const thr = Math.max(60, bg - 62);
    const x0 = Math.round(W * .035), x1 = Math.round(W * .965), y0 = Math.round(H * .015), y1 = Math.round(H * .985);
    const rows = new Float32Array(H);
    for (let y = y0; y < y1; y++) { let c = 0; for (let x = x0; x < x1; x++) if (lum[y * W + x] < thr) c++; rows[y] = c; }
    const sm = rows.map((v, y) => (v * 2 + (rows[y - 1] || 0) + (rows[y + 1] || 0)) / 4);
    const top = Array.from(sm).sort((a, b) => b - a)[Math.max(0, Math.floor(H * .03))] || 1, tr = Math.max(2, top * .14);
    let runs = [], s = -1;
    for (let y = 0; y <= H; y++) { const on = y < H && sm[y] > tr; if (on && s < 0) s = y; else if (!on && s >= 0) { runs.push([s, y - 1]); s = -1; } }
    if (!runs.length) return [];
    const mh = median(runs.map(r => r[1] - r[0] + 1).filter(h => h > 3)) || 8;
    // دمج الفجوات الصغيرة
    const merged = [runs[0].slice()];
    for (const r of runs.slice(1)) { const l = merged[merged.length - 1]; if (r[0] - l[1] <= Math.max(2, mh * .28)) l[1] = r[1]; else merged.push(r.slice()); }
    // حذف الحدود الرفيعة العريضة والضجيج
    const keep = [];
    for (const [a, b] of merged) {
      const h = b - a + 1; if (h < mh * .42 || h < 5) continue;
      let cols = 0, first = W, last = -1;
      for (let x = x0; x < x1; x++) { let c = 0; for (let y = a; y <= b; y++) if (lum[y * W + x] < thr) c++; if (c >= 2) { cols++; if (x < first) first = x; if (x > last) last = x; } }
      if (last < 0) continue;
      if (h <= 4 && (last - first) > W * .8) continue;                 // خطّ إطار
      keep.push({ a, b, l: first, r: last });
    }
    if (!keep.length) return [];
    let L = Infinity, R = -Infinity; keep.forEach(k => { L = Math.min(L, k.l); R = Math.max(R, k.r); });
    return keep.map((k, i) => {
      const above = i ? k.a - keep[i - 1].b : k.a, below = i < keep.length - 1 ? keep[i + 1].a - k.b : H - k.b;
      return { t: Math.max(0, (k.a - Math.min(above, mh) * .38) / H), b: Math.min(1, (k.b + Math.min(below, mh) * .38) / H), l: Math.max(0, L / W - .01), r: Math.min(1, R / W + .01) };
    });
  }

  G.BookCore = { W0, H0, ASP0, textBox, textLines, imageLines, css };
})(window);
