(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;
  const root = document.documentElement;

  let uid = 0;
  const block = (cls, title, kids) => {
    const id = `std-t${++uid}`;
    return h('section', { class: `fp-sec ${cls}`, 'aria-labelledby': title ? id : null }, [
      title ? h('h2', { class: cls === 'std-cards' ? 'visually-hidden' : 'std-title', id }, [title]) : null,
      ...kids,
    ]);
  };
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
    const entries = rows.filter((r) => r.dataset.key);
    const weekly = rows.filter((r) => !r.dataset.key);
    const leads = entries.filter((r) => r.classList.contains('is-lead'));
    const types = (r) => r.querySelectorAll('.fp-mt > .fp-ty').length;
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
