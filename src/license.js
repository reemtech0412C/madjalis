// ترخيص «المجالس»: مرتبط بالجهاز ويعمل دون إنترنت.
//   • رمز الجهاز: بصمة ثابتة مشتقّة من MachineGuid الخاصّ بويندوز (XXXX-XXXX-XXXX-XXXX).
//   • مفتاح التفعيل: بيانات موقَّعة بمفتاح Ed25519 خاصّ بصاحب البرنامج وحده (لا يوجد المفتاح الخاصّ في هذا البرنامج) تحمل
//     حتى 3 رموز أجهزة وتاريخ انتهاء اختياريّاً واسم العميل. البرنامج يتحقّق بالمفتاح العامّ المضمَّن هنا فقط.
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

const PUBLIC_DER = Buffer.from("MCowBQYDK2VwAyEA41cixRVPUeBxH7iqdtvnAEyk3pA0mRvIynov1CO7dWA=", "base64");
const PUB = crypto.createPublicKey({ key: PUBLIC_DER, format: "der", type: "spki" });
const EPOCH = Date.UTC(2024, 0, 1);                     // أيّام الانتهاء تُعدّ من هذا التاريخ
const MAX_DEVICES = 3;
const SUPPORT_EMAIL = "yaqobdullah@gmail.com";
const SUPPORT_PHONE = "+23599217725";                 // واتساب

let _id = null;
/** رمز الجهاز: 8 بايت (16 خانة ست‌عشريّة) */
function deviceId() {
  if (_id) return _id;
  let guid = "";
  try { guid = (execFileSync("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], { encoding: "utf8", windowsHide: true, timeout: 6000 }).match(/MachineGuid\s+REG_SZ\s+(\S+)/) || [])[1] || ""; } catch {}
  if (!guid) guid = os.hostname() + "|" + ((os.cpus()[0] || {}).model || "");        // احتياط نادر
  _id = crypto.createHash("sha256").update("MAJALIS|" + guid.toLowerCase()).digest("hex").slice(0, 16).toUpperCase();
  return _id;
}
const fmtId = h => h.match(/.{4}/g).join("-");
const normId = s => String(s || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
const deviceCode = () => fmtId(deviceId());

/** يفكّ المفتاح ويتحقّق من التوقيع. يرجع { ok, devs, exp, name } أو { ok:false, err } */
function parse(key) {
  let raw;
  try { raw = Buffer.from(String(key || "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64"); } catch { return { ok: false, err: "الكود غير صحيح" }; }
  if (raw.length < 6 + 64) return { ok: false, err: "الكود غير صحيح أو ناقص" };
  const data = raw.subarray(0, raw.length - 64), sig = raw.subarray(raw.length - 64);
  let valid = false; try { valid = crypto.verify(null, data, PUB, sig); } catch {}
  if (!valid) return { ok: false, err: "الكود غير صحيح (التوقيع لا يطابق)" };
  if (data[0] !== 0x4D || data[1] !== 1) return { ok: false, err: "إصدار الكود غير مدعوم" };
  const expDays = data.readUInt16BE(2), n = data[4];
  if (n < 1 || n > MAX_DEVICES || data.length < 5 + n * 8 + 1) return { ok: false, err: "الكود تالف" };
  const devs = []; for (let i = 0; i < n; i++) devs.push(data.subarray(5 + i * 8, 13 + i * 8).toString("hex").toUpperCase());
  const nl = data[5 + n * 8], name = data.subarray(6 + n * 8, 6 + n * 8 + nl).toString("utf8");
  return { ok: true, devs, exp: expDays ? EPOCH + expDays * 86400000 : 0, name };
}

/** هل المفتاح صالح لهذا الجهاز الآن؟ */
function check(key) {
  const p = parse(key); if (!p.ok) return p;
  if (!p.devs.includes(deviceId())) return { ok: false, err: "هذا الكود صادر لجهاز آخر. أرسل رمز هذا الجهاز لإصدار كود له." };
  if (p.exp && Date.now() > p.exp) return { ok: false, err: "انتهت صلاحيّة هذا الكود بتاريخ " + new Date(p.exp).toLocaleDateString("ar-u-nu-latn") + "." };
  return p;
}

/** ملفّ الترخيص المحفوظ + حارس ضدّ إرجاع ساعة الجهاز */
function load(dir) {
  const f = dir + "/license.key", t = dir + "/.lt";
  let key = ""; try { key = fs.readFileSync(f, "utf8"); } catch { return { ok: false, err: "" }; }
  const r = check(key); if (!r.ok) return r;
  let last = 0; try { last = +fs.readFileSync(t, "utf8") || 0; } catch {}
  if (last && Date.now() < last - 36 * 3600 * 1000) return { ok: false, err: "ساعة الجهاز مضبوطة على وقت سابق. اضبط التاريخ والوقت ثمّ أعد التشغيل." };
  try { fs.writeFileSync(t, String(Math.max(last, Date.now()))); } catch {}
  return r;
}
function save(dir, key) { const r = check(key); if (r.ok) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(dir + "/license.key", String(key).replace(/\s+/g, "")); try { fs.writeFileSync(dir + "/.lt", String(Date.now())); } catch {} } return r; }

module.exports = { deviceCode, deviceId, check, load, save, parse, normId, fmtId, MAX_DEVICES, SUPPORT_EMAIL, SUPPORT_PHONE, EPOCH };
