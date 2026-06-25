#!/usr/bin/env node
/**
 * meeting-feedback-slack — 会議の参加者一人ひとりに「個別フィードバック」をSlack DMで送るCLI。
 *
 * 思想:
 *   会議は「意見交換の場」。聞いているだけ・黙っているだけ、はナシ。
 *   だから本ツールは必ず「発言量・参加度」と「次回アクション」をフィードバックする。
 *   何も言わずに座っていた人には、次回は必ず発言するよう背中を押すメッセージが入る。
 *
 * 使い方:
 *   node send-feedback.js --participants participants.csv               # 本番送信
 *   node send-feedback.js -p participants.csv --dry-run                 # 送らずプレビュー
 *   node send-feedback.js -p participants.csv --template tmpl.txt       # 文面を自前テンプレで
 *   node send-feedback.js -p participants.csv --delay 1500              # 送信間隔(ms)
 *
 * 参加者CSV（1行=1人、人ごとに内容が違う）:
 *   宛先列   : email 列 または slack_id 列（両方あれば slack_id 優先）
 *   評価列   : 発言回数 / 良かった点 / 改善点 / 次回アクション / 一言   ※すべて任意
 *   見出し列 : 会議名 / 日付   ※任意（無くてよい）
 *
 * 既定では構造化された文面を自動生成する。--template を渡すと {{列名}} 差し込み + 計算列
 * （{{発言コメント}} など）でカスタム文面を組める。
 */

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- 小さなログ補助（ANSIカラー） ---------------------------------------
const c = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", gray: "\x1b[90m", bold: "\x1b[1m",
};
const log = (...a) => console.log(...a);
const ok = (s) => `${c.green}${s}${c.reset}`;
const err = (s) => `${c.red}${s}${c.reset}`;
const warn = (s) => `${c.yellow}${s}${c.reset}`;
const dim = (s) => `${c.gray}${s}${c.reset}`;

// ---- 引数パース ----------------------------------------------------------
function parseArgs(argv) {
  const args = { delay: 1000, dryRun: false, lowThreshold: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-p": case "--participants": args.participants = next(); break;
      case "-t": case "--template": args.template = next(); break;
      case "-d": case "--delay": args.delay = Number(next()); break;
      case "--low": args.lowThreshold = Number(next()); break;
      case "--token": args.token = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "-h": case "--help": args.help = true; break;
      default:
        console.error(err(`不明な引数: ${a}`));
        process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  log(`${c.bold}meeting-feedback-slack${c.reset} — 会議フィードバックを一人ひとりに個別DM

${c.bold}必須:${c.reset}
  -p, --participants <file>  参加者CSV（email か slack_id 列が必要）

${c.bold}任意:${c.reset}
  -t, --template <file>      自前の文面テンプレ（{{列名}}/{{発言コメント}} 差し込み）
  -d, --delay <ms>           送信間隔ミリ秒（既定 1000）
      --low <n>              「発言が少ない」とみなす閾値（既定 3。これ未満で強めの一押し）
      --token <xoxb-...>     Slack Bot Token（未指定なら環境変数/.env を使用）
      --dry-run              実際には送らず、宛先解決と文面プレビューだけ行う
  -h, --help                 このヘルプ

${c.bold}CSVの列（すべて任意・人ごとに異なる内容）:${c.reset}
  name / email / slack_id / 会議名 / 日付
  発言回数 / 良かった点 / 改善点 / 次回アクション / 一言

${c.bold}例:${c.reset}
  node send-feedback.js -p participants.csv --dry-run
  node send-feedback.js -p participants.csv --delay 1500
`);
}

// ---- .env の簡易読み込み（依存ゼロ） ------------------------------------
function loadDotEnv() {
  const p = join(__dirname, ".env");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---- CSVパーサ（BOM・引用符・改行込みフィールド対応） -------------------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM除去
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== "")) // 空行を除外
    .map((r) => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

// 列名のゆらぎを吸収して値を取り出す
function pick(record, candidates) {
  const keys = Object.keys(record);
  for (const cand of candidates) {
    const hit = keys.find((k) => k.toLowerCase() === cand.toLowerCase());
    if (hit && record[hit]) return record[hit];
  }
  return "";
}

// {{列名}} を差し込み
function renderTemplate(template, record) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name) => {
    const keys = Object.keys(record);
    const hit = keys.find((k) => k.toLowerCase() === String(name).toLowerCase());
    return hit ? record[hit] : `{{${name}}}`;
  });
}

const isSlackId = (s) => /^[UW][A-Z0-9]{6,}$/.test(s);

// ---- フィードバック文面の組み立て ---------------------------------------
// 「会議は意見交換の場・黙っているのはNG」を軸に、発言量と次回アクションを必ず含める。

// 発言回数 → 参加度コメント。数値が取れないときは null（カウント行を出さない）。
function participationComment(record, lowThreshold) {
  const raw = pick(record, ["発言回数", "発言数", "発言", "speak_count", "speakcount", "count"]);
  if (raw === "") {
    return {
      count: null,
      comment:
        "会議は「意見交換の場」です。聞いているだけ・黙っているだけ、はナシ。" +
        "次回はあなたの意見を、まず一つ出すところから始めましょう。",
    };
  }
  const n = Number(String(raw).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) {
    return { count: raw, comment: "次回も、自分の意見を言葉にして場に出していきましょう。" };
  }
  if (n <= 0) {
    return {
      count: 0,
      comment:
        "今回は発言ゼロでした。会議は意見交換の場です。" +
        "黙って座っているだけなら、その時間はもったいない。" +
        "次回は最低でも1回、必ず意見を出しましょう。どんな小さな視点でも議論の材料になります。",
    };
  }
  if (n < lowThreshold) {
    return {
      count: n,
      comment:
        "発言はありました。ただ、もう一歩。意見交換の場である以上、" +
        "次回はあと数回、思ったことをその場で言葉にしていきましょう。",
    };
  }
  return {
    count: n,
    comment:
      "しっかり発言できていました。意見を出す姿勢が場を前に進めます。" +
      "この調子で、次は発言の「質」も意識していきましょう。",
  };
}

// 既定の構造化フィードバックを生成（Slack mrkdwn）
function buildFeedbackMessage(record, lowThreshold) {
  const name = pick(record, ["name", "お名前", "氏名", "名前"]);
  const meeting = pick(record, ["会議名", "meeting", "ミーティング"]);
  const date = pick(record, ["日付", "date", "開催日"]);
  const good = pick(record, ["良かった点", "よかった点", "good", "強み"]);
  const improve = pick(record, ["改善点", "改善", "課題", "improve"]);
  const nextAction = pick(record, ["次回アクション", "次回", "アクション", "next_action", "nextaction", "action"]);
  const note = pick(record, ["一言", "メッセージ", "note", "memo", "備考"]);

  const part = participationComment(record, lowThreshold);

  const head = name ? `${name} さん、お疲れさまでした！` : "お疲れさまでした！";
  const subjectBits = [date, meeting].filter(Boolean).join(" ");
  const subject = subjectBits
    ? `${subjectBits} のフィードバックです。`
    : "先ほどの会議のフィードバックです。";

  const lines = [head, subject, ""];

  // 軸1: 発言量・参加度（必ず入れる）
  lines.push("*■ 発言・参加について*");
  if (part.count !== null) lines.push(`今回の発言: ${part.count}回`);
  lines.push(part.comment);
  lines.push("");

  // 良かった点 / 改善点（あれば）
  if (good) { lines.push("*■ 良かった点*"); lines.push(`・${good}`); lines.push(""); }
  if (improve) { lines.push("*■ 改善点*"); lines.push(`・${improve}`); lines.push(""); }

  // 軸2: 次回アクション（必ず入れる。未指定なら発言を促す既定値）
  lines.push("*■ 次回アクション*");
  lines.push(`・${nextAction || "次回の会議では、自分から最低1回は意見を出す"}`);

  if (note) { lines.push(""); lines.push(note); }

  // 末尾は trim して余分な空行を除く
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// 自前テンプレ用に計算列を足したレコードを返す
function recordWithComputed(record, lowThreshold) {
  const part = participationComment(record, lowThreshold);
  return {
    ...record,
    発言コメント: part.comment,
    参加コメント: part.comment,
  };
}

// ---- Slack Web API 呼び出し ---------------------------------------------
async function slackApi(method, token, params) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") || "1");
    await sleep((retry + 1) * 1000);
    return slackApi(method, token, params);
  }
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || `slack_api_error:${method}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 宛先レコード → Slack ユーザーID
async function resolveUserId(record, token, liveLookup) {
  const slackId = pick(record, ["slack_id", "slackid", "user_id", "userid", "id"]);
  if (slackId && isSlackId(slackId)) return slackId;

  const email = pick(record, ["email", "mail", "メール", "メールアドレス"]);
  if (email) {
    if (!liveLookup) return `email:${email}`;
    const data = await slackApi("users.lookupByEmail", token, { email });
    return data.user.id;
  }
  throw new Error("宛先に有効な slack_id もメールアドレスもありません");
}

// ---- メイン --------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  loadDotEnv();
  const token = args.token || process.env.SLACK_BOT_TOKEN;

  const problems = [];
  if (!args.participants) problems.push("--participants (参加者CSV) が必要です");
  if (!args.dryRun && !token) problems.push("SLACK_BOT_TOKEN が未設定です（.env か --token、または --dry-run を使用）");
  if (problems.length) {
    for (const p of problems) console.error(err("✗ " + p));
    log(dim("\n--help でヘルプを表示します。"));
    process.exit(1);
  }

  const participantsPath = resolve(process.cwd(), args.participants);
  if (!existsSync(participantsPath)) { console.error(err(`参加者CSVが見つかりません: ${participantsPath}`)); process.exit(1); }

  let template = null;
  if (args.template) {
    const templatePath = resolve(process.cwd(), args.template);
    if (!existsSync(templatePath)) { console.error(err(`テンプレが見つかりません: ${templatePath}`)); process.exit(1); }
    template = readFileSync(templatePath, "utf8");
  }

  const records = parseCsv(readFileSync(participantsPath, "utf8"));
  if (records.length === 0) { console.error(err("参加者が0件です。CSVの中身を確認してください。")); process.exit(1); }

  log(`${c.bold}会議フィードバック 個別DM 送信${c.reset}`);
  log(`参加者: ${c.cyan}${records.length}${c.reset} 名   間隔: ${args.delay}ms   文面: ${template ? "自前テンプレ" : "自動生成"}   ${args.dryRun ? warn("[DRY-RUN: 実送信なし]") : ok("[本番送信]")}`);
  log(dim("─".repeat(56)));

  const logFile = join(__dirname, `feedback-log-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
  appendFileSync(logFile, "index,target,user_id,status,detail\n");

  let success = 0, failed = 0;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const label = pick(rec, ["name", "お名前", "氏名", "名前"]) ||
      pick(rec, ["email", "メールアドレス"]) ||
      pick(rec, ["slack_id"]) || `#${i + 1}`;
    const num = `${String(i + 1).padStart(String(records.length).length, " ")}/${records.length}`;
    const body = template
      ? renderTemplate(template, recordWithComputed(rec, args.lowThreshold))
      : buildFeedbackMessage(rec, args.lowThreshold);

    try {
      const liveLookup = !!token;
      const userId = await resolveUserId(rec, token, liveLookup);

      if (args.dryRun) {
        log(`${dim(num)} ${ok("✓")} ${label} ${dim(`(${userId})`)}`);
        log(dim("    " + body.split("\n").join("\n    ")));
        log("");
        appendFileSync(logFile, `${i + 1},"${label}",${userId},dry-run,\n`);
        success++;
        continue;
      }

      const conv = await slackApi("conversations.open", token, { users: userId });
      await slackApi("chat.postMessage", token, {
        channel: conv.channel.id,
        text: body,
      });
      log(`${dim(num)} ${ok("✓ 送信")} ${label} ${dim(`(${userId})`)}`);
      appendFileSync(logFile, `${i + 1},"${label}",${userId},sent,\n`);
      success++;
    } catch (e) {
      log(`${dim(num)} ${err("✗ 失敗")} ${label} ${dim("— " + e.message)}`);
      appendFileSync(logFile, `${i + 1},"${label}",,error,"${e.message}"\n`);
      failed++;
    }

    if (!args.dryRun && i < records.length - 1) await sleep(args.delay);
  }

  log(dim("─".repeat(56)));
  log(`完了: ${ok(`成功 ${success}`)} / ${failed ? err(`失敗 ${failed}`) : `失敗 ${failed}`}`);
  log(dim(`ログ: ${logFile}`));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(err("予期しないエラー: " + (e.stack || e.message))); process.exit(1); });
