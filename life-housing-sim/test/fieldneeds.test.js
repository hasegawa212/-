// TDD：現場が必要としている知識（販売に必要な知識マトリクス・出現頻度順）を LIFE ROUTE に入れる
// 足りなかった5つ：① 転勤リスクを数字で（貸したら毎月いくら・売ったらいくら・控除はどうなる）② 家族（親）への説明と早めの同席
// ③ NISAとの違い ④ 借入不安を段階的に（他の借入・リボ → CIC → 事前審査 → 本審査）⑤ 金利上昇（変動と固定）
// 断定しない：貸せばローンが払える・控除は必ず続く・黙って貸してよい、とは言わない
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const d = S.defaults();
const x = S.compute(d);
const tr = S.compute({ ...d, transfer: { on: true, leaseRent: 70_000 } });
const debt = S.compute({ ...d, debt: { monthly: 20_000 } });
const noForbidden = (v) => { const t = JSON.stringify(v); for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !t.includes(f) : !f.test(t), String(f)); };

test("入力：転勤（あり/なし・貸した場合の家賃）と他の借入（毎月）。初期値はなし", () => {
  assert.deepEqual(d.transfer, { on: false, leaseRent: 70_000 });
  assert.deepEqual(d.debt, { monthly: 0 });
});

test("① 転勤：貸した場合の毎月（家賃−管理費5%−空室1か月/年 vs 返済＋維持費）、売った場合（10年後）、控除の扱い、NG", () => {
  const t = S.transfer(tr);
  const net = 70_000 * 0.95 * 11 / 12;
  assert.ok(Math.abs(t.lease.netMonthly - net) < 1);
  assert.ok(Math.abs(t.lease.outMonthly - S.future(tr).monthly.own) < 1);
  assert.ok(Math.abs(t.lease.gap - (net - t.lease.outMonthly)) < 1);
  assert.equal(t.sale.net, S.future(tr).points[0].net);
  assert.equal(t.options.length, 3);
  assert.match(t.options.map((o) => o.name).join(), /単身赴任.*貸す.*売る/);
  const credit = t.options.map((o) => o.credit).join("／");
  assert.match(credit, /続く/);
  assert.match(credit, /止まる/);
  assert.match(t.creditNote, /届出書/);
  assert.match(t.creditNote, /延びない/);
  assert.match(t.lease.note, /金融機関の承諾/);
  assert.match(t.axes.join(), /貸しやすい.*売りやすい.*戻る/);
  assert.ok(t.ng.length >= 3);
  assert.equal(t.ask.length, 4, "ヒアリング4項目");
  noForbidden({ ...t, ng: null });
  assert.doesNotMatch(JSON.stringify({ ...t, ng: null }), /家賃でローンが払えます|必ず続きます/);
});

test("④ 借入：他の借入を含む返済比率を審査の目安に入れ、段階（整理→CIC→事前→本審査）を出す", () => {
  const g = S.gate(debt);
  const c = g.checks.find((v) => v.key === "debt");
  assert.ok(c, "他の借入があるときだけ出る");
  assert.match(c.label, /他の借入を含む/);
  const r = ((debt.loan.pmt + 20_000) * 12) / debt.input.income;
  assert.match(c.value, new RegExp(Math.round(r * 100) + "%"));
  assert.ok(!S.gate(x).checks.some((v) => v.key === "debt"));
  const p = S.debtPlan(debt);
  assert.deepEqual(p.steps.map((s) => s.name), ["借入を整理", "CICで確認", "事前審査", "本審査"]);
  assert.match(p.steps[0].what, /リボ|カードローン/);
  assert.ok(p.monthly === 20_000 && p.yearly === 240_000);
});

test("⑤ 金利：+0.5/+1/+2%の毎月と総額、変動と固定のちがい（ルールは金融機関で異なる）", () => {
  const r = S.rateRisk(x);
  assert.deepEqual(r.rows.map((v) => v.add), [0.005, 0.01, 0.02]);
  for (const v of r.rows) assert.ok(Math.abs(v.pmt - S.payment(x.loan.amount, x.input.own.rate + v.add, x.input.own.years)) < 1);
  assert.ok(r.rows[2].extraTotal > r.rows[0].extraTotal);
  assert.match(r.types.map((t) => t.name).join(), /変動.*固定/);
  assert.match(JSON.stringify(r), /金融機関/);
  assert.match(JSON.stringify(r), /下がる/);
});

test("③ NISAとの違い：どちらも元本保証なし、住まいになる／換金しやすさ／税、両方使える", () => {
  const n = S.nisaCompare(x);
  assert.ok(n.rows.length >= 5);
  assert.match(JSON.stringify(n.rows), /元本保証なし/);
  assert.match(n.both, /両方/);
  noForbidden(n);
  assert.doesNotMatch(JSON.stringify(n), /NISAより(必ず|絶対)/);
});

test("② 家族（親）への説明：早めに同席・資料を共有・親の不安には数字で・決めるのは本人とご家族", () => {
  const f = S.familyTalk(x);
  assert.ok(f.process.length >= 4);
  assert.match(f.process.join(), /同席/);
  assert.match(f.show.join(), /完済/);
  assert.match(f.show.join(), /下落|下がる/);
  assert.match(f.decide, /ご本人とご家族/);
  noForbidden(f);
});

test("知識マトリクス：Tier1〜4（出現頻度順）、各項目にひとこと答えと、どこで見せるか。件数や社内の数字は出さない", () => {
  const K = S.KNOWLEDGE;
  assert.deepEqual(K.tiers.map((t) => t.name), ["Tier 1 必須", "Tier 2 標準", "Tier 3 応用", "Tier 4 専門"]);
  assert.equal(K.tiers.reduce((s, t) => s + t.items.length, 0), 18);
  for (const t of K.tiers) for (const it of t.items) assert.ok(it.name && it.answer && it.where, it.name);
  assert.equal(K.gaps.length, 5);
  assert.doesNotMatch(JSON.stringify(K), /\d+件|\d+名/);
  noForbidden(K);
});

test("説明に入る：④NISA・⑤金利（＋転勤ありなら転勤）・⑥他の借入・⑧家族", () => {
  const t = S.talk(tr), td = S.talk(debt);
  assert.match(t[5].show, /NISA/);
  assert.match(t[6].show, /変動/);
  assert.match(t[6].show, /転勤/);
  assert.doesNotMatch(S.talk(x)[6].show, /転勤したら/);
  assert.match(td[7].show, /他の借入/);
  assert.match(t[9].show, /ご家族/);
});

test("資料：転勤ありのお客様だけ「転勤になったら」の1枚（団信の次）", () => {
  const keys = (v) => S.deck(v).slides.map((s) => s.key);
  assert.ok(!keys(x).includes("transfer"));
  const k = keys(tr);
  assert.equal(k[k.indexOf("danshin") + 1], "transfer");
  const s = S.deck(tr).slides.find((v) => v.key === "transfer");
  assert.ok(s.kpis.length >= 2 && s.kpis.length <= 3 && s.headline.length <= 40 && s.lead.length <= 80);
});

test("画面：営業の知識（社内用）パネル、④⑤⑧の表示、入力欄", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="knowOpen"/);
  assert.match(html, /function knowRender\(/);
  for (const f of ["transferView", "rateView", "nisaView", "familyView"]) assert.match(html, new RegExp(`function ${f}\\(x\\)`));
  for (const k of ["transfer.on", "transfer.leaseRent", "debt.monthly"]) assert.match(html, new RegExp(`\\["${k.replace(".", "\\.")}"`));
});
