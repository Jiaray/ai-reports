/* 本日焦點的今天日期與農民曆，掛 AIR.almanac（front.js 選用；只有 news/index.html 載入，排在 front.js 前）。
   - 國曆日期、星期自己算，一定有；農曆月日、干支生肖年、農曆節日、宜忌、沖煞、節氣由 lunar.js 算。
   - lunar.js＝6tail/lunar-javascript v1.7.8（MIT，原檔未改，授權在檔頭的 npm 套件裡）：約 430KB，報告頁用不到，
     第一次 load() 才另外載入（同 almanac.js 的 ?v=）；載不到只畫國曆日期那一格，下次 load() 再試。
     它是 UMD：沒有模組系統時在 window 掛 Solar、Lunar 等十幾個名稱，只在這支用。
   - lunar.js 只輸出簡體：TW 表逐詞換成台灣農民曆用字（上梁→上樑、启钻→啟攢、龙头节→龍抬頭…），表上沒有的原樣顯示。
   - render(iso)：iso＝台北日期 YYYY-MM-DD → <section class="fp-alm">（樣式在 front.css；data-day 給 front.js 判斷過午夜）。 */
(() => {
  'use strict';
  const A = window.AIR;
  const h = A.h;
  const WEEK = '日一二三四五六';
  const self = document.currentScript;
  const SRC = (() => {
    try {
      const v = self && new URL(self.src).searchParams.get('v');
      return new URL(`lunar.js${v ? `?v=${encodeURIComponent(v)}` : ''}`, self ? self.src : location.href).href;
    } catch (e) {
      return 'assets/lunar.js';
    }
  })();

  const ready = () => Boolean(window.Solar && window.Lunar && typeof window.Solar.fromYmd === 'function');
  let loading = null;
  // → Promise<boolean>：lunar.js 能用了沒；失敗不 reject（農民曆是附加的，不擋頁面）
  function load() {
    if (ready()) return Promise.resolve(true);
    if (!loading) {
      loading = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = SRC;
        s.onload = () => resolve(ready());
        s.onerror = () => {
          loading = null;
          s.remove();
          resolve(false);
        };
        document.head.append(s);
      });
    }
    return loading;
  }

  // ── 台灣用字（簡體 → 台灣農民曆寫法）──
  const TW = {
    // 宜忌
    平治道涂: '平治道塗', 馀事勿取: '餘事勿取', 诸事不宜: '諸事不宜', 斋醮: '齋醮', 塑绘: '塑繪', 订盟: '訂盟', 纳采: '納采',
    动土: '動土', 造桥: '造橋', 安机械: '安機械', 栽种: '栽種', 纳畜: '納畜', 牧养: '牧養', 入殓: '入殮', 开市: '開市',
    坏垣: '壞垣', 开光: '開光', 入学: '入學', 开池: '開池', 安门: '安門', 理发: '理髮', 造庙: '造廟', 开仓: '開倉',
    出货财: '出貨財', 纳财: '納財', 畋猎: '畋獵', 补垣: '補垣', 断蚁: '斷蟻', 行丧: '行喪', 问名: '問名', 会亲友: '會親友',
    进人口: '進人口', 修坟: '修墳', 竖柱: '豎柱', 上梁: '上樑', 作梁: '作樑', 开柱眼: '開柱眼', 架马: '架馬', 谢土: '謝土',
    启钻: '啟攢', 教牛马: '教牛馬', 求医: '求醫', 扫舍: '掃舍', 挂匾: '掛匾', 开生坟: '開生墳', 合寿木: '合壽木', 盖屋: '蓋屋',
    习艺: '習藝', 经络: '經絡', 结网: '結網', 造仓: '造倉', 合帐: '合帳', 无: '無', 修饰垣墙: '修飾垣牆', 纳婿: '納婿',
    造车器: '造車器', 置产: '置產', 取渔: '取漁', 针灸: '針灸', 开渠: '開渠', 词讼: '詞訟', 开厕: '開廁', 筑堤: '築堤',
    归岫: '歸岫', 雇佣: '雇傭', 归宁: '歸寧', 修门: '修門',
    // 農曆節日
    腊八节: '臘八節', 春节: '春節', 元宵节: '元宵節', 龙头节: '龍抬頭', 端午节: '端午節', 七夕节: '七夕', 中秋节: '中秋節', 重阳节: '重陽節',
    // 節氣
    惊蛰: '驚蟄', 谷雨: '穀雨', 小满: '小滿', 芒种: '芒種', 处暑: '處暑',
    // 生肖、方位
    龙: '龍', 马: '馬', 鸡: '雞', 猪: '豬', 东: '東',
  };
  const tw = (s) => TW[s] || s;
  const MONTH = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

  // → { iso, md, wd, lu: null | {...} }；lunar.js 還沒好或算錯 → lu＝null（只畫國曆）
  function day(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const out = { iso, md: `${m} 月 ${d} 日`, wd: `星期${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`, lu: null };
    if (!ready()) return out;
    try {
      const lu = window.Solar.fromYmd(y, m, d).getLunar();
      const mo = lu.getMonth(); // 閏月是負數
      const next = lu.getNextJieQi(true); // true：照日期比，今天是節氣時給下一個
      const ns = next.getSolar();
      out.lu = {
        date: `農曆${mo < 0 ? '閏' : ''}${MONTH[Math.abs(mo) - 1]}月${lu.getDayInChinese()}`,
        year: `${lu.getYearInGanZhi()}${tw(lu.getYearShengXiao())}年`,
        fest: lu.getFestivals().map(tw),
        yi: lu.getDayYi().map(tw),
        ji: lu.getDayJi().map(tw),
        chong: `沖${tw(lu.getDayChongShengXiao())}（${lu.getDayChongGan()}${lu.getDayChong()}）煞${tw(lu.getDaySha())}`,
        jieqi: tw(lu.getJieQi()), // 今天是節氣才有
        next: `${tw(next.getName())} ${ns.getMonth()}/${ns.getDay()}（${WEEK[ns.getWeek()]}）`,
      };
    } catch (e) {
      console.error('農民曆計算失敗', e);
    }
    return out;
  }

  // 宜忌各詞不拆行：一詞一個 span（nowrap），詞間留一般空白讓報讀器分得開
  const words = (list) => (list.length ? list.flatMap((t, i) => [i ? ' ' : null, h('span', null, [t])]) : ['—']);

  function render(iso) {
    const x = day(iso);
    const L = x.lu;
    const kids = [h('div', { class: 'fp-alm-day' }, [
      h('p', { class: 'fp-alm-date' }, [
        h('time', { class: 'fp-alm-md', datetime: x.iso }, [x.md]), h('span', { class: 'fp-alm-wd' }, [x.wd]),
      ]),
      L ? h('p', { class: 'fp-alm-lu' }, [
        h('span', null, [L.date]), h('span', null, [L.year]),
        ...L.fest.map((f) => h('span', { class: 'fp-alm-fest' }, [f])),
      ]) : null,
    ])];
    if (L) {
      kids.push(h('div', { class: 'fp-alm-body' }, [
        h('dl', { class: 'fp-alm-yj' }, [
          h('div', { class: 'fp-alm-row is-yi' }, [h('dt', { class: 'fp-alm-k' }, ['宜']), h('dd', { class: 'fp-alm-v' }, words(L.yi))]),
          h('div', { class: 'fp-alm-row is-ji' }, [h('dt', { class: 'fp-alm-k' }, ['忌']), h('dd', { class: 'fp-alm-v' }, words(L.ji))]),
        ]),
        h('p', { class: 'fp-alm-more' }, [
          h('span', null, [h('span', { class: 'fp-alm-lab' }, ['沖煞']), L.chong]),
          L.jieqi ? h('span', null, [h('span', { class: 'fp-alm-lab' }, ['節氣']), `今天${L.jieqi}`])
            : h('span', null, [h('span', { class: 'fp-alm-lab' }, ['下個節氣']), L.next]),
        ]),
      ]));
    }
    return h('section', { class: `fp-alm${L ? '' : ' is-plain'}`, 'aria-label': '今天的日期與農民曆', 'data-day': x.iso, 'data-lunar': L ? '' : null }, kids);
  }

  A.almanac = { load, render };
})();
