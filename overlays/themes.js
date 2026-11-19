// «منبر» — الألوان والنقوش الإسلاميّة. مشترك بين الواجهة (المعاينة) وطبقات البثّ.
(function (G) {
  // ---------- الألوان ----------
  // deep أغمق خلفيّة، bg الخلفيّة، plate لوح البطاقات، accent الذهبيّ/اللون البارز، fg النصّ فوق الألواح
  const BASE = {
    zumurrud: { name: "زمرّديّ", bg: "#0E2F27", accent: "#C9A15A" },
    layl:     { name: "ليليّ",   bg: "#0C1B36", accent: "#CDA65E" },
    unnab:    { name: "عنّابيّ", bg: "#3A0F18", accent: "#D4AF6A" },
    fayruz:   { name: "فيروزيّ", bg: "#0A3340", accent: "#6CC9BC" },
    ramli:    { name: "رمليّ",   bg: "#3B2E1F", accent: "#E3C58C" },
    faham:    { name: "فحميّ",   bg: "#151518", accent: "#C9A15A" },
    banafsaj: { name: "بنفسجيّ", bg: "#251634", accent: "#D9B46E" },
    aji:      { name: "عاجيّ",   bg: "#F3EBDA", accent: "#9C7A3C", light: true, ink: "#1E3A30" },
    sundus:   { name: "سندسيّ",  bg: "#06402B", accent: "#B6E3A1" },
    zaytuni:  { name: "زيتونيّ", bg: "#26301A", accent: "#D8B25C" },
    zarqa:    { name: "لازورديّ", bg: "#0B2A5B", accent: "#E2B84E" },
    sama:     { name: "سماويّ",  bg: "#0F3B5E", accent: "#A8D8F5" },
    nuhasi:   { name: "نحاسيّ",  bg: "#38190F", accent: "#E7A26B" },
    rummani:  { name: "رمّانيّ", bg: "#4A0F26", accent: "#EDB9B0" },
    hajari:   { name: "حجريّ",   bg: "#1D2832", accent: "#C9D1D9" },
    midad:    { name: "حبريّ",   bg: "#070707", accent: "#F1E7D0" },
    lulu:     { name: "لؤلؤيّ",  bg: "#EDF3F0", accent: "#1F7A63", light: true, ink: "#153A31" },
    asal:     { name: "عسليّ",   bg: "#FBF1D8", accent: "#A8660F", light: true, ink: "#3B2A10" },
  };
  const hex = c => { c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
  const toHex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  const rgba = (c, a) => `rgba(${hex(c).join(",")},${a})`;
  function theme(key, custom) {
    const b = key === "custom" && custom ? Object.assign({ name: "خاصّ" }, custom) : (BASE[key] || BASE.zumurrud);
    const L = !!b.light, fg = L ? (b.ink || "#1E2A25") : "#FFFFFF";
    return {
      key, name: b.name, light: L,
      deep: L ? mix(b.bg, "#000", .06) : mix(b.bg, "#000", .32),
      bg: b.bg,
      mid: L ? mix(b.bg, "#fff", .45) : mix(b.bg, "#fff", .07),
      hi: L ? mix(b.bg, "#fff", .7) : mix(b.bg, "#fff", .14),
      plate1: L ? rgba(mix(b.bg, "#fff", .75), .97) : rgba(mix(b.bg, "#fff", .06), .96),
      plate2: L ? rgba(mix(b.bg, "#fff", .55), .97) : rgba(mix(b.bg, "#000", .25), .97),
      accent: b.accent, accentHi: L ? mix(b.accent, "#000", .2) : mix(b.accent, "#fff", .38), accentLo: mix(b.accent, "#000", .25),
      line: rgba(b.accent, .55), fg, fg2: L ? rgba(fg, .72) : "rgba(255,255,255,.78)",
      paper: "#FBF6EA", ink: "#1E2A25",
    };
  }
  function themeVars(t) {
    return {
      "--deep": t.deep, "--bg": t.bg, "--mid": t.mid, "--hi": t.hi, "--plate1": t.plate1, "--plate2": t.plate2,
      "--accent": t.accent, "--accent-hi": t.accentHi, "--accent-lo": t.accentLo, "--line": t.line,
      "--fg": t.fg, "--fg2": t.fg2, "--paper": t.paper, "--ink": t.ink,
    };
  }

  // ---------- خطوط البثّ ----------
  // fa = العناوين والأسماء، fs = البيانات والتسميات. (الملفّات في assets/fonts ومعرَّفة في fonts.css)
  const FONTS = {
    default: { name: "ثمانية", note: "الافتراضيّ", fa: '"TSD","Amiri",serif', fs: '"TS","IBM Plex Sans Arabic",sans-serif', load: ["TSD", "TS"] },
    tajawal: { name: "تجوال", note: "Tajawal", fa: '"Tajawal","IBM Plex Sans Arabic",sans-serif', fs: '"Tajawal","IBM Plex Sans Arabic",sans-serif', load: ["Tajawal"] },
    plex: { name: "IBM Plex Sans Arabic", note: "رسميّ واضح", fa: '"IBM Plex Sans Arabic",sans-serif', fs: '"IBM Plex Sans Arabic",sans-serif', load: ["IBM Plex Sans Arabic"] },
    naskh: { name: "نسخ نوتو", note: "Noto Naskh — نسخ واضح", fa: '"Noto Naskh Arabic","Amiri",serif', fs: '"Cairo","Noto Sans Arabic",sans-serif', load: ["Noto Naskh Arabic", "Cairo"] },
    cairo: { name: "كايرو", note: "Cairo — عصريّ", fa: '"Cairo","Noto Sans Arabic",sans-serif', fs: '"Cairo","Noto Sans Arabic",sans-serif', load: ["Cairo"] },
    kufi: { name: "كوفي نوتو", note: "Noto Kufi — هندسيّ", fa: '"Noto Kufi Arabic","Cairo",sans-serif', fs: '"Cairo","Noto Sans Arabic",sans-serif', load: ["Noto Kufi Arabic", "Cairo"] },
    elmessiri: { name: "المسيري", note: "El Messiri — أنيق", fa: '"El Messiri","Cairo",sans-serif', fs: '"Almarai","Cairo",sans-serif', load: ["El Messiri", "Almarai"] },
    almarai: { name: "المرعي", note: "Almarai", fa: '"Almarai","Cairo",sans-serif', fs: '"Almarai","Cairo",sans-serif', load: ["Almarai"] },
    alexandria: { name: "الإسكندريّة", note: "Alexandria — عريض", fa: '"Alexandria","Cairo",sans-serif', fs: '"Alexandria","Cairo",sans-serif', load: ["Alexandria"] },
    scheherazade: { name: "شهرزاد", note: "Scheherazade New — نسخ تقليديّ", fa: '"Scheherazade New","Amiri",serif', fs: '"Cairo",sans-serif', load: ["Scheherazade New", "Cairo"] },
    reem: { name: "ريم كوفي", note: "Reem Kufi", fa: '"Reem Kufi","Cairo",sans-serif', fs: '"Cairo",sans-serif', load: ["Reem Kufi", "Cairo"] },
    noto: { name: "Noto Sans Arabic", note: "نوتو سانس عربي", fa: '"Noto Sans Arabic","IBM Plex Sans Arabic",sans-serif', fs: '"Noto Sans Arabic","IBM Plex Sans Arabic",sans-serif', load: ["Noto Sans Arabic"] },
  };
  const fontOf = k => FONTS[k] || FONTS.default;

  // ---------- النقوش ----------
  // كل نقش يرجّع بلاطة SVG تتكرّر. اللون والشفافيّة من الهويّة.
  const P = (cx, cy, R, n, rot = 0) => [...Array(n)].map((_, i) => { const t = rot + i * 2 * Math.PI / n; return [cx + R * Math.cos(t), cy + R * Math.sin(t)]; });
  const poly = pts => `<polygon points="${pts.map(p => p.map(v => v.toFixed(2)).join(",")).join(" ")}"/>`;
  const star = (cx, cy, R, r, n, rot = -Math.PI / 2) => poly([...Array(n * 2)].map((_, i) => { const t = rot + i * Math.PI / n, q = i % 2 ? r : R; return [cx + q * Math.cos(t), cy + q * Math.sin(t)]; }));
  const PATTERNS = {
    khatam: { name: "خاتم سليمان", size: 120, tile(s) {   // نجمة ثمانيّة متشابكة (مربّعان متداخلان) + مثمّن
      const c = s / 2, r = s * .34, r2 = s * .2;
      const st = (x, y) => poly(P(x, y, r, 4, Math.PI / 4)) + poly(P(x, y, r, 4, 0)) + poly(P(x, y, r2, 8, Math.PI / 8));
      let g = st(c, c); for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) g += st(x, y);
      return { w: s, h: s, g: g + `<path d="M${c},${c - r}V${-r}M${c},${c + r}V${s + r}M${c - r},${c}H${-r}M${c + r},${c}H${s + r}"/>` };
    } },
    zellige: { name: "زليج", size: 110, tile(s) {   // نجوم ثمانيّة وصلبان (زليج أندلسيّ)
      const R = s * Math.SQRT2 / 4, r = R * .62;
      let g = star(s / 2, s / 2, R, r, 8, Math.PI / 8) + star(s / 2, s / 2, R * .45, R * .3, 8, Math.PI / 8);
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) g += star(x, y, R, r, 8, Math.PI / 8) + star(x, y, R * .45, R * .3, 8, Math.PI / 8);
      return { w: s, h: s, g };
    } },
    sudasi: { name: "مسدّس", size: 96, tile(s) {    // خلايا سداسيّة متداخلة (بلا مثلّثات متقاطعة)
      const h = s * Math.sqrt(3), R = s / Math.sqrt(3) * .98;
      let g = "";
      for (const [x, y] of [[0, 0], [s, 0], [0, h], [s, h], [s / 2, h / 2]]) g += poly(P(x, y, R, 6, 0)) + poly(P(x, y, R * .5, 6, Math.PI / 6)) + `<circle cx="${x}" cy="${y}" r="${(R * .14).toFixed(2)}"/>`;
      return { w: s, h, g };
    } },
    mihrab: { name: "أقواس", size: 90, tile(s) {     // صفّ أقواس محراب
      const w = s, h = s * 1.5, i = s * .14, a = (w - 2 * i) * .55;
      const arch = (x0, y0, ww, hh, ah) => `<path d="M${x0},${y0 + hh}V${y0 + ah}C${x0},${y0 + ah * .42} ${x0 + ww * .3},${y0 + ah * .12} ${x0 + ww / 2},${y0}C${x0 + ww * .7},${y0 + ah * .12} ${x0 + ww},${y0 + ah * .42} ${x0 + ww},${y0 + ah}V${y0 + hh}"/>`;
      return { w, h, g: arch(i, i, w - 2 * i, h - i, a) + arch(i * 2, i * 2.2, w - 4 * i, h - i * 2.2, a * .8) + `<path d="M0,${h}H${w}"/>` };
    } },
    muayyan: { name: "معيّنات", size: 64, tile(s) {  // شبكة معيّنات بنقاط (طابع نجديّ هادئ)
      const c = s / 2;
      return { w: s, h: s, g: `<path d="M0,${c}L${c},0L${s},${c}L${c},${s}Z"/><path d="M${c * .5},${c}L${c},${c * .5}L${c * 1.5},${c}L${c},${c * 1.5}Z"/><circle cx="0" cy="0" r="${s * .05}"/><circle cx="${s}" cy="0" r="${s * .05}"/><circle cx="0" cy="${s}" r="${s * .05}"/><circle cx="${s}" cy="${s}" r="${s * .05}"/>` };
    } },
    dawair: { name: "دوائر متداخلة", size: 70, tile(s) {   // زهرة الحياة: دوائر متساوية على شبكة سداسيّة
      const hh = s * Math.sqrt(3) / 2; let g = "";
      for (let j = -2; j <= 3; j++) for (let i = -2; i <= 3; i++) { const x = i * s + (((j % 2) + 2) % 2) * s / 2, y = j * hh; g += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${s}"/>`; }
      return { w: s, h: 2 * hh, g };
    } },
    qushur: { name: "قشور", size: 64, tile(s) {   // موجات متداخلة (قشور السمك) بأقواس متحدّة المركز
      let g = "";
      for (let j = -1; j <= 3; j++) for (let i = -1; i <= 2; i++) {
        const x = i * s + (((j % 2) + 2) % 2) * s / 2, y = j * s / 2;
        for (const k of [1, .68, .36]) { const r = s / 2 * k; g += `<path d="M${(x - r).toFixed(2)},${y.toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(x + r).toFixed(2)},${y.toFixed(2)}"/>`; }
      }
      return { w: s, h: s, g };
    } },
    nujum6: { name: "نجوم سداسيّة", size: 84, tile(s) {   // نجمة سداسيّة على شبكة سداسيّة
      const hh = s * Math.sqrt(3) / 2; let g = "";
      for (let j = -1; j <= 3; j++) for (let i = -1; i <= 2; i++) { const x = i * s + (((j % 2) + 2) % 2) * s / 2, y = j * hh; g += star(x, y, s * .5, s * .29, 6) + poly(P(x, y, s * .2, 6, 0)); }
      return { w: s, h: 2 * hh, g };
    } },
    muthallath: { name: "مثلّثات", size: 70, tile(s) {   // شبكة مثلّثات منتظمة (هندسيّة حديثة)
      const hh = s * Math.sqrt(3) / 2; let g = "";
      for (let j = -1; j <= 3; j++) for (let i = -1; i <= 2; i++) {
        const x = i * s + (((j % 2) + 2) % 2) * s / 2, y = j * hh;
        g += `<path d="M${x},${y}L${x + s},${y}M${x},${y}L${x + s / 2},${y + hh}M${x},${y}L${x - s / 2},${y + hh}"/>`;
      }
      return { w: s, h: 2 * hh, g };
    } },
    warda: { name: "وردة ثمانيّة", size: 100, tile(s) {   // وردة بثمان بتلات (زخرفة نباتيّة)
      const ros = (x, y, r) => { let t = `<circle cx="${x}" cy="${y}" r="${(r * .12).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="${(r * .98).toFixed(2)}"/>`;
        for (let k = 0; k < 8; k++) t += `<ellipse cx="${x}" cy="${(y - r * .5).toFixed(2)}" rx="${(r * .26).toFixed(2)}" ry="${(r * .5).toFixed(2)}" transform="rotate(${k * 45} ${x} ${y})"/>`; return t; };
      const c = s / 2, r = s * .34;
      let g = ros(c, c, r); for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) g += ros(x, y, r);
      return { w: s, h: s, g };
    } },
    none: { name: "بلا نقش", size: 10, tile(s) { return { w: s, h: s, g: "" }; } },
  };
  function patternURI(key, color = "#C9A15A", alpha = .14, scale = 1, sw = 1.2) {
    const p = PATTERNS[key] || PATTERNS.khatam;
    const { w, h, g } = p.tile(p.size * scale);
    if (!g) return "none";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}"><g fill="none" stroke="${color}" stroke-opacity="${alpha}" stroke-width="${sw}">${g}</g></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }
  const patternSize = (key, scale = 1) => { const p = PATTERNS[key] || PATTERNS.khatam; const t = p.tile(p.size * scale); return [t.w, t.h]; };

  // ---------- أشكال الإطارات ----------
  // المضلّعة منها تُرسم (SVG) وتُحوَّل إلى أقنعة للمحرّك من المضلّع نفسه فيتطابق الحدّ مع القصّ. (arch/round/oval/rect أقدم ولها مسارات خاصّة)
  const bez = (p0, p1, p2, p3, n = 48) => [...Array(n + 1)].map((_, i) => { const t = i / n, u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; });
  const arc = (cx, cy, rx, ry, a0, a1, n = 40) => [...Array(n + 1)].map((_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  const POLY = {
    ogee: (w, h) => { const ah = Math.min(w * .62, h * .55), L = bez([0, ah], [0, ah * .42], [w * .5 * .70, ah * .5], [w / 2, 0], 64); return [...L, ...L.map(([x, y]) => [w - x, y]).reverse().slice(1), [w, h], [0, h]]; },
    dome: (w, h) => { const r = Math.min(w / 2, h * .6); return [...arc(w / 2, r, w / 2, r, Math.PI, 2 * Math.PI, 72), [w, h], [0, h]]; },
    octagon: (w, h) => { const c = Math.min(w, h) * .2; return [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]]; },
    hexagon: (w, h) => { const k = Math.min(w * .5, h * .22); return [[w / 2, 0], [w, k], [w, h - k], [w / 2, h], [0, h - k], [0, k]]; },
    chamfer: (w, h) => { const c = Math.min(w, h) * .16; return [[0, 0], [w - c, 0], [w, c], [w, h], [c, h], [0, h - c]]; },
    pill: (w, h) => { const r = Math.min(w, h) / 2; return w >= h ? [...arc(r, r, r, r, Math.PI / 2, Math.PI * 1.5, 48), ...arc(w - r, r, r, r, -Math.PI / 2, Math.PI / 2, 48)] : [...arc(r, r, r, r, Math.PI, 2 * Math.PI, 48), ...arc(r, h - r, r, r, 0, Math.PI, 48)]; },
    circle: (w, h) => { const r = Math.min(w, h) / 2; return arc(w / 2, h / 2, r, r, 0, 2 * Math.PI, 144).slice(0, -1); },
  };
  const shapePoly = (shape, w, h) => POLY[shape] ? POLY[shape](Math.max(2, w), Math.max(2, h)) : null;
  const SHAPES = { arch: "محراب", ogee: "محراب مدبَّب", dome: "قوس نصف دائريّ", round: "ناعم", rect: "حادّ", chamfer: "ركن مقصوص", octagon: "مثمّن", hexagon: "مسدّس", pill: "كبسولة", oval: "بيضاويّ", circle: "دائرة" };

  // ---------- نمط النصوص (الاسم / الدرس) ----------
  // st = { bg:{on,color,alpha}, border:{on,color,width,style}, shadow:{on,alpha,blur,y}, radius, pad, text:{color} }
  // الألوان: «#rrggbb» أو «theme:deep|accent|accentHi|hi|paper» (تتبع الهويّة المختارة)
  const col = (c, t) => { c = String(c || ""); return c.startsWith("theme:") ? ((t && t[c.slice(6)]) || "#000000") : c; };
  function boxCss(st, t) {
    st = st || {}; const bg = st.bg || {}, bd = st.border || {}, sh = st.shadow || {}, o = {};
    const boxed = !!(bg.on || bd.on);
    if (bg.on) o.background = rgba(col(bg.color || "theme:deep", t), bg.alpha ?? .6);
    if (bd.on) o.border = (bd.width || 2) + "px " + (bd.style || "solid") + " " + col(bd.color || "theme:accent", t);
    if (boxed) { const p = st.pad ?? 18; Object.assign(o, { padding: (p * .55) + "px " + p + "px", borderRadius: (st.radius ?? 14) + "px", width: "fit-content", maxWidth: "100%", boxSizing: "border-box" }); }
    if (sh.on) { const a = sh.alpha ?? .55, bl = sh.blur ?? 24, y = sh.y ?? 8; if (boxed) o.boxShadow = "0 " + y + "px " + bl + "px rgba(0,0,0," + a + ")"; o.textShadow = "0 " + Math.max(1, y / 3) + "px " + Math.round(bl * .6) + "px rgba(0,0,0," + Math.min(.92, a + .2) + ")"; }
    return o;
  }
  const textColor = (st, t) => st && st.text && st.text.color ? col(st.text.color, t) : "";

  // ---------- الأوضاع السينمائيّة ----------
  // bars = نسبة الشريطين الأسودين (0 = بلا)، vig = التعتيم عند الأطراف، grain = حبيبات الفيلم، glow = وهج لونيّ من الزاوية،
  // grade = تصحيح لونيّ على صورة الكاميرا: c تباين، s تشبّع، g غاما، b سطوع، m لون مضروب (دفء/برودة)
  const CINEMA = {
    off:     { name: "بلا وضع", note: "الصورة كما هي" },
    classic: { name: "كلاسيكيّ", note: "2٫35:1 — دفء هادئ", bars: 2.35, vig: .34, grain: .10, glow: 0, grade: { c: .10, s: -.06, g: -.04, b: -.01, m: "#FFF1DE" } },
    scope:   { name: "سينما سكوب", note: "2٫39:1 — ألوان نقيّة", bars: 2.39, vig: .26, grain: .05, glow: 0, grade: { c: .12, s: .06, g: 0, b: 0, m: "#FFFFFF" } },
    doc:     { name: "وثائقيّ", note: "1٫85:1 — ألوان هادئة", bars: 1.85, vig: .24, grain: .08, glow: 0, grade: { c: .08, s: -.16, g: .02, b: 0, m: "#F4F6F6" } },
    golden:  { name: "ساعة ذهبيّة", note: "دفء وإشراق", bars: 0, vig: .30, grain: .04, glow: .16, grade: { c: .06, s: .10, g: -.06, b: .02, m: "#FFE6BF" } },
    cool:    { name: "ليل أزرق", note: "برودة هادئة", bars: 2.35, vig: .38, grain: .07, glow: 0, grade: { c: .12, s: -.04, g: -.02, b: -.02, m: "#DCE8FF" } },
    noir:    { name: "أبيض وأسود", note: "تباين عالٍ", bars: 2.2, vig: .50, grain: .14, glow: 0, grade: { c: .28, s: -1, g: -.08, b: -.02, m: "#FFFFFF" } },
    vintage: { name: "أرشيفيّ", note: "حبيبات وألوان باهتة", bars: 1.85, vig: .46, grain: .22, glow: 0, grade: { c: -.04, s: -.22, g: .04, b: .02, m: "#F6E2BE" } },
  };

  G.MINBAR_THEMES = { BASE, theme, themeVars, FONTS, fontOf, PATTERNS, CINEMA, shapePoly, SHAPES, boxCss, textColor, col, patternURI, patternSize, mix, rgba };
})(typeof window !== "undefined" ? window : globalThis);
if (typeof module !== "undefined") module.exports = globalThis.MINBAR_THEMES;
