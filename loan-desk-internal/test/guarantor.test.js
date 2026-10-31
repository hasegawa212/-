// 保証会社（保証機関）: 同じ保証会社で否決されたら、その保証会社しか使わない金融機関には出さない
const test = require("node:test");
const assert = require("node:assert/strict");
const LSA = require("../../loan-screening-app/lib/screening.js");
const { LENDERS } = require("../data/lenders.js");
const { GUARANTORS, LENDER_GUARANTORS } = require("../data/guarantors.js");
const R = require("../lib/recommend.js");
const base = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 400, incomePrev: 400, incomePrev2: 400, tenure: 5, employ: "regular",
  price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });
const names = (list) => list.map((c) => c.lender.name);

test("保証会社のデータ: 金融機関の保証会社はすべて定義済みで、根拠（src）がある", () => {
  for (const [lender, gs] of Object.entries(LENDER_GUARANTORS)) {
    assert.ok(LENDERS.some((l) => l.name === lender), lender);
    for (const g of gs) { assert.ok(GUARANTORS[g.id], g.id); assert.ok(["社内記録", "公開情報", "要確認"].includes(g.src)); }
  }
});

test("候補に保証会社が付く", () => {
  const r = R.recommend(base);
  const mito = r.candidates.find((c) => c.lender.name === "水戸信用金庫");
  assert.deepEqual(mito.guarantors.map((g) => g.name), ["しんきん保証基金", "全国保証"]);
});

test("否決された金融機関の保証会社を覚え、その保証会社しか使わない先は外す（筑波=全国保証 → 茨城県信用組合も外す）", () => {
  const r = R.recommend(Object.assign({}, base, { rejectedLenders: ["筑波銀行"] }));
  assert.ok(r.rejectedGuarantors.includes("zenkoku"));
  const ex = r.excluded.find((c) => c.lender.name === "茨城県信用組合") || r.avoid.find((c) => c.lender.name === "茨城県信用組合");
  assert.ok(ex);
  assert.ok(!names(r.candidates).includes("筑波銀行"));
});

test("別の保証ルートがある先は外さず、確認することを出す（東邦銀行は東邦信用保証のルート）", () => {
  const r = R.recommend(Object.assign({}, base, { rejectedLenders: ["筑波銀行"] }));
  const touhou = r.candidates.find((c) => c.lender.name === "東邦銀行");
  assert.ok(touhou);
  assert.match(touhou.guarantorNote, /東邦信用保証/);
});

test("保証会社を直接指定しても外せる（しんきん保証基金で否決 → 確定ルートがそれだけの信金は、全国保証ルートの確認が条件）", () => {
  const r = R.recommend(Object.assign({}, base, { rejectedGuarantors: ["shinkin"] }));
  const mito = r.candidates.find((c) => c.lender.name === "水戸信用金庫");
  assert.ok(mito);
  assert.match(mito.guarantorNote, /全国保証.*確認/);
  const r2 = R.recommend(Object.assign({}, base, { rejectedGuarantors: ["shinkin", "zenkoku"] }));
  assert.ok(!names(r2.candidates).includes("水戸信用金庫"));
});

test("出す順番は、2番目以降を別の保証会社にする（同じ保証会社に続けて出さない）", () => {
  const r = R.recommend(base);
  const seen = new Set();
  for (const c of r.planItems) {
    const ids = c.guarantors.filter((g) => g.src !== "要確認").map((g) => g.id);
    if (ids.length) { assert.ok(!ids.every((id) => seen.has(id)), c.lender.name); ids.forEach((id) => seen.add(id)); }
  }
});

test("信用保証協会は住宅ローンを扱わない旨と、保証会社は業者も審査する旨を返す", () => {
  const r = R.recommend(base);
  assert.match(r.guarantorNote, /信用保証協会/);
  assert.match(r.guarantorNote, /業者/);
});
