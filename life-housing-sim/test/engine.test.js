// TDD：住まいの一生（賃貸のまま／持ち家）を同じ前提で比べる計算
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const base = S.defaults(); // 27歳・年収390万・家賃3万・貯金140万・30歳で結婚（商談報告の中央値に近いお客様像）

test("住宅ローンの毎月の返済（元利均等）", () => {
  assert.equal(Math.round(S.payment(30_000_000, 0.015, 35)), 91_855);
  assert.equal(S.payment(0, 0.015, 35), 0);
});

test("年金の概算：基礎年金＋厚生年金（年収が高いほど多い・上限あり）", () => {
  const a = S.pension(4_000_000, 22, 65), b = S.pension(6_000_000, 22, 65);
  assert.ok(a.yearly > 1_500_000 && a.yearly < 2_200_000, `${a.yearly}`);
  assert.ok(b.yearly > a.yearly);
  assert.equal(S.pension(30_000_000, 22, 65).yearly, S.pension(7_800_000, 22, 65).yearly, "標準報酬の上限");
});

test("賃貸の家賃は暮らしの段階で変わる（ひとり→2人→子育て→老後）", () => {
  const x = S.compute(base);
  const at = (age) => x.years.find((y) => y.age === age);
  assert.equal(at(27).rentMonthly, base.rent.single);
  assert.equal(at(31).rentMonthly, base.rent.couple);
  assert.equal(at(40).rentMonthly, base.rent.family);
  assert.equal(at(70).rentMonthly, base.rent.old);
});

test("持ち家：完済後は返済がなくなり、税金・保険・修繕だけになる", () => {
  const x = S.compute(base);
  const done = base.own.buyAge + base.own.years;
  const y1 = x.years.find((y) => y.age === done - 1), y2 = x.years.find((y) => y.age === done + 1);
  assert.ok(y1.ownLoan > 0);
  assert.equal(y2.ownLoan, 0);
  assert.ok(y2.ownUpkeep > 0);
});

test("老後（65〜95歳）：賃貸は年金から家賃を払い続ける → 毎月の不足が大きい", () => {
  const x = S.compute(base);
  assert.ok(x.old.rent.gapMonthly > x.old.own.gapMonthly);
  assert.equal(Math.round(x.old.rent.rentTotal), base.rent.old * 12 * 30 + Math.round((base.rent.old * base.rent.renewMonths / base.rent.renewEvery) * 30) + base.rent.insYear * 30, "家賃＋更新料＋家財保険");
  assert.ok(x.prepare.rentExtra > 0, "賃貸のままなら、老後の家賃のぶん多く準備が必要");
  assert.ok(Math.abs(x.prepare.monthlyRent - x.prepare.rentNeed / ((65 - 27) * 12)) < 1);
});

test("一生の住居費（今〜95歳）と、65歳時点の家の価値（3つのシナリオ）", () => {
  const x = S.compute(base);
  assert.ok(x.life.rent > 0 && x.life.own > 0);
  const v = x.value65;
  assert.ok(v.down < v.flat && v.flat < v.up);
  assert.ok(v.flat > 0);
});

test("もしも：団信で亡くなったときは残りのローンがなくなる／金利が1%上がったら", () => {
  const x = S.compute(base);
  assert.equal(x.whatIf.danshinLoanAfter, 0);
  assert.ok(x.whatIf.danshinRentContinues > 0, "賃貸なら家族は家賃を払い続ける");
  assert.ok(x.whatIf.rateUpPmt > x.whatIf.pmt);
});

test("持たない場合に「差額を積み立てて運用した」公平な比較も出す", () => {
  const x = S.compute({ ...base, invest: { on: true, rate: 0.03 } });
  assert.ok(x.fair.rentInvested65 >= 0);
  assert.equal(typeof x.fair.note, "string");
});

test("結婚しない・子どもなしでも計算できる", () => {
  const x = S.compute({ ...base, family: { marryAge: null, kids: 0 } });
  assert.ok(x.years.every((y) => y.age >= 65 || y.rentMonthly === base.rent.single));
});

test("説明のステップ（⓪ポートフォリオ〜⑦今はいい？）は全部、話すこと・見せる数字・お客様への質問がある", () => {
  const steps = S.talk(S.compute(base));
  assert.equal(steps.length, 8);
  assert.ok(steps[0].title.startsWith("⓪") && steps[7].title.startsWith("⑦"));
  for (const st of steps) for (const k of ["title", "say", "show", "ask"]) assert.ok(st[k] && st[k].length > 3, `${st.title} ${k}`);
});

test("禁止表現を使わない（家賃は無駄・必ず値上がり・今買わないと損 など）", () => {
  const all = JSON.stringify(S.talk(S.compute(base))) + JSON.stringify(S.NOTES);
  for (const re of S.FORBIDDEN) assert.ok(!re.test(all), String(re));
});

// ───── 追加：保険・税金・住宅ローン控除 ─────
test("税額の概算（給与のみ・令和8・9年分の特例）：所得税・住民税", () => {
  const t = S.estimateTax(3_900_000);
  assert.equal(t.incomeTax, 52_750);
  assert.equal(t.residentTax, 164_000);
  assert.equal(t.taxable, 1_055_000);
  assert.equal(S.estimateTax(5_000_000).incomeTax, 88_500);
});

test("住宅ローン控除：住宅の種類ごとの限度額・期間で、税額を超えない範囲（控除しきれない額は数えない）", () => {
  const x = S.compute({ ...base, own: { ...base.own, kind: "used_other" } });
  const c = x.credit;
  assert.equal(c.limit, 20_000_000);
  assert.equal(c.years, 10);
  assert.equal(c.rows.length, 10);
  for (const r of c.rows) {
    assert.ok(r.actual <= r.max, "上限以下");
    assert.ok(r.actual <= 52_750 + Math.min(97_500, Math.floor(1_055_000 * 0.05), 164_000), "所得税＋住民税の上限以下");
  }
  assert.ok(c.total > 0 && c.total <= 20_000_000 * 0.007 * 10);
  assert.equal(S.compute({ ...base, own: { ...base.own, kind: "none" } }).credit.total, 0);
});

test("結婚後（40歳未満）に買えば若者夫婦世帯の上乗せ（ZEHは4,500万円）。単身なら一般（3,500万円）", () => {
  const married = S.compute({ ...base, own: { ...base.own, kind: "new_zeh", buyAge: 31 } });
  const single = S.compute({ ...base, family: { marryAge: null, kids: 0 }, own: { ...base.own, kind: "new_zeh", buyAge: 31 } });
  assert.equal(married.credit.limit, 45_000_000);
  assert.equal(single.credit.limit, 35_000_000);
});

test("控除は持ち家の年間費用から差し引かれ、一生の内訳の合計＝一生の住居費", () => {
  const x = S.compute(base);
  const credited = x.years.filter((y) => y.ownCredit > 0);
  assert.equal(credited.length, x.credit.rows.filter((r) => r.actual > 0).length);
  const sum = (o) => Object.values(o).reduce((s, v) => s + v.amount * (v.sign || 1), 0);
  assert.ok(Math.abs(sum(x.breakdown.rent) - x.life.rent) < 1);
  assert.ok(Math.abs(sum(x.breakdown.own) - x.life.own) < 1);
  assert.ok(x.breakdown.own.interest.amount > 0, "利息も見える");
  assert.ok(x.breakdown.own.tax.amount > 0 && x.breakdown.own.ins.amount > 0, "税金・保険も見える");
  assert.ok(x.breakdown.rent.ins.amount > 0, "賃貸の家財保険");
});

test("保険：生命保険は団信で見直せる分を持ち家側で減らせる（設定したときだけ）", () => {
  const a = S.compute({ ...base, lifeIns: { monthly: 10_000, cutWithDanshin: 0 } });
  const b = S.compute({ ...base, lifeIns: { monthly: 10_000, cutWithDanshin: 5_000 } });
  assert.equal(a.insurance.ownLife, a.insurance.rentLife);
  assert.ok(b.insurance.ownLife < b.insurance.rentLife);
});

test("ステップ②の説明に、税金・保険・住宅ローン控除が出てくる", () => {
  const s2 = S.talk(S.compute(base)).find((t) => t.title.startsWith("②"));
  for (const w of ["税金", "保険", "住宅ローン控除"]) assert.ok((s2.say + s2.show).includes(w), w);
});

test("限度額が同じ住宅（中古その他など）では「上乗せ」と表示しない", () => {
  const x = S.compute({ ...base, own: { ...base.own, kind: "used_other", buyAge: 31 } });
  assert.equal(x.credit.special, false);
});

// ───── 追加：ポートフォリオ・生涯年収・「今はいい」への答え ─────
test("年収を一般（国税庁の平均給与459.5万円）と比べる", () => {
  const x = S.compute(base);
  assert.equal(S.AVG_SALARY, 4_595_000);
  assert.ok(Math.abs(x.income.vsAverage - 3_900_000 / 4_595_000) < 1e-9);
});

test("生涯収入＝これからの給料（昇給を仮定）＋年金。そのうち住まいに使う割合", () => {
  const x = S.compute({ ...base, raise: 0 });
  const inc = x.income;
  assert.equal(Math.round(inc.salaryMe), 3_900_000 * (65 - 27));
  assert.equal(Math.round(inc.pension), Math.round(x.pension.yearly * 30));
  assert.ok(inc.total >= inc.salaryMe + inc.pension);
  assert.ok(Math.abs(inc.housingShare.rent - x.life.rent / inc.total) < 1e-9);
  assert.ok(inc.housingShare.rent > inc.housingShare.own);
  assert.ok(S.compute({ ...base, raise: 0.01 }).income.salaryMe > inc.salaryMe, "昇給ありなら多い");
});

test("ポートフォリオ：今の資産と、65歳時点の資産（賃貸のまま／持ち家）", () => {
  const x = S.compute({ ...base, nisa: { monthly: 10_000, balance: 300_000, rate: 0.03 } });
  const p = x.portfolio;
  assert.equal(p.now.savings, base.savings);
  assert.equal(p.now.nisa, 300_000);
  assert.equal(p.now.realEstate, 0);
  assert.ok(p.at65.nisa > 300_000 + 10_000 * 12 * 38, "積立＋運用益");
  assert.equal(p.at65.rent.realEstate, 0);
  assert.ok(p.at65.own.realEstate > 0, "持ち家は家の価値−残りのローン");
  assert.ok(p.at65.own.total > p.at65.rent.total);
});

test("「今はいい」：1・3・5年待つと、待つ間の家賃・完済年齢・65歳を過ぎて返す年数が増える", () => {
  const x = S.compute(base);
  const w = x.wait;
  assert.deepEqual(w.map((r) => r.years), [0, 1, 3, 5]);
  assert.equal(w[0].rentWhileWaiting, 0);
  for (let i = 1; i < w.length; i++) {
    assert.ok(w[i].rentWhileWaiting > w[i - 1].rentWhileWaiting);
    assert.ok(w[i].payoffAge >= w[i - 1].payoffAge);
    assert.ok(w[i].loanYearsAfterRetire >= w[i - 1].loanYearsAfterRetire);
  }
  assert.ok(w[3].payoffAge <= 80, "80歳までに完済する返済期間に縮める");
  assert.ok(w[3].pmt >= w[0].pmt, "期間が短くなれば毎月は増える");
});

test("待つ間に金利が0.5%上がった場合も見せる（上がるとは断定しない）", () => {
  const x = S.compute(base);
  assert.ok(x.waitRateUp.pmt > x.wait[0].pmt);
  const s7 = S.talk(x)[7];
  assert.ok(/仮に|場合/.test(s7.show), "仮定として示す");
  assert.ok(/理由/.test(s7.ask), "待つ理由を聞く");
});
