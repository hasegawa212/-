// TDD：区切り — 「やるか・やらないか」の前に、まず「できるか（審査が通るか）」を確かめる
// 決めるのは融資する金融機関。当社で審査を申し込んだ方のうち、通るのは10人中2〜3人ほど（目安）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const Share = require("../lib/share");

const x = S.compute(S.defaults());

test("審査の通る割合の目安は1か所で定義：10人中2〜3人（当社の目安・変わることを書く）", () => {
  assert.equal(S.PASS_RATE.of, 10);
  assert.equal(S.PASS_RATE.low, 2);
  assert.equal(S.PASS_RATE.high, 3);
  assert.match(S.PASS_RATE.note, /目安/);
});

test("gate(x)：数字で見る目安（返済比率・完済年齢・年収の何倍・定年後の返済）を、シミュレーションの数字で判定", () => {
  const g = S.gate(x);
  const by = Object.fromEntries(g.checks.map((c) => [c.key, c]));
  const lim = x.input.income < 4_000_000 ? 0.3 : 0.35;
  assert.equal(by.ratio.ok, x.loan.ratioNow <= lim);
  assert.ok(by.ratio.value.includes(Math.round(x.loan.ratioNow * 100) + "%"));
  assert.equal(by.payoff.ok, x.loan.endAge <= 80);
  assert.equal(by.multiple.ok, x.loan.amount / x.input.income <= 7);
  assert.equal(by.reemploy.ok, x.loan.ratioReemploy <= 0.35);
  assert.equal(g.allOk, g.checks.every((c) => c.ok));
  assert.match(g.verdict, g.allOk ? /可能性/ : /見直/);
  assert.match(g.verdict, /金融機関が(判断|決め)/, "決めるのは金融機関");
});

test("gate(x)：金融機関が見ること（数字以外）と、2段階の進め方（できるか → やるか）", () => {
  const g = S.gate(x);
  const lookAt = g.lookAt.join("／");
  for (const w of ["勤続", "他の借入", "信用情報", "団信", "担保"]) assert.match(lookAt, new RegExp(w));
  assert.equal(g.steps.length, 3);
  assert.match(g.steps[0], /できるか.*事前審査.*無料.*購入の義務はありません/);
  assert.match(g.steps[1], /やるか.*やらないか/);
  assert.match(g.steps[2], /通らなかった/, "通らなかったときの道も示す");
});

test("借入が重い条件では「見直し」になる（年収280万・物件4,000万）", () => {
  const g = S.gate(S.compute({ ...S.defaults(), income: 2_800_000, own: { ...S.defaults().own, price: 40_000_000 } }));
  assert.equal(g.allOk, false);
  assert.match(g.verdict, /見直/);
});

test("説明の順番：⑤もしも → ⑥まず「できるか」（区切り） → ⑦まとめ（やる・やらない） → ⑧「今はいい」", () => {
  const t = S.talk(x);
  assert.equal(t.length, 9);
  assert.match(t[6].title, /^⑥ まず「できるか」/);
  assert.match(t[6].say, /金融機関/);
  assert.match(t[6].say, /10人中2〜3人/);
  assert.match(t[6].say, /やるか.*やらないか/);
  assert.match(t[6].ask, /無料.*購入の義務はありません/);
  assert.match(t[7].title, /^⑦ まとめ/);
  assert.match(t[8].title, /^⑧「今はいい」/);
  for (const s of t) for (const re of S.FORBIDDEN) assert.doesNotMatch(s.say + s.show + s.ask, re);
});

test("提案書のまとめ（4ページ目）に区切りが入る：まず「できるか」→ その土台で「やるか」", () => {
  const p = S.proposal(x).pages[3];
  assert.match(p.lead, /できるか/);
  assert.match(p.points[0], /10人中2〜3人/);
  assert.match(p.nextSteps[0], /事前審査/);
});

test("トップのおすすめアクションに「まず『できるか』を確かめる」（⑥へ）", () => {
  const a = S.home(x).actions.find((v) => /できるか/.test(v.title));
  assert.ok(a);
  assert.equal(a.step, 6);
});

test("共有リンクは⑧まで開ける", () => {
  assert.equal(Share.decode("#step=8", S.defaults()).step, 8);
  assert.equal(Share.decode("#step=9", S.defaults()).step, 0);
});
