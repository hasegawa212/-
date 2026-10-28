// TDD：入力の初期値は空（お客様ごとに必ず選ぶ）。見本の数字（27歳・年収390万…）をお客様に見せない
// 空のあいだは数字を出さず、全部選んだら説明を始められる。仮定の値（金利・老後の生活費など）は今までどおり初期値あり
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);

test("お客様ごとに選ぶ項目：年齢・年収・貯金・家賃・NISA・物件価格・生命保険", () => {
  assert.deepEqual(S.askFields(S.defaults()), ["age", "income", "savings", "nisa.balance", "nisa.monthly", "rent.single", "own.price", "lifeIns.monthly", "lifeIns.cover"]);
  for (const k of S.ASK_FIELDS) assert.notEqual(get(S.defaults(), k), undefined, k);
});

test("社宅のお客様は、家賃のかわりに社宅の自己負担と出る年齢を選ぶ", () => {
  const f = S.askFields(S.preset("shataku"));
  assert.ok(!f.includes("rent.single"));
  assert.ok(f.includes("shataku.self") && f.includes("shataku.until"));
});

test("まだ選んでいない項目：空の数がわかる（全部選べば0）", () => {
  const all = new Set(S.askFields(S.defaults()));
  assert.equal(S.missing(S.defaults(), all).length, 9);
  assert.equal(S.missing(S.defaults(), new Set()).length, 0);
  assert.deepEqual(S.missing(S.defaults(), new Set(["age", "rent.couple"])), ["age"], "選ぶ項目以外は数えない");
  const sh = S.preset("shataku");
  assert.deepEqual(S.missing(sh, new Set(["rent.single", "shataku.self"])), ["shataku.self"], "社宅なら家賃は数えない");
});

test("画面：選ぶ項目はすべて入力欄にあり、空なら「選んでください」、全部選ぶまで数字を出さない", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  for (const k of [...S.ASK_FIELDS, "shataku.self", "shataku.until"]) assert.match(html, new RegExp(`\\["${k.replace(".", "\\.")}",`), k);
  assert.match(html, /選んでください/);
  assert.match(html, /S\.missing\(/);
  assert.match(html, /あと\$\{/, "あと何項目か表示");
});

test("リンクに条件（s=）がないとき（#step=3 だけ・前の画面の続き）は、見本の数字を出さず空から", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /new Set\(\/\(\^\|\[#&\]\)s=\/\.test\(location\.hash\)/, "s= があるときだけ入力済み");
});

test("共有リンクには、お客様ごとの項目を初期値と同じでも必ず入れる（開いた人が空にならない）", () => {
  const Share = require("../lib/share");
  const d = S.defaults();
  const h = Share.encode(d, { step: 2, defaults: d, keep: S.askFields(d) });
  assert.match(h, /s=/);
  const back = Share.decode(h, d);
  for (const k of S.askFields(d)) assert.equal(get(back.state, k), get(d, k), k);
  assert.doesNotMatch(Share.encode(d, { step: 2, defaults: d }), /s=/, "keep なしは今までどおり");
  assert.match(html2(), /keep: need\(\)\.length \? \[\] : S\.askFields\(state\)/);
});
function html2() { return fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"); }
