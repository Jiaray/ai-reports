/* 舊版施工中頁：新 story.html、adhoc.html 已改載 story.js、adhoc.js，不再載這支；留著只給部署空窗裡快取的舊 HTML（網址還帶舊 ?v=），
   之後清理時刪（.wip-* 樣式 report.js 的新聞卡系列頁退路仍在用，不跟著刪）。
   原說明（news/story.html、news/adhoc.html；設計 §6.8：先放按鈕與「施工中」，樣式另議）。#app 的 data-page 決定是哪一頁：
   - story：#<議題名（encodeURIComponent）> → 議題頁，標題＝議題名（當純文字）；沒有 hash → 議題目錄。
   - adhoc：#<代號> → 暫時頁，標題讀 adhoc/<代號>.json 的 title，讀不到就顯示代號。
   hashchange 重畫。依賴 A.bar（bar.js）；A.look 選用（沒有就不列「一般」外觀）。施工中的樣式在 report.css（.wip-*）。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const page = app.dataset.page === 'adhoc' ? 'adhoc' : 'story';
  const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/; // 同 publish.py 的暫時頁路徑

  // ── 外觀：同報告頁（air-news-look）；沒有 A.look 就不列「一般」 ──
  const KEY_LOOK = 'air-news-look';
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  let look = LOOKS[0][0];
  try {
    const v = localStorage.getItem(KEY_LOOK);
    if (LOOKS.some((x) => x[0] === v)) look = v;
  } catch (e) { /* 讀不到：用預設 */ }
  root.setAttribute('data-look', look);

  // 壞掉的百分比編碼 → 照原樣顯示
  function hashText() {
    const raw = location.hash.slice(1);
    try { return decodeURIComponent(raw).trim(); } catch (e) { return raw.trim(); }
  }

  // ── 報頭工具列（bar.js；樣式摘要 5.1）：系列 ▾｜本日焦點｜本週回顧｜議題｜版面。議題目錄 aria-current=page、議題頁 true（同一邊）；
  // 舊版 bar.js 沒有 storyLink 就不放議題 ──
  const indexDoc = A.getJSON('index.json').catch(() => null);
  let hasWeekly = false;
  let srBox; // undefined＝還沒建
  let vwBox = null;
  const toolbar = (key) => B.toolbar([
    srBox,
    B.navLink('本日焦點', 'front', './', null),
    hasWeekly ? B.navLink('本週回顧', 'weekly', './?w', null) : null,
    B.storyLink ? B.storyLink(page === 'story' ? (key ? 'true' : 'page') : null) : null,
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

  // ── 這一頁要寫什麼：{ kicker, title, text } ──
  async function about(key) {
    if (page === 'story') {
      return key
        ? { kicker: '議題', title: key, text: '議題頁正在改版，之後會在這裡依時間列出這個議題的全部新聞卡。' }
        : { kicker: '', title: '議題目錄', text: '議題目錄正在改版，之後會在這裡依進行中、沉寂、歸檔列出所有議題。' };
    }
    let title = key;
    if (SLUG_RE.test(key)) {
      try {
        const doc = await A.getJSON(`adhoc/${key}.json`);
        if (doc && typeof doc.title === 'string' && doc.title.trim() && (!doc.slug || doc.slug === key)) title = doc.title.trim();
      } catch (e) { /* 讀不到（已刪或還沒建）：顯示代號 */ }
    }
    return { kicker: title ? '暫時頁' : '', title: title || '暫時頁', text:'暫時頁正在改版，之後會在這裡列出這次查詢新增、補充或比對到的新聞卡。' };
  }

  // ── 畫頁：換 hash 時捲回頂端、焦點移到標題（首次開頁不搶焦點）；較晚發出的請求才算數 ──
  let ticket = 0;
  async function load(moved) {
    const my = ++ticket;
    const meta = await indexDoc;
    const series = new Map((meta && Array.isArray(meta.series) ? meta.series : []).map((s) => [s && s.id, s && s.cadence]));
    hasWeekly = (meta && Array.isArray(meta.items) ? meta.items : [])
      .some((e) => e && (e.cadence || series.get(e.series) || 'daily') !== 'daily');
    if (srBox === undefined) srBox = B.seriesMenu ? B.seriesMenu(meta, null) : null;
    const key = hashText();
    const x = await about(key);
    if (my !== ticket) return;
    const focused = document.activeElement;
    app.replaceChildren(
      toolbar(key),
      h('header', { class: 'masthead wip-head' }, [
        x.kicker ? h('p', { class: 'wip-kicker' }, [x.kicker]) : null,
        h('h1', { class: 'mast-title', tabindex: '-1' }, [x.title]),
      ]),
      h('main', { id: 'main', class: 'wip' }, [
        h('p', { class: 'wip-tag' }, ['施工中']),
        h('p', { class: 'wip-text' }, [x.text]),
        h('p', { class: 'wip-back' }, [h('a', { href: './' }, ['回本日焦點'])]),
      ]),
    );
    document.title = `${x.title}｜AI Reports`;
    if (moved) {
      window.scrollTo(0, 0);
      app.querySelector('h1').focus({ preventScroll: true });
    } else if (focused && focused.isConnected && focused !== document.activeElement) {
      focused.focus({ preventScroll: true }); // 版面面板隨工具列重建搬家
    }
  }

  layoutPanel();
  window.addEventListener('hashchange', () => {
    load(true).catch((err) => console.error('頁面顯示失敗', err));
  });
  load(false).catch((err) => { // 出錯也不能停在「載入中…」
    console.error('頁面顯示失敗', err);
    app.textContent = '頁面顯示失敗，重新整理再試一次。';
  });
})();
