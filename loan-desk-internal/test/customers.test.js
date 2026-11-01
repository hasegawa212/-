const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../lib/customers.js");

test("呼び名はイニシャル（ローマ字2〜3文字）か姓（漢字・かな4文字まで）。長い名前・数字・空白入りは断る", () => {
  assert.equal(C.normInitials("st"), "S.T");
  assert.equal(C.normInitials("S.T."), "S.T");
  assert.equal(C.normInitials("ＫＹＭ"), "K.Y.M");
  assert.equal(C.normInitials("斎藤"), "斎藤");
  assert.equal(C.normInitials("さいとう"), "さいとう");
  for (const bad of ["斎藤 理央", "長谷川光太郎", "SAITO", "S", "090", "S1", "斎藤1"]) assert.equal(C.normInitials(bad), null, bad);
});

test("保存するのは決めた入力だけ（メモ・名前・電話の欄は落とす）", () => {
  const r = C.save([], { initials: "S.T", staff: "上田", input: { age: 27, income: 355, single: true, name: "山田太郎", tel: "090-1111-2222", memo: "x", rejected: ["JA"] } }, "2026-11-01 10:00");
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.item.input).sort(), ["age", "income", "rejected", "single"]);
  assert.doesNotMatch(JSON.stringify(r.list), /山田|090/);
});

test("名前を入れようとすると保存しない。担当に電話番号は入れない", () => {
  assert.equal(C.save([], { initials: "斎藤 理央", staff: "上田", input: {} }).ok, false);
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
  mem.v = JSON.stringify([{ initials: "ST", staff: "a", input: { age: 1, name: "x" } }, { initials: "山田 太郎" }]);
  const l = C.load(mem);
  assert.equal(l.length, 1);
  assert.deepEqual(Object.keys(l[0].input), ["age"]);
  assert.ok(C.store(mem, l));
});

test("書き出し→読み込みで元に戻る。同じお客様は新しいほうを残し、ほかのファイルは断る", () => {
  let a = C.save([], { initials: "斎藤", staff: "上田", input: { age: 27, posted: "2026-10-01", flag: "", notes: "借入額は仮に2,500万" } }, "2026-10-01 00:00").list;
  a = C.save(a, { initials: "ST", staff: "犬塚", input: { age: 30 } }, "2026-10-02 00:00").list;
  const text = C.exportText(a, "2026-11-01");
  const r = C.importText([], text);
  assert.ok(r.ok); assert.equal(r.added, 2); assert.deepEqual(r.list, a);
  const older = C.save([], { initials: "斎藤", staff: "上田", input: { age: 26, posted: "2026-10-01" } }, "2026-09-01 00:00").list;
  const r2 = C.importText(older, text);
  assert.equal(r2.updated, 1); assert.equal(r2.list.find((x) => x.initials === "斎藤").input.age, 27);
  assert.equal(C.importText([], JSON.stringify({ kind: "other", items: [] })).ok, false);
  assert.equal(C.importText([], "{").ok, false);
  const bad = JSON.stringify({ kind: C.KIND, items: [{ initials: "山田太郎さん", staff: "x", input: {} }] });
  assert.equal(C.importText([], bad).skipped, 1);
});

test("探す: 姓・担当・県で絞れる（ひらがなとカタカナは同じ扱い）", () => {
  let l = C.save([], { initials: "さいとう", staff: "上田", input: { pref: "茨城" } }, "a").list;
  l = C.save(l, { initials: "KY", staff: "犬塚", input: { pref: "群馬" } }, "b").list;
  assert.equal(C.search(l, "サイトウ").length, 1);
  assert.equal(C.search(l, "犬塚").length, 1);
  assert.equal(C.search(l, "群馬")[0].initials, "K.Y");
  assert.equal(C.search(l, "").length, 2);
  assert.deepEqual(C.staffs(l), ["上田", "犬塚"].sort());
});

test("同じ姓・同じ担当でも、掲載日が違えば別のお客様として残る。旧字（﨑）も読める", () => {
  let l = C.save([], { initials: "佐藤", staff: "坂本", input: { age: 27, posted: "2026-03-29" } }, "a").list;
  l = C.save(l, { initials: "佐藤", staff: "坂本", input: { age: 26, posted: "2025-09-30" } }, "b").list;
  assert.equal(l.length, 2);
  assert.equal(C.normInitials("朽﨑"), "朽﨑");
});
