// TDD：営業マンがお客様に見せる資料（16:9）＝「賃貸より、購入。」をお客様の数字で示す資料
// 結論 → 購入をすすめる理由（1枚に1つ）→ 待つと／親御さまの頃 → 注意点 → 進め方 → 次の一歩
// 宅建業法：断定しない。理由はすべてお客様の数字、注意点のスライドは必ず入れる。数字が合わない人には「おすすめ」と書かない
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const meta = { customer: "山田", company: "合同会社ジャパンマネジメント", staff: "佐藤", tel: "03-0000-0000", date: "2026年10月28日" };
const d = S.deck(x, meta);
const keys = (v) => v.slides.map((s) => s.key);

const BODY = ["fixed", "conclusion", "life", "old", "asset", "prepare", "danshin", "credit", "wait", "bubble", "cautions", "steps", "next"];
test("構成：表紙 →（独身なら）自分の空間 → 固定費 → 結論 → 理由（住居費・老後・資産・準備・もしも・控除）→ 待つと → 親御さまの頃 → 注意点 → 進め方 → 次の一歩", () => {
  assert.deepEqual(keys(d), ["cover", "space", ...BODY]);
  assert.deepEqual(keys(S.deck(S.compute(S.preset("shataku")))), ["cover", "space", ...BODY], "社宅の独身も");
  assert.deepEqual(keys(S.deck(S.compute(S.preset("family")))), ["cover", ...BODY], "結婚・子どもありは14枚のまま");
});

test("独身の2枚目「買うのは、家だけじゃない。」：絵＋今の家賃と毎月の返済（同じ物差し）、断定しない", () => {
  const s = d.slides.find((v) => v.key === "space");
  assert.match(s.headline, /家だけじゃない/);
  assert.equal(s.visual, "space");
  assert.equal(S.spaceImage(x).src, "img/space-single.jpg");
  assert.match(S.spaceImage(x).alt, /趣味/);
  assert.equal(S.spaceImage(S.compute(S.preset("family"))), null);
  assert.ok(s.kpis.some((k) => k.value === S.man(S.fixedCost(x).rent, 1)));
  assert.ok(s.kpis.some((k) => k.value === S.man(x.loan.pmt, 1)));
  assert.ok(s.notes.say && s.notes.ask);
  assert.match(s.points.join("／"), /管理|修繕/, "自分で手入れする責任も書く");
  const late = S.deck(S.compute({ ...S.defaults(), age: 50, own: { ...S.defaults().own, buyAge: 50 } })).slides.find((v) => v.key === "space");
  assert.doesNotMatch(JSON.stringify(late), /おすすめ/);
});

test("表紙：「家賃を払い続けるより、自分の家を。」＋お客様のお名前・会社・担当・日付", () => {
  const c = d.slides[0];
  assert.equal(c.title, S.APP.name);
  assert.match(c.headline, /自分の家/);
  assert.match(c.to, /山田 様/);
  assert.match(c.from, /合同会社ジャパンマネジメント/);
  assert.match(c.from, /佐藤/);
  assert.equal(S.deck(x).slides[0].to, "", "名前がなければ宛名は空");
});

test("結論は2枚目：数字が購入に向いていれば「購入をおすすめします」", () => {
  const c = d.slides.find((s) => s.key === "conclusion");
  assert.match(c.headline, /購入をおすすめします/);
  assert.equal(c.visual, "asset", "購入をすすめるときは「今払ってる賃料が将来の資産になる」の絵");
  assert.ok(c.kpis.length >= 2);
});

test("理由のスライドは、持ち家が有利な項目に「理由1・2…」と番号、数字は計算と同じ", () => {
  const r = S.recommend(x);
  const reasons = d.slides.filter((s) => s.reason);
  assert.ok(reasons.length >= 4);
  reasons.forEach((s, i) => assert.match(s.headline, new RegExp(`^理由${i + 1}`)));
  const life = d.slides.find((s) => s.key === "life");
  assert.ok(life.kpis.some((k) => k.value === S.man(x.life.rent)));
  assert.ok(life.kpis.some((k) => k.value === S.man(r.reasons[0].own)));
  const old = d.slides.find((s) => s.key === "old");
  assert.ok(old.kpis.some((k) => k.value === S.man(x.old.own.gapMonthly, 1)));
  const credit = d.slides.find((s) => s.key === "credit");
  assert.ok(credit.kpis.some((k) => k.value === S.man(x.credit.total)));
});

test("数字が購入に向かない人（50歳で買う例）には「おすすめ」と書かず、理由の番号もつけない", () => {
  const late = S.deck(S.compute({ ...S.defaults(), age: 50, own: { ...S.defaults().own, buyAge: 50 } }));
  const c = late.slides.find((s) => s.key === "conclusion");
  assert.doesNotMatch(c.headline, /おすすめします/);
  assert.doesNotMatch(late.slides[0].headline, /自分の家を。/);
  for (const s of late.slides.filter((v) => ["life", "old", "prepare"].includes(v.key) && !v.reason)) assert.doesNotMatch(s.headline, /^理由/);
});

test("注意点のスライドは必ずある：金利・修繕と税金・値下がり・差額の運用（元本保証なし）・決めるのは金融機関", () => {
  const c = d.slides.find((s) => s.key === "cautions");
  const t = c.points.join("／");
  assert.match(t, /金利/);
  assert.match(t, /修繕/);
  assert.match(t, /下がる/);
  assert.match(t, /元本保証なし/);
  assert.match(t, /金融機関/);
});

test("お客様が見る面は短く（見出し40字・一言80字以内・数字2〜3個）、数字がこわれない", () => {
  for (const s of d.slides.filter((v) => !["cover", "next"].includes(v.kind))) {
    assert.ok(s.headline.length <= 40, s.headline);
    assert.ok(s.lead.length <= 80, `${s.key} ${s.lead.length}字：${s.lead}`);
    assert.ok(s.kpis.length >= 2 && s.kpis.length <= 3, s.key);
    for (const k of s.kpis) assert.ok(k.label && k.value, s.key);
  }
  for (const p of ["single", "shataku", "family"]) assert.doesNotMatch(JSON.stringify(S.deck(S.compute(S.preset(p)))), /NaN|Infinity|undefined/);
});

test("営業マンのノート：話すこと・質問がすべてのスライドにある（説明の台本と同じ文を使う）", () => {
  const t = S.talk(x);
  for (const s of d.slides.filter((v) => v.kind === "step")) assert.ok(s.notes.say && s.notes.ask, s.key);
  assert.equal(d.slides.find((s) => s.key === "fixed").notes.say, t[0].say);
  assert.equal(d.slides.find((s) => s.key === "steps").notes.say, t.find((v) => /^⑥/.test(v.title)).say);
});

test("次の一歩：提案書と同じチェックリスト＋会社の連絡先", () => {
  const n = d.slides.at(-1), p = S.proposal(x, {}).pages[3];
  assert.deepEqual(n.steps, p.nextSteps);
  assert.match(n.contact, /03-0000-0000/);
});

test("禁止表現なし（今しかない・必ず値上がり・家賃は無駄 など）", () => {
  for (const p of ["single", "shataku", "family"]) {
    const all = JSON.stringify(S.deck(S.compute(S.preset(p)), meta));
    for (const re of S.FORBIDDEN) assert.doesNotMatch(all, re);
  }
});
