// #04_案件相談シートの全員を、社内版の「お客様」に読み込めるファイルにする
// 使い方: node tools/export-customers.js <sheets.json> <出力フォルダ>
//   出力 loandesk_customers_YYYYMMDD.json には姓・担当・条件が入る。リポジトリの外にだけ書く（中は断る）
//   画面の「お客様を保存する」→「読み込む」で端末に入れる
const fs = require("fs");
const path = require("path");
const C = require("../lib/customers.js");
const { fromSheet } = require("./sheet-map.js");
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("使い方: node tools/export-customers.js <sheets.json> <出力フォルダ>"); process.exit(1); }
const dir = path.resolve(out), repo = path.resolve(__dirname, "../..");
if (dir === repo || dir.startsWith(repo + path.sep)) { console.error("出力先がリポジトリの中です。お客様の名前が入るので、リポジトリの外を指定してください"); process.exit(1); }
const sheets = JSON.parse(fs.readFileSync(src, "utf8"));
let list = [], bad = [];
for (const s of sheets) {
  const m = fromSheet(s);
  const input = { pref: m.pref, employ: m.employ, single: s.single === true, motive: false, rej: 0, rejected: [], posted: s.posted || "", flag: m.flag, notes: m.notes.join("／") };
  if (s.age > 0) input.age = s.age;
  if (s.income_man > 0) input.income = s.income_man;
  if (s.tenure_years != null) input.tenure = s.tenure_years;
  if (m.loan) input.loan = m.loan;
  input.debt = m.debt;
  const r = C.save(list, { initials: s.surname || "", staff: s.staff || "", input }, (s.posted || "") + " 00:00");
  if (r.ok) list = r.list; else bad.push(s.surname || "?");
}
const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const file = path.join(dir, `loandesk_customers_${date}.json`);
fs.writeFileSync(file, C.exportText(list, new Date().toISOString().slice(0, 10)));
console.log(`${list.length}人を書き出しました（読めなかった ${bad.length}人: ${bad.join("・") || "なし"}）`, file);
