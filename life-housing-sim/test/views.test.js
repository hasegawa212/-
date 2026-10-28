// TDD：同じ入力から3つの見せ方（iPhone の説明画面・Zoom の16:9資料・A4のPDF提案書）を作る。
// 見た目だけを変え、計算結果は3つで完全に一致させる（回帰テスト）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const cases = { single: S.preset("single"), shataku: S.preset("shataku"), family: S.preset("family"),
  late: { ...S.defaults(), age: 50, own: { ...S.defaults().own, buyAge: 50 } }, rich: { ...S.preset("family"), income: 7_000_000, own: { ...S.preset("family").own, price: 45_000_000 } } };

test("主要な数字は、説明画面（talk）・16:9資料（deck）・PDF提案書（proposal）で同じ文字列", () => {
  for (const [name, inp] of Object.entries(cases)) {
    const x = S.compute(inp);
    const views = { talk: JSON.stringify(S.talk(x)), deck: JSON.stringify(S.deck(x)), pdf: JSON.stringify(S.proposal(x)) };
    const key = { 一生の住居費_賃貸: S.man(x.life.rent), 一生の住居費_持ち家: S.man(x.life.own), 老後の不足_賃貸: S.man(x.old.rent.gapMonthly, 1),
      老後の不足_持ち家: S.man(x.old.own.gapMonthly, 1), 毎月の返済: S.man(x.loan.pmt, 1) };
    for (const [k, v] of Object.entries(key)) for (const [vn, s] of Object.entries(views)) assert.ok(s.includes(v), `${name}：${k} ${v} が ${vn} にない`);
  }
});

test("PDF：年齢別の比較（累計の住居費）— 最後の年齢の累計は一生の住居費と一致", () => {
  for (const inp of Object.values(cases)) {
    const x = S.compute(inp), t = S.ageTable(x);
    assert.equal(t[0].age, x.input.age);
    assert.equal(t.at(-1).age, x.input.lifeEnd);
    assert.ok(t.some((r) => r.age === x.input.retireAge));
    for (let k = 1; k < t.length; k++) assert.ok(t[k].age > t[k - 1].age && t[k].rent >= t[k - 1].rent && t[k].own >= t[k - 1].own);
    assert.ok(Math.abs(t.at(-1).rent - x.life.rent) < 1);
    assert.ok(Math.abs(t.at(-1).own - x.life.own) < 1);
    for (const r of t) assert.equal(r.diff, r.rent - r.own);
  }
});

test("PDF：計算の条件（入力した数字と仮定）と注意事項が付く。お名前は条件に入れない", () => {
  const x = S.compute(S.defaults()), c = S.conditions(x);
  const txt = JSON.stringify(c);
  for (const l of ["年齢", "年収", "物件価格", "金利", "返済", "家賃", "老後の生活費"]) assert.match(txt, new RegExp(l), l);
  assert.ok(txt.includes(S.man(x.input.own.price)));
  const P = S.proposal(x, { customer: "山田" });
  assert.equal(P.appendix.length, 2);
  assert.match(P.appendix[0].title, /年齢/);
  assert.deepEqual(P.appendix[0].table, S.ageTable(x));
  assert.match(P.appendix[1].title, /条件/);
  assert.deepEqual(P.appendix[1].conditions, c);
  assert.ok(P.appendix[1].notes.length >= 5);
  assert.doesNotMatch(JSON.stringify(P.appendix), /山田/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(JSON.stringify(P.appendix), re);
  assert.doesNotMatch(JSON.stringify(P.appendix), /NaN|Infinity|undefined/);
});

test("画面：iPhone は進み具合と前へ・次へを下に固定、長い前提は折りたたみ／Zoom は入力・営業メモを出さない／PDF は改ページで切れない", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="mnav"/);
  assert.match(html, /id="mprog"/);
  assert.match(html, /<details[^>]*id="notesBox"/);
  assert.match(html, /body\.present #notesBox/);
  assert.match(html, /break-inside:\s*avoid/);
  assert.match(html, /P\.appendix/);
});
