/**
 * 反響面談コンソール — 自動化レイヤー（Code.gs と同じ Apps Script プロジェクトに追加）
 * =============================================================================
 * 4つの自動化をまとめて提供します。各機能は独立して使えます。
 *
 *  #1 Slackサマリー → シート自動転記   parseSummary_() + doPost(action:"importSummary")
 *  #2 反響フォーム → ヒアリング下書き   importInquiriesToDrafts()（時間主導トリガー）
 *  #3 Zoom録画文字起こし → AI要約 → 行  extractTranscript_() + doPost(action:"extractTranscript")
 *  #4 コンソール保存時に Slack も投稿    postSlackSummary_()（Code.gs の doPost から呼ぶ）
 *
 * 【Script Properties に設定】(プロジェクトの設定 → スクリプト プロパティ)
 *   SLACK_WEBHOOK_URL   … #1/#4 用 Slack Incoming Webhook（任意）
 *   ANTHROPIC_API_KEY   … #3 用 Claude API キー（任意）
 *   ANTHROPIC_MODEL     … 省略時 claude-opus-4-8（コスト優先なら claude-haiku-4-5 等）
 * =============================================================================
 */

function props_() { return PropertiesService.getScriptProperties(); }

// シートメニュー（手動実行用）
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('反響自動化')
    .addItem('反響→ヒアリング下書きを同期', 'importInquiriesToDrafts')
    .addToUi();
}

// =============================================================================
// 共通：cells(col→value) を 25行目ヘッダの並びでサマリー本文に整形（#1/#4 共用）
// =============================================================================
function buildSummaryFromCells_(c) {
  var v = function (col) { return (c[col] == null || c[col] === '') ? '-' : c[col]; };
  return [
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '  反響顧客ヒアリングサマリー',
    '  株式会社 Martial Arts',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '記入日：' + v('A') + '　反響：' + v('B') + '（' + v('C') + '）',
    '顧客名：' + v('E') + '（' + v('F') + '）　担当：' + v('D'),
    '連絡先：' + v('AR') + '　可：' + v('AS') + ' / 不可：' + v('AT'),
    '',
    '■ 現状',
    '・現住居：' + v('I') + '　家賃：' + v('H') + '万円　住所：' + v('G'),
    '・きっかけ：' + v('AV') + '　検討開始：' + v('AM') + '　内見経験：' + v('AK'),
    '・他社比較：' + v('AL'),
    '',
    '■ 資金計画',
    '・希望価格：' + v('O') + '〜' + v('P') + '万円',
    '・自己資金：' + v('L') + '万円　預金：' + v('N') + '万円　月々：' + v('M') + '万円',
    '・ローン種別：' + v('K') + '　勤務先：' + v('Q') + '　入社：' + v('T') + '　' + v('S'),
    '・源泉A：' + v('U') + '万 / B：' + v('V') + '万　金融機関：' + v('W'),
    '・既存借入：' + v('X') + '　延滞：' + v('Y') + '　確申：' + v('Z') + '　資格：' + v('AA'),
    '',
    '■ 希望エリア',
    '・エリア：' + v('AB') + '　勤務地：' + v('R') + '　通勤' + v('AC') + '分　徒歩' + v('AD') + '分　' + v('AE'),
    '',
    '■ 物件条件',
    '・種別：' + v('AF') + '　間取り：' + v('AG') + '　階数：' + v('AH') + '　駐車：' + v('AI') + '台',
    '・近隣施設：' + v('AJ'),
    '',
    '■ ライフプラン・本音',
    '・家族構成：' + v('J') + '　親居住：' + v('AU'),
    '・動機：' + v('AW'),
    '',
    '■ 次アクション',
    '・内見候補①：' + v('AN') + ' ／ ②：' + v('AO'),
    '・★確定内見：' + v('AP') + '　同行者：' + v('AQ'),
    '・備考：' + v('AY'),
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '炎であれ、昨日を超えろ、爪痕を残せ。',
  ].join('\n');
}

// =============================================================================
// #4 コンソール保存時に Slack へ同時投稿（Code.gs の doPost から呼ぶ）
// =============================================================================
function postSlackSummary_(cells) {
  var url = props_().getProperty('SLACK_WEBHOOK_URL');
  if (!url) return; // 未設定なら何もしない
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: buildSummaryFromCells_(cells) }),
    muteHttpExceptions: true,
  });
}

// =============================================================================
// #1 Slackサマリー → シート自動転記
//   doPost(action:"importSummary", text:"...", sheet:"ヒアリングシート①") で受ける。
//   Slack の「反響顧客ヒアリングサマリー」本文を解析し、53列の行を追記する。
// =============================================================================
function parseSummary_(text) {
  var cells = {};
  var pick = function (re) { var m = text.match(re); return m ? m[1].trim() : ''; };
  var put = function (col, val) { if (val && val !== '-') cells[col] = val; };

  put('A', pick(/記入日：([^\s　]+)/));
  put('B', pick(/反響：([^（\n]+)（/));
  put('C', pick(/反響：[^（\n]+（([^）]+)）/));
  put('E', pick(/顧客名：([^（\n]+)（/));
  put('F', pick(/顧客名：[^（\n]+（([^）]+)）/));
  put('D', pick(/担当：([^\s　\n]+)/));
  put('AR', pick(/連絡先：([^\s　]+)/));
  put('AS', pick(/可：([^\/\n]+?)\s*\//));
  put('AT', pick(/不可：([^\n]+)/));

  put('I', pick(/現住居：([^\s　]+)/));
  put('H', pick(/家賃：([^\s　万]+)万?円?/));
  put('G', pick(/住所：([^\n]+)/));
  put('AV', pick(/きっかけ：([^\s　]+)/));
  put('AM', pick(/検討開始：([^\s　]+)/));
  put('AK', pick(/内見経験：([^\n]+)/));
  put('AL', pick(/他社比較：([^\n]+)/));

  put('O', pick(/希望価格：([^〜]+)〜/));
  put('P', pick(/希望価格：[^〜]+〜([^\s万]+)万/));
  put('L', pick(/自己資金：([^\s万]+)万/));
  put('N', pick(/預金：([^\s万]+)万/));
  put('M', pick(/月々：([^\s万]+)万/));
  put('K', pick(/ローン種別：([^\s　]+)/));
  put('Q', pick(/勤務先：([^\s　]+)/));
  put('T', pick(/入社：([^\s　]+)/));
  put('S', pick(/入社：[^\s　]+\s+([^\s　\n]+)/));
  put('U', pick(/源泉A：([^\s万]+)万/));
  put('V', pick(/B：([^\s万]+)万/));
  put('W', pick(/金融機関：([^\n]+)/));
  put('X', pick(/既存借入：([^\s　]+)/));
  put('Y', pick(/延滞：([^\s　]+)/));
  put('Z', pick(/確申：([^\s　]+)/));
  put('AA', pick(/資格：([^\n]+)/));

  put('AB', pick(/エリア：([^\s　]+)/));
  put('R', pick(/勤務地：([^\s　]+)/));
  put('AC', pick(/通勤([^\s分]+)分/));
  put('AD', pick(/徒歩([^\s分]+)分/));
  put('AE', pick(/徒歩[^\s分]+分\s+([^\s　\n]+)/));

  put('AF', pick(/種別：([^\s　]+)/));
  put('AG', pick(/間取り：([^\s　]+)/));
  put('AH', pick(/階数：([^\s　]+)/));
  put('AI', pick(/駐車：([^\s台]+)台?/));
  put('AJ', pick(/近隣施設：([^\n]+)/));

  put('J', pick(/家族構成：([^\s　]+)/));
  put('AU', pick(/親居住：([^\n]+)/));
  put('AW', pick(/動機：([^\n]+)/));

  put('AN', pick(/内見候補①：([^／\n]+?)\s*／/));
  put('AO', pick(/②：([^\n]+)/));
  put('AP', pick(/★確定内見：([^\s　]+)/));
  put('AQ', pick(/同行者：([^\n]+)/));
  put('AY', pick(/備考：([^\n]+)/));

  return cells;
}

// =============================================================================
// #2 反響管理シート → ヒアリングシート下書き自動作成
//   新規反響（未取り込み）を検知し、分かる範囲を埋めた下書き行を追記する。
//   取り込み済みは反響管理シートのZ列(=26列目)にマーカーを書いて二重取り込みを防ぐ。
//   時間主導トリガー（例：5分おき）に登録、またはメニューから手動実行。
// =============================================================================
function importInquiriesToDrafts() {
  var book = getBook_();
  var src = book.getSheetByName('反響管理シート（martialhp連動）');
  var dst = book.getSheetByName(DEFAULT_SHEET);
  if (!src || !dst) return;

  var values = src.getDataRange().getValues();
  var header = values[0];
  var idx = {};
  header.forEach(function (h, i) { idx[String(h).trim()] = i; });
  var MARK = 25; // Z列（0始まり25）に取り込みマーカー

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[idx['氏名']]) continue;          // 空行スキップ
    if (row[MARK] === '取込済') continue;       // 取り込み済みスキップ

    var cells = {};
    cells['A'] = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (idx['受信日時'] != null) cells['B'] = row[idx['受信日時']];
    if (idx['流入元'] != null)  cells['C'] = row[idx['流入元']];
    if (idx['担当'] != null)    cells['D'] = row[idx['担当']];
    if (idx['氏名'] != null)    cells['E'] = row[idx['氏名']];
    if (idx['電話番号'] != null) cells['AR'] = row[idx['電話番号']];
    if (idx['希望エリア・物件'] != null) cells['AB'] = row[idx['希望エリア・物件']];
    if (idx['備考'] != null)    cells['AY'] = row[idx['備考']];

    writeRowToSheet_(dst, cells, '');
    src.getRange(r + 1, MARK + 1).setValue('取込済');
  }
}

// =============================================================================
// #3 Zoom録画の文字起こし → Claude で53列に構造化 → 行追記
//   doPost(action:"extractTranscript", transcript:"...", sheet:"...") で受ける。
// =============================================================================
function extractTranscript_(transcript, sheetName) {
  var apiKey = props_().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY 未設定' };
  var model = props_().getProperty('ANTHROPIC_MODEL') || 'claude-opus-4-8';

  // 抽出したい列を JSON Schema として宣言（col文字をキーにする）
  var schemaProps = {};
  for (var col in HEADERS) {
    if (col === 'AZ' || col === 'BA') continue; // 自動列は除外
    schemaProps[col] = { type: 'string', description: HEADERS[col] };
  }
  var payload = {
    model: model,
    max_tokens: 4000,
    output_config: {
      format: {
        type: 'json_schema',
        schema: { type: 'object', properties: schemaProps, additionalProperties: false },
      },
    },
    messages: [{
      role: 'user',
      content: '次の不動産面談の文字起こしから、各項目を抽出してJSONで返してください。'
        + '分からない項目は空文字。数値は単位を除いた数字のみ。キーは列記号(A,B,...)です。\n\n'
        + '【文字起こし】\n' + transcript,
    }],
  };

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var data = JSON.parse(res.getContentText());
  if (!data.content) return { ok: false, error: 'API応答エラー: ' + res.getContentText() };

  var jsonText = '';
  data.content.forEach(function (b) { if (b.type === 'text') jsonText += b.text; });
  var cells;
  try { cells = JSON.parse(jsonText); } catch (e) { return { ok: false, error: '抽出JSON解析失敗' }; }

  var sheet = getBook_().getSheetByName(sheetName || DEFAULT_SHEET);
  ensureHeaders_(sheet);
  var row = writeRowToSheet_(sheet, cells, '');
  return { ok: true, row: row };
}

// =============================================================================
// 共通：cells を次の空行へ書き込み（Code.gs の doPost と同じ規則）。書いた行番号を返す。
// =============================================================================
function writeRowToSheet_(sheet, cells, viewUrl) {
  ensureHeaders_(sheet);
  cells['AZ'] = cells['AZ'] || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  if (viewUrl) cells['BA'] = viewUrl;
  var row = nextEmptyRow_(sheet);
  for (var col in cells) {
    if (!HEADERS[col]) continue;
    var val = cells[col];
    if (val === undefined || val === null || val === '') continue;
    sheet.getRange(row, colToIndex_(col)).setValue(val);
  }
  return row;
}
