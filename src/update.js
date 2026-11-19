// التحقّق من التحديث: يقرأ آخر إصدار منشور في مستودع GitHub (Releases) ويقارنه بإصدار البرنامج.
// نوعان من الأصول في الإصدار المنشور:
//   Majalis-update-X.Y.Z.zip (+ .sha256)  حزمة خفيفة فيها app.asar (وأيّ ملفّات resources أخرى): تُستبدَل والبرنامج مغلق ثمّ يُعاد تشغيله
//   Majalis-Setup-X.Y.Z.exe               مثبّت كامل: يُحمَّل ويُشغَّل
// الحزمة الخفيفة لا تُطبَّق إلّا بعد مطابقة SHA-256 المنشورة في الإصدار نفسه.
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto"), cp = require("child_process");
const REPO = "reemtech0412C/madjalis";
const UA = { "User-Agent": "Majalis-Updater", Accept: "application/vnd.github+json" };

const ver = v => String(v || "").replace(/^v/i, "").split(/[.\-+]/).map(x => parseInt(x, 10) || 0);
const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };

async function check(current) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: UA });
  if (r.status === 404) return { current, latest: current, available: false, none: true };
  if (!r.ok) throw new Error("تعذّر الاتّصال بالمستودع (" + r.status + ")");
  const j = await r.json(), latest = String(j.tag_name || "").replace(/^v/i, ""), assets = j.assets || [];
  const zip = assets.find(a => /^Majalis-update-.*\.zip$/i.test(a.name)), sha = zip && assets.find(a => a.name === zip.name + ".sha256"), exe = assets.find(a => /^Majalis-Setup-.*\.exe$/i.test(a.name));
  return { current, latest, available: newer(latest, current), notes: String(j.body || "").slice(0, 1500), page: j.html_url, zip: zip && { name: zip.name, url: zip.browser_download_url, size: zip.size, sha: sha && sha.browser_download_url }, exe: exe && { name: exe.name, url: exe.browser_download_url, size: exe.size } };
}
async function download(url, dest, onProgress) {
  const r = await fetch(url, { headers: { "User-Agent": UA["User-Agent"] }, redirect: "follow" });
  if (!r.ok) throw new Error("فشل التحميل (" + r.status + ")");
  const total = Number(r.headers.get("content-length")) || 0; let got = 0;
  const out = fs.createWriteStream(dest), rd = r.body.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; out.write(Buffer.from(value)); got += value.length; onProgress && onProgress(got, total); }
  await new Promise(res => out.end(res));
}
const sha256 = f => new Promise((res, rej) => { const h = crypto.createHash("sha256"); fs.createReadStream(f).on("data", d => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej); });

// info: ناتج check(). ctx: { resourcesDir, exePath, pid, quit() }. onProgress(msg, frac)
async function install(info, ctx, onProgress = () => {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "majalis-upd-"));
  if (info.zip && info.zip.sha) {
    const zipf = path.join(tmp, info.zip.name);
    await download(info.zip.url, zipf, (g, t) => onProgress("تحميل التحديث", t ? g / t : .3));
    const want = (await (await fetch(info.zip.sha, { headers: { "User-Agent": UA["User-Agent"] } })).text()).trim().split(/\s+/)[0].toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(want) || want !== await sha256(zipf)) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error("بصمة الحزمة لا تطابق المنشورة — أُلغي التحديث حفاظاً على سلامة البرنامج"); }
    onProgress("تطبيق التحديث وإعادة التشغيل…", 1);
    // سكربت يعمل بعد إغلاق البرنامج: ينتظر خروجه، يفكّ الحزمة، ينسخ فوق resources، ثمّ يعيد التشغيل
    const ps = path.join(tmp, "apply.ps1"), q = s => "'" + String(s).replace(/'/g, "''") + "'";
    fs.writeFileSync(ps, `$ErrorActionPreference='Stop'
try { Wait-Process -Id ${ctx.pid} -Timeout 60 -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 2
$x = Join-Path ${q(tmp)} 'x'; Expand-Archive -LiteralPath ${q(zipf)} -DestinationPath $x -Force
Copy-Item -Path (Join-Path $x '*') -Destination ${q(ctx.resourcesDir)} -Recurse -Force
Start-Process -FilePath ${q(ctx.exePath)}
`, "utf8");
    cp.spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", ps], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    setTimeout(() => ctx.quit(), 400);
    return { mode: "zip" };
  }
  if (info.exe) {
    const f = path.join(tmp, info.exe.name);
    await download(info.exe.url, f, (g, t) => onProgress("تحميل المثبّت", t ? g / t : .3));
    cp.spawn(f, [], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => ctx.quit(), 400);
    return { mode: "exe" };
  }
  throw new Error("هذا الإصدار لا يحمل ملفّ تحديث (zip أو مثبّت)");
}
module.exports = { REPO, check, install, newer };
