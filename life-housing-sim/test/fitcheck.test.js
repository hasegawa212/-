// TDD：住宅ローンの適性チェック（⑥）。お客様と一緒に○×で答える → 事前審査の前に「確かめること」を出す
// 合否は出さない（決めるのは金融機関）／答えは保存しない・共有リンクに入れない／断定しない
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");
const Share = require("../lib/share");

const d = S.defaults();
const x = S.compute(d);
const KEYS = ["late", "phone", "cards", "revo", "loans", "tenure", "employ", "apply", "transfer", "live", "health"];
const allOk = Object.fromEntries(S.FIT_ITEMS.map((it) => [it.key, it.options.find((o) => o.ok).v]));
const noForbidden = (v) => { const t = JSON.stringify(v); for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !t.includes(f) : !f.test(t), String(f)); };

test("質問は11こ：支払いの遅れ→スマホ分割→カード枚数→リボ→ほかの借入→勤続→働き方→申し込み→転勤→自分で住む→団信", () => {
  assert.deepEqual(S.FIT_ITEMS.map((it) => it.key), KEYS);
  for (const it of S.FIT_ITEMS) {
    assert.ok(it.q.endsWith("？"), it.key);
    assert.ok(it.options.length >= 2 && it.options.length <= 3, it.key);
    assert.ok(it.options.some((o) => o.ok), `${it.key} に問題なしの答えがある`);
    for (const o of it.options) if (!o.ok) assert.ok(o.todo && o.todo.length > 8, `${it.key}/${o.v} には確かめることがある`);
  }
});

test("何も答えていないとき：確かめることは出さず、答え方を案内する", () => {
  const f = S.fitCheck(x, {});
  assert.equal(f.answered, 0);
  assert.equal(f.total, 11);
  assert.equal(f.todos.length, 0);
  assert.match(f.summary, /答えると/);
});

test("全部問題なし：確かめることはなし。ただし決めるのは金融機関（通るとは言わない）", () => {
  const f = S.fitCheck(x, allOk);
  assert.equal(f.answered, 11);
  assert.equal(f.todos.length, 0);
  assert.match(f.summary, /金融機関/);
  assert.doesNotMatch(f.summary, /通ります|通る見込み|大丈夫/);
});

test("答えに応じた「確かめること」：遅れ→CIC、リボ→残りを減らす、申し込み→約6か月、自分で住まない→住宅ローンは使えない", () => {
  const f = S.fitCheck(x, { ...allOk, late: "yes", revo: "yes", apply: "yes", live: "no" });
  const t = f.todos.map((v) => v.todo).join("／");
  assert.equal(f.todos.length, 4);
  assert.match(t, /CIC/);
  assert.match(t, /リボ|残り/);
  assert.match(t, /6か月/);
  assert.match(t, /住宅ローンは使えません/);
  assert.match(f.summary, /4つ/);
  assert.ok(f.todos.every((v) => v.q && v.answer), "どの質問の答えからか分かる");
});

test("入力済みの条件は答えを先に入れておく（個人事業主・転勤あり・ほかの借入あり）、自分で変えられる", () => {
  const y = S.compute({ ...d, job: "self", transfer: { ...d.transfer, on: true }, debt: { monthly: 20000 } });
  const f = S.fitCheck(y, {});
  const it = (k) => f.items.find((v) => v.key === k);
  assert.equal(it("employ").answer, "self"); assert.ok(it("employ").auto);
  assert.equal(it("transfer").answer, "maybe"); assert.ok(it("transfer").auto);
  assert.equal(it("loans").answer, "yes"); assert.ok(it("loans").auto);
  assert.match(f.todos.map((v) => v.todo).join(), /確定申告書/);
  assert.equal(S.fitCheck(y, { employ: "regular" }).items.find((v) => v.key === "employ").auto, false);
  assert.equal(S.fitCheck(x, {}).items.find((v) => v.key === "employ").answer, null, "会社員の初期値では答えを決めつけない");
});

test("数字の目安（返済の割合など）も一緒に返す／注意書き：合否ではない・保存しない", () => {
  const f = S.fitCheck(x, allOk);
  assert.equal(f.numbers.length, S.gate(x).checks.length);
  assert.match(f.note, /合否/);
  assert.match(f.note, /金融機関/);
  assert.match(f.note, /保存/);
  noForbidden(f);
  noForbidden(S.FIT_ITEMS);
  assert.doesNotMatch(JSON.stringify([f, S.FIT_ITEMS, S.fitCheck(x, { ...allOk, late: "yes" })]), /必ず|通りません|審査に落ち/);
});

test("知らない答えは無視する（未回答のまま）", () => {
  const f = S.fitCheck(x, { late: "boss", cards: 3 });
  assert.equal(f.answered, 0);
});

test("答えは共有リンクに入らない（state に fit を入れても捨てる）", () => {
  const h = Share.encode({ ...d, fit: { late: "yes" } }, { defaults: d });
  assert.doesNotMatch(Buffer.from(h.replace(/^#s=/, "").split("&")[0], "base64url").toString(), /fit|late/);
  const h2 = "#s=" + Buffer.from(JSON.stringify({ fit: { late: "yes" } })).toString("base64url");
  assert.equal(Share.decode(h2, d).state.fit, undefined);
});

test("画面：⑥に fitView（ボタンで答える・Zoomでは省く）、答えは保存しない", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /function fitView\(x\)/);
  assert.match(html, /trustView\(x\) \+ fitView\(x\) \+ prepView\(x\)/);
  assert.match(html, /data-fk=/);
  assert.match(html, /body\.present \.fitbox \{ display:none; \}/);
  assert.doesNotMatch(html, /setItem\([^)]*fit/i, "答えをストレージに保存しない");
});
