const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/screening.js");
const NOW = "2026-10-31T09:00:00+09:00";
const run = (p, pol, opt) => L.screen(Object.assign({}, L.SAMPLE, p), pol || "megabank", Object.assign({ now: NOW }, opt));
const flat = (p, pol) => run(Object.assign({ floor: 100 }, p), pol || "flat35");

// ---------- 型 ----------
test("信用金庫型がある。地域条件と会員の閾値を持つ", () => {
  const s = L.PRESETS.shinkin;
  assert.ok(s);
  assert.equal(s.label, "信用金庫型");
  assert.equal(s.requireArea, true);
  assert.ok(s.memberThreshold > 0);
  assert.equal(s.guarantor.type, "shinkin");
});

test("全ての型が保証機関・事務手数料・借入額の範囲を持つ", () => {
  for (const p of Object.values(L.PRESETS)) {
    assert.ok(["bank", "shinkin", "none", "waived"].includes(p.guarantor.type), p.id);
    assert.ok(p.guarantor.label);
    assert.ok(["fixed", "rate"].includes(p.adminFee.type));
    assert.ok(p.loanMin >= 0 && p.loanMax > p.loanMin);
    assert.ok(["collateral", "price"].includes(p.ltvBase));
  }
  assert.equal(L.PRESETS.flat35.guarantor.type, "none");
  assert.equal(L.PRESETS.flat35.ltvBase, "price");
  assert.equal(L.PRESETS.flat35.loanMax, 8000);
  assert.equal(L.PRESETS.flat35.ageMax, 69);
  assert.equal(L.PRESETS.net.guarantor.type, "waived");
});

test("信用保証協会は住宅ローンを扱わない旨を返す", () => {
  assert.match(L.GUARANTOR_NOTE, /信用保証協会/);
  assert.match(L.GUARANTOR_NOTE, /事業資金/);
  assert.match(run({}).guarantorNote, /住宅ローン/);
});

// ---------- フラット35 ----------
test("フラット35のポイント: 子育てプラスとS", () => {
  assert.equal(L.flatPoints({ kids: 2 }), 2);
  assert.equal(L.flatPoints({ kids: 0, youngCouple: true }), 1);
  assert.equal(L.flatPoints({ kids: 1, youngCouple: true }), 1); // 子がいれば子の数
  assert.equal(L.flatPoints({ kids: 0, flatS: "zeh" }), 3);
  assert.equal(L.flatPoints({ kids: 0, flatS: "a" }), 2);
  assert.equal(L.flatPoints({ kids: 0, flatS: "b" }), 1);
  assert.equal(L.flatPoints({ kids: 2, flatS: "zeh" }), 5);
});

test("引下げ: 1ptにつき当初5年0.25%（最大1.0%）、5pt以上は6〜10年目に (pt−4)×0.25%", () => {
  assert.deepEqual(L.flatReduction(0), []);
  assert.deepEqual(L.flatReduction(2), [{ from: 1, to: 5, cut: 0.5 }]);
  assert.deepEqual(L.flatReduction(4), [{ from: 1, to: 5, cut: 1.0 }]);
  assert.deepEqual(L.flatReduction(5), [{ from: 1, to: 5, cut: 1.0 }, { from: 6, to: 10, cut: 0.25 }]);
  assert.deepEqual(L.flatReduction(7), [{ from: 1, to: 5, cut: 1.0 }, { from: 6, to: 10, cut: 0.75 }]);
});

test("融資率は物件価格で計算し、9割超は金利が上がる", () => {
  const lo = flat({ price: 3000, down: 400, flatRate: 3.46 });   // 融資率 86.7%
  const hi = flat({ price: 3000, down: 100, flatRate: 3.46 });   // 融資率 96.7%
  assert.ok(Math.abs(lo.flat.ltv - 2600 / 3000 * 100) < 1e-9);
  assert.equal(lo.flat.highLtv, false);
  assert.equal(hi.flat.highLtv, true);
  assert.ok(Math.abs(hi.flat.baseRate - (3.46 + L.PRESETS.flat35.highLtv.add)) < 1e-9);
  assert.ok(Math.abs(lo.flat.baseRate - 3.46) < 1e-9);
});

test("フラット35の適用金利は flatRate を使い、団信に入らなければ0.2%下がる。引下げは当初金利に反映", () => {
  const a = flat({ price: 3000, down: 400, flatRate: 3.46, danshin: "ok", kids: 0 });
  assert.ok(Math.abs(a.input.rate - 3.46) < 1e-9);
  const b = flat({ price: 3000, down: 400, flatRate: 3.46, danshin: "no", kids: 0 });
  assert.ok(Math.abs(b.input.rate - 3.26) < 1e-9);
  const c = flat({ price: 3000, down: 400, flatRate: 3.46, kids: 2 });
  assert.ok(Math.abs(c.flat.firstRate - 2.96) < 1e-9);
  assert.ok(Math.abs(c.input.rate - 3.46) < 1e-9); // 審査は引下げ前の金利で
});

test("フラット35: 借入額の範囲・旧耐震・床面積", () => {
  const big = flat({ price: 9500, down: 500, income: 2000, incomePrev: 2000, flatRate: 3.46 });
  assert.equal(big.stages.find((s) => s.key === "capacity").checks.find((c) => c.key === "loanRange").status, "ng");
  assert.notEqual(big.decision, "approve");
  const q = flat({ property: "usedMansion", builtYears: 46, oldQuake: true, flatRate: 3.46 });
  assert.equal(q.stages.find((s) => s.key === "property").checks.find((c) => c.key === "quake").status, "ng");
  assert.equal(run({ oldQuake: true, property: "usedMansion", builtYears: 46 }).stages.find((s) => s.key === "property").checks.find((c) => c.key === "quake").status, "warn");
});

test("フラット35は保証料0・保証人不要、事務手数料は定率", () => {
  const r = flat({ price: 3000, down: 400, flatRate: 3.46 });
  assert.equal(r.fees.guarantee.lump, 0);
  assert.equal(r.fees.guarantee.rateAdd, 0);
  assert.ok(Math.abs(r.fees.admin - r.loan * 10000 * L.PRESETS.flat35.adminFee.value / 100) < 1);
});

// ---------- 信用金庫 ----------
test("信用金庫型: 営業地域外は否決", () => {
  assert.equal(run({ inArea: false }, "shinkin").decision, "reject");
  assert.notEqual(run({ inArea: true }, "shinkin").decision, "reject");
  // 他の型では地域を問わない
  assert.notEqual(run({ inArea: false }, "megabank").decision, "reject");
});

test("信用金庫型: 会員の閾値を超えると出資金が条件と書類に出る", () => {
  const r = run({ inArea: true }, "shinkin");
  assert.ok(r.loan > L.PRESETS.shinkin.memberThreshold);
  assert.ok(r.conditions.some((c) => /出資/.test(c)));
  assert.ok(r.docsRequired.some((d) => /出資/.test(d.label)));
  const small = run({ inArea: true, price: 900, down: 300 }, "shinkin");
  assert.ok(!small.docsRequired.some((d) => /出資/.test(d.label)));
});

// ---------- 保証料・事務手数料 ----------
test("一括前払いの保証料は借入額と期間に比例し、格付が下がるほど高い", () => {
  const P = L.resolvePolicy("megabank");
  const a = L.guaranteeCost({ feeType: "lump" }, P, "A", 3000, 35);
  const a2 = L.guaranteeCost({ feeType: "lump" }, P, "A", 1500, 35);
  const a3 = L.guaranteeCost({ feeType: "lump" }, P, "A", 3000, 20);
  const c = L.guaranteeCost({ feeType: "lump" }, P, "C", 3000, 35);
  assert.ok(Math.abs(a.lump - 2 * a2.lump) < 1);
  assert.ok(a3.lump < a.lump);
  assert.ok(c.lump > a.lump);
  assert.equal(a.rateAdd, 0);
  assert.equal(a.lump, P.guarantor.lumpPer100.A * 30);
});

test("金利上乗せ型は保証料率を適用金利に足し、一括は0", () => {
  const P = L.resolvePolicy("megabank");
  const g = L.guaranteeCost({ feeType: "rate" }, P, "B", 3000, 35);
  assert.equal(g.lump, 0);
  assert.equal(g.rateAdd, P.guarantee.B.fee);
});

test("ネット銀行型は保証料0、事務手数料は借入額の2.2%", () => {
  const r = run({ feeType: "lump" }, "net");
  assert.equal(r.fees.guarantee.lump, 0);
  assert.ok(Math.abs(r.fees.admin - r.loan * 10000 * 0.022) < 1);
  const m = run({}, "megabank");
  assert.equal(m.fees.admin, L.PRESETS.megabank.adminFee.value);
});

test("保証会社の工程に保証機関と支払い方法が出る", () => {
  const r = run({ feeType: "lump" }, "shinkin");
  const g = r.stages.find((s) => s.key === "guarantee");
  assert.ok(g.checks.some((c) => c.key === "guarantor" && /信用金庫/.test(c.value)));
  assert.ok(g.checks.some((c) => c.key === "feeType" && /一括/.test(c.value)));
  assert.ok(r.fees.total > 0);
});

test("表示文に断定・約束の言葉を使わない（v3の画面文言）", () => {
  for (const r of [flat({ kids: 2 }), run({ inArea: false }, "shinkin"), run({ feeType: "lump" })]) {
    const text = JSON.stringify([r.conditions, r.stages, r.flat, r.fees, r.guarantorNote]);
    for (const w of [/必ず通/, /絶対/, /確実に/, /審査に通ります/, /保証します/]) assert.doesNotMatch(text, w);
  }
});
