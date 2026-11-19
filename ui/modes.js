// «المجالس» — الأقسام الثلاثة عند فتح البرنامج: خطب الجمع | الدروس العلميّة | المحاضرات
// لكل قسم: بياناته ونموذجه وأسماء مشاهده وكاميرا جمهوره (المصلّون / المستمعون) وشعاراته وشاشاته.
const MODES = {
  lessons: { name: "الدروس العلميّة", tab: "الدرس", desc: "الحلقات والكتب والمجالس: كتاب وشيخ وبطاقة الصفحة", hero: "book" },
  khutba: { name: "خطب الجمع", tab: "الخطبة", desc: "المسجد والمكان والخطيب والتاريخ تلقائيّاً، مع كاميرا المصلّين", hero: "mosque" },
  lecture: { name: "المحاضرات", tab: "المحاضرة", desc: "المحاضر والمستمعون بلا كتاب، بعنوان المحاضرة والجهة", hero: "podium" },
  quran: { name: "معرض القرآن الكريم", tab: "التلاوة", desc: "قارئ بمشاهد آيات تتنقّل آيةً آية من المصحف العثماني: أسفل الشاشة أو بجانب القارئ أو في إطار", hero: "quran" },
  lab: { name: "معمل المجالس", tab: "المعمل", desc: "استوديو لتعديل مقاطع محمَّلة: قصّ وحذف السكتات ودمج ومشاهد وآيات ومقدّمات وردّ وصوت بإطار وصور", hero: "lab" },
  podcast: { name: "بودكاست", tab: "الحلقة", desc: "مقدّم وضيف بقوالب استوديو عصريّة وخلفيّات وخطوط متعدّدة", hero: "mic" },
};
// مشاهد كل قسم وأسماؤها (القسم «الدروس» يعرض كل المشاهد كما هي)
const MODE_SCENES = {
  khutba: { intro: "قبل الخطبة", sheikh: "الخطيب", cam2: "المصلّون", duo: "الخطيب + المصلّين", outro: "الختام" },
  lecture: { intro: "قبل المحاضرة", sheikh: "المحاضر", cam2: "المستمعون", duo: "المحاضر + المستمعين", break: "استراحة", outro: "الختام" },
  quran: { intro: "قبل التلاوة", sheikh: "القارئ", cam2: "الكاميرا الثانية", duo: "القارئ + الثانية", qbottom: "آية أسفل", qside: "آية بجانب القارئ", qtop: "آية أعلى", qframe: "آية في إطار", outro: "الختام" },
  podcast: { intro: "قبل الحلقة", sheikh: "المقدّم", cam2: "الضيف", cam3: "الثالثة", duo: "حوار", duo2: "ثنائي", trio: "ثلاثي", gal: "معرض الصور", galguest: "معرض + الضيف", break: "استراحة", outro: "الختام" },
};
const MODE_CAM2 = {
  lessons: { audience: "الحضور", students: "الطلبة", courtyard: "باحة المسجد" },
  khutba: { worshippers: "المصلّون", courtyard: "باحة المسجد", women: "مصلّى النساء", outside: "خارج المسجد" },
  lecture: { listeners: "المستمعون", hall: "القاعة", students: "الطلبة", audience: "الحضور" },
  quran: { second: "الكاميرا الثانية", audience: "الحضور" },
  podcast: { guest: "الضيف", cohost: "مقدّم مشارك", audience: "الحضور" },
};
const curMode = () => (S().mode && MODES[S().mode]) ? S().mode : "lessons";
const inLessons = () => curMode() === "lessons";

// المشاهد الظاهرة في غرفة التحكّم بحسب القسم (مع تسمياتها)
function visibleScenes() {
  const m = curMode(), map = MODE_SCENES[m], cam2On = !!S().cam2.on;
  const order = map ? Object.keys(map) : null;
  return (ST.scenes || []).slice().sort((p, q) => order ? order.indexOf(p.key) - order.indexOf(q.key) : 0).filter(s => {
    if (map && !map[s.key]) return false;
    if (s.key === "break" && S().breakOn === false) return false;
    if ((s.key === "cam2" || s.key === "duo" || s.key === "duo2" || s.key === "galguest") && !cam2On) return false;
    if ((s.key === "duo2" || s.key === "gal" || s.key === "galguest") && curMode() !== "podcast") return false;
    if (/^q(bottom|side|top|frame)$/.test(s.key) && curMode() !== "quran") return false;
    if ((s.key === "cam3" || s.key === "trio") && !(curMode() === "podcast" && (S().cam3 || {}).on)) return false;
    return true;
  }).map(s => Object.assign({}, s, { label: (map && map[s.key]) || s.name }));
}

// ---------- أيقونات البطاقات ----------
const MODE_ART = {
  mosque: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6c0 4-3 5-3 8a3 3 0 0 0 6 0c0-3-3-4-3-8z"/><path d="M14 50V34a18 18 0 0 1 36 0v16"/><path d="M8 50h48"/><path d="M26 50V40a6 6 0 0 1 12 0v10"/><path d="M8 50V28M56 50V28"/><path d="M8 22v-4M56 22v-4"/></svg>',
  book: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 16c-6-4-14-4-22-2v34c8-2 16-2 22 2 6-4 14-4 22-2V14c-8-2-16-2-22 2z"/><path d="M32 16v34"/><path d="M16 24c4-1 8-1 11 0M16 32c4-1 8-1 11 0M37 24c4-1 8-1 11 0M37 32c4-1 8-1 11 0"/></svg>',
  reels: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="19" y="5" width="26" height="54" rx="5"/><path d="M26 11h12"/><path d="M28 24l12 8-12 8z" fill="currentColor" fill-opacity=".25"/><path d="M13 20v24M51 20v24" opacity=".5"/><circle cx="32" cy="51" r="1.6" fill="currentColor"/></svg>',
  mic: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="23" y="6" width="18" height="30" rx="9"/><path d="M14 30a18 18 0 0 0 36 0M32 48v10M23 58h18"/><path d="M28 16h8M28 22h8M28 28h8" opacity=".55"/></svg>',
  lab: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="12" width="48" height="30" rx="4"/><path d="M26 22l12 5-12 5z" fill="currentColor" fill-opacity=".3"/><path d="M8 50h48M14 56h10M30 56h8M44 56h6"/><path d="M20 50v-4M34 50v-4M46 50v-4"/></svg>',
  quran: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 18c-6-4-14-4-22-2v34c8-2 16-2 22 2 6-4 14-4 22-2V16c-8-2-16-2-22 2z"/><path d="M32 18v34"/><path d="M32 6l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L32 18.4l-5 2.8 1.2-5.6L24 11.8l5.6-.6z" fill="currentColor" fill-opacity=".3"/><path d="M16 28c4-1 8-1 11 0M16 36c4-1 8-1 11 0M37 28c3-1 7-1 11 0M37 36c3-1 7-1 11 0" opacity=".6"/></svg>',
  podium: '<svg viewBox="0 0 64 64" width="84" height="84" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="14" r="6"/><path d="M20 42c0-8 5-14 12-14s12 6 12 14"/><path d="M14 42h36v14H14z"/><path d="M24 49h16"/><rect x="26" y="4" width="12" height="3" rx="1.5" opacity=".0"/></svg>',
};

// ---------- شاشة الأقسام (أوّل ما يظهر) ----------
function openModes() {
  const box = $("modeHub"), last = curMode();
  box.innerHTML = `<div class="hub-in modes-in"><div class="hub-top"><img src="logo.png" class="hub-logo" alt="المجالس"><div class="grow"></div><button id="mdGeneral" class="mid gbtn"><span class="ic" data-i="gear"></span>الإعدادات العامة</button></div>
    <h1>ماذا تبثّ اليوم؟</h1><p class="hint">اختر القسم: لكل قسم بياناته ومشاهده وشعاراته الخاصّة.</p>
    <div class="mode-grid">${["khutba", "lessons", "lecture", "podcast", "quran", "lab"].map(k => `<button class="mcard${k === last ? " last" : ""}" data-m="${k}"><span class="mart">${MODE_ART[MODES[k].hero]}</span><b>${MODES[k].name}</b><small>${MODES[k].desc}</small>${k === last ? '<em>آخر قسم استعملته</em>' : ""}</button>`).join("")}<button class="mcard wide" id="mdReels"><span class="mart">${MODE_ART.reels}</span><span class="wtx"><b>الريلز</b><small>قسم مستقلّ: اقتطع مقاطع عموديّة قصيرة من تسجيل كاميرا الشيخ للنشر في وسائل التواصل</small></span></button></div></div>`;
  box.hidden = false;
  box.querySelectorAll(".mcard[data-m]").forEach(b => b.onclick = () => chooseMode(b.dataset.m));
  $("mdReels").onclick = () => openReels();
  if (typeof icons === "function") icons(box); $("mdGeneral").onclick = () => openGeneral();
}
// ---------- الخطب والمحاضرات المحفوظة ----------
const MODE_DEF = {
  khutba: { title: "خطبة الجمعة", topic: "", mosque: "", place: "", khatibTitle: "فضيلة الشيخ", khatib: "", start: "12:30", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
  lecture: { title: "", lecturerTitle: "", lecturer: "", org: "", place: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
  quran: { title: "معرض القرآن الكريم", lecturerTitle: "القارئ", lecturer: "", org: "", place: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
  podcast: { title: "", tagline: "", episode: "", topic: "", hostTitle: "المقدّم", host: "", guestTitle: "الضيف", guest: "", guestRole: "", third: "", thirdTitle: "", next: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null, guestImg: null, tpl: { id: "studio" }, music: { tracks: [], assign: { intro: "", break: "", outro: "" }, fx: { on: false, id: "", file: "", vol: 70 }, bed: { on: false, id: "", file: "", vol: 22, duck: true } } },
};
const MI_TXT = { khutba: { list: "الخطب المحفوظة", one: "خطبة", add: "خطبة جديدة", empty: "لا توجد خطب محفوظة بعد." }, lecture: { list: "المحاضرات المحفوظة", one: "محاضرة", add: "محاضرة جديدة", empty: "لا توجد محاضرات محفوظة بعد." }, podcast: { list: "حلقات البودكاست", one: "حلقة", add: "حلقة جديدة", empty: "لا توجد حلقات محفوظة بعد." }, quran: { list: "جلسات معرض القرآن", one: "جلسة", add: "جلسة جديدة", empty: "لا توجد جلسات محفوظة بعد." } };
const miList = m => ((S().modeItems || {})[m]) || [];
const miId = () => "mi_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const miName = (m, it) => (m === "podcast" ? [it.title, it.episode && "الحلقة " + it.episode, it.topic, it.guest] : m === "khutba" ? [it.title && it.title !== "خطبة الجمعة" ? it.title : "", it.topic, it.mosque, it.khatib] : [it.title, it.lecturer, it.org]).filter(Boolean).join(" · ") || ("بلا عنوان — " + MI_TXT[m].one);
const miSaveAll = (m, list) => patch({ modeItems: Object.assign({}, S().modeItems, { [m]: list }) });
function modeFields(m, cfg) {
  if (m === "podcast") return [{ k: "title", label: "اسم البودكاست", val: cfg.title, ph: "مثال: بودكاست أثير" }, { k: "tagline", label: "وصف قصير (اختياريّ)", val: cfg.tagline, ph: "حوارات تُلهم" },
    { k: "episode", label: "رقم الحلقة", val: cfg.episode, ph: "12" }, { k: "topic", label: "عنوان الحلقة", val: cfg.topic },
    { k: "host", label: "اسم المقدّم", val: cfg.host }, { k: "hostTitle", label: "صفة المقدّم", val: cfg.hostTitle },
    { k: "guest", label: "اسم الضيف", val: cfg.guest }, { k: "guestTitle", label: "صفة الضيف", val: cfg.guestTitle },
    { k: "guestRole", label: "تعريف الضيف (اختياريّ)", val: cfg.guestRole, ph: "كاتب وباحث" }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }];
  if (m === "quran") return [{ k: "title", label: "عنوان المعرض", val: cfg.title, ph: "معرض القرآن الكريم" }, { k: "lecturerTitle", label: "لقب القارئ", val: cfg.lecturerTitle, ph: "القارئ / الشيخ" }, { k: "lecturer", label: "اسم القارئ", val: cfg.lecturer },
    { k: "org", label: "الجهة (اختياريّ)", val: cfg.org }, { k: "place", label: "المكان", val: cfg.place }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }];
  return m === "khutba"
    ? [{ k: "mosque", label: "اسم المسجد", val: cfg.mosque, ph: "مثال: جامع الفرقان" }, { k: "place", label: "المكان", val: cfg.place, ph: "المدينة / الحيّ" },
      { k: "khatibTitle", label: "لقب الخطيب", val: cfg.khatibTitle }, { k: "khatib", label: "اسم الخطيب", val: cfg.khatib },
      { k: "title", label: "عنوان الخطبة", val: cfg.title, ph: "خطبة الجمعة" }, { k: "topic", label: "موضوع الخطبة (اختياريّ)", val: cfg.topic }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }]
    : [{ k: "title", label: "عنوان المحاضرة", val: cfg.title }, { k: "lecturerTitle", label: "لقب المحاضر", val: cfg.lecturerTitle, ph: "الدكتور / الأستاذ / الشيخ" }, { k: "lecturer", label: "اسم المحاضر", val: cfg.lecturer },
      { k: "org", label: "الجهة المنظِّمة", val: cfg.org }, { k: "place", label: "المكان", val: cfg.place }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }];
}
// يحفظ المفتوح حاليّاً في عنصره (وينشئ عنصراً من بيانات القسم القديمة إن لم توجد قائمة بعد)
async function miEnsure(m) {
  const cfg = S().modes[m] || {}, list = miList(m).slice();
  if (cfg.itemId && list.some(i => i.id === cfg.itemId)) { await miSaveAll(m, list.map(i => i.id === cfg.itemId ? Object.assign({}, cfg, { id: cfg.itemId }) : i)); return; }
  const filled = m === "podcast" ? (cfg.title || cfg.host || cfg.topic || cfg.guest) : m === "khutba" ? (cfg.mosque || cfg.khatib || cfg.topic) : (cfg.lecturer || cfg.title || cfg.org);
  if (filled) { const it = Object.assign({}, cfg, { id: miId() }); await patch({ modes: Object.assign({}, S().modes, { [m]: Object.assign({}, cfg, { itemId: it.id }) }) }); await miSaveAll(m, list.concat(it)); }
}
async function miEnter(m, it) {
  await miEnsure(m);
  await patch({ modes: Object.assign({}, S().modes, { [m]: Object.assign({}, it, { itemId: it.id }) }) });
  ST = await api.call("state:get"); applyModeUI();
  const box = $("modeList"); if (box) box.hidden = true; toast("جاهز: " + miName(m, it)); if (typeof renderPodcast === "function") renderPodcast();
}
async function miNew(m) {
  const f = await askForm(MI_TXT[m].add, modeFields(m, MODE_DEF[m]), "إنشاء وبدء"); if (!f) return;
  const it = Object.assign({}, MODE_DEF[m], f, { id: miId() });
  await miEnsure(m); await miSaveAll(m, miList(m).concat(it)); await miEnter(m, it);
}
async function openModeList(m) {
  await miEnsure(m);
  let box = $("modeList"); if (!box) { box = document.createElement("div"); box.id = "modeList"; box.style.cssText = "position:fixed;inset:0;z-index:61;background:radial-gradient(120% 90% at 50% 0%,#12302A 0%,var(--bg) 62%);overflow:auto"; document.body.appendChild(box); }
  const T = MI_TXT[m], cfg = S().modes[m] || {}, list = miList(m).slice().reverse();
  box.innerHTML = `<div class="hub-in"><div class="hub-top"><img src="logo.png" class="hub-logo" alt="المجالس"><div class="grow"></div>${cfg.itemId ? '<button id="miResume" class="mid">العودة لغرفة التحكّم</button>' : ""}<button id="miSections" class="mid">‹ الأقسام</button></div>
    <h1>${T.list}</h1><p class="hint">اختر للبثّ، أو عدّل، أو انسخ، أو احذف. كل عنصر يحفظ بياناته وشعاراته وشاشاته.</p>
    <div class="hub-grid">${list.map(it => `<div class="hcard${cfg.itemId === it.id ? " now" : ""}" data-id="${it.id}" tabindex="0"><b>${esc(miName(m, it))}</b><small>${[it.place, it.start && "الوقت " + it.start].filter(Boolean).map(esc).join(" · ") || "—"}</small>${cfg.itemId === it.id ? '<span class="tag">المفتوحة الآن</span>' : ""}<div class="cact"><button data-a="ed">✎ تعديل</button><button data-a="cp">⧉ نسخ</button><button data-a="dl" class="danger">🗑 حذف</button></div></div>`).join("")}
    <div class="hcard add" id="miNew" style="cursor:pointer"><span class="plus">＋</span><b>${T.add}</b></div></div>${list.length ? "" : `<p class="hint" style="margin-top:14px">${T.empty}</p>`}</div>`;
  box.hidden = false;
  const q = (s, fn) => { const e = box.querySelector(s); if (e) e.onclick = fn; };
  q("#miResume", () => { box.hidden = true; }); q("#miSections", () => { box.hidden = true; openModes(); }); q("#miNew", () => miNew(m));
  box.querySelectorAll(".hcard[data-id]").forEach(c => {
    const it = miList(m).find(x => x.id === c.dataset.id);
    c.onclick = e => { if (!e.target.closest(".cact")) miEnter(m, it); };
    c.querySelector('[data-a="ed"]').onclick = async e => {
      e.stopPropagation(); const f = await askForm("تعديل " + T.one, modeFields(m, it)); if (!f) return;
      const nu = Object.assign({}, it, f); await miSaveAll(m, miList(m).map(x => x.id === it.id ? nu : x));
      if ((S().modes[m] || {}).itemId === it.id) { await patch({ modes: Object.assign({}, S().modes, { [m]: Object.assign({}, S().modes[m], f) }) }); ST = await api.call("state:get"); applyModeUI(); }
      openModeList(m);
    };
    c.querySelector('[data-a="cp"]').onclick = async e => { e.stopPropagation(); const cp = Object.assign(JSON.parse(JSON.stringify(it)), { id: miId(), title: (it.title || "") + " (نسخة)" }); await miSaveAll(m, miList(m).concat(cp)); openModeList(m); toast("نُسخت"); };
    c.querySelector('[data-a="dl"]').onclick = async e => {
      e.stopPropagation(); if (!confirm("حذف «" + miName(m, it) + "»؟ لا يمكن التراجع.")) return;
      await miSaveAll(m, miList(m).filter(x => x.id !== it.id));
      if ((S().modes[m] || {}).itemId === it.id) { await patch({ modes: Object.assign({}, S().modes, { [m]: Object.assign({}, MODE_DEF[m]) }) }); ST = await api.call("state:get"); applyModeUI(); }
      openModeList(m);
    };
  });
  if (!list.length) miNew(m);
}
async function chooseMode(m) {
  if (m === "lab") { openLab(); return; }
  if (curMode() !== m || S().mode !== m) { await patch({ mode: m }); }
  if (m === "quran" && !(S().modes.quran || {}).qInit) {          // أوّل دخول: كاميرا واحدة (القارئ)، والثانية اختياريّة من «الأجهزة» أو تبويب المصحف
    await patch({ cam2: { on: false }, modes: Object.assign({}, S().modes, { quran: Object.assign({}, S().modes.quran, { qInit: true }) }) });
  }
  if (m === "podcast" && !(S().modes.podcast || {}).podInit) {
    await patch({ cam2: { on: true, target: "guest" }, duo: { mode: "side", big: "cam2" }, modes: Object.assign({}, S().modes, { podcast: Object.assign({}, S().modes.podcast, { podInit: true }) }) });
    toast("فُعّلت كاميرا الضيف — اختر جهازها من «الأجهزة»", 5000);
  }
  ST = await api.call("state:get");
  applyModeUI();
  $("modeHub").hidden = true;
  if (m === "lessons") { openHub("list"); return; }
  await openModeList(m);
}
// نافذة سريعة لبيانات الخطبة/المحاضرة عند الدخول
async function modeSetup(m) {
  const cfg = S().modes[m], date = m === "khutba" ? "التاريخ يُلتقط تلقائيّاً (يوم الجمعة وهجريّاً وميلاديّاً)" : "";
  const fields = m === "khutba"
    ? [{ k: "mosque", label: "اسم المسجد", val: cfg.mosque, ph: "مثال: جامع الفرقان" }, { k: "place", label: "المكان", val: cfg.place, ph: "المدينة / الحيّ" },
      { k: "khatibTitle", label: "لقب الخطيب", val: cfg.khatibTitle }, { k: "khatib", label: "اسم الخطيب", val: cfg.khatib },
      { k: "title", label: "عنوان الخطبة", val: cfg.title, ph: "خطبة الجمعة" }, { k: "topic", label: "موضوع الخطبة (اختياريّ)", val: cfg.topic }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }]
    : [{ k: "title", label: "عنوان المحاضرة", val: cfg.title }, { k: "lecturerTitle", label: "لقب المحاضر", val: cfg.lecturerTitle, ph: "الدكتور / الأستاذ / الشيخ" }, { k: "lecturer", label: "اسم المحاضر", val: cfg.lecturer },
      { k: "org", label: "الجهة المنظِّمة", val: cfg.org }, { k: "place", label: "المكان", val: cfg.place }, { k: "start", label: "وقت البداية", val: cfg.start, type: "time" }];
  const f = await askForm(m === "khutba" ? "بيانات الخطبة" : "بيانات المحاضرة", fields, "ابدأ");
  if (f) { await modeSave(f); toast(date || "حُفظت بيانات المحاضرة"); }
}
const modeSave = vals => patch({ modes: Object.assign({}, S().modes, { [curMode()]: Object.assign({}, S().modes[curMode()], vals) }) }).then(() => { renderCrumb(); const m = curMode(), c = S().modes[m]; if (c && c.itemId) miSaveAll(m, miList(m).map(i => i.id === c.itemId ? Object.assign({}, c, { id: c.itemId }) : i)); });

// تسميات الكاميرات في البودكاست: «المقدّم / الضيف» بدل «الشيخ / الحضور» (عناصر data-pod، بما فيها بطاقات الهاتف التي تُبنى لاحقاً)
function podLabels() {
  const m = curMode(), P = m === "podcast", Qr = m === "quran";
  const q = t => t.replace("كاميرا الضيف", "الكاميرا الثانية").replace("ككاميرا الضيف", "كالكاميرا الثانية").replace("الضيف", "الثانية").replace("المقدّم", "القارئ");
  document.querySelectorAll("[data-pod]").forEach(e => { if (!e.dataset.o) e.dataset.o = e.textContent; e.textContent = Qr ? q(e.dataset.pod) : P ? e.dataset.pod : e.dataset.o; });
}

// ---------- تهيئة الواجهة حسب القسم ----------
function applyModeUI() {
  try { podDock(); } catch {}
  const m = curMode(), L = m === "lessons";
  document.body.dataset.mode = m;
  const tabBtn = k => document.querySelector(`#tabs button[data-t="${k}"]`);
  const lib = tabBtn("lib"), les = tabBtn("lesson"), hal = tabBtn("halaqa");
  if (lib) lib.style.display = L ? "" : "none";
  const setTl = (b, t) => { const x = b && b.querySelector(".tl"); if (x) x.textContent = t; };
  setTl(les, "ضبط " + MODES[m].tab); setTl(hal, L ? "ضبط الحلقة" : m === "khutba" ? "ضبط المسجد" : m === "podcast" ? "ضبط البودكاست" : "ضبط الجهة");
  podLabels();
  try { if (typeof capSync === "function") capSync(); } catch {}
  { const Q = m === "quran", qt = tabBtn("quran"); if (qt) qt.style.display = Q ? "" : "none"; if (Q) { if (typeof renderQuran === "function") renderQuran(); } else if (document.querySelector("#tabs button.on") === qt && les) les.click(); }
  { const cb = $("cam3Box"); if (cb) cb.hidden = m !== "podcast"; }
  { const P = m === "podcast", pt = tabBtn("podcast"), dz = tabBtn("design"); if (pt) pt.style.display = P ? "" : "none"; if (dz) dz.style.display = P ? "none" : "";
    if (P && document.querySelector("#tabs button.on") === dz && pt) pt.click(); if (!P && document.querySelector("#tabs button.on") === pt && les) les.click(); }
  { const hf = $("hForm"); if (hf) { hf.style.display = L ? "" : "none"; const h2 = hf.previousElementSibling; if (h2) h2.style.display = L ? "" : "none"; } }
  if (!L && document.querySelector("#tabs button.on") === lib) { les && les.click(); }
  const bo = $("bookOnly"); if (bo) bo.closest("label").style.display = L ? "" : "none";
  const bb = $("bookbar"); if (bb) bb.style.display = L ? "" : "none";
  const h3 = document.querySelector("#t-lesson h3"); if (h3) h3.innerHTML = (L ? "بيانات الدرس" : m === "khutba" ? "بيانات الخطبة" : m === "podcast" ? "بيانات الحلقة" : m === "quran" ? "بيانات المعرض" : "بيانات المحاضرة") + " <small>تظهر في البثّ فوراً</small>";
  renderScenes(); renderTexts(); renderCrumb(); renderCam2(); renderScreens(); renderLogos();
  if (typeof setScene === "function") setScene(ST.program);
}

// ---------- نموذج الخطبة/المحاضرة في تبويب «الدرس» ----------
function renderModeForm() {
  const m = curMode(), cfg = S().modes[m], f = $("textForm"); f.innerHTML = "";
  const group = (title, fields, open = true) => {
    const d = document.createElement("details"); d.className = "acc"; if (open) d.open = true;
    d.innerHTML = `<summary><span>${title}</span><span class="sum"></span></summary><div class="in"></div>`;
    fields.forEach(([k, label, ph, full, type]) => {
      const l = document.createElement("label"); if (full) l.className = "full"; l.textContent = label;
      const inp = document.createElement("input"); inp.value = cfg[k] || ""; inp.placeholder = ph || ""; if (type) inp.type = type;
      let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => modeSave({ [k]: inp.value }), 250); };
      l.appendChild(inp); d.querySelector(".in").appendChild(l);
    });
    f.appendChild(d); return d;
  };
  if (m === "podcast") {
    group("البودكاست", [["title", "الاسم", "مثال: بودكاست أثير", 1], ["tagline", "وصف قصير", "حوارات تُلهم", 1]]);
    group("الحلقة", [["episode", "رقم الحلقة", "12"], ["topic", "عنوان الحلقة", "", 1]]);
    group("المقدّم", [["host", "الاسم", "اسم المقدّم"], ["hostTitle", "الصفة", "المقدّم"]]);
    group("الضيف", [["guest", "الاسم", "اسم الضيف"], ["guestTitle", "الصفة", "الضيف"], ["guestRole", "تعريف الضيف (اختياريّ)", "كاتب وباحث", 1]]);
    group("الكاميرا الثالثة (اختياريّ)", [["third", "الاسم", "اسم صاحب الكاميرا الثالثة"], ["thirdTitle", "الصفة", ""]], false);
    group("الختام", [["next", "جملة الختام", "موعدنا في الحلقة القادمة", 1]], false);
  } else if (m === "khutba") {
    group("الخطيب", [["khatibTitle", "اللقب", "فضيلة الشيخ"], ["khatib", "الاسم", "اسم الخطيب"]]);
    group("المسجد والمكان", [["mosque", "اسم المسجد", "مثال: جامع الفرقان", 1], ["place", "المكان", "المدينة / الحيّ", 1]]);
    group("الخطبة", [["title", "العنوان", "خطبة الجمعة", 1], ["topic", "الموضوع (اختياريّ)", "موضوع الخطبة", 1]]);
  } else if (m === "quran") {
    group("القارئ", [["lecturerTitle", "اللقب", "القارئ / الشيخ"], ["lecturer", "الاسم", "اسم القارئ"]]);
    group("المعرض", [["title", "العنوان", "معرض القرآن الكريم", 1], ["org", "الجهة (اختياريّ)", "", 1], ["place", "المكان", "", 1]]);
  } else {
    group("المحاضر", [["lecturerTitle", "اللقب", "الدكتور / الأستاذ"], ["lecturer", "الاسم", "اسم المحاضر"]]);
    group("المحاضرة", [["title", "العنوان", "عنوان المحاضرة", 1], ["org", "الجهة المنظِّمة", "", 1], ["place", "المكان", "", 1]]);
  }
  group("الوقت", [["start", "وقت البداية", "", 0, "time"]], true);
  // التاريخ: تلقائيّ أو يدويّ
  const d = document.createElement("details"); d.className = "acc"; d.open = true;
  d.innerHTML = `<summary><span>التاريخ</span><span class="sum"></span></summary><div class="in"></div>`;
  const inn = d.querySelector(".in");
  inn.appendChild(tsSwitch("التقاط التاريخ تلقائيّاً (يوم وهجريّ وميلاديّ)", cfg.dateAuto !== false, on => modeSave({ dateAuto: on }).then(renderModeForm)));
  if (cfg.dateAuto === false) { const l = document.createElement("label"); l.className = "full"; l.textContent = "التاريخ يدويّاً"; const inp = document.createElement("input"); inp.value = cfg.dateText || ""; let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => modeSave({ dateText: inp.value }), 250); }; l.appendChild(inp); inn.appendChild(l); }
  f.appendChild(d);
}

function initModes() { applyModeUI(); openModes(); }
