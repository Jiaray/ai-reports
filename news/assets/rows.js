/* 新聞卡列表列（本日焦點、系列頁、議題頁共用；暫時頁用不展開的 link()），掛 AIR.rows（介面見檔尾）。依賴 AIR.h、AIR.getJSON；A.facets、A.bar 選用。
   一列＝<details class="peek">：summary 是左緣領域色線、上方小字（系列・時間・家數）、標題、（補充或更正）更新句（每列一樣，沒有頭條樣式），
   右邊箭頭來自 report.css 的 .peek；點開在頁內展開，標題不是連結（summary 裡不放連結、不放標題元素）。
   收合時只用輕量條目（契約 §9）；第一次展開才抓那張卡的檔（決策 D-030），畫摘要、AI 解讀、領域欄位，
   最後一列「開新聞卡｜系列 X、Y｜分類 ▾」（樣式摘要 5.3、5.4）。抓不到只在展開區顯示一行錯誤，收起再點開重抓。
   樣式在 rows.css（.rw／.rw-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const h = A.h;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const ID_RE = /^(\d{4})-W(\d{2})-(\d{4})$/;
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);

  // ── 編號 → 卡檔路徑（同 card.js，改一邊要改兩邊；card.js 要在缺 rows.js 時照樣能用）──
  function weeksIn(y) {
    const t = new Date(Date.UTC(y, 11, 28));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  }
  function cardPath(id) {
    const m = ID_RE.exec(str(id));
    if (!m || +m[2] < 1 || +m[2] > weeksIn(+m[1]) || +m[3] < 1) return null;
    return `cards/${m[1]}/W${m[2]}/${m[3]}.json`;
  }

  // ── 時間（台北）──
  const pad = (n) => String(n).padStart(2, '0');
  const parts = (iso) => {
    const ms = typeof iso === 'string' ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? null : new Date(ms + TAIPEI_MS);
  };
  // 「20:05」
  function hm(iso) {
    const t = parts(iso);
    return t ? `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` : '';
  }
  // 「11/24（二）20:05」；不是今年加年份
  function mdw(iso) {
    const t = parts(iso);
    if (!t) return '';
    const y = t.getUTCFullYear();
    const thisYear = new Date(Date.now() + TAIPEI_MS).getUTCFullYear();
    return `${y === thisYear ? '' : `${y}/`}${t.getUTCMonth() + 1}/${t.getUTCDate()}（${WEEK[t.getUTCDay()]}）${hm(iso)}`;
  }
  // 上方小字的時間：寫法由頁面決定（本日焦點多久前、系列頁時刻、議題頁日期，樣式摘要 5.6）
  const time = (iso, text, title) => h('time', { class: 'rw-tm', datetime: iso, title: title || null }, [text]);

  // ── 列表頁共用（系列頁；議題頁、暫時頁也用）：事件時間、台北日曆日、日段標題、同一天內的順序 ──
  // 事件時間（樣式摘要 5.2）：索引的 event_at；舊索引沒有就照契約 §9 算（late 用最早報導）
  const eventAt = (c) => str(c && c.event_at) || (c && c.late === true && str(c.first_reported_at)) || str(c && c.born_at);
  // 台北日曆日 YYYY-MM-DD（解析不出來給 ''）；today() 是看的當下
  const dayOf = (iso) => {
    const t = parts(iso);
    return t ? t.toISOString().slice(0, 10) : '';
  };
  const today = () => new Date(Date.now() + TAIPEI_MS).toISOString().slice(0, 10);
  function shiftDay(key, n) {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  // 日段標題：「今天 11/25（三）」「昨天 11/24（二）」，再往前「11/23（一）」；不是今年加年份
  function dayLabel(key) {
    const d = new Date(`${key}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return '';
    const now = today();
    const md = `${d.getUTCFullYear() === +now.slice(0, 4) ? '' : `${d.getUTCFullYear()}/`}${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`;
    if (key === now) return `今天 ${md}`;
    return key === shiftDay(now, -1) ? `昨天 ${md}` : md;
  }
  // 高、中、低 → 0、1、2，沒標 3（事件分量、急迫性共用）
  const LEVEL = new Map([['高', 0], ['中', 1], ['低', 2]]);
  const level = (v) => (LEVEL.has(v) ? LEVEL.get(v) : 3);
  // 同一天內（設計 §6.7、契約 §9 1.16）：事件分量 → heat_rank 小的在前（沒有排後）→ 時間新到舊。at(c) 給比時間用的時刻（預設事件時間）
  const heatRank = (c) => (typeof c.heat_rank === 'number' && Number.isFinite(c.heat_rank) ? c.heat_rank : 2);
  const msOf = (iso) => {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  const byImportance = (at = eventAt) => (a, b) => level(a.weight) - level(b.weight) || heatRank(a) - heatRank(b)
    || (msOf(at(b)) - msOf(at(a))) || 0;

  // ── *_html 的再淨化（全站一份，新聞卡頁 card.js 也用這裡的 rich／prose／dive）。只留下列標籤與屬性；<a> 只收 http(s)，一律新分頁＋noopener ──
  const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
  const TAGS = new Map([['a', ['href']], ['strong', []], ['b', []], ['em', []], ['br', []]]);
  const DROP = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'noscript']);
  // 不在清單的元素 Sanitizer 會連內文一起刪；常見的文字外框改成只拆框留字（下面 clean() 的退回做法本來就拆框留字）
  const ALLOW = {
    elements: [...TAGS].map(([name, attributes]) => ({ name, attributes })),
    replaceWithChildrenElements: ['span', 'i', 'u', 's', 'code', 'small', 'sub', 'sup', 'mark', 'abbr', 'q', 'cite', 'time', 'p', 'div'],
  };
  function clean(node) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) return;
      if (n.nodeType !== Node.ELEMENT_NODE || DROP.has(n.localName)) {
        n.remove();
        return;
      }
      clean(n);
      const keep = TAGS.get(n.localName);
      if (!keep || (n.localName === 'a' && !isWeb(n.getAttribute('href')))) {
        n.replaceWith(...n.childNodes);
        return;
      }
      [...n.attributes].forEach((a) => { if (!keep.includes(a.name)) n.removeAttribute(a.name); });
      if (n.localName === 'a') {
        n.setAttribute('target', '_blank');
        n.setAttribute('rel', 'noopener');
      }
    });
  }
  function rich(tag, attrs, html) {
    const el = h(tag, attrs);
    if ('setHTML' in Element.prototype) {
      try {
        el.setHTML(html, { sanitizer: ALLOW });
        clean(el); // Sanitizer 預設留 mailto: 等其他 scheme
        return el;
      } catch (e) { /* 設定不被接受：走下面的過濾 */ }
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    clean(tpl.content);
    el.replaceChildren(tpl.content);
    return el;
  }
  // 句末分段：只在標籤、<a>／<strong>、引號括號之外斷；每段至少 min 字，結尾不到 min/2 併回前段
  const OPEN = '「『（(〔【';
  const CLOSE = '」』）)〕】';
  const ENDS = '。！？';
  function paragraphs(html, min = 60) {
    const textLen = (s) => s.replace(/<[^>]*>/g, '').length;
    const out = [];
    String(html || '').split(/<br\s*\/?>/i).forEach((block) => {
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
  const prose = (cls, html) => {
    const ps = paragraphs(html).map((x) => rich('p', null, x));
    return ps.length ? h('div', { class: cls }, ps) : null;
  };
  function dive(html) {
    const box = prose('row-dive', html);
    if (box) box.firstChild.prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
    return box;
  }
  // 領域欄位（資安的影響範圍與處置、財經的關鍵數據…）
  function fields(card) {
    const rows = list(card.fields).filter((f) => f && str(f.name) && str(f.html));
    return rows.length ? h('dl', { class: 'rw-fields' }, rows.map((f) => h('div', { class: 'rw-field' }, [
      h('dt', null, [f.name]), rich('dd', null, f.html),
    ]))) : null;
  }

  // ── 卡檔：編號＋版本快取一份（重畫、再展開不重抓）；失敗不留，下次展開重抓 ──
  const cache = new Map();
  function fetchCard(c) {
    const key = `${c.id}@${c.version || ''}`;
    if (!cache.has(key)) {
      const p = A.getJSON(cardPath(c.id)).then((card) => {
        if (!card || typeof card !== 'object' || card.id !== c.id || !str(card.title)) throw new Error('資料不完整');
        return card;
      });
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  }
  // 機構、人物套別名表（同 card.js；讀不到照原樣），第一次展開才抓
  let aliasDoc = null;
  const aliases = () => aliasDoc || (aliasDoc = A.getJSON('aliases.json').catch(() => null));
  function aliased(facets, table) {
    if (!facets || typeof facets !== 'object' || !table) return facets;
    const out = { ...facets };
    ['org', 'person'].forEach((k) => {
      const map = table[k] && typeof table[k] === 'object' ? table[k] : null;
      if (map && Array.isArray(out[k])) out[k] = [...new Set(out[k].map((v) => (typeof map[v] === 'string' ? map[v] : v)))];
    });
    return out;
  }

  // ── 一列 ──
  // c：輕量條目（契約 §9）。o：
  //   meta(id) → { short, group }：系列短名與領域（頁面從 index.json 給）
  //   page：這頁本身的系列代號（字串或陣列）：上方小字、最後一列都不列（本日焦點不給，全部都列）
  //   time：上方小字的時間節點（用 time() 做）；series:false＝上方小字不列系列（議題頁）
  //   extra：上方小字接在家數後的字串（鄉民頁的平台熱度「85 推」）；flag：標題前的紅底標示（資安頁「遭利用」）
  //   known：頁面上已寫的字（議題頁的議題路徑「上層 › 子議題」），展開後的分類不重列
  //   tag：外層元素（預設 article；放進 <ol> 時給 li）；id
  // 回傳外層元素（data-id＝編號、data-fq＝系列代號空白分隔，給頁面過濾）；編號不對或沒有標題回 null
  const seriesIds = (c) => [...new Set(list(c.series).filter((s) => typeof s === 'string' && s))];
  const metaOf = (o) => o.meta || ((id) => ({ short: id, group: '' }));
  // 上方小字：這頁以外的系列・時間・家數・頁面加的字・網路討論（row、link 共用）
  function topLine(c, o, others, tag) {
    const meta = metaOf(o);
    const outlets = c.heat && Number.isInteger(c.heat.outlets) && c.heat.outlets > 0 ? c.heat.outlets : 0;
    const warn = A.bar && A.bar.ICON ? A.bar.ICON.warn : '';
    return h(tag, { class: 'rw-mt' }, [
      ...(o.series === false ? [] : others.map((s) => h('span', { class: 'rw-ty', 'data-group': meta(s).group || null }, [meta(s).short || s]))),
      o.time || null,
      outlets ? h('span', { class: 'rw-n' }, [`${outlets} 家`]) : null,
      ...list(o.extra).filter((x) => str(x)).map((x) => h('span', { class: 'rw-n' }, [x])),
      c.online_only === true ? h('span', { class: 'rw-online' }, [h('span', { class: 'rw-online-ico', html: warn }), '網路討論，未經媒體證實']) : null,
    ]);
  }
  // 最後一段 log：補充「更新 HH:MM」、更正紅色「更正 HH:MM」＋該段的更新句（更正句開頭的「更正：」不重寫）
  function updLine(c) {
    const lu = c.last_update && typeof c.last_update === 'object' ? c.last_update : null;
    const fix = Boolean(lu && lu.kind === 'correction');
    let text = lu ? str(lu.text).trim() : '';
    if (fix) text = text.replace(/^更正[：:]\s*/, '');
    return lu && (fix || lu.kind === 'supplement') && hm(lu.at) ? h('span', { class: `rw-up${fix ? ' is-fix' : ''}` }, [
      h('span', { class: 'rw-up-k' }, [fix ? '更正 ' : '更新 ', h('time', { datetime: lu.at, title: mdw(lu.at) }, [hm(lu.at)])]),
      text ? h('span', { class: 'rw-up-t' }, [text]) : null,
    ]) : null;
  }
  const outer = (c, o, all, cls, kids) => h(o.tag || 'article', {
    class: cls, id: o.id || null, 'data-id': c.id,
    'data-group': (all.length && metaOf(o)(all[0]).group) || null, 'data-fq': all.join(' '), // 沒有系列＝沒有領域色（色線用分隔線色）
  }, kids);

  function row(c, o = {}) {
    if (!c || typeof c !== 'object' || !cardPath(c.id) || !str(c.title)) return null;
    const meta = metaOf(o);
    const page = new Set([].concat(o.page || []));
    const all = seriesIds(c);
    const others = all.filter((s) => !page.has(s));
    const top = topLine(c, o, others, 'span');
    const upd = updLine(c);
    const body = h('div', { class: 'more-body rw-body' });
    const det = h('details', { class: 'peek' }, [
      h('summary', { class: 'peek-sum' }, [top, h('span', { class: 'row-title rw-title' }, [
        str(o.flag) ? h('span', { class: 'rw-flag' }, [o.flag]) : null, c.title,
      ]), upd]),
      body,
    ]);

    const names = others.map((s) => meta(s).short || s);
    // 最後一列：開新聞卡｜系列（每個連到系列頁；不列本頁的系列）｜分類 ▾（卡檔到了才有）
    function acts(fx) {
      const links = others.flatMap((s, i) => [
        i ? h('span', { class: 'rw-sr-sep' }, ['、']) : null,
        h('a', { class: 'rw-act', href: `./?t=${encodeURIComponent(s)}` }, [meta(s).short || s]),
      ]).filter(Boolean);
      return h('div', { class: 'rw-acts' }, [
        h('a', { class: 'rw-act', href: `card.html#${c.id}` }, ['開新聞卡']),
        links.length ? h('span', { class: 'rw-sr' }, [h('span', { class: 'rw-lab' }, ['系列']), ...links]) : null,
        fx ? h('span', { class: 'rw-sep', 'aria-hidden': 'true' }) : null,
        fx ? fx.toggle : null,
      ]);
    }
    let state = 'idle'; // idle → loading → done；失敗回 idle
    async function fill() {
      state = 'loading';
      body.replaceChildren(h('p', { class: 'rw-wait' }, ['載入中…']));
      try {
        const [card, table] = await Promise.all([fetchCard(c), aliases(), A.facets ? A.facets.load() : null]);
        const facets = aliased(card.facets, table);
        // 分類：系列名已在這一列、頁面上已寫的字（known）→ 不重列；議題連到議題頁
        const fx = A.facets && facets ? A.facets.parts(facets, {
          title: str(card.title), types: [...names, ...list(o.known).filter((x) => str(x))], links: true,
        }) : null;
        body.replaceChildren(...[
          prose('row-sum', str(card.summary_html)), dive(str(card.dive_html)), fields(card), acts(fx), fx ? fx.panel : null,
        ].filter(Boolean));
        state = 'done';
      } catch (err) {
        const why = err instanceof SyntaxError ? '資料格式不對' : (err && err.message) || String(err);
        body.replaceChildren(h('p', { class: 'rw-err', role: 'alert' }, [`這張新聞卡載入失敗（${why}），收起再點開可重試。`]), acts(null));
        state = 'idle';
      }
    }
    // toggle 不冒泡：掛在每個 details 上；頁面重畫時設 open 也會觸發（卡檔已在快取）
    det.addEventListener('toggle', () => { if (det.open && state === 'idle') fill(); });
    return outer(c, o, all, 'rw', [det]);
  }

  // 不在頁內展開的一列（暫時頁，樣式摘要第 10 節）：上方小字、標題（連到新聞卡頁）、更新句、一句話（不截斷）。
  // o 同 row() 的 meta、page、time、series、extra、tag、id；觸控時整列都可點（rows.css 撐開連結）
  function link(c, o = {}) {
    if (!c || typeof c !== 'object' || !cardPath(c.id) || !str(c.title)) return null;
    const page = new Set([].concat(o.page || []));
    const all = seriesIds(c);
    const top = topLine(c, o, all.filter((s) => !page.has(s)), 'div');
    return outer(c, o, all, 'rw is-link', [
      top.firstChild ? top : null, // 沒有系列也沒有時間（暫時頁的「時間不明」）就不留空行
      h('a', { class: 'rw-title rw-go', href: `card.html#${c.id}` }, [c.title, h('span', { class: 'rw-go-ar', 'aria-hidden': 'true' }, [' →'])]),
      updLine(c),
      str(c.line) ? h('p', { class: 'rw-line' }, [c.line]) : null,
    ]);
  }

  // rich(tag, attrs, html)、prose(cls, html)、dive(html)：*_html 淨化後成元素（新聞卡頁共用；card.js 缺這幾個時退回純文字）。
  // eventAt、dayOf、today、shiftDay、dayLabel、level、byImportance：列表頁的分天與排序（系列頁 series.js、暫時頁 adhoc.js 同一套）
  A.rows = { row, link, time, hm, mdw, cardPath, rich, prose, dive, eventAt, dayOf, today, shiftDay, dayLabel, level, byImportance };
})();
