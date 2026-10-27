// TDD：名前は「LIFE ROUTE（ライフルート）」。トップ・提案書・画面・送るファイルで同じ名前
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

test("名前の定義は1か所（APP）：LIFE ROUTE／ライフルート／住まいとお金、95歳までの道のり", () => {
  assert.deepEqual(S.APP, { name: "LIFE ROUTE", kana: "ライフルート", tagline: "住まいとお金、95歳までの道のり" });
});

test("トップページと提案書の表紙に、同じ名前が出る", () => {
  const x = S.compute(S.defaults());
  const h = S.home(x);
  assert.equal(h.hero.title, "LIFE ROUTE");
  assert.equal(h.hero.kana, "ライフルート");
  assert.equal(h.hero.catch, S.APP.tagline);
  const c = S.proposal(x).cover;
  assert.equal(c.title, "LIFE ROUTE");
  assert.match(c.sub, /ライフルート/);
});

test("画面と送るファイルから、古い名前（住まいの一生シミュレーター・ライフパートナー）が消えている", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /住まいの一生シミュレーター|ライフパートナー|LIFE PARTNER/);
  assert.match(html, /<title>LIFE ROUTE/);
  const dist = fs.readdirSync(path.join(root, "dist"));
  assert.ok(dist.includes("ライフルート.html"));
  for (const f of dist) assert.match(f, /^ライフルート/, "送るファイルはすべて新しい名前（見本の資料PDFも）");
});
