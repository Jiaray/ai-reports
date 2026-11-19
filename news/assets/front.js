/* 頭版（news/ 不帶 t 參數）：讀 index.json（類型設定與各類型最新報告）、front/index.json（有頭版的日期，新到舊）
   與當天的頭版檔 front/<年>/<日期>.json，照使用者選定的樣版 B（整點分組時間軸）渲染。?f=YYYY-MM-DD 開指定日期。
   帶 t 參數是報告頁，這支什麼都不做（交給 report.js）。site.js 是 defer、排在本檔前面，執行時 window.AIR 已經在。
   *_html 欄位是 publish.py 淨化過的片段（只留 http/https 連結與粗體），其餘欄位一律當純文字（AIR.h 的子節點字串）。 */
(() => {
  'use strict';
  const query = new URLSearchParams(location.search);
  if (query.get('t')) return; // 報告頁由 report.js 負責
  const A = window.AIR;
  const h = A.h;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const SEEN_KEY = 'air-front-seen';
  const SEEN_DAYS = 7;
  const want = query.get('f'); // 指定日期；沒有就開最新一天（書籤與主畫面固定開最新）

  // 條目沿用報告頁速讀讀法的樣式；頭版固定藍圖外觀（報告頁的讀法、外觀選擇不影響頭版）
  root.setAttribute('data-read', 'scan');
  root.setAttribute('data-look', 'blueprint');
  app.classList.add('fp');

  let index = null; // news/index.json；抓不到時為 null，類型資訊改用頭版檔自己的 reports
  let dates = []; // 有頭版的日期，新到舊
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
  const keepFrom = () => addDays(today(), 1 - SEEN_DAYS);
  // 這一天要標「新」的 key：第一次看這天全部不標（之後才進來的才標）；太舊的日期不記也不標
  function freshKeys(date, keys) {
    const set = marked.get(date) || new Set();
    marked.set(date, set);
    const all = readSeen();
    if (all && date >= keepFrom() && Array.isArray(all[date])) {
      const before = new Set(all[date]);
      keys.forEach((k) => { if (!before.has(k)) set.add(k); });
    }
    return set;
  }
  // 畫面渲染後記下這天的 key（和舊紀錄合併），順便丟掉 7 天前的紀錄
  function remember(date, keys) {
    const all = readSeen();
    if (!all || date < keepFrom()) return;
    const next = {};
    Object.keys(all).forEach((d) => {
      if (DATE_RE.test(d) && d >= keepFrom() && Array.isArray(all[d])) next[d] = all[d].filter((k) => typeof k === 'string');
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

  // 整點標題（黏在頂端）：「10:00」，不是頭版那天的加註日期；週報月報、沒有時間的條目也用同一種標題
  const hourHead = (label, day) => h('h2', { class: 'fp-hr' }, [label, day ? h('span', { class: 'fp-hr-day' }, [day]) : null]);

  // ── 一則條目 ──────────────────────────────────────────────────────
  // 左緣一條領域色線；summary 第一行是類型＋時刻（週報月報是期別），接著標題。每輪第一順位（原本的「要聞」）
  // 淡底色、標題大一號，收合時先露兩行摘要；點開看完整摘要、來源與「看原文／看解讀」。
  // 原生 <details>：鍵盤、報讀器、「在頁面中尋找」（收合的摘要也搜得到、找到時自動展開）都直接可用。
  // summary 裡的標題用 span、不用 h3（同報告頁速讀：部分螢幕閱讀器把 summary 當按鈕，會丟掉裡面的標題），也不放連結。
  // o.id：元素 id；o.types：類型 id（第一個決定色線）；o.stamp：類型後面的灰字節點；o.lead：要聞；o.isNew：標「新」；o.read：「看解讀」網址
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
    if (o.read) acts.push(h('a', { class: 'fp-act', href: o.read }, ['看解讀']));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    body.push(h('div', { class: 'fp-acts' }, acts));
    const types = o.types || [];
    const meta = h('span', { class: 'fp-mt' }, [...types.map(typeTag), o.stamp || null]);
    // 預覽和展開後的摘要是同一段字：預覽對報讀器隱藏，summary 唸起來就只有類型、時刻與標題
    const pre = o.lead && it.summary_html ? h('span', { class: 'fp-pre', 'aria-hidden': 'true' }, [plainText(it.summary_html)]) : null;
    const cls = ['fp-row', 'fp-it'];
    if (o.lead) cls.push('is-lead');
    if (hot) cls.push('is-hot');
    return h('article', { class: cls.join(' '), id: o.id, 'data-group': types.length ? seriesMeta(types[0]).group : null }, [
      h('details', { class: 'peek' }, [
        h('summary', { class: 'peek-sum' }, [meta, title, pre]),
        h('div', { class: 'more-body' }, body),
      ]),
    ]);
  }

  // ── 報頭 ──────────────────────────────────────────────────────────
  // 頭版網址：最新一天是 news/（書籤固定開最新），其他天是 ?f=YYYY-MM-DD
  const dayHref = (d) => (d === dates[0] ? './' : `?f=${d}`);
  function dayLink(d, dir) {
    const arrow = h('span', { class: 'fp-arrow', 'aria-hidden': 'true' }, [dir === 'prev' ? '‹' : '›']);
    if (!d) return h('span', { class: 'fp-day is-off', 'aria-hidden': 'true' }, [arrow]);
    return h('a', {
      class: 'fp-day', rel: dir, href: dayHref(d), title: dayLabel(d), 'aria-label': `${dir === 'prev' ? '前一期' : '後一期'}頭版 ${dayLabel(d)}`,
    }, [arrow]);
  }

  // 報頭只有一列（樣版 B：原本只放「版面」的那一列左邊整塊空著，使用者覺得浪費）：
  // 左邊小字「頭版」＋日期大字，右邊前後一期與「版面」三個圖示鈕。刊名與更新時間拿掉
  const hdButtons = (kids) => h('div', { class: 'fp-hd-btns' }, [...kids, fpBox]);
  function masthead() {
    const i = dates.indexOf(front.date);
    const prev = i >= 0 ? dates[i + 1] : null;
    const next = i > 0 ? dates[i - 1] : null;
    return h('header', { class: 'fp-hd' }, [
      h('div', { class: 'fp-hd-row' }, [
        h('h1', { class: 'fp-title' }, [
          h('span', { class: 'fp-kicker' }, ['頭版']),
          h('span', { class: 'fp-date' }, [`${md(front.date)} 週${weekday(front.date)}`]),
        ]),
        hdButtons([dayLink(prev, 'prev'), dayLink(next, 'next')]),
      ]),
      // 預設開最新一個有頭版的日期；那天不是今天時提醒（spec 6.6）。日期大標題已有，提醒不再重寫日期
      front.date !== today() && front.date === dates[0] ? h('p', { class: 'fp-latest' }, ['今天還沒有頭版，這是最近一期']) : null,
    ]);
  }

  // ── 底部類型標籤列：第一個「頭版」是目前頁，其餘是 index.json 有報告的類型（短名取 series[].short）──
  function tabs() {
    const items = (index && index.items) || [];
    const ids = [...new Set((items.length ? items : (front && front.reports) || []).map((e) => e.series).filter(Boolean))].sort(bySeries);
    const list = h('div', { class: 'ed-tabs' }, [
      h('a', { class: 'ed-tab', href: './', 'aria-current': 'page' }, ['頭版']),
      ...ids.map((id) => h('a', { class: 'ed-tab', href: `?t=${encodeURIComponent(id)}` }, [seriesMeta(id).short])),
    ]);
    return h('nav', { class: 'editions fp-tabs', 'aria-label': '新聞類型' }, [list]);
  }

  // 標籤列的捲軸藏起來了，兩端「還有更多」的淡出提示由 report.css 用捲動驅動動畫畫；
  // 不支援的瀏覽器改用 IntersectionObserver 加 .more-start／.more-end（同 report.js 的 scrollHints）
  let hintObserver = null;
  function scrollHints() {
    if (hintObserver) hintObserver.disconnect();
    hintObserver = null;
    if ((window.CSS && CSS.supports('animation-timeline', 'scroll()')) || !('IntersectionObserver' in window)) return;
    const list = app.querySelector('.ed-tabs');
    const first = list && list.firstElementChild;
    if (!first) return;
    const last = list.lastElementChild;
    hintObserver = new IntersectionObserver((entries) => entries.forEach(({ target, intersectionRatio }) => {
      list.classList.toggle(target === first ? 'more-start' : 'more-end', intersectionRatio < 1);
    }), { root: list, threshold: 1, rootMargin: '1px' });
    hintObserver.observe(first);
    if (last !== first) hintObserver.observe(last);
  }

  // 頁尾只留頭版的整理方式；刊名與日期上面都有了，不再重複
  const footer = () => h('footer', { class: 'foot' }, [
    h('span', { class: 'foot-left' }, ['頭版從當天各報告標出的重點整理，同一則新聞只列一次']),
  ]);

  // 載入出錯的畫面沒有報頭：「版面」單獨放在頂端那一列的右邊
  const bar = () => (fpBox ? h('div', { class: 'fp-bar' }, [fpBox]) : null);

  function show(kids) {
    const focused = document.activeElement;
    app.replaceChildren(...kids.filter(Boolean));
    // 「版面」面板跟著重畫搬到新的那一列，搬動時焦點會掉到 body：放回原本的按鈕（條目的焦點由 render 自己還原）
    if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
    requestAnimationFrame(scrollHints);
  }

  // ── 整頁 ──────────────────────────────────────────────────────────
  // 重畫（回前景時頭版有變）不打斷閱讀：記下展開中的條目與焦點所在的條目，畫完還原
  function render() {
    const opened = new Set([...app.querySelectorAll('.fp-row')].filter((el) => el.querySelector('details[open]')).map((el) => el.id));
    const active = document.activeElement && document.activeElement.closest && document.activeElement.closest('.fp-row');
    const focusId = active ? active.id : null;

    const list = (front.entries || []).filter((e) => e && e.key && Array.isArray(e.from) && e.from.length);
    const fresh = freshKeys(front.date, list.map((e) => e.key));
    // 「要聞」＝第 1 輪順位（各報告最重要的那則）：不再分區，改成時間軸上淡底色、標題大一號
    const top = list.length ? Math.min(...list.map((e) => e.rank)) : 0;
    // 時間軸由新到舊；沒有時間的排最後，照順位、類型順序
    const timed = list.map((e) => ({ e, w: when(e.ts) }));
    timed.sort((a, b) => (a.w && b.w ? b.w.ms - a.w.ms : (a.w ? -1 : 0) + (b.w ? 1 : 0))
      || a.e.rank - b.e.rank || bySeries(a.e.from[0].series, b.e.from[0].series) || (a.e.key < b.e.key ? -1 : 1));
    const entryRow = (e, w) => {
      const m = e.from[0]; // 主來源（front.py 已依順位、類型順序排好）
      return tlRow(e, {
        id: `fp-${e.key}`,
        types: [...new Set(e.from.map((f) => f.series))].sort(bySeries),
        stamp: w ? h('time', { class: 'fp-tm', datetime: e.ts }, [w.hm]) : null,
        lead: e.rank === top,
        isNew: fresh.has(e.key),
        read: reportHref(m.series, m.period, m.no),
      });
    };
    const tl = [];
    let group = null;
    timed.forEach(({ e, w }) => {
      const g = w ? `${w.day} ${w.hour}` : '-';
      if (g !== group) {
        group = g;
        tl.push(w ? hourHead(`${w.hour}:00`, w.day !== front.date ? dayLabel(w.day) : null) : hourHead('其他時間'));
      }
      tl.push(entryRow(e, w));
    });
    // 週報與月報接在時間軸最後，同樣用整點標題那種黏頂標題；類型後面的灰字是期別，依順位排
    const weekly = [...(front.weekly || [])].sort((a, b) => bySeries(a.series, b.series) || (a.date < b.date ? 1 : -1));
    if (weekly.some((w) => (w.items || []).length)) tl.push(hourHead('週報與月報'));
    weekly.forEach((w) => {
      const cadence = seriesMeta(w.series).cadence || (/-W\d{2}$/.test(w.period) ? 'weekly' : 'monthly');
      [...(w.items || [])].sort((a, b) => a.rank - b.rank).forEach((it) => tl.push(tlRow(it, {
        id: `fp-${w.series}-${it.no}`,
        types: [w.series],
        stamp: h('span', { class: 'fp-tm' }, [A.fmtShort(w.period, cadence)]),
        read: reportHref(w.series, w.period, it.no),
      })));
    });
    show([
      masthead(),
      h('main', { id: 'main', class: 'fp-tl' }, tl.length ? tl : [h('p', { class: 'load-error' }, ['這天的頭版沒有條目。'])]),
      tabs(),
      footer(),
    ]);
    document.title = `頭版 ${dayLabel(front.date)}｜AI Reports`;
    opened.forEach((id) => {
      const d = document.getElementById(id);
      if (d) d.querySelector('details').open = true;
    });
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) el.querySelector('summary').focus({ preventScroll: true });
    }
    remember(front.date, list.map((e) => e.key)); // 畫面渲染後才記下
  }

  // 網站上還沒有任何頭版（剛部署、front/index.json 不存在或是空的）：不卡在載入中，
  // 說明「還沒有頭版」並列出各類型最新一期的連結（Review Focus 4）
  function noFront() {
    const items = (index && index.items) || [];
    const latest = [];
    items.forEach((e) => {
      if (e && e.series && e.period && !latest.some((x) => x.series === e.series)) latest.push(e);
    });
    latest.sort((a, b) => bySeries(a.series, b.series));
    const kids = [
      h('header', { class: 'fp-hd' }, [
        h('div', { class: 'fp-hd-row' }, [h('h1', { class: 'fp-title' }, [h('span', { class: 'fp-date' }, ['頭版'])]), hdButtons([])]),
      ]),
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
    if (!index) kids.splice(2, 0, h('p', { class: 'load-error', role: 'alert' }, ['新聞清單也載入失敗，重新整理再試一次。']));
    show(kids);
    document.title = '頭版｜AI Reports';
  }

  function problem(text, more) {
    show([
      bar(),
      h('main', { id: 'main' }, [h('p', { class: 'load-error', role: 'alert' }, [text, more || null])]),
      index ? tabs() : null,
    ]);
    document.title = '頭版｜AI Reports';
  }

  const frontPath = (d) => `front/${d.slice(0, 4)}/${d}.json`;
  const validDates = (doc) => (doc && Array.isArray(doc.dates) ? doc.dates : [])
    .map((x) => x && x.date).filter((d) => typeof d === 'string' && DATE_RE.test(d));
  // 要開哪一天：指定了 f 就是那天，否則最新一天
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
    if (!DATE_RE.test(d) || !dates.includes(d)) {
      problem(`找不到 ${d} 的頭版。`, h('a', { href: './' }, ['看最新頭版']));
      return;
    }
    try {
      front = await A.getJSON(frontPath(d));
    } catch (err) {
      problem(`這天的頭版載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    if (!isFront(front, d)) {
      problem(`${d} 的頭版檔內容不完整，重新整理再試一次。`);
      return;
    }
    render();
  }
  // 頭版檔要是物件、日期等於要開的那天（手改壞或部署到一半時不硬畫）
  const isFront = (doc, d) => !!doc && typeof doc === 'object' && doc.date === d;

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
      const changed = datesChanged || !front || doc2.date !== front.date || doc2.built_at !== front.built_at;
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

  // ── 右上角「版面」：只有「配色」一組（自動／淺色／深色，沿用 air-theme）。位置與行為同報告頁的 layoutPanel
  // （使用者要求兩頁的「版面」都固定在右上角）：按鈕在報頭上方那一列的右端，面板在按鈕正下方往下展開；
  // 打開時焦點移入、有看得見的「關閉」鈕、點外面或按 Esc 關閉、關閉後焦點回到「版面」。
  // 不用原生 popover：popover 在 top layer，要跟住按鈕得靠 anchor positioning（Firefox 不支援）；
  // 面板放在按鈕旁的一般 DOM、absolute 定位，就會跟著按鈕。
  // 外觀直接用報告頁的 .dd-*／.vw-* 樣式（report.css 兩頁都會載入），兩頁的「版面」長得一模一樣；id 用頭版自己的（fp-*）──
  const ICON_SLIDERS = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M2.5 6H11M15 6h2.5M2.5 14H5M9 14h8.5"/><rect x="11" y="4" width="4" height="4"/><rect x="5" y="12" width="4" height="4"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5 5 15"/></svg>';
  // 打開時淡入、往下滑 4px（同報告頁；減少動態時只淡入）
  function openMotion(el) {
    if (!el.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.animate(still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out' });
  }

  function layoutPanel() {
    if (!A.THEMES) return; // 瀏覽器還快取著舊版 site.js：沒有配色可選，就不放按鈕
    const toggle = h('button', { type: 'button', class: 'dd-toggle', 'aria-expanded': 'false', 'aria-controls': 'fp-panel' }, [
      h('span', { class: 'dd-ico', html: ICON_SLIDERS }), h('span', { class: 'dd-txt' }, ['版面']), // 頭版報頭只露圖示，字留給報讀器
    ]);
    const panel = h('div', { class: 'dd-panel vw-panel', id: 'fp-panel', role: 'dialog', 'aria-labelledby': 'fp-title', hidden: true });
    const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': '關閉版面設定', html: ICON_CLOSE });
    panel.appendChild(h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: 'fp-title' }, ['版面設定']), close]));
    const buttons = A.THEMES.map(([value, text]) => {
      const b = h('button', { type: 'button' }, [text]);
      b.addEventListener('click', () => {
        if (value !== A.getTheme()) A.setTheme(value); // 「自動」會刪掉儲存值（跟著系統），見 site.js
        sync();
      });
      return [b, value];
    });
    panel.appendChild(h('div', { class: 'vw-group', role: 'group', 'aria-labelledby': 'fp-label-theme' }, [
      h('span', { class: 'vw-label', id: 'fp-label-theme' }, ['配色']),
      h('div', { class: 'vw-seg' }, buttons.map((x) => x[0])),
    ]));
    // 選中狀態與「自動（深色）／自動（淺色）」的說明；別的分頁改配色、系統深淺改變時 site.js 發 air-theme
    function sync() {
      const cur = A.getTheme();
      buttons.forEach(([b, value]) => {
        b.setAttribute('aria-pressed', String(value === cur));
        if (A.themeLabel) b.textContent = A.themeLabel(value);
      });
    }
    const focusPicked = () => (panel.querySelector('[aria-pressed=true]') || panel.querySelector('button')).focus();
    document.addEventListener('air-theme', sync);
    // 開啟後焦點移到目前選中的配色；關閉鈕、Esc 收起後焦點回「版面」
    const open = (yes) => {
      panel.hidden = !yes;
      toggle.setAttribute('aria-expanded', String(yes));
      if (yes) {
        openMotion(panel);
        focusPicked();
      }
    };
    close.addEventListener('click', () => {
      open(false);
      toggle.focus();
    });
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      open(panel.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target)) open(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        open(false);
        toggle.focus();
      }
    });
    sync();
    fpBox = h('div', { class: 'dd vw' }, [toggle, panel]); // 按鈕在前：鍵盤從「版面」按 Tab 直接進面板；由 show() 放進頁首那一列
  }

  layoutPanel();
  main()
    .catch((err) => { // 渲染途中出錯也不能卡在「載入中…」
      console.error('頭版載入失敗', err);
      const msg = '頭版顯示失敗，重新整理再試一次。';
      try { problem(msg); } catch (e) { app.textContent = msg; } // 連錯誤頁都畫不出來時至少換掉載入中
    })
    .finally(() => { ready = true; });
})();
