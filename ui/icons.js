// أيقونات «منبر» — SVG بسيطة وواضحة (خطّ 2px)، تُلوَّن بـ currentColor
(function () {
  const s = (d, vb = 24) => `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  // رسم مشهد: إطار شاشة بزوايا ناعمة + محتواه
  const t = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3.6" width="20" height="16.8" rx="3.6"/>${d}</svg>`;
  const I = {
    // ---- تبويبات الإطار الجانبي ----
    tab_halaqa: s('<circle cx="12" cy="7.6" r="3.1"/><circle cx="4.9" cy="10.4" r="2.3"/><circle cx="19.1" cy="10.4" r="2.3"/><path d="M6.6 20.2a5.4 5.4 0 0 1 10.8 0"/><path d="M1.6 18.4a3.6 3.6 0 0 1 4-3.3M22.4 18.4a3.6 3.6 0 0 0-4-3.3"/>'),
    tab_book: s('<path d="M5 4.2A1.7 1.7 0 0 1 6.7 2.5H18.5v16.7H6.7A1.7 1.7 0 0 0 5 20.9z"/><path d="M5 20.9a1.7 1.7 0 0 0 1.7 1.6h11.8"/><path d="M9.2 7.3h5.6M9.2 10.7h4"/><path d="M14.5 2.5v6l1.6-1.1 1.6 1.1v-6" fill="currentColor" fill-opacity=".28"/>'),
    tab_lesson: s('<rect x="3" y="3.5" width="18" height="12.5" rx="2.4"/><path d="M7.6 8h8.8M7.6 11.6h5.2"/><path d="M12 16v3.4M8 21h8"/>'),
    tab_look: s('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2.1-1.1 1.6-2.2-.5-1.2.4-2.6 1.8-2.6H17a4 4 0 0 0 4-4C21 7 17 3 12 3z"/><circle cx="7.6" cy="11.2" r="1.2" fill="currentColor"/><circle cx="10.6" cy="7.4" r="1.2" fill="currentColor"/><circle cx="15.2" cy="7.9" r="1.2" fill="currentColor"/>'),
    tab_cam: s('<rect x="2.5" y="6.2" width="19" height="13" rx="3"/><circle cx="12" cy="12.7" r="3.5"/><path d="M8.1 6.2L9.4 4h5.2l1.3 2.2"/>'),
    tab_live: s('<circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M7.7 7.7a6.1 6.1 0 0 0 0 8.6M16.3 7.7a6.1 6.1 0 0 1 0 8.6M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>'),
    // ---- المشاهد: شاشة صغيرة بمحتواها (خطّ 1.7 وتعبئة خفيفة) ----
    sc_clock: t('<circle cx="12" cy="12" r="4.7"/><path d="M12 9.2V12l2.1 1.4"/><path d="M9.6 5.6h4.8" opacity=".55"/>'),
    sc_person: t('<circle cx="12" cy="10.1" r="2.8" fill="currentColor" fill-opacity=".3"/><path d="M6.6 18.6c.7-3 2.9-4.6 5.4-4.6s4.7 1.6 5.4 4.6" fill="currentColor" fill-opacity=".3"/>'),
    sc_bookperson: t('<rect x="4" y="7" width="7.2" height="10" rx="1.2" fill="currentColor" fill-opacity=".25"/><path d="M5.8 10h3.6M5.8 12.4h3.6M5.8 14.8h2.4"/><circle cx="16.4" cy="10.2" r="2.2" fill="currentColor" fill-opacity=".3"/><path d="M12.6 18c.5-2.1 1.9-3.2 3.8-3.2s3.3 1.1 3.8 3.2" fill="currentColor" fill-opacity=".3"/>'),
    sc_pageperson: t('<rect x="3.8" y="5.8" width="6.4" height="12.4" rx="1.2" fill="currentColor" fill-opacity=".25"/><path d="M5.4 9h3.2M5.4 11.5h3.2M5.4 14h3.2"/><circle cx="16" cy="10.2" r="2.3" fill="currentColor" fill-opacity=".3"/><path d="M12 18.4c.5-2.2 2.1-3.4 4-3.4s3.5 1.2 4 3.4" fill="currentColor" fill-opacity=".3"/>'),
    sc_book: t('<path d="M12 7.6c-2-1.4-4.7-1.4-6.8 0v9.2c2.1-1.4 4.8-1.4 6.8 0 2-1.4 4.7-1.4 6.8 0V7.6c-2.1-1.4-4.8-1.4-6.8 0z" fill="currentColor" fill-opacity=".25"/><path d="M12 7.6v9.2"/>'),
    sc_lines: t('<circle cx="12" cy="8.3" r="2" fill="currentColor" fill-opacity=".3"/><rect x="3.8" y="12" width="16.4" height="6" rx="1.3" fill="currentColor" fill-opacity=".25"/><path d="M6.2 14h11.6M6.2 16.2h7.4"/>'),
    sc_cup: t('<path d="M7.6 10.6h8v3.4a3.6 3.6 0 0 1-3.6 3.6h-.8a3.6 3.6 0 0 1-3.6-3.6z" fill="currentColor" fill-opacity=".25"/><path d="M15.6 11.4h.9a1.7 1.7 0 0 1 0 3.4h-.9"/><path d="M9.6 6.6c0 .9 1 1 1 1.9M12.6 6.6c0 .9 1 1 1 1.9" opacity=".7"/>'),
    sc_cam2: t('<circle cx="7.6" cy="10" r="1.9" fill="currentColor" fill-opacity=".3"/><circle cx="12" cy="8.9" r="1.9" fill="currentColor" fill-opacity=".3"/><circle cx="16.4" cy="10" r="1.9" fill="currentColor" fill-opacity=".3"/><path d="M4.4 17.2c.4-2.1 1.5-3 3.2-3s2.8.9 3.2 3M8.8 17.2c.4-2.1 1.5-3 3.2-3s2.8.9 3.2 3M13.2 17.2c.4-2.1 1.5-3 3.2-3s2.8.9 3.2 3"/>'),
    sc_qbottom: t('<rect x="3.6" y="5" width="16.8" height="14" rx="2.6" fill="currentColor" fill-opacity=".16"/><rect x="5.6" y="13.4" width="12.8" height="4" rx="1.6" fill="currentColor" fill-opacity=".55"/><circle cx="12" cy="8.8" r="2" fill="currentColor" fill-opacity=".4"/>'),
    sc_qtop: t('<rect x="3.6" y="5" width="16.8" height="14" rx="2.6" fill="currentColor" fill-opacity=".16"/><rect x="5.6" y="6.6" width="12.8" height="4" rx="1.6" fill="currentColor" fill-opacity=".55"/><circle cx="12" cy="15" r="2" fill="currentColor" fill-opacity=".4"/>'),
    sc_qside: t('<rect x="3.6" y="5" width="16.8" height="14" rx="2.6" fill="currentColor" fill-opacity=".16"/><rect x="5.4" y="7.2" width="7.4" height="9.6" rx="1.4" fill="currentColor" fill-opacity=".55"/><circle cx="16.4" cy="10" r="2" fill="currentColor" fill-opacity=".4"/>'),
    sc_qframe: t('<rect x="3.6" y="5" width="16.8" height="14" rx="2.6" fill="currentColor" fill-opacity=".16"/><rect x="5.4" y="7.2" width="7.4" height="9.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="16.4" cy="10" r="2" fill="currentColor" fill-opacity=".4"/>'),
    sc_duo2: t('<rect x="3.6" y="6.4" width="8" height="11.2" rx="1.6" fill="currentColor" fill-opacity=".24"/><rect x="12.4" y="6.4" width="8" height="11.2" rx="1.6" fill="currentColor" fill-opacity=".34"/>'),
    sc_gal: t('<rect x="3.8" y="7.4" width="12.4" height="9.6" rx="2" fill="currentColor" fill-opacity=".2"/><rect x="7.8" y="5.6" width="12.4" height="9.6" rx="2" fill="currentColor" fill-opacity=".32"/><circle cx="12" cy="9.2" r="1.3" fill="currentColor"/>'),
    sc_galguest: t('<rect x="9" y="6" width="11.4" height="9.6" rx="2" fill="currentColor" fill-opacity=".3"/><circle cx="5.7" cy="9.4" r="2" fill="currentColor" fill-opacity=".34"/><path d="M2.8 15.4a2.9 2.9 0 0 1 5.8 0z" fill="currentColor" fill-opacity=".34"/><circle cx="14.7" cy="9.6" r="1.2" fill="currentColor"/>'),
    sc_duo: t('<rect x="4" y="6.4" width="10.4" height="9.2" rx="3" fill="currentColor" fill-opacity=".22"/><rect x="9.6" y="10.4" width="10.4" height="7.4" rx="3" fill="currentColor" fill-opacity=".3"/>'),
    sc_end: t('<circle cx="12" cy="12" r="4.8" fill="currentColor" fill-opacity=".22"/><path d="M9.6 12.2l1.9 1.9 3.4-3.8"/>'),
    gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>'),
    library: s('<path d="M4 19V5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2z"/><path d="M10 3h4v18h-4"/><path d="M14 4.5l3.8-1 3.2 16.5-3.8 1z"/>'),
    lesson: s('<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>'),
    design: s('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.4" fill="currentColor"/><circle cx="12" cy="7.5" r="1.4" fill="currentColor"/><circle cx="16" cy="10" r="1.4" fill="currentColor"/><path d="M12 21a3 3 0 0 1 0-6h2a3 3 0 0 0 3-3"/>'),
    logos: s('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 14v6.5M14 17.25h6.5"/>'),
    devices: s('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>'),
    live: s('<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'),
    rec: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>'),
    stop: s('<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>'),
    mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'),
    camera: s('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'),
    next: s('<path d="M15 5l-7 7 7 7"/>'),          // التالية (يسار في العربي)
    prev: s('<path d="M9 5l7 7-7 7"/>'),
    up: s('<path d="M5 15l7-7 7 7"/>'),
    down: s('<path d="M5 9l7 7 7-7"/>'),
    zoom: s('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>'),
    band: s('<rect x="3" y="9" width="18" height="6" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M3 5h18M3 19h18"/>'),
    search: s('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>'),
    folder: s('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    file: s('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    globe: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    trash: s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    key: s('<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>'),
    copy: s('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  };
  window.ICON = (name, cls = "ic") => `<span class="${cls}">${I[name] || ""}</span>`;
})();
