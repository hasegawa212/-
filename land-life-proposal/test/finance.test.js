// TDD：マーシャルアーツ版で必要になる資金計画の機能（諸費用ローン・審査の返済比率・家賃並みで買える価格）
const test = require("node:test");
const assert = require("node:assert/strict");
const LL = require("../lib/engine");

test("諸費用ローン：諸費用を借入に含めると、手元から出るのは頭金だけ", () => {
  const p = { ...LL.SAMPLE.props[0], price: 30_000_000, down: 0, buyCostRate: 0.08, financeCosts: true };
  const x = LL.compute({ ...LL.SAMPLE, props: [p] }).props[0];
  assert.equal(x.loan.amount, 32_400_000, "借入＝価格−頭金＋諸費用");
  assert.equal(x.cashOut, 0, "初期費用（現金）は0");
  assert.equal(Math.round(x.loan.eligible), 30_000_000, "控除の対象は住宅の取得対価の部分だけ");
});

test("諸費用ローン：住宅ローン控除の年末残高は、住宅取得分の割合で按分する", () => {
  const base = { ...LL.SAMPLE.props[0], kind: "used", perf: "energy", certs: true, price: 30_000_000, down: 0, buyCostRate: 0.08 };
  const fin = LL.compute({ ...LL.SAMPLE, props: [{ ...base, financeCosts: true }] }).props[0];
  const r = fin.credit.rows[0];
  const ratio = 30_000_000 / 32_400_000;
  // 限度額2,000万円より残高が大きいので上限は同じ。按分の効果は限度額未満の年に出る → 残高按分そのものを検証
  assert.ok(Math.abs(r.eligibleBalance - r.balance * ratio) < 1);
  const big = LL.compute({ ...LL.SAMPLE, props: [{ ...base, perf: "zeh", financeCosts: true }] }).props[0];
  assert.equal(big.credit.rows[0].max, Math.floor((big.credit.rows[0].balance * ratio * 0.007) / 100) * 100, "ZEH（限度3,500万）では按分後の残高×0.7%");
});

test("諸費用ローンを使わない場合は従来どおり（回帰）", () => {
  const x = LL.compute(LL.SAMPLE).props[0];
  assert.equal(x.loan.amount, 32_000_000);
  assert.equal(x.loan.eligible, 32_000_000);
  assert.equal(x.credit.first, 209_500);
});

test("審査の返済比率：既存の借入を含め、審査金利で計算する", () => {
  const s = LL.screening({ gross: 4_500_000, existingMonthly: 20_000, loan: 30_000_000, years: 35, screenRate: 0.03 });
  const pm = LL.payment(30_000_000, 0.03, 35);
  assert.ok(Math.abs(s.ratio - (pm * 12 + 240_000) / 4_500_000) < 1e-9);
  assert.equal(s.limit, 0.35, "年収400万円以上は35%（フラット35の基準）");
  assert.equal(s.ok, s.ratio <= 0.35);
  assert.equal(LL.screening({ gross: 3_800_000, existingMonthly: 0, loan: 20_000_000, years: 35, screenRate: 0.03 }).limit, 0.3, "400万円未満は30%");
});

test("審査の返済比率：借入できる上限額を逆算する", () => {
  const s = LL.screening({ gross: 4_500_000, existingMonthly: 20_000, loan: 30_000_000, years: 35, screenRate: 0.03 });
  const atMax = LL.screening({ gross: 4_500_000, existingMonthly: 20_000, loan: s.maxLoan, years: 35, screenRate: 0.03 });
  assert.ok(Math.abs(atMax.ratio - 0.35) < 1e-6, "上限額で返済比率がちょうど35%");
  const none = LL.screening({ gross: 3_000_000, existingMonthly: 100_000, loan: 10_000_000, years: 35, screenRate: 0.03 });
  assert.equal(none.maxLoan, 0, "既存借入だけで基準を超えるなら0");
});

test("家賃並みで買える価格：毎月の返済額から物件価格を逆算する", () => {
  const a = LL.affordablePrice({ monthly: 100_000, rate: 0.015, years: 35, down: 0, costRate: 0.08, financeCosts: true });
  const loan = a.price - 0 + a.price * 0.08;
  assert.ok(Math.abs(LL.payment(loan, 0.015, 35) - 100_000) < 1, "逆算した価格で返済が10万円");
  const b = LL.affordablePrice({ monthly: 100_000, rate: 0.015, years: 35, down: 3_000_000, costRate: 0.07, financeCosts: false });
  assert.ok(Math.abs(LL.payment(b.price - 3_000_000, 0.015, 35) - 100_000) < 1);
  assert.equal(Math.round(b.cash), Math.round(3_000_000 + b.price * 0.07), "必要な現金＝頭金＋諸費用");
});

test("compute：審査と家賃並み予算を物件ごと・お客様ごとに返す", () => {
  const x = LL.compute({ ...LL.SAMPLE, customer: { ...LL.SAMPLE.customer, existingMonthly: 15_000, monthlyWish: 90_000 }, screen: { rate: 0.03 } });
  assert.ok(x.props[0].screen.ratio > 0 && x.props[0].screen.maxLoan > 0);
  assert.ok(x.afford.price > 0);
});
