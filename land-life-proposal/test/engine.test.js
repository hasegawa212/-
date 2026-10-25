// node --test test/  — 計算エンジンの検算（依存なし）
const test = require("node:test");
const assert = require("node:assert/strict");
const LL = require("../lib/engine");
const R = require("../lib/rules");

const S = LL.SAMPLE;
const C = { ...S.customer, loanYears: 35 };
const A = S.props[0], B = S.props[1];
const loanA = { amount: 32_000_000, rate: 0.015, years: 35 };
const judgeWith = (p, c = {}) => LL.judge({ ...C, ...c }, { ...A, ...p });

test("住宅ローン：元利均等の計算式", () => {
  assert.equal(Math.round(LL.payment(32e6, 0.015, 35)), 97_979);
  assert.equal(Math.round(LL.balanceAfter(32e6, 0.015, 35, 420)), 0);
  // 元金の合計＝借入額（毎月の元金を足し上げる）
  let bal = 32e6, sum = 0;
  const pm = LL.payment(32e6, 0.015, 35);
  for (let k = 0; k < 420; k++) { const prin = pm - bal * 0.015 / 12; sum += prin; bal -= prin; }
  assert.ok(Math.abs(sum - 32e6) < 1);
  assert.equal(Math.round(LL.balanceAfter(32e6, 0.015, 35, 120)), 24_498_655);
  assert.equal(LL.payment(0, 0.015, 35), 0);
});

test("税額の概算（年収550万円・社会保険料15%・2027年）", () => {
  const t = LL.estimateTax(5_500_000, 2027);
  assert.equal(t.totalIncome, 3_960_000);   // 550万 − 給与所得控除154万
  assert.equal(t.taxable, 2_095_000);       // 396万 − 社保82.5万 − 基礎控除104万
  assert.equal(t.incomeTax, 112_000);       // 209.5万×10% − 97,500
  assert.equal(t.residentTax, 268_000);     // (396 − 82.5 − 43)万×10% − 2,500
  assert.ok(t.takeHome > 4_200_000 && t.takeHome < 4_400_000);
  assert.equal(LL.estimateTax(5_500_000, 2029).incomeTax, 112_000, "保守的前提：2028年以降も同じ税額");
  assert.ok(LL.estimateTax(5_500_000, 2029, 0.15, false).incomeTax > 112_000, "現行法どおりなら2028年以降は増える");
});

test("控除：区分ごとの借入限度額・控除期間（2027年入居・単身）", () => {
  const cases = [
    [{ kind: "new", perf: "certified" }, 45e6, 13], [{ kind: "new", perf: "zeh" }, 35e6, 13], [{ kind: "new", perf: "energy" }, 20e6, 13],
    [{ kind: "used", perf: "certified" }, 35e6, 13], [{ kind: "used", perf: "zeh" }, 35e6, 13], [{ kind: "used", perf: "energy" }, 20e6, 13],
    [{ kind: "used", perf: "other", certs: false }, 20e6, 10], [{ kind: "resale", perf: "zeh" }, 35e6, 13],
  ];
  for (const [p, limit, years] of cases) {
    const j = judgeWith(p);
    assert.equal(j.ok, true, JSON.stringify(p));
    assert.equal(j.limit, limit, JSON.stringify(p));
    assert.equal(j.years, years, JSON.stringify(p));
    assert.equal(j.rate, 0.007);
  }
});

test("控除：対象外・経過措置", () => {
  assert.equal(judgeWith({ perf: "other", certs: false }).ok, false, "新築その他（2024年以降確認）");
  assert.equal(judgeWith({ perf: "other", certs: false, confirmDate: "2023-11-01" }).years, 10, "新築その他の経過措置");
  assert.equal(judgeWith({ perf: "energy", confirmDate: "2028-02-01", builtDate: "2028-09-01" }, { moveInYear: 2028 }).ok, false);
  const t = judgeWith({ perf: "energy", confirmDate: "2027-12-31" }, { moveInYear: 2028 });
  assert.equal(t.ok && t.limit === 20e6 && t.years === 10, true, "2028年入居・2027年確認は2,000万・10年");
  assert.equal(judgeWith({ redZone: true }, { moveInYear: 2028 }).ok, false, "2028年以降のレッドゾーン新築");
  assert.equal(judgeWith({ redZone: true }).ok, true, "2027年入居はレッドゾーンでも可");
  assert.equal(judgeWith({ floor: 39 }).ok, false);
  assert.equal(judgeWith({ fromRelative: true }).ok, false);
  assert.equal(judgeWith({ moveInOK: false }).ok, false);
  assert.equal(judgeWith({}, { loanYears: 9 }).ok, false);
  assert.equal(judgeWith({ kind: "used", perf: "other", builtDate: "1980-05-01" }).ok, false, "旧耐震・証明なし");
  assert.equal(judgeWith({ kind: "used", perf: "other", builtDate: "1980-05-01", seismicCert: true }).ok, true, "旧耐震・証明あり");
  assert.equal(judgeWith({ perf: "zeh", certs: false }).ok, false, "証明書なしの新築→その他扱い→対象外");
  assert.equal(judgeWith({}, { moveInYear: 2031 }).ok, false, "データ外の入居年");
});

test("控除：子育て・若者夫婦の上乗せは単身者に自動適用しない", () => {
  assert.equal(judgeWith({}).limit, 35e6);
  assert.equal(judgeWith({}, { household: "married", age: 35 }).limit, 45e6);
  assert.equal(judgeWith({}, { under19Dep: true }).limit, 45e6);
  assert.equal(judgeWith({ floor: 45 }, { household: "married", age: 35 }).limit, 35e6, "上乗せは50㎡以上");
  assert.equal(judgeWith({}, { household: "married", age: 45, spouseAge: 42 }).limit, 35e6);
});

test("控除：年ごとの充当（上限と実際を区別し、控除しきれない額は加算しない）", () => {
  const s = LL.creditSimulate(C, A, loanA);
  for (const r of s.rows.filter((r) => r.inPeriod)) {
    assert.equal(r.actual + r.unused, r.max);
    assert.ok(r.fromIT <= r.tax.incomeTax);
    assert.ok(r.fromRT <= R.COMMON.residentCapMax && r.fromRT <= Math.floor(r.tax.taxable * 0.05));
    assert.equal(r.max % 100, 0);
  }
  assert.equal(s.firstMax, 220_300);  // 年末残高3,147.6万×0.7%
  assert.equal(s.first, 209_500);     // 所得税112,000 + 住民税97,500
  assert.ok(s.totalUnused > 0 && s.total < s.totalMax);
  assert.equal(s.rows.filter((r) => r.inPeriod).length, 13);
  // 詳細モード
  const d = LL.creditSimulate({ ...C, taxMode: "detail", tax: { totalIncome: 3_960_000, incomeTax: 50_000, taxable: 1_000_000, residentTax: 200_000 } }, A, loanA);
  assert.equal(d.first, 100_000);
  // 年末残高の手入力
  const o = LL.creditSimulate(C, { ...A, firstBalance: 20_000_000 }, loanA);
  assert.equal(o.rows[0].max, 140_000);
});

test("売却：仲介手数料の上限と手取り", () => {
  assert.equal(Math.round(LL.brokerFee(25_000_000)), 891_000);
  assert.equal(Math.round(LL.brokerFee(3_000_000)), 154_000);
  const flat = LL.SCENARIOS[1];
  const s = LL.saleAt(A, flat, 10, loanA);
  assert.equal(Math.round(s.total), 25_000_000);
  assert.equal(Math.round(s.net), Math.round(25_000_000 - LL.brokerFee(25_000_000) - 100_000 - 24_498_655));
  assert.ok(LL.valueAt(A, flat, 30).bldg >= A.bldgPrice * 0.1 - 1, "建物の下限10%");
});

test("比較・適合・まとめ計算", () => {
  const x = LL.compute(S);
  assert.equal(x.props.length, 2);
  assert.equal(Math.round(x.props[0].pmt), 97_979);
  assert.equal(Math.round(x.props[0].cashLeft), 550_000);
  assert.ok(Math.abs(x.props[0].ten.with - (x.props[0].ten.without - x.props[0].credit.first10)) < 1);
  assert.equal(x.props[1].credit.judge.years, 10);
  assert.equal(x.compare.rank[0], "house", "生活価値・自由度を重視する初期値では戸建てが上位");
  const cheap = LL.compare3({ life: 1, cost: 5, freedom: 1, upkeep: 5, asset: 1, liquidity: 5, future: 1 });
  assert.equal(cheap.rank[0], "rent", "身軽さ重視なら賃貸が上位");
  const f = x.props[0].fit;
  assert.equal(f.find((r) => r.key === "hazard").status, "unknown");
  assert.equal(f.find((r) => r.key === "parking").status, "ok");
  const risk = x.props[0].risk;
  assert.equal(risk.length, 3);
  assert.ok(risk[2].loanRatio > risk[0].loanRatio);
});
