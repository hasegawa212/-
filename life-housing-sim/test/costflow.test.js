// TDD：
// 1) 「持ち家のほうがコストが高い」に見える問題：持ち家の合計には「家そのものの代金」が入っている（払ったあと自分の家として残る）。
//    消えるお金（賃貸＝家賃の全部／持ち家＝利息・税金・保険・修繕・諸費用など）で比べられるようにする。毎月の住居費もならべる
// 2) 審査に必要な書類：CIC＋本人確認書類（運転免許証・健康保険証・マイナンバーカードのどれか）＋源泉徴収票2期分
// 3) 審査のあとの流れ：事前審査 → 内見 → 売買契約 → 本申込（本審査）→ 金銭消費貸借契約 → 決済・引き渡し
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const d = S.defaults();
const cheap = S.compute({ ...d, age: 33, rent: { ...d.rent, single: 35_000 } }); // 家賃が安い例（スクリーンショットと同じ形）

test("くらべ方：持ち家の合計＝家の代金（残る）＋消えるお金。賃貸は全部が消えるお金", () => {
  const c = S.costCompare(cheap);
  assert.equal(c.rent.total, cheap.life.rent);
  assert.equal(c.rent.spent, cheap.life.rent);
  assert.equal(c.own.total, cheap.life.own);
  assert.equal(c.own.house, cheap.input.own.price, "95歳までに返し終わるので家の代金は全部");
  assert.ok(Math.abs(c.own.spent - (c.own.total - c.own.house)) < 1);
  assert.ok(c.own.total > c.rent.total, "合計だけ見ると持ち家が高い例");
  assert.ok(c.own.spent < c.own.total);
  assert.ok(Array.isArray(c.own.items) && c.own.items.some((v) => /利息/.test(v.label)));
});

test("95歳までに返し終わらない場合は、返した分だけが家の代金", () => {
  const x = S.compute({ ...d, age: 64, own: { ...d.own, buyAge: 64, years: 35 } });
  const c = S.costCompare(x);
  assert.ok(c.own.house > 0 && c.own.house < x.input.own.price);
});

test("毎月の住居費：今の家賃 と 買ったあと（返済＋税金・保険・修繕の月割り）", () => {
  const c = S.costCompare(cheap), o = cheap.input.own;
  assert.equal(c.monthly.rent, cheap.years[0].rentMonthly);
  assert.ok(Math.abs(c.monthly.ownLoan - cheap.loan.pmt) < 1e-6);
  assert.ok(Math.abs(c.monthly.ownUpkeep - (o.propTax + o.ins + o.repairYear) / 12) < 1e-6);
  assert.ok(Math.abs(c.monthly.own - (c.monthly.ownLoan + c.monthly.ownUpkeep)) < 1e-6);
});

test("② の説明：家の代金が入っていること・消えるお金・毎月を文章で出す", () => {
  const t = S.talk(cheap).find((v) => /^②/.test(v.title)), c = S.costCompare(cheap);
  assert.match(t.say, /家そのものの代金/);
  for (const v of [S.man(c.own.house), S.man(c.own.spent), S.man(c.rent.spent), S.man(c.monthly.own, 1)]) assert.ok(t.show.includes(v), v);
  for (const re of S.FORBIDDEN) assert.doesNotMatch(t.say + t.show, re);
});

test("審査に必要な書類：CIC・本人確認書類（免許証・保険証・マイナンバーカードのどれか）・源泉徴収票2期分", () => {
  const g = S.gate(cheap), txt = JSON.stringify(g.docs);
  for (const w of ["CIC", "運転免許証", "健康保険証", "マイナンバーカード", "源泉徴収票", "2期分"]) assert.ok(txt.includes(w), w);
  assert.ok(g.steps.some((s) => /本人確認書類/.test(s) && /源泉徴収票/.test(s)));
});

test("審査のあとの流れ：事前審査 → 内見 → 売買契約 → 本申込 → 金銭消費貸借契約 → 決済・引き渡し", () => {
  const names = S.FLOW.map((f) => f.name);
  const order = ["事前審査", "内見", "売買契約", "本申込", "金銭消費貸借契約", "決済・引き渡し"];
  let at = -1;
  for (const n of order) { const k = names.findIndex((v) => v.includes(n)); assert.ok(k > at, n); at = k; }
  assert.deepEqual(S.gate(cheap).flow, S.FLOW);
  const six = S.talk(cheap).find((v) => /^⑥/.test(v.title));
  assert.match(six.show, /内見/);
  assert.match(six.show, /本申込/);
  const p = S.proposal(cheap).pages[3];
  assert.ok(p.nextSteps.some((s) => /内見/.test(s) && /本申込/.test(s)));
});
