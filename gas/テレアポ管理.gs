// テレアポ管理シート — Google Apps Script Web App
// デプロイ後の exec URL に GET/POST でアクセスして操作する。
//
// SPREADSHEET_ID はスクリプトプロパティで上書き可能。未設定時は下記の
// デフォルト ID が使われる。スタンドアロンプロジェクトで動かす場合は
// 対象スプレッドシートへのアクセス権を GAS 実行アカウントに付与すること。
var DEFAULT_SPREADSHEET_ID = '1bMfdadJXV0NqdiawZmbGzDUMiDMbBt4Cr2d1uNVDjBw';
var SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') ||
  DEFAULT_SPREADSHEET_ID;
var SHEET_NAME = 'テレアポ管理シート';

var HEADERS = [
  'No.','優先度','架電ステータス','お名前','フリガナ','電話番号',
  '電話可能な時間帯','面談希望','年収','勤続年数','貯蓄額',
  '不動産所有','投資経験','住所','メールアドレス','問合せ日',
  '架電日1','架電結果1','架電日2','架電結果2','架電日3','架電結果3',
  'アポ日時','担当者','備考'
];

// ---------------------------------------------------------------------------
// Web App エントリポイント
// ---------------------------------------------------------------------------

function doGet(e) {
  var action = (e.parameter.action || 'list');
  try {
    switch (action) {
      case 'list':
        return jsonResponse(handleList(e.parameter));
      case 'get':
        return jsonResponse(handleGet(e.parameter));
      case 'stats':
        return jsonResponse(handleStats());
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action || '';
  try {
    switch (action) {
      case 'add':
        return jsonResponse(handleAdd(body));
      case 'update':
        return jsonResponse(handleUpdate(body));
      case 'updateStatus':
        return jsonResponse(handleUpdateStatus(body));
      case 'addCallResult':
        return jsonResponse(handleAddCallResult(body));
      case 'delete':
        return jsonResponse(handleDelete(body));
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET ハンドラ
// ---------------------------------------------------------------------------

function handleList(params) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { records: [], count: 0 };

  var records = rowsToObjects(data);

  if (params.priority) {
    records = records.filter(function(r) { return r['優先度'] === params.priority; });
  }
  if (params.status) {
    records = records.filter(function(r) { return r['架電ステータス'] === params.status; });
  }
  if (params.assignee) {
    records = records.filter(function(r) { return r['担当者'] === params.assignee; });
  }

  var offset = parseInt(params.offset, 10) || 0;
  var limit  = parseInt(params.limit, 10)  || records.length;
  var total  = records.length;
  records = records.slice(offset, offset + limit);

  return { records: records, count: records.length, total: total };
}

function handleGet(params) {
  if (!params.no) throw new Error('Parameter "no" is required');
  var no = parseInt(params.no, 10);
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var records = rowsToObjects(data);
  var found = records.filter(function(r) { return r['No.'] === no; });
  if (found.length === 0) throw new Error('Record not found: No.' + no);
  return { record: found[0] };
}

function handleStats() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var records = rowsToObjects(data);

  var byPriority = {};
  var byStatus = {};
  records.forEach(function(r) {
    var p = r['優先度'] || '未設定';
    var s = r['架電ステータス'] || '未着手';
    byPriority[p] = (byPriority[p] || 0) + 1;
    byStatus[s]   = (byStatus[s] || 0) + 1;
  });

  return {
    total: records.length,
    byPriority: byPriority,
    byStatus: byStatus
  };
}

// ---------------------------------------------------------------------------
// POST ハンドラ
// ---------------------------------------------------------------------------

function handleAdd(body) {
  var sheet = getSheet();
  var lastRow = sheet.getLastRow();
  var nextNo = 1;
  if (lastRow >= 2) {
    nextNo = sheet.getRange(lastRow, 1).getValue() + 1;
  }

  var row = HEADERS.map(function(h) {
    if (h === 'No.') return nextNo;
    return body[h] || '';
  });

  sheet.appendRow(row);
  return { success: true, no: nextNo };
}

function handleUpdate(body) {
  if (!body.no) throw new Error('"no" is required');
  var rowIndex = findRowByNo(body.no);
  var sheet = getSheet();

  HEADERS.forEach(function(h, i) {
    if (h === 'No.') return;
    if (body.hasOwnProperty(h)) {
      sheet.getRange(rowIndex, i + 1).setValue(body[h]);
    }
  });

  return { success: true, no: body.no };
}

function handleUpdateStatus(body) {
  if (!body.no) throw new Error('"no" is required');
  if (!body.status) throw new Error('"status" is required');
  var rowIndex = findRowByNo(body.no);
  var sheet = getSheet();
  var colIndex = HEADERS.indexOf('架電ステータス') + 1;
  sheet.getRange(rowIndex, colIndex).setValue(body.status);
  return { success: true, no: body.no, status: body.status };
}

function handleAddCallResult(body) {
  if (!body.no) throw new Error('"no" is required');
  if (!body.date) throw new Error('"date" is required');
  if (!body.result) throw new Error('"result" is required');

  var rowIndex = findRowByNo(body.no);
  var sheet = getSheet();

  for (var i = 1; i <= 3; i++) {
    var dateCol = HEADERS.indexOf('架電日' + i) + 1;
    var resultCol = HEADERS.indexOf('架電結果' + i) + 1;
    var existing = sheet.getRange(rowIndex, dateCol).getValue();
    if (!existing || existing === '') {
      sheet.getRange(rowIndex, dateCol).setValue(body.date);
      sheet.getRange(rowIndex, resultCol).setValue(body.result);

      if (body.status) {
        var statusCol = HEADERS.indexOf('架電ステータス') + 1;
        sheet.getRange(rowIndex, statusCol).setValue(body.status);
      }

      return { success: true, no: body.no, callSlot: i };
    }
  }

  throw new Error('All 3 call slots are already filled for No.' + body.no);
}

function handleDelete(body) {
  if (!body.no) throw new Error('"no" is required');
  var rowIndex = findRowByNo(body.no);
  var sheet = getSheet();
  sheet.deleteRow(rowIndex);
  return { success: true, no: body.no };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function getSheet() {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');
  return sheet;
}

function findRowByNo(no) {
  var sheet = getSheet();
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == no) return i + 2;
  }
  throw new Error('Record not found: No.' + no);
}

function rowsToObjects(data) {
  var headers = data[0];
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[headers[j]] = val;
    }
    records.push(obj);
  }
  return records;
}

function jsonResponse(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// 初期セットアップ用: CSV → スプレッドシート インポート
// ---------------------------------------------------------------------------

function setupFromCSV() {
  var sheet = getSheet();
  if (sheet.getLastRow() > 1) {
    throw new Error('Sheet already has data. Clear it first if you want to re-import.');
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  SpreadsheetApp.flush();
  Logger.log('Headers written. Import CSV data via File > Import in Google Sheets.');
}
