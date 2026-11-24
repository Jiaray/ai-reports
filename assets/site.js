/* 全站共用（window.AIR）：配色、期別短寫、getJSON、h()、首頁配色三鈕；回到頂端自動裝上。 */
(function () {
  'use strict';
  var KEY = 'air-theme';
  var THEMES = [['auto', '自動'], ['light', '淺色'], ['dark', '深色']];
  var root = document.documentElement;

  function readTheme() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }
  // <meta color-scheme> 跟 data-theme 一起改：樣式載入前底色才對
  function applyTheme(t) {
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = t === 'auto' ? 'light dark' : t;
  }
  // air-theme：themeSwitch 與 report.js／front.js 的版面面板據此更新
  function changed() {
    document.dispatchEvent(new CustomEvent('air-theme'));
  }
  function setTheme(t) {
    applyTheme(t);
    try {
      if (t === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch (e) { /* 無法儲存就只套用本頁 */ }
    changed();
  }
  applyTheme(readTheme());
  // 「自動（深色）」的標示隨系統深淺更新
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themeLabel(t) {
    if (t === 'light') return '淺色';
    if (t === 'dark') return '深色';
    return '自動（' + (systemDark && systemDark.matches ? '深色' : '淺色') + '）';
  }
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', changed);
  // 別分頁改配色 → 跟著換（e.key 為 null＝儲存區被清空）
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) {
      applyTheme(readTheme());
      changed();
    }
  });

  // 期別短寫：11/18、第 47 週、11 月
  function fmtShort(period, cadence) {
    var m;
    if (cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(period))) return '第 ' + (+m[2]) + ' 週';
    if (cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(period))) return (+m[2]) + ' 月';
    m = /^\d{4}-(\d{2})-(\d{2})$/.exec(period || '');
    return m ? (+m[1]) + '/' + (+m[2]) : String(period || '');
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  // h(tag, {class, html, 其他屬性}, [子節點或字串])：html 只收淨化過的 *_html 片段，其他資料放 kids 當純文字
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  // 首頁報頭的配色三鈕（新聞頁的配色在「版面」面板）
  function themeSwitch() {
    var g = h('div', { class: 'theme-switch', role: 'group', 'aria-label': '配色' });
    var btns = THEMES.map(function (m) {
      var b = h('button', { type: 'button' }, [m[1]]);
      b.addEventListener('click', function () { setTheme(m[0]); });
      g.appendChild(b);
      return b;
    });
    function sync() {
      var cur = readTheme();
      btns.forEach(function (x, i) {
        x.setAttribute('aria-pressed', String(THEMES[i][0] === cur));
        x.textContent = themeLabel(THEMES[i][0]);
      });
    }
    document.addEventListener('air-theme', sync);
    sync();
    return g;
  }

  // 回到頂端：頁首一屏高的隱形哨兵捲出畫面才顯示（.is-on）。
  // 不用 CSS scroll-state 容器查詢：Safari 不支援（iPhone 是主要讀者）
  var UP_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M3 2.5h12M9 15.5V6M4.5 10.5 9 6l4.5 4.5"/></svg>';
  function backToTop() {
    if (!('IntersectionObserver' in window) || !document.body) return;
    var sentinel = h('div', { class: 'to-top-sentinel', 'aria-hidden': 'true' });
    var btn = h('button', { type: 'button', class: 'to-top', 'aria-label': '回到頂端', title: '回到頂端', html: UP_ICON });
    document.body.prepend(sentinel);
    document.body.appendChild(btn);
    new IntersectionObserver(function (entries) {
      btn.classList.toggle('is-on', !entries[entries.length - 1].isIntersecting);
    }).observe(sentinel);
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // 鍵盤：按鈕隨即隱藏，焦點交給頁首第一個可操作元素（略過連結），不掉回 <body>
    function focusStart() {
      var first = document.querySelector('.skip-link, a[href], button:not(.to-top)');
      if (first) first.focus({ preventScroll: true });
    }
    // 只限鍵盤：Chrome 滑鼠點擊也給按鈕焦點，此時移交會讓略過連結跳出來
    var viaKeyboard = false;
    btn.addEventListener('focus', function () {
      try { viaKeyboard = btn.matches(':focus-visible'); } catch (e) { viaKeyboard = false; }
    });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce && reduce.matches ? 'auto' : 'smooth' });
      if (viaKeyboard) focusStart();
    });
    // 焦點在按鈕上改按 Home／Page Up：按鈕隱藏、焦點被拿走 → 同樣交到頁首
    btn.addEventListener('focusout', function (e) {
      if (viaKeyboard && !e.relatedTarget && !btn.classList.contains('is-on')) focusStart();
      viaKeyboard = false;
    });
  }
  backToTop();

  window.AIR = {
    h: h, getJSON: getJSON, fmtShort: fmtShort, themeSwitch: themeSwitch,
    THEMES: THEMES, getTheme: readTheme, setTheme: setTheme, themeLabel: themeLabel,
  };
})();
