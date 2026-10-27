// TDD：団体信用生命保険（団信）と生命保険を並べて比べる
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());

test("団信の保障額＝住宅ローンの残り：借りた日が最大、返すほど減り、完済で0（年ごと）", () => {
  const d = S.danshin(x);
  assert.equal(d.cover[0].age, x.loan.buyAge);
  assert.ok(Math.abs(d.cover[0].amount - x.loan.amount) < 1);
  for (let i = 1; i < d.cover.length; i++) assert.ok(d.cover[i].amount <= d.cover[i - 1].amount);
  assert.equal(d.cover.at(-1).age, x.loan.endAge);
  assert.equal(d.cover.at(-1).amount, 0);
  const at60 = d.cover.find((c) => c.age === 60);
  assert.ok(Math.abs(at60.amount - x.loan.atReemploy.balance) < 1);
});

test("一般団信は金利に含まれ、別払いなし。がん・3大疾病・ワイドは金利上乗せの目安で、毎月・総額いくら増えるか", () => {
  const d = S.danshin(x);
  assert.equal(d.general.extraMonthly, 0);
  assert.match(d.general.note, /金利に含まれ/);
  const keys = d.options.map((o) => o.key);
  assert.deepEqual(keys, ["cancer", "sandai", "wide"]);
  for (const o of d.options) {
    const pm = S.payment(x.loan.amount, x.input.own.rate + o.add, x.input.own.years);
    assert.ok(Math.abs(o.extraMonthly - (pm - x.loan.pmt)) < 1e-6);
    assert.ok(Math.abs(o.extraTotal - o.extraMonthly * x.loan.months) < 1e-3);
    assert.ok(o.add >= 0.001 && o.add <= 0.003, "上乗せは年0.1〜0.3%の目安");
  }
  assert.match(d.optionsNote, /金融機関/);
});

test("生命保険（今の契約）：毎月の保険料×65歳までの総額、保障額は一定。生命保険料控除は生命保険だけ", () => {
  const d = S.danshin(x);
  assert.equal(d.life.monthly, x.input.lifeIns.monthly);
  assert.equal(d.life.total, x.insurance.rentLife);
  assert.equal(d.life.cover, x.input.lifeIns.cover);
  const rows = Object.fromEntries(d.rows.map((r) => [r.key, r]));
  for (const k of ["target", "amount", "premium", "total", "period", "deduction", "health"]) assert.ok(rows[k], k);
  assert.match(rows.deduction.danshin, /対象外|なし/);
  assert.match(rows.deduction.life, /あり|対象/);
  assert.match(rows.premium.danshin, /金利に含まれ/);
});

test("見直し：団信がある間（返している間）は、生命保険を減らせる場合がある（減らす額は設定、0なら見直さない）", () => {
  const cut = S.danshin(S.compute({ ...S.defaults(), lifeIns: { monthly: 10_000, cutWithDanshin: 5_000, cover: 10_000_000 } }));
  assert.equal(cut.review.monthly, 5_000);
  assert.ok(cut.review.total > 0);
  assert.equal(S.danshin(x).review.total, 0);
});

test("独身なら「親や兄弟にローンが残らない」、家族なら「家族に住まいが残る」", () => {
  assert.match(S.danshin(x).message, /親や兄弟/);
  assert.match(S.danshin(S.compute(S.preset("family"))).message, /家族に住まいが残/);
});

test("⑤の説明と提案書（3ページ目）に団信と生命保険の比較が入る（断定しない）", () => {
  const five = S.talk(x)[5];
  assert.match(five.show, /団信.*金利に含まれ/);
  assert.match(five.show, /生命保険/);
  const p3 = JSON.stringify(S.proposal(x).pages[2]);
  assert.match(p3, /団信/);
  assert.match(p3, /生命保険/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(five.say + five.show, re);
});

test("生命保険の保障額は入力できる（初期値1,000万円）、共有リンクで行き来できる", () => {
  assert.equal(S.defaults().lifeIns.cover, 10_000_000);
  const Share = require("../lib/share");
  const st = { ...S.defaults(), lifeIns: { ...S.defaults().lifeIns, cover: 20_000_000 } };
  assert.equal(Share.decode(Share.encode(st), S.defaults()).state.lifeIns.cover, 20_000_000);
});
