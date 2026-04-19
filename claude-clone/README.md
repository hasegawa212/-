# Open Clone — Claude風チャットUI

Claude のUIを参考にした、依存ゼロの静的なチャットクローンです。ブラウザだけで動作し、会話は `localStorage` に保存されます。

## 特徴

- 依存ゼロ (HTML + CSS + Vanilla JS)
- チャット履歴をサイドバーに表示 / 新規チャット作成
- マークダウン風整形 (コードブロック / インラインコード / 段落)
- モデルセレクタ (Clone Opus / Sonnet / Haiku — 表示のみ)
- レスポンシブ (モバイル対応)
- ダミー応答エンジン (オフラインでも動作)

## 起動

任意の静的サーバーで配信するだけです。

```bash
# Python
python3 -m http.server --directory claude-clone 8000

# Node (npx)
npx serve claude-clone
```

ブラウザで http://localhost:8000 を開いてください。

## 実LLMへの接続

`app.js` の `generateReply()` を差し替えます。

```js
async function generateReply(prompt, history, model) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history, model }),
  });
  const data = await res.json();
  return data.content;
}
```

## 構成

```
claude-clone/
├── index.html   # マークアップ
├── styles.css   # スタイル (ダークテーマ)
├── app.js       # チャットロジック + localStorage
└── README.md
```
