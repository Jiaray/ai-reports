/* AI Reports 共用：配色切換、期別格式、JSON 讀取、建立元素。
   記住的配色由各頁 <head> 裡的一小段 inline 腳本在第一次繪製前先套好（防閃），本檔用 defer 載入、不擋畫面；
   頁面腳本（home.js、report.js）也是 defer、排在本檔後面，執行時 window.AIR 已經在了。 */
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
  // data-theme 給 CSS 的色票用；<meta name="color-scheme"> 讓瀏覽器在樣式載入前就用對的底色（指南的做法），兩者一起改
  function applyTheme(t) {
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = t === 'auto' ? 'light dark' : t;
  }
  // 配色變了（本頁切換、別的分頁改了、系統深淺變了）：通知頁面上的切換鈕更新選中狀態與「自動」的說明
  function changed() {
    document.dispatchEvent(new CustomEvent('air-theme'));
  }
  // 套用並記在 localStorage；回到「自動」時刪掉儲存值（跟著系統），無痕模式只在本頁生效
  function setTheme(t) {
    applyTheme(t);
    try {
      if (t === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch (e) { /* 無法儲存就只套用本頁 */ }
    changed();
  }
  applyTheme(readTheme());
  // 「自動」註明目前實際生效的深淺（指南：System (Currently light)），系統深淺改變時跟著更新
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themeLabel(t) {
    if (t === 'light') return '淺色';
    if (t === 'dark') return '深色';
    return '自動（' + (systemDark && systemDark.matches ? '深色' : '淺色') + '）';
  }
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', changed);
  // 別的分頁改了配色：這一頁跟著換（e.key 為 null 表示整個儲存區被清掉）
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
  // h('a', {href, class, html, ...}, [子節點或字串])。html 只給 publish.py 淨化過的片段（*_html 欄位），
  // 其他資料一律以子節點字串放入，當純文字處理。
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
  // 三鈕配色切換（自動／淺色／深色），點哪個套哪個（首頁報頭用；新聞頁的配色在右下角「版面」面板）
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

  // 回到頂端（每一頁右下角）：頁首放一個一個畫面高的隱形哨兵，被捲出畫面（捲過約一屏）才顯示按鈕。
  // CSS 的 scroll-state 容器查詢 Safari 還不支援，iPhone 是主要讀者，所以一律用 IntersectionObserver（指南的備援做法）
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
    // 鍵盤操作時按鈕一回到頂端就隱藏，焦點移到頁首第一個可操作元素（略過連結），不要掉回 <body>
    function focusStart() {
      var first = document.querySelector('.skip-link, a[href], button:not(.to-top)');
      if (first) first.focus({ preventScroll: true });
    }
    // 只處理鍵盤焦點：滑鼠點擊在 Chrome 也會讓按鈕取得焦點，那時移交焦點會讓略過連結跳出來
    var viaKeyboard = false;
    btn.addEventListener('focus', function () {
      try { viaKeyboard = btn.matches(':focus-visible'); } catch (e) { viaKeyboard = false; }
    });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce && reduce.matches ? 'auto' : 'smooth' });
      if (viaKeyboard) focusStart();
    });
    // 焦點停在按鈕上時改用 Home／Page Up 捲回頂端：按鈕隱藏、焦點被拿走，同樣接到頁首（指南：focusout 時移交焦點）
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
