#!/usr/bin/env node
/**
 * slack-bulk-dm — 宛先リストの一人ひとりに「個別DM」を一斉送信するCLI。
 *
 * グループDMではなく各人へ個別に届くため、受け取った側は「自分だけに来た」
 * と感じる。名前などの差し込みにも対応。
 *
 * 使い方:
 *   node send.js --recipients recipients.csv --message message.txt
 *   node send.js -r list.csv -m msg.txt --dry-run        # 送信せずプレビュー
 *   node send.js -r list.csv -m msg.txt --delay 1500     # 送信間隔(ms)
 *
 * 宛先CSVは email 列または slack_id 列のどちらか（両方あれば slack_id 優先）を持つ。
 * その他の列（name 等）は本文の {{列名}} に差し込める。
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
  const args = { delay: 1000, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-r": case "--recipients": args.recipients = next(); break;
      case "-m": case "--message": args.message = next(); break;
      case "-d": case "--delay": args.delay = Number(next()); break;
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
  log(`${c.bold}slack-bulk-dm${c.reset} — 個別DMの一斉送信CLI

${c.bold}必須:${c.reset}
  -r, --recipients <file>  宛先CSV（email 列 か slack_id 列が必要）
  -m, --message <file>     本文テキスト（{{列名}} で差し込み可）

${c.bold}任意:${c.reset}
  -d, --delay <ms>         送信間隔ミリ秒（既定 1000）
      --token <xoxb-...>   Slack Bot Token（未指定なら環境変数/.env を使用）
      --dry-run            実際には送らず、宛先解決と本文プレビューだけ行う
  -h, --help               このヘルプ

${c.bold}例:${c.reset}
  node send.js -r recipients.csv -m message.txt --dry-run
  node send.js -r recipients.csv -m message.txt --delay 1500
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

// ---- Slack Web API 呼び出し ---------------------------------------------
async function slackApi(method, token, params) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(params),
  });
  // レート制限なら少し待って1回だけ再試行
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
// liveLookup=false のとき（トークン無しの dry-run など）はメール解決を実APIで行わず、
// プレビュー用の暫定ラベルを返す。
async function resolveUserId(record, token, liveLookup) {
  const slackId = pick(record, ["slack_id", "slackid", "user_id", "userid", "id"]);
  if (slackId && isSlackId(slackId)) return slackId;

  const email = pick(record, ["email", "mail", "メール", "メールアドレス"]);
  if (email) {
    if (!liveLookup) return `email:${email}`; // 実送信時に解決
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

  // 入力チェック
  const problems = [];
  if (!args.recipients) problems.push("--recipients (宛先CSV) が必要です");
  if (!args.message) problems.push("--message (本文テキスト) が必要です");
  if (!args.dryRun && !token) problems.push("SLACK_BOT_TOKEN が未設定です（.env か --token、または --dry-run を使用）");
  if (problems.length) {
    for (const p of problems) console.error(err("✗ " + p));
    log(dim("\n--help でヘルプを表示します。"));
    process.exit(1);
  }

  const recipientsPath = resolve(process.cwd(), args.recipients);
  const messagePath = resolve(process.cwd(), args.message);
  if (!existsSync(recipientsPath)) { console.error(err(`宛先CSVが見つかりません: ${recipientsPath}`)); process.exit(1); }
  if (!existsSync(messagePath)) { console.error(err(`本文ファイルが見つかりません: ${messagePath}`)); process.exit(1); }

  const records = parseCsv(readFileSync(recipientsPath, "utf8"));
  const template = readFileSync(messagePath, "utf8");
  if (records.length === 0) { console.error(err("宛先が0件です。CSVの中身を確認してください。")); process.exit(1); }

  log(`${c.bold}Slack 個別DM 一斉送信${c.reset}`);
  log(`宛先: ${c.cyan}${records.length}${c.reset} 件   間隔: ${args.delay}ms   ${args.dryRun ? warn("[DRY-RUN: 実送信なし]") : ok("[本番送信]")}`);
  log(dim("─".repeat(56)));

  const logFile = join(__dirname, `send-log-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
  appendFileSync(logFile, "index,target,user_id,status,detail\n");

  let success = 0, failed = 0;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const label = pick(rec, ["name", "お名前", "氏名", "名前"]) ||
      pick(rec, ["email", "メールアドレス"]) ||
      pick(rec, ["slack_id"]) || `#${i + 1}`;
    const num = `${String(i + 1).padStart(String(records.length).length, " ")}/${records.length}`;
    const body = renderTemplate(template, rec);

    try {
      const liveLookup = !!token; // トークンがあればメール解決を実行（dry-runでも検証になる）
      const userId = await resolveUserId(rec, token, liveLookup);

      if (args.dryRun) {
        log(`${dim(num)} ${ok("✓")} ${label} ${dim(`(${userId})`)}`);
        log(dim("    " + body.split("\n").join("\n    ")));
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
