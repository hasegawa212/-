/**
 * テレアポ管理シート × Telegram Bot
 *  - 担当者がTelegramに「<No.> <結果>」と送ると
 *    シートの該当行の 架電日N / 架電結果N / 架電ステータス を自動更新する。
 *  - n8n も Docker も不要。Google Apps Script だけで完結する。
 *
 * 使い方:
 *   1) このスクリプトを テレアポ管理シート の Apps Script エディタに貼り付け
 *   2) BOT_TOKEN, SHEET_NAME を自分の値に書き換え
 *   3) メニューの「実行」→ setup を実行 (権限を許可)
 *   4) 「デプロイ → 新しいデプロイ → 種類: ウェブアプリ → 全員アクセス可」で公開
 *   5) 発行されたURLを registerWebhook 関数の WEBHOOK_URL に貼って実行
 *   6) Telegramボットに「3 アポ獲得」と送ると即更新
 */

// ====== 設定 (ここだけ書き換える) ======
const BOT_TOKEN  = 'ここにBotFatherでもらったTokenを貼る';
const SHEET_NAME = 'テレアポ管理シート';
const SLACK_WEBHOOK_URL = ''; // 任意。アポ獲得時にSlackへ通知したい場合だけ入れる
// =====================================

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* -------- セットアップ用 -------- */

function setup() {
  // 動作確認: Botの情報を取得
  const me = JSON.parse(UrlFetchApp.fetch(`${TG_API}/getMe`).getContentText());
  Logger.log(me);
  if (!me.ok) throw new Error('BOT_TOKEN が間違っています');
  Logger.log(`✅ Bot OK: @${me.result.username}`);
  Logger.log('次に「デプロイ → 新しいデプロイ → ウェブアプリ」でURLを発行し、registerWebhook を実行してください。');
}

function registerWebhook() {
  const WEBHOOK_URL = 'ここにデプロイで発行されたウェブアプリURLを貼る';
  const res = UrlFetchApp.fetch(`${TG_API}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}`);
  Logger.log(res.getContentText());
}

function deleteWebhook() {
  Logger.log(UrlFetchApp.fetch(`${TG_API}/deleteWebhook`).getContentText());
}

/* -------- Telegram Webhook 受信 -------- */

function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    const msg = update.message;
    if (!msg || !msg.text) return ContentService.createTextOutput('ok');

    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const operator =
      msg.from.username || `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

    const parsed = parseCommand(msg.text);
    if (!parsed.ok) {
      reply(chatId, `⚠️ 使い方: 「3 アポ獲得」のように送ってください\n${parsed.hint || ''}`, messageId);
      return ContentService.createTextOutput('ok');
    }

    const result = updateRow(parsed.no, parsed.result, operator);
    if (!result.ok) {
      reply(chatId, `❌ ${result.message}`, messageId);
      return ContentService.createTextOutput('ok');
    }

    reply(
      chatId,
      `✅ 記録しました\nNo.${result.row_no} ${result.name}\n架電${result.slot}: ${parsed.result}\nステータス: ${result.next_status}`,
      messageId
    );

    if (result.is_appointment && SLACK_WEBHOOK_URL) {
      notifySlack(result, parsed.result, operator);
    }

    return ContentService.createTextOutput('ok');
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput('error');
  }
}

/* -------- 入力パース -------- */

function parseCommand(text) {
  const stripped = text.trim().replace(/^\/log\s+/i, '').replace(/[：:]/g, ' ');
  const m = stripped.match(/^\s*(\d+)\s+(.+)$/s);
  if (!m) return { ok: false, hint: '例) 3 アポ獲得' };

  const no = Number(m[1]);
  const result = m[2].trim();

  const map = [
    { re: /アポ獲得|獲得|成約/, status: 'アポ獲得',     appt: true  },
    { re: /アポ($|[^獲])/,       status: 'アポ予定',     appt: false },
    { re: /不在|留守/,           status: '次回架電予定', appt: false },
    { re: /拒否|断り|NG/i,        status: '対応不可',     appt: false },
    { re: /再架電|折り返し|再電/, status: '次回架電予定', appt: false },
    { re: /番号違い|誤番/,        status: '番号誤り',     appt: false },
  ];
  const hit = map.find(s => s.re.test(result));
  return {
    ok: true,
    no,
    result,
    next_status: hit ? hit.status : '架電済み',
    is_appointment: !!(hit && hit.appt),
  };
}

/* -------- シート更新 -------- */

function updateRow(no, resultText, operator) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, message: `シート「${SHEET_NAME}」が見つかりません` };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const colNo      = headers.indexOf('No.');
  const colName    = headers.indexOf('お名前');
  const colPhone   = headers.indexOf('電話番号');
  const colStatus  = headers.indexOf('架電ステータス');
  const colDate1   = headers.indexOf('架電日1');
  const colDate2   = headers.indexOf('架電日2');
  const colDate3   = headers.indexOf('架電日3');
  const colRes1    = headers.indexOf('架電結果1');
  const colRes2    = headers.indexOf('架電結果2');
  const colRes3    = headers.indexOf('架電結果3');

  if (colNo < 0) return { ok: false, message: '「No.」列が見つかりません' };

  // 該当行を探す
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][colNo]) === Number(no)) { rowIdx = i; break; }
  }
  if (rowIdx < 0) return { ok: false, message: `No.${no} が見つかりません` };

  // 空き枠を探す
  const slotMap = [
    { date: colDate1, res: colRes1, n: 1 },
    { date: colDate2, res: colRes2, n: 2 },
    { date: colDate3, res: colRes3, n: 3 },
  ];
  const slot = slotMap.find(s => {
    if (s.date < 0) return false;
    const v = data[rowIdx][s.date];
    return v === '' || v === null || v === undefined;
  });
  if (!slot) return { ok: false, message: `No.${no} は既に3回架電済みです。手動で更新してください。` };

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const cellRow = rowIdx + 1;

  sheet.getRange(cellRow, slot.date + 1).setValue(today);
  sheet.getRange(cellRow, slot.res + 1).setValue(`${resultText} (${operator})`);

  const parsed = parseCommand(`${no} ${resultText}`);
  if (colStatus >= 0) sheet.getRange(cellRow, colStatus + 1).setValue(parsed.next_status);

  return {
    ok: true,
    row_no: no,
    name: colName  >= 0 ? data[rowIdx][colName]  : '',
    phone: colPhone >= 0 ? data[rowIdx][colPhone] : '',
    slot: slot.n,
    next_status: parsed.next_status,
    is_appointment: parsed.is_appointment,
    today,
  };
}

/* -------- 送信ヘルパ -------- */

function reply(chatId, text, replyToMessageId) {
  UrlFetchApp.fetch(`${TG_API}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
    }),
    muteHttpExceptions: true,
  });
}

function notifySlack(result, resultText, operator) {
  const payload = {
    text:
      `:tada: *アポ獲得!*\n` +
      `*No.${result.row_no}* ${result.name} (${result.phone})\n` +
      `*担当:* ${operator}\n` +
      `*結果:* ${resultText}\n` +
      `*日付:* ${result.today}`,
  };
  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
