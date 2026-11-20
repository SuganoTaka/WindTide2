# Render.com での公開手順

`render.yaml` を同梱しているので、リポジトリを接続するだけで公開できます。

## 1. GitHub にリポジトリを作成

リポジトリ直下に `package.json`、`app/`、`render.yaml` が**直接**並ぶようにアップロードしてください（フォルダを入れ子にしない）。

> **重要**: 既存リポジトリへ「上書きアップロード」すると、古いファイル（`components/MapView.tsx`、
> `components/LeafletMap.tsx`、`app/api/fish` など）が残り、ビルドが `Can't resolve 'leaflet'` で失敗します。
> 新規リポジトリに本フォルダの中身だけをアップロードするか、残っている古いファイルを削除してください。

## 2. Render で公開

1. https://render.com にサインイン（GitHub 連携）
2. **New +** → **Blueprint** → リポジトリを選択（`render.yaml` が自動で読まれます）
3. そのまま **Apply** を押す

手動で Web Service を作る場合の設定:

| 項目 | 値 |
| --- | --- |
| Language / Runtime | Node |
| Build Command | `npm install --no-audit --no-fund --registry=https://registry.npmjs.org && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/` |
| Plan | Free |

環境変数は不要です（Open-Meteo・気象庁は API キーなしで利用できます）。

公開後は `/` が 200 を返し、港を選ぶと週間ビューが表示されます。気象庁の公式情報は
サーバーから `www.data.jma.go.jp` / `www.jma.go.jp` へ接続できる環境でのみ表示されます
（取得できない場合はブロックごと非表示になり、Open-Meteo の表示は継続します）。

## トラブルシューティング

### ビルドが `npm error`（使い方の一覧）で落ちる
`package.json` のない場所でビルドしています。リポジトリ直下に `package.json` があるか、
Render の **Root Directory** が空（または実際のアプリ直下）になっているかを確認してください。

### 起動はするがページが表示されない
- Start Command が `npm start` になっているか（`npm run dev` は不可）
- ログに `Ready on` が出ているか
- 無料プランはスリープ復帰に 30〜60 秒かかります

### ビルドが `npm error Exit handler never called!` で落ちる
`package-lock.json` の `"resolved"` が社内 npm ミラーを指していると、Render から到達できず失敗します。
`https://registry.npmjs.org/...` 以外のホストが無いことを確認してください。

本リポジトリの `package-lock.json` は公開レジストリのみを参照するよう正規化済みです。
再生成する場合:

```bash
rm package-lock.json
npm install --package-lock-only --no-audit --no-fund --registry=https://registry.npmjs.org
```
