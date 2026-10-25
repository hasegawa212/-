// TDD：2つの版（マーシャルアーツ／ジャパンマネジメント）の設定が揃っていること
const test = require("node:test");
const assert = require("node:assert/strict");
const LL = require("../lib/engine");
const EDITIONS = require("../editions");

const IDS = ["martialarts", "japan-mgmt"];

test("2つの版が登録されている", () => {
  assert.deepEqual(Object.keys(EDITIONS).sort(), [...IDS].sort());
});

for (const id of IDS) {
  const ed = EDITIONS[id];
  test(`${id}：会社情報・写真の表示・サンプルがそろっている`, () => {
    for (const k of ["name", "nameEn", "site", "tel", "license"]) assert.ok(ed.brand[k], `brand.${k}`);
    assert.ok(ed.photoCaption, "写真の注記");
    assert.equal(ed.sample.props.length, 2);
    const x = LL.compute(ed.sample);
    for (const p of x.props) {
      for (const v of [p.pmt, p.own.total, p.cashLeft, p.credit.total, p.ten.with, p.screen.ratio]) assert.ok(Number.isFinite(v), "数値が有限");
    }
  });
}

test("マーシャルアーツ版：お客様層に合わせたサンプル（反響の賃貸世帯・リフォーム済み中古と新築の比較・諸費用ローン）", () => {
  const ed = EDITIONS.martialarts;
  const kinds = ed.sample.props.map((p) => p.kind).sort();
  assert.ok(kinds.includes("resale") || kinds.includes("used"), "中古（買取再販）を比較に含める");
  assert.ok(ed.sample.props.some((p) => p.financeCosts), "諸費用ローンのケースがある");
  assert.ok(ed.sample.customer.monthlyWish > 0, "月々の支払い希望（ヒアリング項目）がある");
  assert.equal(ed.sample.customer.household, "single");
});

test("ジャパンマネジメント版：これまでのサンプルを維持（回帰）", () => {
  const x = LL.compute(EDITIONS["japan-mgmt"].sample);
  assert.equal(Math.round(x.props[0].pmt), 97_979);
  assert.equal(x.props[0].credit.total, 2_437_300);
});
