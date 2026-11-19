// ريلز: اقتطاع مقطع (دقيقة–دقيقتين) من تسجيل، حذف السكتات، تحويله لإطار عمودي 9:16، وإضافة نصّ توضيحيّ خاصّ به. كل العمل بـffmpeg.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(bin, args, { onErr, onOut } = {}) {
  return new Promise((resolve, reject) => {
    let err = "", out = "";
    const p = spawn(bin, args, { windowsHide: true });
    p.stderr.on("data", d => { const s = String(d); err += s; onErr && onErr(s); });
    p.stdout.on("data", d => { const s = String(d); out += s; onOut && onOut(s); });
    p.on("error", reject);
    p.on("close", code => resolve({ code, err, out, p }));
    run.last = p;
  });
}

class Reels {
  constructor({ ffmpeg, ffprobe }) { this.ff = ffmpeg; this.fp = ffprobe; this.job = null; }

  async probe(file) {
    const r = await run(this.fp, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
    if (r.code !== 0) throw new Error("تعذّرت قراءة الملفّ (قد يكون تالفاً أو لم يكتمل تسجيله)");
    const j = JSON.parse(r.out), v = (j.streams || []).find(s => s.codec_type === "video"), a = (j.streams || []).some(s => s.codec_type === "audio");
    // اتّجاه العرض المخزَّن في الملفّ (هواتف وتسجيلات الكاميرا العموديّة تُخزَّن بمقاس أفقيّ مع وسم تدوير)
    let rot = 0; if (v) { const sd = (v.side_data_list || []).find(x => x.rotation !== undefined); rot = sd ? Number(sd.rotation) : Number(v.tags && v.tags.rotate) || 0; }
    rot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;       // الدوران عكس عقارب الساعة: 0 | 90 | 180 | 270
    return { duration: Number(j.format && j.format.duration) || 0, w: v && v.width, h: v && v.height, audio: a, rotation: rot };
  }

  /** فترات الصمت داخل المقطع [start, start+dur] بالثواني النسبيّة لبداية المقطع */
  async silences(file, start, dur, noise = -34, minSil = .45) {
    const r = await run(this.ff, ["-hide_banner", "-nostats", "-ss", String(start), "-t", String(dur), "-i", file, "-vn", "-af", `silencedetect=noise=${noise}dB:d=${minSil}`, "-f", "null", "-"]);
    const out = []; let s = null;
    for (const line of r.err.split(/\r?\n/)) {
      let m = line.match(/silence_start:\s*(-?[\d.]+)/); if (m) { s = Math.max(0, Number(m[1])); continue; }
      m = line.match(/silence_end:\s*([\d.]+)/); if (m && s !== null) { out.push([s, Math.min(dur, Number(m[1]))]); s = null; }
    }
    if (s !== null) out.push([s, dur]);               // صمت حتى نهاية المقطع
    return out;
  }

  /** الأجزاء المحفوظة بعد حذف السكتات: نُبقي pad ثانية من كل جانب لكل سكتة حتى يبقى «نَفَس» طبيعيّ، ونحذف الصمت في البداية والنهاية */
  plan(dur, sil, { pad = .15, minKeep = .35 } = {}) {
    let keep = [], cur = 0;
    for (const [a, b] of sil) {
      const lead = a <= .05, tail = b >= dur - .05;
      const cutA = lead ? a : a + pad, cutB = tail ? b : b - pad;
      if (cutB - cutA < .12) continue;                    // سكتة قصيرة لا تستحقّ القصّ
      if (cutA > cur) keep.push([cur, cutA]);
      cur = Math.max(cur, cutB);
    }
    if (cur < dur) keep.push([cur, dur]);
    keep = keep.filter(([a, b]) => b - a >= minKeep);
    if (!keep.length) keep = [[0, dur]];
    return keep;
  }

  // تعبير خطّيّ بالقطع لمسار التتبّع: v0 + Σ (Δv × clip((t−tᵢ)/Δt, 0, 1)) — بلا تداخل if فيبقى سريعاً ومضموناً مهما كثرت النقاط
  trackExpr(kf, idx) {
    let e = kf[0][idx].toFixed(4);
    for (let i = 0; i + 1 < kf.length; i++) {
      const dt = kf[i + 1][0] - kf[i][0], dv = kf[i + 1][idx] - kf[i][idx];
      if (dt <= 0.001 || Math.abs(dv) < 0.00005) continue;
      e += `+(${dv.toFixed(4)})*clip((t-${kf[i][0].toFixed(3)})/${dt.toFixed(3)},0,1)`;
    }
    return e;
  }

  buildGraph({ segs, hasAudio, layout, track, overlay, logo, outDur, loud, frame, rotation, caps }) {
    const f = n => n.toFixed(3), parts = [], N = segs.length;
    // 1) الصورة العموديّة. في وضع «قصّ» يُطبَّق القصّ المتتبِّع لوجه الشيخ على الخطّ الزمنيّ الأصليّ قبل حذف السكتات
    let src = "[0:v]";
    const top = Math.max(0, Math.round(layout.top ?? 300)), mid = Math.max(600, Math.min(1920, Math.round((layout.mid ?? 1260) / 2) * 2));
    {
      const z = Math.min(2.2, Math.max(1, layout.zoom || 1)), AR = 1080 / mid;
      const cxE = track && track.length > 1 ? this.trackExpr(track, 1) : String(Math.min(1, Math.max(0, layout.cx ?? .5)));
      const cyE = track && track.length > 1 ? this.trackExpr(track, 2) : String(Math.min(1, Math.max(0, layout.cy ?? .45)));
      // ffmpeg لا يدوّر مدخل filter_complex تلقائيّاً دوماً ويُبقي الوسم في الناتج فيظهر الريلز مقلوباً/أفقيّاً: نطبّق التدوير صراحةً ونُصفّر وسمه عند المدخل
      const rf = { 90: "transpose=2,", 270: "transpose=1,", 180: "hflip,vflip," }[rotation || 0] || "";
      parts.push(`[0:v]${rf}crop=w='floor(min(iw,ih*${AR.toFixed(5)})/${z}/2)*2':h='floor(min(iw,ih*${AR.toFixed(5)})/${AR.toFixed(5)}/${z}/2)*2':x='min(max((${cxE})*iw-ow/2,0),iw-ow)':y='min(max((${cyE})*ih-oh/2,0),ih-oh)',scale=1080:${mid}:flags=lanczos,setsar=1[cv]`);
      src = "[cv]";
    }
    // 2) أجزاء الكلام بعد حذف السكتات
    const vin = N > 1 ? Array.from({ length: N }, (_, i) => `[s${i}]`) : [src];
    if (N > 1) parts.push(`${src}split=${N}${vin.join("")}`);
    segs.forEach(([s, e], i) => {
      parts.push(`${vin[i]}trim=start=${f(s)}:end=${f(e)},setpts=PTS-STARTPTS[v${i}]`);
      if (hasAudio) { const L = e - s, fd = Math.min(.012, L / 4); parts.push(`[0:a]atrim=start=${f(s)}:end=${f(e)},asetpts=PTS-STARTPTS,afade=t=in:d=${f(fd)},afade=t=out:st=${f(L - fd)}:d=${f(fd)}[a${i}]`); }
    });
    parts.push(segs.map((_, i) => `[v${i}]` + (hasAudio ? `[a${i}]` : "")).join("") + `concat=n=${N}:v=1:a=${hasAudio ? 1 : 0}[vc]` + (hasAudio ? "[ac]" : ""));
    // 3) الفيديو في وسط الإطار بين الشريطين (سمكهما من إعدادات الريلز)
    parts.push(`[vc]pad=1080:1920:0:${top}:color=black[base]`);
    // 4) النصّ (الصورة 1) ثمّ شعار البداية يتلاشى وشعار النهاية يظهر (الصورة 2)
    let cur = "[base]", idx = 1;
    if (overlay) { parts.push(`${cur}[${idx}:v]overlay=0:0:format=auto:shortest=1[t1]`); cur = "[t1]"; idx++; }
    if (caps) { parts.push(`${cur}[${idx}:v]overlay=0:0:format=auto:eof_action=pass:repeatlast=1[tcp]`); cur = "[tcp]"; idx++; }     // الترجمة النصّيّة (مدخل concat واحد)
    if (frame && frame.hex) {
      // إطار رفيع يحيط بالمقطع: كامل عند البداية، ثمّ يُزال مع عقارب الساعة بدءاً من أعلى الوسط بانتظام حتى يختفي تماماً مع نهاية المقطع.
      // الإطار صورة ثابتة، وقناع الإزالة (مسح زاويّ) يُحسَب بربع الدقّة ثمّ يُكبَّر فيبقى التصدير سريعاً.
      const ins = Math.max(0, Math.round(frame.inset ?? 16)), th = Math.max(1, Math.round(frame.w ?? 6)), hx = "0x" + String(frame.hex).replace("#", "").toUpperCase();
      const cx = 135, cy = ((top + mid / 2) / 4).toFixed(2), P = "(T/" + f(Math.max(.1, outDur)) + ")*1.0167";
      parts.push(`color=c=black@0:s=1080x1920:r=30:d=${f(outDur + .1)},format=rgba,drawbox=x=${ins}:y=${top + ins}:w=${1080 - ins * 2}:h=${mid - ins * 2}:color=${hx}@1:t=${th}:replace=1[rg0]`);
      parts.push(`color=c=black:s=270x480:r=30:d=${f(outDur + .1)},format=gray,geq=lum='255*clip(((mod(atan2(X-${cx},${cy}-Y)+2*PI,2*PI)/(2*PI))-${P})*60+1,0,1)',scale=1080:1920:flags=bicubic,format=gray[wp]`);
      parts.push(`[rg0]split[rg1][rg2];[rg2]alphaextract[rga];[rga][wp]blend=all_mode=multiply,format=gray[rgm];[rg1][rgm]alphamerge[rg]`);
      parts.push(`${cur}[rg]overlay=0:0:format=auto:eof_action=pass[tf]`); cur = "[tf]";
    }
    if (logo) {
      // مدخل لطيف: بطاقة الشعار (خلفيّة معتّمة بهويّة الحلقة) تنفتح من المركز كحدقة العين فينبثق منها الفيديو، وفي الختام تنغلق عليه البطاقة بالشعار.
      // الفتحة بحافّة ناعمة تتّسع بتسارع لطيف (ease-out) ثمّ تتباطأ؛ والمعالجة (geq) على أوّل S ثانية وآخرها فقط فلا تُبطئ التصدير.
      const S = Math.max(1.2, logo.secs || 2), D = Math.min(1.2, S * 0.62), li = idx, EO = "(1-pow(1-clip(%P%,0,1),3))";
      const RI = `(-90+1500*${EO.replace("%P%", `(T-${f(S - D)})/${f(D)}`)})`;        // يتّسع بعد استقرار البطاقة
      const RO = `(1410-1500*${EO.replace("%P%", `T/${f(D)}`)})`;                      // ينقبض من أوّل الثواني الأخيرة
      // القناع يُحسَب بربع الدقّة (270×480) ثمّ يُكبَّر: حافّة ناعمة أصلاً فلا يُفقَد شيء، والتصدير أسرع 16 مرّة من حسابه بالدقّة الكاملة
      const mask = (R, d) => `color=c=black:s=270x480:r=30:d=${f(d)},format=gray,geq=lum='255*clip((hypot(X-135,Y-240)*4-${R})/90,0,1)',scale=1080:1920:flags=bicubic,format=gray`;
      parts.push(`[${li}:v]format=rgba,split=2[l1][l2]`);
      parts.push(mask(RI, S + .1) + "[m1]");
      parts.push(mask(RO, S) + "[m2]");
      parts.push(`[l1]trim=duration=${f(S + .1)},setpts=PTS-STARTPTS[c1];[c1][m1]alphamerge[li1]`);
      parts.push(`[l2]trim=duration=${f(S)},setpts=PTS-STARTPTS[c2];[c2][m2]alphamerge,setpts=PTS-STARTPTS+${f(Math.max(0, outDur - S))}/TB[lo1]`);
      parts.push(`${cur}[li1]overlay=0:0:format=auto:eof_action=pass:enable='lt(t,${f(S + .1)})'[t2]`);
      parts.push(`[t2][lo1]overlay=0:0:format=auto:eof_action=pass:enable='gte(t,${f(Math.max(0, outDur - S - .05))})'[vo]`);
    } else parts.push(`${cur}null[vo]`);
    if (hasAudio) parts.push(loud ? "[ac]loudnorm=I=-16:TP=-1.5:LRA=11[ao]" : "[ac]anull[ao]");
    return parts.join(";\n");
  }

  buildArgs({ file, start, dur, segs, hasAudio, layout, track, overlay, logo, loud, out, graphFile, frame, rotation, caps }) {
    const fps = 30, outDur = segs.reduce((a, [s, e]) => a + (e - s), 0);
    fs.writeFileSync(graphFile, this.buildGraph({ segs, hasAudio, layout, track, overlay, logo, outDur, loud, frame, rotation, caps }));
    const args = ["-hide_banner", "-y", "-nostats", "-progress", "pipe:1", "-ss", String(start), "-t", String(dur)];
    if (rotation) args.push("-display_rotation", "0");
    args.push("-i", file);
    if (overlay) args.push("-loop", "1", "-framerate", String(fps), "-i", overlay);
    if (caps) args.push("-f", "concat", "-safe", "0", "-i", caps.list);
    if (logo) args.push("-loop", "1", "-framerate", String(fps), "-i", logo.png);
    args.push("-filter_complex_script", graphFile, "-map", "[vo]");
    if (hasAudio) args.push("-map", "[ao]");
    args.push("-t", String(outDur.toFixed(3)), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(fps), "-profile:v", "high", "-level", "4.2");
    if (hasAudio) args.push("-c:a", "aac", "-b:a", "160k", "-ar", "48000");
    args.push("-movflags", "+faststart", out);
    return args;
  }

  /**
   * job: { file, start, dur, silence:{on,noise,minSil,pad}, layout:{mode,cx,cy,zoom,fy}, overlay, overlayEnd, loud, out }
   * onProgress(0..1, msg)
   */
  async render(job, onProgress = () => {}) {
    if (this.job) throw new Error("هناك ريلز قيد الإنشاء الآن — انتظر حتى ينتهي");
    this.job = job; let caps = null, capsWarn = "";
    try {
      onProgress(0.02, "قراءة الملفّ…");
      const info = await this.probe(job.file);
      const start = Math.max(0, job.start || 0), dur = Math.min(Math.max(1, job.dur), Math.max(1, info.duration - start));
      let segs = [[0, dur]], removed = 0;
      if (job.silence && job.silence.on && info.audio) {
        onProgress(0.06, "كشف السكتات…");
        const sil = await this.silences(job.file, start, dur, job.silence.noise ?? -34, job.silence.minSil ?? .45);
        segs = this.plan(dur, sil, { pad: job.silence.pad ?? .15 });
        removed = dur - segs.reduce((a, [s, e]) => a + (e - s), 0);
      }
      const outDur = segs.reduce((a, [s, e]) => a + (e - s), 0);
      // ترجمة نصّيّة تلقائيّة (اختياريّة): فشلها لا يُفشل الريلز، بل يُصدَّر بلا ترجمة مع تنبيه
      if (job.makeCaps) { onProgress(0.08, "تفريغ الكلام للترجمة النصّيّة…"); try { caps = await job.makeCaps({ start, dur, segs, outDur, file: job.file, hasAudio: info.audio }); capsWarn = caps.warn || ""; } catch (e) { capsWarn = e.message; caps = null; } }
      fs.mkdirSync(path.dirname(job.out), { recursive: true });
      const graphFile = job.out + ".graph.txt";
      const args = this.buildArgs({ file: job.file, start, dur, segs, hasAudio: info.audio, layout: job.layout || { mode: "crop" }, track: job.track, overlay: job.overlay, logo: job.logo, loud: job.loud !== false, out: job.out, graphFile, frame: job.frame, rotation: info.rotation, caps });
      onProgress(0.1, `تحويل إلى 9:16 (${Math.round(outDur)} ث${removed > 0.5 ? " — حُذف " + Math.round(removed) + " ث من السكتات" : ""})…`);
      let tail = "";
      const r = await run(this.ff, args, {
        onOut: s => { const m = [...s.matchAll(/out_time_us=(\d+)/g)].pop(); if (m) onProgress(0.1 + 0.88 * Math.min(1, Number(m[1]) / 1e6 / outDur), null); },
        onErr: s => { tail = (tail + s).slice(-1500); },
      });
      fs.unlink(graphFile, () => {});
      if (r.code !== 0) throw new Error("فشل ffmpeg: " + tail.split(/\r?\n/).filter(Boolean).slice(-3).join(" | "));
      onProgress(1, "تمّ");
      return { out: job.out, duration: outDur, removed, segments: segs.length, capsN: caps ? caps.n : 0, capsWarn };
    } finally { this.job = null; if (caps && caps.cleanup) caps.cleanup(); }
  }

  cancel() { try { run.last && run.last.kill(); } catch {} }
}

module.exports = { Reels, run };
