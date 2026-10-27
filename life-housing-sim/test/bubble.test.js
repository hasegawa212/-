// TDD：親御さまの「バブル崩壊」のイメージ → 当時と今の金利で、同じ借入の毎月の返済をくらべる
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());

test("当時（1990〜91年）の金利：都市銀行の変動 最高8.5%、住宅金融公庫 約5.5%（出どころつき）", () => {
  assert.equal(S.BUBBLE.bankRate, 0.085);
  assert.equal(S.BUBBLE.publicRate, 0.055);
  assert.match(S.BUBBLE.source, /1990/);
});

test("同じ借入額・同じ年数で、当時の金利なら毎月いくらか（今の計画とくらべる）", () => {
  const b = S.bubble(x);
  assert.ok(Math.abs(b.bank - S.payment(x.loan.amount, 0.085, x.input.own.years)) < 1e-6);
  assert.ok(Math.abs(b.public - S.payment(x.loan.amount, 0.055, x.input.own.years)) < 1e-6);
  assert.equal(b.now, x.loan.pmt);
  assert.ok(b.bank > b.public && b.public > b.now);
  assert.ok(Math.abs(b.times - b.bank / b.now) < 1e-9);
});

test("⑧（今はいい）に、親御さまの頃との違いを入れる（値上がりはあてにしない・値下がりもありうる）", () => {
  const t = S.talk(x)[9];
  assert.match(t.show, /親御さま/);
  assert.match(t.show, /8\.5%/);
  assert.ok(t.show.includes(S.man(S.bubble(x).bank, 1)));
  assert.match(t.show, /値上がりをあてにせず/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(t.say + t.show, re);
});
