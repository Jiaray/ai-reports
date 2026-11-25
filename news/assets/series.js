/* 新聞卡系列頁（news/?t=<新聞卡日報系列>；樣式摘要第 7 節），掛 AIR.series（介面見檔尾）。
   report.js 讀完 index.json、確定是新聞卡系列後呼叫 render(ctx)；工具列、「版面」沿用 report.js 的。這支沒載到時 report.js 顯示施工中。
   讀 cards/recent.json，列近 7 天（台北日曆日：今天往回 6 天）這個系列的新聞卡，依天分段、新到舊；條目是 rows.js 的列表列。
   - 放哪天：事件時間（event_at）那天；補充過的移到最後補充（supplemented_at）那天，上方小字的時間改寫「新生 M/D」；更正、掛來源不移。
   - 同一天內：事件分量 → heat_rank → 時間新到舊（rows.js byImportance；時間用放那天的時刻）；每段第一張露一句話。
   - 資安：頂端「要修補的漏洞」（事件類型含漏洞揭露），依急迫性 → 同上；exploited 標「遭利用」；列過的不再進日段。
   - 鄉民：每天再分 PTT、HN、V2EX 三區，各依該平台熱度排、只列 > 0；同一張卡在幾個平台有熱度就列幾次（〈不重複〉的例外）。
   - 遊戲：同一天內主題含網頁遊戲的排前面。
   - &d=YYYY-MM-DD：7 天內捲到那段（那天沒卡就捲到更早最近的一段），超過停在頁首。
   回前景重抓 recent.json，built_at 或台北日期變了才重畫（展開中的列保持展開）。依賴 A.bar、A.rows；樣式在 series.css（.sp／.sp-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  // 缺 rows.js 或舊版（沒有分天排序工具）：不接手，report.js 退回施工中
  if (!A || !A.bar || !A.rows || typeof A.rows.byImportance !== 'function') return;
  const h = A.h;
  const B = A.bar;
  const R = A.rows;
  const DAYS = 7;
  const PATH = 'cards/recent.json';
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const PATCH_EVENT = '漏洞揭露';
  const WEB_GAME = '網頁遊戲';
  const PLATFORMS = [['ptt', 'PTT', '推'], ['hn', 'HN', '分'], ['v2ex', 'V2EX', '回覆']]; // 鄉民頁分區順序與熱度單位
  const CADENCE = { daily: '日', weekly: '週', monthly: '月' };
  // 頁尾的收錄條件（設計文件 §6.8，改成白話；程式條件在 news-aggregator views.py）
  const RULES = {
    international: '台灣以外地區的新聞；以科技、金融市場、企業經營、娛樂與媒體、生活與休閒、遊戲、博奕為主的不收',
    tech_ai: '主題含 AI 的新聞',
    tech: '主題含科技的新聞，以及半導體、軟體與雲端、網路平台、硬體與消費電子、電信業的企業經營新聞；以 AI 或資安為主的不收',
    security: '主題含資安的新聞；「要修補的漏洞」收事件類型是漏洞揭露的，依急迫性、事件分量排',
    finance: '主題含財經，且跟台灣直接相關，或間接相關且事件分量中以上',
    health: '主題含健康與醫療的新聞',
    gambling: '主題或產業含博奕的新聞',
    gamedev: '主題或產業含遊戲的新聞；同一天內網頁遊戲排前面',
    taiwan_general: '跟台灣直接相關的新聞；以金融市場為主的不收',
    taiwan_disaster: '跟台灣直接相關的災害、事故、天氣新聞與公衛事件',
    social: 'PTT、HN、V2EX 上有討論熱度的新聞；每天依平台分區，各依該平台的熱度排',
  };
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);
  const valid = (iso) => typeof iso === 'string' && !Number.isNaN(Date.parse(iso));

  let ctx = null; // { app, index, t, d, toolbar }
  let doc = null; // recent.json（還沒建＝{}）
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
  const webGame = (c) => (Array.isArray(c.topic_all) ? c.topic_all : list(c.topic)).includes(WEB_GAME);

  // ── 一列（rows.js）；左緣色線用這頁的領域色（樣式摘要示意頁）；data-k＝區｜編號（重畫後還原展開，鄉民頁同卡多列）──
  function rowOf(x, o = {}) {
    const time = x.moved
      ? R.time(x.ev, `新生 ${md(x.ev)}`, R.mdw(x.ev))
      : R.time(x.ev, o.full ? `${md(x.ev)} ${R.hm(x.ev)}` : R.hm(x.ev), R.mdw(x.ev));
    const el = R.row(x.c, { meta, page: ctx.t, time, lead: o.lead, tag: 'li', flag: o.flag, extra: o.extra });
    if (!el) return null;
    el.dataset.group = meta(ctx.t).group || el.dataset.group || '';
    el.dataset.k = `${o.zone || ''}|${x.c.id}`;
    return el;
  }
  const rowsList = (rows) => h('ol', { class: 'sp-list', role: 'list' }, rows.filter(Boolean));
  // 分段：<section>＋黏頂標題（只在自己那段黏住，被下一段推走）；標題可被程式移焦點（&d=）
  const section = (id, cls, title, n, kids, day) => h('section', { class: `sp-sec ${cls}`, id, 'aria-labelledby': `${id}-h`, 'data-day': day || null }, [
    h('h2', { class: 'sp-dh', id: `${id}-h`, tabindex: '-1' }, [h('span', { class: 'sp-dh-t' }, [title]), h('span', { class: 'sp-n' }, [`${n} 張`])]),
    ...kids,
  ]);

  // ── 整頁 ──
  function build() {
    const all = pageCards();
    const atOf = new Map(all.map((x) => [x.c, x.at]));
    const imp = R.byImportance((c) => atOf.get(c) || R.eventAt(c));
    const t = ctx.t;
    let rest = all;
    const out = [];
    const shown = new Set();
    // 資安：要修補的漏洞
    if (t === 'security') {
      const patch = all.filter((x) => list(x.c.event).includes(PATCH_EVENT))
        .sort((a, b) => R.level(a.c.urgency) - R.level(b.c.urgency) || imp(a.c, b.c));
      if (patch.length) {
        rest = all.filter((x) => !patch.includes(x));
        patch.forEach((x) => shown.add(x.c.id));
        out.push(section('sp-patch', 'sp-patch', '要修補的漏洞', patch.length, [
          rowsList(patch.map((x) => rowOf(x, { full: true, zone: 'patch', flag: x.c.exploited === true ? '遭利用' : '' }))),
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
        let lead = true;
        const zones = PLATFORMS.map(([k, name, unit]) => {
          const zi = items.filter((x) => community(x.c, k)).sort((a, b) => community(b.c, k) - community(a.c, k) || imp(a.c, b.c));
          if (!zi.length) return null;
          const rows = zi.map((x) => {
            const r = rowOf(x, { zone: k, lead, extra: [`${community(x.c, k)} ${unit}`] });
            lead = false;
            return r;
          });
          return h('div', { class: 'sp-zone', 'data-zone': k }, [
            h('h3', { class: 'sp-zh' }, [h('span', { class: 'sp-zh-t' }, [name]), h('span', { class: 'sp-n' }, [`${zi.length} 張`])]),
            rowsList(rows),
          ]);
        }).filter(Boolean);
        out.push(section(id, 'sp-day', R.dayLabel(day), items.length, zones, day));
        return;
      }
      items.sort((a, b) => (t === 'gamedev' ? webGame(b.c) - webGame(a.c) : 0) || imp(a.c, b.c));
      out.push(section(id, 'sp-day', R.dayLabel(day), items.length, [rowsList(items.map((x, i) => rowOf(x, { lead: i === 0 })))], day));
    });
    return { sections: out, count: shown.size };
  }

  // 沒有卡：系列面板裡的其他系列（bar.js seriesGroups；舊 bar.js 沒有就只列新聞卡系列）
  function others() {
    const g = B.seriesGroups ? B.seriesGroups(ctx.index)
      : { cards: (B.cardSeries ? B.cardSeries(ctx.index) : []).filter((s) => s.id !== 'general'), reports: [] };
    const link = (s, text) => h('a', { class: 'sp-go', href: `./?t=${encodeURIComponent(s.id)}`, 'data-group': s.group || null }, [text]);
    const cards = g.cards.filter((s) => s.id !== ctx.t).map((s) => link(s, s.short || s.title || s.id));
    const reports = g.reports.flatMap((r) => r.list.map((s) => link(s, r.list.length > 1 ? `${r.name} ${CADENCE[s.cadence] || ''}報` : s.short || s.title || s.id)));
    const col = (id, name, items) => (items.length ? h('div', { class: 'sp-go-col' }, [
      h('h2', { class: 'sp-go-h', id }, [name]),
      h('ul', { class: 'sp-go-list', 'aria-labelledby': id }, items.map((a) => h('li', null, [a]))),
    ]) : null);
    const kids = [col('sp-go-cards', '新聞卡（近 7 天）', cards), col('sp-go-reports', '照舊的報告', reports)].filter(Boolean);
    return kids.length ? h('nav', { class: 'sp-go-box', 'aria-label': '其他系列' }, kids) : null;
  }

  function show(kids) {
    const focused = document.activeElement;
    ctx.app.replaceChildren(...kids.filter(Boolean));
    // 下拉隨重畫搬家時焦點掉到 body → 放回原按鈕
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  // 重畫不打斷閱讀：記下展開中的列與焦點所在的列，畫完還原（卡檔已在 rows.js 快取）
  function draw() {
    const app = ctx.app;
    const rowOfEl = (el) => (el && el.closest ? el.closest('#main [data-k]') : null);
    const opened = new Set([...app.querySelectorAll('#main [data-k]')].filter((el) => el.querySelector('details[open]')).map((el) => el.dataset.k));
    const active = rowOfEl(document.activeElement);
    const activeK = active ? active.dataset.k : null;
    const short = meta(ctx.t).short;
    const { sections, count } = build();
    const rule = RULES[ctx.t];
    show([
      ctx.toolbar(),
      h('header', { class: 'masthead sp-head' }, [
        h('h1', { class: 'mast-title' }, [short]),
        h('p', { class: 'sp-sub' }, [count ? `近 ${DAYS} 天・${count} 張` : `近 ${DAYS} 天`]),
      ]),
      h('main', { id: 'main', class: 'sp' }, count ? sections : [
        h('p', { class: 'sp-empty', role: 'status' }, [`近 ${DAYS} 天沒有符合的新聞卡。`]),
        others(),
      ]),
      rule ? h('footer', { class: 'foot sp-foot' }, [h('span', { class: 'foot-left' }, [`${short}收錄：${rule}`])]) : null,
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
  }

  // &d=：7 天內捲到那天那段（新到舊，第一個不晚於那天的段）；超過、格式不對停在頁首。
  // 等下一個畫面：bar.js 量好 --bar-h（scroll-padding-top）才不會被凍結的工具列蓋住；焦點移到段標題（不再捲）
  function jump(d) {
    const today = R.today();
    if (!DATE_RE.test(d) || d > today || d < R.shiftDay(today, -(DAYS - 1))) return;
    const target = [...ctx.app.querySelectorAll('#main .sp-day')].find((s) => s.dataset.day <= d);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      target.querySelector('.sp-dh').focus({ preventScroll: true });
    });
  }

  function problem(text) {
    show([ctx.toolbar(), h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text])])]);
    document.title = `${meta(ctx.t).short}｜AI Reports`;
  }

  // recent.json：還沒建（404）＝沒有卡；其他錯誤丟出
  async function load() {
    try {
      const v = await A.getJSON(PATH);
      return v && typeof v === 'object' ? v : {};
    } catch (err) {
      if (/^HTTP 404$/.test(err && err.message)) return {};
      throw err;
    }
  }

  // ctx：{ app: #app, index: index.json, t: 系列代號, d: 網址的 d, toolbar: () => 工具列 }。不會丟出（錯誤畫在頁上）
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
      jump(ctx.d || '');
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
