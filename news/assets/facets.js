(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;

  const DIMS = [
    ['region', '地區'], ['country', '國家'], ['taiwan', '台灣關聯'], ['topic', '主題'], ['event', '事件類型'], ['story', '議題'],
    ['sector', '產業'], ['org', '機構'], ['person', '人物'], ['affects', '影響'], ['importance', '重要度'], ['tone', '調性'],
    ['stage', '進展'], ['keyword', '關鍵詞'],
  ];
  let regionName = null;
  try { regionName = new Intl.DisplayNames(['zh-Hant-TW', 'zh-TW'], { type: 'region' }); } catch (e) { }
  const country = (code) => {
    if (!regionName || !/^[A-Z]{2}$/.test(code)) return code;
    try { return regionName.of(code) || code; } catch (e) { return code; }
  };

  let rules = { alias: new Map(), parent: new Map(), retire: new Set() };
  let loading = null;
  function load() {
    if (!loading) {
      loading = A.getJSON('stories.json').then((doc) => {
        const next = { alias: new Map(), parent: new Map(), retire: new Set() };
        ((doc && Array.isArray(doc.rules)) ? doc.rules : []).forEach((r) => {
          if (!r || typeof r.from !== 'string' || !r.from) return;
          if (r.type === 'alias' && typeof r.to === 'string' && r.to) next.alias.set(r.from, r.to);
          else if (r.type === 'parent' && typeof r.to === 'string' && r.to) next.parent.set(r.from, r.to);
          else if (r.type === 'retire') next.retire.add(r.from);
        });
        rules = next;
      }).catch(() => { });
    }
    return loading;
  }
  function canonical(name) {
    let n = name;
    for (let i = 0; i < 10 && rules.alias.has(n); i++) n = rules.alias.get(n);
    return rules.retire.has(n) || rules.retire.has(name) ? null : n;
  }
  function stories(list) {
    const names = [...new Set(list.map(canonical).filter(Boolean))];
    const chain = (n) => {
      const path = [n];
      for (let i = 0; i < 5; i++) {
        const p = rules.parent.get(path[0]);
        const up = p && canonical(p);
        if (!up || path.includes(up)) break;
        path.unshift(up);
      }
      return path;
    };
    const paths = names.map(chain);
    const covered = new Set(paths.flatMap((p) => p.slice(0, -1)));
    return paths.filter((p) => !(p.length === 1 && covered.has(p[0]))).map((p) => p.join(' › '));
  }

  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
  const IN_TITLE = new Set(['country', 'org', 'person', 'keyword']);
  const TAG_HIDES = { 持續: ['stage'], 中性: ['tone'], 利多: ['tone'], 利空: ['tone'] };
  function rows(facets, ctx = {}) {
    if (!facets || typeof facets !== 'object') return [];
    const title = norm(ctx.title || '');
    const src = norm(ctx.src || '');
    const tags = (ctx.tags || []).map(norm);
    const hideDims = new Set((ctx.tags || []).flatMap((t) => TAG_HIDES[t] || []));
    const seen = new Set([...(ctx.types || []), ...(ctx.tags || [])].map(norm));
    const out = [];
    DIMS.forEach(([key, label]) => {
      const raw = Array.isArray(facets[key]) ? facets[key].filter((v) => typeof v === 'string' && v.trim()) : [];
      if (!raw.length || hideDims.has(key)) return;
      let vals = key === 'story' ? stories(raw) : key === 'country' ? raw.map(country) : raw;
      vals = vals.filter((v) => {
        const n = norm(v);
        if (seen.has(n) || tags.includes(n)) return false;
        if (key === 'taiwan' && v === '無') return false;
        if (key === 'org' && src && src.includes(n)) return false;
        if (IN_TITLE.has(key) && title.includes(n)) return false;
        seen.add(n);
        return true;
      });
      if (vals.length) out.push({ key, label, vals });
    });
    return out;
  }

  let uid = 0;
  function parts(facets, ctx) {
    const list = rows(facets, ctx);
    if (!list.length) return null;
    const id = `fct-${++uid}`;
    const toggle = h('button', { type: 'button', class: 'fct-tg', 'aria-expanded': 'false', 'aria-controls': id }, ['分類']);
    const panel = h('div', { class: 'fct-panel', id, role: 'region', 'aria-label': '分類' }, [
      h('dl', { class: 'fct-list' }, list.map((r) => h('div', { class: 'fct-row', 'data-dim': r.key }, [
        h('dt', null, [r.label]),
        h('dd', null, r.vals.map((v) => h('span', { class: 'fct-v' }, [v]))),
      ]))),
    ]);
    panel.setAttribute('hidden', 'until-found');
    const set = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      if (open) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', 'until-found');
    };
    toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
    panel.addEventListener('beforematch', () => set(true));
    return { toggle, panel };
  }
  const bar = (toggle) => h('div', { class: 'fct-bar' }, [toggle]);

  A.facets = { DIMS, load, rows, parts, bar, canonical, stories };
})();
