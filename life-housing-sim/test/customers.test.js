// TDD：お客様を保存（この端末のブラウザの中だけ・送らない）・消す・担当ごとに分ける
// 条件は共有リンクと同じ形（#s=…）で持つので、読み込むときは share.decode の検査を通る
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../lib/customers");
const S = require("../lib/engine");
const Share = require("../lib/share");

const d = S.defaults();
const hash = Share.encode({ ...d, age: 40 }, { defaults: d, keep: S.askFields(d) });

test("保存：名前・担当・条件（リンクの形）・日時。同じ id なら上書き", () => {
  let list = [];
  list = C.save(list, { name: "山田", staff: "佐藤", hash, now: "2026-10-28T10:00:00Z" });
  assert.equal(list.length, 1);
  const id = list[0].id;
  assert.ok(id);
  assert.equal(list[0].hash, hash);
  list = C.save(list, { id, name: "山田 太郎", staff: "佐藤", hash, now: "2026-10-28T11:00:00Z" });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "山田 太郎");
  assert.equal(list[0].updated, "2026-10-28T11:00:00Z");
});

test("名前がないと保存しない（だれの条件かわからなくなるため）", () => {
  assert.throws(() => C.save([], { name: " ", staff: "佐藤", hash }), /名前/);
});

test("消す：1人だけ消える。全部消すもできる", () => {
  let list = C.save([], { name: "A", staff: "佐藤", hash, now: "2026-10-28T10:00:00Z" });
  list = C.save(list, { name: "B", staff: "鈴木", hash, now: "2026-10-28T10:01:00Z" });
  const a = list.find((v) => v.name === "A").id;
  list = C.remove(list, a);
  assert.deepEqual(list.map((v) => v.name), ["B"]);
  assert.deepEqual(C.clear(), []);
});

test("担当ごとに分ける：担当の名前順、担当なしは最後、各担当の中は新しい順", () => {
  let list = [];
  list = C.save(list, { name: "A", staff: "鈴木", hash, now: "2026-10-28T10:00:00Z" });
  list = C.save(list, { name: "B", staff: "佐藤", hash, now: "2026-10-28T10:01:00Z" });
  list = C.save(list, { name: "C", staff: "", hash, now: "2026-10-28T10:02:00Z" });
  list = C.save(list, { name: "D", staff: "佐藤", hash, now: "2026-10-28T10:03:00Z" });
  const g = C.byStaff(list);
  assert.deepEqual(g.map((v) => v.staff), ["佐藤", "鈴木", "担当なし"]);
  assert.deepEqual(g[0].items.map((v) => v.name), ["D", "B"]);
});

test("読み込み：壊れたデータや形の違うものは捨てる。条件は decode を通して開ける", () => {
  assert.deepEqual(C.parse("こわれた"), []);
  assert.deepEqual(C.parse(JSON.stringify([{ name: "x" }, 1, null])), []);
  const list = C.save([], { name: "山田", staff: "佐藤", hash, now: "2026-10-28T10:00:00Z" });
  const back = C.parse(C.serialize(list));
  assert.equal(back.length, 1);
  assert.equal(Share.decode(back[0].hash, d).state.age, 40);
});

test("画面：「保存したお客様」の一覧（担当ごと・開く・消す・全部消す）。保存はこの端末の中だけと書く", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<script src="lib\/customers\.js"><\/script>/);
  assert.match(html, /id="custOpen"/);
  assert.match(html, /CU\.byStaff\(list\)/);
  assert.match(html, /data-open=/);
  assert.match(html, /data-del=/);
  assert.match(html, /全部消す/);
  assert.match(html, /どこにも送りません/);
  assert.match(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "tools/bundle.js"), "utf8"), /lib\/customers\.js/);
});

test("どの画面からでも開ける：トップの左メニュー・条件バー・入力の確認画面", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /\["users", "保存したお客様", "cust"\]/);
  assert.match(html, /g === "cust"\) custOpen\(\)/);
  assert.match(html, /id="fbCust"/);
  assert.match(html, /id="wizSave"/);
});
