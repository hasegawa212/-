const test = require("node:test");
const assert = require("node:assert/strict");
const { appraise, eligibility } = require("../lib/collateral.js");
const { resolvePolicy } = require("../lib/policy.js");
const mb = resolvePolicy("megabank");

const house = { property: "usedHouse", price: 2500, builtYears: 10, structure: "wood", landArea: 150, rosenka: 80000, floor: 100 };

test("戸建は積算評価: 土地＝路線価×面積、建物＝再調達単価×延床×残存÷耐用", () => {
  const r = appraise(house, mb);
  assert.equal(r.method, "積算");
  assert.equal(r.land, 150 * 80000 / 10000); // 1,200万円
  const exp = mb.unitCost.wood * 100 * (mb.life.wood - 10) / mb.life.wood;
  assert.ok(Math.abs(r.building - exp) < 1e-9);
  assert.ok(Math.abs(r.value - (r.land + r.building)) < 1e-9);
});

test("木造は耐用年数を過ぎると建物の評価が0（土地だけ）", () => {
  const r = appraise(Object.assign({}, house, { builtYears: 25 }), mb);
  assert.equal(r.building, 0);
  assert.equal(r.value, r.land);
});

test("マンション、または土地・建物の数字がないときは簡易評価", () => {
  const m = appraise({ property: "usedMansion", price: 3000, builtYears: 15 }, mb);
  assert.equal(m.method, "簡易");
  assert.ok(m.value < 3000 && m.value > 0);
  assert.equal(appraise({ property: "usedHouse", price: 2500, builtYears: 10 }, mb).method, "簡易");
  assert.equal(appraise(Object.assign({}, house, { collateral: 1800 }), mb).method, "手入力");
  assert.equal(appraise(Object.assign({}, house, { collateral: 1800 }), mb).value, 1800);
});

test("旧耐震は評価を下げる", () => {
  const a = appraise({ property: "usedMansion", price: 3000, builtYears: 45 }, mb).value;
  const b = appraise({ property: "usedMansion", price: 3000, builtYears: 45, oldQuake: true }, mb).value;
  assert.ok(b < a);
});

test("物件の適格性: 接道2m未満・再建築不可・投資用は足切り", () => {
  const ok = eligibility(Object.assign({ purpose: "own", road: 4 }, house), mb);
  assert.equal(ok.knockouts.length, 0);
  for (const p of [{ road: 1.5 }, { saikenchiku: true }, { purpose: "invest" }]) {
    const r = eligibility(Object.assign({ purpose: "own", road: 4 }, house, p), mb);
    assert.ok(r.knockouts.length >= 1, JSON.stringify(p));
  }
});

test("市街化調整区域・借地は型の設定で × か △", () => {
  const base = Object.assign({ purpose: "own", road: 4 }, house);
  const st = (pol, p, key) => eligibility(Object.assign({}, base, p), pol).checks.find((c) => c.key === key).status;
  assert.equal(st(Object.assign({}, mb, { allowChosei: false }), { zone: "chosei" }, "zone"), "ng");
  assert.equal(st(Object.assign({}, mb, { allowChosei: true }), { zone: "chosei" }, "zone"), "warn");
  assert.equal(st(Object.assign({}, mb, { allowLeasehold: false }), { leasehold: true }, "leasehold"), "ng");
  assert.equal(st(Object.assign({}, mb, { allowLeasehold: true }), { leasehold: true }, "leasehold"), "warn");
});

test("床面積が型の下限に満たないと ×、違反建築は ×", () => {
  const base = Object.assign({ purpose: "own", road: 4 }, house);
  const f35 = resolvePolicy("flat35");
  assert.equal(eligibility(Object.assign({}, base, { floor: 60 }), f35).checks.find((c) => c.key === "floor").status, "ng");
  assert.equal(eligibility(Object.assign({}, base, { floor: 60 }), mb).checks.find((c) => c.key === "floor").status, "ok");
  assert.equal(eligibility(Object.assign({}, base, { overBuild: true }), mb).checks.find((c) => c.key === "overBuild").status, "ng");
});
