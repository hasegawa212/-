// TDD：映像と数字の連動 — 地図の道の印（年齢）・グラフの点・ライフイベント・エリアのカードが、同じ数字を指す
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const h = S.home(x);

test("道の印：今（スタート）からGOAL（65歳）まで、年齢の順に、道の上の位置 t（0〜1）を持つ", () => {
  const m = h.milestones;
  assert.equal(m[0].age, x.input.age);
  assert.equal(m[0].t, 0);
  assert.equal(m.at(-1).age, x.input.retireAge);
  assert.equal(m.at(-1).t, 1);
  for (let i = 1; i < m.length; i++) { assert.ok(m[i].age > m[i - 1].age, "同じ年齢はまとめる"); assert.ok(m[i].t > m[i - 1].t); }
  for (const v of m) assert.ok(Math.abs(v.t - Math.min(1, (v.age - x.input.age) / (x.input.retireAge - x.input.age))) < 1e-9);
});

test("道の印の数字は、シミュレーションと同じ（買う＝毎月の返済、定年＝残りの回数と残高、GOAL＝年金と資産）", () => {
  const by = Object.fromEntries(h.milestones.map((v) => [v.age, v]));
  assert.match(by[30].label, /家を買う/);
  assert.ok(by[30].stat.includes(S.man(x.loan.pmt, 1)));
  assert.match(by[60].label, /定年/);
  assert.ok(by[60].stat.includes(`残り${x.loan.atReemploy.left}回`));
  assert.ok(by[60].stat.includes(S.man(x.loan.atReemploy.balance)));
  assert.match(by[65].label, /年金/);
  assert.match(by[65].label, /完済/, "同じ年齢の出来事は1つの印にまとめる");
  assert.ok(by[65].stat.includes(S.man(x.pension.monthly, 1)));
  // どの印にも、その年齢の資産（持ち家の場合）を出す。グラフの点と同じ値
  for (const v of h.milestones) {
    const p = h.assets.path.find((q) => q.age === v.age);
    assert.equal(v.assets, p.own);
  }
});

test("社宅の人は「社宅を出る」印に、家賃がいくら上がるかを出す", () => {
  const hs = S.home(S.compute(S.preset("shataku")));
  const m = hs.milestones.find((v) => /社宅を出る/.test(v.label));
  assert.ok(m && m.stat.includes("3.8万円"));
});

test("エリアのカード：大きく見せる数字は1つ（ラベル付き）。シミュレーションと同じ", () => {
  const a = Object.fromEntries(h.areas.map((v) => [v.key, v]));
  assert.equal(a.cash.big, S.man(x.input.savings));
  assert.equal(a.nisa.big, S.man(x.portfolio.at65.nisa));
  assert.equal(a.ins.big, S.man(x.input.lifeIns.monthly, 1));
  assert.equal(a.home.big, S.man(x.loan.pmt, 1));
  assert.equal(a.plan.big, S.man(x.life.own));
  for (const v of h.areas) assert.ok(v.bigLabel && v.bigLabel.length <= 16, v.bigLabel);
});

test("ライフイベントの各行にも、その出来事の数字（道の印と同じ文）", () => {
  for (const e of h.events) {
    const m = h.milestones.find((v) => v.age === Math.min(e.age, x.input.retireAge) && v.label.includes(e.label.replace(/（.*）/, "")));
    assert.ok(m, e.label);
  }
});
