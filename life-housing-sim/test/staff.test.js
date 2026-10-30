// TDD：営業の子たちが使えるように
// ①端末ごとの担当者アカウント（パスワードなし・この端末の中だけ）②お客様の登録をわかりやすく ③アプリ内の「使い方」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CU = require("../lib/customers");
const S = require("../lib/engine");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("担当者アカウント：登録すると、その人で使う。同じ名前は1つ。切り替え・この端末から消す", () => {
  let s = CU.staffParse(null);
  assert.deepEqual(s, { current: "", list: [] });
  s = CU.staffAdd(s, " 佐藤 ");
  assert.deepEqual(s, { current: "佐藤", list: ["佐藤"] });
  s = CU.staffAdd(s, "鈴木");
  s = CU.staffAdd(s, "佐藤");
  assert.deepEqual(s, { current: "佐藤", list: ["佐藤", "鈴木"] });
  s = CU.staffUse(s, "鈴木");
  assert.equal(s.current, "鈴木");
  assert.equal(CU.staffUse(s, "いない人").current, "鈴木", "登録していない名前には切り替えない");
  s = CU.staffRemove(s, "鈴木");
  assert.deepEqual(s, { current: "", list: ["佐藤"] });
  assert.throws(() => CU.staffAdd(s, "  "), /名前/);
});

test("読み込み：壊れたデータは空に、今の担当が一覧にないときは空に、長すぎる名前は切る", () => {
  assert.deepEqual(CU.staffParse("{x"), { current: "", list: [] });
  assert.deepEqual(CU.staffParse(JSON.stringify({ current: "X", list: ["佐藤"] })), { current: "", list: ["佐藤"] });
  assert.equal(CU.staffParse(JSON.stringify({ current: "", list: ["あ".repeat(50)] })).list[0].length, 20);
  assert.equal(CU.STAFF_KEY, "lhs_staff_v1");
});

test("自分のお客様：今の担当のお客様だけ。担当がないときは全員", () => {
  let list = [];
  list = CU.save(list, { name: "山田", staff: "佐藤", hash: "#s=a" });
  list = CU.save(list, { name: "鈴木", staff: "田中", hash: "#s=b" });
  assert.deepEqual(CU.mine(list, "佐藤").map((v) => v.name), ["山田"]);
  assert.equal(CU.mine(list, "").length, 2);
});

test("使い方（HOWTO）：最初の担当者登録から、入力・説明・登録・資料までの6ステップ。守ることも書く", () => {
  assert.equal(S.HOWTO.steps.length, 6);
  assert.match(S.HOWTO.steps[0].title, /担当者/);
  assert.match(S.HOWTO.steps.map((v) => v.title).join(), /お客様を登録/);
  for (const v of S.HOWTO.steps) assert.ok(v.title && v.body && v.go, v.title);
  assert.ok(S.HOWTO.rules.length >= 4);
  assert.match(S.HOWTO.rules.join(), /概算/);
  assert.match(S.HOWTO.rules.join(), /金融機関/);
  const t = JSON.stringify(S.HOWTO);
  for (const f of S.FORBIDDEN) assert.ok(!f.test(t), String(f));
});

test("画面：担当者のボタン（どこからでも）・担当者の画面・お客様の登録フォーム（prompt を使わない）・使い方", () => {
  assert.match(html, /id="acctBtn"/);
  assert.match(html, /id="acctBox"/);
  assert.match(html, /function acctRender\(/);
  assert.match(html, /CU\.staffAdd\(/);
  assert.match(html, /id="regName"/, "お客様の名前は画面の入力欄で");
  assert.doesNotMatch(html, /prompt\("お客様のお名前/, "prompt はやめる");
  assert.doesNotMatch(html, /prompt\("担当者のお名前/);
  assert.match(html, /自分のお客様/);
  assert.match(html, /CU\.mine\(/);
  assert.match(html, /id="helpBtn"/);
  assert.match(html, /id="helpBox"/);
  assert.match(html, /S\.HOWTO/);
  assert.match(html, /lhs_help_seen/, "初めての端末では使い方を自動で開く（見たかどうかだけを覚える）");
});
