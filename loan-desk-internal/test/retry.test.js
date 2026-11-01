const test = require("node:test");
const assert = require("node:assert/strict");
const LSA = require("../../loan-screening-app/lib/screening.js");
const T = require("../lib/retry.js");
const x = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 355, incomePrev: 355, incomePrev2: 355, tenure: 5, employ: "contract", single: true,
  price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });

test("最後の申込みから6か月たつまでは「待つ」。たてば「今から出せる」（銀行の KSC は1年と添える）", () => {
  const h = [{ lender: "水戸信用金庫", stage: "pre", result: "reject", month: "2026-09", reason: "borrower_single" }];
  const w = T.retryPlan(x, h, { today: "2026-11-01" });
  assert.equal(w.when.status, "wait"); assert.equal(w.from, "2027-03"); assert.match(w.when.text, /2027年3月/);
  const n = T.retryPlan(x, h, { today: "2027-04-01" });
  assert.equal(n.when.status, "now"); assert.match(n.when.text, /KSC/);
  assert.equal(T.retryPlan(x, [{ lender: "JA", stage: "pre", result: "reject", reason: "unknown" }], { today: "2026-11-01" }).when.status, "unknown");
});

test("否決済みの金融機関は次の順番に出さない。保証会社が同じだけの金融機関も外れる", () => {
  const h = [{ lender: "水戸信用金庫", stage: "pre", result: "reject", month: "2026-01", reason: "guarantor" }];
  const p = T.retryPlan(x, h, { today: "2026-11-01" });
  assert.ok(!p.next.some((c) => c.lender.name === "水戸信用金庫"));
  assert.ok(p.exclude.some((c) => c.lender.name === "水戸信用金庫"));
  assert.ok(p.next.length >= 1);
});

test("SBIアルヒ銀行のような表記ゆれも、否決済みとして外す", () => {
  const p = T.retryPlan(x, [{ lender: "SBIアルヒ銀行", stage: "main", result: "reject", month: "2026-01", reason: "unknown" }], { today: "2026-11-01" });
  assert.ok(!p.next.some((c) => c.lender.name === "SBIアルヒ"));
});

test("直すこと: 理由ごとの対策。3件以上なら最初に「方向性を見直す」、理由不明は最後に「確かめる」", () => {
  const h = ["筑波銀行", "東邦銀行", "JA"].map((l, i) => ({ lender: l, stage: "pre", result: "reject", month: `2026-0${7 + i}`, reason: i === 2 ? "borrower_single" : "unknown" }));
  const p = T.retryPlan(x, h, { today: "2026-11-01" });
  assert.equal(p.fixes[0].key, "many");
  assert.equal(p.fixes[1].key, "borrower_single");
  assert.equal(p.fixes[p.fixes.length - 1].key, "unknown");
  assert.equal(p.rejects, 3); assert.equal(p.recent, 3);
});

test("待っている間は、直近の否決が消えたあとの順番も見せる", () => {
  const h = ["筑波銀行", "東邦銀行"].map((l) => ({ lender: l, stage: "pre", result: "reject", month: "2026-10", reason: "unknown" }));
  const p = T.retryPlan(x, h, { today: "2026-11-01" });
  assert.equal(p.when.status, "wait");
  assert.ok(Array.isArray(p.nextAfterWait));
});

test("正直に伝える・1行ずつ・目安、を必ず返す。隠す・同時に出す方向の言葉はない", () => {
  const p = T.retryPlan(x, [{ lender: "JA", stage: "pre", result: "reject", month: "2026-01", reason: "dealer" }], { today: "2026-11-01" });
  assert.match(p.tell, /正直/); assert.match(p.rule, /1行ずつ/); assert.match(p.note, /目安/);
  assert.match(p.fixes.find((f) => f.key === "dealer").text, /開示/);
  assert.doesNotMatch(JSON.stringify({ t: p.tell, r: p.rule, f: p.fixes }), /隠して|伏せて|同時に出/);
});

test("同じ金融機関で否決のあと通っていれば、そこは「出さない先」にしない", () => {
  const h = [{ lender: "水戸信用金庫", stage: "pre", result: "reject", month: "2026-01", reason: "unknown" }, { lender: "水戸信用金庫", stage: "pre", result: "pass", month: "2026-03" }];
  const p = T.retryPlan(x, h, { today: "2026-11-01" });
  assert.ok(!p.exclude.some((c) => c.lender.name === "水戸信用金庫" && /否決済み/.test(c.reason)));
});
