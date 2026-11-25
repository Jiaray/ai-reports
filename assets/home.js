/* 首頁：catalog.json 每個類別一個藍圖分區，列該類別 index.json 最近 8 份；類別有 focus 時最上面加本日焦點一列。 */
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

  // 類別有 focus（本日焦點候選，news/cards/focus.json）時最上面一列：近 24 小時的前 3 張，沒有就列最近一批
  const DAY = 864e5;
  const focusRow = (c, cards) => {
    const fresh = cards.filter((x) => Date.now() - Date.parse(x.focus_at) <= DAY);
    const list = (fresh.length ? fresh : cards).slice(0, 3);
    return h('article', { class: 'row' }, [
      h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, ['★']), h('span', { class: 'row-time' }, [fresh.length ? '24 小時' : '最近'])]),
      h('div', { class: 'row-main' }, [
        h('div', { class: 'tags' }, [h('span', { class: 'tag tag-hot' }, ['本日焦點'])]),
        h('h3', { class: 'row-title' }, [h('a', { href: c.path }, ['本日焦點'])]),
        ...(list.length
          ? list.map((x) => h('p', { class: 'row-sum' }, [h('a', { href: `${c.path}card.html#${x.id}` }, [x.title])]))
          : [h('p', { class: 'row-sum' }, ['還沒有新聞卡。'])]),
      ]),
    ]);
  };

  A.getJSON('catalog.json').then((cat) => Promise.all((cat.categories || []).map((c) => Promise.all([
    A.getJSON(c.index).then((idx) => idx.items || [], () => []),
    c.focus ? A.getJSON(c.focus).then((f) => f.cards || [], () => []) : null,
  ]).then(([items, focus]) => [c, items, focus])))).then((cats) => {
    box.replaceChildren(...cats.map(([c, items, focus], i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}` }, [
      h('div', { class: 'sec-tab' }, [
        h('span', { class: 'sec-no' }, [`SEC. ${pad(i + 1)}`]),
        h('h2', { class: 'sec-name' }, [h('a', { href: c.path }, [c.title])]),
        h('span', { class: 'sec-count' }, ['最新']),
      ]),
      h('div', { class: 'sec-body' }, [
        c.description ? h('p', { class: 'sec-note' }, [c.description]) : null,
        focus ? focusRow(c, focus) : null,
        ...items.slice(0, 8).map((e, j) => row(c, e, j)),
        items.length || focus ? null : h('p', { class: 'sec-note' }, ['還沒有內容。']),
      ]),
    ])));
  }).catch((err) => {
    box.replaceChildren(h('p', { class: 'load-error', role: 'alert' }, [`目錄載入失敗（${err.message}），重新整理再試一次。`]));
  });
})();
