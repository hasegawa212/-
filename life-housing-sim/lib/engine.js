// LIFE ROUTE（ライフルート）の計算：賃貸のまま／持ち家 を、今から95歳まで同じ前提で比べる
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
  const manY = (v) => man(v, v % 10_000 ? 1 : 0); // 2万円・5.8万円

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

  // 年金の概算（年額）：基礎年金（満額と仮定）＋厚生年金（月給 × 乗率 × 加入月数）
  // reemploy＝{ age: 定年, rate: 再雇用の年収の割合 }：定年から retireAge までは月給が rate 倍
  function pension(income, workStart, retireAge, reemploy) {
    const mon = (v) => Math.min(PENSION.salaryCap, Math.max(0, v) / 12);
    const re = reemploy ? Math.min(retireAge, Math.max(workStart, reemploy.age)) : retireAge;
    const rRate = reemploy ? reemploy.rate : 1;
    const months1 = Math.max(0, re - workStart) * 12, months2 = Math.max(0, retireAge - re) * 12;
    const kousei = income > 0 ? (mon(income) * months1 + mon(income * rRate) * months2) * PENSION.kouseiRate : 0;
    const yearly = Math.round(PENSION.basicFull + kousei);
    return { yearly, monthly: yearly / 12, basic: PENSION.basicFull, kousei: Math.round(kousei) };
  }

  // 名前（トップページ・提案書・画面で同じ）
  const APP = { name: "LIFE ROUTE", kana: "ライフルート", tagline: "住まいとお金、95歳までの道のり" };

  // 住宅ローンの審査が通る割合の目安（当社で審査を申し込んだ方の実感。年・地域・金融機関・お客様の状況で変わる）
  const PASS_RATE = { of: 10, low: 2, high: 3, note: "当社で審査を申し込んだ方の目安（年・地域・金融機関で変わります）" };

  // CIC（指定信用情報機関）の本人開示。事前審査の前に、お客様自身が信用情報を取り寄せて確かめる（2026年10月時点。手数料・方法は変わることがある）
  const CIC = {
    url: "https://www.cic.co.jp/mydata/index.html",
    methods: [
      { key: "net", name: "インターネット開示", fee: 500, how: "スマホ・パソコンから申し込み、その場でPDFで見られる" },
      { key: "mail", name: "郵送開示", fee: 1500, how: "申込書・本人確認書類・開示利用券（または定額小為替）を郵送、届くまで約10日" },
    ],
    why: "返済の遅れ・他の借入（車・カード・リボ）・最近の申し込みの記録を、事前審査の前に自分で確かめる",
    note: "窓口での開示は終了。手数料・方法は変わることがあるので、申し込む前にCIC公式サイトで確認してください。銀行系の借入は全国銀行個人信用情報センター（KSC）、消費者金融系はJICCにも記録があります。",
  };

  // 会社名の初期値（トップページ・提案書。画面の「会社名」で変えられる）
  const DEFAULT_COMPANY = "合同会社ジャパンマネジメント";

  // 家賃の平均：当社のお客様の家賃の中央値（社内Slack #02_アポ報告 見込み客の集計 2026年9〜10月）。社宅・家賃補助の自己負担は1〜3万円が多い
  const RENT_AVG = { single: 58_000, shatakuSelf: 20_000, source: "当社のお客様（20代後半・単身・賃貸）の家賃の中央値 約5.8万円、社宅・家賃補助の自己負担 1〜3万円（2026年9〜10月の商談・アポ報告の集計）" };

  // 商談報告（#03）の中央値に近いお客様像：27歳・年収390万・貯金140万。家賃は将来の暮らしに合わせた目安（仮定）
  // お客様像のひな形。初期値は「独身」（商談のお客様の大半：独身・結婚願望「無し・あまり無し」71%）
  function preset(name) {
    const p = {
      age: 27, income: 3_900_000, savings: 1_400_000, workStart: 22, retireAge: 65, lifeEnd: 95,
      family: { marryAge: null, kids: 0, firstKidAge: 32 },
      partnerIncome: 0,
      rent: { single: RENT_AVG.single, couple: 75_000, family: 90_000, old: RENT_AVG.single, renewMonths: 1, renewEvery: 2, insYear: 10_000 },
      shataku: { on: false, self: RENT_AVG.shatakuSelf, until: 30 },
      reemploy: { age: 60, rate: 0.6 }, // 60歳で定年→65歳まで再雇用（年収は定年前の6割と仮定） // 社宅：自己負担と、出なければいけない年齢（だいたい30歳）
      own: { buyAge: 30, price: 28_000_000, landShare: 0.35, down: 0, costRate: 0.07, financeCosts: true, rate: 0.012, years: 35,
        propTax: 100_000, ins: 30_000, repairYear: 150_000, repairUpAfter: 20, repairUpRate: 1.5, kind: "used_other" },
      lifeIns: { monthly: 10_000, cutWithDanshin: 0, cover: 10_000_000 }, // 生命保険：毎月の保険料・団信で減らせる分・保障額
      nisa: { monthly: 10_000, balance: 300_000, rate: 0.03 },
      raise: 0.01, // 年収の上がり方（年率・仮定）
      oldLiving: { single: 130_000, couple: 220_000 },
      landRates: { down: -0.01, flat: 0, up: 0.01 },
      invest: { on: false, rate: 0.03 },
    };
    if (name === "family") { p.family = { marryAge: 30, kids: 1, firstKidAge: 32 }; p.rent.old = 70_000; }
    if (name === "shataku") { p.shataku.on = true; p.own.buyAge = p.shataku.until; }
    return p;
  }
  const PRESETS = { single: "独身・賃貸（家賃は平均）", shataku: "独身・社宅（30歳ごろまで）", family: "結婚・子どもあり" };
  function defaults() { return preset("single"); }
  // お客様ごとに必ず選ぶ項目（画面の初期値は空。見本の数字をお客様に見せない）。それ以外は仮定の初期値のまま
  const ASK_FIELDS = ["age", "income", "savings", "nisa.balance", "nisa.monthly", "rent.single", "own.price", "lifeIns.monthly", "lifeIns.cover"];
  function askFields(inp) {
    return inp.shataku && inp.shataku.on ? ASK_FIELDS.flatMap((k) => (k === "rent.single" ? ["shataku.self", "shataku.until"] : [k])) : ASK_FIELDS.slice();
  }
  // blank＝まだ選んでいない項目の集合 → そのうち今選ぶべきもの
  function missing(inp, blank) { return askFields(inp).filter((k) => blank.has(k)); }

  function stage(inp, age) {
    const f = inp.family || {};
    if (age >= inp.retireAge) return "old";
    if (f.kids > 0 && f.firstKidAge != null && age >= f.firstKidAge && age < f.firstKidAge + 22) return "family";
    if (f.marryAge != null && age >= f.marryAge) return "couple";
    return "single";
  }
  const STAGE_LABEL = { single: "ひとり暮らし", couple: "2人暮らし", family: "子育て", old: "老後", shataku: "社宅" };

  function compute(input, nested) {
    const d = defaults();
    const inp = { ...d, ...input, family: { ...d.family, ...(input.family || {}) }, rent: { ...d.rent, ...(input.rent || {}) },
      own: { ...d.own, ...(input.own || {}) }, oldLiving: { ...d.oldLiving, ...(input.oldLiving || {}) },
      landRates: { ...d.landRates, ...(input.landRates || {}) }, invest: { ...d.invest, ...(input.invest || {}) },
      lifeIns: { ...d.lifeIns, ...(input.lifeIns || {}) }, nisa: { ...d.nisa, ...(input.nisa || {}) }, shataku: { ...d.shataku, ...(input.shataku || {}) }, reemploy: { ...d.reemploy, ...(input.reemploy || {}) } };
    const reAge = Math.min(inp.retireAge, inp.reemploy.age), reRate = inp.reemploy.rate;
    const sh = inp.shataku;
    const inShataku = (age) => sh.on && age < sh.until && age < inp.retireAge;
    const o = inp.own, R = inp.rent;
    // 暮らしの段階ごとの家賃。2人暮らしが「なし」（0）なら、結婚後もひとり暮らしの家賃のまま
    // 「なし」（0）：2人暮らし→ひとり暮らしと同じ、子育て期→2人暮らし（それもなしならひとり）と同じ。ひとり・老後の「なし」は家賃0（実家など）
    const rentAt = (st) => (st === "couple" ? R.couple || R.single : st === "family" ? R.family || R.couple || R.single : R[st]);
    const married = inp.family.marryAge != null;
    const cost = o.price * o.costRate;
    const loan = o.price - o.down + (o.financeCosts ? cost : 0);
    const cashAtBuy = o.down + (o.financeCosts ? 0 : cost);
    const pmt = payment(loan, o.rate, o.years);
    const buyAge = Math.max(inp.age, o.buyAge);
    const loanEnd = buyAge + o.years;

    const me = pension(inp.income, inp.workStart, inp.retireAge, inp.reemploy);
    const partner = married ? (inp.partnerIncome > 0 ? pension(inp.partnerIncome, inp.workStart, inp.retireAge, inp.reemploy) : { yearly: PENSION.basicFull }) : { yearly: 0 };
    const pensionYearly = me.yearly + partner.yearly;
    const living = married ? inp.oldLiving.couple : inp.oldLiving.single;

    // 住宅ローン控除：年末残高（住宅の取得分だけ）× 0.7%（限度額・物件価格まで）。所得税→住民税（課税所得×5%・最高97,500円）の順に、払った税金の範囲で戻る
    const kind = CREDIT_KINDS[o.kind] || CREDIT_KINDS.none;
    const f = inp.family;
    const marriedAtBuy = f.marryAge != null && f.marryAge <= buyAge;
    const kidAtBuy = f.kids > 0 && f.firstKidAge != null && f.firstKidAge <= buyAge && buyAge - f.firstKidAge < 19; // 19歳未満の子がいる
    // 上乗せの対象世帯で、かつ限度額が上がる住宅のときだけ「上乗せ」として扱う
    const special = ((marriedAtBuy && buyAge < 40) || kidAtBuy) && kind.limit[1] > kind.limit[0];
    const limit = kind.limit[special ? 1 : 0];
    const tax = estimateTax(inp.income);
    const resCap = Math.min(RES_CAP_MAX, Math.floor(tax.taxable * RES_CAP_RATE), tax.residentTax);
    const share = loan > 0 ? Math.min(1, Math.max(0, o.price - o.down) / loan) : 0;
    const creditRows = [];
    for (let i = 1; i <= kind.years && buyAge + i - 1 < inp.lifeEnd; i++) {
      const balance = balanceAfter(loan, o.rate, o.years, 12 * i) * share;
      const max = Math.floor((Math.min(balance, limit, o.price) * CREDIT_RATE) / 100) * 100;
      const fromIT = Math.min(max, tax.incomeTax);
      const fromRT = Math.min(max - fromIT, resCap);
      creditRows.push({ i, age: buyAge + i - 1, balance, max, fromIT, fromRT, actual: fromIT + fromRT });
    }
    // その年齢になった時点で、返した回数・残りの回数・残高（ローンは月で数える：35年＝420回）
    const loanAt = (age) => {
      const paidN = Math.min(o.years * 12, Math.max(0, age - buyAge) * 12);
      return { age, paid: paidN, left: o.years * 12 - paidN, balance: balanceAfter(loan, o.rate, o.years, paidN) };
    };
    const creditAt = (age) => (creditRows.find((r) => r.age === age) || { actual: 0 }).actual;

    const years = [];
    for (let age = inp.age; age < inp.lifeEnd; age++) {
      const st = inShataku(age) ? "shataku" : stage(inp, age);
      const rentMonthly = st === "shataku" ? sh.self : rentAt(st);
      const rentPart = rentMonthly * 12, renewPart = st === "shataku" ? 0 : (rentMonthly * R.renewMonths) / R.renewEvery, rentIns = R.insYear;
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
    const paidMonths = 12 * Math.max(0, Math.min(loanEnd, inp.lifeEnd) - buyAge);
    const principal = paid > 0 ? loan - balanceAfter(loan, o.rate, o.years, paidMonths) : 0;
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
    const ownedYears = Math.max(0, Math.min(inp.retireAge, loanEnd) - buyAge); // 団信が付いている（返している）年数
    const insurance = {
      rentHome: breakdown.rent.ins.amount, ownHome: breakdown.own.ins.amount,
      rentLife: inp.lifeIns.monthly * 12 * lifeYears,
      ownLife: inp.lifeIns.monthly * 12 * lifeYears - Math.min(inp.lifeIns.cutWithDanshin, inp.lifeIns.monthly) * 12 * ownedYears,
      lifeMonthly: inp.lifeIns.monthly, cut: inp.lifeIns.cutWithDanshin,
    };

    // 生涯収入（これからの給料＋年金）と、そのうち住まいに使う割合
    let salaryMe = 0, salaryPartner = 0, salaryReemploy = 0;
    for (let a = inp.age; a < inp.retireAge; a++) {
      // 定年までは毎年 raise で上がり、再雇用の間は定年前の年収 × rate（上がらない）
      const g = Math.pow(1 + inp.raise, Math.min(a, reAge) - inp.age) * (a >= reAge ? reRate : 1);
      salaryMe += inp.income * g;
      if (a >= reAge) salaryReemploy += inp.income * g;
      if (married && a >= inp.family.marryAge) salaryPartner += inp.partnerIncome * g;
    }
    const pensionTotal = pensionYearly * oldYears.length;
    const life = { rent: sum(years, "rentYear"), own: sum(years, "ownYear") };
    const incomeTotal = salaryMe + salaryPartner + pensionTotal;
    const income = {
      salaryMe, salaryPartner, salaryReemploy, reemploy: { age: reAge, rate: reRate }, pension: pensionTotal, total: incomeTotal,
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
        // 審査の目安：返済比率（毎月の返済×12÷買うときの年収）。年収400万円未満30%・以上35%（フラット35の基準）
        const incB = inp.income * Math.pow(1 + inp.raise, b - inp.age);
        const ratio = incB > 0 ? (sub.loan.pmt * 12) / incB : 0, lim = incB < 4_000_000 ? 0.3 : 0.35;
        const screen = { income: incB, ratio, limit: lim, ok: ratio <= lim, shorter: yrs < o.years };
        return { years: k, buyAge: b, loanYears: yrs, payoffAge: b + yrs, pmt: sub.loan.pmt, screen,
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
      renew: (() => {
        const n = years.filter((y) => y.renewPart > 0).length;
        return { total: tot("renewPart"), old: oldYears.reduce((s2, y) => s2 + y.renewPart, 0), every: R.renewEvery, months: R.renewMonths,
          times: R.renewEvery > 0 ? Math.round(n / R.renewEvery) : 0, perTimeNow: (inShataku(inp.age) ? 0 : rentAt(stage(inp, inp.age))) * R.renewMonths };
      })(),
      // 審査：老後の賃貸の入居審査は、収入が年金だけになる。家賃が収入の3分の1以下が一般的な目安
      screening: { rent: { ageFrom: inp.retireAge, ratioOld: pensionYearly > 0 ? (R.old * 12) / pensionYearly : Infinity, guide: 1 / 3,
        hard: pensionYearly > 0 ? (R.old * 12) / pensionYearly > 1 / 3 : true } },
      shataku: sh.on ? { self: sh.self, until: sh.until, after: rentAt(stage(inp, Math.max(inp.age, sh.until))), jump: rentAt(stage(inp, Math.max(inp.age, sh.until))) - sh.self } : null,
      credit: { kind: o.kind, label: kind.label, limit, years: kind.years, special, rows: creditRows, total: creditRows.reduce((s2, r) => s2 + r.actual, 0),
        totalMax: creditRows.reduce((s2, r) => s2 + r.max, 0), first: creditRows.length ? creditRows[0].actual : 0 },
      breakdown,
      insurance,
      acquisition: { cost, costRate: o.costRate },
      loan: { amount: loan, pmt, cashAtBuy, buyAge, endAge: loanEnd, months: o.years * 12,
        atReemploy: loanAt(reAge), atRetire: loanAt(inp.retireAge),
        ratioNow: inp.income > 0 ? (pmt * 12) / inp.income : 0, ratioReemploy: inp.income * reRate > 0 ? (pmt * 12) / (inp.income * reRate) : pmt > 0 ? null : 0 }, // null＝再雇用の収入なし
      pension: { me, partnerYearly: partner.yearly, yearly: pensionYearly, monthly: pensionYearly / 12, living },
      life,
      old: { rent: oldRent, own: oldOwn, years: oldYears.length },
      prepare: { rentNeed: oldRent.need, ownNeed: oldOwn.need, rentExtra: oldRent.need - oldOwn.need,
        monthlyRent: oldRent.need / monthsToRetire, monthlyOwn: oldOwn.need / monthsToRetire, months: monthsToRetire },
      value65,
      whatIf: { pmt, rateUpPmt: payment(loan, o.rate + 0.01, o.years), danshinLoanAfter: 0, danshinRentContinues: married ? rentAt("couple") : R.single },
      fair: { rentInvested65: fv, rate: inp.invest.rate, note: `持ち家との差額を毎年積み立てて、年${(inp.invest.rate * 100).toFixed(0)}%で運用できた場合（運用は元本保証なし。続けられるかが前提）` },
    };
  }

  // 定年・再雇用とローンの回数（説明と提案書で同じ文を使う）
  function workLoanLine(x) {
    const i = x.input, L = x.loan, re = x.income.reemploy, r = L.atReemploy;
    const work = re.age < i.retireAge ? (re.rate > 0 ? `${re.age}歳で定年、${i.retireAge}歳まで再雇用（年収は定年前の${Math.round(re.rate * 100)}%＝今の年収なら ${man(i.income * re.rate)}と仮定）` : `${re.age}歳で定年、そのあとは働かない（再雇用なし）`) : `${i.retireAge}歳まで今の働き方`;
    const loan = `ローンは${i.own.years}年＝${L.months}回払い（毎月 ${man(L.pmt, 1)}）`;
    const at = re.age < i.retireAge && r.left > 0 ? `。${re.age}歳の時点で${r.paid}回払って残り${r.left}回（残高 ${man(r.balance)}）${L.ratioReemploy == null ? "、定年のあとは収入がないので、定年までの繰上げ返済や退職金で残りを返す計画が必要です" : `、再雇用の間の返済は年収の${Math.round(L.ratioReemploy * 100)}%`}${L.ratioReemploy > 0.35 ? "（重いので、定年までの繰上げ返済や退職金で残りを減らす計画も一緒に考えます）" : ""}` : r.left === 0 ? `。${re.age}歳までに完済` : "";
    const end = L.atRetire.left > 0 ? `。${i.retireAge}歳でまだ残り${L.atRetire.left}回（残高 ${man(L.atRetire.balance)}）` : `。${L.endAge}歳で完済`;
    return work + "／" + loan + at + end;
  }

  // 賃貸と購入、どちらがいいか：お客様の数字で比べて、購入が合うならすすめる（合わなければ無理にすすめない）
  // 理由はすべて compute の数字。注意点（金利・修繕・値下がり・差額の運用・決めるのは金融機関）も必ず一緒に返す
  function recommend(x) {
    const i = x.input, g = gate(x), v = x.value65;
    const reasons = [
      { key: "life", label: `一生の住居費（${i.lifeEnd}歳まで・実質）`, rent: x.life.rent, own: x.life.own - v.flat,
        text: `賃貸のまま ${man(x.life.rent)}／持ち家 ${man(x.life.own)}。持ち家は${i.retireAge}歳に家が残り（横ばいで ${man(v.flat)}）、差し引くと実質 ${man(x.life.own - v.flat)}` },
      { key: "old", label: `${i.retireAge}歳からの毎月の不足`, rent: x.old.rent.gapMonthly, own: x.old.own.gapMonthly,
        text: `賃貸のまま 毎月 ${man(x.old.rent.gapMonthly, 1)}／持ち家 毎月 ${man(x.old.own.gapMonthly, 1)}。持ち家は返済が終われば家賃がかからない` },
      { key: "prepare", label: `${i.retireAge}歳までに準備したいお金`, rent: x.prepare.rentNeed, own: x.prepare.ownNeed,
        text: `賃貸のまま ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)}）／持ち家 ${man(x.prepare.ownNeed)}（毎月 ${man(x.prepare.monthlyOwn, 1)}）` },
      { key: "asset", label: `${i.retireAge}歳の資産（概算）`, rent: x.portfolio.at65.rent.total, own: x.portfolio.at65.own.total,
        text: `賃貸のまま ${man(x.portfolio.at65.rent.total)}／持ち家 ${man(x.portfolio.at65.own.total)}（うち家 ${man(x.portfolio.at65.own.realEstate)}）` },
    ].map((r) => ({ ...r, favorOwn: r.key === "asset" ? r.own > r.rent : r.own < r.rent }));
    const favor = reasons.filter((r) => r.favorOwn).length;
    const verdict = favor >= 3 ? (g.allOk ? "buy" : "buyAfterCheck") : "prepare";
    const top = reasons.filter((r) => r.favorOwn);
    const headline = verdict === "buy" ? "数字で比べると、あなたには購入をおすすめします。まず事前審査で、この計画が通るか確かめましょう"
      : verdict === "buyAfterCheck" ? "数字で比べると、購入が合っています。目安に△がある項目（借入額・頭金・返済期間）を見直し、事前審査で確かめてから進めましょう"
      : "今の条件では、購入より、賃貸のまま準備を進めるほうが合っています。条件（買う年齢・物件価格・頭金）が変われば、もう一度比べましょう";
    const cautions = [
      `金利が1%上がると、毎月の返済は ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}`,
      `持ち家は、固定資産税・火災保険・修繕の備えが必要（一生で 税金 ${man(x.breakdown.own.tax.amount)}・修繕 ${man(x.breakdown.own.repair.amount)}）`,
      `家の値段は下がることもあります（${i.retireAge}歳の家の価値：下落 ${man(v.down)}〜上昇 ${man(v.up)}。将来の価格を約束するものではありません）`,
      `賃貸のまま、差額を毎月年${(x.fair.rate * 100).toFixed(0)}%で運用し続けられた場合は ${man(x.fair.rentInvested65)}（元本保証なし。途中でやめたりマイナスの年もあります）`,
      "住宅ローンを決めるのは融資する金融機関です（事前審査は無料・購入の義務はありません）",
    ];
    return { verdict, favor, reasons, top, headline, cautions, gate: g };
  }

  // いちばん大きな固定費＝住まい。今の家賃・手取り（概算：社会保険料15%と所得税・住民税を引く）・割合・払い続けた場合の合計
  const rentTxt = (v) => (v ? man(v, 1) : "なし");
  // ¥ の絵：独身（社宅も）は「一人で暮らす。戸建てという選択。」、結婚・子どもありは「賃貸の仕組み」
  function rentImage(x) {
    const single = x.input.family.marryAge == null;
    return single
      ? { src: "img/rent-mechanism-single.jpg", single, alt: "一人で暮らす。戸建てという選択。賃貸の戸建てにはオーナーがいて、家賃はオーナーのローンの返済、管理・修繕・税金にあてられ、残りが収益になる。自分が戸建てを持つと、暮らしに合わせて使い、返済で借入残高を減らし、将来の売却・賃貸も選択肢になる" }
      : { src: "img/rent-mechanism.jpg", single, alt: "賃貸の仕組み：入居者は毎月の家賃を払い、オーナーは住まいを提供する。家賃はオーナーのローンの返済、管理・修繕・税金にあてられ、残りがオーナーの収益になる" };
  }
  function fixedCost(x) {
    const i = x.input, now = x.years[0], t = estimateTax(i.income);
    const takeHome = (i.income - i.income * 0.15 - t.incomeTax - t.residentTax) / 12;
    const rentOnly = (y) => y.rentPart + y.renewPart;
    const to65 = x.years.filter((y) => y.age < i.retireAge).reduce((s, y) => s + rentOnly(y), 0);
    const toEnd = x.years.reduce((s, y) => s + rentOnly(y), 0);
    return { rent: now.rentMonthly, yearly: now.rentMonthly * 12, takeHome, share: takeHome > 0 ? now.rentMonthly / takeHome : 0, to65, toEnd };
  }

  // 親御さまの頃（バブル期）の住宅ローン金利：都市銀行の変動金利 最高8.5%（1990〜91年）、住宅金融公庫 約5.5%（1990年）
  const BUBBLE = { bankRate: 0.085, publicRate: 0.055, source: "1990〜91年の住宅ローン金利（都市銀行の変動金利の最高 8.5%、住宅金融公庫 約5.5%）。金融機関・解説記事の金利推移より" };
  function bubble(x) {
    const L = x.loan, y = x.input.own.years;
    const bank = payment(L.amount, BUBBLE.bankRate, y), pub = payment(L.amount, BUBBLE.publicRate, y);
    return { bank, public: pub, now: L.pmt, times: L.pmt > 0 ? bank / L.pmt : 0 };
  }

  // 団信の上乗せ金利の目安（2026年10月時点、金融機関・商品で違う）。一般団信は多くの金融機関で金利に含まれ、別払いなし
  const DANSHIN_OPTIONS = [
    { key: "cancer", label: "がん団信", add: 0.001 },
    { key: "sandai", label: "3大疾病付き団信", add: 0.002 },
    { key: "wide", label: "ワイド団信（持病がある方向け）", add: 0.003 },
  ];
  // 団体信用生命保険（団信）と生命保険を並べて比べる
  function danshin(x) {
    const i = x.input, o = i.own, L = x.loan, single = i.family.marryAge == null;
    const cover = [];
    for (let a = L.buyAge; a <= L.endAge; a++) cover.push({ age: a, amount: balanceAfter(L.amount, o.rate, o.years, (a - L.buyAge) * 12) });
    const options = DANSHIN_OPTIONS.map((d) => {
      const extraMonthly = payment(L.amount, o.rate + d.add, o.years) - L.pmt;
      return { ...d, extraMonthly, extraTotal: extraMonthly * L.months };
    });
    const life = { monthly: i.lifeIns.monthly, total: x.insurance.rentLife, cover: i.lifeIns.cover };
    const review = { monthly: x.insurance.cut, total: x.insurance.rentLife - x.insurance.ownLife };
    const rows = [
      { key: "target", label: "何を守るか", danshin: "住宅ローンの残り（万一のとき、残りのローンがなくなる）", life: "家族の生活費など（契約した保障額が支払われる）" },
      { key: "amount", label: "保障額", danshin: `${man(L.amount)} → 返すほど減り ${L.endAge}歳で0`, life: `${man(life.cover)}（一定）` },
      { key: "premium", label: "保険料", danshin: "金利に含まれ別払いなし（一般団信）", life: `毎月 ${man(life.monthly, 1)}` },
      { key: "total", label: `${i.retireAge}歳までに払う額`, danshin: "別払い 0円", life: man(life.total) },
      { key: "period", label: "期間", danshin: `返している間だけ（${L.buyAge}〜${L.endAge}歳）`, life: "契約した期間" },
      { key: "deduction", label: "生命保険料控除", danshin: "対象外", life: "あり" },
      { key: "health", label: "健康状態", danshin: "加入に審査あり。入れないとローンが組めない場合も（ワイド団信は金利が上乗せ）", life: "加入に審査あり" },
    ];
    return {
      cover, general: { extraMonthly: 0, note: "一般団信（死亡・高度障害）の保険料は、多くの金融機関で住宅ローンの金利に含まれ、別払いはありません" },
      options, optionsNote: "上乗せ金利は年0.1〜0.3%が目安。金融機関・商品で違うので、申し込む前に確認してください",
      life, review, rows,
      message: single ? "万一のとき、残りのローンは保険で返され、親や兄弟にローンが残りません" : "万一のとき、残りのローンは保険で返され、家族に住まいが残ります",
    };
  }
  function danshinLine(x) {
    const d = danshin(x), L = x.loan, c = d.options[0];
    return `団信と生命保険：団信は住宅ローンの残り（${man(L.amount)}→${L.endAge}歳で0）を守り、一般団信の保険料は金利に含まれ別払いなし。生命保険は毎月 ${man(d.life.monthly, 1)}（${x.input.retireAge}歳まで ${man(d.life.total)}、保障額 ${man(d.life.cover)}）。${c.label}にすると毎月 +${man(c.extraMonthly, 1)}（金利+${(c.add * 100).toFixed(1)}%の目安）${d.review.total > 0 ? `。返している間は生命保険を毎月 ${man(d.review.monthly, 1)} 減らすと ${man(d.review.total)} の見直し` : ""}`;
  }

  // 老後の賃貸の入居審査（一般的な目安。断定しない）
  function rentScreenLine(x) {
    const s = x.screening.rent, i = x.input;
    if (!i.rent.old) return `賃貸の入居審査：老後の家賃は「なし」（家賃のかからない住まい）の計画なので、入居審査の心配はありません`;
    return `賃貸の入居審査：${s.ageFrom}歳からは収入が年金（毎月 ${man(x.pension.monthly, 1)}）だけになり、家賃 ${rentTxt(i.rent.old)} は年金の${Math.round(s.ratioOld * 100)}%。家賃は収入の3分の1以内が一般的な審査の目安なので、${s.hard ? "高齢・保証人とあわせて通りにくくなる場合があります" : "目安の範囲ですが、年齢や保証人で断られる場合があります"}`;
  }

  // 区切り：「やるか・やらないか」の前に、まず「できるか」を確かめる。決めるのは融資する金融機関
  function gate(x) {
    const i = x.input, L = x.loan, lim = i.income < 4_000_000 ? 0.3 : 0.35, mult = i.income > 0 ? L.amount / i.income : Infinity;
    const pct = (v) => Math.round(v * 100) + "%";
    const checks = [
      { key: "ratio", label: "返済比率（毎月の返済×12÷年収）", value: `${pct(L.ratioNow)}（目安 ${pct(lim)}以内）`, ok: L.ratioNow <= lim },
      { key: "multiple", label: "借りる額は年収の何倍か", value: `${mult.toFixed(1)}倍（目安 7倍以内）`, ok: mult <= 7 },
      { key: "payoff", label: "完済の年齢", value: `${L.endAge}歳（目安 80歳まで）`, ok: L.endAge <= 80 },
      { key: "reemploy", label: "定年後（再雇用）の返済", value: L.atReemploy.left > 0 ? (L.ratioReemploy == null ? "収入なし（定年までに完済するか、退職金で返す計画が必要）" : `年収の${pct(L.ratioReemploy)}（目安 35%以内）`) : "定年までに完済", ok: L.atReemploy.left === 0 || (L.ratioReemploy != null && L.ratioReemploy <= 0.35) },
    ];
    const allOk = checks.every((c) => c.ok);
    return {
      passRate: PASS_RATE, checks, allOk,
      verdict: allOk ? "数字の目安の上では、土台に乗る可能性があります。ただし、実際は融資する金融機関が決めます。"
        : "目安を超える項目があります。借りる額・頭金・返済期間を見直してから確かめましょう。実際は融資する金融機関が決めます。",
      lookAt: ["勤続年数・雇用形態（正社員・派遣など）", "他の借入（車のローン・カード・リボ・奨学金）", "返済の遅れがないか（信用情報）", "健康状態（団信に入れるか）", "物件の担保評価"],
      steps: [
        `⓪ まず自分で：CICで信用情報を取り寄せる（本人開示：ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円）。${CIC.why}`,
        "① できるか：住宅ローンの事前審査（無料・購入の義務はありません）で、金融機関に借りられる額を確かめる",
        "② その土台に乗ったら：通った金額の範囲で、やるか・やらないかを決める",
        "通らなかったら：理由になりそうな点（他の借入・勤続・頭金）を整えて時期を改める／賃貸のまま準備する",
      ],
    };
  }

  // どのお客様にも同じ順番で説明する6ステップ（話すこと・見せる数字・お客様への質問）
  function talk(x) {
    const i = x.input, o = i.own;
    const stages = [...new Set(x.years.map((y) => y.stageLabel))];
    const single = i.family.marryAge == null;
    const sh = x.shataku;
    const r = x.old.rent, w = x.old.own;
    const inc = x.income, pf = x.portfolio, wt = x.wait, wu = x.waitRateUp;
    const zero = { title: "⓪ あなたのお金の全体像", say: "まず、今の資産と、これから一生で入ってくるお金を一緒に見ます。住まいは、その中でいちばん大きな支出です。",
      show: `年収 ${man(i.income)}（一般の平均給与 ${man(inc.average, 1)} の ${Math.round(inc.vsAverage * 100)}%）／これから一生で入ってくるお金 ${man(inc.total)}（給料 ${man(inc.salaryMe + inc.salaryPartner)}・年金 ${man(inc.pension)}）／そのうち住まいに使う割合　賃貸のまま ${Math.round(inc.housingShare.rent * 100)}%・持ち家 ${Math.round(inc.housingShare.own * 100)}%／今の資産　預貯金 ${man(pf.now.savings)}・NISA ${man(pf.now.nisa)}・不動産 なし・保険 毎月 ${man(pf.now.insuranceMonthly, 1)}`,
      ask: "今の預金・NISA・保険・不動産のバランスに、満足していますか。" };
    const g = gate(x), bb = bubble(x), fc = fixedCost(x), rc = recommend(x);
    const intro = { title: "¥ 節約するなら、いちばん大きな固定費から",
      say: `日本は「節約しなさい」と言われて育つ国です。では、何を節約すると一番効くでしょうか。答えは、毎月いちばん大きな固定費＝住まい（家賃）です。家賃は住まいの対価で、同時にオーナーのローンの返済や将来の備えにもつながっています。同じ住まいのお金を、家賃として払い続けるか、自分の資産に変えていくか。一緒に数字で見ていきましょう。`,
      show: (fc.rent ? `今の家賃 毎月 ${man(fc.rent, 1)}（手取りの約${Math.round(fc.share * 100)}%・手取りは概算 毎月 ${man(fc.takeHome, 1)}）／1年で ${man(fc.yearly)}／` : `今の家賃 なし（実家など）。家賃がかからない今は、貯金と住まいの準備ができる時期です／`) + `${fc.to65 ? `${i.retireAge}歳まで払い続けると ${man(fc.to65)}、${i.lifeEnd}歳までで ${man(fc.toEnd)}` : `${i.lifeEnd}歳までに払う家賃 ${man(fc.toEnd)}`}（更新料こみ・家財保険は含まない）／家賃の行き先：オーナーのローンの返済・管理や修繕・固定資産税など → 残りがオーナーの収益（空室や修繕で赤字になる場合もあります）`,
      ask: "毎月の固定費で、いちばん大きいものは何ですか。その家賃は、誰の将来の備えになっていると思いますか。" };
    const six = { title: "⑥ まず「できるか」を確かめる（区切り）",
      say: `ここで一度、区切りをつけます。住宅ローンは、借りたい人や私たちが決めるのではなく、融資する金融機関が決めます。当社で審査を申し込んだ方のうち、通るのは${PASS_RATE.of}人中${PASS_RATE.low}〜${PASS_RATE.high}人ほどです（目安）。ですから、やるか・やらないかを決める前に、まず「できるか」をこちらで確認させてください。その土台に乗ったら、やるか・やらないかを決めていただければ大丈夫です。できるかわからないまま決めても意味がないので、お客様のお時間を無駄にしないための順番です。`,
      show: g.checks.map((c) => `${c.ok ? "○" : "△"} ${c.label} ${c.value}`).join("／") + `／${g.verdict}／金融機関が見ること：${g.lookAt.join("・")}／${g.steps[0]}`,
      ask: "まずCICで信用情報を取り寄せ、できるかを確かめませんか（事前審査は無料・購入の義務はありません）。" };
    const seven = wt.length ? { title: "⑧「今はいい」と思ったら", say: "待つこと自体は悪いことではありません。大事なのは、待つ理由と、待つ間に払うお金・遅れる完済年齢を知ったうえで決めることです。",
      show: wt.slice(1).map((r) => `${r.years}年待つと：待つ間の家賃 ${man(r.rentWhileWaiting)}・完済 ${r.payoffAge}歳${r.loanYearsAfterRetire ? `（${i.retireAge}歳を過ぎて${r.loanYearsAfterRetire}年返済）` : ""}・毎月 ${man(r.pmt, 1)}・住宅ローンの審査の返済比率 ${Math.round(r.screen.ratio * 100)}%（目安 ${Math.round(r.screen.limit * 100)}%以内${r.screen.ok ? "" : "を超える"}${r.screen.shorter ? "・返済期間が短くなる" : ""}）`).join("／") +
        "。年齢が上がるほど返済期間が短くなり、健康状態によっては団信に入れず、審査が通りにくくなる場合があります" +
        (wu ? `／仮に3年の間に金利が0.5%上がった場合、毎月 ${man(wu.pmt, 1)}（下がる場合もあります）` : "") +
        `／親御さまの頃（1990年前後）とは条件が違います：同じ ${man(x.loan.amount)}・${i.own.years}年でも、当時の金利 8.5%なら毎月 ${man(bb.bank, 1)}、公庫 5.5%でも ${man(bb.public, 1)}。今の計画（${(i.own.rate * 100).toFixed(1)}%）は ${man(bb.now, 1)}。当時は値上がりを見込んだ買い方が多かったが、今回は値上がりをあてにせず、住むために払える範囲で考えます（値下がりもありうるので⑦の下落シナリオも一緒に）`,
      ask: "待つ理由は何ですか。その理由がなくなるのはいつ頃ですか。" } : null;
    return [intro, zero,
      { title: "① これからの暮らしの段階", say: sh
          ? `今は社宅で家賃が抑えられていますが、社宅はだいたい${sh.until}歳ごろまでです。出たあとは、ふつうの家賃を${i.lifeEnd}歳まで払うことになります。社宅の間は、貯金と住まいの準備ができる時期です。`
          : single
          ? `ひとりで暮らしていく場合も、家賃は一生続きます。今の働き方のまま${i.retireAge}歳を迎え、そのあとも${i.lifeEnd}歳まで住まいは必要です。持ち家なら、結婚しても住み続ける・貸す・売るを選べます。`
          : `家賃は暮らしの段階で変わります。${stages.join(" → ")} と進むと、広い部屋が必要な時期に家賃も上がります。`,
        show: (sh ? `社宅 ${manY(sh.self)}（${sh.until}歳まで）→ 社宅を出たあと ${manY(sh.after)}（毎月 ${manY(sh.jump)}・年 ${manY(sh.jump * 12)} 増える。家賃は当社のお客様の平均）／` : "") +
          (x.input.family.marryAge != null ? `ひとり ${rentTxt(i.rent.single)} → 2人 ${i.rent.couple ? man(i.rent.couple, 1) : "（ひとりと同じ）"} → 子育て ${i.rent.family ? man(i.rent.family, 1) : "（2人と同じ）"} → 老後 ${rentTxt(i.rent.old)}（毎月）` : `ひとり ${rentTxt(i.rent.single)}${i.rent.single === RENT_AVG.single ? "（当社のお客様の家賃の平均）" : ""} → 老後 ${rentTxt(i.rent.old)}（毎月）`),
        ask: sh ? `社宅を出るのは何歳ごろの予定ですか。出たあと、どこに住みたいですか。` : single ? "これからも、ひとりで自由に暮らしていきたいですか。結婚したら、住まいはどうしたいですか。" : "結婚・お子さま・働き方は、何歳ごろにどうなっていたいですか。" },
      { title: "② 一生でかかる住まいのお金", say: `今から${i.lifeEnd}歳まで、住まいには一生お金がかかります。賃貸は家賃と保険を払い続け、持ち家は返済が終わったあとは税金・保険・修繕だけになります。持ち家は住宅ローン控除で、払った税金の一部が戻ります。`,
        show: `一生の住居費　賃貸のまま ${man(x.life.rent)}／持ち家 ${man(x.life.own)}（${o.buyAge}歳で${man(o.price)}の家を買った場合）。持ち家のうち 税金（固定資産税・都市計画税）${man(x.breakdown.own.tax.amount)}・保険（火災・地震）${man(x.breakdown.own.ins.amount)}・利息 ${man(x.breakdown.own.interest.amount)}、住宅ローン控除で戻る税金 ${man(x.credit.total)}（${x.credit.label}・${x.credit.years}年）。賃貸の家財保険 ${man(x.breakdown.rent.ins.amount)}・更新料 ${man(x.renew.total)}（${x.renew.every}年ごとに家賃${x.renew.months}か月分、${i.lifeEnd}歳までに${x.renew.times}回。うち${i.retireAge}歳から ${man(x.renew.old)}）`,
        ask: "一生の住まいのお金を、今まで計算したことはありますか。税金や保険まで含めて考えたことはありますか。" },
      { title: `③ ${i.retireAge}歳からの${x.old.years}年`, say: single
          ? `${i.retireAge}歳からは、ひとり分の年金が収入の中心です。賃貸のままだと、その年金から家賃を払い続けることになります。持ち家は${x.loan.endAge}歳で返済が終わる計画です。`
          : `${i.retireAge}歳からは年金が収入の中心です。賃貸のままだと、年金から家賃を払い続けることになります。持ち家は${x.loan.endAge}歳で返済が終わる計画です。`,
        show: `${workLoanLine(x)}／年金（概算）毎月 ${man(x.pension.monthly, 1)}／毎月の支出　賃貸 ${man(r.outMonthly, 1)}・持ち家 ${man(w.outMonthly, 1)}／毎月の不足　賃貸 ${man(r.gapMonthly, 1)}・持ち家 ${man(w.gapMonthly, 1)}`,
        ask: "老後の住まいは、どこで、どんな家に住んでいたいですか。" },
      { title: "④ 持たないなら、いくら準備が必要か", say: `賃貸のままでも、老後の家賃のぶんを今から準備できれば大丈夫です。そのために必要な金額を見てみましょう。`,
        show: `${i.retireAge}歳までに準備したいお金　賃貸のまま ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)} の積立）／持ち家 ${man(x.prepare.ownNeed)}（毎月 ${man(x.prepare.monthlyOwn, 1)}）`,
        ask: `毎月 ${man(x.prepare.monthlyRent, 1)} を${i.retireAge}歳まで積み立て続けられそうですか。` },
      single ? { title: "⑤ もしものとき", say: `ひとりで暮らす場合、いちばんの心配は「年を取ってからの住まい」です。高齢のひとり暮らしは、年齢や保証人を理由に賃貸の入居を断られることがあります。持ち家なら、返済が終わったあとは住む場所が確保できます。住宅ローンには団体信用生命保険（団信）が付くので、万一のときもローンが親や兄弟に残りません。金利が上がると返済が増える点は持ち家の注意点です。`,
        show: `${rentScreenLine(x)}／${danshinLine(x)}／老後ひとりで払う家賃 ${i.rent.old ? `毎月 ${man(i.rent.old, 1)}（${x.old.years}年で ${man(x.old.rent.rentTotal)}）` : "なし"}／団信：万一のときの残りのローン ${man(x.whatIf.danshinLoanAfter)}／金利が1%上がったら毎月の返済 ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}`,
        ask: "ひとりで年を重ねたとき、どこに住んでいたいですか。金利が上がったときの備えはありますか。" } :
      { title: "⑤ もしものとき", say: `住宅ローンには団体信用生命保険（団信）が付き、万一のときは残りのローンが保険で返済され、家族に住まいが残ります。そのぶん、今の生命保険を見直せる場合があります。賃貸の場合、家族は家賃を払い続けます。高齢になると、年齢を理由に賃貸の入居を断られることもあります。金利が上がると返済が増える点は持ち家の注意点です。`,
        show: `${rentScreenLine(x)}／${danshinLine(x)}／団信：万一のときの残りのローン ${man(x.whatIf.danshinLoanAfter)}（賃貸なら家族は毎月 ${man(x.whatIf.danshinRentContinues, 1)} を払い続ける）／金利が1%上がったら毎月の返済 ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}`,
        ask: "ご家族に、どんな形で住まいを残したいですか。金利が上がったときの備えはありますか。" },
      six,
      { title: "⑦ まとめ：賃貸と購入、どちらがいいか", say: rc.verdict === "prepare"
          ? `${rc.headline}。賃貸のままでも、老後の家賃のぶんを毎月 ${man(x.prepare.monthlyRent, 1)} 準備していけば大丈夫です。`
          : `ここまでの数字で比べると、${rc.verdict === "buy" ? "購入をおすすめします" : "購入が合っています"}。${rc.top.map((r) => r.label.replace(/（.*）/, "")).join("・")}が、持ち家のほうが有利です。家賃として払い続けるお金が、返し終わればご自身の家として残ります。注意点も一緒に確認します。`,
        show: `おすすめの理由：${rc.reasons.map((r) => `${r.favorOwn ? "◎" : "△"}${r.label} ${r.text}`).join("／")}／注意：${rc.cautions.join("／")}`,
        ask: rc.verdict === "prepare" ? "老後の家賃の準備は、いつから、毎月いくらなら続けられそうですか。" : "この計画で、事前審査に進みませんか（無料・購入の義務はありません）。" },
      ...(seven ? [seven] : []),
    ];
  }

  // 営業マンがお客様に見せる資料（16:9）＝「賃貸より、購入。」をお客様の数字で示す
  // 表紙 → 固定費 → 結論 → 理由（1枚に1つ）→ 待つと → 親御さまの頃 → 注意点 → 進め方 → 次の一歩
  // 理由はすべて compute の数字。持ち家が有利な項目だけ「理由1・2…」と番号。数字が合わない人には「おすすめ」と書かない
  // お客様が見る面＝見出し・一言・大きな数字・図。話すこと・質問は営業マン用ノート（talk の文を使う）
  function deck(x, meta = {}) {
    const i = x.input, t = talk(x), fc = fixedCost(x), rc = recommend(x), g = gate(x), bb = bubble(x), P = proposal(x, meta);
    const buy = rc.verdict !== "prepare", w5 = x.wait[3] || x.wait[x.wait.length - 1], name = meta.customer && String(meta.customer).trim();
    const k = (label, value, sub = "", tone = "") => ({ label, value, sub, tone });
    const by = (mark) => t.find((s) => s.title.startsWith(mark)) || t[0];
    const note = (mark) => ({ say: by(mark).say, ask: by(mark).ask });
    const R = Object.fromEntries(rc.reasons.map((r) => [r.key, r]));
    let n = 0;
    const reason = (key, yes, no) => { const r = R[key], f = buy && r.favorOwn; return { reason: f, headline: f ? `理由${++n}　${yes}` : no }; };
    const slides = [];
    const step = (key, o) => slides.push({ kind: "step", key, points: [], reason: false, ...o });
    slides.push({ kind: "cover", key: "cover", title: APP.name, kana: APP.kana, tagline: APP.tagline,
      headline: buy ? "家賃を払い続けるより、自分の家を。" : "賃貸と購入、数字でくらべました",
      to: name ? name + " 様" : "", from: [meta.company || DEFAULT_COMPANY, meta.staff ? "担当：" + meta.staff : ""].filter(Boolean).join("　"), date: meta.date || "", profile: P.cover.profile });
    step("fixed", { headline: "節約するなら、いちばん大きな固定費から", visual: "fixed",
      lead: fc.rent ? `毎月の家賃は手取りの約${Math.round(fc.share * 100)}%。その家賃は、オーナーのローンの返済や将来の備えになっています。` : "今は家賃なし。家を出ると、いちばん大きな固定費＝家賃が始まります。",
      kpis: [k("今の家賃（毎月）", fc.rent ? man(fc.rent, 1) : "なし", fc.rent ? `手取りの約${Math.round(fc.share * 100)}%` : "実家など", "rent"),
        k(fc.to65 ? `${i.retireAge}歳まで払い続けると` : `${i.lifeEnd}歳までの家賃`, man(fc.to65 || fc.toEnd), `${i.lifeEnd}歳までで ${man(fc.toEnd)}`, "rent")],
      points: rentImage(x).single
        ? ["家賃は住まいの対価。オーナーのローンの返済・管理・修繕・税金にあてられます", "自分が戸建てを持つと：① 暮らしに合わせて使う　② 返済を通じて借入残高を減らす　③ 将来の売却・賃貸も選択肢に", "購入には税金・修繕費などが必要です。売却価格や賃貸収入は、立地や建物の状態によって変わります"]
        : ["家賃は住まいの対価。受け取った家賃は、オーナーのローンの返済・管理・修繕・税金にあてられます", "同じ住まいのお金を、家賃として払い続けるか、自分の資産に変えていくか"], notes: note("¥") });
    step("conclusion", { headline: buy ? "結論：あなたには、購入をおすすめします" : "結論：今は賃貸のまま、準備を進めましょう", visual: "recommend",
      lead: buy ? `持ち家が有利な項目が${rc.favor}つ。${rc.verdict === "buy" ? "まず事前審査で、この計画が通るか確かめましょう。" : "△の項目を見直し、事前審査で確かめてから進めましょう。"}` : `持ち家が有利な項目は${rc.favor}つ。条件（買う年齢・価格・頭金）が変われば、もう一度くらべます。`,
      kpis: [k("持ち家が有利な項目", `4つ中${rc.favor}つ`, "", buy ? "own" : ""), k("毎月の返済（持ち家）", man(x.loan.pmt, 1), `${x.loan.buyAge}歳で買い ${x.loan.endAge}歳で完済`, "own")],
      notes: note("⑦") });
    const life = R.life;
    step("life", { ...reason("life", "一生の住居費は、持ち家のほうが少ない", "くらべ：一生の住居費"), visual: "life",
      lead: `${i.lifeEnd}歳までの住居費を、税金・保険・修繕まで入れて比べました。持ち家は${i.retireAge}歳に残る家の価値を差し引いた実質です。`,
      kpis: [k("賃貸のまま", man(life.rent), "", "rent"), k("持ち家（実質）", man(life.own), `総額 ${man(x.life.own)}−家の価値 ${man(x.value65.flat)}`, "own")], notes: note("②") });
    step("old", { ...reason("old", "老後の毎月が、ぐっと楽になる", "くらべ：老後の毎月"), visual: "old",
      lead: `${i.retireAge}歳からは年金が中心。持ち家は返済が終われば家賃がかからず、毎月の不足が小さくなります。`,
      kpis: [k("毎月の不足（賃貸のまま）", man(R.old.rent, 1), "", "rent"), k("毎月の不足（持ち家）", man(R.old.own, 1), `${x.loan.endAge}歳で完済`, "own"), k("年金（概算・毎月）", man(x.pension.monthly, 1))], notes: note("③") });
    step("asset", { ...reason("asset", `${i.retireAge}歳に、家という資産が残る`, `くらべ：${i.retireAge}歳の資産`), visual: "portfolio",
      lead: `家賃は払えば終わりですが、返済は家として残ります。${i.retireAge}歳の資産（預貯金・NISA・家の価値−残りのローン）を比べました。`,
      kpis: [k(`${i.retireAge}歳の資産（賃貸のまま）`, man(R.asset.rent), "", "rent"), k(`${i.retireAge}歳の資産（持ち家）`, man(R.asset.own), `うち家 ${man(x.portfolio.at65.own.realEstate)}`, "own")], notes: note("⓪") });
    step("prepare", { ...reason("prepare", "老後に向けて準備するお金が少なくてすむ", "くらべ：老後への準備"), visual: "prepare",
      lead: `賃貸のままなら、老後の家賃のぶんも${i.retireAge}歳までに準備が必要です。持ち家なら、その準備が少なくてすみます。`,
      kpis: [k(`${i.retireAge}歳までに準備（賃貸のまま）`, man(R.prepare.rent), `毎月 ${man(x.prepare.monthlyRent, 1)} の積立`, "rent"), k(`${i.retireAge}歳までに準備（持ち家）`, man(R.prepare.own), `毎月 ${man(x.prepare.monthlyOwn, 1)} の積立`, "own")], notes: note("④") });
    step("danshin", { reason: buy, headline: buy ? `理由${++n}　もしものときも、ローンは残らない` : "もしものとき（団信と保険）", visual: "danshin",
      lead: "住宅ローンには団体信用生命保険（団信）。万一のとき残りのローンは保険で返済され、住まいが残ります。",
      kpis: [k("万一のとき残るローン", man(0), "団信", "own"), k("老後の賃貸の入居審査", Math.round(x.screening.rent.ratioOld * 100) + "%", "家賃÷年金（目安 33%以内）", "rent")], notes: note("⑤") });
    step("credit", { reason: buy && x.credit.total > 0, headline: buy && x.credit.total > 0 ? `理由${++n}　住宅ローン控除で、税金が戻る` : "住宅ローン控除", visual: "credit",
      lead: x.credit.total > 0 ? `買った年から${x.credit.years}年間、払った所得税・住民税の一部が戻ります（${x.credit.label}）。` : "この物件の種類では、住宅ローン控除の対象外です。",
      kpis: [k("戻る税金（合計・概算）", man(x.credit.total), `${x.credit.years}年間`, "own"), k("1年目", man(x.credit.rows[0] ? x.credit.rows[0].actual : 0), "所得税→住民税の順", "own")], notes: { say: `住宅ローン控除は、ローンの残高の0.7%を上限に、払った所得税と住民税から戻る仕組みです。この計画だと${x.credit.years}年間で約${man(x.credit.total)}。払った税金より多くは戻らないので、年収に合わせて計算しています。`, ask: "源泉徴収票の所得税の額を、あとで一緒に確認させてください。" } });
    step("wait", { headline: "待つと、家賃が出ていき、完済が遅れる", visual: "wait",
      lead: w5 ? `待つのも選択肢です。ただ${w5.years}年待つと、その間の家賃 ${man(w5.rentWhileWaiting)}が出ていき、完済は${w5.payoffAge}歳に。` : "待つ理由と、待つ間に払う家賃を知ったうえで決めましょう。",
      kpis: w5 ? [k(`${w5.years}年待つ間の家賃`, man(w5.rentWhileWaiting), "", "rent"), k("完済の年齢", `${w5.payoffAge}歳`, `今なら ${x.loan.endAge}歳`)] : [k("毎月の返済", man(x.loan.pmt, 1)), k("完済の年齢", `${x.loan.endAge}歳`)], notes: note("⑧") });
    step("bubble", { headline: "親御さまの頃とは、金利も買い方も違う", visual: "bubble",
      lead: `同じ ${man(x.loan.amount)}・${i.own.years}年でも、1990年前後の金利 8.5%なら毎月 ${man(bb.bank, 1)}。今の計画は ${man(bb.now, 1)}です。`,
      kpis: [k("1990年前後（8.5%）", man(bb.bank, 1), "毎月", "rent"), k(`今の計画（${(i.own.rate * 100).toFixed(1)}%）`, man(bb.now, 1), "毎月", "own")],
      points: ["当時は値上がりを見込んだ買い方が多かった。今回は値上がりをあてにせず、住むために払える範囲で考えます", "値下がりもありうるので、次の注意点も一緒に確認します"],
      notes: { say: "ご両親が心配されるのは当然です。当時は金利が高く、値上がりを見込んで買う方が多かった時代でした。今回は、値上がりをあてにせず、住むために払える範囲で考えています。", ask: "親御さまにも見ていただけるよう、この資料をお渡ししましょうか。" } });
    step("cautions", { headline: "購入する前に、確認しておくこと", visual: "none",
      lead: "良いことだけでなく、注意点もお伝えします。どれも数字で確認しておけば備えられます。",
      kpis: [k("金利が1%上がったら（毎月）", man(x.whatIf.rateUpPmt, 1), `今の計画 ${man(x.whatIf.pmt, 1)}`), k(`${i.retireAge}歳の家の価値（下落した場合）`, man(x.value65.down), `横ばい ${man(x.value65.flat)}`)],
      points: rc.cautions, notes: { say: "購入には注意点もあります。金利が上がる、修繕や税金がかかる、家の値段が下がることもある。賃貸のまま差額を運用し続けられれば、資産が増える場合もあります。ここまで知ったうえで決めていただきたいです。", ask: "この中で、いちばん気になる点はどれですか。" } });
    step("steps", { headline: "進め方：まず「できるか」を確かめる", visual: "gate",
      lead: "住宅ローンを決めるのは金融機関。やるか・やらないかの前に、事前審査で「できるか」を確かめます。",
      kpis: [k("審査が通るのは（当社の目安）", `${PASS_RATE.of}人中${PASS_RATE.low}〜${PASS_RATE.high}人`), k("事前審査", "無料", "購入の義務はありません")],
      points: [g.verdict], notes: note("⑥") });
    slides.push({ kind: "next", key: "next", headline: "次の一歩", steps: P.pages[3].nextSteps,
      contact: [meta.company || DEFAULT_COMPANY, meta.staff ? "担当：" + meta.staff : "", meta.tel ? "TEL " + meta.tel : ""].filter(Boolean).join("　"), notes: NOTES.slice(0, 4) });
    return { slides, verdict: rc.verdict };
  }

  // お客様にお渡しする提案書（A4・4ページ）。数字はすべて compute の結果から
  function proposal(x, meta = {}) {
    const i = x.input, single = i.family.marryAge == null, inc = x.income, pf = x.portfolio, b = x.breakdown;
    const pct = (v) => Math.round(v * 100) + "%";
    const w5 = x.wait[3] || x.wait[x.wait.length - 1];
    const fc = fixedCost(x), rc = recommend(x);
    const cover = {
      title: APP.name,
      sub: `${APP.kana}｜賃貸のまま／持ち家 を、今から${i.lifeEnd}歳まで同じ物差しでくらべました`,
      to: meta.customer && String(meta.customer).trim() ? String(meta.customer).trim() + " 様" : "お客様",
      date: meta.date || "",
      company: meta.company || DEFAULT_COMPANY,
      contact: [meta.staff ? "担当：" + meta.staff : "", meta.tel ? "TEL " + meta.tel : ""].filter(Boolean).join("　"),
      profile: `${i.age}歳・年収 ${man(i.income)}・貯金 ${man(i.savings)}・${x.shataku ? `社宅（自己負担 ${manY(x.shataku.self)}・${x.shataku.until}歳まで）・` : ""}${single ? "おひとりで暮らす前提" : (i.family.marryAge + "歳で結婚" + (i.family.kids ? `・お子さま${i.family.kids}人` : ""))}・${i.own.buyAge}歳で ${man(i.own.price)} の家を買った場合`,
    };
    const pages = [
      { no: 1, title: "あなたのお金の全体像", lead: `これから一生で入ってくるお金は約 ${man(inc.total)}。住まいは、その中でいちばん大きな支出です。`,
        points: [
          `年収 ${man(i.income)}（一般の平均給与 ${man(inc.average, 1)} の ${pct(inc.vsAverage)}）`,
          `一生で入ってくるお金 ${man(inc.total)}（給料 ${man(inc.salaryMe + inc.salaryPartner)}・年金 ${man(inc.pension)}）`,
          `毎月いちばん大きな固定費は住まい：${fc.rent ? `今の家賃 ${man(fc.rent, 1)}（手取りの約${pct(fc.share)}）` : "今は家賃なし（実家など）、家を出ると家賃が始まります"}。${fc.to65 ? `${i.retireAge}歳まで払い続けると ${man(fc.to65)}。` : ""}家賃は住まいの対価で、オーナーのローンの返済・管理・修繕・税金にあてられます`,
          `そのうち住まいに使うお金　賃貸のまま ${man(x.life.rent)}（${pct(inc.housingShare.rent)}）／持ち家 ${man(x.life.own)}（${pct(inc.housingShare.own)}）`,
          `今の資産　預貯金 ${man(pf.now.savings)}・NISA ${man(pf.now.nisa)}・不動産 なし・保険 毎月 ${man(pf.now.insuranceMonthly, 1)}`,
          `${i.retireAge}歳の資産（概算）　賃貸のまま ${man(pf.at65.rent.total)}／持ち家 ${man(pf.at65.own.total)}（うち家 ${man(pf.at65.own.realEstate)}）`,
        ] },
      { no: 2, title: "一生でかかる住まいのお金", lead: `今から${i.lifeEnd}歳まで、賃貸は家賃を払い続け、持ち家は返済が終わると税金・保険・修繕だけになります。`,
        points: [
          `一生の住居費　賃貸のまま ${man(x.life.rent)}／持ち家 ${man(x.life.own)}（住宅ローン控除で戻る税金を差し引いた額）`,
          `賃貸の更新料　${x.renew.every}年ごとに家賃${x.renew.months}か月分。${i.lifeEnd}歳までに${x.renew.times}回・合計 ${man(x.renew.total)}（うち${i.retireAge}歳から ${man(x.renew.old)}）`,
          `持ち家の内訳　元金 ${man(b.own.principal.amount)}・利息 ${man(b.own.interest.amount)}・固定資産税等 ${man(b.own.tax.amount)}・火災地震保険 ${man(b.own.ins.amount)}・修繕 ${man(b.own.repair.amount)}`,
          `住宅ローン控除　${x.credit.label}・${x.credit.years}年。払う税金の範囲で戻る見込み ${man(x.credit.total)}（制度上の上限 ${man(x.credit.totalMax)}）`,
          `毎月の返済 ${man(x.loan.pmt, 1)}（金利 ${(i.own.rate * 100).toFixed(1)}%・${i.own.years}年＝${x.loan.months}回払い・${x.loan.endAge}歳で完済）`,
        ], table: true },
      { no: 3, title: single ? `${i.retireAge}歳からの、ひとりの暮らし` : `${i.retireAge}歳からの暮らしと、もしものとき`,
        lead: single ? `${i.retireAge}歳からは、ひとり分の年金が収入の中心です。賃貸のままなら、その年金から家賃を払い続けます。`
          : `${i.retireAge}歳からは年金が収入の中心です。ご家族の暮らしと住まいを、もしものときも含めて考えます。`,
        points: [
          workLoanLine(x),
          `年金（概算）毎月 ${man(x.pension.monthly, 1)}／毎月の支出　賃貸のまま ${man(x.old.rent.outMonthly, 1)}・持ち家 ${man(x.old.own.outMonthly, 1)}`,
          `毎月の不足　賃貸のまま ${man(x.old.rent.gapMonthly, 1)}・持ち家 ${man(x.old.own.gapMonthly, 1)}`,
          rentScreenLine(x),
          danshinLine(x),
          `持たない場合に${i.retireAge}歳までに準備したいお金 ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)} の積立）`,
          single ? `高齢のひとり暮らしは、年齢や保証人を理由に賃貸の入居を断られることがあります。団信があるので、万一のときもローンは親や兄弟に残りません。`
            : `団信があるので、万一のときは残りのローンがなくなり、ご家族に住まいが残ります（賃貸ならご家族は毎月 ${man(x.whatIf.danshinRentContinues, 1)} を払い続けます）。`,
          `金利が1%上がった場合の毎月の返済 ${man(x.whatIf.rateUpPmt, 1)}（今の計画 ${man(x.whatIf.pmt, 1)}）`,
        ] },
      { no: 4, title: "賃貸と購入、どちらがいいか（まとめと次の一歩）", lead: rc.headline,
        points: [
          `区切り：住宅ローンを決めるのは融資する金融機関です。当社で審査を申し込んだ方のうち、通るのは${PASS_RATE.of}人中${PASS_RATE.low}〜${PASS_RATE.high}人ほど（目安）。数字の目安：${gate(x).checks.map((c) => `${c.ok ? "○" : "△"}${c.label.replace(/（.*）/, "")} ${c.value.replace(/（.*）/, "")}`).join("・")}`,
          `おすすめの理由：${rc.reasons.map((r) => `${r.favorOwn ? "◎" : "△"}${r.label.replace(/（.*）/, "")} 賃貸 ${r.key === "old" ? man(r.rent, 1) : man(r.rent)}・持ち家${r.key === "life" ? "（家の価値を引いた実質）" : ""} ${r.key === "old" ? man(r.own, 1) : man(r.own)}`).join("／")}`,
          `注意：金利が1%上がると毎月 ${man(x.whatIf.rateUpPmt, 1)}・修繕と固定資産税の備え・家の値段は下がることも（${i.retireAge}歳の家の価値 ${man(x.value65.down)}〜${man(x.value65.up)}）`,
          `持つなら：無理のない返済（毎月 ${man(x.loan.pmt, 1)}）と、修繕・固定資産税の備え。${i.retireAge}歳の家の価値（概算）は ${man(x.value65.down)}〜${man(x.value65.up)}（将来の価格を約束するものではありません）`,
          `賃貸のままにする場合：老後の家賃のための積立（毎月 ${man(x.prepare.monthlyRent, 1)}）。差額を年${(x.fair.rate * 100).toFixed(0)}%で運用できた場合 ${man(x.fair.rentInvested65)}（元本保証なし）`,
          `待つ場合：5年待つと、その間の家賃 ${man(w5.rentWhileWaiting)}・完済 ${w5.payoffAge}歳${w5.loanYearsAfterRetire ? `（${i.retireAge}歳を過ぎて${w5.loanYearsAfterRetire}年返済）` : ""}・住宅ローンの審査の返済比率 ${Math.round(w5.screen.ratio * 100)}%（目安 ${Math.round(w5.screen.limit * 100)}%以内）。年齢が上がると期間が短くなり審査が通りにくくなる場合もあります。待つ理由がはっきりしていれば、待つのも選択肢です`,
        ],
        nextSteps: [
          `CICで自分の信用情報を取り寄せる（ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円、${CIC.url.replace("https://", "")}）`,
          "住宅ローンの事前審査で、借りられる額を確かめる（無料・購入の義務はありません）",
          "ねんきんネットで、ご自身の年金の見込額を確かめる",
          "条件（エリア・広さ・駐車場・毎月の上限）を書き出して、物件を見る",
          single ? "今は賃貸のまま、老後の家賃のための積立を始める" : "今は賃貸のまま、ご家族で話し合う時間をとる",
          "今回は見送り、状況が変わったら（転勤・結婚・貯金）もう一度試算する",
        ] },
    ];
    return { cover, pages, notes: NOTES.slice() };
  }

  // トップページ（LIFE ROUTE）：お客様が主人公。数字はすべて compute の結果から（見本の数字は使わない）
  // done＝チェックしたミッション（{ preApproval, viewHomes, nenkin, insurance, nisaReview }）。画面の中だけで、保存しない
  function home(x, done = {}, meta = {}) {
    const i = x.input, o = i.own, pf = x.portfolio, L = x.loan;
    const now = i.savings + i.nisa.balance;
    const parts = [
      { key: "realEstate", label: "不動産", amount: 0 },
      { key: "nisa", label: "NISA", amount: i.nisa.balance },
      { key: "savings", label: "預貯金", amount: i.savings },
    ].map((p) => ({ ...p, share: now > 0 ? p.amount / now : p.key === "savings" ? 1 : 0 }));
    // 今から65歳まで、持ち家の場合の資産（預貯金＋NISA＋家の価値−残りのローン）。65歳は portfolio.at65.own と同じ
    const nr = i.nisa.rate, path = [];
    for (let a = i.age; a <= i.retireAge; a++) {
      const n = a - i.age, g = Math.pow(1 + nr, n);
      const nisa = i.nisa.balance * g + (nr === 0 ? i.nisa.monthly * 12 * n : (i.nisa.monthly * 12 * (g - 1)) / nr);
      let house = 0;
      if (a >= L.buyAge) {
        const t = a - L.buyAge;
        const value = o.price * o.landShare + o.price * (1 - o.landShare) * Math.max(0.1, 1 - (0.9 * t) / 30);
        house = Math.max(0, value - balanceAfter(L.amount, o.rate, o.years, t * 12));
      }
      path.push({ age: a, own: i.savings + nisa + house, rent: i.savings + nisa });
    }
    const target = x.prepare.rentNeed;
    const rentNow = x.years[0] ? x.years[0].rentMonthly : i.rent.single;
    // 今は家賃なし（実家など）なら、家を出たあとの家賃で備えを考える
    const rentBase = rentNow || (x.years.find((y) => y.rentMonthly > 0) || {}).rentMonthly || 0, rentWord = rentNow ? "家賃" : "家を出たあとの家賃";
    const M = [
      { id: "cushion", area: "cash", label: `急な出費に備える貯金（${rentWord}の6か月分 ${man(rentBase * 6)}）`, auto: true, done: i.savings >= rentBase * 6 },
      { id: "nisaStart", area: "nisa", label: "NISAで毎月の積立を始める", auto: true, done: i.nisa.monthly > 0 },
      { id: "nisaReview", area: "nisa", label: "積立の額と続けられるかを確かめる", auto: false },
      { id: "insurance", area: "ins", label: "保険を見直す（団信で減らせる分があるか）", auto: false },
      { id: "cic", area: "home", label: `CICで自分の信用情報を取り寄せる（ネット${CIC.methods[0].fee}円）`, auto: false },
      { id: "preApproval", area: "home", label: "住宅ローンの事前審査で借りられる額を確かめる（無料・購入の義務はありません）", auto: false },
      { id: "viewHomes", area: "home", label: "条件（エリア・広さ・毎月の上限）を書き出して物件を見る", auto: false },
      { id: "plan", area: "plan", label: "ライフプランをつくる（このシミュレーション）", auto: true, done: true },
      { id: "nenkin", area: "plan", label: "ねんきんネットで年金の見込額を確かめる", auto: false },
    ].map((m) => ({ ...m, done: m.auto ? !!m.done : !!done[m.id] }));
    const lv = (k) => 1 + M.filter((m) => m.area === k && m.done).length;
    const prog = (k) => M.filter((m) => m.area === k && m.done).length / M.filter((m) => m.area === k).length;
    // big＝カードで大きく見せる数字（1つ）、bigLabel＝その数字が何か
    const AT = (n) => n + 1; // 説明の先頭に「¥ いちばん大きな固定費」があるので、⓪ は1番目
    // 準備 ◯/◯ できた＝そのエリアの「やること」のうち、できた数（Lv. より意味が伝わる）
    const count = (k) => { const ms = M.filter((m) => m.area === k), d = ms.filter((m) => m.done).length; return { doneCount: d, total: ms.length, readiness: `準備 ${d}/${ms.length} できた` }; };
    const area = (key, label, sub, big, bigLabel, value, step) => ({ key, label, sub, big, bigLabel, value, step, level: lv(key), progress: prog(key), ...count(key), missions: M.filter((m) => m.area === key) });
    const areas = [
      area("cash", "現預金エリア", "安心の土台をつくる", man(i.savings), "今の預貯金", `急な出費の備え：${rentWord}の6か月分 ${man(rentBase * 6)}`, AT(0)),
      area("nisa", "NISAエリア", "未来の資産を育てる", man(pf.at65.nisa), `${i.retireAge}歳のNISA（見込み）`, `残高 ${man(i.nisa.balance)}・毎月 ${man(i.nisa.monthly, 1)}（年${(nr * 100).toFixed(0)}%と仮定）`, AT(0)),
      area("ins", "保険エリア", "もしもの時に備える", man(i.lifeIns.monthly, 1), "毎月の保険料", "団信で万一のときローンは残らない", AT(5)),
      area("home", "不動産エリア", "住まいで人生を豊かに", man(L.pmt, 1), "毎月の返済", `${L.buyAge}歳で ${man(o.price)}・${L.months}回・${L.endAge}歳で完済`, AT(2)),
      area("plan", "ライフプランエリア", "これからの暮らしをデザイン", man(x.life.own), "一生の住居費（持ち家）", `賃貸のまま ${man(x.life.rent)}`, AT(1)),
    ];
    // ライフイベント：出来事と、そのときの数字（stat）。地図の道の印・グラフの点・一覧で同じ文を使う
    const f = i.family, sh = x.shataku, re = x.income.reemploy;
    const ev = [{ age: i.age, label: "今（ここからスタート）", stat: `資産 ${man(now)}・家賃 ${rentNow ? `毎月 ${manY(rentNow)}` : "なし（実家など）"}` }];
    if (sh && sh.until > i.age) ev.push({ age: sh.until, label: "社宅を出る", stat: `家賃 ${manY(sh.self)}→${manY(sh.after)}（毎月 +${manY(sh.jump)}）` });
    if (f.marryAge != null && f.marryAge >= i.age) ev.push({ age: f.marryAge, label: "結婚", stat: i.rent.couple ? `2人暮らしの家賃 ${manY(i.rent.couple)}` : "家賃はひとり暮らしのまま" });
    if (f.kids > 0 && f.firstKidAge >= i.age) ev.push({ age: f.firstKidAge, label: "子どもが生まれる", stat: i.rent.family ? `子育て期の家賃 ${manY(i.rent.family)}` : "家賃は2人暮らしのまま" });
    ev.push({ age: L.buyAge, label: `家を買う（${man(o.price)}）`, stat: `毎月 ${man(L.pmt, 1)}×${L.months}回` });
    if (re.age < i.retireAge) ev.push({ age: re.age, label: "定年・再雇用", stat: L.atReemploy.left > 0 ? `年収 ${man(i.income * re.rate)}・ローン残り${L.atReemploy.left}回（残高 ${man(L.atReemploy.balance)}）` : `年収 ${man(i.income * re.rate)}・ローンは完済` });
    ev.push({ age: i.retireAge, label: "年金生活", stat: `年金 毎月 ${man(x.pension.monthly, 1)}` });
    ev.push({ age: L.endAge, label: "ローン完済", stat: `${L.months}回の返済が終わる` });
    ev.sort((p, q) => p.age - q.age);
    // 道の印：今（t=0）からGOAL（65歳、t=1）まで。同じ年齢の出来事は1つにまとめ、65歳より後の出来事はGOALの印に年齢つきで入れる
    const span = Math.max(1, i.retireAge - i.age), milestones = [];
    for (const e of ev) {
      const age = Math.min(e.age, i.retireAge), late = e.age > i.retireAge;
      const label = late ? `${e.label}（${e.age}歳）` : e.label;
      const last = milestones.at(-1);
      if (last && last.age === age) { last.label += "・" + label; last.stat += "／" + e.stat; continue; }
      const p = path.find((q) => q.age === age);
      milestones.push({ age, t: (age - i.age) / span, label, stat: e.stat, assets: p ? p.own : 0 });
    }
    const doneN = M.filter((m) => m.done).length;
    return {
      hero: { title: APP.name, kana: APP.kana, catch: APP.tagline,
        name: meta.customer && String(meta.customer).trim() ? String(meta.customer).trim() + " 様" : "あなた",
        company: meta.company || DEFAULT_COMPANY, level: 1 + doneN, age: i.age,
        doneCount: doneN, total: M.length, readiness: `準備 ${doneN}/${M.length} できた`, howto: "下の「やること」をチェックすると、できた数が増えます" },
      assets: { now, parts, path, at65: { rent: pf.at65.rent.total, own: pf.at65.own.total } },
      goal: { label: `${i.retireAge}歳までに準備したいお金（賃貸のままの場合）`, target, ownTarget: x.prepare.ownNeed, now, pct: target > 0 ? Math.min(1, now / target) : 1 },
      areas, missions: M, events: ev, milestones,
      actions: [
        { title: i.nisa.monthly > 0 ? "NISAを続ける" : "NISAを始める", sub: "少しずつ、未来の資産を育てる", step: AT(0), icon: "nisa" },
        { title: "住まいの一生を見る", sub: "賃貸のまま／持ち家を同じ物差しで", step: AT(2), icon: "home" },
        { title: "まず「できるか」を確かめる", sub: "決めるのは金融機関。事前審査は無料・購入の義務なし", step: AT(6), icon: "ins" },
        { title: "提案書をつくる", sub: "A4・4ページでお渡し", go: "proposal", icon: "plan" },
      ],
    };
  }

  const NOTES = [
    "金額はすべて概算です。年金は ねんきんネット・ねんきん定期便の見込額で確かめてください。",
    "年金は基礎年金を満額、厚生年金を「年収÷12 × 5.481/1000 × 加入月数」で概算（令和8年度の数字。賞与・昇給・加入期間で変わる）。60歳で定年・65歳まで再雇用（年収は定年前の6割と仮定、会社の制度で変わる）とし、再雇用の5年は給料も厚生年金も下がった年収で計算。",
    "ローンは月で数える（35年＝420回払い）。定年・65歳の時点の残りの回数と残高は、毎月同じ額を返す元利均等返済で計算。",
    "家賃の初期値 5.8万円は当社のお客様（20代後半・単身・賃貸）の家賃の中央値。社宅は自己負担2万円・30歳ごろまでと仮定（会社の規定で変わる。社宅の間は更新料なし）。",
    "老後の生活費（住居費を除く）・将来の家賃・物件価格・修繕費は仮定です。お客様の地域と暮らしに合わせて変えてください。",
    "家の価値は、土地は年−1%／0%／＋1%、建物は30年で1割まで下がると仮定した3つのシナリオです。",
    "高齢期の賃貸は、年齢や保証人を理由に入居を断られる場合がある（一般的な傾向）。家賃は収入の3分の1以内が入居審査の一般的な目安。",
    "住宅ローンの審査は返済比率（年収400万円未満30%・以上35%、フラット35の基準）で目安を表示。完済は80歳までが一般的で、年齢が上がると期間が短くなる。団信は健康状態で入れない場合がある。実際の審査は金融機関ごとに異なる。",
    "賃貸の更新料は2年ごとに家賃1か月分と仮定（地域・物件で0〜2か月）。社宅の間は更新料なし。",
    "住宅ローン控除は2026〜2027年入居の制度（令和8年度税制改正）で概算。単身は一般の限度額、結婚後（40歳未満）や子育て中に入居すると上乗せ。所得税→住民税（課税所得×5%・最高97,500円）の順に、払った税金の範囲で戻り、控除しきれない額は数えない。税額は給与収入だけの単身として概算〔要確認：源泉徴収票で確認〕。",
    "一般の年収は国税庁「民間給与実態統計調査」令和5年分の平均給与 459.5万円。生涯収入は今の年収が毎年1%上がると仮定（▼で変更）した給料と、年金（概算）の合計。",
    "NISAは今の残高と毎月の積立を年3%で運用できたと仮定（元本保証なし）。預貯金は今のまま。65歳の不動産は家の価値（横ばい）から残りのローンを引いた額。",
    "待った場合の計算は、物件価格・金利が今と同じ前提（上がることも下がることもある）。返済は80歳までに終わる期間に縮める。",
    "諸費用（物件価格の7%と仮定）には、登記費用・不動産取得税・印紙税・ローン手数料・仲介手数料などが含まれる。固定資産税・都市計画税は物件・地域で変わる。",
  ];

  return { ASK_FIELDS, askFields, missing, rentImage, deck, recommend, fixedCost, BUBBLE, bubble, danshin, DANSHIN_OPTIONS, CIC, PASS_RATE, gate, APP, DEFAULT_COMPANY, home, RENT_AVG, proposal, preset, PRESETS, AVG_SALARY, FORBIDDEN, PENSION, CREDIT_KINDS, payment, balanceAfter, pension, estimateTax, defaults, compute, talk, NOTES, man, STAGE_LABEL };
});
