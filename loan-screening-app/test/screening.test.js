const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/screening.js");

test("元利均等の返済額と借入可能額は逆算で一致する", () => {
  const m = L.pmt(3000, 1, 35);
  assert.ok(Math.abs(m - 8.469) < 0.01); // 3,000万・1%・35年 ≒ 8.47万円/月
  assert.ok(Math.abs(L.pv(m, 1, 35) - 3000) < 1e-6);
  assert.equal(L.pmt(1200, 0, 10), 10);
});

test("年収帯で返済比率の上限が変わる", () => {
  assert.equal(L.dtiLimit(250, L.POLICY), 25);
  assert.equal(L.dtiLimit(350, L.POLICY), 30);
  assert.equal(L.dtiLimit(400, L.POLICY), 35);
});

test("返済比率は審査金利で計算し、他の借入を含む", () => {
  const r = L.screen({ price: 3000, down: 0, term: 35, income: 500, car: 3, scholarship: 0 });
  const expect = ((L.pmt(3000, 3.5, 35) + 3) * 12) / 500 * 100;
  assert.ok(Math.abs(r.dti - expect) < 1e-9);
});

test("異動・団信不可・再建築不可・年齢・最低年収は足切りで否決", () => {
  for (const p of [{ late: "jiko" }, { danshin: "no" }, { saikenchiku: true }, { age: 72 }, { income: 120, incomePrev: 120 }]) {
    const r = L.screen(p);
    assert.equal(r.decision, "reject", JSON.stringify(p));
    assert.ok(r.knockouts.length >= 1);
    assert.equal(r.maxLoan, 0);
  }
});

test("余裕のある申込みは承認見込み・格付A/B", () => {
  const r = L.screen({ employ: "public", tenure: 12, income: 750, incomePrev: 740, price: 3500, down: 700, car: 0, scholarship: 0 });
  assert.equal(r.decision, "approve");
  assert.ok(["A", "B"].includes(r.grade));
  assert.ok(r.maxLoan >= r.loan);
});

test("借入額だけが超える場合は減額の条件付き承認と融資可能額を出す", () => {
  const r = L.screen({ employ: "large", tenure: 8, income: 450, incomePrev: 440, price: 4200, down: 200, car: 0, scholarship: 0 });
  assert.equal(r.decision, "conditional");
  assert.ok(r.maxLoan < r.loan && r.maxLoan > 0);
  assert.ok(r.conditions.some((c) => c.includes("減額")));
  // 融資可能額で借りれば返済比率は上限以内
  const again = L.screen({ employ: "large", tenure: 8, income: 450, incomePrev: 440, price: r.maxLoan + 200, down: 200, car: 0, scholarship: 0 });
  assert.ok(again.dti <= again.limit + 1e-9);
});

test("自営業は直近2期の低いほうの所得で審査し、事業3期が必要", () => {
  const r = L.screen({ employ: "self", income: 600, incomePrev: 450, tenure: 2 });
  assert.equal(r.income, 450);
  assert.equal(r.checks.find((c) => c.key === "tenure").status, "warn");
  assert.notEqual(r.decision, "approve");
});

test("完済年齢の上限で返済期間を縮めて融資可能額を出す", () => {
  const r = L.screen({ age: 55, term: 35 });
  assert.equal(r.term, 25);
  assert.equal(r.checks.find((c) => c.key === "payoff").status, "ng");
});

test("担保評価は中古・旧耐震で下がり、手入力があればそれを使う", () => {
  assert.ok(L.collateralRate({ property: "usedHouse", builtYears: 25 }) < L.collateralRate({ property: "newHouse" }));
  assert.equal(L.collateralRate({ property: "usedMansion", builtYears: 40, oldQuake: true }), 55);
  assert.equal(L.screen({ collateral: 2000 }).collateral, 2000);
});

test("改善シミュレーションは判定か融資可能額が変わるものだけ出す", () => {
  const r = L.screen({});
  assert.ok(r.whatIf.length > 0);
  for (const w of r.whatIf) assert.ok(w.decision !== r.decision || w.maxLoan !== r.maxLoan);
});

test("基準は差し替えられる（審査金利を下げると返済比率が下がる）", () => {
  assert.ok(L.screen({}, { stressRate: 2 }).dti < L.screen({}).dti);
});

test("表示文に断定・約束の言葉を使わない", () => {
  const r = L.screen({});
  const text = JSON.stringify([r.conditions, r.strengths, r.concerns, r.decisionInfo, L.NOTE]);
  for (const w of [/必ず通/, /絶対/, /確実に/, /審査に通ります/, /保証します/]) assert.doesNotMatch(text, w);
  assert.match(L.NOTE, /約束するものではなく/);
});
