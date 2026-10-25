// node test.js — 住宅ローン控除エンジンの検算（依存なし）
const assert = require("assert");
const T = require("./taxcredit");
const base = { moveInYear: 2027, moveInMonth: 3, age: 35, married: false, under19Dep: false, gross: 5_500_000, socialRate: 0.15,
  taxMode: "estimate", loanYears: 35, rate: 0.015, floor: 85, certs: true, seismicOK: true, redZone: false, fromRelative: false,
  kind: "new", perf: "zeh", loan: 32_000_000, price: 35_000_000 };
const sim = (o) => T.simulate({ ...base, ...o });
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// 返済：元利均等の検算（35年で残高0、毎月返済額）
ok(Math.round(T.payment(32e6, 0.015, 35)) === 97_979, "毎月返済額");
ok(Math.round(T.balanceAfter(32e6, 0.015, 35, 420)) === 0, "完済で残高0");
// 税額の概算（年収550万円・社保15%・令和8/9年分）
const t = T.estimateTax(5_500_000, 2027);
ok(t.totalIncome === 3_960_000 && t.taxable === 2_095_000 && t.incomeTax === 112_000, "所得税の概算");
// 区分ごとの限度額・期間
ok(sim({}).judge.limit === 35e6 && sim({}).judge.years === 13, "新築ZEH 3,500万・13年");
ok(sim({ perf: "energy" }).judge.limit === 20e6, "新築省エネ 2,000万");
ok(!sim({ perf: "other" }).judge.ok, "新築その他（2024年以降確認）は対象外");
ok(sim({ perf: "other", confirmDate: "2023-10-01" }).judge.years === 10, "新築その他の経過措置 10年");
ok(!sim({ perf: "energy", moveInYear: 2028, confirmDate: "2028-01-10" }).judge.ok, "2028年入居・2028年確認の省エネ新築は対象外");
ok(sim({ perf: "energy", moveInYear: 2028, confirmDate: "2027-12-31" }).judge.years === 10, "経過措置 2,000万・10年");
ok(sim({ kind: "used", perf: "other" }).judge.years === 10, "中古その他 10年");
ok(sim({ kind: "used", perf: "zeh" }).judge.limit === 35e6 && sim({ kind: "used", perf: "zeh" }).judge.years === 13, "中古ZEH 3,500万・13年");
ok(sim({ kind: "used", perf: "energy" }).judge.years === 13, "中古省エネ 13年");
ok(!sim({ kind: "used", perf: "other", seismicOK: false }).judge.ok, "耐震未証明の中古は対象外");
ok(!sim({ floor: 39 }).judge.ok && !sim({ loanYears: 9 }).judge.ok && !sim({ fromRelative: true }).judge.ok, "床面積・期間・取得先");
ok(sim({ perf: "zeh", certs: false }).judge.perf === "other", "証明書なしは「その他」扱い");
ok(sim({ married: true, age: 35 }).judge.limit === 45e6, "若者夫婦の上乗せ");
ok(sim({ married: true, age: 35, floor: 45 }).judge.limit === 35e6, "上乗せは50㎡以上");
ok(!sim({ redZone: true, moveInYear: 2028 }).judge.ok, "2028年以降のレッドゾーン新築は対象外");
// 控除の充当：実際の控除 = 所得税 + 住民税（上限） ≤ 制度上の上限、控除しきれない額は加算しない
const s = sim({});
s.rows.filter((r) => r.inPeriod).forEach((r) => {
  ok(r.actual + r.unused === r.max, "上限 = 実際 + 控除しきれない額");
  ok(r.fromRT <= T.RESIDENT_CAP && r.fromIT <= r.tax.incomeTax, "所得税・住民税の上限");
});
ok(s.first === 209_500 && s.totalUnused > 0, "初年度は税額が上限（控除しきれない額あり）");
ok(sim({ taxMode: "detail", detail: { totalIncome: 3_960_000, incomeTax: 50_000, taxable: 1_000_000, residentTax: 200_000 } }).first === 100_000, "詳細モード：所得税5万＋住民税5万");
console.log(`ok — ${n} assertions`);
