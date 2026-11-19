// «المجالس» — قسم البودكاست: قوالب استوديو بخلفيّاتها وخطوطها وبطاقاتها. يُحمَّل بعد ov.js في طبقات البثّ، ويُستعمل من Node أيضاً (قائمة القوالب).
// كل قالب = ألوان + خطّ + شكل إطار + نمط لوحة الاسم + خلفيّة. وللمستخدم تعديل كلّ واحد منها فوق القالب (S.podcast).
(function (G) {
  // ---------- القوالب ----------
  const TPL = {
    studio: { name: "استوديو", note: "إضاءة مسرح على داكن أنيق", pal: { bg: "#121B2B", accent: "#4CC3FF" }, font: "cairo", shape: "round", plate: "pill", bg: "spot", title: "cap", duo: { mode: "side", big: "cam2" } },
    ather: { name: "أثير", note: "موجات صوتيّة متدفّقة بألوان ليليّة", pal: { bg: "#1A1038", accent: "#B38CFF" }, font: "alexandria", shape: "round", plate: "glass", bg: "waves", title: "cap", duo: { mode: "side", big: "cam2" } },
    neon: { name: "نيون", note: "وهج وردي على أسود عميق", pal: { bg: "#09090F", accent: "#FF3D8B" }, font: "reem", shape: "chamfer", plate: "tag", bg: "grad", title: "bar", duo: { mode: "inset", big: "cam2" } },
    wiqar: { name: "وقار", note: "عاجيّ دافئ بلمسة ذهبيّة", pal: { bg: "#F4ECDD", accent: "#A8761F", light: true, ink: "#2A2113" }, font: "elmessiri", shape: "round", plate: "bar", bg: "dots", title: "cap", duo: { mode: "side", big: "cam2" } },
    layl: { name: "حديث الليل", note: "سماء نجوم هادئة", pal: { bg: "#0B1B3A", accent: "#F2C879" }, font: "tajawal", shape: "oval", plate: "pill", bg: "stars", title: "cap", duo: { mode: "overlap", big: "cam2" } },
    coffee: { name: "قهوة", note: "دافئ بنّيّ بخطوط مائلة (شاشة بوجهين كبيرين)", pal: { bg: "#2A1A12", accent: "#E0A96D" }, font: "elmessiri", shape: "round", plate: "bar", bg: "lines", title: "cap", layout: "split", duo: { mode: "side", big: "cam2" } },
    clean: { name: "نقاء", note: "أبيض نظيف بأزرق، عنوان كبير في الوسط", pal: { bg: "#F6F8FB", accent: "#2F6BFF", light: true, ink: "#14213D" }, font: "plex", shape: "round", plate: "glass", bg: "mesh", title: "cap", layout: "center", duo: { mode: "side", big: "cam2" } },
    tech: { name: "تقنيّ", note: "أخضر نيون على أسود، وجهان كبيران", pal: { bg: "#050F18", accent: "#00E5A8" }, font: "noto", shape: "chamfer", plate: "tag", bg: "dots", title: "bar", layout: "split", duo: { mode: "inset", big: "cam2" } },
    classic: { name: "كلاسيك", note: "عنّابيّ بذهبيّ أنيق، ملصق بدوائر كبيرة", pal: { bg: "#3A0F1F", accent: "#E6C27A" }, font: "naskh", shape: "oval", plate: "glass", bg: "rings", title: "cap", layout: "poster", duo: { mode: "side", big: "cam2" } },
    sunset: { name: "غروب", note: "تدرّج برتقاليّ بنفسجيّ، ملصق بعنوان ضخم", pal: { bg: "#2B1250", accent: "#FF8A5B" }, font: "alexandria", shape: "round", plate: "pill", bg: "mesh", title: "cap", layout: "poster", duo: { mode: "overlap", big: "cam2" } },
    sea: { name: "بحر", note: "فيروزيّ هادئ بموجات، عنوان في الوسط", pal: { bg: "#06384A", accent: "#6FE3D0" }, font: "tajawal", shape: "pill", plate: "pill", bg: "waves", title: "cap", layout: "center", duo: { mode: "side", big: "cam2" } },
    paper: { name: "ورق", note: "ورقيّ دافئ بلمسة حمراء، وجهان كبيران", pal: { bg: "#EFE6D2", accent: "#B5452B", light: true, ink: "#2B1D12" }, font: "naskh", shape: "rect", plate: "bar", bg: "paper", title: "bar", layout: "split", duo: { mode: "side", big: "cam2" } },
    echo: { name: "صدى", note: "أصفر جريء على أسود، عنوان في الوسط", pal: { bg: "#0E0E0E", accent: "#FFD400" }, font: "kufi", shape: "rect", plate: "tag", bg: "lines", title: "bar", layout: "center", duo: { mode: "inset", big: "cam2" } },
    torn: { name: "ورقة ممزّقة", note: "ورق ممزّق وشريط لاصق على أزرق مزخرف، وصور بإطار بولارويد", pal: { bg: "#1B4A6B", accent: "#F0B54A" }, font: "cairo", shape: "rect", plate: "paper", bg: "doodle", title: "bar", pframe: "paper", duo: { mode: "side", big: "cam2" } },
    block: { name: "كتلة", note: "ألوان صلبة مائلة وخطّ عريض", pal: { bg: "#0F3D3E", accent: "#FFC145" }, font: "kufi", shape: "rect", plate: "tag", bg: "block", title: "bar", duo: { mode: "side", big: "cam2" } },
  };
  const BGS = { doodle: "رموز مرسومة", spot: "إضاءة مسرح", waves: "موجات صوتيّة", grad: "ألوان متوهّجة", mesh: "شبكة ألوان", rings: "حلقات", lines: "خطوط مائلة", paper: "ورق", dots: "نقاط هادئة", stars: "نجوم", block: "كتل مائلة", solid: "لون صريح", image: "صورة" };
  const LAYOUTS = { cards: "بطاقتان", split: "وجهان كبيران", poster: "ملصق بدوائر", center: "عنوان في الوسط" };
  const PLATES = { paper: "ورقة ممزّقة", pill: "كبسولة", glass: "زجاجيّة", bar: "شريط", tag: "بطاقة ملوّنة" };
  const DEF_SHOW = { badge: true, ep: true, topic: true, eq: true, logo: true, social: true };

  /** إعدادات البودكاست الفعّالة: القالب + تعديلات المستخدم */
  function cfg(S) {
    const raw = (S && S.podcast) || {}, o = {}; for (const k in raw) if (raw[k] !== undefined && raw[k] !== null) o[k] = raw[k];
    const base = TPL[o.id] || TPL.studio;
    return Object.assign({ id: TPL[o.id] ? o.id : "studio" }, base, o, { pal: Object.assign({}, base.pal, o.pal || {}), show: Object.assign({}, DEF_SHOW, o.show || {}), bgKind: o.bg || base.bg });
  }
  /** هويّة الطبقات في وضع البودكاست: تُدمَج في S.design فتتلوّن كلّ الطبقات (الخلفيّة والشاشات والترجمة) بقالب البودكاست */
  function design(S) {
    const c = cfg(S), p = c.pal;
    return Object.assign({}, S.design, { theme: "custom", custom: { name: c.name, bg: p.bg, accent: p.accent, light: !!p.light, ink: p.ink }, font: c.font, frame: c.shape, motion: c.motion !== false && (S.design || {}).motion !== false });
  }
  const shapeOf = tpl => ((tpl && tpl.shape) || (TPL[tpl && tpl.id] || TPL.studio).shape);

  G.PK = { TPL, BGS, LAYOUTS, PLATES, DEF_SHOW, cfg, design, shapeOf };
  if (typeof document === "undefined") return;                         // في Node: القوائم فقط

  const css = document.createElement("style");
  css.textContent = `
@keyframes pkw{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pkfl{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(70px,-50px) scale(1.14)}}
@keyframes pktw{0%,100%{opacity:.18}50%{opacity:1}}
@keyframes pksway{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}
@keyframes pkbg{to{background-position:46px 46px}}
@keyframes pkbg2{to{background-position:96px 0}}
@keyframes pkspin{to{transform:rotate(360deg)}}
@keyframes pkslide{from{transform:translateX(-34px)}to{transform:translateX(34px)}}
@keyframes pkeq{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
@keyframes pkpl{0%,100%{opacity:1}50%{opacity:.4}}
body.pk-still *{animation:none!important}
.pk-eq{display:flex;align-items:flex-end;gap:7px}.pk-eq i{display:block;border-radius:6px;transform-origin:bottom;animation:pkeq 1.1s ease-in-out infinite}
`;
  document.head.appendChild(css);

  const rgba = (c, a) => MINBAR_THEMES.rgba(c, a), mix = (a, b, t) => MINBAR_THEMES.mix(a, b, t);
  const still = S => { document.body.classList.toggle("pk-still", cfg(S).motion === false || (S.design || {}).motion === false); };

  // ---------- الأيقونات ----------
  const MIC = '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  const micIcon = (size, bg, fg) => { const d = el("div", { width: size + "px", height: size + "px", borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }); d.innerHTML = `<svg viewBox="0 0 24 24" width="${Math.round(size * .56)}" height="${Math.round(size * .56)}">${MIC}</svg>`; return d; };

  // ---------- الخلفيّات ----------
  // موجة جيبيّة بعرض 3840 (ضعف الشاشة) لتتحرّك أفقيّاً بسلاسة: التحريك -50٪ ثمّ تعود فتتطابق البداية والنهاية
  const wavePath = (amp, periods, phase, y, h) => {
    let d = `M0,${h} L0,${y + amp * Math.sin(phase)}`;
    for (let x = 40; x <= 3840; x += 40) d += ` L${x},${(y + amp * Math.sin(phase + x / 3840 * periods * 2 * Math.PI)).toFixed(1)}`;
    return d + ` L3840,${h} Z`;
  };
  const rnd = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  // ---------- التفاعل مع الصوت ----------
  // مستوى صوت المقدّم/الضيف (حدث level من البرنامج) يحرّك الخلفيّة: نبض عامّ + موجات تعلو + بقع تتّسع + أشعّة تلمع + أعمدة صوت تتراقص.
  // بلا بثّ للمستوى (محرّك متوقّف) تتنفّس الخلفيّة بخفّة. حركة الخلفيّة معطّلة تُوقف كلّ هذا.
  const RX = { on: false, lv: 0, tgt: 0, t: 0, root: null, items: [], bars: [] };
  const rxAdd = (e, kind, i = 0) => { RX.items.push([e, kind, i]); return e; };
  function react() {
    if (RX.on) return; RX.on = true;
    if (typeof listen === "function") listen((k, d) => { if (k === "level" && d) { RX.tgt = Math.max(0, Math.min(1, d.v || 0)); RX.t = performance.now(); } });
    const loop = () => {
      requestAnimationFrame(loop);
      if (document.body.classList.contains("pk-still")) return;
      const now = performance.now(), live = now - RX.t < 1500, tgt = live ? RX.tgt : .1 + .08 * Math.sin(now / 1100);
      RX.lv += (tgt - RX.lv) * (tgt > RX.lv ? .38 : .09); const v = RX.lv;
      if (RX.root && RX.root.isConnected) { RX.root.style.transform = `scale(${(1 + v * .045).toFixed(4)})`; RX.root.style.filter = `brightness(${(1 + v * .32).toFixed(3)}) saturate(${(1 + v * .45).toFixed(3)})`; }
      RX.items = RX.items.filter(x => x[0].isConnected);
      for (const [e, k, i] of RX.items) {
        if (k === "wave") { e.style.transformOrigin = "50% 100%"; e.style.transform = `translateY(${(-v * (40 + i * 14)).toFixed(1)}px) scaleY(${(1 + v * (.55 + i * .12)).toFixed(3)})`; }
        else if (k === "blob") { e.style.transform = `scale(${(1 + v * (.3 + i * .08)).toFixed(3)})`; e.style.opacity = Math.min(1, .62 + v * .5); }
        else if (k === "ring") e.style.transform = `scale(${(1 + v * .035 * (i + 1)).toFixed(4)})`;
        else if (k === "beam") e.style.opacity = Math.min(1, .55 + v * 1.1);
        else if (k === "glow") e.style.opacity = Math.min(1, .5 + v * .9);
      }
      RX.bars = RX.bars.filter(x => x[0].isConnected);
      for (const [b, ph] of RX.bars) { const s = Math.max(.14, Math.min(1, .16 + v * (.75 + .45 * Math.sin(now / 130 + ph)) + (live ? 0 : .12 * (.5 + .5 * Math.sin(now / 420 + ph))))); b.style.animation = "none"; b.style.transform = `scaleY(${s.toFixed(3)})`; }
    };
    requestAnimationFrame(loop);
  }
  function bg(host, S) {
    const c = cfg(S), t = S._t, kind = c.bgKind, light = !!t.light, ac = t.accent; still(S);
    RX.items = []; react();
    const parent = el("div", { inset: 0, transformOrigin: "50% 60%", willChange: "transform, filter" }, host, "abs"); RX.root = parent;
    const base = css => el("div", Object.assign({ inset: 0 }, css), parent, "abs");
    if (kind === "image" && c.bgImg) {
      const im = el("img", { inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: c.bgBlur ? `blur(${c.bgBlur}px)` : "none", transform: c.bgBlur ? "scale(1.08)" : "none" }, parent, "abs"); im.src = "/media/" + encodeURIComponent(c.bgImg); im.onerror = () => im.remove();
      base({ background: `rgba(0,0,0,${Math.max(0, Math.min(.9, (c.bgDim ?? 45) / 100))})` });
      base({ background: `radial-gradient(110% 90% at 50% 50%, transparent 55%, ${rgba(t.deep, .75)} 100%)` }); return;
    }
    if (kind === "waves") {
      base({ background: `linear-gradient(165deg, ${t.hi} 0%, ${t.bg} 46%, ${t.deep} 100%)` });
      [[110, 3, 0, 700, .17, 46], [80, 4, 1.7, 790, .13, 62], [60, 5, 3.1, 850, .1, 80], [40, 6, 4.4, 920, .22, 95]].forEach(([amp, per, ph, y, a, dur], i) => {
        const ow = rxAdd(el("div", { inset: 0 }, parent, "abs"), "wave", i);
        const w = el("div", { left: 0, top: 0, width: "3840px", height: "1080px", animation: `pkw ${dur}s linear infinite${i % 2 ? " reverse" : ""}` }, ow, "abs");
        w.innerHTML = `<svg width="3840" height="1080" viewBox="0 0 3840 1080"><defs><linearGradient id="pkg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ac}" stop-opacity="${a * 2.2}"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/></linearGradient></defs><path d="${wavePath(amp, per, ph, y, 1080)}" fill="url(#pkg${i})"/></svg>`;
      });
      base({ background: `radial-gradient(60% 55% at 70% 18%, ${rgba(ac, .16)}, transparent 70%)` }); return;
    }
    if (kind === "grad") {
      base({ background: `linear-gradient(135deg, ${t.deep}, ${t.bg})` });
      [[ac, 900, "-10%", "-25%", .55, 22], [t.accentHi, 700, "60%", "45%", .34, 28], [mix(t.bg, "#ffffff", .25), 800, "-8%", "55%", .5, 34]].forEach(([col, s, l, tp, a, dur]) =>
        { const ob = rxAdd(el("div", { inset: 0 }, parent, "abs"), "blob", dur % 3); el("div", { left: l, top: tp, width: s + "px", height: s + "px", borderRadius: "50%", background: col, opacity: a, filter: "blur(140px)", animation: `pkfl ${dur}s ease-in-out infinite` }, ob, "abs"); });
      base({ background: `radial-gradient(110% 90% at 50% 50%, transparent 50%, ${rgba(t.deep, .7)} 100%)` }); return;
    }
    if (kind === "mesh") {
      base({ background: `radial-gradient(60% 55% at 14% 18%, ${rgba(ac, light ? .5 : .6)}, transparent 70%), radial-gradient(55% 55% at 88% 22%, ${rgba(t.accentHi, light ? .35 : .4)}, transparent 70%), radial-gradient(70% 60% at 62% 98%, ${rgba(mix(t.bg, ac, .5), .6)}, transparent 72%), linear-gradient(160deg, ${t.hi}, ${t.bg} 55%, ${t.deep})` });
      [[ac, 760, "8%", "10%", .5, 26], [t.accentHi, 620, "62%", "6%", .38, 31]].forEach(([col, s, l, tp, a, dur], i) => { const ob = rxAdd(el("div", { inset: 0 }, parent, "abs"), "blob", i); el("div", { left: l, top: tp, width: s + "px", height: s + "px", borderRadius: "50%", background: col, opacity: a, filter: "blur(120px)", animation: `pkfl ${dur}s ease-in-out infinite` }, ob, "abs"); });
      base({ background: `radial-gradient(110% 90% at 50% 50%, transparent 55%, ${rgba(t.deep, light ? .18 : .6)} 100%)` }); return;
    }
    if (kind === "rings") {
      base({ background: `radial-gradient(circle at 50% 118%, ${t.hi} 0%, ${t.bg} 55%, ${t.deep} 100%)` });
      [420, 700, 980, 1280, 1620].forEach((r, i) => rxAdd(el("div", { left: "50%", top: "118%", width: r * 2 + "px", height: r * 2 + "px", marginLeft: -r + "px", marginTop: -r + "px", borderRadius: "50%", border: "2px solid " + rgba(ac, .26 - i * .035), animation: `pkpl ${7 + i * 2}s ease-in-out ${i * .8}s infinite` }, parent, "abs"), "ring", i));
      base({ background: `radial-gradient(110% 90% at 50% 40%, transparent 55%, ${rgba(t.deep, .6)} 100%)` }); return;
    }
    if (kind === "lines") {
      base({ background: `linear-gradient(160deg, ${light ? t.hi : t.mid}, ${t.bg} 55%, ${t.deep})` });
      base({ backgroundImage: `repeating-linear-gradient(115deg, ${rgba(light ? t.ink : ac, light ? .06 : .08)} 0 2px, transparent 2px 48px)`, backgroundSize: "96px 96px", animation: "pkbg2 9s linear infinite", WebkitMaskImage: "radial-gradient(90% 90% at 50% 45%, #000 30%, transparent 100%)" });
      rxAdd(base({ background: rgba(ac, .12), clipPath: "polygon(0 70%, 100% 36%, 100% 52%, 0 86%)", animation: "pkslide 11s ease-in-out infinite alternate" }), "glow");
      base({ background: ac, clipPath: "polygon(0 69.4%, 100% 35.4%, 100% 36%, 0 70%)", opacity: .8 }); return;
    }
    if (kind === "doodle") {
      const svg = col => "url(\"data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' fill='none' stroke='${col}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M30 24l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z'/><circle cx='128' cy='36' r='9'/><path d='M120 120l16 16m0-16l-16 16'/><path d='M40 128c8-12 16 12 24 0s16 12 24 0'/><rect x='108' y='84' width='22' height='22' rx='4' transform='rotate(14 119 95)'/></svg>`) + "\")";
      base({ background: `radial-gradient(120% 100% at 50% 35%, ${mix(t.bg, "#ffffff", .1)}, ${t.bg} 55%, ${t.deep} 100%)` });
      base({ backgroundImage: svg(rgba(light ? t.ink : "#ffffff", .09)), backgroundSize: "180px 180px", animation: "pkbg2 40s linear infinite", WebkitMaskImage: "radial-gradient(95% 95% at 50% 45%, #000 40%, transparent 100%)" });
      rxAdd(base({ background: `radial-gradient(60% 50% at 82% 88%, ${rgba(ac, .22)}, transparent 70%)` }), "glow"); return;
    }
    if (kind === "paper") {
      base({ background: t.bg });
      base({ backgroundImage: `repeating-linear-gradient(0deg, ${rgba(t.ink || "#000", .045)} 0 1px, transparent 1px 38px), radial-gradient(circle, ${rgba(t.ink || "#000", .05)} 1px, transparent 1.4px)`, backgroundSize: "auto, 14px 14px" });
      base({ background: `radial-gradient(120% 100% at 50% 40%, transparent 50%, ${rgba(t.accent, .16)} 100%)` });
      rxAdd(el("div", { right: "-120px", top: "-120px", width: "520px", height: "520px", borderRadius: "50%", border: "28px dashed " + rgba(ac, .16), animation: "pkspin 80s linear infinite" }, parent, "abs"), "glow");
      rxAdd(el("div", { left: "-180px", bottom: "-200px", width: "620px", height: "620px", borderRadius: "50%", border: "22px solid " + rgba(ac, .1), animation: "pkspin 120s linear infinite reverse" }, parent, "abs"), "glow"); return;
    }
    if (kind === "dots") {
      base({ background: light ? `linear-gradient(160deg, ${t.hi}, ${t.bg})` : `linear-gradient(160deg, ${t.mid}, ${t.bg} 60%, ${t.deep})` });
      base({ backgroundImage: `radial-gradient(circle, ${rgba(light ? t.ink : ac, light ? .22 : .34)} 2px, transparent 2.6px)`, backgroundSize: "46px 46px", animation: "pkbg 8s linear infinite", WebkitMaskImage: "radial-gradient(85% 85% at 50% 45%, #000 25%, transparent 100%)" });
      el("div", { left: "-8%", top: "-30%", width: "900px", height: "900px", borderRadius: "50%", background: rgba(ac, light ? .14 : .22), filter: "blur(120px)" }, parent, "abs"); return;
    }
    if (kind === "stars") {
      base({ background: `linear-gradient(180deg, ${t.deep} 0%, ${t.bg} 55%, ${t.hi} 100%)` });
      el("div", { right: "8%", top: "6%", width: "520px", height: "520px", borderRadius: "50%", background: `radial-gradient(circle, ${rgba(ac, .34)}, transparent 68%)` }, parent, "abs");
      const r = rnd(11);
      for (let i = 0; i < 120; i++) { const s = 1 + r() * 2.6; el("i", { left: (r() * 100).toFixed(2) + "%", top: (r() * 100).toFixed(2) + "%", width: s + "px", height: s + "px", borderRadius: "50%", background: r() > .8 ? ac : "#fff", opacity: .2 + r() * .6, animation: `pktw ${(2.4 + r() * 4).toFixed(1)}s ease-in-out ${(r() * 5).toFixed(1)}s infinite` }, parent, "abs"); }
      return;
    }
    if (kind === "block") {
      base({ background: t.bg });
      { const ob = rxAdd(el("div", { inset: 0, animation: "pkslide 9s ease-in-out infinite alternate" }, parent, "abs"), "glow");
        el("div", { inset: 0, background: rgba(ac, .16), clipPath: "polygon(86% 0, 100% 0, 100% 100%, 72% 100%)" }, ob, "abs");
        el("div", { inset: 0, background: ac, clipPath: "polygon(85.4% 0, 86.2% 0, 72.8% 100%, 72% 100%)", opacity: .9 }, ob, "abs");
        el("div", { inset: 0, background: rgba(ac, .55), clipPath: "polygon(87.8% 0, 88.1% 0, 74.8% 100%, 74.5% 100%)" }, ob, "abs"); }
      el("div", { left: "-160px", bottom: "-200px", width: "620px", height: "620px", borderRadius: "50%", border: "34px solid " + rgba(ac, .12) }, parent, "abs"); return;
    }
    if (kind === "solid") {
      base({ background: t.bg }); base({ background: `radial-gradient(110% 90% at 50% 40%, transparent 55%, ${rgba(t.deep, .65)} 100%)` }); return;
    }
    // spot: إضاءة مسرح
    base({ background: `radial-gradient(75% 95% at 50% -12%, ${t.hi} 0%, ${t.bg} 52%, ${t.deep} 100%)` });
    base({ backgroundImage: `linear-gradient(${rgba(ac, .05)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(ac, .05)} 1px, transparent 1px)`, backgroundSize: "84px 84px", WebkitMaskImage: "radial-gradient(80% 80% at 50% 38%, #000, transparent)" });
    [["-4%", "58%", "-16deg"], ["46%", "58%", "16deg"]].forEach(([l, w, r], bi) => { const sw = el("div", { inset: 0, transformOrigin: "50% -10%", animation: `pksway ${9 + bi * 4}s ease-in-out ${bi * -3}s infinite` }, parent, "abs"); rxAdd(el("div", { left: l, top: "-6%", width: w, height: "100%", background: `linear-gradient(180deg, ${rgba(ac, .16)}, transparent 62%)`, clipPath: "polygon(36% 0, 64% 0, 100% 100%, 0 100%)", transform: `rotate(${r})`, filter: "blur(18px)", opacity: .8 }, sw, "abs"), "beam"); });
    el("div", { left: 0, right: 0, bottom: 0, height: "30%", background: `linear-gradient(0deg, ${rgba(ac, .2)}, transparent)` }, parent, "abs");
  }

  // ---------- مكوّنات ----------
  /** أعمدة الصوت المتحرّكة (زخرفة بودكاست) */
  function eq(parent, css, { n = 9, w = 8, h = 46, color, gap } = {}) {
    const box = el("div", Object.assign({ height: h + "px" }, css || {}), parent, "pk-eq abs");
    if (gap != null) box.style.gap = gap + "px";
    const r = rnd(n * 7 + 3); react();
    for (let i = 0; i < n; i++) RX.bars.push([el("i", { width: w + "px", height: Math.round(h * (.45 + r() * .55)) + "px", background: color || "var(--accent)", animationDuration: (.7 + r() * .9).toFixed(2) + "s", animationDelay: (-r() * 1.4).toFixed(2) + "s" }, box), i * 1.7]);
    return box;
  }
  /** شعار البودكاست الخاصّ: tpl.brand = {file, nobg, cut}. brandMode: replace (يحلّ محلّ الاسم — الافتراضيّ) | with (بجانب الاسم) */
  const brandOf = S => { const c = cfg(S), b = c.brand; if (!b || !b.file) return null; return { file: b.nobg && b.cut ? b.cut : b.file, h: Math.max(30, Math.min(260, Number(c.brandH) || 90)), replace: c.brandMode !== "with" }; };
  /** شعارات الحلقة (S.logos): كل شعار له موضعه (9 مواضع) وحجمه وشفافيّته وأين يظهر (البثّ/قبل/استراحة/ختام). الشعارات في الموضع نفسه تُصفّ جنباً إلى جنب */
  const LPOS = { tl: ["left", "top"], tc: ["center", "top"], tr: ["right", "top"], ml: ["left", "mid"], mc: ["center", "mid"], mr: ["right", "mid"], bl: ["left", "bottom"], bc: ["center", "bottom"], br: ["right", "bottom"] };
  function logoLayer(parent, S, ctx) {
    const c = cfg(S); if (c.show.logo === false || (S.design || {}).sponsors === false) return;
    const list = (S.logos || []).filter(l => l && l.on !== false && (l.show || {})[ctx] !== false); if (!list.length) return;
    const groups = {}; list.forEach(l => { const k = LPOS[l.pos] ? l.pos : "tl"; (groups[k] = groups[k] || []).push(l); });
    Object.entries(groups).forEach(([k, arr]) => {
      const [hx, vy] = LPOS[k], css = { display: "flex", alignItems: "center", gap: "26px", pointerEvents: "none" };
      if (hx === "left") css.left = "56px"; else if (hx === "right") css.right = "56px"; else { css.left = "50%"; }
      if (vy === "top") css.top = "42px"; else if (vy === "bottom") css.bottom = "42px"; else css.top = "50%";
      const tr = (hx === "center" ? "translateX(-50%) " : "") + (vy === "mid" ? "translateY(-50%)" : ""); if (tr.trim()) css.transform = tr.trim();
      const g = el("div", css, parent, "abs rise");
      arr.forEach(l => { const im = el("img", { height: Math.max(24, Math.min(420, Number(l.h) || 70)) + "px", maxWidth: "640px", objectFit: "contain", opacity: l.op ?? 1, filter: l.mono ? (S._t.light ? "brightness(0)" : "brightness(0) invert(1)") : "none" }, g);
        im.src = "/media/" + encodeURIComponent(l.nobg && l.cut ? l.cut : l.file); im.onerror = () => im.remove(); });
    });
  }
  /** شارة البودكاست: شعار/ميكروفون + الاسم + رقم الحلقة */
  function badge(parent, S, css) {
    const c = cfg(S), t = S._t, T = texts(), name = T.programFull || T.program || "";
    if (!name && !T.episode) return null;
    const box = el("div", Object.assign({ display: "flex", alignItems: "center", gap: "18px", padding: "11px 30px 11px 14px", borderRadius: "99px", background: rgba(t.deep, .8), border: "1.5px solid " + rgba(t.accent, .6), backdropFilter: "blur(8px)", boxShadow: "0 12px 34px rgba(0,0,0,.32)" }, css || {}), parent, "rise");
    const br = brandOf(S);
    if (br) { const i = el("img", { height: Math.min(76, br.h) + "px", maxWidth: "340px", objectFit: "contain" }, box); i.src = "/media/" + encodeURIComponent(br.file); i.onerror = () => i.replaceWith(micIcon(66, t.accent, t.light ? "#fff" : t.deep)); }
    else box.appendChild(micIcon(66, t.accent, t.light ? "#fff" : t.deep));
    if (!(br && br.replace)) {
      const tx = el("div", { display: "flex", flexDirection: "column", gap: "2px" }, box);
      if (name) el("div", { font: "700 36px var(--fa)", color: "var(--fg)", whiteSpace: "nowrap" }, tx).textContent = AR(name);
      if (T.tagline) el("div", { font: "500 19px var(--fs)", color: "var(--accent-hi)", whiteSpace: "nowrap" }, tx).textContent = AR(T.tagline);
    }
    if (c.show.ep && T.episode) { const e = el("div", { padding: "6px 20px", borderRadius: "99px", background: t.accent, color: t.light ? "#fff" : t.deep, font: "700 24px var(--fs)", whiteSpace: "nowrap" }, box); e.textContent = AR("الحلقة " + T.episode); }
    return box;
  }
  /** لوحة الاسم والصفة بنمط القالب: pill | glass | bar | tag */
  function plate(parent, S, name, role, css, k = 1) {
    if (!name) return null; const c = cfg(S), t = S._t, st = c.plate;
    const box = el("div", Object.assign({ display: "flex", alignItems: "center", gap: 16 * k + "px", maxWidth: "1100px", whiteSpace: "nowrap" }, css || {}), parent, "rise");
    const nm = (size, col) => { const n = el("div", { font: `700 ${size * k}px var(--fa)`, color: col, overflow: "hidden", textOverflow: "ellipsis" }); n.textContent = AR(name); return n; };
    const rl = (size, col) => { const r = el("div", { font: `500 ${size * k}px var(--fs)`, color: col }); r.textContent = AR(role); return r; };
    if (st === "glass") {
      Object.assign(box.style, { flexDirection: "column", alignItems: "flex-start", gap: 2 * k + "px", padding: 14 * k + "px " + 34 * k + "px", borderRadius: 24 * k + "px", background: t.light ? "rgba(255,255,255,.62)" : "rgba(255,255,255,.12)", border: "1.5px solid " + (t.light ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.28)"), backdropFilter: "blur(14px)", boxShadow: "0 14px 40px rgba(0,0,0,.3)" });
      if (role) box.appendChild(rl(20, "var(--accent-hi)")); box.appendChild(nm(36, "var(--fg)"));
    } else if (st === "bar") {
      Object.assign(box.style, { padding: 12 * k + "px " + 34 * k + "px " + 12 * k + "px " + 24 * k + "px", background: rgba(t.deep, .9), borderRight: 7 * k + "px solid " + t.accent, borderRadius: 6 * k + "px", boxShadow: "0 12px 34px rgba(0,0,0,.3)" });
      if (role) { box.appendChild(rl(22, "var(--accent-hi)")); el("i", { width: "2px", height: 26 * k + "px", background: rgba(t.accent, .6) }, box); } box.appendChild(nm(34, "var(--fg)"));
    } else if (st === "paper") {
      Object.assign(box.style, { position: "relative", flexDirection: "column", alignItems: "center", gap: 0, filter: "drop-shadow(0 10px 16px rgba(0,0,0,.42))" });
      const inn = el("div", { display: "flex", flexDirection: "column", alignItems: "center", padding: 10 * k + "px " + 38 * k + "px " + 12 * k + "px", background: "#f7f4ea", clipPath: torn(9 + name.length, 30, 2.6), transform: "rotate(-1.3deg)" }, box);
      if (role) { const r = el("div", { font: `600 ${20 * k}px var(--fs)`, color: "#7a6c4f" }, inn); r.textContent = AR(role); }
      const n = el("div", { font: `800 ${36 * k}px var(--fa)`, color: "#1d1b24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, inn); n.textContent = AR(name);
      el("div", { left: "50%", top: -9 * k + "px", width: 90 * k + "px", height: 20 * k + "px", transform: "translateX(-50%) rotate(-3deg)", background: "rgba(229,225,210,.85)", clipPath: torn(4, 8, 10) }, box, "abs");
    } else if (st === "tag") {
      Object.assign(box.style, { flexDirection: "column", alignItems: "flex-start", gap: 0, filter: "drop-shadow(0 12px 22px rgba(0,0,0,.3))" });
      if (role) { const b0 = el("div", { padding: 5 * k + "px " + 30 * k + "px", background: rgba(t.deep, .92), borderRadius: `${14 * k}px ${14 * k}px 0 0`, alignSelf: "stretch" }, box); b0.appendChild(rl(20, "var(--accent-hi)")); }
      const a = el("div", { padding: 8 * k + "px " + 30 * k + "px", background: t.accent, color: t.light ? "#fff" : t.deep, borderRadius: role ? `0 0 ${14 * k}px ${14 * k}px` : `${14 * k}px` }, box); a.appendChild(nm(36, "inherit")); a.firstChild.style.color = "inherit";
    } else {
      Object.assign(box.style, { padding: 9 * k + "px " + 32 * k + "px", borderRadius: "99px", background: rgba(t.deep, .9), border: "1.5px solid " + t.accent, boxShadow: "0 10px 30px rgba(0,0,0,.4)" });
      if (role) box.appendChild(rl(20, "var(--accent-hi)")); box.appendChild(nm(34, "var(--fg)"));
    }
    return box;
  }
  const people = T => ({
    host: { name: T.sheikh, role: T["sheikh-title"] || "المقدّم" },
    guest: { name: T.guest, role: [T["guest-title"] || "الضيف", T.guestRole].filter(Boolean).join(" — ") },
    third: { name: T.third, role: T["third-title"] || "" },
  });
  /** شريط عنوان الحلقة (أسفل اليسار / أعلى الوسط) */
  function topic(parent, S, css) {
    const c = cfg(S), T = texts(); if (!c.show.topic || !T.topic) return null;
    const box = el("div", Object.assign({ display: "flex", alignItems: "center", gap: "14px", padding: "10px 28px", borderRadius: "16px", background: rgba(S._t.deep, .78), borderRight: "6px solid " + S._t.accent, maxWidth: "900px", backdropFilter: "blur(6px)" }, css || {}), parent, "rise");
    const l = el("span", { font: "500 18px var(--fs)", color: "var(--accent-hi)", whiteSpace: "nowrap" }, box); l.textContent = "عنوان الحلقة";
    const v = el("span", { font: "700 30px var(--fa)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, box); v.textContent = AR(T.topic);
    return box;
  }

  // ---------- مشهد منفرد (المقدّم / الضيف بكاميرا كاملة) ----------
  function solo(S, who) {
    const c = cfg(S), t = S._t, T = texts(), b = document.body, pp = people(T)[who]; still(S);
    el("div", { left: 0, right: 0, bottom: 0, height: "360px", background: `linear-gradient(0deg, ${rgba(t.deep, .9)}, transparent)` }, b, "abs");
    if (c.title === "bar") el("div", { left: 0, right: 0, top: 0, height: "170px", background: `linear-gradient(180deg, ${rgba(t.deep, .85)}, transparent)` }, b, "abs");
    if (c.show.badge) badge(b, S, { right: "80px", top: "52px", position: "absolute" });
    logoLayer(b, S, "live");
    plate(b, S, pp.name, pp.role, { position: "absolute", right: "84px", bottom: "74px" }, 1.12);
    topic(b, S, { position: "absolute", left: "84px", bottom: "86px" });
    if (c.show.eq) eq(b, { right: "84px", bottom: "200px" }, { n: 7, w: 7, h: 38 });
  }

  // ---------- إطار الثنائيّ (الحوار) ----------
  function duoFrame(S, who, box, big) {
    const c = cfg(S), t = S._t, b = document.body, T = texts(), [x, y, w, h] = box; still(S);
    const f = frameSVG(c.shape, box, { sw: 3, inner: c.plate === "glass" ? 0 : 10 });
    f.style.filter = `drop-shadow(0 0 22px ${rgba(t.accent, .45)})`;
    const pp = people(T)[who === "cam2" ? "guest" : who === "cam3" ? "third" : "host"], k = Math.max(.7, Math.min(1.1, w / 800));
    const row = el("div", { left: x + "px", top: (y + h - (c.plate === "paper" ? 112 : 70) * k) + "px", width: w + "px", display: "flex", justifyContent: "center", pointerEvents: "none" }, b, "abs");
    plate(row, S, pp.name, pp.role, {}, k);
    if (big) {
      logoLayer(b, S, "live");
      if (c.show.badge) { const r = el("div", { left: 0, right: 0, top: "12px", display: "flex", justifyContent: "center", pointerEvents: "none", transform: "scale(.82)", transformOrigin: "top center" }, b, "abs"); badge(r, S, {}); }
      const bot = el("div", { left: 0, right: 0, bottom: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "30px", pointerEvents: "none", transform: "scale(.86)", transformOrigin: "bottom center" }, b, "abs");
      if (c.show.eq) eq(bot, { position: "relative" }, { n: 7, w: 7, h: 34 }); topic(bot, S, { position: "relative" }); if (c.show.eq) eq(bot, { position: "relative" }, { n: 7, w: 7, h: 34 });
    }
  }

  // «ثنائي»: الشاشة نصفان متجاورتان بلا إطار؛ خطّ فاصل متوهّج بينهما، ولوحة الاسم أسفل كلّ نصف. الإطار «الكبير» (الأيسر) يحمل الشارة والشعار والعنوان.
  function halfFrame(S, who, box, big) {
    const c = cfg(S), t = S._t, b = document.body, T = texts(), [x, y, w, h] = box; still(S);
    const pp = people(T)[who === "cam2" ? "guest" : who === "cam3" ? "third" : "host"];
    if (x > 0) {
      const ln = el("div", { left: (x - 2) + "px", top: 0, width: "4px", height: "1080px", background: `linear-gradient(to bottom, transparent, ${t.accent} 14%, ${t.accentHi} 50%, ${t.accent} 86%, transparent)`, boxShadow: `0 0 26px ${rgba(t.accent, .75)}` }, b, "abs");
      rxAdd(ln, "glow"); react();
    }
    const vg = el("div", { left: x + "px", top: (y + h - 300) + "px", width: w + "px", height: "300px", background: "linear-gradient(to top, rgba(0,0,0,.55), transparent)", pointerEvents: "none" }, b, "abs");
    const row = el("div", { left: x + "px", top: (y + h - (c.plate === "paper" ? 178 : 118)) + "px", width: w + "px", display: "flex", justifyContent: "center", pointerEvents: "none" }, b, "abs");
    plate(row, S, pp.name, pp.role, {}, 1);
    if (big) {
      logoLayer(b, S, "live");
      if (c.show.badge) { const r = el("div", { left: 0, right: 0, top: "12px", display: "flex", justifyContent: "center", pointerEvents: "none", transform: "scale(.82)", transformOrigin: "top center" }, b, "abs"); badge(r, S, {}); }
      const bot = el("div", { left: 0, right: 0, bottom: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "30px", pointerEvents: "none", transform: "scale(.8)", transformOrigin: "bottom center" }, b, "abs");
      if (c.show.eq) eq(bot, { position: "relative" }, { n: 7, w: 7, h: 30 }); topic(bot, S, { position: "relative" }); if (c.show.eq) eq(bot, { position: "relative" }, { n: 7, w: 7, h: 30 });
    }
  }

  // ---------- «ورقة ممزّقة»: بطاقة صورة بحافّة ممزّقة وشريط لاصق وتعليق بخطّ القالب، وورقة مسطّرة ممزّقة كخلفيّة لها ----------
  function torn(seed, n = 44, amp = 1.2) {
    const r = rnd(seed), p = [], e = (x0, y0, x1, y1, f) => { for (let i = 0; i < n; i++) { const t = i / n, j = r() * amp * (i % 2 ? 1 : .35); p.push(f(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, j)); } };
    e(0, 0, 100, 0, (x, y, j) => [x, y + j]); e(100, 0, 100, 100, (x, y, j) => [x - j, y]); e(100, 100, 0, 100, (x, y, j) => [x, y - j]); e(0, 100, 0, 0, (x, y, j) => [x + j, y]);
    return "polygon(" + p.map(q => q[0].toFixed(2) + "% " + q[1].toFixed(2) + "%").join(",") + ")";
  }
  function paperCard({ w, ar = .75, src, cap = "", rot = 0, seed = 7, ink = "#1d1b24" }) {
    const tmp = document.createElement("div"), pad = Math.round(w * .06), ph = Math.min(Math.round((w - pad * 2) * Math.max(.55, Math.min(1.3, ar))), Math.round(w * 1.05)), capH = cap ? Math.round(w * .2) : pad, h = pad + ph + capH;
    const wrap = el("div", { width: w + "px", height: h + "px", transform: `rotate(${rot}deg)`, filter: "drop-shadow(0 14px 20px rgba(0,0,0,.45))" }, tmp);
    el("div", { inset: 0, background: "#f7f4ea", clipPath: torn(seed, 46, 1.5) }, wrap, "abs");
    el("div", { left: pad + "px", top: pad + "px", width: (w - pad * 2) + "px", height: ph + "px", background: `#111 center/cover url("${src}")`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }, wrap, "abs");
    if (cap) { const c = el("div", { left: "4%", right: "4%", top: (pad + ph) + "px", height: capH + "px", display: "flex", alignItems: "center", justifyContent: "center", font: `700 ${Math.round(w * .085)}px var(--fa)`, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, wrap, "abs"); c.textContent = AR(cap); }
    el("div", { left: "50%", top: -Math.round(w * .045) + "px", width: Math.round(w * .34) + "px", height: Math.round(w * .09) + "px", transform: "translateX(-50%) rotate(-2.5deg)", background: "rgba(229,225,210,.82)", clipPath: torn(seed + 5, 8, 9), boxShadow: "0 1px 3px rgba(0,0,0,.2)" }, wrap, "abs");
    return { el: wrap, h };
  }
  function paperSheet(parent, [x, y, w, h], seed = 3) {
    const wr = el("div", { left: x + "px", top: y + "px", width: w + "px", height: h + "px", filter: "drop-shadow(0 18px 30px rgba(0,0,0,.45))" }, parent, "abs");
    el("div", { inset: 0, background: "repeating-linear-gradient(to bottom, transparent 0 41px, rgba(90,130,170,.28) 41px 42px), #f4f1e6", clipPath: torn(seed, 60, 1.1) }, wr, "abs");
    return wr;
  }

  Object.assign(G.PK, { paperCard, paperSheet, torn, halfFrame, brandOf, logoLayer, bg, eq, badge, plate, topic, solo, duoFrame, micIcon, people, rgba, mix, still });
})(typeof window !== "undefined" ? window : globalThis);
if (typeof module !== "undefined") module.exports = globalThis.PK;
