const test = require("node:test");
const assert = require("node:assert");
const HB = require("../game/logic.js");

const ring = (o) => Object.assign({ x: 100, y: 100, r0: 50, born: 0, life: 2, gold: false }, o);

test("リングは寿命で 0 まで縮む", () => {
  assert.strictEqual(HB.radiusAt(ring(), 0), 50);
  assert.strictEqual(HB.radiusAt(ring(), 1), 25);
  assert.strictEqual(HB.radiusAt(ring(), 2), 0);
});

test("中心ヒットは2倍、金は3倍、外れはコンボ0", () => {
  const edge = HB.hit([ring()], 140, 100, 0, 0);
  assert.deepStrictEqual([edge.index, edge.center, edge.points, edge.combo], [0, false, 100, 1]);
  const center = HB.hit([ring({ gold: true })], 105, 100, 0, 0);
  assert.strictEqual(center.points, 100 * 2 * 3);
  const miss = HB.hit([ring()], 300, 300, 0, 7);
  assert.deepStrictEqual([miss.index, miss.combo], [-1, 0]);
  // 縮んだ後は、さっきまで当たっていた位置でも外れ
  assert.strictEqual(HB.hit([ring()], 140, 100, 1.5, 0).index, -1);
});

test("重なっていたら新しい（手前の）リングが割れる", () => {
  assert.strictEqual(HB.hit([ring(), ring({ born: 0.1 })], 100, 100, 0.2, 0).index, 1);
});

test("コンボ倍率は5連続ごとに+1、最大×5", () => {
  assert.deepStrictEqual([0, 4, 5, 9, 10, 100].map(HB.multiplier), [1, 1, 2, 2, 3, 5]);
  assert.strictEqual(HB.hit([ring()], 140, 100, 0, 4).points, 200);
});

test("時間とともに難しくなる", () => {
  const a = HB.difficulty(0), b = HB.difficulty(60);
  assert.ok(b.life < a.life && b.spawn < a.spawn);
  assert.deepStrictEqual(HB.difficulty(999), b);
});
