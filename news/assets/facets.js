/* 條目的分類標籤（facets）：每則新聞展開後最後面一個預設收合的小區塊（使用者要求：預設收合、淡化、不刻意引人注意）。
   報告頁（report.js，三種讀法）與頭版（front.js）共用；index.html 在 bar.js 之後、report.js／front.js 之前載入（defer），
   掛在 window.AIR.facets。部署後的快取空窗拿到舊 index.html（沒載入這支）時 A.facets 不在：呼叫端照常畫、只是少這一塊。
   1. 面向的順序與中文名稱：同 news-aggregator 的 facets.py（DIMENSIONS），唯一出處在那邊，這裡照抄
   2. 議題對照表 stories.json：改名合併（alias）顯示新名稱、退役（retire）不顯示、子議題帶出上層（parent）；
      已發布的報告不改，讀取時才套用。讀不到就照原樣顯示
   3. 去掉頁面上已經有的資訊（使用者要求：任何地方都不重複）：系列名稱、來源媒體、標籤（含熱門徽章）、標題裡已有的國家、機構、人物與關鍵詞、
      台灣關聯「無」；同一個值在前面的面向出現過就不再列
   4. parts()：開關（小字「分類」＋小箭頭）與清單（「面向　值、值」，使用者在三種試作中選定 A 小字清單）分開回傳，
      開關由呼叫端接在條目最後那一列（另參、來源標籤、看原文）的尾巴，清單放在那一列下方 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;

  // ── 1. 面向 ──────────────────────────────────────────────────────────
  const DIMS = [
    ['region', '地區'], ['country', '國家'], ['taiwan', '台灣關聯'], ['topic', '主題'], ['event', '事件類型'], ['story', '議題'],
    ['sector', '產業'], ['org', '機構'], ['person', '人物'], ['affects', '影響'], ['importance', '重要度'], ['tone', '調性'],
    ['stage', '進展'], ['keyword', '關鍵詞'],
  ];
  // 國家是 ISO 代碼（TR、AU）：用瀏覽器內建的中文國名，不支援或不認得就照原樣
  let regionName = null;
  try { regionName = new Intl.DisplayNames(['zh-Hant-TW', 'zh-TW'], { type: 'region' }); } catch (e) { /* 舊瀏覽器 */ }
  const country = (code) => {
    if (!regionName || !/^[A-Z]{2}$/.test(code)) return code;
    try { return regionName.of(code) || code; } catch (e) { return code; }
  };

  // ── 2. 議題對照表 ────────────────────────────────────────────────────
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
      }).catch(() => { /* 沒有對照表或讀不到：議題照原樣顯示 */ });
    }
    return loading;
  }
  // 改名一路追到最後的名稱（防循環最多 10 層）；退役的回 null
  function canonical(name) {
    let n = name;
    for (let i = 0; i < 10 && rules.alias.has(n); i++) n = rules.alias.get(n);
    return rules.retire.has(n) || rules.retire.has(name) ? null : n;
  }
  // 議題清單 → 顯示用的字串：子議題寫成「上層 › 子議題」，上層另外單獨列著的就不再重複
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

  // ── 3. 去重 ──────────────────────────────────────────────────────────
  // ctx：{ title：標題純文字（國名比對用顯示名稱）, types：頁面上看得到的系列名稱, src：來源字串, tags：標籤文字（含熱門徽章） }
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
  const IN_TITLE = new Set(['country', 'org', 'person', 'keyword']); // 專有名詞：標題已經寫了就不列
  const TAG_HIDES = { 持續: ['stage'], 中性: ['tone'], 利多: ['tone'], 利空: ['tone'] }; // 標籤已經說了同一件事
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
        if (key === 'org' && src && src.includes(n)) return false; // 來源媒體已經寫在標題下或另參
        if (IN_TITLE.has(key) && title.includes(n)) return false; // 標題裡就寫了
        seen.add(n);
        return true;
      });
      if (vals.length) out.push({ key, label, vals });
    });
    return out;
  }

  // ── 4. 元件 ──────────────────────────────────────────────────────────
  // 開關和清單分開放（使用者要求：不另建一行——條目最後有另參、來源標籤或「看原文」那一列時，開關接在那一列最後面），
  // 所以不用 <details>：開關是帶 aria-expanded／aria-controls 的 <button>，清單是它控制的區塊、放在那一列下方。
  // 清單用 hidden="until-found"：收合時「在頁面中尋找」照樣找得到，找到時自動展開（beforematch，不支援的瀏覽器就是一般的 hidden）。
  // 開關的可點範圍在觸控螢幕上由透明 ::before 往外補到 44px（CSS）。
  // 清單是 <dl>：面向名稱 <dt>、值 <dd>（每個值一個 span，頓號由 CSS 補）。回傳 { toggle, panel }，沒有可列的值回 null
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
  // 沒有可以併入的那一列時：開關自己一行
  const bar = (toggle) => h('div', { class: 'fct-bar' }, [toggle]);

  A.facets = { DIMS, load, rows, parts, bar, canonical, stories };
})();
