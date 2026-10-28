// TDD：¥（いちばん大きな固定費）の絵は、お客様のタイプで変える
// 独身（社宅も）＝「一人で暮らす。戸建てという選択。」／結婚・子どもあり＝これまでの「賃貸の仕組み」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

test("独身・社宅は戸建ての絵、結婚・子どもありは賃貸の仕組みの絵（どちらもファイルがある）", () => {
  for (const p of ["single", "shataku"]) assert.equal(S.rentImage(S.compute(S.preset(p))).src, "img/rent-mechanism-single.jpg", p);
  assert.equal(S.rentImage(S.compute(S.preset("family"))).src, "img/rent-mechanism.jpg");
  for (const p of ["single", "family"]) {
    const im = S.rentImage(S.compute(S.preset(p)));
    assert.ok(fs.existsSync(path.join(__dirname, "..", im.src)), im.src);
    assert.ok(im.alt.length > 20);
  }
});

test("独身の資料（¥）には、戸建てを持つと何ができるか（3つ）と、絵の注記（税金・修繕・売却価格は変わる）", () => {
  const s = S.deck(S.compute(S.defaults())).slides.find((v) => v.key === "fixed");
  const t = s.points.join("／");
  assert.match(t, /暮らしに合わせて/);
  assert.match(t, /借入残高/);
  assert.match(t, /売却・賃貸/);
  assert.match(t, /税金・修繕/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(t, re);
});
