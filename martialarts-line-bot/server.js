// server.js — LINE Messaging API webhook（Node + Express）
//
// 株式会社 Martial Arts のビジネスライン（公式アカウント）本体。
// 構成は japan-mgmt-line-bot と同じ：
//   Express + /webhook + X-Line-Signature(HMAC-SHA256) 検証 + reply API。
// 応答内容は faq.js（データ）、見た目は flex.js（デザイン）に分離しています。

import express from 'express';
import crypto from 'node:crypto';
import { loadEnv } from './env.js';
import { matchFaq, greetingText, fallbackText } from './faq.js';
import { FLEX_BUILDERS, greetingHero, serviceDetail, quickReply } from './flex.js';

// ローカル実行時は .env を読み込む（本番は環境変数が直接渡るため .env 不要）。
// 認証情報の定数を読む前に実行することが重要。
loadEnv();

const PORT = process.env.PORT || 3000;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

const app = express();

// ── ヘルスチェック ──────────────────────────────────────────────
app.get('/', (_req, res) => res.send('martialarts-line-bot is running'));
app.get('/health', (_req, res) =>
  res.json({ ok: true, hasSecret: Boolean(CHANNEL_SECRET), hasToken: Boolean(CHANNEL_ACCESS_TOKEN) }),
);

// ── Webhook 本体 ────────────────────────────────────────────────
// 署名検証は「生のリクエストボディ」に対して行うため、express.raw で
// バイト列を受け取り、検証後に自前で JSON.parse する。
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.get('x-line-signature');

  if (CHANNEL_SECRET) {
    if (!verifySignature(req.body, signature)) {
      console.warn('[webhook] 署名検証に失敗。リクエストを破棄します。');
      return res.status(401).send('invalid signature');
    }
  } else {
    console.warn('[webhook] LINE_CHANNEL_SECRET 未設定のため署名検証をスキップ（開発時のみ）。');
  }

  // LINE には常に 200 を返す（再送ループ回避のため、処理失敗時も 200）。
  res.status(200).end();

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8') || '{}');
  } catch (err) {
    console.error('[webhook] JSON parse error:', err);
    return;
  }

  for (const event of payload.events ?? []) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('[webhook] event handling error:', err);
    }
  }
});

// ── 開発用シミュレーター（LINE なしで応答を確認） ──────────────
// 例: curl 'http://localhost:3000/dev/simulate?text=査定'
// 本番(NODE_ENV=production)では無効。
if (process.env.NODE_ENV !== 'production') {
  app.get('/dev/simulate', (req, res) => {
    res.json({ input: req.query.text, messages: buildReplyForText(req.query.text) });
  });
  app.get('/dev/greeting', (_req, res) => res.json({ messages: buildGreeting() }));
}

// ── イベント処理 ───────────────────────────────────────────────
async function handleEvent(event) {
  if (event.type === 'follow') {
    return reply(event.replyToken, buildGreeting());
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    return reply(event.replyToken, buildReplyForText(event.message.text));
  }
  if (event.type === 'message') {
    // スタンプ・画像など：案内文を返す
    return reply(event.replyToken, [withQuickReply(textMessage(fallbackText()))]);
  }
}

// 友だち追加時：ブランドヒーロー + メニュー付きの一言
function buildGreeting() {
  return [greetingHero(), withQuickReply(textMessage('下のメニューからもお選びいただけます👇'))];
}

// テキスト入力 → 返信メッセージ配列（純粋関数）
function buildReplyForText(text) {
  const rule = matchFaq(text);
  if (!rule) return [withQuickReply(textMessage(fallbackText()))];

  const messages = [];
  if (rule.serviceId) {
    // サービス詳細は Flex（デザインカード）で返す
    const flex = serviceDetail(rule.serviceId);
    messages.push(flex || textMessage(rule.answer));
  } else if (rule.flex && FLEX_BUILDERS[rule.flex]) {
    messages.push(FLEX_BUILDERS[rule.flex]());
  } else {
    messages.push(textMessage(rule.answer));
  }

  // 最後のメッセージにクイックリプライ（メニュー）を添付
  messages[messages.length - 1] = withQuickReply(messages[messages.length - 1]);
  return messages;
}

// ── メッセージ組み立てヘルパー ─────────────────────────────────
function textMessage(text) {
  return { type: 'text', text };
}
function withQuickReply(message) {
  return { ...message, quickReply: quickReply() };
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
    console.log('[reply:dry-run] (LINE_CHANNEL_ACCESS_TOKEN 未設定)\n', JSON.stringify(messages, null, 2));
    return;
  }
  const resp = await fetch(LINE_REPLY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!resp.ok) console.error('[reply] LINE API error:', resp.status, await resp.text());
}

app.listen(PORT, () => {
  console.log(`martialarts-line-bot listening on http://localhost:${PORT}`);
  console.log('  webhook: POST /webhook   health: GET /health');
  if (process.env.NODE_ENV !== 'production') {
    console.log('  simulate: GET /dev/simulate?text=査定   greeting: GET /dev/greeting');
  }
});
