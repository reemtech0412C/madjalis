// «المجالس» — شاشة الحلقات (أوّل ما يظهر) + نافذة الإدخال + تخصيص شاشات قبل البثّ/الاستراحة/الختام.
// يعتمد على دوال app.js (ST, S, api, toast, esc, AR, patch, makeLogoCut, loadMeta…) وتُستدعى بعد تحميلها.

const hop = async (op, ...args) => { const r = window.LABSB ? await api.call("lab:sbx:op", LABSB.pid, op, ...args) : await api.call("halaqat:op", op, ...args); ST.settings = r.settings; if (window.LABSB && LABSB.changed) LABSB.changed(); return r.result; };
const cur = () => {
  const s = S();
  if (s.mode && s.mode !== "lessons" && s.modes && s.modes[s.mode]) { const m = s.modes[s.mode]; return { h: Object.assign({ id: "mode:" + s.mode, name: (MODES[s.mode] || {}).name, books: [] }, m, { mosque: m.mosque || m.org || "" }), b: null, s: null }; }
  const q = s.sel || {}, h = (s.halaqat || []).find(x => x.id === q.h) || null;
  const b = h && h.books.find(x => x.id === q.b) || null, ss = b && b.sessions.find(x => x.id === q.s) || null;
  return { h, b, s: ss };
};
const sessName = s => [s.scope, s.session].filter(Boolean).join(" · ") || "مجلس";

// بعد أيّ تغيير في المختار: نعيد رسم كل ما يعتمد على بيانات الدرس والكتاب
async function reloadAll() {
  ST = await stateGet();
  renderTexts(); renderScreens(); renderCrumb(); renderLogos();
  await loadMeta(); renderShelf();
}

// ---------- نافذة إدخال بسيطة ----------
function askForm(title, fields, ok = "حفظ") {
  return new Promise(res => {
    const box = $("dlg"), f = $("dlgForm");
    f.className = fields.length > 3 ? "wide" : "";
    f.innerHTML = `<h3>${esc(title)}</h3><div class="fgrid">` + fields.map(x => `<label class="fld">${esc(x.label)}<input name="${x.k}" value="${esc(x.val || "")}" placeholder="${esc(x.ph || "")}" ${x.type ? `type="${x.type}"` : ""} autocomplete="off"></label>`).join("")
      + `</div><div class="two"><button type="submit" class="pri">${esc(ok)}</button><button type="button" id="dlgNo">إلغاء</button></div>`;
    box.hidden = false;
    const close = v => { box.hidden = true; f.onsubmit = null; res(v); };
    f.onsubmit = e => { e.preventDefault(); const o = {}; fields.forEach(x => o[x.k] = f.elements[x.k].value.trim()); close(o); };
    $("dlgNo").onclick = () => close(null);
    const first = f.querySelector("input"); if (first) { first.focus(); first.select(); }
  });
}
const sure = msg => confirm(msg);

// ---------- الحلقة المختارة في الرأس ----------
function renderCrumb() {
  const { h, b, s } = cur(), c = $("crumb");
  if (!inLessons()) { const m = S().modes[curMode()]; c.querySelector(".tx").textContent = [MODES[curMode()].name, curMode() === "khutba" ? (m.mosque || m.khatib) : (m.title || m.lecturer)].filter(Boolean).join("  ›  "); c.title = "تبديل القسم"; return; }
  c.querySelector(".tx").textContent = h ? [h.name, b && b.title, s && sessName(s)].filter(Boolean).join("  ›  ") : "اختر الحلقة";
  c.title = "الحلقات والكتب والمجالس";
}

// ---------- شاشة الحلقات ----------
let HUB = { view: "list", hid: null };
function openHub(view = "list", hid = null) {
  const { h } = cur();
  HUB = view === "halaqa" && hid ? { view, hid } : (view === "current" && h ? { view: "halaqa", hid: h.id } : { view: "list", hid: null });
  $("hub").hidden = false; renderHub();
}
function closeHub() { if (!cur().s) return toast("اختر مجلساً أوّلاً"); $("hub").hidden = true; }

async function enter(h, b, s) {
  try { await hop("select", h.id, b.id, s && s.id); await reloadAll(); $("hub").hidden = true; toast("المجلس في البثّ ✓"); }
  catch (e) { toast(e.message); }
}

function renderHub() {
  const hub = $("hub"), halaqat = S().halaqat || [];
  const { h: ch, b: cb, s: cs } = cur();
  const top = `<div class="hub-top"><img src="logo.png" class="hub-logo" alt="المجالس"><div class="grow"></div>${cs ? `<button id="hubClose" class="mid">العودة لغرفة التحكّم</button>` : ""}</div>`;
  let body = "";
  if (HUB.view === "list") {
    body = `<h1>اختر الحلقة العلميّة</h1><p class="hint">كل حلقة تحفظ كتبها ومجالسها وإعداداتها، فلا تُعاد في كل تسجيل.</p>`;
    if (cs) body += `<button id="hubResume" class="resume"><span>متابعة آخر مجلس</span><b>${esc(ch.name)}</b><small>${esc(cb.title || "")} · ${esc(sessName(cs))}</small></button>`;
    body += `<div class="hub-grid">` + halaqat.map(h => {
      const nb = h.books.length, ns = h.books.reduce((a, b) => a + b.sessions.length, 0);
      return `<div class="hcard" data-h="${h.id}" tabindex="0"><b>${esc(h.name)}</b><small>${h.mosque ? esc(h.mosque) + " · " : ""}${AR(nb)} كتاب · ${AR(ns)} مجلس</small><div class="cact"><button data-a="he">✎ تعديل</button><button data-a="hd" class="danger">🗑 حذف</button></div></div>`;
    }).join("") + `<button class="hcard add" id="hubNew"><span class="plus">＋</span><b>إنشاء حلقة</b></button></div>`;
  } else {
    const h = halaqat.find(x => x.id === HUB.hid);
    if (!h) { HUB = { view: "list", hid: null }; return renderHub(); }
    body = `<div class="hub-bar"><button id="hubBack">‹ الحلقات</button><div class="grow"></div><button id="hEdit">تعديل الحلقة</button><button id="hDel" class="danger">حذف</button></div>
      <h1>${esc(h.name)}</h1><p class="hint">${h.mosque ? esc(h.mosque) : "لم يُحدَّد المسجد — يمكنك إضافته من «تعديل الحلقة»"}</p>`;
    body += `<h2>الكتب المدرَّسة</h2>`;
    body += h.books.length ? h.books.map(b => `<section class="hbook" data-b="${b.id}">
        <div class="hb-head"><div><b>${esc(b.title)}</b><small>${[b.program, [b.sheikhTitle, b.sheikh].filter(Boolean).join(" ")].filter(Boolean).map(esc).join(" — ")}</small></div>
          <div class="grow"></div><button data-a="newS">＋ مجلس جديد</button><button data-a="editB">تعديل</button><button data-a="delB" class="danger">حذف</button></div>
        <div class="hb-sessions">${b.sessions.length ? b.sessions.slice().reverse().map(s => `<div class="hs ${cs && cs.id === s.id ? "cur" : ""}" data-s="${s.id}">
            <button class="open" data-a="open"><b>${esc(s.session || "مجلس")}</b><span>${esc(s.scope || "—")}${s.date ? " · " + esc(s.date) : ""}</span></button>
            <button class="ib" data-a="editS" title="تعديل">✎</button><button class="ib danger" data-a="delS" title="حذف">🗑</button></div>`).join("") : `<p class="hint">لا مجالس بعد.</p>`}</div></section>`).join("")
      : `<p class="hint">لم تُضف كتباً لهذه الحلقة بعد.</p>`;
    body += `<button id="hNewBook" class="big pri">＋ إضافة كتاب</button>`;
  }
  hub.innerHTML = `<div class="hub-in">${top}${body}</div>`;
  const q = (s, fn) => { const e = hub.querySelector(s); if (e) e.onclick = fn; };
  q("#hubClose", closeHub);
  q("#hubResume", () => enter(ch, cb, cs));
  q("#hubNew", async () => {
    const f = await askForm("إنشاء حلقة علميّة", [{ k: "name", label: "اسم الحلقة", ph: "مثال: حلقة ... للعلوم الإسلاميّة" }, { k: "mosque", label: "المسجد / المكان (اختياري)" }], "إنشاء");
    if (!f || !f.name) return; const id = await hop("createHalaqa", f); await reloadAll(); openHub("halaqa", id);
  });
  hub.querySelectorAll(".hcard[data-h]").forEach(c => {
    c.onclick = e => { if (e.target.closest(".cact")) return; openHub("halaqa", c.dataset.h); };
    const hh = halaqat.find(x => x.id === c.dataset.h);
    c.querySelector('[data-a="he"]').onclick = async e => { e.stopPropagation(); const f = await askForm("تعديل الحلقة", [{ k: "name", label: "اسم الحلقة", val: hh.name }, { k: "mosque", label: "المسجد / المكان", val: hh.mosque }]); if (f && f.name) { await hop("updateHalaqa", hh.id, f); await reloadAll(); renderHub(); } };
    c.querySelector('[data-a="hd"]').onclick = async e => { e.stopPropagation(); if (!sure("حذف «" + hh.name + "» بكل كتبها ومجالسها؟ لا يمكن التراجع.")) return; await hop("removeHalaqa", hh.id); await reloadAll(); renderHub(); };
  });
  if (HUB.view !== "halaqa") return;
  const h = halaqat.find(x => x.id === HUB.hid);
  const again = async () => { await reloadAll(); renderHub(); };
  q("#hubBack", () => openHub("list"));
  q("#hEdit", async () => {
    const f = await askForm("تعديل الحلقة", [{ k: "name", label: "اسم الحلقة", val: h.name }, { k: "mosque", label: "المسجد / المكان", val: h.mosque }]);
    if (f && f.name) { await hop("updateHalaqa", h.id, f); again(); }
  });
  q("#hDel", async () => { if (!sure(`حذف «${h.name}» بكل كتبها ومجالسها؟ لا يمكن التراجع.`)) return; await hop("removeHalaqa", h.id); await reloadAll(); openHub("list"); });
  const bookFields = b => [{ k: "title", label: "اسم الكتاب", val: b && b.title, ph: "مثال: زاد المستقنع" }, { k: "program", label: "اسم الدورة", val: b && b.program, ph: "مثال: الدورة العلميّة في شرح…" },
    { k: "sheikhTitle", label: "لقب الشيخ", val: b ? b.sheikhTitle : "فضيلة الشيخ" }, { k: "sheikh", label: "اسم الشيخ", val: b && b.sheikh }];
  q("#hNewBook", async () => {
    const f = await askForm("إضافة كتاب إلى الحلقة", bookFields(null), "إضافة"); if (!f || !f.title) return;
    await hop("createBook", h.id, f); again();
  });
  hub.querySelectorAll(".hbook").forEach(sec => {
    const b = h.books.find(x => x.id === sec.dataset.b);
    const on = (a, fn, root = sec) => root.querySelectorAll(`[data-a="${a}"]`).forEach(e => e.onclick = ev => fn(ev.target.closest(".hs"), ev));
    on("newS", async () => {
      const prev = b.sessions[b.sessions.length - 1] || {};
      const f = await askForm("مجلس جديد", [{ k: "scope", label: "الباب", val: prev.scope, ph: "كتاب الطهارة" }, { k: "session", label: "رقم المجلس", ph: "يُرقَّم تلقائيّاً لو تركته فارغاً" }, { k: "date", label: "التاريخ (اختياري)", ph: "يُحسب تلقائيّاً لو تركته فارغاً" }, { k: "start", label: "وقت البداية", val: prev.start || "20:00", type: "time" }], "إنشاء وفتح");
      if (!f) return; const sid = await hop("createSession", h.id, b.id, f); await reloadAll(); const nh = S().halaqat.find(x => x.id === h.id), nb = nh.books.find(x => x.id === b.id); enter(nh, nb, nb.sessions.find(x => x.id === sid));
    });
    on("editB", async () => { const f = await askForm("تعديل الكتاب", bookFields(b)); if (f && f.title) { await hop("updateBook", h.id, b.id, f); again(); } });
    on("delB", async () => { if (sure(`حذف «${b.title}» ومجالسه من الحلقة؟`)) { await hop("removeBook", h.id, b.id); again(); } });
    on("open", row => enter(h, b, b.sessions.find(x => x.id === row.dataset.s)));
    on("editS", async row => {
      const s = b.sessions.find(x => x.id === row.dataset.s);
      const f = await askForm("تعديل المجلس", [{ k: "scope", label: "الباب", val: s.scope }, { k: "session", label: "رقم المجلس", val: s.session }, { k: "date", label: "التاريخ", val: s.date }, { k: "start", label: "وقت البداية", val: s.start, type: "time" }, { k: "next", label: "جملة الختام", val: s.next, ph: "موعدنا القادم بإذن الله" }]);
      if (f) { await hop("updateSession", h.id, b.id, s.id, f); again(); }
    });
    on("delS", async row => { if (sure("حذف هذا المجلس؟")) { await hop("removeSession", h.id, b.id, row.dataset.s); again(); } });
  });
}

// ---------- تخصيص شاشات قبل البثّ والاستراحة والختام: شعار الحلقة فقط ----------
const SCREEN_KINDS = [["intro", "قبل البثّ"], ["break", "الاستراحة"], ["outro", "الختام"]];
function renderScreens() {
  const { h } = cur();
  $("scrHalaqa").textContent = h ? h.name : "";
  const rows = $("scrRows"); rows.innerHTML = "";
  if (!h) { rows.innerHTML = `<p class="hint">اختر حلقة أوّلاً من زرّ الحلقات أعلى الشاشة.</p>`; $("imgLogo").innerHTML = ""; return; }
  SCREEN_KINDS.forEach(([k, label]) => {
    const on = !!(h.screens && h.screens[k] && h.screens[k].logo);
    const row = document.createElement("div"); row.className = "scr-row"; row.innerHTML = `<b>${label}</b>`;
    const bt = document.createElement("button"); bt.textContent = on ? "شعار الحلقة ظاهر" : "شعار الحلقة مخفي"; bt.className = on ? "on" : "";
    bt.onclick = async () => {
      const screens = JSON.parse(JSON.stringify(h.screens || {})); screens[k] = Object.assign({}, screens[k], { logo: !on });
      await hop("updateHalaqa", h.id, { screens }); renderScreens();
      if (!on && !h.logo) toast("ارفع شعار الحلقة أدناه");
    };
    row.appendChild(bt);
    if (k === "break") { const tg = document.createElement("button"); const bo = S().breakOn !== false; tg.textContent = bo ? "المشهد مفعّل" : "المشهد مغلق"; tg.className = bo ? "on" : ""; tg.onclick = async () => { await patch({ breakOn: !bo }); renderScenes(); renderScreens(); }; row.appendChild(tg); }
    rows.appendChild(row);
  });
  imgEditor($("imgLogo"), h.logo, "شعار الحلقة", v => hop("updateHalaqa", h.id, { logo: v }));
  renderScreenFx();
}

// ---------- تخصيص الشاشة: بطاقة الكتاب + الخلفيّة + الصوت ----------
let SFX_K = "intro";
const SFX_OLD = { arch: "M2,41V17C2,10 8,4 17,1C26,4 32,10 32,17V41Z", round: "M8,1H26A6,6 0 0 1 32,7V35A6,6 0 0 1 26,41H8A6,6 0 0 1 2,35V7A6,6 0 0 1 8,1Z", oval: "M17,1A15,20 0 1 1 16.9,1Z", rect: "M2,1H32V41H2Z" };
const sfxShape = k => SFX_OLD[k] || "M" + TH.shapePoly(k, 30, 40).map(([x, y]) => (x + 2).toFixed(1) + "," + (y + 1).toFixed(1)).join("L") + "Z";
function renderScreenFx() {
  const { h } = cur(), kindBox = $("scrFxKind"), box = $("scrFx");
  if (!h) { kindBox.innerHTML = ""; box.innerHTML = ""; return; }
  const scr = () => JSON.parse(JSON.stringify((cur().h || h).screens || {}));
  const get = () => (scr()[SFX_K] || {}).fx || {};
  const save = async (part, rerender = true) => {
    const screens = scr(), cur0 = screens[SFX_K] || { logo: false }, fx = Object.assign({}, cur0.fx, part);
    screens[SFX_K] = Object.assign({}, cur0, { fx });
    await hop("updateHalaqa", h.id, { screens }); if (rerender) renderScreenFx();
  };
  const part = (k, o, rerender = false) => save({ [k]: Object.assign({}, get()[k], o) }, rerender);
  kindBox.innerHTML = "";
  SCREEN_KINDS.forEach(([k, label]) => { const b = document.createElement("button"); b.className = "opt" + (SFX_K === k ? " on" : ""); b.innerHTML = "<span>" + label + "</span>"; b.onclick = () => { SFX_K = k; renderScreenFx(); }; kindBox.appendChild(b); });
  const fx = get(), cd = fx.card || {}, bg = fx.bg || {}, sd = fx.sound || {};
  box.innerHTML = "";
  const sec = title => { const s = document.createElement("div"); s.className = "tssec"; if (title) { const t = document.createElement("b"); t.textContent = title; t.style.color = "var(--accent,#D1AA62)"; s.appendChild(t); } box.appendChild(s); return s; };
  const row = (label, node) => { const r = document.createElement("div"); r.className = "tsrow"; r.innerHTML = "<span>" + label + "</span>"; r.appendChild(node); return r; };

  // ----- قالب الشاشة (قبل البثّ فقط): بطاقة الكتاب | إطار المحراب | الشيخ بارزاً
  const POD = curMode() === "podcast";                        // البودكاست: القالب والخلفيّة من تبويب «القالب»، فلا بطاقة كتاب ولا قوالب محراب هنا
  const tp = fx.tpl || { id: "card" }, isTpl = !POD && SFX_K === "intro" && tp.id !== "card";
  // أيقونات التواصل (مشتركة بين قوالب «المحراب/الشيخ بارزاً» وبطاقة الكتاب). في وضع البطاقة يُحفَظ id:"card" مع الإعداد حتى لا يُحسَب قالباً.
  const tpart = (o, rerender) => part("tpl", Object.assign(tp.id ? {} : { id: "card" }, o), rerender);
  const socialsUI = s => {
    // حسابات التواصل (لكل حلقة)
    const lab2 = document.createElement("b"); lab2.textContent = "حسابات التواصل أسفل الشاشة"; lab2.style.cssText = "display:block;margin-top:14px;color:var(--accent,#D1AA62)"; s.appendChild(lab2);
    if (!POD) s.appendChild(tsSwitch("إظهار أيقونات التواصل على الشاشة", tp.socials !== false, on => tpart({ socials: on }, true)));
    if (!POD && tp.socials !== false) s.appendChild(tsSwitch("كتابة المعرّف بجانب كل أيقونة", tp.socialText ?? (tp.id === "arch"), on => tpart({ socialText: on })));
    { const hh = document.createElement("p"); hh.className = "hint"; hh.textContent = "تظهر دائماً أيقونات فيسبوك ويوتيوب وتيليجرام وتيك توك بحجم موحّد في سطر واحد. أضف حساباً من النوع نفسه لتُكتب معرّفه بجانب أيقونته (وأغلقه لإخفاء الأيقونة)، أو أضف حسابات أخرى لتظهر بعدها."; s.appendChild(hh); }
    const soc = JSON.parse(JSON.stringify(cur().h.socials || [])), saveSoc = () => hop("updateHalaqa", cur().h.id, { socials: soc.filter(x => x) });
    soc.forEach((x, i) => { const r = document.createElement("div"); r.className = "tsrow";
      const sel = document.createElement("select"); sel.innerHTML = [["telegram", "تيليجرام"], ["facebook", "فيسبوك"], ["instagram", "إنستغرام"], ["x", "X"], ["tiktok", "تيك توك"], ["youtube", "يوتيوب"], ["whatsapp", "واتساب"], ["snapchat", "سناب شات"], ["linkedin", "لينكدإن"], ["web", "موقع"]].map(([v, n]) => '<option value="' + v + '">' + n + "</option>").join(""); sel.value = x.type || "telegram";
      const inp = document.createElement("input"); inp.value = x.handle || ""; inp.placeholder = "@الحساب"; inp.dir = "ltr"; inp.style.flex = "1";
      const on = document.createElement("label"); on.className = "switch"; on.style.margin = "0"; on.innerHTML = '<input type="checkbox" ' + (x.on !== false ? "checked" : "") + "><i></i>"; on.title = "تفعيل / إغلاق هذا الحساب"; on.querySelector("input").onchange = e => { soc[i].on = e.target.checked; saveSoc(); };
      const del = document.createElement("button"); del.textContent = "✕"; del.className = "danger";
      sel.onchange = () => { soc[i].type = sel.value; saveSoc(); }; let tm; inp.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { soc[i].handle = inp.value; saveSoc(); }, 400); };
      del.onclick = async () => { soc.splice(i, 1); await saveSoc(); renderScreenFx(); };
      r.append(on, sel, inp, del); s.appendChild(r); });
    if (soc.length < 7) { const add = document.createElement("button"); add.className = "mid"; add.textContent = "+ إضافة حساب"; add.onclick = async () => { soc.push({ type: "telegram", handle: "", on: true }); await saveSoc(); renderScreenFx(); }; s.appendChild(add); }
  };
  if (SFX_K === "intro" && !POD) {
    const s = sec("قالب الشاشة");
    const row0 = document.createElement("div"); row0.className = "cards3";
    const art = id => id === "card" ? '<svg viewBox="0 0 60 34" width="60"><rect x="2" y="2" width="56" height="30" rx="3" fill="none" stroke="currentColor" opacity=".5"/><path d="M8 30V14a9 9 0 0 1 18 0v16z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="42" cy="17" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
      : id === "arch" ? '<svg viewBox="0 0 60 34" width="60"><rect x="2" y="2" width="56" height="30" rx="3" fill="none" stroke="currentColor" opacity=".5"/><path d="M38 30V14a9 9 0 0 1 18 0v16z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M41 28V14a6 6 0 0 1 12 0v14z" fill="currentColor" opacity=".3"/><path d="M6 10h24M9 16h18M12 22h12" stroke="currentColor" stroke-width="1.6"/></svg>'
      : '<svg viewBox="0 0 60 34" width="60"><rect x="2" y="2" width="56" height="30" rx="3" fill="none" stroke="currentColor" opacity=".5"/><path d="M34 2h24v30H28z" fill="currentColor" opacity=".18"/><circle cx="46" cy="14" r="5" fill="currentColor" opacity=".55"/><path d="M36 32c1-9 5-11 10-11s9 2 10 11z" fill="currentColor" opacity=".55"/><path d="M6 10h20M8 16h16M10 22h12" stroke="currentColor" stroke-width="1.6"/></svg>';
    [["card", "بطاقة الكتاب", "الشكل الحاليّ"], ["arch", "إطار المحراب", "الصورة في إطار مزدوج"], ["cutout", "الشيخ بارزاً", "صورة بلا خلفيّة على لوح"]].forEach(([id, t, sub]) => {
      const b = document.createElement("button"); b.className = "opt" + (tp.id === id ? " on" : ""); b.innerHTML = art(id) + "<span>" + t + "</span><small>" + sub + "</small>";
      b.onclick = () => part("tpl", { id }, true); row0.appendChild(b); });
    s.appendChild(row0);
    if (isTpl) {
      const bk = cur().b, hold = document.createElement("div");
      if (!inLessons()) { imgEditor(hold, cur().h.sheikhImg, "صورة المتحدّث", v => hop("updateHalaqa", cur().h.id, { sheikhImg: v }), { smart: true }); const l = document.createElement("div"); l.className = "hint"; l.textContent = "صورة " + (curMode() === "khutba" ? "الخطيب" : "المحاضر"); s.append(l, hold); }
      else if (bk) { imgEditor(hold, bk.sheikhImg, "صورة الشيخ", v => hop("updateBook", cur().h.id, bk.id, { sheikhImg: v }), { smart: true }); const l = document.createElement("div"); l.className = "hint"; l.textContent = "صورة الشيخ للكتاب الحاليّ: " + (bk.title || ""); s.append(l, hold); }
      else { const l = document.createElement("div"); l.className = "hint"; l.textContent = "اختر كتاباً أوّلاً لرفع صورة شيخه."; s.appendChild(l); }
      if (tp.id === "arch" || tp.id === "cutout") {
        const lab = document.createElement("b"); lab.textContent = "إطار الصورة"; lab.style.cssText = "display:block;margin-top:10px;color:var(--accent,#D1AA62)"; s.appendChild(lab);
        const shapes = document.createElement("div"); shapes.className = "cards4";
        Object.entries(TH.SHAPES).forEach(([k, n]) => { const b = document.createElement("button"); b.className = "opt" + ((tp.shape || "arch") === k ? " on" : ""); b.innerHTML = shapeSVG(sfxShape(k)) + "<span>" + n + "</span>"; b.onclick = () => part("tpl", { shape: k }, true); shapes.appendChild(b); });
        s.appendChild(shapes);
        s.appendChild(tsSwitch("حلقة (إطار) مزدوجة حول الصورة", tp.ring !== false, on => part("tpl", { ring: on }, true)));
        if (tp.ring !== false) s.appendChild(row("لون الحلقة", tsColors(tp.ringColor || (tp.colors && tp.colors.accent) || "#0F5A33", c => part("tpl", { ringColor: c }, true))));
        s.appendChild(tsSwitch("هالات خفيفة خلف الإطار", tp.halo !== false, on => part("tpl", { halo: on })));
        s.appendChild(tsSwitch("هالة سوداء ناعمة حول حواف الصورة المقصوصة (تخفي أثر إزالة الخلفية)", tp.edge !== false, on => part("tpl", { edge: on }, true)));
        if (tp.edge !== false) {
          s.appendChild(tsRange("قوّة الهالة", 0.1, 2, 0.05, tp.edgeA ?? 1, v => Math.round(v * 100) + "٪", v => part("tpl", { edgeA: v })));
          s.appendChild(tsRange("اتّساع الهالة", 0.3, 3, 0.1, tp.edgeR ?? 1, v => "×" + v.toFixed(1), v => part("tpl", { edgeR: v })));
        }
        s.appendChild(tsRange("تقريب الصورة", 1, 2.2, 0.05, tp.zoom || 1, v => "×" + v.toFixed(2), v => part("tpl", { zoom: v })));
        s.appendChild(tsRange("موضع الصورة أفقيّاً", 0, 1, 0.01, tp.ox ?? 0.5, v => Math.round(v * 100) + "٪", v => part("tpl", { ox: v })));
        s.appendChild(tsRange("موضع الصورة رأسيّاً", 0, 1, 0.01, tp.oy ?? 0.12, v => Math.round(v * 100) + "٪", v => part("tpl", { oy: v })));
      }
      // ألوان القالب: مطابقة للنموذجين المرجعيّين افتراضيّاً، أو ألوان الهويّة، أو مخصّصة
      const lab3 = document.createElement("b"); lab3.textContent = "ألوان القالب"; lab3.style.cssText = "display:block;margin-top:12px;color:var(--accent,#D1AA62)"; s.appendChild(lab3);
      s.appendChild(tsSwitch("استعمال ألوان هويّة البثّ بدل ألوان النموذج", !!tp.useTheme, on => part("tpl", { useTheme: on }, true)));
      if (!tp.useTheme) {
        const defs = tp.id === "cutout" ? { bg: "#E9EBEF", ink: "#1B2A63", accent: "#1B2A63", plate: "#111111" } : { bg: "#FFFFFF", ink: "#12482B", accent: "#0F5A33", plate: "#0F5A33" };
        const cl = tp.colors || {}, setC = (k, v) => part("tpl", { colors: Object.assign({}, tp.colors, { [k]: v }) }, true);
        [["bg", "الخلفيّة"], ["ink", "النصوص"], ["accent", "التمييز والعناوين"], ["plate", "اللوحات"]].forEach(([k, n]) => s.appendChild(row(n, tsColors(cl[k] || defs[k], c => setC(k, c)))));
        const rs = document.createElement("button"); rs.className = "mid"; rs.textContent = "استعادة ألوان النموذج الأصليّة"; rs.onclick = () => part("tpl", { colors: {}, ringColor: "" }, true); s.appendChild(rs);
      }
      // الخطوط والسطر التمهيديّ والمؤلّف
      const lab4 = document.createElement("b"); lab4.textContent = "الخطوط والنصوص"; lab4.style.cssText = "display:block;margin-top:12px;color:var(--accent,#D1AA62)"; s.appendChild(lab4);
      const FNTS = [["", "الافتراضيّ للنموذج"], ["naskh", "نسخ نوتو (Noto Naskh)"], ["scheherazade", "شهرزاد (Scheherazade)"], ["elmessiri", "المسيري (El Messiri)"], ["cairo", "كايرو (Cairo)"], ["kufi", "كوفي نوتو (Noto Kufi)"], ["alexandria", "الإسكندريّة (Alexandria)"], ["mada", "مدى (Mada)"], ["almarai", "المرعي (Almarai)"], ["changa", "شانجا (Changa)"], ["reem", "ريم كوفي (Reem Kufi)"], ["aref", "عارف رقعة (Aref Ruqaa)"], ["amiri", "أميري (Amiri)"], ["tajawal", "تجوال (Tajawal)"], ["plex", "IBM Plex Arabic"]];
      const fsel = (key, label) => { const sel = document.createElement("select"); sel.innerHTML = FNTS.map(([v, n]) => '<option value="' + v + '">' + n + "</option>").join(""); sel.value = tp[key] || ""; sel.onchange = () => part("tpl", { [key]: sel.value }); s.appendChild(row(label, sel)); };
      fsel("fontTitle", "خطّ العناوين والأسماء"); fsel("fontBody", "خطّ النصوص الصغيرة");
      const kk = document.createElement("input"); kk.value = tp.kicker || ""; kk.placeholder = "مثال: شرح كتاب"; let kt; kk.oninput = () => { clearTimeout(kt); kt = setTimeout(() => part("tpl", { kicker: kk.value }), 350); }; s.appendChild(row("سطر تمهيديّ", kk));
      s.appendChild(tsSwitch("إظهار مؤلّف الكتاب (للعلّامة …)", tp.showAuthor !== false, on => part("tpl", { showAuthor: on })));
      const hn = document.createElement("div"); hn.className = "hint"; hn.textContent = "اسم الكتاب الإلكترونيّ لا يظهر في القالبين: العنوان هو اسم الدورة. صفة الشيخ أو منصبه تُكتب من تبويب «الدرس» (قسم الشيخ) وتظهر تحت اسمه."; s.appendChild(hn);
      s.appendChild(tsSwitch("العدّ التنازليّ للبثّ", tp.countdown !== false, on => part("tpl", { countdown: on })));
      socialsUI(s);
    }
  }

  // ----- بطاقة الكتاب
  if (!isTpl && !POD) { const s = sec("بطاقة الكتاب");
    const shapes = document.createElement("div"); shapes.className = "cards4";
    Object.entries(TH.SHAPES).forEach(([k, n]) => { const b = document.createElement("button"); b.className = "opt" + ((cd.shape || "arch") === k ? " on" : ""); b.innerHTML = shapeSVG(sfxShape(k)) + "<span>" + n + "</span>"; b.onclick = () => part("card", { shape: k }, true); shapes.appendChild(b); });
    s.appendChild(shapes);
    const fill = cd.fill || {}; s.appendChild(row("لون التعبئة", tsColors(fill.color || "theme:deep", c => part("card", { fill: Object.assign({ alpha: .82 }, fill, { color: c }) }, true))));
    s.appendChild(tsRange("شفافيّة التعبئة", 0.1, 1, .02, fill.alpha ?? .82, v => Math.round(v * 100) + "٪", v => part("card", { fill: Object.assign({ color: "theme:deep" }, fill, { alpha: v }) })));
    const bd = cd.border || {};
    s.appendChild(tsSwitch("حدّ البطاقة", bd.on !== false, on => part("card", { border: Object.assign({}, bd, { on }) }, true)));
    if (bd.on !== false) { s.appendChild(row("لون الحدّ", tsColors(bd.color || "theme:accent", c => part("card", { border: Object.assign({}, bd, { color: c }) }, true))));
      s.appendChild(tsRange("سماكة الحدّ", 1, 12, 1, bd.width || 3, v => v + " px", v => part("card", { border: Object.assign({}, bd, { width: v }) }))); }
    s.appendChild(tsSwitch("الخطّ الخارجيّ الرفيع حول البطاقة", cd.outer !== false, on => part("card", { outer: on })));
    s.appendChild(tsSwitch("ظلّ البطاقة", cd.shadow !== false, on => part("card", { shadow: on }))); }
  if (!isTpl) { const s = sec("أيقونات التواصل أسفل البطاقة"); socialsUI(s); }

  // ----- الخلفيّة
  if (!POD) { const s = sec("الصورة الخلفيّة");
    const acts = document.createElement("div"); acts.className = "acts2";
    const mk = (t, fn, danger) => { const x = document.createElement("button"); x.textContent = t; if (danger) x.classList.add("danger"); x.onclick = fn; acts.appendChild(x); };
    if (bg.file) { const im = document.createElement("div"); im.className = "imgprev"; im.innerHTML = '<img src="/media/' + encodeURIComponent(bg.file) + '">'; s.appendChild(im); }
    mk(bg.file ? "تغيير الصورة" : "اختيار صورة خلفيّة", async () => { const f = await api.call("media:pickImage", "الصورة الخلفيّة للشاشة"); if (f) save({ bg: Object.assign({ dim: 35, blur: 0, pattern: true }, bg, { file: f }) }); });
    if (bg.file) mk("حذف الصورة", () => save({ bg: Object.assign({}, bg, { file: "" }) }), true);
    s.appendChild(acts);
    if (bg.file) { s.appendChild(tsRange("تعتيم الصورة", 0, 90, 1, bg.dim ?? 35, v => v + "٪", v => part("bg", { dim: v })));
      s.appendChild(tsRange("تغبيش الصورة", 0, 30, 1, bg.blur ?? 0, v => v + " px", v => part("bg", { blur: v })));
      s.appendChild(tsSwitch("إبقاء نقش الهويّة فوق الصورة", bg.pattern !== false, on => part("bg", { pattern: on }))); }
    else { const p = document.createElement("p"); p.className = "hint"; p.textContent = "بلا صورة: تظهر خلفيّة الهويّة (لون + نقش)."; s.appendChild(p); } }

  // ----- الصوت
  if (!POD) { const s = sec("الصوت على الشاشة");
    const acts = document.createElement("div"); acts.className = "acts2";
    const mk = (t, fn, danger) => { const x = document.createElement("button"); x.textContent = t; if (danger) x.classList.add("danger"); x.onclick = fn; acts.appendChild(x); };
    if (sd.file) { const n = document.createElement("div"); n.className = "hint"; n.textContent = "♪ " + (sd.name || sd.file); s.appendChild(n); }
    mk(sd.file ? "تغيير الملفّ" : "اختيار ملفّ صوت", async () => { const r = await api.call("media:pickAudio", "الصوت على الشاشة"); if (r) save({ sound: Object.assign({ vol: 60 }, sd, { file: r.file, name: r.name }) }); });
    if (sd.file) {
      mk("تجربة", () => { window.__sfxAu && window.__sfxAu.pause(); const a = window.__sfxAu = new Audio("/media/" + encodeURIComponent(sd.file)); a.volume = (sd.vol ?? 60) / 100; a.play().catch(() => {}); setTimeout(() => a.pause(), 8000); });
      mk("حذف الصوت", () => save({ sound: {} }), true); }
    s.appendChild(acts);
    if (sd.file) s.appendChild(tsRange("مستوى الصوت", 0, 100, 1, sd.vol ?? 60, v => v + "٪", v => part("sound", { vol: v })));
    const p = document.createElement("p"); p.className = "hint"; p.textContent = "يعمل الصوت متكرّراً طالما الشاشة على الهواء، ويبدأ من أوّله كل مرّة تظهر فيها الشاشة، ويدخل في البثّ والتسجيل. أوّل مرّة بعد هذا التحديث تحتاج إعادة تشغيل البرنامج."; s.appendChild(p); }
}
// محرّر صورة: اختيار / تغيير، بلا خلفيّة (يحتفظ بالأصل)، حذف
function imgEditor(box, obj, title, save, opts = {}) {
  box.innerHTML = "";
  if (!save) { box.innerHTML = `<p class="hint">اختر كتاباً أوّلاً.</p>`; return; }
  const prev = document.createElement("div"); prev.className = "imgprev";
  if (obj && obj.file) prev.innerHTML = `<img src="/media/${encodeURIComponent(obj.nobg && obj.cut ? obj.cut : obj.file)}">`; else prev.innerHTML = `<span>لا توجد صورة</span>`;
  const acts = document.createElement("div"); acts.className = "acts2";
  const mk = (t, fn, on, danger) => { const x = document.createElement("button"); x.textContent = t; if (on) x.className = "on"; if (danger) x.classList.add("danger"); x.onclick = fn; acts.appendChild(x); };
  const done = () => renderScreens();
  mk(obj && obj.file ? "تغيير الصورة" : "اختيار صورة", async () => { const f = await api.call("media:pickImage", title); if (f) { await save({ file: f, cut: null, nobg: false }); done(); } });
  if (obj && obj.file) {
    mk(opts.smart ? (obj.nobg ? "الخلفيّة محذوفة — اضغط للأصل" : "✨ إزالة الخلفيّة بذكاء") : (obj.nobg ? "بلا خلفيّة" : "بخلفيّتها"), async () => {
      if (obj.nobg) { await save(Object.assign({}, obj, { nobg: false })); return done(); }
      try {
        let cut = obj.cut; if (!cut) { toast(opts.smart ? "جارٍ إزالة الخلفيّة بذكاء… (ثوانٍ)" : "جارٍ إزالة الخلفيّة…", 6000); cut = opts.smart ? await smartCutout({ file: obj.file }) : await makeLogoCut({ file: obj.file }); }
        if (!cut) return toast(opts.smart ? "لم أجد شخصاً واضحاً في الصورة — جرّب صورة أقرب" : "الصورة أصلاً بلا خلفيّة مصمتة");
        await save(Object.assign({}, obj, { nobg: true, cut })); done();
      } catch (e) { toast("تعذّرت إزالة الخلفيّة: " + e.message); }
    }, !!obj.nobg);
    mk("حذف", async () => { await save(null); done(); }, false, true);
  }
  box.append(prev, acts);
}

function initHub() {
  $("crumb").onclick = () => openModes();
  renderCrumb(); renderScreens();
}
