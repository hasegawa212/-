// env.js — 依存ゼロの簡易 .env ローダー（ローカル実行用）
//
// ローカルでは README の手順どおり `.env` を置けば読み込まれます。
// 本番（Render など）は環境変数が直接渡るため `.env` が無くても動作します。
// 既存の process.env を優先し、上書きはしません（＝実環境の値が常に勝ちます）。

import { readFileSync } from 'node:fs';

export function loadEnv(url = new URL('./.env', import.meta.url)) {
  try {
    const text = readFileSync(url, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* .env が無ければ環境変数をそのまま使う（本番はこちら） */
  }
}
