const test = require("node:test");
const assert = require("node:assert/strict");
const RM = require("../lib/rolemap");
const D = require("../data/roles");
const PLAN = require("../data/handoff");

test("本物の割り当て案：代表と担当なしの仕事すべてに案があり、エラー0", () => {
  const h = RM.handoff(D, PLAN, D.ceoId);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.missing, []);
});

test("本物の割り当て案：席は立候補の席 ID だけ、案に人の名前を書かない（立候補で決める）", () => {
  const names = D.people.flatMap((p) => [p.name, p.name.split(" ")[0]]);
  for (const [id, v] of Object.entries(PLAN)) {
    if (v.seat) assert.match(v.seat, /^(E-[0-8]|S-([1-9]|10)|M-1|P-[12]|K-[1-5])$/, id);
    for (const n of names) assert.ok(!(v.note || "").includes(n), `${id} の note に ${n}`);
  }
});

test("本物の割り当て案：代表に残る仕事は半分以下になる", () => {
  const h = RM.handoff(D, PLAN, D.ceoId);
  assert.ok(h.ceoAfter.length * 2 <= h.ceoBefore, `${h.ceoAfter.length}/${h.ceoBefore}`);
});

test("席の名前：案で使う席すべてに名前がある", () => {
  const SEATS = require("../data/seats");
  for (const v of Object.values(PLAN)) if (v.seat) assert.ok(SEATS[v.seat], v.seat);
});
