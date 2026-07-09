// richmenu.js — リッチメニュー定義（トーク画面下に常時表示される6分割メニュー）
//
// 「どんな人でも最強に便利」の中心。文字入力が苦手な方でも、下のメニューを
// タップするだけで主要導線（相談・売却・購入・建築・太陽光・アクセス）へ届きます。
//
// 画像は 2500×1686px の PNG が必要です（assets/richmenu.svg をPNG化して使用）。

// 6分割（2行 × 3列）。各セルは message アクションで faq.js のキーワードに着地します。
export const RICH_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'Martial Arts メインメニュー',
  chatBarText: 'メニュー',
  areas: [
    // 上段
    { bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '無料相談' } },
    { bounds: { x: 833, y: 0, width: 833, height: 843 },
      action: { type: 'message', text: '査定' } },
    { bounds: { x: 1666, y: 0, width: 834, height: 843 },
      action: { type: 'message', text: '購入' } },
    // 下段
    { bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: 'リフォーム' } },
    { bounds: { x: 833, y: 843, width: 833, height: 843 },
      action: { type: 'message', text: '太陽光' } },
    { bounds: { x: 1666, y: 843, width: 834, height: 843 },
      action: { type: 'message', text: 'アクセス' } },
  ],
};

const API = 'https://api.line.me/v2/bot/richmenu';
const DATA_API = 'https://api-data.line.me/v2/bot/richmenu';

// リッチメニューを作成 → 画像アップロード → デフォルト設定まで一括実行。
// imageBuffer: PNG(2500×1686) の Buffer。token: チャネルアクセストークン。
export async function setupRichMenu(imageBuffer, token) {
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が必要です');

  // 1) 作成
  const created = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(RICH_MENU),
  });
  if (!created.ok) throw new Error(`richmenu create failed: ${created.status} ${await created.text()}`);
  const { richMenuId } = await created.json();

  // 2) 画像アップロード
  const uploaded = await fetch(`${DATA_API}/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${token}` },
    body: imageBuffer,
  });
  if (!uploaded.ok) throw new Error(`image upload failed: ${uploaded.status} ${await uploaded.text()}`);

  // 3) 全ユーザーのデフォルトに設定
  const set = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  if (!set.ok) throw new Error(`set default failed: ${set.status} ${await set.text()}`);

  return richMenuId;
}
