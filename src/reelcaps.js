// ترجمة نصّيّة تلقائيّة على الريلز: تفريغ كلام المقطع (Whisper عبر Groq) ← جمل بأزمنتها ← مواءمتها مع الخطّ الزمنيّ بعد حذف السكتات
// ← ترجمة اختياريّة ← صورة شفّافة لكل جملة ← قائمة concat واحدة يركّبها ffmpeg فوق الفيديو (مدخل واحد فلا يثقل التصدير).
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const TERM = /(?<=[.؟?!؛;…])\s+/;

/** جمل المقطع: كل مقطع كلام من Whisper يُقسَّم عند علامات نهاية الجملة، ويُوزَّع زمنه على أجزائه بنسبة الأحرف */
function sentencesOf(raw) {
  const out = [];
  for (const s of raw) {
    const parts = String(s.text || "").split(/\n/).flatMap(l => l.split(TERM)).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    const tot = parts.reduce((a, p) => a + p.length, 0) || 1; let t0 = s.start;
    for (const p of parts) { const d = (s.end - s.start) * p.length / tot; out.push({ a: t0, b: t0 + d, text: p }); t0 += d; }
  }
  return out;
}

/** زمن في المقطع الأصليّ ← زمن في الناتج بعد حذف السكتات (segs = الأجزاء المحفوظة [[بداية، نهاية]…]) */
function mapTime(t, segs) {
  let cum = 0;
  for (const [a, b] of segs) { if (t <= a) return cum; if (t < b) return cum + (t - a); cum += b - a; }
  return cum;
}

/**
 * @param ctx   { start, dur, segs, outDur, file, hasAudio }
 * @param cc    إعدادات الترجمة { langs, size, pos, box }
 * @param deps  { ffmpeg, caps (مثيل Captions), hasKey, tmpDir, renderFrames(frames, style, dir) → [مسارات PNG], style }
 * @returns     { list, n, cleanup }
 */
async function buildReelCaps(ctx, cc, deps) {
  const { start, dur, segs, outDur, file, hasAudio } = ctx;
  if (!hasAudio) throw new Error("التسجيل بلا صوت");
  if (!deps.hasKey()) throw new Error("مفتاح التفريغ غير مدمج في البرنامج");
  const dir = fs.mkdtempSync(path.join(deps.tmpDir, "reelcap-")), cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  try {
    const wav = path.join(dir, "a.wav");
    await new Promise((res, rej) => execFile(deps.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(start), "-t", String(dur), "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav],
      { windowsHide: true, timeout: 10 * 60 * 1000 }, e => e ? rej(new Error("تعذّر استخراج صوت المقطع")) : res()));
    const raw = await deps.caps.segmentsOf(fs.readFileSync(wav), "ar");
    let items = sentencesOf(raw).map(x => ({ a: mapTime(x.a, segs), b: mapTime(x.b, segs), text: x.text })).filter(x => x.b - x.a > 0.2);
    if (!items.length) throw new Error("لم يُكتشف كلام في المقطع");
    // لا تداخل: تنتهي كل جملة قبل بداية التي بعدها، وتبقى ثانية على الأقلّ لتُقرأ
    items = items.map((x, i) => { const nx = items[i + 1], b = Math.max(x.b, Math.min(x.a + 1.2, outDur)), cap = nx ? Math.max(x.a + .3, nx.a - .02) : outDur; return { a: x.a, b: Math.min(b, cap, outDur), text: x.text }; });
    // الترجمة (دفعات صغيرة، سطر لكل جملة)
    const targets = (cc.langs || []).filter(l => l !== "ar");
    let warn = "";
    if (targets.length) {
      for (let i = 0; i < items.length; i += 10) {
        const batch = items.slice(i, i + 10);
        try {
          const out = await deps.caps.translate(batch.map(x => x.text).join("\n"), targets, "ar", deps.caps.cfg() || {});
          for (const l of targets) { const arr = String(out[l] || "").split("\n").map(s => s.trim()).filter(Boolean); if (arr.length === batch.length) batch.forEach((x, k) => { (x.tr = x.tr || {})[l] = arr[k]; }); else warn = "تعذّرت ترجمة بعض الجمل"; }
        } catch (e) { warn = "الترجمة: " + e.message; }
      }
    }
    // إطار لكل جملة: الجملة السابقة باهتة فوقها لو كانت قريبة (أقلّ من 2.5 ث)
    const frames = items.map((x, i) => {
      const p = items[i - 1], lines = [];
      if (p && x.a - p.b < 2.5) lines.push({ text: p.text, kind: "prev" });
      lines.push({ text: x.text, kind: "orig" });
      for (const l of targets) if (x.tr && x.tr[l]) lines.push({ text: x.tr[l], kind: "tr", lang: l });
      return { lines };
    });
    const pngs = await deps.renderFrames(frames, deps.style, dir);
    const blank = await deps.renderFrames([null], deps.style, dir, "blank");
    // قائمة concat: شفّاف حتى أوّل جملة، ثمّ كل جملة بمدّتها، وبينها شفّاف
    const q = p => "file '" + p.replace(/\\/g, "/").replace(/'/g, "'\\''") + "'";
    const lines = []; let t = 0;
    const gap = d => { if (d > 0.016) lines.push(q(blank[0]), "duration " + d.toFixed(3)); };
    items.forEach((x, i) => { gap(x.a - t); lines.push(q(pngs[i]), "duration " + Math.max(0.05, x.b - x.a).toFixed(3)); t = x.b; });
    gap(Math.max(0, outDur + 0.5 - t));
    lines.push(q(blank[0]));                                    // السطر الأخير يُكرَّر بلا مدّة (متطلّب concat)
    const list = path.join(dir, "caps.txt"); fs.writeFileSync(list, lines.join("\n") + "\n");
    return { list, n: items.length, warn, cleanup };
  } catch (e) { cleanup(); throw e; }
}

module.exports = { buildReelCaps, sentencesOf, mapTime };
