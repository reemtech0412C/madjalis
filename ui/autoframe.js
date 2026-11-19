// «المجالس» — التأطير الذكي لكاميرا الشيخ: يلتقط لقطة من الكاميرا، يكشف الوجه محلّيّاً (بلا إنترنت)،
// ثمّ يضبط مركز القصّ والتقريب فيبقى الشيخ في وسط الإطار الصغير (الكتاب + الشيخ) وفي كل المشاهد.
const AF = { ready: false, busy: false, fast: 0, wasLive: false, last: null, misses: 0 };
const afClamp = (v, a, b) => Math.min(b, Math.max(a, v));

function afLoadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل " + src)); document.head.appendChild(s); }); }
async function afLoad() {
  if (AF.ready) return;
  await afLoadScript("/faceapi/dist/face-api.js");
  await faceapi.nets.tinyFaceDetector.loadFromUri("/faceapi/model");
  AF.ready = true;
}
// صورة مدوَّرة باتّجاه عقارب الساعة (لتجربة الاتّجاهات)؛ 0 يرجع الصورة نفسها
function afRotate(img, r) {
  if (!r) return img;
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas"), swap = r === 90 || r === 270;
  c.width = swap ? H : W; c.height = swap ? W : H;
  const g = c.getContext("2d"); g.translate(c.width / 2, c.height / 2); g.rotate(r * Math.PI / 180); g.drawImage(img, -W / 2, -H / 2);
  return c;
}
// حدود الصورة الفعليّة داخل الإطار: الهاتف العموديّ عبر الكاميرا الافتراضيّة يصل غالباً في وسط إطار أفقيّ بأشرطة سوداء.
// لا نقبل إلا أشرطة على جانبين (أو أعلى وأسفل) والصورة تملأ المحور الآخر، فلا تلتبس صورة صغيرة على خلفية سوداء بأشرطة.
function afBounds(src) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight, k = 192 / sw, w = 192, h = Math.max(8, Math.round(sh * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, TH = 28;
  const col = new Uint8Array(w), row = new Uint8Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = Math.max(d[i], d[i + 1], d[i + 2]); if (v > TH) { col[x] = 1; row[y] = 1; } }
  const first = a => a.indexOf(1), last = a => a.lastIndexOf(1);
  const x0 = first(col), x1 = last(col) + 1, y0 = first(row), y1 = last(row) + 1;
  if (x0 < 0) return [0, 0, 1, 1];
  const fw = (x1 - x0) / w, fh = (y1 - y0) / h, pad = .012;
  if (fh >= .9 && fw >= .25 && fw <= .94) return [Math.min(1, x0 / w + pad), 0, Math.max(0, x1 / w - pad), 1];          // أشرطة جانبيّة (هاتف عموديّ)
  if (fw >= .9 && fh >= .25 && fh <= .94) return [0, Math.min(1, y0 / h + pad), 1, Math.max(0, y1 / h - pad)];          // أشرطة علويّة وسفليّة
  return [0, 0, 1, 1];
}
function renderFit() {
  cards("fitSeg", "camFit", [
    { v: "crop", t: "قصّ ذكيّ", s: "نافذة أفقيّة كبيرة حول وجه الشيخ", art: `<svg viewBox="0 0 60 34" width="60"><rect x="1" y="1" width="58" height="32" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="21" y="4" width="18" height="26" rx="2" fill="currentColor" opacity=".25"/><rect x="2" y="9" width="56" height="16" rx="2" fill="none" stroke="#D1AA62" stroke-width="2"/></svg>` },
    { v: "fit", t: "عموديّ كامل", s: "الصورة كاملة بخلفيّة مغبَّشة", art: `<svg viewBox="0 0 60 34" width="60"><rect x="1" y="1" width="58" height="32" rx="3" fill="currentColor" opacity=".18" stroke="currentColor" opacity=".5"/><rect x="21" y="3" width="18" height="28" rx="2" fill="#D1AA62"/></svg>` }],
    S().design.camFit || "crop", v => patch({ design: { camFit: v } }).then(renderFit));
}
function renderRot() {
  const set = v => { const fr = S().framing; return patch({ design: { camRot: v }, framing: v === "auto" ? fr : Object.assign({}, fr, { sheikh: Object.assign({}, fr.sheikh, { rot: +v }) }) }).then(renderRot); };
  cards("rotSeg", "camRot", [{ v: "auto", t: "تلقائي" }, { v: "0", t: "0°" }, { v: "90", t: "90°" }, { v: "180", t: "180°" }, { v: "270", t: "270°" }], String(S().design.camRot || "auto"), set);
}
function afRender() {
  const on = S().design.autoFrame !== false;
  $("autoFrame").checked = on;
  $("afState").textContent = !on ? "متوقّف — الضبط يدويّ" : AF.last ? `وجه الشيخ: ${AF.last}` : "بانتظار الكاميرا…";
}
// يكشف وجه الشيخ ويحسب الإطار؛ force = التقاط فوري بلا تنعيم
async function afTick(force) {
  return Promise.race([afTickInner(force), new Promise(r => setTimeout(() => { AF.busy = false; r(false); }, 20000))]);
}
async function afTickInner(force) {
  if (AF.busy || S().design.autoFrame === false) return false;
  const live = ST.cams && ST.cams.live && ST.cams.live.sheikh;
  if (!live) { AF.last = null; return false; }
  AF.busy = true;
  try {
    await afLoad();
    const snap = await api.call("cam:snap"); if (!snap || !snap.img) return false;
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("صورة غير صالحة")); setTimeout(() => rej(new Error("انتهت مهلة تحميل اللقطة")), 8000); img.src = snap.img; });
    // الهاتف العموديّ: قد تصل الصورة جانبيّة. نجرّب الاتّجاهات (الحاليّ أوّلاً) حتى نجد وجهاً منتصباً، ونعتمد ذلك الاتّجاه
    const cur0 = S().framing.sheikh, mode = S().design.camRot || "auto", curRot = cur0.rot || 0;
    const cands = mode === "auto" ? [curRot, ...[0, 90, 270, 180].filter(r => r !== curRot)] : [+mode];
    let dets = [], rot = curRot, src = img;
    for (const r of cands) {
      src = afRotate(img, r);
      dets = AF.mock ? AF.mock(src) : await faceapi.detectAllFaces(src, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .4 }));   // AF.mock للاختبار فقط
      if (dets.length) { rot = r; break; }
    }
    if (!dets.length) { AF.misses++; if (AF.misses === 3) { AF.last = "لم يُرَ — يبقى الإطار كما هو"; afRender(); } return false; }
    AF.misses = 0;
    const d = dets.reduce((a, b) => b.box.width * b.box.height > a.box.width * a.box.height ? b : a);   // الأكبر = الأقرب = الشيخ
    const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
    const bn = afBounds(src), cwN = bn[2] - bn[0], chN = bn[3] - bn[1], asp = (W * cwN) / (H * chN);      // مقاس الصورة الفعليّة بلا الأشرطة
    const fx = (d.box.x + d.box.width / 2) / W, fy = (d.box.y + d.box.height / 2) / H, fw = d.box.width / (W * cwN);
    // الإطار الصغير (576×784): نريد عرض الوجه ≈ 30٪ من عرضه. عرض مصدر الكاميرا بعد التكبير للتغطية = max(576, 784×النسبة)
    const zoom = afClamp(.30 * 576 / (fw * Math.max(576, 784 * asp)), 1, 2.2);
    const cur = S().framing.sheikh, a = force ? 1 : .4;
    const turned = rot !== (cur.rot || 0), a2 = turned ? 1 : a;      // تغيّر الاتّجاه: نثبّت الإطار فوراً بلا تنعيم
    const ob = cur.box || [0, 0, 1, 1], boxMoved = bn.some((v, i) => Math.abs(v - ob[i]) > .02);
    const nf = { fx: cur.fx + (fx - cur.fx) * a2, fy: cur.fy + (fy - cur.fy) * a2, zoom: cur.zoom + (zoom - cur.zoom) * a2, rot, box: boxMoved ? bn : ob };
    AF.last = `${Math.round(fx * 100)}٪ ، ${Math.round(fy * 100)}٪${rot ? " · مُدوَّرة " + rot + "°" : ""}${cwN < .95 || chN < .95 ? " · أُزيلت الأشرطة السوداء" : ""}`.replace(/[0-9]/g, x => "0123456789"[x]);
    // لا نحرّك المحرّك لتغيّرات صغيرة (تفادي الاهتزاز)
    if (Math.abs(nf.fx - cur.fx) > .012 || Math.abs(nf.fy - cur.fy) > .012 || Math.abs(nf.zoom - cur.zoom) > .05 || turned || boxMoved || force) {
      await patch({ framing: Object.assign({}, S().framing, { sheikh: nf }) }); renderFraming();
    }
    afRender(); return true;
  } catch (e) { console.error("autoframe", e); return false; }
  finally { AF.busy = false; }
}
function afLoop() { afTick(AF.fast > 0).finally(() => { if (AF.fast > 0) AF.fast--; setTimeout(afLoop, AF.fast > 0 ? 900 : 2500); }); }
function initAutoFrame() {
  $("autoFrame").onchange = e => { patch({ design: { autoFrame: e.target.checked } }).then(() => { afRender(); if (e.target.checked) AF.fast = 4; }); };
  $("afNow").onclick = async () => { if (S().design.autoFrame === false) await patch({ design: { autoFrame: true } }); AF.fast = 0; afRender(); const ok = await afTick(true); toast(ok ? "ضُبط الإطار على وجه الشيخ ✓" : "لم أجد وجهاً أو الكاميرا غير شغّالة"); };
  // عند تشغيل الكاميرا: عدّة التقاطات سريعة تثبّت الإطار
  api.on("cams", c => { const live = !!(c.live && c.live.sheikh); if (live && !AF.wasLive) AF.fast = 4; AF.wasLive = live; });
  renderFit(); renderRot(); afRender(); afLoop();
}
