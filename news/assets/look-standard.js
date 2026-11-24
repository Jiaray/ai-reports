/* 外觀「一般」的頭版排法與 theme-color（樣式在 look-standard.css），掛 window.AIR.look。
   1. arrangeFront(main)：只搬 front.js 畫好的同一批 .fp-it、不重建（展開、過濾、記看過照舊）；
      每塊都是 main 直屬的 .fp-sec（front.js applyFilter 據此藏空塊）。
   2. themeColor()：頂列色＝Header 底色（--surface）。 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;
  const root = document.documentElement;

  // ── 1. 頭版 ──
  let uid = 0;
  const block = (cls, title, kids) => {
    const id = `std-t${++uid}`;
    return h('section', { class: `fp-sec ${cls}`, 'aria-labelledby': title ? id : null }, [
      title ? h('h2', { class: cls === 'std-cards' ? 'visually-hidden' : 'std-title', id }, [title]) : null,
      ...kids,
    ]);
  };
  // 頭條、卡片的時間移到摘要預覽後（系列 → 標題 → 預覽 → 時間）
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
    const leads = rows.filter((r) => r.classList.contains('is-lead'));
    const types = (r) => r.querySelectorAll('.fp-mt > .fp-ty').length;
    // 頭條＝第一順位中出自最多份報告者，同數取最新（時間軸已新到舊）；要聞卡片＝其餘第一順位；即時新聞＝其餘
    const hero = leads.reduce((best, r) => (!best || types(r) > types(best) ? r : best), null);
    const cards = leads.filter((r) => r !== hero);
    const latest = rows.filter((r) => !r.classList.contains('is-lead'));
    main.classList.add('std-home');
    main.replaceChildren(...[
      hero ? block('std-lead', null, [timeLast(hero)]) : null,
      cards.length ? block('std-cards', '要聞', [h('div', { class: 'std-grid' }, cards.map(timeLast))]) : null,
      latest.length ? block('std-latest', '即時新聞', latest) : null,
    ].filter(Boolean));
  }

  // ── 2. 瀏覽器頂列顏色 ──
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
