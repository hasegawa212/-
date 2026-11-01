// 否決の記録を集計して data/outcomes.js を作る（お客様単位の行は書き出さない。金融機関ごとの件数だけ）
// 使い方: node tools/build-outcomes.js <案件表.csv>   ※案件表はリポジトリに入れない
// 列: id,date,...,single,...,lender,lender_type,stage,outcome,reject_reason_tag,source,note
const fs = require("fs");
const path = require("path");
const { normLender, reasonOf } = require("../lib/outcomes.js");
const file = process.argv[2];
if (!file) { console.error("使い方: node tools/build-outcomes.js <案件表.csv>"); process.exit(1); }
const csv = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = csv.trim().split(/\r?\n/);
const head = lines[0].split(",");
const parse = (l) => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const rows = lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const by = {};
const blank = () => ({ pre: { pass: 0, reject: 0 }, main: { pass: 0, reject: 0 }, single: { pass: 0, reject: 0 }, reasons: {} });
let from = "9999-99", to = "0000-00";
for (const r of rows) {
  if (r.outcome !== "approve" && r.outcome !== "reject") continue;
  const name = normLender(r.lender);
  const o = (by[name] = by[name] || blank());
  const k = r.outcome === "approve" ? "pass" : "reject";
  o[r.stage === "main" ? "main" : "pre"][k]++;
  if (r.single === "Y") o.single[k]++;
  if (k === "reject") { const t = reasonOf(r.reject_reason_tag, r.note); o.reasons[t] = (o.reasons[t] || 0) + 1; }
  if (r.date) { if (r.date < from) from = r.date; if (r.date > to) to = r.date; }
}
const out = `// 社外秘：否決の記録の集計（金融機関ごとの件数だけ。お客様の行・名前・日付は入れない）
// tools/build-outcomes.js で、リポジトリの外にある案件表から作る。手で直さない
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const OUTCOMES_PERIOD = ${JSON.stringify(from.replace("-", "/") + "〜" + to.replace("-", "/"))};
  const OUTCOMES = ${JSON.stringify(by, null, 1).replace(/\n\s*/g, " ")};
  return { OUTCOMES_PERIOD, OUTCOMES };
});
`;
fs.writeFileSync(path.join(__dirname, "../data/outcomes.js"), out);
console.log(`${Object.keys(by).length} 金融機関、期間 ${from}〜${to} を data/outcomes.js に書きました`);
