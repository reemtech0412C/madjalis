// «المجالس» — هاتف المجالس: الاقتران برمز QR، حالة الاتصال، وتحكّم عن بُعد بالكاميرا (الدقّة، التقريب، التعريض، القفل).
let PH = null;
const PH_ROLES = [["sheikh", "كاميرا الشيخ", "camSheikh"], ["audience", "كاميرا الحضور", "cam2"]];      // في البودكاست تُسمّى «كاميرا المقدّم / الضيف» (انظر applyModeUI)
const PH_UI = {};

function qrSvg(text) {
  const q = qrcode(0, "M"); q.addData(text, "Byte"); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
const num = v => AR(Math.round(v));

function buildPhone() {
  const box = $("phoneBox"); box.innerHTML = "";
  PH_ROLES.forEach(([role, title, devKey]) => {
    const c = document.createElement("div"); c.className = "phc";
    c.innerHTML = `
      <div class="phh"><b data-pod="${role === "sheikh" ? "كاميرا المقدّم" : "كاميرا الضيف"}">${title}</b><span class="phs"></span></div>
      <div class="pq"><div class="qr"></div><p class="hint">افتح تطبيق «كاميرا المجالس» على الهاتف واضغط «مسح رمز QR»، ووجّهه إلى هذا الرمز.</p></div>
      <div class="pc" hidden>
        <div class="pinfo"></div>
        <button class="use mid"></button>
        <div class="two">
          <label class="fld">الدقّة <select data-k="res"><option value="720">720p</option><option value="1080" selected>1080p</option><option value="1440">1440p</option><option value="2160">4K</option></select></label>
          <label class="fld">الإطارات <select data-k="fps"><option>24</option><option selected>30</option><option>60</option></select></label>
        </div>
        <label class="fld">تقريب <input type="range" min="1" max="5" step=".1" value="1" data-k="zoom"></label>
        <label class="fld">سطوع (تعريض) <input type="range" min="-4" max="4" step="1" value="0" data-k="ev"></label>
        <label class="fld">بورتريه — غبش الخلفيّة <b class="pov"></b> <input type="range" min="0" max="100" step="1" value="0" data-k="portrait"></label>
        <p class="hint ppn" hidden>لم يعمل نموذج فصل الشخص على هذا الهاتف.</p>
        <div class="pl"><button data-l="afLock">تثبيت الفوكس</button><button data-l="aeLock">تثبيت التعريض</button><button data-l="awbLock">تثبيت اللون</button></div>
        <div class="two"><button data-a="lens" class="mid">تبديل العدسة</button><button data-a="stop" class="mid danger">قطع الهاتف</button></div>
      </div>`;
    box.appendChild(c);
    const u = PH_UI[role] = { c, st: c.querySelector(".phs"), q: c.querySelector(".pq"), qr: c.querySelector(".qr"), p: c.querySelector(".pc"), info: c.querySelector(".pinfo"), use: c.querySelector(".use"), uri: "", locks: {}, lens: "back" };
    const send = cmd => api.call("phone:cmd", role, cmd);
    c.querySelectorAll("select[data-k]").forEach(s => s.onchange = () => send(s.dataset.k === "res" ? { cmd: "quality", res: +s.value, fps: +c.querySelector('[data-k=fps]').value } : { cmd: "quality", res: +c.querySelector('[data-k=res]').value, fps: +s.value }));
    const pfs = v => v > 0 ? "f/" + (16 * Math.pow(1.4 / 16, v / 100)).toFixed(1) + " · " + v + "٪" : "مُطفأ";
    c.querySelectorAll("input[data-k]").forEach(i => { let t; i.oninput = () => { if (i.dataset.k === "portrait") c.querySelector(".pov").textContent = pfs(+i.value); i.dataset.touch = Date.now(); clearTimeout(t); t = setTimeout(() => send({ cmd: i.dataset.k, v: +i.value }), 120); }; });
    c.querySelectorAll("button[data-l]").forEach(b => b.onclick = () => { const k = b.dataset.l; u.locks[k] = !u.locks[k]; b.classList.toggle("on", u.locks[k]); send({ cmd: k, v: u.locks[k] }); });
    c.querySelector('[data-a=lens]').onclick = () => { u.lens = u.lens === "back" ? "front" : "back"; send({ cmd: "lens", v: u.lens }); };
    c.querySelector('[data-a=stop]').onclick = () => send({ cmd: "stop" });
    u.use.onclick = () => {
      const phone = { id: "phone:" + role, name: "هاتف المجالس", phone: true };
      patch({ devices: { [devKey]: phone } }).then(() => { toast("تُطبَّق كاميرا الهاتف…"); loadDevices && loadDevices(); renderPhone(); });
    };
  });
  $("phUsb").onclick = async () => {
    toast("جارٍ تهيئة USB…"); const r = await api.call("phone:usb");
    toast(r.ok ? `جاهز: ${AR(r.devices.filter(d => d.reversed).length)} هاتف عبر الكابل — افتح التطبيق واضغط «ابدأ البثّ»` : r.err, 5000);
  };
  $("phInstall").onclick = async () => {
    toast("جارٍ تثبيت التطبيق على الهاتف…", 8000); const r = await api.call("phone:install");
    toast(r.ok ? "ثُبّت التطبيق وفُتح على الهاتف ✓" : "تعذّر التثبيت: " + r.err, 6000);
  };
  $("phRegen").onclick = async () => { if (!confirm("رمز جديد يفصل الهواتف المقترنة. متابعة؟")) return; PH = await api.call("phone:regen"); renderPhone(); toast("أُنشئ رمز جديد — امسحه من الهاتف"); };
  $("phUsbAuto").onchange = async e => { PH = await api.call("phone:usbAuto", e.target.checked); renderPhone(); };
}

function renderPhone() {
  if (!PH || !PH_UI.sheikh) return;
  $("phHost").textContent = `منفذ الاستقبال ${AR(PH.port)} · عناوين الكمبيوتر: ${PH.ips.length ? PH.ips.join("، ") : "لا توجد شبكة"}`;
  $("phUsbAuto").checked = !!PH.usbAuto;
  PH_ROLES.forEach(([role, title, devKey]) => {
    const u = PH_UI[role], p = PH.phones[role];
    if (u.uri !== PH.uri[role]) { u.uri = PH.uri[role]; u.qr.innerHTML = qrSvg(u.uri); }
    u.st.textContent = p ? (p.live ? "● يبثّ" : "● متّصل") : "غير متّصل"; u.st.className = "phs " + (p ? (p.live ? "live" : "on") : "");
    u.q.hidden = !!p; u.p.hidden = !p;
    if (p) {
      const rot = p.rot ? ` · تدوير ${AR(p.rot)}°` : "";
      u.info.innerHTML = `<b>${esc(p.name)}</b><br>${p.w ? AR(p.w) + "×" + AR(p.h) : "—"}${rot} · ${num(p.fps || 0)} إطار/ث · ${num(p.kbps || 0)} كيلوبت/ث` +
        `<br>البطّارية ${p.bat != null ? AR(p.bat) + "٪" : "—"} · تأخير الشبكة ${p.rtt != null ? AR(p.rtt) + " م.ث" : "—"}${p.drop ? " · أُسقط " + AR(p.drop) + " إطار" : ""}`;
      const used = S().devices[devKey] && S().devices[devKey].phone;
      const pod = typeof curMode === "function" && curMode() === "podcast", who = role === "sheikh" ? (pod ? "المقدّم" : "الشيخ") : (pod ? "الضيف" : "الحضور");
      u.use.textContent = used ? `✓ يُستخدم ككاميرا ${who}` : `استخدمه ككاميرا ${who}`;
      u.use.className = "use mid" + (used ? " on" : "");
      const ps = u.c.querySelector("[data-k=portrait]"); if (ps && p.portrait != null && Date.now() - (+ps.dataset.touch || 0) > 1500) { ps.value = p.portrait; u.c.querySelector(".pov").textContent = p.portrait > 0 ? "f/" + (16 * Math.pow(1.4 / 16, p.portrait / 100)).toFixed(1) + " · " + p.portrait + "٪" : "مُطفأ"; }
      u.c.querySelector(".ppn").hidden = p.portraitOk !== false;
    }
  });
}

async function initPhone() {
  buildPhone(); if (typeof podLabels === "function") podLabels();
  api.on("phone", st => { PH = st; renderPhone(); });
  PH = await api.call("phone:info"); renderPhone();
}
