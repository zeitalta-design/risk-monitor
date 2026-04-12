# データソース巡回先台帳

最終更新: 2026-04-02

## 補助金 (hojokin_items)

### ✅ 実装済み

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数期待 |
|---|---|---|---|---|---|
| J-Grants API（デジタル庁） | https://api.jgrants-portal.go.jp/exp/v1/public/subsidies | REST API / JSON | 随時 | ★★★★★ | 数百〜数千件 |

**取得方法**: keyword + acceptance=1 パラメータ必須。キーワードを20種類以上並べて重複排除で全件取得可。

### 🔜 次バッチ候補

| ソース | URL | 形式 | 備考 |
|---|---|---|---|
| ミラサポplus | https://mirasapo-plus.go.jp | HTML/スクレイピング | 中小企業庁系。JSレンダリング必要 |
| 経済産業省補助金一覧 | https://www.meti.go.jp/information/publicoffer/ | HTML | 年度ごとにHTML整理 |

---

## 入札 (nyusatsu_items)

### ⚠️ 未実装（ソース候補確定済み）

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数期待 |
|---|---|---|---|---|---|
| 調達ポータル（デジタル庁/財務省） | https://www.p-portal.go.jp | HTML（SPA/POST） | 随時 | ★★☆☆☆ | 数千件/月 |
| 入札情報速報サービス(NJSS) | https://www.njss.info | HTML | 随時 | ★★☆☆☆ | 要会員確認 |
| 各府省電子調達GEPS | https://www.geps.go.jp | HTML/PDF | 随時 | ★★★☆☆ | 数百件/月 |

**実装方針**: 調達ポータルはSelenium/Playwright必須（form POST + JS）。GEPSはXML形式のRSSがあり取得しやすい。次バッチ優先度: GEPS RSS → 調達ポータルCSVダウンロード。

**具体的な次ステップ**:
1. `https://www.geps.go.jp/rss/` でRSSフィード取得可否を確認
2. 調達ポータルの落札情報CSVダウンロード機能を調査
3. 入札スクレイパーを `scripts/ingest-nyusatsu-geps.mjs` として実装

---

## 産廃処分 (sanpai_items)

### ⚠️ 未実装（ソース候補確定済み）

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数期待 |
|---|---|---|---|---|---|
| 産廃情報ネット（sanpainet） | https://www2.sanpainet.or.jp/shobun/ | HTML | 随時 | ★★☆☆☆ | 数千件 ※403対策必要 |
| 東京都産廃行政処分 | https://www.kankyo.metro.tokyo.lg.jp/resource/industrial_waste/ | HTML | 随時 | ★★★☆☆ | 数十〜百件/年 |
| 大阪府産廃行政処分 | https://www.pref.osaka.lg.jp/sanpai/gyouseishobun/ | HTML | 随時 | ★★★☆☆ | 数十件/年 |
| 環境省（統計のみ） | https://www.env.go.jp/recycle/waste/ | PDF/HTML | 年1回 | ★★☆☆☆ | 集計値のみ |

**実装方針**: 自治体別にHTMLパーサーを書く必要がある。まず東京都・大阪府・神奈川県・愛知県・福岡県の5自治体を対象にする。sanpainetはUser-Agent対策が必要。

**具体的な次ステップ**:
1. 東京都ページの実際のURL（JavaScript不要なページ）を確認
2. `scripts/ingest-sanpai-tokyo.mjs` を実装（cheerio or node-html-parser）
3. 大阪府・神奈川県を追加

---

## 許認可 (kyoninka_entities)

### ⚠️ 未実装（ソース候補確定済み）

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数期待 |
|---|---|---|---|---|---|
| 国交省建設業者検索 | https://etsuran.mlit.go.jp | HTML | 随時 | ★★★☆☆ | 数万件 |
| 金融庁登録業者リスト | https://www.fsa.go.jp/menkyo/menkyo.html | HTML/CSV | 随時 | ★★★☆☆ | 数千件 |
| 法人番号公表サイト | https://www.houjin-bangou.nta.go.jp | CSV/API | 随時 | ★★★★☆ | 全法人網羅 |
| 国交省不動産業者検索 | https://www.mlit.go.jp/totikensangyo/const/sosei_const_fr_000036.html | HTML | 随時 | ★★★☆☆ | 数万件 |

**実装方針**: 法人番号サイトはCSVダウンロード可能で最も取得しやすい。ただし許認可情報（建設業許可等）は国交省の個別DBが必要。まず法人番号APIで事業者マスタを作り、許認可は各省庁DBと突合する2段階アプローチを推奨。

---

## 指定管理 (shitei_items)

### ⚠️ 未実装（ソース候補確定済み）

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数期待 |
|---|---|---|---|---|---|
| 総務省指定管理者制度状況調査 | https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/teisyoku/shiteikanrisha.html | HTML/PDF | 年1回 | ★★☆☆☆ | 統計のみ |
| 東京都指定管理者募集 | https://www.metro.tokyo.lg.jp/tosei/hodohappyo/press/category/ | HTML | 随時 | ★★★☆☆ | 数十件/年 |
| 大阪府指定管理者選定 | https://www.pref.osaka.lg.jp/shisan/shitei_kanrisha/ | HTML | 随時 | ★★★☆☆ | 数十件/年 |
| 各自治体入札・契約情報ページ | 各市区町村 | HTML | 随時 | ★★☆☆☆ | 分散型 |

**実装方針**: 自治体の公開情報ページをクロールする方式。件数が少なく分散しているため、まず主要10都市の入札・契約情報ページを巡回先として登録し、cronで週次チェックする設計を推奨。

---

## 行政処分（参考: 既実装）

| ソース | URL | 形式 | 更新頻度 | 取得しやすさ | 件数 |
|---|---|---|---|---|---|
| 国交省建設業行政処分 | 国交省各地方整備局 | HTML/PDF | 随時 | ★★★☆☆ | 約800件（実装済） |
