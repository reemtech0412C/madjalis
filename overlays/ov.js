// «منبر» — مكتبة طبقات البثّ. كل طبقة تقرأ الحالة من البرنامج (/state) وتتحدّث لحظيّاً (/events).
// أخطاء الطبقات تُرسل للبرنامج (داخل OBS ما فيه أدوات مطوّر)
const __log = m => { try { fetch("/log?m=" + encodeURIComponent(location.pathname + location.search + " | " + m)); } catch {} };
addEventListener("error", e => __log((e.message || e.type) + " @" + (e.lineno || "") + ":" + (e.colno || "")), true);
addEventListener("unhandledrejection", e => __log("rejection: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
(() => {
  const q = new URLSearchParams(location.search);
  const P = k => q.get(k);
  const W = 1920, H = 1080;
  // 4K: الطبقة تُرسم بنفس إحداثيّات 1080p وتُكبَّر ×2 فتبقى حادّة
  if (q.get("z")) document.documentElement.style.zoom = q.get("z");
  const AR = s => String(s ?? "").replace(/[0-9]/g, d => "0123456789"[d]);
  const T_ = window.MINBAR_THEMES;
  function el(tag, css = {}, parent = document.body, cls = "") {
    const e = document.createElement(tag); if (cls) e.className = cls; Object.assign(e.style, css); parent.appendChild(e); return e;
  }
  // ---------- الحالة ----------
  let S = null; const subs = [];
  async function load() { S = await (await fetch("/state", { cache: "no-store" })).json(); if (window.__PODOVR) { S.mode = "podcast"; S.podcast = Object.assign({}, S.podcast, window.__PODOVR); }       // معاينة قالب في الواجهة
    { const o = q.get("ovr"); if (o) { try { const v = JSON.parse(o); for (const k in v) S[k] = (k === "texts" || k === "design") ? Object.assign({}, S[k], v[k]) : v[k]; } catch {} } }
    if (S.mode === "podcast" && window.PK) S.design = PK.design(S); applyTheme(); return S; }
  function applyTheme() {
    const t = T_.theme(S.design.theme, S.design.custom);
    S._t = t;
    const r = document.documentElement.style;
    for (const [k, v] of Object.entries(T_.themeVars(t))) r.setProperty(k, v);
    document.documentElement.classList.toggle("light", t.light);
    const F = T_.fontOf(S.design.font);                       // خطّ البثّ الذي اختاره المستخدم
    r.setProperty("--fa", F.fa); r.setProperty("--fs", F.fs);
  }
  function listen(fn) { subs.push(fn); }
  function connect() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onmessage = async e => {
      const { event, data } = JSON.parse(e.data);
      if (event === "state") { const prev = S ? JSON.stringify(S) : ""; await load(); if (prev && JSON.stringify(S) === prev) return; subs.forEach(f => f("state", S)); }
      else if (event === "book") { if (S) S.bookState = data; subs.forEach(f => f("book", data)); }
      else if (event === "caption") subs.forEach(f => f("caption", data));
      else if (event === "sfx") subs.forEach(f => f("sfx", data));
      else if (event === "level") subs.forEach(f => f("level", data));
      else if (event === "gal") subs.forEach(f => f("gal", data));
      else if (event === "reload") location.reload();
    };
    ws.onclose = () => setTimeout(connect, 1500);
  }
  // يرسم الطبقة كاملة، ويعيد رسمها كل ما تغيّرت البيانات أو التصميم
  async function boot(draw, { onBook } = {}) {
    await load();
    const run = () => { [...document.body.children].forEach(c => { if (c.tagName !== "SCRIPT" && !c.dataset.keep) c.remove(); }); draw(S); };
    // نحمّل خطّ البثّ المختار قبل الرسم (بالأوزان 400 و500 و700) حتى لا يظهر النصّ بخطّ بديل
    const preload = () => Promise.all(T_.fontOf(S.design.font).load.flatMap(f => [400, 500, 700].map(w => document.fonts.load(`${w} 24px "${f}"`, "أبجد 123").catch(() => {})))).catch(() => {});
    await preload(); await document.fonts.ready.catch(() => {});
    run();
    listen(async (kind, d) => { if (kind === "state") { await preload(); run(); } else if (kind === "book" && onBook) onBook(d); });
    // OBS يخبر الطبقة لمّا يصير مشهدها على الهواء: نعيد الرسم (تعود الحركة) بدل إعادة تحميل الصفحة
    if (!onBook) {
      addEventListener("obsSourceActiveChanged", async e => { if (e.detail && e.detail.active) { await load().catch(() => {}); run(); } });
      // حارس: لو تغيّرت حالة الكاميرا/التصميم ولم يصل الحدث (طبقة موقوفة) نعيد الرسم
      let sig = JSON.stringify([S.cam, S.cam2, S.design]);
      setInterval(async () => { try { await load(); const n = JSON.stringify([S.cam, S.cam2, S.design]); if (n !== sig) { sig = n; run(); } } catch {} }, 2000);
    }
    connect();
  }
  const texts = () => {
    const t = Object.assign({}, S.texts);
    if (!t.date) t.date = hijri();
    t.programFull = String(t.program || "").trim();      // اسم الدورة وحده: اسم الحلقة لا يُعرض معه (يبقى محفوظاً في النظام)
    return t;
  };
  function hijri(d = new Date()) {
    try {
      const day = new Intl.DateTimeFormat("ar-SA", { weekday: "long" }).format(d);
      const h = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d);
      return `${day} ${h}`;
    } catch { return ""; }
  }
  // ---------- الأشكال ----------
  function archPath(w, h, ah = w * .42, inset = 0) {
    const x0 = inset, x1 = w - inset, y0 = inset, yb = h - inset, ww = x1 - x0, a = ah;
    return `M${x0},${yb} V${y0 + a} C${x0},${y0 + a * .42} ${x0 + ww * .30},${y0 + a * .12} ${x0 + ww / 2},${y0} C${x0 + ww * .70},${y0 + a * .12} ${x1},${y0 + a * .42} ${x1},${y0 + a} V${yb} Z`;
  }
  function roundPath(w, h, r, i = 0) {
    const x0 = i, y0 = i, x1 = w - i, y1 = h - i; r = Math.max(0, r - i);
    return `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}H${x0 + r}A${r},${r} 0 0 1 ${x0},${y1 - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`;
  }
  // إطار الكاميرا حسب الشكل المختار: arch محراب | round مستطيل ناعم | oval بيضاويّ | rect حادّ
  function shapePath(shape, w, h, inset = 0) {
    const pl = T_.shapePoly(shape, w - inset * 2, h - inset * 2);
    if (pl) return "M" + pl.map(([x, y]) => (x + inset).toFixed(1) + "," + (y + inset).toFixed(1)).join("L") + "Z";
    if (shape === "arch") return archPath(w, h, w * .42 - inset * .4, inset);
    if (shape === "oval") return `M${w / 2},${inset}A${w / 2 - inset},${h / 2 - inset} 0 1 1 ${w / 2 - .01},${inset}Z`;
    return roundPath(w, h, shape === "rect" ? 6 : Math.min(w, h) * .07, inset);
  }
  function frameSVG(shape, [x, y, w, h], { sw = 2.5, inner = 12, fill = "none", parent = document.body } = {}) {
    const s = el("div", { left: x + "px", top: y + "px", width: w + "px", height: h + "px" }, parent, "abs");
    s.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
      <path d="${shapePath(shape, w, h, 0)}" fill="${fill}" stroke="var(--accent)" stroke-width="${sw}"/>
      ${inner ? `<path d="${shapePath(shape, w + inner * 2, h + inner * 2, 0)}" transform="translate(${-inner},${-inner})" fill="none" stroke="var(--accent)" stroke-opacity=".42" stroke-width="1"/>` : ""}
    </svg>`;
    return s;
  }
  // ---------- النقش ----------
  function pattern(parent, { alpha = .13, scale = 1, move = true, color } = {}) {
    const key = S.design.pattern || "khatam";
    const [pw, ph] = T_.patternSize(key, scale);
    const d = el("div", { position: "absolute", inset: `-${Math.ceil(ph)}px -${Math.ceil(pw)}px`, backgroundImage: T_.patternURI(key, color || S._t.accent, S._t.light ? alpha * .75 : alpha, scale), backgroundSize: `${pw}px ${ph}px` }, parent);
    if (move && S.design.motion !== false) d.animate([{ transform: "translate(0,0)" }, { transform: `translate(${pw}px,${ph}px)` }], { duration: 90000, iterations: Infinity, easing: "linear" });
    return d;
  }
  // ---------- الشعارات والرعاة ----------
  // كل الشعارات الظاهرة (حتى 6) بألوانها الأصليّة؛ «أبيض» فقط لو اختاره المستخدم لذلك الشعار.
  // المقاس يصغر تلقائيّاً كل ما زاد العدد حتى يدخل الصفّ في مكانه.
  function logos(parent, { h = 64, gap = 28, maxW = 0 } = {}) {
    const list = (S.logos || []).filter(l => l && l.on !== false).slice(0, 6);
    if (!list.length) return null;
    // موضع مخصّص: كل الشعارات في زاوية واحدة ثابتة من الشاشة بدل مواضع التصميم
    const pos = S.design.logoPos;
    if (pos && pos !== "auto") {
      if (document.getElementById("mb-logo-corner")) return null;
      const [v, hz] = pos.split("-");
      parent = el("div", { [v]: "36px", [hz]: "48px", zIndex: 50 }, document.body, "abs rise");
      parent.id = "mb-logo-corner"; h = Math.max(h, 64); gap = Math.max(gap, 24);
    }
    const sc = Math.min(5, Math.max(.4, Number(S.design.logoScale) || 1));          // خيار المستخدم: تكبير/تصغير الشعارات
    const k = (list.length <= 3 ? 1 : list.length === 4 ? .9 : .78) * sc;
    const hh = Math.round(h * k), gg = Math.round(gap * k);
    const row = el("div", { display: "flex", alignItems: "center", gap: gg + "px", height: hh + "px", flexWrap: "nowrap" }, parent);
    if (maxW) row.style.maxWidth = maxW + "px";
    list.forEach(l => {
      const slot = el("div", { height: hh + "px", maxWidth: hh * 2.4 + "px", flex: "none" }, row, "logo-slot");
      const img = el("img", { height: hh + "px", maxWidth: hh * 2.4 + "px", objectFit: "contain" }, slot); img.src = "/media/" + encodeURIComponent(l.nobg && l.cut ? l.cut : l.file);
      if (l.mono) img.style.filter = S._t.light ? "brightness(0)" : "brightness(0) invert(1)";
      img.onerror = () => slot.remove();
    });
    return row;
  }
  // نمط مجموعة نصوص (name | lesson) من إعدادات «نمط النصوص»
  function styleBox(e, g) {
    if (!e) return e; const st = (S.design.textStyle || {})[g]; if (!st) return e;
    Object.assign(e.style, T_.boxCss(st, S._t));
    const c = T_.textColor(st, S._t); if (c) { e.style.color = c; e.querySelectorAll("*").forEach(x => { x.style.color = c; }); }
    return e;
  }
  function qr(parent, size = 120) {
    if (!S.qr) return null;
    const img = el("img", { width: size + "px", height: size + "px", borderRadius: "12px", background: "#fff", padding: "8px", boxSizing: "border-box" }, parent);
    img.src = "/media/" + encodeURIComponent(S.qr); img.onerror = () => img.remove();
    return img;
  }
  // ---------- الوقت ----------
  function countdownTo(hhmm) {
    const [h, m] = String(hhmm || "").split(":").map(Number);
    if (isNaN(h)) return null;
    const now = new Date(), t = new Date(now); t.setHours(h, m || 0, 0, 0);
    return Math.round((t - now) / 1000);
  }
  // هل عنوان الكتاب مذكور أصلاً في اسم الدورة؟ (نقارن بعد تطبيع الحروف: الهمزات والتاء المربوطة والتشكيل)
  const normAr = s => String(s || "").replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^ء-ي0-9a-zA-Z]+/g, " ").trim();
  function sameTitle(prog, book) {
    const p = normAr(prog), b = normAr(book); if (!b) return true; if (p === b) return true;
    const STOP = new Set(["في", "من", "الي", "علي", "و", "كتاب", "شرح", "متن"]);
    let t = b.split(" "); while (t.length > 1 && STOP.has(t[0])) t.shift();
    t = t.slice(0, 3); while (t.length > 1 && STOP.has(t[t.length - 1])) t.pop();
    return (" " + p + " ").includes(" " + t.join(" ") + " ");
  }
  const mmss = s => {
    if (s == null) return ""; s = Math.max(0, s);
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0");
    return AR(h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`);
  };
  Object.assign(window, { listen, styleBox, sameTitle, P, W, H, AR, el, boot, texts, hijri, archPath, shapePath, frameSVG, pattern, logos, qr, countdownTo, mmss, MB: { get S() { return S; } } });
})();
