/* 外觀「一般」的瀏覽器頂列顏色 theme-color（樣式在 look-standard.css），掛 window.AIR.look（各頁用 A.look 在不在判斷要不要列「一般」）。
   themeColor()：頂列色＝Header 底色（--surface）。 */
(() => {
  'use strict';
  const A = window.AIR;
  if (!A) return;
  const root = document.documentElement;

  // ── 瀏覽器頂列顏色 ──
  function themeColor() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (root.getAttribute('data-look') !== 'standard') {
      if (meta) meta.remove();
      return;
    }
    if (!meta) {
      meta = A.h('meta', { name: 'theme-color' });
      document.head.append(meta);
    }
    meta.content = getComputedStyle(root).getPropertyValue('--surface').trim() || '#FFFFFF';
  }
  new MutationObserver(themeColor).observe(root, { attributes: true, attributeFilter: ['data-look', 'data-theme'] });
  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (dark && dark.addEventListener) dark.addEventListener('change', themeColor);
  themeColor();

  A.look = { themeColor };
})();
