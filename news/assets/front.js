/* 本日焦點（news/，不帶 t；帶 t 的交給 report.js）：讀 cards/focus.json，取看的當下往回 window_hours（24）小時內的前 limit（10）張新聞卡；
   一張都沒有時列整份的前 limit 張並標最後更新（設計 §6.8、契約 §9）。不按日期翻頁、不按整點分段：一條清單照 focus.json 的順序
   （樣式摘要 5.5）；條目是 A.rows 的列表列（頁內展開）；過濾標籤依系列。不標「新」（依每台裝置的瀏覽紀錄算，碰到用詞規則）；
   舊的 air-front-seen 開頁時刪掉。其他網址參數（舊的每週頭版 ?w）不認，一律顯示本日焦點。
   報頭下有今天的日期與農民曆（A.almanac，almanac.js；lunar.js 開頁就另載，最多等 3 秒，晚到的到了再補上那一塊）。
   依賴 A.bar（bar.js 報頭元件）；A.facets、A.look、A.rows、A.almanac 選用（載入失敗就少該功能；沒有 A.rows 時退回標題連結清單）。 */
(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('t')) return; // 系列頁（含不認得的代號）由 report.js 負責
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const FILTER_KEY = 'air-front-types'; // ["finance", …]：選中的系列代號
  try {
    localStorage.removeItem('air-front-filter'); // 舊版依領域過濾的選擇
    localStorage.removeItem('air-front-seen'); // 舊版「新」標記的瀏覽紀錄
  } catch (e) { /* 存取不了：沒有可刪的 */ }
  // A.look 不在（look-standard.js 載入失敗）→ 不列「一般」
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  function storedLook() {
    let v = null;
    try { v = localStorage.getItem(KEY_LOOK); } catch (e) { /* 讀不到：用預設 */ }
    return LOOKS.some((x) => x[0] === v) ? v : LOOKS[0][0];
  }
  let look = storedLook();
  const applyLook = () => root.setAttribute('data-look', look);
  root.setAttribute('data-read', 'scan');
  applyLook();
  app.classList.add('fp');

  let index = null; // 抓不到＝null，系列名稱退回代號
  let fpBox = null; // 「版面」下拉（layoutPanel 建一次，每次重畫搬進新工具列）
  let srBox = null; // 「系列」下拉（index 到了建一次；舊版 bar.js 沒有 seriesMenu 就不放）
  const R = A.rows || null; // 列表列（rows.js）；部署空窗缺檔＝null
  const AL = A.almanac || null; // 今天日期與農民曆（almanac.js）
  const almReady = AL ? AL.load() : null; // lunar.js 開頁就開始載

  // ── 日期與時間（台北）──
  const taipei = (ms) => new Date(ms + TAIPEI_MS).toISOString(); // 台北時間的 ISO（Z 只是佔位）
  const today = () => taipei(Date.now()).slice(0, 10);
  const weekday = (iso) => WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`; // 2026-11-18 → 11/18
  const dayLabel = (iso) => `${md(iso)}（${weekday(iso)}）`; // → 11/18（三）

  // ── 系列 ──
  function seriesRank(id) {
    const order = ((index && index.series) || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }
  const bySeries = (a, b) => seriesRank(a) - seriesRank(b) || (a < b ? -1 : a > b ? 1 : 0);
  // short 一律取 series[].short（不從標題推）；沒有 short → 用標題；不在 index.json 的代號（已刪的舊系列）沒有領域色
  function seriesMeta(id) {
    const s = ((index && index.series) || []).find((x) => x.id === id);
    const title = (s && s.title) || id;
    return { title, short: (s && s.short) || title, group: (s && s.group) || '' };
  }
  // 系列短名；顏色由 report.css 依 data-group（領域）給
  const typeTag = (id) => {
    const m = seriesMeta(id);
    return h('span', { class: 'fp-ty', 'data-group': m.group || null }, [m.short]);
  };

  // ── 報頭（bar.js 元件）──
  const TITLE = '本日焦點';
  // 工具列（樣式摘要 5.1）：新聞首頁（＝這頁，aria-current=page；按鈕叫新聞首頁、頁名仍是本日焦點，使用者定案）　右邊一組：系列｜議題｜版面。
  // 舊版 bar.js 沒有 storyLink 就不放議題
  const toolbar = () => B.toolbar([
    B.navLink('新聞首頁', 'front', './', 'page'), srBox, B.storyLink ? B.storyLink(null) : null, fpBox,
  ]);

  // ── 快速過濾 ──
  // 標籤照系列順序、後接張數（屬於多個系列的卡各算一次）；系列少於兩個不放。
  // 都沒選＝全部；否則顯示任一系列有選到的卡；有選才出現「清除」（不另放「全部」）。
  // 選擇存 air-front-types：下次開沿用；不進網址（分享出去不帶自己的篩選）；這頁沒有的系列照樣記著，只套用這頁有的
  const UNIT_WORD = '張';
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
  let picked = readFilter(); // 含這頁沒有的系列；存不進 localStorage 時仍有效
  let fq = null; // { chips, clear, status, sync }；沒有標籤列＝null

  // types：[{ t: 系列代號, n: 張數 }]，已排序。
  // bar.js 過濾面板照抄 .fp-chip 的 data-type、data-group、.fp-chip-t、.fp-chip-n、aria-pressed，並代按 .fp-fq-clear；
  // 議題目錄（story.js filterBar）用同一套標記，改一邊要改兩邊
  function filterBar(types) {
    fq = null;
    if (types.length < 2) return [];
    const chips = types.map(({ t: id, n }) => {
      const m = seriesMeta(id);
      const b = h('button', { type: 'button', class: 'fp-chip', 'data-type': id, 'data-group': m.group || null, 'aria-pressed': 'false' }, [
        h('span', { class: 'fp-chip-mk', html: CHECK }), // 沒選＝領域色塊、選了＝勾（不只靠顏色；front.css 切換）
        h('span', { class: 'fp-chip-t' }, [m.short]),
        h('span', { class: 'fp-chip-n' }, [String(n), h('span', { class: 'visually-hidden' }, [` ${UNIT_WORD}`])]),
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
    return [bar, status];
  }

  // announce＝剛按了標籤 → status 唸結果。條目＝#main 裡帶 data-fq 的（列表列 .rw；退路 .fp-card）
  function applyFilter(announce) {
    const rows = [...app.querySelectorAll('#main [data-fq]')];
    const on = new Set(fq ? fq.chips.map((b) => b.dataset.type).filter((x) => picked.has(x)) : []);
    if (fq) fq.chips.forEach((b) => b.setAttribute('aria-pressed', String(on.has(b.dataset.type))));
    let shown = 0;
    rows.forEach((r) => {
      const ok = !on.size || (r.dataset.fq || '').split(' ').some((x) => on.has(x));
      r.hidden = !ok;
      if (ok) shown += 1;
    });
    if (fq) {
      const lost = fq.clear.contains(document.activeElement);
      fq.clear.hidden = !on.size;
      fq.sync();
      if (lost && fq.clear.hidden) fq.chips[0].focus(); // 「清除」藏起 → 焦點移到第一個標籤，不掉回頁首
      if (announce) fq.status.textContent = on.size ? `顯示 ${shown} ${UNIT_WORD}` : `顯示全部 ${shown} ${UNIT_WORD}`;
    }
  }
  // 別的分頁改了篩選 → 跟著套（不唸）
  window.addEventListener('storage', (e) => {
    if (e.key !== FILTER_KEY && e.key !== null) return;
    picked = readFilter();
    if (app.querySelector('#main [data-fq]')) applyFilter(false);
  });
  // 重畫前記下焦點在哪個過濾標籤（'' ＝「清除」），畫完放回
  const chipFocusNow = () => {
    const b = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-fq button');
    return b ? b.dataset.type || '' : null;
  };
  function restoreChip(key) {
    if (key == null || !fq) return;
    const b = key ? fq.chips.find((x) => x.dataset.type === key) : fq.clear;
    (b && !b.hidden ? b : fq.chips[0]).focus({ preventScroll: true });
  }

  function show(kids) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    // 下拉隨重畫搬家時焦點掉到 body → 放回原按鈕（條目的焦點由 render 還原）
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  // 載入出錯：工具列＋錯誤訊息
  function problem(text) {
    show([toolbar(), h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text])])]);
    document.title = `${TITLE}｜AI Reports`;
  }

  // ── 本日焦點（cards/focus.json；契約 §9；樣式摘要 5.5）──
  // 卡已由 card_index 排好序（事件分量 → 熱度 → 時間）、擋掉標重複與舊新聞（late）；這裡只依看的當下切時間窗，
  // 一條清單照原順序（不按整點分段：同一個整點的條目會被拆散）
  const FOCUS_PATH = 'cards/focus.json';
  const CARD_RE = /^\d{4}-W\d{2}-\d{4}$/;
  let focus = null; // focus.json；抓不到（還沒建）＝{}
  let focusKey = ''; // 畫面上的 是否近期｜編號｜built_at：換了才整頁重畫
  const num = (v, d) => (typeof v === 'number' && v > 0 ? v : d);
  const focusAt = (c) => Date.parse(c.focus_at || c.born_at);
  const focusCards = () => (focus && Array.isArray(focus.cards) ? focus.cards : []).filter((c) => c && typeof c === 'object'
    && CARD_RE.test(c.id || '') && typeof c.title === 'string' && c.title && !c.dup_of && c.late !== true && !Number.isNaN(focusAt(c)));
  const windowHours = () => num(focus && focus.window_hours, 24);
  const limit = () => Math.floor(num(focus && focus.limit, 10));
  // → { cards, recent }：時間窗內的前 limit 張；一張都沒有 → 整份的前 limit 張、recent=false。
  // 比現在晚（裝置時鐘慢）也算在窗內
  function pickFocus(now) {
    const all = focusCards();
    const inWindow = all.filter((c) => now - focusAt(c) <= windowHours() * 3600000);
    return inWindow.length ? { cards: inWindow.slice(0, limit()), recent: true } : { cards: all.slice(0, limit()), recent: false };
  }
  const keyOf = (picked) => `${picked.recent}|${picked.cards.map((c) => c.id).join()}|${(focus && focus.built_at) || ''}`;

  // 多久前：不到 1 分鐘「剛剛」，其餘分鐘、小時、天（RelativeTimeFormat 給「3 小時前」；不支援自己拼）
  let rtf = null;
  try { rtf = new Intl.RelativeTimeFormat('zh-Hant-TW', { numeric: 'always' }); } catch (e) { /* 舊瀏覽器 */ }
  const UNIT_NAME = { minute: '分鐘', hour: '小時', day: '天' };
  function ago(ms, now) {
    const s = Math.max(0, now - ms) / 1000;
    if (s < 60) return '剛剛';
    const [n, unit] = s < 3600 ? [Math.floor(s / 60), 'minute'] : s < 86400 ? [Math.floor(s / 3600), 'hour'] : [Math.floor(s / 86400), 'day'];
    return rtf ? rtf.format(-n, unit) : `${n} ${UNIT_NAME[unit]}前`;
  }
  // 「11/25（三）09:00」；不是今年加年份
  function stamp(ms) {
    const x = taipei(ms);
    return `${x.slice(0, 4) === today().slice(0, 4) ? '' : `${x.slice(0, 4)}/`}${dayLabel(x.slice(0, 10))}${x.slice(11, 16)}`;
  }
  const seriesOf = (c) => [...new Set((Array.isArray(c.series) ? c.series : []).filter((s) => typeof s === 'string' && s))].sort(bySeries);
  // 每則標多久前（focus_at；滑過看完整時間）；data-ago：每分鐘更新
  const agoTime = (c, now) => {
    const ms = focusAt(c);
    const el = R ? R.time(c.focus_at || c.born_at, ago(ms, now), stamp(ms)) : h('time', { class: 'fp-tm', datetime: c.focus_at || c.born_at, title: stamp(ms) }, [ago(ms, now)]);
    el.setAttribute('data-ago', '');
    return el;
  };

  // 一張新聞卡＝列表列（rows.js）：本頁不屬於哪個系列，上方小字與展開後的「系列」列全部；每列一樣，沒有頭條樣式
  const cardRow = (c, now) => R.row({ ...c, series: seriesOf(c) }, {
    meta: seriesMeta, time: agoTime(c, now), tag: 'li',
  });
  // 部署空窗沒有 rows.js：系列・多久前・更新｜標題連到新聞卡頁｜一句話（前一版的清單）
  const updated = (c) => focusAt(c) > Date.parse(c.born_at) || Boolean(c.last_update && c.last_update.refocus === true);
  function focusRow(c, now) {
    const types = seriesOf(c);
    const meta = h('p', { class: 'fp-mt' }, [
      ...types.map(typeTag),
      agoTime(c, now),
      updated(c) ? h('span', { class: 'fp-upd' }, ['更新']) : null,
      c.online_only === true ? h('span', { class: 'fp-online' }, [
        h('span', { class: 'fp-online-ico', html: B.ICON.warn }), '網路討論，未經媒體證實',
      ]) : null,
    ]);
    return h('li', {
      class: 'fp-it fp-card', 'data-group': (types.length && seriesMeta(types[0]).group) || null, 'data-id': c.id, 'data-fq': types.join(' '),
    }, [
      meta,
      h('h2', { class: 'row-title fp-cd-title' }, [h('a', { href: `card.html#${c.id}` }, [c.title])]),
      typeof c.line === 'string' && c.line ? h('p', { class: 'fp-line' }, [c.line]) : null,
    ]);
  }

  // 重畫不打斷閱讀：記下展開中的列與焦點所在的列、過濾標籤，畫完還原（展開的卡檔已在 rows.js 快取）
  function renderFocus() {
    const now = Date.now();
    const picked = pickFocus(now);
    const { cards, recent } = picked;
    focusKey = keyOf(picked);
    const rowOf = (el) => (el && el.closest ? el.closest('#main [data-id]') : null);
    const opened = new Set([...app.querySelectorAll('#main [data-id]')].filter((el) => el.querySelector('details[open]')).map((el) => el.dataset.id));
    const active = rowOf(document.activeElement);
    const activeId = active ? active.dataset.id : null;
    const chipFocus = chipFocusNow();
    const built = Date.parse(focus && focus.built_at);
    // 時間窗內沒有卡：同非當期提示的黃條，標最後更新
    const note = cards.length && !recent ? h('p', { class: 'stale' }, [
      h('span', { class: 'stale-ico', html: B.ICON.warn }),
      h('span', null, [`過去 ${windowHours()} 小時沒有新的新聞卡，以下是最近一批${Number.isNaN(built) ? '' : `・最後更新 ${stamp(built)}`}`]),
    ]) : null;
    const rows = cards.map((c) => (R ? cardRow(c, now) : focusRow(c, now))).filter(Boolean);
    // 過濾標籤：各系列張數（一張屬於多個系列各算一次）
    const counts = new Map();
    rows.forEach((r) => r.dataset.fq.split(' ').filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
    const types = [...counts.keys()].sort(bySeries).map((x) => ({ t: x, n: counts.get(x) }));
    const main = h('main', { id: 'main', class: 'fp-focus' }, rows.length
      ? [h('ol', { class: 'fp-list', role: 'list' }, rows)]
      : [h('p', { class: 'fp-empty-note', role: 'status' }, ['本日焦點還沒有新聞卡。'])]);
    show([
      note,
      toolbar(),
      h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...filterBar(types)]),
      AL ? AL.render(today()) : null,
      main,
      // 退回最近一批時不寫「過去 N 小時內」（黃條已說明這段時間沒有新卡）
      h('footer', { class: 'foot' }, [h('span', { class: 'foot-left' }, [
        note ? `本日焦點依重要程度取前 ${limit()} 張` : `本日焦點列出過去 ${windowHours()} 小時內新增或補充的新聞卡，依重要程度取前 ${limit()} 張`,
      ])]),
    ]);
    document.title = `${TITLE}｜AI Reports`;
    const find = (id) => [...app.querySelectorAll('#main [data-id]')].find((el) => el.dataset.id === id);
    opened.forEach((id) => {
      const d = find(id) && find(id).querySelector('details');
      if (d) d.open = true;
    });
    applyFilter(false);
    const back = activeId && find(activeId);
    if (back && !back.hidden) (back.querySelector('summary') || back.querySelector('a')).focus({ preventScroll: true });
    restoreChip(chipFocus);
  }
  // 開著不動時每分鐘：清單沒變只改「多久前」，換了才整頁重畫
  function tickFocus() {
    const now = Date.now();
    if (keyOf(pickFocus(now)) !== focusKey) {
      renderFocus();
      return;
    }
    app.querySelectorAll('#main time[data-ago]').forEach((el) => { el.textContent = ago(Date.parse(el.getAttribute('datetime')), now); });
    syncAlmanac();
  }
  // 農民曆那一塊：過了午夜、或 lunar.js 晚到（畫的時候只有國曆）→ 就地換掉，不整頁重畫
  function syncAlmanac() {
    const el = AL ? app.querySelector(':scope > .fp-alm') : null;
    if (!el) return;
    const next = AL.render(today());
    if (el.dataset.day !== next.dataset.day || el.hasAttribute('data-lunar') !== next.hasAttribute('data-lunar')) el.replaceWith(next);
  }

  async function focusMain() {
    // 農民曆跟清單一起等，最多 3 秒（不讓它拖住新聞）；晚到的由下面的 then 補上
    const almWait = almReady ? Promise.race([almReady, new Promise((r) => { setTimeout(r, 3000); })]) : null;
    const [idx, doc] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON(FOCUS_PATH), almWait]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    srBox = B.seriesMenu ? B.seriesMenu(index, null) : null;
    if (doc.status === 'fulfilled') focus = doc.value && typeof doc.value === 'object' ? doc.value : {};
    else if (/^HTTP 404$/.test(doc.reason && doc.reason.message)) focus = {}; // 還沒建 → 當沒有卡
    else {
      problem(`${TITLE}載入失敗（${doc.reason instanceof SyntaxError ? '資料格式不對' : doc.reason.message}），重新整理再試一次。`);
      return;
    }
    renderFocus();
    if (almReady) almReady.then(() => syncAlmanac());
    setInterval(() => { if (document.visibilityState === 'visible') tickFocus(); }, 60000);
  }
  // 回前景重抓：清單、built_at 都沒變只更新多久前（不收起展開中的列）；沒抓到也照現在時間重切
  async function refreshFocus() {
    const doc = await A.getJSON(FOCUS_PATH).catch(() => null);
    if (doc && typeof doc === 'object') focus = doc;
    tickFocus();
  }

  // 回前景（含 bfcache 回來）：一律重抓、照現在重切時間窗（有變才重畫）
  let ready = false; // 首次載入完成前不重抓（開頁時的 visibilitychange）
  let refreshing = false;
  async function refresh() {
    if (!ready || refreshing || document.visibilityState !== 'visible') return;
    if (!focus) return; // 首次載入失敗的頁面不重畫
    refreshing = true;
    try {
      await refreshFocus();
    } catch (err) {
      console.error('本日焦點更新失敗', err);
    } finally {
      refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });

  // ── 「版面」下拉：外觀＋配色；沿用 report.css 的 .dd-*／.vw-*，id 用 fp-* ──
  // 換外觀只換 data-look（樣式全在 CSS）；view transition 淡入淡出（減少動態由 report.css 取消）
  function setLook(v) {
    look = v;
    try { localStorage.setItem(KEY_LOOK, v); } catch (e) { /* 存不了：只套用本頁 */ }
    if (!document.startViewTransition) return applyLook();
    document.startViewTransition(applyLook).ready.catch(() => {}); // 快速連切被跳過時不報錯
    return null;
  }
  function layoutPanel() {
    const groups = [
      ['外觀', LOOKS, () => look, setLook],
      // 按鈕文字由 themeLabel 給（「自動」會註明目前深色或淺色）
      ['配色', A.THEMES, A.getTheme, A.setTheme, A.themeLabel],
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
    // site.js 在別的分頁改配色、系統深淺改變時發 air-theme
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
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', null, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]') || panel.querySelector('.vw-seg button'),
    });
  }

  layoutPanel();
  focusMain()
    .catch((err) => { // 出錯也不能停在「載入中…」
      console.error('本日焦點載入失敗', err);
      const msg = `${TITLE}顯示失敗，重新整理再試一次。`;
      try { problem(msg); } catch (e) { app.textContent = msg; } // 錯誤頁也畫不出來 → 至少換掉載入中
    })
    .finally(() => { ready = true; });
})();
