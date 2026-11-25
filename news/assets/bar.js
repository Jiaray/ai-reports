/* 新聞頁報頭共用元件（report.js、series.js、front.js、card.js、story.js、adhoc.js；舊 wip.js），掛 AIR.bar（介面見檔尾），依賴 AIR.h、#app。
   1. 圖示（aria-hidden；按鈕名稱靠文字或 aria-label）
   2. 下拉 dropdown()（功能鈕開時為底部面板）
   3. 期別寫法
   4. 元件 datePicker、titleChapters、seriesMenu（面板內容 seriesGroups）、toolbar、navLink、storyLink、roving。
      工具列組成（樣式摘要 5.1）：新聞卡相關的頁「系列 ▾｜本日焦點｜本週回顧｜議題｜版面」；週報報告頁與本週回顧日期按鈕排最前面
   5. 工具列凍結：--bar-h、.is-stuck
   6. 非當期提示 staleBanner
   7. 手機右下角功能鈕（扇面） */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const WEEK = '日一二三四五六';

  // ── 1. 圖示 ──
  const svg = (size, d, extra = '') => `<svg viewBox="0 0 20 20"${size ? ` width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="${d}"/>${extra}</svg>`;
  const ICON = {
    sliders: svg(18, 'M2.5 6H11M15 6h2.5M2.5 14H5M9 14h8.5', '<rect x="11" y="4" width="4" height="4"/><rect x="5" y="12" width="4" height="4"/>'), // 版面；方形旋鈕配藍圖方角
    calendar: svg(18, 'M3 4.5h14V17H3zM3 8.5h14M7 2.5v4M13 2.5v4'),
    caret: svg(14, 'M6 8l4 4 4-4'),
    close: svg(16, 'M5 5l10 10M15 5 5 15'),
    caretLg: svg(0, 'M5 7.5l5 5 5-5'), // 大標題箭頭：不給寬高，隨 CSS 外框
    front: svg(18, 'M3 3.5h14v13H3zM6 7.5h8M6 10.5h8M6 13.5h5'), // 本日焦點：一張報紙（同網站圖示）
    weekly: svg(18, 'M6 2.5h11v11H6zM3 5.5v12h12M9 6h5M9 9h5M9 12h3'), // 本週回顧：兩張疊報紙；front、weekly 也給 front.js「出自」用
    series: svg(18, 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z'), // 系列：四格
    story: svg(18, 'M8.4 2.5 6.6 17.5M13.4 2.5l-1.8 15M3.5 7.2h14M2.5 12.8h14'), // 議題：#（議題名就是網址的 #），須和其他圖示分得出
    warn: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M10 2.8 18 17H2z" stroke-linejoin="round"/><path d="M10 8v4.2M10 14.2v.1" stroke-linecap="round" stroke-width="1.9"/></svg>',
    fan: svg(20, 'M17 17H3.5A13.5 13.5 0 0 1 17 3.5zM17 17 5.3 10.25M17 17 10.25 5.3'), // 功能鈕：從右下角張開的扇子
    // 章節：›＋三條線，須和 readScan 分得出（扇面相鄰）
    chapters: svg(18, 'M8.5 5h8.5M8.5 10h8.5M8.5 15h8.5M3 7l3 3-3 3').replace('<path ', '<path stroke-linecap="round" stroke-linejoin="round" '),
    filter: svg(18, 'M2.5 3.5h15l-6 7v6l-3-1.5v-4.5z'),
    check: svg(12, 'M4 10.5l3.5 3.5L16 5.5'),
    // 讀法（report.js 選項、扇面共用）：readFull＝四行字、readScan＝方點清單、readTimeline＝時鐘＋逆時針箭頭（須和 readScan 分得出）
    readFull: svg(16, 'M3.5 4.5h13M3.5 8h13M3.5 11.5h13M3.5 15h8'),
    readScan: svg(16, 'M7.5 5h9M7.5 10h9M7.5 15h9', '<rect x="3" y="4" width="2" height="2"/><rect x="3" y="9" width="2" height="2"/><rect x="3" y="14" width="2" height="2"/>'),
    readTimeline: svg(16, 'M2.5 10a7.5 7.5 0 1 0 7.5-7.5 8.1 8.1 0 0 0-5.6 2.3L2.5 6.7M2.5 2.5v4.2h4.2M10 5.8V10l3.3 1.7')
      .replace('<path ', '<path stroke-linecap="round" stroke-linejoin="round" '),
  };

  // ── 2. 下拉面板 ──
  // 用 WAAPI 不用 @starting-style：換讀法時面板隨報頭搬家，後者每搬一次重播淡入
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

  // 面板貼按鈕左緣展開、超出視窗右緣（工具列換行、系列按鈕排在日期後）→ 往左移回來，左右各留 16px；底部面板不移。
  // 用負 margin 不用 translate：translate 前的位置仍算進可捲動範圍，會多出橫向捲動
  function fitIn(panel, sheet) {
    panel.style.marginLeft = '';
    if (sheet) return;
    const r = panel.getBoundingClientRect();
    const over = r.right - (document.documentElement.clientWidth - 16);
    if (over > 0) panel.style.marginLeft = `${-Math.max(0, Math.min(over, r.left - 16))}px`;
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
    shutFan(); // 第 7 段
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

  // ── 3. 期別寫法 ──
  const ymd = (p) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(p || '');
  const wdOf = (m) => WEEK[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()];
  // front.js 每週頭版 document.title 也用
  function periodLabel(period, cadence) {
    let m;
    if (cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(period))) return `${m[1]} 年第 ${+m[2]} 週`;
    if (cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(period))) return `${m[1]} 年 ${+m[2]} 月`;
    return (m = ymd(period)) ? `${period}（週${wdOf(m)}）` : period;
  }
  function periodGroup(period, cadence) {
    const y = period.slice(0, 4);
    if (cadence === 'weekly' || cadence === 'monthly') return `${y} 年`;
    const m = ymd(period);
    return m ? `${y} 年 ${+m[2]} 月` : y;
  }
  function periodRow(period, cadence) {
    let m;
    if (cadence === 'weekly' && (m = /^\d{4}-W(\d{2})$/.exec(period))) return [`第 ${+m[1]} 週`];
    if (cadence === 'monthly' && (m = /^\d{4}-(\d{2})$/.exec(period))) return [`${+m[1]} 月`];
    if (!(m = ymd(period))) return [period];
    return [h('span', null, [`${+m[2]}/${+m[3]}`]), h('span', { class: 'pd-wd' }, [`週${wdOf(m)}`])];
  }

  // ── 4. 元件 ──
  // 工具列須是 #app 的直接子節點（第 5、7 段靠 :scope > .editions 找）
  const toolbar = (kids) => h('nav', { class: 'editions', 'aria-label': '報頭工具列' }, kids.filter(Boolean));
  // current＝aria-current：page＝這頁本身，true＝同一邊（日報／週報）的其他頁
  const navLink = (text, icon, href, current) => h('a', { class: 'ed-link', href, 'aria-current': current || null }, [
    h('span', { class: 'dd-ico', html: ICON[icon] }), h('span', null, [text]),
  ]);

  // 用連結不用 <select>：換頁不是選值。here（左欄）：[{ text, count, href, current }]；periods（右欄）：[{ period, href, current }]（新到舊）
  const UNIT = { daily: ['日期', '這天的新聞'], weekly: ['週期', '這週的新聞'], monthly: ['月份', '這個月的新聞'] };
  function datePicker({ period, cadence, here, periods }) {
    const [unit, hereName] = UNIT[cadence] || UNIT.daily;
    const typeCol = here.length ? h('div', { class: 'pd-col pd-types' }, [
      h('p', { class: 'pd-group', id: 'pd-types-label' }, [hereName]),
      h('ul', { class: 'pd-items', 'aria-labelledby': 'pd-types-label' }, here.map((x) => h('li', null, [
        h('a', { class: 'pd-item', href: x.href, 'aria-current': x.current ? 'page' : null }, [
          h('span', null, [x.text]), x.count ? h('span', { class: 'pd-n' }, [String(x.count)]) : null,
        ]),
      ]))),
    ]) : null;
    const groups = [];
    periods.forEach((p) => {
      const name = periodGroup(p.period, cadence);
      let last = groups[groups.length - 1];
      if (!last || last.name !== name) groups.push(last = { name, items: [] });
      last.items.push(p);
    });
    const dateCol = h('div', { class: 'pd-col pd-dates' }, groups.flatMap((g, gi) => [
      h('p', { class: 'pd-group', id: `pd-g${gi}` }, [g.name]),
      h('ul', { class: 'pd-items', 'aria-labelledby': `pd-g${gi}` }, g.items.map((p) => h('li', null, [
        h('a', { class: 'pd-item', href: p.href, 'aria-current': p.current ? 'page' : null }, periodRow(p.period, cadence)),
      ]))),
    ]));
    return dropdown({
      cls: 'pd', id: 'pd-panel', title: unit, closeLabel: `關閉${unit}`,
      toggleKids: [
        h('span', { class: 'dd-ico', html: ICON.calendar }),
        h('span', { class: 'visually-hidden' }, [`${unit}：`]), h('span', null, [periodLabel(period, cadence)]),
        h('span', { class: 'dd-caret', html: ICON.caret }),
      ],
      body: [h('div', { class: 'pd-body' }, [typeCol, dateCol])],
      // 頭版的 here 沒有 current→落在第一個系列
      pick: (panel) => ['.pd-types .pd-item[aria-current=page]', '.pd-types .pd-item', '.pd-item[aria-current=page]']
        .map((s) => panel.querySelector(s)).find(Boolean),
    });
  }

  // 章節下拉（只有報告頁）：按鈕包在 <h1> 裡保留標題地標；最後一字＋箭頭包 .chap-tail 不換行（兩行時箭頭接在字後）
  // items：[{ name, count, href, k }]（k：地圖外觀分區色號）
  function titleChapters({ title, items, panelTitle }) {
    if (!items.length) return h('h1', { class: 'mast-title' }, [title]);
    return dropdown({
      cls: 'chap', id: 'chap-panel', title: panelTitle, closeLabel: `關閉${panelTitle}`, toggleCls: 'chap-toggle',
      toggleKids: [
        h('span', { class: 'chap-name' }, [
          title.slice(0, -1),
          h('span', { class: 'chap-tail' }, [title.slice(-1), h('span', { class: 'chap-caret', html: ICON.caretLg })]),
        ]),
        h('span', { class: 'visually-hidden' }, [`，${panelTitle}`]),
      ],
      wrap: (toggle) => h('h1', { class: 'mast-title' }, [toggle]),
      body: [h('ul', { class: 'chap-list', 'aria-labelledby': 'chap-panel-title' }, items.map((x) => h('li', null, [
        h('a', { class: 'chap-item', href: x.href, 'data-k': x.k || null }, [
          h('span', { class: 'chap-sec' }, [x.name]), h('span', { class: 'pd-n' }, [String(x.count)]),
        ]),
      ])))],
      pick: (panel) => panel.querySelector('.chap-item'),
    });
  }

  // 新聞卡日報系列：index.json series 裡 cadence daily 的，GitHub 趨勢（仍是報告）與臨時系列（publish.py 給領域「其他」）除外
  const REPORT_DAILY = ['github'];
  const cardSeries = (index) => (index && Array.isArray(index.series) ? index.series : [])
    .filter((s) => s && typeof s.id === 'string' && s.cadence === 'daily' && !REPORT_DAILY.includes(s.id) && s.group !== '其他');
  // 「系列 ▾」面板兩欄（樣式摘要 5.1）：左「新聞卡（近 7 天）」＝新聞卡日報系列頁，右「照舊的報告」＝週報、月報、GitHub 趨勢。
  // 綜合併入本日焦點、臨時系列（領域「其他」）只用網址開，都不列。連結 ./?t=（新聞卡頁等其他頁面也連得到）；current＝目前的系列代號
  // （目前位置同日期面板 aria-current=page）。左欄順序照樣式摘要（博奕挨著遊戲），不在表上的照 index.json 順序接在後面；
  // 右欄同名開頭的併成一列（GitHub 日／週／月）。一顆下拉不逐一放按鈕：十多個系列擺不進工具列與扇面
  const PANEL_ORDER = ['international', 'tech_ai', 'tech', 'security', 'finance', 'health', 'gambling', 'gamedev', 'taiwan_general', 'taiwan_disaster', 'social'];
  const CADENCE_WORD = new Map([['daily', '日'], ['weekly', '週'], ['monthly', '月']]);
  // 面板兩欄的內容 → { cards: [系列設定], reports: [{ name, list: [系列設定] }] }（系列頁沒有卡時也照這份列其他系列）
  function seriesGroups(index) {
    const all = index && Array.isArray(index.series) ? index.series.filter((s) => s && typeof s.id === 'string') : [];
    const rank = (id) => (PANEL_ORDER.includes(id) ? PANEL_ORDER.indexOf(id) : PANEL_ORDER.length);
    const cards = cardSeries(index).filter((s) => s.id !== 'general')
      .map((s, i) => ({ s, i })).sort((a, b) => rank(a.s.id) - rank(b.s.id) || a.i - b.i).map((x) => x.s);
    const cardIds = new Set(cardSeries(index).map((s) => s.id));
    const reports = [];
    all.filter((s) => !cardIds.has(s.id) && s.id !== 'general' && s.group !== '其他' && CADENCE_WORD.has(s.cadence)).forEach((s) => {
      const name = String(s.short || s.title || s.id).split(/\s+/)[0];
      const same = reports.find((r) => r.name === name);
      if (same) same.list.push(s);
      else reports.push({ name, list: [s] });
    });
    const order = [...CADENCE_WORD.keys()];
    reports.forEach((r) => r.list.sort((a, b) => order.indexOf(a.cadence) - order.indexOf(b.cadence)));
    return { cards, reports };
  }
  function seriesMenu(index, current) {
    const { cards, reports } = seriesGroups(index);
    if (!cards.length && !reports.length) return null;
    const href = (s) => `./?t=${encodeURIComponent(s.id)}`;
    const here = (s) => (s.id === current ? 'page' : null);
    const item = (s) => h('a', { class: 'pd-item sr-it', href: href(s), 'data-group': s.group || null, 'aria-current': here(s) }, [
      h('span', null, [s.short || s.title || s.id]),
    ]);
    // 同名多份（GitHub）：名稱不是連結，後面接「日」「週」「月」；報讀器唸「GitHub 日報」
    const multi = (r) => {
      const subs = r.list;
      return h('div', { class: 'sr-multi', 'data-group': subs[0].group || null }, [
        h('span', { class: 'sr-name', 'aria-hidden': 'true' }, [r.name]),
        ...subs.map((s) => h('a', { class: 'pd-item sr-sub', href: href(s), 'aria-current': here(s) }, [
          h('span', { class: 'visually-hidden' }, [`${r.name} `]), CADENCE_WORD.get(s.cadence), h('span', { class: 'visually-hidden' }, ['報']),
        ])),
      ]);
    };
    const col = (cls, id, name, items) => {
      if (!items.length) return null;
      const ul = h('ul', { class: 'pd-items sr-list', 'aria-labelledby': id }, items.map((x) => h('li', null, [x])));
      ul.style.setProperty('--sr-rows', String(Math.ceil(items.length / 2))); // 左欄兩欄時的列數（report.css）
      return h('div', { class: `sr-col ${cls}` }, [h('p', { class: 'pd-group', id }, [name]), ul]);
    };
    return dropdown({
      cls: 'sr', id: 'sr-panel', title: '系列', closeLabel: '關閉系列',
      toggleKids: [h('span', { class: 'dd-ico', html: ICON.series }), h('span', null, ['系列']), h('span', { class: 'dd-caret', html: ICON.caret })],
      body: [h('div', { class: 'sr-body' }, [
        col('sr-cards', 'sr-g-cards', '新聞卡（近 7 天）', cards.map(item)),
        col('sr-reports', 'sr-g-reports', '照舊的報告', reports.map((r) => (r.list.length > 1 ? multi(r) : item(r.list[0])))),
      ])],
      pick: (panel) => panel.querySelector('.pd-item[aria-current=page]') || panel.querySelector('.pd-item'),
    });
  }
  // 「議題」→ 議題目錄（story.html）；current 同 navLink
  const storyLink = (current) => navLink('議題', 'story', 'story.html', current);

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

  // ── 5. 工具列凍結 ──
  // --bar-h 給 report.css、front.css、look-standard.css 讀，.is-stuck 給 report.css。工具列重畫是新元素→監看 #app 重找重量；
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
  // report.js 換讀法捲回同一則時用
  const barHeight = () => (bar && bar.isConnected && pinned ? bar.getBoundingClientRect().height : 0);

  // ── 6. 非當期提示 ──
  // 台北今天用 IANA 時區，不支援才固定 +8（台灣無日光節約）；不用 Temporal：Safari 沒有，不值得載 polyfill
  const TZ = 'Asia/Taipei';
  const pad2 = (n) => String(n).padStart(2, '0');
  function taipeiToday() {
    try {
      const p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
        .formatToParts(new Date()).forEach((x) => { p[x.type] = +x.value; });
      if (p.year && p.month && p.day) return [p.year, p.month, p.day];
    } catch (e) { /* 退回固定偏移 */ }
    const t = new Date(Date.now() + 8 * 3600 * 1000);
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  }
  // ISO 週：星期四所在的年；Date.UTC 只當日曆算術
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const wy = t.getUTCFullYear();
    return `${wy}-W${pad2(Math.ceil(((t - Date.UTC(wy, 0, 1)) / 86400000 + 1) / 7))}`;
  }
  // 依期別寫法判斷，不看 cadence；認不出不提示
  const KINDS = [
    [/^\d{4}-\d{2}-\d{2}$/, '非當日資訊', (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`],
    [/^\d{4}-W\d{2}$/, '非當週資訊', isoWeek],
    [/^\d{4}-\d{2}$/, '非當月資訊', (y, m) => `${y}-${pad2(m)}`],
  ];
  function staleText(period) {
    const kind = KINDS.find(([re]) => re.test(period || ''));
    return kind && kind[2](...taipeiToday()) !== period ? kind[1] : '';
  }
  // 提示條須放在 #app 第一個（restale 靠它）；note 接在後面（頭版：最新一期但今天還沒出刊）
  // 和整頁一起畫（不事後插入推版面），故不加 live region：讀頁面第一個就讀到
  let staleOf = null; // { period, note }：分頁開著過午夜，回到前景時重算
  function staleBanner(period, note) {
    staleOf = { period, note };
    const text = staleText(period);
    return text ? h('p', { class: 'stale' }, [
      h('span', { class: 'stale-ico', html: ICON.warn }), h('span', null, [note ? `${text}・${note}` : text]),
    ]) : null;
  }
  function restale() {
    if (!staleOf || !app) return;
    const old = app.querySelector(':scope > .stale');
    const next = staleBanner(staleOf.period, staleOf.note);
    if (old && next) old.replaceWith(next);
    else if (old) old.remove();
    else if (next) app.prepend(next);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') restale(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) restale(); });

  // ── 7. 手機右下角功能鈕 ──
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

  // → { panels 外圈, links 內圈 } 或 null。版面面板 id：report.js vw-panel、front.js fp-panel
  function fabItems() {
    const bar = app && app.querySelector(':scope > .editions');
    if (!bar) return null;
    const panels = [];
    const panel = (id, label, icon) => {
      const p = document.getElementById(id);
      if (p && app.contains(p) && ctrls.has(p)) panels.push({ key: id, label, icon, run: openPanel(id) });
    };
    const pdTitle = document.getElementById('pd-panel-title');
    panel('pd-panel', pdTitle ? pdTitle.textContent : '日期', 'calendar');
    panel('sr-panel', '系列', 'series');
    if (app.querySelector('.fp-fq .fp-chip')) panels.push({ key: 'fq', label: '過濾', icon: 'filter', run: openFilter });
    else panel('chap-panel', '章節', 'chapters');
    // 讀法格：圖示抄選中的 .read-ico，名稱帶讀法→換讀法時重建
    const curRead = app.querySelector('.read-sw .read-opt[aria-pressed=true]');
    if (curRead) {
      panels.push({ key: 'rd', label: `讀法：${curRead.querySelector('.read-name').textContent}`, html: curRead.querySelector('.read-ico').innerHTML, run: openRead });
    }
    panel('vw-panel', '版面', 'sliders');
    panel('fp-panel', '版面', 'sliders');
    const links = [...bar.querySelectorAll(':scope > a.ed-link')].map((a) => {
      const ico = a.querySelector('.dd-ico');
      return { key: a.getAttribute('href'), label: a.textContent.trim(), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), html: ico ? ico.innerHTML : '' };
    });
    return { panels, links };
  }

  // 0°＝正左、90°＝正上。定案：外圈由下往上日期、章節或過濾、讀法、版面（系列照工具列排在日期後、沒有日期就在最下）；
  // 內圈由上往下本日焦點、本週回顧、議題
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
  // 只從功能鈕開的底部面板（過濾、讀法；頁面上沒有對應下拉）→ { box, panel, list, open(yes, how), shut }
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

  // 報告頁讀法面板（手機藏 .read-sw）：照抄 report.js 的 .read-opt（data-v、aria-pressed、.read-ico、.read-name），按了代按那顆
  let rd = null;
  const realReads = () => [...document.querySelectorAll('#app .read-sw .read-opt')];
  function openRead() {
    const opts = realReads();
    if (!opts.length) return;
    if (!rd) {
      rd = sheetBox({ id: 'rd-panel', cls: 'rds', title: '讀法', closeLabel: '關閉讀法' });
      rd.list.addEventListener('click', (e) => {
        const b = e.target.closest('.fq-item');
        const real = b && realReads().find((x) => x.dataset.v === b.dataset.v);
        if (!real) return;
        rd.shut();
        if (real.getAttribute('aria-pressed') !== 'true') proxyClick(real);
      });
    }
    rd.list.replaceChildren(...opts.map((o) => {
      return h('li', null, [h('button', { type: 'button', class: 'fq-item rds-item', 'data-v': o.dataset.v, 'aria-pressed': o.getAttribute('aria-pressed') }, [
        h('span', { class: 'rds-ico', html: o.querySelector('.read-ico').innerHTML }),
        h('span', { class: 'fq-name' }, [o.querySelector('.read-name').textContent]),
        h('span', { class: 'rds-mk', html: ICON.check }),
      ])]);
    }));
    rd.open(true, sheetHow());
  }
  syncFab();
  new MutationObserver(() => syncFab()).observe(root, { attributes: true, attributeFilter: ['data-look'] }); // 換外觀：扇面換形狀

  A.bar = { ICON, dropdown, periodLabel, toolbar, navLink, storyLink, datePicker, titleChapters, cardSeries, seriesGroups, seriesMenu, roving, barHeight, staleBanner };
})();
