// v4: ペアローン・借り換え・ボーナス払い・変動金利の5年／125%ルール・物件の癖
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/screening.js");
const NOW = "2026-10-31T09:00:00+09:00";
const run = (p, pol) => L.screen(Object.assign({}, L.SAMPLE, p), pol || "megabank", { now: NOW });
const chk = (r, stage, key) => r.stages.find((s) => s.key === stage).checks.find((c) => c.key === key);

// ---------- ペアローン ----------
test("ペアローン: 借入を割合で分け、それぞれの年収で返済負担率を見る", () => {
  const r = run({ jointType: "pair", pairShare: 40, partnerIncome: 300, partnerAge: 30, car: 0, scholarship: 0, price: 4000, down: 400 });
  assert.equal(r.pair.mainLoan, 3600 * 0.6);
  assert.equal(r.pair.partnerLoan, 3600 * 0.4);
  // 本人の返済負担率は本人分の借入だけで計算する
  const exp = (L.pmt(3600 * 0.6, 3.5, 35) * 12) / 480 * 100;
  assert.ok(Math.abs(r.dti - exp) < 1e-9);
  assert.ok(Math.abs(r.pair.partnerDti - (L.pmt(3600 * 0.4, 3.5, 35) * 12) / 300 * 100) < 1e-9);
  assert.ok(chk(r, "capacity", "pairPartner"));
  // 収入合算として二重に足さない
  assert.equal(r.income, 480);
});

test("ペアローン: 相手の返済負担率が超えると × 、相手の完済年齢も見る", () => {
  const over = run({ jointType: "pair", pairShare: 60, partnerIncome: 200, partnerAge: 30, price: 4000, down: 0 });
  assert.equal(chk(over, "capacity", "pairPartner").status, "ng");
  const old = run({ jointType: "pair", pairShare: 30, partnerIncome: 400, partnerAge: 50, term: 35 });
  assert.notEqual(chk(old, "capacity", "pairPayoff").status, "ok");
});

test("ペアローン: 諸費用・団信・契約が2本になる（必要書類が相手の分も出る）", () => {
  const r = run({ jointType: "pair", pairShare: 40, partnerIncome: 300, partnerAge: 30 });
  assert.ok(r.docsRequired.some((d) => /相手/.test(d.label)));
  assert.equal(r.fees.contracts, 2);
});

// ---------- 借り換え ----------
test("借り換え: 借入額は残高（＋諸費用）で、担保は今の評価で見る", () => {
  const r = run({ purpose: "refi", refiBalance: 2200, price: 2800, down: 0, costs: 80, financeCosts: true, property: "usedHouse", builtYears: 8, landArea: 0 });
  assert.equal(r.loan, 2280);
  assert.ok(chk(r, "property", "refiHistory"));
});

test("借り換え: いまのローンに延滞があれば ×", () => {
  const r = run({ purpose: "refi", refiBalance: 2000, refiLate: true });
  assert.equal(chk(r, "property", "refiHistory").status, "ng");
  assert.notEqual(r.decision, "approve");
});

// ---------- ボーナス払い ----------
test("ボーナス払いは借入の50%まで。ボーナスがないのに使うと △", () => {
  assert.equal(chk(run({ bonusShare: 60, bonusIncome: 80 }), "capacity", "bonus").status, "ng");
  assert.equal(chk(run({ bonusShare: 20, bonusIncome: 0 }), "capacity", "bonus").status, "warn");
  assert.equal(chk(run({ bonusShare: 20, bonusIncome: 80 }), "capacity", "bonus").status, "ok");
  assert.equal(chk(run({ bonusShare: 0 }), "capacity", "bonus"), undefined);
});

test("ボーナス払い: 毎月分とボーナス分の返済を分けて出す（年間の合計は返済負担率と一致）", () => {
  const r = run({ bonusShare: 20, bonusIncome: 80 });
  const loan = r.loan;
  const monthly = L.pmt(loan * 0.8, r.input.rate, 35);
  const bonus = L.pmt(loan * 0.2, r.input.rate, 35) * 6; // 半年ごと＝6か月分
  assert.ok(Math.abs(r.bonusPlan.monthly - monthly) < 1e-9);
  assert.ok(Math.abs(r.bonusPlan.bonus - bonus) < 1e-9);
  assert.ok(Math.abs(r.bonusPlan.monthly * 12 + r.bonusPlan.bonus * 2 - L.pmt(loan, r.input.rate, 35) * 12) < 1e-6);
});

// ---------- 変動金利の5年／125%ルール ----------
test("変動金利: 金利が上がっても5年は返済額が同じで、上がるときは前の125%まで", () => {
  const r = run({ rateType: "variable", rate: 0.9 });
  const rr = r.rateRisk;
  assert.equal(rr.applies, true);
  const up2 = rr.scenarios.find((s) => s.up === 2);
  assert.ok(up2.paymentAfter5 <= rr.base * 1.25 + 1e-9);
  // +2%は本来の返済が125%を超える → 未払いの利息が出るおそれ
  assert.ok(up2.uncapped > rr.base * 1.25);
  assert.equal(up2.capped, true);
  assert.equal(run({ rateType: "fixedAll" }).rateRisk.applies, false);
});

// ---------- 物件の癖 ----------
test("私道: 持分なし（通行・掘削の承諾なし）は × 、持分ありは ○、承諾書ありは △", () => {
  const st = (p) => chk(run(Object.assign({ property: "usedHouse", builtYears: 10 }, p)), "property", "privateRoad").status;
  assert.equal(st({ privateRoad: "noShare" }), "ng");
  assert.equal(st({ privateRoad: "consent" }), "warn");
  assert.equal(st({ privateRoad: "share" }), "ok");
});

test("ひな壇・擁壁（検査済証なし）・検査済証なし・未登記の増築は △（フラット35は検査済証なしで ×）", () => {
  const base = { property: "usedHouse", builtYears: 15 };
  assert.equal(chk(run(Object.assign({ retainingWall: true }, base)), "property", "retainingWall").status, "warn");
  assert.equal(chk(run(Object.assign({ unregistered: true }, base)), "property", "unregistered").status, "warn");
  assert.equal(chk(run(Object.assign({ noInspection: true }, base)), "property", "noInspection").status, "warn");
  assert.equal(chk(run(Object.assign({ noInspection: true, floor: 100, flatRate: 3.46 }, base), "flat35"), "property", "noInspection").status, "ng");
});

test("v4の文言にも断定・約束の言葉を使わない", () => {
  const r = run({ jointType: "pair", pairShare: 40, partnerIncome: 300, partnerAge: 30, rateType: "variable", privateRoad: "noShare", bonusShare: 20, bonusIncome: 0 });
  const text = JSON.stringify([r.stages, r.conditions, r.rateRisk, r.pair, r.bonusPlan]);
  for (const w of [/必ず/, /絶対/, /確実に/, /保証します/]) assert.doesNotMatch(text, w);
});
