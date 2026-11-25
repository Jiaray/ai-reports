/* 新聞頁報頭共用元件（report.js、series.js、front.js、card.js、story.js、adhoc.js），掛 AIR.bar（介面見檔尾），依賴 AIR.h、#app。
   1. 圖示（aria-hidden；按鈕名稱靠文字或 aria-label）
   2. 下拉 dropdown()（功能鈕開時為底部面板）
   3. 元件 seriesMenu（系列設定 cardSeries）、toolbar、navLink、storyLink、roving。
      工具列組成（樣式摘要 5.1）：左邊「本日焦點」，右邊一組「系列 ▾｜議題｜版面」
   4. 工具列凍結：--bar-h、.is-stuck
   5. 手機右下角功能鈕（扇面） */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;

  // ── 1. 圖示 ──
  const svg = (size, d, extra = '') => `<svg viewBox="0 0 20 20"${size ? ` width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="${d}"/>${extra}</svg>`;
  const ICON = {
    sliders: svg(18, 'M2.5 6H11M15 6h2.5M2.5 14H5M9 14h8.5', '<rect x="11" y="4" width="4" height="4"/><rect x="5" y="12" width="4" height="4"/>'), // 版面；方形旋鈕配藍圖方角
    caret: svg(14, 'M6 8l4 4 4-4'),
    close: svg(16, 'M5 5l10 10M15 5 5 15'),
    front: svg(18, 'M3 3.5h14v13H3zM6 7.5h8M6 10.5h8M6 13.5h5'), // 本日焦點：一張報紙（同網站圖示）
    // 系列：一排書（兩本直立、一本斜靠），取叢書系列的意思；書脊橫線讓長方形看得出是書
    series: svg(18, 'M2.5 3.5H6v13H2.5zM2.5 6.5H6M2.5 13.5H6M7.5 5h3v11.5h-3zM7.5 8h3M14.9 16.5 11.2 5.1l2.85-.93 3.71 11.41z'),
    story: svg(18, 'M8.4 2.5 6.6 17.5M13.4 2.5l-1.8 15M3.5 7.2h14M2.5 12.8h14'), // 議題：#（議題名就是網址的 #），須和其他圖示分得出
    warn: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M10 2.8 18 17H2z" stroke-linejoin="round"/><path d="M10 8v4.2M10 14.2v.1" stroke-linecap="round" stroke-width="1.9"/></svg>',
    fan: svg(20, 'M17 17H3.5A13.5 13.5 0 0 1 17 3.5zM17 17 5.3 10.25M17 17 10.25 5.3'), // 功能鈕：從右下角張開的扇子
    filter: svg(18, 'M2.5 3.5h15l-6 7v6l-3-1.5v-4.5z'),
    check: svg(12, 'M4 10.5l3.5 3.5L16 5.5'),
  };

  // ── 2. 下拉面板 ──
  // 用 WAAPI 不用 @starting-style：頁面重畫時面板隨工具列搬家，後者每搬一次重播淡入
  function openMotion(el, sheet) {
    if (!el.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    else if (sheet) el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' });
    else el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out' });
  }

  // 底部面板背景：放在同一個 .dd 裡（同疊放層級才蓋得住工具列）
  function makeShade(shut) {
    const shade = h('div', { class: 'dd-shade', hidden: true });
    shade.addEventListener('click', (e) => {
      e.stopPropagation();
      shut();
    });
    return shade;
  }
  function showShade(shade, yes) {
    shade.hidden = !yes;
    shade.style.opacity = '';
    if (yes && shade.animate) shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  }

  // 定案：從頂端 64px（把手＋標題列）或清單在頂時往下拖；拖過三成高（≤140px）或下甩→收起，否則彈回
  // touchmove 非 passive：攔下才不會捲背景、下拉重新整理
  function sheetDrag(panel, shade, shut) {
    let s = null;
    const reset = () => {
      panel.style.transform = '';
      panel.style.transition = '';
      shade.style.opacity = '';
    };
    panel.addEventListener('touchstart', (e) => {
      s = null;
      if (!panel.classList.contains('is-sheet') || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      s = { y, t: Date.now(), dy: 0, on: false, head: y - panel.getBoundingClientRect().top < 64 };
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      if (!s.on) {
        if (dy === 0) return;
        if (dy > 0 && (s.head || panel.scrollTop <= 0)) s.on = true;
        else if (s.head) return e.preventDefault(); // 標題列往上拖：不捲背景
        else {
          s = null; // 往上：交給清單捲動
          return;
        }
      }
      e.preventDefault();
      s.dy = Math.max(0, dy);
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${s.dy}px)`;
      shade.style.opacity = String(Math.max(0, 1 - s.dy / panel.offsetHeight));
    }, { passive: false });
    const end = () => {
      if (!s || !s.on) {
        s = null;
        return;
      }
      const { dy, t } = s;
      s = null;
      const fling = dy / Math.max(1, Date.now() - t) > 0.6;
      if (dy > Math.min(140, panel.offsetHeight * 0.3) || (fling && dy > 24)) {
        const go = panel.animate ? panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(100%)' }],
          { duration: 160, easing: 'ease-in' }) : null;
        const done = () => { shut(); reset(); };
        if (go) go.onfinish = done;
        else done();
      } else {
        panel.style.transition = 'transform .18s ease-out';
        panel.style.transform = '';
        shade.style.opacity = '';
        setTimeout(reset, 200);
      }
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
  }

  // 面板貼按鈕右緣展開（系列、版面），超出視窗 → 移回來，左右各留 16px；底部面板不移。
  // 貼左緣的超出右邊改 margin-left、貼右緣的超出左邊（窄桌機，系列面板比按鈕左邊的空間寬）改 margin-right，另一邊的 margin 對定位沒作用。
  // 用負 margin 不用 translate：translate 前的位置仍算進可捲動範圍，會多出橫向捲動
  function fitIn(panel, sheet) {
    panel.style.marginLeft = '';
    panel.style.marginRight = '';
    if (sheet) return;
    const r = panel.getBoundingClientRect();
    const edge = document.documentElement.clientWidth - 16;
    const over = r.right - edge;
    const under = 16 - r.left;
    if (over > 0) panel.style.marginLeft = `${-Math.max(0, Math.min(over, r.left - 16))}px`;
    else if (under > 0) panel.style.marginRight = `${-Math.max(0, Math.min(under, edge - r.right))}px`;
  }

  // 所有下拉共用一組 document 監聽（頭版重畫不越掛越多）；proxying：proxyClick 代按時不算點外面
  const live = new Set();
  let proxying = false;
  document.addEventListener('click', (e) => {
    if (proxying) return;
    live.forEach((d) => { if (!d.panel.hidden && !d.box.contains(e.target)) d.open(false); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    live.forEach((d) => { if (!d.panel.hidden) d.shut(); });
    shutFan(); // 第 5 段
  });
  // 面板 → { open }，給功能鈕從底部打開
  const ctrls = new WeakMap();

  // 按鈕後緊接面板（Tab 直接進入），absolute 跟著按鈕；不用 popover：top layer 要 anchor positioning 才跟得住，Firefox 不支援
  // × 必留（非 modal 面板要看得見關閉鈕）；同時只開一個靠點別顆按鈕＝點外面
  function dropdown({ cls, id, title, closeLabel, toggleKids, body, pick, toggleCls = 'dd-toggle', wrap = (t) => t }) {
    const toggle = h('button', { type: 'button', class: toggleCls, 'aria-expanded': 'false', 'aria-controls': id }, toggleKids);
    const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': closeLabel, html: ICON.close });
    const panel = h('div', { class: `dd-panel ${cls}-panel`, id, role: 'dialog', 'aria-labelledby': `${id}-title`, hidden: true }, [
      h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: `${id}-title` }, [title]), close]),
      ...body,
    ]);
    let shut = null;
    const shade = makeShade(() => shut());
    const box = h('div', { class: `dd ${cls}` }, [wrap(toggle), shade, panel]);
    // how＝{ sheet, after(had) }（功能鈕開）：收起時呼叫 after，had＝收起前焦點在面板裡
    let after = null;
    function open(yes, how) {
      const had = !yes && !panel.hidden && panel.contains(document.activeElement);
      const sheet = Boolean(yes && how && how.sheet);
      panel.hidden = !yes;
      panel.classList.toggle('is-sheet', sheet);
      showShade(shade, sheet);
      toggle.setAttribute('aria-expanded', String(yes));
      if (!yes) {
        if (after) {
          const f = after;
          after = null;
          f(had);
        }
        return;
      }
      if (after && !sheet) {
        const f = after; // 底部面板開著時改從頂端按鈕開：先結束底部那次
        after = null;
        f(false);
      }
      if (sheet) after = how.after || null;
      fitIn(panel, sheet);
      openMotion(panel, sheet);
      ((pick && pick(panel)) || close).focus({ preventScroll: sheet });
    }
    shut = () => {
      const fromFab = Boolean(after);
      open(false);
      if (!fromFab) toggle.focus();
    };
    sheetDrag(panel, shade, shut);
    ctrls.set(panel, { open });
    toggle.addEventListener('click', () => open(panel.hidden));
    close.addEventListener('click', shut);
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) open(false); });
    live.add({ box, panel, open, shut });
    return box;
  }

  // ── 3. 元件 ──
  // 工具列須是 #app 的直接子節點（第 4、5 段靠 :scope > .editions 找）
  const toolbar = (kids) => h('nav', { class: 'editions', 'aria-label': '報頭工具列' }, kids.filter(Boolean));
  // current＝aria-current：page＝這頁本身，true＝這頁屬於它（議題頁之於議題目錄）
  const navLink = (text, icon, href, current) => h('a', { class: 'ed-link', href, 'aria-current': current || null }, [
    h('span', { class: 'dd-ico', html: ICON[icon] }), h('span', null, [text]),
  ]);

  // 系列設定：index.json 的 series 全部（{ id, title, short, group }；陣列順序＝views.SERIES＝全站系列順序，同領域的挨在一起）
  const cardSeries = (index) => (index && Array.isArray(index.series) ? index.series : [])
    .filter((s) => s && typeof s.id === 'string' && s.id);
  // 「系列 ▾」面板（樣式摘要 5.1）：「新聞卡（近 7 天）」列全部系列頁，照 index.json 的順序（同領域的挨在一起），文字前一條領域色短線。
  // 連結 ./?t=（新聞卡頁等其他頁面也連得到）；current＝目前的系列代號（目前位置 aria-current=page）。
  // 一顆下拉不逐一放按鈕：二十多個系列擺不進工具列與扇面
  function seriesMenu(index, current) {
    const cards = cardSeries(index);
    if (!cards.length) return null;
    const item = (s) => h('a', {
      class: 'pd-item sr-it', href: `./?t=${encodeURIComponent(s.id)}`, 'data-group': s.group || null, 'aria-current': s.id === current ? 'page' : null,
    }, [h('span', null, [s.short || s.title || s.id])]);
    const ul = h('ul', { class: 'pd-items sr-list', 'aria-labelledby': 'sr-g-cards' }, cards.map((s) => h('li', null, [item(s)])));
    ul.style.setProperty('--sr-rows', String(Math.ceil(cards.length / 2))); // 兩欄時的列數（report.css）
    return dropdown({
      cls: 'sr', id: 'sr-panel', title: '系列', closeLabel: '關閉系列',
      toggleKids: [h('span', { class: 'dd-ico', html: ICON.series }), h('span', null, ['系列']), h('span', { class: 'dd-caret', html: ICON.caret })],
      body: [h('div', { class: 'sr-body' }, [
        h('div', { class: 'sr-col sr-cards' }, [h('p', { class: 'pd-group', id: 'sr-g-cards' }, ['新聞卡（近 7 天）']), ul]),
      ])],
      pick: (panel) => panel.querySelector('.pd-item[aria-current=page]') || panel.querySelector('.pd-item'),
    });
  }
  // 「議題」→ 議題目錄（story.html）；current 同 navLink。ed-story：工具列右邊一組靠它找位置（report.css）
  const storyLink = (current) => {
    const a = navLink('議題', 'story', 'story.html', current);
    a.classList.add('ed-story');
    return a;
  };

  // 不支援 focusgroup 時補 roving tabindex（只攔方向鍵、Home／End）；回傳 sync：藏按鈕（頭版「清除」）後呼叫補回停點
  function roving(bar) {
    if ('focusGroup' in HTMLElement.prototype) return () => {};
    const items = () => [...bar.querySelectorAll('button')].filter((b) => !b.hidden);
    const sync = (cur) => {
      const list = items();
      const keep = (cur && list.includes(cur) && cur) || list.find((b) => b.tabIndex === 0) || list[0];
      bar.querySelectorAll('button').forEach((b) => { b.tabIndex = b === keep ? 0 : -1; });
    };
    bar.addEventListener('focusin', (e) => {
      const b = e.target.closest('button');
      if (b) sync(b);
    });
    bar.addEventListener('keydown', (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
      const rtl = getComputedStyle(bar).direction === 'rtl';
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      const next = step ? list[(i + step + list.length) % list.length]
        : e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : null;
      if (!next) return;
      e.preventDefault();
      next.focus();
    });
    sync();
    return sync;
  }

  // ── 4. 工具列凍結 ──
  // --bar-h 給 report.css、front.css、series.css、look-standard.css 讀，.is-stuck 給 report.css。工具列重畫是新元素→監看 #app 重找重量；
  // pinned（是否 sticky）在 measure 記下，捲動時免讀樣式
  const root = document.documentElement;
  const app = document.getElementById('app');
  let bar = null;
  let pinned = true;
  const measure = () => {
    if (!bar || !bar.isConnected) return;
    pinned = getComputedStyle(bar).position === 'sticky';
    root.style.setProperty('--bar-h', `${pinned ? Math.round(bar.getBoundingClientRect().height) : 0}px`);
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
  const stuck = () => {
    if (bar && bar.isConnected) bar.classList.toggle('is-stuck', pinned && window.scrollY > 0 && bar.getBoundingClientRect().top <= 0.5);
  };
  function track() {
    const el = app && app.querySelector(':scope > .editions');
    if (el === bar) return;
    if (ro && bar) ro.unobserve(bar);
    bar = el;
    if (!bar) return root.style.removeProperty('--bar-h');
    if (ro) ro.observe(bar);
    measure();
    stuck();
  }
  if (app) new MutationObserver(() => { track(); syncFab(); }).observe(app, { childList: true });
  // 跨過 40em 時直接重量：收成 0 高時 ResizeObserver 不一定通知
  if (window.matchMedia) {
    const narrow = window.matchMedia('(max-width: 40em)');
    if (narrow.addEventListener) narrow.addEventListener('change', measure);
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; stuck(); });
  }, { passive: true });

  // ── 5. 手機右下角功能鈕 ──
  // 定案：功能鈕、扇面只有圖示，名稱（報讀器照唸）按住滑過或鍵盤聚焦時浮出；點開再點一格，或按住滑到那格放開
  // 項目讀自 #app 的工具列。每格＝clip-path 裁的按鈕（點擊範圍一起裁），格線另畫在上層 SVG
  // root 的 has-fab、fab-open、fab-sheet 給 report.css
  // 定案：半徑 34（中間留給 44px 功能鈕，report.css --fab-size）／98／162，一圈時 34–162
  const FAB_R = [34, 98, 162];
  // 縫與圓角：藍圖一整片細線分格，地圖、一般分開的圓角塊
  const FAB_SHAPE = { blueprint: { gap: 0, round: 0 }, atlas: { gap: 4, round: 6 }, standard: { gap: 4, round: 6 } };
  const lookNow = () => root.getAttribute('data-look') || 'blueprint';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => {
    const el = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  let fab = null; // { layer, btn, anchor, tip, key }
  let fanOpen = false;
  let hot = null;
  let drag = null;
  let lastUp = 0; // 放開時間：擋補發的 click
  let lastDragGo = 0; // 滑到某格放開的時間：擋補發的 click
  const runs = new WeakMap(); // 扇面按鈕 → 開面板的函式

  function sheetHow() {
    root.classList.add('fab-sheet');
    return {
      sheet: true,
      after: (had) => {
        root.classList.remove('fab-sheet');
        if (had && fab) fab.btn.focus({ preventScroll: true });
      },
    };
  }
  const openPanel = (id) => () => {
    const p = document.getElementById(id);
    const c = p && ctrls.get(p);
    if (c) c.open(true, sheetHow());
  };

  // → { panels 外圈, links 內圈 } 或 null。版面面板 id：report.js 等 vw-panel、front.js fp-panel
  function fabItems() {
    const bar = app && app.querySelector(':scope > .editions');
    if (!bar) return null;
    const panels = [];
    const panel = (id, label, icon) => {
      const p = document.getElementById(id);
      if (p && app.contains(p) && ctrls.has(p)) panels.push({ key: id, label, icon, run: openPanel(id) });
    };
    panel('sr-panel', '系列', 'series');
    if (app.querySelector('.fp-fq .fp-chip')) panels.push({ key: 'fq', label: '過濾', icon: 'filter', run: openFilter });
    panel('vw-panel', '版面', 'sliders');
    panel('fp-panel', '版面', 'sliders');
    const links = [...bar.querySelectorAll(':scope > a.ed-link')].map((a) => {
      const ico = a.querySelector('.dd-ico');
      return { key: a.getAttribute('href'), label: a.textContent.trim(), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), html: ico ? ico.innerHTML : '' };
    });
    return { panels, links };
  }

  // 0°＝正左、90°＝正上。定案：外圈由下往上系列、過濾（本日焦點、議題目錄才有）、版面；
  // 內圈由上往下本日焦點、議題
  function buildPie(items) {
    const S = FAB_R[2] + 2;
    const P = (r, a) => {
      const t = (a * Math.PI) / 180;
      return `${(S - r * Math.cos(t)).toFixed(2)} ${(S - r * Math.sin(t)).toFixed(2)}`;
    };
    const shape = FAB_SHAPE[lookNow()] || FAB_SHAPE.blueprint;
    // 格間留 gap（兩邊各縮一半、邊線平行；整片外緣不縮）；四角二次曲線修圓（控制點＝原尖角）
    function cellPath(r0, r1, a0, a1) {
      const g = shape.gap / 2;
      const rc = shape.round;
      const ri = r0 + (r0 === FAB_R[0] ? 0 : g);
      const ro = r1 - (r1 === FAB_R[2] ? 0 : g);
      const ds = a0 === 0 ? 0 : g;
      const de = a1 === 90 ? 0 : g;
      const A0 = (r) => a0 + (Math.asin(ds / r) * 180) / Math.PI; // 縮進 ds 後的邊線在半徑 r 處的角度
      const A1 = (r) => a1 - (Math.asin(de / r) * 180) / Math.PI;
      if (!rc) return `M${P(ro, A0(ro))}A${ro} ${ro} 0 0 1 ${P(ro, A1(ro))}L${P(ri, A1(ri))}A${ri} ${ri} 0 0 0 ${P(ri, A0(ri))}Z`;
      const deg = (len, r) => (len / r) * 180 / Math.PI;
      return `M${P(ro - rc, A0(ro - rc))}Q${P(ro, A0(ro))} ${P(ro, A0(ro) + deg(rc, ro))}`
        + `A${ro} ${ro} 0 0 1 ${P(ro, A1(ro) - deg(rc, ro))}Q${P(ro, A1(ro))} ${P(ro - rc, A1(ro - rc))}`
        + `L${P(ri + rc, A1(ri + rc))}Q${P(ri, A1(ri))} ${P(ri, A1(ri) - deg(rc, ri))}`
        + `A${ri} ${ri} 0 0 0 ${P(ri, A0(ri) + deg(rc, ri))}Q${P(ri, A0(ri))} ${P(ri + rc, A0(ri + rc))}Z`;
    }
    const rings = [items.links.slice().reverse(), items.panels].filter((r) => r.length);
    const bounds = rings.length === 2 ? [[FAB_R[0], FAB_R[1]], [FAB_R[1], FAB_R[2]]] : [[FAB_R[0], FAB_R[2]]];
    const pie = h('div', { class: 'fab-pie', id: 'fab-pie', role: 'group', 'aria-label': '功能' });
    pie.style.width = pie.style.height = `${S}px`;
    const lines = sv('svg', { class: 'fab-lines', viewBox: `0 0 ${S} ${S}`, width: S, height: S, 'aria-hidden': 'true', focusable: 'false' });
    const cells = new Map();
    rings.forEach((list, ri) => {
      const [r0, r1] = bounds[ri];
      list.forEach((x, k) => {
        const a0 = (90 * k) / list.length;
        const a1 = (90 * (k + 1)) / list.length;
        const d = cellPath(r0, r1, a0, a1);
        const el = x.href
          ? h('a', { class: 'fab-it', href: x.href, 'aria-current': x.current || null })
          : h('button', { type: 'button', class: 'fab-it', 'aria-haspopup': 'dialog' });
        el.style.clipPath = `path("${d}")`;
        const t = (((a0 + a1) / 2) * Math.PI) / 180;
        const rm = (r0 + r1) / 2;
        const at = [-rm * Math.cos(t), -rm * Math.sin(t)]; // 圖示中心（相對功能鈕中心）
        const inner = h('span', { class: 'fab-in' }, [h('span', { class: 'fab-ico', html: x.html || ICON[x.icon] }), h('span', { class: 'fab-lab' }, [x.label])]);
        inner.style.left = `${(S + at[0]).toFixed(1)}px`;
        inner.style.top = `${(S + at[1]).toFixed(1)}px`;
        el.append(inner);
        el.dataset.k = String(cells.size);
        el.dataset.tipX = at[0].toFixed(1);
        el.dataset.tipY = at[1].toFixed(1);
        if (x.run) runs.set(el, x.run);
        lines.append(sv('path', { d, 'data-k': el.dataset.k }));
        cells.set(x, el);
      });
    });
    lines.append(sv('path', { class: 'fab-rim', d: `M${P(FAB_R[2], 0)}A${FAB_R[2]} ${FAB_R[2]} 0 0 1 ${P(FAB_R[2], 90)}` }));
    // 鍵盤順序：外圈由下往上，再內圈
    [...items.panels, ...items.links].forEach((x) => { if (cells.has(x)) pie.append(cells.get(x)); });
    pie.append(lines);
    return pie;
  }

  // 名稱放 .fab-tip：在扇面外層，不被 clip-path 裁掉
  function mark(el, cls, on) {
    if (!el || !fab) return;
    el.classList.toggle(cls, on);
    const path = fab.anchor.querySelector(`.fab-lines [data-k="${el.dataset.k}"]`);
    if (path) path.classList.toggle(cls, on);
    const lab = el.querySelector('.fab-lab');
    fab.tip.hidden = !on;
    if (on && lab) {
      fab.tip.textContent = lab.textContent;
      fab.tip.style.left = `${el.dataset.tipX}px`;
      fab.tip.style.top = `${el.dataset.tipY}px`;
    }
  }
  function setHot(el) {
    if (el === hot) return;
    mark(hot, 'is-hot', false);
    hot = el;
    mark(hot, 'is-hot', true);
  }
  const cellAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const it = el && el.closest('.fab-it');
    return it && fab && fab.anchor.contains(it) ? it : null;
  };

  function setFan(yes, focusFirst) {
    if (!fab) return;
    fanOpen = yes;
    fab.layer.classList.toggle('is-open', yes);
    root.classList.toggle('fab-open', yes);
    fab.btn.setAttribute('aria-expanded', String(yes));
    setHot(null);
    if (yes) {
      live.forEach((d) => { if (!d.panel.hidden) d.open(false); });
      const first = focusFirst && fab.anchor.querySelector('.fab-it');
      if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
    } else if (fab.anchor.contains(document.activeElement)) fab.btn.focus({ preventScroll: true });
  }
  function shutFan() {
    if (!fanOpen) return;
    setFan(false);
    fab.btn.focus({ preventScroll: true });
  }
  // 連結點一下走瀏覽器預設換頁，按住滑過放開的才自己換
  function activate(el, viaDrag) {
    setFan(false);
    if (el.tagName === 'A') {
      if (viaDrag) location.assign(el.href);
      return;
    }
    const run = runs.get(el);
    if (run) run();
  }

  function ensureFab() {
    if (fab) return;
    const scrim = h('div', { class: 'fab-scrim' });
    const btn = h('button', { type: 'button', class: 'fab-btn', 'aria-label': '功能', 'aria-expanded': 'false', 'aria-controls': 'fab-pie', html: ICON.fan + ICON.close });
    const tip = h('span', { class: 'fab-tip', 'aria-hidden': 'true', hidden: true });
    const anchor = h('div', { class: 'fab-anchor' }, [tip]);
    const layer = h('div', { class: 'fab-layer' }, [scrim, btn, anchor]);
    document.body.append(layer);
    fab = { layer, btn, anchor, tip, key: '' };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, was: fanOpen, moved: false };
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 不支援就只能點 */ }
      if (!fanOpen) setFan(true);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) drag.moved = true;
      if (drag.moved) setHot(cellAt(e.clientX, e.clientY));
    });
    btn.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      lastUp = Date.now();
      const el = d.moved ? cellAt(e.clientX, e.clientY) : null;
      setHot(null);
      if (el) {
        lastDragGo = lastUp;
        activate(el, true);
      } else if (!d.moved && d.was) setFan(false);
    });
    btn.addEventListener('pointercancel', () => {
      drag = null;
      setHot(null);
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 長按不跳出系統選單
    // 不往上傳：免得「點外面」收掉剛開的面板
    layer.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = e.target.closest('.fab-it');
      if (it && Date.now() - lastDragGo < 700) return e.preventDefault(); // 按住滑過放開後補發的 click
      if (e.target === scrim) return setFan(false);
      if (e.target.closest('.fab-btn')) {
        if (Date.now() - lastUp > 700) setFan(!fanOpen, true); // 鍵盤、沒送指標事件的輔助工具：點一下切換
        return;
      }
      if (it) activate(it, false);
    });
    const keyboardFocus = (el) => { try { return el.matches(':focus-visible'); } catch (err) { return true; } }; // 舊 Safari 不認得 :focus-visible
    anchor.addEventListener('focusin', (e) => { const it = e.target.closest('.fab-it'); if (it && keyboardFocus(it)) mark(it, 'is-focus', true); });
    anchor.addEventListener('focusout', (e) => { const it = e.target.closest('.fab-it'); if (it) mark(it, 'is-focus', false); });
  }

  function syncFab() {
    const items = fabItems();
    const has = Boolean(items && items.panels.length + items.links.length);
    root.classList.toggle('has-fab', has);
    measure(); // has-fab 改變工具列收不收→重量
    if (!has) {
      if (fab) {
        setFan(false);
        fab.layer.hidden = true;
      }
      return;
    }
    ensureFab();
    fab.layer.hidden = false;
    const key = JSON.stringify([lookNow(), items.panels.map((x) => [x.key, x.label]), items.links.map((x) => [x.label, x.href, x.current])]);
    if (key === fab.key) return;
    fab.key = key;
    setFan(false);
    fab.anchor.querySelectorAll('.fab-pie').forEach((n) => n.remove());
    fab.anchor.prepend(buildPie(items));
  }

  // 頭版過濾面板（議題目錄 story.js 用同一套標記）：照抄 front.js 的 .fp-fq .fp-chip（代號 data-type、名稱 .fp-chip-t、則數 .fp-chip-n、aria-pressed）、.fp-fq-clear，
  // 按了代按頁面那顆
  let fq = null;
  const realChips = () => [...document.querySelectorAll('#app .fp-fq .fp-chip')];
  const chipId = (c) => c.dataset.type;
  const chipName = (c) => c.querySelector('.fp-chip-t').textContent;
  function proxyClick(el) {
    proxying = true;
    try { el.click(); } finally { proxying = false; }
  }
  function syncFilter() {
    const chips = realChips();
    let any = false;
    fq.list.querySelectorAll('.fq-item').forEach((b) => {
      const real = chips.find((c) => chipId(c) === b.dataset.id);
      const on = Boolean(real && real.getAttribute('aria-pressed') === 'true');
      b.setAttribute('aria-pressed', String(on));
      any = any || on;
    });
    const lost = fq.clear.contains(document.activeElement);
    fq.clear.hidden = !any;
    if (lost && !any) {
      const first = fq.list.querySelector('.fq-item');
      if (first) first.focus();
    }
  }
  // 只從功能鈕開的底部面板（過濾；頁面上沒有對應下拉）→ { box, panel, list, open(yes, how), shut }
  function sheetBox({ id, cls, title, closeLabel, extra = [] }) {
    const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': closeLabel, html: ICON.close });
    const list = h('ul', { class: 'fq-list', 'aria-labelledby': `${id}-title` });
    const panel = h('div', { class: `dd-panel ${cls}-panel`, id, role: 'dialog', 'aria-labelledby': `${id}-title`, hidden: true }, [
      h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: `${id}-title` }, [title]), ...extra, close]),
      list,
    ]);
    const s = { panel, list };
    const shade = makeShade(() => s.shut());
    s.box = h('div', { class: `dd ${cls}` }, [shade, panel]);
    document.body.append(s.box);
    let after = null;
    s.open = (yes, how) => {
      const had = !yes && !panel.hidden && panel.contains(document.activeElement);
      panel.hidden = !yes;
      panel.classList.toggle('is-sheet', yes);
      showShade(shade, yes);
      if (!yes) {
        if (after) {
          const f = after;
          after = null;
          f(had);
        }
        return;
      }
      after = (how && how.after) || null;
      openMotion(panel, true);
      (list.querySelector('[aria-pressed=true]') || list.querySelector('.fq-item') || close).focus({ preventScroll: true });
    };
    s.shut = () => s.open(false);
    sheetDrag(panel, shade, s.shut);
    live.add(s);
    close.addEventListener('click', s.shut);
    return s;
  }

  function openFilter() {
    const chips = realChips();
    if (!chips.length) return;
    if (!fq) {
      const clear = h('button', { type: 'button', class: 'fq-clear', hidden: true }, ['清除']);
      fq = sheetBox({ id: 'fq-panel', cls: 'fq', title: '依系列過濾', closeLabel: '關閉過濾', extra: [clear] });
      fq.clear = clear;
      const { list } = fq;
      list.addEventListener('click', (e) => {
        const b = e.target.closest('.fq-item');
        const real = b && realChips().find((c) => chipId(c) === b.dataset.id);
        if (real) proxyClick(real);
        syncFilter();
      });
      clear.addEventListener('click', () => {
        const real = document.querySelector('#app .fp-fq .fp-fq-clear');
        if (real) proxyClick(real);
        syncFilter();
      });
    }
    // 每次照現在的標籤重列（重畫後系列、則數會變）；--g-c 抄標籤的計算值（front.css 依 data-group 給）
    fq.list.replaceChildren(...chips.map((c) => {
      const n = c.querySelector('.fp-chip-n');
      const b = h('button', { type: 'button', class: 'fq-item', 'data-id': chipId(c), 'aria-pressed': 'false' }, [
        h('span', { class: 'fq-mk', html: ICON.check }),
        h('span', { class: 'fq-name' }, [chipName(c)]),
        h('span', { class: 'pd-n' }, [n && n.firstChild ? n.firstChild.textContent : '']),
      ]);
      const color = getComputedStyle(c).getPropertyValue('--g-c').trim();
      if (color) b.style.setProperty('--g-c', color);
      return h('li', null, [b]);
    }));
    syncFilter();
    fq.open(true, sheetHow());
  }

  syncFab();
  new MutationObserver(() => syncFab()).observe(root, { attributes: true, attributeFilter: ['data-look'] }); // 換外觀：扇面換形狀

  A.bar = { ICON, dropdown, toolbar, navLink, storyLink, cardSeries, seriesMenu, roving };
})();
