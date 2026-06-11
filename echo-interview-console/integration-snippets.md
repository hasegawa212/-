# 送信スニペット集（サマリー本文 → ヒアリングシート転記）

面談サマリーを生成している任意のアプリ（Replit版コンソール等）から、本文を
**n8n Webhook** か **Apps Script Web App** へPOSTすると、ヒアリングシートへ53列で転記されます。
生成したサマリー文字列（`summaryText`）をそのまま送るだけです。

宛先は2通り。どちらか片方でOK：

| 宛先 | URL | 送るJSON |
| --- | --- | --- |
| n8n Webhook（推奨・直送） | `https://<your>.app.n8n.cloud/webhook/slack-hearing-summary` | `{ "text": summaryText, "sheet": "ヒアリングシート①" }` |
| Apps Script Web App（直） | `https://script.google.com/macros/s/.../exec` | `{ "action": "importSummary", "text": summaryText, "sheet": "ヒアリングシート①" }` |

> `sheet` は省略すると `ヒアリングシート①`。CORS回避のため `Content-Type: text/plain` を推奨。

---

## curl（動作確認用）

```bash
curl -X POST "https://martial-arts-ghd.app.n8n.cloud/webhook/slack-hearing-summary" \
  -H "Content-Type: text/plain" \
  --data '{"text":"━━━━\n  反響顧客ヒアリングサマリー\n…(本文)…","sheet":"ヒアリングシート①"}'
```

## Node.js（Replit が Node の場合）

Slackへ投稿している箇所の直後に、同じ `summaryText` を送ります。

```js
// 既存: await postToSlack(summaryText);
async function sendToHearingSheet(summaryText, sheet = "ヒアリングシート①") {
  const N8N_URL = process.env.N8N_HEARING_URL; // 例: https://martial-arts-ghd.app.n8n.cloud/webhook/slack-hearing-summary
  try {
    await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ text: summaryText, sheet }),
    });
  } catch (e) {
    console.error("hearing-sheet送信エラー:", e);
  }
}

await sendToHearingSheet(summaryText);
```

## Python（Replit が Python の場合）

```python
import os, json, requests

def send_to_hearing_sheet(summary_text: str, sheet: str = "ヒアリングシート①") -> None:
    url = os.environ["N8N_HEARING_URL"]  # n8n Webhook URL
    try:
        requests.post(
            url,
            data=json.dumps({"text": summary_text, "sheet": sheet}),
            headers={"Content-Type": "text/plain; charset=utf-8"},
            timeout=15,
        )
    except Exception as e:
        print("hearing-sheet送信エラー:", e)

# 既存の Slack 投稿の直後に:
send_to_hearing_sheet(summary_text)
```

---

## メモ
- `summaryText` の形式は本コンソールの「📝 サマリー生成」と同じ（■現状／■資金計画／…）。
  Apps Script 側の `parseSummary_()` がこの見出し構造を前提に53列へ振り分けます。
- 送信先URLは環境変数（例 `N8N_HEARING_URL`）に逃がし、コードに直書きしないこと。
- 失敗してもSlack投稿は止めない（上記は try/catch で握りつぶし）。
