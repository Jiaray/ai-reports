/* 首頁：讀 catalog.json 列出各類別，再讀各類別的 index.json 帶出最近 5 份。 */
(function () {
  'use strict';
  var A = window.AIR;
  var h = A.h;
  var box = document.getElementById('cats');
  document.getElementById('foot').appendChild(A.themeSwitch());

  A.getJSON('catalog.json').then(function (cat) {
    return Promise.all((cat.categories || []).map(function (c) {
      return A.getJSON(c.index).then(
        function (idx) { return [c, idx.items || []]; },
        function () { return [c, []]; }
      );
    }));
  }).then(function (rows) {
    box.textContent = '';
    rows.forEach(function (row) {
      var c = row[0];
      var latest = row[1].slice(0, 5);
      box.appendChild(h('section', { class: 'cat' }, [
        h('h2', { class: 'cat-h' }, [h('a', { href: c.path }, [c.title])]),
        h('p', { class: 'cat-desc' }, [c.description || '']),
        latest.length
          ? h('ul', { class: 'entries' }, latest.map(function (e) { return h('li', null, [A.entry(c.path, e, true)]); }))
          : h('p', { class: 'muted' }, ['還沒有內容。'])
      ]));
    });
  }).catch(function (err) {
    box.textContent = '';
    box.appendChild(h('p', { class: 'load-error', role: 'alert' }, ['目錄載入失敗（' + err.message + '），重新整理再試一次。']));
  });
})();
