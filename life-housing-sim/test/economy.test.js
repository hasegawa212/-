// TDD：今の経済の数字（2026年10月時点）を LIFE ROUTE に入れる
// 1) 物価：全国CPI（生鮮食品を除く）2026年9月 前年同月比 +2.1%（総務省 2026/10/23 公表）
// 2) 預金金利：3メガバンクの普通預金 年0.5%（2026/11/2から・税引前）→ 物価が金利より上がると、預金は実質で目減り
// 3) 老後2000万円問題：2019年 金融審議会 報告書＝当時の平均的な無職の夫婦の毎月約5.5万円の不足×30年。お客様自身の数字とくらべる
// 4) 貯蓄型保険：早期解約で払った額より戻りが少ない場合がある。保障と貯蓄は分けて考える
// 物価・金利は「仮に続いた場合」とし、断定しない。出典と時点を必ず添える
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const d = S.defaults();
const x = S.compute({ ...d, age: 30, savings: 2_000_000 });
const fam = S.compute(S.preset("family"));

test("ECONOMY：数字・時点・出典を1か所で持つ", () => {
  const E = S.ECONOMY;
  assert.equal(E.cpi.rate, 0.021);
  assert.match(E.cpi.month, /2026年9月/);
  assert.match(E.cpi.src, /総務省/);
  assert.equal(E.deposit.rate, 0.005);
  assert.match(E.deposit.from, /2026年11月/);
  assert.equal(E.report2000.gapMonthly, 55_000);
  assert.equal(E.report2000.years, 30);
  assert.equal(E.report2000.total, 20_000_000);
  assert.match(E.report2000.src, /金融審議会/);
  assert.match(E.report2000.src, /2019/);
  assert.match(E.asOf, /2026年10月/);
});

test("物価：65歳の生活費は、仮に物価が+2.1%続くと今より増える（今の値×1.021^年数）", () => {
  const e = S.economy(x), n = x.input.retireAge - x.input.age;
  assert.equal(e.years, n);
  assert.ok(Math.abs(e.factor - Math.pow(1.021, n)) < 1e-9);
  assert.ok(Math.abs(e.living65 - x.pension.living * e.factor) < 1);
  assert.ok(e.living65 > x.pension.living);
});

test("預金：金利0.5%・物価2.1%が続くと、預金は実質で目減り（買える量が減る）", () => {
  const e = S.economy(x), n = e.years;
  assert.ok(Math.abs(e.savings.nominal65 - 2_000_000 * Math.pow(1.005, n)) < 1);
  assert.ok(Math.abs(e.savings.real65 - 2_000_000 * Math.pow(1.005 / 1.021, n)) < 1);
  assert.ok(e.savings.real65 < 2_000_000);
  assert.ok(e.savings.lossRate > 0 && e.savings.lossRate < 1);
});

test("2000万円問題：報告書の前提と、お客様自身の老後の不足（賃貸のまま／持ち家）をならべる", () => {
  const e = S.economy(x);
  assert.equal(e.vs2000.report, 20_000_000);
  assert.equal(e.vs2000.rent, x.old.rent.need);
  assert.equal(e.vs2000.own, x.old.own.need);
  assert.match(e.vs2000.line, /2000万円/);
  assert.match(e.vs2000.line, /5\.5万円/);
  assert.match(e.vs2000.line, /あなたの場合/);
  assert.match(e.vs2000.line, new RegExp(S.man(x.old.rent.need)));
});

test("説明：③に2000万円問題との比較、④に物価と預金、⑤に貯蓄型保険の注意。すべて「仮に」・出典つき", () => {
  for (const r of [x, fam]) {
    const t = S.talk(r);
    assert.match(t[4].show, /2000万円/);
    assert.match(t[5].show, /物価/);
    assert.match(t[5].show, /仮に/);
    assert.match(t[5].show, /0\.5%/);
    assert.match(t[6].show, /貯蓄型/);
    assert.match(t[6].show, /元本割れ|払った額より/);
  }
  const all = S.talk(x).map((s) => s.say + s.show + s.ask).join("");
  for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !all.includes(f) : !f.test(all), String(f));
  assert.ok(!/必ず(上が|目減り|損)/.test(all));
});

test("提案書と注意事項：出典と時点を書く", () => {
  const p = S.proposal(x);
  const txt = JSON.stringify(p);
  assert.match(txt, /2000万円/);
  assert.match(JSON.stringify(p.appendix), /物価/);
  assert.ok(S.NOTES.some((n) => /総務省/.test(n) && /2026年9月/.test(n)));
  assert.ok(S.NOTES.some((n) => /金融審議会/.test(n) && /2019/.test(n)));
  assert.ok(S.NOTES.some((n) => /0\.5%/.test(n) && /2026年11月/.test(n)));
});
