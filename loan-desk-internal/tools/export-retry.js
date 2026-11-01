// 否決されて、まだ本審査を通っていないお客様を「再挑戦」用に社内版へ読み込めるファイルにする
// 使い方: node tools/export-retry.js <案件表.csv> <名前の対応.json> <sheets.json> <出力フォルダ>
//   案件表・名前の対応・相談シートはお客様の情報なので、すべてリポジトリの外に置く。出力も外にだけ書く
//   出力 loandesk_customers_retry_YYYYMMDD.json を画面の「読み込む」で入れる（相談シートの同じお客様には履歴が足される）
const fs = require("fs");
const path = require("path");
const C = require("../lib/customers.js");
const O = require("../lib/outcomes.js");
const { fromSheet, normPref, EMP } = require("./sheet-map.js");
const [csvFile, mapFile, sheetsFile, out] = process.argv.slice(2);
if (!csvFile || !mapFile || !sheetsFile || !out) { console.error("使い方: node tools/export-retry.js <案件表.csv> <名前の対応.json> <sheets.json> <出力フォルダ>"); process.exit(1); }
const dir = path.resolve(out), repo = path.resolve(__dirname, "../..");
if (dir === repo || dir.startsWith(repo + path.sep)) { console.error("出力先がリポジトリの中です。お客様の名前が入るので、リポジトリの外を指定してください"); process.exit(1); }

const text = fs.readFileSync(csvFile, "utf8").replace(/^﻿/, "");
const lines = text.trim().split(/\r?\n/), head = lines[0].split(",");
const parse = (l) => { const o = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
const rows = lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));           // { 名前: id }
const nameOf = Object.fromEntries(Object.entries(map).map(([n, id]) => [id, n]));
const sheets = JSON.parse(fs.readFileSync(sheetsFile, "utf8"));
const flat = (s) => String(s || "").replace(/\s/g, "");

const by = {};
for (const r of rows) (by[r.id] = by[r.id] || []).push(r);
let list = [], skipped = { passed: 0, noName: 0 };
for (const [id, rs] of Object.entries(by)) {
  if (!rs.some((r) => r.outcome === "reject")) continue;
  const history = rs.filter((r) => r.outcome === "approve" || r.outcome === "reject").map((r) => C.cleanHist({
    lender: O.normLender(r.lender), stage: r.stage === "main" ? "main" : "pre", result: r.outcome === "approve" ? "pass" : "reject",
    month: r.date, reason: r.outcome === "reject" ? O.reasonOf(r.reject_reason_tag, r.note) : undefined })).filter(Boolean);
  if (history.some((h) => h.result === "pass" && h.stage === "main")) { skipped.passed++; continue; }   // 本審査まで通った人は除く
  const name = nameOf[id];
  if (!name) { skipped.noName++; continue; }
  const sheet = sheets.find((s) => flat(s.name) === flat(name)) || sheets.find((s) => s.surname && flat(name).startsWith(s.surname) && name.length <= 2);
  const surname = sheet ? sheet.surname : name.length <= 2 ? name : name.slice(0, 2);
  const first = rs.find((r) => r.age) || rs[0];
  const input = { history, rej: 0, rejected: [], motive: false };
  if (sheet) {
    const m = fromSheet(sheet);
    Object.assign(input, { pref: m.pref, employ: m.employ, single: sheet.single === true, posted: sheet.posted || "", notes: m.notes.join("／") });
    if (sheet.age > 0) input.age = sheet.age; if (sheet.income_man > 0) input.income = sheet.income_man; if (sheet.tenure_years != null) input.tenure = sheet.tenure_years;
    if (m.loan) input.loan = m.loan; input.debt = m.debt; if (m.flag) input.flag = m.flag;
  } else {
    Object.assign(input, { pref: normPref(first.pref_city), employ: EMP[first.employ_cat] || "regular", single: first.single === "Y", posted: "" });
    if (+first.age) input.age = +first.age; if (+first.income_man) input.income = +first.income_man; if (first.tenure_years !== "") input.tenure = +first.tenure_years || undefined;
    if (+first.loan_man) input.loan = +first.loan_man;
  }
  if (!(input.age > 0 && input.income > 0)) input.flag = "条件 未入力（年齢・年収を入れてから再挑戦を見る）";
  const r = C.save(list, { initials: surname, staff: sheet ? sheet.staff || "" : "", input }, (history.map((h) => h.month).filter(Boolean).sort().pop() || "") + " 00:00");
  if (r.ok) list = r.list;
}
const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const file = path.join(dir, `loandesk_customers_retry_${date}.json`);
fs.writeFileSync(file, C.exportText(list, new Date().toISOString().slice(0, 10)));
console.log(`${list.length}人（本審査まで通った ${skipped.passed}人と名前の分からない ${skipped.noName}人を除く）`, file);
