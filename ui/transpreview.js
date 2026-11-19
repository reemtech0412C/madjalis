// «المجالس» — محاكاة الانتقال بين المشاهد داخل شاشة المعاينة.
// المحرّك ينفّذ الانتقال الحقيقيّ في البثّ والتسجيل؛ هنا نعرضه في المعاينة أيضاً بنفس النوع والمدّة والاتّجاه.
(() => {
  const W = 800, H = 450;
  let cv, g, raf = 0, token = 0;
  const luma = {};
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  function ensure() {
    if (cv) return;
    cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    Object.assign(cv.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", display: "none", zIndex: 6, background: "#000" });
    document.getElementById("previewBox").appendChild(cv);
    g = cv.getContext("2d", { willReadFrequently: true });
  }
  async function lumaOf(name) {
    if (luma[name]) return luma[name];
    const im = await load("/luma/" + encodeURIComponent(name)); if (!im) return null;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(im, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, l = new Float32Array(W * H); for (let i = 0; i < l.length; i++) l[i] = d[i * 4] / 255;
    return luma[name] = l;
  }
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  window.minbar.on("transition", async o => {
    ensure(); const my = ++token; cancelAnimationFrame(raf);
    const [A, B] = await Promise.all([load(o.a), load(o.b)]); if (!A || !B || my !== token) return;
    const L = o.luma ? await lumaOf(o.luma) : null; if (my !== token) return;
    // مجسّم ثانٍ نحتفظ فيه ببيانات الصورتين للمسح بالـluma
    let ad, bd, out;
    if (o.id === "wipe_transition" && L) {
      const t = document.createElement("canvas"); t.width = W; t.height = H; const x = t.getContext("2d", { willReadFrequently: true });
      x.drawImage(A, 0, 0, W, H); ad = x.getImageData(0, 0, W, H).data; x.drawImage(B, 0, 0, W, H); bd = x.getImageData(0, 0, W, H).data; out = g.createImageData(W, H);
    }
    const start = performance.now() - (o.elapsed || 0);
    cv.style.display = "block";
    const dir = o.direction || "left";
    const frame = now => {
      if (my !== token) return;
      const p = Math.min(1, (now - start) / o.ms);
      g.globalAlpha = 1; g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      if (o.id === "fade_transition") { g.drawImage(A, 0, 0, W, H); g.globalAlpha = p; g.drawImage(B, 0, 0, W, H); }
      else if (o.id === "fade_to_color_transition") {
        const sp = o.sp || .5, first = p < sp, k = first ? p / sp : (1 - p) / (1 - sp);
        g.drawImage(first ? A : B, 0, 0, W, H); g.globalAlpha = Math.max(0, Math.min(1, k)); g.fillStyle = o.hex || "#000"; g.fillRect(0, 0, W, H);
      } else if (o.id === "slide_transition") {
        const e = ease(p), v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir] || [-1, 0];
        g.drawImage(A, v[0] * e * W, v[1] * e * H, W, H); g.drawImage(B, (v[0] * e - v[0]) * W, (v[1] * e - v[1]) * H, W, H);
      } else if (o.id === "swipe_transition") {
        const e = ease(p), v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir] || [-1, 0];
        if (o.swipeIn) { g.drawImage(A, 0, 0, W, H); g.drawImage(B, (v[0] * e - v[0]) * W, (v[1] * e - v[1]) * H, W, H); }
        else { g.drawImage(B, 0, 0, W, H); g.drawImage(A, v[0] * e * W, v[1] * e * H, W, H); g.globalAlpha = (1 - e) * .0; }
      } else if (o.id === "wipe_transition" && L) {
        const soft = Math.max(.02, o.soft || .3), t = p * (1 + soft), od = out.data;
        for (let i = 0, j = 0; i < L.length; i++, j += 4) {
          let v = L[i]; if (o.invert) v = 1 - v;
          let m = (t - v) / soft; m = m < 0 ? 0 : m > 1 ? 1 : m; const n = 1 - m;
          od[j] = ad[j] * n + bd[j] * m; od[j + 1] = ad[j + 1] * n + bd[j + 1] * m; od[j + 2] = ad[j + 2] * n + bd[j + 2] * m; od[j + 3] = 255;
        }
        g.putImageData(out, 0, 0);
      } else { g.drawImage(A, 0, 0, W, H); g.globalAlpha = p; g.drawImage(B, 0, 0, W, H); }
      if (p < 1) raf = requestAnimationFrame(frame);
      else setTimeout(() => { if (my === token) cv.style.display = "none"; }, 120);
    };
    raf = requestAnimationFrame(frame);
  });
})();
