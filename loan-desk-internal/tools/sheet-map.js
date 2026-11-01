// #04_案件相談シートの1人分を、社内版の入力に直す（run-sheets.js と export-customers.js で共通）
// お客様の情報そのものはここに入れない（変換のきまりだけ）
const LSA = require("../../loan-screening-app/lib/screening.js");
const EMP = { "上場/大企業": "large", "中小": "regular", "公務員": "public", "契約/派遣": "contract", "自営": "self", "不明": "regular" };
const PREFS = ["茨城", "栃木", "群馬", "埼玉", "千葉", "福島", "東京", "神奈川"];
const normPref = (p) => (p ? PREFS.find((k) => String(p).includes(k)) || String(p).replace(/[県都府]$/, "") : "");
const STD = 2500, RATE = 0.9;

// 戻り値: { pref, miss[], flag, loan, debt, employ, notes[] }
function fromSheet(s) {
  const miss = [];
  if (!(s.age > 0)) miss.push("年齢");
  if (!(s.income_man > 0)) miss.push("年収");
  if (s.tenure_years == null) miss.push("勤続");
  const pref = normPref(s.property_pref) || normPref(s.pref);
  const employ = s.self_employed ? "self" : EMP[s.employer_cat] || "regular";
  const notes = [];
  if (miss.length) return { pref, miss, employ, flag: "未記入: " + miss.join("・"), notes, loan: 0, debt: 0 };
  let loan = STD;
  if (s.desired_monthly_man > 0) loan = Math.min(STD, Math.floor(LSA.pv(s.desired_monthly_man, RATE, Math.min(35, 80 - s.age)) / 10) * 10);
  else notes.push("借入額は仮に2,500万");
  if (80 - s.age < 35) notes.push(`返済期間${80 - s.age}年（80歳完済）`);
  if (s.loan_balance_man > 500) return { pref, miss, employ, loan, debt: 0, notes, flag: `個別判断（借入残高 ${Math.round(s.loan_balance_man)}万）` };
  let debt = 0;
  if (s.loan_balance_man > 0) { debt = Math.round((s.loan_balance_man / 48) * 10) / 10; notes.push(`他の借入 残高${s.loan_balance_man}万→毎月${debt}万で仮置き`); }
  else if (s.car_loan === true || s.loans_count > 0) { debt = 3; notes.push("車ローン等の毎月額 要確認（仮に3万）"); }
  return { pref, miss, employ, loan, debt, notes, flag: "" };
}
module.exports = { fromSheet, normPref, EMP, STD, RATE };
