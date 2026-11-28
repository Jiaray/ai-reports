# 新聞來源清單

news-aggregator 每一輪抓什麼都照這份清單（程式：news-aggregator 的 `source_list.py`，格式與規則見它的檔頭）。一列是一個抓取單位：一個來源的一個查詢（同一個 feed，或同一組關鍵字查詢）。

- 區：主線的列放「共用」或「領域：…」，由程式依「系列」欄排（系列跨兩個以上領域放共用）；「板凳」距上次抓滿 7 天才抓；「待檢」是新發現、還沒通過檢查的來源（不抓）；「停用」不抓。主線連續 14 輪沒有收錄會移到板凳，板凳那次有收錄就回主線；釘選的永遠留在主線。
- 抓法：`rss`、`newsletter` 依網址抓（newsletter 把一期拆成每則）；其他是程式裡的專用抓法，網址要和程式一致；`pool` 是國際媒體池的 feed（代號 `pool_<媒體 key>`）。
- 查詢＝關鍵字（逗號分隔，空白＝全收）；則數＝每輪最多抓幾則；正文＝要不要抓全文；區塊＝候選池裡的分組；形式＝新聞、長文、播客、論文、開源專案；系列＝逗號分隔的系列代號；最近收錄＝最近一次有素材被收錄的日期。
- 每輪抓之前，程式會檢查清單和程式對不對得上；對不上的那列這輪不抓，記進待裁決。收集時間與收錄統計在同資料夾的 `sources-stats.json`。

## 共用

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cna_politics | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/politics |  | 15 | 是 | headlines | 新聞 | zh-TW | taiwan_general,politics |  | 2026-11-25 | 2026-11-28 | 中央社政治分類 |
| cna_social | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/social |  | 15 | 是 | headlines | 新聞 | zh-TW | taiwan_general,society |  | 2026-11-25 | 2026-11-28 | 中央社社會分類 |
| cna_intworld | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/intworld |  | 15 | 是 | headlines | 新聞 | zh-TW | taiwan_general,politics |  | 2026-11-25 | 2026-11-28 | 中央社國際分類 |
| pts | 公視新聞網 | rss | https://news.pts.org.tw/xml/newsfeed.xml |  | 15 | 是 | headlines | 新聞 | zh-TW | taiwan_general,society,cross_strait |  | 2026-11-25 | 2026-11-28 | 全站 feed（沒有分類 feed） |
| cna_health | 中央社 健康 | rss | https://feeds.feedburner.com/rsscna/lifehealth |  | 30 | 是 | health_news | 新聞 | zh-TW | health,life |  | 2026-11-25 | 2026-11-27 | 中央社生活分類（生活、健康、文化混合） |
| pool_bbc_top | BBC Top News | pool | https://feeds.bbci.co.uk/news/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_bbc_world | BBC World | pool | https://feeds.bbci.co.uk/news/world/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_bbc_chinese | BBC 中文 | pool | https://feeds.bbci.co.uk/zhongwen/trad/rss.xml |  | 30 | 否 | international_pool | 新聞 | zh-TW | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_guardian_world | The Guardian World | pool | https://www.theguardian.com/world/rss |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_aljazeera | Al Jazeera | pool | https://www.aljazeera.com/xml/rss/all.xml |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_france24 | France 24 | pool | https://www.france24.com/en/rss |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_un_news | UN News | pool | https://news.un.org/feed/subscribe/en/news/all/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | society,politics |  | 2026-11-25 | 2026-11-26 | 時間只有日期 |
| pool_dw_news | DW News | pool | https://rss.dw.com/xml/rss-en-all |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_euronews | Euronews | pool | https://www.euronews.com/rss?format=xml |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_wsj | WSJ | pool | https://feeds.content.dowjones.io/public/rss/RSSUSnews |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait,finance |  | 2026-11-25 | 2026-11-28 |  |
| pool_dawn | Dawn | pool | https://www.dawn.com/feeds/home/ |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_rappler | Rappler | pool | https://www.rappler.com/feed/ |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-27 |  |
| pool_premium_times | Premium Times | pool | https://www.premiumtimesng.com/feed |  | 10 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 |  | 則數 30→10（2026-11-26 第一次全收 15 則收 0） |
| pool_rfi_africa | RFI Africa | pool | https://www.rfi.fr/en/africa/rss |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 |  |  |
| pool_mexico_news_daily | Mexico News Daily | pool | https://mexiconewsdaily.com/feed/ |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 |  |  |
| pool_hrw | Human Rights Watch | pool | https://www.hrw.org/rss/news |  | 30 | 否 | international_pool | 新聞 | en | society,politics |  | 2026-11-25 |  |  |
| pool_nikkei_asia | Nikkei Asia | pool | https://asia.nikkei.com/rss/feed/nar |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_scmp_china | SCMP China | pool | https://www.scmp.com/rss/4/feed |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-27 |  |
| pool_the_diplomat | The Diplomat | pool | https://thediplomat.com/feed/ |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_japan_times | Japan Times | pool | https://www.japantimes.co.jp/feed/ |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-27 |  |
| pool_straits_times_asia | Straits Times Asia | pool | https://www.straitstimes.com/news/asia/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 |  |
| pool_reuters | Reuters (Google News fallback) | pool | https://news.google.com/rss/search?q=site%3Areuters.com%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen |  | 30 | 否 | international_pool | 新聞 | en | politics,society,cross_strait |  | 2026-11-25 | 2026-11-28 | Google News 的 site:reuters.com 檢索，只有標題 |
| nature | Nature | rss | https://www.nature.com/nature.rss |  | 15 | 是 | papers | 論文 | en | papers,science |  | 2026-11-26 | 2026-11-27 | 研究與新聞混合；時間只有日期 |
| quanta | Quanta Magazine | rss | https://www.quantamagazine.org/feed/ |  | 5 | 是 | science_news | 長文 | en | science,reading |  | 2026-11-26 |  | 數學、物理、生物科普長文 |
| ustr | USTR | rss | https://ustr.gov/rss.xml |  | 5 | 是 | policy_official | 新聞 | en | finance,politics |  | 2026-11-26 | 2026-11-26 | 美國貿易代表署：關稅、貿易協定 |
| bis_export | BIS 出口管制 | rss | https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=industry-and-security-bureau |  | 5 | 是 | policy_official | 新聞 | en | finance,tech | 是 | 2026-11-26 |  | 聯邦公報上的 BIS 規則與公告；量少，釘選 |
| ap_gnews | AP (Google News fallback) | rss | https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en |  | 30 | 否 | headlines | 新聞 | en | politics,society |  | 2026-11-26 | 2026-11-28 | Google News 的 site:apnews.com 檢索，只有標題 |
| axios | Axios | rss | https://api.axios.com/feed/ |  | 15 | 是 | politics_news | 新聞 | en | politics,finance |  | 2026-11-26 | 2026-11-27 |  |
| nyt_asia | NYT Asia Pacific | rss | https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml |  | 15 | 否 | politics_news | 新聞 | en | politics,cross_strait |  | 2026-11-26 | 2026-11-27 | 付費牆，只有標題與摘要 |
| cna_local | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/local |  | 15 | 是 | society_news | 新聞 | zh-TW | society,taiwan_general |  | 2026-11-26 | 2026-11-27 | 中央社地方分類 |
| propublica | ProPublica | rss | https://www.propublica.org/feeds/propublica/main |  | 5 | 是 | society_news | 新聞 | en | society,reading |  | 2026-11-26 | 2026-11-26 | 調查報導 |
| npr_news | NPR News | rss | https://feeds.npr.org/1001/rss.xml |  | 10 | 是 | headlines | 新聞 | en | politics,society |  | 2026-11-26 | 2026-11-27 | NPR 新聞總覽；feed 只留 10 則 |
| solidot | Solidot | rss | https://www.solidot.org/index.rss |  | 15 | 是 | tech_media | 新聞 | zh-CN | tech,science |  | 2026-11-26 | 2026-11-28 | 中文版 Slashdot，短訊 |
| tmtpost | 鈦媒體 | rss | https://www.tmtpost.com/rss.xml |  | 15 | 是 | tech_media | 新聞 | zh-CN | tech,finance |  | 2026-11-26 | 2026-11-27 | 中國科技商業；feed 帶全文 |
| kr36 | 36氪 | rss | https://feed.quanwenrss.com/feed/36kr-latest.xml |  | 15 | 是 | tech_media | 新聞 | zh-CN | tech,finance |  | 2026-11-26 | 2026-11-28 | quanwenrss 代理（原站 feed 沒有時間）；每則連回 36kr.com |
| malwarebytes | Malwarebytes Labs | rss | https://www.malwarebytes.com/blog/feed/index.xml |  | 5 | 是 | security_news | 新聞 | en | security,life |  | 2026-11-26 | 2026-11-28 | 詐騙與消費者資安 |
| sspai | 少数派 | rss | https://sspai.com/feed |  | 5 | 是 | life_news | 新聞 | zh-CN | life,tech |  | 2026-11-26 |  | App 與效率工具 |
| time_mag | TIME | rss | https://time.com/feed/ |  | 10 | 是 | politics_news | 新聞 | en | politics,reading |  | 2026-11-26 | 2026-11-27 | feed 帶全文 |
| new_sciencealert_com | ScienceAlert | rss | https://www.sciencealert.com/feed/gn/ |  | 10 | 是 | discovered | 新聞 | en-US | tech,science |  | 2026-11-26 |  | 2026-11-26 自動進主線；網站 https://www.sciencealert.com |
| new_nypost_com | New York Post | rss | https://nypost.com/feed/ |  | 10 | 是 | discovered | 新聞 | en-US | social,cross_strait,politics,finance,tech |  | 2026-11-26 | 2026-11-27 | 2026-11-27 自動進主線；網站 https://nypost.com |

## 領域：台灣

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mygopen | MyGoPen | rss | https://www.mygopen.com/feeds/posts/default/?max-results=40 |  | 20 | 是 | fact_checks | 新聞 | zh-TW | taiwan_general |  | 2026-11-25 | 2026-11-27 |  |
| tfc | 台灣事實查核中心 | rss | https://tfc-taiwan.org.tw/fact-check-reports/feed/ |  | 20 | 是 | fact_checks | 新聞 | zh-TW | taiwan_general |  | 2026-11-25 | 2026-11-27 |  |
| ptt_news | PTT 時事看板 | ptt_news | https://www.ptt.cc |  | 15 | 否 | ptt_pulse | 新聞 | zh-TW | taiwan_general,social |  | 2026-11-25 | 2026-11-27 | 八卦、政黑板的 [新聞]／[爆卦] 主文，只有標題與推文數 |
| ncdr_alerts | NCDR 示警 | ncdr_alerts | https://alerts.ncdr.nat.gov.tw/RssAtomFeeds.ashx |  | 20 | 否 | official_alerts | 新聞 | zh-TW | taiwan_general | 是 | 2026-11-25 | 2026-11-28 | 國家災害防救科技中心官方示警 |
| cna_disaster | 中央社 CNA | cna | https://www.cna.com.tw | 地震,颱風,豪雨,洪水,災害,停班,停課,撤離,土石流 | 15 | 是 | coverage | 新聞 | zh-TW | taiwan_general |  | 2026-11-25 | 2026-11-26 | 中央社政治、社會、國際三個 feed 的災害關鍵字 |
| pts_disaster | 公視新聞網 | rss | https://news.pts.org.tw/xml/newsfeed.xml | 地震,颱風,豪雨,洪水,災害,停班,停課,撤離,土石流 | 15 | 是 | coverage | 新聞 | zh-TW | taiwan_general |  | 2026-11-25 |  | 公視的災害關鍵字 |
| ptt_hot | PTT 全站熱門 | ptt | https://www.ptt.cc/bbs/hotboards.html |  | 40 | 否 | ptt_hot | 新聞 | zh-TW | social |  | 2026-11-25 | 2026-11-28 | 熱門板前 6 板第一頁 |
| v2ex | V2EX | v2ex | https://www.v2ex.com/api/topics/hot.json |  | 30 | 是 | v2ex_hot | 新聞 | zh-CN | social |  | 2026-11-25 |  |  |
| cna_mainland | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/mainland |  | 15 | 是 | cross_strait_news | 新聞 | zh-TW | cross_strait |  | 2026-11-25 | 2026-11-27 | 中央社兩岸分類 |
| guardian_china | The Guardian China | rss | https://www.theguardian.com/world/china/rss |  | 20 | 是 | cross_strait_news | 新聞 | en | cross_strait |  | 2026-11-25 | 2026-11-27 |  |
| nyt_cn | 紐約時報中文網 | rss | https://cn.nytimes.com/rss/ |  | 15 | 是 | cross_strait_news | 新聞 | zh-CN | cross_strait |  | 2026-11-26 | 2026-11-27 | 部分付費 |
| rfi_cn | RFI 中文 | rss | https://www.rfi.fr/cn/rss |  | 20 | 是 | cross_strait_news | 新聞 | zh-CN | cross_strait |  | 2026-11-26 | 2026-11-28 | 法廣中文，中國與港澳台 |
| dw_cn | DW 中文 | rss | https://rss.dw.com/rdf/rss-chi-all |  | 15 | 是 | cross_strait_news | 新聞 | zh-CN | cross_strait |  | 2026-11-26 | 2026-11-28 | 德國之聲中文 |

## 領域：政治

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| guardian_us_politics | The Guardian US politics | rss | https://www.theguardian.com/us-news/us-politics/rss |  | 20 | 是 | politics_news | 新聞 | en | politics |  | 2026-11-25 | 2026-11-28 |  |
| politico | Politico | rss | https://rss.politico.com/politics-news.xml |  | 15 | 是 | politics_news | 新聞 | en | politics |  | 2026-11-26 |  | 美國國會與白宮 |
| politico_eu | Politico Europe | rss | https://www.politico.eu/feed/ |  | 15 | 是 | politics_news | 新聞 | en | politics |  | 2026-11-26 | 2026-11-28 | 歐盟政治 |
| whitehouse | White House | rss | https://www.whitehouse.gov/news/feed/ |  | 10 | 是 | policy_official | 新聞 | en | politics |  | 2026-11-26 | 2026-11-26 | 行政命令與聲明 |
| wsj_world | WSJ World News | rss | https://feeds.content.dowjones.io/public/rss/RSSWorldNews |  | 15 | 否 | politics_news | 新聞 | en | politics |  | 2026-11-26 | 2026-11-28 | 付費牆，只有標題與摘要；美國新聞在國際媒體池 pool_wsj |

## 領域：社會

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| guardian_society | The Guardian Society | rss | https://www.theguardian.com/society/rss |  | 20 | 是 | society_news | 新聞 | en | society |  | 2026-11-25 | 2026-11-28 |  |
| pool_gdacs | GDACS | pool | https://www.gdacs.org/xml/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | society |  | 2026-11-25 |  | 橘、紅色災害警報 |
| pool_usgs | USGS | pool | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson |  | 30 | 否 | international_pool | 新聞 | en | society |  | 2026-11-25 |  | 24 小時內的顯著地震 |
| pew_research | Pew Research Center | rss | https://www.pewresearch.org/feed/ |  | 10 | 是 | society_news | 新聞 | en | society |  | 2026-11-26 |  | 民調與社會數據 |

## 領域：財經

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| twse_news | 臺灣證券交易所 OpenAPI | twse_news | https://openapi.twse.com.tw/v1/news/newsList |  | 20 | 否 | market_wire | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 結構化公告，只有日期 |
| udn_money_focus | 經濟日報 | rss | https://money.udn.com/rssfeed/news/1001/5590?ch=money |  | 20 | 是 | finance_coverage | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 財經要聞 |
| udn_money_industry | 經濟日報 | rss | https://money.udn.com/rssfeed/news/1001/5591?ch=money |  | 20 | 是 | finance_coverage | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 產業 |
| cnyes_headline | Anue 鉅亨網 | rss | https://news.cnyes.com/rss/v1/news/category/headline |  | 20 | 是 | finance_coverage | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 頭條 |
| cnyes_tw_stock | Anue 鉅亨網 | rss | https://news.cnyes.com/rss/v1/news/category/tw_stock |  | 20 | 是 | finance_coverage | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 台股 |
| cna_finance | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/finance |  | 15 | 是 | finance_coverage | 新聞 | zh-TW | finance |  | 2026-11-25 | 2026-11-28 | 中央社財經分類 |
| pool_bbc_business | BBC Business | pool | https://feeds.bbci.co.uk/news/business/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | finance |  | 2026-11-25 | 2026-11-27 |  |
| pool_cnbc | CNBC | pool | https://www.cnbc.com/id/100003114/device/rss/rss.html |  | 30 | 否 | international_pool | 新聞 | en | finance |  | 2026-11-25 | 2026-11-28 |  |
| pool_ft | Financial Times | pool | https://www.ft.com/rss/home |  | 30 | 否 | international_pool | 新聞 | en | finance |  | 2026-11-25 | 2026-11-28 |  |
| fed_monetary | 聯準會 | rss | https://www.federalreserve.gov/feeds/press_monetary.xml |  | 5 | 是 | policy_official | 新聞 | en | finance | 是 | 2026-11-26 |  | 貨幣政策新聞稿；量少，釘選 |
| bloomberg_markets | Bloomberg Markets | rss | https://www.bloomberg.com/feeds/markets/news.rss |  | 20 | 否 | finance_coverage | 新聞 | en | finance |  | 2026-11-26 | 2026-11-28 | 付費牆，只有標題與摘要 |
| fortune | Fortune | rss | https://fortune.com/feed/fortune-feeds/?id=3230629 |  | 10 | 是 | finance_coverage | 新聞 | en | finance |  | 2026-11-26 | 2026-11-28 | feed 帶全文 |
| cn21jingji | 21 世紀經濟報道 | rss | https://feed.quanwenrss.com/feed/21caijing-home.xml |  | 15 | 是 | finance_coverage | 新聞 | zh-CN | finance |  | 2026-11-26 | 2026-11-28 | quanwenrss 代理；每則連回 21jingji.com |

## 領域：科技

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aihot | AIHOT | rss | https://aihot.virxact.com/rss |  | 15 | 是 | ai_curated | 新聞 | zh-CN | ai |  | 2026-11-25 | 2026-11-27 |  |
| tldr_ai | TLDR AI | tldr_ai | https://tldr.tech/api/rss/ai |  | 15 | 是 | ai_curated | 新聞 | en | ai |  | 2026-11-25 | 2026-11-28 | 一期拆成每則（抓那期頁面） |
| import_ai | Import AI | rss | https://importai.substack.com/feed |  | 15 | 是 | ai_curated | 新聞 | en | ai |  | 2026-11-25 |  |  |
| latentspace_ainews | Latent Space AINews | latentspace_ainews | https://www.latent.space/feed |  | 15 | 是 | ai_curated | 新聞 | en | ai |  | 2026-11-25 | 2026-11-26 | 只收 [AINews] 每日彙整，拆成每則 |
| hn_ai | Hacker News | hackernews | https://news.ycombinator.com | AI,LLM,GPT,Claude,OpenAI,DeepSeek,Gemini,Agent | 15 | 是 | hn_ai | 新聞 | en | ai |  | 2026-11-25 | 2026-11-28 | 近 24 小時關鍵字搜尋（10 分以上） |
| nl_bensbites | Ben's Bites | newsletter | https://www.bensbites.com/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| nl_interconnects | Interconnects | newsletter | https://www.interconnects.ai/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| nl_oneusefulthing | One Useful Thing | newsletter | https://www.oneusefulthing.org/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| nl_chinai | ChinAI | newsletter | https://chinai.substack.com/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| nl_memia | Memia | newsletter | https://memia.substack.com/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 | 2026-11-26 | AI 電子報，每期拆成每則 |
| nl_ai2roi | AI to ROI | newsletter | https://ai2roi.substack.com/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| nl_kdnuggets | KDnuggets | newsletter | https://www.kdnuggets.com/feed |  | 3 | 是 | newsletter_picks | 新聞 | en | ai |  | 2026-11-25 |  | AI 電子報，每期拆成每則 |
| huggingface | HF Papers | huggingface | https://huggingface.co/api/daily_papers |  | 20 | 是 | huggingface_papers | 論文 | en | papers |  | 2026-11-25 | 2026-11-27 | Hugging Face Daily Papers，依票數 |
| hn_front | Hacker News | hackernews | https://news.ycombinator.com |  | 20 | 是 | hn_front | 新聞 | en | tech |  | 2026-11-25 | 2026-11-28 | 首頁 |
| arstechnica | Ars Technica | rss | https://feeds.arstechnica.com/arstechnica/index |  | 20 | 是 | tech_media | 新聞 | en | tech |  | 2026-11-25 | 2026-11-28 |  |
| theverge | The Verge | rss | https://www.theverge.com/rss/index.xml |  | 20 | 是 | tech_media | 新聞 | en | tech |  | 2026-11-25 | 2026-11-28 |  |
| technews_tw | 科技新報 | rss | https://technews.tw/feed/ |  | 20 | 是 | tech_media | 新聞 | zh-TW | tech |  | 2026-11-25 | 2026-11-28 |  |
| icsda | ICSDA 資安日報 | icsda | https://icsda.org.tw |  | 20 | 是 | icsda_digest | 新聞 | zh-TW | security |  | 2026-11-25 | 2026-11-28 | 主來源：最新一篇的今日新聞速覽 |
| bleepingcomputer | BleepingComputer | rss | https://www.bleepingcomputer.com/feed/ |  | 30 | 是 | security_news | 新聞 | en | security |  | 2026-11-25 | 2026-11-28 |  |
| thehackernews | The Hacker News | rss | https://feeds.feedburner.com/TheHackersNews |  | 30 | 是 | security_news | 新聞 | en | security |  | 2026-11-25 | 2026-11-28 |  |
| krebs | Krebs on Security | rss | https://krebsonsecurity.com/feed/ |  | 30 | 是 | security_news | 新聞 | en | security |  | 2026-11-25 |  |  |
| ithome_security | iThome 資安 | rss | https://www.ithome.com.tw/rss | 資安,漏洞,駭客,勒索,惡意,釣魚,外洩,零時差,後門,CVE | 30 | 是 | security_news | 新聞 | zh-TW | security |  | 2026-11-25 | 2026-11-27 | 全站 feed 用資安關鍵字篩 |
| hn_security | Hacker News | hackernews | https://news.ycombinator.com | security,vulnerability,CVE,exploit,ransomware,malware,breach,zero-day | 15 | 是 | community | 新聞 | en | security |  | 2026-11-25 | 2026-11-28 | 近 24 小時關鍵字搜尋 |
| lobsters_security | Lobsters | lobsters_security | https://lobste.rs/hottest.json |  | 10 | 是 | community | 新聞 | en | security |  | 2026-11-25 | 2026-11-26 | hottest 裡帶 security 標籤的 |
| github_trending | GitHub Trending | github | https://github.com/trending |  | 25 | 是 | github_trending | 開源專案 | en | github |  | 2026-11-25 | 2026-11-26 | 日榜全收 |
| pool_bbc_technology | BBC Technology | pool | https://feeds.bbci.co.uk/news/technology/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | tech |  | 2026-11-25 | 2026-11-26 |  |
| pool_guardian_technology | The Guardian Technology | pool | https://www.theguardian.com/uk/technology/rss |  | 30 | 否 | international_pool | 新聞 | en | tech |  | 2026-11-25 | 2026-11-28 |  |
| openai_news | OpenAI News | rss | https://openai.com/news/rss.xml |  | 10 | 是 | ai_official | 新聞 | en | ai |  | 2026-11-26 |  | 官方公告 |
| deepmind_blog | Google DeepMind | rss | https://deepmind.google/blog/rss.xml |  | 5 | 是 | ai_official | 新聞 | en | ai |  | 2026-11-26 |  | 官方研究與模型發布 |
| google_ai_blog | Google AI Blog | rss | https://blog.google/innovation-and-ai/technology/ai/rss/ |  | 5 | 是 | ai_official | 新聞 | en | ai |  | 2026-11-26 |  | The Keyword 的 AI 專區 |
| hf_blog | Hugging Face Blog | rss | https://huggingface.co/blog/feed.xml |  | 5 | 是 | ai_official | 新聞 | en | ai |  | 2026-11-26 |  | feed 只有標題 |
| simon_willison | Simon Willison | rss | https://simonwillison.net/atom/everything/ |  | 10 | 是 | ai_curated | 新聞 | en | ai |  | 2026-11-26 | 2026-11-26 | 個人部落格，LLM 工具實測 |
| mit_tech_review | MIT Technology Review | rss | https://www.technologyreview.com/feed/ |  | 10 | 是 | tech_media | 新聞 | en | ai,tech |  | 2026-11-26 |  | 部分付費 |
| techmeme | Techmeme | rss | https://www.techmeme.com/feed.xml |  | 15 | 否 | tech_curated | 新聞 | en | tech |  | 2026-11-26 | 2026-11-28 | 編輯挑的當日要聞；每則連到 Techmeme 頁，原文連結在摘要裡 |
| techcrunch | TechCrunch | rss | https://techcrunch.com/feed/ |  | 20 | 是 | tech_media | 新聞 | en | tech,ai |  | 2026-11-26 | 2026-11-27 | 新創、募資、AI 產品 |
| media404 | 404 Media | rss | https://www.404media.co/rss/ |  | 10 | 是 | tech_media | 新聞 | en | tech |  | 2026-11-26 | 2026-11-26 | 獨立調查報導，部分付費 |
| cloudflare_blog | Cloudflare Blog | rss | https://blog.cloudflare.com/rss/ |  | 5 | 是 | tech_media | 新聞 | en | tech,security |  | 2026-11-26 |  | 網路基礎設施與事故檢討 |
| cna_tech | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/technology |  | 15 | 是 | tech_media | 新聞 | zh-TW | tech |  | 2026-11-26 | 2026-11-27 | 中央社科技分類 |
| cisa_advisories | CISA | rss | https://www.cisa.gov/cybersecurity-advisories/all.xml |  | 10 | 是 | security_advisories | 新聞 | en | security |  | 2026-11-26 | 2026-11-28 | 美國官方漏洞與攻擊公告（含工控） |
| sans_isc | SANS ISC | rss | https://isc.sans.edu/rssfeed.xml |  | 5 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 |  | 每日威脅觀察；feed 只有標題 |
| the_record | The Record | rss | https://therecord.media/feed |  | 10 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 | 2026-11-28 | 國家級攻擊與資安政策 |
| schneier | Schneier on Security | rss | https://www.schneier.com/blog/atom.xml |  | 5 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 |  | 個人部落格；文章頁抽到的是讀者留言，程式不抓頁面、改用 feed 內文（fetch_news.FEED_ONLY_URL） |
| cisco_talos | Cisco Talos | rss | https://blog.talosintelligence.com/rss/ |  | 5 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 | 2026-11-26 | 威脅情資研究 |
| the_register | The Register | rss | https://www.theregister.com/headlines.atom |  | 15 | 是 | tech_media | 新聞 | en | tech,security |  | 2026-11-26 | 2026-11-27 | 企業 IT、雲端與資安；feed 帶全文 |
| slashdot | Slashdot | rss | https://rss.slashdot.org/Slashdot/slashdotMain |  | 10 | 是 | tech_media | 新聞 | en | tech |  | 2026-11-26 | 2026-11-28 | 社群投稿、編輯摘要；每則連到 Slashdot 討論頁 |
| macrumors | MacRumors | rss | https://feeds.macrumors.com/MacRumors-All |  | 10 | 是 | tech_media | 新聞 | en | tech |  | 2026-11-26 | 2026-11-28 | Apple 消息 |
| ithome_cn | IT 之家 | rss | https://www.ithome.com/rss/ |  | 20 | 是 | tech_media | 新聞 | zh-CN | tech |  | 2026-11-26 | 2026-11-28 | 中國科技新聞，一天 60 則以上 |
| cyberscoop | CyberScoop | rss | https://cyberscoop.com/feed/ |  | 10 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 | 2026-11-26 | 美國資安政策 |
| helpnetsecurity | Help Net Security | rss | https://www.helpnetsecurity.com/feed/ |  | 10 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 | 2026-11-28 |  |
| darkreading | Dark Reading | rss | https://www.darkreading.com/rss.xml |  | 10 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 | 2026-11-26 |  |
| securelist | Securelist | rss | https://securelist.com/feed/ |  | 5 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 |  | 卡巴斯基威脅研究 |
| checkpoint_research | Check Point Research | rss | https://research.checkpoint.com/feed/ |  | 5 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 |  | 威脅研究 |
| project_zero | Google Project Zero | rss | https://projectzero.google/feed.xml |  | 3 | 是 | security_news | 新聞 | en | security |  | 2026-11-26 |  | 漏洞研究，量少 |
| cell | Cell | rss | https://www.cell.com/cell/current.rss |  | 5 | 否 | papers | 論文 | en | papers |  | 2026-11-26 |  | 每期目錄；文章頁擋抓取（403），用 feed 摘要 |
| arxiv_ai | arXiv | rss | https://rss.arxiv.org/rss/cs.ai+cs.LG |  | 20 | 是 | papers | 論文 | en | papers |  | 2026-11-26 | 2026-11-26 | cs.AI＋cs.LG 每日新論文，一天上百篇；沒有熱度排序 |
| new_computerbase_de | ComputerBase | rss | https://www.computerbase.de/rss/news.xml |  | 10 | 是 | discovered | 新聞 |  | tech |  | 2026-11-26 | 2026-11-28 | 2026-11-26 自動進主線；網站 https://www.computerbase.de |
| new_itpro_com | ITPro | rss | https://www.itpro.com/feeds.xml |  | 10 | 是 | discovered | 新聞 | en | tech |  | 2026-11-26 | 2026-11-27 | 2026-11-26 自動進主線；網站 https://www.itpro.com |
| new_defensenews_com | Defense News | rss | https://www.defensenews.com/feed/ |  | 10 | 是 | discovered | 新聞 | en-US | tech |  | 2026-11-26 | 2026-11-28 | 2026-11-27 自動進主線；網站 https://www.defensenews.com |

## 領域：科學健康

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pansci | 泛科學 | rss | https://pansci.asia/feed |  | 10 | 是 | science_news | 新聞 | zh-TW | science |  | 2026-11-25 |  |  |
| sciencenews | Science News | rss | https://www.sciencenews.org/feed |  | 20 | 是 | science_news | 新聞 | en | science |  | 2026-11-25 | 2026-11-26 |  |
| statnews | STAT News | rss | https://www.statnews.com/feed/ |  | 30 | 是 | health_news | 新聞 | en | health |  | 2026-11-25 | 2026-11-27 |  |
| medicalxpress | Medical Xpress | rss | https://medicalxpress.com/rss-feed/ |  | 10 | 是 | health_news | 新聞 | en | health |  | 2026-11-25 | 2026-11-28 | 則數 30→10（2026-11-26 第一次全收 30 則收 3、正文全抓不到） |
| sciencedaily_health | ScienceDaily Health | rss | https://www.sciencedaily.com/rss/health_medicine.xml |  | 30 | 是 | health_news | 新聞 | en | health |  | 2026-11-25 | 2026-11-27 |  |
| guardian_health | The Guardian Health | rss | https://www.theguardian.com/society/health/rss |  | 30 | 是 | health_news | 新聞 | en | health |  | 2026-11-25 | 2026-11-28 |  |
| npr_health | NPR Health | rss | https://feeds.npr.org/1128/rss.xml |  | 30 | 是 | health_news | 新聞 | en | health |  | 2026-11-25 | 2026-11-27 |  |
| mongabay | Mongabay | rss | https://news.mongabay.com/feed/ |  | 20 | 是 | environment_news | 新聞 | en | environment |  | 2026-11-25 | 2026-11-28 | 台灣端沒有固定更新的環境媒體 feed |
| pool_bbc_science | BBC Science & Environment | pool | https://feeds.bbci.co.uk/news/science_and_environment/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | science,environment |  | 2026-11-25 | 2026-11-28 |  |
| pool_bbc_health | BBC Health | pool | https://feeds.bbci.co.uk/news/health/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | health |  | 2026-11-25 | 2026-11-28 |  |
| pool_guardian_environment | The Guardian Environment | pool | https://www.theguardian.com/uk/environment/rss |  | 30 | 否 | international_pool | 新聞 | en | environment |  | 2026-11-25 | 2026-11-26 |  |
| pool_who | WHO | pool | https://www.who.int/rss-feeds/news-english.xml |  | 30 | 否 | international_pool | 新聞 | en | health |  | 2026-11-25 |  |  |
| nasa | NASA | rss | https://www.nasa.gov/news-release/feed/ |  | 10 | 是 | science_news | 新聞 | en | science |  | 2026-11-26 |  | 官方新聞稿 |
| sciam | Scientific American | rss | https://www.scientificamerican.com/platform/syndication/rss/ |  | 10 | 是 | science_news | 新聞 | en | science |  | 2026-11-26 | 2026-11-26 | 部分付費 |

## 領域：生活娛樂

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| guardian_lifeandstyle | The Guardian Life and style | rss | https://www.theguardian.com/lifeandstyle/rss |  | 8 | 是 | life_news | 新聞 | en | life |  | 2026-11-25 |  | 則數 20→8（2026-11-26 第一次全收 16 則收 0） |
| cna_culture | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/culture |  | 15 | 是 | culture_news | 新聞 | zh-TW | culture |  | 2026-11-25 | 2026-11-27 | 中央社文化分類 |
| guardian_culture | The Guardian Culture | rss | https://www.theguardian.com/culture/rss |  | 10 | 是 | culture_news | 新聞 | en | culture |  | 2026-11-25 | 2026-11-27 | 則數 20→10（2026-11-26 第一次全收 20 則收 2） |
| cna_stars | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/stars |  | 15 | 是 | entertainment_news | 新聞 | zh-TW | entertainment |  | 2026-11-25 | 2026-11-26 | 中央社影劇分類 |
| deadline | Deadline | rss | https://deadline.com/feed/ |  | 10 | 是 | entertainment_news | 新聞 | en | entertainment |  | 2026-11-25 | 2026-11-26 | 則數 20→10（2026-11-26 第一次全收 12 則收 2） |
| cna_sport | 中央社 CNA | rss | https://feeds.feedburner.com/rsscna/sport |  | 10 | 是 | sports_news | 新聞 | zh-TW | sports |  | 2026-11-25 | 2026-11-27 | 中央社運動分類；則數 15→10（2026-11-26 第一次全收 13 則收 2） |
| bbc_sport | BBC Sport | rss | https://feeds.bbci.co.uk/sport/rss.xml |  | 10 | 是 | sports_news | 新聞 | en | sports |  | 2026-11-25 | 2026-11-27 | 則數 20→10（2026-11-26 第一次全收 20 則收 2） |
| pool_bbc_arts | BBC Entertainment & Arts | pool | https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml |  | 30 | 否 | international_pool | 新聞 | en | culture |  | 2026-11-25 | 2026-11-27 |  |
| lifehacker | Lifehacker | rss | https://lifehacker.com/rss |  | 10 | 是 | life_news | 新聞 | en | life |  | 2026-11-26 |  | 實用技巧；feed 帶全文 |
| atlas_obscura | Atlas Obscura | rss | https://www.atlasobscura.com/feeds/latest |  | 5 | 是 | life_news | 新聞 | en | life,culture |  | 2026-11-26 |  | 旅行與冷知識 |

## 領域：遊戲產業

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gamesindustry | GamesIndustry.biz | rss | https://www.gamesindustry.biz/feed |  | 30 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-28 |  |
| pocketgamerbiz | PocketGamer.biz | rss | https://www.pocketgamer.biz/index.rss |  | 30 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-28 |  |
| mobilegamer | Mobilegamer.biz | rss | https://mobilegamer.biz/feed/ |  | 30 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-26 |  |
| gamesbeat | GamesBeat | rss | https://gamesbeat.com/feed/ |  | 30 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-28 |  |
| 80lv | 80 Level | rss | https://80.lv/feed |  | 30 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-27 |  |
| cocos_forum | Cocos 中文社區 | cocos_forum | https://forum.cocos.org |  | 60 | 是 | cocos_forum | 新聞 | zh-CN | game_dev |  | 2026-11-25 | 2026-11-28 | 近 7 天新帖，正文是首帖與前 19 則回覆 |
| pixijs | PixiJS Releases | rss | https://github.com/pixijs/pixijs/releases.atom |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 |  |  |
| babylonjs | Babylon.js Releases | rss | https://github.com/BabylonJS/Babylon.js/releases.atom |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 |  |  |
| threejs | three.js Releases | rss | https://github.com/mrdoob/three.js/releases.atom |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 |  |  |
| phaser | Phaser Releases | rss | https://github.com/phaserjs/phaser/releases.atom |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 |  |  |
| godot_blog | Godot Engine Blog | rss | https://godotengine.org/rss.xml |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-28 |  |
| gamefromscratch | GameFromScratch | rss | https://gamefromscratch.com/feed/ |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 | 2026-11-27 |  |
| gamedeveloper | Game Developer | rss | https://www.gamedeveloper.com/rss.xml |  | 40 | 是 | engines_media | 新聞 | en | game_dev |  | 2026-11-25 |  |  |
| hn_engines | Hacker News | hackernews | https://news.ycombinator.com | WebGL,WebGPU,game engine,PixiJS,three.js,Godot,Cocos,HTML5 game | 15 | 是 | hn_engines | 新聞 | en | game_dev |  | 2026-11-25 |  | 近 24 小時關鍵字搜尋 |
| yogonet | Yogonet International | rss | https://www.yogonet.com/international/rss.xml |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-28 |  |
| igb | iGaming Business | rss | https://igamingbusiness.com/feed/ |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-28 |  |
| ggrasia | GGRAsia | rss | https://www.ggrasia.com/feed |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-27 |  |
| agbrief | Asia Gaming Brief | rss | https://agbrief.com/feed/ |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-28 |  |
| intergame | InterGame | rss | https://www.intergameonline.com/rss/all |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-27 |  |
| casinoorg | Casino.org News | rss | https://www.casino.org/news/feed/ |  | 45 | 是 | gambling_news | 新聞 | en | gambling |  | 2026-11-25 | 2026-11-28 |  |
| gnews_macau_zh | Google News 澳門博彩 | rss | https://news.google.com/rss/search?q=%E5%8D%9A%E5%BD%A9%20%28site%3Amacaodaily.com%20OR%20site%3Aexmoo.com%20OR%20site%3Aallinmedia.com.hk%20OR%20site%3Atdm.com.mo%20OR%20site%3Agcs.gov.mo%29%20when%3A3d&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant |  | 5 | 否 | gambling_news | 新聞 | zh-TW | gambling |  | 2026-11-25 | 2026-11-26 | Google News 的澳門媒體 site: 檢索，沒有正文 |

## 領域：閱讀

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| paul_graham | Paul Graham | rss | https://filipesilva.github.io/paulgraham-rss/feed.rss |  | 3 | 是 | essays | 長文 | en | reading |  | 2026-11-25 | 2026-11-26 | 鏡像 feed，日期是每月 1 日 |
| farnam_street | Farnam Street | rss | https://fs.blog/feed |  | 3 | 是 | essays | 長文 | en | reading |  | 2026-11-25 | 2026-11-27 |  |
| scott_young | Scott Young | rss | https://www.scotthyoung.com/blog/feed/ |  | 3 | 是 | essays | 長文 | en | reading |  | 2026-11-25 |  |  |
| lex_fridman | Lex Fridman | rss | https://lexfridman.com/feed/podcast |  | 3 | 是 | podcasts | 播客 | en | reading |  | 2026-11-25 |  |  |
| 80000_hours | 80000 Hours | rss | https://feeds.transistor.fm/80000-hours-podcast |  | 3 | 是 | podcasts | 播客 | en | reading |  | 2026-11-25 |  |  |
| latentspace_podcast | Latent Space | latentspace_podcast | https://latent.space/feed |  | 3 | 是 | podcasts | 播客 | en | reading |  | 2026-11-25 | 2026-11-28 | 排除 [AINews] |
| hn_reading | Hacker News | hackernews | https://news.ycombinator.com | essay,book,books,history,science,mathematics,psychology,philosophy | 20 | 是 | hn_deep | 長文 | en | reading |  | 2026-11-25 | 2026-11-28 | 近 24 小時關鍵字搜尋 |
| the_atlantic | The Atlantic | rss | https://www.theatlantic.com/feed/all/ |  | 8 | 是 | essays | 長文 | en | reading |  | 2026-11-26 | 2026-11-28 | 文章頁擋抓取（403），改用 feed 全文（Atom 的 content） |
| longreads | Longreads | rss | https://longreads.com/feed/ |  | 3 | 是 | essays | 長文 | en | reading |  | 2026-11-26 | 2026-11-27 | 編輯精選長篇報導 |
| ruanyifeng | 阮一峰的網路日誌 | rss | https://www.ruanyifeng.com/blog/atom.xml |  | 3 | 是 | essays | 長文 | zh-CN | reading |  | 2026-11-26 | 2026-11-27 | 科技愛好者週刊，每週五 |
| pragmatic_engineer | The Pragmatic Engineer | rss | https://blog.pragmaticengineer.com/rss/ |  | 3 | 是 | essays | 長文 | en | reading |  | 2026-11-26 |  | 軟體團隊與產業；部分付費 |
| vox | Vox | rss | https://www.vox.com/rss/index.xml |  | 5 | 是 | essays | 長文 | en | reading |  | 2026-11-26 | 2026-11-28 | 解釋型報導；feed 帶全文 |

## 板凳

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## 待檢

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## 停用

| 代號 | 名稱 | 抓法 | 網址 | 查詢 | 則數 | 正文 | 區塊 | 形式 | 語言 | 系列 | 釘選 | 加入日期 | 最近收錄 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| new_telegraph_co_uk | The Telegraph | rss | https://www.telegraph.co.uk |  | 10 | 是 | discovered | 新聞 |  | finance |  | 2026-11-26 |  | 發現 1 次；卡 @563；檢查未過 3 次，停用：網站抓不到（HTTP 402） |
| new_nextgov_com | NextGov | rss | https://www.nextgov.com |  | 10 | 是 | discovered | 新聞 |  | security |  | 2026-11-26 |  | 發現 1 次；卡 @381；檢查未過 3 次，停用：首頁找不到 feed（<link rel="alternate">） |
| new_cnn_com | CNN | rss | https://www.cnn.com |  | 10 | 是 | discovered | 新聞 |  | cross_strait |  | 2026-11-26 |  | 發現 1 次；卡 @502；檢查未過 3 次，停用：首頁找不到 feed（<link rel="alternate">） |
| new_stcn_com | 證券時報 | rss | https://www.stcn.com |  | 10 | 是 | discovered | 新聞 |  | tech,finance |  | 2026-11-26 |  | 發現 1 次；卡 @266；檢查未過 3 次，停用：網站抓不到（ReadTimeout: HTTPSConnectionPool(host='203.107.63.113', port=443): Read timed out. (read timeout=15)） |
| new_cbsnews_com | CBS News | rss | https://www.cbsnews.com |  | 10 | 是 | discovered | 新聞 |  | social,cross_strait,politics,finance,tech |  | 2026-11-26 |  | 發現 1 次；卡 2026-W48-0064；檢查未過 3 次，停用：feed 抓不到（HTTP 404） |
| new_iowacapitaldispatch_com | Iowa Capital Dispatch | rss | https://iowacapitaldispatch.com |  | 10 | 是 | discovered | 新聞 |  | health,environment |  | 2026-11-26 |  | 發現 1 次；卡 2026-W48-0130；檢查未過 3 次，停用：網站抓不到（HTTP 403） |
| new_neowin_net | Neowin | rss | https://www.neowin.net |  | 10 | 是 | discovered | 新聞 |  | tech |  | 2026-11-26 |  | 發現 1 次；卡 @359；檢查未過 3 次，停用：網站抓不到（HTTP 403） |
| xbox_wire | Xbox Wire | rss | https://news.xbox.com/en-us/feed/ |  | 10 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-26 |  | 使用者 2026-11-26 移除；官方公告 |
| playstation_blog | PlayStation Blog | rss | https://blog.playstation.com/feed/ |  | 10 | 是 | gamedev_news | 新聞 | en | game_dev |  | 2026-11-26 |  | 使用者 2026-11-26 移除；官方公告 |
