// إعدادات «منبر» — ملفّ JSON واحد في مجلّد بيانات البرنامج.
const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  texts: {
    program: "الدورة العلميّة في شرح زاد المستقنع",
    halaqa: "",                        // اسم الحلقة العلميّة: يظهر بجوار اسم الدورة (يُملأ من الحلقة المختارة)
    book: "زاد المستقنع في اختصار المقنع",
    scope: "كتاب الطهارة",
    session: "المجلس الأوّل",
    "sheikh-title": "فضيلة الشيخ",
    sheikh: "اسم الشيخ",
    "sheikh-post": "",                 // صفة الشيخ أو منصبه (اختياريّ) تحت اسمه
    reader: "",
    mosque: "",
    date: "",
    start: "20:00",
    "break-min": "10",
    next: "",
  },
  design: {
    theme: "zumurrud", custom: null,   // custom = { bg, accent }
    pattern: "khatam",
    reading: { pos: "front", lines: 3, step: "line", size: 1, bg: .55, fade: true },   // مشهد «سطور الكتاب»: pos = front أمام الشيخ | side بجانبه، lines = 2 أو 3، step = line سطر | all بعدد السطور المعروضة
    camSide: "left",                    // الكاميرا يسار والكتاب يمين
    frame: "arch",                      // arch | round | oval | rect
    sponsors: true,
    font: "default",                    // خطّ البثّ: default | tajawal | plex | noto
    camFit: "crop",                     // الهاتف العموديّ في مشهد «الشيخ»: crop = نافذة 16:9 حول الوجه | fit = الصورة العموديّة كاملة بخلفيّة مغبَّشة
    camRot: "auto",                     // تدوير صورة كاميرا الشيخ (الهاتف العموديّ): auto | 0 | 90 | 180 | 270
    autoFrame: true,                    // تأطير ذكي: يتبع وجه الشيخ تلقائيّاً
    logoScale: 1,                       // تكبير/تصغير الشعارات: 0.5 – 5
    logoPos: "auto",                    // auto | top-right | top-left | bottom-right | bottom-left
    grad: "black",                      // لون التدرّج تحت الاسم: black | theme
    transition: "soft",                 // مفتاح من TRANSITIONS في scenes.js
    transitionMs: 0,                    // مدّة الانتقال بالمللي ثانية (0 = المدّة الافتراضيّة لكل انتقال)
    textStyle: { name: {}, lesson: {} }, // نمط نصوص الاسم والدرس (انظر boxCss في themes.js)
    cinema: "off",                      // الوضع السينمائيّ (CINEMA في themes.js)
    cinemaK: 100,                       // شدّته 0–100٪
    cinemaBars: true,                   // الشريطان الأسودان (في مشهدَي الشيخ والحضور)
    flip: "rtl",                        // اتجاه تقليب الكتاب
    motion: true,
    hideSpeaker: false,                 // «الكتاب فقط»: يخفي الشيخ حتى لو الكاميرا شغّالة
  },
  devices: { camSheikh: null, cam2: null, cam3: null, micSheikh: null },
  cam3: { on: false, label: "" },   // الكاميرا الثالثة (البودكاست): اختياريّة، تُفعَّل وتُغلَق
  audio: { delay: 0 },   // تأخير صوت الميكروفون (م.ث) لمزامنته مع صورة الهاتف
  framing: { sheikh: { zoom: 1, fx: .5, fy: .42, rot: 0, box: [0, 0, 1, 1] }, cam2: { zoom: 1, fx: .5, fy: .5 }, cam3: { zoom: 1, fx: .5, fy: .5 } },
  // كاميرا الحضور (الثانويّة): on = مفعّلة | target = audience (الحضور) | students (الطلبة) | courtyard (باحة المسجد) | custom (نصّ حرّ في label)
  cam2: { on: false, target: "audience", label: "" },
  // مشهد «الشيخ + الحضور»: mode = overlap (متداخلان) | inset (الصغير داخل الكبير) | side (متجاوران)، big = الكبير، side = جهته، small = مقياس الصغير
  duo: { mode: "overlap", big: "sheikh", side: "right", small: 1 },
  quality: "1080",     // 1080 | 4k
  // منصّات البثّ: تقدر تفعّل أكثر من منصّة وتبثّ لها كلها في نفس الوقت
  platforms: {
    youtube: { on: true, key: "" },
    facebook: { on: false, key: "" },
    telegram: { on: false, server: "", key: "" },
    tiktok: { on: false, server: "", key: "" },
    custom: { on: false, server: "", key: "" },
  },
  dirs: {},            // مجلّدات الحفظ المخصّصة: rec (الدروس) | reels (الريلز) | audio (الصوتيّات)؛ الفارغ = الافتراضيّ
  audioRec: true,      // استخراج ملفّ صوت عالي الجودة مع كلّ تسجيل
  uiTheme: "green",     // مظهر ألوان واجهة البرنامج: green | navy | burgundy | purple | coffee | graphite
  camQ: { res: "auto", fps: 0, fmt: "auto" },   // جودة كاميرات ويندوز (الرقميّة وبطاقات الالتقاط): الدقّة WxH | الإطارات | الصيغة (auto|mjpeg|nv12|yuy2) — auto = افتراضيّ الجهاز
  breakOn: true,       // مشهد «الاستراحة» مفعّل (يمكن إغلاقه فلا يظهر بين المشاهد)
  autoRec: false,      // يبدأ التسجيل تلقائيّاً عند بدء البثّ المباشر
  stream: { key: "", server: "rtmps://a.rtmps.youtube.com:443/live2" },
  logos: [],          // [{ file, name, on, mono, nobg, cut }]
  qr: null,
  book: null,         // { id, v }
  bookState: { page: 1, focus: false, band: null, step: .042 },
  halaqat: [],        // الحلقات ← الكتب ← المجالس (انظر halaqat.js)
  sel: null,          // المختار الآن: { h, b, s }
  // هاتف «المجالس»: token = رمز الاقتران (يُولَّد تلقائيّاً)، size = آخر حجم صورة وصل من كل هاتف (لتجهيز المصدر)
  phone: { token: "", usb: true, usbNoToken: true, size: { sheikh: [1080, 1920], audience: [1080, 1920] } },
  // الترجمة النصّيّة الحيّة: الصوت ← Whisper (Groq، مجّاني) ← ترجمة اختياريّة ← شريط أسفل الفيديو
  captions: { on: false, mic: "", src: "ar", langs: ["ar", "fr"], size: "m", pos: "bottom", lift: 130, model: "whisper-large-v3", hint: true, save: true },
  // ريلز: مقاطع عموديّة 9:16 من التسجيل أو ذاكرة الإعادة، بحذف السكتات ونصّ توضيحيّ خاصّ بكل مقطع (text = مسوّدة المقطع الحاليّ)
  reels: {
    silence: { on: true, noise: -34, minSil: 0.45, pad: 0.15 },
    layout: { mode: "crop", cx: 0.5, cy: 0.45, zoom: 1 },
    loud: true,
    text: { title: "", note: "", foot: "", pos: "low", showName: true,
      top: 300, bot: 360,                          // سمك الشريطين الزخرفيّين (بكسل من 1920)
      deco: true, decoAlpha: 0.2, line: 6, fade: 150, frame: true, frameW: 6, frameInset: 16, frameColor: "", bandColor: "theme:deep", lineColor: "theme:accent",
      titleFont: "", titleSize: 70, titleColor: "#FFFFFF", nameFont: "", nameSize: 68, nameColor: "#FFFFFF", noteFont: "", noteSize: 44 },
    caps: { on: false, langs: ["ar"], size: "m", pos: "bottom", box: true },   // ترجمة نصّيّة تلقائيّة (كلام الشيخ) على الريلز
    track: true,                                   // تتبّع وجه الشيخ فلا يفلت من الإطار
    logo: { on: true, secs: 2 },                   // شعار الحلقة في البداية (يتلاشى) وفي النهاية (يظهر)
    rb: { on: false, secs: 120 },
    clean: { on: true },                           // تسجيل كاميرا الشيخ نظيفةً (عموديّاً بلا زخارف) طوال البثّ/التسجيل لتقطيع الريلز لاحقاً
    auto: { on: false, everyMin: 20, secs: 90 },
  },
  // الأقسام: lessons = الدروس العلميّة (الحلقات والكتب)، khutba = خطب الجمع، lecture = المحاضرات. لكل قسم نسخته من الشعارات والشاشات وصورة المتحدّث
  mode: "lessons",
  modes: {
    khutba: { title: "خطبة الجمعة", topic: "", mosque: "", place: "", khatibTitle: "فضيلة الشيخ", khatib: "", start: "12:30", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
    lecture: { title: "", lecturerTitle: "", lecturer: "", org: "", place: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
    // البودكاست: مقدّم وضيف بقالب استوديو (tpl: القالب وخلفيّته وخطّه وبطاقاته — انظر overlays/podkit.js). sheikhImg = صورة المقدّم، guestImg = صورة الضيف
    // معرض القرآن الكريم: يستعمل حقول المحاضرة (lecturer = القارئ). الموضع الحاليّ في المصحف في الحقل quran في الأعلى
    quran: { title: "معرض القرآن الكريم", lecturerTitle: "القارئ", lecturer: "", org: "", place: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null },
    podcast: { title: "", tagline: "", episode: "", topic: "", hostTitle: "المقدّم", host: "", guestTitle: "الضيف", guest: "", guestRole: "", third: "", thirdTitle: "", next: "", start: "20:00", dateAuto: true, dateText: "", sponsors: [], logo: null, screens: null, socials: [], sheikhImg: null, guestImg: null, tpl: { id: "studio" }, music: { tracks: [], assign: { intro: "", break: "", outro: "" }, fx: { on: false, id: "", file: "", vol: 70 }, bed: { on: false, id: "", file: "", vol: 22, duck: true } } },
  },
  quran: { s: 1, a: 1, p: 0, size: 100, num: true, head: true, info: true, scope: "all", rf: 1, rt: 7, follow: false, cam: "sheikh" },   // الموضع الحاليّ في المصحف وخيارات العرض
  modeItems: { khutba: [], lecture: [], podcast: [], quran: [] },   // الخطب والمحاضرات المحفوظة: كل عنصر نسخة كاملة من إعدادات القسم (وله id)
  library: [],        // [{ id, title, author, kind, pages, source, added }]
};

class Store {
  constructor(dir) {
    this.file = path.join(dir, "settings.json");
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch {}
    this.s = {};
    for (const k of Object.keys(DEFAULTS)) {
      const d = DEFAULTS[k], v = saved[k];
      this.s[k] = d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" ? Object.assign({}, d, v) : (v !== undefined ? v : JSON.parse(JSON.stringify(d)));
    }
    // كاميرا القارئ أُلغيت نهائيّاً: ننظّف بقاياها من الإعدادات القديمة
    if (this.s.devices) { delete this.s.devices.camReader; delete this.s.devices.micReader; }      // مايك القارئ أُلغي: مايك واحد (الشيخ)
    if (this.s.framing) delete this.s.framing.reader;
    this.t = null;
    // ترحيل: مفتاح يوتيوب القديم
    if (this.s.stream && this.s.stream.key && !this.s.platforms.youtube.key) this.s.platforms.youtube = { on: true, key: this.s.stream.key };
  }
  get() { return this.s; }
  patch(p) {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === "object" && !Array.isArray(v) && this.s[k] && typeof this.s[k] === "object" && !Array.isArray(this.s[k])) this.s[k] = Object.assign({}, this.s[k], v);
      else this.s[k] = v;
    }
    this.save();
    return this.s;
  }
  save() { clearTimeout(this.t); this.t = setTimeout(() => this.flush(), 300); }
  flush() { clearTimeout(this.t); fs.writeFileSync(this.file, JSON.stringify(this.s, null, 1)); }
}
module.exports = { Store, DEFAULTS };
