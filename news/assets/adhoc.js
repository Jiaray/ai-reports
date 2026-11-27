/* 暫時頁（news/adhoc.html#<slug>；樣式摘要第 10 節）：讀 adhoc/<slug>.json（一次臨時查詢的結果）；不進任何選單、面板或目錄，只用網址開。
   報頭：查詢主題（title）、「臨時查詢・M/D HH:MM 查詢・N 張」，下接說明列。清單依事件時間分天（新到舊，日段同系列頁），
   同一天內依重要程度（rows.js byImportance）；每張是 rows.js 的不展開列 link()：上方小字（系列・HH:MM）、標題連新聞卡頁、一句話。
   不標 op（新增、補充、比對到），只照卡本身的 last_update 標「更新」。事件時間、系列等由索引建置補進暫時頁資料（契約 §9 1.16），
   舊資料缺的依編號讀週索引補。找不到（已刪或代號錯）顯示說明與回本日焦點。hashchange 重畫。
   依賴 A.bar、A.rows（要有 link()：部署空窗配到舊 rows.js 時只放一行說明）；A.look 選用。
   日段沿用 series.css 的 .sp-sec／.sp-dh／.sp-list；其餘樣式在 adhoc.css（.ah／.ah-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const R = A.rows && typeof A.rows.link === 'function' && typeof A.rows.byImportance === 'function' ? A.rows : null;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/; // 同 publish.py 的暫時頁路徑
  // 補欄位時取週索引輕量條目的這幾項（同索引建置補進暫時頁資料的欄位；家數等不放，上方小字只有系列與時刻）
  const DERIVED = ['event_at', 'series', 'weight', 'heat_rank', 'last_update', 'title', 'line'];
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const valid = (iso) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

  // ── 外觀：新聞各頁共用（air-news-look）；沒有 A.look 就不列「一般」 ──
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  let look = LOOKS[0][0];
  try {
    const v = localStorage.getItem(KEY_LOOK);
    if (LOOKS.some((x) => x[0] === v)) look = v;
  } catch (e) { /* 讀不到：用預設 */ }
  root.setAttribute('data-look', look);

  function hashText() {
    const raw = location.hash.slice(1);
    try { return decodeURIComponent(raw).trim(); } catch (e) { return raw.trim(); }
  }

  // ── 系列（index.json）──
  const indexDoc = A.getJSON('index.json').catch(() => null);
  let index = null;
  function meta(id) {
    const s = list(index && index.series).find((x) => x && x.id === id) || {};
    return { short: str(s.short) || str(s.title) || id, group: str(s.group) };
  }
  // M/D（不是今年加年份）
  function md(iso) {
    const k = R.dayOf(iso);
    if (!k) return '';
    return `${k.slice(0, 4) === R.today().slice(0, 4) ? '' : `${k.slice(0, 4)}/`}${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
  }

  // ── 報頭工具列（bar.js；樣式摘要 5.1）：新聞首頁（連本日焦點）　右邊一組：系列｜議題｜版面；暫時頁不標 aria-current ──
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

  const head = (title, below = []) => h('header', { class: 'masthead ah-head' }, [
    h('h1', { class: 'mast-title ah-title', tabindex: '-1' }, [title]), ...below,
  ]);
  const backLink = () => h('a', { class: 'ah-back', href: './' }, ['回本日焦點']);

  // ── 資料 ──
  // 暫時頁的卡：編號合法、有標題、不重複；缺事件時間的（舊資料）依編號讀週索引補 DERIVED 那幾項
  async function cardsOf(doc) {
    const seen = new Set();
    const cards = list(doc.cards).filter((c) => {
      if (!c || typeof c !== 'object' || !R.cardPath(c.id) || !str(c.title) || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    const need = cards.filter((c) => !valid(c.event_at));
    if (!need.length) return cards;
    const found = new Map();
    const paths = [...new Set(need.map((c) => R.cardPath(c.id).replace(/\d{4}\.json$/, 'index.json')))];
    (await Promise.all(paths.map((p) => A.getJSON(p).catch(() => null)))).forEach((d) => list(d && d.cards).forEach((e) => {
      if (e && typeof e.id === 'string') found.set(e.id, e);
    }));
    return cards.map((c) => {
      const e = !valid(c.event_at) && found.get(c.id);
      if (!e) return c;
      const add = {};
      DERIVED.forEach((k) => { if (e[k] !== undefined && e[k] !== null) add[k] = e[k]; });
      add.event_at = R.eventAt(e);
      return { ...c, ...add };
    });
  }

  // ── 一頁 ──
  // 日段：同系列頁（段標題黏在工具列下方、右邊張數），新到舊；同一天內 byImportance。找不到事件時間的接在最後「時間不明」
  function sections(cards) {
    const timed = cards.filter((c) => valid(c.event_at));
    const odd = cards.filter((c) => !valid(c.event_at));
    const imp = R.byImportance((c) => c.event_at);
    const one = (c) => R.link(c, { meta, time: valid(c.event_at) ? R.time(c.event_at, R.hm(c.event_at), R.mdw(c.event_at)) : null, tag: 'li' });
    const sec = (id, title, items, day) => h('section', { class: 'sp-sec ah-day', id, 'aria-labelledby': `${id}-h`, 'data-day': day || null }, [
      h('h2', { class: 'sp-dh', id: `${id}-h` }, [h('span', { class: 'sp-dh-t' }, [title]), h('span', { class: 'sp-n' }, [`${items.length} 張`])]),
      h('ol', { class: 'sp-list', role: 'list' }, items.map(one).filter(Boolean)),
    ]);
    const days = [...new Set(timed.map((c) => R.dayOf(c.event_at)))].sort().reverse();
    const out = days.map((day) => sec(`d-${day}`, R.dayLabel(day), timed.filter((c) => R.dayOf(c.event_at) === day).sort(imp), day));
    if (odd.length) out.push(sec('d-none', '時間不明', odd));
    return out;
  }

  function page(slug, doc, cards) {
    const title = str(doc.title).trim() || slug;
    const built = valid(doc.built_at) ? `${md(doc.built_at)} ${R.hm(doc.built_at)} 查詢` : '';
    return {
      title,
      kids: [
        head(title, [
          h('p', { class: 'ah-sub' }, [['臨時查詢', built, `${cards.length} 張`].filter(Boolean).join('・')]),
          h('p', { class: 'ah-note' }, ['這是臨時查詢的結果頁，7 天內沒有再查就會刪除；裡面的新聞卡不受影響，連結照樣能開。']),
        ]),
        h('main', { id: 'main', class: 'ah' }, cards.length ? sections(cards) : [h('p', { class: 'ah-empty' }, ['這次查詢沒有收進任何新聞卡。'])]),
        // 記號說明（rows.js；舊 rows.js 沒有 legend 就不放）
        ...(cards.length && R.legend ? [R.legend()] : []),
      ],
    };
  }
  // 已刪、代號錯、內容不是這份：同一個說明
  const gone = () => ({
    title: '找不到這份臨時查詢',
    kids: [head('找不到這份臨時查詢'), h('main', { id: 'main', class: 'ah' }, [h('p', { class: 'ah-miss' }, [
      '這份臨時查詢已刪除或不存在；裡面的新聞卡照樣能從本日焦點、系列頁、議題頁找到。', backLink(),
    ])])],
  });
  const failed = (err) => {
    const why = err instanceof SyntaxError ? '資料格式不對' : (err && err.message) || String(err);
    return {
      title: '臨時查詢載入失敗',
      kids: [head('臨時查詢載入失敗'), h('main', { id: 'main', class: 'ah' }, [h('p', { class: 'load-error', role: 'alert' }, [
        `原因：${why}。重新整理再試一次。`, backLink(),
      ])])],
    };
  };

  // ── 畫頁：換 hash 時捲回頂端、焦點移到標題（首次開頁不搶焦點）；較晚發出的請求才算數 ──
  let ticket = 0;
  function show(p, moved) {
    const focused = document.activeElement;
    app.replaceChildren(toolbar(), ...p.kids);
    document.title = `${p.title}｜AI Reports`;
    if (moved) {
      window.scrollTo(0, 0);
      app.querySelector('h1').focus({ preventScroll: true });
    } else if (focused && focused.isConnected && focused !== document.activeElement) {
      focused.focus({ preventScroll: true }); // 版面面板隨工具列重建搬家
    }
  }

  async function load(moved) {
    const my = ++ticket;
    index = await indexDoc;
    if (srBox === undefined) srBox = B.seriesMenu ? B.seriesMenu(index, null) : null;
    const slug = hashText();
    if (!R) { // 部署空窗：新 HTML 配到缺檔或舊的 rows.js（沒有 link()）
      show({ title: '臨時查詢', kids: [head('臨時查詢'), h('main', { id: 'main', class: 'ah' }, [h('p', { class: 'load-error', role: 'status' }, [
        '這一頁剛更新，有些檔案還沒到；過幾分鐘重新整理再試。', backLink(),
      ])])] }, moved);
      return;
    }
    let p;
    if (!SLUG_RE.test(slug)) p = gone();
    else {
      try {
        const doc = await A.getJSON(`adhoc/${slug}.json`);
        if (!doc || typeof doc !== 'object' || (doc.slug && doc.slug !== slug)) p = gone();
        else p = page(slug, doc, await cardsOf(doc));
      } catch (err) {
        p = /^HTTP 404$/.test(err && err.message) ? gone() : failed(err);
      }
    }
    if (my === ticket) show(p, moved);
  }

  layoutPanel();
  window.addEventListener('hashchange', () => {
    load(true).catch((err) => console.error('暫時頁顯示失敗', err));
  });
  load(false).catch((err) => { // 出錯也不能停在「載入中…」
    console.error('暫時頁顯示失敗', err);
    app.textContent = '頁面顯示失敗，重新整理再試一次。';
  });
})();
