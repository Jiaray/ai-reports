/* 新聞頁報頭的共用部分：報告頁（report.js）與頭版（front.js）的報頭長得一樣（使用者要求：所有頁面上方區塊統一功能）——
   最上面一列工具列「日期｜本日新聞｜本週新聞｜……｜版面」凍結在頂端，下面是大標題，大標題點開是本頁的章節（頭版是時段）。
   index.html 在 site.js 之後、report.js／front.js 之前載入（都是 defer），掛在 window.AIR.bar。
   1. 圖示（裝飾用，aria-hidden；按鈕的名稱來自文字或 aria-label）
   2. dropdown()：報頭三種下拉面板（日期、大標題、版面）共用的骨架與開關
   3. 期別的寫法：日期按鈕的長短兩種、日期清單的分組與每列
   4. datePicker()、titleChapters()、toolbar()、navLink()：版面一致的元件，資料由各頁算好傳進來
   5. 工具列凍結（position:sticky 在 report.css）：量工具列高度寫進 :root 的 --bar-h（頭版黏頂的時段標題、
      錨點跳轉要讓開它），捲離頂端時加 .is-stuck（底下一條細線） */
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
  };

  // ── 2. 下拉面板 ──────────────────────────────────────────────────────
  // 打開面板時淡入、往下滑 4px（回應使用者的動作；減少動態時只淡入）。用 WAAPI 不用 @starting-style：
  // 換讀法時面板會跟著頁首那一列搬家，@starting-style 會在每次搬家重播一次淡入
  function openMotion(el) {
    if (!el.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.animate(still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out' });
  }

  // 頁面上建過的下拉：點外面、Esc 由這裡的一組 document 監聽統一處理（頭版重畫時不會越掛越多監聽）
  const live = new Set();
  document.addEventListener('click', (e) => {
    live.forEach((d) => { if (!d.panel.hidden && !d.box.contains(e.target)) d.open(false); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') live.forEach((d) => { if (!d.panel.hidden) d.shut(); });
  });

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
    function open(yes) {
      panel.hidden = !yes;
      toggle.setAttribute('aria-expanded', String(yes));
      if (!yes) return;
      openMotion(panel);
      ((pick && pick(panel)) || close).focus();
    }
    const shut = () => {
      open(false);
      toggle.focus();
    };
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

  // 大標題（使用者要求：標題的下拉是本頁的章節）：標題文字＋往下的箭頭是一顆按鈕，點開是本頁的章節（報告頁是分區，
  // 頭版是時段），右邊是則數；是頁內連結，用 Tab 依序走，不是 ARIA menu（指南：導覽連結不加 menu／menuitem 角色、不攔方向鍵）。
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
  if (app) new MutationObserver(track).observe(app, { childList: true });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; stuck(); });
  }, { passive: true });
  // 捲動補償（換讀法時捲回同一則）要扣掉的工具列高度
  const barHeight = () => (bar && bar.isConnected ? bar.getBoundingClientRect().height : 0);

  A.bar = { ICON, dropdown, periodLabel, periodShort, toolbar, navLink, datePicker, titleChapters, barHeight };
})();
