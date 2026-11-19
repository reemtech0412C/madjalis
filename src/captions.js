// الترجمة النصّيّة الحيّة: مقاطع الصوت (WAV 16ك) ← Whisper large-v3 عبر Groq (طبقة مجّانيّة) ← ترجمة اختياريّة بنموذج Llama ← شريط الشاشة.
// المفتاح مجّانيّ من console.groq.com (بلا بطاقة). الحدّ المجّانيّ: ~20 طلب/دقيقة و7200 ثانية صوت/ساعة.
const fs = require("fs");
const path = require("path");

const API = "https://api.groq.com/openai/v1";
const LANGS = { ar: ["العربيّة", "Arabic"], fr: ["Français", "French"] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// عبارات يهلوس بها Whisper على الصمت/الضجيج
const HALLU = [/المترجمs+للقناة/, /شركةs+الهدى/, /^[s.!؟،-]*نهايةs+الدرس[s.!؟،-]*$/, /^[s.!؟،-]*(شكرا|شكراً|شكرًا)(s+لكم|s+جزيلا|s+لك)?[s.!؟،-]*$/, /ترجم(ة)?s+(ال)?(تعنيق|تعليق)/, /^[s.!؟،-]*(مرحبا|إلىs+اللقاء|الىs+اللقاء)[s.!؟،-]*$/, /شكر[اً]?s+علىs+المشاهدة/, /نانسي\s*قنقر/, /amara\.org/i, /اشترك(وا)?\s+في\s+(ال)?قناة/, /لا\s+تنس(وا)?\s+(الاشتراك|الاشتراك\s+في)/, /ترجمة\s+(و)?(تدقيق|مراجعة)/, /subtitles?\s+by/i, /sous-titr/i];

function httpError(status, body) {
  let m = ""; try { m = JSON.parse(body).error.message; } catch {}
  if (status === 401) return new Error("مفتاح Groq غير صالح — تأكّد منه أو أنشئ مفتاحاً جديداً");
  if (status === 429) return new Error("تجاوزتَ الحدّ المجّاني مؤقّتاً — تُستأنف الترجمة تلقائيّاً");
  return new Error(`خطأ ${status}${m ? ": " + m : ""}`);
}

async function call(url, opts, tries = 2) {
  for (let i = 0; ; i++) {
    let r;
    try { r = await fetch(url, opts); } catch (e) { throw new Error("لا يوجد اتّصال بالإنترنت"); }
    if (r.ok) return r;
    if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await sleep(Math.min(Number(r.headers.get("retry-after")) || 2, 15) * 1000); continue; }
    throw httpError(r.status, await r.text().catch(() => ""));
  }
}

class Captions {
  // follow/onText/qhint: تتبّع التلاوة (معرض القرآن) — يعمل حتى لو الترجمة المعروضة مطفأة، ويُمرِّر كل نصّ مسموع إلى onText
  constructor({ cfg, key, terms, emit, status, dir, follow, onText, qhint }) {
    Object.assign(this, { cfg, key, terms, emit, status, dir, follow, onText, qhint });
    this.q = []; this.busy = false; this.seq = 0; this.prev = ""; this.last = ""; this.dupes = 0; this.errAt = 0;
  }

  enqueue(wav, sec) {
    const c = this.cfg();
    if (!(c.on || (this.follow && this.follow())) || !this.key()) return;
    if (this.q.length >= 4) this.q.shift();              // نتأخّر؟ نُسقط الأقدم ليبقى العرض حيّاً
    this.q.push({ wav, sec });
    this.pump();
  }

  async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.q.length) {
        const j = this.q.shift();
        try { await this.process(j); this.status({ ok: true }); }
        catch (e) { this.status({ error: e.message }); }
      }
    } finally { this.busy = false; }
  }

  async process({ wav, sec }) {
    const c = this.cfg(), src = c.src || "ar";
    const text = await this.transcribe(wav, c, src);
    if (!text) return;
    if (this.onText) { try { this.onText(text); } catch (e) { this.status({ error: "التتبّع: " + e.message }); } }
    if (!c.on) return;                                   // الترجمة المعروضة مطفأة: التفريغ لتتبّع التلاوة فقط
    const id = ++this.seq, ts = Date.now();
    const base = { id, ts, src, text, tr: {}, sec };
    this.emit(base);                                     // الأصل يظهر فوراً
    const targets = (c.langs || []).filter(l => l !== src && LANGS[l]);
    let tr = {};
    if (targets.length) {
      try { tr = await this.translate(text, targets, src, c); this.emit(Object.assign({}, base, { tr })); }
      catch (e) { this.status({ error: "الترجمة: " + e.message }); }
    }
    this.log(base, tr);
    this.prev = (this.prev + " " + text).slice(-240); this.lastText = text;
  }

  async transcribe(wav, c, src) {
    const fd = new FormData();
    fd.append("file", new Blob([wav], { type: "audio/wav" }), "chunk.wav");
    fd.append("model", c.model || "whisper-large-v3");
    fd.append("language", src);
    fd.append("response_format", "verbose_json");
    fd.append("temperature", "0");
    if (c.hint !== false) {
      // سياق يضبط أسماء الكتب والأعلام: عنوان الكتاب واسم الشيخ والدورة + آخر جملة
      const t = this.terms() || {};
      const parts = src === "ar" ? [`درس علميّ شرعيّ بالعربيّة الفصحى.`, t.program && `الدورة: ${t.program}.`, t.book && `الكتاب: ${t.book}.`, t.sheikh && `الشيخ: ${t.sheikh}.`, this.prev]
        : [t.book && `Book: ${t.book}.`, t.sheikh && `Speaker: ${t.sheikh}.`, this.prev];
      const qh = this.follow && this.follow() && this.qhint ? this.qhint() : "";
      const p = qh || parts.filter(Boolean).join(" ").slice(-420);
      if (p) fd.append("prompt", p);
    }
    const r = await call(API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + this.key() }, body: fd });
    const j = await r.json();
    // هلوسة الصمت: Whisper يخترع جملاً قصيرة («شكراً»، «ترجمة…») حين لا كلام. نُسقط المقاطع قليلة الثقة أو التي يرى النموذج أنّها صمت
    const words = t => String(t).trim().split(/s+/).filter(Boolean).length;
    const all = j.segments || [];
    const segs = all.filter(s => !(s.no_speech_prob > 0.6 && s.avg_logprob < -0.7) && !(s.avg_logprob < -1.6) && !(s.compression_ratio > 2.4));
    if (all.length && !segs.length) this.status({ drop: all.map(x => x.text).join(' ').trim().slice(0, 40) });
    let text = (j.segments ? segs.map(s => String(s.text).replace(/\s+/g, " ").trim()).filter(Boolean).join("\n") : String(j.text || "").replace(/\s+/g, " ").trim()).trim();
    if (!text || text.length < 2) return "";
    if (HALLU.some(re => re.test(text))) { this.status({ drop: text.slice(0, 40) }); return ""; }
    if (text === this.last) { if (++this.dupes >= 2) return ""; } else this.dupes = 0;      // تكرار متتالٍ = غالباً هلوسة
    this.last = text;
    return text;
  }

  /** تفريغ مقطع كامل (WAV 16ك أحاديّ) بأزمنة بداية/نهاية كل مقطع كلام — للترجمة النصّيّة على الريلز (لا يمسّ حالة البثّ الحيّ) */
  async segmentsOf(wav, src = "ar") {
    const c = this.cfg(), t = this.terms() || {};
    const fd = new FormData();
    fd.append("file", new Blob([wav], { type: "audio/wav" }), "clip.wav");
    fd.append("model", c.model || "whisper-large-v3");
    fd.append("language", src); fd.append("response_format", "verbose_json"); fd.append("temperature", "0");
    const prompt = [`درس علميّ شرعيّ بالعربيّة الفصحى.`, t.program && `الدورة: ${t.program}.`, t.book && `الكتاب: ${t.book}.`, t.sheikh && `الشيخ: ${t.sheikh}.`].filter(Boolean).join(" ").slice(0, 400);
    if (c.hint !== false && prompt) fd.append("prompt", prompt);
    const r = await call(API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + this.key() }, body: fd }, 3);
    const j = await r.json();
    return (j.segments || []).filter(s => !(s.no_speech_prob > 0.6 && s.avg_logprob < -0.7) && !(s.avg_logprob < -1.6) && !(s.compression_ratio > 2.4))
      .map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text).replace(/\s+/g, " ").trim() })).filter(s => s.text.length > 1 && !HALLU.some(re => re.test(s.text)));
  }

  async translate(text, targets, src, c) {
    const list = targets.map(l => `"${l}" (${LANGS[l][1]})`).join(", ");
    const sys = `You translate live captions of an Islamic scholarly lesson. Source language: ${LANGS[src][1]}. ` +
      `Translate the user's text faithfully and naturally into each requested language: ${list}. ` +
      `The text has one sentence per line: return the translation with the same number of lines, translating each line separately and keeping the line breaks (use \n inside the JSON string). Preserve the exact meaning; do not add, omit, explain or summarize. Keep Quran/hadith wording accurate to its meaning, transliterate proper names, keep honorifics short (e.g. ﷺ). ` +
      `Reply with ONLY a JSON object whose keys are the language codes and whose values are the translations.`;
    const user = (this.lastText ? `Previous sentence (context only, do not translate): ${this.lastText}\n\n` : "") + `Text to translate:\n${text}`;
    const run = async model => {
      const r = await call(API + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + this.key(), "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }, 2);
      const j = await r.json();
      return JSON.parse(j.choices[0].message.content);
    };
    let out;
    try { out = await run(c.tmodel || "llama-3.3-70b-versatile"); }
    catch (e) { if (/الحدّ المجّاني|خطأ 5/.test(e.message)) out = await run("llama-3.1-8b-instant"); else throw e; }   // نفد حدّ النموذج الكبير: نموذج أصغر بحدّ أعلى
    const tr = {};
    for (const l of targets) if (typeof out[l] === "string" && out[l].trim()) tr[l] = out[l].trim();
    return tr;
  }

  log(d, tr) {
    const c = this.cfg();
    if (c.save === false || !this.dir) return;
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10), tm = new Date(d.ts).toTimeString().slice(0, 8);
      const lines = d.text.split("\n").map((t, i) => (i ? "          " : `[${tm}] `) + t).concat(Object.entries(tr).map(([l, t]) => `       (${l}) ${t.replace(/\n/g, "\n            ")}`));
      fs.appendFileSync(path.join(this.dir, `نصّ-الدرس-${day}.txt`), lines.join("\n") + "\n");
    } catch {}
  }

  async testKey() {
    const k = this.key();
    if (!k) throw new Error("لا يوجد مفتاح مدمج في البرنامج بعد");
    const r = await call(API + "/models", { headers: { Authorization: "Bearer " + k } }, 1);
    const j = await r.json();
    const ids = (j.data || []).map(m => m.id);
    if (!ids.some(i => /whisper/.test(i))) throw new Error("المفتاح يعمل لكن لا يتيح Whisper");
    return { ok: true, models: ids.filter(i => /whisper|llama-3/.test(i)) };
  }

  /** سطر تجريبيّ لمعاينة الشكل على الشاشة بلا صوت */
  preview() {
    const c = this.cfg(), src = c.src || "ar";
    const samples = { ar: ["بسم الله الرحمن الرحيم", "الحمد لله ربّ العالمين", "والصلاة والسلام على أشرف المرسلين"].join("\n") };
    const tr = { fr: ["Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux", "Louange à Allah, Seigneur des mondes", "Que la paix et les bénédictions soient sur le plus noble des messagers"].join("\n") };
    const text = samples[src] || samples.ar, t = {};
    for (const l of c.langs || []) if (l !== src && tr[l]) t[l] = tr[l];
    this.emit({ id: ++this.seq, ts: Date.now(), src, text, tr: t, sec: 0, preview: true });
    return true;
  }
}

module.exports = { Captions, LANGS };
