const test = require("node:test");
const assert = require("node:assert/strict");
const LSA = require("../../loan-screening-app/lib/screening.js");
const { LENDERS } = require("../data/lenders.js");
const R = require("../lib/recommend.js");
const base = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 355, incomePrev: 355, incomePrev2: 355, tenure: 5, employ: "contract", single: true,
  price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });

test("実績データに、お客様の名前・電話・住所の番地は入っていない", () => {
  const s = JSON.stringify(LENDERS);
  assert.doesNotMatch(s, /様|\d{2,4}-\d{2,4}-\d{3,4}|番地|丁目/);
  for (const l of LENDERS) assert.ok(LSA.PRESETS[l.type], l.name);
});

test("通過率は (通過+1)/(通過+否決+2) で、件数が少ない金融機関を極端に扱わない", () => {
  assert.equal(R.passRate({ pass: 0, reject: 0 }), 0.5);
  assert.ok(Math.abs(R.passRate({ pass: 13, reject: 4 }) - 14 / 19) < 1e-12);
});

test("エリアの外の金融機関は候補に出さない（全国は出す）", () => {
  const r = R.recommend(Object.assign({}, base, { pref: "茨城" }));
  for (const c of r.candidates) assert.ok(c.lender.areas.includes("茨城") || c.lender.areas.includes("全国"), c.lender.name);
  assert.ok(!r.candidates.some((c) => c.lender.name === "鹿沼信用金庫"));
});

test("茨城の契約社員・単身: 実績の多い労金・水戸信金が上位、通過のない組合・常陽は「避ける」に出る", () => {
  const r = R.recommend(base);
  const top = r.candidates.slice(0, 3).map((c) => c.lender.name);
  assert.ok(top.includes("中央労働金庫"), top.join());
  assert.ok(top.includes("水戸信用金庫"), top.join());
  const avoid = r.avoid.map((c) => c.lender.name);
  assert.ok(avoid.includes("茨城県信用組合"));
  assert.ok(avoid.includes("JA"));
});

test("審査エンジンで否決見込みの金融機関は候補から外す（例: ネット銀行型は契約社員 ×）", () => {
  const r = R.recommend(base);
  const sbi = r.candidates.find((c) => c.lender.name === "SBIアルヒ");
  assert.ok(!sbi || sbi.screen.decision !== "reject");
  assert.ok(r.excluded.some((c) => c.lender.type === "net"));
});

test("申込みは1行ずつ: 順番と、否決されたら次、を返す。同時に出さない", () => {
  const r = R.recommend(base);
  assert.ok(r.plan.length >= 2);
  assert.match(r.plan[0], /まず/);
  assert.match(r.rule, /同時/);
});

test("仲介会社は実績どおり（増子建設が既定）。グループ会社を使うときは関係を開示", () => {
  const r = R.recommend(base);
  const mito = r.candidates.find((c) => c.lender.name === "水戸信用金庫");
  assert.equal(mito.broker, "増子建設");
  assert.match(mito.brokerAlt, /開示/);
  assert.match(r.disclosure, /売主/);
});

test("単身で購入動機書がないと、準備に動機書が出る", () => {
  const r = R.recommend(Object.assign({}, base, { motiveDoc: false }));
  assert.ok(r.prepare.some((p) => /購入動機/.test(p)));
});

test("断定・約束の言葉を使わない", () => {
  const s = JSON.stringify(R.recommend(base));
  for (const w of [/必ず/, /絶対/, /確実に/, /保証します/, /通ります/]) assert.doesNotMatch(s, w);
});

test("用意することに同じ内容を二重に出さない", () => {
  const r = R.recommend(Object.assign({}, base, { motiveDoc: false }));
  assert.equal(r.prepare.filter((p) => /購入動機/.test(p)).length, 1);
});
