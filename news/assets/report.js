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
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const query = new URLSearchParams(location.search);
  if (!query.get('t')) return; // 頭版（不帶 t）由 front.js 負責
  let index = { series: [], items: [] };
  let all = [];
  let shown = null; // 目前這一期 { entry, data }：換讀法時重繪用
  let vwBox = null; // 「版面」按鈕＋面板（layoutPanel 建一次），每次重繪頁首那一列時放進最右邊

  // ── 版面：讀法 × 外觀，各取第一個為預設。這次只做這幾種（樣稿另有專注、日曆、直排）──
  const READS = [['full', '完整'], ['scan', '速讀'], ['timeline', '時間軸']];
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖']];
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

  function periodLabel(e) {
    let m;
    if (e.cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(e.period))) return `${m[1]} 年第 ${+m[2]} 週`;
    if (e.cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(e.period))) return `${m[1]} 年 ${+m[2]} 月`;
    const d = new Date(`${e.period}T00:00:00`);
    return Number.isNaN(d.getTime()) ? e.period : `${e.period}（週${WEEK[d.getDay()]}）`;
  }

  // 這一期的日期（月/日，不補零），條目左欄的日期跟它一樣就不再顯示（使用者要求：任何地方都不重複同一個資訊）
  let issueMD = '';
  const monthDay = (m, d) => `${+m}/${+d}`;

  // 2026-11-18 → 11 月 18 日（三）（時間軸的日期標題）
  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m} 月 ${d} 日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
  }

  // 報頭上方那一列（使用者指定位置）：左上角日期（期別）、中間新聞類型標籤、右上角「版面」按鈕。
  // 類型標籤第一個是「頭版」（回 news/ 不帶參數），其餘依 index.json 的系列順序，只列有報告的。
  // 有「頭版」可回之後，只有一種新聞也照列（原本只有一種時不列，因為那一個標籤只會跟報頭大標題重複）
  function editions(cur, data) {
    const order = (index.series || []).map((s) => s.id);
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    const ids = [...new Set(all.map((e) => e.series))].sort((a, b) => rank(a) - rank(b));
    const kids = [];
    if (cur) kids.push(periodPicker(cur, data));
    if (ids.length) {
      kids.push(h('div', { class: 'ed-tabs' }, [h('a', { class: 'ed-tab', href: './' }, ['頭版']), ...ids.map((id) => {
        const latest = all.find((e) => e.series === id);
        return h('a', {
          class: 'ed-tab', href: link(id), 'aria-current': cur && id === cur.series ? 'page' : null,
        }, [latest.series_title || latest.title]);
      })]));
    }
    if (vwBox) kids.push(vwBox);
    return kids.length ? h('nav', { class: 'editions', 'aria-label': '期別、新聞類型與版面' }, kids) : null;
  }

  // 日期清單的分組與每列文字：日報依月份分組、一列是「11/18　週三」；週報、月報依年份分組、一列是「第 47 週」「11 月」
  function periodGroup(e) {
    const y = e.period.slice(0, 4);
    if (e.cadence === 'weekly' || e.cadence === 'monthly') return `${y} 年`;
    const m = /^\d{4}-(\d{2})-\d{2}$/.exec(e.period);
    return m ? `${y} 年 ${+m[1]} 月` : y;
  }
  function periodRow(e) {
    let m;
    if (e.cadence === 'weekly' && (m = /^\d{4}-W(\d{2})$/.exec(e.period))) return [`第 ${+m[1]} 週`];
    if (e.cadence === 'monthly' && (m = /^\d{4}-(\d{2})$/.exec(e.period))) return [`${+m[1]} 月`];
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.period);
    if (!m) return [e.period];
    const wd = WEEK[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()];
    return [h('span', null, [`${+m[2]}/${+m[3]}`]), h('span', { class: 'pd-wd' }, [`週${wd}`])];
  }

  // 左上角的日期按鈕：顯示目前這期，點開是這一期的「目錄」——左欄本期章節（跳到分區，使用者要求章節跳轉放這裡、
  // 頁面上不再重複擺分區目錄），右欄這個類型的全部期別（換期）。每一項都是連結（換期就是換頁，不是表單選值，
  // 所以用連結清單、不用 <select>）；點了連結面板就收起。時間軸讀法沒有分區，章節欄由 CSS 藏起來。
  // 同一頁的內容不會變：建一次，重繪頁首那一列時重用（不重複掛 document 的事件）
  let pdBox = null;
  let pdKey = '';
  function periodPicker(cur, data) {
    const cacheKey = `${keyOf(cur)}${data ? '+data' : ''}`;
    if (pdBox && pdKey === cacheKey) return pdBox;
    const named = data ? (data.sections || []).map((s, i) => [s, i]).filter(([s]) => s.name) : [];
    const secCol = named.length ? h('div', { class: 'pd-col pd-secs' }, [
      h('p', { class: 'pd-group', id: 'pd-secs-label' }, ['章節']),
      h('ul', { class: 'pd-items', 'aria-labelledby': 'pd-secs-label' }, named.map(([s, i]) => h('li', null, [
        // data-k：地圖外觀在章節名稱前加分區色塊（頁面上的彩色分區目錄拿掉了，顏色對照改由這裡提供）
        h('a', { class: 'pd-item', href: `#sec-${pad(i + 1)}`, 'data-k': String((i % 10) + 1) }, [
          h('span', { class: 'pd-sec' }, [s.name]), h('span', { class: 'pd-n' }, [String(s.count)]),
        ]),
      ]))),
    ]) : null;
    const groups = [];
    all.filter((e) => e.series === cur.series).forEach((e) => {
      const name = periodGroup(e);
      let last = groups[groups.length - 1];
      if (!last || last.name !== name) groups.push(last = { name, items: [] });
      last.items.push(e);
    });
    const dateCol = h('div', { class: 'pd-col pd-dates' }, groups.flatMap((g, gi) => [
      h('p', { class: 'pd-group', id: `pd-g${gi}` }, [g.name]),
      h('ul', { class: 'pd-items', 'aria-labelledby': `pd-g${gi}` }, g.items.map((e) => h('li', null, [
        h('a', { class: 'pd-item', href: link(e.series, e.period), 'aria-current': e.period === cur.period ? 'page' : null }, periodRow(e)),
      ]))),
    ]));
    pdKey = cacheKey;
    pdBox = dropdown({
      cls: 'pd', id: 'pd-panel', title: '目錄', closeLabel: '關閉目錄',
      toggleKids: [
        h('span', { class: 'dd-ico', html: ICON_CALENDAR }),
        h('span', { class: 'visually-hidden' }, ['目錄：']), h('span', null, [periodLabel(cur)]),
        h('span', { class: 'dd-caret', html: ICON_CARET }),
      ],
      body: [h('div', { class: 'pd-body' }, [secCol, dateCol])],
      // 打開時焦點落在第一個看得到的連結（有章節就是第一個章節，時間軸讀法是目前這期）
      pick: (panel) => [...panel.querySelectorAll('.pd-secs .pd-item, .pd-item[aria-current=page]')].find((a) => a.offsetParent !== null),
    });
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
  // 日期跟這一期相同就只放時刻（日期已在左上角的日期按鈕）；時間軸的日期由分組標題負責，一律只放時刻
  function rowTime(left, line) {
    const m = /^((\d{1,2})\/(\d{1,2}))(?:\s+(\d{1,2}:\d{2}))?$/.exec(left || '');
    if (!m) return h('span', { class: 'row-time' }, [h('span', { class: 'rt-txt' }, [left || ''])]);
    const kids = [];
    if (!line && monthDay(m[2], m[3]) !== issueMD) kids.push(h('span', { class: 'rt-d' }, [m[1]]));
    if (m[4]) kids.push(...(kids.length ? [' '] : []), h('span', { class: 'rt-hm' }, [m[4]]));
    return h('span', { class: 'row-time' }, kids);
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

  // 時間軸：摘要收成兩行，點「看解讀」展開完整摘要、重點、解讀與收集來源；只有摘要可看時整段列出、不必展開
  function fold(it, body) {
    const more = (it.also || []).length || (it.also_more || []).length || (it.bullets_html || []).length
      || it.table || it.dive_html;
    if (!more) return it.summary_html ? h('p', { class: 'teaser teaser-all', html: it.summary_html }) : null;
    return h('details', { class: 'more' }, [
      h('summary', { class: 'more-sum' }, [
        it.summary_html ? h('span', { class: 'teaser' }, [plainText(it.summary_html)]) : null,
        h('span', { class: 'more-hint' }, [
          h('span', { class: 'mh-o' }, [it.dive_html ? '看解讀' : '看更多']),
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

  // 一則條目。o.peek：速讀（只列標題，點標題展開）；o.fold：時間軸（兩行摘要＋「看解讀」，不列來源標籤，同樣稿）；
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
        ps[0].prepend(h('span', { class: 'dive-label' }, ['解讀']));
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
    const left = hot && hot.from === 'left' ? h('span', { class: 'row-time' }) : rowTime(it.left, o.line);
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

  function report(r) {
    const key = (i) => String((i % 10) + 1); // 分區色號 1–10，給地圖外觀依分區上色（超過 10 區循環）
    const dm = /^\d{4}-(\d{2})-(\d{2})$/.exec(r.date || '');
    issueMD = dm ? monthDay(dm[1], dm[2]) : '';
    // 報頭只留大標題（使用者要求：任何地方都不重複同一個資訊）——日期在左上角的日期按鈕，所以地圖外觀的長日期拿掉；
    // 英文刊名（DAILY INTERNATIONAL BRIEFING）跟大標題是同一個名字，拿掉；期號使用者覺得是多餘的裝飾，拿掉（資料照留）。
    // 本期來源收到文末（不是首要資訊）。導言（r.intro）依使用者要求不在任何版面顯示，資料照留：Telegram 與首頁列表的摘要還會用到
    const head = h('header', { class: 'masthead' }, [h('h1', { class: 'mast-title' }, [r.title])]);
    const tagsOf = r.src_tags || [];
    const srcs = tagsOf.length ? h('aside', { class: 'srcs', 'aria-labelledby': 'srcs-title' }, [
      h('h2', { class: 'srcs-title', id: 'srcs-title' }, ['本期來源']),
      h('ul', { class: 'srcs-list' }, tagsOf.map((t) => h('li', { class: 'tag tag-neutral' }, [t]))),
    ]) : null;
    // 頁尾只留產生方式；刊名與日期上面都有了，不再重複
    const foot = h('footer', { class: 'foot' }, [h('span', { class: 'foot-left' }, [r.foot_left])]);
    if (view.read === 'timeline') return [head, timeline(r, key), srcs, foot].filter(Boolean);
    const peekMode = view.read === 'scan';
    // 分區目錄不放在頁面上，任何讀法都一樣（使用者要求：章節跳轉在左上角的日期按鈕「目錄」裡，不重複擺；
    // 速讀原本黏在頂端的分區列也一起拿掉）。分區標題只留名稱：「SEC. 01」編號與「N 則」使用者覺得是多餘的裝飾（則數在日期選單的章節清單裡有）
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
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - Math.max(spot.top, view.read === 'scan' ? 64 : 0));
    };
    if (!document.startViewTransition) {
      update();
      return Promise.resolve();
    }
    return document.startViewTransition(update).updateCallbackDone;
  }

  // 頁首下拉面板的圖示（裝飾用，aria-hidden；按鈕的名稱來自文字或 aria-label）：
  // 調整滑桿（「版面」，方形旋鈕配合藍圖的方角）、月曆（日期）、往下的箭頭（日期按鈕右側，展開時轉向）、關閉
  const ICON_SLIDERS = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M2.5 6H11M15 6h2.5M2.5 14H5M9 14h8.5"/><rect x="11" y="4" width="4" height="4"/><rect x="5" y="12" width="4" height="4"/></svg>';
  const ICON_CALENDAR = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M3 4.5h14V17H3zM3 8.5h14M7 2.5v4M13 2.5v4"/></svg>';
  const ICON_CARET = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M6 8l4 4 4-4"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5 5 15"/></svg>';

  // 打開面板時淡入、往下滑 4px（回應使用者的動作；減少動態時只淡入）。用 WAAPI 不用 @starting-style：
  // 換讀法時面板會跟著頁首那一列搬家，@starting-style 會在每次搬家重播一次淡入
  function openMotion(el) {
    if (!el.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.animate(still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 140, easing: 'ease-out' });
  }

  // 頁首那一列的下拉面板（左上角日期、右上角版面）共用的骨架與開關：
  // 面板頂端是標題＋ ×（非 modal 面板要有看得見的關閉鈕，指南）；按鈕切換開關，點外面、按 Esc、按 × 都會收起
  // （Esc、× 收起後焦點回按鈕）；打開時淡入、焦點移到 pick(panel) 給的元素。點另一顆按鈕也算點外面，所以同時只開一個。
  // 按鈕在前、面板緊接在後：鍵盤從按鈕按 Tab 直接進面板
  function dropdown({ cls, id, title, closeLabel, toggleKids, body, pick }) {
    const toggle = h('button', { type: 'button', class: 'dd-toggle', 'aria-expanded': 'false', 'aria-controls': id }, toggleKids);
    const close = h('button', { type: 'button', class: 'dd-close', 'aria-label': closeLabel, html: ICON_CLOSE });
    const panel = h('div', { class: `dd-panel ${cls}-panel`, id, role: 'dialog', 'aria-labelledby': `${id}-title`, hidden: true }, [
      h('div', { class: 'dd-head' }, [h('span', { class: 'dd-title', id: `${id}-title` }, [title]), close]),
      ...body,
    ]);
    const box = h('div', { class: `dd ${cls}` }, [toggle, panel]);
    function open(yes) {
      panel.hidden = !yes;
      toggle.setAttribute('aria-expanded', String(yes));
      if (!yes) return;
      openMotion(panel);
      ((pick && pick(panel)) || close).focus();
    }
    const shut = () => {
      open(false);
      toggle.focus();
    };
    toggle.addEventListener('click', () => open(panel.hidden));
    close.addEventListener('click', shut);
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) open(false); }); // 點了章節或日期連結就收起
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !box.contains(e.target)) open(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) shut();
    });
    return box;
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
    vwBox = dropdown({
      cls: 'vw', id: 'vw-panel', title: '版面設定', closeLabel: '關閉版面設定',
      toggleKids: [h('span', { class: 'dd-ico', html: ICON_SLIDERS }), h('span', null, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]'),
    });
  }

  // 新聞類型標籤列的捲軸是藏起來的，兩端「還有更多」的提示由 report.css 用捲動驅動動畫畫；
  // 不支援的瀏覽器（Safari 26 以前等）改用 IntersectionObserver 加 .more-start／.more-end（指南的退路寫法）。
  // 另外把目前的新聞類型捲進標籤列的可視範圍（只捲標籤列本身，不動整頁）
  let hintObservers = [];
  function scrollHints() {
    hintObservers.forEach((o) => o.disconnect());
    hintObservers = [];
    const tabs = app.querySelector('.ed-tabs');
    const cur = tabs && tabs.querySelector('[aria-current=page]');
    if (cur && tabs.scrollWidth > tabs.clientWidth) {
      const offset = cur.getBoundingClientRect().left - tabs.getBoundingClientRect().left;
      tabs.scrollLeft += offset - (tabs.clientWidth - cur.offsetWidth) / 2;
    }
    if (window.CSS && CSS.supports('animation-timeline', 'scroll()')) return;
    app.querySelectorAll('.ed-tabs').forEach((scroller) => {
      const first = scroller.firstElementChild;
      const last = scroller.lastElementChild;
      if (!first) return;
      const io = new IntersectionObserver((entries) => entries.forEach(({ target, intersectionRatio }) => {
        scroller.classList.toggle(target === first ? 'more-start' : 'more-end', intersectionRatio < 1);
      }), { root: scroller, threshold: 1, rootMargin: '1px' });
      io.observe(first);
      if (last !== first) io.observe(last);
      hintObservers.push(io);
    });
  }

  // 目前這一期的整頁：報頭上方那一列（期別選單、類型標籤、版面）＋報告。放進畫面後的下一格再設捲動提示
  const page = () => {
    requestAnimationFrame(scrollHints);
    return [editions(shown.entry, shown.data), ...report(shown.data)].filter(Boolean);
  };

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
