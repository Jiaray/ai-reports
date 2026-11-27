/* 本日焦點的今天日期與農民曆，掛 AIR.almanac（front.js 選用；只有 news/index.html 載入，排在 front.js 前）。
   - 國曆日期、星期自己算，一定有；農曆月日、干支生肖年、農曆節日、宜忌、沖煞、行政日曆的農曆假日與清明由 lunar.js 算（節氣不顯示）。
   - lunar.js＝6tail/lunar-javascript v1.7.8（MIT，原檔未改，授權在檔頭的 npm 套件裡）：約 430KB，其他頁用不到，
     第一次 load() 才另外載入（同 almanac.js 的 ?v=）；載不到只畫國曆日期那一格，下次 load() 再試。
     它是 UMD：沒有模組系統時在 window 掛 Solar、Lunar 等十幾個名稱，只在這支用。
   - lunar.js 只輸出簡體：TW 表逐詞換成台灣農民曆用字（上梁→上樑、启钻→啟攢、龙头节→龍抬頭…），表上沒有的原樣顯示。
   - 右邊一格當月的台灣行政日曆（放假紅字、今天畫圈），放假日照人事行政總處辦公日曆表的規則算（見 holidays）。
   - render(iso, { open })：iso＝台北日期 YYYY-MM-DD → <section class="fp-alm">（樣式在 front.css；data-day 給 front.js 判斷過午夜）；
     手機收成一行、點開才顯示宜忌與月曆（open＝展開，.is-open）；
     dayOff(iso) 給核對用。 */
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
      out.lu = {
        date: `農曆${mo < 0 ? '閏' : ''}${MONTH[Math.abs(mo) - 1]}月${lu.getDayInChinese()}`,
        year: `${lu.getYearInGanZhi()}${tw(lu.getYearShengXiao())}年`,
        fest: lu.getFestivals().map(tw),
        yi: lu.getDayYi().map(tw),
        ji: lu.getDayJi().map(tw),
        chong: `沖${tw(lu.getDayChongShengXiao())}（${lu.getDayChongGan()}${lu.getDayChong()}）煞${tw(lu.getDaySha())}`,
      };
    } catch (e) {
      console.error('農民曆計算失敗', e);
    }
    return out;
  }

  // ── 台灣行政日曆：人事行政總處「政府行政機關辦公日曆表」的放假日（2026 年起的規則）──
  // 依 2025 年修正的紀念日及節日實施條例：週六日放假；開國紀念日、和平紀念日、兒童節、民族掃墓節（清明）、勞動節、端午、
  // 教師節、中秋、國慶、光復節、行憲紀念日逢週六 → 前一個上班日補假、逢週日 → 次一個上班日補假；春節（除夕前一日到初三）
  // 逢週六日 → 都在春節後的上班日補假；兒童節與清明同一天 → 兒童節提前一天（逢週四延後一天）。
  // 照官方日曆表核對過：115（2026）年放假 120 天、116（2027）年 121 天，兩年都沒有補班。
  // 人事總處另外公告調整（彈性放假、補行上班、跨年補假以外的特例）時寫進 ADJUST：'YYYY-MM-DD': '名稱'＝放假、null＝上班
  const ADJUST = {};
  const offCache = new Map();
  // 年 → Map(YYYY-MM-DD → 名稱)：有名稱的放假日（含落在週六日的節日、補假）；隔年元旦逢週六的 12/31 補假也算進今年
  function holidays(Y) {
    if (offCache.has(Y)) return offCache.get(Y);
    const S = window.Solar;
    const LU = window.Lunar;
    const sol = (y, m, d) => S.fromYmd(y, m, d);
    const isoOf = (s) => s.toYmd();
    const named = new Map();
    const put = (s, name) => {
      const k = isoOf(s);
      named.set(k, named.has(k) ? `${named.get(k)}、${name}` : name);
    };
    const weekend = (s) => s.getWeek() === 0 || s.getWeek() === 6;
    const work = (s) => !weekend(s) && !named.has(isoOf(s));
    const nextWork = (from, step) => {
      let s = from.next(step);
      while (!work(s)) s = s.next(step);
      return s;
    };
    const qm = sol(Y, 4, 15).getLunar().getJieQiTable()['清明']; // 清明（4/4 或 4/5）
    const sameDay = qm.getMonth() === 4 && qm.getDay() === 4;
    const kids = sameDay ? (qm.getWeek() === 4 ? sol(Y, 4, 5) : sol(Y, 4, 3)) : sol(Y, 4, 4);
    const lunar = (m, d) => LU.fromYmd(Y, m, d).getSolar();
    const general = [
      [sol(Y, 1, 1), '開國紀念日'], [sol(Y, 2, 28), '和平紀念日'], [kids, '兒童節'], [qm, '民族掃墓節'], [sol(Y, 5, 1), '勞動節'],
      [lunar(5, 5), '端午節'], [sol(Y, 9, 28), '教師節'], [lunar(8, 15), '中秋節'], [sol(Y, 10, 10), '國慶日'],
      [sol(Y, 10, 25), '光復節'], [sol(Y, 12, 25), '行憲紀念日'],
    ];
    const ny = lunar(1, 1);
    const spring = [[ny.next(-2), '小年夜'], [ny.next(-1), '除夕'], [ny, '春節'], [ny.next(1), '春節'], [ny.next(2), '春節']];
    [...spring, ...general].forEach(([s, name]) => put(s, name));
    // 補假：春節的先放（依序補在春節後），其他照日期先後；後放的讓開已放的
    let end = spring[spring.length - 1][0];
    spring.filter(([s]) => weekend(s)).forEach(([, name]) => {
      end = nextWork(end, 1);
      put(end, `${name}補假`);
    });
    const shift = (s, name) => {
      if (s.getWeek() === 6) put(nextWork(s, -1), `${name}補假`);
      else if (s.getWeek() === 0) put(nextWork(s, 1), `${name}補假`);
    };
    general.slice().sort((a, b) => a[0].toYmd().localeCompare(b[0].toYmd())).forEach(([s, name]) => shift(s, name));
    const nextNewYear = sol(Y + 1, 1, 1);
    if (nextNewYear.getWeek() === 6) shift(nextNewYear, '開國紀念日');
    offCache.set(Y, named);
    return named;
  }
  // → { off: 是否放假, name: 名稱或 '' }
  function dayOff(iso) {
    if (Object.prototype.hasOwnProperty.call(ADJUST, iso)) return { off: ADJUST[iso] !== null, name: ADJUST[iso] || '補行上班' };
    const name = holidays(+iso.slice(0, 4)).get(iso) || '';
    const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return { off: Boolean(name) || wd === 0 || wd === 6, name };
  }

  // 當月小日曆：紅字（加粗）＝放假，今天畫圈（aria-current=date）；節日名稱放 title 與報讀文字
  const pad = (n) => String(n).padStart(2, '0');
  function calendar(iso) {
    const [y, m, today] = iso.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(h('td'));
    for (let d = 1; d <= days; d++) {
      const { off, name } = dayOff(`${y}-${pad(m)}-${pad(d)}`);
      const cls = [off ? 'is-off' : '', d === today ? 'is-today' : ''].filter(Boolean).join(' ');
      cells.push(h('td', { class: cls || null, title: name || null, 'aria-current': d === today ? 'date' : null }, [
        h('span', { class: 'fp-alm-n' }, [h('span', { class: 'fp-alm-d' }, [String(d)])]),
        name ? h('span', { class: 'visually-hidden' }, [`，${name}`]) : null,
      ]));
    }
    while (cells.length % 7) cells.push(h('td'));
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(h('tr', null, cells.slice(i, i + 7)));
    return h('table', { class: 'fp-alm-cal' }, [
      h('caption', { class: 'visually-hidden' }, [`${y} 年 ${m} 月行政日曆，紅字是放假日`]),
      h('thead', null, [h('tr', null, [...WEEK].map((w, i) => h('th', { scope: 'col', class: i === 0 || i === 6 ? 'is-off' : null }, [w])))]),
      h('tbody', null, rows),
    ]);
  }

  // 宜忌各詞不拆行：一詞一個 span（nowrap），詞間留一般空白讓報讀器分得開
  const words = (list) => (list.length ? list.flatMap((t, i) => [i ? ' ' : null, h('span', null, [t])]) : ['—']);

  // o.open：手機（≤ 40em）收成一行時是否展開（front.js 重畫時沿用原本的狀態）
  function render(iso, o = {}) {
    const x = day(iso);
    const L = x.lu;
    const kids = [h('div', { class: 'fp-alm-day' }, [
      h('p', { class: 'fp-alm-date' }, [
        h('time', { class: 'fp-alm-md', datetime: x.iso }, [x.md]), h('span', { class: 'fp-alm-wd' }, [x.wd]),
      ]),
      L ? h('p', { class: 'fp-alm-lu' }, [
        h('span', { class: 'fp-alm-ld' }, [L.date]), h('span', null, [L.year]),
        ...L.fest.map((f) => h('span', { class: 'fp-alm-fest' }, [f])),
      ]) : null,
      // 沖煞放日期格（補滿日曆撐出的高度，宜忌格只留宜忌）；節氣不顯示（使用者定案）
      L ? h('p', { class: 'fp-alm-more' }, [h('span', { class: 'fp-alm-lab' }, ['沖煞']), L.chong]) : null,
    ])];
    if (L) {
      kids.push(h('div', { class: 'fp-alm-body' }, [
        h('dl', { class: 'fp-alm-yj' }, [
          h('div', { class: 'fp-alm-row is-yi' }, [h('dt', { class: 'fp-alm-k' }, ['宜']), h('dd', { class: 'fp-alm-v' }, words(L.yi))]),
          h('div', { class: 'fp-alm-row is-ji' }, [h('dt', { class: 'fp-alm-k' }, ['忌']), h('dd', { class: 'fp-alm-v' }, words(L.ji))]),
        ]),
      ]));
      try {
        kids.push(h('div', { class: 'fp-alm-mon' }, [calendar(x.iso)]));
      } catch (e) {
        console.error('行政日曆計算失敗', e);
      }
    }
    const box = h('section', { class: `fp-alm${L ? '' : ' is-plain'}${o.open ? ' is-open' : ''}`, 'aria-label': '今天的日期與農民曆', 'data-day': x.iso, 'data-lunar': L ? '' : null });
    if (!L) {
      box.append(...kids);
      return box;
    }
    // 手機（≤ 40em，決策 2026-11-26）：收成一行「11 月 26 日 星期四・農曆十月十八 ›」，點開才顯示宜忌與月曆；
    // 桌機不顯示這顆鈕（front.css），三格照舊。三格包在 .fp-alm-in（display:contents，格線照排）
    const id = 'fp-alm-in';
    const tg = h('button', { type: 'button', class: 'fp-alm-tg', 'aria-expanded': String(Boolean(o.open)), 'aria-controls': id }, [
      h('span', { class: 'fp-alm-tg-t' }, [h('b', null, [x.md]), ` ${x.wd}・${L.date}`]),
      h('span', { class: 'fp-alm-chev', 'aria-hidden': 'true' }),
    ]);
    tg.addEventListener('click', () => {
      const open = !box.classList.contains('is-open');
      box.classList.toggle('is-open', open);
      tg.setAttribute('aria-expanded', String(open));
    });
    box.append(tg, h('div', { class: 'fp-alm-in', id }, kids));
    return box;
  }

  A.almanac = { load, render, dayOff };
})();
