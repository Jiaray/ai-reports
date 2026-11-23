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
  function applyTheme(t) {
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = t === 'auto' ? 'light dark' : t;
  }
  function changed() {
    document.dispatchEvent(new CustomEvent('air-theme'));
  }
  function setTheme(t) {
    applyTheme(t);
    try {
      if (t === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch (e) { }
    changed();
  }
  applyTheme(readTheme());
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themeLabel(t) {
    if (t === 'light') return '淺色';
    if (t === 'dark') return '深色';
    return '自動（' + (systemDark && systemDark.matches ? '深色' : '淺色') + '）';
  }
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', changed);
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) {
      applyTheme(readTheme());
      changed();
    }
  });

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
    function focusStart() {
      var first = document.querySelector('.skip-link, a[href], button:not(.to-top)');
      if (first) first.focus({ preventScroll: true });
    }
    var viaKeyboard = false;
    btn.addEventListener('focus', function () {
      try { viaKeyboard = btn.matches(':focus-visible'); } catch (e) { viaKeyboard = false; }
    });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce && reduce.matches ? 'auto' : 'smooth' });
      if (viaKeyboard) focusStart();
    });
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
