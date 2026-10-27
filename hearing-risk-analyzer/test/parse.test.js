// TDD：#03_商談報告 の文章から、必要な項目を取り出せること
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse, yen } = require("../lib/parse");

const SAMPLE = fs.readFileSync(path.join(__dirname, "../samples/sample.txt"), "utf8");

test("金額の書き方（円・万・カンマ）を円に直す", () => {
  assert.equal(yen("5,796,962円"), 5_796_962);
  assert.equal(yen("60万"), 600_000);
  assert.equal(yen("4.6万"), 46_000);
  assert.equal(yen("残180万"), 1_800_000);
  assert.equal(yen("なし"), null);
});

test("基本情報と年収の推移を読む", () => {
  const r = parse(SAMPLE);
  assert.equal(r.date, "2026/10/20");
  assert.equal(r.age, 28);
  assert.deepEqual(r.incomes.map((x) => x.amount), [5_200_000, 4_100_000, 4_000_000]);
  assert.equal(r.incomes[0].label, "R7年");
  assert.equal(r.bonus, 900_000);
  assert.equal(r.employer, "宇都宮市立〇〇中学校");
  assert.equal(r.rank, "C");
  assert.equal(r.negotiations, 3);
});

test("お金の状況・希望条件・動機を読む", () => {
  const r = parse(SAMPLE);
  assert.equal(r.savings, 500_000);
  assert.equal(r.rent, 50_000);
  assert.equal(r.carLoanBalance, 1_500_000);
  assert.equal(r.wish.monthly, 80_000);
  assert.equal(r.wish.bonusEach, 100_000);
  assert.equal(r.wish.parking, 2);
  assert.equal(r.motive, "結婚");
  assert.ok(r.notes.some((l) => l.includes("赤字申告")));
  assert.ok(r.summary.includes("婚約者"));
});

test("書類のチェック（✅/⬜）を数える", () => {
  const r = parse(SAMPLE);
  assert.equal(r.docs.length, 5);
  assert.deepEqual(r.docs.filter((d) => d.done).map((d) => d.name), ["源泉1期", "給料明細"]);
});
