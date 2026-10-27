// 住まいの一生シミュレーター（計算）：賃貸のまま／持ち家 を、今から95歳まで同じ前提で比べる
// 依存なし。Node：require("./lib/engine")　ブラウザ：<script src="lib/engine.js"> で window.LHS
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.LHS = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // お客様に言わない表現（事実に反する・断定・あおり）
  // 一般の年収：国税庁「民間給与実態統計調査」令和5年分の平均給与（1年を通じて勤務した給与所得者）
  const AVG_SALARY = 4_595_000;

  const FORBIDDEN = [/今しかない/, /二度と(買えない|ない)/, /必ず値上がり/, /絶対に損(し|は)ない/, /今買わないと損/, /家賃は(無駄|捨て)/, /返済(は|が)(すべて|全部)資産/, /必ず売れる/, /土地は必ず/, /残りわずか/, /今だけ/];

  // 年金の概算に使う数字（令和8年度。日本年金機構の資料による。毎年度改定）
  const PENSION = {
    basicFull: 847_300,        // 老齢基礎年金の満額（年額）
    kouseiRate: 5.481 / 1000,  // 厚生年金（報酬比例部分）の乗率（2003年4月以降の加入期間）
    salaryCap: 650_000,        // 標準報酬月額の上限
  };

  // 住宅ローン控除（2026〜2027年入居の制度。単身・一般は limit[0]、子育て・若者夫婦世帯は limit[1]）
  // 2028年以降の入居は新築の省エネ基準などが変わる〔要確認〕。詳しい判定は land-life-proposal/lib/rules.js
  const CREDIT_KINDS = {
    new_cert: { label: "新築・買取再販（認定長期優良・低炭素）", limit: [45_000_000, 50_000_000], years: 13 },
    new_zeh: { label: "新築・買取再販（ZEH水準省エネ）", limit: [35_000_000, 45_000_000], years: 13 },
    new_energy: { label: "新築・買取再販（省エネ基準）", limit: [20_000_000, 30_000_000], years: 13 },
    used_zeh: { label: "中古（認定・ZEH水準）", limit: [35_000_000, 45_000_000], years: 13 },
    used_energy: { label: "中古（省エネ基準）", limit: [20_000_000, 30_000_000], years: 13 },
    used_other: { label: "中古・買取再販（その他の住宅）", limit: [20_000_000, 20_000_000], years: 10 },
    none: { label: "対象外（省エネ基準を満たさない新築など）", limit: [0, 0], years: 0 },
  };
  const CREDIT_RATE = 0.007, RES_CAP_RATE = 0.05, RES_CAP_MAX = 97_500;

  // 税額の概算（給与収入だけ・単身。令和8・9年分の特例を将来も続くと仮定＝控除できる余地を低めに見積もる）
  function salaryDeduction(g) {
    let f;
    if (g <= 1_625_000) f = 550_000;
    else if (g <= 1_800_000) f = g * 0.4 - 100_000;
    else if (g <= 3_600_000) f = g * 0.3 + 80_000;
    else if (g <= 6_600_000) f = g * 0.2 + 440_000;
    else if (g <= 8_500_000) f = g * 0.1 + 1_100_000;
    else f = 1_950_000;
    return Math.min(g, Math.max(740_000, f));
  }
  function basicDeduction(total) {
    if (total > 25_000_000) return 0;
    if (total > 24_500_000) return 160_000;
    if (total > 24_000_000) return 320_000;
    if (total > 23_500_000) return 480_000;
    if (total <= 4_890_000) return 1_040_000;
    if (total <= 6_550_000) return 670_000;
    return 620_000;
  }
  function incomeTaxOf(t) {
    const B = [[1_950_000, 0.05, 0], [3_300_000, 0.1, 97_500], [6_950_000, 0.2, 427_500], [9_000_000, 0.23, 636_000],
      [18_000_000, 0.33, 1_536_000], [40_000_000, 0.4, 2_796_000], [Infinity, 0.45, 4_796_000]];
    const b = B.find((x) => t <= x[0]);
    return Math.max(0, Math.floor(t * b[1] - b[2]));
  }
  function estimateTax(gross, socialRate = 0.15) {
    const totalIncome = Math.max(0, gross - salaryDeduction(gross));
    const social = gross * socialRate;
    const taxable = Math.floor(Math.max(0, totalIncome - social - basicDeduction(totalIncome)) / 1000) * 1000;
    const rtTaxable = Math.floor(Math.max(0, totalIncome - social - 430_000) / 1000) * 1000;
    const residentTax = Math.max(0, Math.floor(rtTaxable * 0.1 - 2_500));
    return { totalIncome, taxable, incomeTax: incomeTaxOf(taxable), residentTax };
  }

  const man = (v, d = 0) => (v == null ? "—" : (v / 10_000).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }) + "万円");

  function payment(P, rate, years) {
    if (P <= 0) return 0;
    const r = rate / 12, n = years * 12;
    if (r === 0) return P / n;
    const g = Math.pow(1 + r, n);
    return (P * r * g) / (g - 1);
  }
  function balanceAfter(P, rate, years, months) {
    const r = rate / 12, pm = payment(P, rate, years), k = Math.min(months, years * 12);
    if (r === 0) return Math.max(0, P - pm * k);
    const g = Math.pow(1 + r, k);
    return Math.max(0, P * g - (pm * (g - 1)) / r);
  }

  // 年金の概算（年額）：基礎年金（満額と仮定）＋厚生年金（平均の月給 × 乗率 × 加入月数）
  function pension(income, workStart, retireAge) {
    const avg = Math.min(PENSION.salaryCap, Math.max(0, income) / 12);
    const months = Math.max(0, retireAge - workStart) * 12;
    const kousei = income > 0 ? avg * PENSION.kouseiRate * months : 0;
    const yearly = Math.round(PENSION.basicFull + kousei);
    return { yearly, monthly: yearly / 12, basic: PENSION.basicFull, kousei: Math.round(kousei) };
  }

  // 商談報告（#03）の中央値に近いお客様像：27歳・年収390万・貯金140万。家賃は将来の暮らしに合わせた目安（仮定）
  function defaults() {
    return {
      age: 27, income: 3_900_000, savings: 1_400_000, workStart: 22, retireAge: 65, lifeEnd: 95,
      family: { marryAge: 30, kids: 1, firstKidAge: 32 },
      partnerIncome: 0,
      rent: { single: 55_000, couple: 75_000, family: 90_000, old: 70_000, renewMonths: 1, renewEvery: 2, insYear: 10_000 },
      own: { buyAge: 30, price: 28_000_000, landShare: 0.35, down: 0, costRate: 0.07, financeCosts: true, rate: 0.012, years: 35,
        propTax: 100_000, ins: 30_000, repairYear: 150_000, repairUpAfter: 20, repairUpRate: 1.5, kind: "used_other" },
      lifeIns: { monthly: 10_000, cutWithDanshin: 0 },
      nisa: { monthly: 10_000, balance: 300_000, rate: 0.03 },
      raise: 0.01, // 年収の上がり方（年率・仮定）
      oldLiving: { single: 130_000, couple: 220_000 },
      landRates: { down: -0.01, flat: 0, up: 0.01 },
      invest: { on: false, rate: 0.03 },
    };
  }

  function stage(inp, age) {
    const f = inp.family || {};
    if (age >= inp.retireAge) return "old";
    if (f.kids > 0 && f.firstKidAge != null && age >= f.firstKidAge && age < f.firstKidAge + 22) return "family";
    if (f.marryAge != null && age >= f.marryAge) return "couple";
    return "single";
  }
  const STAGE_LABEL = { single: "ひとり暮らし", couple: "2人暮らし", family: "子育て", old: "老後" };

  function compute(input, nested) {
    const d = defaults();
    const inp = { ...d, ...input, family: { ...d.family, ...(input.family || {}) }, rent: { ...d.rent, ...(input.rent || {}) },
      own: { ...d.own, ...(input.own || {}) }, oldLiving: { ...d.oldLiving, ...(input.oldLiving || {}) },
      landRates: { ...d.landRates, ...(input.landRates || {}) }, invest: { ...d.invest, ...(input.invest || {}) },
      lifeIns: { ...d.lifeIns, ...(input.lifeIns || {}) }, nisa: { ...d.nisa, ...(input.nisa || {}) } };
    const o = inp.own, R = inp.rent;
    const married = inp.family.marryAge != null;
    const cost = o.price * o.costRate;
    const loan = o.price - o.down + (o.financeCosts ? cost : 0);
    const cashAtBuy = o.down + (o.financeCosts ? 0 : cost);
    const pmt = payment(loan, o.rate, o.years);
    const buyAge = Math.max(inp.age, o.buyAge);
    const loanEnd = buyAge + o.years;

    const me = pension(inp.income, inp.workStart, inp.retireAge);
    const partner = married ? (inp.partnerIncome > 0 ? pension(inp.partnerIncome, inp.workStart, inp.retireAge) : { yearly: PENSION.basicFull }) : { yearly: 0 };
    const pensionYearly = me.yearly + partner.yearly;
    const living = married ? inp.oldLiving.couple : inp.oldLiving.single;

    // 住宅ローン控除：年末残高（住宅の取得分だけ）× 0.7%（限度額・物件価格まで）。所得税→住民税（課税所得×5%・最高97,500円）の順に、払った税金の範囲で戻る
    const kind = CREDIT_KINDS[o.kind] || CREDIT_KINDS.none;
    const f = inp.family;
    const marriedAtBuy = f.marryAge != null && f.marryAge <= buyAge;
    const kidAtBuy = f.kids > 0 && f.firstKidAge != null && f.firstKidAge <= buyAge;
    // 上乗せの対象世帯で、かつ限度額が上がる住宅のときだけ「上乗せ」として扱う
    const special = ((marriedAtBuy && buyAge < 40) || kidAtBuy) && kind.limit[1] > kind.limit[0];
    const limit = kind.limit[special ? 1 : 0];
    const tax = estimateTax(inp.income);
    const resCap = Math.min(RES_CAP_MAX, Math.floor(tax.taxable * RES_CAP_RATE), tax.residentTax);
    const share = loan > 0 ? Math.min(1, Math.max(0, o.price - o.down) / loan) : 0;
    const creditRows = [];
    for (let i = 1; i <= kind.years; i++) {
      const balance = balanceAfter(loan, o.rate, o.years, 12 * i) * share;
      const max = Math.floor((Math.min(balance, limit, o.price) * CREDIT_RATE) / 100) * 100;
      const fromIT = Math.min(max, tax.incomeTax);
      const fromRT = Math.min(max - fromIT, resCap);
      creditRows.push({ i, age: buyAge + i - 1, balance, max, fromIT, fromRT, actual: fromIT + fromRT });
    }
    const creditAt = (age) => (creditRows.find((r) => r.age === age) || { actual: 0 }).actual;

    const years = [];
    for (let age = inp.age; age < inp.lifeEnd; age++) {
      const st = stage(inp, age);
      const rentMonthly = R[st];
      const rentPart = rentMonthly * 12, renewPart = (rentMonthly * R.renewMonths) / R.renewEvery, rentIns = R.insYear;
      const rentYear = rentPart + renewPart + rentIns;
      let ownYear, ownLoan = 0, ownUpkeep = 0, cash = 0, ownTax = 0, ownIns = 0, ownRepair = 0, ownCredit = 0, preRent = 0;
      if (age < buyAge) { ownYear = rentYear; preRent = rentYear; }
      else {
        if (age === buyAge) cash = cashAtBuy;
        ownLoan = age < loanEnd ? pmt * 12 : 0;
        const held = age - buyAge;
        ownTax = o.propTax; ownIns = o.ins; ownRepair = o.repairYear * (held >= o.repairUpAfter ? o.repairUpRate : 1);
        ownUpkeep = ownTax + ownIns + ownRepair;
        ownCredit = creditAt(age);
        ownYear = cash + ownLoan + ownUpkeep - ownCredit;
      }
      years.push({ age, stage: st, stageLabel: STAGE_LABEL[st], rentMonthly, rentYear, rentPart, renewPart, rentIns,
        ownYear, ownLoan, ownUpkeep, ownTax, ownIns, ownRepair, ownCredit, cash, preRent });
    }

    const sum = (arr, k) => arr.reduce((s, y) => s + y[k], 0);
    const oldYears = years.filter((y) => y.age >= inp.retireAge);
    const oldOf = (k, housingK) => {
      const out = oldYears.map((y) => living * 12 + y[housingK]);
      const gaps = out.map((v) => Math.max(0, v - pensionYearly));
      const need = gaps.reduce((s, v) => s + v, 0);
      return { housingTotal: sum(oldYears, housingK), need, gapMonthly: oldYears.length ? need / oldYears.length / 12 : 0,
        outMonthly: oldYears.length ? out.reduce((s, v) => s + v, 0) / oldYears.length / 12 : 0 };
    };
    const oldRent = { ...oldOf("rent", "rentYear"), rentTotal: sum(oldYears, "rentYear") };
    const oldOwn = oldOf("own", "ownYear");
    const monthsToRetire = Math.max(1, (inp.retireAge - inp.age) * 12);

    // 65歳時点の家の価値（土地は年率で変化、建物は30年で1割まで直線で下がると仮定）
    const t = Math.max(0, inp.retireAge - buyAge);
    const bldg = o.price * (1 - o.landShare) * Math.max(0.1, 1 - (0.9 * t) / 30);
    const landAt = (r) => o.price * o.landShare * Math.pow(1 + r, t);
    const balance65 = balanceAfter(loan, o.rate, o.years, t * 12);
    const value65 = { down: landAt(inp.landRates.down) + bldg, flat: landAt(inp.landRates.flat) + bldg, up: landAt(inp.landRates.up) + bldg, bldg, balance: balance65 };

    // 公平な比較：賃貸の人が「持ち家との差額」を毎年積み立てて運用した場合の65歳時点の額（運用は元本保証なし）
    let fv = 0;
    for (const y of years.filter((y) => y.age >= buyAge && y.age < inp.retireAge)) fv = fv * (1 + inp.invest.rate) + Math.max(0, y.ownYear - y.rentYear);

    const tot = (k) => years.reduce((s2, y) => s2 + y[k], 0);
    const paid = tot("ownLoan");
    const principal = Math.min(loan, paid);
    const breakdown = {
      rent: {
        rent: { label: "家賃", amount: tot("rentPart") },
        renew: { label: "更新料", amount: tot("renewPart") },
        ins: { label: "家財保険（賃貸の火災保険）", amount: tot("rentIns") },
      },
      own: {
        preRent: { label: "買うまでの家賃など", amount: tot("preRent") },
        cash: { label: "頭金・諸費用（現金）", amount: tot("cash") },
        principal: { label: o.financeCosts ? "ローン返済のうち元金（諸費用を含む）" : "ローン返済のうち元金", amount: principal },
        interest: { label: "ローン返済のうち利息", amount: paid - principal },
        tax: { label: "固定資産税・都市計画税", amount: tot("ownTax") },
        ins: { label: "火災・地震保険", amount: tot("ownIns") },
        repair: { label: "修繕の積立", amount: tot("ownRepair") },
        credit: { label: "住宅ローン控除（戻る税金）", amount: tot("ownCredit"), sign: -1 },
      },
    };
    // 生命保険（住まいとは別に、両方で払う）。持ち家は団信で死亡保障が付くので、見直せる分を設定できる
    const lifeYears = Math.max(0, inp.retireAge - inp.age);
    const ownedYears = Math.max(0, inp.retireAge - buyAge);
    const insurance = {
      rentHome: breakdown.rent.ins.amount, ownHome: breakdown.own.ins.amount,
      rentLife: inp.lifeIns.monthly * 12 * lifeYears,
      ownLife: inp.lifeIns.monthly * 12 * lifeYears - Math.min(inp.lifeIns.cutWithDanshin, inp.lifeIns.monthly) * 12 * ownedYears,
      lifeMonthly: inp.lifeIns.monthly, cut: inp.lifeIns.cutWithDanshin,
    };

    // 生涯収入（これからの給料＋年金）と、そのうち住まいに使う割合
    let salaryMe = 0, salaryPartner = 0;
    for (let a = inp.age; a < inp.retireAge; a++) {
      const g = Math.pow(1 + inp.raise, a - inp.age);
      salaryMe += inp.income * g;
      if (married && a >= inp.family.marryAge) salaryPartner += inp.partnerIncome * g;
    }
    const pensionTotal = pensionYearly * oldYears.length;
    const life = { rent: sum(years, "rentYear"), own: sum(years, "ownYear") };
    const incomeTotal = salaryMe + salaryPartner + pensionTotal;
    const income = {
      salaryMe, salaryPartner, pension: pensionTotal, total: incomeTotal,
      vsAverage: inp.income / AVG_SALARY, average: AVG_SALARY, averageLifetime: AVG_SALARY * Math.max(0, inp.retireAge - inp.workStart),
      housingShare: { rent: incomeTotal ? life.rent / incomeTotal : 0, own: incomeTotal ? life.own / incomeTotal : 0 },
    };

    // ポートフォリオ：今の資産と、65歳時点の資産（預貯金は今のまま、NISAは積立＋運用と仮定）
    const n = Math.max(0, inp.retireAge - inp.age), nr = inp.nisa.rate;
    const nisa65 = inp.nisa.balance * Math.pow(1 + nr, n) + (nr === 0 ? inp.nisa.monthly * 12 * n : (inp.nisa.monthly * 12 * (Math.pow(1 + nr, n) - 1)) / nr);
    const houseNet = Math.max(0, value65.flat - value65.balance);
    const portfolio = {
      now: { savings: inp.savings, nisa: inp.nisa.balance, realEstate: 0, insuranceMonthly: inp.lifeIns.monthly, nisaMonthly: inp.nisa.monthly },
      at65: {
        nisa: nisa65,
        rent: { savings: inp.savings, nisa: nisa65, realEstate: 0, total: inp.savings + nisa65 },
        own: { savings: inp.savings, nisa: nisa65, realEstate: houseNet, total: inp.savings + nisa65 + houseNet },
      },
    };

    // 「今はいい」と思ったら：1・3・5年待った場合（返済は80歳までに終わる期間に縮める）
    let wait = [], waitRateUp = null;
    if (!nested) {
      const b0 = buyAge;
      const at = (k, rateAdd = 0) => {
        const b = b0 + k, yrs = Math.max(10, Math.min(o.years, 80 - b));
        const sub = compute({ ...input, own: { ...o, buyAge: b, years: yrs, rate: o.rate + rateAdd } }, true);
        const waited = years.filter((y) => y.age >= b0 && y.age < b);
        return { years: k, buyAge: b, loanYears: yrs, payoffAge: b + yrs, pmt: sub.loan.pmt,
          rentWhileWaiting: waited.reduce((s2, y) => s2 + y.rentYear, 0), loanYearsAfterRetire: Math.max(0, b + yrs - inp.retireAge),
          lifeOwn: sub.life.own, oldGapOwn: sub.old.own.gapMonthly };
      };
      wait = [0, 1, 3, 5].map((k) => at(k));
      waitRateUp = { ...at(3, 0.005), rateAdd: 0.005 };
    }

    return {
      input: inp,
      years,
      income,
      portfolio,
      wait,
      waitRateUp,
      tax,
      credit: { kind: o.kind, label: kind.label, limit, years: kind.years, special, rows: creditRows, total: creditRows.reduce((s2, r) => s2 + r.actual, 0),
        totalMax: creditRows.reduce((s2, r) => s2 + r.max, 0), first: creditRows.length ? creditRows[0].actual : 0 },
      breakdown,
      insurance,
      acquisition: { cost, costRate: o.costRate },
      loan: { amount: loan, pmt, cashAtBuy, buyAge, endAge: loanEnd },
      pension: { me, partnerYearly: partner.yearly, yearly: pensionYearly, monthly: pensionYearly / 12, living },
      life,
      old: { rent: oldRent, own: oldOwn, years: oldYears.length },
      prepare: { rentNeed: oldRent.need, ownNeed: oldOwn.need, rentExtra: oldRent.need - oldOwn.need,
        monthlyRent: oldRent.need / monthsToRetire, monthlyOwn: oldOwn.need / monthsToRetire, months: monthsToRetire },
      value65,
      whatIf: { pmt, rateUpPmt: payment(loan, o.rate + 0.01, o.years), danshinLoanAfter: 0, danshinRentContinues: married ? R.couple : R.single },
      fair: { rentInvested65: fv, rate: inp.invest.rate, note: `持ち家との差額を毎年積み立てて、年${(inp.invest.rate * 100).toFixed(0)}%で運用できた場合（運用は元本保証なし。続けられるかが前提）` },
    };
  }

  // どのお客様にも同じ順番で説明する6ステップ（話すこと・見せる数字・お客様への質問）
  function talk(x) {
    const i = x.input, o = i.own;
    const stages = [...new Set(x.years.map((y) => y.stageLabel))];
    const r = x.old.rent, w = x.old.own;
    const inc = x.income, pf = x.portfolio, wt = x.wait, wu = x.waitRateUp;
    const zero = { title: "⓪ あなたのお金の全体像", say: "まず、今の資産と、これから一生で入ってくるお金を一緒に見ます。住まいは、その中でいちばん大きな支出です。",
      show: `年収 ${man(i.income)}（一般の平均給与 ${man(inc.average, 1)} の ${Math.round(inc.vsAverage * 100)}%）／これから一生で入ってくるお金 ${man(inc.total)}（給料 ${man(inc.salaryMe + inc.salaryPartner)}・年金 ${man(inc.pension)}）／そのうち住まいに使う割合　賃貸のまま ${Math.round(inc.housingShare.rent * 100)}%・持ち家 ${Math.round(inc.housingShare.own * 100)}%／今の資産　預貯金 ${man(pf.now.savings)}・NISA ${man(pf.now.nisa)}・不動産 なし・保険 毎月 ${man(pf.now.insuranceMonthly, 1)}`,
      ask: "今の預金・NISA・保険・不動産のバランスに、満足していますか。" };
    const seven = wt.length ? { title: "⑦「今はいい」と思ったら", say: "待つこと自体は悪いことではありません。大事なのは、待つ理由と、待つ間に払うお金・遅れる完済年齢を知ったうえで決めることです。",
      show: wt.slice(1).map((r) => `${r.years}年待つと：待つ間の家賃 ${man(r.rentWhileWaiting)}・完済 ${r.payoffAge}歳${r.loanYearsAfterRetire ? `（${i.retireAge}歳を過ぎて${r.loanYearsAfterRetire}年返済）` : ""}・毎月 ${man(r.pmt, 1)}`).join("／") +
        (wu ? `／仮に3年の間に金利が0.5%上がった場合、毎月 ${man(wu.pmt, 1)}（下がる場合もあります）` : ""),
      ask: "待つ理由は何ですか。その理由がなくなるのはいつ頃ですか。" } : null;
    return [zero,
      { title: "① これからの暮らしの段階", say: `家賃は暮らしの段階で変わります。${stages.join(" → ")} と進むと、広い部屋が必要な時期に家賃も上がります。`,
        show: x.input.family.marryAge != null ? `ひとり ${man(i.rent.single, 1)} → 2人 ${man(i.rent.couple, 1)} → 子育て ${man(i.rent.family, 1)} → 老後 ${man(i.rent.old, 1)}（毎月）` : `ひとり ${man(i.rent.single, 1)} → 老後 ${man(i.rent.old, 1)}（毎月）`,
        ask: "結婚・お子さま・働き方は、何歳ごろにどうなっていたいですか。" },
      { title: "② 一生でかかる住まいのお金", say: `今から${i.lifeEnd}歳まで、住まいには一生お金がかかります。賃貸は家賃と保険を払い続け、持ち家は返済が終わったあとは税金・保険・修繕だけになります。持ち家は住宅ローン控除で、払った税金の一部が戻ります。`,
        show: `一生の住居費　賃貸のまま ${man(x.life.rent)}／持ち家 ${man(x.life.own)}（${o.buyAge}歳で${man(o.price)}の家を買った場合）。持ち家のうち 税金（固定資産税・都市計画税）${man(x.breakdown.own.tax.amount)}・保険（火災・地震）${man(x.breakdown.own.ins.amount)}・利息 ${man(x.breakdown.own.interest.amount)}、住宅ローン控除で戻る税金 ${man(x.credit.total)}（${x.credit.label}・${x.credit.years}年）。賃貸の家財保険 ${man(x.breakdown.rent.ins.amount)}`,
        ask: "一生の住まいのお金を、今まで計算したことはありますか。税金や保険まで含めて考えたことはありますか。" },
      { title: `③ ${i.retireAge}歳からの${x.old.years}年`, say: `${i.retireAge}歳からは年金が収入の中心です。賃貸のままだと、年金から家賃を払い続けることになります。持ち家は${x.loan.endAge}歳で返済が終わる計画です。`,
        show: `年金（概算）毎月 ${man(x.pension.monthly, 1)}／毎月の支出　賃貸 ${man(r.outMonthly, 1)}・持ち家 ${man(w.outMonthly, 1)}／毎月の不足　賃貸 ${man(r.gapMonthly, 1)}・持ち家 ${man(w.gapMonthly, 1)}`,
        ask: "老後の住まいは、どこで、どんな家に住んでいたいですか。" },
      { title: "④ 持たないなら、いくら準備が必要か", say: `賃貸のままでも、老後の家賃のぶんを今から準備できれば大丈夫です。そのために必要な金額を見てみましょう。`,
        show: `${i.retireAge}歳までに準備したいお金　賃貸のまま ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)} の積立）／持ち家 ${man(x.prepare.ownNeed)}（毎月 ${man(x.prepare.monthlyOwn, 1)}）`,
        ask: `毎月 ${man(x.prepare.monthlyRent, 1)} を${i.retireAge}歳まで積み立て続けられそうですか。` },
      { title: "⑤ もしものとき", say: `住宅ローンには団体信用生命保険（団信）が付き、万一のときは残りのローンが保険で返済され、家族に住まいが残ります。そのぶん、今の生命保険を見直せる場合があります。賃貸の場合、家族は家賃を払い続けます。高齢になると、年齢を理由に賃貸の入居を断られることもあります。金利が上がると返済が増える点は持ち家の注意点です。`,
        show: `団信：万一のときの残りのローン ${man(x.whatIf.danshinLoanAfter)}（賃貸なら家族は毎月 ${man(x.whatIf.danshinRentContinues, 1)} を払い続ける）／金利が1%上がったら毎月の返済 ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}`,
        ask: "ご家族に、どんな形で住まいを残したいですか。金利が上がったときの備えはありますか。" },
      { title: "⑥ まとめ：持つ・持たない、それぞれの準備", say: `どちらが正解ということはありません。持つなら、無理のない返済と修繕の備え。持たないなら、老後の家賃のための積立。「持たない」を選ぶ場合も、準備が必要だと知ったうえで選ぶことが大切です。`,
        show: `${i.retireAge}歳時点の家の価値（概算）　下落 ${man(x.value65.down)}／横ばい ${man(x.value65.flat)}／上昇 ${man(x.value65.up)}　※将来の価格を約束するものではありません／参考：差額を積み立てて運用した場合 ${man(x.fair.rentInvested65)}（${x.fair.note}）`,
        ask: "どちらの準備なら、ご自身に合っていると思いますか。" },
      ...(seven ? [seven] : []),
    ];
  }

  const NOTES = [
    "金額はすべて概算です。年金は ねんきんネット・ねんきん定期便の見込額で確かめてください。",
    "年金は基礎年金を満額、厚生年金を「年収÷12 × 5.481/1000 × 加入月数」で概算（令和8年度の数字。賞与・昇給・加入期間で変わる）。",
    "老後の生活費（住居費を除く）・将来の家賃・物件価格・修繕費は仮定です。お客様の地域と暮らしに合わせて変えてください。",
    "家の価値は、土地は年−1%／0%／＋1%、建物は30年で1割まで下がると仮定した3つのシナリオです。",
    "高齢期の賃貸は、年齢や保証人を理由に入居を断られる場合がある（一般的な傾向）。",
    "住宅ローン控除は2026〜2027年入居の制度（令和8年度税制改正）で概算。単身は一般の限度額、結婚後（40歳未満）や子育て中に入居すると上乗せ。所得税→住民税（課税所得×5%・最高97,500円）の順に、払った税金の範囲で戻り、控除しきれない額は数えない。税額は給与収入だけの単身として概算〔要確認：源泉徴収票で確認〕。",
    "一般の年収は国税庁「民間給与実態統計調査」令和5年分の平均給与 459.5万円。生涯収入は今の年収が毎年1%上がると仮定（▼で変更）した給料と、年金（概算）の合計。",
    "NISAは今の残高と毎月の積立を年3%で運用できたと仮定（元本保証なし）。預貯金は今のまま。65歳の不動産は家の価値（横ばい）から残りのローンを引いた額。",
    "待った場合の計算は、物件価格・金利が今と同じ前提（上がることも下がることもある）。返済は80歳までに終わる期間に縮める。",
    "諸費用（物件価格の7%と仮定）には、登記費用・不動産取得税・印紙税・ローン手数料・仲介手数料などが含まれる。固定資産税・都市計画税は物件・地域で変わる。",
  ];

  return { AVG_SALARY, FORBIDDEN, PENSION, CREDIT_KINDS, payment, balanceAfter, pension, estimateTax, defaults, compute, talk, NOTES, man, STAGE_LABEL };
});
