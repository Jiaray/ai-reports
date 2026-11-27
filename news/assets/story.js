/* 議題頁與議題目錄（news/story.html；樣式摘要第 8、9 節）。讀 cards/story-index.json（名稱已套 stories.json）。
   - #<議題名（encodeURIComponent）>＝議題頁：改名、合併過的舊名稱照 stories.json 落到新名稱（網址換成新名稱，不多一筆歷史）。
     報頭：上層「X ›」、議題名、狀態・N 張・M/D 起（沉寂、歸檔加多久沒有新卡）、子議題（兩張以上的才列）、「跳到最新 ↓」。
     時間軸舊到新（事件時間），每張是 rows.js 的列表列（上方小字 M/D（週）HH:MM・N 家，不列系列名）；相隔 7 天以上插「⋯ N 天沒有新卡」；
     上層議題頁也收子議題的卡（story-index 已列進上層），標子議題名。各卡的輕量條目依編號讀週索引（每份只讀一次）。
   - 不帶 hash＝議題目錄：進行中、沉寂、歸檔三區（story-index 的 status），各區依最新一張卡新到舊；只有一張卡的議題不列；
     子議題縮排在上層底下（不論自己的狀態）；歸檔依月份收進 <details>。系列篩選標籤同本日焦點（front.js filterBar 的 .fp-fq 標記、
     front.css 樣式，bar.js 功能鈕的過濾面板也認得），選擇存 air-story-types（不跟本日焦點共用）。
   hashchange 重畫。依賴 A.bar、A.rows；A.facets（舊名稱、分類）、A.look 選用。
   樣式在 story.css（.st／.st-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const R = A.rows;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const GAP_DAYS = 7; // 相鄰兩張相隔幾天以上插間隔標記
  const ZONES = [['active', '進行中', ''], ['quiet', '沉寂', '7–90 天沒有新卡'], ['archived', '歸檔', '90 天以上沒有新卡']];
  const STATUS = new Map(ZONES.map(([k, name]) => [k, name]));
  const SILENT = new Map([['quiet', '7 天沒有新卡'], ['archived', '90 天以上沒有新卡']]);
  const FILTER_KEY = 'air-story-types'; // 議題目錄選中的系列代號（不跟本日焦點的 air-front-types 共用）
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const valid = (iso) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

  // ── 外觀：新聞各頁共用（air-news-look）；沒有 A.look 就不列「一般」。列表列借用標題讀法的樣式（同頭版）──
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  let look = LOOKS[0][0];
  try {
    const v = localStorage.getItem(KEY_LOOK);
    if (LOOKS.some((x) => x[0] === v)) look = v;
  } catch (e) { /* 讀不到：用預設 */ }
  root.setAttribute('data-look', look);
  root.setAttribute('data-read', 'scan');
  app.classList.add('st');

  // 壞掉的百分比編碼 → 照原樣
  function hashText() {
    const raw = location.hash.slice(1);
    try { return decodeURIComponent(raw).trim(); } catch (e) { return raw.trim(); }
  }
  const storyHref = (name) => `story.html#${encodeURIComponent(name)}`;

  // ── 資料：index.json（系列短名、領域）、story-index（抓不到或不是物件就丟出，畫成載入失敗）、週索引（每份只抓一次，失敗不留）──
  const indexDoc = A.getJSON('index.json').catch(() => null);
  let index = null;
  let storyDoc = null;
  async function storyIndex() {
    if (storyDoc) return storyDoc;
    const v = await A.getJSON('cards/story-index.json');
    if (!v || typeof v !== 'object') throw new SyntaxError('story-index.json 不是物件');
    storyDoc = v;
    return storyDoc;
  }
  const weeks = new Map();
  function week(path) {
    if (!weeks.has(path)) {
      weeks.set(path, A.getJSON(path).catch(() => {
        weeks.delete(path);
        return null;
      }));
    }
    return weeks.get(path);
  }
  // 議題清單：名稱不重複（先出現的算）
  function storyList(doc) {
    const seen = new Set();
    return list(doc && doc.stories).filter((s) => {
      if (!s || typeof s !== 'object' || !str(s.name).trim() || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }
  const countOf = (s) => (Number.isInteger(s.count) ? s.count : list(s.cards).length);
  // 最新一張卡的事件時間；目錄排序與「最新 M/D」都用它
  const latestAt = (s) => str(s.latest && s.latest.event_at);
  const msOf = (iso) => (valid(iso) ? Date.parse(iso) : -Infinity);
  const newestFirst = (a, b) => msOf(latestAt(b)) - msOf(latestAt(a)) || (a.name < b.name ? -1 : 1);

  // ── 系列 ──
  const seriesInfo = (id) => list(index && index.series).find((s) => s && s.id === id) || {};
  function meta(id) {
    const s = seriesInfo(id);
    return { short: str(s.short) || str(s.title) || id, group: str(s.group) };
  }
  const seriesRank = (id) => {
    const order = list(index && index.series).map((s) => s && s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  };

  // ── 時間：M/D（不是今年加年份）──
  function md(iso) {
    const k = R.dayOf(iso);
    if (!k) return '';
    return `${k.slice(0, 4) === R.today().slice(0, 4) ? '' : `${k.slice(0, 4)}/`}${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
  }
  const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

  // ── 報頭工具列（bar.js；樣式摘要 5.1）：新聞首頁（連本日焦點）　右邊一組：系列｜議題｜版面。「議題」在議題目錄 aria-current=page、議題頁 true ──
  let srBox; // undefined＝還沒建
  let vwBox = null;
  const toolbar = (current) => B.toolbar([
    B.navLink('新聞首頁', 'front', './', null),
    srBox,
    B.storyLink(current),
    vwBox,
  ]);

  function layoutPanel() {
    const setLook = (v) => {
      look = v;
      try { localStorage.setItem(KEY_LOOK, v); } catch (e) { /* 存不了：只套用本頁 */ }
      const swap = () => root.setAttribute('data-look', v);
      if (!document.startViewTransition) return swap();
      document.startViewTransition(swap).ready.catch(() => {}); // 快速連切被跳過時不報錯
      return null;
    };
    const groups = [
      ['外觀', LOOKS, () => look, setLook],
      ['配色', A.THEMES, A.getTheme, A.setTheme, A.themeLabel],
    ].map(([label, opts, get, set, labelOf], gi) => {
      const buttons = opts.map(([value, text]) => {
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
    // id 用 vw-panel：bar.js 手機功能鈕認得它
    vwBox = B.dropdown({
      cls: 'vw', id: 'vw-panel', title: '版面設定', closeLabel: '關閉版面設定',
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', null, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]'),
    });
  }

  const back = () => h('p', { class: 'st-back' }, [
    h('a', { href: 'story.html' }, ['看議題目錄']), h('a', { href: './' }, ['回本日焦點']),
  ]);
  // 報頭：above 在大標題上方（上層議題），below 在下方；h1 讓換頁時焦點有地方落
  const head = (title, above = null, below = []) => h('header', { class: 'masthead st-head' }, [
    above, h('h1', { class: 'mast-title st-title', tabindex: '-1' }, [title]), ...below,
  ]);

  // ════ 議題頁 ════
  // 那條路徑 [上層…, 這個議題]（索引的 parent 鏈；最多 6 層防循環）
  function pathOf(s, byName) {
    const path = [s.name];
    let p = str(s.parent);
    for (let i = 0; p && i < 6 && !path.includes(p); i++) {
      path.unshift(p);
      p = str((byName.get(p) || {}).parent);
    }
    return path;
  }
  // 這個議題的卡（輕量條目），依事件時間舊到新；讀不到、標重複的不列
  async function entries(ids) {
    const uniq = [...new Set(list(ids).filter((id) => R.cardPath(id)))];
    const paths = [...new Set(uniq.map((id) => R.cardPath(id).replace(/\d{4}\.json$/, 'index.json')))];
    const found = new Map();
    (await Promise.all(paths.map(week))).forEach((d) => list(d && d.cards).forEach((e) => {
      if (e && typeof e.id === 'string') found.set(e.id, e);
    }));
    const got = uniq.map((id) => found.get(id)).filter((e) => e && str(e.title) && !e.dup_of && valid(R.eventAt(e)));
    got.sort((a, b) => msOf(R.eventAt(a)) - msOf(R.eventAt(b)) || (a.id < b.id ? -1 : 1));
    return { got, asked: uniq.length };
  }
  // 時間軸：每張一個 rows.js 列表列（加 .st-row：不用領域色線，改方點），相隔 GAP_DAYS 天以上插間隔標記；最新一張 #st-latest。
  // labels：編號 → 子議題名（上層議題頁）；known：頁面已寫的議題路徑（展開後分類不重列）
  function timeline(items, labels, known) {
    const kids = [];
    let prev = '';
    items.forEach((e) => {
      const ev = R.eventAt(e);
      const day = R.dayOf(ev);
      const gap = prev ? dayDiff(prev, day) : 0;
      if (gap >= GAP_DAYS) kids.push(h('li', { class: 'st-gap' }, [`⋯ ${gap} 天沒有新卡`]));
      prev = day;
      const el = R.row(e, { meta, series: false, time: R.time(ev, R.mdw(ev)), tag: 'li', known });
      if (!el) return;
      el.classList.add('st-row');
      const names = labels.get(e.id);
      const t = names && el.querySelector('.rw-tm');
      if (t) t.after(...names.map((n) => h('span', { class: 'st-kid' }, [h('span', { class: 'visually-hidden' }, ['子議題 ']), n])));
      kids.push(el);
    });
    const rows = kids.filter((k) => k.classList.contains('st-row'));
    const last = rows[rows.length - 1];
    if (last) {
      last.classList.add('is-latest');
      last.id = 'st-latest';
    }
    return h('ol', { class: 'st-tl', role: 'list', 'aria-label': '時間軸（舊到新）' }, kids);
  }
  // 「跳到最新 ↓」：網址的 # 是議題名，用按鈕捲動、焦點移到最新一張的標題列（不用 #錨點）；捲完才移焦點
  function jump() {
    const b = h('button', { type: 'button', class: 'st-jump' }, ['跳到最新', h('span', { 'aria-hidden': 'true' }, [' ↓'])]);
    b.addEventListener('click', async () => {
      const el = document.getElementById('st-latest');
      if (!el) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      await el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      (el.querySelector('summary') || el).focus({ preventScroll: true });
    });
    return b;
  }

  async function storyPage(raw) {
    const [doc] = await Promise.all([storyIndex(), A.facets ? A.facets.load() : null]);
    const all = storyList(doc);
    const byName = new Map(all.map((s) => [s.name, s]));
    // 改名、合併過的舊名稱 → 新名稱；新名稱不在索引（索引還沒重建）就照原名找
    const canon = A.facets ? A.facets.canonical(raw) : raw;
    const name = canon && byName.has(canon) ? canon : raw;
    const s = byName.get(name);
    if (!s) {
      return {
        title: '找不到這個議題',
        kids: [head('找不到這個議題'), h('main', { id: 'main', class: 'st-main' }, [
          h('p', { class: 'st-miss' }, [raw ? `議題〈${raw}〉沒有對應的新聞卡；可能已改名、合併，或還沒有新聞卡。` : '網址裡的議題名不完整。']),
          back(),
        ])],
      };
    }
    const path = pathOf(s, byName);
    const up = path.length > 1 && byName.has(path[path.length - 2]) ? path[path.length - 2] : '';
    const children = all.filter((k) => k.parent === s.name && k.name !== s.name).sort(newestFirst);
    // 上層議題頁：子議題的卡標子議題名（只有一張卡的子議題也標；子議題清單只列兩張以上的）
    const labels = new Map();
    children.forEach((k) => list(k.cards).forEach((id) => labels.set(id, [...(labels.get(id) || []), k.name])));
    const { got, asked } = await entries(s.cards);
    const known = [path.join(' › '), ...children.map((k) => [...path, k.name].join(' › '))];
    const st = STATUS.get(s.status);
    const first = got.length ? R.eventAt(got[0]) : str(s.first);
    const withKids = got.some((e) => labels.has(e.id));
    const sub = [`${got.length} 張${withKids ? '（含子議題）' : ''}`, md(first) ? `${md(first)} 起` : '', SILENT.get(s.status) || ''].filter(Boolean).join('・');
    const kidsShown = children.filter((k) => countOf(k) >= 2);
    const kidsBox = kidsShown.length ? h('div', { class: 'st-kids' }, [
      h('span', { class: 'st-kids-lab', id: 'st-kids-lab' }, ['子議題']),
      h('ul', { class: 'st-kids-list', 'aria-labelledby': 'st-kids-lab' }, kidsShown.map((k) => h('li', null, [
        h('a', { class: 'st-kid-a', href: storyHref(k.name) }, [k.name, h('span', { class: 'st-kid-n' }, [`（${countOf(k)}）`])]),
      ]))),
    ]) : null;
    const crumb = up ? h('p', { class: 'st-crumb' }, [
      h('span', { class: 'visually-hidden' }, ['上層議題：']), h('a', { href: storyHref(up) }, [up]), h('span', { 'aria-hidden': 'true' }, [' ›']),
    ]) : null;
    const main = got.length
      ? [timeline(got, labels, known)]
      : [h('p', { class: 'load-error', role: 'alert' }, [asked ? '這個議題的新聞卡載入失敗，重新整理再試一次。' : '這個議題目前沒有新聞卡。'])];
    return {
      title: s.name,
      rename: name !== raw ? name : '', // 舊名稱：畫的時候把網址換成新名稱（load 確認還是最新的請求才換）
      kids: [
        head(s.name, crumb, [
          h('p', { class: 'st-sub' }, [st ? h('span', { class: `st-tag is-${s.status}` }, [st]) : null, h('span', null, [sub])]),
          kidsBox,
          got.length > 1 ? jump() : null,
        ]),
        h('main', { id: 'main', class: 'st-main' }, main),
        // 記號說明（rows.js；時間軸不用領域色線、上方小字不列系列）
        got.length ? R.legend({ line: false, after: '時間、報導家數' }) : null,
      ],
    };
  }

  // ════ 議題目錄 ════
  // ── 系列篩選（同 front.js filterBar 的標記：bar.js 功能鈕的過濾面板照抄 .fp-chip 的 data-type、data-group、.fp-chip-t、.fp-chip-n、
  //    aria-pressed，並代按 .fp-fq-clear；改一邊要改兩邊）。都沒選＝全部；議題有任一張卡屬於選到的系列就留下（索引的 series 是所有卡的聯集）──
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
    } catch (e) { /* 存不了：這次照篩，下次不記得 */ }
  }
  let picked = readFilter(); // 含目錄裡沒有的系列；存不進 localStorage 時仍有效
  let fq = null; // { chips, clear, status, sync }；沒有標籤列＝null

  // types：[{ t: 系列代號, n: 議題數 }]，已排序；系列少於兩個不放
  function filterBar(types) {
    fq = null;
    if (types.length < 2) return null;
    const chips = types.map(({ t: id, n }) => {
      const m = meta(id);
      const b = h('button', { type: 'button', class: 'fp-chip', 'data-type': id, 'data-group': m.group || null, 'aria-pressed': 'false' }, [
        h('span', { class: 'fp-chip-mk', html: CHECK }),
        h('span', { class: 'fp-chip-t' }, [m.short]),
        h('span', { class: 'fp-chip-n' }, [String(n), h('span', { class: 'visually-hidden' }, [' 個'])]),
      ]);
      b.addEventListener('click', () => {
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
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
    fq = { chips, clear, status, sync: B.roving(bar) };
    return h('div', { class: 'st-fq' }, [bar, status]);
  }

  // 套篩選：每個議題列各自比對（子議題列在上層 <li> 裡，上層藏了它也跟著藏）；區、月份的個數改成看得到的數，沒有就整塊藏。
  // announce＝剛按了標籤 → status 唸結果
  function applyFilter(announce) {
    const main = app.querySelector('#main');
    if (!main) return;
    const on = new Set(fq ? fq.chips.map((b) => b.dataset.type).filter((x) => picked.has(x)) : []);
    if (fq) fq.chips.forEach((b) => b.setAttribute('aria-pressed', String(on.has(b.dataset.type))));
    main.querySelectorAll('.st-st').forEach((r) => {
      r.hidden = Boolean(on.size) && !(r.dataset.fq || '').split(' ').some((x) => on.has(x));
    });
    const seen = (box) => [...box.querySelectorAll('.st-st')].filter((r) => !r.closest('.st-st[hidden]')).length;
    main.querySelectorAll('.st-month').forEach((m) => {
      const n = seen(m);
      m.hidden = !n;
      m.querySelector('.st-mn').textContent = `${n} 個`;
    });
    let shown = 0;
    main.querySelectorAll('.st-zone').forEach((z) => {
      const n = seen(z);
      shown += n;
      z.hidden = !n;
      z.querySelector('.st-zn').textContent = `${n} 個`;
    });
    if (fq) {
      const lost = fq.clear.contains(document.activeElement);
      fq.clear.hidden = !on.size;
      fq.sync();
      if (lost && fq.clear.hidden) fq.chips[0].focus(); // 「清除」藏起 → 焦點移到第一個標籤，不掉回頁首
      if (announce) fq.status.textContent = on.size ? `顯示 ${shown} 個議題` : `顯示全部 ${shown} 個議題`;
    }
  }
  // 別的分頁改了篩選 → 跟著套（不唸）
  window.addEventListener('storage', (e) => {
    if (e.key !== FILTER_KEY && e.key !== null) return;
    picked = readFilter();
    if (app.querySelector('#main .st-st')) applyFilter(false);
  });

  // 一個議題一列：名稱（連議題頁）・N 張・最新 M/D；進行中區的上層議題第二行灰字是最新一張的標題；
  // 子議題自己的狀態跟所在區不同時加狀態。子議題（目錄裡有的）接在下面一層。seen：畫過的（防上層鏈繞圈）
  function storyItem(s, ctx, depth) {
    ctx.seen.add(s.name);
    const kids = depth < 3 ? ctx.kidsOf(s.name).filter((k) => !ctx.seen.has(k.name)) : [];
    const late = latestAt(s);
    const status = depth && s.status !== ctx.zone ? STATUS.get(s.status) : '';
    const info = [`${countOf(s)} 張`, md(late) ? `最新 ${md(late)}` : '', status || ''].filter(Boolean).join('・');
    const two = ctx.zone === 'active' && !depth && s.latest && str(s.latest.title);
    const hit = h('div', { class: 'st-hit' }, [
      h('a', { class: 'st-nm', href: storyHref(s.name) }, [s.name]),
      h('span', { class: 'st-meta' }, [info]),
      two ? h('span', { class: 'st-last' }, [s.latest.title]) : null,
    ]);
    const sub = kids.map((k) => storyItem(k, ctx, depth + 1));
    return h('li', { class: `st-st${depth ? ' is-kid' : ''}`, 'data-fq': list(s.series).filter((x) => typeof x === 'string').join(' ') }, [
      hit, sub.length ? h('ul', { class: 'st-list', role: 'list' }, sub) : null,
    ]);
  }
  const rowsIn = (el) => el.querySelectorAll('.st-st').length + (el.matches('.st-st') ? 1 : 0);

  function directory(doc) {
    const listed = storyList(doc).filter((s) => countOf(s) >= 2);
    const byName = new Map(listed.map((s) => [s.name, s]));
    const kidsOf = (name) => listed.filter((k) => k.parent === name && k.name !== name).sort(newestFirst);
    const zoneOf = (s) => (STATUS.has(s.status) ? s.status : 'active');
    const seen = new Set();
    // 頂層：上層不在目錄裡的；畫完還沒畫到的（上層鏈繞圈、太深）補成頂層。done：[{ s, li }]，各區依最新一張卡新到舊
    const tops = listed.filter((s) => !byName.has(str(s.parent)) || s.parent === s.name).sort(newestFirst);
    const draw = (s) => ({ s, li: storyItem(s, { zone: zoneOf(s), seen, kidsOf }, 0) });
    const done = tops.map(draw);
    listed.filter((s) => !seen.has(s.name)).sort(newestFirst).forEach((s) => { if (!seen.has(s.name)) done.push(draw(s)); });

    const zones = ZONES.map(([k, name, note]) => {
      const mine = done.filter((x) => zoneOf(x.s) === k);
      if (!mine.length) return null;
      const lis = mine.map((x) => x.li);
      const n = lis.reduce((t, li) => t + rowsIn(li), 0);
      const id = `st-z-${k}`;
      let body;
      if (k === 'archived') {
        // 依最新一張卡的月份分組，預設收合（<details>：頁內尋找找得到收合的內容）
        const months = new Map();
        mine.forEach(({ s, li }) => {
          const key = (R.dayOf(latestAt(s)) || '0000-00').slice(0, 7);
          months.set(key, [...(months.get(key) || []), li]);
        });
        body = [...months.keys()].sort().reverse().map((key) => {
          const group = months.get(key);
          const label = key === '0000-00' ? '時間不明' : `${+key.slice(0, 4)} 年 ${+key.slice(5, 7)} 月`;
          return h('details', { class: 'st-month' }, [
            h('summary', { class: 'st-month-s' }, [
              h('span', { class: 'st-month-t' }, [label]), h('span', { class: 'st-n st-mn' }, [`${group.reduce((t, li) => t + rowsIn(li), 0)} 個`]),
            ]),
            h('ul', { class: 'st-list', role: 'list' }, group),
          ]);
        });
      } else {
        body = [h('ul', { class: `st-list${k === 'active' ? '' : ' is-compact'}`, role: 'list', 'aria-labelledby': id }, lis)];
      }
      return h('section', { class: `st-zone is-${k}`, 'aria-labelledby': id }, [
        h('h2', { class: 'st-zh', id }, [
          h('span', { class: 'st-zh-t' }, [name]),
          h('span', { class: 'st-n' }, [h('span', { class: 'st-zn' }, [`${n} 個`]), note ? `・${note}` : null]),
        ]),
        ...body,
      ]);
    }).filter(Boolean);

    // 篩選標籤：目錄裡出現的系列，照 index.json 的系列順序，後接議題數
    const count = new Map();
    listed.forEach((s) => new Set(list(s.series)).forEach((x) => {
      if (typeof x === 'string' && x) count.set(x, (count.get(x) || 0) + 1);
    }));
    const types = [...count].map(([t, n]) => ({ t, n })).sort((a, b) => seriesRank(a.t) - seriesRank(b.t) || (a.t < b.t ? -1 : 1));
    return {
      title: '議題',
      kids: [
        head('議題', null, [zones.length ? filterBar(types) : null]),
        h('main', { id: 'main', class: 'st-main st-dir' }, zones.length ? zones : [
          h('p', { class: 'st-empty', role: 'status' }, ['目前沒有兩張以上新聞卡的議題。']),
        ]),
        h('footer', { class: 'foot st-foot' }, [h('span', { class: 'foot-left' }, [
          '只列有兩張以上新聞卡的議題；上層議題的張數含子議題。只有一張卡的議題從新聞卡的分類點進去。',
        ])]),
      ],
      filter: true,
    };
  }

  // ── 畫頁：換 hash 時捲回頂端、焦點移到標題（首次開頁不搶焦點）；較晚發出的請求才算數 ──
  let ticket = 0;
  function show(kids, title, moved) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    document.title = `${title}｜AI Reports`;
    if (moved) {
      window.scrollTo(0, 0);
      const h1 = app.querySelector('h1');
      if (h1) h1.focus({ preventScroll: true });
    } else if (focused && focused.isConnected && focused !== document.activeElement) {
      focused.focus({ preventScroll: true }); // 版面面板隨工具列重建搬家
    }
  }
  const failed = (title, err) => {
    const why = err instanceof SyntaxError ? '資料格式不對' : (err && err.message) || String(err);
    return [head(title), h('main', { id: 'main', class: 'st-main' }, [h('p', { class: 'load-error', role: 'alert' }, [
      `議題資料載入失敗（${why}），重新整理再試一次。`, h('a', { href: './' }, ['回本日焦點']),
    ])])];
  };

  async function load(moved) {
    const my = ++ticket;
    index = await indexDoc;
    if (srBox === undefined) srBox = B.seriesMenu(index, null);
    const key = hashText();
    const current = key ? 'true' : 'page';
    let page;
    try {
      page = key ? await storyPage(key) : directory(await storyIndex());
    } catch (err) {
      if (my !== ticket) return;
      console.error('議題頁顯示失敗', err);
      show([toolbar(current), ...failed(key || '議題', err)], key || '議題', moved);
      return;
    }
    if (my !== ticket) return;
    // replaceState 不觸發 hashchange、不多一筆歷史
    if (page.rename) history.replaceState(history.state, '', `#${encodeURIComponent(page.rename)}`);
    show([toolbar(current), ...page.kids], page.title, moved);
    if (page.filter) applyFilter(false);
  }

  layoutPanel();
  window.addEventListener('hashchange', () => {
    load(true).catch((err) => console.error('議題頁顯示失敗', err));
  });
  load(false).catch((err) => { // 出錯也不能停在「載入中…」
    console.error('議題頁顯示失敗', err);
    app.textContent = '頁面顯示失敗，重新整理再試一次。';
  });
})();
