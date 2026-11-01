const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../lib/outcomes.js");
const { OUTCOMES, OUTCOMES_PERIOD } = require("../data/outcomes.js");
const { LENDERS } = require("../data/lenders.js");
const LSA = require("../../loan-screening-app/lib/screening.js");
const R = require("../lib/recommend.js");
const base = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 355, incomePrev: 355, incomePrev2: 355, tenure: 5, employ: "contract", single: true,
  price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });

test("集計データは金融機関ごとの件数だけ（お客様の行・名前・電話・日付は入らない）", () => {
  const s = JSON.stringify(OUTCOMES);
  assert.doesNotMatch(s, /様|\d{2,4}-\d{2,4}-\d{3,4}|\d{4}-\d{2}|番地|丁目/);
  for (const o of Object.values(OUTCOMES)) assert.deepEqual(Object.keys(o).sort(), ["main", "pre", "reasons", "single"]);
  assert.match(OUTCOMES_PERIOD, /^\d{4}\/\d{2}〜\d{4}\/\d{2}$/);
});

test("集計の合計は lenders.js の通過・否決の件数と同じ（二重管理でずれない）", () => {
  for (const l of LENDERS) {
    const o = OUTCOMES[l.name]; if (!o) continue;
    assert.equal(o.pre.pass + o.main.pass, l.pass, l.name);
    assert.equal(o.pre.reject + o.main.reject, l.reject, l.name);
    const r = Object.values(o.reasons).reduce((a, b) => a + b, 0);
    assert.equal(r, l.reject, `${l.name} 否決の理由の合計`);
  }
});

test("否決の理由: 備考から寄せる（業者NG・接道・充て物・保証会社NG）、タグがなければ「理由の記録なし」", () => {
  assert.equal(O.reasonOf("unknown", "信金保証の業者NG(属性理由ではない)"), "dealer");
  assert.equal(O.reasonOf("property_collateral", "接道なし指摘"), "property_road_access");
  assert.equal(O.reasonOf("unknown", "充て物審査"), "property_atemono");
  assert.equal(O.reasonOf("unknown", "保証会社NG"), "guarantor");
  assert.equal(O.reasonOf("single", ""), "borrower_single");
  assert.equal(O.reasonOf("unknown", "総合的判断・全国保証"), "unknown");
  assert.equal(O.reasonOf("unknown", "物件待ち"), "unknown");
});

test("表記ゆれは lenders.js の名前にそろえる", () => {
  assert.equal(O.normLender("SBIアルヒ銀行"), "SBIアルヒ");
  assert.equal(O.normLender("鹿沼相互信用金庫"), "鹿沼信用金庫");
  for (const v of Object.values(O.ALIAS)) assert.ok(LENDERS.some((l) => l.name === v), v);
});

test("足す記録は 金融機関・段階・結果・理由・単身・月 だけ。名前や自由文の欄があれば受け付けない", () => {
  assert.ok(O.validRecord({ lender: "水戸信用金庫", stage: "pre", result: "reject", reason: "borrower_single", single: true }));
  assert.ok(!O.validRecord({ lender: "水戸信用金庫", stage: "pre", result: "reject", reason: "borrower_single", single: true, name: "山田" }));
  assert.ok(!O.validRecord({ lender: "水戸信用金庫", stage: "pre", result: "reject", single: true }), "否決は理由が必須");
  assert.ok(!O.validRecord({ lender: "水戸信用金庫", stage: "x", result: "pass", single: false }));
});

test("記録を足すと通過率が出し直され、元の集計は書き換わらない", () => {
  const before = JSON.stringify(OUTCOMES);
  const add = Array.from({ length: 4 }, () => ({ lender: "結城信用金庫", stage: "pre", result: "reject", reason: "borrower_single", single: true }));
  const m = O.merge(OUTCOMES, add);
  assert.equal(JSON.stringify(OUTCOMES), before);
  const s = O.statsOf(m["結城信用金庫"]);
  assert.equal(s.all.reject, OUTCOMES["結城信用金庫"].pre.reject + 4);
  assert.equal(s.reasons[0].key, "borrower_single");
  assert.match(s.text.single, /4件中 通過0/);
});

test("単身のお客様で、単身の記録が2件以上・通過2割以下の金融機関は「最初には出さない」に入る", () => {
  const add = Array.from({ length: 3 }, () => ({ lender: "結城信用金庫", stage: "pre", result: "reject", reason: "borrower_single", single: true }));
  const r = R.recommend(base, { records: add });
  const a = r.avoid.find((c) => c.lender.name === "結城信用金庫");
  assert.ok(a, "単身で外れる");
  assert.match(a.reason, /単身/);
  const r2 = R.recommend(Object.assign({}, base, { single: false, motiveDoc: true }), { records: add });
  assert.ok(!r2.avoid.some((c) => c.lender.name === "結城信用金庫" && /単身/.test(c.reason)), "単身でなければ単身の記録では外さない");
});

test("候補ごとに 全体・事前・本審査・単身 の通過率と否決の理由を返す。理由の記録がある割合も返す", () => {
  const r = R.recommend(base);
  const c = r.candidates.find((x) => x.lender.name === "中央労働金庫");
  assert.match(c.stats.text.all, /17件中 通過13/);
  assert.ok(c.stats.text.pre && c.stats.text.main && c.stats.text.single);
  assert.ok(r.reasonSummary.total >= r.reasonSummary.known);
  assert.ok(r.reasonSummary.coverage > 0 && r.reasonSummary.coverage < 1);
});

test("上位の候補の否決の理由から、出す前の確認が足される（例: 充て物）", () => {
  const r = R.recommend(base);
  assert.ok(r.prepare.some((p) => /充て物/.test(p)), r.prepare.join("\n"));
});
