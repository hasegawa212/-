// TDD：60歳で定年→65歳まで再雇用（年収が下がる）、ローンは月（35年＝420回）で数える
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const Share = require("../lib/share");

const flat = (p) => ({ ...p, raise: 0 }); // 手計算しやすいように昇給なし

test("初期値：60歳で定年、65歳まで再雇用（年収は定年前の6割と仮定）、年金は65歳から", () => {
  const d = S.defaults();
  assert.deepEqual(d.reemploy, { age: 60, rate: 0.6 });
  assert.equal(d.retireAge, 65);
});

test("生涯の給料：60歳までは今の年収、60〜65歳は6割（手計算と一致）", () => {
  // 390万 × 33年（27〜59歳）＋ 390万 × 0.6 × 5年（60〜64歳）＝ 12,870万 ＋ 1,170万
  const x = S.compute(flat(S.defaults()));
  assert.equal(Math.round(x.income.salaryMe), 128_700_000 + 11_700_000);
  assert.equal(Math.round(x.income.salaryReemploy), 11_700_000);
});

test("年金：再雇用の5年は給料が下がった分だけ厚生年金も少なく計算（手計算と一致）", () => {
  // (390万÷12)×5.481/1000×456月（22〜60歳）＋(234万÷12)×5.481/1000×60月（60〜65歳）
  const k = Math.round(325_000 * 0.005481 * 456 + 195_000 * 0.005481 * 60);
  const p = S.pension(3_900_000, 22, 65, { age: 60, rate: 0.6 });
  assert.equal(p.kousei, k);
  assert.equal(p.yearly, 847_300 + k);
  assert.equal(S.compute(S.defaults()).pension.me.kousei, k);
  // 再雇用なし（60歳＝65歳、10割）なら今までと同じ
  assert.equal(S.pension(3_900_000, 22, 65, { age: 65, rate: 1 }).kousei, S.pension(3_900_000, 22, 65).kousei);
});

test("ローンは月で数える：35年＝420回。30歳で買うと、60歳の定年で残り60回、65歳で完済", () => {
  const x = S.compute(S.defaults());
  const L = x.loan;
  assert.equal(L.months, 420);
  assert.equal(L.atReemploy.age, 60);
  assert.equal(L.atReemploy.paid, 360);
  assert.equal(L.atReemploy.left, 60);
  assert.equal(Math.round(L.atReemploy.balance), Math.round(S.balanceAfter(L.amount, 0.012, 35, 360)));
  assert.equal(L.atRetire.left, 0);
  assert.equal(L.atRetire.balance, 0);
  // 毎月の返済 × 420回 ＝ 返済の合計
  const paid = x.years.reduce((s, y) => s + y.ownLoan, 0);
  assert.ok(Math.abs(paid - L.pmt * 420) < 1);
});

test("再雇用の間の返済比率：毎月の返済×12 ÷ 再雇用の年収（今の年収の6割）", () => {
  const x = S.compute(S.defaults());
  assert.ok(Math.abs(x.loan.ratioReemploy - (x.loan.pmt * 12) / (3_900_000 * 0.6)) < 1e-9);
  assert.ok(Math.abs(x.loan.ratioNow - (x.loan.pmt * 12) / 3_900_000) < 1e-9);
});

test("説明と提案書に「420回」「60歳で定年・65歳まで再雇用」が出る（あおらない）", () => {
  const x = S.compute(S.defaults());
  const t = S.talk(x), all = t.map((s) => s.say + s.show + s.ask).join("");
  assert.match(all, /420回/);
  assert.match(all, /60歳.*再雇用/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(all, re);
  const p = JSON.stringify(S.proposal(x));
  assert.match(p, /420回/);
  assert.match(p, /再雇用/);
});

test("共有リンク：定年・再雇用の条件も行き来できる", () => {
  const st = { ...S.defaults(), reemploy: { age: 62, rate: 0.7 } };
  assert.deepEqual(Share.decode(Share.encode(st), S.defaults()).state.reemploy, { age: 62, rate: 0.7 });
});

test("再雇用の間の返済が年収の35%を超えるときは、繰上げ返済・退職金の計画も一緒に考えると伝える", () => {
  const heavy = S.talk(S.compute(S.defaults())).map((s) => s.show).join("");
  assert.match(heavy, /繰上げ返済/);
  const light = S.talk(S.compute({ ...S.defaults(), reemploy: { age: 60, rate: 1 } })).map((s) => s.show).join("");
  assert.doesNotMatch(light, /繰上げ返済/);
});
