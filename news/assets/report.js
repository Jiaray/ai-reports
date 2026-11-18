/* 新聞報告渲染器：讀頁面殼 body[data-report] 指向的 JSON（schema 1）畫出整份報告。
   殼裡的免 JS 精簡版在渲染成功後才換掉；JSON 讀不到就保留精簡版並提示。
   *_html 欄位是 publish.py 用 md2html2.inline 淨化過的片段（只留 http/https 連結與粗體），
   其餘欄位一律當純文字放入 DOM。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const app = document.getElementById('app');
  const dataUrl = document.body.dataset.report;
  const newsRoot = document.body.dataset.newsRoot || '../../';
  const READ_KEY = 'air-read';
  const ALSO_SHOWN = 8;
  const HIGHLIGHT_LABEL = { daily: '今日重點', weekly: '本週重點', monthly: '本月重點' };
  const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  const readUrls = () => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); }
  };
  const markRead = (url) => {
    try {
      const s = readUrls();
      s.add(url);
      localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-3000)));
    } catch (e) { /* 無痕模式或停用儲存：只在本頁標示 */ }
  };

  const tag = (text, tone) => h('span', { class: tone ? `tag ${tone}` : 'tag' }, [text]);
  const joinLinks = (links) => links.flatMap((l, i) => {
    const a = h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.text]);
    return i ? ['、', a] : [a];
  });

  function table(t) {
    return h('div', { class: 'tbl' }, [h('table', null, [
      h('thead', null, [h('tr', null, t.head.map((c) => h('th', { html: c })))]),
      h('tbody', null, t.rows.map((row) => h('tr', null, row.map((c) => h('td', { html: c }))))),
    ])]);
  }

  function noteBlocks(blocks, cls) {
    return blocks.map((b) => {
      if (b.kind === 'p') return h('p', { class: cls, html: b.html });
      if (b.kind === 'ul') return h('ul', { class: cls }, b.items.map((x) => h('li', { html: x })));
      return table(b);
    });
  }

  function also(links) {
    if (links.length <= ALSO_SHOWN) return h('p', { class: 'also' }, ['另參：', ...joinLinks(links)]);
    const rest = links.slice(ALSO_SHOWN);
    return h('div', { class: 'also' }, [
      h('p', null, ['另參：', ...joinLinks(links.slice(0, ALSO_SHOWN))]),
      h('details', null, [h('summary', null, [`其餘 ${rest.length} 個連結`]), h('p', null, joinLinks(rest))]),
    ]);
  }

  function item(it) {
    const meta = [];
    if (it.source) meta.push(tag(it.source, 'src'));
    (it.tags || []).forEach((t) => meta.push(tag(t.text, t.tone)));
    if (it.heat && it.rail_kind !== 'heat') meta.push(tag(it.heat));
    if (it.lang) meta.push(tag(it.lang));
    const title = it.url
      ? h('a', { href: it.url, target: '_blank', rel: 'noopener', html: it.title_html })
      : h('span', { html: it.title_html });
    return h('li', {
      class: it.fill ? 'item is-fill' : 'item', id: `i${it.no}`, 'data-src': it.source || '', 'data-url': it.url || '',
    }, [
      h('div', { class: 'rail' }, [it.rail_date ? h('span', { class: 'rd' }, [it.rail_date]) : null, it.rail || '']),
      h('div', { class: 'body' }, [
        meta.length ? h('div', { class: 'meta' }, meta) : null,
        h('h3', { class: 'it-title' }, [title]),
        it.summary_html ? h('p', { class: 'it-sum', html: it.summary_html }) : null,
        it.bullets_html && it.bullets_html.length
          ? h('ul', { class: 'it-bul' }, it.bullets_html.map((b) => h('li', { html: b }))) : null,
        it.table ? table(it.table) : null,
        it.dive_html ? h('details', { class: 'dive' }, [h('summary', null, ['解讀']), h('p', { html: it.dive_html })]) : null,
        it.links && it.links.length ? also(it.links) : null,
      ]),
    ]);
  }

  function section(s) {
    const el = h('section', { class: 'sec', id: s.id, 'aria-label': s.name || null });
    if (s.name) el.appendChild(h('h2', { class: 'sec-h' }, [s.name, h('span', { class: 'n' }, [`${s.count} 則`])]));
    let feed = null;
    s.blocks.forEach((b) => {
      if (b.type === 'item') {
        if (!feed) {
          feed = h('ol', { class: 'feed' });
          el.appendChild(feed);
        }
        feed.appendChild(item(b));
        return;
      }
      feed = null; // 子標題或分區說明把時間軸切成數段
      if (b.type === 'sub') el.appendChild(h('h3', { class: 'sec-sub', html: b.html }));
      else noteBlocks(b.blocks, 'sec-note').forEach((n) => el.appendChild(n));
    });
    return el;
  }

  function head(r) {
    const intro = r.intro || [];
    const lede = intro[0] && intro[0].kind === 'p' ? intro[0] : null;
    const label = HIGHLIGHT_LABEL[r.cadence] || '重點';
    return h('header', { class: 'r-head' }, [
      h('p', { class: 'crumb' }, [h('a', { href: `${newsRoot}index.html` }, ['所有新聞'])]),
      h('p', { class: 'r-when' }, [A.fmtPeriod(r.period, r.cadence)]),
      h('h1', { class: 'r-title' }, [r.title]),
      lede ? h('p', { class: 'r-lede', html: lede.html }) : null,
      ...noteBlocks(lede ? intro.slice(1) : intro, 'r-intro'),
      r.highlights_html && r.highlights_html.length ? h('section', { class: 'r-high', 'aria-label': label }, [
        h('h2', null, [label]),
        h('ul', null, r.highlights_html.map((x) => h('li', { html: x }))),
      ]) : null,
      r.sources && r.sources.length ? h('p', { class: 'r-src' }, [`來源：${r.sources.join('、')}`]) : null,
    ]);
  }

  // 「Global Scan（全網速覽）」這類中英並列的分區名，膠囊只放括號裡的中文，手機上才放得下
  const shortName = (name) => {
    const m = /（([^（）]+)）\s*$/.exec(name);
    return m ? m[1] : name;
  };

  function bar(r) {
    const chips = r.sections.filter((s) => s.name && s.count).map((s) => h('a', {
      class: 'chip sec-chip', href: `#${s.id}`, 'data-for': s.id, title: s.name,
    }, [shortName(s.name), h('span', { class: 'n' }, [String(s.count)])]));
    const hasDive = r.sections.some((s) => s.blocks.some((b) => b.type === 'item' && b.dive_html));
    const toggle = h('button', {
      type: 'button', class: 'tool-btn', 'aria-expanded': 'false', 'aria-controls': 'tools', 'aria-label': '搜尋與篩選', html: SEARCH_ICON,
    });
    const q = h('input', {
      type: 'search', class: 'q', id: 'q', placeholder: '搜尋標題、摘要、解讀', 'aria-label': '搜尋這份報告', autocomplete: 'off', enterkeyhint: 'search',
    });
    const tools = h('div', { class: 'tools', id: 'tools', hidden: true }, [
      q,
      h('div', { class: 'facets', id: 'facets', role: 'group', 'aria-label': '依來源篩選' }),
      h('div', { class: 'tools-foot' }, [
        h('span', { id: 'count', 'aria-live': 'polite' }),
        hasDive ? h('button', { type: 'button', class: 'chip', id: 'expand', 'aria-pressed': 'false' }, ['展開全部解讀']) : null,
      ]),
    ]);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      tools.hidden = !open;
      if (open) q.focus();
    });
    return h('div', { class: 'r-bar' }, [
      h('div', { class: 'r-bar-row' }, [h('nav', { class: 'sec-chips', 'aria-label': '分區' }, chips), toggle]),
      tools,
    ]);
  }

  function setupFilter(root) {
    const items = [...root.querySelectorAll('.item')];
    const secs = [...root.querySelectorAll('.sec')];
    const q = root.querySelector('#q');
    const facets = root.querySelector('#facets');
    const count = root.querySelector('#count');
    const empty = root.querySelector('#empty');
    const text = new Map(items.map((li) => [li, li.querySelector('.body').textContent.toLowerCase()]));
    const sources = new Map();
    items.forEach((li) => {
      const s = li.dataset.src;
      if (s) sources.set(s, (sources.get(s) || 0) + 1);
    });
    let src = '';
    let query = '';
    const chips = [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-src': name }, [name, h('span', { class: 'n' }, [String(n)])]);
      b.addEventListener('click', () => {
        src = src === name ? '' : name;
        apply();
      });
      return b;
    });
    if (chips.length > 1) facets.append(...chips);
    else facets.hidden = true;

    function apply() {
      let shown = 0;
      items.forEach((li) => {
        const ok = (!src || li.dataset.src === src) && (!query || text.get(li).includes(query));
        li.hidden = !ok;
        if (ok) shown += 1;
      });
      const filtering = Boolean(src || query);
      secs.forEach((s) => { s.hidden = filtering && !s.querySelector('.item:not([hidden])'); });
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.src === src)));
      count.textContent = filtering ? `符合 ${shown} 則` : `共 ${items.length} 則`;
      empty.hidden = shown > 0;
    }
    let timer = 0;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = q.value.trim().toLowerCase();
        apply();
      }, 120);
    });
    root.querySelector('#clear').addEventListener('click', () => {
      q.value = '';
      query = '';
      src = '';
      apply();
      q.focus();
    });
    apply();
  }

  function setupExpand(root) {
    const btn = root.querySelector('#expand');
    const dives = () => root.querySelectorAll('details.dive');
    window.addEventListener('beforeprint', () => dives().forEach((d) => { d.open = true; }));
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      dives().forEach((d) => { d.open = on; });
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? '收合全部解讀' : '展開全部解讀';
    });
  }

  // 捲到哪一區，頂列對應的分區膠囊就反白
  function setupSpy(root) {
    const nav = root.querySelector('.sec-chips');
    const chips = new Map([...root.querySelectorAll('.sec-chip')].map((c) => [c.dataset.for, c]));
    if (!chips.size || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const c = e.isIntersecting && chips.get(e.target.id);
        if (!c) return;
        chips.forEach((x) => x.removeAttribute('aria-current'));
        c.setAttribute('aria-current', 'true');
        nav.scrollTo({ left: c.offsetLeft - nav.offsetLeft - 8, behavior: 'smooth' });
      });
    }, { rootMargin: '-30% 0px -65% 0px' });
    root.querySelectorAll('.sec').forEach((s) => io.observe(s));
  }

  // 點過的標題變淡，下次打開同一份或別份報告都記得（存在這台裝置）
  function setupRead(root) {
    const read = readUrls();
    root.querySelectorAll('.item').forEach((li) => {
      if (li.dataset.url && read.has(li.dataset.url)) li.classList.add('is-read');
    });
    root.addEventListener('click', (e) => {
      const a = e.target.closest('.it-title a');
      if (!a) return;
      const li = a.closest('.item');
      markRead(li.dataset.url);
      li.classList.add('is-read');
    });
  }

  async function seriesNav(r, nav) {
    const all = h('a', { href: `${newsRoot}index.html` }, ['所有新聞']);
    try {
      const idx = await A.getJSON(`${newsRoot}index.json`);
      let same = (idx.items || []).filter((e) => e.series === r.series);
      if (!same.some((e) => e.period === r.period)) {
        const arc = await A.getJSON(`${newsRoot}archive/${r.period.slice(0, 4)}.json`);
        same = (arc.items || []).filter((e) => e.series === r.series);
      }
      same.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
      const i = same.findIndex((e) => e.period === r.period);
      const prev = i > 0 ? same[i - 1] : null;
      const next = i >= 0 && i < same.length - 1 ? same[i + 1] : null;
      nav.append(
        prev ? h('a', { href: newsRoot + prev.path, rel: 'prev' }, [`‹ ${A.fmtShort(prev.period, prev.cadence)}`]) : h('span'),
        all,
        next ? h('a', { href: newsRoot + next.path, rel: 'next' }, [`${A.fmtShort(next.period, next.cadence)} ›`]) : h('span'),
      );
    } catch (e) {
      nav.append(h('span'), all, h('span'));
    }
  }

  function render(r) {
    if (r.schema !== 1) throw new Error(`不支援的資料版本 ${r.schema}`);
    const main = h('main', { class: 'sections' }, r.sections.map(section));
    main.appendChild(h('div', { class: 'empty', id: 'empty', hidden: true }, [
      h('p', null, ['沒有符合的條目。']),
      h('button', { type: 'button', class: 'chip', id: 'clear' }, ['清除搜尋與篩選']),
    ]));
    const nav = h('nav', { class: 'series-nav', 'aria-label': '同系列前後期' });
    const foot = h('footer', { class: 'site-foot' }, [
      h('p', null, [r.disclaimer || '', r.generated_at ? `產生於 ${A.fmtStamp(r.generated_at)}。` : '']),
      A.themeSwitch(),
    ]);
    app.replaceChildren(head(r), bar(r), main, nav, foot);
    setupFilter(app);
    setupExpand(app);
    setupSpy(app);
    setupRead(app);
    seriesNav(r, nav);
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  A.getJSON(dataUrl).then(render).catch((err) => {
    document.documentElement.classList.remove('js');
    app.insertBefore(h('p', { class: 'load-error', role: 'alert' }, [
      `完整版載入失敗（${err.message}），以下是精簡版；重新整理可再試一次。`,
    ]), app.firstChild);
  });
})();
