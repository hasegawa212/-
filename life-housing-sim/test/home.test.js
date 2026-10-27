// TDD：トップページ「ライフパートナー」— お客様が主人公。数字はすべてシミュレーションから（見本の数字は使わない）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());

test("主人公はお客様：名前があれば「◯◯ 様」、なければ「あなた」。会社名は入力どおり", () => {
  assert.equal(S.home(x, {}, { customer: "山田 太郎" }).hero.name, "山田 太郎 様");
  assert.equal(S.home(x).hero.name, "あなた");
  assert.equal(S.home(x, {}, { company: "株式会社 Martial Arts" }).hero.company, "株式会社 Martial Arts", "入力した会社名");
  assert.equal(S.home(x).hero.title, "ライフパートナー");
});

test("今の資産：預貯金＋NISA（不動産なし）。内訳の割合は合計100%", () => {
  const h = S.home(x);
  assert.equal(h.assets.now, x.input.savings + x.input.nisa.balance);
  const sum = h.assets.parts.reduce((s, p) => s + p.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(h.assets.parts.find((p) => p.key === "realEstate").amount, 0);
});

test("資産の見通し：今から65歳まで（持ち家）。最後は65歳の資産（持ち家）と一致", () => {
  const h = S.home(x);
  assert.equal(h.assets.path[0].age, x.input.age);
  assert.equal(h.assets.path.at(-1).age, x.input.retireAge);
  assert.ok(Math.abs(h.assets.path.at(-1).own - x.portfolio.at65.own.total) < 1);
  assert.ok(Math.abs(h.assets.path[0].own - h.assets.now) < 1);
});

test("目標：65歳までに準備したいお金（賃貸のまま）と、今の資産の割合（0〜100%）", () => {
  const g = S.home(x).goal;
  assert.equal(g.target, x.prepare.rentNeed);
  assert.equal(g.now, x.input.savings + x.input.nisa.balance);
  assert.equal(g.pct, Math.min(1, g.now / g.target));
});

test("5つのエリア：現預金・NISA・保険・不動産・ライフプラン。数字はシミュレーションと同じ", () => {
  const h = S.home(x);
  assert.deepEqual(h.areas.map((a) => a.key), ["cash", "nisa", "ins", "home", "plan"]);
  const a = Object.fromEntries(h.areas.map((v) => [v.key, v]));
  assert.ok(a.cash.value.includes(S.man(x.input.savings)));
  assert.ok(a.nisa.value.includes(S.man(x.portfolio.at65.nisa)));
  assert.ok(a.ins.value.includes(S.man(x.input.lifeIns.monthly, 1)));
  assert.ok(a.home.value.includes(S.man(x.input.own.price)));
  assert.ok(a.plan.value.includes(S.man(x.life.rent)));
  for (const v of h.areas) assert.ok(Number.isInteger(v.step) && v.step >= 0 && v.step <= 7, "押すと説明のステップへ");
});

test("ミッション：自動で判定（NISA・ライフプラン）＋チェック（事前審査・ねんきんネット・保険）。レベル＝1＋できた数", () => {
  const h0 = S.home(x);
  const m = Object.fromEntries(h0.missions.map((v) => [v.id, v]));
  assert.equal(m.nisaStart.done, true, "NISA 毎月1万円 → 始めている");
  assert.equal(m.plan.done, true, "このシミュレーションでライフプランを作った");
  assert.equal(m.preApproval.done, false);
  assert.equal(S.home(S.compute({ ...S.defaults(), nisa: { ...S.defaults().nisa, monthly: 0 } })).missions.find((v) => v.id === "nisaStart").done, false);
  const doneN = h0.missions.filter((v) => v.done).length;
  assert.equal(h0.hero.level, 1 + doneN);
  const h1 = S.home(x, { preApproval: true, nenkin: true });
  assert.equal(h1.hero.level, h0.hero.level + 2);
  assert.equal(h1.areas.find((a) => a.key === "home").level, h0.areas.find((a) => a.key === "home").level + 1);
  for (const a of h1.areas) assert.ok(a.progress >= 0 && a.progress <= 1);
  assert.ok(h0.missions.some((v) => /事前審査.*購入の義務はありません/.test(v.label)));
});

test("ライフイベント：今・買う・定年・年金・完済（年齢順）。社宅・結婚・子どもは条件があるときだけ", () => {
  const ev = S.home(x).events;
  const ages = ev.map((e) => e.age);
  assert.deepEqual(ages, [...ages].sort((p, q) => p - q));
  const txt = ev.map((e) => e.label).join("／");
  for (const w of ["今", "家を買う", "定年", "年金", "完済"]) assert.match(txt, new RegExp(w));
  assert.doesNotMatch(txt, /結婚|社宅/);
  const fam = S.home(S.compute(S.preset("family"))).events.map((e) => e.label).join("／");
  assert.match(fam, /結婚/); assert.match(fam, /子ども/);
  assert.match(S.home(S.compute(S.preset("shataku"))).events.map((e) => e.label).join("／"), /社宅を出る/);
});

test("おすすめのアクション4つ（押すと説明のステップか提案書へ）。言い方はあおらない", () => {
  const h = S.home(x);
  assert.equal(h.actions.length, 4);
  for (const a of h.actions) assert.ok(a.step != null || a.go === "proposal");
  const all = JSON.stringify(h);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(all, re);
  assert.doesNotMatch(all, /\+\d+(\.\d+)?%|7\.7%/, "根拠のない上昇率は出さない");
});

test("会社名の初期値は「合同会社ジャパンマネジメント」（トップページと提案書で同じ。入力すれば変えられる）", () => {
  assert.equal(S.DEFAULT_COMPANY, "合同会社ジャパンマネジメント");
  assert.equal(S.home(x).hero.company, "合同会社ジャパンマネジメント");
  assert.equal(S.proposal(x).cover.company, "合同会社ジャパンマネジメント");
  assert.equal(S.home(x, {}, { company: "別の会社" }).hero.company, "別の会社");
});
