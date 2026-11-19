// «المجالس» — تبويب «القالب» في قسم البودكاست: القوالب (معاينة حقيقيّة)، الخلفيّة، الألوان، الخطوط (بأشكالها)، الإطارات والبطاقات، العناصر، تقسيمات الحوار،
// الموسيقى وأصوات التنقّل، وصور المقدّم والضيف. كلّ ما يُختار يُحفَظ مع الحلقة (modes.podcast) وتقرؤه طبقات البثّ مباشرةً (overlays/podkit.js).
const POD_BG_PAL = [["#121B2B", "كحليّ داكن"], ["#1A1038", "بنفسجيّ ليليّ"], ["#09090F", "أسود"], ["#0B1B3A", "أزرق ليليّ"], ["#0F3D3E", "أخضر مزرق"], ["#2A0E1F", "عنّابيّ"], ["#14211A", "أخضر غابيّ"], ["#262626", "فحميّ"], ["#F4ECDD", "عاجيّ"], ["#FFFFFF", "أبيض"], ["#E8F1F7", "سماويّ فاتح"]];
const POD_AC_PAL = [["#4CC3FF", "أزرق سماويّ"], ["#B38CFF", "بنفسجيّ"], ["#FF3D8B", "وردي"], ["#F2C879", "ذهبيّ"], ["#FFC145", "أصفر"], ["#3DDC97", "أخضر"], ["#FF7A3D", "برتقاليّ"], ["#FF4D4D", "أحمر"], ["#00BFA5", "تركوازيّ"], ["#A8761F", "برونزيّ"], ["#FFFFFF", "أبيض"]];
const podLum = hex => { const h = String(hex).replace("#", ""), [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };
const podTpl = () => Object.assign({ id: "studio" }, ((S().modes || {}).podcast || {}).tpl);
const podSave = (o, rerender = true) => modeSave({ tpl: JSON.parse(JSON.stringify(Object.assign({}, podTpl(), o))) }).then(() => { if (rerender) renderPodcast(); });
const podMusic = () => { const m = ((S().modes || {}).podcast || {}).music || {}; return { tracks: m.tracks || [], assign: Object.assign({ intro: "", break: "", outro: "" }, m.assign), fx: Object.assign({ on: false, id: "", file: "", vol: 70 }, m.fx), bed: Object.assign({ on: false, id: "", file: "", vol: 22, duck: true }, m.bed) }; };
const podMusicSave = async m => { await modeSave({ music: JSON.parse(JSON.stringify(m)) }); await podApplyScreens(m); };

// الموسيقى المُسنَدة تُطبَّق على شاشات «قبل الحلقة / الاستراحة / الختام» عبر آليّة صوت الشاشات نفسها (يعمل متكرّراً ما دامت الشاشة على الهواء)
async function podApplyScreens(m) {
  const h = cur().h; if (!h) return;
  const screens = JSON.parse(JSON.stringify(h.screens || {}));
  for (const k of ["intro", "break", "outro"]) {
    const tr = m.tracks.find(t => t.id === m.assign[k]), sc = screens[k] || {}, fx = sc.fx || {};
    screens[k] = Object.assign({}, sc, { fx: Object.assign({}, fx, { sound: tr ? { file: tr.file, name: tr.name, vol: tr.vol ?? 60 } : {} }) });
  }
  await hop("updateHalaqa", h.id, { screens });
  ST = await api.call("state:get");
}

let POD_LIB = null;
let POD_VIEW = "intro";
let POD_GAL = null;                                             // بطاقات القوالب (إطارات معاينة حيّة) تُبنى مرّة واحدة ويُحدَّث التحديد فقط
function podGallery(current, onPick) {
  if (!POD_GAL) {
    POD_GAL = document.createElement("div"); POD_GAL.className = "podgal";
    Object.entries(PK.TPL).forEach(([id, t]) => {
      const b = document.createElement("button"); b.dataset.id = id; b.className = "podcard";
      b.innerHTML = `<div class="pv"><iframe tabindex="-1" loading="lazy"></iframe></div><b>${esc(t.name)}</b><small>${esc(t.note)}</small>`;
      b.onclick = () => POD_GAL.onpick && POD_GAL.onpick(id);
      POD_GAL.appendChild(b);
    });
  }
  POD_GAL.onpick = onPick;
  POD_GAL.querySelectorAll(".podcard").forEach(b => { const fr = b.querySelector("iframe"), u = POD_VIEW === "intro" ? "/ov/screen.html?kind=intro&tpl=" + b.dataset.id : "/ov/podprev.html?tpl=" + b.dataset.id; if (fr.dataset.u !== u) { fr.dataset.u = u; fr.src = u; } }); POD_GAL.querySelectorAll(".podcard").forEach(b => b.classList.toggle("on", b.dataset.id === current));
  return POD_GAL;
}

function renderPodcast() {
  const box = $("t-podcast"); if (!box || typeof PK === "undefined") return;
  const side = podScroller(box), keep = side ? side.scrollTop : 0, hold = POD_GAL && POD_GAL.parentNode === box ? POD_GAL : null; if (hold) box.removeChild(hold);
  box.innerHTML = "";
  const tp = podTpl(), c = PK.cfg({ podcast: tp }), set = (o, re) => podSave(o, re), row = (label, node) => { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>"; r.appendChild(node); return r; };
  const sec = (title, hint) => { const h = document.createElement("h2"); h.className = "tsec"; h.textContent = title; box.appendChild(h); if (hint) { const p = document.createElement("p"); p.className = "hint"; p.textContent = hint; box.appendChild(p); } };
  const chips = (obj, cur0, fn) => { const w = document.createElement("div"); w.className = "podchips"; Object.entries(obj).forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if (cur0 === k) b.className = "on"; b.onclick = () => fn(k); w.appendChild(b); }); return w; };

  // ---- القوالب ----
  sec("قالب الحلقة", "اختر قالباً جاهزاً بخلفيّته وخطّه وبطاقاته وتقسيم الحوار، ثمّ عدّل ما تشاء بالأسفل. المعاينة بالشكل الحقيقيّ، ويتغيّر البثّ فوراً.");
  box.appendChild(chips({ intro: "معاينة شاشة قبل الحلقة", duo: "معاينة الحوار (إطاران)" }, POD_VIEW, k => { POD_VIEW = k; renderPodcast(); }));
  box.appendChild(podGallery(c.id, async id => {
    await set({ id, pal: undefined, bg: undefined, font: undefined, shape: undefined, plate: undefined, title: undefined, layout: undefined }, false);
    const d = PK.TPL[id].duo; if (d) await patch({ duo: Object.assign({}, d) });        // تقسيم الحوار الخاصّ بالقالب
    renderPodcast();
  }));
  box.appendChild(row("تخطيط شاشة قبل الحلقة", chips(PK.LAYOUTS, c.layout || "cards", k => set({ layout: k }, true))));
  { const r = document.createElement("button"); r.className = "mid"; r.textContent = "إعادة ضبط تعديلاتي على القالب"; r.onclick = () => set({ pal: undefined, bg: undefined, font: undefined, shape: undefined, plate: undefined, title: undefined, layout: undefined, bgImg: undefined, bgDim: undefined, bgBlur: undefined }, true); box.appendChild(r); }

  // ---- الخلفيّة ----
  sec("الخلفيّة");
  box.appendChild(chips(PK.BGS, c.bgKind, k => set({ bg: k }, true)));
  if (c.bgKind === "image") {
    const hd = document.createElement("div"); box.appendChild(hd);
    imgEditor(hd, tp.bgImg ? { file: tp.bgImg } : null, "صورة خلفيّة البودكاست", async v => { await set({ bgImg: v ? v.file : "" }, false); renderPodcast(); });
    box.appendChild(tsRange("تعتيم الصورة", 0, 90, 1, c.bgDim ?? 45, v => v + "٪", v => set({ bgDim: v }, false)));
    box.appendChild(tsRange("تغبيش الصورة", 0, 30, 1, c.bgBlur ?? 0, v => v + " px", v => set({ bgBlur: v }, false)));
  }
  box.appendChild(tsSwitch("حركة الخلفيّة والأعمدة الصوتيّة", c.motion !== false, on => set({ motion: on }, false)));

  // ---- الألوان ----
  sec("الألوان");
  box.appendChild(row("لون الخلفيّة", tsColors(c.pal.bg, v => { const light = podLum(v) > .62; set({ pal: Object.assign({}, c.pal, { bg: v, light, ink: light ? "#2A2113" : undefined }) }, true); }, false, POD_BG_PAL)));
  box.appendChild(row("اللون البارز", tsColors(c.pal.accent, v => set({ pal: Object.assign({}, c.pal, { accent: v }) }, true), false, POD_AC_PAL)));

  // ---- الخطّ (كلّ خطّ بشكله) ----
  sec("الخطّ", "خطّ العناوين والأسماء وكلّ نصوص البودكاست. كل خطّ معروض بشكله الحقيقيّ.");
  { const g = document.createElement("div"); g.className = "podfonts";
    Object.entries(TH.FONTS).forEach(([k, f]) => {
      const b = document.createElement("button"); b.className = "podfont" + (c.font === k ? " on" : "");
      b.innerHTML = `<span class="pfs" style="font-family:${f.fa}">حوارات تُلهم ١٢</span><span class="pfn" style="font-family:${f.fs}">أحمد الراشد — الحلقة الأولى</span><small>${esc(f.name)}</small>`;
      b.onclick = () => set({ font: k }, true); g.appendChild(b);
    }); box.appendChild(g); }

  // ---- الإطارات والبطاقات ----
  sec("إطارات الكاميرا وبطاقات الأسماء", "شكل الإطار يُطبَّق على قصّ الكاميرا نفسه (يُعاد بناء المشاهد عند التغيير، ويؤجَّل لو كان البثّ جارياً).");
  { const g = document.createElement("div"); g.className = "podshapes";
    Object.entries(TH.SHAPES).forEach(([k, n]) => {
      const b = document.createElement("button"); b.className = "podshape" + (c.shape === k ? " on" : ""); b.title = n;
      b.innerHTML = `<svg viewBox="0 0 34 44" width="34" height="44"><path d="${sfxShape(k)}" fill="none" stroke="currentColor" stroke-width="2"/></svg><small>${esc(n)}</small>`;
      b.onclick = () => set({ shape: k }, true); g.appendChild(b);
    }); box.appendChild(g); }
  box.appendChild(chips(PK.PLATES, c.plate, k => set({ plate: k }, true)));
  box.appendChild(chips({ cap: "شارة كبسولة في الأعلى", bar: "شريط علويّ متدرّج" }, c.title, k => set({ title: k }, true)));

  // ---- العناصر ----
  sec("العناصر على الشاشة");
  [["badge", "شارة البودكاست (الاسم والشعار)"], ["ep", "رقم الحلقة"], ["topic", "شريط عنوان الحلقة"], ["eq", "أعمدة الصوت المتحرّكة"], ["logo", "الشعار"], ["social", "أيقونات التواصل في شاشات البودكاست"]]
    .forEach(([k, t]) => box.appendChild(tsSwitch(t, c.show[k] !== false, on => set({ show: Object.assign({}, c.show, { [k]: on }) }, false))));

  // ---- شعار البودكاست الخاصّ ----
  sec("شعار البودكاست", "شعار خاصّ بالبودكاست يحلّ محلّ الاسم في الشارة وفي شاشة «قبل الحلقة» (أو يظهر بجانبه).");
  { const hd = document.createElement("div"); box.appendChild(hd);
    imgEditor(hd, tp.brand || null, "شعار البودكاست", async v => { await set({ brand: v || undefined }, false); renderPodcast(); });
    if (tp.brand && tp.brand.file) {
      box.appendChild(tsSwitch("يحلّ محلّ اسم البودكاست", c.brandMode !== "with", on => set({ brandMode: on ? "replace" : "with" }, false)));
      box.appendChild(tsRange("حجم الشعار", 40, 220, 5, c.brandH ?? 90, v => v + " px", v => set({ brandH: v }, false))); } }

  // ---- شعارات الحلقة (متعدّدة) ----
  sec("شعارات الحلقة", "أضف حتى ٦ شعارات (جهات، رعاة…). لكل شعار موضعه وحجمه وشفافيّته وأين يظهر، والشعارات في الموضع نفسه تُصَفّ جنباً إلى جنب.");
  { const L = S().logos || [], upd = ch => { const X = S().logos.slice(); ch(X); return patch({ logos: X }).then(renderPodcast); };
    const POS = [["tr", "أعلى اليمين"], ["tc", "أعلى الوسط"], ["tl", "أعلى اليسار"], ["mr", "وسط اليمين"], ["mc", "الوسط"], ["ml", "وسط اليسار"], ["br", "أسفل اليمين"], ["bc", "أسفل الوسط"], ["bl", "أسفل اليسار"]];
    L.forEach((l, i) => {
      const d = document.createElement("div"); d.className = "podtrack podlogo";
      const top = document.createElement("div"); top.className = "ptr";
      const im = document.createElement("img"); im.src = "/media/" + encodeURIComponent(l.nobg && l.cut ? l.cut : l.file); im.style.cssText = "height:44px;max-width:120px;object-fit:contain;background:#fff3;border-radius:8px;padding:3px";
      const on = tsSwitch(l.on === false ? "مخفي" : "ظاهر", l.on !== false, v => upd(X => X[i] = Object.assign({}, l, { on: v })));
      const del = document.createElement("button"); del.className = "danger"; del.textContent = "✕"; del.onclick = () => upd(X => X.splice(i, 1));
      top.append(im, on, del); d.appendChild(top);
      const g = document.createElement("div"); g.className = "podpos"; POS.forEach(([k, n]) => { const b = document.createElement("button"); b.title = n; if ((l.pos || "tl") === k) b.className = "on"; b.onclick = () => upd(X => X[i] = Object.assign({}, l, { pos: k })); g.appendChild(b); });
      d.appendChild(row("الموضع", g));
      d.appendChild(tsRange("الحجم", 24, 260, 2, l.h || 70, v => v + " px", v => upd(X => X[i] = Object.assign({}, l, { h: v }))));
      d.appendChild(tsRange("الشفافيّة", 20, 100, 1, Math.round((l.op ?? 1) * 100), v => v + "٪", v => upd(X => X[i] = Object.assign({}, l, { op: v / 100 }))));
      const sh = Object.assign({ live: true, intro: true, break: true, outro: true }, l.show), w = document.createElement("div"); w.className = "podchips";
      [["live", "البثّ (المقدّم/الضيف/حوار)"], ["intro", "قبل الحلقة"], ["break", "الاستراحة"], ["outro", "الختام"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if (sh[k] !== false) b.className = "on"; b.onclick = () => upd(X => X[i] = Object.assign({}, l, { show: Object.assign({}, sh, { [k]: sh[k] === false }) })); w.appendChild(b); });
      d.appendChild(row("يظهر في", w));
      d.appendChild(tsSwitch("أبيض (بدل ألوانه)", !!l.mono, v => upd(X => X[i] = Object.assign({}, l, { mono: v }))));
      box.appendChild(d); });
    if (L.length < 6) { const b = document.createElement("button"); b.className = "mid pri"; b.textContent = "＋ إضافة شعار"; b.onclick = async () => { ST.settings.logos = await api.call("media:addLogos"); renderPodcast(); }; box.appendChild(b); } }

  // ---- تقسيمات الحوار ----
  sec("تقسيمات الحوار", "كيف يظهر المقدّم والضيف معاً في مشهد «حوار». لكل قالب تقسيمه الافتراضيّ ويمكنك تغييره.");
  { const d = Object.assign({ mode: "side", big: "cam2", side: "right", small: 1 }, S().duo || {}), dset = o => patch({ duo: o }).then(renderPodcast);
    box.appendChild(chips({ side: "جنباً إلى جنب", inset: "الصغير داخل الكبير", overlap: "متداخلان" }, d.mode, v => dset({ mode: v })));
    box.appendChild(row("الإطار الكبير", chips({ sheikh: "المقدّم", cam2: "الضيف" }, d.big, v => dset({ big: v }))));
    box.appendChild(row("جهة الكبير", chips({ right: "يمين", left: "يسار" }, d.side, v => dset({ side: v }))));
    box.appendChild(tsRange("حجم الإطار الصغير", 0.5, 1.3, 0.05, d.small || 1, v => "×" + (+v).toFixed(2), v => patch({ duo: { small: v } })));
    if (!(S().cam2 || {}).on) { const w = document.createElement("div"); w.className = "hint"; w.style.color = "var(--bad,#FF8A80)"; w.textContent = "كاميرا الضيف مطفأة، فلا يظهر مشهد «الضيف» ولا «حوار».";
      const b = document.createElement("button"); b.className = "mid pri"; b.textContent = "تفعيل كاميرا الضيف"; b.onclick = async () => { await patch({ cam2: { on: true, target: "guest" } }); if (typeof renderScenes === "function") renderScenes(); renderPodcast(); toast("اختر جهاز الضيف من «الأجهزة»"); }; box.append(w, b); } }

  // ---- الموسيقى وأصوات التنقّل ----
  podMusicUI(box, sec, row);

  // ---- الصور ----
  sec("صور المقدّم والضيف", "تظهر في شاشة «قبل الحلقة». بلا صورة يظهر حرف من الاسم.");
  { const h = hop, mid = "mode:podcast", cfg = (S().modes || {}).podcast || {};
    const one = (label, key) => { const t = document.createElement("div"); t.className = "hint"; t.textContent = label; const hd = document.createElement("div"); box.append(t, hd);
      imgEditor(hd, cfg[key], label, async v => { await h("updateHalaqa", mid, { [key]: v }); ST = await api.call("state:get"); renderPodcast(); }, { smart: true }); };
    one("صورة المقدّم", "sheikhImg"); one("صورة الضيف", "guestImg"); }

  requestAnimationFrame(() => POD_GAL && POD_GAL.querySelectorAll(".pv").forEach(p => p.style.setProperty("--ps", ((p.clientWidth || 280) / 1920).toFixed(4))));
  if (side) side.scrollTop = keep;
}

// ---------- الموسيقى ----------
const POD_PLAY = { au: null, id: "" };
// أقرب عنصر قابل للتمرير حول التبويب: نحفظ موضعه ونعيده بعد كل إعادة رسم فلا يقفز التركيز للأعلى
function podScroller(el) { for (let e = el; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 4) return e; } return $("side"); }
const podPlayUi = () => document.querySelectorAll("[data-playid]").forEach(b => { b.textContent = POD_PLAY.id === b.dataset.playid ? "■ إيقاف" : "▶ تجربة"; });
function podPlay(tr) { if (POD_PLAY.au) { POD_PLAY.au.pause(); POD_PLAY.au = null; } if (!tr || POD_PLAY.id === tr.id) { POD_PLAY.id = ""; return podPlayUi(); } const a = POD_PLAY.au = new Audio(tr.url || ("/media/" + encodeURIComponent(tr.file))); a.volume = Math.max(0, Math.min(1, (tr.vol ?? 60) / 100)); POD_PLAY.id = tr.id; a.onended = () => { POD_PLAY.id = ""; podPlayUi(); }; a.play().catch(() => {}); podPlayUi(); }
function podMusicUI(box, sec, row) {
  const m = podMusic(), save = async o => { await podMusicSave(Object.assign({}, podMusic(), o)); renderPodcast(); };
  if (!POD_LIB) api.call("sounds:list").then(l => { POD_LIB = Array.isArray(l) ? l : []; renderPodcast(); });
  sec("مكتبة الأصوات الجاهزة", "أصوات تنقّل وموسيقى خلفيّة هادئة مُجهَّزة داخل البرنامج. ▶ للتجربة و＋ لإضافتها إلى موسيقى الحلقة (ثمّ اختيارها بالأسفل).");
  [["transition", "أصوات التنقّل"], ["ambient", "موسيقى هادئة للخلفيّة"]].forEach(([kind, title]) => {
    const items = (POD_LIB || []).filter(x => x.kind === kind); if (!items.length) return;
    const h = document.createElement("b"); h.textContent = title; h.style.cssText = "display:block;margin:10px 0 4px;color:var(--accent,#D1AA62)"; box.appendChild(h);
    items.forEach(it => { const r = document.createElement("div"); r.className = "podlib"; const have = m.tracks.some(t => t.file === "snd-" + it.id + ".mp3");
      const pl = document.createElement("button"); pl.className = "mid"; pl.dataset.playid = it.id; pl.textContent = POD_PLAY.id === it.id ? "■ إيقاف" : "▶ تجربة"; pl.onclick = () => podPlay({ id: it.id, file: null, url: "/assets/sounds/" + it.file, vol: kind === "ambient" ? 40 : 80 });
      const nm = document.createElement("span"); nm.textContent = it.name + (kind === "ambient" ? " · هادئة تتكرّر بلا فجوة" : " · " + it.sec.toFixed(1) + " ث");
      const ad = document.createElement("button"); ad.className = "mid" + (have ? "" : " pri"); ad.textContent = have ? "✓ مُضافة" : "＋ إضافة"; ad.disabled = have;
      ad.onclick = async () => { const f = await api.call("sounds:add", it.id); const mm = podMusic(); save({ tracks: mm.tracks.concat({ id: "m" + it.id, file: f.file, name: f.name, vol: kind === "ambient" ? 30 : 60 }) }); };
      r.append(pl, nm, ad); box.appendChild(r); });
  });
  sec("موسيقى البودكاست", "استورد مقاطع موسيقيّة (مقدّمة، استراحة، ختام…) وأدِرها هنا، ثمّ أسندها لشاشات الحلقة. تُحفَظ مع الحلقة.");
  const imp = document.createElement("button"); imp.className = "mid pri"; imp.textContent = "＋ استيراد موسيقى";
  imp.onclick = async () => { const r = await api.call("media:pickAudio", "موسيقى البودكاست"); if (!r) return; const id = "m" + Date.now().toString(36); save({ tracks: m.tracks.concat({ id, file: r.file, name: String(r.name).replace(/\.[^.]+$/, ""), vol: 60 }) }); };
  box.appendChild(imp);
  if (!m.tracks.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "لا توجد موسيقى بعد."; box.appendChild(p); }
  m.tracks.forEach(tr => {
    const d = document.createElement("div"); d.className = "podtrack";
    const top = document.createElement("div"); top.className = "ptr";
    const play = document.createElement("button"); play.className = "mid"; play.dataset.playid = tr.id; play.textContent = POD_PLAY.id === tr.id ? "■ إيقاف" : "▶ تجربة"; play.onclick = () => podPlay(tr);
    const nm = document.createElement("input"); nm.value = tr.name; let tmr; nm.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => podMusicSave({ ...podMusic(), tracks: podMusic().tracks.map(x => x.id === tr.id ? { ...x, name: nm.value } : x) }), 400); };
    const del = document.createElement("button"); del.className = "danger"; del.textContent = "✕"; del.title = "حذف";
    del.onclick = () => { if (!confirm("حذف «" + tr.name + "» من موسيقى الحلقة؟")) return; const mm = podMusic(); const a = Object.assign({}, mm.assign); for (const k in a) if (a[k] === tr.id) a[k] = ""; const fx = mm.fx.id === tr.id ? Object.assign({}, mm.fx, { id: "", file: "", on: false }) : mm.fx, bed = mm.bed.id === tr.id ? Object.assign({}, mm.bed, { id: "", file: "", on: false }) : mm.bed; save({ tracks: mm.tracks.filter(x => x.id !== tr.id), assign: a, fx, bed }); };
    top.append(play, nm, del); d.appendChild(top);
    d.appendChild(tsRange("مستوى الصوت", 0, 100, 1, tr.vol ?? 60, v => v + "٪", v => podMusicSave({ ...podMusic(), tracks: podMusic().tracks.map(x => x.id === tr.id ? { ...x, vol: v } : x) })));
    box.appendChild(d);
  });
  const sel = (cur0, fn, none = "— بلا موسيقى —") => { const s = document.createElement("select"); s.innerHTML = `<option value="">${none}</option>` + m.tracks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join(""); s.value = m.tracks.some(t => t.id === cur0) ? cur0 : ""; s.onchange = () => fn(s.value); s.style.flex = "1"; return s; };
  if (m.tracks.length) {
    sec("إسناد الموسيقى للشاشات", "تعمل الموسيقى متكرّرةً طالما الشاشة على الهواء، وتبدأ من أوّلها عند ظهور الشاشة.");
    [["intro", "قبل الحلقة"], ["break", "الاستراحة"], ["outro", "الختام"]].forEach(([k, label]) => box.appendChild(row(label, sel(m.assign[k], v => save({ assign: Object.assign({}, m.assign, { [k]: v }) })))));
  }
  sec("أصوات التنقّل بين المشاهد", "صوت قصير (وشوشة/ضربة) يُشغَّل مع كل انتقال بين المشاهد في البثّ والتسجيل. استورده من «استيراد موسيقى» ثمّ اخترْه هنا.");
  box.appendChild(tsSwitch("تشغيل صوت التنقّل", !!m.fx.on, on => save({ fx: Object.assign({}, m.fx, { on }) })));
  box.appendChild(row("الصوت", sel(m.fx.id, v => { const t = m.tracks.find(x => x.id === v); save({ fx: Object.assign({}, m.fx, { id: v, file: t ? t.file : "", on: m.fx.on && !!t }) }); }, "— اختر صوتاً —")));
  box.appendChild(tsRange("مستوى صوت التنقّل", 0, 100, 1, m.fx.vol ?? 70, v => v + "٪", v => podMusicSave({ ...podMusic(), fx: { ...podMusic().fx, vol: v } })));
  sec("موسيقى الخلفيّة أثناء الحوار", "موسيقى هادئة تعمل تحت كلام المقدّم والضيف في مشاهد المقدّم والضيف وحوار. في وضع «تفاعليّة» تخفت تلقائيّاً حين يتكلّم أحد وتعلو عند الصمت.");
  box.appendChild(tsSwitch("تشغيل موسيقى الخلفيّة", !!m.bed.on, on => save({ bed: Object.assign({}, m.bed, { on }) })));
  box.appendChild(row("المقطع", sel(m.bed.id, v => { const t = m.tracks.find(x => x.id === v); save({ bed: Object.assign({}, m.bed, { id: v, file: t ? t.file : "", on: m.bed.on && !!t }) }); }, "— اختر موسيقى —")));
  box.appendChild(tsRange("مستوى الموسيقى", 0, 100, 1, m.bed.vol ?? 22, v => v + "٪", v => podMusicSave({ ...podMusic(), bed: { ...podMusic().bed, vol: v } })));
  box.appendChild(tsSwitch("تفاعليّة: تخفت عند الكلام", m.bed.duck !== false, on => save({ bed: Object.assign({}, m.bed, { duck: on }) })));
  { const t = document.createElement("button"); t.className = "mid"; t.textContent = "▶ تجربة صوت التنقّل"; t.onclick = () => { if (!m.fx.file) return toast("اختر صوتاً أوّلاً"); const a = new Audio("/media/" + encodeURIComponent(m.fx.file)); a.volume = (m.fx.vol ?? 70) / 100; a.play().catch(() => {}); }; box.appendChild(t); }
}

// ---------- معرض الصور ----------
const podPh = () => { const p = ((S().modes || {}).podcast || {}).photos || {}; return { frame: p.frame || "", items: p.items || [], secs: p.secs || 6, fx: p.fx || "kenburns", caps: p.caps !== false, music: Object.assign({ id: "", file: "", vol: 25 }, p.music) }; };
const podPhSave = (p, re = true) => modeSave({ photos: JSON.parse(JSON.stringify(p)) }).then(() => podDock(!re));
const podMS = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const podParseT = v => { const m = String(v).trim().match(/^(\d+):(\d{1,2})$/); return m ? +m[1] * 60 + +m[2] : Math.max(0, parseInt(v) || 0); };
function podPhotosUI(box, sec, row) {
  const P0 = podPh(), m = podMusic(), esc2 = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  if (false) sec("معرض الصور", "أضف صوراً للحلقة. مشهد «معرض الصور» يعرضها صورةً بعد صورة بموسيقى هادئة، و«معرض + الضيف» يعرضها بجانب كاميرا الضيف. ويمكن أيضاً تركيب أيّ صورة فوق مشاهد الكاميرات: الآن، أو في وقت محدّد من الحلقة، وأكثر من صورة معاً.");
  const add = document.createElement("button"); add.className = "mid pri"; add.textContent = "＋ إضافة صور…"; add.style.display = "none";
  add.onclick = async () => { const r = await api.call("media:pickImages", "صور الحلقة"); if (!r || !r.length) return; const p = podPh(); r.forEach((f, i) => p.items.push({ id: "p" + Date.now().toString(36) + i, file: f.file, cap: "", inGal: true, ov: { on: false, pos: "br", w: 26, at: 0, dur: 0 } })); podPhSave(p); };
  box.appendChild(add);
  if (!P0.items.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "لا توجد صور بعد."; box.appendChild(p); }
  const upd = (id, fn, re = false) => { const p = podPh(); p.items = p.items.map(x => x.id === id ? fn(JSON.parse(JSON.stringify(x))) : x); return podPhSave(p, re); };
  P0.items.forEach((it, idx) => {
    const ov = Object.assign({ on: false, pos: "br", w: 26, at: 0, dur: 0 }, it.ov), d = document.createElement("div"); d.className = "phcard";
    const th = document.createElement("img"); th.className = "th"; th.src = "/media/" + encodeURIComponent(it.file); d.appendChild(th);
    const ctl = document.createElement("div"); ctl.className = "ctl";
    const cap = document.createElement("input"); cap.type = "text"; cap.placeholder = "تعليق على الصورة (اختياري)"; cap.value = it.cap || ""; let tm; cap.oninput = () => { clearTimeout(tm); tm = setTimeout(() => upd(it.id, x => (x.cap = cap.value, x)), 500); };
    const mv = (dir, txt) => { const b = document.createElement("button"); b.className = "mid"; b.textContent = txt; b.disabled = idx + dir < 0 || idx + dir >= P0.items.length; b.onclick = () => { const p = podPh(), a = p.items; [a[idx], a[idx + dir]] = [a[idx + dir], a[idx]]; podPhSave(p); }; return b; };
    const del = document.createElement("button"); del.className = "danger"; del.textContent = "✕"; del.title = "حذف الصورة"; del.onclick = () => { if (!confirm("حذف هذه الصورة من الحلقة؟")) return; const p = podPh(); p.items = p.items.filter(x => x.id !== it.id); podPhSave(p); };
    const ig = document.createElement("label"); ig.style.cssText = "display:flex;gap:5px;align-items:center;font-size:12px"; ig.innerHTML = `<input type="checkbox" ${it.inGal !== false ? "checked" : ""}> ضمن المعرض`; ig.firstChild.onchange = e => upd(it.id, x => (x.inGal = e.target.checked, x));
    ctl.append(cap, mv(-1, "▲"), mv(1, "▼"), ig, del); d.appendChild(ctl);
    const o = document.createElement("div"); o.className = "ov";
    o.appendChild(tsSwitch("تركيبها فوق المشهد الآن", !!ov.on, on => upd(it.id, x => (x.ov.on = on, x))));
    const grid = document.createElement("div"); grid.className = "phgrid";
    ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"].forEach(k => { const b = document.createElement("button"); b.className = "mid" + (ov.pos === k ? " on" : ""); b.title = k; b.onclick = () => upd(it.id, x => (x.ov.pos = k, x), true); grid.appendChild(b); });
    o.appendChild(row("الموضع", grid));
    o.appendChild(tsRange("حجم الصورة", 10, 60, 1, ov.w, v => v + "٪", v => upd(it.id, x => (x.ov.w = v, x))));
    const sched = document.createElement("div"); sched.className = "ctl";
    const at = document.createElement("input"); at.type = "text"; at.value = podMS(ov.at || 0); at.style.width = "70px"; at.onchange = () => upd(it.id, x => (x.ov.at = podParseT(at.value), x), true);
    const du = document.createElement("input"); du.type = "number"; du.min = 0; du.max = 7200; du.value = ov.dur || 0; du.style.width = "70px"; du.onchange = () => upd(it.id, x => (x.ov.dur = Math.max(0, +du.value || 0), x), true);
    sched.append(Object.assign(document.createElement("span"), { textContent: "تظهر عند (د:ث)" }), at, Object.assign(document.createElement("span"), { textContent: "لمدّة (ث)" }), du);
    o.appendChild(row("ظهور مجدول", sched));
    const hp = document.createElement("p"); hp.className = "hint"; hp.textContent = "المدّة 0 = بلا جدولة (تظهر فقط عند تفعيل «الآن»). الوقت محسوب من لحظة بدء البثّ أو التسجيل."; o.appendChild(hp);
    d.appendChild(o); box.appendChild(d);
  });
  sec("إعدادات المعرض");
  { const fw = document.createElement("div"); fw.className = "podchips";
    [["", "حسب القالب"], ["shape", "بشكل القالب"], ["paper", "ورقة ممزّقة"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if ((P0.frame || "") === k) b.className = "on"; b.onclick = () => { const p = podPh(); p.frame = k; podPhSave(p); }; fw.appendChild(b); });
    box.appendChild(row("شكل إطار الصور (المعرض والتركيب)", fw)); }
  box.appendChild(tsRange("ثواني كل صورة", 2, 20, 1, P0.secs, v => v + " ث", v => { const p = podPh(); p.secs = v; podPhSave(p, false); }));
  const fxw = document.createElement("div"); fxw.className = "podchips";
  [["kenburns", "حركة بطيئة"], ["fade", "تلاشٍ"], ["slide", "انزلاق"]].forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; if (P0.fx === k) b.className = "on"; b.onclick = () => { const p = podPh(); p.fx = k; podPhSave(p); }; fxw.appendChild(b); });
  box.appendChild(row("حركة الانتقال", fxw));
  box.appendChild(tsSwitch("إظهار التعليقات", P0.caps, on => { const p = podPh(); p.caps = on; podPhSave(p, false); }));
  const ms = document.createElement("select"); ms.innerHTML = `<option value="">— بلا موسيقى —</option>` + m.tracks.map(t => `<option value="${esc2(t.id)}" ${P0.music.id === t.id ? "selected" : ""}>${esc2(t.name)}</option>`).join("");
  ms.onchange = () => { const t = m.tracks.find(x => x.id === ms.value), p = podPh(); p.music = Object.assign({}, p.music, { id: ms.value, file: t ? t.file : "" }); podPhSave(p, false); };
  box.appendChild(row("موسيقى المعرض", ms));
  box.appendChild(tsRange("مستوى الموسيقى", 0, 100, 1, P0.music.vol ?? 25, v => v + "٪", v => { const p = podPh(); p.music.vol = v; podPhSave(p, false); }));
  if (!m.tracks.length) { const p = document.createElement("p"); p.className = "hint"; p.textContent = "لاختيار موسيقى: أضف مقطعاً هادئاً من «مكتبة الأصوات» أو استورد ملفّك في قسم الموسيقى."; box.appendChild(p); }
}

// ---------- لوحة معرض الصور تحت معاينة البثّ (غرفة التحكّم) ----------
// كلّ إدارة الصور هنا: إضافة، عرض على الهواء بضغطة، السابقة/التالية في مشهد المعرض، التعليقات، الموضع والحجم والجدولة، الترتيب، الحذف، وإعدادات المعرض.
let POD_DOCK_OPEN = (() => { try { return localStorage.getItem("podDockOpen") === "1"; } catch { return true; } })();
function podDock(keepBody) {
  const d = document.getElementById("phDock"); if (!d) return;
  const on = curMode() === "podcast"; d.hidden = !on; if (!on) return;
  const p = podPh(); let det = d.querySelector(".phdet"), keep = det ? det.scrollTop : 0;
  d.innerHTML = "";
  const head = document.createElement("div"); head.className = "phhead"; d.appendChild(head);
  const mk = (txt, title, fn, cls = "mid") => { const b = document.createElement("button"); b.className = cls; b.textContent = txt; b.title = title; b.onclick = fn; head.appendChild(b); return b; };
  const t = document.createElement("b"); t.textContent = "معرض الصور"; head.appendChild(t);
  mk("＋ إضافة", "إضافة صور للحلقة", async () => { const r = await api.call("media:pickImages", "صور الحلقة"); if (!r || !r.length) return; const q = podPh(); r.forEach((f, i) => q.items.push({ id: "p" + Date.now().toString(36) + i, file: f.file, cap: "", inGal: true, ov: { on: false, pos: "br", w: 26, at: 0, dur: 0 } })); POD_DOCK_OPEN = true; podPhSave(q, true); }, "mid pri");
  mk("السابقة", "الصورة السابقة في مشهد معرض الصور", () => api.call("gal:cmd", "prev"));
  mk("التالية", "الصورة التالية في مشهد معرض الصور", () => api.call("gal:cmd", "next"));
  const sp = document.createElement("span"); sp.style.flex = "1"; head.appendChild(sp);
  mk(POD_DOCK_OPEN ? "▾ إخفاء الإدارة" : "▸ إدارة الصور", "إظهار/إخفاء تفاصيل الصور", () => { POD_DOCK_OPEN = !POD_DOCK_OPEN; try { localStorage.setItem("podDockOpen", POD_DOCK_OPEN ? "1" : "0"); } catch {} podDock(); });
  const strip = document.createElement("div"); strip.className = "phstrip"; d.appendChild(strip);
  if (!p.items.length) { const e = document.createElement("small"); e.textContent = "لا صور — اضغط «＋ إضافة»، ثم اضغط الصورة لتظهر على الهواء فوق المشهد"; strip.appendChild(e); }
  p.items.forEach(it => {
    const b = document.createElement("button"); b.className = "phth" + (it.ov && it.ov.on ? " on" : ""); b.title = (it.cap || "صورة") + (it.ov && it.ov.on ? " — على الهواء (اضغط للإخفاء)" : " — اضغط لإظهارها فوق المشهد");
    b.innerHTML = '<img src="/media/' + encodeURIComponent(it.file) + '">' + (it.ov && it.ov.on ? "<i>على الهواء</i>" : "");
    b.onclick = () => { const q = podPh(); q.items = q.items.map(x => x.id === it.id ? Object.assign({}, x, { ov: Object.assign({ pos: "br", w: 26, at: 0, dur: 0 }, x.ov, { on: !(x.ov && x.ov.on) }) }) : x); podPhSave(q, true); };
    strip.appendChild(b);
  });
  if (!POD_DOCK_OPEN) return;
  det = document.createElement("div"); det.className = "phdet"; d.appendChild(det);
  { const sc = document.getElementById("stageCol"), r = sc ? sc.getBoundingClientRect() : null; if (r) { det.style.left = r.left + "px"; det.style.width = r.width + "px"; }
    const hd = document.createElement("div"); hd.className = "phdh"; hd.innerHTML = "<b>إدارة صور الحلقة</b>"; const x = document.createElement("button"); x.className = "mid"; x.textContent = "✕ إغلاق"; x.onclick = () => { POD_DOCK_OPEN = false; try { localStorage.setItem("podDockOpen", "0"); } catch {} podDock(); }; hd.appendChild(x); det.appendChild(hd); }
  const sec = (title, hint) => { const h = document.createElement("h2"); h.className = "tsec"; h.textContent = title; det.appendChild(h); if (hint) { const q = document.createElement("p"); q.className = "hint"; q.textContent = hint; det.appendChild(q); } };
  const row = (label, node) => { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>"; r.appendChild(node); return r; };
  podPhotosUI(det, sec, row); det.scrollTop = keep;
}
