// أقنعة أشكال الإطارات (محراب / مستطيل ناعم / بيضاويّ / حادّ) بأيّ مقاس: صور PNG شفّافة تُولَّد عند الحاجة وتُخزَّن.
// يقرؤها OBS من القرص (فلتر «شكل الإطار») فلازم تُكتب في مجلّد حقيقيّ خارج app.asar.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const TH = require("../overlays/themes.js");

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
}
function encodePng(w, h, alpha) {
  const stride = w * 4 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) { const o = y * stride + 1 + x * 4; raw[o] = 255; raw[o + 1] = 255; raw[o + 2] = 255; raw[o + 3] = alpha[y * w + x]; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// نفس هندسة طبقات العرض (ov.js: archPath / roundPath)
// تعبئة مضلّع بتنعيم (4 خطوط فرعيّة لكل صفّ وتغطية أفقيّة دقيقة)
function polyCoverage(pts, w, h) {
  const SS = 4, acc = new Float32Array(w * h), n = pts.length;
  for (let sy = 0; sy < h * SS; sy++) {
    const y = (sy + .5) / SS, xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
      if (y1 === y2 || y < Math.min(y1, y2) || y >= Math.max(y1, y2)) continue;
      xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    xs.sort((p, q) => p - q);
    const row = Math.min(h - 1, Math.floor(sy / SS)) * w;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, xs[k]), xb = Math.min(w, xs[k + 1]);
      for (let px = Math.floor(xa); px < xb && px < w; px++) acc[row + px] += (Math.min(xb, px + 1) - Math.max(xa, px)) / SS;
    }
  }
  const a = new Uint8Array(w * h); for (let i = 0; i < a.length; i++) a[i] = Math.round(255 * clamp01(acc[i]));
  return a;
}

function coverage(shape, w, h) {
  const poly = TH.shapePoly(shape, w, h);
  if (poly) return polyCoverage(poly, w, h);
  const a = new Uint8Array(w * h);
  if (shape === "arch") {
    const ah = w * .42, N = 600, xs = [], ys = [];
    // المنحنى: (0,ah) ← (w/2,0) بمنحنى بيزيه تكعيبيّ؛ نجدول y الأعلى لكل x
    const P = [[0, ah], [0, ah * .42], [w * .30, ah * .12], [w / 2, 0]];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      xs.push(u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0]);
      ys.push(u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]);
    }
    const top = x => {                                    // y الأعلى عند x (نصف المنحنى ثمّ انعكاس)
      const xx = x > w / 2 ? w - x : x;
      let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= xx) lo = m; else hi = m; }
      const dx = xs[hi] - xs[lo] || 1, f = (xx - xs[lo]) / dx; return ys[lo] + (ys[hi] - ys[lo]) * f;
    };
    for (let x = 0; x < w; x++) {
      const yt = top(x + .5), ax = clamp01(Math.min(x + 1, w - x));
      for (let y = 0; y < h; y++) a[y * w + x] = Math.round(255 * Math.min(ax, clamp01(y + 1 - yt)));
    }
  } else if (shape === "oval") {
    const rx = w / 2, ry = h / 2, m = Math.min(rx, ry);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + .5 - rx) / rx, ny = (y + .5 - ry) / ry, d = (Math.sqrt(nx * nx + ny * ny) - 1) * m;
      a[y * w + x] = Math.round(255 * clamp01(.5 - d));
    }
  } else {
    const r = shape === "rect" ? 6 : Math.min(w, h) * .07, hx = w / 2 - r, hy = h / 2 - r;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const qx = Math.abs(x + .5 - w / 2) - hx, qy = Math.abs(y + .5 - h / 2) - hy;
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      a[y * w + x] = Math.round(255 * clamp01(.5 - d));
    }
  }
  return a;
}

/** مسار قناع بالشكل والمقاس (يُولَّد مرّة ويُعاد استعماله). */
function maskFile(dir, shape, w, h) {
  w = Math.round(w); h = Math.round(h);
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${shape}-${w}x${h}.png`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, encodePng(w, h, coverage(shape, w, h)));
  return f;
}

module.exports = { maskFile, coverage };
