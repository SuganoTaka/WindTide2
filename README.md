# WindTide — 潮見帖フォーキャスト

全国 **3,925 か所**（漁港 2,931 / 港湾 994）から港を選び、**風予報とタイドグラフ**を週間（7日）・月間（30日）で確認する Web アプリです。見た内容は CSV（Excel）や PDF（印刷）で持ち出せます。気象庁の公式情報（週間天気・海上予報・海上警報）も併記します。

- 仕様: [`docs/spec.md`](docs/spec.md)
- 技術: Next.js 15（App Router）/ TypeScript / Tailwind CSS
- データ: Open-Meteo（風・気温・降水・潮位・平年値）/ 気象庁（公式予報・警報）/ 国土数値情報（港）

## 主な機能

- **港を選ぶ**: 3,925 港を港名・都道府県・種別で検索。現在地から近い順に並べ替え。お気に入り（localStorage）。
- **週間ビュー**: 7日×24時間の風ヒートマップ（10m/s以上は警告色）、日別サマリ、168時間のタイドグラフ（満干・現在時刻線）。
- **月間ビュー**: 月カレンダーに潮回り・満干時刻（最大4つ）・日別最大風速。17日目以降は「予報範囲外」、満干は「概算」表示。平年値（過去5年同月の平均風速）の基準線。
- **公式情報**: 気象庁の週間天気・海上予報（風・波・視程・天気）・海上警報の赤帯。取得できない場合はブロックごと非表示。
- **出力**: CSV（時間別・日別、UTF-8 BOM付き）、A4横1ページの印刷/PDFレイアウト。
- **共有**: 港とビューを URL（`?port=F01853&view=week`）に反映。

## クイックスタート

```bash
npm install
npm run dev          # http://localhost:3000
```

本番ビルドの確認:

```bash
npm run build
npm start
```

## テスト

```bash
npm test             # 計算ロジックのユニットテスト（Vitest）
npm run test:e2e     # 主要導線のE2E（要: 起動中のサーバーと playwright）
```

E2E は外部 API をモックするため、ネットワークがなくても通ります。実行前に `npm run build && npm start`（またはプレビュー）で `http://127.0.0.1:3000` を起動してください。`BASE_URL` で変更できます。

## 構成

```
app/
  api/weather/    Open-Meteo 取得（15分キャッシュ、失敗時はブラウザ直取得にフォールバック）
  api/jma/        気象庁 週間天気・海上予報・海上警報（30分/5分キャッシュ）
  api/normal/     平年値（Archive API、24時間キャッシュ）
components/       港一覧・港パネル・週間/月間ビュー・タイドグラフ・公式情報カード
lib/
  weather-build.ts  Open-Meteo の整形（16日・日別集計・30日への拡張）
  tide.ts           満干抽出・潮回り・月齢・17日目以降の概算
  jma.ts            気象庁 JSON/XML のパース（全角・ノット正規化）
  jma-areas.ts      港 → 府県予報区・海上予報区のマッピング
  csv.ts            CSV生成（UTF-8 BOM）・ダウンロード
  storage.ts        お気に入り
public/data/      港データ ports.json（約 750KB / 3,925件）
data/source/       港データの原本（国土数値情報 ZIP）
scripts/           ports.json 再生成、E2Eスモークテスト
tests/             ユニットテスト
docs/              仕様書
```

## 港データ

`public/data/ports.json` は同梱済みです。再生成する場合:

```bash
# data/source/ に C09-06_GML.zip（漁港）と C02-14_GML.zip（港湾）を置いて
npm run data:ports     # -> public/data/ports.json
```

## 環境変数

不要です。Open-Meteo・気象庁は API キーなしで利用できます（サーバーから外部に出るためにプロキシが必要な場合のみ `HTTPS_PROXY` などを設定）。

## 潮見帖からの連携

港IDは潮見帖と同じ生成スクリプト由来（`F00001` / `H00001`）です。

- **リンクで開く**: `https://<WindTide>/?port=F01853&view=week`
  - 潮見帖の `?p=F01853` をそのまま渡すこともできます（`?p=` は `?port=` の別名）
  - `?view=week|month` で初期表示を指定
- **埋め込み**: `https://<WindTide>/embed?port=F01853&view=week`
  - 港一覧・お気に入り・共有ボタンを省いたコンパクト表示（週間/月間タブ・CSV・印刷は利用可）
  - `?p=` / `?lat=35.75&lon=140.84`（最寄り港）にも対応
  - iframe で埋め込む場合、公開環境では許可オリジンを設定してください:
    `EMBED_FRAME_ANCESTORS="'self' https://fishingportjapan.onrender.com"`
    （未設定の場合は `frame-ancestors` を出さないため、どこからでも埋め込めます）

iframe で埋め込む場合（高さは目安）:

```html
<iframe
  src="https://<WindTide>/embed?p=F01853&view=week"
  style="width:100%;height:1400px;border:0"
  loading="lazy"
  title="WindTide 予報"
></iframe>
```

潮見帖側の追加はリンク1本です（例）:

```tsx
const WINDTIDE = process.env.NEXT_PUBLIC_WINDTIDE_URL; // 例: https://windtide.example.com
<a href={`${WINDTIDE}/?p=${port.i}&view=week`} target="_blank" rel="noopener">
  WindTideで風・潮を見る
</a>
```

## デプロイ

`render.yaml` のブループリントでそのまま公開できます。手順は [`DEPLOY.md`](DEPLOY.md) を参照してください。

## 出典・免責

- 気象・潮位・平年値: [Open-Meteo](https://open-meteo.com/)
- 公式予報・海上予報・海上警報: [気象庁](https://www.jma.go.jp/)
- 港データ: 国土数値情報（国土交通省）
- 潮位・気象はモデル推算値であり、実際の海況と異なる場合があります。判断は海上保安庁の潮汐表など公式情報もあわせて確認してください。
