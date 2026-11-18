/* 共用新聞頁（news/index.html）：讀 index.json 自動列出有報告的新聞類型，依網址 ?t=<系列>&d=<期別>
   載入該期報告 JSON，用原本的「工程藍圖」版型渲染（DOM 結構同 md2html2.py 的 render()）。
   沒帶參數顯示最新一期；只帶 t 顯示該類型最新一期。
   *_html 欄位是 publish.py 用 md2html2.inline 淨化過的片段（只留 http/https 連結與粗體），其餘欄位一律當純文字。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const app = document.getElementById('app');
  const WEEK = '日一二三四五六';
  let index = { series: [], items: [], years: [] };
  let all = [];
  let archivesLoaded = false;

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (e) => `${e.series}/${e.period}`;
  const newest = (a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.generated_at < b.generated_at ? 1 : -1;
  };
  const link = (series, period) => `?t=${encodeURIComponent(series)}${period ? `&d=${encodeURIComponent(period)}` : ''}`;

  function merge(items) {
    const seen = new Set(all.map(keyOf));
    items.forEach((e) => {
      if (!seen.has(keyOf(e))) {
        seen.add(keyOf(e));
        all.push(e);
      }
    });
    all.sort(newest);
  }

  async function loadArchives() {
    if (archivesLoaded) return;
    archivesLoaded = true;
    for (const y of index.years || []) {
      try {
        merge((await A.getJSON(`archive/${y}.json`)).items || []);
      } catch (e) { /* 缺某年的清單就略過 */ }
    }
  }

  function periodLabel(e) {
    let m;
    if (e.cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(e.period))) return `${m[1]} 年第 ${+m[2]} 週`;
    if (e.cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(e.period))) return `${m[1]} 年 ${+m[2]} 月`;
    const d = new Date(`${e.period}T00:00:00`);
    return Number.isNaN(d.getTime()) ? e.period : `${e.period}（週${WEEK[d.getDay()]}）`;
  }

  // 報頭上方：新聞類型標籤（依 index.json 的系列順序，只列有報告的）＋期別選單
  function editions(cur) {
    const order = (index.series || []).map((s) => s.id);
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    const ids = [...new Set(all.map((e) => e.series))].sort((a, b) => rank(a) - rank(b));
    const tabs = ids.map((id) => {
      const latest = all.find((e) => e.series === id);
      return h('a', {
        class: 'ed-tab', href: link(id), 'aria-current': cur && id === cur.series ? 'page' : null,
      }, [latest.series_title || latest.title]);
    });
    const kids = [h('div', { class: 'ed-tabs' }, tabs)];
    if (cur) {
      const periods = all.filter((e) => e.series === cur.series);
      const select = h('select', { class: 'ed-date', id: 'period', name: 'd', 'aria-label': '選擇期別' }, periods.map((e) => h('option', {
        value: e.period, selected: e.period === cur.period,
      }, [periodLabel(e)])));
      if (index.truncated && !archivesLoaded) select.appendChild(h('option', { value: '' }, ['載入更早的期別…']));
      select.addEventListener('change', async () => {
        if (select.value) {
          location.href = link(cur.series, select.value);
          return;
        }
        await loadArchives();
        app.querySelector('.editions').replaceWith(editions(cur));
      });
      kids.push(select);
    }
    return h('nav', { class: 'editions', 'aria-label': '新聞類型與期別' }, kids);
  }

  // ── 藍圖版型（對應 md2html2.py 的 render）──────────────────────────────
  function table(t) {
    return h('div', { class: 'tbl' }, [h('table', null, [
      h('thead', null, [h('tr', null, t.head.map((c) => h('th', { html: c })))]),
      h('tbody', null, t.rows.map((r) => h('tr', null, r.map((c) => h('td', { html: c }))))),
    ])]);
  }

  function notes(blocks, cls) {
    return (blocks || []).map((b) => {
      if (b.kind === 'p') return h('p', { class: cls, html: b.html });
      if (b.kind === 'ul') return h('ul', { class: cls }, b.items.map((x) => h('li', { html: x })));
      return table(b);
    });
  }

  function links(list) {
    return list.flatMap((l, i) => {
      const a = l.url ? h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.text]) : document.createTextNode(l.text);
      return i ? ['、', a] : [a];
    });
  }

  function row(it) {
    const tags = [];
    if (it.src) tags.push(h('span', { class: 'tag tag-neutral' }, [it.src]));
    (it.tags || []).forEach((t) => tags.push(h('span', { class: `tag ${t.cls}` }, [t.text])));
    if (it.heat) tags.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    const main = [
      tags.length ? h('div', { class: 'tags' }, tags) : null,
      it.url
        ? h('h3', { class: 'row-title' }, [h('a', { href: it.url, target: '_blank', rel: 'noopener', html: it.title_html })])
        : h('h3', { class: 'row-title', html: it.title_html }),
    ];
    const also = it.also && it.also.length ? h('span', { class: 'seealso' }, ['另參：', ...links(it.also)]) : null;
    if (it.summary_html) {
      const p = h('p', { class: 'row-sum', html: it.summary_html });
      if (also) p.append(' ', also);
      main.push(p);
    } else if (also) {
      main.push(h('p', { class: 'row-sum' }, [also]));
    }
    if (it.also_more && it.also_more.length) {
      main.push(h('details', { class: 'seealso-more' }, [h('summary', null, [`其餘 ${it.also_more.length} 個連結`]), ...links(it.also_more)]));
    }
    if (it.bullets_html && it.bullets_html.length) {
      main.push(h('ul', { class: 'row-bullets' }, it.bullets_html.map((b) => h('li', { html: b }))));
    }
    if (it.table) main.push(table(it.table));
    if (it.dive_html) {
      const p = h('p', { class: 'row-dive' }, [h('span', { class: 'dive-label' }, ['解讀'])]);
      p.insertAdjacentHTML('beforeend', it.dive_html);
      main.push(p);
    }
    return h('article', { class: 'row', id: `item-${it.no}` }, [
      h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, [it.no]), h('span', { class: 'row-time' }, [it.left])]),
      h('div', { class: 'row-main' }, main),
    ]);
  }

  function report(r) {
    const date = [h('span', { class: 'date' }, [r.date])];
    (r.src_tags || []).forEach((t) => date.push(h('span', { class: 'sep' }, ['|']), h('span', { class: 'tag tag-neutral' }, [t])));
    const head = h('header', { class: 'masthead' }, [
      h('div', { class: 'mast-top' }, [
        h('span', { class: 'mast-brand' }, [r.brief]),
        h('div', { class: 'mast-right' }, [h('span', { class: 'mast-issue' }, [r.issue]), A.themeSwitch()]),
      ]),
      h('h1', { class: 'mast-title' }, [r.title]),
      h('div', { class: 'mast-date' }, date),
      ...notes(r.intro, 'intro'),
    ]);
    const cells = [];
    r.sections.forEach((s, i) => {
      if (s.name) {
        cells.push(h('a', { class: 'toc-cell', href: `#sec-${pad(i + 1)}` }, [
          h('span', { class: 'toc-no' }, [pad(i + 1)]), h('span', { class: 'toc-name' }, [s.name]),
        ]));
      }
    });
    const secs = r.sections.map((s, i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}` }, [
      h('div', { class: 'sec-tab' }, [
        h('span', { class: 'sec-no' }, [`SEC. ${pad(i + 1)}`]),
        h('h2', { class: 'sec-name' }, [s.name]),
        h('span', { class: 'sec-count' }, [`${s.count} 則`]),
      ]),
      h('div', { class: 'sec-body' }, s.blocks.flatMap((b) => {
        if (b.type === 'item') return [row(b)];
        if (b.type === 'sub') return [h('h3', { class: 'sec-sub', html: b.html })];
        return notes(b.blocks, 'sec-note');
      })),
    ]));
    const foot = h('footer', { class: 'foot' }, [
      h('span', { class: 'foot-left' }, [r.foot_left]),
      h('span', { class: 'foot-right' }, [`${r.brief} · ${r.date}`]),
    ]);
    return [head, cells.length ? h('nav', { class: 'toc' }, cells) : null, ...secs, foot].filter(Boolean);
  }

  const problem = (cur, text, more) => app.replaceChildren(
    ...(all.length ? [editions(cur)] : []),
    h('p', { class: 'load-error', role: 'alert' }, [text, more || null]),
  );

  async function main() {
    try {
      index = await A.getJSON('index.json');
    } catch (err) {
      problem(null, `新聞清單載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    merge(index.items || []);
    const q = new URLSearchParams(location.search);
    const t = q.get('t') || '';
    const d = q.get('d') || '';
    const find = () => (t ? all.find((e) => e.series === t && (!d || e.period === d)) : all[0]);
    let entry = find();
    if (!entry && t && d) {
      await loadArchives();
      entry = find();
    }
    if (!entry) {
      if (all.length) problem(null, `找不到這一期（${t}${d ? ` ${d}` : ''}）。`, h('a', { href: './' }, ['看最新一期']));
      else problem(null, '還沒有任何報告。');
      return;
    }
    let data;
    try {
      data = await A.getJSON(entry.data);
    } catch (err) {
      problem(entry, `這一期的資料載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    document.title = `${data.title} ${data.date}｜AI Reports`;
    app.replaceChildren(editions(entry), ...report(data));
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  main();
})();
