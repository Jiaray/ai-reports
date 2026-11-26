# ai-reports

GitHub Pages 靜態站 <https://jiaray.github.io/ai-reports/>，只放 AI 產生、可公開的內容。public repo：檔案、commit 訊息與完整歷史全公開，刪檔刪不掉歷史；`noindex` 不是存取控制。

## 上傳邊界（commit／push 前逐條確認；內容、檔名、路徑、commit 訊息都算）

可上傳：
- news-aggregator 產生的 `news/` 檔：`index.json`（系列設定）、`stories.json`、來源清單 `sources.md` 與來源統計 `sources-stats.json`。週報、每週頭版（`news/weekly/`）與 `news/archive/` 已廢除、已刪除，不再上傳。
- 新聞卡（news-aggregator 的 cards.py、card_errors.py、card_index 產生）：`news/cards/<Y>/W<ww>/<NNNN>.json`（新聞卡）、`news/cards/<Y>/W<ww>/index.json`（週索引）、`news/cards/recent.json`、`news/cards/focus.json`、`news/cards/story-index.json`、`news/cards/url-index.json`（全部卡的網址索引）、`news/cards/id-floor.json`（各週編號下限）、`news/cards/errors.json`、`news/aliases.json`、`news/adhoc/<slug>.json`（暫時頁資料）。壞檔備份（`*.broken-*`）與暫存檔（`.*.tmp`）不上傳。
- 網站：`index.html`、`404.html`、`catalog.json`、`assets/`、`news/index.html`、`news/card.html`、`news/story.html`、`news/adhoc.html`、`news/manifest.webmanifest`、`news/assets/`（含新聞卡頁的 `card.js`、`card.css`，列表列的 `rows.js`、`rows.css`，系列頁的 `series.js`、`series.css`，議題頁與議題目錄的 `story.js`、`story.css`，暫時頁的 `adhoc.js`、`adhoc.css`，本日焦點農民曆的 `almanac.js` 與第三方 `lunar.js`），及新類別的同類檔。
- `README.md`、`CLAUDE.md`、`.gitignore`、`.nojekyll`。

禁止：
- 公司與工作資訊：Datadog 的 log、metric、trace、監控數據、截圖及據此的分析；遊戲名稱、編號、專案代號、內部代碼、版本、上線排程；成員的姓名、暱稱、帳號、Telegram ID、出勤請假、聯絡方式、組織職務；內部網址、主機名、IP、repo 名稱與路徑；GitLab／Jira／Confluence 內容；規格書、需求單、程式碼、營運與營收數據、事故與資安事件分析。
- 憑證：token、金鑰、密碼、cookie、`.env`、`~/.config/` 下任何內容。
- `~/Documents/ai-reports/` 的報告與工作檔（多為公司內部內容）。
- 狀態檔與中間檔：抓下來的原始 JSON、log、草稿 markdown（一律放 repo 外）。

判斷：只收「來源本來公開、整理後不涉公司內部或個人資料」的內容；公開新聞報到使用者任職的公司或產品可照實寫，不加任何內部資訊或內部觀點；拿不準就不上傳，先問使用者。

## Git

本專案允許模型執行 `git add`（限指名路徑，不得用 `-A`、`.` 或萬用字元）、`git commit`、`git push`，以及 `git checkout HEAD -- <指名路徑>`（只用來還原誤刪、被發布腳本擋下的新聞卡檔、錯誤紀錄、別名表；不提交、不改寫歷史）；force push、rebase 或 amend 已推送的 commit、刪分支等改寫既有歷史的動作，以及更改 repo 設定，都不在範圍內。此宣告要與使用者全域 CLAUDE.md 的專案豁免清單同時成立才生效。

- 分支：只用 `main`（改、commit、push `origin main`）。雲端 session 指派的 `claude/…` 分支不用：開工前 `git checkout main && git pull --ff-only`，工作分支不推。
- `news/` 的資料只用腳本發布：新聞卡 `cards.py publish --push`（修正 `cards.py correct｜dup｜split｜retag --push`、錯誤紀錄與別名表 `card_errors.py … --push`）；議題對照表 `story_review.py … --push`；來源清單與統計 `source_list.py update --push`。腳本只 add／commit 自己產生、且在可上傳清單內的路徑，不帶入其他已 stage 的檔。
- 手動 commit（改網站）：先跑 `git diff --cached --name-only`，確認全在可上傳範圍；訊息用繁體中文 Conventional Commits。
- 與遠端整合只交給腳本（news-aggregator 只在一台電腦依序跑、不會兩台同時發布；別台推過的內容只在雲端那一輪與其他電腦手動跑時遇到）：不手動 `git pull --rebase`、不 force。腳本會快轉或把未推的 commit rebase 到遠端、逐檔解衝突、重推最多 3 次。手動 commit 推送被拒 → 在 news-aggregator 的 skill 根目錄跑 `publish.py --sync --push`（本 repo 不在 `~/github/ai-reports` 時加 `--site`）。
- 腳本 exit 3＝合併不了（`news/` 以外的檔兩邊都改過、議題對照表互相矛盾、有進行到一半的 rebase／merge）：已恢復整合前狀態（改動仍在）、記入 news-aggregator 待裁決清單、結束時 Telegram 通知使用者。不自己解衝突；等使用者回覆，以 `publish.py --sync --push` 處理（`--prefer 路徑=遠端|本機` 選邊、`--abort-stale` 放棄進行到一半的整合）。
- 誤推禁止內容：立刻停手，告訴使用者推了什麼、哪個 commit。不自行改寫歷史，由使用者決定；已推送視同外洩。

## 檔案

| 路徑 | 內容 |
|---|---|
| `index.html`、`assets/home.js` | 首頁：讀 `catalog.json`，每個類別一區；類別有 `focus`（新聞是 `news/cards/focus.json`）時只放本日焦點一列（進本日焦點的連結＋近 24 小時前 3 張，沒有就列最近一批），不讀 `index.json`；沒有 `focus` 的類別列 `index.json` 的 `items` 最近 8 份 |
| `catalog.json` | 類別清單（每個類別可加 `focus`）；`base_url` 給 publish.py 組公開網址 |
| `assets/site.css`、`assets/site.js` | 全站藍圖樣式；`window.AIR` 共用工具、配色切換、回到頂端 |
| `news/index.html` | 新聞共用頁：不帶 `t` 交給 front.js（本日焦點），帶 `t` 交給 report.js（系列頁） |
| `news/card.html`、`news/assets/card.js`、`card.css` | 新聞卡頁：依 `#<編號>` 讀一張新聞卡；系列與事件時間讀它的輕量條目，議題區塊讀 `cards/story-index.json` 與週索引 |
| `news/story.html`、`news/assets/story.js`、`story.css` | 議題頁（`#<議題名>`）與議題目錄（不帶 hash）：讀 `cards/story-index.json`，議題頁各卡的輕量條目依編號讀週索引；篩選標籤借 front.css 的 `.fp-fq` |
| `news/adhoc.html`、`news/assets/adhoc.js`、`adhoc.css` | 暫時頁（`#<slug>`）：讀 `adhoc/<slug>.json`；日段借 series.css 的 `.sp-sec`／`.sp-dh` |
| `news/assets/bar.js` | `AIR.bar` 報頭元件：工具列、下拉面板、系列面板、議題連結、工具列凍結、手機功能鈕 |
| `news/assets/report.js`、`report.css` | `?t=` 的分派（`index.json` 的系列交給 series.js；不認得的代號顯示「找不到這個系列」；series.js 沒載到時顯示施工中）、系列頁的工具列與「版面」；report.css 是新聞各頁共用的樣式：領域色、報頭、下拉面板、功能鈕、內文（`.row-sum`、`.row-dive`）、列表列的展開箭頭（`.peek`）、分類標籤（`.fct-*`）、施工中與找不到頁（`.wip-*`） |
| `news/assets/series.js`、`series.css` | `AIR.series` 系列頁（`?t=<系列>`）：report.js 讀完 `index.json` 後呼叫，工具列與「版面」用 report.js 的；讀 `cards/recent.json`，近 7 天依天分段 |
| `news/assets/rows.js`、`rows.css` | `AIR.rows` 新聞卡列表列（本日焦點、系列頁、議題頁）：頁內展開、展開時才抓卡檔；暫時頁用不展開的 `link()`；列表頁的分天與排序（`eventAt`、`dayOf`、`dayLabel`、`byImportance` 等，議題頁、暫時頁也用這一套）；`*_html` 的瀏覽器端淨化與分段（`rich`、`prose`、`dive`，新聞卡頁也用這一份） |
| `news/assets/front.js`、`front.css` | 本日焦點（過濾標籤的標記與樣式議題目錄也用）；本日焦點的日期與農民曆樣式 `.fp-alm` 也在 front.css |
| `news/assets/almanac.js` | `AIR.almanac` 本日焦點的今天日期與農民曆：國曆自己算；農曆、干支生肖、節日、宜忌、沖煞用 lunar.js 算，簡體逐詞轉台灣用字（`TW` 表）；當月台灣行政日曆的放假日照人事行政總處辦公日曆表的規則算（`holidays`），人事總處另行公告調整（彈性放假、補行上班）時寫進 `ADJUST` |
| `news/assets/lunar.js` | 第三方 6tail/lunar-javascript v1.7.8（MIT）：npm 原檔，只在檔頭加授權文字，不改內容；約 430KB，只有本日焦點由 almanac.js 另外載入（同 `?v=`），其他頁不載；升版時整檔換掉、照樣加授權檔頭 |
| `news/assets/facets.js` | `AIR.facets` 新聞卡分類標籤（新聞卡頁、列表列共用，議題逐段連到議題頁） |
| `news/assets/look-standard.css`、`.js` | 外觀「一般」：樣式；`AIR.look` theme-color（各頁看 `A.look` 在不在決定列不列「一般」） |
| `news/manifest.webmanifest` | 主畫面名稱「AI 頭版」 |

## 資料（`news/`）

- `index.json`（card_index 建索引時重寫）：`{"schema": 2, "generated_at", "series": [{"id", "title", "short", "group"}]}`，系列設定（`short` 短名、`group` 領域；陣列順序＝news-aggregator `views.SERIES`＝全站系列順序，同領域的挨在一起）；不再有 `items`。22 個系列、9 個領域（台灣、政治、社會、財經、科技、科學健康、生活娛樂、遊戲產業、閱讀），定義在 news-aggregator `views.py`。
- `sources.md`、`sources-stats.json`（news-aggregator `source_list.py`）：來源清單（全部抓取單位，分共用、各領域、板凳、待檢、停用）與每個抓取單位的收集時間、連續未收錄輪數、板凳上次抓的時間；網站不讀。
- 新聞卡（契約與格式在 news-aggregator 的新聞卡契約 §2、§3、§9；任何修正只改標記，不搬檔、不刪卡，已傳出的網址永遠打得開）：
  - `cards/<Y>/W<ww>/<NNNN>.json`（cards.py publish 寫內容；`online_only`、`heat`、來源分類由 card_index 補）：一張新聞卡，`schema` 2（`facets.form` 形式：新聞、長文、播客、論文、開源專案，程式寫）。編號 `<ISO 年>-W<兩位週>-<四位流水號>`（例 `2026-W48-0153`），週＝新增時間的台北 ISO 週；流水號＝該週資料夾現有最大號與 `id-floor.json` 該週數字的較大者加 1。`dup_of` 有值＝跟那張是同一件事；`log` 是補充（`supplement`）、更正（`correction`）紀錄，原文不改。
  - `cards/<Y>/W<ww>/index.json`（card_index）：週索引，該週新增的全部卡（含封存、標重複）的輕量條目，依編號。
  - `cards/recent.json`（card_index）：未封存、或 8 天內新增或更新過的卡的輕量條目，`updated_at` 新到舊；系列頁讀它。
  - `cards/focus.json`（card_index）：本日焦點候選 `{"window_hours": 24, "limit": 10, "built_at", "cards": [輕量條目＋focus_at，已排好序]}`；收沒標重複、不是舊新聞（late）、48 小時內新增或 refocus 補充的卡。網站看的當下只取 `focus_at` 在 `window_hours` 內的前 `limit` 張；一張都沒有時列整份的前 `limit` 張並標 `built_at` 為最後更新。
  - `cards/story-index.json`（card_index）：議題索引（名稱已套 `stories.json`；`parent` 上層；`status` 進行中、沉寂、歸檔；`cards` 編號，子議題的卡也列進上層，標重複的不列；契約 1.16 加 `series` 所有卡的系列聯集、`latest` 最新一張的編號標題事件時間、`count`）；議題頁、議題目錄讀它。
  - `cards/url-index.json`（card_index）：`{"schema": 1, "built_at", "urls": {"<正規化網址>": "<卡編號>"}}`，含封存與標重複的卡；同一個網址只開一張卡靠它擋。網站不讀。
  - `cards/id-floor.json`：`{"<ISO 年>-W<兩位週>": <刪除前最大流水號>}`，刪過卡的週編號往下接、不重複使用。網站不讀。
  - `cards/errors.json`（cards.py、card_errors.py）：疑似錯誤與已套用的修正紀錄。
  - 輕量條目：`id`、`title`、`line`（一句話）、時間、`archived`、`late`、`online_only`、`dup_of`、主要標籤（含 `taiwan` 台灣關聯）、`form`（形式）、`heat`、`series`（會出現在哪些系列頁，標重複的卡不進任何系列）、`last_update`（最後一段補充或更正，含 `refocus`）、`corrected_at`；契約 1.16 加 `first_reported_at`、`event_at`（事件時間：late 用最早報導，其他用新增）、`supplemented_at`（最後一段補充的時間）、`heat_rank`（熱度相對名次，0 最熱）、`exploited`（領域欄位含「已遭利用」）。
- `aliases.json`（cards.py、card_errors.py）：機構、人物的別名表與待核准提案；卡檔原文不改，讀取時套用（新聞卡頁的分類）。
- `adhoc/<slug>.json`（cards.py）：暫時頁資料 `{"slug", "title", "built_at", "cards": [{"id", "title", "line", "op"}]}`；card_index 重建時每張補上 `event_at`、`series`、`weight`、`heat_rank`、`last_update` 並更新 `title`、`line`（契約 1.16；網站遇到缺的舊資料依編號讀週索引補）；`op` 不顯示。同代號重查整份覆蓋，7 天沒再查刪檔。
- `stories.json`（story_review.py）：議題（`facets.story`）的改名合併、上層、退役規則與待核准提案；新聞卡不改，讀取時套用。
- 新聞卡的 `*_html` 欄位（`summary_html`、`dive_html`、`fields[].html`、`log[].html`）是發布端淨化過的片段（只留 http/https 連結與粗體），才可當 HTML 插入，另在瀏覽器再濾一次（rows.js 一份，列表列與新聞卡頁共用）。其餘欄位一律當純文字（議題名、暫時頁代號等網址片段也是）。
- 改資料格式要升 `schema`；渲染器要能讀還在網站上的舊版本（新聞統一改版時舊卡全部刪除，這次的渲染器只讀 schema 2 的卡；舊卡沒有 `form` 照常顯示）。

## 網址（傳出去後不改路徑規則、系列代號、repo 名稱）

- `news/`：本日焦點（書籤、主畫面固定開它）：看的當下往回 24 小時內新增或補充的新聞卡、前 10 張，不按日期翻頁。front.js 負責；其他參數（舊網址 `?f=YYYY-MM-DD`、已刪的每週頭版 `?w`）不認，一律顯示本日焦點。
- `news/?t=<系列>`：系列頁（series.js）：近 7 天的新聞卡；`&d=YYYY-MM-DD`（舊日報網址）在 7 天內捲到那天那段（那天沒卡就捲到更早最近的一段），超過 7 天停在頁首。`t` 不在 `index.json` 的系列裡（含已刪的舊代號、`?t=general`）：顯示「找不到這個系列」與回本日焦點的連結，不做舊代號的轉址（report.js）。
- 系列代號在 2026-11 新聞統一改版時一次性改過（刪 `general`、`international`、`taiwan_disaster` 與全部週報系列；`tech_ai` 改 `ai`、`gamedev` 改 `game_industry`），之後照「傳出去後不改」。
- `news/card.html#<編號>`：新聞卡（card.js）。
- `news/story.html#<議題名，encodeURIComponent>`：議題頁（story.js）；改名、合併過的舊名稱照 `stories.json` 落到新名稱（`replaceState` 把網址換成新名稱）。`news/story.html` 不帶 hash：議題目錄。
- `news/adhoc.html#<slug>`：暫時頁（adhoc.js；不放進任何選單、面板或目錄，只用網址開）。
- 連結一律相對路徑（站在 `/ai-reports/` 子路徑下）；`404.html` 例外，用 `/ai-reports/` 開頭的絕對路徑。

## 用語

- 頭版：本日焦點（讀新聞卡，front.js）；工具列與手機扇面連回它的按鈕叫「新聞首頁」。每週頭版（本週回顧）、每日頭版已刪除。畫面以外（程式、檔名、文件）都叫頭版。
- 新聞卡：一件事一張（量詞「張」），網站唯一的內容單位；系列頁、議題頁、暫時頁都只列新聞卡。頁面不出現以讀者閱讀進度為前提的字眼（「看過」「還沒看過」）。
- 系列＝一組新聞卡的篩選（代號如 `finance`，22 個）；領域＝系列的 `group`（9 個），只用在選單分組與領域色；形式＝新聞卡的面向 `form`（新聞、長文、播客、論文、開源專案），決定 GitHub、論文、深度閱讀三個系列頁。
- `data-read`：各頁固定 `scan`（沿用改版前「標題讀法」的名稱；列表列借它的 `.peek`、`.row-title` 樣式），沒有讀法切換。外觀 `data-look`：藍圖 `blueprint`（預設；防閃腳本不設，新聞各頁的 JS 會設）、地圖 `atlas`、一般 `standard`。配色 `data-theme`：自動（不存）、`light`、`dark`。
- AI 解讀＝新聞卡的 `dive_html`（模型讀原文後的分析；摘要才是原文事實）：標籤一律寫「AI 解讀」，連結寫「看 AI 解讀」。
- localStorage：`air-theme` 配色、`air-news-look` 外觀（新聞各頁共用）、`air-front-types` 本日焦點的系列過濾、`air-story-types` 議題目錄的系列篩選（不跟本日焦點共用）。`air-news-read`（舊讀法）已不使用；舊的 `air-front-filter`、`air-front-seen` 已不使用，本日焦點開頁時刪除。

## 前端規則

定案：
- 現有版面、配色、互動、文案都是使用者定案，改變前先問使用者（修 bug 不算）。新版面只能做成可切換的選項；預設永遠是藍圖；系列頁只用標題列（使用者定案，不放讀法切換）。藍圖的設計代幣、配色與線條不改。
- 不重複：同一頁每個資訊只出現一次（日期、系列名、媒體名、家數、徽章出處……）；導覽的「目前位置」標示不算。新增任何顯示前先確認頁面上沒有同樣的資訊。例外：鄉民系列頁同一張卡在幾個平台有熱度，就在那天的幾個平台區各列一次（各標該平台的熱度；使用者定案）。
- 報頭不顯示導言；`lede` 只給首頁列表（新增類別的 `items`）。新聞類別沒有 `intro`／`lede`：首頁列本日焦點，Telegram 訊息由 news-aggregator 從新聞卡組成。

載入、快取、版本：
- 載入順序（全部 `defer`）：site.js → bar.js → look-standard.js → facets.js → rows.js → series.js（只有 `news/index.html`）→ report.js → almanac.js（只有 `news/index.html`，排在 front.js 前）→ front.js（新聞卡頁 card.js；議題頁 story.js；暫時頁 adhoc.js，不載 facets.js），執行時 `window.AIR` 已在；series.js 要排在 report.js 前（report.js 看 `A.series` 在不在決定交給它或顯示施工中）；新頁面腳本同樣 `defer` 排在 site.js 後。CSS：site.css → report.css（新聞各頁共用）→ front.css（本日焦點；議題頁借它的篩選標籤）→ rows.css（沒有 front.css 的頁排在 report.css 後）→ look-standard.css → 頁面自己的 series.css、card.css、story.css、adhoc.css（檔內自帶一般外觀的規則；暫時頁先載 series.css 再載 adhoc.css）。
- 每個 HTML 的 `<head>` 有 inline 防閃腳本：首次繪製前套 `air-theme`（`data-theme`＋`<meta name=color-scheme>`），新聞頁另套 `air-news-look`（`data-look`）。
- 部署後約 10 分鐘的快取空窗會混到新舊檔：新共用檔、bar.js 新函式、新 CSS 標記都要容錯——缺了就少那個功能，頁面照常、不停在「載入中…」。這類容錯只為撐過那次部署的空窗，之後清理時可刪（目前有：`B.seriesMenu`、`B.storyLink`（舊 bar.js 沒有就不放「議題」）、`A.facets.storyPaths` 的存在檢查；report.js、series.js 直接讀 `index.json` 的系列（不靠 bar.js，配到舊 bar.js 也認得系列、列得出其他系列）；舊 HTML 沒載 series.js、或配到缺檔或舊的 rows.js（沒有 `A.rows.byImportance`，series.js 不掛 `A.series`）時，report.js 的系列頁退回「施工中」；新 HTML 配到缺檔或舊的 rows.js（`A.rows` 不在）時 front.js 的本日焦點退回前一版的標題連結清單（`focusRow`、front.css 的 `.fp-card`），頁面照常、不停在「載入中…」；新聞卡頁配到缺檔或舊的 rows.js（沒有 `A.rows.rich`／`prose`／`dive`）時 card.js 把 `*_html` 退回純文字（惰性 `<template>` 解析、去掉 script 等元素後只取 `textContent`，依 `<br>` 分段；沒有連結、粗體與分句），其餘照常；議題頁、議題目錄配到缺檔的 rows.js（`A.rows` 不在）、暫時頁配到缺檔或舊的 rows.js（沒有 `A.rows.link`）時，story.js、adhoc.js 只放一行「這一頁剛更新…過幾分鐘重新整理」與回本日焦點）。新聞統一改版刪掉的容錯：`?t=general` 轉本日焦點（現在顯示「找不到這個系列」）、舊版施工中頁 wip.js、`B.cardSeries`／`B.seriesGroups` 的存在檢查；bar.js 同時拿掉了報告頁、每週頭版才用的元件（日期、章節、讀法、非當期提示），快取裡的舊週報頁、本週回顧在空窗內會顯示失敗，那兩種頁已刪除，不補容錯。常設的只有選用模組檢查：用 `A.facets`、`A.look` 前先檢查（facets.js、look-standard.js 載入失敗時少該功能）。
- `?v=`：`index.html`、`404.html`、`news/index.html`、`news/card.html`、`news/story.html`、`news/adhoc.html` 引用 `assets/`、`news/assets/` 的每個 CSS、JS 都帶 `?v=<台北日期＋兩位序號>`（例 `2026112101`）。改了任何 CSS、JS → 六個 HTML 的 `?v=` 全部換成同一個新值、一起 commit。HTML 本身仍快取 10 分鐘。

樣式：
- 範圍隔離：`look-standard.css` 只用 `[data-look=standard]` 開頭的選擇器；地圖寫在 `[data-look=atlas]`；`front.css` 的規則對象只限 `.fp`／`.fp-*`、`card.css` 只限 `.cd`／`.cd-*`、`rows.css` 只限 `.rw`／`.rw-*`、`series.css` 只限 `.sp`／`.sp-*`、`story.css` 只限 `.st`／`.st-*`、`adhoc.css` 只限 `.ah`／`.ah-*`（都可加 `:root[data-theme]`、`[data-look]` 前綴），不對 `:root`、`html` 本身設值；藍圖是不加外觀選擇器的基底樣式。別頁借用的元件（議題目錄的 `.fp-fq` 篩選標籤、暫時頁的 `.sp-dh` 日段）樣式留在原檔，不在借用頁覆寫；一般外觀的篩選標籤寫成 `:is(.fp,.st) .fp-chip`。
- 地圖一律圓角（`--r-sm` 6px、`--r-md` 10px），條目左緣色線維持直線；藍圖一律方角。
- 斷點用 em：窄版 `max-width:40em`、寬版 `64em`。
- 觸控（`pointer:coarse`）可點元素至少 44px 高；例外：本日焦點與議題目錄的過濾標籤（緊密排列，見 front.css）。
- 內文行高：摘要、AI 解讀 1.7；一句話預覽 1.6–1.65。段距 .75em（一般外觀 .8em），要明顯大於行距。
- 文字寫滿欄寬：標題與內文的 `text-wrap` 維持預設（balance 把兩行標題切半；pretty 在 iOS WebKit 整段提早換行）；不用兩端對齊（窄欄中英混排會拉開字距）；文字欄不另設 `max-width`（`.wrap` 最寬 880px，三種外觀一樣、左右內距也一樣；一般外觀不另設頁寬或內容欄寬，使用者定案）。
- 工具列上方、下拉面板（含手機底部面板）頂端都不畫粗線，三種外觀一樣（使用者定案）。
- `body{overflow-wrap:break-word}`（site.css）讓長英數字串放不下才斷；不改成 `anywhere`（會改變最小寬度，表格欄被擠成一字一行）。
- 字型：藍圖、地圖用思源黑體（Noto Sans TC，news/index.html 載入）；條目標題用內文字型（窄體英數夾在中文裡會黏成一團），編號、時刻、標籤等短英數用 `--font-heading` 窄體；一般外觀只用系統字；首頁、404 退回蘋方。
- 改排版後用 iOS 模擬器的 Safari 看一次（桌機 Chrome 看不出 WebKit 的換行差異）。

互動、無障礙：
- 主要內容包在 `<main>`（新聞頁 `main#main`、首頁 `main#cats`）；`<body>` 最前面有略過連結。
- 下拉面板（系列、版面）共用 bar.js `dropdown()`：同時只開一個；Esc、點外面、× 收起（Esc、× 收起後焦點回按鈕）；打開時焦點移入。面板內是連結清單、用 Tab 走，不用 ARIA menu。
- 按鈕列（本日焦點與議題目錄的過濾標籤）：`role=toolbar`＋`aria-pressed`（按鈕文字不隨狀態改）＋`focusgroup`，不支援時 bar.js `roving()` 補方向鍵。
- 狀態不只靠顏色（加線、打勾、圖示）；強制色彩模式（`forced-colors`）改用外框或底線標示；`prefers-reduced-motion` 時關掉動畫與轉場。
- 放不下就換行，不做橫向捲動的導覽列（桌機滑鼠點不到藏起來的項目）。
- 手機（≤40em）一律有右下角功能鈕（`html.has-fab`），頂端工具列收起、不凍結，沒有另外的手機工具列排版：工具列上每一項都要在扇面有一格、圖示相同；面板留在工具列 DOM 裡，由扇面從底部打開（`.is-sheet`）。

## 頁面要點（細節在各檔註解）

- 報頭（bar.js，新聞各頁共用）：凍結的工具列＋大標題。左邊「新聞首頁」（連本日焦點 `./`；按鈕叫新聞首頁、頁名與大標題仍是本日焦點，使用者定案）、右邊一組「系列｜議題｜版面」（組裡第一個 `margin-left:auto`，report.css；「議題」帶 `.ed-story`）。本日焦點不翻日期。「新聞首頁」只在本日焦點標目前位置；「議題」連議題目錄（`story.html`；在議題頁、議題目錄標目前位置）；系列頁、新聞卡頁、暫時頁都不標。工具列放不下就換行。bar.js 量工具列高度寫進 `--bar-h`（`scroll-padding-top`、黏頂標題讓開它；不凍結時記 0）。
- 系列（bar.js `seriesMenu`）：一顆下拉，按鈕同「版面」只放圖示與文字、不加下拉箭頭（使用者定案），面板一欄「新聞卡（近 7 天）」列全部系列頁（`./?t=<系列>`，短名取 `index.json` 的 `series[].short`），順序照 `index.json`（＝`views.SERIES`，同領域的挨在一起），清單分兩欄、先直後橫，文字前一條領域色短線。目前的系列 `aria-current=page`；系列二十多個，逐一放按鈕擺不進工具列與扇面。圖示是一排書（兩本直立、一本斜靠）。面板同「版面」貼按鈕右緣展開，窄桌機超出左緣時 `fitIn` 往右移回來。手機扇面「系列」「議題」各一格。
- 本日焦點（front.js）：讀 `cards/focus.json`，不翻日期、不按整點分段，一條最多 10 張的清單照 `focus.json` 的順序；條目是 rows.js 的列表列（見下；展開後最後一列是「開新聞卡｜系列…｜分類」，舊頭版的「出自」改成「系列」），上方小字的時間寫多久前（滑過看完整時間），每張一樣（沒有頭條樣式，使用者定案）；過濾標籤＝本頁新聞卡的系列短名。報頭下一塊今天的日期與農民曆（almanac.js；樣式摘要另見 front.css 註解）：定案不搶新聞——小字、無底色、細框、留白壓到最少，高度約等於小日曆（桌機約 100px）；左格國曆「M 月 D 日 星期X」＋農曆月日、干支生肖年、農曆節日、沖煞（節氣不顯示，使用者定案），中格宜、忌，右格當月行政日曆（放假紅字加粗、今天畫圈，節日名稱在 title）；左右兩格照內容寬、宜忌補滿，窄版（≤ 40em）左國曆右日曆、宜忌移到下面一整列；放假規則 2026 年起適用，已照 115、116 年官方日曆表核對（放假 120、121 天）；lunar.js 最多等 3 秒，晚到的到了再補，載不到只剩國曆那一格；開著過午夜就地換成新的一天。時間窗內沒有卡時工具列上方一條黃色橫幅（`.stale`，report.css）標最後更新。開著每分鐘更新多久前，回前景重抓（有變才重畫，展開中的列保持展開）。不標「新」。
- 新聞卡列表列（rows.js，本日焦點、系列頁、議題頁）：左緣領域色線、上方小字（這頁以外的系列・時間・家數，頁面可再接一項，如鄉民頁的平台熱度）、標題（頁面可在前面加紅底標示，如資安頁的「遭利用」）、右邊箭頭；標題不是連結，點開在頁內展開。最後一段 log 是補充的，標題下一行「更新 HH:MM」＋更新句；更正用紅色「更正 HH:MM」。展開時才抓那張卡的檔（`cards/<Y>/W<ww>/<NNNN>.json`），列摘要、AI 解讀、領域欄位，最後一列「開新聞卡｜系列 X、Y（連系列頁，不列本頁的系列）｜分類 ▾」（分類不重列頁面已寫的議題；議題連到議題頁）；抓不到只在那一列顯示一行錯誤，收起再點開重抓。不展開的 `link()`（暫時頁）：同樣的上方小字與更新句，標題連新聞卡頁（觸控時整列可點），下接一句話（不截斷）。
- 新聞卡頁（card.js；樣式摘要第 6 節）：由上而下——特殊狀態（有才顯示，標題上方一行框線說明：已封存「已封存（M/D）：之後的發展看議題〈…〉」，封存日＝新增加 7 天、寫入時就封存的用新增那天；重複「這件事已併入另一張新聞卡：〈X 的標題〉」；網路討論「網路討論，未經媒體證實」）→ 系列（領域色、連系列頁，取輕量條目的 `series`）・事件時間（`event_at`，M/D（週）HH:MM）→ 標題 → 跳轉標籤（有補充時「更新 ↓」到最新一段補充；「N 家報導 ↓」到來源，家數 `heat.outlets` 只在這裡出現，0 家寫「來源 ↓」；是按鈕不是 # 錨點，網址的 # 是編號）→ 摘要（不顯示一句話）→ 補充段落（左側色線＋「更新 M/D HH:MM」；更正紅線＋「更正 M/D HH:MM」；改過標題的那段附「原標題：…」；原文不改）→ AI 解讀 → 領域欄位 → 議題區塊 → 來源 → 分類 → 頁尾編號（等寬字）。議題區塊：「議題　〈名稱〉」＋「看整個議題 →」，依事件時間列同議題的卡（日期＋標題連該卡，這張寫「這張」），只列這張前後各 2 張；層級取最具體那層、那層只有這張就往上、到頂都只有這張不放（議題名留在分類）；兩個不相干的議題各一塊；標重複的卡不放；各卡標題與時間依編號讀週索引（只讀這張前後幾張所在的週）。來源：標題列「來源　N 個地區」，先列 5 家（媒體名、官方／社群／彙整類型、地區、時刻〔跟事件不同天加日期〕、↗），其餘收進 `<details>`「顯示其餘 N 家」（同一家多篇時寫「則」）。分類不重列頁上已有的系列名、議題、來源媒體。外部連結只收 http(s)；編號不對或檔案不存在顯示「找不到這張新聞卡」；`hashchange` 換卡。
- 系列頁（series.js；樣式摘要第 7 節）：讀 `cards/recent.json`，列近 7 天（台北日曆日：今天往回 6 天）這個系列的新聞卡，依天分段、新到舊；段標題「今天 11/25（三）」「昨天 11/24（二）」，再往前「11/23（一）」，黏在工具列下方，右邊張數。報頭＝系列短名＋「近 7 天・N 張」（沒有卡只寫「近 7 天」）；收錄條件一句白話放頁尾。卡放事件時間（`event_at`）那天；補充過的移到最後補充（`supplemented_at`）那天，上方小字的時間改寫「新增 M/D」，標題下是 rows.js 的更新句（最後一段 log；最後一段是更正時是更正句）；更正、掛來源不移。上方小字時間寫 HH:MM、家數 `heat.outlets`，左緣色線用這頁的領域色。同一天內：事件分量（高→中→低→沒標）→ `heat_rank` 小的在前 → 時間新到舊（移過的卡用補充時間）；每張一樣，沒有頭條樣式（淡底、大字、一句話預覽都不用；使用者定案）。資安：頂端「要修補的漏洞」收近 7 天事件類型含漏洞揭露的卡，依急迫性 → 同上，時間寫 M/D HH:MM，`exploited` 標紅底「遭利用」，列過的不再進日段。鄉民：每天再分 PTT、HN、V2EX 三區（區名旁張數），各依該平台社群熱度高到低、只列 > 0，上方小字加該平台熱度（「85 推」「641 分」「30 回覆」）；三平台都 0 的卡整頁不列。財經（新聞統一改版設計 §6.1）：每天再分上「台灣」（輕量條目 `taiwan` 是「直接」）、下「國際」兩區（區名旁張數），各依同一天內的順序排；兩區都全部直接列出，國際區不收合（舊的「再看 N 張」已拿掉，使用者定案）。遊戲產業：同一天內主題含網頁遊戲的排前面。GitHub、論文、深度閱讀三頁依卡的形式收（`series` 由 card_index 算好）。沒有卡：「近 7 天沒有符合的新聞卡。」＋其他系列的連結（同系列面板）。`&d=` 見〈網址〉（焦點移到那段標題）。回前景重抓，台北日期或 `built_at` 變了才重畫（展開中的列保持展開）。
- 議題頁（story.js；樣式摘要第 8 節）：`story-index` 找議題（舊名稱先照 `stories.json` 換成新名稱；新名稱不在索引就照原名找；都沒有顯示「找不到這個議題」與看議題目錄、回本日焦點）。報頭：有上層時標題上方一行「上層名 ›」連回上層；大標題＝議題名；下一行狀態標籤（進行中主色底、沉寂與歸檔灰框）＋「N 張・M/D 起」（有子議題的卡時寫「N 張（含子議題）」；沉寂加「7 天沒有新卡」、歸檔加「90 天以上沒有新卡」）；子議題（兩張以上的）列「子議題　名稱（張數）」；兩張以上時放「跳到最新 ↓」按鈕（捲到最新一張、焦點移到它的標題列；網址的 # 是議題名，不用錨點）。時間軸依事件時間舊到新：左側直線、每張一個方點（最新實心；地圖、一般外觀為圓點），條目是 rows.js 列表列（不用領域色線、上方小字不列系列，時間寫 M/D（週）HH:MM・N 家）；相鄰兩張相隔 7 天以上（台北日曆日）插「⋯ N 天沒有新卡」。上層議題頁收子議題的卡（`story-index` 已列進上層），在時間後標子議題名（虛線框；只有一張卡的子議題也標）。各卡的輕量條目依編號讀週索引（每份只讀一次），讀不到、標重複的不列。
- 議題目錄（story.js，`story.html` 不帶 hash；樣式摘要第 9 節）：大標題「議題」，下方系列篩選標籤（同本日焦點的 `.fp-fq` 元件，手機功能鈕的過濾面板照樣代按；議題的 `series` 有任一個選到就留下；存 `air-story-types`）。三區進行中、沉寂（「・7–90 天沒有新卡」）、歸檔（「・90 天以上沒有新卡」），區標題寫個數（篩選後改成看得到的數，沒有就整區藏），各區依 `latest` 的事件時間新到舊。只有一張卡的議題（`count` < 2）不列，子議題也一樣。進行中的上層議題兩行（名稱、張數・最新 M/D；第二行灰字最新一張的標題），其餘一行；子議題（目錄裡有的）縮排在上層底下、不論自己的狀態，跟所在區不同時加狀態。歸檔依最新一張的月份收進 `<details>`（預設收合）。觸控時整列可點。頁尾一句說明只列兩張以上。
- 暫時頁（adhoc.js；樣式摘要第 10 節）：不進任何選單、面板或目錄。報頭：大標題＝`title`、「臨時查詢・M/D HH:MM 查詢・N 張」、灰底說明列。清單依事件時間分天（新到舊，段標題同系列頁、黏在工具列下方），同一天內依重要程度（`byImportance`）；每張是 rows.js 的 `link()`：上方小字「系列・HH:MM」、標題連新聞卡頁、一句話；不在頁內展開；不標 `op`，只照卡的 `last_update` 標更新。缺事件時間的（舊資料）依編號讀週索引補，再找不到接在最後「時間不明」。代號不合法、檔案 404、`slug` 對不上：「這份臨時查詢已刪除或不存在；裡面的新聞卡照樣能從本日焦點、系列頁、議題頁找到」＋回本日焦點。議題名、暫時頁代號從網址來，一律當純文字。
- 找不到這個系列（report.js）：`?t=` 不在 `index.json` 的系列裡時，報頭小字「系列」＋大標題「找不到這個系列」，一段說明（網址裡的代號當純文字、最多 40 字）與回本日焦點；不轉址。樣式借施工中頁的 `.wip-*`。
- 施工中頁：系列頁只在 series.js 沒載到時由 report.js 顯示（`.wip-*`）。
- 外觀「一般」：本日焦點（列表列）只靠 look-standard.css，單欄清單、不用領域色；系列頁同樣單欄（段標題、漏洞區、平台區的一般外觀在 series.css）；議題頁、議題目錄、暫時頁同樣單欄，一般外觀的規則在 story.css、adhoc.css。

## 新增類別

1. 類別代號：小寫英數與 `-`，定了不改；`assets`、`archive`、`index`、`front`、`cards`、`adhoc`、`weekly` 是保留字（新聞系列代號同樣不能用）。
2. 建 `<代號>/index.html`、`<代號>/index.json`（`series` 系列設定＋`items`；`items` 每筆要有 `series`、`series_title`、`period`、`cadence`、`title`、`count`、`lede`；首頁連到 `<代號>/?t=<series>&d=<period>`）；每個系列一份 `<代號>/<series>/index.json` 全期別清單。新聞類別例外：`news/index.json` 只有 `series`、不用 `items`，首頁靠 `catalog.json` 的 `focus` 只列本日焦點。
3. `catalog.json` 的 `categories` 加一筆，首頁就會列出。
4. 產出工具只寫自己的目錄，遵守上傳邊界。
