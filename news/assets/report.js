/* 共用新聞頁（news/index.html）的報告頁：讀 index.json 自動列出有報告的新聞類型，依網址 ?t=<系列>&d=<期別>
   載入該期報告 JSON 渲染；只帶 t 顯示該類型最新一期。不帶 t 是頭版，這支什麼都不做（交給 front.js）。
   期別選單讀該類型的 <系列>/index.json（全部期別）；抓不到就只用 index.json 裡的最近幾期。
   預設是原本的「工程藍圖」版型（DOM 結構同 md2html2.py 的 render()）。右上角「版面」可切換讀法（完整／速讀／時間軸）、
   外觀（藍圖／地圖）與配色，選擇記在 localStorage（同一裝置記住）；規格來自使用者的版型樣稿。
   讀法決定 DOM，換讀法就重繪；外觀與配色只改 <html> 的 data-look／data-theme，樣式全在 CSS。
   *_html 欄位是 publish.py 用 md2html2.inline 淨化過的片段（只留 http/https 連結與粗體），其餘欄位一律當純文字。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar; // 報頭的共用元件（bar.js）
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const query = new URLSearchParams(location.search);
  if (!query.get('t')) return; // 頭版（不帶 t）由 front.js 負責
  // 部署後的快取空窗：瀏覽器還拿著舊的 index.html（沒有載入 bar.js）、卻拿到新的這支——補載 bar.js 後重跑這支，
  // 不然頁面會停在「載入中…」（front.js 同一段，兩支共用同一次載入 A.barLoad）
  if (!B) {
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
  let index = { series: [], items: [] };
  let all = [];
  let shown = null; // 目前這一期 { entry, data }：換讀法時重繪用
  let vwBox = null; // 「版面」按鈕＋面板（layoutPanel 建一次），每次重繪頁首那一列時放進最右邊

  // ── 版面：讀法 × 外觀，各取第一個為預設。這次只做這幾種（樣稿另有專注、日曆、直排）──
  // 外觀「一般」（使用者的晨光日報規格）樣式在 look-standard.css；部署後的快取空窗拿到舊 index.html（沒載入
  // look-standard.js、A.look 不在）時不列這個選項，記住的值不認得就退回藍圖
  const READS = [['full', '完整'], ['scan', '速讀'], ['timeline', '時間軸']];
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  const KEY_READ = 'air-news-read';
  const KEY_LOOK = 'air-news-look';
  function stored(key, list) {
    let v = null;
    try { v = localStorage.getItem(key); } catch (e) { /* 無痕或停用儲存：用預設 */ }
    return list.some((x) => x[0] === v) ? v : list[0][0];
  }
  function store(key, v) {
    try { localStorage.setItem(key, v); } catch (e) { /* 無法儲存就只套用本頁 */ }
  }
  const view = { read: stored(KEY_READ, READS), look: stored(KEY_LOOK, LOOKS) };
  function applyView() {
    root.setAttribute('data-read', view.read);
    root.setAttribute('data-look', view.look);
  }
  applyView();

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (e) => `${e.series}/${e.period}`;
  const newest = (a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.generated_at < b.generated_at ? 1 : -1;
  };
  const link = (series, period) => `?t=${encodeURIComponent(series)}${period ? `&d=${encodeURIComponent(period)}` : ''}`;

  function merge(items) {
    const seen = new Set(all.map(keyOf));
    items.forEach((e) => {
      if (!seen.has(keyOf(e))) {
        seen.add(keyOf(e));
        all.push(e);
      }
    });
    all.sort(newest);
  }

  // 這一期的日期（月/日，不補零），條目左欄的日期跟它一樣就不再顯示（使用者要求：任何地方都不重複同一個資訊）
  let issueMD = '';
  const monthDay = (m, d) => `${+m}/${+d}`;

  // 2026-11-18 → 11 月 18 日（三）（時間軸的日期標題）
  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m} 月 ${d} 日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
  }

  // 報頭最上面那一列（使用者要求：所有頁面同一列，頭版也是）：左上角日期（點開是這天有的新聞與有新聞的日期）、
  // 「本日新聞」（回 news/ 的每日頭版）、「本週新聞」（news/?w 的每週頭版）、右上角「版面」；元件在 bar.js。
  // 兩顆連結也是日報、週報兩邊的切換：日報頁標「本日新聞」、週報與月報頁標「本週新聞」為目前位置（月報收在每週頭版）
  // （不只靠顏色：主文字色＋底線；aria-current 是 true，表示同一邊、不是那一頁本身）
  const cadenceOf = (e) => (e && e.cadence) || 'daily';
  function editions(cur) {
    if (!cur && !all.length && !vwBox) return null;
    return B.toolbar([
      cur ? periodPicker(cur) : null,
      all.length ? B.navLink('本日新聞', 'front', './', cur && cadenceOf(cur) === 'daily' ? 'true' : null) : null,
      weeklyLink(cur),
      vwBox,
    ]);
  }

  // 「本週新聞」（使用者要求：最上方一顆切到週報的按鈕，字數同「本日新聞」）：連到每週頭版的最新一週（使用者要求：
  // 本週新聞也有自己的頭版）；還沒有任何週報、月報就不顯示（使用者選定，同「有報告才列出」）。週報、月報頁上標成目前位置（true）
  function weeklyLink(cur) {
    if (!all.some((e) => cadenceOf(e) !== 'daily')) return null;
    return B.navLink('本週新聞', 'weekly', '?w', cur && cadenceOf(cur) !== 'daily' ? 'true' : null);
  }

  // 類型順序：index.json 的系列順序，不在裡面的排最後
  function rankOf(id) {
    const order = (index.series || []).map((s) => s.id);
    return order.includes(id) ? order.indexOf(id) : order.length;
  }

  // 大標題（使用者要求：標題的下拉是本頁的章節）：點開是這一期的分區（跳到分區；頁面上不另擺分區目錄）與則數，
  // 地圖外觀在名稱前加分區色塊（data-k）。時間軸讀法沒有分區：一般的 <h1>、不帶箭頭。
  // 同一期的內容不變：建一次，在完整、速讀之間換讀法重繪報頭時重用
  let chapBox = null;
  let chapKey = '';
  function titleChapters(cur, r) {
    const items = (r.sections || []).map((s, i) => ({ name: s.name, count: s.count, href: `#sec-${pad(i + 1)}`, k: String((i % 10) + 1) }))
      .filter((x) => x.name);
    if (!cur || view.read === 'timeline') return B.titleChapters({ title: r.title, items: [] });
    if (chapBox && chapKey === keyOf(cur)) return chapBox;
    chapKey = keyOf(cur);
    chapBox = B.titleChapters({ title: r.title, items, panelTitle: '本期章節' });
    return chapBox;
  }

  // 左上角的日期按鈕（版面在 bar.js 的 datePicker）：左欄同一天（週報同一週、月報同一月）有報告的類型與則數
  // （換類型、日期不變）；右欄同週期（日報／週報／月報）任一類型有報告的期別（換日期：這個類型那期有就留在這個類型，
  // 沒有就換到那期排第一的類型）。素材以載入的資料為準：index.json 的最近 200 份＋這個類型自己的全部期別。
  // 同一頁的內容不會變：建一次，重繪頁首那一列時重用
  let pdBox = null;
  let pdKey = '';
  function periodPicker(cur) {
    if (pdBox && pdKey === keyOf(cur)) return pdBox;
    pdKey = keyOf(cur);
    const byRank = (a, b) => rankOf(a.series) - rankOf(b.series);
    const byPeriod = new Map(); // 期別 → 那期有的報告（同一類型重出只留最新那份；all 已依新到舊排）
    all.filter((e) => cadenceOf(e) === cadenceOf(cur)).forEach((e) => {
      const list = byPeriod.get(e.period) || [];
      if (!list.some((x) => x.series === e.series)) list.push(e);
      byPeriod.set(e.period, list);
    });
    const here = [...(byPeriod.get(cur.period) || [cur])].sort(byRank).map((e) => ({
      text: e.series_title || e.title, count: e.count, href: link(e.series, e.period), current: e.series === cur.series,
    }));
    const periods = [...byPeriod.keys()].sort().reverse().map((p) => {
      const list = byPeriod.get(p);
      const e = list.find((x) => x.series === cur.series) || [...list].sort(byRank)[0];
      return { period: p, href: link(e.series, p), current: p === cur.period };
    });
    pdBox = B.datePicker({ period: cur.period, cadence: cadenceOf(cur), here, periods });
    return pdBox;
  }

  // ── 藍圖版型（對應 md2html2.py 的 render）──────────────────────────────
  function table(t) {
    return h('div', { class: 'tbl' }, [h('table', null, [
      h('thead', null, [h('tr', null, t.head.map((c) => h('th', { scope: 'col', html: c })))]),
      h('tbody', null, t.rows.map((r) => h('tr', null, r.map((c) => h('td', { html: c }))))),
    ])]);
  }

  function notes(blocks, cls) {
    return (blocks || []).map((b) => {
      if (b.kind === 'p') return h('p', { class: cls, html: b.html });
      if (b.kind === 'ul') return h('ul', { class: cls }, b.items.map((x) => h('li', { html: x })));
      return table(b);
    });
  }

  // 條目來源字串（「Financial Times、CNBC、DW（德國政府出資）等 10 家」）拆成媒體名、出資性質與家數
  function parseSrc(src) {
    const s = (src || '').trim();
    const m = /^(.*?)\s*等\s*(\d+)\s*家$/.exec(s);
    const body = m ? m[1] : s;
    const notes = new Map();
    const names = body ? body.split('、').map((p) => p.trim()).filter(Boolean).map((p) => {
      const n = /^(.*?)\s*（([^（）]*)）$/.exec(p);
      if (!n) return p;
      notes.set(n[1], n[2]);
      return n[1];
    }) : [];
    return { names, notes, count: m ? +m[2] : names.length };
  }

  // 另參、其餘連結（使用者要求：任何地方都不重複同一個資訊）：
  // - 同一家媒體有好幾篇時，媒體名只寫一次，第二篇起標「第 N 篇」放在名稱後的括號裡（原本會出現「France 24／RFI、France 24／RFI」）
  // - notes：標題下只寫家數時，出資性質改在這裡、接在媒體名後面（同一個括號）
  // - shown：標題下已經寫了名稱的媒體（單一來源），這裡不再寫名稱，只放「第 2 篇」（第 1 篇就是標題連結）
  // seen 記著前面已經寫過的媒體與篇數，讓「其餘連結」接著另參往下編號
  function links(list, seen = new Map(), { notes = new Map(), shown = new Set() } = {}) {
    const groups = [];
    list.forEach((l) => {
      const g = groups.find((x) => x.text === l.text);
      if (g) g.items.push(l);
      else groups.push({ text: l.text, items: [l] });
    });
    const link = (l, text) => (l.url ? h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [text]) : document.createTextNode(text));
    const join = (arr) => arr.flatMap((a, k) => (k ? ['、', a] : [a]));
    return join(groups.map((g) => {
      const before = seen.get(g.text) ?? (shown.has(g.text) ? 1 : 0);
      seen.set(g.text, before + g.items.length);
      const nth = (k) => link(g.items[k], `第 ${before + k + 1} 篇`);
      if (before && shown.has(g.text)) return h('span', null, join(g.items.map((_, k) => nth(k))));
      const head = before ? document.createTextNode(g.text) : link(g.items[0], g.text);
      const note = !before && notes.has(g.text) ? notes.get(g.text) : '';
      const rest = (before ? g.items.map((_, k) => k) : g.items.slice(1).map((_, k) => k + 1)).map(nth);
      const inner = [...(note ? [note] : []), ...(note && rest.length ? ['，'] : []), ...join(rest)];
      return h('span', null, inner.length ? [head, '（', ...inner, '）'] : [head]);
    }));
  }

  // 左欄時間：「11/18 14:20」拆成日期、時刻兩段（藍圖下看起來與原本的整串文字相同）；Today、Hot 這類字樣原樣。
  // 日期跟這一期相同就只放時刻（日期已在左上角的日期按鈕）；時間軸的日期由分組標題負責，一律只放時刻。
  // 條目有 ts（台北時間 ISO）時用 <time datetime>，機器讀得到完整時間（樣式只看 .row-time，外觀不變）
  function rowTime(left, line, ts) {
    const m = /^((\d{1,2})\/(\d{1,2}))(?:\s+(\d{1,2}:\d{2}))?$/.exec(left || '');
    if (!m) return h('span', { class: 'row-time' }, [h('span', { class: 'rt-txt' }, [left || ''])]);
    const kids = [];
    if (!line && monthDay(m[2], m[3]) !== issueMD) kids.push(h('span', { class: 'rt-d' }, [m[1]]));
    if (m[4]) kids.push(...(kids.length ? [' '] : []), h('span', { class: 'rt-hm' }, [m[4]]));
    return h(ts ? 'time' : 'span', { class: 'row-time', datetime: ts || null }, kids);
  }

  // 長段落在句末（。！？）分段，提高閱讀舒適度：只在標籤、連結、粗體與引號括號之外斷開；
  // 每段至少約 60 字（短句併在同一段），結尾太短的零頭併回前一段；寫稿時的分段（<br>）照樣分開
  const OPEN = '「『（(〔【';
  const CLOSE = '」』）)〕】';
  const ENDS = '。！？';
  function paragraphs(html, min = 60) {
    const textLen = (s) => s.replace(/<[^>]*>/g, '').length;
    const out = [];
    html.split(/<br\s*\/?>/i).forEach((block) => {
      const paras = [];
      let cur = '';
      let depth = 0; // 引號、括號層數
      let inline = 0; // <a>、<strong> 層數
      let last = ''; // 上一個文字字元
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
        // 句號後，或「……。」這種句號在引號內、引號收尾後，才算句末
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

  // 熱門標記：來源標成 Hot、PTT 爆文，或「頭條／直播／利空」這類紅色標籤；所有版面都在標題前加紅色徽章凸顯。
  // 回傳徽章文字與出處（left／heat／tag），出處那個標籤或左欄字樣就不再重複顯示
  function hotInfo(it) {
    if (/^hot$/i.test((it.left || '').trim())) return { label: 'HOT', from: 'left' };
    if ((it.heat || '').trim() === '爆') return { label: '爆', from: 'heat' };
    const t = (it.tags || []).find((x) => x.cls === 'tag-hot');
    return t ? { label: t.text, from: 'tag', tag: t } : null;
  }
  const hotBadge = (hot) => h('span', { class: 'hot-badge' }, [hot.label]);

  // 淨化過的 HTML 片段 → 純文字（時間軸的摘要預覽用）
  function plainText(html) {
    const t = document.createElement('template');
    t.innerHTML = html.replace(/<br\s*\/?>/gi, ' ');
    return t.content.textContent.replace(/\s+/g, ' ').trim();
  }

  // 時間軸：摘要收成兩行，點「看 AI 解讀」展開完整摘要、重點、解讀與收集來源；只有摘要可看時整段列出、不必展開
  function fold(it, body) {
    const more = (it.also || []).length || (it.also_more || []).length || (it.bullets_html || []).length
      || it.table || it.dive_html;
    if (!more) return it.summary_html ? h('p', { class: 'teaser teaser-all', html: it.summary_html }) : null;
    return h('details', { class: 'more' }, [
      h('summary', { class: 'more-sum' }, [
        it.summary_html ? h('span', { class: 'teaser' }, [plainText(it.summary_html)]) : null,
        h('span', { class: 'more-hint' }, [
          h('span', { class: 'mh-o' }, [it.dive_html ? '看 AI 解讀' : '看更多']),
          h('span', { class: 'mh-c' }, ['收起']),
        ]),
      ]),
      h('div', { class: 'more-body' }, body),
    ]);
  }

  const titleLink = (it) => (it.url
    ? h('h3', { class: 'row-title' }, [h('a', { href: it.url, target: '_blank', rel: 'noopener', html: it.title_html })])
    : h('h3', { class: 'row-title', html: it.title_html }));

  // 速讀：只列標題（使用者要求：兩行摘要短到讀不出東西），點標題展開；熱門新聞在標題前加紅色徽章。
  // 展開後第一行是來源、標籤與原文連結，接著摘要、重點與解讀，收集來源（多家報導、另參）在最後；沒有內容可展開就照常把標題做成原文連結
  // 放在 <summary> 裡的標題用 span、不用 h3：部分螢幕閱讀器把 summary 當成按鈕，會丟掉裡面的標題（指南：不要把標題放進 summary）
  function peek(it, tags, body, hot) {
    const title = body.length ? h('span', { class: 'row-title', html: it.title_html }) : titleLink(it);
    if (hot) title.prepend(hotBadge(hot));
    if (!body.length) return title;
    const meta = [...tags];
    if (it.url) meta.push(h('a', { class: 'peek-link', href: it.url, target: '_blank', rel: 'noopener' }, ['看原文 ↗']));
    return h('details', { class: 'peek' }, [
      h('summary', { class: 'peek-sum' }, [title]),
      h('div', { class: 'more-body' }, [meta.length ? h('div', { class: 'tags' }, meta) : null, ...body]),
    ]);
  }

  // 一則條目。o.peek：速讀（只列標題，點標題展開）；o.fold：時間軸（兩行摘要＋「看 AI 解讀」，不列來源標籤，同樣稿）；
  // o.line：時間軸（標分區名稱，data-k 給地圖外觀依分區上色）
  function row(it, o = {}) {
    const hot = hotInfo(it); // 徽章的出處（「爆」熱度、紅色標籤）不再另列成標籤
    // 來源（使用者選的做法）：多家來源、文末又有另參時，標題下只寫「N 家報導」，媒體名、出資性質與連結只在文末出現一次；
    // 單一來源照舊在標題下寫名稱，文末同一家只放「第 2 篇」。時間軸不列來源標籤，名稱與出資性質都在文末
    const src = parseSrc(it.src);
    const hasAlso = (it.also || []).length > 0 || (it.also_more || []).length > 0;
    const countOnly = hasAlso && src.count >= 2;
    const nameAtTop = !!it.src && !o.fold && !countOnly;
    const linkOpt = nameAtTop ? { shown: new Set(src.names) } : { notes: src.notes };
    const tags = [];
    if (it.src && !o.fold) tags.push(h('span', { class: 'tag tag-neutral' }, [countOnly ? `${src.count} 家報導` : it.src]));
    (it.tags || []).forEach((t) => {
      if (!(hot && hot.tag === t)) tags.push(h('span', { class: `tag ${t.cls}` }, [t.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) tags.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    const title = o.peek ? null : titleLink(it);
    if (title && hot) title.prepend(hotBadge(hot));
    // 標籤（來源、新事件等）放在標題下方（使用者要求）
    const main = o.peek ? [] : [
      o.line && o.sec ? h('span', { class: 'row-sec' }, [o.sec]) : null,
      title,
      tags.length ? h('div', { class: 'tags' }, tags) : null,
    ];
    // 正文連貫閱讀（使用者要求）：摘要 → 重點 → 表格 → 解讀；收集來源（另參、其餘連結）一律收在條目最後。
    // 「多家報導：N 家（…）」重點不顯示：家數已在標題下的「N 家報導」，各家又在「另參」逐一列出連結，
    // 再列一次就重複了（使用者要求：任何地方都不重複同一個資訊）。摘要與解讀在句末分段（paragraphs），長段落讀起來舒服
    const isSrcBullet = (b) => /^<strong>多家報導/.test(b);
    const bullets = (it.bullets_html || []).filter((b) => !isSrcBullet(b));
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    if (bullets.length) body.push(h('ul', { class: 'row-bullets' }, bullets.map((b) => h('li', { html: b }))));
    if (it.table) body.push(table(it.table));
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      if (ps.length) {
        ps[0].prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
        body.push(h('div', { class: 'row-dive' }, ps));
      }
    }
    const srcs = [];
    // 「其餘連結」裡跟另參同一家媒體的那幾篇，併進另參（接在那家後面標「第 N 篇」），其餘連結只留另參沒有的媒體，
    // 同一家媒體的名字在條目裡只出現一次
    const inAlso = new Set((it.also || []).map((l) => l.text));
    const alsoList = [...(it.also || []), ...(it.also_more || []).filter((l) => inAlso.has(l.text))];
    const moreList = (it.also_more || []).filter((l) => !inAlso.has(l.text));
    const seen = new Map(); // 另參與其餘連結共用，接著編號
    if (alsoList.length) {
      srcs.push(h('p', { class: 'row-also' }, [h('span', { class: 'seealso' }, ['另參：', ...links(alsoList, seen, linkOpt)])]));
    }
    if (moreList.length) {
      srcs.push(h('details', { class: 'seealso-more' }, [h('summary', null, [`其餘 ${moreList.length} 個連結`]), ...links(moreList, seen, linkOpt)]));
    }
    if (srcs.length) body.push(h('div', { class: 'row-srcs' }, srcs));
    if (o.peek) main.push(peek(it, tags, body, hot));
    else main.push(...(o.fold ? [fold(it, body)] : body));
    // 熱門新聞已有 HOT 徽章，左欄就不再重複「Hot」字樣
    const left = hot && hot.from === 'left' ? h('span', { class: 'row-time' }) : rowTime(it.left, o.line, it.ts);
    return h('article', { class: hot ? 'row is-hot' : 'row', id: `item-${it.no}`, 'data-k': o.line ? o.k : null }, [
      h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, [it.no]), left]),
      h('div', { class: 'row-main' }, main),
    ]);
  }

  // 時間軸：所有分區的條目依 ts 由新到舊排成一條、按台北日期分組；最前面那組若就是這一期的日期，
  // 不放日期標題（日期已在左上角的日期按鈕）。沒有 ts 的（Today、Hot 這類字樣，或還沒有 ts 的舊資料）照原本順序接在最後。
  // 外層是 <main>（主要內容地標；報頭、頁尾留在外面），沒有預設樣式，外觀不變
  function timeline(r, key) {
    const list = [];
    r.sections.forEach((s, i) => s.blocks.forEach((b) => {
      if (b.type === 'item') list.push({ it: b, sec: s.name, k: key(i), n: list.length, t: b.ts ? Date.parse(b.ts) : NaN });
    }));
    const timed = list.filter((x) => !Number.isNaN(x.t)).sort((a, b) => b.t - a.t || a.n - b.n);
    const rest = list.filter((x) => Number.isNaN(x.t));
    const kids = [];
    const put = (x) => kids.push(row(x.it, { fold: true, line: true, sec: x.sec, k: x.k }));
    let day = '';
    timed.forEach((x) => {
      const d = new Date(x.t + TAIPEI_MS).toISOString().slice(0, 10);
      if (d !== day) {
        if (day || d !== r.date) kids.push(h('h2', { class: 'tl-day' }, [dayLabel(d)]));
        day = d;
      }
      put(x);
    });
    if (timed.length && rest.length) kids.push(h('h2', { class: 'tl-day' }, ['未標時間']));
    rest.forEach(put);
    return h('main', { class: 'tl', id: 'main' }, kids);
  }

  function report(r, cur) {
    const key = (i) => String((i % 10) + 1); // 分區色號 1–10，給地圖外觀依分區上色（超過 10 區循環）
    const dm = /^\d{4}-(\d{2})-(\d{2})$/.exec(r.date || '');
    issueMD = dm ? monthDay(dm[1], dm[2]) : '';
    // 報頭只留大標題（使用者要求：任何地方都不重複同一個資訊）——日期在左上角的日期按鈕，所以地圖外觀的長日期拿掉；
    // 英文刊名（DAILY INTERNATIONAL BRIEFING）跟大標題是同一個名字，拿掉；期號使用者覺得是多餘的裝飾，拿掉（資料照留）。
    // 大標題本身是本期章節的下拉（titleChapters）。
    // 本期來源收到文末（不是首要資訊）。導言（r.intro）依使用者要求不在任何版面顯示，資料照留：Telegram 與首頁列表的摘要還會用到
    const head = h('header', { class: 'masthead' }, [titleChapters(cur, r)]);
    const tagsOf = r.src_tags || [];
    const srcs = tagsOf.length ? h('aside', { class: 'srcs', 'aria-labelledby': 'srcs-title' }, [
      h('h2', { class: 'srcs-title', id: 'srcs-title' }, ['本期來源']),
      h('ul', { class: 'srcs-list' }, tagsOf.map((t) => h('li', { class: 'tag tag-neutral' }, [t]))),
    ]) : null;
    // 頁尾只留產生方式；刊名與日期上面都有了，不再重複
    const foot = h('footer', { class: 'foot' }, [h('span', { class: 'foot-left' }, [r.foot_left])]);
    if (view.read === 'timeline') return [head, timeline(r, key), srcs, foot].filter(Boolean);
    const peekMode = view.read === 'scan';
    // 分區目錄不放在頁面上，任何讀法都一樣（使用者要求：章節跳轉在大標題的下拉裡，不重複擺；
    // 速讀原本黏在頂端的分區列也一起拿掉）。分區標題只留名稱：「SEC. 01」編號與「N 則」使用者覺得是多餘的裝飾（則數在大標題下拉的章節清單裡有）
    const secs = r.sections.map((s, i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}`, 'data-k': key(i) }, [
      h('div', { class: 'sec-tab' }, [h('h2', { class: 'sec-name' }, [s.name])]),
      h('div', { class: 'sec-body' }, s.blocks.flatMap((b) => {
        if (b.type === 'item') return [row(b, { peek: peekMode })];
        if (b.type === 'sub') return [h('h3', { class: 'sec-sub', html: b.html })];
        return notes(b.blocks, 'sec-note');
      })),
    ]));
    // 分區包在 <main>（主要內容地標）；報頭、本期來源、頁尾留在外面
    return [head, h('main', { id: 'main' }, secs), srcs, foot].filter(Boolean);
  }

  // ── 右上角「版面」按鈕與面板（使用者要求固定在報頭上方那一列的右端，面板往下展開）──────
  // 切換時保住閱讀位置：記下畫面頂端正在讀的那一則，換完捲回同一則
  function readingSpot() {
    if (window.scrollY < 1) return null;
    for (const el of app.querySelectorAll('.row')) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 80) return { id: el.id, top: rect.top };
    }
    return null;
  }

  // 換讀法、外觀時用 view transition 淡入淡出（不支援的瀏覽器直接換；減少動態的設定由 report.css 取消動畫）。
  // 回傳 DOM 換完的 Promise：要在新畫面上做事（例如還原焦點）的呼叫端要等它
  function redraw(rebuild) {
    const spot = readingSpot();
    const update = () => {
      const focused = document.activeElement;
      applyView();
      if (rebuild && shown) app.replaceChildren(...page());
      // 「版面」面板跟著頁首那一列搬到重建的新列，搬動時焦點會掉到 body：放回面板裡原本那顆按鈕
      if (focused && focused.isConnected && focused !== document.activeElement) focused.focus({ preventScroll: true });
      const el = spot && document.getElementById(spot.id);
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - Math.max(spot.top, B.barHeight()));
    };
    if (!document.startViewTransition) {
      update();
      return Promise.resolve();
    }
    return document.startViewTransition(update).updateCallbackDone;
  }

  function layoutPanel() {
    // 每一列：左邊項目名稱、右邊相連的分段選項（選中那格用主色填滿，同目前的類型標籤）
    const groups = [
      ['讀法', READS, () => view.read, (v) => { view.read = v; store(KEY_READ, v); redraw(true); }],
      ['外觀', LOOKS, () => view.look, (v) => { view.look = v; store(KEY_LOOK, v); redraw(false); }],
      // 剛部署時瀏覽器可能還快取著舊版 site.js（沒有 THEMES）：少一組配色，不讓整頁卡住。
      // 配色鈕的文字由 site.js 的 themeLabel 給（「自動」會註明目前是深色或淺色）
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
    // 別的分頁改了配色、或系統深淺改變（site.js 發出 air-theme）：更新選中狀態與「自動」的說明
    document.addEventListener('air-theme', sync);
    sync();
    // 由 editions() 放進報頭上方那一列的最右邊。打開時焦點移到目前選中的讀法，
    // 鍵盤與螢幕閱讀器使用者才知道面板開了、從哪裡開始
    vwBox = B.dropdown({
      cls: 'vw', id: 'vw-panel', title: '版面設定', closeLabel: '關閉版面設定',
      // 字包一層 .dd-txt：手機上只露圖示（字留給報讀器），三顆按鈕才放得進一列
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', { class: 'dd-txt' }, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]'),
    });
  }

  // 目前這一期的整頁：不是今天／本週／本月那一期時最上面的提示條（bar.js）、報頭最上面那一列（日期、本日新聞、本週新聞、版面）
  // ＋報告（大標題是本期章節的下拉）。部署後的快取空窗可能拿到還沒有 staleBanner 的舊 bar.js：少提示條，頁面照常
  const stale = () => (B.staleBanner ? B.staleBanner(shown.entry.period) : null);
  const page = () => [stale(), editions(shown.entry), ...report(shown.data, shown.entry)].filter(Boolean);

  const problem = (cur, text, more) => app.replaceChildren(
    ...[all.length ? editions(cur) : null].filter(Boolean),
    h('p', { class: 'load-error', role: 'alert' }, [text, more || null]),
  );

  // 這個類型的全部期別（<系列>/index.json）。代號不合規則、檔案不存在（舊資料還沒有類型清單）或格式不對都回 null，
  // 呼叫端就只用 index.json 裡的項目，不報錯
  async function seriesList(t) {
    if (!/^[a-z0-9_-]+$/.test(t)) return null;
    try {
      const doc = await A.getJSON(`${t}/index.json`);
      return doc && Array.isArray(doc.items) ? doc : null;
    } catch (e) {
      return null;
    }
  }

  async function main() {
    const t = query.get('t') || '';
    const d = query.get('d') || '';
    const listing = seriesList(t); // 和 index.json 同時抓，不排隊
    try {
      index = await A.getJSON('index.json');
    } catch (err) {
      problem(null, `新聞清單載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    merge(index.items || []);
    // 類型清單的項目沒有 series、series_title、cadence：從 index.json 的類型設定補（沒有就用清單自己的）
    const doc = await listing;
    if (doc) {
      const info = (index.series || []).find((s) => s.id === t) || {};
      const extra = {
        series: t, series_title: info.title || doc.title || t, cadence: info.cadence || doc.cadence || 'daily',
      };
      merge(doc.items.filter((e) => e && e.period && e.data).map((e) => ({ ...e, ...extra })));
    }
    const entry = all.find((e) => e.series === t && (!d || e.period === d));
    if (!entry) {
      // 這個類型還有別期就帶去它的最新一期，連類型都沒有就回頭版
      const more = all.some((e) => e.series === t)
        ? h('a', { href: link(t) }, ['看這個類型的最新一期'])
        : h('a', { href: './' }, ['回頭版']);
      if (all.length) problem(null, `找不到這一期（${t}${d ? ` ${d}` : ''}）。`, more);
      else problem(null, '還沒有任何報告。');
      return;
    }
    let data;
    try {
      data = await A.getJSON(entry.data);
    } catch (err) {
      problem(entry, `這一期的資料載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    shown = { entry, data };
    document.title = `${data.title} ${data.date}｜AI Reports`;
    app.replaceChildren(...page());
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  layoutPanel();
  main();
})();
