const test = require("node:test");
const assert = require("node:assert/strict");
const { incomeUsed } = require("../lib/income.js");
const { resolvePolicy } = require("../lib/policy.js");
const mb = resolvePolicy("megabank");

test("会社員は直近の年収", () => {
  const r = incomeUsed({ employ: "regular", income: 500, incomePrev: 600, incomePrev2: 700 }, mb);
  assert.equal(r.own, 500);
  assert.equal(r.total, 500);
});

test("自営業は型の基準で: 3期平均／2期の低いほう／直近", () => {
  const x = { employ: "self", income: 600, incomePrev: 450, incomePrev2: 300 };
  assert.equal(incomeUsed(x, Object.assign({}, mb, { incomeBasis: "avg3" })).own, 450);
  assert.equal(incomeUsed(x, Object.assign({}, mb, { incomeBasis: "min2" })).own, 450);
  assert.equal(incomeUsed(x, Object.assign({}, mb, { incomeBasis: "latest" })).own, 600);
  // 3期目が未入力なら、入力のある期だけで平均
  assert.equal(incomeUsed({ employ: "self", income: 600, incomePrev: 400, incomePrev2: 0 }, Object.assign({}, mb, { incomeBasis: "avg3" })).own, 500);
});

test("収入合算: 連帯保証は型の割合、連帯債務はその割合で算入", () => {
  const g = incomeUsed({ employ: "regular", income: 400, jointType: "guarantor", jointIncome: 300 }, mb);
  assert.equal(g.joint, 300 * mb.jointGuarantor / 100);
  const c = incomeUsed({ employ: "regular", income: 400, jointType: "codebtor", jointIncome: 300 }, mb);
  assert.equal(c.joint, 300 * mb.jointCodebtor / 100);
  assert.equal(incomeUsed({ employ: "regular", income: 400, jointType: "none", jointIncome: 300 }, mb).joint, 0);
});
