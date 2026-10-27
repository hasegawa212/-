// TDD：説明のいちばん最初「節約するなら、いちばん大きな固定費から」
// 日本は「節約しなさい」と言われて育つ国 → 何を節約するか → いちばん大きな固定費は住まい（家賃）
// → 賃貸の仕組み（家賃はオーナーのローン返済・管理・修繕・税金・収益にあてられる）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const Share = require("../lib/share");

const x = S.compute(S.defaults());

test("固定費：今の家賃・手取り（概算）・手取りに占める割合・65歳まで／95歳までに払う家賃", () => {
  const f = S.fixedCost(x);
  const now = x.years[0];
  assert.equal(f.rent, now.rentMonthly, "今の家賃（毎月）");
  const t = S.estimateTax(x.input.income);
  const take = (x.input.income - x.input.income * 0.15 - t.incomeTax - t.residentTax) / 12;
  assert.ok(Math.abs(f.takeHome - take) < 1e-6, "手取り＝年収−社会保険料（15%と仮定）−所得税−住民税");
  assert.ok(Math.abs(f.share - f.rent / f.takeHome) < 1e-12);
  const to65 = x.years.filter((y) => y.age < x.input.retireAge).reduce((s, y) => s + y.rentPart + y.renewPart, 0);
  assert.ok(Math.abs(f.to65 - to65) < 1, "65歳まで賃貸で払う家賃（更新料こみ）");
  const to95 = x.years.reduce((s, y) => s + y.rentPart + y.renewPart, 0);
  assert.ok(Math.abs(f.toEnd - to95) < 1, "95歳まで");
  assert.ok(f.to65 > 0 && f.toEnd > f.to65);
  assert.equal(f.yearly, f.rent * 12);
});

test("説明のいちばん最初（¥）：節約 → いちばん大きな固定費 → 賃貸の仕組み（家賃は住まいの対価）", () => {
  const t = S.talk(x);
  const s = t[0];
  assert.match(s.title, /^¥/);
  assert.match(s.title, /固定費/);
  assert.match(s.say, /節約/);
  assert.match(s.say, /いちばん大きな固定費/);
  assert.match(s.say, /オーナー/);
  assert.match(s.say, /ローンの返済/);
  assert.match(s.say, /住まいの対価/);
  assert.match(s.say, /どちらが正解ということはありません/, "家賃を否定しない");
  assert.ok(s.show.includes(S.man(S.fixedCost(x).rent, 1)), "今の家賃");
  assert.ok(s.show.includes(S.man(S.fixedCost(x).to65)), "65歳までの家賃");
  assert.match(s.show, /赤字/, "オーナーも空室や修繕で赤字になる場合がある（画像の注記と同じ）");
  assert.match(s.ask, /固定費/);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(s.say + s.show + s.ask, re);
  assert.match(t[1].title, /^⓪/, "そのあとは今までどおり ⓪〜⑧");
  assert.match(t[t.length - 1].title, /^⑧/);
  assert.equal(t.length, 10);
});

test("トップのボタンは、同じ名前のステップを開く（番号がずれない）", () => {
  const h = S.home(x), t = S.talk(x);
  const byTitle = (re) => h.actions.find((a) => re.test(a.title));
  assert.match(t[byTitle(/できるか/).step].title, /^⑥/);
  assert.match(t[byTitle(/住まいの一生/).step].title, /^②/);
  assert.match(t[byTitle(/NISA/).step].title, /^⓪/);
  for (const a of h.areas) assert.ok(a.step >= 1 && a.step <= 9);
  assert.match(t[h.areas.find((a) => a.key === "ins").step].title, /^⑤/);
});

test("前に送った共有リンク（番号がずれる前）も、同じステップが開く", () => {
  // 旧リンク：step=6 は ⑥ → 新しい並びでは 7
  assert.equal(Share.decode("#step=6", S.defaults()).step, 7);
  assert.equal(Share.decode("#step=8", S.defaults()).step, 9);
  // 新リンク：v=2 つき
  const h = Share.encode(S.defaults(), { step: 7, defaults: S.defaults() });
  assert.match(h, /v=2/);
  assert.equal(Share.decode(h, S.defaults()).step, 7);
  assert.equal(Share.decode("#step=9&v=2", S.defaults()).step, 9);
  assert.equal(Share.decode("#step=10&v=2", S.defaults()).step, 0, "範囲外は最初");
  assert.equal(Share.decode("#p=1", S.defaults()).step, 0, "ステップなしは「¥」から");
});

test("提案書1ページ目に「いちばん大きな固定費」が入る（4ページのまま）", () => {
  const p = S.proposal(x);
  assert.equal(p.pages.length, 4);
  const f = S.fixedCost(x);
  assert.ok(p.pages[0].points.some((v) => /いちばん大きな固定費/.test(v) && v.includes(S.man(f.rent, 1))));
});
