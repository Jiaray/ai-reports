(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const query = new URLSearchParams(location.search);
  if (!query.get('t')) return;
  if (!B) {
    const self = document.currentScript && document.currentScript.src;
    if (!self) return;
    A.barLoad = A.barLoad || new Promise((ok, ko) => {
      const s = document.createElement('script');
      const u = new URL('bar.js', self);
      u.search = new URL(self).search;
      s.src = u.href;
      s.onload = ok;
      s.onerror = ko;
      document.head.append(s);
    });
    A.barLoad.then(() => document.head.append(Object.assign(document.createElement('script'), { src: self })), () => {});
    return;
  }
  let index = { series: [], items: [] };
  let all = [];
  let shown = null;
  let stories = null;
  let seriesNames = [];
  let vwBox = null;

  const READS = [['full', '完整'], ['scan', '標題'], ['timeline', '時間軸']];
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  const KEY_READ = 'air-news-read';
  const KEY_LOOK = 'air-news-look';
  function stored(key, list) {
    let v = null;
    try { v = localStorage.getItem(key); } catch (e) { }
    return list.some((x) => x[0] === v) ? v : list[0][0];
  }
  function store(key, v) {
    try { localStorage.setItem(key, v); } catch (e) { }
  }
  const view = { read: stored(KEY_READ, READS), look: stored(KEY_LOOK, LOOKS) };
  function applyView() {
    root.setAttribute('data-read', view.read);
    root.setAttribute('data-look', view.look);
  }
  applyView();

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

  let issueMD = '';
  const monthDay = (m, d) => `${+m}/${+d}`;

  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m} 月 ${d} 日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
  }

  const cadenceOf = (e) => (e && e.cadence) || 'daily';
  function editions(cur) {
    if (!cur && !all.length && !vwBox) return null;
    return B.toolbar([
      cur ? periodPicker(cur) : null,
      all.length ? B.navLink('本日焦點', 'front', './', cur && cadenceOf(cur) === 'daily' ? 'true' : null) : null,
      weeklyLink(cur),
      vwBox,
    ]);
  }

  function weeklyLink(cur) {
    if (!all.some((e) => cadenceOf(e) !== 'daily')) return null;
    return B.navLink('本週回顧', 'weekly', '?w', cur && cadenceOf(cur) !== 'daily' ? 'true' : null);
  }

  function rankOf(id) {
    const order = (index.series || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }

  let chapBox = null;
  let chapKey = '';
  function titleChapters(cur, r) {
    const items = (r.sections || []).map((s, i) => ({ name: s.name, count: s.count, href: `#sec-${pad(i + 1)}`, k: String((i % 10) + 1) }))
      .filter((x) => x.name);
    if (!cur || view.read === 'timeline') return B.titleChapters({ title: r.title, items: [] });
    if (chapBox && chapKey === keyOf(cur)) return chapBox;
    chapKey = keyOf(cur);
    chapBox = B.titleChapters({ title: r.title, items, panelTitle: '本期章節' });
    return chapBox;
  }

  let pdBox = null;
  let pdKey = '';
  function periodPicker(cur) {
    if (pdBox && pdKey === keyOf(cur)) return pdBox;
    pdKey = keyOf(cur);
    const byRank = (a, b) => rankOf(a.series) - rankOf(b.series);
    const byPeriod = new Map();
    all.filter((e) => cadenceOf(e) === cadenceOf(cur)).forEach((e) => {
      const list = byPeriod.get(e.period) || [];
      if (!list.some((x) => x.series === e.series)) list.push(e);
      byPeriod.set(e.period, list);
    });
    const here = [...(byPeriod.get(cur.period) || [cur])].sort(byRank).map((e) => ({
      text: e.series_title || e.title, count: e.count, href: link(e.series, e.period), current: e.series === cur.series,
    }));
    const periods = [...byPeriod.keys()].sort().reverse().map((p) => {
      const list = byPeriod.get(p);
      const e = list.find((x) => x.series === cur.series) || [...list].sort(byRank)[0];
      return { period: p, href: link(e.series, p), current: p === cur.period };
    });
    pdBox = B.datePicker({ period: cur.period, cadence: cadenceOf(cur), here, periods });
    return pdBox;
  }

  function table(t) {
    return h('div', { class: 'tbl' }, [h('table', null, [
      h('thead', null, [h('tr', null, t.head.map((c) => h('th', { scope: 'col', html: c })))]),
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

  function parseSrc(src) {
    const s = (src || '').trim();
    const m = /^(.*?)\s*等\s*(\d+)\s*家$/.exec(s);
    const body = m ? m[1] : s;
    const notes = new Map();
    const names = body ? body.split('、').map((p) => p.trim()).filter(Boolean).map((p) => {
      const n = /^(.*?)\s*（([^（）]*)）$/.exec(p);
      if (!n) return p;
      notes.set(n[1], n[2]);
      return n[1];
    }) : [];
    return { names, notes, count: m ? +m[2] : names.length };
  }

  function links(list, seen = new Map(), { notes = new Map(), shown = new Set() } = {}) {
    const groups = [];
    list.forEach((l) => {
      const g = groups.find((x) => x.text === l.text);
      if (g) g.items.push(l);
      else groups.push({ text: l.text, items: [l] });
    });
    const link = (l, text) => (l.url ? h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [text]) : document.createTextNode(text));
    const join = (arr) => arr.flatMap((a, k) => (k ? ['、', a] : [a]));
    return join(groups.map((g) => {
      const before = seen.get(g.text) ?? (shown.has(g.text) ? 1 : 0);
      seen.set(g.text, before + g.items.length);
      const nth = (k) => link(g.items[k], `第 ${before + k + 1} 篇`);
      if (before && shown.has(g.text)) return h('span', null, join(g.items.map((_, k) => nth(k))));
      const head = before ? document.createTextNode(g.text) : link(g.items[0], g.text);
      const note = !before && notes.has(g.text) ? notes.get(g.text) : '';
      const rest = (before ? g.items.map((_, k) => k) : g.items.slice(1).map((_, k) => k + 1)).map(nth);
      const inner = [...(note ? [note] : []), ...(note && rest.length ? ['，'] : []), ...join(rest)];
      return h('span', null, inner.length ? [head, '（', ...inner, '）'] : [head]);
    }));
  }

  function rowTime(left, line, ts) {
    const m = /^((\d{1,2})\/(\d{1,2}))(?:\s+(\d{1,2}:\d{2}))?$/.exec(left || '');
    if (!m) return h('span', { class: 'row-time' }, [h('span', { class: 'rt-txt' }, [left || ''])]);
    const kids = [];
    if (!line && monthDay(m[2], m[3]) !== issueMD) kids.push(h('span', { class: 'rt-d' }, [m[1]]));
    if (m[4]) kids.push(...(kids.length ? [' '] : []), h('span', { class: 'rt-hm' }, [m[4]]));
    return h(ts ? 'time' : 'span', { class: 'row-time', datetime: ts || null }, kids);
  }

  const OPEN = '「『（(〔【';
  const CLOSE = '」』）)〕】';
  const ENDS = '。！？';
  function paragraphs(html, min = 60) {
    const textLen = (s) => s.replace(/<[^>]*>/g, '').length;
    const out = [];
    html.split(/<br\s*\/?>/i).forEach((block) => {
      const paras = [];
      let cur = '';
      let depth = 0;
      let inline = 0;
      let last = '';
      for (let i = 0; i < block.length; i++) {
        const ch = block[i];
        if (ch === '<') {
          const end = block.indexOf('>', i);
          if (end < 0) {
            cur += block.slice(i);
            break;
          }
          inline += block[i + 1] === '/' ? -1 : 1;
          cur += block.slice(i, end + 1);
          i = end;
          continue;
        }
        cur += ch;
        if (OPEN.includes(ch)) depth += 1;
        else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
        const sentenceEnd = (ENDS.includes(ch) && depth === 0) || (CLOSE.includes(ch) && depth === 0 && ENDS.includes(last));
        last = ch;
        if (sentenceEnd && inline === 0 && textLen(cur) >= min) {
          paras.push(cur.trim());
          cur = '';
        }
      }
      if (cur.trim()) {
        if (paras.length && textLen(cur) < min / 2) paras[paras.length - 1] += cur;
        else paras.push(cur.trim());
      }
      out.push(...paras);
    });
    return out.filter(Boolean);
  }

  function hotInfo(it) {
    if (/^hot$/i.test((it.left || '').trim())) return { label: 'HOT', from: 'left' };
    if ((it.heat || '').trim() === '爆') return { label: '爆', from: 'heat' };
    const t = (it.tags || []).find((x) => x.cls === 'tag-hot');
    return t ? { label: t.text, from: 'tag', tag: t } : null;
  }
  const hotBadge = (hot) => h('span', { class: 'hot-badge' }, [hot.label]);

  function plainText(html) {
    const t = document.createElement('template');
    t.innerHTML = html.replace(/<br\s*\/?>/gi, ' ');
    return t.content.textContent.replace(/\s+/g, ' ').trim();
  }

  const foldsMore = (it) => (it.also || []).length || (it.also_more || []).length || (it.bullets_html || []).length
    || it.table || it.dive_html;
  function fold(it, body) {
    const more = foldsMore(it);
    if (!more) return it.summary_html ? h('p', { class: 'teaser teaser-all', html: it.summary_html }) : null;
    return h('details', { class: 'more' }, [
      h('summary', { class: 'more-sum' }, [
        it.summary_html ? h('span', { class: 'teaser' }, [plainText(it.summary_html)]) : null,
        h('span', { class: 'more-hint' }, [
          h('span', { class: 'mh-o' }, [it.dive_html ? '看 AI 解讀' : '看更多']),
          h('span', { class: 'mh-c' }, ['收起']),
        ]),
      ]),
      h('div', { class: 'more-body' }, body),
    ]);
  }

  const titleLink = (it) => (it.url
    ? h('h3', { class: 'row-title' }, [h('a', { href: it.url, target: '_blank', rel: 'noopener', html: it.title_html })])
    : h('h3', { class: 'row-title', html: it.title_html }));

  function peek(it, tags, body, hot) {
    const title = body.length ? h('span', { class: 'row-title', html: it.title_html }) : titleLink(it);
    if (hot) title.prepend(hotBadge(hot));
    if (!body.length) return title;
    const meta = [...tags];
    if (it.url) meta.push(h('a', { class: 'peek-link', href: it.url, target: '_blank', rel: 'noopener' }, ['看原文 ↗']));
    return h('details', { class: 'peek' }, [
      h('summary', { class: 'peek-sum' }, [title]),
      h('div', { class: 'more-body' }, [meta.length ? h('div', { class: 'tags' }, meta) : null, ...body]),
    ]);
  }

  function row(it, o = {}) {
    const hot = hotInfo(it);
    const src = parseSrc(it.src);
    const hasAlso = (it.also || []).length > 0 || (it.also_more || []).length > 0;
    const countOnly = hasAlso && src.count >= 2;
    const nameAtTop = !!it.src && !o.fold && !countOnly;
    const linkOpt = nameAtTop ? { shown: new Set(src.names) } : { notes: src.notes };
    const tags = [];
    if (it.src && !o.fold) tags.push(h('span', { class: 'tag tag-neutral' }, [countOnly ? `${src.count} 家報導` : it.src]));
    (it.tags || []).forEach((t) => {
      if (!(hot && hot.tag === t)) tags.push(h('span', { class: `tag ${t.cls}` }, [t.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) tags.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    const title = o.peek ? null : titleLink(it);
    if (title && hot) title.prepend(hotBadge(hot));
    const main = o.peek ? [] : [
      o.line && o.sec ? h('span', { class: 'row-sec' }, [o.sec]) : null,
      title,
      tags.length ? h('div', { class: 'tags' }, tags) : null,
    ];
    const isSrcBullet = (b) => /^<strong>多家報導/.test(b);
    const bullets = (it.bullets_html || []).filter((b) => !isSrcBullet(b));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    if (bullets.length) body.push(h('ul', { class: 'row-bullets' }, bullets.map((b) => h('li', { html: b }))));
    if (it.table) body.push(table(it.table));
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      if (ps.length) {
        ps[0].prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
        body.push(h('div', { class: 'row-dive' }, ps));
      }
    }
    const srcs = [];
    const inAlso = new Set((it.also || []).map((l) => l.text));
    const alsoList = [...(it.also || []), ...(it.also_more || []).filter((l) => inAlso.has(l.text))];
    const moreList = (it.also_more || []).filter((l) => !inAlso.has(l.text));
    const seen = new Map();
    if (alsoList.length) {
      srcs.push(h('p', { class: 'row-also' }, [h('span', { class: 'seealso' }, ['另參：', ...links(alsoList, seen, linkOpt)])]));
    }
    if (moreList.length) {
      srcs.push(h('details', { class: 'seealso-more' }, [h('summary', null, [`其餘 ${moreList.length} 個連結`]), ...links(moreList, seen, linkOpt)]));
    }
    const fx = A.facets && A.facets.parts && it.facets ? A.facets.parts(it.facets, {
      title: plainText(it.title_html || ''), types: seriesNames, src: it.src,
      tags: [...(it.tags || []).map((t) => t.text), it.heat, hot && hot.label].filter(Boolean),
    }) : null;
    let fxBar = null;
    if (fx && srcs.length && alsoList.length) srcs[0].append(fx.toggle);
    else if (fx && srcs.length) srcs[srcs.length - 1] = h('div', { class: 'fct-with' }, [srcs[srcs.length - 1], fx.toggle]);
    else if (fx) fxBar = A.facets.bar(fx.toggle);
    if (srcs.length) body.push(h('div', { class: 'row-srcs' }, srcs));
    const foldOnly = o.fold && !foldsMore(it);
    if (fx && !foldOnly) body.push(...[fxBar, fx.panel].filter(Boolean));
    if (o.peek) main.push(peek(it, tags, body, hot));
    else main.push(...(o.fold ? [fold(it, body), ...(fx && foldOnly ? [fxBar, fx.panel] : [])] : body));
    const left = hot && hot.from === 'left' ? h('span', { class: 'row-time' }) : rowTime(it.left, o.line, it.ts);
    return h('article', { class: hot ? 'row is-hot' : 'row', id: `item-${it.no}`, 'data-k': o.line ? o.k : null }, [
      h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, [it.no]), left]),
      h('div', { class: 'row-main' }, main),
    ]);
  }

  function timeline(r, key) {
    const list = [];
    r.sections.forEach((s, i) => s.blocks.forEach((b) => {
      if (b.type === 'item') list.push({ it: b, sec: s.name, k: key(i), n: list.length, t: b.ts ? Date.parse(b.ts) : NaN });
    }));
    const timed = list.filter((x) => !Number.isNaN(x.t)).sort((a, b) => b.t - a.t || a.n - b.n);
    const rest = list.filter((x) => Number.isNaN(x.t));
    const kids = [];
    const put = (x) => kids.push(row(x.it, { fold: true, line: true, sec: x.sec, k: x.k }));
    let day = '';
    timed.forEach((x) => {
      const d = new Date(x.t + TAIPEI_MS).toISOString().slice(0, 10);
      if (d !== day) {
        if (day || d !== r.date) kids.push(h('h2', { class: 'tl-day' }, [dayLabel(d)]));
        day = d;
      }
      put(x);
    });
    if (timed.length && rest.length) kids.push(h('h2', { class: 'tl-day' }, ['未標時間']));
    rest.forEach(put);
    return h('main', { class: 'tl', id: 'main' }, kids);
  }

  function report(r, cur) {
    const key = (i) => String((i % 10) + 1);
    const dm = /^\d{4}-(\d{2})-(\d{2})$/.exec(r.date || '');
    issueMD = dm ? monthDay(dm[1], dm[2]) : '';
    const head = h('header', { class: 'masthead read-head' }, [titleChapters(cur, r), readSwitch()]);
    const tagsOf = r.src_tags || [];
    const srcs = tagsOf.length ? h('aside', { class: 'srcs', 'aria-labelledby': 'srcs-title' }, [
      h('h2', { class: 'srcs-title', id: 'srcs-title' }, ['本期來源']),
      h('ul', { class: 'srcs-list' }, tagsOf.map((t) => h('li', { class: 'tag tag-neutral' }, [t]))),
    ]) : null;
    const foot = h('footer', { class: 'foot' }, [h('span', { class: 'foot-left' }, [r.foot_left])]);
    if (view.read === 'timeline') return [head, timeline(r, key), srcs, foot].filter(Boolean);
    const peekMode = view.read === 'scan';
    const secs = r.sections.map((s, i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}`, 'data-k': key(i) }, [
      h('div', { class: 'sec-tab' }, [h('h2', { class: 'sec-name' }, [s.name])]),
      h('div', { class: 'sec-body' }, s.blocks.flatMap((b) => {
        if (b.type === 'item') return [row(b, { peek: peekMode })];
        if (b.type === 'sub') return [h('h3', { class: 'sec-sub', html: b.html })];
        return notes(b.blocks, 'sec-note');
      })),
    ]));
    return [head, h('main', { id: 'main' }, secs), srcs, foot].filter(Boolean);
  }

  function readingSpot() {
    if (window.scrollY < 1) return null;
    for (const el of app.querySelectorAll('.row')) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 80) return { id: el.id, top: rect.top };
    }
    return null;
  }

  function redraw(rebuild) {
    const spot = readingSpot();
    const update = () => {
      const focused = document.activeElement;
      applyView();
      if (rebuild && shown) app.replaceChildren(...page());
      if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
      const el = spot && document.getElementById(spot.id);
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - Math.max(spot.top, B.barHeight()));
    };
    if (!document.startViewTransition) {
      update();
      return Promise.resolve();
    }
    const vt = document.startViewTransition(update);
    vt.ready.catch(() => {});
    return vt.updateCallbackDone;
  }

  const READ_ICON = { full: 'readFull', scan: 'readScan', timeline: 'readTimeline' };
  let readBar = null;
  function readSwitch() {
    if (readBar) return readBar;
    const buttons = READS.map(([value, text]) => {
      const b = h('button', { type: 'button', class: 'read-opt', 'data-v': value, 'aria-pressed': String(value === view.read) }, [
        h('span', { class: 'read-ico', html: B.ICON[READ_ICON[value]] || '' }),
        h('span', { class: 'read-name' }, [text]),
      ]);
      b.addEventListener('click', () => {
        if (value === view.read) return;
        view.read = value;
        store(KEY_READ, value);
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        redraw(true);
      });
      return b;
    });
    readBar = h('div', { class: 'read-sw', role: 'toolbar', 'aria-labelledby': 'read-lab', focusgroup: 'toolbar wrap' }, [
      h('span', { class: 'read-lab', id: 'read-lab' }, ['讀法']),
      ...buttons,
    ]);
    if (B.roving) B.roving(readBar);
    return readBar;
  }

  function layoutPanel() {
    const groups = [
      ['外觀', LOOKS, () => view.look, (v) => { view.look = v; store(KEY_LOOK, v); redraw(false); }],
      ...(A.THEMES ? [['配色', A.THEMES, A.getTheme, A.setTheme, A.themeLabel]] : []),
    ].map(([label, list, get, set, labelOf], gi) => {
      const buttons = list.map(([value, text]) => {
        const b = h('button', { type: 'button' }, [text]);
        b.addEventListener('click', () => {
          if (value !== get()) set(value);
          sync();
        });
        return [b, value];
      });
      const el = h('div', { class: 'vw-group', role: 'group', 'aria-labelledby': `vw-label-${gi}` }, [
        h('span', { class: 'vw-label', id: `vw-label-${gi}` }, [label]),
        h('div', { class: 'vw-seg' }, buttons.map((x) => x[0])),
      ]);
      return { el, buttons, get, labelOf };
    });
    function sync() {
      groups.forEach((g) => g.buttons.forEach(([b, value]) => {
        b.setAttribute('aria-pressed', String(value === g.get()));
        if (g.labelOf) b.textContent = g.labelOf(value);
      }));
    }
    document.addEventListener('air-theme', sync);
    sync();
    vwBox = B.dropdown({
      cls: 'vw', id: 'vw-panel', title: '版面設定', closeLabel: '關閉版面設定',
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', { class: 'dd-txt' }, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]'),
    });
  }

  const stale = () => (B.staleBanner ? B.staleBanner(shown.entry.period) : null);
  const page = () => [stale(), editions(shown.entry), ...report(shown.data, shown.entry)].filter(Boolean);

  const problem = (cur, text, more) => app.replaceChildren(
    ...[all.length ? editions(cur) : null].filter(Boolean),
    h('p', { class: 'load-error', role: 'alert' }, [text, more || null]),
  );

  async function seriesList(t) {
    if (!/^[a-z0-9_-]+$/.test(t)) return null;
    try {
      const doc = await A.getJSON(`${t}/index.json`);
      return doc && Array.isArray(doc.items) ? doc : null;
    } catch (e) {
      return null;
    }
  }

  async function main() {
    const t = query.get('t') || '';
    const d = query.get('d') || '';
    const listing = seriesList(t);
    stories = A.facets ? A.facets.load() : null;
    try {
      index = await A.getJSON('index.json');
    } catch (err) {
      problem(null, `新聞清單載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    merge(index.items || []);
    const doc = await listing;
    if (doc) {
      const info = (index.series || []).find((s) => s.id === t) || {};
      const extra = {
        series: t, series_title: info.title || doc.title || t, cadence: info.cadence || doc.cadence || 'daily',
      };
      merge(doc.items.filter((e) => e && e.period && e.data).map((e) => ({ ...e, ...extra })));
    }
    const entry = all.find((e) => e.series === t && (!d || e.period === d));
    if (!entry) {
      const more = all.some((e) => e.series === t)
        ? h('a', { href: link(t) }, ['看這個系列的最新一期'])
        : h('a', { href: './' }, ['回本日焦點']);
      if (all.length) problem(null, `找不到這一期（${t}${d ? ` ${d}` : ''}）。`, more);
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
    if (A.facets) await stories;
    const info = (index.series || []).find((s) => s.id === entry.series) || {};
    seriesNames = [info.short, info.title, info.group, entry.series_title].filter(Boolean);
    shown = { entry, data };
    document.title = `${data.title} ${data.date}｜AI Reports`;
    app.replaceChildren(...page());
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const peek = target && target.querySelector('details.peek');
      if (peek) peek.open = true;
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }
  }

  layoutPanel();
  main();
})();
