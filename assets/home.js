(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const box = document.getElementById('cats');
  const pad = (n) => String(n).padStart(2, '0');
  document.getElementById('mast-right').appendChild(A.themeSwitch());

  const row = (c, e, i) => h('article', { class: 'row' }, [
    h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, [pad(i + 1)]), h('span', { class: 'row-time' }, [A.fmtShort(e.period, e.cadence)])]),
    h('div', { class: 'row-main' }, [
      h('div', { class: 'tags' }, [h('span', { class: 'tag tag-neutral' }, [e.series_title || e.title]), h('span', { class: 'tag tag-outline' }, [`${e.count} 則`])]),
      h('h3', { class: 'row-title' }, [h('a', { href: `${c.path}?t=${encodeURIComponent(e.series)}&d=${encodeURIComponent(e.period)}` }, [`${e.title} ${e.period}`])]),
      e.lede ? h('p', { class: 'row-sum' }, [e.lede]) : null,
    ]),
  ]);

  A.getJSON('catalog.json').then((cat) => Promise.all((cat.categories || []).map((c) => A.getJSON(c.index).then(
    (idx) => [c, idx.items || []],
    () => [c, []],
  )))).then((cats) => {
    box.replaceChildren(...cats.map(([c, items], i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}` }, [
      h('div', { class: 'sec-tab' }, [
        h('span', { class: 'sec-no' }, [`SEC. ${pad(i + 1)}`]),
        h('h2', { class: 'sec-name' }, [h('a', { href: c.path }, [c.title])]),
        h('span', { class: 'sec-count' }, ['最新']),
      ]),
      h('div', { class: 'sec-body' }, [
        c.description ? h('p', { class: 'sec-note' }, [c.description]) : null,
        ...items.slice(0, 8).map((e, j) => row(c, e, j)),
        items.length ? null : h('p', { class: 'sec-note' }, ['還沒有內容。']),
      ]),
    ])));
  }).catch((err) => {
    box.replaceChildren(h('p', { class: 'load-error', role: 'alert' }, [`目錄載入失敗（${err.message}），重新整理再試一次。`]));
  });
})();
