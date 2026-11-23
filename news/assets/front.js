(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('t')) return;
  const A = window.AIR;
  if (!A.bar) {
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
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const WEEK_RE = /^\d{4}-W\d{2}$/;
  const SEEN_KEY = 'air-front-seen';
  const SEEN_DAYS = 7;
  const SEEN_WEEKS = 2;
  const FILTER_KEY = 'air-front-types';
  try { localStorage.removeItem('air-front-filter'); } catch (e) { }
  const weekMode = query.has('w');
  const PERIOD_RE = weekMode ? WEEK_RE : DATE_RE;
  const want = (weekMode ? query.get('w') : query.get('f')) || null;

  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  function storedLook() {
    let v = null;
    try { v = localStorage.getItem(KEY_LOOK); } catch (e) { }
    return LOOKS.some((x) => x[0] === v) ? v : LOOKS[0][0];
  }
  let look = storedLook();
  const standard = () => look === 'standard';
  const applyLook = () => root.setAttribute('data-look', look);
  root.setAttribute('data-read', 'scan');
  applyLook();
  app.classList.add('fp');

  let index = null;
  let dates = [];
  let front = null;
  let fpBox = null;
  const marked = new Map();

  const taipei = (ms) => new Date(ms + TAIPEI_MS).toISOString();
  const today = () => taipei(Date.now()).slice(0, 10);
  const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const weekday = (iso) => WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
  const dayLabel = (iso) => `${md(iso)}（${weekday(iso)}）`;
  function isoWeek(iso) {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y = t.getUTCFullYear();
    return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`;
  }
  const period = () => (weekMode ? front.week : front.date);

  function seriesRank(id) {
    const order = ((index && index.series) || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }
  const bySeries = (a, b) => seriesRank(a) - seriesRank(b) || (a < b ? -1 : a > b ? 1 : 0);
  function seriesMeta(id) {
    const s = ((index && index.series) || []).find((x) => x.id === id);
    const r = ((front && front.reports) || []).find((x) => x.series === id);
    const it = ((index && index.items) || []).find((x) => x.series === id);
    const title = (s && s.title) || (r && r.series_title) || (it && it.series_title) || id;
    return {
      title,
      short: (s && s.short) || title,
      group: (s && s.group) || (r && r.group) || '其他',
      cadence: (s && s.cadence) || (it && it.cadence) || '',
    };
  }
  const typeTag = (id) => {
    const m = seriesMeta(id);
    return h('span', { class: 'fp-ty', 'data-group': m.group }, [m.short]);
  };
  const reportHref = (series, period, no) => `?t=${encodeURIComponent(series)}&d=${encodeURIComponent(period)}${no != null ? `#item-${no}` : ''}`;

  function readSeen() {
    let raw;
    try {
      raw = localStorage.getItem(SEEN_KEY);
    } catch (e) {
      return null;
    }
    try {
      const v = raw ? JSON.parse(raw) : {};
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  }
  const keep = (p) => (DATE_RE.test(p) ? p >= addDays(today(), 1 - SEEN_DAYS)
    : WEEK_RE.test(p) && p >= isoWeek(addDays(today(), -7 * (SEEN_WEEKS - 1))));
  function freshKeys(date, keys) {
    const set = marked.get(date) || new Set();
    marked.set(date, set);
    const all = readSeen();
    if (all && keep(date) && Array.isArray(all[date])) {
      const before = new Set(all[date]);
      keys.forEach((k) => { if (!before.has(k)) set.add(k); });
    }
    return set;
  }
  function remember(date, keys) {
    const all = readSeen();
    if (!all || !keep(date)) return;
    const next = {};
    Object.keys(all).forEach((d) => {
      if (keep(d) && Array.isArray(all[d])) next[d] = all[d].filter((k) => typeof k === 'string');
    });
    next[date] = [...new Set([...(next[date] || []), ...keys])];
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch (e) { }
  }

  function hotInfo(it) {
    if (/^hot$/i.test((it.left || '').trim())) return { label: 'HOT', from: 'left' };
    if ((it.heat || '').trim() === '爆') return { label: '爆', from: 'heat' };
    const t = (it.tags || []).find((x) => x.cls === 'tag-hot');
    return t ? { label: t.text, from: 'tag', tag: t } : null;
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

  function when(ts) {
    const ms = ts ? Date.parse(ts) : NaN;
    if (Number.isNaN(ms)) return null;
    const t = taipei(ms);
    return { ms, day: t.slice(0, 10), hour: t.slice(11, 13), hm: t.slice(11, 16) };
  }
  const plainText = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();

  const hourHead = (label, day) => h('h2', { class: 'fp-hr' }, [label, day ? h('span', { class: 'fp-hr-day' }, [day]) : null]);

  function tlRow(it, o) {
    const hot = hotInfo(it);
    const title = h('span', { class: 'row-title' }, [it.title || '']);
    if (hot) title.prepend(h('span', { class: 'hot-badge' }, [hot.label]));
    if (o.isNew) title.append(h('span', { class: 'fp-new' }, ['新']));
    const acts = [];
    if (it.src) acts.push(h('span', { class: 'tag tag-neutral' }, [it.src]));
    (it.tags || []).forEach((t) => {
      if (!(hot && hot.tag === t)) acts.push(h('span', { class: `tag ${t.cls || ''}` }, [t.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) acts.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    if (it.url) acts.push(h('a', { class: 'fp-act', href: it.url, target: '_blank', rel: 'noopener' }, ['看原文 ↗']));
    const linked = new Set();
    const srcLinks = [];
    (o.from || []).filter((f) => f && f.series && f.period).sort((a, b) => bySeries(a.series, b.series)).forEach((f) => {
      if (linked.has(f.series)) return;
      linked.add(f.series);
      const m = seriesMeta(f.series);
      if (srcLinks.length) srcLinks.push(h('span', { class: 'fp-from-sep' }, ['、']));
      srcLinks.push(h('a', { class: 'fp-act fp-series', href: reportHref(f.series, f.period, f.no) }, [
        h('span', { class: 'fp-series-ico', html: B.ICON[(m.cadence || 'daily') === 'daily' ? 'front' : 'weekly'] || '' }), m.title,
      ]));
    });
    if (srcLinks.length) acts.push(h('span', { class: 'fp-from' }, [h('span', { class: 'fp-from-lab' }, ['出自']), ...srcLinks]));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      ps[0].prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
      body.push(h('div', { class: 'row-dive' }, ps));
    }
    const types = o.types || [];
    const fx = A.facets && A.facets.parts && it.facets ? A.facets.parts(it.facets, {
      title: it.title || '', types: types.map((t) => seriesMeta(t).short), src: it.src,
      tags: [...(it.tags || []).map((t) => t.text), it.heat, hot && hot.label].filter(Boolean),
    }) : null;
    if (fx) {
      if (srcLinks.length) acts.push(h('span', { class: 'fp-sep', 'aria-hidden': 'true' }));
      acts.push(fx.toggle);
    }
    body.push(h('div', { class: 'fp-acts' }, acts));
    if (fx) body.push(fx.panel);
    const meta = h('span', { class: 'fp-mt' }, [...types.map(typeTag), o.stamp || null]);
    const pre = o.lead && it.summary_html ? h('span', { class: 'fp-pre', 'aria-hidden': 'true' }, [plainText(it.summary_html)]) : null;
    const cls = ['fp-row', 'fp-it'];
    if (o.lead) cls.push('is-lead');
    if (hot) cls.push('is-hot');
    return h('article', {
      class: cls.join(' '), id: o.id, 'data-group': types.length ? seriesMeta(types[0]).group : null, 'data-fq': types.join(' '),
      'data-key': o.key || null,
    }, [
      h('details', { class: 'peek' }, [
        h('summary', { class: 'peek-sum' }, [meta, title, pre]),
        h('div', { class: 'more-body' }, body),
      ]),
    ]);
  }

  const dayHref = (d) => (d === dates[0] ? './' : `?f=${d}`);
  const weekHref = (w) => (w === dates[0] ? '?w' : `?w=${w}`);
  const periodHref = (p) => (weekMode ? weekHref(p) : dayHref(p));
  const latestHref = weekMode ? '?w' : './';
  const here = () => (period() === dates[0] ? 'page' : 'true');
  const frontLink = (current) => B.navLink('本日焦點', 'front', './', current);
  const TITLE = weekMode ? '本週回顧' : '本日焦點';
  const cadenceOf = (e) => e.cadence || seriesMeta(e.series).cadence || 'daily';

  function weeklyLink(current) {
    const any = ((index && index.items) || []).some((e) => e && e.series && e.period && cadenceOf(e) !== 'daily');
    return any || weekMode ? B.navLink('本週回顧', 'weekly', '?w', current) : null;
  }

  function datePicker() {
    const p = period();
    const mine = (e) => (weekMode
      ? (cadenceOf(e) === 'weekly' ? e.period === p : cadenceOf(e) === 'monthly' && DATE_RE.test(e.date || '') && isoWeek(e.date) === p)
      : cadenceOf(e) === 'daily' && e.period === p);
    const list = [];
    ((index && index.items) || []).forEach((e) => {
      if (e && e.series && e.period && mine(e) && !list.some((x) => x.series === e.series)) list.push(e);
    });
    list.sort((a, b) => bySeries(a.series, b.series));
    return B.datePicker({
      period: p,
      cadence: weekMode ? 'weekly' : 'daily',
      here: list.map((e) => ({ text: e.series_title || seriesMeta(e.series).title, count: e.count, href: reportHref(e.series, e.period) })),
      periods: dates.map((d) => ({ period: d, href: periodHref(d), current: d === p })),
    });
  }

  const masthead = (types) => [
    B.staleBanner ? B.staleBanner(period(), period() === dates[0] ? (weekMode ? '本週還沒有回顧，這是最近一期' : '今天還沒有焦點，這是最近一期') : null) : null,
    B.toolbar([datePicker(), frontLink(weekMode ? null : here()), weeklyLink(weekMode ? here() : null), fpBox]),
    h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...filterBar(types)]),
  ];

  const CHECK = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9"/></svg>';
  function readFilter() {
    try {
      const v = JSON.parse(localStorage.getItem(FILTER_KEY) || '[]');
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    } catch (e) {
      return new Set();
    }
  }
  function saveFilter() {
    try {
      if (picked.size) localStorage.setItem(FILTER_KEY, JSON.stringify([...picked]));
      else localStorage.removeItem(FILTER_KEY);
    } catch (e) { }
  }
  let picked = readFilter();
  let fq = null;

  const roving = (bar) => (B.roving ? B.roving(bar) : () => {});

  function filterBar(types) {
    fq = null;
    if (types.length < 2) return [];
    const chips = types.map(({ t, n }) => {
      const m = seriesMeta(t);
      const b = h('button', { type: 'button', class: 'fp-chip', 'data-type': t, 'data-group': m.group, 'aria-pressed': 'false' }, [
        h('span', { class: 'fp-chip-mk', html: CHECK }),
        h('span', { class: 'fp-chip-t' }, [m.short]),
        h('span', { class: 'fp-chip-n' }, [String(n), h('span', { class: 'visually-hidden' }, [' 則'])]),
      ]);
      b.addEventListener('click', () => {
        if (picked.has(t)) picked.delete(t);
        else picked.add(t);
        saveFilter();
        applyFilter(true);
      });
      return b;
    });
    const clear = h('button', { type: 'button', class: 'fp-fq-clear', 'aria-label': '清除篩選', hidden: true }, ['清除']);
    clear.addEventListener('click', () => {
      picked = new Set();
      saveFilter();
      applyFilter(true);
    });
    const bar = h('div', { class: 'fp-fq', role: 'toolbar', 'aria-label': '依系列篩選', focusgroup: 'toolbar wrap' }, [...chips, clear]);
    const status = h('p', { class: 'visually-hidden', role: 'status' });
    fq = { chips, clear, status, sync: roving(bar) };
    return [bar, status];
  }

  function applyFilter(announce) {
    const rows = [...app.querySelectorAll('.fp-tl .fp-it')];
    const on = new Set(fq ? fq.chips.map((b) => b.dataset.type).filter((t) => picked.has(t)) : []);
    if (fq) fq.chips.forEach((b) => b.setAttribute('aria-pressed', String(on.has(b.dataset.type))));
    let shown = 0;
    rows.forEach((r) => {
      const ok = !on.size || (r.dataset.fq || '').split(' ').some((t) => on.has(t));
      r.hidden = !ok;
      if (ok) shown += 1;
    });
    app.querySelectorAll('.fp-tl > .fp-sec').forEach((s) => { s.hidden = !s.querySelector('.fp-it:not([hidden])'); });
    if (fq) {
      const lost = fq.clear.contains(document.activeElement);
      fq.clear.hidden = !on.size;
      fq.sync();
      if (lost && fq.clear.hidden) fq.chips[0].focus();
      if (announce) fq.status.textContent = on.size ? `顯示 ${shown} 則` : `顯示全部 ${shown} 則`;
    }
    remember(period(), rows.filter((r) => !r.hidden && r.dataset.key).map((r) => r.dataset.key));
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== FILTER_KEY && e.key !== null) return;
    picked = readFilter();
    if (front && app.querySelector('.fp-tl')) applyFilter(false);
  });

  const footer = () => h('footer', { class: 'foot' }, [
    h('span', { class: 'foot-left' }, [weekMode ? '本週回顧從當週各週報、月報標出的重點整理，同一則新聞只列一次'
      : '本日焦點從當天各日報標出的重點整理，同一則新聞只列一次']),
  ]);

  function show(kids) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  function render() {
    const opened = new Set([...app.querySelectorAll('.fp-row')].filter((el) => el.querySelector('details[open]')).map((el) => el.id));
    const active = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-row');
    const focusId = active ? active.id : null;
    const onChip = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-fq button');
    const chipFocus = onChip ? onChip.dataset.type || '' : null;

    const list = (front.entries || []).filter((e) => e && e.key && Array.isArray(e.from) && e.from.length);
    const seen = readSeen();
    const firstLook = !!seen && !Array.isArray(seen[period()]);
    const fresh = freshKeys(period(), list.map((e) => e.key));
    const top = list.length ? Math.min(...list.map((e) => e.rank)) : 0;
    const timed = list.map((e) => ({ e, w: when(e.ts) }));
    timed.sort((a, b) => (a.w && b.w ? b.w.ms - a.w.ms : (a.w ? -1 : 0) + (b.w ? 1 : 0))
      || a.e.rank - b.e.rank || bySeries(a.e.from[0].series, b.e.from[0].series) || (a.e.key < b.e.key ? -1 : 1));
    const entryRow = (e, w) => tlRow(e, {
      id: `fp-${e.key}`,
      key: e.key,
      types: [...new Set(e.from.map((f) => f.series))].sort(bySeries),
      from: e.from,
      stamp: w ? h('time', { class: 'fp-tm', datetime: e.ts }, [w.hm]) : null,
      lead: e.rank === top,
      isNew: fresh.has(e.key),
    });
    const tl = [];
    const counts = new Map();
    let group = null;
    const addRow = (row) => {
      tl[tl.length - 1].append(row);
      row.dataset.fq.split(' ').filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    };
    const openSlot = (label, day) => tl.push(h('section', { class: 'fp-sec' }, [hourHead(label, day)]));
    timed.forEach(({ e, w }) => {
      const g = !w ? '-' : weekMode ? w.day : `${w.day} ${w.hour}`;
      if (g !== group) {
        group = g;
        if (!w) openSlot('其他時間');
        else if (weekMode) openSlot(dayLabel(w.day));
        else openSlot(`${w.hour}:00`, w.day !== front.date ? dayLabel(w.day) : null);
      }
      addRow(entryRow(e, w));
    });
    const types = [...counts.keys()].sort(bySeries).map((t) => ({ t, n: counts.get(t) }));
    const main = h('main', { id: 'main', class: 'fp-tl' }, tl.length ? tl : [h('p', { class: 'load-error' }, [weekMode ? '這週的回顧沒有條目。' : '這天的焦點沒有條目。'])]);
    if (standard() && A.look) A.look.arrangeFront(main);
    show([...masthead(types), main, footer()]);
    document.title = `${TITLE} ${weekMode ? B.periodLabel(front.week, 'weekly') : dayLabel(front.date)}｜AI Reports`;
    opened.forEach((id) => {
      const d = document.getElementById(id);
      if (d) d.querySelector('details').open = true;
    });
    if (firstLook) remember(period(), list.map((e) => e.key));
    applyFilter(false);
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && !el.hidden) el.querySelector('summary').focus({ preventScroll: true });
    }
    if (chipFocus != null && fq) {
      const b = chipFocus ? fq.chips.find((x) => x.dataset.type === chipFocus) : fq.clear;
      (b && !b.hidden ? b : fq.chips[0]).focus({ preventScroll: true });
    }
  }

  function noFront() {
    const items = (index && index.items) || [];
    const latest = [];
    items.forEach((e) => {
      if (e && e.series && e.period && (cadenceOf(e) === 'daily') !== weekMode
        && !latest.some((x) => x.series === e.series)) latest.push(e);
    });
    latest.sort((a, b) => bySeries(a.series, b.series));
    const kids = [
      B.toolbar([frontLink(weekMode ? null : 'page'), weeklyLink(weekMode ? 'page' : null), fpBox]),
      h('header', { class: 'masthead' }, [h('h1', { class: 'mast-title' }, [TITLE])]),
      h('main', { id: 'main', class: 'fp-empty' }, [
        h('p', { class: 'fp-empty-note', role: 'status' }, [latest.length ? `還沒有${TITLE}。先看各系列最新一期：` : `還沒有${TITLE}，也還沒有任何報告。`]),
        latest.length ? h('ul', { class: 'fp-empty-list' }, latest.map((e) => {
          const m = seriesMeta(e.series);
          return h('li', null, [h('a', { href: reportHref(e.series, e.period) }, [
            e.series_title || m.title,
            h('span', { class: 'fp-empty-when' }, [A.fmtShort(e.period, e.cadence || m.cadence)]),
          ])]);
        })) : null,
      ]),
      footer(),
    ];
    if (!index) kids.splice(3, 0, h('p', { class: 'load-error', role: 'alert' }, ['新聞清單也載入失敗，重新整理再試一次。']));
    show(kids);
    document.title = `${TITLE}｜AI Reports`;
  }

  function problem(text, more) {
    show([
      B.toolbar([frontLink(null), weeklyLink(null), fpBox]),
      h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text, more || null])]),
    ]);
    document.title = `${TITLE}｜AI Reports`;
  }

  const frontPath = (d) => `front/${d.slice(0, 4)}/${d}.json`;
  const validDates = (doc) => (doc && Array.isArray(doc[weekMode ? 'weeks' : 'dates']) ? doc[weekMode ? 'weeks' : 'dates'] : [])
    .map((x) => x && x[weekMode ? 'week' : 'date']).filter((d) => typeof d === 'string' && PERIOD_RE.test(d));
  const target = () => (want || dates[0] || null);

  async function main() {
    const [idx, list] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON('front/index.json'), A.facets ? A.facets.load() : null]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    dates = list.status === 'fulfilled' ? validDates(list.value) : [];
    if (!dates.length) {
      noFront();
      return;
    }
    const d = target();
    if (!PERIOD_RE.test(d) || !dates.includes(d)) {
      problem(`找不到 ${d} 的${TITLE}。`, h('a', { href: latestHref }, [`看最新${TITLE}`]));
      return;
    }
    try {
      front = await A.getJSON(frontPath(d));
    } catch (err) {
      problem(`這${weekMode ? '週' : '天'}的${TITLE}載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    if (!isFront(front, d)) {
      problem(`${d} 的${TITLE}內容不完整，重新整理再試一次。`);
      return;
    }
    render();
  }
  const isFront = (doc, d) => !!doc && typeof doc === 'object' && doc[weekMode ? 'week' : 'date'] === d;

  let ready = false;
  let refreshing = false;
  async function refresh() {
    if (!ready || refreshing || document.visibilityState !== 'visible') return;
    refreshing = true;
    let prev = null;
    try {
      const doc = await A.getJSON('front/index.json').catch(() => null);
      if (!doc) return;
      const next = validDates(doc);
      if (!next.length) return;
      const datesChanged = next.join() !== dates.join();
      const d = want || next[0];
      if (!next.includes(d)) return;
      const doc2 = await A.getJSON(frontPath(d)).catch(() => null);
      if (!isFront(doc2, d)) return;
      const changed = datesChanged || !front || doc2.date !== front.date || doc2.week !== front.week || doc2.built_at !== front.built_at;
      prev = [dates, front];
      dates = next;
      front = doc2;
      if (changed) render();
    } catch (err) {
      if (prev) [dates, front] = prev;
      console.error('頭版更新失敗', err);
    } finally {
      refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });

  function setLook(v) {
    const was = standard();
    look = v;
    try { localStorage.setItem(KEY_LOOK, v); } catch (e) { }
    const swap = () => {
      const focused = document.activeElement;
      applyLook();
      if (front && standard() !== was) render();
      if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
    };
    if (document.startViewTransition) document.startViewTransition(swap);
    else swap();
  }
  function layoutPanel() {
    const groups = [
      ['外觀', LOOKS, () => look, setLook],
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
      const el = h('div', { class: 'vw-group', role: 'group', 'aria-labelledby': `fp-label-${gi}` }, [
        h('span', { class: 'vw-label', id: `fp-label-${gi}` }, [label]),
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
    fpBox = B.dropdown({
      cls: 'vw', id: 'fp-panel', title: '版面設定', closeLabel: '關閉版面設定',
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', { class: 'dd-txt' }, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]') || panel.querySelector('.vw-seg button'),
    });
  }

  layoutPanel();
  main()
    .catch((err) => {
      console.error('頭版載入失敗', err);
      const msg = `${TITLE}顯示失敗，重新整理再試一次。`;
      try { problem(msg); } catch (e) { app.textContent = msg; }
    })
    .finally(() => { ready = true; });
})();
