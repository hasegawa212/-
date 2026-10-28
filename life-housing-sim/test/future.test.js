// TDD：「毎月の家賃、そのまま払い続けますか？」— 賃貸と戸建て購入で、毎月払うお金が10年後・20年後にどう変わるかを、お客様の数字で
// 1) 毎月：今の家賃 vs 返済＋維持費（固定資産税・保険・修繕）
// 2) 10年後・20年後：払った合計、ローン残高、家の想定価格（横ばいシナリオ）、売却費用（仲介手数料の上限）、売った場合の手元の目安
// 3) 老後：完済後の毎月の住居費（維持費だけ）vs 老後の家賃、住み替え・売却という選択肢
// 正直に：仮定の概算、頭金・諸費用・税金・保険・修繕がかかる、価値は下がる場合もある（マイナスもそのまま出す）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const x = S.compute(S.defaults());
const f = S.future(x);

test("毎月：今の家賃 vs 返済＋維持費", () => {
  assert.equal(f.monthly.rent, x.years.find((y) => y.age === x.loan.buyAge).rentMonthly);
  assert.equal(f.monthly.loan, x.loan.pmt);
  const y = x.years.find((v) => v.age === x.loan.buyAge);
  assert.ok(Math.abs(f.monthly.upkeep - y.ownUpkeep / 12) < 1);
  assert.ok(Math.abs(f.monthly.own - (f.monthly.loan + f.monthly.upkeep)) < 1);
});

test("10年後・20年後：払った合計・ローン残高・家の価値・売却費用・手元の目安（計算と一致）", () => {
  assert.deepEqual(f.points.map((p) => p.years), [10, 20, x.input.own.years], "完済の年（35年後）まで");
  assert.ok(f.points[2].paidOff && f.points[2].balance < 1);
  for (const p of f.points) {
    const ys = x.years.filter((y) => y.age >= x.loan.buyAge && y.age < x.loan.buyAge + p.years);
    assert.equal(p.age, x.loan.buyAge + p.years);
    assert.ok(Math.abs(p.rentPaid - ys.reduce((s, y) => s + y.rentPart + y.renewPart, 0)) < 1);
    assert.ok(Math.abs(p.loanPaid - ys.reduce((s, y) => s + y.ownLoan, 0)) < 1);
    assert.ok(Math.abs(p.upkeep - ys.reduce((s, y) => s + y.ownUpkeep, 0)) < 1);
    assert.ok(Math.abs(p.balance - S.balanceAfter(x.loan.amount, x.input.own.rate, x.input.own.years, p.years * 12)) < 1);
    assert.ok(Math.abs(p.saleCost - (p.value * 0.03 + 60_000) * 1.1) < 1, "仲介手数料の上限（税込）");
    assert.ok(Math.abs(p.net - (p.value - p.balance - p.saleCost)) < 1, "マイナスでもそのまま");
    assert.ok(p.principal > 0 && Math.abs(p.principal - (x.loan.amount - p.balance)) < 1);
  }
  assert.ok(f.points[1].balance < f.points[0].balance, "返すほど残高は減る");
});

test("老後：完済後の毎月の住居費（維持費）vs 老後の家賃、選択肢", () => {
  assert.equal(f.old.rent, x.input.rent.old);
  assert.ok(f.old.own > 0 && f.old.own < f.monthly.own);
  assert.match(f.old.options.join("／"), /住み替え/);
  assert.match(f.old.options.join("／"), /売却/);
});

test("言葉：見出し・キャッチ・注意（仮定・諸費用・価値の下落）", () => {
  assert.match(f.title, /毎月の家賃、そのまま払い続けますか/);
  assert.match(f.sub, /10年後・20年後/);
  assert.equal(f.catch, "家賃は、住むための支払い。住宅ローンは、住みながら自分の家を持つための支払い。");
  assert.match(f.note, /頭金・諸費用・固定資産税・保険・修繕/);
  assert.match(f.note, /下がる場合/);
  const all = JSON.stringify(f);
  for (const v of S.FORBIDDEN) assert.ok(typeof v === "string" ? !all.includes(v) : !v.test(all), String(v));
  for (const p of ["single", "shataku", "family"]) assert.doesNotMatch(JSON.stringify(S.future(S.compute(S.preset(p)))), /NaN|Infinity|undefined/);
});

test("資料：結論の次に「future」の1枚（数字は計算と同じ）。準備をすすめる人には問いかけの見出しにしない", () => {
  const d = S.deck(x);
  const keys = d.slides.map((s) => s.key);
  assert.equal(keys[keys.indexOf("conclusion") + 1], "future");
  const s = d.slides.find((v) => v.key === "future");
  assert.equal(s.visual, "future");
  assert.ok(s.kpis.some((k) => k.value === S.man(f.monthly.rent, 1)));
  assert.ok(s.kpis.some((k) => k.value === S.man(f.monthly.own, 1)));
  assert.ok(s.notes.say && s.notes.ask);
  const poor = S.compute({ ...S.defaults(), age: 50, income: 2_500_000, rent: { ...S.defaults().rent, single: 30_000, old: 30_000 }, own: { ...S.defaults().own, price: 45_000_000 } });
  assert.equal(S.recommend(poor).verdict, "prepare");
  assert.doesNotMatch(S.deck(poor).slides.find((v) => v.key === "future").headline, /払い続けますか/);
});

test("画面：②に futureView（Zoomでは省く）、資料の future", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /function futureView\(x\)/);
  assert.match(html, /future: \(\) => futureView\(x\)/);
  assert.match(html, /costView\(x\) \+ futureView\(x\)/);
  assert.match(html, /body\.present \.futurebox/);
});

test("5つのメリット：正直な言い方（価値は上下・選択肢は立地で変わる）。賃貸を「何も残らない」とは書かない", () => {
  assert.equal(f.merits.length, 5);
  const t = JSON.stringify(f.merits);
  assert.match(t, /上下/);
  assert.match(t, /団信/);
  assert.match(S.future(S.compute(S.preset("family"))).merits[4].text, /家族/);
  assert.doesNotMatch(JSON.stringify(f), /何も残らない|資産0円|資産 0円/);
});
