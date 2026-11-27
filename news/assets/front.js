/* 本日焦點（news/，不帶 t；帶 t 的交給 report.js）：讀 cards/focus.json，取看的當下往回 window_hours（24）小時內的前 limit（10）張新聞卡；
   一張都沒有時列整份的前 limit 張並標最後更新（設計 §6.8、契約 §9）。不按日期翻頁、不按整點分段：一條清單照 focus.json 的順序
   （樣式摘要 5.5）；條目是 A.rows 的列表列（頁內展開）。不標「新」（依每台裝置的瀏覽紀錄算，碰到用詞規則）。其他網址參數不認，一律顯示本日焦點。
   前 limit 張之後接「各系列」速覽：時間窗內每個系列最重要的 3 張（扣掉上面列過的），依領域分塊（決策 2026-11-26）。
   報頭下有今天的日期與農民曆（A.almanac，almanac.js；lunar.js 開頁就另載，最多等 3 秒，晚到的到了再補上那一塊）。
   頁尾右邊是來源狀態入口（連 sources.html）：focus.json 的 today＋sources-status.json（畫完清單再抓，不擋新聞；抓不到就不放來源那段）。
   依賴 A.bar（bar.js 報頭元件）、A.rows（rows.js 列表列）；A.look、A.almanac 選用（載入失敗就少該功能）。 */
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
  let srBox = null; // 「系列」下拉（index 到了建一次）
  const R = A.rows; // 列表列（rows.js）
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

  // ── 報頭（bar.js 元件）──
  const TITLE = '本日焦點';
  // 工具列（樣式摘要 5.1）：新聞首頁（＝這頁，aria-current=page；按鈕叫新聞首頁、頁名仍是本日焦點，使用者定案）　右邊一組：系列｜議題｜版面
  const toolbar = () => B.toolbar([
    B.navLink('新聞首頁', 'front', './', 'page'), srBox, B.storyLink(null), fpBox,
  ]);

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
  let focus = null; // focus.json
  let focusKey = ''; // 畫面上的 是否近期｜編號｜各系列挑的卡｜built_at：換了才整頁重畫
  const num = (v, d) => (typeof v === 'number' && v > 0 ? v : d);
  const focusAt = (c) => Date.parse(c.focus_at || c.born_at);
  const focusCards = () => (focus && Array.isArray(focus.cards) ? focus.cards : []).filter((c) => c && typeof c === 'object'
    && CARD_RE.test(c.id || '') && typeof c.title === 'string' && c.title && !c.dup_of && c.late !== true && !Number.isNaN(focusAt(c)));
  const windowHours = () => num(focus && focus.window_hours, 24);
  const limit = () => Math.floor(num(focus && focus.limit, 10));
  // → { cards, recent, plan }：時間窗內的前 limit 張；一張都沒有 → 整份的前 limit 張、recent=false、沒有速覽。
  // plan＝各系列速覽要列的（見 plan()）。比現在晚（裝置時鐘慢）也算在窗內
  function pickFocus(now) {
    const all = focusCards();
    const inWindow = all.filter((c) => now - focusAt(c) <= windowHours() * 3600000);
    if (!inWindow.length) return { cards: all.slice(0, limit()), recent: false, plan: null };
    const cards = inWindow.slice(0, limit());
    return { cards, recent: true, plan: plan(inWindow, new Set(cards.map((c) => c.id))) };
  }
  // 前 limit 張、各系列挑的卡（與那個系列有沒有卡）換了才整頁重畫；只有「看全部 N 張」的 N 變了就地改（tickFocus），
  // 窗內每滑出一張卡就整頁重畫會讓畫面跳動
  const keyOf = (picked) => [
    picked.recent, picked.cards.map((c) => c.id).join(),
    (picked.plan || []).map((p) => (p.n ? p.pick.map((c) => c.id).join('+') || '0' : '-')).join('/'),
    (focus && focus.built_at) || '',
  ].join('|');

  // ── 頁尾：來源狀態入口（使用者定案）：「今天　新增 N｜補充 N｜來源 連得上/全部 ›」，連 sources.html ──
  // 新增、補充讀 focus.json 的 today（date 不是台北今天＝午夜後還沒發布過，寫 0）；來源讀 sources-status.json 的主線單位
  // （板凳、待檢、停用不算），有連不上的「來源」那段紅字加 ✕；最後一輪（built_at）超過 STALE_HOURS 小時改寫「✕ N 小時沒更新」。
  // 來源檔抓不到就不放來源那段。每分鐘重算（tickFocus），回前景重抓。
  const STATUS_PATH = 'sources-status.json';
  const STALE_HOURS = 8;
  const OFF_SECTIONS = ['板凳', '待檢', '停用'];
  const XMARK = '<svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>';
  let srcDoc; // sources-status.json；undefined＝還沒抓、null＝抓不到或格式不對
  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  function srcEntry(now) {
    const t = focus.today;
    const doc = srcDoc && Array.isArray(srcDoc.units) ? srcDoc : null;
    const sep = () => h('span', { class: 'fp-src-sep', 'aria-hidden': 'true' }, ['｜']);
    const fresh = t.date === today();
    const born = fresh ? count(t.new) : 0;
    const supp = fresh ? count(t.supplemented) : 0;
    const kids = [
      h('span', { class: 'fp-src-day' }, ['今天']),
      h('span', null, ['新增 ', h('b', null, [String(born)])]), sep(), h('span', null, ['補充 ', h('b', null, [String(supp)])]),
    ];
    const said = [`今天新增 ${born} 張、補充 ${supp} 張`];
    if (doc) {
      kids.push(sep());
      const main = doc.units.filter((u) => u && typeof u === 'object' && !OFF_SECTIONS.includes(u.section));
      const ok = main.filter((u) => u.ok !== false).length;
      const built = Date.parse(doc.built_at);
      const late = !Number.isNaN(built) && now - built > STALE_HOURS * 3600000;
      const bad = (text) => h('span', { class: 'fp-src-bad' }, ['來源 ', h('span', { class: 'fp-src-x', html: XMARK }), h('b', null, [text])]);
      if (late) {
        const hrs = Math.floor((now - built) / 3600000);
        kids.push(bad(`${hrs} 小時沒更新`));
        said.push(`來源資料 ${hrs} 小時沒更新，收集可能停了`);
      } else if (ok < main.length) {
        kids.push(bad(`${ok}/${main.length}`));
        said.push(`${main.length} 個來源有 ${main.length - ok} 個連不上`);
      } else {
        kids.push(h('span', null, ['來源 ', h('b', null, [`${ok}/${main.length}`])]));
        said.push(`${main.length} 個來源都連得上`);
      }
    }
    kids.push(h('span', { class: 'fp-src-chev', 'aria-hidden': 'true' }));
    return h('a', { class: 'fp-src', href: 'sources.html', 'aria-label': `新聞來源狀態：${said.join('，')}` }, kids);
  }
  // 就地換頁尾的入口（不整頁重畫）；內容沒變不動，焦點在入口上時換完移回去
  function syncSrcEntry() {
    const foot = app.querySelector(':scope > footer.foot');
    if (!foot) return;
    const old = foot.querySelector(':scope > .fp-src');
    const next = srcEntry(Date.now());
    if (old && next && old.outerHTML === next.outerHTML) return;
    const had = old && old === document.activeElement;
    if (old) old.remove();
    if (next) {
      foot.append(next);
      if (had) next.focus({ preventScroll: true });
    }
  }
  // 抓不到時保留上一份（回前景重抓失敗不讓入口消失）；第一次就抓不到＝null
  async function loadSrc() {
    const d = await A.getJSON(STATUS_PATH).catch(() => null);
    if (d && typeof d === 'object' && Array.isArray(d.units)) srcDoc = d;
    else if (srcDoc === undefined) srcDoc = null;
    syncSrcEntry();
  }

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
    const el = R.time(c.focus_at || c.born_at, ago(ms, now), stamp(ms));
    el.setAttribute('data-ago', '');
    return el;
  };

  // 一張新聞卡＝列表列（rows.js）：本頁不屬於哪個系列，上方小字與展開後的「系列」列全部；每列一樣，沒有頭條樣式。
  // omit：清單全是事件分量高時不標「重要」（每張都有就沒有區別；記號說明裡註明）
  const cardRow = (c, now, omit) => R.row({ ...c, series: seriesOf(c) }, {
    meta: seriesMeta, time: agoTime(c, now), tag: 'li', omit,
  });

  // ── 各系列速覽（決策 2026-11-26）：前 limit 張之後，index.json 的系列順序、依領域分塊，每個系列最重要的 PER 張 ──
  // 挑卡＝那個系列頁選「重要」時的前幾張：鄉民依社群熱度（只收有熱度的）、資安先依急迫性、財經先台灣（台灣關聯直接）、
  // 遊戲開發先網頁遊戲開發類（views.web_dev），其餘照本日焦點的順序（focus.json 已依事件分量 → 熱度 → 時間排好）。全頁不重複：上面列過的不再列
  const PER = 3;
  const urgency = (c) => ({ 高: 0, 中: 1, 低: 2 }[c.urgency] ?? 3);
  const community = (c) => {
    const m = c.heat && c.heat.community && typeof c.heat.community === 'object' ? c.heat.community : {};
    return ['hn', 'ptt', 'v2ex'].reduce((t, k) => t + (typeof m[k] === 'number' && m[k] > 0 ? m[k] : 0), 0);
  };
  const webDev = (c) => {
    const t = Array.isArray(c.topic_all) ? c.topic_all : Array.isArray(c.topic) ? c.topic : [];
    return t.includes('網頁遊戲') || (t.includes('遊戲') && t.includes('開發與開源'));
  };
  function seriesOrder(id, list) {
    const at = new Map(list.map((c, i) => [c, i]));
    const base = (a, b) => at.get(a) - at.get(b);
    if (id === 'social') return list.filter((c) => community(c) > 0).sort((a, b) => community(b) - community(a) || base(a, b));
    if (id === 'security') return [...list].sort((a, b) => urgency(a) - urgency(b) || base(a, b));
    if (id === 'finance') return [...list].sort((a, b) => (b.taiwan === '直接') - (a.taiwan === '直接') || base(a, b));
    if (id === 'game_dev') return [...list].sort((a, b) => webDev(b) - webDev(a) || base(a, b));
    return list;
  }
  // pool：時間窗內的卡（focus.json 的順序）；used：上面已列的編號（會加進這裡挑的）→ [{ s: 系列, n: 窗內張數, pick: 要列的卡 }]；
  // 沒有系列設定或窗內沒有卡 → null
  function plan(pool, used) {
    const series = B.cardSeries(index);
    if (!pool.length || !series.length) return null;
    return series.map((s) => {
      const all = pool.filter((c) => Array.isArray(c.series) && c.series.includes(s.id));
      const pick = all.length ? seriesOrder(s.id, all).filter((c) => !used.has(c.id)).slice(0, PER) : [];
      pick.forEach((c) => used.add(c.id));
      return { s, n: all.length, pick };
    });
  }
  const seeAll = (n) => `看全部 ${n} 張`;
  const noneLine = (ps) => `近 ${windowHours()} 小時沒有新卡：${ps.map((p) => p.s.short || p.s.title || p.s.id).join('、')}`;
  function overview(ps, now) {
    if (!ps) return null;
    const blocks = []; // [{ group, secs }]：同領域挨在一起（index.json 的順序）
    ps.filter((p) => p.n).forEach(({ s, n, pick }) => {
      // 同系列頁：上方小字不列這段的系列、左緣色線用這段的領域色
      const rows = pick.map((c) => {
        const el = R.row({ ...c, series: seriesOf(c) }, { meta: seriesMeta, page: s.id, time: agoTime(c, now), tag: 'li' });
        if (el) el.dataset.group = s.group || '';
        return el;
      }).filter(Boolean);
      const hid = `fp-s-${s.id}`;
      const sec = h('section', { class: 'fp-sec', 'aria-labelledby': hid, 'data-group': s.group || null, 'data-s': s.id }, [
        // 段標題黏在工具列下方；整條連到系列頁（N＝時間窗內這個系列的張數）
        h('h3', { class: 'fp-sec-h', id: hid }, [h('a', { class: 'fp-sec-a', href: `./?t=${encodeURIComponent(s.id)}` }, [
          h('span', { class: 'fp-sec-t' }, [s.short || s.title || s.id]), h('span', { class: 'fp-sec-n' }, [seeAll(n)]),
        ])]),
        rows.length ? h('ol', { class: 'fp-list', role: 'list' }, rows) : h('p', { class: 'fp-sec-none' }, [`這個系列近 ${windowHours()} 小時的卡都在上面。`]),
      ]);
      const last = blocks[blocks.length - 1];
      if (last && last.group === (s.group || '')) last.secs.push(sec);
      else blocks.push({ group: s.group || '', secs: [sec] });
    });
    const empty = ps.filter((p) => !p.n);
    // 每個領域一塊（上方細線＋較大間距）；兩個以上系列的領域才寫領域名（只有一個系列的，名稱跟系列一樣，不重複）
    return h('section', { class: 'fp-map', 'aria-labelledby': 'fp-map-h' }, [
      h('h2', { class: 'fp-map-h', id: 'fp-map-h' }, ['各系列']),
      h('p', { class: 'fp-map-sub' }, [`近 ${windowHours()} 小時，每個系列最重要的 ${PER} 張；上面列過的不重列。`]),
      ...blocks.map((b) => h('div', { class: 'fp-dom', 'data-group': b.group || null }, [
        b.secs.length > 1 && b.group ? h('p', { class: 'fp-dom-h' }, [b.group]) : null, ...b.secs,
      ])),
      empty.length ? h('p', { class: 'fp-map-empty' }, [noneLine(empty)]) : null,
    ]);
  }
  // 列的卡沒變、只有張數變了：就地改「看全部 N 張」（N 變 0 的會換鍵、整頁重畫）
  function syncCounts(ps) {
    (ps || []).forEach((p) => {
      const el = app.querySelector(`.fp-sec[data-s="${CSS.escape(p.s.id)}"] .fp-sec-n`);
      if (el && el.textContent !== seeAll(p.n)) el.textContent = seeAll(p.n);
    });
  }

  // 重畫不打斷閱讀：記下展開中的列與焦點所在的列，畫完還原（展開的卡檔已在 rows.js 快取）
  function renderFocus() {
    const now = Date.now();
    const picked = pickFocus(now);
    const { cards, recent } = picked;
    focusKey = keyOf(picked);
    const rowOf = (el) => (el && el.closest ? el.closest('#main [data-id]') : null);
    const opened = new Set([...app.querySelectorAll('#main [data-id]')].filter((el) => el.querySelector('details[open]')).map((el) => el.dataset.id));
    const active = rowOf(document.activeElement);
    const activeId = active ? active.dataset.id : null;
    const secFocus = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.fp-sec-a') : null;
    const almOpen = Boolean(app.querySelector(':scope > .fp-alm.is-open'));
    const built = Date.parse(focus && focus.built_at);
    // 時間窗內沒有卡：同非當期提示的黃條，標最後更新
    const note = cards.length && !recent ? h('p', { class: 'stale' }, [
      h('span', { class: 'stale-ico', html: B.ICON.warn }),
      h('span', null, [`過去 ${windowHours()} 小時沒有新的新聞卡，以下是最近一批${Number.isNaN(built) ? '' : `・最後更新 ${stamp(built)}`}`]),
    ]) : null;
    // 前 limit 張都是事件分量高（平常如此）→ 不標「重要」；有一張不是就照常標，記號說明也不寫那句
    const allImp = cards.length > 0 && cards.every((c) => c.weight === '高');
    const rows = cards.map((c) => cardRow(c, now, allImp ? ['imp'] : null)).filter(Boolean);
    const main = h('main', { id: 'main', class: 'fp-focus' }, rows.length
      ? [h('ol', { class: 'fp-list', role: 'list' }, rows), overview(picked.plan, now)].filter(Boolean)
      : [h('p', { class: 'fp-empty-note', role: 'status' }, ['本日焦點還沒有新聞卡。'])]);
    show([
      note,
      toolbar(),
      h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE])]),
      AL ? AL.render(today(), { open: almOpen }) : null,
      main,
      // 記號說明（rows.js）
      rows.length ? R.legend({ front: allImp ? rows.length : 0 }) : null,
      // 退回最近一批時不寫「過去 N 小時內」（黃條已說明這段時間沒有新卡）
      h('footer', { class: 'foot' }, [h('span', { class: 'foot-left' }, [
        note ? `本日焦點依重要程度取前 ${limit()} 張` : `本日焦點列出過去 ${windowHours()} 小時內新增或補充的新聞卡，依重要程度取前 ${limit()} 張`,
      ]), srcEntry(now)]),
    ]);
    document.title = `${TITLE}｜AI Reports`;
    const find = (id) => [...app.querySelectorAll('#main [data-id]')].find((el) => el.dataset.id === id);
    opened.forEach((id) => {
      const d = find(id) && find(id).querySelector('details');
      if (d) d.open = true;
    });
    const back = activeId && find(activeId);
    if (back && !back.hidden) (back.querySelector('summary') || back.querySelector('a')).focus({ preventScroll: true });
    const sec = secFocus && app.querySelector(`.fp-sec-a[href="${secFocus.getAttribute('href')}"]`);
    if (sec) sec.focus({ preventScroll: true });
  }
  // 開著不動時每分鐘：清單沒變只改「多久前」，換了才整頁重畫
  function tickFocus() {
    const now = Date.now();
    const picked = pickFocus(now);
    if (keyOf(picked) !== focusKey) {
      renderFocus();
      return;
    }
    syncCounts(picked.plan);
    app.querySelectorAll('#main time[data-ago]').forEach((el) => { el.textContent = ago(Date.parse(el.getAttribute('datetime')), now); });
    syncAlmanac();
    syncSrcEntry();
  }
  // 農民曆那一塊：過了午夜、或 lunar.js 晚到（畫的時候只有國曆）→ 就地換掉，不整頁重畫（手機的展開狀態、開關上的焦點照留）
  function syncAlmanac() {
    const el = AL ? app.querySelector(':scope > .fp-alm') : null;
    if (!el) return;
    const next = AL.render(today(), { open: el.classList.contains('is-open') });
    if (el.dataset.day === next.dataset.day && el.hasAttribute('data-lunar') === next.hasAttribute('data-lunar')) return;
    const had = el.contains(document.activeElement);
    el.replaceWith(next);
    const tg = had && next.querySelector('.fp-alm-tg');
    if (tg) tg.focus({ preventScroll: true });
  }

  async function focusMain() {
    // 農民曆跟清單一起等，最多 3 秒（不讓它拖住新聞）；晚到的由下面的 then 補上
    const almWait = almReady ? Promise.race([almReady, new Promise((r) => { setTimeout(r, 3000); })]) : null;
    const [idx, doc] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON(FOCUS_PATH), almWait]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    srBox = B.seriesMenu(index, null);
    if (doc.status !== 'fulfilled' || !doc.value || typeof doc.value !== 'object') {
      const why = doc.status === 'fulfilled' || doc.reason instanceof SyntaxError ? '資料格式不對' : doc.reason.message;
      problem(`${TITLE}載入失敗（${why}），重新整理再試一次。`);
      return;
    }
    focus = doc.value;
    renderFocus();
    if (almReady) almReady.then(() => syncAlmanac());
    loadSrc(); // 頁尾來源入口：清單畫好再抓，不擋新聞
    setInterval(() => { if (document.visibilityState === 'visible') tickFocus(); }, 60000);
  }
  // 回前景重抓：清單、built_at 都沒變只更新多久前（不收起展開中的列）；沒抓到也照現在時間重切
  async function refreshFocus() {
    const [doc] = await Promise.all([A.getJSON(FOCUS_PATH).catch(() => null), loadSrc()]);
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
