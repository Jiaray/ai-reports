/* 新聞卡系列頁（news/?t=<系列>；樣式摘要第 7 節），掛 AIR.series（介面見檔尾）。
   report.js 讀完 index.json、確定是其中的系列後呼叫 render(ctx)；工具列、「版面」沿用 report.js 的。
   讀 cards/recent.json，列近 7 天（台北日曆日：今天往回 6 天）這個系列的新聞卡，依天分段、新到舊；條目是 rows.js 的列表列。
   - 放哪天：事件時間（event_at）那天；補充過的移到最後補充（supplemented_at）那天，上方小字的時間改寫「新增 M/D」；更正、掛來源不移。
   - 報頭一行「系列名　近 7 天・N 張 …… [最新｜重要]」；排序預設最新（放那天的時刻新到舊），存 air-series-sort（所有系列頁共用）。
   - 同一天內（排序選重要）：事件分量 → heat_rank → 時間新到舊（rows.js byImportance；時間用放那天的時刻）；每張都同樣只列標題（沒有頭條樣式，使用者定案）。
     以下各頁的排法也都是「重要」；選最新時分區照留，區內一律新到舊。
   - 資安：頂端「要修補的漏洞」（事件類型含漏洞揭露），依急迫性 → 同上；遭利用是 rows.js 的列記號（exploited）；列過的不再進日段。
   - 列記號（緊急、遭利用、重要、熱門、切身）由 rows.js 畫；main 後、頁尾前放記號說明（rows.js legend）。
   - 鄉民：每天再分 PTT、HN、V2EX 三區，各依該平台熱度排、只列 > 0；同一張卡在幾個平台有熱度就列幾次（〈不重複〉的例外）。
   - 財經：每天再分台灣（台灣關聯直接）、國際兩區，各依重要程度排；兩區都全部直接列出（不收合，使用者定案）。
   - 遊戲開發：同一天內網頁遊戲開發類（主題含網頁遊戲，或同時含遊戲和開發與開源；views.web_dev）排前面，最新、重要都套。
   回前景重抓 recent.json，built_at 或台北日期變了才重畫（展開中的列保持展開）。依賴 A.rows（工具列由 report.js 給）；樣式在 series.css（.sp／.sp-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const R = A.rows;
  const DAYS = 7;
  const PATH = 'cards/recent.json';
  const PATCH_EVENT = '漏洞揭露';
  const PLATFORMS = [['ptt', 'PTT', '推'], ['hn', 'HN', '分'], ['v2ex', 'V2EX', '回覆']]; // 鄉民頁分區順序與熱度單位
  const FIN_ZONES = [['taiwan', '台灣'], ['intl', '國際']]; // 財經頁分區順序；台灣＝輕量條目 taiwan 是「直接」（views.finance_zone）
  // 頁尾的收錄條件（新聞統一改版設計 §6 的系列頁條件，改成白話；程式條件在 news-aggregator views.py）
  const RULES = {
    taiwan_general: '跟台灣直接相關的新聞；以金融市場為主的不收',
    social: 'PTT、HN、V2EX 上有討論熱度的新聞；每天依平台分區，各依該平台的熱度排',
    cross_strait: '主題含兩岸的新聞，以及地區含中國大陸、港澳的政治、國際關係、國防、戰爭、社會、犯罪與司法新聞',
    politics: '主題含政治（含選舉）、國際關係、國防與軍事、戰爭與衝突的新聞',
    society: '主題含社會（含人權、移民與難民）、犯罪與司法、勞動、教育、災害與事故的新聞',
    finance: '主題含財經的新聞；每天分台灣（跟台灣直接相關）、國際兩區，各依重要程度排',
    ai: '主題含 AI 的新聞',
    tech: '主題含科技的新聞，以及半導體、軟體與雲端、網路平台、硬體與消費電子、電信業的企業經營新聞；以 AI 或資安為主的不收',
    security: '主題含資安的新聞；「要修補的漏洞」收事件類型是漏洞揭露的，依急迫性、事件分量排',
    github: '形式是開源專案的新聞卡',
    papers: '形式是論文的新聞卡',
    science: '主題含科學的新聞',
    health: '主題含健康與醫療的新聞',
    environment: '主題含環境與氣候、能源的新聞',
    life: '主題含生活與休閒、交通、天氣的新聞',
    culture: '主題含文化藝術的新聞',
    entertainment: '主題含娛樂與媒體的新聞',
    sports: '主題含體育的新聞',
    game_dev: '主題或產業含遊戲的新聞；同一天內網頁遊戲開發（主題含網頁遊戲，或同時含遊戲和開發與開源）排前面',
    gambling: '主題或產業含博奕的新聞',
    reading: '形式是長文或播客的新聞卡',
  };
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const valid = (iso) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

  // ── 排序「最新｜重要」（決策 2026-11-26）：預設最新；存 air-series-sort（所有系列頁共用，不進網址）。
  //    最新＝放那天的時刻（max(事件時間, 補充時間)）新到舊；重要＝原本各頁的排法。頁內分區（要修補的漏洞、鄉民三平台、財經台灣／國際）都保留，只改區內順序 ──
  const SORT_KEY = 'air-series-sort';
  const ico = (body) => `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">${body}</svg>`;
  const SORTS = [
    ['new', '最新', ico('<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 5.6V10l3 2" fill="none" stroke="currentColor" stroke-width="1.7"/>')], // 時鐘
    ['imp', '重要', ico('<circle cx="10" cy="4.4" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.4 7.8h9.2l2.6 10.4H2.8z" fill="currentColor"/>')], // 秤砣
  ];
  function readSort() {
    let v = null;
    try { v = localStorage.getItem(SORT_KEY); } catch (e) { /* 讀不到：用預設 */ }
    return SORTS.some((s) => s[0] === v) ? v : SORTS[0][0];
  }
  let sort = readSort();

  let ctx = null; // { app, index, t, toolbar }
  let doc = null; // recent.json
  let drawnKey = ''; // 台北日期｜built_at：回前景時變了才重畫

  // ── 系列 ──
  const seriesOf = (id) => list(ctx.index && ctx.index.series).find((s) => s && s.id === id) || {};
  function meta(id) {
    const s = seriesOf(id);
    return { short: s.short || s.title || id, group: s.group || '' };
  }

  // ── 時間：M/D（不是今年加年份）、M/D HH:MM ──
  function md(iso) {
    const k = R.dayOf(iso);
    if (!k) return '';
    return `${k.slice(0, 4) === R.today().slice(0, 4) ? '' : `${k.slice(0, 4)}/`}${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
  }

  // ── 這頁的卡：{ c, ev（事件時間）, at（放那天的時刻）, day, moved } ──
  // 補充時間比事件時間晚才移（late 卡的事件時間是最早報導）；比今天晚（裝置時鐘慢）算今天
  function placed(c) {
    const ev = R.eventAt(c);
    const sup = valid(c.supplemented_at) && Date.parse(c.supplemented_at) > Date.parse(ev) ? c.supplemented_at : '';
    const at = sup || ev;
    const today = R.today();
    const day = R.dayOf(at) > today ? today : R.dayOf(at);
    return { c, ev, at, day, moved: Boolean(sup) && R.dayOf(sup) !== R.dayOf(ev) };
  }
  function pageCards() {
    const first = R.shiftDay(R.today(), -(DAYS - 1));
    const seen = new Set();
    return list(doc && doc.cards).filter((c) => {
      if (!c || typeof c !== 'object' || !R.cardPath(c.id) || !str(c.title) || c.dup_of || seen.has(c.id)) return false;
      if (!list(c.series).includes(ctx.t) || !valid(R.eventAt(c))) return false;
      seen.add(c.id);
      return true;
    }).map(placed).filter((x) => x.day >= first);
  }
  const community = (c, k) => {
    const n = c.heat && c.heat.community && c.heat.community[k];
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  };
  // 網頁遊戲開發類（同 news-aggregator views.web_dev）
  const webDev = (c) => {
    const t = Array.isArray(c.topic_all) ? c.topic_all : list(c.topic);
    return t.includes('網頁遊戲') || (t.includes('遊戲') && t.includes('開發與開源'));
  };
  const finZone = (c) => (c.taiwan === '直接' ? 'taiwan' : 'intl');

  // ── 一列（rows.js）；左緣色線用這頁的領域色（樣式摘要示意頁）；data-k＝區｜編號（重畫後還原展開，鄉民頁同卡多列）──
  function rowOf(x, o = {}) {
    const time = x.moved
      ? R.time(x.ev, `新增 ${md(x.ev)}`, R.mdw(x.ev))
      : R.time(x.ev, o.full ? `${md(x.ev)} ${R.hm(x.ev)}` : R.hm(x.ev), R.mdw(x.ev));
    const el = R.row(x.c, { meta, page: ctx.t, time, tag: 'li', extra: o.extra });
    if (!el) return null;
    el.dataset.group = meta(ctx.t).group || el.dataset.group || '';
    el.dataset.k = `${o.zone || ''}|${x.c.id}`;
    return el;
  }
  const rowsList = (rows) => h('ol', { class: 'sp-list', role: 'list' }, rows.filter(Boolean));
  // 段內一區（鄉民的平台、財經的台灣／國際）：區名＋張數，下接清單（全部直接列出）
  function zone(k, name, n, rows) {
    return h('div', { class: 'sp-zone', 'data-zone': k }, [
      h('h3', { class: 'sp-zh' }, [h('span', { class: 'sp-zh-t' }, [name]), h('span', { class: 'sp-n' }, [`${n} 張`])]),
      rowsList(rows),
    ]);
  }
  // 分段：<section>＋黏頂標題（只在自己那段黏住，被下一段推走）
  const section = (id, cls, title, n, kids) => h('section', { class: `sp-sec ${cls}`, id, 'aria-labelledby': `${id}-h` }, [
    h('h2', { class: 'sp-dh', id: `${id}-h` }, [h('span', { class: 'sp-dh-t' }, [title]), h('span', { class: 'sp-n' }, [`${n} 張`])]),
    ...kids,
  ]);

  // ── 整頁 ──
  function build() {
    const all = pageCards();
    const atOf = new Map(all.map((x) => [x.c, x.at]));
    const imp = R.byImportance((c) => atOf.get(c) || R.eventAt(c));
    const ms = (iso) => Date.parse(iso) || 0;
    const latest = sort === 'new' ? (a, b) => ms(b.at) - ms(a.at) || imp(a.c, b.c) : null; // 最新：放那天的時刻新到舊
    const t = ctx.t;
    let rest = all;
    const out = [];
    const shown = new Set();
    // 資安：要修補的漏洞
    if (t === 'security') {
      const patch = all.filter((x) => list(x.c.event).includes(PATCH_EVENT))
        .sort(latest || ((a, b) => R.level(a.c.urgency) - R.level(b.c.urgency) || imp(a.c, b.c)));
      if (patch.length) {
        rest = all.filter((x) => !patch.includes(x));
        patch.forEach((x) => shown.add(x.c.id));
        out.push(section('sp-patch', 'sp-patch', '要修補的漏洞', patch.length, [
          rowsList(patch.map((x) => rowOf(x, { full: true, zone: 'patch' }))), // 遭利用是 rows.js 的記號（exploited）
        ]));
      }
    }
    // 鄉民：沒有任何平台熱度的卡哪一區都不列，整頁都不算
    if (t === 'social') rest = rest.filter((x) => PLATFORMS.some(([k]) => community(x.c, k)));
    const days = [...new Set(rest.map((x) => x.day))].sort().reverse();
    days.forEach((day) => {
      const items = rest.filter((x) => x.day === day);
      items.forEach((x) => shown.add(x.c.id));
      const id = `d-${day}`;
      if (t === 'social') {
        const zones = PLATFORMS.map(([k, name, unit]) => {
          const zi = items.filter((x) => community(x.c, k)).sort(latest || ((a, b) => community(b.c, k) - community(a.c, k) || imp(a.c, b.c)));
          if (!zi.length) return null;
          return zone(k, name, zi.length, zi.map((x) => rowOf(x, { zone: k, extra: [`${community(x.c, k)} ${unit}`] })));
        }).filter(Boolean);
        out.push(section(id, 'sp-day', R.dayLabel(day), items.length, zones));
        return;
      }
      // 財經：台灣在上、國際在下，各依重要程度，全部直接列出
      if (t === 'finance') {
        const zones = FIN_ZONES.map(([k, name]) => {
          const zi = items.filter((x) => finZone(x.c) === k).sort(latest || ((a, b) => imp(a.c, b.c)));
          if (!zi.length) return null;
          return zone(k, name, zi.length, zi.map((x) => rowOf(x, { zone: k })));
        }).filter(Boolean);
        out.push(section(id, 'sp-day', R.dayLabel(day), items.length, zones));
        return;
      }
      items.sort((a, b) => (t === 'game_dev' ? webDev(b.c) - webDev(a.c) : 0) || (latest ? latest(a, b) : imp(a.c, b.c)));
      out.push(section(id, 'sp-day', R.dayLabel(day), items.length, [rowsList(items.map((x) => rowOf(x)))]));
    });
    return { sections: out, count: shown.size };
  }

  // 沒有卡：系列面板裡的其他系列（index.json 的系列，照它的順序）
  function others() {
    const cards = A.bar.cardSeries(ctx.index).filter((s) => s.id !== ctx.t)
      .map((s) => h('a', { class: 'sp-go', href: `./?t=${encodeURIComponent(s.id)}`, 'data-group': s.group || null }, [s.short || s.title || s.id]));
    if (!cards.length) return null;
    return h('nav', { class: 'sp-go-box', 'aria-label': '其他系列' }, [h('div', { class: 'sp-go-col' }, [
      h('h2', { class: 'sp-go-h', id: 'sp-go-cards' }, ['新聞卡（近 7 天）']),
      h('ul', { class: 'sp-go-list', 'aria-labelledby': 'sp-go-cards' }, cards.map((a) => h('li', null, [a]))),
    ])]);
  }

  function show(kids) {
    const focused = document.activeElement;
    ctx.app.replaceChildren(...kids.filter(Boolean));
    // 下拉隨重畫搬家時焦點掉到 body → 放回原按鈕
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  // 排序鈕（報頭右邊；手機在系列名右邊）：按了存起來、整頁重畫（展開中的列保持展開）、焦點留在這顆
  function sortBar() {
    return h('div', { class: 'sp-sort', role: 'group', 'aria-label': '排序' }, SORTS.map(([v, text, icon]) => {
      const b = h('button', { type: 'button', class: 'sp-sort-b', 'data-v': v, 'aria-pressed': String(sort === v) }, [
        h('span', { class: 'sp-sort-ico', html: icon }), h('span', null, [text]),
      ]);
      b.addEventListener('click', () => {
        if (sort === v) return;
        sort = v;
        try { localStorage.setItem(SORT_KEY, v); } catch (e) { /* 存不了：只套用這次 */ }
        draw();
      });
      return b;
    }));
  }
  // 別的分頁改了排序 → 跟著換
  window.addEventListener('storage', (e) => {
    if ((e.key !== SORT_KEY && e.key !== null) || !ctx || readSort() === sort) return;
    sort = readSort();
    draw();
  });

  // 重畫不打斷閱讀：記下展開中的列與焦點所在的列（或排序鈕），畫完還原（卡檔已在 rows.js 快取）
  function draw() {
    const app = ctx.app;
    const rowOfEl = (el) => (el && el.closest ? el.closest('#main [data-k]') : null);
    const opened = new Set([...app.querySelectorAll('#main [data-k]')].filter((el) => el.querySelector('details[open]')).map((el) => el.dataset.k));
    const active = rowOfEl(document.activeElement);
    const activeK = active ? active.dataset.k : null;
    const sortBtn = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.sp-sort-b') : null;
    const short = meta(ctx.t).short;
    const { sections, count } = build();
    const rule = RULES[ctx.t];
    show([
      ctx.toolbar(),
      // 報頭一行：系列名　近 7 天・N 張 …… [最新｜重要]（手機：系列名＋排序一行，近 7 天・N 張下一行；series.css）
      h('header', { class: 'masthead sp-head' }, [
        h('h1', { class: 'mast-title' }, [short]),
        h('p', { class: 'sp-sub' }, [count ? `近 ${DAYS} 天・${count} 張` : `近 ${DAYS} 天`]),
        count ? sortBar() : null,
      ]),
      h('main', { id: 'main', class: 'sp' }, count ? sections : [
        h('p', { class: 'sp-empty', role: 'status' }, [`近 ${DAYS} 天沒有符合的新聞卡。`]),
        others(),
      ]),
      count ? R.legend() : null, // 記號說明
      rule ?h('footer', { class: 'foot sp-foot' }, [h('span', { class: 'foot-left' }, [`${short}收錄：${rule}`])]) : null,
    ]);
    document.title = `${short}｜AI Reports`;
    drawnKey = `${R.today()}|${(doc && doc.built_at) || ''}`;
    const find = (k) => [...app.querySelectorAll('#main [data-k]')].find((el) => el.dataset.k === k);
    opened.forEach((k) => {
      const d = find(k) && find(k).querySelector('details');
      if (d) d.open = true;
    });
    const back = activeK && find(activeK);
    if (back) back.querySelector('summary').focus({ preventScroll: true });
    const again = sortBtn && app.querySelector(`.sp-sort-b[data-v="${sortBtn.dataset.v}"]`);
    if (again) again.focus({ preventScroll: true });
  }

  function problem(text) {
    show([ctx.toolbar(), h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text])])]);
    document.title = `${meta(ctx.t).short}｜AI Reports`;
  }

  // recent.json：抓不到或不是物件就丟出（畫成載入失敗）
  async function load() {
    const v = await A.getJSON(PATH);
    if (!v || typeof v !== 'object') throw new SyntaxError('recent.json 不是物件');
    return v;
  }

  // ctx：{ app: #app, index: index.json, t: 系列代號, toolbar: () => 工具列 }。不會丟出（錯誤畫在頁上）
  async function render(c) {
    ctx = c;
    try {
      doc = await load();
    } catch (err) {
      problem(`新聞卡清單載入失敗（${err instanceof SyntaxError ? '資料格式不對' : err.message}），重新整理再試一次。`);
      return;
    }
    try {
      draw();
    } catch (err) {
      console.error('系列頁顯示失敗', err);
      problem('系列頁顯示失敗，重新整理再試一次。');
      return;
    }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
  }

  // 回前景（含 bfcache）：重抓；台北日期或 built_at 變了才重畫（跨午夜「今天」「昨天」要換）
  let refreshing = false;
  async function refresh() {
    if (refreshing || document.visibilityState !== 'visible' || !doc) return;
    refreshing = true;
    try {
      const next = await load().catch(() => null);
      if (next) doc = next;
      if (`${R.today()}|${(doc && doc.built_at) || ''}` !== drawnKey) draw();
    } catch (err) {
      console.error('系列頁更新失敗', err);
    } finally {
      refreshing = false;
    }
  }

  A.series = { render };
})();
