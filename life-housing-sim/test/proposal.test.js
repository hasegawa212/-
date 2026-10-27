// TDD：お客様にお渡しする提案書（A4・4ページ）の中身
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const P = S.proposal(x, { customer: "山田", company: "株式会社サンプル", staff: "鈴木", tel: "03-0000-0000", date: "2026年10月27日" });

test("4ページ：①全体像 ②一生の住まいのお金 ③老後ともしも ④まとめと次の一歩", () => {
  assert.equal(P.pages.length, 4);
  assert.deepEqual(P.pages.map((p) => p.no), [1, 2, 3, 4]);
  for (const p of P.pages) {
    assert.ok(p.title && p.lead && p.lead.length > 10, p.no);
    assert.ok(Array.isArray(p.points) && p.points.length >= 2, `${p.no} points`);
  }
});

test("表紙にお客様名（様）・作成日・会社名・担当者が入る", () => {
  assert.equal(P.cover.to, "山田 様");
  assert.equal(P.cover.date, "2026年10月27日");
  assert.equal(P.cover.company, "株式会社サンプル");
  assert.ok(P.cover.contact.includes("鈴木") && P.cover.contact.includes("03-0000-0000"));
  assert.equal(S.proposal(x, {}).cover.to, "お客様", "名前がなくても作れる");
});

test("大事な数字が提案書に入っている（シミュレーターと同じ値）", () => {
  const txt = JSON.stringify(P);
  for (const v of [x.life.rent, x.life.own, x.prepare.rentNeed, x.credit.total, x.income.total]) assert.ok(txt.includes(S.man(v)), S.man(v));
  assert.ok(txt.includes(S.man(x.wait[3].rentWhileWaiting)), "5年待った場合の家賃");
});

test("次の一歩はお客様が選べるチェックリスト（買う以外の選択肢もある）", () => {
  const n = P.pages[3].nextSteps;
  assert.ok(n.length >= 3);
  assert.ok(n.some((s) => /事前審査/.test(s)));
  assert.ok(n.some((s) => /見送|待つ|賃貸/.test(s)), "持たない選択肢も");
});

test("注意書き（概算・約束しない・出典）と、禁止表現がない", () => {
  assert.ok(P.notes.length >= 4);
  const all = JSON.stringify(P);
  for (const re of S.FORBIDDEN) assert.ok(!re.test(all), String(re));
  assert.ok(/概算/.test(all) && /約束するものではありません/.test(all));
});

test("独身なら独身向け、家族なら家族向けの言葉になる", () => {
  const fam = S.proposal(S.compute(S.preset("family")), {});
  assert.ok(/ひとり/.test(JSON.stringify(P.pages[2])));
  assert.ok(/ご家族/.test(JSON.stringify(fam.pages[2])));
});
