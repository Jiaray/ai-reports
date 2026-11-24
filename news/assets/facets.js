/* 條目分類標籤（facets）：report.js、front.js 共用，掛 window.AIR.facets。分段：1 面向 2 議題對照表 3 去重 4 元件 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;

  // ── 1. 面向 ──
  // 照抄 news-aggregator facets.py 的 DIMENSIONS（順序、中文名）；那邊改這邊跟著改
  const DIMS = [
    ['region', '地區'], ['country', '國家'], ['taiwan', '台灣關聯'], ['topic', '主題'], ['event', '事件類型'], ['story', '議題'],
    ['sector', '產業'], ['org', '機構'], ['person', '人物'], ['affects', '影響'], ['importance', '重要度'], ['tone', '調性'],
    ['stage', '進展'], ['keyword', '關鍵詞'],
  ];
  // 國家是 ISO 代碼 → Intl 中文國名；不支援或不認得照原樣
  let regionName = null;
  try { regionName = new Intl.DisplayNames(['zh-Hant-TW', 'zh-TW'], { type: 'region' }); } catch (e) { /* 舊瀏覽器 */ }
  const country = (code) => {
    if (!regionName || !/^[A-Z]{2}$/.test(code)) return code;
    try { return regionName.of(code) || code; } catch (e) { return code; }
  };

  // ── 2. 議題對照表 ──
  let rules = { alias: new Map(), parent: new Map(), retire: new Set() };
  let loading = null;
  function load() {
    if (!loading) {
      loading = A.getJSON('stories.json').then((doc) => {
        const next = { alias: new Map(), parent: new Map(), retire: new Set() };
        const ups = [];
        ((doc && Array.isArray(doc.rules)) ? doc.rules : []).forEach((r) => {
          if (!r || typeof r.from !== 'string' || !r.from) return;
          if (r.type === 'alias' && typeof r.to === 'string' && r.to) next.alias.set(r.from, r.to);
          else if (r.type === 'parent' && typeof r.to === 'string' && r.to) ups.push([r.from, r.to]);
          else if (r.type === 'retire') next.retire.add(r.from);
        });
        rules = next;
        // parent 兩邊換成改名合併後的名稱（同 facets.py story_rules）：子議題改名後仍掛在原上層；同名先核准的優先
        ups.forEach(([from, to]) => {
          const c = canonical(from);
          const p = canonical(to);
          if (c && p && c !== p && !next.parent.has(c)) next.parent.set(c, p);
        });
      }).catch(() => { /* 讀不到：議題照原樣顯示 */ });
    }
    return loading;
  }
  // alias 追到最後的名稱（最多 10 層防循環）；最後的名稱退役（retire）才回 null，原名退役後又改名的照新名稱（同 facets.py canonical_story）
  function canonical(name) {
    let n = name;
    for (let i = 0; i < 10 && rules.alias.has(n); i++) n = rules.alias.get(n);
    return rules.retire.has(n) ? null : n;
  }
  // 子議題寫成「上層 › 子議題」（parent）；上層已出現在別條路徑就不單獨列
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

  // ── 3. 去重 ──
  // ctx：{ title：標題純文字（國名用顯示名比對）, types：頁面上的系列名, src：來源字串, tags：標籤文字（含熱門徽章） }
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
  const IN_TITLE = new Set(['country', 'org', 'person', 'keyword']); // 標題已寫就不列
  const TAG_HIDES = { 持續: ['stage'], 中性: ['tone'], 利多: ['tone'], 利空: ['tone'] }; // 標籤已說同一件事
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
        if (key === 'org' && src && src.includes(n)) return false; // 來源媒體已顯示
        if (IN_TITLE.has(key) && title.includes(n)) return false;
        seen.add(n);
        return true;
      });
      if (vals.length) out.push({ key, label, vals });
    });
    return out;
  }

  // ── 4. 元件 ──
  // parts() → { toggle, panel }，沒有可列的值回 null（report.js、front.js 依賴）。
  // 呼叫端把開關接在條目最後一列（另參、來源標籤、看原文）尾、清單放該列下方 → 兩者分開，不用 <details>。
  // 清單 hidden="until-found"：頁內尋找照樣找得到、找到自動展開（beforematch；不支援＝一般 hidden）。.fct-v 間的頓號由 CSS 補
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
  // 沒有可併入的那一列時，開關自成一行
  const bar = (toggle) => h('div', { class: 'fct-bar' }, [toggle]);

  A.facets = { DIMS, load, rows, parts, bar, canonical, stories };
})();
