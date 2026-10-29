// TDD：保存したお客様を見つけやすく・使いやすく
// ボタンに人数／入力の最初の画面に「続きから」（新しい順）／一覧で検索（ひらがな・カタカナどちらでも）／各行に年齢・年収
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CU = require("../lib/customers");

let list = [];
list = CU.save(list, { name: "やまだ太郎", staff: "佐藤", hash: "#s=a", now: "2026-10-01T00:00:00Z" });
list = CU.save(list, { name: "鈴木花子", staff: "", hash: "#s=b", now: "2026-10-20T00:00:00Z" });
list = CU.save(list, { name: "田中一郎", staff: "サトウ", hash: "#s=c", now: "2026-10-10T00:00:00Z" });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("新しい順に n 人（「続きから」に出す）", () => {
  assert.deepEqual(CU.recent(list, 2).map((v) => v.name), ["鈴木花子", "田中一郎"]);
  assert.equal(CU.recent(list).length, 3);
  assert.deepEqual(CU.recent([], 3), []);
});

test("検索：名前・担当の一部で。ひらがな／カタカナ、空白、大文字小文字を気にしない", () => {
  assert.deepEqual(CU.search(list, "ヤマダ").map((v) => v.name), ["やまだ太郎"]);
  assert.deepEqual(CU.search(list, "さとう").map((v) => v.name), ["田中一郎"]);
  assert.deepEqual(CU.search(list, "佐藤").map((v) => v.name), ["やまだ太郎"]);
  assert.deepEqual(CU.search(list, " 花子 ").map((v) => v.name), ["鈴木花子"]);
  assert.equal(CU.search(list, "").length, 3);
  assert.equal(CU.search(list, "いない人").length, 0);
});

test("ボタンに人数を出す（保存したお客様（3））", () => {
  assert.match(html, /function custLabel\(\)/);
  assert.match(html, /保存したお客様（\$\{n\}）/);
  assert.match(html, /custTitle\(\)/);
  for (const id of ["custOpen", "fbCust"]) assert.match(html, new RegExp(`\\$\\("${id}"\\)`));
});

test("入力の最初の画面に「続きから」：保存があるときだけ、新しい順に開ける", () => {
  assert.match(html, /id="wizCust"/);
  assert.match(html, /続きから/);
  assert.match(html, /LHSCustomers\.recent\(/);
  assert.match(html, /id="wizCustAll"/);
});

test("一覧：検索欄、各行に年齢・年収（条件から）、保存のあとに「次からはここから開けます」", () => {
  assert.match(html, /id="custSearch"/);
  assert.match(html, /CU\.search\(/);
  assert.match(html, /function custBrief\(/);
  assert.match(html, /LHSShare\.decode\(/);
  assert.match(html, /次からは/);
});
