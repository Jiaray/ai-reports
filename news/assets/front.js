/* 頭版（不帶 t 或 t=general；其他 t 交給 report.js），兩種：
   - 本日焦點（news/、舊網址 ?f=、?t=general）：讀 cards/focus.json，取看的當下往回 window_hours（24）小時內的前 limit（10）張新聞卡；
     一張都沒有時列整份的前 limit 張並標最後更新（設計 §6.8、契約 §9）。不按日期翻頁、不按整點分段：一條清單照 focus.json 的順序
     （樣式摘要 5.5）；條目是 A.rows 的列表列（頁內展開）；過濾標籤依系列。每日頭版已停用，舊檔不再讀。
   - 每週頭版（?w、?w=YYYY-Www）：讀 index.json、front/index.json 與該週頭版檔，畫成時間軸。
   兩種都不標「新」（依每台裝置的瀏覽紀錄算，碰到用詞規則）；舊的 air-front-seen 開頁時刪掉。
   依賴 A.bar（bar.js 報頭元件）；A.facets、A.look、A.rows 選用（載入失敗就少該功能；沒有 A.rows 時本日焦點退回標題連結清單）；
   每週頭版條目沿用 report.css 標題讀法（data-read=scan）的 .peek／.row-*。 */
(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  const t = query.get('t');
  if (t && t !== 'general') return; // 綜合早報頁併入本日焦點（設計 §6.2）
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const WEEK_RE = /^\d{4}-W\d{2}$/;
  const FILTER_KEY = 'air-front-types'; // ["finance", …]：選中的系列代號（本日焦點、每週頭版共用）
  try {
    localStorage.removeItem('air-front-filter'); // 舊版依領域過濾的選擇
    localStorage.removeItem('air-front-seen'); // 舊版「新」標記的瀏覽紀錄
  } catch (e) { /* 存取不了：沒有可刪的 */ }
  const weekMode = !t && query.has('w');
  const want = (weekMode && query.get('w')) || null;

  // A.look 不在（look-standard.js 載入失敗）→ 不列「一般」
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  function storedLook() {
    let v = null;
    try { v = localStorage.getItem(KEY_LOOK); } catch (e) { /* 讀不到：用預設 */ }
    return LOOKS.some((x) => x[0] === v) ? v : LOOKS[0][0];
  }
  let look = storedLook();
  const standard = () => look === 'standard';
  const applyLook = () => root.setAttribute('data-look', look);
  root.setAttribute('data-read', 'scan');
  applyLook();
  app.classList.add('fp');

  let index = null; // 抓不到＝null，系列資訊改用頭版檔的 reports
  let dates = []; // 有每週頭版的週，新到舊
  let front = null; // 每週頭版檔（本日焦點時一直是 null）
  let fpBox = null; // 「版面」下拉（layoutPanel 建一次，每次重畫搬進新工具列）
  let srBox = null; // 「系列 ▾」下拉（index 到了建一次；舊版 bar.js 沒有 seriesMenu 就不放）
  const R = A.rows || null; // 列表列（rows.js）；部署空窗缺檔＝null

  // ── 日期與時間（台北）──
  const taipei = (ms) => new Date(ms + TAIPEI_MS).toISOString(); // 台北時間的 ISO（Z 只是佔位）
  const today = () => taipei(Date.now()).slice(0, 10);
  const weekday = (iso) => WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`; // 2026-11-18 → 11/18
  const dayLabel = (iso) => `${md(iso)}（${weekday(iso)}）`; // → 11/18（三）
  // ISO 週（同週報期別）：該週星期四所在的年
  function isoWeek(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const y = d.getUTCFullYear();
    return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`;
  }
  const period = () => front.week;

  // ── 系列 ──
  function seriesRank(id) {
    const order = ((index && index.series) || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }
  const bySeries = (a, b) => seriesRank(a) - seriesRank(b) || (a < b ? -1 : a > b ? 1 : 0);
  // short 一律取 series[].short（不從標題推）；舊資料沒有 short → 用標題
  function seriesMeta(id) {
    const s = ((index && index.series) || []).find((x) => x.id === id);
    const r = ((front && front.reports) || []).find((x) => x.series === id);
    const it = ((index && index.items) || []).find((x) => x.series === id);
    const title = (s && s.title) || (r && r.series_title) || (it && it.series_title) || id;
    return {
      title,
      short: (s && s.short) || title,
      group: (s && s.group) || (r && r.group) || '其他',
      cadence: (s && s.cadence) || (it && it.cadence) || '',
    };
  }
  // 系列短名；顏色由 report.css 依 data-group（領域）給
  const typeTag = (id) => {
    const m = seriesMeta(id);
    return h('span', { class: 'fp-ty', 'data-group': m.group }, [m.short]);
  };
  const reportHref = (series, p, no) => `?t=${encodeURIComponent(series)}&d=${encodeURIComponent(p)}${no != null ? `#item-${no}` : ''}`;

  // ── 熱門徽章與摘要分段：與 report.js 的 hotInfo、paragraphs 相同，改一邊要改兩邊 ──
  function hotInfo(it) {
    if (/^hot$/i.test((it.left || '').trim())) return { label: 'HOT', from: 'left' };
    if ((it.heat || '').trim() === '爆') return { label: '爆', from: 'heat' };
    const tg = (it.tags || []).find((x) => x.cls === 'tag-hot');
    return tg ? { label: tg.text, from: 'tag', tag: tg } : null;
  }
  const OPEN = '「『（(〔【';
  const CLOSE = '」』）)〕】';
  const ENDS = '。！？';
  function paragraphs(html, min = 60) {
    const textLen = (s) => s.replace(/<[^>]*>/g, '').length;
    const out = [];
    html.split(/<br\s*\/?>/i).forEach((block) => {
      const paras = [];
      let cur = '';
      let depth = 0;
      let inline = 0;
      let last = '';
      for (let i = 0; i < block.length; i++) {
        const ch = block[i];
        if (ch === '<') {
          const end = block.indexOf('>', i);
          if (end < 0) {
            cur += block.slice(i);
            break;
          }
          inline += block[i + 1] === '/' ? -1 : 1;
          cur += block.slice(i, end + 1);
          i = end;
          continue;
        }
        cur += ch;
        if (OPEN.includes(ch)) depth += 1;
        else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
        const sentenceEnd = (ENDS.includes(ch) && depth === 0) || (CLOSE.includes(ch) && depth === 0 && ENDS.includes(last));
        last = ch;
        if (sentenceEnd && inline === 0 && textLen(cur) >= min) {
          paras.push(cur.trim());
          cur = '';
        }
      }
      if (cur.trim()) {
        if (paras.length && textLen(cur) < min / 2) paras[paras.length - 1] += cur;
        else paras.push(cur.trim());
      }
      out.push(...paras);
    });
    return out.filter(Boolean);
  }

  // ── 時間軸 ──
  function when(ts) {
    const ms = ts ? Date.parse(ts) : NaN;
    if (Number.isNaN(ms)) return null;
    const x = taipei(ms);
    return { ms, day: x.slice(0, 10), hm: x.slice(11, 16) };
  }
  // 要聞預覽的純文字：DOMParser 不執行腳本、不載圖片
  const plainText = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();

  // 時段標題：每週頭版依日期「11/20（五）」
  const dayHead = (label) => h('h2', { class: 'fp-hr' }, [label]);

  // ── 一則條目 ──
  // 原生 <details>：鍵盤、報讀器、頁內尋找（收合的也找得到、找到自動展開）直接可用。
  // 標題用 span 不用 h3（部分報讀器把 summary 當按鈕、丟掉裡面的標題）；summary 裡不放連結。
  // o.types：系列代號（第一個的領域給色線）；o.from：[{ series, period, no }]；o.stamp：系列後的灰字節點；
  // o.lead：第一順位（收合時另露摘要預覽）。data-fq＝系列代號（空白分隔），快速過濾比對用
  function tlRow(it, o) {
    const hot = hotInfo(it);
    const title = h('span', { class: 'row-title' }, [it.title || '']);
    if (hot) title.prepend(h('span', { class: 'hot-badge' }, [hot.label]));
    const acts = [];
    if (it.src) acts.push(h('span', { class: 'tag tag-neutral' }, [it.src]));
    (it.tags || []).forEach((tg) => {
      if (!(hot && hot.tag === tg)) acts.push(h('span', { class: `tag ${tg.cls || ''}` }, [tg.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) acts.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    if (it.url) acts.push(h('a', { class: 'fp-act', href: it.url, target: '_blank', rel: 'noopener' }, ['看原文 ↗']));
    // 出自：灰字「出自」＋報紙圖示＋系列全名，連到該期報告的這一則（#item-NN）；圖示同工具列（日報 front、週報月報 weekly）；
    // 每個系列一個、「、」隔開、照系列順序
    const linked = new Set();
    const srcLinks = [];
    (o.from || []).filter((f) => f && f.series && f.period).sort((a, b) => bySeries(a.series, b.series)).forEach((f) => {
      if (linked.has(f.series)) return;
      linked.add(f.series);
      const m = seriesMeta(f.series);
      if (srcLinks.length) srcLinks.push(h('span', { class: 'fp-from-sep' }, ['、']));
      srcLinks.push(h('a', { class: 'fp-act fp-series', href: reportHref(f.series, f.period, f.no) }, [
        h('span', { class: 'fp-series-ico', html: B.ICON[(m.cadence || 'daily') === 'daily' ? 'front' : 'weekly'] || '' }), m.title,
      ]));
    });
    if (srcLinks.length) acts.push(h('span', { class: 'fp-from' }, [h('span', { class: 'fp-from-lab' }, ['出自']), ...srcLinks]));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    // 定案：AI 解讀直接展開在頭版（不放連到報告頁的「看 AI 解讀」）
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      ps[0].prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
      body.push(h('div', { class: 'row-dive' }, ps));
    }
    const types = o.types || [];
    // 分類標籤：開關接在 .fp-acts 列尾、清單放該列下方；ctx 傳條目上已顯示的標題、系列、來源、標籤供去重
    const fx = A.facets && it.facets ? A.facets.parts(it.facets, {
      title: it.title || '', types: types.map((x) => seriesMeta(x).short), src: it.src,
      tags: [...(it.tags || []).map((tg) => tg.text), it.heat, hot && hot.label].filter(Boolean),
    }) : null;
    if (fx) {
      // 隔開出自與分類；兩者都在才放
      if (srcLinks.length) acts.push(h('span', { class: 'fp-sep', 'aria-hidden': 'true' }));
      acts.push(fx.toggle);
    }
    body.push(h('div', { class: 'fp-acts' }, acts));
    if (fx) body.push(fx.panel);
    const meta = h('span', { class: 'fp-mt' }, [...types.map(typeTag), o.stamp || null]);
    // 預覽與展開後的摘要同一段字 → 對報讀器隱藏
    const pre = o.lead && it.summary_html ? h('span', { class: 'fp-pre', 'aria-hidden': 'true' }, [plainText(it.summary_html)]) : null;
    const cls = ['fp-row', 'fp-it'];
    if (o.lead) cls.push('is-lead');
    if (hot) cls.push('is-hot');
    return h('article', {
      class: cls.join(' '), id: o.id, 'data-group': types.length ? seriesMeta(types[0]).group : null, 'data-fq': types.join(' '),
    }, [
      h('details', { class: 'peek' }, [
        h('summary', { class: 'peek-sum' }, [meta, title, pre]),
        h('div', { class: 'more-body' }, body),
      ]),
    ]);
  }

  // ── 報頭（bar.js 元件）──
  const weekHref = (w) => (w === dates[0] ? '?w' : `?w=${w}`);
  const here = () => (period() === dates[0] ? 'page' : 'true'); // aria-current：最新一期 page、其他期 true
  const frontLink = (current) => B.navLink('本日焦點', 'front', './', current);
  const TITLE = weekMode ? '本週回顧' : '本日焦點';
  const cadenceOf = (e) => e.cadence || seriesMeta(e.series).cadence || 'daily';

  function weeklyLink(current) {
    const any = ((index && index.items) || []).some((e) => e && e.series && e.period && cadenceOf(e) !== 'daily');
    return any || weekMode ? B.navLink('本週回顧', 'weekly', '?w', current) : null;
  }
  // 工具列（樣式摘要 5.1）：日期（只有每週頭版）｜系列 ▾｜本日焦點｜本週回顧｜議題｜版面。舊版 bar.js 沒有 storyLink 就不放議題
  const toolbar = (date, frontCur, weekCur) => B.toolbar([
    date, srBox, frontLink(frontCur), weeklyLink(weekCur), B.storyLink ? B.storyLink(null) : null, fpBox,
  ]);

  // 日期面板：左欄＝這週出刊的報告（當週週報＋當週發布的月報），右欄＝有每週頭版的週。
  // 定案：換週、換系列都從這裡進，頭版不放 ‹ › 換週鈕與底部系列列
  function datePicker() {
    const p = period();
    const mine = (e) => (cadenceOf(e) === 'weekly' ? e.period === p
      : cadenceOf(e) === 'monthly' && DATE_RE.test(e.date || '') && isoWeek(e.date) === p);
    const list = [];
    ((index && index.items) || []).forEach((e) => {
      if (e && e.series && e.period && mine(e) && !list.some((x) => x.series === e.series)) list.push(e);
    });
    list.sort((a, b) => bySeries(a.series, b.series));
    return B.datePicker({
      period: p,
      cadence: 'weekly',
      here: list.map((e) => ({ text: e.series_title || seriesMeta(e.series).title, count: e.count, href: reportHref(e.series, e.period) })),
      periods: dates.map((d) => ({ period: d, href: weekHref(d), current: d === p })),
    });
  }

  // 開最新一週但不是本週時，非當期提示接「…這是最近一期」（定案：併入提示條，不另起一行）。
  // 定案：大標題不加下拉，右邊是過濾標籤
  const masthead = (types) => [
    B.staleBanner(period(), period() === dates[0] ? '本週還沒有回顧，這是最近一期' : null),
    toolbar(datePicker(), null, here()),
    h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...filterBar(types)]),
  ];

  // ── 快速過濾（本日焦點、每週頭版）──
  // 標籤照系列順序、後接則數或張數（屬於多個系列的條目各算一次）；系列少於兩個不放。
  // 都沒選＝全部；否則顯示任一系列有選到的條目；空時段整段藏；有選才出現「清除」（不另放「全部」）。
  // 選擇存 air-front-types（兩頁共用）：換週、下次開都沿用；不進網址（分享出去不帶自己的篩選）；這頁沒有的系列照樣記著，只套用這頁有的
  const UNIT_WORD = weekMode ? '則' : '張';
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
  let picked = readFilter(); // 含這週沒有的系列；存不進 localStorage 時仍有效
  let fq = null; // { chips, clear, status, sync }；沒有標籤列＝null

  // types：[{ t: 系列代號, n: 則數 }]，已排序。
  // bar.js 過濾面板照抄 .fp-chip 的 data-type、data-group、.fp-chip-t、.fp-chip-n、aria-pressed，並代按 .fp-fq-clear；
  // 議題目錄（story.js filterBar）用同一套標記，改一邊要改兩邊
  function filterBar(types) {
    fq = null;
    if (types.length < 2) return [];
    const chips = types.map(({ t: id, n }) => {
      const m = seriesMeta(id);
      const b = h('button', { type: 'button', class: 'fp-chip', 'data-type': id, 'data-group': m.group, 'aria-pressed': 'false' }, [
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

  // announce＝剛按了標籤 → status 唸結果。條目＝#main 裡帶 data-fq 的（每週頭版 .fp-it、本日焦點 .rw）
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
    app.querySelectorAll('#main .fp-sec').forEach((s) => { s.hidden = !s.querySelector('[data-fq]:not([hidden])'); });
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

  const weekFooter = () => h('footer', { class: 'foot' }, [
    h('span', { class: 'foot-left' }, ['本週回顧從當週各週報、月報標出的重點整理，同一則新聞只列一次']),
  ]);

  function show(kids) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    // 下拉隨重畫搬家時焦點掉到 body → 放回原按鈕（條目的焦點由 render 還原）
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  // ── 每週頭版整頁 ──
  // 重畫不打斷閱讀：記下展開中與焦點所在的條目，畫完還原
  function render() {
    const opened = new Set([...app.querySelectorAll('.fp-row')].filter((el) => el.querySelector('details[open]')).map((el) => el.id));
    const active = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-row');
    const focusId = active ? active.id : null;
    const chipFocus = chipFocusNow();

    const list = (front.entries || []).filter((e) => e && e.key && Array.isArray(e.from) && e.from.length);
    // 第一順位（各報告最重要的那則）→ lead
    const top = list.length ? Math.min(...list.map((e) => e.rank)) : 0;
    // 新到舊；沒有時間的排最後；再依順位、系列順序
    const timed = list.map((e) => ({ e, w: when(e.ts) }));
    timed.sort((a, b) => (a.w && b.w ? b.w.ms - a.w.ms : (a.w ? -1 : 0) + (b.w ? 1 : 0))
      || a.e.rank - b.e.rank || bySeries(a.e.from[0].series, b.e.from[0].series) || (a.e.key < b.e.key ? -1 : 1));
    const entryRow = (e, w) => tlRow(e, {
      id: `fp-${e.key}`,
      types: [...new Set(e.from.map((f) => f.series))].sort(bySeries),
      from: e.from,
      stamp: w ? h('time', { class: 'fp-tm', datetime: e.ts }, [w.hm]) : null,
      lead: e.rank === top,
    });
    // 每天一個 <section>：日期標題只在自己那段黏頂（被下一段推走，不疊在一起）；過濾後空的整段藏。順便數各系列則數
    const tl = [];
    const counts = new Map();
    let group = null;
    const addRow = (row) => {
      tl[tl.length - 1].append(row);
      row.dataset.fq.split(' ').filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    };
    timed.forEach(({ e, w }) => {
      const g = w ? w.day : '-';
      if (g !== group) {
        group = g;
        tl.push(h('section', { class: 'fp-sec' }, [dayHead(w ? dayLabel(w.day) : '其他時間')]));
      }
      addRow(entryRow(e, w));
    });
    const types = [...counts.keys()].sort(bySeries).map((x) => ({ t: x, n: counts.get(x) }));
    const main = h('main', { id: 'main', class: 'fp-tl' }, tl.length ? tl : [h('p', { class: 'load-error' }, ['這週的回顧沒有條目。'])]);
    if (standard() && A.look) A.look.arrangeFront(main);
    show([...masthead(types), main, weekFooter()]);
    document.title = `${TITLE} ${B.periodLabel(front.week, 'weekly')}｜AI Reports`;
    opened.forEach((id) => {
      const d = document.getElementById(id);
      if (d) d.querySelector('details').open = true;
    });
    applyFilter(false);
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && !el.hidden) el.querySelector('summary').focus({ preventScroll: true });
    }
    restoreChip(chipFocus);
  }

  // 還沒有任何每週頭版（front/index.json 不存在或沒有週）：列各週報、月報最新一期
  function noFront() {
    const items = (index && index.items) || [];
    const latest = [];
    items.forEach((e) => {
      if (e && e.series && e.period && cadenceOf(e) !== 'daily' && !latest.some((x) => x.series === e.series)) latest.push(e);
    });
    latest.sort((a, b) => bySeries(a.series, b.series));
    const kids = [
      toolbar(null, null, 'page'),
      h('header', { class: 'masthead' }, [h('h1', { class: 'mast-title' }, [TITLE])]),
      h('main', { id: 'main', class: 'fp-empty' }, [
        h('p', { class: 'fp-empty-note', role: 'status' }, [latest.length ? `還沒有${TITLE}。先看各系列最新一期：` : `還沒有${TITLE}，也還沒有任何報告。`]),
        latest.length ? h('ul', { class: 'fp-empty-list' }, latest.map((e) => {
          const m = seriesMeta(e.series);
          return h('li', null, [h('a', { href: reportHref(e.series, e.period) }, [
            e.series_title || m.title,
            h('span', { class: 'fp-empty-when' }, [A.fmtShort(e.period, e.cadence || m.cadence)]),
          ])]);
        })) : null,
      ]),
      weekFooter(),
    ];
    if (!index) kids.splice(3, 0, h('p', { class: 'load-error', role: 'alert' }, ['新聞清單也載入失敗，重新整理再試一次。']));
    show(kids);
    document.title = `${TITLE}｜AI Reports`;
  }

  // 載入出錯：工具列（沒有日期按鈕）＋錯誤訊息
  function problem(text, more) {
    show([
      toolbar(null, weekMode ? null : 'page', null),
      h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text, more || null])]),
    ]);
    document.title = `${TITLE}｜AI Reports`;
  }

  // 週的年＝ISO 年＝期別前四碼
  const frontPath = (w) => `front/${w.slice(0, 4)}/${w}.json`;
  const validWeeks = (doc) => (doc && Array.isArray(doc.weeks) ? doc.weeks : [])
    .map((x) => x && x.week).filter((w) => typeof w === 'string' && WEEK_RE.test(w));

  async function weekMain() {
    // index、週清單、議題對照表並行抓；頭版檔要等週清單
    const [idx, list] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON('front/index.json'), A.facets ? A.facets.load() : null]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    srBox = B.seriesMenu ? B.seriesMenu(index, null) : null;
    dates = list.status === 'fulfilled' ? validWeeks(list.value) : [];
    if (!dates.length) {
      noFront();
      return;
    }
    const w = want || dates[0];
    if (!WEEK_RE.test(w) || !dates.includes(w)) {
      problem(`找不到 ${w} 的${TITLE}。`, h('a', { href: '?w' }, [`看最新${TITLE}`]));
      return;
    }
    try {
      front = await A.getJSON(frontPath(w));
    } catch (err) {
      problem(`這週的${TITLE}載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    if (!isFront(front, w)) {
      problem(`${w} 的${TITLE}內容不完整，重新整理再試一次。`);
      return;
    }
    render();
  }
  // 期別要等於要開的那期：防手改壞或部署到一半時硬畫
  const isFront = (doc, w) => !!doc && typeof doc === 'object' && doc.week === w;

  // ── 回前景更新：週清單或頭版檔 built_at 變了才重畫；指定了週不跳，開最新的換到新的一週 ──
  let ready = false; // 首次載入完成前不重抓（開頁時的 visibilitychange）
  let refreshing = false;
  async function refreshWeek() {
    let prev = null;
    try {
      const doc = await A.getJSON('front/index.json').catch(() => null);
      if (!doc) return;
      const next = validWeeks(doc);
      if (!next.length) return;
      const datesChanged = next.join() !== dates.join();
      const w = want || next[0];
      if (!next.includes(w)) return;
      const doc2 = await A.getJSON(frontPath(w)).catch(() => null);
      if (!isFront(doc2, w)) return;
      const changed = datesChanged || !front || doc2.week !== front.week || doc2.built_at !== front.built_at;
      prev = [dates, front];
      dates = next;
      front = doc2;
      if (changed) render();
    } catch (err) {
      // render 出錯時畫面仍是上一版 → 狀態一併退回
      if (prev) [dates, front] = prev;
      console.error('頭版更新失敗', err);
    }
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
  const notGeneral = (c) => [...new Set((Array.isArray(c.series) ? c.series : []).filter((s) => typeof s === 'string' && s !== 'general'))].sort(bySeries);
  // 每則標多久前（focus_at；滑過看完整時間）；data-ago：每分鐘更新
  const agoTime = (c, now) => {
    const ms = focusAt(c);
    const el = R ? R.time(c.focus_at || c.born_at, ago(ms, now), stamp(ms)) : h('time', { class: 'fp-tm', datetime: c.focus_at || c.born_at, title: stamp(ms) }, [ago(ms, now)]);
    el.setAttribute('data-ago', '');
    return el;
  };

  // 一張新聞卡＝列表列（rows.js）：本頁＝綜合（general），上方小字與展開後的「系列」都不列；第一張露一句話
  const cardRow = (c, lead, now) => R.row({ ...c, series: notGeneral(c) }, {
    meta: seriesMeta, page: 'general', time: agoTime(c, now), lead, tag: 'li',
  });
  // 部署空窗沒有 rows.js：系列・多久前・更新｜標題連到新聞卡頁｜一句話（前一版的清單）
  const updated = (c) => focusAt(c) > Date.parse(c.born_at) || Boolean(c.last_update && c.last_update.refocus === true);
  function focusRow(c, lead, now) {
    const types = notGeneral(c);
    const meta = h('p', { class: 'fp-mt' }, [
      ...types.map(typeTag),
      agoTime(c, now),
      updated(c) ? h('span', { class: 'fp-upd' }, ['更新']) : null,
      c.online_only === true ? h('span', { class: 'fp-online' }, [
        h('span', { class: 'fp-online-ico', html: B.ICON.warn }), '網路討論，未經媒體證實',
      ]) : null,
    ]);
    return h('li', {
      class: `fp-it fp-card${lead ? ' is-lead' : ''}`, 'data-group': types.length ? seriesMeta(types[0]).group : '綜合', 'data-id': c.id, 'data-fq': types.join(' '),
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
    const rows = cards.map((c, i) => (R ? cardRow(c, i === 0, now) : focusRow(c, i === 0, now))).filter(Boolean);
    // 過濾標籤：各系列張數（一張屬於多個系列各算一次）
    const counts = new Map();
    rows.forEach((r) => r.dataset.fq.split(' ').filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
    const types = [...counts.keys()].sort(bySeries).map((x) => ({ t: x, n: counts.get(x) }));
    const main = h('main', { id: 'main', class: 'fp-focus' }, rows.length
      ? [h('ol', { class: 'fp-list', role: 'list' }, rows)]
      : [h('p', { class: 'fp-empty-note', role: 'status' }, ['本日焦點還沒有新聞卡。'])]);
    show([
      note,
      toolbar(null, 'page', null),
      h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...filterBar(types)]),
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
  }

  async function focusMain() {
    const [idx, doc] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON(FOCUS_PATH)]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    srBox = B.seriesMenu ? B.seriesMenu(index, null) : null;
    if (doc.status === 'fulfilled') focus = doc.value && typeof doc.value === 'object' ? doc.value : {};
    else if (/^HTTP 404$/.test(doc.reason && doc.reason.message)) focus = {}; // 還沒建 → 當沒有卡
    else {
      problem(`${TITLE}載入失敗（${doc.reason instanceof SyntaxError ? '資料格式不對' : doc.reason.message}），重新整理再試一次。`);
      return;
    }
    renderFocus();
    setInterval(() => { if (document.visibilityState === 'visible') tickFocus(); }, 60000);
  }
  // 回前景重抓：清單、built_at 都沒變只更新多久前（不收起展開中的列）；沒抓到也照現在時間重切
  async function refreshFocus() {
    const doc = await A.getJSON(FOCUS_PATH).catch(() => null);
    if (doc && typeof doc === 'object') focus = doc;
    tickFocus();
  }

  // 回前景（含 bfcache 回來）：本日焦點一律重抓、照現在重切時間窗（有變才重畫），每週頭版有變才重畫
  async function refresh() {
    if (!ready || refreshing || document.visibilityState !== 'visible') return;
    if (weekMode ? !front : !focus) return; // 首次載入失敗的頁面不重畫
    refreshing = true;
    try {
      await (weekMode ? refreshWeek() : refreshFocus());
    } catch (err) {
      console.error('頭版更新失敗', err);
    } finally {
      refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });

  // ── 「版面」下拉：外觀＋配色；沿用 report.css 的 .dd-*／.vw-*，id 用 fp-* ──
  function setLook(v) {
    const was = standard();
    look = v;
    try { localStorage.setItem(KEY_LOOK, v); } catch (e) { /* 存不了：只套用本頁 */ }
    // 每週頭版進出「一般」才重畫（條目排法不同）；藍圖↔地圖、本日焦點只換 data-look（樣式全在 CSS）。
    // view transition 同報告頁（減少動態由 report.css 取消）。
    // masthead() 組新工具列時面板就搬家、焦點已掉到 body（show() 記不到）→ 這裡先記、畫完放回
    const swap = () => {
      const focused = document.activeElement;
      applyLook();
      if (front && standard() !== was) render();
      if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
    };
    if (document.startViewTransition) document.startViewTransition(swap);
    else swap();
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
  (weekMode ? weekMain() : focusMain())
    .catch((err) => { // 出錯也不能停在「載入中…」
      console.error('頭版載入失敗', err);
      const msg = `${TITLE}顯示失敗，重新整理再試一次。`;
      try { problem(msg); } catch (e) { app.textContent = msg; } // 錯誤頁也畫不出來 → 至少換掉載入中
    })
    .finally(() => { ready = true; });
})();
