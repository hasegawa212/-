const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../lib/customers.js");

test("イニシャルはローマ字2〜3文字だけ。漢字・かな・長い名前・数字は断る", () => {
  assert.equal(C.normInitials("st"), "S.T");
  assert.equal(C.normInitials("S.T."), "S.T");
  assert.equal(C.normInitials("ＫＹＭ"), "K.Y.M");
  for (const bad of ["斎藤", "さいとう", "SAITO", "S", "090", "S1"]) assert.equal(C.normInitials(bad), null, bad);
});

test("保存するのは決めた入力だけ（メモ・名前・電話の欄は落とす）", () => {
  const r = C.save([], { initials: "S.T", staff: "上田", input: { age: 27, income: 355, single: true, name: "山田太郎", tel: "090-1111-2222", memo: "x", rejected: ["JA"] } }, "2026-11-01 10:00");
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.item.input).sort(), ["age", "income", "rejected", "single"]);
  assert.doesNotMatch(JSON.stringify(r.list), /山田|090/);
});

test("名前を入れようとすると保存しない。担当に電話番号は入れない", () => {
  assert.equal(C.save([], { initials: "斎藤", staff: "上田", input: {} }).ok, false);
  assert.equal(C.save([], { initials: "ST", staff: "09011112222", input: {} }).ok, false);
});

test("同じイニシャル＋担当は上書き、新しいものが先頭。削除できる", () => {
  let l = C.save([], { initials: "ST", staff: "上田", input: { age: 27 } }, "a").list;
  l = C.save(l, { initials: "KY", staff: "上田", input: { age: 30 } }, "b").list;
  l = C.save(l, { initials: "S.T", staff: "上田", input: { age: 28 } }, "c").list;
  assert.equal(l.length, 2);
  assert.equal(l[0].initials, "S.T");
  assert.equal(l[0].input.age, 28);
  assert.equal(C.remove(l, l[0].id).length, 1);
});

test("保存先が壊れていても落ちない。読み込むときも決めた形に直す", () => {
  const mem = { v: "{bad", getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  assert.deepEqual(C.load(mem), []);
  mem.v = JSON.stringify([{ initials: "ST", staff: "a", input: { age: 1, name: "x" } }, { initials: "山田" }]);
  const l = C.load(mem);
  assert.equal(l.length, 1);
  assert.deepEqual(Object.keys(l[0].input), ["age"]);
  assert.ok(C.store(mem, l));
});
