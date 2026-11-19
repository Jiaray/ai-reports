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

  window.AIR = {
    h: h, getJSON: getJSON, fmtShort: fmtShort, themeSwitch: themeSwitch,
    THEMES: THEMES, getTheme: readTheme, setTheme: setTheme, themeLabel: themeLabel,
  };
})();
