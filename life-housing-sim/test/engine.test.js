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
  assert.equal(Math.round(x.old.rent.rentTotal), base.rent.old * 12 * 30 + Math.round((base.rent.old * base.rent.renewMonths / base.rent.renewEvery) * 30));
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

test("説明の6ステップは全部、話すこと・見せる数字・お客様への質問がある", () => {
  const steps = S.talk(S.compute(base));
  assert.equal(steps.length, 6);
  for (const st of steps) for (const k of ["title", "say", "show", "ask"]) assert.ok(st[k] && st[k].length > 3, `${st.title} ${k}`);
});

test("禁止表現を使わない（家賃は無駄・必ず値上がり・今買わないと損 など）", () => {
  const all = JSON.stringify(S.talk(S.compute(base))) + JSON.stringify(S.NOTES);
  for (const re of S.FORBIDDEN) assert.ok(!re.test(all), String(re));
});
