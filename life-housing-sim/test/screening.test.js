// TDD：賃貸の更新料と、審査が通りにくくなること（老後の賃貸の入居審査／待つほど住宅ローンの審査が厳しくなる）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

test("更新料：2年ごとに家賃1か月分。一生の合計・老後の分・1回あたりを出す（内訳と一致）", () => {
  const x = S.compute(S.defaults());
  const r = x.renew;
  assert.equal(r.total, x.breakdown.rent.renew.amount);
  const old = x.years.filter((y) => y.age >= 65).reduce((s, y) => s + y.renewPart, 0);
  assert.equal(r.old, old);
  assert.equal(r.perTimeNow, S.defaults().rent.single * 1);
  assert.equal(r.every, 2);
  assert.equal(r.times, Math.round(r.total / (r.total / r.times)), "回数");
  // 27〜94歳の68年 → 2年ごとに34回
  assert.equal(r.times, 34);
});

test("更新料：社宅の間は0、更新料なしの物件（0か月）なら0", () => {
  assert.equal(S.compute({ ...S.defaults(), rent: { ...S.defaults().rent, renewMonths: 0 } }).renew.total, 0);
  const sh = S.compute(S.preset("shataku"));
  assert.ok(sh.renew.times < S.compute(S.defaults()).renew.times);
});

test("賃貸の入居審査：老後は収入が年金だけ。家賃が年金の3分の1を超えると通りにくくなる目安", () => {
  const x = S.compute(S.defaults());
  const s = x.screening.rent;
  assert.equal(s.ageFrom, 65);
  assert.ok(Math.abs(s.ratioOld - (x.input.rent.old * 12) / x.pension.yearly) < 1e-9);
  assert.equal(s.guide, 1 / 3);
  assert.equal(s.hard, s.ratioOld > 1 / 3);
  assert.equal(s.hard, true, "5.8万÷年金14.4万＝40%");
  const low = S.compute({ ...S.defaults(), rent: { ...S.defaults().rent, old: 40_000 } }).screening.rent;
  assert.equal(low.hard, false);
});

test("住宅ローンの審査：待つほど年齢が上がり、返済期間が短く・返済比率が高くなる（年収400万未満30%・以上35%が目安）", () => {
  const x = S.compute(S.defaults());
  for (const w of x.wait) {
    const inc = x.input.income * Math.pow(1 + x.input.raise, w.buyAge - x.input.age);
    assert.ok(Math.abs(w.screen.income - inc) < 1);
    assert.ok(Math.abs(w.screen.ratio - (w.pmt * 12) / inc) < 1e-9);
    assert.equal(w.screen.limit, inc < 4_000_000 ? 0.3 : 0.35);
    assert.equal(w.screen.ok, w.screen.ratio <= w.screen.limit);
    assert.equal(w.screen.shorter, w.loanYears < x.input.own.years);
  }
  // 5年待つと35歳で買う→80歳完済の上限で期間は35年のまま／10年待つ人は短くなる
  const late = S.compute({ ...S.defaults(), own: { ...S.defaults().own, buyAge: 47 } });
  assert.equal(late.wait[3].screen.shorter, true);
  assert.ok(late.wait[3].screen.ratio > late.wait[0].screen.ratio, "期間が短くなると返済比率が上がる");
});

test("説明：②に更新料、⑤に入居審査、⑧に住宅ローンの審査（断定しない・あおらない）", () => {
  const x = S.compute(S.defaults());
  const t = S.talk(x);
  const two = t.find((s) => s.title.startsWith("②")), five = t.find((s) => s.title.startsWith("⑤")), seven = t.find((s) => s.title.startsWith("⑧"));
  assert.match(two.show, /更新料/);
  assert.ok(two.show.includes(S.man(x.renew.total)));
  assert.match(five.show, /入居審査/);
  assert.match(five.show, /3分の1/);
  assert.match(seven.show, /審査/);
  const all = t.map((s) => s.say + s.show + s.ask).join("");
  assert.doesNotMatch(all, /必ず(落ち|通らない)|絶対に借りられない/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(all, re);
});

test("提案書：更新料と、審査が通りにくくなること（目安）が入る", () => {
  const p = JSON.stringify(S.proposal(S.compute(S.defaults())));
  assert.match(p, /更新料/);
  assert.match(p, /入居審査/);
  assert.match(p, /住宅ローンの審査/);
});
