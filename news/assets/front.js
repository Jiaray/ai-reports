/* 頭版（news/ 不帶 t 參數）：讀 index.json（類型設定與各類型最新報告）、front/index.json（有頭版的日期與週，新到舊）
   與那一期的頭版檔，照使用者選定的樣版 B（時間軸）渲染。兩種頭版（使用者要求：日報的頭版不放週報，週報另有自己的頭版）：
   - 每日頭版（本日新聞）：news/ 開最新一天、?f=YYYY-MM-DD 開指定日期；檔案 front/<年>/<日期>.json，依整點分組。
   - 每週頭版（本週新聞）：news/?w 開最新一週、?w=YYYY-Www 開指定週；檔案 front/<ISO 年>/<YYYY-Www>.json（當週的週報與月報），依日期分組。
   帶 t 參數是報告頁，這支什麼都不做（交給 report.js）。site.js 是 defer、排在本檔前面，執行時 window.AIR 已經在。
   *_html 欄位是 publish.py 淨化過的片段（只留 http/https 連結與粗體），其餘欄位一律當純文字（AIR.h 的子節點字串）。 */
(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('t')) return; // 報告頁由 report.js 負責
  const A = window.AIR;
  // 部署後的快取空窗：瀏覽器還拿著舊的 index.html（沒有載入 bar.js）、卻拿到新的這支——補載 bar.js 後重跑這支，
  // 不然頁面會停在「載入中…」（report.js 同一段，兩支共用同一次載入 A.barLoad）
  if (!A.bar) {
    const self = document.currentScript && document.currentScript.src;
    if (!self) return;
    A.barLoad = A.barLoad || new Promise((ok, ko) => {
      const s = document.createElement('script');
      const u = new URL('bar.js', self);
      u.search = new URL(self).search; // 帶同一個版本號（?v=），不拿到快取裡的舊 bar.js
      s.src = u.href;
      s.onload = ok;
      s.onerror = ko;
      document.head.append(s);
    });
    A.barLoad.then(() => document.head.append(Object.assign(document.createElement('script'), { src: self })), () => {});
    return;
  }
  const h = A.h;
  const B = A.bar; // 報頭的共用元件（bar.js）
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const WEEK_RE = /^\d{4}-W\d{2}$/;
  const SEEN_KEY = 'air-front-seen';
  const SEEN_DAYS = 7;
  const SEEN_WEEKS = 2;
  const FILTER_KEY = 'air-front-types'; // 快速過濾選了哪些類型（["finance","gambling"]）
  try { localStorage.removeItem('air-front-filter'); } catch (e) { /* 舊版依領域過濾的選擇，已不用 */ }
  const weekMode = query.has('w'); // 每週頭版
  const PERIOD_RE = weekMode ? WEEK_RE : DATE_RE;
  // 指定的日期（週）；沒有就開最新一期（書籤與主畫面固定開最新）
  const want = (weekMode ? query.get('w') : query.get('f')) || null;

  // 條目沿用報告頁速讀讀法的樣式（報告頁的讀法選擇不影響頭版）。外觀和報告頁共用 air-news-look：
  // 記住的是「一般」就用一般（look-standard.js 把時間軸搬成頭條＋要聞卡片＋即時新聞）；「地圖」用地圖的樣式
  // （使用者要求：色票、字型、報頭等高線與地圖風格的過濾標籤，全在 CSS；條目排法同藍圖），其他是藍圖。
  // 部署後的快取空窗拿到舊 index.html（沒載入 look-standard.js、A.look 不在）時不列「一般」、照藍圖畫
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  function storedLook() {
    let v = null;
    try { v = localStorage.getItem(KEY_LOOK); } catch (e) { /* 無痕或停用儲存：用預設 */ }
    return LOOKS.some((x) => x[0] === v) ? v : LOOKS[0][0];
  }
  let look = storedLook();
  const standard = () => look === 'standard';
  const applyLook = () => root.setAttribute('data-look', look); // look 一定是 LOOKS 裡的值（storedLook 檢查過）
  root.setAttribute('data-read', 'scan');
  applyLook();
  app.classList.add('fp');

  let index = null; // news/index.json；抓不到時為 null，類型資訊改用頭版檔自己的 reports
  let dates = []; // 有頭版的日期（每週頭版：週），新到舊
  let front = null; // 目前顯示的頭版檔
  let fpBox = null; // 「版面」按鈕＋面板（layoutPanel 建一次），每次重畫時放進報頭上方那一列的右端
  const marked = new Map(); // 這次開頁以來標過「新」的 key（日期 → Set）：回前景重畫時照樣標著

  // ── 日期與時間（台北） ────────────────────────────────────────────
  const taipei = (ms) => new Date(ms + TAIPEI_MS).toISOString(); // 台北時間的 ISO 字串（Z 當作台北）
  const today = () => taipei(Date.now()).slice(0, 10);
  const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const weekday = (iso) => WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`; // 2026-11-18 → 11/18
  const dayLabel = (iso) => `${md(iso)}（${weekday(iso)}）`; // → 11/18（三）
  // ISO 週（同週報期別 YYYY-Www）：那一週的星期四落在哪一年就是哪一年的週
  function isoWeek(iso) {
    const t = new Date(`${iso}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y = t.getUTCFullYear();
    return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`;
  }
  const period = () => (weekMode ? front.week : front.date); // 這頁的期別

  // ── 類型 ──────────────────────────────────────────────────────────
  // 類型順序（spec 6.3）：index.json 的 series 順序；不在裡面的臨時主題排最後、彼此依代號排
  function seriesRank(id) {
    const order = ((index && index.series) || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }
  const bySeries = (a, b) => seriesRank(a) - seriesRank(b) || (a < b ? -1 : a > b ? 1 : 0);
  // 類型的短名、標題、領域與週期：短名一律取資料的 series[].short（不從標題推）；舊資料沒有 short 時用標題
  function seriesMeta(id) {
    const s = ((index && index.series) || []).find((x) => x.id === id);
    const r = ((front && front.reports) || []).find((x) => x.series === id);
    const it = ((index && index.items) || []).find((x) => x.series === id);
    const title = (s && s.title) || (r && r.series_title) || (it && it.series_title) || id;
    return {
      title,
      short: (s && s.short) || title,
      group: (s && s.group) || (r && r.group) || '主題',
      cadence: (s && s.cadence) || (it && it.cadence) || '',
    };
  }
  // 類型名稱：純文字、用領域色（時間軸樣版 B，不再是外框標籤）
  const typeTag = (id) => {
    const m = seriesMeta(id);
    return h('span', { class: 'fp-ty', 'data-group': m.group }, [m.short]);
  };
  const reportHref = (series, period, no) => `?t=${encodeURIComponent(series)}&d=${encodeURIComponent(period)}${no != null ? `#item-${no}` : ''}`;

  // ── 這台裝置看過的條目（localStorage air-front-seen：{ "<日期>": ["<key>", …] }，只留最近 7 天）──
  // 每次存取都包 try/catch：無痕模式或停用網站資料時讀不到就不標「新」、寫不進去就算了，畫面照常
  function readSeen() {
    let raw;
    try {
      raw = localStorage.getItem(SEEN_KEY);
    } catch (e) {
      return null; // 讀不到：不標「新」
    }
    try {
      const v = raw ? JSON.parse(raw) : {};
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {}; // 內容壞了：當作沒看過，之後重寫
    }
  }
  // 記多久：日期留 7 天、週留 2 週（含這週）
  const keep = (p) => (DATE_RE.test(p) ? p >= addDays(today(), 1 - SEEN_DAYS)
    : WEEK_RE.test(p) && p >= isoWeek(addDays(today(), -7 * (SEEN_WEEKS - 1))));
  // 這一天（週）要標「新」的 key：第一次看全部不標（之後才進來的才標）；太舊的不記也不標
  function freshKeys(date, keys) {
    const set = marked.get(date) || new Set();
    marked.set(date, set);
    const all = readSeen();
    if (all && keep(date) && Array.isArray(all[date])) {
      const before = new Set(all[date]);
      keys.forEach((k) => { if (!before.has(k)) set.add(k); });
    }
    return set;
  }
  // 畫面渲染後記下這天的 key（和舊紀錄合併），順便丟掉 7 天前的紀錄
  function remember(date, keys) {
    const all = readSeen();
    if (!all || !keep(date)) return;
    const next = {};
    Object.keys(all).forEach((d) => {
      if (keep(d) && Array.isArray(all[d])) next[d] = all[d].filter((k) => typeof k === 'string');
    });
    next[date] = [...new Set([...(next[date] || []), ...keys])];
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch (e) { /* 無法儲存（無痕、空間滿）：下次就當第一次看 */ }
  }

  // ── 同 report.js：熱門徽章的規則與摘要分段 ───────────────────────
  // 熱門：來源標 Hot、PTT 爆文，或「頭條／直播／利空」這類紅色標籤；徽章出處那個標籤或熱度不再重複顯示
  function hotInfo(it) {
    if (/^hot$/i.test((it.left || '').trim())) return { label: 'HOT', from: 'left' };
    if ((it.heat || '').trim() === '爆') return { label: '爆', from: 'heat' };
    const t = (it.tags || []).find((x) => x.cls === 'tag-hot');
    return t ? { label: t.text, from: 'tag', tag: t } : null;
  }
  // 長段落在句末（。！？）分段：只在標籤、連結、粗體與引號括號之外斷開；每段至少約 60 字（同 report.js）
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

  // ── 時間軸（使用者在三個樣版中選定的 B：整點分組）────────────────────
  // 條目的台北時間；沒有 ts 或解析不出來是 null
  function when(ts) {
    const ms = ts ? Date.parse(ts) : NaN;
    if (Number.isNaN(ms)) return null;
    const t = taipei(ms);
    return { ms, day: t.slice(0, 10), hour: t.slice(11, 13), hm: t.slice(11, 16) };
  }
  // 摘要的純文字（要聞收合時的兩行預覽用）：DOMParser 不執行腳本、不載圖片
  const plainText = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();

  // 時段標題（黏在頂端）：每日頭版是整點「10:00」（不是頭版那天的加註日期），每週頭版是日期「11/20（五）」；沒有時間的條目也用同一種標題
  const hourHead = (label, day) => h('h2', { class: 'fp-hr' }, [label, day ? h('span', { class: 'fp-hr-day' }, [day]) : null]);

  // ── 一則條目 ──────────────────────────────────────────────────────
  // 左緣一條領域色線；summary 第一行是類型＋時刻（週報月報是期別），接著標題。每輪第一順位（原本的「要聞」）
  // 淡底色、標題大一號，收合時先露兩行摘要；點開看完整摘要、AI 解讀（頭版檔的 dive_html）、來源與「看原文」。
  // 原生 <details>：鍵盤、報讀器、「在頁面中尋找」（收合的摘要也搜得到、找到時自動展開）都直接可用。
  // summary 裡的標題用 span、不用 h3（同報告頁速讀：部分螢幕閱讀器把 summary 當按鈕，會丟掉裡面的標題），也不放連結。
  // o.id：元素 id；o.types：類型 id（第一個決定色線）；o.stamp：類型後面的灰字節點；o.lead：要聞；o.isNew：標「新」；
  // o.key：頭版條目的 key（記「看過」用）。data-fq 是這則的類型（類型代號，空白分隔），快速過濾比對用
  function tlRow(it, o) {
    const hot = hotInfo(it);
    const title = h('span', { class: 'row-title' }, [it.title || '']);
    if (hot) title.prepend(h('span', { class: 'hot-badge' }, [hot.label]));
    if (o.isNew) title.append(h('span', { class: 'fp-new' }, ['新'])); // 緊接在標題後面（使用者定案）
    const acts = [];
    if (it.src) acts.push(h('span', { class: 'tag tag-neutral' }, [it.src]));
    (it.tags || []).forEach((t) => {
      if (!(hot && hot.tag === t)) acts.push(h('span', { class: `tag ${t.cls || ''}` }, [t.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) acts.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    if (it.url) acts.push(h('a', { class: 'fp-act', href: it.url, target: '_blank', rel: 'noopener' }, ['看原文 ↗']));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    // AI 解讀直接接在摘要後面（使用者要求：頭版展開就看得到，不再放跳到報告頁的「看 AI 解讀」）；樣式同報告頁
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      ps[0].prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
      body.push(h('div', { class: 'row-dive' }, ps));
    }
    body.push(h('div', { class: 'fp-acts' }, acts));
    const types = o.types || [];
    const meta = h('span', { class: 'fp-mt' }, [...types.map(typeTag), o.stamp || null]);
    // 預覽和展開後的摘要是同一段字：預覽對報讀器隱藏，summary 唸起來就只有類型、時刻與標題
    const pre = o.lead && it.summary_html ? h('span', { class: 'fp-pre', 'aria-hidden': 'true' }, [plainText(it.summary_html)]) : null;
    const cls = ['fp-row', 'fp-it'];
    if (o.lead) cls.push('is-lead');
    if (hot) cls.push('is-hot');
    return h('article', {
      class: cls.join(' '), id: o.id, 'data-group': types.length ? seriesMeta(types[0]).group : null, 'data-fq': types.join(' '),
      'data-key': o.key || null,
    }, [
      h('details', { class: 'peek' }, [
        h('summary', { class: 'peek-sum' }, [meta, title, pre]),
        h('div', { class: 'more-body' }, body),
      ]),
    ]);
  }

  // ── 報頭（使用者要求：所有頁面上方區塊統一功能；元件在 bar.js）──────────────
  // 最上面是和報告頁同一列的工具列：日期（點開是這天的新聞與有頭版的日期；每週頭版是週）、「本日新聞」（每日頭版）、
  // 「本週新聞」（每週頭版）、「版面」；這頁是哪一種就標成目前位置（最新一期 page，其他期 true）。工具列凍結在頂端。
  // 下面是大標題「頭版」（每週頭版是「週報頭版」），右邊是快速過濾標籤（使用者要求：頭版的大標題不要下拉）。
  // 原本的日期大字與 ‹ › 拿掉：日期在日期按鈕（不重複），換日用日期面板（使用者選定）
  // 網址：最新一天是 news/、其他天 ?f=YYYY-MM-DD；最新一週是 ?w、其他週 ?w=YYYY-Www（書籤固定開最新）
  const dayHref = (d) => (d === dates[0] ? './' : `?f=${d}`);
  const weekHref = (w) => (w === dates[0] ? '?w' : `?w=${w}`);
  const periodHref = (p) => (weekMode ? weekHref(p) : dayHref(p));
  const latestHref = weekMode ? '?w' : './';
  const here = () => (period() === dates[0] ? 'page' : 'true');
  const frontLink = (current) => B.navLink('本日新聞', 'front', './', current);
  const TITLE = weekMode ? '週報頭版' : '頭版';
  const cadenceOf = (e) => e.cadence || seriesMeta(e.series).cadence || 'daily';

  // 「本週新聞」（使用者要求：最上方一顆切到週報的按鈕，字數同「本日新聞」）：連到每週頭版的最新一週；
  // index.json 還沒有任何週報、月報就不顯示（使用者選定）
  function weeklyLink(current) {
    const any = ((index && index.items) || []).some((e) => e && e.series && e.period && cadenceOf(e) !== 'daily');
    return any || weekMode ? B.navLink('本週新聞', 'weekly', '?w', current) : null;
  }

  // 日期按鈕：左欄「這天的新聞」＝那天有出刊的日報（各連到那一期，右邊則數；頭版底部原本的類型列拿掉了，
  // 使用者要求，類型從這裡進），右欄有頭版的日期（各連到那天的頭版）。每週頭版：左欄「這週的新聞」＝那週的週報
  // 與那週發布的月報，右欄有頭版的週
  function datePicker() {
    const p = period();
    const mine = (e) => (weekMode
      ? (cadenceOf(e) === 'weekly' ? e.period === p : cadenceOf(e) === 'monthly' && DATE_RE.test(e.date || '') && isoWeek(e.date) === p)
      : cadenceOf(e) === 'daily' && e.period === p);
    const list = [];
    ((index && index.items) || []).forEach((e) => {
      if (e && e.series && e.period && mine(e) && !list.some((x) => x.series === e.series)) list.push(e);
    });
    list.sort((a, b) => bySeries(a.series, b.series));
    return B.datePicker({
      period: p,
      cadence: weekMode ? 'weekly' : 'daily',
      here: list.map((e) => ({ text: e.series_title || seriesMeta(e.series).title, count: e.count, href: reportHref(e.series, e.period) })),
      periods: dates.map((d) => ({ period: d, href: periodHref(d), current: d === p })),
    });
  }

  // types：這頁有的類型與則數（render 排時間軸時收集）。
  // 最上面是非當期提示（bar.js，不是台北的今天、本週才有）：開的是最新一期、今天（本週）還沒出刊時（spec 6.6），提示後面接說明
  // （使用者選定：原本大標題下那一行「今天還沒有頭版，這是最近一期」併進提示條，不出現兩個提示）。日期在日期按鈕，提示不重寫日期。
  // 部署後的快取空窗可能拿到還沒有 staleBanner 的舊 bar.js：少提示條，頁面照常
  const masthead = (types) => [
    B.staleBanner ? B.staleBanner(period(), period() === dates[0] ? (weekMode ? '本週還沒有週報頭版，這是最近一期' : '今天還沒有頭版，這是最近一期') : null) : null,
    B.toolbar([datePicker(), frontLink(weekMode ? null : here()), weeklyLink(weekMode ? here() : null), fpBox]),
    h('header', { class: 'masthead fp-head' }, [h('h1', { class: 'mast-title' }, [TITLE]), ...filterBar(types)]),
  ];

  // ── 快速過濾（互動照建議預設）──────────────────────────────────────────
  // 標籤＝這頁條目上看得到的類型名稱（使用者要求：條目寫「博奕」，標籤就是「博奕」，不要歸到領域「遊戲」；
  // index.json series 的 short：綜合、國際、AI、科技、資安、博奕、財經、健康…），順序照選單，後面是則數
  // （一則出自多份報告就每個類型都算）；色塊同條目左緣的領域色線。可多選：都沒選＝全部顯示；選了就顯示「任一份來源報告的類型
  // 有選到」的條目（出自綜合＋財經的那則，選財經時也在）；篩完沒有條目的時段連時段標題一起藏起來。
  // 有選時最後面出現「清除」（不另放「全部」）。選擇記在 localStorage air-front-types（類型代號）：換日期、下次開都沿用，不寫進網址
  // （傳出去的連結不帶自己的篩選）；這天沒有的類型照樣記著（別天出現時還是選著），畫面只套用這天有的，一個都沒有就等於沒選。
  // 結構照指南的 toolbar：role="toolbar"、按鈕用 aria-pressed（字不隨狀態改）、整列只佔一個 Tab 停點、方向鍵移動（focusgroup，
  // 不支援的瀏覽器用 roving tabindex 補）；篩選結果用 role="status" 唸「顯示 N 則」（放在 toolbar 外面）。領域少於兩個時不放標籤列。
  const CHECK = '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9"/></svg>';
  function readFilter() {
    try {
      const v = JSON.parse(localStorage.getItem(FILTER_KEY) || '[]');
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    } catch (e) {
      return new Set(); // 讀不到或內容壞了：當作沒選
    }
  }
  function saveFilter() {
    try {
      if (picked.size) localStorage.setItem(FILTER_KEY, JSON.stringify([...picked]));
      else localStorage.removeItem(FILTER_KEY);
    } catch (e) { /* 存不了（無痕、空間滿）：這次照樣能篩，下次不記得 */ }
  }
  let picked = readFilter(); // 選了的類型（含這天沒有的）；存不進 localStorage 時這份照樣有效
  let fq = null; // 這次畫面的過濾列 { chips, clear, status, sync }；沒有標籤列時是 null

  // 指南 toolbar 的鍵盤：支援 focusgroup 的瀏覽器由它處理；不支援時自己做 roving tabindex——整列只有一顆 tabindex=0，
  // 左右鍵在看得到的按鈕之間移動（到頭繞回）、Home／End 到頭尾，只攔自己處理的鍵。回傳 sync：「清除」藏起來後補回停點
  function roving(bar) {
    if ('focusGroup' in HTMLElement.prototype) return () => {};
    const items = () => [...bar.querySelectorAll('button')].filter((b) => !b.hidden);
    const sync = (cur) => {
      const list = items();
      const keep = (cur && list.includes(cur) && cur) || list.find((b) => b.tabIndex === 0) || list[0];
      bar.querySelectorAll('button').forEach((b) => { b.tabIndex = b === keep ? 0 : -1; });
    };
    bar.addEventListener('focusin', (e) => {
      const b = e.target.closest('button');
      if (b) sync(b);
    });
    bar.addEventListener('keydown', (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
      const rtl = getComputedStyle(bar).direction === 'rtl';
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      const next = step ? list[(i + step + list.length) % list.length]
        : e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : null;
      if (!next) return;
      e.preventDefault();
      next.focus();
    });
    sync();
    return sync;
  }

  // 標籤列＋念結果用的 status；types：[{ t, n }]（t 是類型代號），已照類型順序排好。
  // data-type 是比對用的類型代號、data-group 給色塊用的領域色；bar.js 的過濾面板照這兩個與 .fp-chip-t 的字抄一份
  function filterBar(types) {
    fq = null;
    if (types.length < 2) return [];
    const chips = types.map(({ t, n }) => {
      const m = seriesMeta(t);
      const b = h('button', { type: 'button', class: 'fp-chip', 'data-type': t, 'data-group': m.group, 'aria-pressed': 'false' }, [
        h('span', { class: 'fp-chip-mk', html: CHECK }), // 沒選是領域色塊、選了是勾（不只靠顏色）
        h('span', { class: 'fp-chip-t' }, [m.short]),
        h('span', { class: 'fp-chip-n' }, [String(n), h('span', { class: 'visually-hidden' }, [' 則'])]),
      ]);
      b.addEventListener('click', () => {
        if (picked.has(t)) picked.delete(t);
        else picked.add(t);
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
    const bar = h('div', { class: 'fp-fq', role: 'toolbar', 'aria-label': '依類型篩選', focusgroup: 'toolbar wrap' }, [...chips, clear]);
    const status = h('p', { class: 'visually-hidden', role: 'status' });
    fq = { chips, clear, status, sync: roving(bar) };
    return [bar, status];
  }

  // 套用目前的選擇：按鈕狀態、條目與時段的顯示、「清除」；announce＝使用者剛按了標籤，念出結果。
  // 顯示中的條目才記成「看過」：第一次看這天時 render 已經全部記下（不會一放出來整片都是「新」），
  // 之後才進來、又被篩掉的條目不記，放出來時照樣標「新」
  function applyFilter(announce) {
    const rows = [...app.querySelectorAll('.fp-tl .fp-it')];
    const on = new Set(fq ? fq.chips.map((b) => b.dataset.type).filter((t) => picked.has(t)) : []);
    if (fq) fq.chips.forEach((b) => b.setAttribute('aria-pressed', String(on.has(b.dataset.type))));
    let shown = 0;
    rows.forEach((r) => {
      const ok = !on.size || (r.dataset.fq || '').split(' ').some((t) => on.has(t));
      r.hidden = !ok;
      if (ok) shown += 1;
    });
    app.querySelectorAll('.fp-tl > .fp-sec').forEach((s) => { s.hidden = !s.querySelector('.fp-it:not([hidden])'); });
    if (fq) {
      const lost = fq.clear.contains(document.activeElement);
      fq.clear.hidden = !on.size;
      fq.sync();
      if (lost && fq.clear.hidden) fq.chips[0].focus(); // 按了「清除」它就藏起來：焦點移到第一個標籤，不掉回頁首
      if (announce) fq.status.textContent = on.size ? `顯示 ${shown} 則` : `顯示全部 ${shown} 則`;
    }
    remember(period(), rows.filter((r) => !r.hidden && r.dataset.key).map((r) => r.dataset.key));
  }
  // 別的分頁改了篩選：這頁跟著換（不念結果）
  window.addEventListener('storage', (e) => {
    if (e.key !== FILTER_KEY && e.key !== null) return;
    picked = readFilter();
    if (front && app.querySelector('.fp-tl')) applyFilter(false);
  });

  // 頁尾只留頭版的整理方式；刊名與日期上面都有了，不再重複
  const footer = () => h('footer', { class: 'foot' }, [
    h('span', { class: 'foot-left' }, [weekMode ? '週報頭版從當週各週報、月報標出的重點整理，同一則新聞只列一次'
      : '頭版從當天各日報標出的重點整理，同一則新聞只列一次']),
  ]);

  function show(kids) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    // 「版面」面板跟著重畫搬到新的那一列，搬動時焦點會掉到 body：放回原本的按鈕（條目的焦點由 render 自己還原）
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
  }

  // ── 整頁 ──────────────────────────────────────────────────────────
  // 重畫（回前景時頭版有變）不打斷閱讀：記下展開中的條目與焦點所在的條目，畫完還原
  function render() {
    const opened = new Set([...app.querySelectorAll('.fp-row')].filter((el) => el.querySelector('details[open]')).map((el) => el.id));
    const active = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-row');
    const focusId = active ? active.id : null;
    const onChip = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-fq button');
    const chipFocus = onChip ? onChip.dataset.type || '' : null; // 焦點在過濾標籤上（'' 是「清除」）：重畫後放回同一顆

    const list = (front.entries || []).filter((e) => e && e.key && Array.isArray(e.from) && e.from.length);
    const seen = readSeen();
    const firstLook = !!seen && !Array.isArray(seen[period()]); // 這台裝置第一次看這天（週）
    const fresh = freshKeys(period(), list.map((e) => e.key));
    // 「要聞」＝第 1 輪順位（各報告最重要的那則）：不再分區，改成時間軸上淡底色、標題大一號
    const top = list.length ? Math.min(...list.map((e) => e.rank)) : 0;
    // 時間軸由新到舊；沒有時間的排最後，照順位、類型順序
    const timed = list.map((e) => ({ e, w: when(e.ts) }));
    timed.sort((a, b) => (a.w && b.w ? b.w.ms - a.w.ms : (a.w ? -1 : 0) + (b.w ? 1 : 0))
      || a.e.rank - b.e.rank || bySeries(a.e.from[0].series, b.e.from[0].series) || (a.e.key < b.e.key ? -1 : 1));
    const entryRow = (e, w) => tlRow(e, {
      id: `fp-${e.key}`,
      key: e.key,
      types: [...new Set(e.from.map((f) => f.series))].sort(bySeries),
      stamp: w ? h('time', { class: 'fp-tm', datetime: e.ts }, [w.hm]) : null,
      lead: e.rank === top,
      isNew: fresh.has(e.key),
    });
    // 每個時段一個 <section>：時段標題只在自己那段黏頂（下一段把它推上去，不疊在一起）；快速過濾後沒有條目的整段藏起來。
    // 每日頭版依整點分組（不是那天的加註日期），每週頭版依日期分組。順便數各類型的則數（過濾標籤後面的數字）
    const tl = [];
    const counts = new Map();
    let group = null;
    const addRow = (row) => {
      tl[tl.length - 1].append(row);
      row.dataset.fq.split(' ').filter(Boolean).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    };
    const openSlot = (label, day) => tl.push(h('section', { class: 'fp-sec' }, [hourHead(label, day)]));
    timed.forEach(({ e, w }) => {
      const g = !w ? '-' : weekMode ? w.day : `${w.day} ${w.hour}`;
      if (g !== group) {
        group = g;
        if (!w) openSlot('其他時間');
        else if (weekMode) openSlot(dayLabel(w.day));
        else openSlot(`${w.hour}:00`, w.day !== front.date ? dayLabel(w.day) : null);
      }
      addRow(entryRow(e, w));
    });
    // 舊版的每日頭版檔另帶 weekly（週報月報接在最後）：使用者要求日報的頭版不放週報，週報改看每週頭版，這裡不畫
    const types = [...counts.keys()].sort(bySeries).map((t) => ({ t, n: counts.get(t) }));
    const main = h('main', { id: 'main', class: 'fp-tl' }, tl.length ? tl : [h('p', { class: 'load-error' }, [weekMode ? '這週的頭版沒有條目。' : '這天的頭版沒有條目。'])]);
    // 外觀「一般」：同一批條目搬成頭條＋要聞卡片＋即時新聞（look-standard.js；只搬元素，過濾、展開、記看過都照舊）
    if (standard() && A.look) A.look.arrangeFront(main);
    show([...masthead(types), main, footer()]);
    document.title = `${TITLE} ${weekMode ? B.periodLabel(front.week, 'weekly') : dayLabel(front.date)}｜AI Reports`;
    opened.forEach((id) => {
      const d = document.getElementById(id);
      if (d) d.querySelector('details').open = true;
    });
    // 畫面渲染後才記下看過的條目：第一次看這天全部記下（同沒有過濾時「第一次看全部不標新」），之後只記顯示中的（applyFilter）
    if (firstLook) remember(period(), list.map((e) => e.key));
    applyFilter(false); // 套用記住的選擇
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && !el.hidden) el.querySelector('summary').focus({ preventScroll: true });
    }
    if (chipFocus != null && fq) {
      const b = chipFocus ? fq.chips.find((x) => x.dataset.type === chipFocus) : fq.clear;
      (b && !b.hidden ? b : fq.chips[0]).focus({ preventScroll: true });
    }
  }

  // 網站上還沒有任何頭版（剛部署、front/index.json 不存在或是空的；每週頭版還沒建）：不卡在載入中，
  // 說明「還沒有頭版」並列出各類型最新一期的連結（Review Focus 4；每週頭版只列週報、月報）
  function noFront() {
    const items = (index && index.items) || [];
    const latest = [];
    items.forEach((e) => {
      if (e && e.series && e.period && (cadenceOf(e) === 'daily') !== weekMode
        && !latest.some((x) => x.series === e.series)) latest.push(e);
    });
    latest.sort((a, b) => bySeries(a.series, b.series));
    const kids = [
      B.toolbar([frontLink(weekMode ? null : 'page'), weeklyLink(weekMode ? 'page' : null), fpBox]),
      h('header', { class: 'masthead' }, [h('h1', { class: 'mast-title' }, [TITLE])]),
      h('main', { id: 'main', class: 'fp-empty' }, [
        h('p', { class: 'fp-empty-note', role: 'status' }, [latest.length ? '還沒有頭版。先看各類型最新一期：' : '還沒有頭版，也還沒有任何報告。']),
        latest.length ? h('ul', { class: 'fp-empty-list' }, latest.map((e) => {
          const m = seriesMeta(e.series);
          return h('li', null, [h('a', { href: reportHref(e.series, e.period) }, [
            e.series_title || m.title,
            h('span', { class: 'fp-empty-when' }, [A.fmtShort(e.period, e.cadence || m.cadence)]),
          ])]);
        })) : null,
      ]),
      // 不放底部的類型標籤列：上面的清單已經列出每個類型（使用者要求：任何地方都不重複同一個資訊）
      footer(),
    ];
    if (!index) kids.splice(3, 0, h('p', { class: 'load-error', role: 'alert' }, ['新聞清單也載入失敗，重新整理再試一次。']));
    show(kids);
    document.title = `${TITLE}｜AI Reports`;
  }

  // 載入出錯的畫面：工具列照放（沒有日期按鈕），下面只有錯誤訊息
  function problem(text, more) {
    show([
      B.toolbar([frontLink(null), weeklyLink(null), fpBox]),
      h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text, more || null])]),
    ]);
    document.title = `${TITLE}｜AI Reports`;
  }

  // 頭版檔：front/<年>/<期別>.json（週的年是 ISO 年，就是期別的前四碼）
  const frontPath = (d) => `front/${d.slice(0, 4)}/${d}.json`;
  // 清單裡的期別：每日頭版讀 dates[].date，每週頭版讀 weeks[].week
  const validDates = (doc) => (doc && Array.isArray(doc[weekMode ? 'weeks' : 'dates']) ? doc[weekMode ? 'weeks' : 'dates'] : [])
    .map((x) => x && x[weekMode ? 'week' : 'date']).filter((d) => typeof d === 'string' && PERIOD_RE.test(d));
  // 要開哪一期：指定了 f（w）就是那一期，否則最新一期
  const target = () => (want || dates[0] || null);

  async function main() {
    // 類型設定與日期清單同時抓，不排隊；頭版檔等日期清單回來才知道要抓哪天
    const [idx, list] = await Promise.allSettled([A.getJSON('index.json'), A.getJSON('front/index.json')]);
    index = idx.status === 'fulfilled' && idx.value && typeof idx.value === 'object' ? idx.value : null;
    dates = list.status === 'fulfilled' ? validDates(list.value) : [];
    if (!dates.length) {
      noFront();
      return;
    }
    const d = target();
    if (!PERIOD_RE.test(d) || !dates.includes(d)) {
      problem(`找不到 ${d} 的${TITLE}。`, h('a', { href: latestHref }, [`看最新${TITLE}`]));
      return;
    }
    try {
      front = await A.getJSON(frontPath(d));
    } catch (err) {
      problem(`這${weekMode ? '週' : '天'}的${TITLE}載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    if (!isFront(front, d)) {
      problem(`${d} 的頭版檔內容不完整，重新整理再試一次。`);
      return;
    }
    render();
  }
  // 頭版檔要是物件、日期（週）等於要開的那一期（手改壞或部署到一半時不硬畫）
  const isFront = (doc, d) => !!doc && typeof doc === 'object' && doc[weekMode ? 'week' : 'date'] === d;

  // ── 回到前景時更新：重抓日期清單與正在看的那天；最新日期或頭版檔的 built_at 變了才重畫。
  // 正在看指定日期（?f=）時不跳日期；開的是 news/（最新一天）而有了更新的一天，就換到新的一天 ──
  let ready = false; // 第一次載入完成前不重抓（剛開頁時的 visibilitychange 不多抓一次）
  let refreshing = false;
  async function refresh() {
    if (!ready || refreshing || document.visibilityState !== 'visible') return;
    refreshing = true;
    let prev = null;
    try {
      const doc = await A.getJSON('front/index.json').catch(() => null);
      if (!doc) return; // 沒網路或暫時抓不到：維持現狀
      const next = validDates(doc);
      if (!next.length) return;
      const datesChanged = next.join() !== dates.join();
      const d = want || next[0];
      if (!next.includes(d)) return;
      const doc2 = await A.getJSON(frontPath(d)).catch(() => null);
      if (!isFront(doc2, d)) return;
      const changed = datesChanged || !front || doc2.date !== front.date || doc2.week !== front.week || doc2.built_at !== front.built_at;
      prev = [dates, front];
      dates = next;
      front = doc2;
      if (changed) render();
    } catch (err) {
      // 新資料畫不出來：畫面還是上一版（render 出錯時還沒換掉內容），狀態也退回上一版
      if (prev) [dates, front] = prev;
      console.error('頭版更新失敗', err);
    } finally {
      refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', refresh);
  // 從往返快取（bfcache）回來時也檢查一次
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });

  // ── 右上角「版面」：「外觀」（藍圖／地圖／一般，和報告頁共用 air-news-look；地圖在頭版只換樣式，條目排法同藍圖）
  // 與「配色」（自動／淺色／深色，沿用 air-theme）兩組。位置與行為同報告頁的「版面」
  // （bar.js 的 dropdown：面板在按鈕正下方往下展開，打開時焦點移入、點外面或按 Esc 關閉、關閉後焦點回「版面」）；
  // 外觀直接用報告頁的 .dd-*／.vw-* 樣式（report.css 兩頁都會載入），id 用頭版自己的（fp-*）──
  function setLook(v) {
    const was = standard();
    look = v;
    try { localStorage.setItem(KEY_LOOK, v); } catch (e) { /* 無法儲存就只套用本頁 */ }
    // 進出「一般」要重排條目（一般的頭條與卡片、藍圖／地圖的整點時間軸）；藍圖↔地圖只換 data-look（樣式全在 CSS）。
    // 同報告頁用 view transition 淡入淡出（減少動態時 report.css 取消）
    // 重畫時「版面」面板在 masthead() 組新工具列那一刻就搬家、焦點掉到 body（show() 記到的已是 body）：
    // 先記住面板裡按下的那顆按鈕，畫完放回去，鍵盤使用者不會被丟回頁首
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
    // 剛部署時瀏覽器可能還快取著舊版 site.js（沒有 THEMES）：少一組配色，不讓整頁卡住
    const groups = [
      ['外觀', LOOKS, () => look, setLook],
      // 「自動」會刪掉儲存值（跟著系統），見 site.js；配色鈕的文字由 themeLabel 給（「自動」會註明目前是深色或淺色）
      ...(A.THEMES ? [['配色', A.THEMES, A.getTheme, A.setTheme, A.themeLabel]] : []),
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
    // 選中狀態與「自動（深色）／自動（淺色）」的說明；別的分頁改配色、系統深淺改變時 site.js 發 air-theme
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
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', { class: 'dd-txt' }, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]') || panel.querySelector('.vw-seg button'),
    });
  }

  layoutPanel();
  main()
    .catch((err) => { // 渲染途中出錯也不能卡在「載入中…」
      console.error('頭版載入失敗', err);
      const msg = `${TITLE}顯示失敗，重新整理再試一次。`;
      try { problem(msg); } catch (e) { app.textContent = msg; } // 連錯誤頁都畫不出來時至少換掉載入中
    })
    .finally(() => { ready = true; });
})();
