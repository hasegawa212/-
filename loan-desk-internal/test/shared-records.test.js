// 審査の結果の共有と、お客様の履歴からの反映（二度入力をなくす）
const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../lib/outcomes.js");
const S = require("../lib/sync.js");
const C = require("../lib/customers.js");
const R = require("../lib/recommend.js");
const LSA = require("../../loan-screening-app/lib/screening.js");
const { OUTCOMES_PERIOD } = require("../data/outcomes.js");

const cust = (ini, history, single) => C.save([], { initials: ini, staff: "上田", input: { single: !!single, history } }, "2026-11-01 00:00").item;

test("periodEnd: 集計の期間の終わり（YYYY-MM）を読む", () => {
  assert.equal(O.periodEnd("2024/07〜2026/10"), "2026-10");
  assert.equal(O.periodEnd(OUTCOMES_PERIOD), OUTCOMES_PERIOD.slice(-7).replace("/", "-"));
  assert.equal(O.periodEnd(""), "");
});

test("fromHistory: 集計の期間より後の履歴だけを記録にする（もう数えた否決を二重に数えない）", () => {
  const c = cust("斎藤", [
    { lender: "JA", stage: "pre", result: "reject", month: "2026-10", reason: "borrower_single" },
    { lender: "筑波銀行", stage: "pre", result: "reject", month: "2026-11", reason: "unknown" },
    { lender: "水戸信用金庫", stage: "main", result: "pass", month: "2026-12" },
    { lender: "東邦銀行", stage: "pre", result: "reject", reason: "unknown" },
  ], true);
  const r = O.fromHistory([c], "2026-10");
  assert.deepEqual(r.map((x) => x.lender), ["筑波銀行", "水戸信用金庫"]);
  assert.ok(r.every(O.validRecord));
  assert.equal(r[0].single, true);
  assert.equal(r[1].reason, undefined);
});

test("allRecords: 足した記録＋お客様の履歴。順番の計算にそのまま使える", () => {
  const c = cust("斎藤", ["結城信用金庫", "結城信用金庫", "結城信用金庫"].map((l, i) => ({ lender: l, stage: "pre", result: "reject", month: `2026-1${i}`.replace("2026-10", "2026-11"), reason: "borrower_single" })), true);
  const all = O.allRecords([{ lender: "JA", stage: "pre", result: "reject", reason: "unknown", single: false }], [c]);
  assert.equal(all.length, 1 + O.fromHistory([c], O.periodEnd(OUTCOMES_PERIOD)).length);
  const x = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 355, incomePrev: 355, incomePrev2: 355, tenure: 5, employ: "contract", single: true, price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });
  const before = R.recommend(x).candidates.find((k) => k.lender.name === "結城信用金庫");
  const after = R.recommend(x, { records: O.allRecords([], [c]) });
  assert.ok(before, "足す前は候補");
  assert.ok(after.avoid.some((k) => k.lender.name === "結城信用金庫") || !after.candidates.some((k) => k.lender.name === "結城信用金庫"), "履歴の否決が順番に効く");
});

test("記録は id を持てる（共有データの行の名前）。id は英数字と - _ だけ", () => {
  const base = { lender: "JA", stage: "pre", result: "reject", reason: "unknown", single: false };
  assert.ok(O.validRecord(Object.assign({ id: "r1a2b3c4d" }, base)));
  assert.ok(!O.validRecord(Object.assign({ id: "斎藤" }, base)));
  assert.match(S.newRecordId(), /^r[0-9a-z]{8,}$/);
  assert.notEqual(S.newRecordId(), S.newRecordId());
});

test("diff は行の名前の決め方を選べる（お客様は docId、記録は id）", () => {
  const a = { id: "r1", lender: "JA", stage: "pre", result: "reject", reason: "unknown", single: false };
  const d = S.diff(new Map(), [a], (r) => r.id);
  assert.deepEqual(d.sets.map((x) => x.docId), ["r1"]);
  assert.equal(S.diff(d.next, [], (r) => r.id).deletes[0], "r1");
});

test("recordsFromSnapshot: 形の正しい記録だけを残す（名前や自由文の欄がある行は落とす）", () => {
  const ok = { id: "r1", lender: "JA", stage: "pre", result: "pass", single: false, month: "2026-11" };
  const r = S.recordsFromSnapshot([{ id: "r1", data: ok }, { id: "r2", data: Object.assign({}, ok, { id: "r2", name: "斎藤" }) }, { id: "r3", data: { lender: "" } }]);
  assert.deepEqual(r.records.map((x) => x.id), ["r1"]);
  assert.equal(S.diff(r.synced, r.records, (x) => x.id).sets.length, 0);
});
