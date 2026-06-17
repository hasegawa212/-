# Open Clone — Claude風チャットUI

Claude のUIを参考にしたオープンソースのチャットクローンです。フロントエンドは依存ゼロのバニラJS、バックエンドは Anthropic API を叩く薄い Express プロキシ。会話は `localStorage` に保存されます。

## 特徴

- フロントは HTML + CSS + Vanilla JS (依存ゼロ)
- サイドバーにチャット履歴 / 新規作成 / 切り替え
- マークダウン風整形 (コードブロック / インライン / 段落)
- モデルセレクタ (Clone Opus / Sonnet / Haiku)
- レスポンシブ (モバイル対応)
- **実LLM接続**: Express バックエンド経由で Anthropic API を呼び出し
- **オフラインフォールバック**: API キー未設定でもダミー応答で動作

## 使い方

### A. オフラインデモ (静的配信)

API キー不要。ダミー応答で動きます。

```bash
python3 -m http.server --directory claude-clone 8000
# → http://localhost:8000
```

### B. 本番モード (実LLM接続)

```bash
cd claude-clone
cp .env.example .env
# .env を編集し ANTHROPIC_API_KEY を設定

npm install
npm start
# → http://localhost:8787
```

起動時にフロントの `generateReply()` が `/api/health` を確認し、API キーが設定されていれば自動的に `/api/chat` 経由で Claude に問い合わせます。

## エンドポイント

| Method | Path | 説明 |
| --- | --- | --- |
| GET | `/api/health` | サーバ稼働 + APIキー設定状況を返す |
| POST | `/api/chat` | `{ messages, model }` を受け取り、Anthropic の応答テキストを返す |

`model` は `clone-opus` / `clone-sonnet` / `clone-haiku` のいずれか (`server.js` で実モデルIDにマッピング)。

## 構成

```
claude-clone/
├── index.html      # マークアップ
├── styles.css      # ダークテーマ
├── app.js          # フロント: チャットロジック + localStorage
├── server.js       # バックエンド: Anthropic API プロキシ
├── prompt.js       # システムプロンプト (単一の真実源)
├── package.json
├── .env.example
└── README.md
```

## カスタマイズポイント

- **プロンプト変更**: `prompt.js` の `buildSystemPrompt()` を編集 (Open Clone の人格・口調・方針はすべてここに集約)
- **モデル追加**: `server.js` の `MODEL_MAP` と `index.html` の `<select>` に行を足す
- **ストリーミング**: `server.js` で `stream: true` に切り替え、SSE で `app.js` に流す
- **認証**: `server.js` の `/api/*` にミドルウェアを挟む
- **永続化**: 現状フロントの `localStorage`。サーバ側に DB を追加すれば共有可能
