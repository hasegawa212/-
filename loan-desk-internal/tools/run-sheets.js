// #04_案件相談シート の全員を、審査エンジン＋社内版にかける
// 使い方: node tools/run-sheets.js <sheets.json> [出力フォルダ]
//   sheets.json は相談シートから抜き出したもの（お客様の情報を含むため、リポジトリの外に置く）
//   出力の「試算結果_全員.md」にも名前が入るので、リポジトリの外に出す。リポジトリ内のパスは受け付けない
// 前提: 借入額＝希望収支から逆算（上限2,500万）、車ローン月額が不明なら仮に3万、返済期間は80歳完済まで、
//       借入残高500万超は「個別判断」
const path = require("path");
const LSA = require("../../loan-screening-app/lib/screening.js");
const R = require("../lib/recommend.js");
const fs = require("fs");
const src = process.argv[2];
if (!src) { console.error("使い方: node tools/run-sheets.js <sheets.json> [出力フォルダ]"); process.exit(1); }
const dir = path.resolve(process.argv[3] || path.dirname(src));
const repo = path.resolve(__dirname, "../..");
if (dir === repo || dir.startsWith(repo + path.sep)) { console.error("出力先がリポジトリの中です。お客様の名前が入るので、リポジトリの外を指定してください"); process.exit(1); }
const sheets = JSON.parse(fs.readFileSync(src, "utf8"));
const { fromSheet } = require("./sheet-map.js");
const rows = [];
for (const s of sheets) {
  const m = fromSheet(s);
  const { pref, loan, debt, employ, notes } = m;
  if (m.flag) { rows.push({ s, pref, skip: m.miss.length ? m.flag : m.flag.replace(/）$/, "。投資用ローン等は家賃収入との相殺を含めて金融機関と個別に）") }); continue; }
  const x = Object.assign({}, LSA.SAMPLE, {
    pref, age: s.age, income: s.income_man, incomePrev: s.income_man, incomePrev2: s.income_man, tenure: s.tenure_years, employ,
    single: s.single === true, motiveDoc: false, price: loan, down: 0, costs: 0, collateral: loan, car: debt, scholarship: 0, rate: 0.9,
    term: Math.min(35, 80 - s.age),
    property: s.house_type === "マンション" ? "usedMansion" : "usedHouse", builtYears: 20, floor: 90,
  });
  const r = R.recommend(x);
  const top = r.planItems[0];
  rows.push({ s, pref, loan, debt, employ, notes, r, top,
    dec: top ? top.screen.decisionInfo.label : "出せる候補なし",
    maxLoan: top ? top.screen.maxLoan : 0, dti: top ? Math.round(top.screen.dti * 10) / 10 : null });
}
// 集計
const done = rows.filter((x) => !x.skip);
const by = {}; for (const x of done) by[x.dec] = (by[x.dec] || 0) + 1;
const firsts = {}; for (const x of done) if (x.top) firsts[x.top.lender.name] = (firsts[x.top.lender.name] || 0) + 1;
console.log(JSON.stringify({ total: rows.length, run: done.length, skipped: rows.length - done.length, decisions: by, firstLender: firsts }, null, 1));
// 一覧（scratchpad の private md）
const L = [];
L.push("# #04_案件相談シート 全員の試算（社外秘・リポジトリに入れない）", "", `作成: ${new Date().toISOString().slice(0, 10)}／借入額は希望収支から逆算（上限2,500万）。金利0.9%・35年・審査は各型の審査金利。目安で、承認を約束するものではない。`, "");
L.push("| お客様 | 掲載 | 担当 | 県 | 年齢 | 年収 | 勤続 | 雇用 | 単身 | 借入(試算) | 判定（第一候補） | 負担率 | 融資可能額 | 出す順番 | 最初には出さない | 要確認 |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const x of rows.sort((a, b) => (b.s.posted || "").localeCompare(a.s.posted || ""))) {
  const s = x.s;
  if (x.skip) { L.push(`| ${s.surname || "?"} | ${s.posted || ""} | ${s.staff || ""} | ${x.pref} | ${s.age ?? ""} | ${s.income_man ?? ""} | ${s.tenure_years ?? ""} | ${s.employer_cat || ""} | ${s.single == null ? "?" : s.single ? "○" : "×"} | — | ${x.skip} | | | | | |`); continue; }
  const order = x.r.planItems.map((c) => c.lender.name).join(" → ") || "—";
  const avoid = x.r.avoid.map((c) => c.lender.name).join("・");
  L.push(`| ${s.surname} | ${s.posted || ""} | ${s.staff || ""} | ${x.pref} | ${s.age} | ${s.income_man} | ${s.tenure_years} | ${s.employer_cat || ""} | ${s.single == null ? "?" : s.single ? "○" : "×"} | ${x.loan} | ${x.dec} | ${x.dti ?? ""}% | ${x.maxLoan} | ${order} | ${avoid} | ${x.notes.join("／")} |`);
}
fs.writeFileSync(dir + "/試算結果_全員.md", L.join("\n"));
console.log("wrote", dir + "/試算結果_全員.md");
