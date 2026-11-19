// يبني مجموعة مشاهد المحرّك (OBS) من اختيارات المستخدم: جهة الكاميرا، شكل الإطار، الجودة، الأجهزة.
// الطبقات صفحات HTML يخدمها «منبر» محلّيّاً؛ الألوان والنصوص تتغيّر لحظيّاً بدون إعادة بناء.
// كل الإحداثيّات مكتوبة بمقاس 1080p، وتتضاعف ×K في 4K (الطبقات تُكبَّر بـ zoom فتبقى حادّة).
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { maskFile } = require("./masks");
// القناع الجاهز (للأشكال والمقاسات القديمة) أو يُولَّد بأيّ مقاس وشكل
const MASKDIR = { v: null };
const maskFor = (assets, shape, w, h) => { const pre = path.join(assets, "masks", `${shape}-${Math.round(w)}x${Math.round(h)}.png`); return fs.existsSync(pre) ? pre : maskFile(MASKDIR.v || path.join(assets, "masks"), shape, w, h); };

const BW = 1920, BH = 1080;
// الأبعاد الأساسيّة والشيخ على اليمين؛ «يسار» = انعكاس أفقيّ
const BASE = {
  card: { book: [64, 128, 1188, 784], cam: [1280, 128, 576, 784] },
  page: { page: [56, 40, 714, 1000] },                     // الصفحة يسار والشيخ يمين
  open: { book: [340, 100, 1240, 880], cam: [1636, 716, 228, 300] },
};
const mirror = ([x, y, w, h]) => [BW - x - w, y, w, h];
function layout(side) {
  const m = side === "left" ? mirror : r => r;
  return {
    card: { book: m(BASE.card.book), cam: m(BASE.card.cam) },
    // صفحة + الشيخ: الكلام عربيّ يبدأ من اليمين، فالشيخ يمين والصفحة يسار (ينعكس لو اختار «الشيخ يسار» في الكتاب+الشيخ؟ لا — ثابت)
    // صفحة + الشيخ: «الشيخ يمين» = الصفحة يسار، و«يسار» = الصفحة يمين
    page: { page: side === "left" ? mirror(BASE.page.page) : BASE.page.page },
    open: { book: BASE.open.book, cam: m(BASE.open.cam) },
  };
}
// أين يقع وجه الشيخ في المخرج (نسبةً للإطار)
const AT = { sheikh: [.5, .40], card: [.5, .42], open: [.5, .40], cam2: [.5, .5] };
// «الشيخ + الحضور»: مستطيلات الإطارين (1080p). mode: overlap = متداخلان | inset = الصغير داخل الكبير | side = متجاوران
// big = من هو الكبير (sheikh|cam2)، side = جهة الكبير (right|left)، small = مقياس الصغير (0٫5–1٫3)
function duoLayout(d) {
  const sc = Math.min(1.3, Math.max(.5, Number(d.small) || 1)), right = d.side !== "left";
  let big, small;
  if (d.mode === "side") { big = [990, 140, 840, 800]; small = [90, 140, 840, 800]; if (!right) { big = mirror(big); small = mirror(small); } }
  else if (d.mode === "inset") {
    big = [360, 110, 1200, 860]; const w = Math.round(420 * sc), h = Math.round(w * .75);
    small = [right ? big[0] + big[2] - w - 36 : big[0] + 36, big[1] + big[3] - h - 36, w, h];
  } else {
    big = [810, 110, 1040, 800]; const w = Math.round(640 * sc), h = Math.round(w * .72);
    small = [big[0] - w + 200, Math.min(1080 - h - 20, big[1] + big[3] - h + 50), w, h];
    if (!right) { big = mirror(big); small = mirror(small); }
  }
  return { big, small };
}
const atPage = side => [side === "left" ? .32 : .68, .40];

const SCENES = [
  { key: "intro", name: "قبل البث", icon: "clock" },
  { key: "sheikh", name: "الشيخ", icon: "person" },
  { key: "card", name: "الكتاب + الشيخ", icon: "bookperson" },
  { key: "page", name: "صفحة + الشيخ", icon: "pageperson" },
  { key: "open", name: "الكتاب مفتوح", icon: "book" },
  { key: "lines", name: "سطور الكتاب", icon: "lines" },          // سطران أو ثلاثة من الصفحة الحاليّة أمام الشيخ أو بجانبه
  { key: "break", name: "استراحة", icon: "cup" },
  { key: "outro", name: "الختام", icon: "end" },
  { key: "cam2", name: "كاميرا الحضور", icon: "cam2" },
  { key: "cam3", name: "كاميرا ثالثة", icon: "cam2" },                 // البودكاست فقط: كاميرا ثالثة اختياريّة بملء الشاشة
  { key: "trio", name: "ثلاثي", icon: "duo" },                          // البودكاست فقط: المقدّم والضيف والثالثة معاً
  { key: "duo2", name: "ثنائي", icon: "duo2" },                          // البودكاست فقط: شاشة نصفان متجاورتان (المقدّم | الضيف)
  { key: "gal", name: "معرض الصور", icon: "gal" },                       // البودكاست فقط: صورة تتقدّم بموسيقى هادئة
  { key: "galguest", name: "معرض + الضيف", icon: "galguest" },           // البودكاست فقط: معرض الصور بجانب كاميرا الضيف
  { key: "qbottom", name: "آية أسفل الشاشة", icon: "qbottom" },          // معرض القرآن: القارئ بملء الشاشة والآية في شريط أسفل
  { key: "qside", name: "آية بجانب القارئ", icon: "qside" },              // القارئ في إطار والآية بجانبه
  { key: "qtop", name: "آية أعلى الشاشة", icon: "qtop" },                 // الآية في شريط أعلى
  { key: "qframe", name: "آية في إطار", icon: "qframe" },                 // الآية داخل إطار زخرفيّ بجانب القارئ
  { key: "duo", name: "الشيخ + الحضور", icon: "duo" },            // ثانويّة مثل «كاميرا الحضور»: إطاران قابلان للتخصيص          // ثانويّة: تظهر في الواجهة فقط لو فُعّلت
];
const TRANSITIONS = {
  soft: { name: "ناعم", id: "fade_transition", ms: 800, settings: () => ({}) },
  wipe: { name: "مسح", id: "wipe_transition", ms: 1100, settings: () => ({ luma_image: "linear-h.png", luma_invert: true, luma_softness: 0.7 }) },
  color: { name: "عبر لون الهويّة", id: "fade_to_color_transition", ms: 800, settings: t => ({ color: obsColor(t.deep), switch_point: 50 }) },
  cut: { name: "قطع مباشر", id: "cut_transition", ms: 0, settings: () => ({}) },
  // انتقالات إضافيّة (كلها مدمجة في المحرّك). ms = المدّة
  slide:   { name: "انزلاق", id: "slide_transition", ms: 700, settings: () => ({ direction: "right" }) },
  slideup: { name: "انزلاق للأعلى", id: "slide_transition", ms: 750, settings: () => ({ direction: "up" }) },
  swipe:   { name: "سحب", id: "swipe_transition", ms: 800, settings: () => ({ direction: "left", swipe_in: false }) },
  iris:    { name: "قزحيّة", id: "wipe_transition", ms: 1100, settings: () => ({ luma_image: "iris.png", luma_invert: false, luma_softness: 0.45 }) },
  curtain: { name: "ستارة", id: "wipe_transition", ms: 1200, settings: () => ({ luma_image: "curtain.png", luma_invert: false, luma_softness: 0.4 }) },
  barn:    { name: "بابان", id: "wipe_transition", ms: 1000, settings: () => ({ luma_image: "barndoor-h.png", luma_invert: false, luma_softness: 0.35 }) },
  blinds:  { name: "شفرات", id: "wipe_transition", ms: 1000, settings: () => ({ luma_image: "blinds-h.png", luma_invert: false, luma_softness: 0.3 }) },
  clock:   { name: "عقارب", id: "wipe_transition", ms: 1200, settings: () => ({ luma_image: "clock.png", luma_invert: false, luma_softness: 0.35 }) },
  cloud:   { name: "سحاب", id: "wipe_transition", ms: 1400, settings: () => ({ luma_image: "cloud.png", luma_invert: false, luma_softness: 0.75 }) },
  water:   { name: "ألوان مائيّة", id: "wipe_transition", ms: 1500, settings: () => ({ luma_image: "watercolor.png", luma_invert: false, luma_softness: 0.7 }) },
  dipblack:{ name: "عبر الأسود", id: "fade_to_color_transition", ms: 900, settings: () => ({ color: obsColor("#000000"), switch_point: 50 }) },
  flash:   { name: "وميض أبيض", id: "fade_to_color_transition", ms: 520, settings: () => ({ color: obsColor("#FFFFFF"), switch_point: 45 }) },
};
const obsColor = hex => parseInt(hex.slice(1).match(/../g).reverse().join(""), 16) + 0xFF000000;

const uid = () => crypto.randomUUID();
const qs = o => "?" + Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : v)}`).join("&");
function source(name, id, settings, extra = {}) {
  return Object.assign({ prev_ver: 553648129, name, uuid: uid(), id, versioned_id: id, settings, mixers: 0, sync: 0, flags: 0, volume: 1.0, balance: 0.5,
    enabled: true, muted: false, "push-to-mute": false, "push-to-mute-delay": 0, "push-to-talk": false, "push-to-talk-delay": 0, hotkeys: {},
    deinterlace_mode: 0, deinterlace_field_order: 0, monitoring_type: 0, private_settings: {}, filters: [] }, extra);
}
const filt = (name, id, settings) => { const f = source(name, id, settings); delete f.filters; return f; };

const isMac = process.platform === "darwin";
const CAM_ID = isMac ? "macos-avcapture" : "dshow_input";
const MIC_ID = isMac ? "coreaudio_input_capture" : "wasapi_input_capture";
const voiceChain = () => [
  filt("تنقية الضوضاء", "noise_suppress_filter_v2", { method: "rnnoise", suppress_level: -30 }),
  filt("تسوية الصوت", "compressor_filter", { ratio: 4.0, threshold: -20.0, attack_time: 6, release_time: 80, output_gain: 4.0, sidechain_source: "none" }),
  filt("محدّد", "limiter_filter", { threshold: -2.0, release_time: 60 }),
];

// صيغ الالتقاط في محرّك البثّ (DirectShow): MJPEG 400 | NV12 201 | YUY2 301 | XRGB 101
const VFMT = { mjpeg: 400, nv12: 201, yuy2: 301, xrgb: 101 };
/** إعدادات مصدر الكاميرا بحسب «جودة الكاميرا»: تلقائيّ = افتراضيّ الجهاز، وإلّا دقّة مخصّصة وإطارات وصيغة محدّدة (للكاميرات الرقميّة وبطاقات الالتقاط) */
function camQuality(q) {
  q = q || {};
  if (!q.res || q.res === "auto" || !/^\d{3,4}x\d{3,4}$/.test(q.res)) return { res_type: 0, frame_interval: -1, video_format: 0 };
  // القيم الافتراضيّة تُكتب صراحةً (-1 / 0) لأنّ تحديث الإعدادات دمجٌ فلا تُمحى القيمة السابقة وحدها
  return { res_type: 1, resolution: q.res, frame_interval: q.fps > 0 ? Math.round(1e7 / q.fps) : -1, video_format: VFMT[q.fmt] || 0 };
}
/** @param o.base رابط الخادم المحلّي  @param o.assets مجلّد assets  @param o.s الإعدادات */
function build({ base, assets, maskDir, s }) {
  MASKDIR.v = maskDir;
  const K = s.quality === "4k" ? 2 : 1, W = BW * K, H = BH * K;
  // البودكاست: شكل إطار الكاميرات يتبع قالبه (قناع القصّ في المحرّك)
  const podTpl = s.mode === "podcast" && s.modes && s.modes.podcast && s.modes.podcast.tpl;
  const side = s.design.camSide || "left", shape = podTpl ? require("../overlays/podkit.js").shapeOf(podTpl) : (s.design.frame || "arch");
  const L = layout(side);
  const k = r => r.map(v => v * K);
  const camSettings = (dev, idle = false) => isMac
    ? Object.assign({ use_preset: true, preset: K === 2 ? "AVCaptureSessionPreset3840x2160" : "AVCaptureSessionPreset1920x1080" }, dev ? { device: dev.id, device_name: dev.name } : {})
    : Object.assign({ deactivate_when_not_showing: idle }, camQuality(s.camQ), dev ? { video_device_id: dev.id } : {});

  class Scene {
    constructor(name) { this.name = name; this.items = []; this.n = 0; this.src = source(name, "scene", { id_counter: 0, custom_size: false, items: [] }); }
    add(src, x = 0, y = 0, { scale = 1, visible = true, crop = [0, 0, 0, 0], locked = true, filter = "disable" } = {}) {
      this.n++; x *= K; y *= K;
      const it = { name: src.name, source_uuid: src.uuid, visible, locked, rot: 0.0, scale_ref: { x: W, y: H }, align: 5,
        bounds_type: 0, bounds_align: 0, bounds_crop: false, crop_left: crop[0], crop_top: crop[1], crop_right: crop[2], crop_bottom: crop[3],
        id: this.n, group_item_backup: false, pos: { x, y }, pos_rel: { x: (2 * x - W) / H, y: 2 * y / H - 1 },
        scale: { x: scale, y: scale }, scale_rel: { x: scale, y: scale }, bounds: { x: 0, y: 0 }, bounds_rel: { x: 0, y: 0 },
        scale_filter: filter, blend_method: "default", blend_type: "normal", show_transition: { duration: 0 }, hide_transition: { duration: 0 }, private_settings: {} };
      this.items.push(it); this.src.settings.items = this.items; this.src.settings.id_counter = this.n;
      return it;
    }
  }
  const ov = (page, params) => `${base}/ov/${page}${qs(Object.assign(K > 1 ? { z: K } : {}, params))}`;
  const S = [], reg = x => (S.push(x), x);
  // audio = الصفحة تُشغّل صوتاً (موسيقى الشاشات): يُوجَّه صوتها لمازج المحرّك، وتُعاد تحميلها عند ظهور المشهد ليبدأ الصوت من أوّله
  const browser = (name, page, w, h, params = {}, restart = false, audio = false) => reg(source(name, "browser_source", {
    is_local_file: false, url: ov(page, params), width: w * K, height: h * K, css: "", fps_custom: true, fps: 30,
    reroute_audio: !!audio, restart_when_active: !!audio, shutdown: false }, audio ? { mixers: 255 } : {}));

  // هاتف «المجالس» (تطبيق الكاميرا): مصدر متصفّح يستقبل بثّ الهاتف، وحجمه = آخر حجم وصل من الهاتف ليعمل معه القصّ والتأطير كأيّ كاميرا
  const isPhone = d => !!(d && d.phone);
  const phoneSrc = (name, role) => {
    const sz = (s.phone && s.phone.size && s.phone.size[role]) || [1080, 1920];
    return reg(source(name, "browser_source", { is_local_file: false, url: `${base}/ov/phone.html?role=${role}`, width: sz[0], height: sz[1], css: "",
      fps_custom: true, fps: 30, reroute_audio: false, restart_when_active: false, shutdown: false }));
  };
  const camS = isPhone(s.devices.camSheikh) ? phoneSrc("كاميرا الشيخ", "sheikh") : reg(source("كاميرا الشيخ", CAM_ID, camSettings(s.devices.camSheikh)));
  const cinemaFilter = () => filt("سينما", "color_filter_v2", { brightness: 0, contrast: 0, saturation: 0, gamma: 0, hue_shift: 0, opacity: 1, color_multiply: 0xFFFFFFFF, color_add: 0 });
  camS.filters = [cinemaFilter()];
  reg(source("مسح الأجهزة", CAM_ID, camSettings(null)));       // مصدر خارج المشاهد لسرد الكاميرات المتّصلة (يعمل حتى لو كانت كاميرا الشيخ هاتفاً)
  // كاميرا الحضور: جهاز مستقلّ عن كاميرا الشيخ (جهاز مكرّر يُهمل). لو مطفأة تُحرَّر الكاميرا (deactivate_when_not_showing)
  const d2 = s.devices.cam2, taken = [s.devices.camSheikh].filter(Boolean).map(x => x.id);
  const cam2 = s.cam2 || { on: false };
  const camT = d2 && d2.id && !taken.includes(d2.id) ? (isPhone(d2) ? phoneSrc("مصدر كاميرا الحضور", "audience") : reg(source("مصدر كاميرا الحضور", CAM_ID, camSettings(d2, !cam2.on)))) : null;
  if (camT) camT.filters = [cinemaFilter()];
  // الكاميرا الثالثة (البودكاست فقط): جهاز مستقلّ عن كاميرتَي المقدّم والضيف. مطفأة = تُحرَّر الكاميرا
  const isPod = s.mode === "podcast", c3 = s.cam3 || { on: false }, d3 = s.devices.cam3, taken3 = [s.devices.camSheikh, s.devices.cam2].filter(Boolean).map(x => x.id);
  const camU = isPod && d3 && d3.id && !taken3.includes(d3.id) ? reg(source("مصدر كاميرا ثالثة", CAM_ID, camSettings(d3, !c3.on))) : null;
  if (camU) camU.filters = [cinemaFilter()];
  const bg = browser("خلفية", "bg.html", BW, BH);
  const bk = {
    card: browser("الكتاب · بطاقة", "book.html", L.card.book[2], L.card.book[3], { mode: "card", w: L.card.book[2], h: L.card.book[3] }),
    page: browser("الكتاب · صفحة", "book.html", L.page.page[2], L.page.page[3], { mode: "page", w: L.page.page[2], h: L.page.page[3] }),
    open: browser("الكتاب · مفتوح", "book.html", L.open.book[2], L.open.book[3], { mode: "open", w: L.open.book[2], h: L.open.book[3] }),
  };
  // «سطور الكتاب»: شريط ورقيّ بسطرين/ثلاثة من الصفحة. أمام الشيخ (أسفل الشاشة) أو بجانبه (يمين/يسار الشيخ)؛ يُبدَّل بينهما لحظيّاً دون إعادة بناء
  const SB = [L.card.book[0], L.card.book[1] + Math.round((L.card.book[3] - 440) / 2), L.card.book[2], 440];
  const strip = {
    front: browser("الكتاب · سطور (أمام)", "book.html", BW, 440, { mode: "strip", w: BW, h: 440, place: "front" }),
    side: browser("الكتاب · سطور (بجانب)", "book.html", SB[2], SB[3], { mode: "strip", w: SB[2], h: SB[3], place: "side" }),
  };
  const fr = {
    lift: browser("إطار · لقب الشيخ فوق السطور", "frame.html", BW, BH, { l: "sheikh", lift: 440, side }, true),
    side: browser("إطار · سطور + الشيخ", "frame.html", BW, BH, { l: "card", book: SB, cam: L.card.cam, side }, true),
    card: browser("إطار · الكتاب + الشيخ", "frame.html", BW, BH, { l: "card", book: L.card.book, cam: L.card.cam, side }, true),
    page: browser("إطار · صفحة + الشيخ", "frame.html", BW, BH, { l: "page", page: L.page.page, side }, true),
    open: browser("إطار · الكتاب مفتوح", "frame.html", BW, BH, { l: "open", cam: L.open.cam, side }, true),
    sheikh: browser("إطار · الشيخ", "frame.html", BW, BH, { l: "sheikh", side }, true),
    cam2: browser("إطار · كاميرا الحضور", "frame.html", BW, BH, { l: "cam2", side }, true),
    cam3: browser("إطار · كاميرا ثالثة", "frame.html", BW, BH, { l: "cam3", side }, true),
  };
  const cinB = browser("سينما", "cinema.html", BW, BH, { bars: 1 });                    // شريطان + تعتيم أطراف + حبيبات (مشهدا الشيخ والحضور)
  const cinN = browser("سينما · بلا شريطين", "cinema.html", BW, BH, { bars: 0 });          // نفس الأجواء بلا شريطين (مشهد الثنائيّ)
  const capS = browser("الترجمة", "captions.html", BW, BH);      // شريط الترجمة الحيّة (يظهر فوق مشاهد الفيديو فقط)
  const scr = {};
  for (const key of ["intro", "break", "outro"]) scr[key] = browser(`شاشة · ${SCENES.find(x => x.key === key).name}`, "screen.html", BW, BH, { kind: key }, true, true);

  // مواضع الكاميرا التي يقصّها البرنامج بعد التشغيل حسب مقاسها الحقيقيّ (box بمقاس المخرج الفعليّ)
  const camItems = [];
  const camAt = (scene, src, box, at, who, fit = false) => { const kb = k(box); scene.add(src, box[0], box[1], { scale: kb[2] / 1920 }); camItems.push({ scene: scene.name, source: src.name, box: kb, at, who, fit }); };

  const nested = [];
  const shaped = (name, box, at) => {
    const sc = new Scene(name); nested.push(sc);
    sc.add(bg); camAt(sc, camS, [0, 0, box[2], box[3]], at, "sheikh");
    sc.src.filters = [
      filt("قصّ", "crop_filter", { relative: false, left: 0, top: 0, cx: box[2] * K, cy: box[3] * K }),
      filt("شكل الإطار", "mask_filter_v2", { type: "mask_alpha_filter.effect", image_path: maskFor(assets, shape, box[2], box[3]), color: 16777215, opacity: 1.0, stretch: true }),
    ];
    return sc;
  };
  // التغبيش (OBS ما فيه فلتر تغبيش أصليّ): تصغير متدرّج بمتوسّط حقيقيّ (area) ثمّ تكبير متدرّج ناعم،
  // والنتيجة مقنّعة بتدرّج من الأسفل فتغبّش منطقة الاسم فقط
  const blurred = (key, src, at, who, mask = "blur-bottom.png", fit = false, center = false) => {
    const st = [[BW / 8, BH / 8], [BW / 16, BH / 16]];             // 240×135 ← 120×67.5
    const a = new Scene(`◂ تغبيش ${key} 1`); nested.push(a);
    { const kb = [0, 0, st[0][0] * K, st[0][1] * K]; a.add(src, 0, 0, { scale: st[0][0] / 1920, filter: "area" }); camItems.push({ scene: a.name, source: src.name, box: kb, at, who, fit, center }); }
    const crop = (w, h) => [0, 0, Math.round(W - w * K), Math.round(H - h * K)];
    const b = new Scene(`◂ تغبيش ${key} 2`); nested.push(b);
    b.add(a.src, 0, 0, { scale: .5, crop: crop(...st[0]), filter: "area" });
    const c = new Scene(`◂ تغبيش ${key} 3`); nested.push(c);
    c.add(b.src, 0, 0, { scale: 4, crop: crop(...st[1]), filter: "bilinear" });         // ← 480×270
    const soft = new Scene(`◂ تغبيش ${key}`); nested.push(soft);
    soft.add(c.src, 0, 0, { scale: 4, crop: crop(BW / 4, BH / 4), filter: "bicubic" });  // ← 1920×1080
    // mask = null: تغبيش كامل (خلفيّة الصورة العموديّة) مع تعتيم خفيف؛ وإلّا تدرّج التغبيش من الأسفل
    soft.src.filters = mask ? [filt("تدرّج التغبيش", "mask_filter_v2", { type: "mask_alpha_filter.effect", image_path: path.join(assets, "masks", mask), color: 16777215, opacity: 1.0, stretch: true })]
      : [filt("تعتيم الخلفيّة", "color_filter_v2", { brightness: -0.04, saturation: 0.0, contrast: 0.0, gamma: 0.0, hue_shift: 0.0 })];
    return soft;
  };
  const camBig = shaped("◂ الشيخ · إطار كبير", L.card.cam, AT.card);
  const camSm = shaped("◂ الشيخ · إطار صغير", L.open.cam, AT.open);
  const blurS = blurred("الشيخ", camS, AT.sheikh, "sheikh");
  // «الهاتف العموديّ»: الصورة العموديّة كاملة في الوسط (contain) فوق نسخة مغبَّشة منها تملأ الشاشة الأفقيّة (portrait → landscape)
  const blurFill = blurred("عمودي", camS, [.5, .5], "sheikh", null, false, true);
  const portrait = new Scene("◂ الشيخ · عمودي"); nested.push(portrait);
  portrait.add(camS, 0, 0, { scale: 1 }); camItems.push({ scene: portrait.name, source: camS.name, box: k([0, 0, BW, BH]), at: [.5, .5], who: "sheikh", mode: "contain" });
  const blurP = blurred("الصفحة", camS, atPage(side), "sheikh", side === "left" ? "blur-bottom-left.png" : "blur-bottom.png", true);
  const blurT = camT ? blurred("كاميرا الحضور", camT, AT.cam2, "cam2") : null;

  // ---- «الشيخ + الحضور»
  const duo = Object.assign({ mode: "overlap", big: "sheikh", side: "right", small: 1 }, s.duo || {});
  const DL = duoLayout(duo);
  const bigWho = duo.big === "cam2" ? "cam2" : "sheikh", smallWho = bigWho === "sheikh" ? "cam2" : "sheikh";
  const duoCam = (name, box, who) => {
    const src = who === "cam3" ? camU : who === "cam2" ? camT : camS; if (!src) return null;
    const sc = new Scene(name); nested.push(sc);
    sc.add(bg); camAt(sc, src, [0, 0, box[2], box[3]], who === "cam2" || who === "cam3" ? AT.cam2 : AT.card, who);
    sc.src.filters = [
      filt("قصّ", "crop_filter", { relative: false, left: 0, top: 0, cx: box[2] * K, cy: box[3] * K }),
      filt("شكل الإطار", "mask_filter_v2", { type: "mask_alpha_filter.effect", image_path: maskFor(assets, shape, box[2], box[3]), color: 16777215, opacity: 1.0, stretch: true }),
    ];
    return sc;
  };
  const duoBig = duoCam("◂ ثنائي · الكبير", DL.big, bigWho), duoSmall = duoCam("◂ ثنائي · الصغير", DL.small, smallWho);
  // ثلاثي (البودكاست): ثلاثة إطارات متساوية — المقدّم يميناً ثمّ الضيف ثمّ الثالثة
  const TRIO = isPod ? [["sheikh", [1290, 200, 570, 700]], ["cam2", [675, 200, 570, 700]], ["cam3", [60, 200, 570, 700]]].map(([who, box], i) => ({ who, box, sc: duoCam("◂ ثلاثي · " + who, box, who), fr: browser("إطار · ثلاثي " + (i + 1), "duo.html", BW, BH, { who, box, big: i === 1 ? 1 : null }, true) })) : [];
  // ثنائي بنصفين: قصّ فقط بلا قناع؛ الضيف يساراً والمقدّم يميناً
  const halfCam = (name, box, who) => {
    const src = who === "cam2" ? camT : camS; if (!src) return null;
    const sc = new Scene(name); nested.push(sc);
    sc.add(bg); camAt(sc, src, [0, 0, box[2], box[3]], who === "cam2" ? AT.cam2 : AT.card, who);
    sc.src.filters = [filt("قصّ", "crop_filter", { relative: false, left: 0, top: 0, cx: box[2] * K, cy: box[3] * K })];
    return sc;
  };
  const HALF = isPod ? [["cam2", [0, 0, 960, 1080]], ["sheikh", [960, 0, 960, 1080]]].map(([who, box], i) => ({ who, box, sc: halfCam("◂ ثنائي نصفان · " + who, box, who), fr: browser("إطار · نصف " + (i + 1), "duo.html", BW, BH, { who, box, half: 1, big: i === 0 ? 1 : null }, true) })) : [];
  // معرض الصور: كامل الشاشة، أو لوحة بجانب إطار الضيف. المصدر يُعاد تحميله عند كل ظهور فيبدأ من الصورة الأولى وبموسيقاه
  const GP = [720, 120, 1140, 780], GG = [60, 200, 600, 700];
  const galFull = isPod ? browser("معرض الصور", "gallery.html", BW, BH, { mode: "full" }, false, true) : null;
  const galPanel = isPod ? browser("معرض الصور · لوحة", "gallery.html", BW, BH, { mode: "panel", box: GP.join(",") }, false, true) : null;
  const galGuest = isPod ? duoCam("◂ معرض · الضيف", GG, "cam2") : null;
  const galGuestFr = isPod ? browser("إطار · معرض + الضيف", "duo.html", BW, BH, { who: "cam2", box: GG, big: 1 }, true) : null;
  // معرض القرآن الكريم: أربعة مشاهد للآيات (أسفل / بجانب / أعلى / في إطار). الآية تُرسَم في طبقة quran.html من نصّ المصحف العثماني
  const isQ = s.mode === "quran", QC = side === "left" ? [70, 140, 680, 800] : [1170, 140, 680, 800], QV = side === "left" ? [830, 140, 1020, 800] : [70, 140, 1020, 800];
  // الكاميرا الافتراضيّة هي كاميرا القارئ؛ ولو فُعّلت كاميرا ثانية يمكن اختيارها لمشاهد الآيات (quran.cam = "cam2")
  const qWho = isQ && camT && (s.quran || {}).cam === "cam2" && cam2.on ? "cam2" : "sheikh";
  const qCam = isQ ? duoCam("◂ قارئ · جانب", QC, qWho) : null;
  const qFr = isQ ? browser("إطار · قارئ جانب", "duo.html", BW, BH, { who: qWho, box: QC, big: 1 }, true) : null;
  const qLayer = p => isQ ? browser("آيات · " + p, "quran.html", BW, BH, { pos: p, box: QV.join(",") }) : null;
  const qB = qLayer("bottom"), qT = qLayer("top"), qS = qLayer("side"), qF = qLayer("frame");
  const qLift = isQ ? browser("إطار · لقب القارئ فوق الآيات", "frame.html", BW, BH, { l: qWho === "cam2" ? "cam2" : "sheikh", lift: 360, side }, true) : null;
  const qTop = isQ ? (qWho === "cam2" ? fr.cam2 : fr.sheikh) : null;
  const frBig = browser("إطار · ثنائي 1", "duo.html", BW, BH, { who: bigWho, box: DL.big, big: 1 }, true);
  const frSmall = browser("إطار · ثنائي 2", "duo.html", BW, BH, { who: smallWho, box: DL.small }, true);

  const scenes = {};
  for (const d of SCENES) scenes[d.key] = new Scene(d.name);
  // ما يُخفى لو ما فيه كاميرا (أو اختار «الكتاب فقط»)، وما يتحرّك للوسط
  const camToggles = [], moves = [], posToggles = [];
  const tog = (scene, src, who) => camToggles.push({ scene: scene.name, source: src.name, who });
  scenes.intro.add(scr.intro);
  { const x = scenes.sheikh; x.add(bg); camAt(x, camS, [0, 0, BW, BH], AT.sheikh, "sheikh"); x.add(blurS.src); x.add(blurFill.src); x.add(portrait.src); x.add(cinB); x.add(fr.sheikh); x.add(capS);
    // وضعان لا يظهران معاً: «قصّ» (نافذة 16:9 حول الوجه) أو «عمودي كامل» (الصورة العموديّة + خلفيّة مغبَّشة)
    tog(x, camS, "sheikh:crop"); tog(x, blurS.src, "sheikh:crop"); tog(x, blurFill.src, "sheikh:fit"); tog(x, portrait.src, "sheikh:fit"); }
  { const x = scenes.card; x.add(bg); x.add(bk.card, L.card.book[0], L.card.book[1]); x.add(camBig.src, L.card.cam[0], L.card.cam[1]); x.add(fr.card); x.add(capS); tog(x, camBig.src, "sheikh");
    moves.push({ scene: x.name, source: bk.card.name, on: [L.card.book[0] * K, L.card.book[1] * K], off: [(BW - L.card.book[2]) / 2 * K, L.card.book[1] * K] }); }
  { const x = scenes.page; x.add(bg); camAt(x, camS, [0, 0, BW, BH], atPage(side), "sheikh", true); x.add(blurP.src); x.add(bk.page, L.page.page[0], L.page.page[1]); x.add(fr.page); x.add(capS); tog(x, camS, "sheikh"); tog(x, blurP.src, "sheikh");
    moves.push({ scene: x.name, source: bk.page.name, on: [L.page.page[0] * K, L.page.page[1] * K], off: [(BW - L.page.page[2]) / 2 * K, L.page.page[1] * K] }); }
  { const x = scenes.open; x.add(bg); x.add(bk.open, L.open.book[0], L.open.book[1]); x.add(camSm.src, L.open.cam[0], L.open.cam[1]); x.add(fr.open); x.add(capS); tog(x, camSm.src, "sheikh"); }
  { const x = scenes.cam2; x.add(bg); if (camT) { camAt(x, camT, [0, 0, BW, BH], AT.cam2, "cam2"); x.add(blurT.src); } x.add(cinB); x.add(fr.cam2); x.add(capS); if (camT) { tog(x, camT, "cam2"); tog(x, blurT.src, "cam2"); } }
  { const x = scenes.cam3; x.add(bg); if (camU) camAt(x, camU, [0, 0, BW, BH], AT.cam2, "cam3"); x.add(cinB); x.add(fr.cam3); x.add(capS); if (camU) tog(x, camU, "cam3"); }
  { const x = scenes.trio; x.add(bg); for (const t of TRIO) { if (!t.sc) continue; x.add(t.sc.src, t.box[0], t.box[1]); x.add(t.fr); tog(x, t.sc.src, t.who); tog(x, t.fr, t.who); } x.add(cinN); x.add(capS); }
  { const x = scenes.duo; x.add(bg);
    if (duoBig) { x.add(duoBig.src, DL.big[0], DL.big[1]); x.add(frBig); tog(x, duoBig.src, bigWho); tog(x, frBig, bigWho); }
    if (duoSmall) { x.add(duoSmall.src, DL.small[0], DL.small[1]); x.add(frSmall); tog(x, duoSmall.src, smallWho); tog(x, frSmall, smallWho); }
    x.add(cinN); x.add(capS); }
  { const x = scenes.duo2; x.add(bg); for (const t of HALF) { if (!t.sc) continue; x.add(t.sc.src, t.box[0], t.box[1]); x.add(t.fr); tog(x, t.sc.src, t.who); tog(x, t.fr, t.who); } x.add(cinN); x.add(capS); }
  if (isPod) { scenes.gal.add(galFull);
    const x = scenes.galguest; x.add(bg); x.add(galPanel); if (galGuest) { x.add(galGuest.src, GG[0], GG[1]); x.add(galGuestFr); tog(x, galGuest.src, "cam2"); tog(x, galGuestFr, "cam2"); } x.add(cinN); }
  if (isQ) {
    for (const [key, frame, layer] of [["qbottom", qLift, qB], ["qtop", qTop, qT]]) { const x = scenes[key];
      if (qWho === "cam2") { x.add(bg); camAt(x, camT, [0, 0, BW, BH], AT.cam2, "cam2"); x.add(blurT.src); x.add(cinB); x.add(frame); x.add(layer); x.add(capS); tog(x, camT, "cam2"); tog(x, blurT.src, "cam2"); continue; }
      x.add(bg); camAt(x, camS, [0, 0, BW, BH], AT.sheikh, "sheikh"); x.add(blurS.src); x.add(blurFill.src); x.add(portrait.src); x.add(cinB); x.add(frame); x.add(layer); x.add(capS);
      tog(x, camS, "sheikh:crop"); tog(x, blurS.src, "sheikh:crop"); tog(x, blurFill.src, "sheikh:fit"); tog(x, portrait.src, "sheikh:fit"); }
    for (const [key, layer] of [["qside", qS], ["qframe", qF]]) { const x = scenes[key];
      x.add(bg); if (qCam) { x.add(qCam.src, QC[0], QC[1]); tog(x, qCam.src, qWho); } x.add(qFr); tog(x, qFr, qWho); x.add(layer); x.add(capS); }
  }
  const sheikhL = new Scene("◂ الشيخ · أمام السطور"); nested.push(sheikhL);
  { const x = sheikhL; x.add(bg); camAt(x, camS, [0, 0, BW, BH], AT.sheikh, "sheikh"); x.add(blurS.src); x.add(blurFill.src); x.add(portrait.src); x.add(cinB); x.add(fr.lift); x.add(capS);
    tog(x, camS, "sheikh:crop"); tog(x, blurS.src, "sheikh:crop"); tog(x, blurFill.src, "sheikh:fit"); tog(x, portrait.src, "sheikh:fit"); }
  { const x = scenes.lines; x.add(bg); x.add(sheikhL.src); x.add(strip.front, 0, BH - 440); x.add(camBig.src, L.card.cam[0], L.card.cam[1]); x.add(fr.side); x.add(strip.side, SB[0], SB[1]); x.add(capS);
    // أمام الشيخ: مشهد الشيخ كاملاً + الشريط أسفله | بجانبه: إطار الشيخ + الشريط جانبه
    posToggles.push({ scene: x.name, source: sheikhL.src.name, pos: "front" }, { scene: x.name, source: strip.front.name, pos: "front" },
      { scene: x.name, source: camBig.src.name, pos: "side", who: "sheikh" }, { scene: x.name, source: fr.side.name, pos: "side" }, { scene: x.name, source: strip.side.name, pos: "side" }, { scene: x.name, source: capS.name, pos: "side" }); }
  scenes.break.add(scr.break);
  scenes.outro.add(scr.outro);

  // الميكروفون الوحيد: مايك الشيخ = مصدر صوت البثّ والتسجيل وملفّ MP3 والريلز والترجمة. أيّ جهاز إدخال في ويندوز (سلكيّ، USB، بلوتوث، مستقبل لاسلكيّ).
  // flags=2 «إجبار مونو»: الميكروفونات الأحاديّة (ياقة/سمّاعة) تُسمَع في الجهتين لا في اليسار فقط، والستيريو يُدمَج. sync = تأخير الصوت لمزامنته مع صورة الهاتف.
  const mic1 = source("مايك الشيخ", MIC_ID, { device_id: s.devices.micSheikh && s.devices.micSheikh.id ? s.devices.micSheikh.id : "default" },
    { filters: voiceChain(), mixers: 255, flags: 2, sync: Math.round(Math.max(0, Math.min(1500, Number((s.audio || {}).delay) || 0)) * 1e6) });
  // صوت التنقّل بين المشاهد (البودكاست): مصدر متصفّح صامت بلا إعادة تحميل عند الظهور، يُضاف لكل مشهد فيبقى حيّاً بين المشاهد
  if (s.mode === "podcast") {
    const sfx = reg(source("صوت التنقلات", "browser_source", { is_local_file: false, url: ov("sfx.html", {}), width: 16, height: 16, css: "", fps_custom: true, fps: 5, reroute_audio: true, restart_when_active: false, shutdown: false }, { mixers: 255 }));
    for (const d of SCENES) scenes[d.key].add(sfx, BW - 16, BH - 16);
    // صور تُركَّب فوق مشاهد الكاميرات: شفّافة بملء الشاشة، تُدار من إعدادات «معرض الصور» (يدويّاً أو بجدول زمنيّ)
    const pho = browser("صور فوق المشهد", "photos.html", BW, BH);
    for (const k of ["sheikh", "cam2", "cam3", "trio", "duo", "duo2"]) scenes[k].add(pho);
    // موسيقى الخلفيّة الهادئة أثناء الحوار فقط (لا في شاشات قبل/استراحة/ختام ولها موسيقاها). «تفاعليّة»: فلتر ضاغط بسلسلة جانبيّة من مايك الشيخ يخفض الموسيقى فور الكلام ويرفعها عند الصمت
    const bedCfg = (((s.modes.podcast || {}).music || {}).bed) || {}, duck = bedCfg.duck !== false;
    const bed = reg(source("موسيقى الخلفية", "browser_source", { is_local_file: false, url: ov("bed.html", {}), width: 16, height: 16, css: "", fps_custom: true, fps: 5, reroute_audio: true, restart_when_active: false, shutdown: false },
      { mixers: 255, filters: duck ? [filt("خفض الموسيقى عند الكلام", "compressor_filter", { ratio: 12.0, threshold: -40.0, attack_time: 25, release_time: 900, output_gain: 0.0, sidechain_source: "مايك الشيخ" })] : [] }));
    for (const k of ["sheikh", "cam2", "cam3", "trio", "duo", "duo2"]) scenes[k].add(bed, BW - 32, BH - 16);
  }
  const main = SCENES.map(d => scenes[d.key]), all = main.concat(nested);
  const t = require("../overlays/themes.js").theme(s.design.theme, s.design.custom);
  const tr = TRANSITIONS[s.design.transition] || TRANSITIONS.soft;
  const coll = {
    name: s._collName, AuxAudioDevice1: mic1,
    sources: S.concat(all.map(x => x.src)), groups: [],
    scene_order: all.map(x => ({ name: x.name })), current_scene: main[0].name, current_program_scene: main[0].name,
    current_transition: tr.name, transition_duration: tr.ms || 300,
    transitions: Object.values(TRANSITIONS).filter(x => x.id !== "cut_transition").map(x => ({ name: x.name, id: x.id, settings: x.settings(t) })),
    quick_transitions: [], saved_projectors: [], preview_locked: false, scaling_enabled: false, scaling_level: 0, scaling_off_x: 0, scaling_off_y: 0,
    canvases: [], modules: { "scripts-tool": [], "output-timer": {}, "auto-scene-switcher": { interval: 300, switches: [], active: false } },
    resolution: { x: W, y: H }, version: 2,
  };
  return { coll, camItems, camToggles, posToggles, moves, K, W, H, scenes: SCENES.map(d => ({ key: d.key, name: d.name })) };
}

module.exports = { camQuality, build, layout, SCENES, TRANSITIONS, obsColor, CAM_ID, MIC_ID };
