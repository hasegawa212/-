// server.js — LINE Messaging API webhook (Node + Express, ルールベース FAQ)
//
// 構成は Chat-Bridge の LINE webhook と同じ作り：
//   Express アプリ + /webhook ルート + X-Line-Signature(HMAC-SHA256) 検証 + reply API。
// 応答ロジックは faq.js（唯一の情報源）に集約しています。

import express from 'express';
import crypto from 'node:crypto';
import { matchFaq, greetingMessage, fallbackMessage, MENU_LABELS } from './faq.js';

const PORT = process.env.PORT || 3000;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

const app = express();

// ── ヘルスチェック（疎通確認用） ────────────────────────────────
app.get('/', (_req, res) => res.send('japan-mgmt-line-bot is running'));
app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    hasSecret: Boolean(CHANNEL_SECRET),
    hasToken: Boolean(CHANNEL_ACCESS_TOKEN),
  }),
);

// ── LINE Webhook 本体 ──────────────────────────────────────────
// 署名検証は「生のリクエストボディ」に対して行うため、JSON パーサより先に
// express.raw でバイト列を受け取り、検証後に自前で JSON.parse する。
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.get('x-line-signature');

  if (CHANNEL_SECRET) {
    if (!verifySignature(req.body, signature)) {
      console.warn('[webhook] 署名検証に失敗しました。リクエストを破棄します。');
      return res.status(401).send('invalid signature');
    }
  } else {
    console.warn('[webhook] LINE_CHANNEL_SECRET 未設定のため署名検証をスキップ（開発時のみ）。');
  }

  // LINE には常に 200 を返す（再送ループを避けるため、処理失敗時も 200）。
  res.status(200).end();

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8') || '{}');
  } catch (err) {
    console.error('[webhook] JSON parse error:', err);
    return;
  }

  const events = payload.events ?? [];
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('[webhook] event handling error:', err);
    }
  }
});

// ── 開発用シミュレーター（LINE なしで応答内容を確認） ───────────
// 例: curl 'http://localhost:3000/dev/simulate?text=手数料'
// 本番(NODE_ENV=production)では無効。
if (process.env.NODE_ENV !== 'production') {
  app.get('/dev/simulate', (req, res) => {
    const text = req.query.text;
    const messages = buildReplyForText(text);
    res.json({ input: text, messages });
  });
}

// ── イベント処理 ───────────────────────────────────────────────
async function handleEvent(event) {
  if (event.type === 'follow') {
    return reply(event.replyToken, [withMenu(greetingMessage())]);
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    const messages = buildReplyForText(event.message.text);
    return reply(event.replyToken, messages);
  }
  // それ以外（スタンプ・画像など）は案内文を返す
  if (event.type === 'message') {
    return reply(event.replyToken, [withMenu(fallbackMessage())]);
  }
}

// テキスト入力 → 返信メッセージ配列を組み立てる（純粋関数）
function buildReplyForText(text) {
  const rule = matchFaq(text);
  const body = rule ? rule.answer : fallbackMessage();
  return [withMenu(body)];
}

// テキストにクイックリプライ（メニュー）を付与した message オブジェクトを作る
function withMenu(text) {
  return {
    type: 'text',
    text,
    quickReply: {
      items: MENU_LABELS.map((label) => ({
        type: 'action',
        action: { type: 'message', label, text: label },
      })),
    },
  };
}

// ── LINE 連携 ──────────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto.createHmac('SHA256', CHANNEL_SECRET).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function reply(replyToken, messages) {
  if (!CHANNEL_ACCESS_TOKEN) {
    // トークン未設定時は送信せずログ出力（ローカル検証用）。
    console.log('[reply:dry-run] (LINE_CHANNEL_ACCESS_TOKEN 未設定)\n', JSON.stringify(messages, null, 2));
    return;
  }
  const resp = await fetch(LINE_REPLY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!resp.ok) {
    console.error('[reply] LINE API error:', resp.status, await resp.text());
  }
}

app.listen(PORT, () => {
  console.log(`japan-mgmt-line-bot listening on http://localhost:${PORT}`);
  console.log(`  webhook: POST /webhook   health: GET /health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  simulate: GET /dev/simulate?text=手数料`);
  }
});
