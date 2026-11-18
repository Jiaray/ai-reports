/* 新聞總覽：讀 index.json（最近 200 份），可依系列篩選、搜尋標題與導言，依日期分組列出；
   清單被截斷時，按「載入更早的報告」再讀 archive/<年>.json。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const list = document.getElementById('list');
  const seriesEl = document.getElementById('series');
  const q = document.getElementById('q');
  const more = document.getElementById('more');
  let items = [];
  let defs = [];
  let years = [];
  let active = '';
  let query = '';

  document.getElementById('foot').appendChild(A.themeSwitch());

  A.getJSON('index.json').then((idx) => {
    items = idx.items || [];
    defs = idx.series || [];
    years = idx.years || [];
    more.hidden = !idx.truncated;
    renderSeries();
    renderList();
  }).catch((err) => {
    list.replaceChildren(h('p', { class: 'load-error', role: 'alert' }, [`清單載入失敗（${err.message}），重新整理再試一次。`]));
  });

  let timer = 0;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      query = q.value.trim().toLowerCase();
      renderList();
    }, 120);
  });

  more.addEventListener('click', async () => {
    more.disabled = true;
    try {
      const seen = new Set(items.map((e) => e.path));
      for (const y of years) {
        const arc = await A.getJSON(`archive/${y}.json`);
        (arc.items || []).forEach((e) => {
          if (!seen.has(e.path)) {
            seen.add(e.path);
            items.push(e);
          }
        });
      }
      more.hidden = true;
      renderSeries();
      renderList();
    } catch (err) {
      more.disabled = false;
      more.textContent = `載入失敗（${err.message}），再試一次`;
    }
  });

  function titleOf(id) {
    const d = defs.find((s) => s.id === id);
    if (d) return d.title;
    const e = items.find((x) => x.series === id);
    return e ? e.series_title || e.title : id;
  }

  function renderSeries() {
    const counts = new Map();
    items.forEach((e) => counts.set(e.series, (counts.get(e.series) || 0) + 1));
    const order = defs.map((s) => s.id).filter((id) => counts.has(id));
    counts.forEach((_, id) => { if (!order.includes(id)) order.push(id); });
    const chip = (id, label) => {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(active === id) }, [label]);
      b.addEventListener('click', () => {
        active = id;
        renderSeries();
        renderList();
      });
      return b;
    };
    seriesEl.replaceChildren(chip('', '全部'), ...order.map((id) => chip(id, titleOf(id))));
    seriesEl.hidden = order.length < 2;
  }

  function renderList() {
    const rows = items.filter((e) => (!active || e.series === active)
      && (!query || `${e.title} ${e.series_title || ''} ${e.lede || ''}`.toLowerCase().includes(query)));
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.generated_at < b.generated_at ? 1 : -1;
    });
    if (!rows.length) {
      list.replaceChildren(h('p', { class: 'empty' }, [items.length ? '沒有符合條件的報告。' : '還沒有報告。']));
      return;
    }
    const groups = [];
    rows.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.rows.push(e);
      else groups.push({ date: e.date, rows: [e] });
    });
    list.replaceChildren(...groups.map((g) => h('section', { class: 'day' }, [
      h('h2', null, [A.fmtDay(g.date)]),
      h('ul', { class: 'entries' }, g.rows.map((e) => h('li', null, [A.entry('', e, e.cadence !== 'daily')]))),
    ])));
  }
})();
