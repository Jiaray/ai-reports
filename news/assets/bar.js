/* 新聞頁報頭的共用部分：報告頁（report.js）與頭版（front.js）的報頭長得一樣（使用者要求：所有頁面上方區塊統一功能）——
   最上面一列工具列「日期｜本日新聞｜本週新聞｜……｜版面」凍結在頂端，下面是大標題，報告頁的大標題點開是本期章節
   （頭版的大標題沒有下拉，右邊是快速過濾標籤，在 front.js）。
   index.html 在 site.js 之後、report.js／front.js 之前載入（都是 defer），掛在 window.AIR.bar。
   1. 圖示（裝飾用，aria-hidden；按鈕的名稱來自文字或 aria-label）
   2. dropdown()：報頭三種下拉面板（日期、大標題、版面）共用的骨架與開關
   3. 期別的寫法：日期按鈕的長短兩種、日期清單的分組與每列
   4. datePicker()、titleChapters()、toolbar()、navLink()：版面一致的元件，資料由各頁算好傳進來
   5. 工具列凍結（position:sticky 在 report.css）：量工具列高度寫進 :root 的 --bar-h（頭版黏頂的時段標題、
      錨點跳轉要讓開它），捲離頂端時加 .is-stuck（底下一條細線）
   6. 非當期提示：開的不是台北時間的今天、本週、本月那一期時，頁面最上面一條黃色橫幅
   7. 手機右下角的功能鈕：工具列的功能收進一顆按鈕，點開扇形展開；從這裡打開的面板改從底部升起 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const WEEK = '日一二三四五六';

  // ── 1. 圖示 ──────────────────────────────────────────────────────────
  const svg = (size, d, extra = '') => `<svg viewBox="0 0 20 20"${size ? ` width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="${d}"/>${extra}</svg>`;
  const ICON = {
    sliders: svg(18, 'M2.5 6H11M15 6h2.5M2.5 14H5M9 14h8.5', '<rect x="11" y="4" width="4" height="4"/><rect x="5" y="12" width="4" height="4"/>'), // 「版面」：方形旋鈕配合藍圖的方角
    calendar: svg(18, 'M3 4.5h14V17H3zM3 8.5h14M7 2.5v4M13 2.5v4'),
    caret: svg(14, 'M6 8l4 4 4-4'), // 日期按鈕右側，展開時轉向
    close: svg(16, 'M5 5l10 10M15 5 5 15'),
    caretLg: svg(0, 'M5 7.5l5 5 5-5'), // 大標題的箭頭：不給寬高、跟著外框（.66em），線條比日期按鈕的寬一些
    front: svg(18, 'M3 3.5h14v13H3zM6 7.5h8M6 10.5h8M6 13.5h5'), // 本日新聞：一張報紙（同網站圖示的三條橫線）
    weekly: svg(18, 'M6 2.5h11v11H6zM3 5.5v12h12M9 6h5M9 9h5M9 12h3'), // 本週新聞：疊起來的兩張報紙
    // 非當期提示：三角形警告（圓角頂點，線條粗一點）
    warn: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M10 2.8 18 17H2z" stroke-linejoin="round"/><path d="M10 8v4.2M10 14.2v.1" stroke-linecap="round" stroke-width="1.9"/></svg>',
    // 右下角功能鈕（第 7 段）：一把從右下角張開的扇子（暗示往左上方展開）、本期章節、頭版的過濾（漏斗）、過濾面板裡的勾
    fan: svg(20, 'M17 17H3.5A13.5 13.5 0 0 1 17 3.5zM17 17 5.3 10.25M17 17 10.25 5.3'),
    chapters: svg(18, 'M3 5.5h2M7.5 5.5H17M3 10h2M7.5 10H17M3 14.5h2M7.5 14.5H17'),
    filter: svg(18, 'M2.5 3.5h15l-6 7v6l-3-1.5v-4.5z'),
    check: svg(12, 'M4 10.5l3.5 3.5L16 5.5'),
  };

  // ── 2. 下拉面板 ──────────────────────────────────────────────────────
  // 打開面板時淡入、往下滑 4px（回應使用者的動作；減少動態時只淡入）。用 WAAPI 不用 @starting-style：
  // 換讀法時面板會跟著頁首那一列搬家，@starting-style 會在每次搬家重播一次淡入。
  // 從功能鈕打開的底部面板（sheet）改成從畫面底部升起
  function openMotion(el, sheet) {
    if (!el.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    else if (sheet) el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1)' });
    else el.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out' });
  }

  // 頁面上建過的下拉：點外面、Esc 由這裡的一組 document 監聽統一處理（頭版重畫時不會越掛越多監聽）。
  // proxying：功能鈕的過濾面板代按頁面上的標籤時，那一下不算「點外面」
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
  // 面板 → 開關：右下角功能鈕（第 7 段）用來從底部打開同一個面板
  const ctrls = new WeakMap();

  // 面板頂端是標題＋ ×（非 modal 面板要有看得見的關閉鈕，指南）；按鈕切換開關，點外面、按 Esc、按 × 都會收起
  // （Esc、× 收起後焦點回按鈕）；打開時淡入、焦點移到 pick(panel) 給的元素。點另一顆按鈕也算點外面，所以同時只開一個。
  // 按鈕在前、面板緊接在後：鍵盤從按鈕按 Tab 直接進面板。面板就放在按鈕旁的一般 DOM、absolute 定位，會跟著按鈕
  // （不用 popover：top layer 要靠 anchor positioning 才跟得住按鈕，Firefox 不支援）。
  // toggleCls 換掉按鈕的樣式（大標題用）；wrap 把按鈕包一層（大標題包進 <h1>）
  function dropdown({ cls, id, title, closeLabel, toggleKids, body, pick, toggleCls = 'dd-toggle', wrap = (t) => t }) {
    const toggle = h('button', { type: 'button', class: toggleCls, 'aria-expanded': 'false', 'aria-controls': id }, toggleKids);
    const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': closeLabel, html: ICON.close });
    const panel = h('div', { class: `dd-panel ${cls}-panel`, id, role: 'dialog', 'aria-labelledby': `${id}-title`, hidden: true }, [
      h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: `${id}-title` }, [title]), close]),
      ...body,
    ]);
    const box = h('div', { class: `dd ${cls}` }, [wrap(toggle), panel]);
    // how：{ sheet: true, after(had) }＝從功能鈕打開，面板貼齊底部（.is-sheet）；收起時呼叫 after，
    // had 表示收起前焦點在面板裡（after 把焦點交回功能鈕，不回頂端的按鈕）
    let after = null;
    function open(yes, how) {
      const had = !yes && !panel.hidden && panel.contains(document.activeElement);
      const sheet = Boolean(yes && how && how.sheet);
      panel.hidden = !yes;
      panel.classList.toggle('is-sheet', sheet);
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
        const f = after; // 底部面板開著時改從頂端按鈕打開：結束底部那一次
        after = null;
        f(false);
      }
      if (sheet) after = how.after || null;
      openMotion(panel, sheet);
      ((pick && pick(panel)) || close).focus({ preventScroll: sheet });
    }
    const shut = () => {
      const fromFab = Boolean(after);
      open(false);
      if (!fromFab) toggle.focus();
    };
    ctrls.set(panel, { open });
    toggle.addEventListener('click', () => open(panel.hidden));
    close.addEventListener('click', shut);
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) open(false); }); // 點了連結就收起
    live.add({ box, panel, open, shut });
    return box;
  }

  // ── 3. 期別的寫法 ────────────────────────────────────────────────────
  const ymd = (p) => /^(\d{4})-(\d{2})-(\d{2})$/.exec(p || '');
  const wdOf = (m) => WEEK[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()];
  // 日期按鈕的長寫法：2026-11-20（週五）、2026 年第 47 週、2026 年 11 月
  function periodLabel(period, cadence) {
    let m;
    if (cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(period))) return `${m[1]} 年第 ${+m[2]} 週`;
    if (cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(period))) return `${m[1]} 年 ${+m[2]} 月`;
    return (m = ymd(period)) ? `${period}（週${wdOf(m)}）` : period;
  }
  // 手機上的短寫法（日報同頭版的「11/20 週五」）：工具列放了本日新聞、本週新聞，長日期在手機放不進一列；年份看面板的分組標題
  function periodShort(period, cadence) {
    let m;
    if (cadence === 'weekly' && (m = /^\d{4}-W(\d{2})$/.exec(period))) return `第 ${+m[1]} 週`;
    if (cadence === 'monthly' && (m = /^\d{4}-(\d{2})$/.exec(period))) return `${+m[1]} 月`;
    return (m = ymd(period)) ? `${+m[2]}/${+m[3]} 週${wdOf(m)}` : period;
  }
  // 日期清單的分組與每列：日報依月份分組、一列是「11/18　週三」；週報、月報依年份分組、一列是「第 47 週」「11 月」
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

  // ── 4. 元件 ──────────────────────────────────────────────────────────
  // 工具列：報告頁與頭版同一列（日期、本日新聞、本週新聞、版面；沒有的就不放）
  const toolbar = (kids) => h('nav', { class: 'editions', 'aria-label': '報頭工具列' }, kids.filter(Boolean));
  // 本日新聞、本週新聞兩顆連結（圖示＋字）；current 是 aria-current 的值（page＝就是這頁，true＝同一邊的其他頁）
  const navLink = (text, icon, href, current) => h('a', { class: 'ed-link', href, 'aria-current': current || null }, [
    h('span', { class: 'dd-ico', html: ICON[icon] }), h('span', null, [text]),
  ]);

  // 日期按鈕（使用者要求：本日新聞時顯示日期、本週新聞時顯示週；日期、週期顯示有的素材）：按鈕是目前這期，點開是兩欄——
  // 左欄「這天的新聞」（週報「這週的新聞」）：那一期有的報告與則數；右欄有新聞的期別（依月份或年份分組）。
  // 每一項都是連結（換頁，不是表單選值，所以用連結清單、不用 <select>）。
  // here：[{ text, count, href, current }]；periods：[{ period, href, current }]（新到舊）
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
        // 長短兩種寫法由 CSS 依寬度只顯示一種（另一種 display:none，報讀器也只唸顯示的那種）
        h('span', { class: 'visually-hidden' }, [`${unit}：`]), h('span', { class: 'pd-long' }, [periodLabel(period, cadence)]),
        h('span', { class: 'pd-short' }, [periodShort(period, cadence)]),
        h('span', { class: 'dd-caret', html: ICON.caret }),
      ],
      body: [h('div', { class: 'pd-body' }, [typeCol, dateCol])],
      // 打開時焦點落在目前這個類型（頭版沒有，就是第一個類型）；只有日期欄時落在目前這期
      pick: (panel) => ['.pd-types .pd-item[aria-current=page]', '.pd-types .pd-item', '.pd-item[aria-current=page]']
        .map((s) => panel.querySelector(s)).find(Boolean),
    });
  }

  // 大標題（使用者要求：標題的下拉是本頁的章節）：標題文字＋往下的箭頭是一顆按鈕，點開是本期的分區（只有報告頁用；
  // 頭版的「本頁時段」下拉已拿掉，使用者覺得幫助不大），右邊是則數；是頁內連結，用 Tab 依序走，不是 ARIA menu（指南：導覽連結不加 menu／menuitem 角色、不攔方向鍵）。
  // 按鈕包在 <h1> 裡，標題地標照舊；報讀器唸「國際新聞日報，本期章節，按鈕，已收合」。沒有章節時是一般的 <h1>、不帶箭頭。
  // 箭頭跟最後一個字綁在一起（不換行）：標題在手機排成兩行時，箭頭接在最後一個字後面，不會漂在右側或單獨掉到下一行。
  // items：[{ name, count, href, k }]（k：地圖外觀的分區色號）
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

  // ── 5. 工具列凍結在頂端 ─────────────────────────────────────────────
  // 工具列每次重畫都是新的元素：#app 的子節點一換就重新找、重新量
  const root = document.documentElement;
  const app = document.getElementById('app');
  let bar = null;
  const measure = () => {
    if (bar && bar.isConnected) root.style.setProperty('--bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
  const stuck = () => {
    if (bar && bar.isConnected) bar.classList.toggle('is-stuck', window.scrollY > 0 && bar.getBoundingClientRect().top <= 0.5);
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
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; stuck(); });
  }, { passive: true });
  // 捲動補償（換讀法時捲回同一則）要扣掉的工具列高度
  const barHeight = () => (bar && bar.isConnected ? bar.getBoundingClientRect().height : 0);

  // ── 6. 非當期提示 ───────────────────────────────────────────────────
  // 使用者要求：開的新聞不是今天、本週（月報：本月）那一期時，頁面上方一條黃色半透明提示；使用者在四種樣式中選定
  // 「貼齊頂端的整條橫幅」，文字只寫「非當日資訊」「非當週資訊」「非當月資訊」（日期已在日期按鈕，不重複）。
  // 「今天」一律是台北時間，不看瀏覽器時區：用 IANA 時區名（指南：不寫死 UTC 偏移）；瀏覽器不認得時區時才退回 +8（台灣沒有日光節約）。
  // 不用 Temporal：Safari 還沒有，只為了取年月日不值得載 polyfill
  const TZ = 'Asia/Taipei';
  const pad2 = (n) => String(n).padStart(2, '0');
  function taipeiToday() {
    try {
      const p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
        .formatToParts(new Date()).forEach((x) => { p[x.type] = +x.value; });
      if (p.year && p.month && p.day) return [p.year, p.month, p.day];
    } catch (e) { /* 不支援 timeZone：用下面的固定偏移 */ }
    const t = new Date(Date.now() + 8 * 3600 * 1000);
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  }
  // ISO 週（同週報期別 YYYY-Www）：那一週的星期四落在哪一年就是哪一年的週；Date.UTC 只當日曆算術用
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const wy = t.getUTCFullYear();
    return `${wy}-W${pad2(Math.ceil(((t - Date.UTC(wy, 0, 1)) / 86400000 + 1) / 7))}`;
  }
  // 依期別的寫法判斷週期（不看 cadence 欄位）：期別和台北現在的同週期期別不同就要提示；認不出的期別不提示
  const KINDS = [
    [/^\d{4}-\d{2}-\d{2}$/, '非當日資訊', (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`],
    [/^\d{4}-W\d{2}$/, '非當週資訊', isoWeek],
    [/^\d{4}-\d{2}$/, '非當月資訊', (y, m) => `${y}-${pad2(m)}`],
  ];
  function staleText(period) {
    const kind = KINDS.find(([re]) => re.test(period || ''));
    return kind && kind[2](...taipeiToday()) !== period ? kind[1] : '';
  }
  // 頁面呼叫 staleBanner(這頁的期別, 補充說明) 放在 #app 最前面（工具列上面）；不是非當期就回 null。
  // note 只在要提示時接在後面（頭版：今天還沒出刊、開的是最近一期）。
  // 一載入就跟整頁一起畫好（不是事後插進來，不推動版面）；不加 live region：不是動態通知，讀頁面時第一個就讀到
  let staleOf = null; // 這頁的 { period, note }：分頁開著過了午夜，回到前景時重算
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

  // ── 7. 手機右下角的功能鈕 ───────────────────────────────────────
  // 使用者要求（手機單手操作，功能都在上方不好按）：工具列的功能收進右下角一顆按鈕，點開扇形展開；四種樣板中選定
  // 「C 扇面」、功能鈕與扇面都只有圖示、頂端工具列保留。只在窄版（≤ 40em，report.css）出現，桌機照舊用工具列。
  // 扇面：內圈是前往（本日新聞、本週新聞，照工具列有的連結），外圈打開面板（日期、本期章節或頭版的過濾、版面）。
  // 每格是裁成扇形的按鈕（clip-path 連點擊範圍一起裁），線條另畫在上面一層 SVG；名稱平常藏著（報讀器照唸），
  // 手指按住滑過、鍵盤聚焦時浮在圖示上方。點一下展開、再點一格；也可以按住功能鈕不放，滑到那格再放開。
  // 從這裡打開的面板是頂端那個面板本身，改成貼齊底部（.is-sheet），收起後焦點回功能鈕。
  // 項目從 #app 裡的工具列讀出來，各頁不必另外呼叫；#app 換內容時重建。
  // 部署後的快取空窗可能拿到舊的 report.css：讀不到 --fab-ready 就不裝，免得頁尾多出沒有樣式的按鈕
  // 扇面半徑：中間空 34px 給功能鈕（44px 方塊，同回到頂端），內圈到 98、外圈到 162（只有一圈時 34–162）。
  // 每種外觀的扇面形狀（使用者要求功能 UI 符合各外觀的風格）：藍圖一整片、細線分格；地圖分成一塊塊圓角色塊（格與格之間留縫，
  // 使用者要求地圖一律圓角）；一般是分開的圓角卡片（留縫＋6px 圓角）。換外觀時重建
  const FAB_R = [34, 98, 162];
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
  let lastUp = 0; // 手指離開功能鈕的時間：之後瀏覽器補發的 click 不再切換一次
  let lastDragGo = 0; // 按住滑到某格放開的時間：之後補發到那一格的 click 不再算一次
  const runs = new WeakMap(); // 扇面上的按鈕 → 打開哪個面板

  const fabReady = () => getComputedStyle(root).getPropertyValue('--fab-ready').trim() !== '';
  // 打開面板的方式：貼齊底部；收起後拿掉 .fab-sheet（功能鈕、回到頂端再出現），焦點原本在面板裡就交回功能鈕
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

  // 工具列上有的功能：外圈面板（日期、章節或過濾、版面），內圈連結（本日新聞、本週新聞）
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
    if (app.querySelector('.fp-fq .fp-chip')) panels.push({ key: 'fq', label: '過濾', icon: 'filter', run: openFilter });
    else panel('chap-panel', '章節', 'chapters');
    panel('vw-panel', '版面', 'sliders');
    panel('fp-panel', '版面', 'sliders');
    const links = [...bar.querySelectorAll(':scope > a.ed-link')].map((a) => {
      const ico = a.querySelector('.dd-ico');
      return { key: a.getAttribute('href'), label: a.textContent.trim(), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), html: ico ? ico.innerHTML : '' };
    });
    return { panels, links };
  }

  // 扇面：角度 0°＝功能鈕正左方、90°＝正上方；外圈的日期在最下面、版面在最上面，內圈本日新聞在上、本週新聞在下
  function buildPie(items) {
    const S = FAB_R[2] + 2;
    const P = (r, a) => {
      const t = (a * Math.PI) / 180;
      return `${(S - r * Math.cos(t)).toFixed(2)} ${(S - r * Math.sin(t)).toFixed(2)}`;
    };
    const shape = FAB_SHAPE[lookNow()] || FAB_SHAPE.blueprint;
    // 一格扇形的外框：格與格之間留 gap（兩側各縮 gap/2，邊線與原本的分格線平行；整片扇形的外緣不縮），
    // 四個角用二次曲線修圓 round px（控制點在原本的尖角）
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
    // 鍵盤順序：外圈的日期、章節、版面，再來本日新聞、本週新聞
    [...items.panels, ...items.links].forEach((x) => { if (cells.has(x)) pie.append(cells.get(x)); });
    pie.append(lines);
    return pie;
  }

  // 按住滑過或鍵盤聚焦的那一格：底色、外框換主色，名稱浮在圖示上方（浮在扇面外層，不被扇形裁掉）
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
      live.forEach((d) => { if (!d.panel.hidden) d.open(false); }); // 頂端開著的面板先收起
      const first = focusFirst && fab.anchor.querySelector('.fab-it');
      if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
    } else if (fab.anchor.contains(document.activeElement)) fab.btn.focus({ preventScroll: true });
  }
  function shutFan() {
    if (!fanOpen) return;
    setFan(false);
    fab.btn.focus({ preventScroll: true });
  }
  // 選了一格：先收起扇面；連結點一下照瀏覽器預設換頁（按住滑過去放開的才自己換），面板從底部打開
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
    // 這一層的 click 不往上傳：bar.js 的「點外面就收起」會把剛從這裡打開的面板又收掉
    layer.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = e.target.closest('.fab-it');
      if (it && Date.now() - lastDragGo < 700) return e.preventDefault(); // 按住滑過去放開後補發的 click
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
    if (!fabReady()) return;
    const items = fabItems();
    const has = Boolean(items && items.panels.length + items.links.length);
    root.classList.toggle('has-fab', has);
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

  // 頭版的過濾（front.js 的快速過濾標籤 .fp-fq）：底部面板列出同樣的類型與則數，按了就代按頁面上那顆標籤——
  // 選擇、記憶（air-front-types）、念「顯示 N 則」都照 front.js，這裡只照抄狀態。
  // 標籤的代號是 data-type、名稱是 .fp-chip-t（舊版 front.js 的標籤是領域：代號與名稱都是 data-group）
  let fq = null;
  const realChips = () => [...document.querySelectorAll('#app .fp-fq .fp-chip')];
  const chipId = (c) => c.dataset.type || c.dataset.group;
  const chipName = (c) => { const t = c.querySelector('.fp-chip-t'); return t ? t.textContent : c.dataset.group; };
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
  function openFilter() {
    const chips = realChips();
    if (!chips.length) return;
    if (!fq) {
      const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': '關閉過濾', html: ICON.close });
      const list = h('ul', { class: 'fq-list', 'aria-labelledby': 'fq-panel-title' });
      const clear = h('button', { type: 'button', class: 'fq-clear', hidden: true }, ['清除']);
      const panel = h('div', { class: 'dd-panel fq-panel', id: 'fq-panel', role: 'dialog', 'aria-labelledby': 'fq-panel-title', hidden: true }, [
        h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: 'fq-panel-title' }, ['依類型過濾']), clear, close]),
        list,
      ]);
      const box = h('div', { class: 'dd fq' }, [panel]);
      document.body.append(box);
      let after = null;
      const open = (yes, how) => {
        const had = !yes && !panel.hidden && panel.contains(document.activeElement);
        panel.hidden = !yes;
        panel.classList.toggle('is-sheet', yes);
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
      fq = { box, panel, list, clear, open, shut: () => open(false) };
      live.add(fq);
      close.addEventListener('click', fq.shut);
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
    // 每次打開照頁面上現在的標籤重列（頭版重畫後領域、則數可能不同）；色塊沿用標籤的領域色
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

  A.bar = { ICON, dropdown, periodLabel, periodShort, toolbar, navLink, datePicker, titleChapters, barHeight, staleBanner };
})();
