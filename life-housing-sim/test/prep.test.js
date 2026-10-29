// TDD：「事前審査の前に、自分の信用を知る」（ユーザーの画像の中身を、正直な言葉で画面と資料に）
// 10人中2〜3人は「当社の目安」と書く／記録がなくても通らないことがある6つ／CICに残る記録5つ／5ステップ（保留か使うか）
// 銀行名・ロゴは出さない／事前審査の承認は本審査・融資を保証しない／断定しない（「場合があります」「ことがあります」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const fam = S.compute(S.preset("family"));
const p = S.screenPrep(x);
const all = JSON.stringify(p);

test("見出し：10人中2〜3人は「当社の目安」として、PASS_RATE と同じ数字", () => {
  assert.match(p.head, /10人中2〜3人/);
  assert.match(p.head + p.rateNote, /当社/);
  assert.match(p.rateNote, /目安/);
  assert.equal(p.passRate, S.PASS_RATE);
});

test("審査で見られること6つ：記録に残るもの／記録がなくても見られるもの", () => {
  assert.deepEqual(p.cases.map((c) => c.name), ["クレジットカードの支払いの遅れ", "スマホ本体の分割払いの遅れ", "カード・ローンの数や利用枠", "勤務先・勤続年数", "転勤の予定", "物件の評価"]);
  assert.ok(p.cases.every((c) => /ことがあります|場合があります/.test(c.what)), "断定しない");
  assert.deepEqual(p.cases.map((c) => c.kind), ["record", "record", "rule", "rule", "rule", "rule"]);
  assert.match(p.white, /記録がなくても/);
});

test("CICに残る記録5つ＋開示の手数料は CIC と同じ数字", () => {
  assert.deepEqual(p.records, ["クレジットカードの支払い状況", "スマホ本体の分割払い", "自動車ローン", "そのほかのローン（教育・カードローンなど）", "ローンやカードの申し込みの記録"]);
  assert.match(p.steps[0].what, new RegExp(`${S.CIC.methods[0].fee}円`));
});

test("5ステップ：CIC→適性チェック→事前審査→結果→使うか保留か（決めるのは自分）", () => {
  assert.deepEqual(p.steps.map((s) => s.name), ["信用情報を確かめる（CIC）", "住宅ローンの適性チェック", "金融機関へ事前審査", "結果を確かめる", "買うかどうかは自分で決める"]);
  assert.match(p.steps[2].what, /同意/);
  assert.match(p.steps[3].what, /保証するものではありません/);
  assert.match(p.steps[3].what, /有効期限/);
  assert.match(p.steps[3].what, /義務もありません/);
  assert.equal(p.keep.name, "今は使わない（保留）");
  assert.equal(p.use.name, "チケットを使う（購入へ進む）");
  assert.ok(p.keep.items.length >= 3 && p.use.items.length >= 3);
  // 適性チェックは、このお客様の数字の目安（gate の○△）を使う
  assert.equal(p.check.length, S.gate(x).checks.length);
});

test("チケットで広がる選択肢4つ：良いことだけでなく、かかるお金・価値の上下も書く", () => {
  assert.equal(p.options.length, 4);
  assert.match(JSON.stringify(p.options), /上がることも下がることも/);
  assert.match(JSON.stringify(p.options), /税金・修繕/);
  assert.match(p.catch, /今の信用を知ることが/);
});

test("言わないこと：銀行名・ロゴ、「通りやすい」「購入できる状態をクリア」、必ず通る、禁止の言葉", () => {
  assert.doesNotMatch(all, /みずほ|MIZ|三井住友|MUFG|三菱UFJ|りそな/);
  assert.doesNotMatch(all, /通りやすく|購入できる状態|必ず(通|借り)|完全ホワイト/);
  assert.match(p.note, /本審査・融資を保証するものではありません/);
  for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !all.includes(f) : !f.test(all), String(f));
});

test("資料：「進め方」の次に「審査の前に、自分の信用を知る」の1枚（独身17枚・家族16枚）", () => {
  const keys = (v) => S.deck(v).slides.map((s) => s.key);
  const k = keys(x);
  assert.equal(k[k.indexOf("steps") + 1], "prep");
  assert.equal(k.length, 17);
  assert.equal(keys(fam).length, 16);
  const s = S.deck(x).slides.find((v) => v.key === "prep");
  assert.ok(s.headline.length <= 40 && s.lead.length <= 80 && s.kpis.length >= 2 && s.kpis.length <= 3);
  assert.equal(s.visual, "prep");
  assert.match(s.kpis.map((v) => v.label).join(), /当社の目安/);
  assert.ok(s.notes.say && s.notes.ask);
});

test("画面：⑥に prepView（Zoomでは省く）、資料の図にも使う", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /function prepView\(x, compact\)/);
  assert.match(html, /trustView\(x\) \+ prepView\(x\)/);
  assert.match(html, /prep: \(\) => prepView\(x, true\)/);
  assert.match(html, /body\.present \.prepbox \{ display:none; \}/);
});
