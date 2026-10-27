// TDD：入力欄の「なし」（0）を選んでも、計算がこわれず、画面・提案書に「0万円」「NaN」「Infinity」が出ない
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const d = S.defaults(), fam = S.preset("family");
const texts = (x) => {
  const t = S.talk(x), p = S.proposal(x), h = S.home(x);
  return JSON.stringify([t, p, h.areas, h.events]);
};
const clean = (x, msg) => {
  const s = texts(x);
  assert.doesNotMatch(s, /NaN|Infinity|undefined/, msg);
  for (const n of Object.values(x.life)) assert.ok(Number.isFinite(n), msg);
};

test("ひとり暮らしの家賃「なし」（実家など）：家賃0・更新料0、文章は「なし」で「0万円」と出さない", () => {
  const x = S.compute({ ...d, rent: { ...d.rent, single: 0 } });
  const before = x.years.filter((y) => y.stage === "single");
  assert.ok(before.length > 0);
  for (const y of before) { assert.equal(y.rentMonthly, 0); assert.equal(y.renewPart, 0); }
  assert.equal(S.fixedCost(x).rent, 0);
  const t = S.talk(x);
  assert.match(t[2].show, /ひとり なし/);
  assert.doesNotMatch(t[0].show + t[2].show, /0\.0万円|(^|[^0-9,])0万円/);
  clean(x, "single 0");
});

test("子育て期の家賃「なし」：2人暮らしの家賃のまま（2人も「なし」ならひとり暮らしの家賃）", () => {
  const x = S.compute({ ...fam, rent: { ...fam.rent, family: 0 } });
  const kid = x.years.find((y) => y.stage === "family");
  assert.equal(kid.rentMonthly, fam.rent.couple);
  const y = S.compute({ ...fam, rent: { ...fam.rent, couple: 0, family: 0 } });
  assert.equal(y.years.find((v) => v.stage === "family").rentMonthly, fam.rent.single);
  assert.doesNotMatch(S.talk(x)[2].show, /子育て 0/);
  clean(x, "family 0");
});

test("老後の家賃「なし」：老後の家賃0、文章は「なし」", () => {
  const x = S.compute({ ...d, rent: { ...d.rent, old: 0 } });
  for (const y of x.years.filter((v) => v.stage === "old")) { assert.equal(y.rentMonthly, 0); assert.equal(y.renewPart, 0); }
  assert.match(S.talk(x)[2].show, /老後 なし/);
  assert.doesNotMatch(S.talk(x)[6].show, /家賃 0/);
  clean(x, "old 0");
});

test("家財保険・固定資産税・火災保険「なし」：その費用だけ0", () => {
  const x = S.compute({ ...d, rent: { ...d.rent, insYear: 0 }, own: { ...d.own, propTax: 0, ins: 0 } });
  assert.equal(x.breakdown.rent.ins.amount, 0);
  assert.equal(x.breakdown.own.tax.amount, 0);
  assert.equal(x.breakdown.own.ins.amount, 0);
  clean(x, "ins/tax 0");
});

test("再雇用「なし」（定年で仕事をやめる）：収入0、返済比率は「収入なし」として扱い、Infinity を出さない", () => {
  const x = S.compute({ ...d, reemploy: { age: 60, rate: 0 } });
  assert.ok(x.loan.atReemploy.left > 0, "定年の時点でローンが残っている例");
  assert.equal(x.loan.ratioReemploy, null);
  const g = S.gate(x).checks.find((c) => c.key === "reemploy");
  assert.equal(g.ok, false);
  assert.match(g.value, /収入なし/);
  assert.match(S.talk(x)[4].show, /収入がない/);
  clean(x, "reemploy 0");
});

test("全部「なし」でも計算できる", () => {
  const x = S.compute({ ...fam, savings: 0, partnerIncome: 0, reemploy: { age: 60, rate: 0 },
    nisa: { balance: 0, monthly: 0, rate: 0 }, rent: { ...fam.rent, single: 0, couple: 0, family: 0, old: 0, insYear: 0, renewMonths: 0 },
    own: { ...fam.own, propTax: 0, ins: 0, kind: "none" }, lifeIns: { monthly: 0, cutWithDanshin: 0, cover: 0 } });
  clean(x, "all none");
});
