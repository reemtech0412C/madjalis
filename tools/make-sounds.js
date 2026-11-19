// يولّد «مكتبة الأصوات الجاهزة» للبودكاست: أصوات تنقّل على طراز ما يُستعمل في البودكاستات (هواء/ضربة/ستينغر/تنبيه/فقاعة…) وموسيقى خلفيّة هادئة تتكرّر بلا فجوة.
// تُصنَع بالكامل بـffmpeg (بلا تنزيل ولا حقوق). كل صوت تنقّل يُضبَط مستواه تلقائياً إلى ذروة -3 dB.
//   node tools/make-sounds.js   ← يكتب assets/sounds/*.mp3 و index.json
const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
const OUT = path.join(__dirname, "..", "assets", "sounds"); fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^(tr|tp)-.*\.mp3$/.test(f) || f === "index.json") fs.unlinkSync(path.join(OUT, f));
const FF = [path.join(__dirname, "..", "resources", "bin", "ffmpeg.exe"), path.join(__dirname, "..", "dist", "win-unpacked", "resources", "bin", "ffmpeg.exe"), "ffmpeg"].find(p => p === "ffmpeg" || fs.existsSync(p));
const sh = args => cp.execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
const peak = file => { try { cp.execFileSync(FF, ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { const m = String(e.stderr || "").match(/max_volume:\s*(-?[\d.]+) dB/); if (m) return +m[1]; } const r = cp.spawnSync(FF, ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }); const m = String(r.stderr).match(/max_volume:\s*(-?[\d.]+) dB/); return m ? +m[1] : 0; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "snd-")), list = [];

// عمليّات بناء: كل مدخل = مرشّح كامل (filter_complex) ينتهي بالوسم [o]
const bell = (c, w, a = 1) => `volume='${a}*exp(-pow((t-${c})/${w},2))':eval=frame`;               // غلاف جرسيّ (غاوسيّ) حول الزمن c
const noise = (d, lo, hi, env) => `anoisesrc=c=pink:d=${d}:a=0.9:r=44100,highpass=f=${lo},lowpass=f=${hi},${env}`;
const TR = [
  // «هواء»: ثلاث حزم ضوضاء تبلغ ذروتها تباعاً فتبدو كمسح صاعد
  ["tp-whoosh", "هواء", 1.3, `${noise(1.3, 120, 600, bell(0.35, 0.2))}[a];${noise(1.3, 600, 2500, bell(0.55, 0.2))}[b];${noise(1.3, 2500, 9000, bell(0.78, 0.2, 0.8))}[c];[a][b][c]amix=inputs=3:normalize=0,aecho=0.7:0.5:60:0.2[o]`],
  ["tp-fast", "سريع", 0.55, `${noise(0.55, 150, 900, bell(0.15, 0.09))}[a];${noise(0.55, 900, 4000, bell(0.26, 0.09))}[b];${noise(0.55, 4000, 10000, bell(0.36, 0.09, 0.8))}[c];[a][b][c]amix=inputs=3:normalize=0[o]`],
  // «ضربة»: نبضة منخفضة + طقة + صدى
  ["tp-impact", "ضربة", 1.6, `aevalsrc='0.9*exp(-5*t)*sin(2*PI*(52+40*exp(-12*t))*t)+0.35*exp(-60*t)*(random(0)*2-1)+0.25*exp(-9*t)*sin(2*PI*110*t)':s=44100:d=1.6,lowpass=f=3500,aecho=0.7:0.6:90|200:0.35|0.2[o]`],
  // «ستينغر»: صعود بالضوضاء إلى ضربة
  ["tp-stinger", "ستينغر", 1.8, `${noise(1.1, 300, 7000, "volume='pow(t/1.0,2.2)':eval=frame")}[r];aevalsrc='if(gt(t,1.0),0.9*exp(-5*(t-1.0))*sin(2*PI*(52+40*exp(-12*(t-1.0)))*(t-1.0))+0.4*exp(-55*(t-1.0))*(random(0)*2-1),0)':s=44100:d=1.8,aecho=0.7:0.6:90:0.3[h];[r]apad=whole_dur=1.8[r2];[r2][h]amix=inputs=2:normalize=0[o]`],
  // «تنبيه»: رنّة مشرقة قصيرة (طراز إشعارات البودكاست)
  ["tp-ding", "تنبيه", 1.4, `aevalsrc='0.45*exp(-4.2*t)*(sin(2*PI*1397*t)+0.45*sin(2*PI*2794*t)+0.25*sin(2*PI*4191*t))*(1-exp(-400*t))':s=44100:d=1.4,aecho=0.8:0.6:110|230:0.3|0.18[o]`],
  // «فقاعة»: نقرة سريعة بانزلاق نغمة
  ["tp-pop", "فقاعة", 0.3, `aevalsrc='0.6*exp(-22*t)*sin(2*PI*(380+2600*t)*t)':s=44100:d=0.3,aecho=0.7:0.5:45:0.2[o]`],
  // «رقميّ»: خشخشة رقميّة قصيرة (Glitch)
  ["tp-glitch", "رقمي", 0.55, `aevalsrc='0.5*(random(0)*2-1)*gt(sin(2*PI*38*t),0.2)*exp(-4*t)+0.18*sin(2*PI*(900+3200*random(1))*t)*gt(sin(2*PI*17*t),0.4)*exp(-3*t)':s=44100:d=0.55,acrusher=bits=5:mode=log:aa=1:mix=0.9,highpass=f=300[o]`],
  // «نغمات»: ثلاث نغمات متتالية خفيفة
  ["tp-pluck", "نغمات", 1.3, `aevalsrc='0.4*(exp(-7*t)*sin(2*PI*523*t)*lt(t,0.15)+exp(-7*(t-0.12))*sin(2*PI*659*t)*gt(t,0.12)*lt(t,0.3)+exp(-6*(t-0.24))*sin(2*PI*784*t)*gt(t,0.24)*(1+0.3*sin(2*PI*1568*t)))':s=44100:d=1.3,aecho=0.8:0.6:100|200:0.3|0.2[o]`],
  // «شريط»: صوت إرجاع شريط كاسيت (نغمة تصعد وتهبط بسرعة)
  ["tp-tape", "شريط", 0.75, `aevalsrc='0.35*sin(2*PI*(300+1500*t-1500*t*t)*t*2)*sin(PI*t/0.75)+0.05*(random(0)*2-1)*sin(PI*t/0.75)':s=44100:d=0.75,lowpass=f=5000,aecho=0.7:0.5:55:0.22[o]`],
];
for (const [id, name, d, fc] of TR) {
  const wav = path.join(TMP, id + ".wav"); const src = /^(anoisesrc|aevalsrc)/.test(fc);
  sh(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", fc.replace(/^(aevalsrc=[^[]*?)\[o\]$/, "$1[o]"), "-map", "[o]", "-t", String(d), wav]);
  const g = -3 - peak(wav);
  sh(["-i", wav, "-af", `volume=${g.toFixed(2)}dB,afade=t=out:st=${(d * 0.85).toFixed(2)}:d=${(d * 0.15).toFixed(2)},aformat=sample_fmts=fltp:channel_layouts=stereo`, "-c:a", "libmp3lame", "-b:a", "160k", path.join(OUT, id + ".mp3")]);
  list.push({ id, name, kind: "transition", file: id + ".mp3", sec: d });
}

// ---------- موسيقى خلفيّة هادئة (حبال من موجات جيبيّة بتضمين بطيء، دورتها 60 ث بالضبط فتتكرّر بلا فجوة) ----------
const pad = (notes, extra = "") => {
  const terms = notes.map(([f, a], i) => `${a}*(0.62+0.38*sin(2*PI*0.05*t+${(i * 1.3).toFixed(2)}))*sin(2*PI*${f}*t)+${(a * 0.18).toFixed(3)}*(0.5+0.5*sin(2*PI*0.1*t+${(i * 0.9).toFixed(2)}))*sin(2*PI*${f * 2}*t)`).join("+");
  return `(${terms}${extra})`;
};
const AM = [
  ["am-calm", "هدوء", [[131, 0.13], [262, 0.1], [330, 0.085], [392, 0.075], [494, 0.06]], ""],
  ["am-cloud", "غيم", [[110, 0.15], [220, 0.1], [262, 0.085], [330, 0.08], [392, 0.07], [494, 0.05]], ""],
  ["am-dawn", "فجر", [[175, 0.12], [262, 0.095], [349, 0.085], [440, 0.075], [659, 0.04]], ""],
  ["am-oasis", "واحة", [[147, 0.13], [294, 0.1], [330, 0.08], [440, 0.075], [587, 0.055]], "+0.07*exp(-1.6*mod(t,6))*sin(2*PI*880*t)*(0.5+0.5*sin(2*PI*0.1*t))"],
  ["am-night", "ليل", [[98, 0.17], [147, 0.12], [196, 0.1], [294, 0.075]], "+0.09*exp(-1.4*mod(t,10))*sin(2*PI*784*t)+0.05*exp(-1.4*mod(t+5,10))*sin(2*PI*1175*t)"],
];
for (const [id, name, notes, extra] of AM) {
  sh(["-f", "lavfi", "-i", `aevalsrc='${pad(notes, extra)}':s=44100:d=60`, "-af", "lowpass=f=2400,aecho=0.8:0.7:480|830:0.35|0.25,volume=6dB,aformat=sample_fmts=fltp:channel_layouts=stereo", "-c:a", "libmp3lame", "-b:a", "112k", path.join(OUT, id + ".mp3")]);
  list.push({ id, name, kind: "ambient", file: id + ".mp3", sec: 60 });
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(list, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(list.length, "ملفّ في", OUT);
