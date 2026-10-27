// TDD：「賃貸と購入、どちらがいいか」→ お客様の数字で購入をすすめる（ただし数字が合わない人には無理にすすめない）
// 宅建業法：断定的判断（必ず得・必ず値上がり）や「今しかない」はNG。理由はすべてお客様の数字、注意点も必ず一緒に
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const single = S.compute(S.defaults());
const fam = S.compute(S.preset("family"));
const late = S.compute({ ...S.defaults(), age: 50, own: { ...S.defaults().own, buyAge: 50 } });

test("理由は4つ、すべてお客様の数字（賃貸と持ち家をならべる）", () => {
  const r = S.recommend(single);
  assert.deepEqual(r.reasons.map((v) => v.key), ["life", "old", "prepare", "asset"]);
  const life = r.reasons[0];
  assert.equal(life.rent, single.life.rent);
  assert.equal(life.own, single.life.own - single.value65.flat, "持ち家は65歳に残る家の価値（横ばい）を差し引いた実質");
  assert.equal(r.reasons[1].rent, single.old.rent.gapMonthly);
  assert.equal(r.reasons[1].own, single.old.own.gapMonthly);
  assert.equal(r.reasons[2].rent, single.prepare.rentNeed);
  assert.equal(r.reasons[3].own, single.portfolio.at65.own.total);
  for (const v of r.reasons) {
    assert.equal(v.favorOwn, v.key === "asset" ? v.own > v.rent : v.own < v.rent);
    assert.ok(v.text.length > 10 && v.label);
  }
});

test("数字が購入に向いていて、審査の目安も○なら「購入をおすすめします」", () => {
  const x = S.compute({ ...S.preset("family"), income: 5_000_000 });
  assert.ok(S.gate(x).allOk);
  const r = S.recommend(x);
  assert.equal(r.verdict, "buy");
  assert.match(r.headline, /購入をおすすめします/);
});

test("数字は購入に向いているが、審査の目安に△があれば「見直してから事前審査で確かめる」", () => {
  assert.equal(S.gate(single).allOk, false);
  const r = S.recommend(single);
  assert.equal(r.verdict, "buyAfterCheck");
  assert.match(r.headline, /購入/);
  assert.match(r.headline, /事前審査/);
});

test("数字が購入に向かない人（50歳で買う例）には、無理にすすめない", () => {
  const r = S.recommend(late);
  assert.equal(r.verdict, "prepare");
  assert.doesNotMatch(r.headline, /おすすめします/);
});

test("注意点も必ず一緒に：金利・修繕と税金・値下がり・差額を運用した場合・決めるのは金融機関", () => {
  const r = S.recommend(single);
  const c = r.cautions.join("／");
  assert.ok(c.includes(S.man(single.whatIf.rateUpPmt, 1)), "金利が1%上がったら");
  assert.match(c, /修繕/);
  assert.ok(c.includes(S.man(single.value65.down)), "下落シナリオ");
  assert.ok(c.includes(S.man(single.fair.rentInvested65)), "差額を運用した場合（元本保証なし）");
  assert.match(c, /元本保証なし/);
  assert.match(c, /金融機関/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(r.headline + JSON.stringify(r), re);
});

test("⑦ まとめは「賃貸と購入、どちらがいいか」：理由と注意点、問いかけは事前審査へ", () => {
  const t = S.talk(single);
  const s = t.find((v) => /^⑦/.test(v.title));
  assert.match(s.title, /賃貸と購入/);
  assert.match(s.say, /購入/);
  assert.doesNotMatch(s.say, /どちらが正解ということはありません/);
  assert.ok(s.show.includes(S.man(single.old.rent.gapMonthly, 1)));
  assert.match(s.show, /注意/);
  assert.match(s.ask, /事前審査/);
  assert.match(s.ask, /購入の義務はありません/);
  const p = S.talk(late).find((v) => /^⑦/.test(v.title));
  assert.doesNotMatch(p.ask, /事前審査に進みませんか/, "向かない人には事前審査へ押さない");
  for (const v of [s, p]) for (const re of S.FORBIDDEN) assert.doesNotMatch(v.say + v.show + v.ask, re);
});

test("最初（¥）は「家賃として払い続けるか、自分の資産に変えるか」へ", () => {
  const s = S.talk(single)[0];
  assert.match(s.say, /自分の資産/);
  assert.doesNotMatch(s.say, /どちらが正解ということはありません/);
});

test("提案書4ページ目：見出しがおすすめ、理由が先頭、賃貸のままの道も残す", () => {
  const p = S.proposal(fam).pages[3];
  const r = S.recommend(fam);
  assert.equal(p.lead, r.headline);
  assert.ok(p.points.some((v) => /おすすめの理由/.test(v)));
  assert.ok(p.points.some((v) => /注意/.test(v)));
  assert.ok(p.nextSteps.some((v) => /賃貸のまま/.test(v)), "賃貸のままの道も選べる");
  assert.equal(S.proposal(fam).pages.length, 4);
});
