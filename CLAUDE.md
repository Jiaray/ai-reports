# CLAUDE.md

本檔提供 Claude Code（claude.ai/code）在此 repo 工作時的指引。

## 這個 repo 是什麼

公開的靜態網站，用 GitHub Pages 發布：<https://jiaray.github.io/ai-reports/>。只放 AI 產生、**可以公開**的資訊。

這是 **public repo**：commit 進來的每個檔案、每則 commit 訊息與完整歷史都公開在網路上；刪檔只刪掉最新版，歷史裡永遠還在。頁面加了 `noindex`，那只是請搜尋引擎不要收錄，不是存取控制：拿到網址的人都看得到。

## 上傳邊界（commit／push 前逐條確認）

### 可以上傳

- `news/` 底下由 news-aggregator `scripts/publish.py` 產生的檔案：`news/<系列>/<年>/<期別>.json` 與同名 `.html`、`news/index.json`、`news/archive/<年>.json`。
- 網站本身：`index.html`、`404.html`、`catalog.json`、`assets/`、`news/index.html`、`news/assets/`，以及日後新類別的同類檔案。
- 本 repo 的 `README.md`、`CLAUDE.md`、`.gitignore`、`.nojekyll`。

### 禁止上傳（檔案內容、檔名、路徑、commit 訊息都算）

- 公司與工作相關資訊，例如：
  - Datadog 的 log、metric、trace、監控數據與截圖，以及依這些資料寫的分析
  - 遊戲名稱、遊戲編號（含專案代號、內部代碼）、版本與上線排程
  - 成員資料：姓名、暱稱、帳號、Telegram ID、出勤與請假、聯絡方式、組織與職務
  - 內部系統的網址、主機名、IP、repo 名稱與路徑，GitLab／Jira／Confluence 的內容
  - 規格書、需求單、程式碼、營運與營收數據、事故與資安事件分析
- 任何憑證：token、金鑰、密碼、cookie、`.env`、`~/.config` 底下的內容。
- `~/Documents/ai-reports/` 裡的既有報告與工作檔：多半是公司內部內容，不得複製或搬進來。
- 狀態檔與中間檔：抓下來的原始 JSON、log、草稿 markdown、跨日記憶（一律放在 repo 外）。

### 判斷原則

- 只有「來源本來就公開，整理後也不涉及公司內部或個人資料」的內容可以進來。
- 新聞報告剛好報到使用者任職的公司或產品（公開新聞）可以照實寫，但不得加上任何內部資訊或內部觀點。
- 拿不準就不上傳，先問使用者。

## Git 操作範圍

本專案允許模型執行 `git add`（限指名路徑，不得用 `-A`、`.` 或萬用字元）、`git commit`、`git push`；force push、rebase 或 amend 已推送的 commit、刪分支等改寫既有歷史的動作，以及更改 repo 設定，都不在範圍內。此宣告要與使用者全域 CLAUDE.md 的專案豁免清單同時成立才生效。

- 報告一律用 `publish.py --push` 發布：它只 add／commit 自己產生的報告檔與索引，路徑不在允許清單就拒絕，也不會把其他已 stage 的檔案帶進 commit。
- 手動 commit（改網站本身時）：commit 前跑 `git diff --cached --name-only`，確認清單全在「可以上傳」範圍內；commit 訊息用繁體中文的 Conventional Commits。
- push 被拒（遠端有新 commit）：先 `git pull --rebase` 再推，不要 force。
- 誤推了禁止內容：立刻停手，告訴使用者推了什麼、在哪個 commit。不要自行改寫歷史；要不要清除由使用者決定，而且已推送的內容要視同已外洩。

## 架構

```
ai-reports/
├── index.html、assets/home.js    首頁：讀 catalog.json，列出各類別與最新內容
├── catalog.json                  類別清單與網站網址（publish.py 用 base_url 組出公開網址）
├── 404.html、.nojekyll、.gitignore
├── assets/site.css、site.js      全站設計代幣、深淺色切換、共用小工具
└── news/
    ├── index.html                新聞總覽：系列篩選、搜尋、依日期分組
    ├── index.json                系列定義＋最近 200 份
    ├── archive/<年>.json         該年完整清單
    ├── assets/                   report.css、report.js（報告渲染器）、news-index.js
    └── <系列>/<年>/<期別>.json   報告資料（schema 1）
        <系列>/<年>/<期別>.html   頁面殼：OG meta（Telegram 預覽）＋免 JS 精簡版，載入 report.js 渲染 JSON
```

- 期別：日報 `YYYY-MM-DD`、週報 `YYYY-Www`（ISO 週）、月報 `YYYY-MM`。同系列同期別重新發布會覆蓋同一個網址。
- 網址傳出去之後，就不要改路徑規則、系列代號或 repo 名稱，否則舊連結全部失效。
- 改 `news/assets/report.js` 會影響所有既有報告的呈現。資料帶 `schema` 版本，改資料格式時渲染器要能讀舊版本。
- 連結一律用相對路徑（網站掛在 `/ai-reports/` 子路徑下）；`404.html` 例外，用 `/ai-reports/` 開頭的絕對路徑。

## 新增一個類別

1. 選類別代號：小寫英數與 `-`，定了就不改；`assets`、`archive`、`index` 是保留字。
2. 建 `<代號>/index.html` 與 `<代號>/index.json`，欄位比照 `news/index.json`（`items` 每筆要有 `path`、`period`、`cadence`、`title`、`count`、`lede`）。
3. 在 `catalog.json` 的 `categories` 加一筆，首頁就會列出。
4. 產出工具只寫自己的目錄，並遵守上面的上傳邊界。
