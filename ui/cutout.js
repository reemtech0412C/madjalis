// «المجالس» — إزالة خلفيّة صورة الشيخ بذكاء: نموذج تقسيم أشخاص (MediaPipe، يعمل محلّيّاً بلا إنترنت) + تنعيم الحواف بمرشّح موجَّه (guided filter)
// فتتبع الحافّةُ حدودَ الشعر والعمامة الحقيقيّة بدل قناع النموذج الخشن (256×256)، ثمّ تنقية الجزر المعزولة وقصّ الصورة حول الشيخ.
const CUT = { seg: null, loading: null };
async function cutLoad() {
  if (CUT.seg) return CUT.seg;
  if (!CUT.loading) CUT.loading = (async () => {
    const mp = await import("/mp/vision_bundle.mjs");
    const fs = await mp.FilesetResolver.forVisionTasks("/mp/wasm");
    return mp.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: "/assets/models/selfie_multiclass_256x256.tflite", delegate: "CPU" }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false });
  })();
  CUT.seg = await CUT.loading; return CUT.seg;
}

// مرشّح الصندوق بالمجاميع التراكميّة (O(N))
function boxFilter(src, w, h, r) {
  const out = new Float32Array(w * h), tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0, row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = acc / (2 * r + 1); acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}
function guided(I, p, w, h, r, eps) {
  const N = w * h, Ip = new Float32Array(N), II = new Float32Array(N);
  for (let i = 0; i < N; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
  const mI = boxFilter(I, w, h, r), mp = boxFilter(p, w, h, r), mIp = boxFilter(Ip, w, h, r), mII = boxFilter(II, w, h, r);
  const a = new Float32Array(N), b = new Float32Array(N);
  for (let i = 0; i < N; i++) { const cov = mIp[i] - mI[i] * mp[i], v = mII[i] - mI[i] * mI[i]; a[i] = cov / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
  const ma = boxFilter(a, w, h, r), mb = boxFilter(b, w, h, r), q = new Float32Array(N);
  for (let i = 0; i < N; i++) q[i] = ma[i] * I[i] + mb[i];
  return q;
}
// يُبقي المكوّنات الكبيرة المتّصلة فقط (يحذف بقايا الخلفيّة المعزولة)
function keepBig(alpha, w, h, thr = .5, minFrac = .04) {
  const N = w * h, lab = new Int32Array(N), sizes = []; let nl = 0; const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (lab[s] || alpha[s] < thr) continue;
    nl++; let sp = 0, cnt = 0; stack[sp++] = s; lab[s] = nl;
    while (sp) { const i = stack[--sp]; cnt++; const x = i % w, y = (i / w) | 0;
      if (x > 0 && !lab[i - 1] && alpha[i - 1] >= thr) { lab[i - 1] = nl; stack[sp++] = i - 1; }
      if (x < w - 1 && !lab[i + 1] && alpha[i + 1] >= thr) { lab[i + 1] = nl; stack[sp++] = i + 1; }
      if (y > 0 && !lab[i - w] && alpha[i - w] >= thr) { lab[i - w] = nl; stack[sp++] = i - w; }
      if (y < h - 1 && !lab[i + w] && alpha[i + w] >= thr) { lab[i + w] = nl; stack[sp++] = i + w; } }
    sizes[nl] = cnt;
  }
  const max = Math.max(0, ...sizes.filter(Boolean)), keep = new Uint8Array(nl + 1);
  sizes.forEach((c, k) => { if (c >= max * minFrac * 5) keep[k] = 1; });
  // تقريب المنطقة المحتفَظ بها بمقدار قليل حتى لا نقصّ حافّة الشعر الناعمة
  const out = new Float32Array(N), near = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (lab[i] && keep[lab[i]]) near[i] = 1;
  const R = 6, dil = boxFilter(Float32Array.from(near), w, h, R);
  for (let i = 0; i < N; i++) out[i] = dil[i] > 0.001 ? alpha[i] : 0;
  return out;
}

/** l = { file } بالاسم داخل مجلّد الوسائط ← يحفظ نسخة PNG شفّافة ويرجع اسمها (أو null لو لم يُكتشف شخص) */
async function smartCutout(l, onP) {
  const seg = await cutLoad(); onP && onP(.2);
  const img = new Image(); img.src = "/media/" + encodeURIComponent(l.file); await img.decode();
  const sc = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const res = seg.segment(c); onP && onP(.5);
  const bgMask = res.confidenceMasks[0], mw = bgMask.width, mh = bgMask.height, bg = bgMask.getAsFloat32Array();
  // احتمال الشخص = 1 − الخلفيّة، ثمّ تكبير تثنائيّ إلى مقاس الصورة
  const P = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const fy = Math.min(mh - 1.001, y * (mh - 1) / (h - 1)), y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < w; x++) { const fx = Math.min(mw - 1.001, x * (mw - 1) / (w - 1)), x0 = fx | 0, tx = fx - x0, i = y0 * mw + x0;
      const v = (1 - bg[i]) * (1 - tx) * (1 - ty) + (1 - bg[i + 1]) * tx * (1 - ty) + (1 - bg[i + mw]) * (1 - tx) * ty + (1 - bg[i + mw + 1]) * tx * ty; P[y * w + x] = v; } }
  bgMask.close && bgMask.close(); res.confidenceMasks.forEach(m => m.close && m.close());
  const d = g.getImageData(0, 0, w, h), px = d.data, I = new Float32Array(w * h);
  for (let i = 0; i < I.length; i++) I[i] = (px[i * 4] * .299 + px[i * 4 + 1] * .587 + px[i * 4 + 2] * .114) / 255;
  let person = 0; for (let i = 0; i < P.length; i++) if (P[i] > .5) person++;
  if (person < w * h * .02) return null;                                   // لم يُكتشف شخص
  const r = Math.max(4, Math.round(Math.max(w, h) / 170));
  const q = guided(I, P, w, h, r, 2e-4); onP && onP(.75);
  // منحنى تباين يحدّ الحافّة (يدفع القيم نحو 0/1) ثمّ تنقية الجزر
  let A = new Float32Array(w * h); for (let i = 0; i < A.length; i++) { let v = (q[i] - .56) * 2.8 + .5; A[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
  A = keepBig(A, w, h);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = A[y * w + x]; px[(y * w + x) * 4 + 3] = Math.round(a * 255); if (a > .05) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  g.putImageData(d, 0, 0);
  const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  const blob = await new Promise(res => o.toBlob(res, "image/png")); onP && onP(.95);
  return api.call("media:saveLogoCut", l.file, await blob.arrayBuffer());
}
