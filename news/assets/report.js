/* 共用新聞頁（news/index.html）：讀 index.json 自動列出有報告的新聞類型，依網址 ?t=<系列>&d=<期別>
   載入該期報告 JSON 渲染。沒帶參數顯示最新一期；只帶 t 顯示該類型最新一期。
   預設是原本的「工程藍圖」版型（DOM 結構同 md2html2.py 的 render()）。右下角「版面」可切換讀法（完整／速讀／時間軸）、
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
  let index = { series: [], items: [], years: [] };
  let all = [];
  let archivesLoaded = false;
  let shown = null; // 目前這一期 { entry, data }：換讀法時重繪用

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

  async function loadArchives() {
    if (archivesLoaded) return;
    archivesLoaded = true;
    for (const y of index.years || []) {
      try {
        merge((await A.getJSON(`archive/${y}.json`)).items || []);
      } catch (e) { /* 缺某年的清單就略過 */ }
    }
  }

  function periodLabel(e) {
    let m;
    if (e.cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(e.period))) return `${m[1]} 年第 ${+m[2]} 週`;
    if (e.cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(e.period))) return `${m[1]} 年 ${+m[2]} 月`;
    const d = new Date(`${e.period}T00:00:00`);
    return Number.isNaN(d.getTime()) ? e.period : `${e.period}（週${WEEK[d.getDay()]}）`;
  }

  // 2026-11-18 → 2026 年 11 月 18 日　星期三（地圖外觀的報頭日期）
  function longDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    return `${+m[1]} 年 ${+m[2]} 月 ${+m[3]} 日　星期${WEEK[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()]}`;
  }

  // 2026-11-18 → 11 月 18 日（三）（時間軸的日期標題）
  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m} 月 ${d} 日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
  }

  // 報頭上方的新聞類型標籤（依 index.json 的系列順序，只列有報告的）。只有一種新聞時不列：
  // 那一個標籤只會跟報頭大標題重複（使用者反映）。withSelect：錯誤頁沒有報頭，期別選單改放這裡
  function editions(cur, withSelect) {
    const order = (index.series || []).map((s) => s.id);
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    const ids = [...new Set(all.map((e) => e.series))].sort((a, b) => rank(a) - rank(b));
    const kids = [];
    if (ids.length > 1) {
      kids.push(h('div', { class: 'ed-tabs' }, ids.map((id) => {
        const latest = all.find((e) => e.series === id);
        return h('a', {
          class: 'ed-tab', href: link(id), 'aria-current': cur && id === cur.series ? 'page' : null,
        }, [latest.series_title || latest.title]);
      })));
    }
    if (cur && withSelect) kids.push(periodSelect(cur));
    return kids.length ? h('nav', { class: 'editions', 'aria-label': '新聞類型與期別' }, kids) : null;
  }

  // 期別選單（看其他天）：平常放在報頭來源那一行的右側
  function periodSelect(cur) {
    const periods = all.filter((e) => e.series === cur.series);
    const select = h('select', { class: 'ed-date', id: 'period', name: 'd', 'aria-label': '選擇期別' }, periods.map((e) => h('option', {
      value: e.period, selected: e.period === cur.period,
    }, [periodLabel(e)])));
    if (index.truncated && !archivesLoaded) select.appendChild(h('option', { value: '' }, ['載入更早的期別…']));
    select.addEventListener('change', async () => {
      if (select.value) {
        location.href = link(cur.series, select.value);
        return;
      }
      await loadArchives();
      if (shown) {
        redraw(true);
      } else {
        const nav = app.querySelector('.editions');
        if (nav) nav.replaceWith(editions(cur, true));
      }
    });
    return select;
  }

  // ── 藍圖版型（對應 md2html2.py 的 render）──────────────────────────────
  function table(t) {
    return h('div', { class: 'tbl' }, [h('table', null, [
      h('thead', null, [h('tr', null, t.head.map((c) => h('th', { html: c })))]),
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

  function links(list) {
    return list.flatMap((l, i) => {
      const a = l.url ? h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.text]) : document.createTextNode(l.text);
      return i ? ['、', a] : [a];
    });
  }

  // 左欄時間：「11/18 14:20」拆成日期、時刻兩段（藍圖下看起來與原本的整串文字相同）；Today、Hot 這類字樣原樣。
  // 時間軸的日期已在分組標題，有時刻就只放時刻
  function rowTime(left, line) {
    const m = /^(\d{1,2}\/\d{1,2})(?:\s+(\d{1,2}:\d{2}))?$/.exec(left || '');
    let kids;
    if (!m) kids = [h('span', { class: 'rt-txt' }, [left || ''])];
    else if (!m[2]) kids = [h('span', { class: 'rt-d' }, [m[1]])];
    else if (line) kids = [h('span', { class: 'rt-hm' }, [m[2]])];
    else kids = [h('span', { class: 'rt-d' }, [m[1]]), ' ', h('span', { class: 'rt-hm' }, [m[2]])];
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

  // 時間軸：摘要收成兩行，點「看解讀」展開完整摘要、另參、重點與解讀；只有摘要可看時整段列出、不必展開
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
  // 展開後第一行是來源、標籤與原文連結，接著摘要、另參、重點與解讀；沒有內容可展開就照常把標題做成原文連結
  function peek(it, tags, body, hot) {
    const title = body.length ? h('h3', { class: 'row-title', html: it.title_html }) : titleLink(it);
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
    const tags = [];
    if (it.src && !o.fold) tags.push(h('span', { class: 'tag tag-neutral' }, [it.src]));
    (it.tags || []).forEach((t) => {
      if (!(hot && hot.tag === t)) tags.push(h('span', { class: `tag ${t.cls}` }, [t.text]));
    });
    if (it.heat && !(hot && hot.from === 'heat')) tags.push(h('span', { class: 'tag tag-outline' }, [it.heat]));
    const title = o.peek ? null : titleLink(it);
    if (title && hot) title.prepend(hotBadge(hot));
    const main = o.peek ? [] : [
      o.line && o.sec ? h('span', { class: 'row-sec' }, [o.sec]) : null,
      tags.length ? h('div', { class: 'tags' }, tags) : null,
      title,
    ];
    // 摘要與解讀在句末分段（paragraphs）；另參獨立一行（使用者要求：長段落適時換行、讀起來舒服）
    const body = [];
    if (it.summary_html) {
      body.push(h('div', { class: 'row-sum' }, paragraphs(it.summary_html).map((x) => h('p', { html: x }))));
    }
    if (it.also && it.also.length) {
      body.push(h('p', { class: 'row-also' }, [h('span', { class: 'seealso' }, ['另參：', ...links(it.also)])]));
    }
    if (it.also_more && it.also_more.length) {
      body.push(h('details', { class: 'seealso-more' }, [h('summary', null, [`其餘 ${it.also_more.length} 個連結`]), ...links(it.also_more)]));
    }
    if (it.bullets_html && it.bullets_html.length) {
      body.push(h('ul', { class: 'row-bullets' }, it.bullets_html.map((b) => h('li', { html: b }))));
    }
    if (it.table) body.push(table(it.table));
    if (it.dive_html) {
      const ps = paragraphs(it.dive_html).map((x) => h('p', { html: x }));
      if (ps.length) {
        ps[0].prepend(h('span', { class: 'dive-label' }, ['解讀']));
        body.push(h('div', { class: 'row-dive' }, ps));
      }
    }
    if (o.peek) main.push(peek(it, tags, body, hot));
    else main.push(...(o.fold ? [fold(it, body)] : body));
    // 熱門新聞已有 HOT 徽章，左欄就不再重複「Hot」字樣
    const left = hot && hot.from === 'left' ? h('span', { class: 'row-time' }) : rowTime(it.left, o.line);
    return h('article', { class: hot ? 'row is-hot' : 'row', id: `item-${it.no}`, 'data-k': o.line ? o.k : null }, [
      h('div', { class: 'row-left' }, [h('span', { class: 'row-no' }, [it.no]), left]),
      h('div', { class: 'row-main' }, main),
    ]);
  }

  // 時間軸：所有分區的條目依 ts 由新到舊排成一條、按台北日期分組；
  // 沒有 ts 的（Today、Hot 這類字樣，或還沒有 ts 的舊資料）照原本順序接在最後
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
        day = d;
        kids.push(h('h2', { class: 'tl-day' }, [dayLabel(d)]));
      }
      put(x);
    });
    if (timed.length && rest.length) kids.push(h('h2', { class: 'tl-day' }, ['未標時間']));
    rest.forEach(put);
    return h('div', { class: 'tl' }, kids);
  }

  function report(r, entry) {
    const key = (i) => String((i % 10) + 1); // 分區色號 1–10，給地圖外觀依分區上色（超過 10 區循環）
    const date = [h('span', { class: 'date' }, [r.date])];
    (r.src_tags || []).forEach((t) => date.push(h('span', { class: 'sep' }, ['|']), h('span', { class: 'tag tag-neutral' }, [t])));
    // 配色切換已移到右下角「版面」面板（同樣稿），報頭右上只留期號；mast-cdate 只在地圖外觀顯示。
    // 導言（r.intro）依使用者要求不在任何版面顯示，資料照留：Telegram 訊息與首頁列表的摘要還會用到
    const head = h('header', { class: 'masthead' }, [
      h('div', { class: 'mast-top' }, [
        h('span', { class: 'mast-brand' }, [r.brief]),
        h('div', { class: 'mast-right' }, [h('span', { class: 'mast-issue' }, [r.issue])]),
      ]),
      h('p', { class: 'mast-cdate' }, [longDate(r.date)]),
      h('h1', { class: 'mast-title' }, [r.title]),
      // 來源那一行：左邊日期與來源，右邊「其他天」期別選單（使用者要求從報頭上方移過來、靠右對齊）
      h('div', { class: 'mast-meta' }, [h('div', { class: 'mast-date' }, date), entry ? periodSelect(entry) : null]),
    ]);
    const foot = h('footer', { class: 'foot' }, [
      h('span', { class: 'foot-left' }, [r.foot_left]),
      h('span', { class: 'foot-right' }, [`${r.brief} · ${r.date}`]),
    ]);
    if (view.read === 'timeline') return [head, timeline(r, key), foot];
    const peekMode = view.read === 'scan';
    const cells = [];
    r.sections.forEach((s, i) => {
      if (s.name) {
        cells.push(h('a', { class: 'toc-cell', href: `#sec-${pad(i + 1)}`, 'data-k': key(i) }, [
          h('span', { class: 'toc-no' }, [pad(i + 1)]), h('span', { class: 'toc-name' }, [s.name]),
          h('span', { class: 'toc-count' }, [`${s.count} 則`]),
        ]));
      }
    });
    const secs = r.sections.map((s, i) => h('section', { class: 'sec', id: `sec-${pad(i + 1)}`, 'data-k': key(i) }, [
      h('div', { class: 'sec-tab' }, [
        h('span', { class: 'sec-no' }, [`SEC. ${pad(i + 1)}`]),
        h('h2', { class: 'sec-name' }, [s.name]),
        h('span', { class: 'sec-count' }, [`${s.count} 則`]),
      ]),
      h('div', { class: 'sec-body' }, s.blocks.flatMap((b) => {
        if (b.type === 'item') return [row(b, { peek: peekMode })];
        if (b.type === 'sub') return [h('h3', { class: 'sec-sub', html: b.html })];
        return notes(b.blocks, 'sec-note');
      })),
    ]));
    return [head, cells.length ? h('nav', { class: 'toc', 'aria-label': '分區' }, cells) : null, ...secs, foot].filter(Boolean);
  }

  // ── 右下角「版面」按鈕與面板 ─────────────────────────────────────────
  // 切換時保住閱讀位置：記下畫面頂端正在讀的那一則，換完捲回同一則
  function readingSpot() {
    if (window.scrollY < 1) return null;
    for (const el of app.querySelectorAll('.row')) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > 80) return { id: el.id, top: rect.top };
    }
    return null;
  }

  function redraw(rebuild) {
    const spot = readingSpot();
    applyView();
    if (rebuild && shown) app.replaceChildren(...page());
    const el = spot && document.getElementById(spot.id);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - Math.max(spot.top, view.read === 'scan' ? 64 : 0));
  }

  function layoutPanel() {
    const toggle = h('button', {
      type: 'button', class: 'vw-toggle', 'aria-expanded': 'false', 'aria-controls': 'vw-panel',
    }, ['版面']);
    const panel = h('div', { class: 'vw-panel', id: 'vw-panel', role: 'dialog', 'aria-label': '版面設定', hidden: true });
    const groups = [
      ['讀法', READS, () => view.read, (v) => { view.read = v; store(KEY_READ, v); redraw(true); }],
      ['外觀', LOOKS, () => view.look, (v) => { view.look = v; store(KEY_LOOK, v); redraw(false); }],
      // 剛部署時瀏覽器可能還快取著舊版 site.js（沒有 THEMES）：少一組配色，不讓整頁卡住
      ...(A.THEMES ? [['配色', A.THEMES, A.getTheme, A.setTheme]] : []),
    ].map(([label, list, get, set], gi) => {
      const buttons = list.map(([value, text]) => {
        const b = h('button', { type: 'button' }, [text]);
        b.addEventListener('click', () => {
          if (value !== get()) set(value);
          sync();
        });
        return [b, value];
      });
      panel.appendChild(h('div', { class: 'vw-group', role: 'group', 'aria-labelledby': `vw-label-${gi}` }, [
        h('span', { class: 'vw-label', id: `vw-label-${gi}` }, [label]), ...buttons.map((x) => x[0]),
      ]));
      return { buttons, get };
    });
    function sync() {
      groups.forEach((g) => g.buttons.forEach(([b, value]) => b.setAttribute('aria-pressed', String(value === g.get()))));
    }
    function open(yes) {
      panel.hidden = !yes;
      toggle.setAttribute('aria-expanded', String(yes));
    }
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
    // 手機上固定按鈕會蓋住右下角的字：往下捲（閱讀中）先收起，往上捲、回到頂端或捲到底再出現；面板開著時不收
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const edge = y < 80 || y + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (!edge && panel.hidden && Math.abs(y - lastY) < 8) return; // 累積到 8px 才判斷方向，避免抖動
      toggle.classList.toggle('vw-away', !edge && panel.hidden && y > lastY);
      lastY = y;
    }, { passive: true });
    sync();
    document.body.append(toggle, panel); // 按鈕在前：鍵盤從「版面」按 Tab 直接進面板
  }

  // 目前這一期的整頁：類型標籤（兩種以上新聞才有）＋報告
  const page = () => [editions(shown.entry), ...report(shown.data, shown.entry)].filter(Boolean);

  const problem = (cur, text, more) => app.replaceChildren(
    ...[all.length ? editions(cur, true) : null].filter(Boolean),
    h('p', { class: 'load-error', role: 'alert' }, [text, more || null]),
  );

  async function main() {
    try {
      index = await A.getJSON('index.json');
    } catch (err) {
      problem(null, `新聞清單載入失敗（${err.message}），重新整理再試一次。`);
      return;
    }
    merge(index.items || []);
    const q = new URLSearchParams(location.search);
    const t = q.get('t') || '';
    const d = q.get('d') || '';
    const find = () => (t ? all.find((e) => e.series === t && (!d || e.period === d)) : all[0]);
    let entry = find();
    if (!entry && t && d) {
      await loadArchives();
      entry = find();
    }
    if (!entry) {
      if (all.length) problem(null, `找不到這一期（${t}${d ? ` ${d}` : ''}）。`, h('a', { href: './' }, ['看最新一期']));
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
