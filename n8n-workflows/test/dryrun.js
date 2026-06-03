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
const store = {}; // ノード名 -> 出力 json
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
  'file-bot', '2026.5.29', '\u{1F4B0}【振込依頼】\u{1F4B0}',
  'お振込のご対応の程、お願い致します！\u{1F647}', '\u{1F4CB}【入力項目】',
  '\u{1F3E2} 取引先名', ' 有限会社川上産業',
  '\u{1F4B4} 請求金額', ' 13,000円',
  '\u{1F4C5} 支払期日', '  2026-06-05',
  '⏰ 処理希望日', '  2026-06-05',
  '\u{1F3E6} 常陽銀行/大洗支店/普通', ' 口座番号：1335208',
  '✍️ 振込依頼人名', ' 株式会社Martial Arts',
  '\u{1F4DD} 案件名', 'ひたちなか市堀口物件　廃棄物収集運搬処理代（草木）',
  '\u{1F464} 担当者', '小久保亮子',
].join('\n');

const repliesResponse = {
  ok: true,
  messages: [
    { ts: '1716800000.000100', text: filebotPost, files: [
      { filetype: 'pdf', mimetype: 'application/pdf', url_private_download: 'https://files.slack.com/inv.pdf', title: '請求書_川上産業.pdf', created: 1716800000 },
    ] },
    { ts: '1716800100.000200', text: '振込受付書①', files: [
      { filetype: 'png', mimetype: 'image/png', url_private_download: 'https://files.slack.com/r1.png', title: '受付書①.png', created: 1716800100 },
    ] },
    { ts: '1716800200.000300', text: '振込受付書②（分割）', files: [
      { filetype: 'png', mimetype: 'image/png', url_private_download: 'https://files.slack.com/r2.png', title: '受付書②.png', created: 1716800200 },
    ] },
  ],
};

console.log('=== 1) Parse Slack Event（reaction_added 受信） ===');
const parsed = runNode('Parse Slack Event', { body: { event: {
  type: 'reaction_added', reaction: 'furikomi_done', user: 'U_CEO',
  item: { type: 'message', channel: 'C_KEIRI', ts: '1716800000.000100' },
} } });
check('対象リアクションとして後続へ流れる (skip=false)', parsed.skip === false, JSON.stringify(parsed));
check('channel / message_ts を抽出', parsed.channel === 'C_KEIRI' && parsed.message_ts === '1716800000.000100');

console.log('\n=== 1b) 無関係なリアクションは無視されるか ===');
const ignored = runNode('Parse Slack Event', { body: { event: {
  type: 'reaction_added', reaction: 'eyes', item: { type: 'message', channel: 'C', ts: '1' },
} } });
check('別の絵文字は skip=true', ignored.skip === true);
// store を本筋の値へ戻す
store['Parse Slack Event'] = parsed;

console.log('\n=== 2) Build CloudConvert Job（請求書/受付書の特定・命名・フォルダ名・ジョブ生成） ===');
const built = runNode('Build CloudConvert Job', repliesResponse);
check('エラーなし', built.error === false, built.reason);
check('受付書を2枚とも検出 (receipt_count=2)', built.receipt_count === 2, String(built.receipt_count));
check('期間フォルダ名 = ⭐️★2026.6.5請求分　有限会社川上産業',
  built.period_folder === '⭐️★2026.6.5請求分　有限会社川上産業', built.period_folder);
check('結合ファイル名が <YYYYMMDD>_<請求書名>_振込受付書セット.pdf 形式',
  /^\d{8}_.+_振込受付書セット\.pdf$/.test(built.filename), built.filename);
const tasks = built.ccJob.tasks;
check('CloudConvert: 請求書インポート + 受付書2枚の画像PDF化タスクを生成',
  !!tasks['import-invoice'] && !!tasks['convert-receipt-0'] && !!tasks['convert-receipt-1']);
check('結合順 = 請求書 → 受付書① → 受付書②（時系列）',
  JSON.stringify(tasks['merge'].input) === JSON.stringify(['import-invoice', 'convert-receipt-0', 'convert-receipt-1']),
  JSON.stringify(tasks['merge'].input));
check('Slackの非公開URLを Authorization 付きで取得する設定',
  tasks['import-invoice'].headers.Authorization === 'Bearer xoxb-TEST-TOKEN');
console.log('   生成ファイル名: ' + built.filename);
console.log('   期間フォルダ : ' + built.period_folder);

console.log('\n=== 2b) 受付書が無い場合は差し戻し ===');
const noReceipt = runNode('Build CloudConvert Job', { ok: true, messages: [repliesResponse.messages[0]] });
check('受付書ゼロ件で error=missing-file', noReceipt.error === true && noReceipt.reason === 'missing-file');
store['Build CloudConvert Job'] = built; // 本筋へ戻す

console.log('\n=== 3) Get Export URL（CloudConvert 完了レスポンスから結合PDFのURL取得） ===');
const exportRes = runNode('Get Export URL', { data: { status: 'finished', tasks: [
  { name: 'merge', operation: 'merge', status: 'finished' },
  { name: 'export', operation: 'export/url', status: 'finished', result: { files: [
    { filename: built.filename, url: 'https://storage.cloudconvert.com/merged-result.pdf' },
  ] } },
] } });
check('ダウンロードURLを取得', exportRes.download_url === 'https://storage.cloudconvert.com/merged-result.pdf');
check('ファイル名/チャンネル/ts を引き継ぎ', exportRes.filename === built.filename && exportRes.channel === 'C_KEIRI');
store['Get Export URL'] = exportRes;

console.log('\n=== 4) Resolve Folder Id（既存フォルダ有/無の両ケース） ===');
const resolvedExisting = runNode('Resolve Folder Id', { files: [{ id: 'FOLDER_EXIST_123', name: built.period_folder }] });
check('既存フォルダあり → そのIDを採用', resolvedExisting.folderId === 'FOLDER_EXIST_123');
const resolvedCreated = runNode('Resolve Folder Id', { id: 'FOLDER_NEW_456' });
check('新規作成 → 作成IDを採用', resolvedCreated.folderId === 'FOLDER_NEW_456');
check('格納先に period_folder を引き継ぎ', resolvedCreated.period_folder === built.period_folder);

console.log('\n========================================');
console.log(`結果: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
