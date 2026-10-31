// 答え合わせ: 匿名化した案件表（CSV）を審査エンジンにかけ、実際の結果と比べる
// 使い方: node tools/calibrate.js <案件表.csv> [借入額が空のときの仮の借入額(万円)] [v=1件ずつ表示]
//   APPLY=1 を付けると、同じお客様の前の申込件数と否決件数を入れて計算する
// 案件表はリポジトリに入れない（名前を伏せていてもお客様単位のデータのため）
// 列: id,date,age,income_man,tenure_years,employ_cat,single,other_debt_monthly_man,...,loan_man,lender_type,stage,outcome,note
const L = require("../../loan-screening-app/lib/screening.js");
const fs = require("fs");
const csv = fs.readFileSync(process.argv[2], "utf8").replace(/^﻿/, "");
const lines = csv.trim().split(/\r?\n/);
const head = lines[0].split(",");
const parse = (l) => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const rows = lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const PRESET = { shinkin: "shinkin", regional: "regional", rokin: "rokin", net: "net", JA: "regional", kumiai: "regional", megabank: "megabank", flat35: "flat35" };
const EMP = { "上場/大企業": "large", "中小": "regular", "公務員": "public", "契約/派遣": "contract", "自営": "self" };
const useLoan = process.argv[3] ? +process.argv[3] : null;
const res = [];
const seen = {}, rej = {};
for (const r of rows) {
  if (!(r.age && r.income_man && r.tenure_years) || r.outcome === "pending" || !PRESET[r.lender_type]) continue;
  if (/業者NG/.test(r.note || "")) continue; // 属性ではない否決は除外
  const loan = +r.loan_man || useLoan; if (!loan) continue;
  const x = { age: +r.age, income: +r.income_man, incomePrev: +r.income_man, incomePrev2: +r.income_man, tenure: +r.tenure_years, employ: EMP[r.employ_cat] || "regular",
    price: loan, down: 0, costs: 0, car: 0, collateral: loan, scholarship: 0, term: 35, rate: 0.9, flatRate: 3.46, property: "usedHouse", builtYears: 15, landArea: 0, floor: 90,
    stage: r.stage === "main" ? "main" : "pre", docs: { income: true, id: true, property: true, contract: true, danshin: true, tax: true, corp: true, fit: true, member: true } };
  if (process.env.APPLY) { const k = r.id; const prior = seen[k] || 0; x.credit = { cic: { late: "none", apply: prior }, jicc: { late: "none", apply: 0 }, ksc: { late: "none", apply: prior, kanpo: false } }; if (r.stage === "pre") seen[k] = prior + 1; x.priorRejects = rej[k] || 0; x.single = r.single === "Y"; }
  const s = L.screen(x, PRESET[r.lender_type], { now: "x" });
  if (process.env.APPLY && r.outcome === "reject") rej[r.id] = (rej[r.id] || 0) + 1;
  const pred = s.decision === "approve" || s.decision === "conditional" ? "approve" : "reject"; const strict = s.decision === "approve" ? "approve" : "reject";
  res.push({ strict, id: r.id, lt: r.lender_type, emp: r.employ_cat, inc: +r.income_man, loan, actual: r.outcome, pred, dec: s.decision, dti: Math.round(s.dti), ng: s.checks.filter((c) => c.status === "ng").map((c) => c.key).join("|") });
}
const ok = res.filter((r) => r.pred === r.actual).length;
console.log("customers", new Set(res.map((r) => r.id)).size, "approve caught", res.filter((r) => r.actual === "approve" && r.pred === "approve").length + "/" + res.filter((r) => r.actual === "approve").length, "reject caught", res.filter((r) => r.actual === "reject" && r.pred === "reject").length + "/" + res.filter((r) => r.actual === "reject").length);
console.log(`loan=${useLoan || "known"} n=${res.length} 一致=${ok} (${Math.round(ok / res.length * 100)}%)`);
const cm = {}; for (const r of res) cm[r.actual + "→" + r.pred] = (cm[r.actual + "→" + r.pred] || 0) + 1; console.log(JSON.stringify(cm));
if (process.argv[4]) for (const r of res) console.log(r.lt, r.emp, r.inc, r.loan, "実際", r.actual, "アプリ", r.dec, "DTI", r.dti, r.ng);
const ok2 = res.filter((r) => r.strict === r.actual).length;
console.log(`「承認見込み」だけを通過とみなすと 一致=${ok2}/${res.length}`);
const byLt = {}; for (const r of res) { const k = r.lt; byLt[k] = byLt[k] || { n: 0, ok: 0 }; byLt[k].n++; if (r.pred === r.actual) byLt[k].ok++; } console.log(JSON.stringify(byLt));
