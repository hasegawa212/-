// TDD：トップページの「Lv.」は意味が伝わりにくい → 「準備 ◯/◯ できた」（やることの数のうち、できた数）で見せる
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());

test("エリアごとに「やること」の数と、できた数がわかる", () => {
  const h = S.home(x);
  for (const a of h.areas) {
    assert.equal(a.total, a.missions.length);
    assert.equal(a.doneCount, a.missions.filter((m) => m.done).length);
    assert.match(a.readiness, new RegExp(`^準備 ${a.doneCount}/${a.total} できた$`));
  }
});

test("全体でも「準備 ◯/◯ できた」、チェックすると増える", () => {
  const h0 = S.home(x), h1 = S.home(x, { preApproval: true, nenkin: true });
  const all = h0.areas.reduce((s, a) => s + a.total, 0);
  assert.equal(h0.hero.total, all);
  assert.equal(h1.hero.doneCount, h0.hero.doneCount + 2);
  assert.match(h1.hero.readiness, /^準備 \d+\/\d+ できた$/);
  assert.match(h0.hero.howto, /チェック/, "数え方の説明がある");
});
