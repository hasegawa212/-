// TDD：「2人暮らし」の家賃に「なし」（0）を選べる。なしなら、結婚後もひとり暮らしの家賃のまま
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const Share = require("../lib/share");

const fam = S.preset("family"); // 30歳で結婚・32歳で第1子
const none = { ...fam, rent: { ...fam.rent, couple: 0 } };

test("2人暮らしが「なし」：結婚後（子育て前）の家賃はひとり暮らしの家賃、更新料もそれに合わせる", () => {
  const x = S.compute(none);
  const y = x.years.find((v) => v.age === 31);
  assert.equal(y.rentMonthly, fam.rent.single);
  assert.equal(y.renewPart, (fam.rent.single * fam.rent.renewMonths) / fam.rent.renewEvery);
  assert.ok(x.years.every((v) => v.rentMonthly > 0), "家賃0円の年はない");
  assert.equal(x.years.find((v) => v.age === 40).rentMonthly, fam.rent.family, "子育て期はそのまま");
});

test("2人暮らしが「なし」：団信のときに家族が払い続ける家賃もひとり暮らしの家賃", () => {
  assert.equal(S.compute(none).whatIf.danshinRentContinues, fam.rent.single);
});

test("2人暮らしが「なし」：説明・トップのライフイベントに「0万円」が出ない", () => {
  const x = S.compute(none);
  const txt = JSON.stringify(S.talk(x)) + JSON.stringify(S.home(x).events);
  assert.doesNotMatch(txt, /2人 0|2人暮らしの家賃 0|0\.0万円|0万円（2人/);
  assert.match(JSON.stringify(S.talk(x)), /2人.*ひとりと同じ/);
});

test("共有リンクでも「なし」（0）を行き来できる", () => {
  assert.equal(Share.decode(Share.encode(none), S.defaults()).state.rent.couple, 0);
});
