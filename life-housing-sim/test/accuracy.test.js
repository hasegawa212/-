// TDD：計算が正確かを「別の方法で計算した答え」と突き合わせる
// ・ローン：月ごとに残高を追いかける（式を使わない）
// ・税金・年金：手計算（令和8年分の制度。財務省「令和8年度税制改正の大綱」）
// ・住宅ローン控除：年ごとの上限（残高・限度額・物件価格・0.7%・所得税・住民税の上限）を一つずつ確かめる
// ・いろいろなお客様像で、合計・内訳・待った場合が食い違わないこと
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} ≠ ${b}（許容 ${tol}）`);

// 月ごとに残高を追いかけるローン（毎月：利息＝残高×金利/12、元金＝返済−利息）
function amortize(P, rate, years, pmt) {
  let bal = P, interest = 0;
  const yearEnd = [];
  for (let m = 1; m <= years * 12; m++) {
    const it = (bal * rate) / 12;
    interest += it;
    bal = bal + it - pmt;
    if (m % 12 === 0) yearEnd.push(bal);
  }
  return { bal, interest, yearEnd };
}

test("ローン：毎月の返済は、月ごとに追いかけると完済時にちょうど0になる額", () => {
  for (const [P, r, y] of [[29_960_000, 0.012, 35], [30_000_000, 0.01, 35], [20_000_000, 0.02, 20], [10_000_000, 0, 10]]) {
    const pmt = S.payment(P, r, y);
    const a = amortize(P, r, y, pmt);
    near(a.bal, 0, 0.01, `完済時の残高 ${P}/${r}/${y}`);
    for (let k = 1; k <= y; k++) near(S.balanceAfter(P, r, y, k * 12), Math.max(0, a.yearEnd[k - 1]), 0.01, `${k}年後の残高`);
  }
});

test("ローン：よく知られた返済額（3,000万円・金利1%・35年＝84,686円）", () => {
  assert.equal(Math.round(S.payment(30_000_000, 0.01, 35)), 84_686);
  assert.equal(Math.round(S.payment(30_000_000, 0.015, 35)), 91_855);
});

test("税金：年収390万（単身・給与だけ）の手計算と一致（令和8年分）", () => {
  // 給与所得控除 390万×20%+44万＝122万 → 所得 268万
  // 社会保険料（15%と仮定）58.5万、基礎控除 104万（所得489万以下：本則62万＋特例42万）
  // 課税所得 268−58.5−104＝105.5万 → 所得税 5%＝52,750円
  // 住民税 (268−58.5−43)×10% − 調整控除2,500＝164,000円
  const t = S.estimateTax(3_900_000);
  assert.equal(t.totalIncome, 2_680_000);
  assert.equal(t.taxable, 1_055_000);
  assert.equal(t.incomeTax, 52_750);
  assert.equal(t.residentTax, 164_000);
});

test("税金：給与所得控除の最低保障74万円・基礎控除の段階（104万／67万／62万）", () => {
  assert.equal(S.estimateTax(1_780_000).taxable, 0, "年収178万までは所得税がかからない（社会保険料を除いても）");
  assert.equal(S.estimateTax(1_000_000).totalIncome, 260_000, "最低保障74万円");
  // 所得 489万超〜655万以下は基礎控除67万：年収 650万 → 所得 650−(130+44)=476万（104万）、年収 700万 → 所得 700−180=520万（67万）
  const t7 = S.estimateTax(7_000_000);
  assert.equal(t7.totalIncome, 5_200_000);
  assert.equal(t7.taxable, Math.floor((5_200_000 - 1_050_000 - 670_000) / 1000) * 1000);
  // 所得税：課税所得 348万 → 20%−427,500＝268,500円
  assert.equal(t7.incomeTax, 268_500);
});

test("年金：年収390万・22〜65歳の手計算と一致（令和8年度）", () => {
  // 基礎年金 847,300円 ＋ 厚生年金 390万÷12＝32.5万 × 5.481/1000 × 516月 ＝ 919,164円
  const p = S.pension(3_900_000, 22, 65);
  assert.equal(p.kousei, 919_164);
  assert.equal(p.yearly, 847_300 + 919_164);
});

// 住宅ローン控除を、年ごとの上限を一つずつ当てはめて別に計算する
function creditOracle(x) {
  const o = x.input.own, k = S.CREDIT_KINDS[o.kind];
  const loan = x.loan.amount, share = (o.price - o.down) / loan;
  const t = S.estimateTax(x.input.income);
  const resCap = Math.min(97_500, Math.floor(t.taxable * 0.05), t.residentTax);
  const a = amortize(loan, o.rate, o.years, x.loan.pmt);
  const rows = [];
  for (let i = 1; i <= k.years; i++) {
    const bal = Math.max(0, a.yearEnd[i - 1] ?? 0) * share;
    const max = Math.floor((Math.min(bal, x.credit.limit, o.price) * 0.007) / 100) * 100;
    const it = Math.min(max, t.incomeTax);
    rows.push({ max, actual: it + Math.min(max - it, resCap) });
  }
  return rows;
}

test("住宅ローン控除：年ごとの額が、別に計算した額と一致する（3つの物件の種類）", () => {
  for (const kind of ["used_other", "new_zeh", "new_cert"]) {
    for (const income of [3_900_000, 6_000_000]) {
      const x = S.compute({ ...S.defaults(), income, own: { ...S.defaults().own, kind, price: 40_000_000 } });
      const o = creditOracle(x);
      assert.equal(x.credit.rows.length, o.length, kind);
      x.credit.rows.forEach((r, i) => {
        near(r.max, o[i].max, 100, `${kind} ${income} ${i + 1}年目 上限`);
        near(r.actual, o[i].actual, 100, `${kind} ${income} ${i + 1}年目 実際`);
        assert.ok(r.fromRT <= 97_500 && r.actual <= r.max);
      });
    }
  }
});

test("住宅ローン控除：子育て世帯の上乗せは「19歳未満の子がいる」ときだけ（子が大きければ一般の限度額）", () => {
  const fam = S.preset("family");
  // 45歳で買う・子どもは25歳で生まれた（買うとき20歳）→ 上乗せなし
  const x = S.compute({ ...fam, age: 44, family: { marryAge: 24, kids: 1, firstKidAge: 25 }, own: { ...fam.own, buyAge: 45, years: 30, kind: "new_zeh" } });
  assert.equal(x.credit.special, false);
  assert.equal(x.credit.limit, S.CREDIT_KINDS.new_zeh.limit[0]);
  // 子どもが18歳なら上乗せ
  const y = S.compute({ ...fam, age: 44, family: { marryAge: 24, kids: 1, firstKidAge: 27 }, own: { ...fam.own, buyAge: 45, years: 30, kind: "new_zeh" } });
  assert.equal(y.credit.special, true);
});

test("内訳：95歳までに返し終わらない場合も、元金＝借りた額−残り、利息＝払った額−元金", () => {
  // 70歳で35年ローン（95歳までに25年分だけ払う）
  const d = S.defaults();
  const x = S.compute({ ...d, age: 69, own: { ...d.own, buyAge: 70 } });
  const paid = x.years.reduce((s, y) => s + y.ownLoan, 0);
  const left = S.balanceAfter(x.loan.amount, d.own.rate, d.own.years, 25 * 12);
  near(x.breakdown.own.principal.amount, x.loan.amount - left, 1, "元金");
  near(x.breakdown.own.interest.amount, paid - (x.loan.amount - left), 1, "利息");
  assert.ok(x.breakdown.own.interest.amount > 0);
});

test("住宅ローン控除：95歳を過ぎた年は数えない（一生の住居費と控除の合計が食い違わない）", () => {
  const d = S.defaults();
  // 90歳で買う（控除10年のうち95歳までの5年だけ）
  const x = S.compute({ ...d, age: 89, own: { ...d.own, buyAge: 90, years: 10 } });
  assert.equal(x.credit.rows.length, 5);
  assert.equal(x.credit.total, x.breakdown.own.credit.amount);
});

test("生命保険：団信で見直せるのは、ローンを返している間だけ", () => {
  const d = S.defaults();
  // 30歳で買って20年で完済（50歳）→ 見直せるのは20年分
  const x = S.compute({ ...d, own: { ...d.own, years: 20 }, lifeIns: { monthly: 10_000, cutWithDanshin: 5_000 } });
  assert.equal(x.insurance.rentLife - x.insurance.ownLife, 5_000 * 12 * 20);
});

// いろいろなお客様像で、合計・内訳が食い違わないこと
function* cases() {
  const d = S.defaults(), f = S.preset("family");
  for (const p of [d, f]) for (const income of [2_800_000, 3_900_000, 6_500_000])
    for (const buyAge of [27, 35, 50]) for (const rate of [0, 0.012, 0.025]) for (const financeCosts of [true, false])
      for (const kind of ["used_other", "new_energy", "none"])
        yield { ...p, income, own: { ...p.own, buyAge, rate, financeCosts, kind, down: financeCosts ? 0 : 1_000_000 } };
}

test("どのお客様像でも：内訳の合計＝一生の住居費、元金＝借りた額、控除は払った税金の範囲", () => {
  let n = 0;
  for (const inp of cases()) {
    const x = S.compute(inp), b = x.breakdown;
    const sumR = Object.values(b.rent).reduce((s, v) => s + v.amount, 0);
    const sumO = Object.values(b.own).reduce((s, v) => s + (v.sign || 1) * v.amount, 0);
    near(sumR, x.life.rent, 1, "賃貸の内訳");
    near(sumO, x.life.own, 1, "持ち家の内訳");
    if (x.loan.endAge <= inp.lifeEnd) near(b.own.principal.amount, x.loan.amount, 1, "元金＝借りた額");
    const t = S.estimateTax(inp.income);
    for (const r of x.credit.rows) {
      assert.ok(r.fromIT <= t.incomeTax && r.fromRT <= Math.min(97_500, t.taxable * 0.05) && r.actual <= r.max);
      assert.ok(r.max <= Math.min(x.credit.limit, inp.own.price) * 0.007 + 1);
    }
    // 待った場合：その間の家賃は年ごとの家賃の合計
    for (const w of x.wait) {
      const rent = x.years.filter((y) => y.age >= x.loan.buyAge && y.age < w.buyAge).reduce((s, y) => s + y.rentYear, 0);
      near(w.rentWhileWaiting, rent, 1);
      assert.ok(w.payoffAge <= 80 || w.loanYears === 10);
    }
    // 老後：不足は「支出−年金」を年ごとに足したもの（マイナスは0）
    const old = x.years.filter((y) => y.age >= inp.retireAge);
    const need = old.reduce((s, y) => s + Math.max(0, x.pension.living * 12 + y.rentYear - x.pension.yearly), 0);
    near(x.old.rent.need, need, 1, "老後の不足（賃貸）");
    n++;
  }
  assert.ok(n >= 300, `${n}通り`);
});

test("提案書の数字は、シミュレーターの数字と同じ（四捨五入の表示まで）", () => {
  const x = S.compute(S.defaults());
  const p = S.proposal(x);
  const text = JSON.stringify(p);
  for (const v of [x.life.rent, x.life.own, x.credit.total, x.prepare.rentNeed, x.income.total]) assert.ok(text.includes(S.man(v)), S.man(v));
  assert.ok(text.includes(S.man(x.loan.pmt, 1)));
});
