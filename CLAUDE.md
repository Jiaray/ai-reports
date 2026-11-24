# ai-reports

GitHub Pages 靜態站 <https://jiaray.github.io/ai-reports/>，只放 AI 產生、可公開的內容。public repo：檔案、commit 訊息與完整歷史全公開，刪檔刪不掉歷史；`noindex` 不是存取控制。

## 上傳邊界（commit／push 前逐條確認；內容、檔名、路徑、commit 訊息都算）

可上傳：
- news-aggregator 產生的 `news/` 檔：`<系列>/<年>/<期別>.json`、`<系列>/index.json`、`index.json`、`front/index.json`、`front/<年>/<YYYY-MM-DD>.json`、`front/<ISO 年>/<YYYY-Www>.json`、`stories.json`。`news/archive/` 已廢除，只許刪除。
- 網站：`index.html`、`404.html`、`catalog.json`、`assets/`、`news/index.html`、`news/manifest.webmanifest`、`news/assets/`，及新類別的同類檔。
- `README.md`、`CLAUDE.md`、`.gitignore`、`.nojekyll`。

禁止：
- 公司與工作資訊：Datadog 的 log、metric、trace、監控數據、截圖及據此的分析；遊戲名稱、編號、專案代號、內部代碼、版本、上線排程；成員的姓名、暱稱、帳號、Telegram ID、出勤請假、聯絡方式、組織職務；內部網址、主機名、IP、repo 名稱與路徑；GitLab／Jira／Confluence 內容；規格書、需求單、程式碼、營運與營收數據、事故與資安事件分析。
- 憑證：token、金鑰、密碼、cookie、`.env`、`~/.config/` 下任何內容。
- `~/Documents/ai-reports/` 的報告與工作檔（多為公司內部內容）。
- 狀態檔與中間檔：抓下來的原始 JSON、log、草稿 markdown、跨日記憶（一律放 repo 外）。

判斷：只收「來源本來公開、整理後不涉公司內部或個人資料」的內容；公開新聞報到使用者任職的公司或產品可照實寫，不加任何內部資訊或內部觀點；拿不準就不上傳，先問使用者。

## Git

本專案允許模型執行 `git add`（限指名路徑，不得用 `-A`、`.` 或萬用字元）、`git commit`、`git push`；force push、rebase 或 amend 已推送的 commit、刪分支等改寫既有歷史的動作，以及更改 repo 設定，都不在範圍內。此宣告要與使用者全域 CLAUDE.md 的專案豁免清單同時成立才生效。

- 分支：只用 `main`（改、commit、push `origin main`）。雲端 session 指派的 `claude/…` 分支不用：開工前 `git checkout main && git pull --ff-only`，工作分支不推。
- 報告類只用腳本發布：`publish.py --push`；頭版補建 `front.py build --push`；議題對照表 `story_review.py … --push`。腳本只 add／commit 自己產生、且在可上傳清單內的路徑，不帶入其他已 stage 的檔。
- 手動 commit（改網站）：先跑 `git diff --cached --name-only`，確認全在可上傳範圍；訊息用繁體中文 Conventional Commits。
- 與遠端整合只交給腳本（使用者在多台機器同時發布不同系列）：不手動 `git pull --rebase`、不 force。腳本會快轉或把未推的 commit rebase 到遠端、逐檔解衝突、重推最多 3 次。手動 commit 推送被拒 → 在 news-aggregator 的 skill 根目錄跑 `publish.py --sync --push`（本 repo 不在 `~/github/ai-reports` 時加 `--site`）。
- 腳本 exit 3＝合併不了（`news/` 以外的檔兩邊都改過、議題對照表互相矛盾、有進行到一半的 rebase／merge）：已恢復整合前狀態（改動仍在）、記入 news-aggregator 待裁決清單、結束時 Telegram 通知使用者。不自己解衝突；等使用者回覆，以 `publish.py --sync --push` 處理（`--prefer 路徑=遠端|本機` 選邊、`--abort-stale` 放棄進行到一半的整合）。
- 誤推禁止內容：立刻停手，告訴使用者推了什麼、哪個 commit。不自行改寫歷史，由使用者決定；已推送視同外洩。

## 檔案

| 路徑 | 內容 |
|---|---|
| `index.html`、`assets/home.js` | 首頁：讀 `catalog.json`，列各類別最新內容 |
| `catalog.json` | 類別清單；`base_url` 給 publish.py 組公開網址 |
| `assets/site.css`、`assets/site.js` | 全站藍圖樣式；`window.AIR` 共用工具、配色切換、回到頂端 |
| `news/index.html` | 新聞共用頁：依網址交給 front.js 或 report.js |
| `news/assets/bar.js` | `AIR.bar` 報頭元件：工具列、下拉面板、日期面板、章節下拉、工具列凍結、非當期提示、手機功能鈕 |
| `news/assets/report.js`、`report.css` | 報告頁、讀法、「版面」；報頭、面板、功能鈕、分類標籤的樣式也在 report.css |
| `news/assets/front.js`、`front.css` | 頭版 |
| `news/assets/facets.js` | `AIR.facets` 條目分類標籤（兩頁共用） |
| `news/assets/look-standard.css`、`.js` | 外觀「一般」：樣式；`AIR.look` 頭版排法、theme-color |
| `news/manifest.webmanifest` | 主畫面名稱「AI 頭版」 |
| `news/general/2026/2026-11-18.html` | 第一版轉址頁，保留；不再產生單篇 HTML |

## 資料（`news/`）

- `index.json`（publish.py）：`series` 系列設定（`group` 領域、`short` 短名；陣列順序＝全站系列順序）＋最近 200 份（含 `lede`）。
- `<系列>/index.json`（publish.py）：該系列全部期別，新到舊，無導言。
- `<系列>/<年>/<期別>.json`（publish.py）：報告，`schema` 1，欄位對應 md2html2.py 的 render。條目選用欄位：`ts` 台北時間 ISO（時間軸排序）、`key` 固定編號、`front` 頭版順位、`facets` 分類標籤（定義在 news-aggregator `facets.py`）。
- `front/index.json`（front.py）：`dates` 最近 60 個每日頭版的日期與則數、`weeks` 最近 26 個每週頭版的週與則數。
- `front/<年>/<YYYY-MM-DD>.json`（front.py）：每日頭版＝當天各日報標 `front` 的條目，依 `key` 合併，同事件不同網址也併（互引主連結且標題相近，`merge_events`）；`facets` 取聯集、`dive_html` 取主來源（沒有取其他來源）、`from` 記來源報告（系列、期別、編號）。舊檔另帶 `weekly`，不畫。
- `front/<ISO 年>/<YYYY-Www>.json`（front.py）：每週頭版＝當週週報＋當週發布的月報，格式同上（`date` 換 `week`）。
- `stories.json`（story_review.py）：議題（`facets.story`）的改名合併、上層、退役規則與待核准提案；報告不改，讀取時套用。
- 期別：日報 `YYYY-MM-DD`、週報 `YYYY-Www`（ISO 週）、月報 `YYYY-MM`；同系列同期別重發即覆蓋。
- publish.py 發布後呼叫 front.py 從報告重建頭版：日報 → 當天每日頭版；週報、月報 → 當週每週頭版。
- `*_html` 欄位是 publish.py 淨化過的片段（只留 http/https 連結與粗體），才可當 HTML 插入；其餘欄位一律當純文字。
- 改資料格式要升 `schema`，渲染器仍要讀舊版本；改 report.js 會影響所有既有報告。

## 網址（傳出去後不改路徑規則、系列代號、repo 名稱）

- `news/`：最新一天的每日頭版（書籤、主畫面固定開最新）；`?f=YYYY-MM-DD` 那天的；`?w` 最新一週的每週頭版、`?w=YYYY-Www` 那週的。front.js 負責。
- `news/?t=<系列>&d=<期別>`：那一期報告；只帶 `t`＝該系列最新一期；`#item-NN` 捲到第 NN 則。report.js 負責。
- 連結一律相對路徑（站在 `/ai-reports/` 子路徑下）；`404.html` 例外，用 `/ai-reports/` 開頭的絕對路徑。

## 用語

- 頭版：每日頭版（畫面文字「本日焦點」）、每週頭版（畫面文字「本週回顧」，`?w`，front.js `weekMode`）。畫面以外（程式、檔名、文件）都叫頭版；front.py 的 commit 訊息寫「週報頭版」。
- 系列＝一種報告（代號如 `finance`）；領域＝系列的 `group`，決定顏色；期別＝一期的日期、週或月。
- 讀法 `data-read`：完整 `full`、標題 `scan`、時間軸 `timeline`；只有報告頁可選，頭版固定 `scan`（條目借用標題讀法的樣式）。外觀 `data-look`：藍圖 `blueprint`（預設；防閃腳本不設，report.js／front.js 會設）、地圖 `atlas`、一般 `standard`。配色 `data-theme`：自動（不存）、`light`、`dark`。
- AI 解讀＝條目的 `dive_html`（模型讀原文後的分析；摘要才是原文事實）：標籤一律寫「AI 解讀」，連結寫「看 AI 解讀」。
- localStorage：`air-theme` 配色、`air-news-look` 外觀（報告頁與頭版共用）、`air-news-read` 讀法、`air-front-seen` 頭版「新」標記、`air-front-types` 頭版過濾（舊 `air-front-filter` 開頁時刪除）。

## 前端規則

定案：
- 現有版面、配色、互動、文案都是使用者定案，改變前先問使用者（修 bug 不算）。新版面只能做成可切換的選項；預設永遠是完整＋藍圖。藍圖（設計代幣、元件同 md2html2.py）的配色與線條不改。
- 不重複：同一頁每個資訊只出現一次（日期、系列名、媒體名、家數、徽章出處……）；導覽的「目前位置」標示不算。新增任何顯示前先確認頁面上沒有同樣的資訊。
- 報頭不顯示導言；`intro`／`lede` 只給 Telegram 訊息與首頁列表。

載入、快取、版本：
- 載入順序（全部 `defer`）：site.js → bar.js → look-standard.js → facets.js → report.js／front.js，執行時 `window.AIR` 已在；新頁面腳本同樣 `defer` 排在 site.js 後。
- 每個 HTML 的 `<head>` 有 inline 防閃腳本：首次繪製前套 `air-theme`（`data-theme`＋`<meta name=color-scheme>`），新聞頁另套 `air-news-look`（`data-look`）。
- 部署後約 10 分鐘的快取空窗會混到新舊檔：新共用檔、bar.js 新函式、新 CSS 標記都要容錯——缺了就少那個功能，頁面照常、不停在「載入中…」。這類容錯只為撐過那次部署的空窗，之後清理時可刪。常設的只有選用模組檢查：用 `A.facets`、`A.look` 前先檢查（facets.js、look-standard.js 載入失敗時少該功能）。
- `?v=`：`index.html`、`404.html`、`news/index.html` 引用 `assets/`、`news/assets/` 的每個 CSS、JS 都帶 `?v=<台北日期＋兩位序號>`（例 `2026112101`）。改了任何 CSS、JS → 三個 HTML 的 `?v=` 全部換成同一個新值、一起 commit。HTML 本身仍快取 10 分鐘。

樣式：
- 範圍隔離：`look-standard.css` 只用 `[data-look=standard]` 開頭的選擇器；地圖寫在 `[data-look=atlas]`；`front.css` 的規則對象只限 `.fp`／`.fp-*`（可加 `:root[data-theme]`、`[data-look]` 前綴），不對 `:root`、`html` 本身設值；藍圖是不加外觀選擇器的基底樣式。
- 地圖一律圓角（`--r-sm` 6px、`--r-md` 10px），條目左緣色線維持直線；藍圖一律方角。
- 斷點用 em：窄版 `max-width:40em`、寬版 `64em`。
- 觸控（`pointer:coarse`）可點元素至少 44px 高；例外：頭版過濾標籤（緊密排列，見 front.css）。
- 內文行高：摘要、AI 解讀 1.7；重點、分區說明 1.65；摘要預覽 1.6–1.65。段距 .75em（一般外觀 .8em），要明顯大於行距。
- 文字寫滿欄寬：標題與內文的 `text-wrap` 維持預設（balance 把兩行標題切半；pretty 在 iOS WebKit 整段提早換行）；不用兩端對齊（窄欄中英混排會拉開字距）；文字欄不另設 `max-width`（`.wrap` 最寬 880px）。
- `body{overflow-wrap:break-word}`（site.css）讓長英數字串放不下才斷；不改成 `anywhere`（會改變最小寬度，表格欄被擠成一字一行）。
- 字型：藍圖、地圖用思源黑體（Noto Sans TC，news/index.html 載入）；條目標題用內文字型（窄體英數夾在中文裡會黏成一團），編號、時刻、標籤等短英數用 `--font-heading` 窄體；一般外觀只用系統字；首頁、404 退回蘋方。
- 手機內文接近滿版：窄版 `.sec-body` 左右內距 `--space-3`、條目左欄（編號＋時刻）36px；藍圖、地圖的內文與標題左緣對齊、留在編號欄右邊。
- 改排版後用 iOS 模擬器的 Safari 看一次（桌機 Chrome 看不出 WebKit 的換行差異）。

互動、無障礙：
- 主要內容包在 `<main>`（新聞頁 `main#main`、首頁 `main#cats`）；`<body>` 最前面有略過連結。
- 下拉面板（日期、章節、版面）共用 bar.js `dropdown()`：同時只開一個；Esc、點外面、× 收起（Esc、× 收起後焦點回按鈕）；打開時焦點移入。面板內是連結清單、用 Tab 走，不用 ARIA menu。
- 按鈕列（頭版過濾標籤、報告頁讀法）：`role=toolbar`＋`aria-pressed`（按鈕文字不隨狀態改）＋`focusgroup`，不支援時 bar.js `roving()` 補方向鍵。
- 狀態不只靠顏色（加線、打勾、圖示）；強制色彩模式（`forced-colors`）改用外框或底線標示；`prefers-reduced-motion` 時關掉動畫與轉場。
- 放不下就換行，不做橫向捲動的導覽列（桌機滑鼠點不到藏起來的項目）。
- 手機（≤40em）一律有右下角功能鈕（`html.has-fab`），頂端工具列收起、不凍結，沒有另外的手機工具列排版：工具列上每一項都要在扇面有一格、圖示相同；面板留在工具列 DOM 裡，由扇面從底部打開（`.is-sheet`）。

## 頁面要點（細節在各檔註解）

- 報頭（bar.js，兩頁共用）：凍結的工具列「日期｜本日焦點｜本週回顧｜版面」＋大標題。bar.js 量工具列高度寫進 `--bar-h`（`scroll-padding-top`、黏頂標題讓開它；不凍結時記 0）。本日焦點／本週回顧兩顆同字數，同時標示目前在日報或週報那一邊；沒有任何週報、月報時不顯示本週回顧。
- 非當期提示（bar.js `staleBanner`）：期別不是台北時間的今天／本週／本月時，工具列上方一條黃色橫幅。
- 頭版（front.js）：每日頭版依整點分組、每週頭版依日期分組（同一套畫法）；過濾標籤＝本頁條目的系列短名；條目展開後「出自」連到報告裡的那一則（`#item-NN`）。
- 報告頁（report.js）：讀法決定 DOM（換讀法重繪），外觀、配色只改 `<html>` 屬性；時間軸依 `ts` 跨分區排序，沒有 `ts` 的照原順序接在最後。
- 外觀「一般」：頭版由 `AIR.look.arrangeFront()` 搬動 front.js 畫好的同一批條目。

## 新增類別

1. 類別代號：小寫英數與 `-`，定了不改；`assets`、`archive`、`index`、`front` 是保留字（新聞系列代號同樣不能用）。
2. 建 `<代號>/index.html`、`<代號>/index.json`（欄位同 `news/index.json`；`items` 每筆要有 `series`、`series_title`、`period`、`cadence`、`title`、`count`、`lede`；首頁連到 `<代號>/?t=<series>&d=<period>`）；每個系列一份 `<代號>/<series>/index.json` 全期別清單。
3. `catalog.json` 的 `categories` 加一筆，首頁就會列出。
4. 產出工具只寫自己的目錄，遵守上傳邊界。
