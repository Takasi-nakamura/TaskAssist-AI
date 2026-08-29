# TaskAssist AI

タスク実行を優先したAIアシスタント(PWA)。商品の最安値・特徴・マニアックな情報などを広域Web検索でまとめ、PDF / Markdown / テキストのファイルとして出力します。

## 主な機能

- 左サイドバー: チャットの新規作成・一覧・名前変更・削除(二次確認あり)
- 設定画面: API タブ(Gemini APIキー、既定モデル、Web検索ON/OFF) / デザインタブ(テーマ: ダーク・ライト・ミッドナイト)
- チャット欄: 中央にメッセージ表示、下部に入力欄
- 入力欄: 「+」ボタンでファイル添付(送信前後プレビュー可)、モデル切替(Flash 3.7 / Flash lite 3.6)、送信ボタン
- ユーザーのプロンプトにコピー ボタン
- 生成結果は自動でファイル化(PDF選択可)され、完成した瞬間にプレビューが開く。閉じても上部のプレビューバーやメッセージ内のカードからいつでもダウンロード・共有・プレビューが可能
- PWA対応(manifest.json / sw.js)。ホーム画面に追加してオフラインでもUIが起動可能

## 使い方

1. `index.html` を静的ホスティング(GitHub Pages 等)にデプロイ
2. アプリを開き、右下(またはサイドバー下部)の「設定」から Google AI Studio で発行した **Gemini APIキー** を入力して保存
3. チャット欄にリサーチしたい内容を入力して送信すると、Web検索(Gemini の `google_search` ツール)を使って調査結果を生成し、指定形式のファイルとして自動出力します

> APIキーはブラウザの `localStorage` にのみ保存され、アプリの外部には送信されません(Gemini API 呼び出し時のみ使用)。

## GitHub Pages で公開する場合

```bash
# リポジトリ直下にこのフォルダの中身をすべて配置してから
git add .
git commit -m "Initial TaskAssist AI PWA"
git push origin main
```

その後、リポジトリの Settings → Pages で公開ブランチ(`main` / ルート)を指定してください。

## モデルについて

`Flash 3.7` / `Flash lite 3.6` は暫定的に以下の実在モデルにマッピングしています。実際のモデル名がリリースされ次第、`app.js` 内の `MODEL_MAP` を書き換えてください。

- Flash 3.7 → `gemini-2.5-flash`
- Flash lite 3.6 → `gemini-2.5-flash-lite`

## ファイル構成

```
index.html      画面構造
styles.css      デザイントークン・レイアウト
app.js          チャット管理・API呼び出し・ファイル出力ロジック
manifest.json   PWAマニフェスト
sw.js           サービスワーカー(オフラインキャッシュ)
icons/          アプリアイコン
```
