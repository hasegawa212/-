const test = require("node:test");
const assert = require("node:assert/strict");
const { creditSummary } = require("../lib/credit.js");

const clean = { cic: { late: "none", apply: 1 }, jicc: { late: "none", apply: 0 }, ksc: { late: "none", apply: 1, kanpo: false } };
const clone = (o) => JSON.parse(JSON.stringify(o));

test("3機関とも問題なし", () => {
  const r = creditSummary({ credit: clean });
  assert.equal(r.knockout, false);
  assert.equal(r.worstLate, "none");
  assert.equal(r.items.length, 3);
});

test("異動がどこか1つの機関にあれば足切り", () => {
  for (const b of ["cic", "jicc", "ksc"]) {
    const c = clone(clean); c[b].late = "jiko";
    const r = creditSummary({ credit: c });
    assert.equal(r.knockout, true, b);
    assert.equal(r.worstLate, "jiko");
  }
});

test("官報情報（破産）は足切り", () => {
  const c = clone(clean); c.ksc.kanpo = true;
  assert.equal(creditSummary({ credit: c }).knockout, true);
});

test("申込件数は合計ではなく機関ごとの最大値", () => {
  const c = clone(clean); c.cic.apply = 3; c.jicc.apply = 3; c.ksc.apply = 2;
  assert.equal(creditSummary({ credit: c }).applyMax, 3);
});

test("いちばん重い延滞を代表にする", () => {
  const c = clone(clean); c.cic.late = "past"; c.jicc.late = "recent";
  assert.equal(creditSummary({ credit: c }).worstLate, "recent");
});
