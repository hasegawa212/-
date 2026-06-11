/**
 * 反響面談コンソール → ヒアリングシート 書き込み用 Google Apps Script Web App
 * =============================================================================
 * 役割：コンソール（ブラウザ）から送られた面談データを、ヒアリングシートの
 *       データテーブル（25行目ヘッダ・26行目以降データ）へ「1項目=1列」で
 *       確実に書き込む。col 文字で書くので項目の取りこぼしが起きない。
 *
 * 列の意味の正は echo-interview-console/fields.js。下の HEADERS はそれと一致させる。
 * A〜BA は既存 53 列、BB〜BE はコンソールで追加する 4 列。
 *
 * 【セットアップ】
 *   1. 対象スプレッドシートを開く → 拡張機能 → Apps Script。
 *   2. このファイルを貼り付け、SPREADSHEET_ID を設定（空ならコンテナを使用）。
 *   3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *        - 次のユーザーとして実行：自分
 *        - アクセスできるユーザー：全員
 *   4. 発行された URL をコンソールの「設定」に貼る。
 * =============================================================================
 */

// 空 '' ならこのスクリプトが紐づくスプレッドシート（コンテナ）を使う。
var SPREADSHEET_ID = '';
var DEFAULT_SHEET = 'ヒアリングシート①';
var HEADER_ROW = 25;   // ヘッダ行
var FIRST_DATA_ROW = 26; // データ開始行
var KEY_COLUMN = 'E';  // 行が埋まっているか判定する列（お客様名）

// 列 → ヘッダ名（fields.js と一致させること）
var HEADERS = {
  A: '記入日', B: '反響日', C: '反響名', D: '担当者', E: 'お客様名', F: 'フリガナ',
  G: '現住所', H: '現家賃（万円/月）', I: '現住居種別', J: '家族構成', K: 'ローン種別',
  L: '自己資金/頭金（万円）', M: '月々支払（万円）', N: '預金額（万円）', O: '予算下限（万円）',
  P: '予算上限（万円）', Q: '勤務先', R: '勤務地', S: '雇用形態', T: '入社時期',
  U: 'R7源泉額A（万円）', V: 'R7源泉額B（万円）', W: '金融機関', X: '既存借入', Y: '延滞履歴',
  Z: '確定申告', AA: '国家資格', AB: '希望エリア', AC: '許容通勤（分）', AD: '駅まで徒歩（分）',
  AE: '通勤手段', AF: '物件種別', AG: '間取り', AH: '階数', AI: '駐車場（台）', AJ: '近隣商業施設',
  AK: '内見経験', AL: '他社問合せ物件', AM: '検討開始時期', AN: '内見可能日①', AO: '内見可能日②',
  AP: '確定内見日時', AQ: '同行者', AR: '連絡先', AS: '連絡可能時間', AT: '連絡不可時間',
  AU: '親御様居住地域', AV: '来訪きっかけ', AW: '家を買う動機', AX: '懸念・不安', AY: '備考',
  AZ: '保存日時', BA: '閲覧URL', BB: 'エリア理由', BC: '絶対条件', BD: '希望条件', BE: '将来像',
};

// -----------------------------------------------------------------------------

function getBook_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID)
                        : SpreadsheetApp.getActiveSpreadsheet();
}

/** 列文字（A, Z, AA, BE…）→ 1始まりの列番号 */
function colToIndex_(letters) {
  var n = 0;
  for (var i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n;
}

/** 25行目ヘッダの抜け（特に BB〜BE）だけ補完。既存ヘッダは上書きしない。 */
function ensureHeaders_(sheet) {
  for (var col in HEADERS) {
    var c = colToIndex_(col);
    var cell = sheet.getRange(HEADER_ROW, c);
    if (cell.getValue() === '' || cell.getValue() == null) {
      cell.setValue(HEADERS[col]);
    }
  }
}

/** KEY_COLUMN が空の最初の行（FIRST_DATA_ROW 以降）を返す */
function nextEmptyRow_(sheet) {
  var keyCol = colToIndex_(KEY_COLUMN);
  var last = sheet.getLastRow();
  for (var r = FIRST_DATA_ROW; r <= last; r++) {
    var v = sheet.getRange(r, keyCol).getValue();
    if (v === '' || v == null) return r;
  }
  return Math.max(last + 1, FIRST_DATA_ROW);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 動作確認 / 反響取得。?no= で反響管理シートの1件を返す。 */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.no) return jsonOut_({ ok: true, inquiry: fetchInquiry_(p.no) });
    return jsonOut_({ ok: true, service: 'echo-interview-console', time: new Date().toISOString() });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/** 面談データを書き込む。body = { sheet, cells:{col:value}, viewUrl } */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var book = getBook_();
    var sheetName = body.sheet || DEFAULT_SHEET;
    var sheet = book.getSheetByName(sheetName);
    if (!sheet) return jsonOut_({ ok: false, error: 'シートが見つかりません: ' + sheetName });

    ensureHeaders_(sheet);

    var cells = body.cells || {};
    cells['AZ'] = cells['AZ'] || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    if (body.viewUrl) cells['BA'] = body.viewUrl;

    var row = nextEmptyRow_(sheet);
    var written = 0;
    for (var col in cells) {
      if (!HEADERS[col]) continue; // 未知の列は無視
      var val = cells[col];
      if (val === undefined || val === null || val === '') continue;
      sheet.getRange(row, colToIndex_(col)).setValue(val);
      written++;
    }
    return jsonOut_({ ok: true, sheet: sheetName, row: row, written: written });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** 反響管理シートから No. で1件取得（任意機能） */
function fetchInquiry_(no) {
  var sheet = getBook_().getSheetByName('反響管理シート（martialhp連動）');
  if (!sheet) return null;
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(no)) {
      var obj = {};
      for (var c = 0; c < header.length; c++) obj[header[c]] = values[r][c];
      return obj;
    }
  }
  return null;
}
