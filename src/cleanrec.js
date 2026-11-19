// تسجيل «كاميرا الشيخ النظيفة»: يلتقط بثّ هاتف الشيخ (H.264) كما يصل، عموديّاً وبلا اسم ولا زخارف ولا شعارات،
// ويحفظه طوال البثّ أو التسجيل لتقطيع الريلز منه لاحقاً. لا إعادة ترميز (copy) فلا حِمل على المعالج.
// الصوت: عند انتهاء الجلسة يُدمَج صوت تسجيل البرنامج (إن وُجد) محاذياً بالساعة.
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");

const stampOf = d => { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; };

class CleanRecorder {
  constructor({ ffmpeg, dir, log }) {
    this.ffmpeg = ffmpeg; this.dir = dir; this.log = log || (() => {});
    this.active = false;          // الجلسة جارية (نسجّل كلّما توفّر هاتف الشيخ)
    this.seg = null;              // المقطع الحاليّ {file, proc, t0, needKey}
    this.done = [];               // مقاطع الجلسة المنتهية
    this.onChange = () => {};
  }
  status() { return { active: this.active, recording: !!this.seg, file: this.seg ? path.basename(this.seg.file) : null, since: this.seg ? this.seg.t0 : 0, segments: this.done.length + (this.seg ? 1 : 0) }; }

  /** تبدأ الجلسة؛ يبدأ التسجيل فعليّاً حين يتوفّر هاتف الشيخ */
  begin(phone, base) { this.active = true; this.done = []; this.base = base || "كاميرا الشيخ"; this.tryStart(phone); }
  tryStart(phone) {
    if (!this.active || this.seg) return;
    const s = phone && phone.phones && phone.phones.sheikh;
    if (!s || s.dead || !s.cfg || !s.key) return;     // ننتظر الإعداد وأوّل إطار مفتاحيّ
    const cfg = s.cfg, rot = ((Number(cfg.rot) || 0) % 360 + 360) % 360;
    const dir = typeof this.dir === "function" ? this.dir() : this.dir;
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const t0 = Date.now(), stem = this.base + (this.done.length ? " (جزء " + (this.done.length + 1) + ")" : "");
    let file = path.join(dir, stem + ".mp4"); for (let i = 2; fs.existsSync(file) || fs.existsSync(file + ".h264"); i++) file = path.join(dir, stem + " (" + i + ").mp4");
    // نكتب الإطارات الخام (Annex-B) إلى ملفّ مؤقّت ثمّ نحوّلها عند الانتهاء إلى mp4 بمعدّل إطارات محسوب من الأختام الزمنيّة الحقيقيّة للهاتف
    // (الأختام الزمنيّة بالساعة تتكدّس لأنّ الشبكة تسلّم الإطارات دفعات فتفسد الملفّ)
    const raw = file + ".h264", seg = { file, raw, t0, rot, fps: Number(cfg.fps) || 30, n: 0, p0: null, p1: null, needKey: false, ws: fs.createWriteStream(raw) };
    seg.ws.on("error", e => this.log("cleanrec write error", e.message));
    try { fs.writeFileSync(raw + ".json", JSON.stringify({ rot, fps: seg.fps })); } catch {}
    this.seg = seg;
    this.frame(s.key);
    this.log("cleanrec start", file, cfg.w + "x" + cfg.h, "rot", rot);
    this.onChange();
  }
  frame(payload) {
    const g = this.seg; if (!g) return;
    const key = (payload[0] & 1) === 1;
    if (g.needKey && !key) return;
    if (g.ws.writableLength > 48 * 1024 * 1024) { g.needKey = true; return; }      // القرص أبطأ من البثّ: نتخطّى حتى المفتاحيّ التالي
    if (key) g.needKey = false;
    const pts = Number(payload.readBigUInt64BE(1));
    if (g.p0 === null) g.p0 = pts; g.p1 = pts; g.n++;
    g.ws.write(payload.subarray(9));
  }
  /** تغيّر الإعداد (دوران/دقّة) أو انقطع الهاتف: نغلق المقطع ونحوّله إلى mp4، وتبدأ مقطعاً جديداً عند توفّر إطار مفتاحيّ */
  cut() {
    const g = this.seg; if (!g) return this.pending || Promise.resolve();
    this.seg = null; this.onChange();
    const p = new Promise(res => g.ws.end(res)).then(() => this.finalize(g)).catch(e => this.log("cleanrec finalize failed", e.message)).then(() => { this.done.push(g); this.onChange(); });
    this.pending = Promise.all([this.pending, p].filter(Boolean));
    return p;
  }
  finalize(g) {
    const dur = g.p0 !== null ? (g.p1 - g.p0) / 1e6 : 0;
    const fps = Math.min(60, Math.max(5, g.n > 1 && dur > 0.5 ? (g.n - 1) / dur : g.fps));
    return this.remux(g.raw, g.file, g.rot, fps);
  }
  remux(raw, file, rot, fps) {
    // -display_rotation: عكس عقارب الساعة؛ والهاتف يعطي الدوران باتّجاه عقارب الساعة
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-display_rotation", String(-rot || 0), "-r", fps.toFixed(3), "-f", "h264", "-i", raw, "-c:v", "copy", "-movflags", "+faststart", file];
    return new Promise((res, rej) => execFile(this.ffmpeg, args, { windowsHide: true, timeout: 3600000, maxBuffer: 1 << 20 }, (e, so, se) => {
      if (e) return rej(new Error(String(se || e.message).slice(-400)));
      try { fs.unlinkSync(raw); fs.unlinkSync(raw + ".json"); } catch {}
      res();
    }));
  }
  /** عند فتح البرنامج: أيّ تسجيل خام بقي من انقطاع مفاجئ يُحوَّل إلى mp4 */
  async recover() {
    const dir = typeof this.dir === "function" ? this.dir() : this.dir; let list = []; try { list = fs.readdirSync(dir).filter(f => f.endsWith(".mp4.h264")); } catch { return; }
    for (const f of list) {
      const raw = path.join(dir, f); let m = { rot: 0, fps: 30 }; try { m = JSON.parse(fs.readFileSync(raw + ".json", "utf8")); } catch {}
      try { await this.remux(raw, raw.slice(0, -5), m.rot || 0, m.fps || 30); this.log("cleanrec recovered", f); } catch (e) { this.log("cleanrec recover failed", f, e.message); }
    }
  }

  /** تنتهي الجلسة. recFile/recT0: تسجيل البرنامج وبداية ساعته لدمج صوته */
  async end(recFile, recT0) {
    this.active = false;
    await this.cut(); await this.pending;
    const segs = this.done.slice(); this.done = [];
    for (const g of segs) {
      let size = 0; try { size = fs.statSync(g.file).size; } catch {}
      if (size < 20 * 1024) { try { fs.unlinkSync(g.file); } catch {} continue; }       // لا شيء يستحقّ الحفظ
      if (recFile && recT0 && fs.existsSync(recFile)) {
        await this.stable(recFile);                           // ملفّ OBS (hybrid mp4) يُغلَق بعد حدث الإيقاف بلحظات
        for (let i = 0; i < 4; i++) { try { await this.mux(g, recFile, recT0); break; } catch (e) { this.log("cleanrec mux failed", i, e.message); await new Promise(r => setTimeout(r, 3000)); } }
      }
    }
    this.onChange();
    return segs.map(g => path.basename(g.file));
  }
  async stable(f) { let last = -1, same = 0; for (let i = 0; i < 40 && same < 2; i++) { let n = -2; try { n = fs.statSync(f).size; } catch {} same = n === last ? same + 1 : 0; last = n; await new Promise(r => setTimeout(r, 1000)); } }
  mux(g, recFile, recT0) {
    const off = (g.t0 - recT0) / 1000;                       // موضع بداية المقطع داخل تسجيل البرنامج (ثانية)
    const out = g.file.replace(/\.mp4$/i, ".mux.mp4");
    const a = off >= 0 ? ["-ss", off.toFixed(3), "-i", recFile] : ["-itsoffset", (-off).toFixed(3), "-i", recFile];
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", g.file, ...a, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out];
    return new Promise((res, rej) => execFile(this.ffmpeg, args, { windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 1 << 20 }, (e, so, se) => {
      if (e) { try { fs.unlinkSync(out); } catch {} return rej(new Error(String(se || e.message).slice(-900))); }
      try { fs.unlinkSync(g.file); fs.renameSync(out, g.file); } catch (x) { return rej(x); }
      res();
    }));
  }
}
module.exports = { CleanRecorder };
