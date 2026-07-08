// setup-richmenu.js — リッチメニューを LINE に登録する CLI
//
// 使い方:
//   1) assets/richmenu.svg を PNG(2500×1686) に変換して assets/richmenu.png を用意
//      例) rsvg-convert -w 2500 -h 1686 assets/richmenu.svg -o assets/richmenu.png
//      （または Chrome / デザインツールで書き出し）
//   2) node setup-richmenu.js [画像パス]   # 既定: assets/richmenu.png
//
// 必要な .env: LINE_CHANNEL_ACCESS_TOKEN

import { readFileSync } from 'node:fs';
import { setupRichMenu } from './richmenu.js';

// .env の簡易ローダー（依存を増やさないため自前）
try {
  const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env が無ければ環境変数をそのまま使う */ }

const imagePath = process.argv[2] || new URL('./assets/richmenu.png', import.meta.url);
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!token) {
  console.error('✗ LINE_CHANNEL_ACCESS_TOKEN が未設定です。.env を確認してください。');
  process.exit(1);
}

let image;
try {
  image = readFileSync(imagePath);
} catch {
  console.error(`✗ 画像が読めません: ${imagePath}`);
  console.error('  assets/richmenu.svg を 2500×1686 の PNG に変換してから実行してください。');
  process.exit(1);
}

setupRichMenu(image, token)
  .then((id) => console.log(`✓ リッチメニューを登録し、デフォルトに設定しました: ${id}`))
  .catch((err) => { console.error('✗ 失敗:', err.message); process.exit(1); });
