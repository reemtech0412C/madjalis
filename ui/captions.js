// «المجالس» — الترجمة النصّيّة الحيّة: التقاط الميكروفون، كشف الكلام، تقطيعه إلى مقاطع WAV، وإرسالها للتفريغ.
const CAP_LANGS = [["ar", "العربيّة"], ["fr", "Français"]];
let CAP_KEY = false;
const CAP = { stats: { sent: 0, quiet: 0, peak: 0, drop: "" }, ctx: null, stream: null, node: null, running: false };
const CAP_SR = 16000, CAP_FR = 4096;

const capCfg = () => S().captions;
const capPatch = p => patch({ captions: p });

function wavOf(chunks) {
  let n = 0; for (const c of chunks) n += c.length;
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, CAP_SR, true); v.setUint32(28, CAP_SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) { const x = Math.max(-1, Math.min(1, c[i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7FFF, true); }
  return buf;
}

async function capStart() {
  if (CAP.running) return;
  const c = capCfg();
  try {
    // الميكروفون هو مايك الشيخ نفسه (تبويب الأجهزة): نطابق اسمه مع أجهزة المتصفّح، وإلّا الافتراضيّ
    const id = await capMicId();
    CAP.stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  } catch (e) { capState("تعذّر فتح الميكروفون: " + e.message, true); return; }
  CAP.ctx = new AudioContext({ sampleRate: CAP_SR });
  const src = CAP.ctx.createMediaStreamSource(CAP.stream);
  const node = CAP.node = CAP.ctx.createScriptProcessor(CAP_FR, 1, 1);
  // كاشف كلام بسيط: عتبة تتكيّف مع ضوضاء الغرفة. المقطع يبدأ بقبل الكلام بثلاث إطارات وينتهي بصمت ~0٫8ث
  let pre = [], buf = [], speaking = false, silent = 0, voiced = 0, floor = 0.004, peak = 0;
  const flush = () => {
    if (voiced >= 3 && peak >= 0.015 && buf.length) { const sec = buf.length * CAP_FR / CAP_SR; CAP.stats.sent++; api.call("cap:audio", wavOf(buf), sec).catch(() => {}); capInfo(); }
    else if (buf.length) { CAP.stats.quiet++; capInfo(); }
    buf = []; speaking = false; silent = 0; voiced = 0; peak = 0;
  };
  node.onaudioprocess = e => {
    const x = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0; for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
    const rms = Math.sqrt(sum / x.length);
    const m = $("capMeter"); if (m) m.style.width = Math.min(100, rms * 700) + "%";
    CAP.stats.peak = Math.max(rms, CAP.stats.peak * 0.97);
    const voice = rms > Math.max(0.010, floor * 3);
    if (!speaking) {
      floor = floor * 0.95 + rms * 0.05;
      pre.push(x); if (pre.length > 3) pre.shift();
      if (voice) { speaking = true; buf = pre.slice(); pre = []; silent = 0; voiced = 1; peak = rms; }
    } else {
      buf.push(x);
      if (voice) { voiced++; silent = 0; peak = Math.max(peak, rms); } else silent++;
      const len = buf.length * CAP_FR / CAP_SR;
      if ((silent >= 3 && len >= 2) || (len >= 9 && silent >= 1) || len >= 14 || silent >= 8) flush();
    }
  };
  src.connect(node); node.connect(CAP.ctx.destination);        // المعالج يحتاج وصلة خرج ليعمل؛ لا صوت يخرج (المخرج صامت)
  CAP.running = true;
  capState("يستمع…");
}

function capStop() {
  if (!CAP.running) return;
  try { CAP.node.disconnect(); } catch {}
  try { CAP.stream.getTracks().forEach(t => t.stop()); } catch {}
  try { CAP.ctx.close(); } catch {}
  CAP.running = false; CAP.ctx = CAP.stream = CAP.node = null;
  const m = $("capMeter"); if (m) m.style.width = "0";
  capState("");
}

function capInfo() {
  const s = CAP.stats, e = $("capInfo"); if (!e) return;
  e.textContent = `مقاطع أُرسلت: ${s.sent} · أُهمل لضعفه: ${s.quiet}` + (s.drop ? ` · آخر مُسقَط: «${s.drop}»` : "");
}

function capState(t, bad) { const e = $("capState"); if (e) { e.textContent = t; e.style.color = bad ? "var(--bad,#FF8A80)" : ""; } }

function capSync() {
  const c = capCfg();
  const need = c.on || (typeof curMode === "function" && curMode() === "quran" && !!(S().quran || {}).follow);      // الترجمة أو تتبّع التلاوة
  if (need && CAP_KEY) capStart(); else capStop();
  if (need && !CAP_KEY) capState("احفظ مفتاح Groq أوّلاً", true);
}

function capLangs() {
  const c = capCfg(), box = $("capLangs"); box.innerHTML = "";
  for (const [code, name] of CAP_LANGS) {
    const b = document.createElement("button"); b.textContent = name + (code === "ar" ? " (الأصل)" : " (ترجمة)"); b.classList.toggle("on", c.langs.includes(code));
    b.onclick = async () => {
      let l = capCfg().langs.slice();
      if (l.includes(code)) l = l.filter(x => x !== code); else l.push(code);
      if (!l.length) l = ["ar"];                       // لا بدّ من لغة واحدة على الأقلّ
      await capPatch({ langs: l }); capLangs();
    };
    box.appendChild(b);
  }
}

// معرّف جهاز المتصفّح لمايك الشيخ: مطابقة الاسم (بعد حذف بادئات «Default - / Communications -» وعلامات الترقيم)
async function capMicId() {
  const dv = S().devices.micSheikh; if (!dv || !dv.name || dv.id === "default") return "";
  try { const t = await navigator.mediaDevices.getUserMedia({ audio: true }); t.getTracks().forEach(x => x.stop()); } catch {}
  const norm = s => String(s || "").toLowerCase().replace(/^(default|communications)\s*-\s*/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications"), n = norm(dv.name);
  const m = devs.find(d => norm(d.label) === n) || devs.find(d => { const l = norm(d.label); return l && (l.includes(n) || n.includes(l)); });
  return m ? m.deviceId : "";
}

function capKeyUi() {
  $("capKeyBadge").textContent = CAP_KEY ? "· مدمج في البرنامج ✓" : "· غير مدمج بعد";
  $("capKeyForm").hidden = CAP_KEY;
  $("capTest").hidden = !CAP_KEY;
  $("capKeyHint").innerHTML = CAP_KEY ? "المفتاح محفوظ داخل البرنامج (ملفّ <b>groq.key</b> في مجلّده) ولا يُطلب منك مجدّداً." : "تقنيّة التفريغ Whisper large-v3 على خوادم Groq، <b>مجّانيّة بلا بطاقة</b>. أنشئ مفتاحاً (يبدأ بـ gsk_) والصقه <b>مرّة واحدة</b> فيُدمج في البرنامج.";
}

async function initCaptions() {
  CAP_KEY = await api.call("cap:hasKey");
  const c = capCfg();
  $("capOn").checked = !!c.on; $("capSize").value = c.size; $("capPos").value = c.pos;
  $("capLift").value = c.lift; $("capModel").value = c.model; $("capHint").checked = c.hint !== false; $("capSave").checked = c.save !== false;
  capKeyUi(); capLangs();
  $("capOn").onchange = async e => { await capPatch({ on: e.target.checked }); capSync(); };
  $("capSaveKey").onclick = async () => {
    const st = $("capKeyState"); st.style.color = "";
    try { await api.call("cap:setKey", $("capKey").value); $("capKey").value = ""; CAP_KEY = true; capKeyUi(); st.textContent = ""; capSync(); toast("حُفظ المفتاح داخل البرنامج"); }
    catch (e) { st.style.color = "var(--bad,#FF8A80)"; st.textContent = "✗ " + e.message; }
  };
  $("capGet").onclick = () => api.call("open:external", "https://console.groq.com/keys");
  $("capTest").onclick = async () => {
    const st = $("capKeyState"); st.style.color = ""; st.textContent = "جارٍ الاختبار…";
    try { const r = await api.call("cap:test"); st.style.color = "var(--ok,#3DCB8B)"; st.textContent = "✓ المفتاح يعمل — Whisper متاح"; }
    catch (e) { st.style.color = "var(--bad,#FF8A80)"; st.textContent = "✗ " + e.message; }
  };
  for (const [id, k] of [["capSize", "size"], ["capPos", "pos"], ["capModel", "model"]]) $(id).onchange = e => capPatch({ [k]: e.target.value });
  $("capLift").oninput = e => capPatch({ lift: +e.target.value });
  $("capHint").onchange = e => capPatch({ hint: e.target.checked });
  $("capSave").onchange = e => capPatch({ save: e.target.checked });
  $("capPrev").onclick = () => api.call("cap:preview");
  api.on("cap:line", d => {
    if (d.preview) return;
    const f = $("capFeed"), id = "cl" + d.id;
    let row = document.getElementById(id);
    if (!row) { row = document.createElement("div"); row.id = id; f.prepend(row); while (f.children.length > 12) f.lastChild.remove(); }
    row.innerHTML = esc(d.text).replace(/\n/g, "<br>") + Object.entries(d.tr || {}).map(([l, t]) => `<small>${l}: ${esc(t).replace(/\n/g, "<br>")}</small>`).join("");
  });
  api.on("cap:status", d => {
    if (d.drop) { CAP.stats.drop = d.drop; capInfo(); } if (d.error) capState("⚠ " + d.error, true); else if (CAP.running) capState("يستمع…"); });
  capSync();
}
