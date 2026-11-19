// «المجالس» — الإعدادات العامة: ألوان البرنامج، التسجيل والمجلّدات، الترخيص والتفعيل، وحول البرنامج.
// تُفتح من زرّ بجانب اسم البرنامج في الصفحة الرئيسيّة (اختيار القسم).

// ---------- ألوان الواجهة ----------
// كل الأخضر الداكن في app.css صار متغيّرات (--cXXXXXX)؛ المظهر يعيد تلوينها بتغيير الصبغة (H) وشدّة اللون (sf) مع بقاء الإضاءة، فتبقى العلاقات بين الخلفية والبطاقات والحدود كما صُمّمت.
const UI_THEMES = {
  green: { name: "أخضر (الحاليّ)", H: null },
  navy: { name: "كحلي ملكي", H: 218, sf: 1.15 },
  burgundy: { name: "عنّابي", H: 348, sf: 1.0 },
  purple: { name: "بنفسجي داكن", H: 268, sf: 1.0 },
  coffee: { name: "قهوة داكنة", H: 28, sf: 0.8 },
  graphite: { name: "فحمي محايد", H: 215, sf: 0.12 },
};
function uiShift(hex, th) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let S = d ? d / (1 - Math.abs(2 * l - 1)) : 0; S = Math.min(1, S * th.sf);
  const c = (1 - Math.abs(2 * l - 1)) * S, x = c * (1 - Math.abs((th.H / 60) % 2 - 1)), m = l - c / 2, k = Math.floor(th.H / 60) % 6;
  const [R, G, B] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return "#" + [R, G, B].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}
let UI_VARS = null;
function uiVars() {                                            // أسماء متغيّرات الألوان من كتلة :root (الاسم نفسه يحمل القيمة الأصليّة)
  if (UI_VARS) return UI_VARS;
  const out = [];
  for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; }
    for (const r of rules) if (r.selectorText === ":root") for (const p of r.style) if (/^--c[0-9a-f]{6}$/.test(p)) out.push([p, "#" + p.slice(3)]); }
  return UI_VARS = out;
}
const UI_BASE = [["--bg", "#0A1311"], ["--bg2", "#0E1B18"], ["--card", "#13241F"], ["--card2", "#192F28"], ["--line", "#25453D"]];
function applyUiTheme(key) {
  const th = UI_THEMES[key] || UI_THEMES.green, root = document.documentElement.style;
  for (const [p, hex] of uiVars().concat(UI_BASE)) { if (th.H == null) root.removeProperty(p); else root.setProperty(p, uiShift(hex, th)); }
  try { localStorage.setItem("uiTheme", key in UI_THEMES ? key : "green"); } catch {}
}
try { const k = localStorage.getItem("uiTheme"); if (k && k !== "green") applyUiTheme(k); } catch {}          // بلا وميض عند الفتح

// ---------- الصفحة ----------
function openGeneral() {
  let ov = $("generalView");
  if (!ov) { ov = document.createElement("div"); ov.id = "generalView"; document.body.appendChild(ov); }
  ov.hidden = false; renderGeneral();
}
async function renderGeneral() {
  const ov = $("generalView"); if (!ov) return;
  const cur = S().uiTheme || "green";
  const swatch = k => { const th = UI_THEMES[k], f = (hex) => th.H == null ? hex : uiShift(hex, th); return `<span class="uts" style="background:linear-gradient(135deg,${f("#0A1311")} 0 38%,${f("#13241F")} 38% 70%,${f("#25453D")} 70%)"></span>`; };
  ov.innerHTML = `<div class="hub-in gen-in">
    <div class="hub-top"><img src="logo.png" class="hub-logo" alt="المجالس"><div class="grow"></div><button id="genBack" class="mid">‹ العودة</button></div>
    <h1>الإعدادات العامة</h1><p class="hint">ما يخصّ البرنامج كلّه، لا درساً بعينه.</p>
    <div class="gen-grid">
      <section class="gen-card"><h2>ألوان البرنامج</h2><p class="hint">لون الخلفية والبطاقات والحدود في كل واجهات البرنامج. لا يغيّر شكل البثّ نفسه.</p>
        <div class="utheme">${Object.keys(UI_THEMES).map(k => `<button class="opt${k === cur ? " on" : ""}" data-k="${k}">${swatch(k)}<span>${UI_THEMES[k].name}</span></button>`).join("")}</div></section>
      <section class="gen-card" id="genRec"><h2>التسجيل والمجلّدات</h2></section>
      <section class="gen-card" id="genLic"><h2>الترخيص والتفعيل</h2><div class="hint">جارٍ القراءة…</div></section>
      <section class="gen-card" id="genAbout"><h2>حول البرنامج</h2><div class="hint">جارٍ القراءة…</div></section>
    </div></div>`;
  $("genBack").onclick = () => { ov.hidden = true; };
  ov.querySelectorAll(".utheme .opt").forEach(b => b.onclick = async () => { applyUiTheme(b.dataset.k); await patch({ uiTheme: b.dataset.k }); renderGeneral(); toast("تغيّر لون البرنامج"); });
  // التسجيل والمجلّدات (كانت في تبويب «البثّ»)
  const rec = $("genRec"); rec.appendChild(tsSwitch("تسجيل تلقائيّ عند بدء البثّ المباشر", !!S().autoRec, on => patch({ autoRec: on }).then(() => toast(on ? "سيبدأ التسجيل تلقائيّاً مع البثّ" : "أُلغي التسجيل التلقائيّ مع البثّ")))); rec.appendChild(dirsBox());
  // الترخيص
  api.call("lic:status").then(st => {
    const box = $("genLic"); if (!box) return; const f = d => new Date(d).toLocaleDateString("ar-u-nu-latn");
    const rows = [];
    if (st.dev) rows.push(["الحالة", "نسخة التطوير — بلا ترخيص"]);
    else rows.push(["الحالة", st.ok ? "✓ مُفعَّل" : "غير مُفعَّل" + (st.err ? " — " + st.err : "")], ...(st.ok ? [["مُرخَّص لـ", st.name || "—"], ["عدد الأجهزة في الترخيص", String(st.devices)], ["الصلاحيّة", st.exp ? "حتى " + f(st.exp) : "دائم"]] : []));
    rows.push(["رمز هذا الجهاز", st.code]);
    box.innerHTML = "<h2>الترخيص والتفعيل</h2>" + rows.map(([a, b]) => `<div class="kv"><span>${a}</span><b dir="auto">${esc(b)}</b></div>`).join("") +
      `<div class="two" style="margin-top:12px"><button class="mid" id="lcCopy">نسخ رمز الجهاز</button><button class="mid" id="lcNew">إدخال كود تفعيل جديد</button></div>
       <div id="lcForm" hidden><textarea id="lcKey" rows="3" dir="ltr" placeholder="الصق كود التفعيل هنا" style="margin-top:10px"></textarea><div class="two"><button class="mid pri" id="lcSave">تفعيل</button><button class="mid" id="lcCancel">إلغاء</button></div><div id="lcMsg" class="hint"></div></div>`;
    $("lcCopy").onclick = () => { navigator.clipboard.writeText(st.code).then(() => toast("نُسخ رمز الجهاز")); };
    $("lcNew").onclick = () => { $("lcForm").hidden = false; $("lcKey").focus(); }; $("lcCancel").onclick = () => { $("lcForm").hidden = true; };
    $("lcSave").onclick = async () => { const r = await api.call("lic:set", $("lcKey").value.trim()); $("lcMsg").textContent = r.ok ? "تمّ التفعيل ✓" : "⚠ " + r.err; if (r.ok) setTimeout(renderGeneral, 900); };
  }).catch(() => {});
  // حول
  api.call("app:about").then(a => {
    const box = $("genAbout"); if (!box) return;
    box.innerHTML = `<h2>حول البرنامج</h2><div class="about-head"><img src="logo.png" alt=""><div><b>المجالس</b><small>بثّ وتسجيل الدروس والخطب والمحاضرات</small></div></div>
      ${[["الإصدار", a.version], ["الشركة المطوِّرة", "YamiTech"], ["واتساب الدعم", a.phone], ["البريد", a.email], ["النظام", a.platform], ["Electron / Chromium", a.electron + " / " + a.chrome]].map(([k, v]) => `<div class="kv"><span>${k}</span><b dir="ltr">${esc(v)}</b></div>`).join("")}
      <div class="two" style="margin-top:12px"><button class="mid" id="abMail">مراسلة الدعم</button><button class="mid pri" id="abUpd">⟳ تحقّق من التحديث</button></div><p class="hint" id="abUpdMsg" style="margin-top:8px"></p><p class="hint" style="margin-top:10px">© 2026 YamiTech. جميع الحقوق محفوظة.</p>`;
    $("abMail").onclick = () => api.call("open:external", "mailto:" + a.email);
    const msg = $("abUpdMsg"), btn = $("abUpd"); api.on("update:progress", d => { msg.textContent = d.m + (d.p != null && d.p < 1 ? " " + Math.round(d.p * 100) + "٪" : ""); });
    btn.onclick = async () => {
      btn.disabled = true; msg.textContent = "جارٍ التحقّق…";
      try {
        const u = await api.call("update:check");
        if (u.none) { msg.textContent = "لا توجد إصدارات منشورة في المستودع بعد."; }
        else if (!u.available) { msg.textContent = "أنت على آخر إصدار (" + u.current + ")."; }
        else {
          msg.innerHTML = "يتوفّر الإصدار <b>" + esc(u.latest) + "</b> (الحاليّ " + esc(u.current) + ")" + (u.notes ? "<br><small>" + esc(u.notes).split("\n").join("<br>") + "</small>" : "");
          const go = document.createElement("button"); go.className = "mid pri"; go.style.marginTop = "8px"; go.textContent = u.zip ? "تحديث الآن (حزمة خفيفة)" : "تحميل المثبّت وتشغيله";
          go.onclick = async () => { go.disabled = true; try { await api.call("update:install"); msg.textContent = "يُغلق البرنامج ثمّ يعيد التشغيل بالتحديث…"; } catch (e) { msg.textContent = e.message; go.disabled = false; } };
          msg.appendChild(document.createElement("br")); msg.appendChild(go);
        }
      } catch (e) { msg.textContent = e.message; } finally { btn.disabled = false; }
    };
  }).catch(() => {});
}
