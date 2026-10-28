// TDD：「今払ってる賃料が将来の資産になる」の絵を ② と 資料の結論 に入れる
// 正直に：家賃そのものが資産になるのではなく、家賃のかわりに返したローンの元金（＋頭金）が家の代金として残る。家の価値は上下する
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("assetImage：画像・代替テキスト・正直な説明（元金が家の代金として残る／価値は上下する）", () => {
  const im = S.assetImage(x);
  assert.equal(im.src, "img/rent-to-asset.jpg");
  assert.ok(fs.existsSync(path.join(__dirname, "..", im.src)));
  assert.match(im.alt, /今払ってる賃料が将来の資産になる/);
  assert.match(im.caption, /元金/);
  assert.match(im.caption, new RegExp(S.man(S.costCompare(x).own.house)));
  assert.match(im.caption, /上がることも下がることも/);
});

test("資料の結論：購入をすすめるときは絵＋家の代金、準備をすすめるときは今までの表（絵は出さない）", () => {
  const c = S.deck(x).slides.find((s) => s.key === "conclusion");
  assert.equal(c.visual, "asset");
  assert.ok(c.kpis.some((k) => k.value === S.man(S.costCompare(x).own.house)));
  assert.match(c.points.join("／"), /上がることも下がることも/);
  // 準備をすすめる人（持ち家が有利な項目が少ない）
  const poor = S.compute({ ...S.defaults(), age: 50, income: 2_500_000, rent: { ...S.defaults().rent, single: 30_000, old: 30_000 }, own: { ...S.defaults().own, price: 45_000_000 } });
  const c2 = S.deck(poor).slides.find((s) => s.key === "conclusion");
  if (S.recommend(poor).verdict === "prepare") assert.equal(c2.visual, "recommend");
});

test("画面：②に絵（Zoomでは省く）、資料の asset、1ファイル版に絵を入れる", () => {
  assert.match(html, /function assetView\(x\)/);
  assert.match(html, /asset: \(\) => assetView\(x\)/);
  assert.match(html, /costView\(x\) \+ futureView\(x\) \+ assetView\(x\)/);
  assert.match(html, /body\.present \.assetimg/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "tools/bundle.js"), "utf8"), /img\/rent-to-asset\.jpg/);
});

test("禁止の言い方はしない", () => {
  const all = JSON.stringify([S.assetImage(x), S.deck(x).slides.find((s) => s.key === "conclusion")]);
  for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !all.includes(f) : !f.test(all), String(f));
});
