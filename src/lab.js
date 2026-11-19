// «معمل المجالس»: استوديو تعديل مقاطع الفيديو والصوت المحمَّلة في الحاسوب.
// المشروع (project.json) = مقاطع مستورَدة + تسلسل رئيسيّ (seq) من أجزاء مقتطعة + طبقات زمنيّة (ov) + مقاطع صوت إضافيّة (audio).
// التصدير: مرشّح ffmpeg واحد يبني التسلسل (قصّ، تخطيط، انتقالات) ثم يركّب فوقه الطبقات (صور PNG شفّافة مرسومة من صفحات البثّ نفسها) والصوت.
const fs = require("fs"), path = require("path");
const { run } = require("./reels");

const W = 1920, H = 1080, FPS = 30;
const uid = p => (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ROT = { 90: "transpose=2,", 270: "transpose=1,", 180: "hflip,vflip," };

class Lab {
  constructor({ dir, ffmpeg, ffprobe, reels, assets }) {
    Object.assign(this, { dir, ff: ffmpeg, fp: ffprobe, reels, assets });
    fs.mkdirSync(dir, { recursive: true });
  }
  pdir(id) { return path.join(this.dir, id); }
  pfile(id) { return path.join(this.pdir(id), "project.json"); }

  // ---------- المشاريع ----------
  list() {
    const out = [];
    for (const id of fs.readdirSync(this.dir)) {
      try { const p = JSON.parse(fs.readFileSync(this.pfile(id), "utf8")); out.push({ id, name: p.name, kind: p.kind, updated: p.updated, dur: this.duration(p) }); } catch {}
    }
    return out.sort((a, b) => b.updated - a.updated);
  }
  create(kind, name) {
    const id = uid("p"), p = { id, name: name || "مشروع جديد", kind: kind || "free", created: Date.now(), updated: Date.now(), v: 1, clips: [], seq: [], ov: [], audio: [], texts: {}, opts: { fade: .35 } };
    fs.mkdirSync(path.join(this.pdir(id), "ov"), { recursive: true }); this.save(p); return p;
  }
  get(id) { return JSON.parse(fs.readFileSync(this.pfile(id), "utf8")); }
  save(p) { p.updated = Date.now(); fs.mkdirSync(this.pdir(p.id), { recursive: true }); const tmp = this.pfile(p.id) + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(p)); fs.renameSync(tmp, this.pfile(p.id)); return p; }
  remove(id) { fs.rmSync(this.pdir(id), { recursive: true, force: true }); }

  // ---------- استيراد ----------
  async probe(file) {
    const r = await run(this.fp, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
    if (r.code !== 0) throw new Error("تعذّرت قراءة الملفّ");
    const j = JSON.parse(r.out), v = (j.streams || []).find(s => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic)), a = (j.streams || []).some(s => s.codec_type === "audio");
    let rot = 0; if (v) { const sd = (v.side_data_list || []).find(x => x.rotation !== undefined); rot = sd ? Number(sd.rotation) : Number(v.tags && v.tags.rotate) || 0; }
    rot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
    const dur = Number(j.format && j.format.duration) || 0;
    let kind = v ? "video" : a ? "audio" : "none";
    if (v && /image2|png_pipe|jpeg_pipe|webp_pipe|bmp_pipe/.test((j.format && j.format.format_name) || "")) kind = "image";
    return { kind, dur: kind === "image" ? 5 : dur, w: v && v.width, h: v && v.height, rot, audio: a && kind !== "image" };
  }
  async addClip(id, file) {
    const info = await this.probe(file);
    if (info.kind === "none") throw new Error("هذا الملفّ ليس فيديو ولا صوتاً ولا صورة");
    const cid = uid("c"), name = path.basename(file), dir = this.pdir(id);
    const clip = Object.assign({ id: cid, file, name }, info);
    fs.mkdirSync(path.join(dir, "media"), { recursive: true });
    if (info.kind === "video" || info.kind === "image") {
      const th = path.join(dir, "media", cid + ".jpg"), rf = ROT[info.rot] || "";
      await run(this.ff, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(info.kind === "image" ? 0 : Math.min(1, info.dur / 3)), "-display_rotation", "0", "-i", file, "-frames:v", "1", "-vf", rf + "scale=320:-2", th]);
      if (fs.existsSync(th)) clip.thumb = "media/" + cid + ".jpg";
    }
    if (info.kind === "image") { const loc = "media/" + cid + path.extname(file).toLowerCase(); fs.copyFileSync(file, path.join(dir, loc)); clip.local = loc; }   // الصور تُنسخ لتُخدَّم لصفحات الرسم
    const p = this.get(id); p.clips.push(clip); this.save(p);
    return clip;
  }
  // نسخة المعاينة: 360p H.264 خفيفة (ملفّات الكاميرا قد لا يشغّلها المتصفّح مباشرة) + قمم الصوت لرسم الموجة
  async makeProxy(id, cid, onProgress = () => {}) {
    const p = this.get(id), c = p.clips.find(x => x.id === cid); if (!c || c.kind === "image") return c;
    const ext = c.kind === "audio" ? ".m4a" : ".mp4", out = path.join(this.pdir(id), "media", cid + ".v2" + ext), tmpOut = path.join(this.pdir(id), "media", cid + ".v2.part" + ext), rf = ROT[c.rot] || "";
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-nostats", "-progress", "pipe:1", "-display_rotation", "0", "-i", c.file];
    if (c.kind === "video") args.push("-vf", rf + "scale=-2:540,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-g", "30", "-keyint_min", "15", "-pix_fmt", "yuv420p"); else args.push("-vn");
    if (c.audio) args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"); else args.push("-an");
    args.push("-movflags", "+faststart", tmpOut);
    const r = await run(this.ff, args, { onOut: s => { const m = [...s.matchAll(/out_time_us=(\d+)/g)].pop(); if (m && c.dur) onProgress(Math.min(1, Number(m[1]) / 1e6 / c.dur)); } });
    if (r.code !== 0) { try { fs.unlinkSync(tmpOut); } catch {} throw new Error("فشل إنشاء نسخة المعاينة: " + r.err.slice(-200)); }
    fs.renameSync(tmpOut, out);
    let peaks = null; if (c.audio) { try { peaks = await this.peaks(c.file, c.dur); } catch {} }
    const p2 = this.get(id), c2 = p2.clips.find(x => x.id === cid); if (!c2) return null;
    const old = c2.proxy && path.join(this.pdir(id), c2.proxy);
    c2.proxy = "media/" + path.basename(out); c2.proxyV = 2; if (peaks) c2.peaks = peaks;
    this.save(p2); if (old && path.resolve(old) !== path.resolve(out)) setTimeout(() => { try { fs.unlinkSync(old); } catch {} }, 8000);
    return c2;
  }
  async peaks(file, dur) {
    const n = Math.max(200, Math.min(6000, Math.round(dur * 5))), sr = 200;
    const buf = await new Promise((res, rej) => {
      const { spawn } = require("child_process"), pr = spawn(this.ff, ["-hide_banner", "-loglevel", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(sr), "-f", "s16le", "-"], { windowsHide: true }), ch = [];
      pr.stdout.on("data", d => ch.push(d)); pr.on("error", rej); pr.on("close", () => res(Buffer.concat(ch)));
    });
    const total = Math.floor(buf.length / 2), per = Math.max(1, Math.floor(total / n)), out = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * per; j < Math.min(total, (i + 1) * per); j++) m = Math.max(m, Math.abs(buf.readInt16LE(j * 2))); out.push(Math.round(m / 327.68) / 100); }
    return out;
  }

  // ---------- أدوات التحرير ----------
  /** أجزاء الاحتفاظ بعد حذف السكتات داخل [a,b] من المقطع (أزمنة المقطع الأصليّ) */
  async silenceCuts(c, a, b, opt = {}) {
    const sil = await this.reels.silences(c.file, a, b - a, opt.noise ?? -34, opt.minSil ?? .5);
    const keep = this.reels.plan(b - a, sil, { pad: opt.pad ?? .15, minKeep: opt.minKeep ?? .4 });
    return { silences: sil.length, keep: keep.map(([x, y]) => [a + x, a + y]) };
  }
  duration(p) { return this.timeline(p).total; }
  /** أزمنة بداية كل جزء في التسلسل (مع تراكب الانتقالات) */
  timeline(p) {
    let t = 0; const items = [];
    (p.seq || []).forEach((s, i) => {
      const d = this.segDur(s), tr = i > 0 && s.trans && s.trans.d > 0 ? Math.min(s.trans.d, d / 2, items[i - 1].dur / 2) : 0;
      const start = t - tr; items.push({ id: s.id, start, dur: d, end: start + d, tr }); t = start + d;
    });
    return { items, total: t };
  }
  segDur(s) { return s.type === "still" ? Math.max(.5, s.dur || 3) : Math.max(.05, (s.out - s.in) / (s.speed || 1)); }

  // ---------- بناء مرشّح التصدير ----------
  /**
   * ctx: { maskFor(shape,w,h) -> مسار PNG، audioBg: صورة خلفيّة للمشروع الصوتيّ، loud, preset, crf }
   * يعيد { args, graph, outDur } — النصّ {GRAPH} في args يُستبدل بمسار ملفّ المرشّح.
   */
  buildExport(p, out, ctx = {}) {
    const clips = Object.fromEntries(p.clips.map(c => [c.id, c])), dir = this.pdir(p.id);
    const inputs = [], F = [], tl = this.timeline(p), total = tl.total, ox = [];
    if (!p.seq.length) throw new Error("لا يوجد في التسلسل ما يُصدَّر");
    const add = (pre, file) => { inputs.push([...pre, "-i", file]); return inputs.length - 1; };
    // صور ثابتة (خلفيّات، أقنعة، طبقات PNG): مصدر movie داخل المرشّح بسحب كسول — بخلاف -loop الذي يملأ الذاكرة بإطارات لمقاطع طويلة
    let msn = 0; const qp = f => String(f).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const loopIn = (file, d) => { const lb = "ms" + (++msn); F.push(`movie='${qp(file)}':loop=0,setpts=N/(${FPS}*TB),fps=${FPS},trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS[${lb}]`); return lb; };
    const V = k => typeof k === "string" ? k : `${k}:v`;
    const rotArgs = c => c && c.rot ? ["-display_rotation", "0"] : [];
    const fit = (lab, w, h, mode, o) => mode === "cover"
      ? `[${lab}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[${o}]`
      : `[${lab}]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[${o}]`;
    const maskOf = (shape, w, h) => ctx.maskFor ? ctx.maskFor(shape || "round", w, h) : null;
    // يضع flux في مربّع بشكل (قناع ألفا) ثمّ يعيد اسم الدفق
    const shapeBox = (src, bw, bh, shape, d, tag) => {
      F.push(fit(src, bw, bh, "cover", `${tag}c`));
      const mk = maskOf(shape, bw, bh); if (!mk) return `${tag}c`;
      const km = loopIn(mk, d);
      F.push(`[${tag}c]format=yuva420p[${tag}f]`); F.push(`[${V(km)}]scale=${bw}:${bh},format=rgba,alphaextract,format=gray,fps=${FPS}[${tag}m]`); F.push(`[${tag}f][${tag}m]alphamerge[${tag}o]`);
      return `${tag}o`;
    };
    const bgOf = (file, d, tag) => {
      if (file && fs.existsSync(file)) { const k = loopIn(file, d); F.push(`[${V(k)}]scale=${W}:${H},setsar=1,fps=${FPS},format=yuv420p,setpts=PTS-STARTPTS[${tag}]`); }
      else F.push(`color=c=0x101820:s=${W}x${H}:r=${FPS}:d=${d.toFixed(3)},format=yuv420p[${tag}]`);
    };

    // ---- الأجزاء ----
    const sv = [], sa = [], sd = [];
    p.seq.forEach((s, i) => {
      const d = this.segDur(s), L = s.layout || { mode: "full" };
      if (s.type === "still") {
        bgOf(path.join(dir, s.png || "none.png"), d, `sv${i}`);
        F.push(`anullsrc=r=48000:cl=stereo,atrim=0:${d.toFixed(3)},asetpts=PTS-STARTPTS[sa${i}]`);
        sv.push(`sv${i}`); sa.push(`sa${i}`); sd.push(d); return;
      }
      const c = clips[s.clip]; if (!c) throw new Error("مقطع مفقود في التسلسل");
      const sp = s.speed || 1, isImg = c.kind === "image";
      const k = isImg ? loopIn(c.file, d) : add([...rotArgs(c), "-ss", s.in.toFixed(3), "-t", (s.out - s.in).toFixed(3)], c.file);
      if (c.kind === "audio") {
        bgOf(ctx.audioBg ? path.join(dir, ctx.audioBg) : null, d, `sv${i}`);
      } else {
        const base = `[${V(k)}]${isImg ? "" : (ROT[c.rot] || "")}setpts=${sp === 1 ? "PTS-STARTPTS" : `(PTS-STARTPTS)/${sp}`},fps=${FPS},format=yuv420p`;
        if (L.mode === "box" && L.box) {
          const [bx, by, bw, bh] = L.box.map(Math.round);
          F.push(`${base}[bv${i}]`);
          const boxed = shapeBox(`bv${i}`, bw, bh, L.shape, d, `b${i}`);
          bgOf(L.bg ? path.join(dir, L.bg) : null, d, `bb${i}`);
          F.push(`[bb${i}][${boxed}]overlay=${bx}:${by}:eof_action=pass:format=auto,format=yuv420p[sv${i}]`);
        } else if (L.fit === "cover") {
          F.push(`${base}[fv${i}]`); F.push(fit(`fv${i}`, W, H, "cover", `sv${i}`));
        } else {                                                    // احتواء مع خلفيّة مغبَّشة تملأ الفراغ (فيديو عموديّ)
          F.push(`${base},split[fa${i}][fb${i}]`);
          F.push(`[fa${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg${i}]`);
          F.push(`[fb${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=28:3,setsar=1[fk${i}]`);
          F.push(`[fk${i}][fg${i}]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p[sv${i}]`);
        }
      }
      const vol = s.mute ? 0 : (s.vol ?? 1), atempo = sp !== 1 ? `,atempo=${sp}` : "";
      if (c.audio && !isImg) F.push(`[${k}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo${atempo},volume=${vol}[sa${i}]`);
      else F.push(`anullsrc=r=48000:cl=stereo,atrim=0:${d.toFixed(3)},asetpts=PTS-STARTPTS[sa${i}]`);
      sv.push(`sv${i}`); sa.push(`sa${i}`); sd.push(d);
    });
    sv.forEach((l, i) => { F.push(`[${l}]fps=${FPS},settb=1/${FPS * 1000},format=yuv420p,setsar=1[sn${i}]`); sv[i] = `sn${i}`; });
    // ---- دمج التسلسل: قصّ مباشر أو انتقال ----
    let cv = sv[0], ca = sa[0], ct = sd[0];
    for (let i = 1; i < sv.length; i++) {
      const tr = p.seq[i].trans && p.seq[i].trans.d > 0 ? Math.min(p.seq[i].trans.d, sd[i] / 2, ct / 2) : 0;
      if (tr > 0.02) {
        const kind = ({ fade: "fade", dip: "fadeblack", wipe: "wipeleft", slide: "slideleft", dissolve: "dissolve" })[p.seq[i].trans.type] || "fade";
        F.push(`[${cv}][${sv[i]}]xfade=transition=${kind}:duration=${tr.toFixed(3)}:offset=${(ct - tr).toFixed(3)}[xv${i}]`);
        F.push(`[${ca}][${sa[i]}]acrossfade=d=${tr.toFixed(3)}:c1=tri:c2=tri[xa${i}]`);
        cv = `xv${i}`; ca = `xa${i}`; ct = ct + sd[i] - tr;
      } else {
        F.push(`[${cv}][${ca}][${sv[i]}][${sa[i]}]concat=n=2:v=1:a=1[cv${i}][ca${i}]`);
        cv = `cv${i}`; ca = `ca${i}`; ct += sd[i];
      }
      F.push(`[${cv}]fps=${FPS},settb=1/${FPS * 1000},format=yuv420p,setsar=1[nm${i}]`); cv = `nm${i}`;
    }
    // ---- الطبقات: B-roll وصور PNG بزمن مطلق على المخرج ----
    const fd = p.opts && p.opts.fade != null ? p.opts.fade : .35;
    let n = 0;
    const ovs = (p.ov || []).filter(o => o.end > o.start && o.start < total).slice().sort((a, b) => (a.z || 0) - (b.z || 0) || a.start - b.start);
    for (const o of ovs) {
      const s0 = Math.max(0, o.start), e0 = Math.min(total, o.end), dur = e0 - s0; n++;
      if (o.type === "broll") {
        const c = clips[o.clip]; if (!c || c.kind === "audio") continue;
        const isImg = c.kind === "image", L = o.mode === "box" && o.box ? o.box.map(Math.round) : null;
        const k = isImg ? loopIn(c.file, dur) : add([...rotArgs(c), "-ss", (o.in || 0).toFixed(3), "-t", dur.toFixed(3)], c.file);
        F.push(`[${V(k)}]${isImg ? "" : (ROT[c.rot] || "")}setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[ov${n}a]`);
        let last;
        if (L) last = shapeBox(`ov${n}a`, L[2], L[3], o.shape, dur, `ob${n}`); else { F.push(fit(`ov${n}a`, W, H, "contain", `ov${n}b`)); last = `ov${n}b`; }
        F.push(`[${last}]setpts=PTS+${s0.toFixed(3)}/TB[ov${n}]`);
        F.push(`[${cv}][ov${n}]overlay=${L ? L[0] : 0}:${L ? L[1] : 0}:enable='between(t,${s0.toFixed(3)},${e0.toFixed(3)})':eof_action=pass:format=auto[ow${n}]`);
        cv = `ow${n}`;
        if (o.audio && c.audio && !isImg) { F.push(`[${k}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${o.vol ?? 1},adelay=${Math.round(s0 * 1000)}|${Math.round(s0 * 1000)}[oa${n}]`); ox.push(`oa${n}`); }
        continue;
      }
      if (!o.png) continue;
      const f = path.join(dir, o.png); if (!fs.existsSync(f)) continue;
      const k = loopIn(f, dur), d2 = Math.min(o.fade != null ? o.fade : fd, dur / 2);
      F.push(`[${V(k)}]format=rgba,fade=t=in:st=0:d=${d2.toFixed(3)}:alpha=1,fade=t=out:st=${(dur - d2).toFixed(3)}:d=${d2.toFixed(3)}:alpha=1,setpts=PTS+${s0.toFixed(3)}/TB[ov${n}]`);
      F.push(`[${cv}][ov${n}]overlay=${o.at ? Math.round(o.at[0]) : 0}:${o.at ? Math.round(o.at[1]) : 0}:eof_action=pass:format=auto[ow${n}]`);
      cv = `ow${n}`;
    }
    // ---- الصوت الإضافيّ (موسيقى/صوت مستورَد) ----
    let mix = ca; const extra = ox.slice();
    (p.audio || []).forEach((t, i) => {
      const c = clips[t.clip]; if (!c || !c.audio) return;
      const at = Math.max(0, t.at || 0), k = add([...(t.loop ? ["-stream_loop", "-1"] : []), "-ss", (t.in || 0).toFixed(3)], c.file);
      const fadeo = t.fadeOut ? `,afade=t=out:st=${Math.max(0, total - at - t.fadeOut).toFixed(3)}:d=${t.fadeOut}` : "";
      F.push(`[${k}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,atrim=0:${Math.max(.1, total - at).toFixed(3)},volume=${t.vol ?? .25}${fadeo},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[mx${i}]`);
      extra.push(`mx${i}`);
    });
    if (extra.length) {
      // التخفيض التلقائيّ للموسيقى تحت الكلام: نقسم صوت الكلام إلى مسارين (للمزج وللسلسلة الجانبيّة)
      F.push(`[${mix}]asplit=2[sp1][sp2]`);
      const mus = [], ducked = [];
      (p.audio || []).forEach((t, i) => { if (extra.includes(`mx${i}`)) (t.duck ? ducked : mus).push(`mx${i}`); });
      let dk = [];
      ducked.forEach((m, j) => { F.push(`[${m}][sp2]sidechaincompress=threshold=0.03:ratio=10:attack=30:release=500[dk${j}]`); dk.push(`dk${j}`); });
      const rest = extra.filter(x => !ducked.includes(x)).concat(dk);
      F.push(`[sp1]${rest.map(x => `[${x}]`).join("")}amix=inputs=${1 + rest.length}:normalize=0:duration=first:dropout_transition=0[am]`); mix = "am";
    }
    if (ctx.loud !== false) { F.push(`[${mix}]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[aout]`); mix = "aout"; }
    const args = ["-hide_banner", "-y", "-nostats", "-progress", "pipe:1"];
    for (const i of inputs) args.push(...i);
    args.push("-/filter_complex", "{GRAPH}", "-map", `[${cv}]`, "-map", `[${mix}]`, "-r", String(FPS), "-c:v", "libx264", "-preset", ctx.preset || "veryfast", "-crf", String(ctx.crf || 19), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", total.toFixed(3), out);
    return { args, graph: F.join(";\n"), outDur: total };
  }

  async render(p, out, ctx = {}, onProgress = () => {}) {
    if (this.job) throw new Error("هناك تصدير قيد العمل الآن");
    this.job = true;
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const b = this.buildExport(p, out, ctx), gf = out + ".graph.txt";
      fs.writeFileSync(gf, b.graph); b.args[b.args.indexOf("{GRAPH}")] = gf;
      onProgress(0.01, "بدء التصدير…");
      let tail = "";
      const r = await run(this.ff, b.args, {
        onOut: s => { const m = [...s.matchAll(/out_time_us=(\d+)/g)].pop(); if (m) onProgress(Math.min(.99, Number(m[1]) / 1e6 / b.outDur), null); },
        onErr: s => { tail = (tail + s).slice(-2500); },
      });
      fs.unlink(gf, () => {});
      if (r.code !== 0) { try { fs.unlinkSync(out); } catch {} throw new Error("فشل التصدير: " + tail.split(/\r?\n/).filter(Boolean).slice(-4).join(" | ")); }
      onProgress(1, "تمّ");
      return { out, duration: b.outDur };
    } finally { this.job = null; }
  }
  cancel() { try { run.last && run.last.kill(); } catch {} }
}
module.exports = { Lab, uid, W, H, FPS };
