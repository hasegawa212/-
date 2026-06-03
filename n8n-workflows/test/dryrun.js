// ローカル ドライラン: invoice-receipt-pdf-merge.json の Code ノードを実データで通し実行する。
// 外部API（Slack/CloudConvert/Drive）は呼ばず、各ノードの入出力（データ変換）だけを検証する。
const path = require('path');
const wf = require(path.join(__dirname, '..', 'invoice-receipt-pdf-merge.json'));

// --- 配置済みインスタンスを模して REPLACE_WITH_* を実値へ置換 ---
const SUBST = {
  REPLACE_WITH_TRIGGER_EMOJI: 'furikomi_done',
  REPLACE_WITH_SLACK_BOT_TOKEN: 'xoxb-TEST-TOKEN',
};
function codeOf(name) {
  const n = wf.nodes.find((x) => x.name === name);
  let c = n.parameters.jsCode;
  for (const [k, v] of Object.entries(SUBST)) c = c.split(k).join(v);
  return c;
}

// --- n8n ランタイムの最小エミュレータ ---
const store = {};
function runNode(name, inputJson) {
  const code = codeOf(name);
  const $input = { first: () => ({ json: inputJson }), all: () => [{ json: inputJson }] };
  const $ = (nodeName) => ({ item: { json: store[nodeName] } });
  const out = new Function('$input', '$', '$json', code)($input, $, inputJson);
  const json = Array.isArray(out) ? out[0].json : out.json;
  store[name] = json;
  return json;
}

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra ? '  -> ' + extra : '')); }
}

// ===== 入力データ（実物の file-bot 投稿 + 受付書2枚） =====
const filebotPost = [
  'file-bot', '2026.5.29', '\u{1F3E2} 取引先名', ' 有限会社川上産業',
  '\u{1F4C5} 支払期日', '  2026-06-05', '\u{1F4DD} 案件名', 'ひたちなか市堀口物件　廃棄物収集運搬処理代（草木）',
].join('\n');

const repliesResponse = {
  ok: true,
  messages: [
    { ts: '1716800000.000100', text: filebotPost, files: [
      { filetype: 'pdf', mimetype: 'application/pdf', url_private_download: 'https://files.slack.com/inv.pdf', title: '請求書_川上産業.pdf', created: 1716800000 },
    ] },
    { ts: '1716800100.000200', text: '受付書1', files: [
      { filetype: 'png', mimetype: 'image/png', url_private_download: 'https://files.slack.com/r1.png', title: '受付書1.png', created: 1716800100 },
    ] },
    { ts: '1716800200.000300', text: '受付書2', files: [
      { filetype: 'png', mimetype: 'image/png', url_private_download: 'https://files.slack.com/r2.png', title: '受付書2.png', created: 1716800200 },
    ] },
  ],
};

console.log('=== 1) Parse Slack Event ===');
const parsed = runNode('Parse Slack Event', { body: { event: {
  type: 'reaction_added', reaction: 'furikomi_done', user: 'U_CEO',
  item: { type: 'message', channel: 'C_KEIRI', ts: '1716800000.000100' },
} } });
check('対象リアクションで後続へ (skip=false)', parsed.skip === false, JSON.stringify(parsed));
check('channel / message_ts 抽出', parsed.channel === 'C_KEIRI' && parsed.message_ts === '1716800000.000100');
const ignored = runNode('Parse Slack Event', { body: { event: { type: 'reaction_added', reaction: 'eyes', item: { type: 'message', channel: 'C', ts: '1' } } } });
check('別の絵文字は skip=true', ignored.skip === true);
store['Parse Slack Event'] = parsed;

console.log('\n=== 2) Build CloudConvert Job ===');
const built = runNode('Build CloudConvert Job', repliesResponse);
check('エラーなし', built.error === false, built.reason);
check('受付書2枚を検出', built.receipt_count === 2, String(built.receipt_count));
check('ファイル名形式 <YYYYMMDD>_..._振込受付書セット.pdf', /^\d{8}_.+_振込受付書セット\.pdf$/.test(built.filename), built.filename);
const tasks = built.ccJob.tasks;
check('結合順 = 請求書 → 受付書1 → 受付書2（時系列）',
  JSON.stringify(tasks['merge'].input) === JSON.stringify(['import-invoice', 'convert-receipt-0', 'convert-receipt-1']),
  JSON.stringify(tasks['merge'].input));
check('Slack非公開URLを Authorization 付きで取得', tasks['import-invoice'].headers.Authorization === 'Bearer xoxb-TEST-TOKEN');
const noReceipt = runNode('Build CloudConvert Job', { ok: true, messages: [repliesResponse.messages[0]] });
check('受付書ゼロ件で error=missing-file', noReceipt.error === true && noReceipt.reason === 'missing-file');
store['Build CloudConvert Job'] = built;
console.log('   生成ファイル名: ' + built.filename);

console.log('\n=== 3) Get Export URL ===');
const exportRes = runNode('Get Export URL', { data: { status: 'finished', tasks: [
  { name: 'export', operation: 'export/url', status: 'finished', result: { files: [
    { filename: built.filename, url: 'https://storage.cloudconvert.com/merged.pdf' },
  ] } },
] } });
check('ダウンロードURL取得', exportRes.download_url === 'https://storage.cloudconvert.com/merged.pdf');
store['Get Export URL'] = exportRes;

console.log('\n=== 4) Pick Latest 請求分（実在フォルダ一覧から最新を選定） ===');
// 実際に Drive から取得した請求分フォルダ群を再現
const realFolders = { files: [
  { id: 'f_2026_2_25', name: '★2026.2.25請求分', createdTime: '2026-02-20T00:00:00Z' },
  { id: 'f_2026_5_3a', name: '★2026.5.3請求分', createdTime: '2026-05-01T09:00:00Z' },
  { id: 'f_2026_5_3b', name: '★2026.5.3請求分', createdTime: '2026-05-02T09:00:00Z' },
  { id: 'f_2026_3_25_name', name: '⭐️★2026.3.25請求分　長谷川光', createdTime: '2026-03-20T00:00:00Z' },
  { id: 'f_2026_3_25', name: '★2026.3.25請求分', createdTime: '2026-03-20T00:00:00Z' },
  { id: 'f_2025_12_25', name: '★2025.12.25請求分', createdTime: '2025-12-20T00:00:00Z' },
] };
const picked = runNode('Pick Latest 請求分', realFolders);
check('最新 = ★2026.5.3請求分（日付最大）', picked.latestFolderName === '★2026.5.3請求分', picked.latestFolderName);
check('同名重複は createdTime が新しい方を採用 (f_2026_5_3b)', picked.latestFolderId === 'f_2026_5_3b', picked.latestFolderId);
check('download_url/filename を引き継ぎ', picked.download_url === exportRes.download_url && picked.filename === built.filename);
store['Pick Latest 請求分'] = picked;

console.log('\n=== 5) Resolve Target Folder（4.支払い サブフォルダ） ===');
const resolved = runNode('Resolve Target Folder', { files: [{ id: 'sub_4_pay', name: '4.支払いの請求書全て（振込、引き落とし）' }] });
check('サブフォルダ「4.支払い…」を格納先に採用', resolved.folderId === 'sub_4_pay', resolved.folderId);
check('格納先パス = 月フォルダ / 4.支払い…', resolved.folderPath === '★2026.5.3請求分 / 4.支払いの請求書全て（振込、引き落とし）', resolved.folderPath);
const resolvedNoSub = runNode('Resolve Target Folder', { files: [] });
check('サブフォルダが無ければ月フォルダ直下にフォールバック', resolvedNoSub.folderId === 'f_2026_5_3b', resolvedNoSub.folderId);

console.log('\n========================================');
console.log(`結果: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
