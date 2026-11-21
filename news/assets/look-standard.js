/* 外觀「一般」（data-look=standard）的頭版排版與瀏覽器頂列顏色。樣式在 look-standard.css。
   index.html 在 bar.js 之後、report.js／front.js 之前載入（都是 defer），掛在 window.AIR.look。
   1. arrangeFront(main)：front.js 畫好時間軸後，把同一批條目（.fp-it，含「新」標記、過濾用的 data-fq）搬成
      頭條（第一順位裡出自最多份報告的那則）＋要聞卡片（其餘第一順位）＋右側「即時新聞」（其餘條目，新到舊）。
      「週報與月報」那塊只給舊版 front.js（每日頭版還畫週報、條目沒有 key）用；現在週報月報在每週頭版，條目都有 key。
      只搬元素、不重建：展開、過濾、記「看過」都照 front.js 原本的做法。每塊都是 .fp-sec，過濾後沒有條目就整塊藏起來。
   2. theme-color：一般外觀時讓手機瀏覽器的頂列用 Header 的底色（--surface），其他外觀拿掉這個 meta、維持原狀。 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;
  const root = document.documentElement;

  // ── 1. 頭版 ──────────────────────────────────────────────────────────
  let uid = 0;
  const block = (cls, title, kids) => {
    const id = `std-t${++uid}`;
    return h('section', { class: `fp-sec ${cls}`, 'aria-labelledby': title ? id : null }, [
      title ? h('h2', { class: cls === 'std-cards' ? 'visually-hidden' : 'std-title', id }, [title]) : null,
      ...kids,
    ]);
  };
  // 頭條與卡片：時間移到摘要預覽後面（規格：分類標籤 → 標題 → 導言 → 時間）
  function timeLast(row) {
    const sum = row.querySelector('.peek-sum');
    const tm = sum && sum.querySelector('.fp-mt > .fp-tm');
    if (tm) sum.append(tm);
    return row;
  }
  function arrangeFront(main) {
    if (!main || !main.classList.contains('fp-tl') || main.classList.contains('std-home')) return;
    const rows = [...main.querySelectorAll('.fp-it')];
    if (!rows.length) return;
    const entries = rows.filter((r) => r.dataset.key); // 頭版條目；週報月報沒有 key
    const weekly = rows.filter((r) => !r.dataset.key);
    const leads = entries.filter((r) => r.classList.contains('is-lead'));
    const types = (r) => r.querySelectorAll('.fp-mt > .fp-ty').length;
    // 頭條：第一順位裡出自最多份報告的那則；一樣多就取最新（時間軸已是新到舊）
    const hero = leads.reduce((best, r) => (!best || types(r) > types(best) ? r : best), null);
    const cards = leads.filter((r) => r !== hero);
    const latest = entries.filter((r) => !r.classList.contains('is-lead'));
    main.classList.add('std-home');
    main.replaceChildren(...[
      hero ? block('std-lead', null, [timeLast(hero)]) : null,
      cards.length ? block('std-cards', '要聞', [h('div', { class: 'std-grid' }, cards.map(timeLast))]) : null,
      weekly.length ? block('std-weekly', '週報與月報', [h('div', { class: 'std-list' }, weekly)]) : null,
      latest.length ? block('std-latest', '即時新聞', latest) : null,
    ].filter(Boolean));
  }

  // ── 2. 瀏覽器頂列顏色 ────────────────────────────────────────────────
  function themeColor() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (root.getAttribute('data-look') !== 'standard') {
      if (meta) meta.remove();
      return;
    }
    if (!meta) {
      meta = h('meta', { name: 'theme-color' });
      document.head.append(meta);
    }
    meta.content = getComputedStyle(root).getPropertyValue('--surface').trim() || '#FFFFFF';
  }
  new MutationObserver(themeColor).observe(root, { attributes: true, attributeFilter: ['data-look', 'data-theme'] });
  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (dark && dark.addEventListener) dark.addEventListener('change', themeColor);
  themeColor();

  A.look = { arrangeFront, themeColor };
})();
