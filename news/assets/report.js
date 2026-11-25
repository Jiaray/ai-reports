/* news/?t=<系列> 的分派：讀 index.json，t 是其中的系列 → 系列頁 series.js（A.series.render）；不認得的 t（含已刪的舊代號，
   不轉址）→「找不到這個系列」＋回本日焦點。series.js 沒載到（部署空窗）時顯示「施工中」。不帶 t 由 front.js 負責。
   這裡建工具列（本日焦點｜系列 ▾｜議題｜版面）與「版面」下拉，系列頁、找不到、施工中共用。
   依賴 A.bar（bar.js）；A.look（look-standard.js）、A.series（series.js）選用，載入失敗就少「一般」外觀、系列頁退回施工中。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const B = A.bar;
  const app = document.getElementById('app');
  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const t = query.get('t') || '';
  if (!t) return; // 本日焦點由 front.js 負責
  let vwBox = null; // 版面按鈕＋面板：建一次，重畫工具列時放回最右邊
  let srBox = null; // 「系列」下拉：index 到了建一次（舊版 bar.js 沒有 seriesMenu 就不放）

  // ── 外觀：第一個為預設；沒有 A.look（look-standard.js 載入失敗）→ 不列「一般」，記住的 standard 退回藍圖。
  // 系列頁只用標題列：data-read 固定 scan（列表列借標題讀法的 .peek、.row-title 樣式），不存 ──
  const LOOKS = [['blueprint', '藍圖'], ['atlas', '地圖'], ...(A.look ? [['standard', '一般']] : [])];
  const KEY_LOOK = 'air-news-look';
  function storedLook() {
    let v = null;
    try { v = localStorage.getItem(KEY_LOOK); } catch (e) { /* 無痕或停用儲存：用預設 */ }
    return LOOKS.some((x) => x[0] === v) ? v : LOOKS[0][0];
  }
  let look = storedLook();
  root.setAttribute('data-read', 'scan');
  root.setAttribute('data-look', look);

  // 工具列（bar.js；樣式摘要 5.1）：本日焦點　右邊一組：系列 ▾｜議題｜版面。舊版 bar.js 沒有 storyLink 就不放議題
  const editions = () => B.toolbar([
    B.navLink('本日焦點', 'front', './', null),
    srBox,
    B.storyLink ? B.storyLink(null) : null,
    vwBox,
  ]);

  // 「版面」下拉：外觀＋配色。換外觀只換 <html data-look>（樣式全在 CSS），view transition 淡入淡出（不支援就直接換；減少動態由 report.css 取消）
  function layoutPanel() {
    const setLook = (v) => {
      look = v;
      try { localStorage.setItem(KEY_LOOK, v); } catch (e) { /* 無法儲存就只套用本頁 */ }
      const swap = () => root.setAttribute('data-look', v);
      if (!document.startViewTransition) return swap();
      document.startViewTransition(swap).ready.catch(() => {}); // 快速連切被跳過時不報錯
      return null;
    };
    const groups = [
      ['外觀', LOOKS, () => look, setLook],
      // 鈕字用 site.js themeLabel（「自動」註明目前深淺）
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
    // site.js 發 air-theme 時重新同步
    document.addEventListener('air-theme', sync);
    sync();
    // pick：打開時焦點移到目前選中的外觀
    vwBox = B.dropdown({
      cls: 'vw', id: 'vw-panel', title: '版面設定', closeLabel: '關閉版面設定',
      toggleKids: [h('span', { class: 'dd-ico', html: B.ICON.sliders }), h('span', null, ['版面'])],
      body: groups.map((g) => g.el),
      pick: (panel) => panel.querySelector('[aria-pressed=true]'),
    });
  }

  // 報頭＋說明（找不到、施工中共用 .wip-* 樣式）：小字「系列」、大標題、（標籤）一段話、回本日焦點
  function notice(title, text, tag) {
    app.replaceChildren(
      editions(),
      h('header', { class: 'masthead wip-head' }, [h('p', { class: 'wip-kicker' }, ['系列']), h('h1', { class: 'mast-title' }, [title])]),
      h('main', { id: 'main', class: 'wip' }, [
        tag ? h('p', { class: 'wip-tag' }, [tag]) : null,
        h('p', { class: 'wip-text' }, [text]),
        h('p', { class: 'wip-back' }, [h('a', { href: './' }, ['回本日焦點'])]),
      ]),
    );
    document.title = `${title}｜AI Reports`;
  }

  // 不認得的代號（設計 §6.2：不做舊代號的轉址）；代號從網址來，一律當純文字、只取前 40 字
  const notFound = () => notice('找不到這個系列', `網址裡的系列代號「${t.slice(0, 40)}」不在系列清單上，可能已改名或刪除；其他系列在工具列的「系列」裡。`);

  // 系列頁的退路：series.js 沒載到（部署空窗、舊 HTML）時放「施工中」與回本日焦點
  const building = (info) => notice(info.title || t, '系列頁正在改版，之後會在這裡列出這個系列的新聞卡。', '施工中');

  async function main() {
    let index;
    try {
      index = await A.getJSON('index.json');
    } catch (err) {
      app.replaceChildren(editions(), h('main', { id: 'main' }, [
        h('p', { class: 'load-error', role: 'alert' }, [`新聞清單載入失敗（${err.message}），重新整理再試一次。`]),
      ]));
      return;
    }
    // 系列代號直接取 index.json（不靠 bar.js：部署空窗配到舊 bar.js 也認得）
    const series = (index && Array.isArray(index.series) ? index.series : []).filter((s) => s && typeof s.id === 'string');
    const info = series.find((s) => s.id === t);
    srBox = B.seriesMenu ? B.seriesMenu(index, info ? t : null) : null;
    if (!info) notFound();
    else if (A.series) A.series.render({ app, index, t, d: query.get('d') || '', toolbar: editions });
    else building(info);
  }

  layoutPanel();
  main().catch((err) => { // 出錯也不能停在「載入中…」
    console.error('系列頁載入失敗', err);
    app.replaceChildren(h('p', { class: 'load-error', role: 'alert' }, ['這一頁顯示失敗，重新整理再試一次。']));
  });
})();
