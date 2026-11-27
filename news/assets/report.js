/* news/?t=<系列> 的分派：讀 index.json，t 是其中的系列 → 系列頁 series.js（A.series.render）；不認得的 t（含已刪的舊代號，
   不轉址）→「找不到這個系列」＋回本日焦點。不帶 t 由 front.js 負責。
   這裡建工具列（新聞首頁｜系列｜議題｜版面）與「版面」下拉，系列頁、找不到共用。
   依賴 A.bar（bar.js）、A.series（series.js）；A.look（look-standard.js）選用，載入失敗就少「一般」外觀。 */
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
  let srBox = null; // 「系列」下拉：index 到了建一次

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

  // 工具列（bar.js；樣式摘要 5.1）：新聞首頁（連本日焦點）　右邊一組：系列｜議題｜版面
  const editions = () => B.toolbar([
    B.navLink('新聞首頁', 'front', './', null),
    srBox,
    B.storyLink(null),
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

  // 不認得的代號（設計 §6.2：不做舊代號的轉址）：小字「系列」、大標題、一段話、回本日焦點（.wip-* 樣式）；
  // 代號從網址來，一律當純文字、只取前 40 字
  function notFound() {
    const title = '找不到這個系列';
    app.replaceChildren(
      editions(),
      h('header', { class: 'masthead wip-head' }, [h('p', { class: 'wip-kicker' }, ['系列']), h('h1', { class: 'mast-title' }, [title])]),
      h('main', { id: 'main', class: 'wip' }, [
        h('p', { class: 'wip-text' }, [`網址裡的系列代號「${t.slice(0, 40)}」不在系列清單上，可能已改名或刪除；其他系列在工具列的「系列」裡。`]),
        h('p', { class: 'wip-back' }, [h('a', { href: './' }, ['回本日焦點'])]),
      ]),
    );
    document.title = `${title}｜AI Reports`;
  }

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
    const known = B.cardSeries(index).some((s) => s.id === t);
    srBox = B.seriesMenu(index, known ? t : null);
    if (known) A.series.render({ app, index, t, toolbar: editions });
    else notFound();
  }

  layoutPanel();
  main().catch((err) => { // 出錯也不能停在「載入中…」
    console.error('系列頁載入失敗', err);
    app.replaceChildren(h('p', { class: 'load-error', role: 'alert' }, ['這一頁顯示失敗，重新整理再試一次。']));
  });
})();
