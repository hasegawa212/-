// TDD：営業マンがお客様に見せる資料（16:9 スライド）
// お客様が見る面＝見出し・一言・大きな数字・図。営業マンが話すこと（say/ask）はノートに分ける
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const d = S.deck(x, { customer: "山田", company: "合同会社ジャパンマネジメント", staff: "佐藤", tel: "03-0000-0000", date: "2026年10月27日" });

test("12枚：表紙 → ¥・⓪〜⑧（説明と同じ順番）→ 次の一歩", () => {
  assert.equal(d.slides.length, 12);
  assert.equal(d.slides[0].kind, "cover");
  assert.equal(d.slides.at(-1).kind, "next");
  const t = S.talk(x);
  d.slides.slice(1, 11).forEach((s, i) => {
    assert.equal(s.kind, "step");
    assert.equal(s.step, i, "説明のステップ番号");
    assert.equal(s.mark, t[i].title.slice(0, 1), "¥・⓪〜⑧ の印");
  });
});

test("表紙：お客様のお名前・会社・担当・日付（名前は meta から。なければ空）", () => {
  const c = d.slides[0];
  assert.equal(c.title, S.APP.name);
  assert.match(c.to, /山田 様/);
  assert.match(c.from, /合同会社ジャパンマネジメント/);
  assert.match(c.from, /佐藤/);
  assert.equal(c.date, "2026年10月27日");
  assert.equal(S.deck(x).slides[0].to, "", "名前がなければ宛名は空");
});

test("お客様が見る面は短く：見出し・一言（80字以内）・大きな数字（2〜3個）", () => {
  for (const s of d.slides.slice(1, 11)) {
    assert.ok(s.headline && s.headline.length <= 40, s.headline);
    assert.ok(s.lead && s.lead.length <= 80, `${s.mark} ${s.lead.length}字：${s.lead}`);
    assert.ok(s.kpis.length >= 2 && s.kpis.length <= 3, s.mark);
    for (const k of s.kpis) assert.ok(k.label && k.value && !/NaN|undefined|Infinity/.test(k.value), `${s.mark} ${k.label}`);
    assert.ok(s.visual, "図");
  }
});

test("数字は計算と同じ（資料と画面で食い違わない）", () => {
  const f = S.fixedCost(x), r = S.recommend(x);
  const yen = d.slides[1];
  assert.ok(yen.kpis.some((k) => k.value === S.man(f.rent, 1)));
  assert.ok(yen.kpis.some((k) => k.value === S.man(f.to65)));
  const two = d.slides.find((s) => s.mark === "②");
  assert.ok(two.kpis.some((k) => k.value === S.man(x.life.rent)));
  assert.ok(two.kpis.some((k) => k.value === S.man(x.life.own)));
  const seven = d.slides.find((s) => s.mark === "⑦");
  assert.equal(seven.lead.slice(0, 20), r.headline.slice(0, 20));
  assert.equal(seven.visual, "recommend");
});

test("営業マンのノート：話すこと・お客様への質問（画面の説明と同じ文）", () => {
  const t = S.talk(x);
  d.slides.slice(1, 11).forEach((s, i) => {
    assert.equal(s.notes.say, t[i].say);
    assert.equal(s.notes.ask, t[i].ask);
  });
});

test("次の一歩：事前審査など、提案書と同じチェックリスト＋会社の連絡先＋ご注意", () => {
  const n = d.slides.at(-1), p = S.proposal(x, {}).pages[3];
  assert.deepEqual(n.steps, p.nextSteps);
  assert.match(n.contact, /合同会社ジャパンマネジメント/);
  assert.match(n.contact, /03-0000-0000/);
  assert.ok(n.notes.length >= 3);
});

test("禁止表現なし・注意点（⑦）は資料にも出る", () => {
  const all = JSON.stringify(d);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(all, re);
  const seven = d.slides.find((s) => s.mark === "⑦");
  assert.ok(seven.points.some((p) => /元本保証なし/.test(p)));
  assert.ok(seven.points.some((p) => /金融機関/.test(p)));
});

test("どのお客様のタイプでも12枚・数字がこわれない", () => {
  for (const p of ["single", "shataku", "family"]) {
    const v = S.deck(S.compute(S.preset(p)));
    assert.equal(v.slides.length, 12);
    assert.doesNotMatch(JSON.stringify(v), /NaN|Infinity|undefined/);
  }
});
