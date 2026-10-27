// TDD：ヒアリングから将来のリスク・強み・数字・価値の伝え方・次回の確認事項を出せること
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("../lib/parse");
const { analyze, FORBIDDEN } = require("../lib/analyze");

const r = parse(fs.readFileSync(path.join(__dirname, "../samples/sample.txt"), "utf8"));
const a = analyze(r);
const ids = a.risks.map((x) => x.id);

test("このヒアリングから読み取れるリスクを出す（根拠つき）", () => {
  for (const id of ["transfer", "partner", "taxLoss", "investLoan", "carLoan", "savings", "incomeSwing", "fxInsurance", "costUp", "bonusPay"])
    assert.ok(ids.includes(id), `${id} がない`);
  for (const x of a.risks) {
    assert.ok(["高", "中", "低"].includes(x.level), x.id);
    assert.ok(x.evidence && x.evidence.length > 0, `${x.id} に根拠がない`);
    for (const k of ["future", "value", "ask", "action"]) assert.ok(x[k] && x[k].length > 5, `${x.id}.${k}`);
  }
  assert.equal(a.risks[0].level, "高", "高いものから並ぶ");
});

test("強み（審査・将来でプラスになる点）も出す", () => {
  const s = a.strengths.map((x) => x.id);
  assert.ok(s.includes("publicJob"), "教員・公務員は収入が安定");
  assert.ok(s.includes("young"), "若いので長く返せる");
  assert.ok(s.includes("marriageCredit"), "結婚すれば若者夫婦世帯の控除上乗せの対象になりうる");
});

test("数字：予算の目安と返済比率（仮定を明記）", () => {
  const n = a.numbers;
  assert.ok(n.loanAt[0].amount > 20_000_000 && n.loanAt[0].amount < 35_000_000, "月8万＋ボーナス10万×2で借りられる額");
  assert.ok(n.loanAt[0].rate < n.loanAt[1].rate && n.loanAt[0].amount > n.loanAt[1].amount);
  assert.equal(n.incomeLow, 4_000_000, "審査は低い年で見られることもある");
  assert.ok(n.ratioLow > n.ratioLatest);
  assert.ok(n.assumptions.length >= 3);
  assert.equal(n.monthlyUp, 30_000, "今の家賃より毎月いくら増えるか");
});

test("書類の進み具合と、次回の確認事項・やること", () => {
  assert.equal(a.docs.done, 2);
  assert.equal(a.docs.total, 5);
  assert.ok(a.questions.length >= 5);
  assert.ok(a.nextActions.some((x) => x.includes("同席")), "決める人（パートナー）の同席");
});

test("伝え方に禁止表現がない（必ず値上がり・家賃は無駄 など）", () => {
  const all = JSON.stringify(a);
  for (const re of FORBIDDEN) assert.ok(!re.test(all), String(re));
});

test("リスクが見つからない内容でも落ちない", () => {
  const b = analyze(parse("【面談日】2026/10/1\n■ 基本情報\n・年齢：40歳\n・年収：R7年6,000,000円"));
  assert.ok(Array.isArray(b.risks));
  assert.ok(b.numbers);
});

test("レポート（Markdown）に7つの見出しと全リスクが出る", () => {
  const { toMarkdown } = require("../lib/report");
  const md = toMarkdown(r, a);
  for (let i = 1; i <= 7; i++) assert.ok(md.includes(`## ${i}.`), `## ${i}.`);
  for (const x of a.risks) assert.ok(md.includes(x.title));
  assert.ok(!md.includes("見本　太郎"), "お客様の氏名はレポートに出さない");
});

test("パートナーの不安が2行に分かれていても拾う", () => {
  const t = "■ 内容要約\n本日、彼女様にご相談いただいた内容を伺いました。\n転勤が確定していない中での購入は現状厳しいとのご意見でした。";
  const x = analyze(parse(t));
  assert.ok(x.risks.some((r) => r.id === "partner"), "partner がない");
});

test("書類は段階ごとに数え、今の段階（最初の段階）の不足だけをリスクにする", () => {
  const t = "▼ S0-S1（初訪〜FP提案）\n✅源泉1期\n✅給料明細\n⬜源泉2期\n▼ S5以降\n⬜ 住民票\n⬜ 印鑑証明書\n⬜ 金消契約書";
  const x = analyze(parse(t));
  assert.equal(x.docs.stages[0].name, "S0-S1（初訪〜FP提案）");
  assert.equal(x.docs.stages[0].done, 2);
  assert.equal(x.docs.stages[0].total, 3);
  assert.ok(!x.risks.some((r) => r.id === "docs"), "今の段階は2/3そろっているのでリスクにしない");
});
