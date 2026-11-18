/* AI Reports 共用：配色切換、日期格式、JSON 讀取、建立元素、報告清單列。
   在 <head> 同步載入：配色在第一次繪製前套好，並標上 .js 讓頁面殼藏起免 JS 精簡版。 */
(function () {
  'use strict';
  var KEY = 'air-theme';
  var root = document.documentElement;
  root.classList.add('js');

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

  var WEEK = '日一二三四五六';
  function isoDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // 2026-11-18 → 11月18日 週三
  function fmtDay(s) {
    var d = isoDate(s);
    return d ? (d.getMonth() + 1) + '月' + d.getDate() + '日 週' + WEEK.charAt(d.getDay()) : String(s || '');
  }
  // 期別的完整寫法：日報 11月18日 週三、週報 2026 年第 47 週、月報 2026 年 11 月
  function fmtPeriod(period, cadence) {
    var m;
    if (cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(period))) return m[1] + ' 年第 ' + (+m[2]) + ' 週';
    if (cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(period))) return m[1] + ' 年 ' + (+m[2]) + ' 月';
    return fmtDay(period);
  }
  // 期別的短寫：11/18、第 47 週、11 月
  function fmtShort(period, cadence) {
    var m;
    if (cadence === 'weekly' && (m = /^(\d{4})-W(\d{2})$/.exec(period))) return '第 ' + (+m[2]) + ' 週';
    if (cadence === 'monthly' && (m = /^(\d{4})-(\d{2})$/.exec(period))) return (+m[2]) + ' 月';
    var d = isoDate(period);
    return d ? (d.getMonth() + 1) + '/' + d.getDate() : String(period || '');
  }
  // ISO 時間 → 台北時間 11/18 15:20
  function fmtStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var t = new Date(d.getTime() + 8 * 3600000);
    var mm = t.getUTCMinutes();
    return (t.getUTCMonth() + 1) + '/' + t.getUTCDate() + ' ' + t.getUTCHours() + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  // h('a', {href, class, text, html, onclick}, [子節點或字串])。
  // html 只給 publish.py 淨化過的片段（*_html 欄位）；其他資料一律走子節點字串或 text，當純文字放入。
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  // 配色切換：點哪個套哪個，記在 localStorage；無痕模式只在本頁生效
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
  // 報告清單的一列：base 是清單 JSON 所在目錄到網站相對路徑的前綴
  function entry(base, e, showWhen) {
    return h('a', { class: showWhen ? 'entry' : 'entry no-when', href: base + e.path }, [
      showWhen ? h('span', { class: 'e-when' }, [fmtShort(e.period, e.cadence)]) : null,
      h('span', { class: 'e-title' }, [e.series_title || e.title]),
      h('span', { class: 'e-count' }, [e.count + ' 則']),
      e.lede ? h('span', { class: 'e-lede' }, [e.lede]) : null
    ]);
  }

  window.AIR = {
    h: h, getJSON: getJSON, fmtDay: fmtDay, fmtPeriod: fmtPeriod, fmtShort: fmtShort,
    fmtStamp: fmtStamp, themeSwitch: themeSwitch, entry: entry
  };
})();
