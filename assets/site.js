/* AI Reports 共用：配色切換、期別格式、JSON 讀取、建立元素。
   在 <head> 同步載入，讓記住的配色在第一次繪製前就套好。 */
(function () {
  'use strict';
  var KEY = 'air-theme';
  var root = document.documentElement;

  function readTheme() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }
  function applyTheme(t) {
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
  }
  applyTheme(readTheme());

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
  // 三鈕配色切換（自動／淺色／深色），點哪個套哪個，記在 localStorage；無痕模式只在本頁生效
  function themeSwitch() {
    var modes = [['auto', '自動'], ['light', '淺色'], ['dark', '深色']];
    var cur = readTheme();
    var g = h('div', { class: 'theme-switch', role: 'group', 'aria-label': '配色' });
    var btns = modes.map(function (m) {
      var b = h('button', { type: 'button', 'aria-pressed': String(m[0] === cur) }, [m[1]]);
      b.addEventListener('click', function () {
        cur = m[0];
        applyTheme(cur);
        try { localStorage.setItem(KEY, cur); } catch (e) { /* 無法儲存就只套用本頁 */ }
        btns.forEach(function (x, i) { x.setAttribute('aria-pressed', String(modes[i][0] === cur)); });
      });
      g.appendChild(b);
      return b;
    });
    return g;
  }

  window.AIR = { h: h, getJSON: getJSON, fmtShort: fmtShort, themeSwitch: themeSwitch };
})();
