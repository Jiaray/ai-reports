/* 新聞來源狀態頁（news/sources.html）：讀 sources-status.json（news-aggregator 的 source_list.update 每輪結尾寫），列全部抓取單位
   近 24 小時的讀取、收錄，與各單位最後一次抓取的結果。從本日焦點頁尾的入口進來；不放進任何選單、面板或目錄。
   報頭「新聞來源」＋「最後一輪 M/D HH:MM・近 24 小時 N 輪・N 個抓取單位」；最後一輪超過 STALE_HOURS 小時，工具列上方一條黃色提示
   （report.css 的 .stale）。狀態篩選列（全部｜連不上｜快進板凳｜沒有新稿）、圖例；依來源清單的區分段（共用、各領域，板凳、待檢、停用
   有來源才出現），每區一張緊湊表格，一個來源一行（使用者定案：長條短、每列不高、留白少）：
   來源（同名的加備註；同一行接網址，放不下截掉）｜長條｜讀取｜收錄｜最近收錄｜狀態（＋同一行原因，完整文字在 title）。
   長條：長度＝讀取（相對全部單位的最大值），深色段＝收錄占讀取；連不上畫斜紋。同一區內依狀態（連不上、快進板凳、沒有新稿、正常、
   板凳、待檢、停用）、再依讀取多到少。手機每列兩行（名稱＋狀態｜長條、讀、收、M/D），不顯示網址與原因。
   檔案 404 或格式不對：「來源狀態還沒產生」＋回本日焦點。每分鐘重算黃色提示，回前景重抓（built_at 變了才重畫，篩選保持）。
   依賴 A.bar；A.look 選用。樣式在 sources.css（.sx／.sx-*）。所有欄位當純文字（A.h 的字串子節點），網址只收 http(s)。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const DATA = 'sources-status.json';
  const TITLE = '新聞來源';
  const STALE_HOURS = 8;     // 最後一輪超過這麼多小時：黃色提示（同本日焦點頁尾入口）
  const NEAR = 11;           // 快進板凳：主線、沒釘選，連續這麼多輪沒收錄（news-aggregator source_list.BENCH_AFTER_ROUNDS − 3）
  const BENCH_ROUNDS = 14;   // source_list.BENCH_AFTER_ROUNDS
  const DOMAIN = '領域：';
  const OFF = { 板凳: 'bench', 待檢: 'pending', 停用: 'off' };
  const TAIPEI_MS = 8 * 3600 * 1000;
  const str = (v) => (typeof v === 'string' ? v : '');
  const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

  // ── 外觀：新聞各頁共用（air-news-look）；沒有 A.look 就不列「一般」 ──
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  let look = LOOKS[0][0];
  try {
    const v = localStorage.getItem(KEY_LOOK);
    if (LOOKS.some((x) => x[0] === v)) look = v;
  } catch (e) { /* 讀不到：用預設 */ }
  root.setAttribute('data-look', look);

  // ── 報頭工具列（bar.js）：新聞首頁　右邊一組：系列｜議題｜版面；這頁不標 aria-current ──
  let srBox; // undefined＝還沒建
  let vwBox = null;
  const toolbar = () => B.toolbar([
    B.navLink('新聞首頁', 'front', './', null),
    srBox,
    B.storyLink ? B.storyLink(null) : null,
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

  // ── 時間（台北）──
  const taipei = (ms) => new Date(ms + TAIPEI_MS).toISOString(); // Z 只是佔位
  const md = (day) => `${+day.slice(5, 7)}/${+day.slice(8, 10)}`;
  function mdhm(iso) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '';
    const x = taipei(ms);
    return `${md(x)} ${x.slice(11, 16)}`;
  }
  const dayOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? md(v) : '');
  const fmt = (n) => int(n).toLocaleString('en-US');

  // ── 狀態 ──
  const svg = (d) => `<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const ST = {
    err: { label: '連不上', icon: svg('M5.5 5.5l9 9M14.5 5.5l-9 9') },
    near: { label: '快進板凳', icon: svg('M10 4v7.5M10 15v.5') },
    empty: { label: '沒有新稿', icon: svg('M5 10h10') },
    ok: { label: '正常', icon: svg('M4.5 10.5l3.5 3.5 7.5-8') },
    bench: { label: '板凳', icon: '' },
    pending: { label: '待檢', icon: '' },
    off: { label: '停用', icon: '' },
  };
  const ORDER = ['err', 'near', 'empty', 'ok', 'bench', 'pending', 'off'];
  const FILTERS = ['err', 'near', 'empty'];
  // 區（板凳、待檢、停用）→ 狀態欄寫區名；連不上＝最後一次抓取出錯；快進板凳＝主線、沒釘選、連續 NEAR 輪以上沒收錄
  // （排在沒有新稿前：快被移到板凳的不能因為剛好沒新稿就看不出來，個數才跟 Telegram 的「快移到板凳」對得上）；沒有新稿＝近 24 小時讀取 0
  function statusOf(u) {
    if (OFF[u.section]) return OFF[u.section];
    if (u.ok === false) return 'err';
    if (u.pinned !== true && int(u.rounds_without_pick) >= NEAR) return 'near';
    if (!(int(u.read) > 0)) return 'empty';
    return 'ok';
  }
  function whyOf(u, s) {
    if (s === 'err') return str(u.error) || '抓取失敗';
    if (s === 'near') return `${int(u.rounds_without_pick)} 輪沒收錄`;
    if (s === 'bench') return u.last_fetched_at && mdhm(u.last_fetched_at) ? `上次抓 ${mdhm(u.last_fetched_at).split(' ')[0]}` : '';
    return '';
  }
  // title：完整原因（連不上加起始時間、快進板凳加規則）
  function titleOf(u, s, why) {
    if (s === 'err') return `連不上：${why}${u.error_since && mdhm(u.error_since) ? `（從 ${mdhm(u.error_since)} 起）` : ''}`;
    if (s === 'near') return `快進板凳：連續 ${int(u.rounds_without_pick)} 輪沒收錄，滿 ${BENCH_ROUNDS} 輪移到板凳、改成 7 天抓一次`;
    if (s === 'bench') return `板凳：7 天抓一次${why ? `，${why}` : ''}`;
    return null;
  }
  const badge = (s) => h('span', { class: `sx-st sx-st-${s}` }, [
    ST[s].icon ? h('span', { class: 'sx-ico', html: ST[s].icon }) : null, ST[s].label,
  ]);

  // ── 資料整理 ──
  const units = (doc) => doc.units.filter((u) => u && typeof u === 'object' && str(u.id));
  function sections(list) {
    const out = [];
    list.forEach((u) => {
      const sec = str(u.section) || '其他';
      let s = out.find((x) => x.sec === sec);
      if (!s) out.push(s = { sec, units: [] });
      s.units.push(u);
    });
    return out;
  }
  const groupOf = (sec) => (sec.startsWith(DOMAIN) ? sec.slice(DOMAIN.length) : null);
  const sum = (list, k) => list.reduce((a, u) => a + int(u[k]), 0);
  const secMeta = (list) => `${list.length} 個・讀 ${fmt(sum(list, 'read'))}・收 ${fmt(sum(list, 'used'))}`;
  const sortUnits = (list) => [...list].sort((a, b) => ORDER.indexOf(statusOf(a)) - ORDER.indexOf(statusOf(b)) || int(b.read) - int(a.read));
  // 同名的抓取單位（例：中央社 CNA 有好幾個 feed）：名稱後面加備註分辨（太長截掉）
  let dupNames = new Set();
  function subOf(u) {
    if (!dupNames.has(u.name)) return '';
    const t = str(u.note) || u.id;
    return t.length > 14 ? `${t.slice(0, 13)}…` : t;
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(str(u)) ? str(u) : null);

  // 長條：長度＝讀取（相對 max），深色段＝收錄占讀取
  const barOf = (u, max) => h('span', { class: 'sx-bar-track', 'aria-hidden': 'true' }, [
    h('span', { class: 'sx-bar-read', style: `width:${(int(u.read) / max * 100).toFixed(1)}%` }, [
      h('span', { class: 'sx-bar-used', style: `width:${int(u.read) ? Math.min(100, int(u.used) / int(u.read) * 100).toFixed(1) : 0}%` }),
    ]),
  ]);

  // ── 篩選（全部｜連不上｜快進板凳｜沒有新稿）──
  let filter = 'all';
  function filterBar(list) {
    const n = (s) => list.filter((u) => statusOf(u) === s).length;
    const opts = [['all', '全部', list.length], ...FILTERS.map((s) => [s, ST[s].label, n(s)])];
    return h('div', { class: 'sx-filter', role: 'toolbar', 'aria-label': '依狀態篩選' }, opts.map(([k, label, count]) => {
      const b = h('button', {
        type: 'button', class: `sx-fb${k === 'all' ? '' : ` sx-fb-${k}`}`, 'aria-pressed': String(k === filter),
        disabled: k !== 'all' && count === 0 ? true : null,
      }, [k === 'all' ? null : h('span', { class: 'sx-ico', html: ST[k].icon }), label, h('span', { class: 'sx-fb-n' }, [String(count)])]);
      b.addEventListener('click', () => {
        filter = k;
        draw(true);
      });
      return b;
    }));
  }

  function table(sec, list, max) {
    const tr = (u) => {
      const s = statusOf(u);
      const why = whyOf(u, s);
      const sub = subOf(u);
      const url = safeUrl(u.url);
      const shown = str(u.url).replace(/^https?:\/\//i, '');
      return h('tr', { class: `sx-tr-${s}` }, [
        h('th', { scope: 'row', class: 'sx-td-name' }, [h('div', { class: 'sx-nm' }, [
          h('span', { class: 'sx-tn' }, [str(u.name) || u.id, sub ? h('span', { class: 'sx-note' }, [sub]) : null]),
          url ? h('a', { class: 'sx-url', href: url, target: '_blank', rel: 'noopener noreferrer' }, [shown])
            : (shown ? h('span', { class: 'sx-url' }, [shown]) : null),
        ])]),
        h('td', { class: `sx-td-bar sx-bar-${s}` }, [barOf(u, max)]),
        h('td', { class: 'sx-num', 'data-k': '讀' }, [s === 'err' && !int(u.read) ? '—' : fmt(u.read)]),
        h('td', { class: 'sx-num', 'data-k': '收' }, [fmt(u.used)]),
        h('td', { class: 'sx-td-day' }, [dayOf(u.last_pick) || '—']),
        h('td', { class: 'sx-td-st', title: titleOf(u, s, why) }, [badge(s), why ? h('span', { class: 'sx-why' }, [why]) : null]),
      ]);
    };
    return h('section', { class: 'sx-sec', 'data-group': groupOf(sec) }, [
      h('h2', { class: 'sx-sh' }, [h('span', { class: 'sx-sh-t' }, [groupOf(sec) || sec]), h('span', { class: 'sx-sh-n' }, [secMeta(list)])]),
      h('table', { class: 'sx-table' }, [
        h('thead', null, [h('tr', null, [
          h('th', { scope: 'col' }, ['來源']),
          h('th', { scope: 'col', class: 'sx-td-bar' }, [h('span', { class: 'visually-hidden' }, ['讀取與收錄長條'])]),
          h('th', { scope: 'col', class: 'sx-num' }, ['讀取']),
          h('th', { scope: 'col', class: 'sx-num' }, ['收錄']),
          h('th', { scope: 'col', class: 'sx-td-day' }, ['最近收錄']),
          h('th', { scope: 'col', class: 'sx-td-st' }, ['狀態']),
        ])]),
        h('tbody', null, sortUnits(list).filter((u) => filter === 'all' || statusOf(u) === filter).map(tr)),
      ]),
    ]);
  }

  // ── 一頁 ──
  const head = (below = []) => h('header', { class: 'masthead sx-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...below]);
  const backLink = () => h('a', { class: 'sx-back', href: './' }, ['回本日焦點']);
  function staleNote(doc, now) {
    const built = Date.parse(doc && doc.built_at);
    if (Number.isNaN(built) || now - built <= STALE_HOURS * 3600000) return null;
    return h('p', { class: 'stale sx-stale' }, [
      h('span', { class: 'stale-ico', html: B.ICON.warn }),
      h('span', null, [`最後一輪是 ${Math.floor((now - built) / 3600000)} 小時前，收集可能停了`]),
    ]);
  }
  function page(doc) {
    const list = units(doc);
    dupNames = new Set(list.map((u) => u.name).filter((n, i, a) => a.indexOf(n) !== i));
    const max = Math.max(1, ...list.map((u) => int(u.read)));
    const secs = sections(list);
    const shown = secs.filter(({ units: us }) => filter === 'all' || us.some((u) => statusOf(u) === filter));
    const missing = Object.keys(OFF).filter((s) => !secs.some((x) => x.sec === s));
    const built = mdhm(doc.built_at);
    return [
      head([h('p', { class: 'sx-sub' }, [[built ? `最後一輪 ${built}` : '', `近 24 小時 ${int(doc.rounds_24h)} 輪`, `${list.length} 個抓取單位`].filter(Boolean).join('・')])]),
      h('main', { id: 'main', class: 'sx' }, [
        filterBar(list),
        h('p', { class: 'sx-legend' }, [
          h('span', { class: 'sx-lg' }, [h('span', { class: 'sx-key sx-key-read' }), '讀取']),
          h('span', { class: 'sx-lg' }, [h('span', { class: 'sx-key sx-key-used' }), '收錄']),
          h('span', null, ['近 24 小時；長條以讀取最多的來源為滿格']),
        ]),
        ...shown.map(({ sec, units: us }) => table(sec, us, max)),
        missing.length && filter === 'all' ? h('p', { class: 'sx-none' }, [`${missing.join('、')}：目前沒有來源。`]) : null,
      ]),
      h('footer', { class: 'foot sx-foot' }, [h('span', { class: 'foot-left' }, [
        '讀取＝近 24 小時抓到的新稿則數；收錄＝其中寫進新聞卡（新增、補充、掛來源）的則數。連不上的來源，下一輪會從上次成功的時間補收；',
        `連續 ${BENCH_ROUNDS} 輪沒收錄的移到板凳，改成 7 天抓一次。`,
      ])]),
    ];
  }
  const missingPage = () => [head(), h('main', { id: 'main', class: 'sx' }, [h('p', { class: 'sx-miss' }, [
    '來源狀態還沒產生；收集程式跑完下一輪就會出現。', backLink(),
  ])])];
  const failedPage = (err) => [head(), h('main', { id: 'main', class: 'sx' }, [h('p', { class: 'load-error', role: 'alert' }, [
    `來源狀態載入失敗（${(err && err.message) || String(err)}），重新整理再試一次。`, backLink(),
  ])])];

  // ── 畫頁：篩選切換時焦點留在按下的篩選鈕 ──
  let doc = null; // 抓到的資料；null＝還沒有或抓不到
  let kids = null;
  function draw(keepFilterFocus) {
    const now = Date.now();
    const focused = document.activeElement;
    app.replaceChildren(...[staleNote(doc, now), toolbar(), ...(kids || page(doc))].filter(Boolean));
    document.title = `${TITLE}｜AI Reports`;
    if (keepFilterFocus) {
      const b = app.querySelector('.sx-filter [aria-pressed=true]');
      if (b) b.focus({ preventScroll: true });
    } else if (focused && focused.isConnected && focused !== document.activeElement) {
      focused.focus({ preventScroll: true }); // 版面面板隨工具列重建搬家
    }
  }
  // 每分鐘：只換黃色提示（跨過 STALE_HOURS、小時數變了）
  function syncStale() {
    if (!doc) return;
    const old = app.querySelector(':scope > .sx-stale');
    const next = staleNote(doc, Date.now());
    if (old && next) { if (old.textContent !== next.textContent) old.replaceWith(next); } else if (old) old.remove();
    else if (next) app.prepend(next);
  }

  async function load() {
    let got = null;
    let err = null;
    try {
      got = await A.getJSON(DATA);
    } catch (e) {
      err = e;
    }
    const valid = got && typeof got === 'object' && Array.isArray(got.units);
    if (valid) {
      const changed = !doc || doc.built_at !== got.built_at;
      doc = got;
      kids = null;
      if (changed) draw(false);
      return;
    }
    if (doc) return; // 回前景重抓失敗：留著畫面上的
    // 404、格式不對（JSON 壞、沒有 units）＝還沒產生；其他（網路）＝載入失敗
    kids = !err || err instanceof SyntaxError || /^HTTP 404$/.test(err.message) ? missingPage() : failedPage(err);
    draw(false);
  }

  async function main() {
    layoutPanel();
    const index = await A.getJSON('index.json').catch(() => null);
    srBox = B.seriesMenu ? B.seriesMenu(index, null) : null;
    await load();
    setInterval(() => { if (document.visibilityState === 'visible') syncStale(); }, 60000);
    const refresh = () => { if (document.visibilityState === 'visible') load().then(syncStale).catch(() => {}); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
  }
  main().catch((err) => { // 出錯也不能停在「載入中…」
    console.error('來源狀態頁顯示失敗', err);
    app.textContent = '頁面顯示失敗，重新整理再試一次。';
  });
})();
