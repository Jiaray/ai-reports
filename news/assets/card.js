/* 新聞卡頁（news/card.html#<編號>）：讀 cards/<Y>/W<ww>/<NNNN>.json 畫一張新聞卡；hashchange 換卡重畫。
   由上而下（樣式摘要第 6 節）：特殊狀態 → 系列・事件時間 → 標題 → 跳轉標籤 → 摘要 → 補充 → AI 解讀 → 領域欄位 → 議題區塊 → 來源 → 分類 → 編號。
   系列與事件時間取那張卡的輕量條目（週索引，沒有再找 recent.json；契約 §9）；議題區塊讀 cards/story-index.json，
   同議題其他卡的標題與時間依編號讀週索引（每份只讀一次）。
   依賴 A.bar；A.rows（*_html 淨化與分段，全站一份）、A.facets、A.look 選用：缺 rows.js（部署空窗）時內文退回純文字。
   跳轉標籤用按鈕捲動、不用 #錨點（網址的 # 是編號，改了會觸發換卡）。樣式在 card.css（.cd-*）；內文沿用 .row-sum、.row-dive、.dive-label。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const WEEK = '日一二三四五六';
  const TAIPEI_MS = 8 * 3600 * 1000;
  const DAY_MS = 86400000;
  const LIFE_DAYS = 7; // 契約 CARD_LIFE_DAYS：新增滿 7 天封存
  const SRC_FIRST = 5; // 來源先列幾家，其餘收合
  const TL_SIDE = 2; // 議題區塊只列這張前後各幾張
  const ID_RE = /^(\d{4})-W(\d{2})-(\d{4})$/;
  // 資料裡的值拿來查表一律用 Map（物件查 toString、constructor 會撞到原型）。媒體類不標
  const KIND = new Map([['official', '官方'], ['community', '社群'], ['aggregator', '彙整']]);
  const str = (v) => (typeof v === 'string' ? v : '');
  const list = (v) => (Array.isArray(v) ? v : []);

  // ── 外觀：新聞各頁共用（air-news-look）；沒有 A.look 就不列「一般」 ──
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  let look = LOOKS[0][0];
  try {
    const v = localStorage.getItem(KEY_LOOK);
    if (LOOKS.some((x) => x[0] === v)) look = v;
  } catch (e) { /* 讀不到：用預設 */ }
  root.setAttribute('data-look', look);

  // ── 編號（同 rows.js 的 cardPath；這裡缺 rows.js 也要能用）──
  // ISO 年的週數：12/28 一定在該年最後一週
  function weeksIn(y) {
    const t = new Date(Date.UTC(y, 11, 28));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  }
  // 「2026-W48-0002」→ 相對路徑；格式不對、週不存在、流水號 0000 → null
  function cardPath(id) {
    const m = ID_RE.exec(str(id));
    if (!m || +m[2] < 1 || +m[2] > weeksIn(+m[1]) || +m[3] < 1) return null;
    return `cards/${m[1]}/W${m[2]}/${m[3]}.json`;
  }
  // 那張卡所在的週索引（編號含週）
  const weekPath = (id) => (cardPath(id) ? cardPath(id).replace(/\d{4}\.json$/, 'index.json') : null);
  function hashId() {
    try { return decodeURIComponent(location.hash.slice(1)).trim(); } catch (e) { return ''; }
  }

  // ── 時間（台北；樣式摘要 5.6：新聞卡頁寫 M/D（週）HH:MM，不寫多久前）──
  const pad = (n) => String(n).padStart(2, '0');
  const taipei = (iso) => {
    const ms = typeof iso === 'string' ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? null : new Date(ms + TAIPEI_MS);
  };
  const thisYear = () => new Date(Date.now() + TAIPEI_MS).getUTCFullYear();
  const md = (t) => `${t.getUTCFullYear() === thisYear() ? '' : `${t.getUTCFullYear()}/`}${t.getUTCMonth() + 1}/${t.getUTCDate()}`;
  const hm = (t) => `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  const mdw = (t) => `${md(t)}（${WEEK[t.getUTCDay()]}）${hm(t)}`;
  const mdhm = (t) => `${md(t)} ${hm(t)}`;
  const dayOf = (t) => (t ? t.toISOString().slice(0, 10) : '');
  // <time>：fmt 是寫法（預設 M/D（週）HH:MM；其他寫法滑過看完整時間）；解析不出來 → null
  function stamp(iso, fmt = mdw, cls = null) {
    const t = taipei(iso);
    return t ? h('time', { class: cls, datetime: iso, title: fmt === mdw ? null : mdw(t) }, [fmt(t)]) : null;
  }

  // ── *_html：用 rows.js 的淨化與分段（全站一份）。缺 rows.js 或舊版沒有這幾個函式時退回純文字：
  //    在惰性的 <template> 裡解析（不執行、不載入）、丟掉不是內文的元素、只取 textContent，依 <br> 分段 ──
  const R = A.rows && ['rich', 'prose', 'dive'].every((k) => typeof A.rows[k] === 'function') ? A.rows : null;
  function plainText(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    tpl.content.querySelectorAll('script,style,template,iframe,object,embed,svg,math,noscript').forEach((n) => n.remove());
    return tpl.content.textContent;
  }
  const rich = (tag, attrs, html) => (R ? R.rich(tag, attrs, html) : h(tag, attrs, [plainText(html)]));
  function prose(cls, html) {
    if (R) return R.prose(cls, html);
    const ps = String(html || '').split(/<br\s*\/?>/i).map((x) => plainText(x).trim()).filter(Boolean).map((x) => h('p', null, [x]));
    return ps.length ? h('div', { class: cls }, ps) : null;
  }
  // AI 解讀＝dive_html：標籤一律「AI 解讀」
  function dive(html) {
    if (R) return R.dive(html);
    const box = prose('row-dive', html);
    if (box) box.firstChild.prepend(h('span', { class: 'dive-label' }, ['AI 解讀']));
    return box;
  }
  const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u); // 外部連結只收 http(s)

  // ── 資料：index.json（系列短名、領域）、別名表；索引每份只抓一次（失敗不留，下次換卡重抓）──
  const indexDoc = A.getJSON('index.json').catch(() => null);
  const aliasDoc = A.getJSON('aliases.json').catch(() => null);
  const docs = new Map();
  function once(path) {
    if (!docs.has(path)) {
      docs.set(path, A.getJSON(path).catch(() => {
        docs.delete(path);
        return null;
      }));
    }
    return docs.get(path);
  }
  const findIn = (doc, id) => list(doc && doc.cards).find((e) => e && e.id === id) || null;
  // 那張卡的輕量條目：週索引（收該週全部卡），找不到再看 recent.json
  async function entryOf(id) {
    return findIn(await once(weekPath(id)), id) || findIn(await once('cards/recent.json'), id);
  }
  // 事件時間（樣式摘要 5.2）：輕量條目的 event_at；索引沒有就照契約 §9 自己算（late 用最早報導）
  const eventAt = (card, e) => str(e && e.event_at) || (card.late === true && str(card.first_reported_at)) || str(card.born_at);

  // 機構、人物套別名表（aliases.json；卡檔原文不改，讀不到照原樣）
  function aliased(facets, table) {
    if (!facets || typeof facets !== 'object' || !table) return facets;
    const out = { ...facets };
    ['org', 'person'].forEach((k) => {
      const map = table[k] && typeof table[k] === 'object' ? table[k] : null;
      if (map && Array.isArray(out[k])) out[k] = [...new Set(out[k].map((v) => (typeof map[v] === 'string' ? map[v] : v)))];
    });
    return out;
  }

  // ── 報頭工具列（bar.js；樣式摘要 5.1）：新聞首頁（連本日焦點）　右邊一組：系列｜議題｜版面；新聞卡頁不標 aria-current ──
  let vwBox = null;
  let srBox; // 「系列」下拉：index 到了建一次（undefined＝還沒建；舊版 bar.js 沒有 seriesMenu 就不放）
  const toolbar = () => B.toolbar([
    B.navLink('新聞首頁', 'front', './', null),
    srBox,
    B.storyLink ? B.storyLink(null) : null, // 舊版 bar.js 沒有就不放
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

  // ── 議題 ──
  const storyHref = (name) => `story.html#${encodeURIComponent(name)}`;
  // 套議題對照表後的路徑陣列 [上層…, 子議題]。部署空窗拿到舊 facets.js（沒有 storyPaths）→ 照原名、不套對照表
  function storyPaths(card) {
    const raw = list(card.facets && card.facets.story).filter((v) => typeof v === 'string' && v.trim());
    return A.facets && A.facets.storyPaths ? A.facets.storyPaths(raw) : [...new Set(raw)].map((n) => [n]);
  }
  // 每條路徑選一層放議題區塊（樣式摘要 6-9）：最具體那層；那層除了這張沒有別張就往上，到頂都沒有就不放。
  // 路徑頂端在 story-index 還有 parent 時接著往上（facets.js 缺時路徑只有一段）。同名只放一次。回傳 [{ name, story, path }]
  function storyPicks(card, paths, byName) {
    const out = [];
    paths.forEach((path) => {
      const chain = [...path].reverse();
      for (let i = 0; i < chain.length && i < 6; i++) {
        const s = byName.get(chain[i]);
        const up = s && str(s.parent);
        if (i === chain.length - 1 && up && !chain.includes(up)) chain.push(up);
        if (s && list(s.cards).some((id) => id !== card.id)) {
          if (!out.some((o) => o.name === chain[i])) out.push({ name: chain[i], story: s, path });
          return;
        }
      }
    });
    return out;
  }
  // 同議題的卡依事件時間排、只取這張前後各 TL_SIDE 張。story-index 依新增時間排（事件時間只有 late 卡不同），
  // 只讀這張前後幾張所在的週索引：議題再長也只抓兩三份。讀不到的卡不列
  async function timeline(card, story, ev) {
    const ids = list(story.cards).filter((id) => cardPath(id));
    let at = ids.indexOf(card.id);
    if (at < 0) { // 索引還沒收這張：當它排在最後
      ids.push(card.id);
      at = ids.length - 1;
    }
    const weeks = [...new Set(ids.slice(Math.max(0, at - TL_SIDE), at + TL_SIDE + 1).map(weekPath))];
    const found = new Map();
    (await Promise.all(weeks.map(once))).forEach((doc) => list(doc && doc.cards).forEach((e) => {
      if (e && typeof e.id === 'string') found.set(e.id, e);
    }));
    const items = ids.filter((id) => id !== card.id && found.has(id) && str(found.get(id).title))
      .map((id) => ({ id, title: found.get(id).title, at: str(found.get(id).event_at) || str(found.get(id).born_at) }));
    items.push({ id: card.id, here: true, at: ev });
    const ms = (x) => Date.parse(x.at) || 0;
    items.sort((a, b) => ms(a) - ms(b) || (a.id < b.id ? -1 : 1));
    const p = items.findIndex((x) => x.here);
    return items.slice(Math.max(0, p - TL_SIDE), p + TL_SIDE + 1);
  }
  let uid = 0;
  function storyBox(pick, items) {
    const id = `cd-st-${++uid}`;
    return h('section', { class: 'cd-box cd-story', 'aria-labelledby': id }, [
      h('div', { class: 'cd-box-h' }, [
        h('h2', { class: 'cd-box-t', id }, [`議題　〈${pick.name}〉`]),
        h('a', { class: 'cd-box-a', href: storyHref(pick.name) }, [
          '看整個議題', h('span', { class: 'visually-hidden' }, [`〈${pick.name}〉`]), h('span', { 'aria-hidden': 'true' }, [' →']),
        ]),
      ]),
      h('ol', { class: 'cd-tl', role: 'list' }, items.map((x) => h('li', { class: `cd-tl-it${x.here ? ' is-here' : ''}`, 'aria-current': x.here ? 'page' : null }, [
        stamp(x.at, md, 'cd-tl-d') || h('span', { class: 'cd-tl-d' }),
        x.here ? h('span', { class: 'cd-tl-here' }, ['這張']) : h('a', { class: 'cd-tl-a', href: `card.html#${x.id}` }, [x.title]),
      ]))),
    ]);
  }

  // ── 報頭各列 ──
  // 封存日：新增滿 7 天那天；寫入時就封存的（最早報導已超過 7 天的 late 卡、最新的來源也超過 7 天）用新增那天
  function archivedOn(card) {
    const born = Date.parse(str(card.born_at));
    if (Number.isNaN(born)) return null;
    const life = born + LIFE_DAYS * DAY_MS;
    const times = list(card.sources).map((s) => Date.parse(str(s && s.time))).filter((t) => !Number.isNaN(t));
    const atWrite = life > Date.now() || (times.length > 0 && Math.max(...times) < born - LIFE_DAYS * DAY_MS);
    return atWrite ? born : life;
  }
  // 特殊狀態（標題上方一行框線說明）：已封存、重複、網路討論
  function flags(card, ctx) {
    const out = [];
    const flag = (cls, kids) => out.push(h('p', { class: `cd-flag ${cls}` }, kids));
    if (card.archived === true) {
      const on = archivedOn(card);
      const day = on == null ? null : h('time', { datetime: new Date(on).toISOString() }, [md(new Date(on + TAIPEI_MS))]);
      const names = ctx.archiveStories;
      flag('cd-arch', [
        '已封存', ...(day ? ['（', day, '）'] : []),
        ...(names.length ? ['：之後的發展看議題', ...names.flatMap((n, i) => [i ? '、' : null, h('a', { href: storyHref(n) }, [`〈${n}〉`])])] : []),
      ]);
    }
    if (ctx.dup) flag('cd-dup', ['這件事已併入另一張新聞卡：', h('a', { href: `card.html#${ctx.dup}` }, [`〈${ctx.dupTitle || ctx.dup}〉`])]);
    if (card.online_only === true) flag('cd-online', [h('span', { class: 'cd-flag-ico', html: B.ICON.warn }), '網路討論，未經媒體證實']);
    return out;
  }
  // 記號（rows.js marks，同列表列：緊急／遭利用、重要、熱門、切身）　系列（領域色、連到系列頁）・事件時間。
  // 記號讀輕量條目（有 heat_rank、exploited）；沒有條目用卡檔的 facets 與 heat。部署空窗配到舊 rows.js（沒有 marks）就不放
  function metaLine(series, ev, card, entry) {
    const f = card.facets && typeof card.facets === 'object' ? card.facets : {};
    const mk = R && R.marks ? R.marks({ weight: f.weight, urgency: f.urgency, relevance: f.relevance, heat: card.heat, ...(entry || {}) }) : [];
    const kids = series.flatMap((s, i) => [
      i ? h('span', { class: 'cd-sep' }, ['、']) : null,
      h('a', { class: 'cd-ty', href: `./?t=${encodeURIComponent(s.id)}`, 'data-group': s.group || null }, [s.short]),
    ]).filter(Boolean);
    const t = stamp(ev, mdw, 'cd-tm');
    if (t && kids.length) kids.push(h('span', { class: 'cd-sep', 'aria-hidden': 'true' }, ['・']));
    if (t) kids.push(t);
    if (mk.length) kids.unshift(h('span', { class: 'cd-mks' }, mk));
    return kids.length ? h('p', { class: 'cd-mt' }, kids) : null;
  }
  // 跳轉標籤：按了捲到那一段、焦點移過去（目標有 tabindex=-1）；捲動照 prefers-reduced-motion
  function jumps(targets) {
    const btns = targets.filter((t) => t.el).map((t) => {
      const b = h('button', { type: 'button', class: `cd-jump${t.cls ? ` ${t.cls}` : ''}`, 'aria-label': t.name }, [
        t.label, h('span', { 'aria-hidden': 'true' }, ['↓']),
      ]);
      b.addEventListener('click', () => {
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        t.el.focus({ preventScroll: true });
        t.el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      });
      return b;
    });
    return btns.length ? h('div', { class: 'cd-jumps' }, btns) : null;
  }

  // ── 內文 ──
  // 補充段落（依時間）：左側色線＋「更新 M/D HH:MM」；更正用紅線與「更正 M/D HH:MM」（另有字，不只靠顏色）。
  // 改了標題的那段寫出原標題；原文不改（更正段開頭的「更正：」已由標示說了，顯示時不重寫）。回傳 { el, latest：最新一段補充 }
  function adds(card) {
    let latest = null;
    const items = list(card.log).filter((e) => e && (e.kind === 'supplement' || e.kind === 'correction')).map((e) => {
      const fix = e.kind === 'correction';
      const t = taipei(e.at);
      const mark = h('span', { class: 'cd-add-k' }, [fix ? '更正' : '更新', ...(t ? [' ', h('time', { datetime: e.at, title: mdw(t) }, [mdhm(t)])] : [])]);
      const text = (fix ? (s) => s.replace(/^\s*更正[：:]\s*/, '') : (s) => s)(str(e.html) || str(e.update));
      const body = prose('row-sum cd-add-body', text) || h('div', { class: 'row-sum cd-add-body' }, [h('p')]);
      body.firstChild.prepend(mark);
      const li = h('li', { class: `cd-add${fix ? ' is-fix' : ''}` }, [
        body,
        str(e.old_title) ? h('p', { class: 'cd-old' }, ['原標題：', e.old_title]) : null,
        dive(str(e.dive_html)),
      ]);
      if (!fix) latest = li;
      return li;
    });
    if (latest) {
      latest.id = 'cd-latest';
      latest.tabIndex = -1;
    }
    return { el: items.length ? h('ol', { class: 'cd-adds', role: 'list', 'aria-label': '更新與更正' }, items) : null, latest };
  }

  // 領域欄位（資安的影響範圍與處置、財經的關鍵數據…）
  function fields(card) {
    const rows = list(card.fields).filter((f) => f && str(f.name) && str(f.html));
    if (!rows.length) return null;
    return h('dl', { class: 'cd-fields' }, rows.map((f) => h('div', { class: 'cd-field' }, [h('dt', null, [f.name]), rich('dd', null, f.html)])));
  }

  // 來源：依報導時間；先列 SRC_FIRST 家（媒體名、類型、地區、時刻、↗），其餘收進 <details>（頁內尋找照樣找得到）。
  // 媒體名用 family（同一家出現多次改用 name，再撞名加篇次）；時刻跟事件時間不同天時加日期
  function sourcesBox(card, ev) {
    const srcs = list(card.sources).filter((s) => s && typeof s === 'object')
      .map((s, i) => ({ s, i, t: Date.parse(str(s.time)) }))
      .sort((a, b) => (Number.isNaN(a.t) ? 1 : 0) - (Number.isNaN(b.t) ? 1 : 0) || a.t - b.t || a.i - b.i)
      .map((x) => x.s);
    if (!srcs.length) return null;
    const fam = (s) => str(s.family) || str(s.name) || '來源';
    const famCount = new Map();
    srcs.forEach((s) => famCount.set(fam(s), (famCount.get(fam(s)) || 0) + 1));
    const used = new Map();
    const named = srcs.map((s) => {
      const base = famCount.get(fam(s)) > 1 ? (str(s.name) || fam(s)) : fam(s);
      const n = (used.get(base) || 0) + 1;
      used.set(base, n);
      return { s, name: n > 1 ? `${base}（第 ${n} 篇）` : base };
    });
    const evDay = dayOf(taipei(ev));
    const item = ({ s, name }) => {
      const t = taipei(s.time);
      const kids = [
        h('span', { class: 'cd-src-nm' }, [name]),
        KIND.has(s.kind) ? h('span', { class: 'cd-src-k' }, [KIND.get(s.kind)]) : null,
        str(s.region) ? h('span', { class: 'cd-src-rg' }, [s.region]) : null,
        t ? h('time', { class: 'cd-src-t', datetime: s.time, title: mdw(t) }, [dayOf(t) === evDay ? hm(t) : mdhm(t)]) : null,
      ];
      return h('li', { class: 'cd-src' }, [
        isWeb(s.url)
          ? h('a', { class: 'cd-src-a', href: s.url, target: '_blank', rel: 'noopener' }, [...kids, h('span', { class: 'cd-src-go', 'aria-hidden': 'true' }, ['↗'])])
          : h('span', { class: 'cd-src-a' }, kids),
        isWeb(s.hn_url) ? h('a', { class: 'cd-src-hn', href: s.hn_url, target: '_blank', rel: 'noopener' }, ['HN 討論', h('span', { 'aria-hidden': 'true' }, [' ↗'])]) : null,
      ]);
    };
    const ul = (xs) => h('ul', { class: 'cd-srcs', role: 'list' }, xs.map(item));
    const rest = named.slice(SRC_FIRST);
    const word = [...famCount.values()].some((n) => n > 1) ? '則' : '家'; // 同一家多篇時「家」數不準
    const regions = new Set(srcs.map((s) => str(s.region)).filter(Boolean));
    return h('section', { class: 'cd-box cd-srcbox', id: 'cd-src', tabindex: '-1', 'aria-labelledby': 'cd-src-t' }, [
      h('div', { class: 'cd-box-h' }, [h('h2', { class: 'cd-box-t', id: 'cd-src-t' }, [regions.size ? `來源　${regions.size} 個地區` : '來源'])]),
      ul(named.slice(0, SRC_FIRST)),
      rest.length ? h('details', { class: 'cd-more' }, [
        h('summary', null, [
          h('span', { class: 'cd-more-c' }, [`顯示其餘 ${rest.length} ${word}`]), h('span', { class: 'cd-more-o' }, [`收起其餘 ${rest.length} ${word}`]),
        ]),
        ul(rest),
      ]) : null,
    ]);
  }

  // ── 一張卡 ──
  // ctx：entry（輕量條目或 null）、meta（index.json）、dup、dupTitle、aliases、paths（議題路徑）、picks＋lines（議題區塊）
  function cardPage(card, ctx) {
    const ev = eventAt(card, ctx.entry);
    const info = new Map(list(ctx.meta && ctx.meta.series).filter((s) => s && typeof s.id === 'string').map((s) => [s.id, s]));
    const series = [...new Set(list(ctx.entry && ctx.entry.series).filter((s) => typeof s === 'string' && s))]
      .map((id) => {
        const s = info.get(id) || {};
        return { id, short: str(s.short) || str(s.title) || id, group: str(s.group) };
      });
    // 封存提示的議題：有區塊用區塊那層，沒有用各路徑最具體那層
    const archiveStories = ctx.picks.length ? ctx.picks.map((p) => p.name) : ctx.paths.map((p) => p[p.length - 1]);
    const log = adds(card);
    const src = sourcesBox(card, ev);
    const outlets = card.heat && Number.isInteger(card.heat.outlets) && card.heat.outlets > 0 ? card.heat.outlets : 0;
    const head = h('header', { class: 'masthead cd-head' }, [
      ...flags(card, { ...ctx, archiveStories }),
      metaLine(series, ev, card, ctx.entry),
      h('h1', { class: 'cd-title', tabindex: '-1' }, [card.title]),
      jumps([
        { label: '更新', name: '更新：跳到最新一段補充', cls: 'is-up', el: log.latest },
        { label: outlets ? `${outlets} 家報導` : '來源', name: outlets ? `${outlets} 家報導：跳到來源` : '跳到來源', el: src },
      ]),
    ]);
    // 分類（facets.js）：系列名、區塊或封存提示已寫的議題、來源媒體 → 不重列（〈不重複〉）
    const facets = aliased(card.facets, ctx.aliases);
    const shown = ctx.picks.length ? ctx.picks.map((p) => p.path) : (card.archived === true ? ctx.paths : []);
    // 分類裡的議題連到議題頁（只有一張卡、沒有議題區塊的議題從這裡點進去）
    const fx = A.facets && facets ? A.facets.parts(facets, {
      title: card.title,
      types: [...series.map((s) => s.short), ...shown.map((p) => p.join(' › '))],
      src: list(card.sources).map((s) => s && (str(s.family) || str(s.name))).join('、'),
      links: true,
    }) : null;
    const main = h('main', { id: 'main', class: 'cd' }, [
      prose('row-sum', str(card.summary_html)),
      log.el,
      dive(str(card.dive_html)),
      fields(card),
      ...ctx.picks.map((p, i) => storyBox(p, ctx.lines[i])),
      src,
      fx ? A.facets.bar(fx.toggle) : null,
      fx ? fx.panel : null,
      // 記號說明：只列五個記號（更新、更正、網路討論在這頁另有寫法）；沒有左緣色線，記號後面接系列與事件時間
      R && R.legend ? R.legend({ cards: false, line: false, after: '系列與事件時間' }) : null,
      h('footer', { class: 'cd-foot' }, ['編號 ', h('span', { class: 'cd-id' }, [card.id])]),
    ].filter(Boolean));
    return [toolbar(), head, main];
  }

  function missing(id) {
    return [
      toolbar(),
      h('header', { class: 'masthead cd-head' }, [h('h1', { class: 'cd-title', tabindex: '-1' }, ['找不到這張新聞卡'])]),
      h('main', { id: 'main', class: 'cd' }, [h('p', { class: 'cd-miss' }, [
        id ? `編號 ${id} 沒有對應的新聞卡。` : '網址裡的新聞卡編號不完整或格式不對。',
        h('a', { class: 'cd-back', href: './' }, ['回本日焦點']),
      ])]),
    ];
  }

  // 抓檔失敗與畫頁出錯共用；h1 讓換卡時焦點有地方落
  function failed(err) {
    const why = err instanceof SyntaxError ? '資料格式不對' : (err && err.message) || String(err);
    return [
      toolbar(),
      h('header', { class: 'masthead cd-head' }, [h('h1', { class: 'cd-title', tabindex: '-1' }, ['新聞卡載入失敗'])]),
      h('main', { id: 'main', class: 'cd' }, [h('p', { class: 'load-error', role: 'alert' }, [
        `原因：${why}。重新整理再試一次。`, h('a', { class: 'cd-back', href: './' }, ['回本日焦點']),
      ])]),
    ];
  }

  // ── 畫頁：換卡時捲回頂端、焦點移到標題（首次開頁不搶焦點）；較晚發出的請求才算數 ──
  let ticket = 0;
  function show(kids, title, moved) {
    const focused = document.activeElement;
    app.replaceChildren(...kids);
    document.title = `${title}｜AI Reports`;
    if (moved) {
      window.scrollTo(0, 0);
      const h1 = app.querySelector('h1');
      if (h1) h1.focus({ preventScroll: true });
    } else if (focused && focused.isConnected && focused !== document.activeElement) {
      focused.focus({ preventScroll: true }); // 版面面板隨工具列重建搬家
    }
  }

  async function load(moved) {
    const my = ++ticket;
    const id = hashId();
    const path = cardPath(id);
    const meta = await indexDoc;
    if (srBox === undefined) srBox = B.seriesMenu ? B.seriesMenu(meta, null) : null;
    if (!path) {
      if (my === ticket) show(missing(''), '找不到這張新聞卡', moved);
      return;
    }
    let card;
    try {
      card = await A.getJSON(path);
    } catch (err) {
      if (my !== ticket) return;
      if (/^HTTP 404$/.test(err.message)) show(missing(id), '找不到這張新聞卡', moved);
      else show(failed(err), '新聞卡載入失敗', moved);
      return;
    }
    // 檔案內容要是這張卡（防手改壞、部署到一半）
    if (!card || typeof card !== 'object' || card.id !== id || !str(card.title)) {
      if (my === ticket) show(missing(id), '找不到這張新聞卡', moved);
      return;
    }
    // 議題對照表、別名表、原卡標題、輕量條目、議題索引並行抓，畫前等它們（讀不到照原樣、少那一塊）。
    // 標了重複的卡不放議題區塊（story-index 不收它；頁面只導向原卡）
    const dup = str(card.dup_of) && str(card.dup_of) !== id && cardPath(card.dup_of) ? card.dup_of : '';
    const [, aliases, dupDoc, entry, storyDoc] = await Promise.all([
      A.facets ? A.facets.load() : null,
      aliasDoc,
      dup ? A.getJSON(cardPath(dup)).catch(() => null) : null,
      entryOf(id),
      str(card.dup_of) ? null : once('cards/story-index.json'),
    ]);
    if (my !== ticket) return;
    const paths = storyPaths(card);
    const byName = new Map(list(storyDoc && storyDoc.stories).filter((s) => s && typeof s.name === 'string').map((s) => [s.name, s]));
    const picks = str(card.dup_of) ? [] : storyPicks(card, paths, byName);
    const lines = await Promise.all(picks.map((p) => timeline(card, p.story, eventAt(card, entry))));
    if (my !== ticket) return;
    const dupTitle = dupDoc && dupDoc.id === dup ? str(dupDoc.title) : '';
    show(cardPage(card, { entry, meta, dup, dupTitle, aliases, paths, picks, lines }), card.title, moved);
  }

  // 畫頁出錯：換成錯誤畫面（不能停在「載入中…」或留著上一張）；已有較晚的請求就不蓋掉它
  function run(moved) {
    const pending = load(moved);
    const my = ticket; // load() 同步就已領號
    pending.catch((err) => {
      console.error('新聞卡顯示失敗', err);
      if (my !== ticket) return;
      try {
        show(failed(err), '新聞卡載入失敗', moved);
      } catch (e) { // 錯誤頁也畫不出來 → 至少換掉畫面
        app.textContent = '新聞卡顯示失敗，重新整理再試一次。';
      }
    });
  }

  layoutPanel();
  window.addEventListener('hashchange', () => run(true));
  run(false);
})();
