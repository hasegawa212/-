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

  // 審査に必要な書類（事前審査の前にそろえる）
  const SCREEN_DOCS = [
    { key: "cic", name: "信用情報（CIC）", what: `本人開示 ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円（自分で取り寄せて確かめる）` },
    { key: "id", name: "本人確認書類", what: "運転免許証・健康保険証・マイナンバーカードのどれか" },
    { key: "income", name: "源泉徴収票", what: "2期分（直近2年分）" },
  ];
  // 働き方で収入の証明がかわる（個人事業主は確定申告書。必要な期数は金融機関で異なる）
  const screenDocs = (x) => x.input.job === "self"
    ? SCREEN_DOCS.map((v) => (v.key === "income" ? { key: "income", name: "確定申告書（控えと収支内訳書など）", what: "直近2〜3期分（金融機関で異なる）" } : v)) : SCREEN_DOCS;
  // 会社員の「社会的信用」と、事前審査＝選べるチケット。信用は「評価されることがある」、通るかは審査してみないとわからない
  function trust(x) {
    const self = x.input.job === "self";
    const table = [
      { label: "収入の証明", employee: "源泉徴収票など", self: "確定申告書など" },
      { label: "収入の評価", employee: "給与・勤務先・勤続年数", self: "所得・事業実績・収入の安定性" },
      { label: "必要書類", employee: "比較的少ない傾向", self: "複数年分の申告書などが必要な場合" },
      { label: "審査のポイント", employee: "勤務先・年収・借入状況", self: "所得の推移・事業の継続性・借入状況" },
    ];
    const ticket = ["だから、まずは信用情報を確認して、住宅ローンの事前審査を受けてみませんか。",
      "事前審査が通れば、住宅購入に向けた第一段階をクリアしたことになります。",
      "そこで手に入るのは、家を買う義務ではありません。家を買うかどうかを、自分で判断できる選択肢です。",
      "そのチケットを使うか、使わないかは、お客様ご自身が決めればいいんです。"];
    return {
      self, table, selfNote: "個人事業主でも住宅ローンは利用できます。ただし金融機関によっては、複数年の所得実績を求められるなど、会社員より確認することが多くなる場合があります。",
      title: self ? "積み上げてきた事業の実績を、将来の選択肢に。" : "会社員として積み上げた信用を、将来の選択肢に。",
      sub: "住宅ローンの事前審査は、家を買う約束ではない。",
      big: "買うか、買わないか。決めるのはあなた。",
      note: "※事前審査の承認は本審査の承認や融資実行を保証せず、有効期限や物件条件などの制約があります。",
      talk: self ? ["個人事業主の方は、確定申告書で所得を確認されます。売上より、申告した所得の推移と事業が続いていることが見られます。",
        "複数年の所得実績を求められることもあるので、直近の確定申告書を2〜3期分そろえておくと話が早くなります。",
        "その実績で住宅ローンを利用できるかどうかは、実際に審査してみないとわかりません。", ...ticket]
        : ["実は、会社員として企業にお勤めされていること自体が、大きな信用なんです。",
        "毎月安定して給与を受け取っているという実績は、住宅ローンの審査でも評価されることがあります。",
        "例えば、個人事業主の方は、売上が大きくても複数年の所得実績を確認されることがあります。",
        "つまり、今お客様が会社員として積み上げている信用には、住宅購入という場面で活用できる価値があります。",
        "ただ、その信用で住宅ローンを利用できるかどうかは、実際に審査してみないとわかりません。", ...ticket],
    };
  }
  // 審査のあとの流れ（いつ・何をするか）
  const FLOW = [
    { name: "事前審査", what: "借りられる額を金融機関に確かめる（無料・購入の義務はありません）" },
    { name: "内見", what: "通った金額の範囲で、物件を実際に見る" },
    { name: "売買契約", what: "買う物件を決めて契約する（重要事項の説明を受ける）" },
    { name: "本申込（本審査）", what: "金融機関に住宅ローンを正式に申し込む" },
    { name: "金銭消費貸借契約", what: "住宅ローンの契約（金消契約）を結ぶ" },
    { name: "決済・引き渡し", what: "残りの代金を払い、鍵を受け取る" },
  ];
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
      transfer: { on: false, leaseRent: 70_000 }, // 転勤の可能性・転勤の間に貸した場合の家賃（目安）
      job: "employee", // 働き方：employee（会社員）／self（個人事業主）
      debt: { monthly: 0 }, // 他の借入（車・カード・リボ・奨学金など）の毎月の返済
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
      lifeIns: { ...d.lifeIns, ...(input.lifeIns || {}) }, nisa: { ...d.nisa, ...(input.nisa || {}) }, shataku: { ...d.shataku, ...(input.shataku || {}) }, reemploy: { ...d.reemploy, ...(input.reemploy || {}) },
      transfer: { ...d.transfer, ...(input.transfer || {}) }, debt: { ...d.debt, ...(input.debt || {}) } };
    const reAge = Math.min(inp.retireAge, inp.reemploy.age), reRate = inp.reemploy.rate;
    const sh = inp.shataku;
    const shEnd = sh.until > 0 ? Math.min(sh.until, inp.retireAge) : inp.retireAge; // 0＝出る年齢の決まりなし（社宅は在職中だけ＝定年まで）
    const inShataku = (age) => sh.on && age < shEnd;
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
    // 今の年齢が買う年齢より上なら「今買う」。文章・提案書・資料も同じ年齢になるように入力側もそろえる（呼び出し側の値は書きかえない）
    inp.own = { ...o, buyAge };
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
      shataku: sh.on ? { self: sh.self, until: sh.until, end: shEnd, endTxt: sh.until > 0 ? `${sh.until}歳まで` : `定年の${inp.retireAge}歳まで・出る年齢の決まりなし`,
        after: rentAt(stage(inp, Math.max(inp.age, shEnd))), jump: rentAt(stage(inp, Math.max(inp.age, shEnd))) - sh.self } : null,
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

  // 今の経済の数字（2026年10月時点）。変わるので、使う前に出典で確かめる。物価・金利は「仮に続いた場合」として使い、断定しない
  const ECONOMY = {
    asOf: "2026年10月時点",
    cpi: { rate: 0.021, month: "2026年9月", label: "全国の消費者物価（生鮮食品を除く総合）前年同月比 +2.1%", src: "総務省統計局 消費者物価指数（2026年10月23日公表）" },
    deposit: { rate: 0.005, from: "2026年11月2日", label: "3メガバンクの普通預金金利 年0.5%（税引前）", src: "各行の発表（ゆうちょ銀行は11月9日から）" },
    report2000: { gapMonthly: 55_000, years: 30, total: 20_000_000, who: "夫65歳以上・妻60歳以上の無職の夫婦（当時の平均）",
      src: "金融審議会 市場ワーキング・グループ報告書「高齢社会における資産形成・管理」（2019年6月）" },
    savingsIns: "貯蓄型の保険は、早く解約すると払った額より戻りが少ない（元本割れ）場合があります。保障（もしものとき）と貯蓄（ふやす）は分けて考えると比べやすくなります",
  };
  // ───── 使い方（営業マン向け・初めての端末で自動で開く）。go＝押したときに開く場所 ─────
  const HOWTO = {
    title: "LIFE ROUTE の使い方（営業マン向け）",
    steps: [
      { title: "① 担当者を登録（最初の1回だけ）", body: "右上の「担当者」から自分の名前を登録します。パスワードはなく、この端末の中だけに保存されます。登録したお客様は自動で自分の担当になります。", go: "acct" },
      { title: "② お客様の数字を入れる", body: "「はじめる」から1問ずつ答えます（タイプ・年齢・年収・貯金・家賃など）。全部選ぶまで、見本の数字は出ません。", go: "start" },
      { title: "③ ¥〜⑧ を順番に説明する", body: "どのお客様にも同じ順番で説明します。iPhoneは下の「次へ」、Zoomは「画面共有モード」。⑥の適性チェックはお客様と一緒にボタンで答えます。", go: "talk" },
      { title: "④ お客様を登録する", body: "「保存したお客様」→ お名前を入れて「登録する」。次からは最初の画面の「続きから」ですぐ開けます。", go: "save" },
      { title: "⑤ 資料・提案書を出す", body: "「お客様に見せる資料（16:9）」は画面共有に、「提案書（A4・PDF）」はお渡し用に。数字はすべてお客様の条件から計算されます。", go: "deck" },
      { title: "⑥ 知識を深める・端末を替える", body: "看板のエリアを押すとノウハウのページ。「営業の知識（社内用）」で切り返しも確認。別の端末へは「保存したお客様」→「ほかの端末へ移す」。", go: "guide" },
    ],
    rules: [
      "数字はすべて概算です。将来の金利・価格・年金を約束するものではありません",
      "値上がりや審査の結果を言い切ったり、期限で急がせたりする言い方はしません",
      "住宅ローンを決めるのは金融機関です。事前審査は無料で、買う義務はありません",
      "お客様のお名前は、この端末の中だけに保存されます。共用の端末では使い終わったら消してください",
    ],
  };
  // ───── エリアのノウハウ（看板のエリアを押すと開くページ）：お客様の数字がなくても見られる一般的な知識 ─────
  // 驚きの数字は計算で出す。制度の数字は2026年10月に公式資料で確かめた値（高額療養費は2026年8月、iDeCoは2026年12月、新築の固定資産税は令和8年度改正）。変わったら更新する。断定しない
  const GUIDE_KEYS = ["nisa", "world", "home", "ins", "plan", "cash", "pension"];
  function guide(key) {
    const E = ECONOMY, P = PENSION;
    const nisaFv = (() => { const r = 0.03 / 12, n = 240; return 30_000 * ((Math.pow(1 + r, n) - 1) / r); })();
    const cashReal = 1_000_000 * Math.pow((1 + E.deposit.rate) / (1 + E.cpi.rate), 10);
    const kogaku = 85_800 + (1_000_000 - 286_000) * 0.01; // 2026年8月の見直し後・年収約370〜510万円
    const creditYears = Math.max(...Object.values(CREDIT_KINDS).map((v) => v.years));
    const halfYears = Math.round(72 / (E.cpi.rate * 100));
    const common = "※一般的な情報で、2026年10月時点の目安です。制度・数字は変わることがあり、将来の値動きや結果を約束するものではありません。";
    const G = {
      nisa: { title: "NISAエリア", icon: "nisa", area: "nisa",
        catch: "NISAは、売っても枠が翌年に戻ってくる。",
        lead: "利益に約20%かかる税金が、NISAの中ならかかりません。しくみを知ると、ムダなく長く使えます。",
        big: { value: man(nisaFv), label: "毎月3万円を20年、年3%で増えた場合", note: `元本720万円（仮定の計算・元本保証なし。値下がりすることもあります）` },
        tips: [
          { head: "1年に360万円、一生で1,800万円まで", body: "つみたて投資枠が年120万円、成長投資枠が年240万円。一生で使える枠は1,800万円（うち成長投資枠は1,200万円まで）です。" },
          { head: "売ると、その分の枠が翌年に復活", body: "売った商品を買ったときの金額の分だけ、翌年に一生の枠が戻ります。急な出費で売っても、枠はなくなりません（1年に使える額は360万円まで）。" },
          { head: "非課税の期間は無期限", body: "いつまで持っていても税金はかかりません。期限を気にして売る必要はありません。" },
          { head: "利益100万円なら、約20万円の差", body: "ふつうの口座では利益に20.315%の税金がかかります。NISAなら、その分がそのまま手元に残ります。" },
          { head: "損は、ほかと相殺できない", body: "NISAで出た損は、ほかの口座の利益と相殺（損益通算）できず、翌年への繰り越しもできません。値下がりの可能性も知ったうえで使いましょう。" },
          { head: "毎年かかる手数料に注目", body: "投資信託は持っている間ずっと手数料（信託報酬）がかかります。年0.1%と1%の差は、長く持つほど大きくなります。" },
        ],
        myths: [{ q: "NISAなら損はしない？", a: "しません、とは言えません。値下がりすることがあり、元本は保証されません。税金がかからないだけです。" },
          { q: "NISAの口座はいくつも作れる？", a: "1人1口座です。金融機関は1年ごとに変えられます。" }],
        todo: ["口座をつくる金融機関を、手数料と商品の数で比べる", "生活費の3〜6か月分を残したうえで、毎月いくらなら続けられるか決める", "固定費（家賃・通信・保険）を見直して、積立のお金をつくる"],
        sources: ["金融庁 NISA特設ウェブサイト"] },
      world: { title: "海外投資エリア", icon: "nisa", area: "nisa",
        catch: "日本の株だけだと、世界の株の約5%にしか投資していない。",
        lead: "世界の株式の時価総額のうち、日本はおよそ5%（時期で変わります）。残りの95%に、少額から分散する方法があります。",
        big: { value: "約5%", label: "世界の株式の時価総額に占める日本の割合（目安）", note: "世界の株価指数での目安。時期で変わります" },
        tips: [
          { head: "NISAの中で、少額から世界に分散", body: "全世界株や米国株のインデックス投資信託なら、1本で何千社にも分けて投資できます。NISAの中でも買えます。" },
          { head: "為替で、円での値段が動く", body: "円安になると円での価値は上がり、円高になると下がります。為替ヘッジありの商品は為替の影響を抑えますが、その分のコストがかかります。" },
          { head: "外国で引かれた税金は、NISAでは戻らない", body: "外国の株の配当には、その国の税金がかかることがあります。NISAでは日本の税金はかかりませんが、外国で引かれた分を取り戻す外国税額控除は使えません。" },
          { head: "時期を分けて買うと、上下をならしやすい", body: "毎月同じ額を積み立てると、高いときは少なく、安いときは多く買えます。為替や株価の上下をならしやすくなります。" },
          { head: "「元本保証で高利回り」は要注意", body: "海外の不動産や未公開株などで「元本保証・高利回り」をうたう話は、金融庁も注意を呼びかける詐欺の典型です。困ったら消費者ホットライン188へ。" },
        ],
        myths: [{ q: "日本の株だけなら安全？", a: "1つの国に集中することもリスクです。国や地域を分けると、1つの国の不調の影響を小さくできます。" },
          { q: "円安なら海外投資は得をする？", a: "円安のときは得に見えますが、円高に戻ると円での値段は下がります。為替は上がることも下がることもあります。" }],
        todo: ["持っている投資信託の中身（国の割合）を確かめる", "同じような商品なら、手数料（信託報酬）の低いほうを比べる", "「確実に儲かる」と言われたら、決める前に家族や188に相談する"],
        sources: ["世界の株価指数の国別構成（目安）", "金融庁「投資詐欺にご注意ください」"] },
      home: { title: "不動産エリア", icon: "home", area: "home",
        catch: "家が建っている土地は、固定資産税が最大6分の1になる。",
        lead: "住宅には、税金・保険・金利の「知っている人だけ得をする」しくみがいくつもあります。",
        big: { value: "6分の1", label: "住宅が建つ土地（200㎡まで）の固定資産税の課税標準", note: "住宅用地の特例。200㎡を超える部分は3分の1。市町村で確認できます" },
        tips: [
          { head: `住宅ローン控除：残高の0.7%が最大${creditYears}年戻る`, body: `年末のローン残高の0.7%を、所得税（引ききれない分は住民税の一部）から差し引けます。入居の年・家の種類で上限と年数が変わります（中古は10年の場合も）。` },
          { head: "団信＝住宅ローンについた生命保険", body: "借りた人に万一があると、残りのローンは保険で返されます。一般の団信の保険料はふつう金利に含まれています。今の生命保険を見直すきっかけにもなります。" },
          { head: "変動金利の「5年ルール」「125%ルール」", body: "金利が上がっても5年は返済額が変わらず、変わるときも前の1.25倍まで、というしくみがある金融機関があります（ない所もあります）。返しきれない利息が残ることもあるので要注意です。" },
          { head: "繰上げ返済は「期間短縮型」が利息を減らす", body: "同じ額を繰上げ返済するなら、返す期間を短くするほうが利息を減らす効果が大きくなります。毎月を楽にしたいなら返済額軽減型です。" },
          { head: "住んだ家を売るとき、利益から3,000万円まで差し引ける", body: "自分が住んでいた家を売って利益が出たとき、条件を満たせば3,000万円までの特別控除があります。" },
          { head: "新築の建物は、固定資産税が一定期間2分の1", body: "新築住宅は、建物の固定資産税（床面積120㎡分まで）が戸建てで3年間、マンションで5年間、2分の1になります（長期優良住宅は5年・7年）。令和8年度の改正で、令和13年3月31日までに新築した住宅まで延長されました。" },
        ],
        myths: [{ q: "家は値上がりするもの？", a: "下がることもあります。値上がりをあてにせず、住むために払える範囲で考えるのが安全です。" },
          { q: "家賃と返済、毎月の額だけ比べればいい？", a: "持ち家は税金・保険・修繕もかかります。LIFE ROUTEでは95歳までの住居費をまとめて比べます。" }],
        todo: ["CICで自分の信用情報を取り寄せる（ネット500円）", "今の家賃と同じくらいの返済で、いくら借りられるかを見る", "事前審査（無料・買う義務なし）で、借りられる額を確かめる"],
        sources: ["国税庁 住宅借入金等特別控除", "総務省 固定資産税（住宅用地の特例）", "国土交通省 新築住宅に係る税額の減額措置（令和8年度税制改正）", "国税庁 居住用財産を譲渡した場合の3,000万円の特別控除"] },
      ins: { title: "保険エリア", icon: "ins", area: "ins",
        catch: "医療費が100万円かかっても、自己負担は約9.3万円で済む場合がある。",
        lead: "日本には、会社員なら入っている公的な保障があります。民間の保険は、その足りない分だけで十分なことも。",
        big: { value: `${kogaku.toLocaleString()}円`, label: "医療費100万円の月の自己負担（年収約370〜510万円の場合・2026年8月から）", note: "高額療養費制度。2026年8月に上限が見直され、1年の合計に上限（年間上限）もできました。所得の区分で変わります" },
        tips: [
          { head: "高額療養費制度で、ひと月の上限が決まっている", body: "医療費の自己負担には、所得に応じたひと月の上限があります。2026年8月からは、年収約370〜510万円なら85,800円＋（医療費−286,000円）×1%。さらに、1年の合計が年間上限に届くと、それ以上はかかりません（年間上限）。" },
          { head: "働けないときは、傷病手当金", body: "会社員が病気やけがで働けないとき、健康保険から給料のおよそ3分の2が、最長1年6か月受け取れます。" },
          { head: "万一のときは、遺族年金も", body: "子どものいる配偶者などには遺族年金があります。必要な保障は「必要なお金−公的な保障−貯蓄」で考えます。" },
          { head: "家を買うと、団信が保障の一部になる", body: "住宅ローンの団信で、住まいのお金は保険で返されます。家を買ったら、今の死亡保障が多すぎないか見直しましょう。" },
          { head: "貯蓄型の保険は、早い解約で元本割れしやすい", body: ECONOMY.savingsIns },
          { head: "生命保険料控除で、税金が少し戻る", body: "払った生命保険料に応じて、所得税・住民税の課税される所得が少し減ります。年末調整で申告します。" },
        ],
        myths: [{ q: "保険はたくさん入るほど安心？", a: "公的な保障と重なる分は、払いすぎになっていることがあります。足りない分だけにすると家計が楽になります。" },
          { q: "医療保険がないと入院できない？", a: "健康保険と高額療養費制度があります。貯蓄で払える分は、保険にしない考え方もあります。" }],
        todo: ["保険証券を出して、保障の内容と毎月の保険料を一覧にする", "会社の健康保険の付加給付（上乗せ）を確かめる", "家を買うなら、団信と重なる保障がないか確かめる"],
        sources: ["厚生労働省「高額療養費制度を利用される皆さまへ」（2026年8月の見直し）", "全国健康保険協会 傷病手当金", "日本年金機構 遺族年金"] },
      plan: { title: "ライフプランエリア", icon: "plan", area: "plan",
        catch: "年3%で増えると、お金は約24年で2倍になる（72の法則）。",
        lead: "人生の大きなお金は、住まい・教育・老後の3つ。並べて見るだけで、いつ何を準備すればいいかが見えてきます。",
        big: { value: "約24年", label: "年3%で増えたとき、お金が2倍になるまで（72÷3）", note: "72の法則による目安。増え方は約束されません" },
        tips: [
          { head: "人生の3大資金＝住まい・教育・老後", body: "時期が重なると苦しくなります。年表に並べて、重ならないように準備します。" },
          { head: "72の法則は、物価にも使える", body: `72÷年利で、2倍になる年数の目安。物価が年${(E.cpi.rate * 100).toFixed(1)}%上がり続けると、約${halfYears}年でお金の価値は半分になります。` },
          { head: "先取り貯蓄", body: "給料が入ったら、まず決めた額を積立口座へ。残りで暮らすと、自然にお金が貯まります。" },
          { head: "キャッシュフロー表で、足りない年が見える", body: "毎年の収入・支出・貯蓄残高を並べると、お金が足りなくなる年が前もってわかります。" },
          { head: "定年後は、収入が下がることが多い", body: "再雇用で収入が下がることがよくあります（LIFE ROUTEは6割で計算）。住宅ローンを定年までに返す計画か確かめましょう。" },
        ],
        myths: [{ q: "ライフプランはお金持ちのためのもの？", a: "収入が限られているほど、大きな出費の時期を前もって知ることが役に立ちます。" },
          { q: "一度つくったら終わり？", a: "結婚・転職・子どもなどで変わります。1年に1回、見直すのがおすすめです。" }],
        todo: ["10年後・20年後にどこでどう暮らしたいか、書き出す", "LIFE ROUTEで、95歳までのお金の流れを見る", "毎年1回、同じ日に見直す日を決める"],
        sources: ["日本FP協会（ライフプラン・キャッシュフロー表の考え方）"] },
      cash: { title: "現預金エリア", icon: "cash", area: "cash",
        catch: `100万円を10年置いておくと、買える量は約${Math.round(cashReal / 10_000)}万円分に。`,
        lead: "預金は額が減らない安心なお金。でも物価が上がると、同じ額で買えるものは少なくなります。",
        big: { value: man(cashReal), label: `100万円を10年、普通預金に置いた場合の買える量`, note: `${E.asOf}の物価 +${(E.cpi.rate * 100).toFixed(1)}%・普通預金 年${(E.deposit.rate * 100).toFixed(1)}%が続いたと仮定。物価や金利は変わります` },
        tips: [
          { head: "生活防衛資金は、生活費の3〜6か月分", body: "急な病気や転職に備えて、すぐ使える預金で持っておきます。これがあると、投資の値下がりにもあわてずに済みます。" },
          { head: "物価が上がると、預金の価値は目減りする", body: `${E.cpi.label}。普通預金の金利（${E.deposit.label}）を上回ると、買える量は少しずつ減ります。` },
          { head: "預金は1,000万円とその利息まで守られる", body: "銀行が破たんしても、1つの銀行につき元本1,000万円とその利息までは預金保険で保護されます（利息のつかない決済用預金は全額）。" },
          { head: "お金を「使う・備える・増やす」に分ける", body: "生活費の口座、生活防衛資金、長く置ける資金（NISAなど）に分けると、迷わずに済みます。" },
          { head: "自動で積立が、いちばん続く", body: "給料日に自動で別の口座へ移すしくみにすると、意志に頼らず貯まります。" },
        ],
        myths: [{ q: "預金なら絶対に安全？", a: "額は減りませんが、物価が上がれば買える量は減ります。安全の意味を分けて考えましょう。" },
          { q: "お金は全部投資したほうがいい？", a: "すぐ使うお金と生活防衛資金は預金で。長く置けるお金だけを投資に回すのが基本です。" }],
        todo: ["毎月の生活費を出して、その3〜6か月分を確かめる", "給料日に自動で積立する設定をする", "1つの銀行に1,000万円を超えて預けていないか確かめる"],
        sources: [E.cpi.src, E.deposit.src, "預金保険機構"] },
      pension: { title: "年金2000万円問題", icon: "plan", talk: "③",
        catch: "年金は、受け取りを遅らせると最大84%増える。",
        lead: "「老後に2000万円足りない」は、2019年の報告書の、当時の平均的な夫婦の計算。あなたに必要な額は、あなたの数字で変わります。",
        big: { value: "最大84%増", label: "75歳まで受け取りを遅らせた場合（繰下げ受給）", note: "1か月遅らせるごとに0.7%増。早めると減ります。受け取る総額は何歳まで生きるかで変わります" },
        tips: [
          { head: "2000万円の中身は「毎月5.5万円×30年」", body: `${E.report2000.src}。${E.report2000.who}の、当時の平均の収入と支出の差です。人によって大きく違います。` },
          { head: `老齢基礎年金の満額は年${P.basicFull.toLocaleString()}円`, body: `令和8年度の額で、月にすると約${Math.round(P.basicFull / 12).toLocaleString()}円。会社員はこれに厚生年金が加わります。金額は毎年度改定されます。` },
          { head: "受け取りは60〜75歳で選べる", body: "66〜75歳に遅らせると1か月0.7%ずつ増え（75歳で84%増）、60〜64歳に早めると1か月0.4%ずつ減ります。" },
          { head: "ねんきんネットで、自分の見込み額がわかる", body: "マイナポータルからも使えます。働き方を変えた場合の試算もできます。" },
          { head: "iDeCoは、掛金が全額所得控除。2026年12月から枠が拡大", body: "掛けたお金の分だけ税金が軽くなります。2026年12月から、会社員の上限は企業年金と合わせて月6.2万円、自営業は月7.5万円に上がり、70歳になるまで加入できるようになります。原則60歳まで引き出せません。" },
        ],
        myths: [{ q: "年金は将来もらえない？", a: "公的年金は国の制度で、受け取れなくなるわけではありません。ただ、金額は見通しで変わります。" },
          { q: "誰でも2000万円足りない？", a: "暮らし方・住まい・年金の額で違います。持ち家か賃貸かでも大きく変わります。" }],
        todo: ["ねんきんネットに登録して、見込み額を見る", "老後の家賃がかかるかどうかを考える（LIFE ROUTEの③）", "NISA・iDeCoで、65歳までに準備する額を決める"],
        sources: [E.report2000.src, "日本年金機構（令和8年度の年金額・繰上げ／繰下げ）", "厚生労働省 Webマガジン「2026年12月からiDeCoがパワーアップ！」（2026年10月20日）"] },
    };
    const g = G[key];
    return g ? { key, ...g, note: common } : null;
  }
  function economy(x) {
    const i = x.input, E = ECONOMY, n = Math.max(0, i.retireAge - i.age);
    const factor = Math.pow(1 + E.cpi.rate, n);
    const nominal65 = i.savings * Math.pow(1 + E.deposit.rate, n), real65 = i.savings * Math.pow((1 + E.deposit.rate) / (1 + E.cpi.rate), n);
    const R = E.report2000, rent = x.old.rent.need, own = x.old.own.need;
    return {
      years: n, factor, living65: x.pension.living * factor,
      savings: { now: i.savings, nominal65, real65, lossRate: i.savings > 0 ? 1 - real65 / i.savings : 0 },
      vs2000: { report: R.total, rent, own,
        line: `老後2000万円問題：2019年の報告書の2000万円は、${R.who}の毎月約${(R.gapMonthly / 10000).toFixed(1)}万円の不足×${R.years}年の計算です。あなたの場合（${i.retireAge}〜${i.lifeEnd}歳）の不足は　賃貸のまま ${man(rent)}／持ち家 ${man(own)}` },
      line: `物価と預金（${E.asOf}）：${E.cpi.month}の物価は前年より+${(E.cpi.rate * 100).toFixed(1)}%、メガバンクの普通預金は年${(E.deposit.rate * 100).toFixed(1)}%。仮にこのまま${n}年続くと、${i.retireAge}歳の生活費は今の毎月 ${man(x.pension.living, 1)} が ${man(x.pension.living * factor, 1)} 相当に` +
        (i.savings > 0 ? `、預金 ${man(i.savings)} は利息で ${man(nominal65)} になっても、買える量は今の ${man(real65)} 分（約${Math.round((1 - real65 / i.savings) * 100)}%目減り）` : "") + `。物価も金利も上がったり下がったりします（この試算の金額は物価を一定で計算）`,
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
  // 独身のお客様に見せる「買うのは、家だけじゃない。自分の好きに使える空間だ。」（趣味・仕事・くつろぎの部屋）。結婚・子どもありには出さない
  function spaceImage(x) {
    return x.input.family.marryAge == null
      ? { src: "img/space-single.jpg", alt: "買うのは、家だけじゃない。自分の好きに使える空間だ。一人暮らしに、戸建てという選択。趣味に没頭する部屋・仕事に集中する部屋・心からくつろぐ部屋。一人だからこそ、暮らしを自由に。" }
      : null;
  }
  // 「毎月の家賃、そのまま払い続けますか？」：賃貸と購入で毎月払うお金が10年後・20年後にどう変わるか（お客様の数字・横ばいシナリオ）
  // 売却費用は仲介手数料の上限（価格×3%＋6万円、税込）。手元の目安はマイナスでもそのまま出す
  function future(x) {
    const i = x.input, o = i.own, L = x.loan, b = L.buyAge;
    const at = (age) => x.years.find((y) => y.age === age) || x.years[x.years.length - 1];
    const y0 = at(b);
    const valueAt = (t) => o.price * o.landShare * Math.pow(1 + i.landRates.flat, t) + o.price * (1 - o.landShare) * Math.max(0.1, 1 - (0.9 * t) / 30);
    const points = [...new Set([10, 20, o.years])].filter((n) => n <= o.years && b + n <= i.lifeEnd).map((n) => {
      const ys = x.years.filter((y) => y.age >= b && y.age < b + n);
      const sum = (k) => ys.reduce((s2, y) => s2 + (typeof k === "function" ? k(y) : y[k]), 0);
      const balance = balanceAfter(L.amount, o.rate, o.years, Math.min(n * 12, L.months));
      const value = valueAt(n), saleCost = (value * 0.03 + 60_000) * 1.1;
      return { years: n, age: b + n, rentPaid: sum((y) => y.rentPart + y.renewPart), loanPaid: sum("ownLoan"), upkeep: sum("ownUpkeep"),
        balance, principal: L.amount - balance, value, saleCost, net: value - balance - saleCost, paidOff: balance < 1 };
    });
    const paidOff = at(Math.min(L.endAge, i.lifeEnd));
    return {
      title: "毎月の家賃、そのまま払い続けますか？", sub: "同じ住居費でも、10年後・20年後の未来は変わる。",
      monthly: { rent: y0.rentMonthly, loan: L.pmt, upkeep: y0.ownUpkeep / 12, own: L.pmt + y0.ownUpkeep / 12 },
      points,
      old: { rent: i.rent.old, own: paidOff.ownUpkeep / 12, from: L.endAge,
        options: ["完済後は、税金・保険・修繕だけで住み続ける", "暮らしに合わせて住み替える（売って次の住まいへ）", "売却・賃貸に出すという選択肢も残る"] },
      merits: [
        { key: "equity", title: "返した元金が、家の代金として残る", text: "返済のうち元金の分だけ、自分の持分が増える（家の価値は上下する）" },
        { key: "old", title: "完済後の住居費が抑えられる", text: `完済後は税金・保険・修繕だけ（毎月 ${man(paidOff.ownUpkeep / 12, 1)}の目安）` },
        { key: "free", title: "暮らしを自分で決められる", text: "間取り・リフォーム・庭の使い方を自分好みに" },
        { key: "options", title: "売却・賃貸という選択肢", text: "暮らしが変わったら、売る・貸すも選べる（立地・状態で変わる）" },
        { key: "danshin", title: "団信で、もしものときも", text: i.family.marryAge == null ? "万一のとき残りのローンは保険で返され、親や兄弟に残らない" : "万一のとき残りのローンは保険で返され、家族に住まいが残る" },
      ],
      catch: "家賃は、住むための支払い。住宅ローンは、住みながら自分の家を持つための支払い。",
      note: "金額はお客様の条件での概算（仮定）です。購入には頭金・諸費用・固定資産税・保険・修繕費などがかかり、建物や土地の価値は下がる場合もあります。家の価値は横ばいのシナリオ、売却費用は仲介手数料の上限で計算。",
    };
  }
  // 「今払ってる賃料が将来の資産になる」（ユーザーの絵）。家賃そのものではなく、家賃のかわりに返した元金（＋頭金）が家の代金として残る、と正直に添える
  function assetImage(x) {
    const cc = costCompare(x);
    return { src: "img/rent-to-asset.jpg", alt: "今払ってる賃料が将来の資産になる。住む場所を、出費から資産へ。賃貸：払い続けても自分のものにならない／購入：今の支払いが将来の資産になる。積み上がる硬貨と家の模型、右肩上がりの矢印、夕日の戸建て（イメージ）",
      caption: `家賃のかわりに返したローンの元金（頭金を含む）${man(cc.own.house)}は、家の代金として自分の家に残ります。家の価値は上がることも下がることもあります（イメージ）` };
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

  // 事前審査の前に、自分の信用を知る（⑥・資料「審査の前に」）。銀行名は出さない。承認は本審査・融資を保証しない
  function screenPrep(x) {
    const R = PASS_RATE, g = gate(x);
    return {
      passRate: R,
      head: `住宅ローンの審査が通るのは、当社の目安で${R.of}人中${R.low}〜${R.high}人。`,
      rateNote: `※${R.note}。金融機関・年収・物件・借入の状況で大きく変わります。`,
      white: "返済の遅れなどの記録がなくても、金融機関の審査の基準で通らないことがあります。だからこそ、まず自分の信用情報を確かめます。",
      cases: [
        { name: "クレジットカードの支払いの遅れ", kind: "record", what: "1回の遅れでも、信用情報に記録されることがあります" },
        { name: "スマホ本体の分割払いの遅れ", kind: "record", what: "携帯料金と一緒に払う端末代の遅れも、信用情報に記録されることがあります" },
        { name: "カード・ローンの数や利用枠", kind: "rule", what: "利用枠やリボ・分割の残りが多いと、借りられる額が減ることがあります" },
        { name: "勤務先・勤続年数", kind: "rule", what: "転職したばかり・勤続が短いと、収入の安定を慎重に見られることがあります" },
        { name: "転勤の予定", kind: "rule", what: "住宅ローンは自分が住む家が前提。近く転勤の予定があると、住み続けられるか確かめられることがあります" },
        { name: "物件の評価", kind: "rule", what: "物件の担保の評価が借りたい額に届かないと、減額や否決になる場合があります" },
      ],
      records: ["クレジットカードの支払い状況", "スマホ本体の分割払い", "自動車ローン", "そのほかのローン（教育・カードローンなど）", "ローンやカードの申し込みの記録"],
      check: g.checks,
      steps: [
        { name: "信用情報を確かめる（CIC）", what: `スマホから取り寄せられます（ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円）。必要に応じてJICC・全国銀行個人信用情報センターも` },
        { name: "住宅ローンの適性チェック", what: "年収・勤続年数・雇用形態・転勤の予定・他の借入・返済の割合・買ったあと住むか、を一緒に確かめます" },
        { name: "金融機関へ事前審査", what: "お客様に合う金融機関を選び、ご本人の同意のうえで申し込みます（無料）" },
        { name: "結果を確かめる", what: "承認なら、借りられる見込みの額がわかります。本審査や融資を保証するものではありません。有効期限があり、家を買う義務もありません" },
        { name: "買うかどうかは自分で決める", what: "結果というチケットを、今は使わずに持っておくか、使って購入へ進むか" },
      ],
      keep: { name: "今は使わない（保留）", items: ["ライフプランに合わせて時期を待つ", "貯金や頭金を準備する", "転勤など、条件が落ち着くまで待つ"] },
      use: { name: "チケットを使う（購入へ進む）", items: ["条件に合う物件を探す", "くわしい資金計画をつくる", `本審査・契約（${FLOW.slice(2, 5).map((f) => f.name).join("→")}）`, "引き渡し・入居"] },
      options: [
        { name: "住みたい家に住む", what: "住む場所と間取りを、自分で選べる" },
        { name: "資産として持つ", what: "返したぶんが家として残る（家の価値は上がることも下がることもあります）" },
        { name: "暮らしに合わせて売る・住み替える", what: "転勤・結婚など、変わったときに選び直せる（売れる値段は時期と物件しだい）" },
        { name: "老後の住居費を抑える", what: "完済後は家賃がかからない（税金・修繕はかかります）" },
      ],
      catch: "今の信用を知ることが、これからの選択肢を広げる。",
      note: "※事前審査の承認は、住宅ローンの契約や本審査・融資を保証するものではありません。審査の基準・条件は金融機関によって異なります。",
    };
  }
  // 住宅ローンの適性チェック（⑥）：お客様と一緒に答えて、事前審査の前に「確かめること」を出す。合否は出さない。答えは保存しない
  const FIT_ITEMS = [
    { key: "late", q: "この2年ほどで、カード・スマホ代・ローンの支払いが遅れたことはありますか？", options: [
      { v: "no", label: "ない", ok: true },
      { v: "yes", label: "ある", ok: false, todo: "CICで記録を確かめる（支払いの遅れの記録は、審査で見られることがあります）" },
      { v: "unknown", label: "わからない", ok: false, todo: "CICで信用情報を取り寄せて、記録がないか確かめる" }] },
    { key: "phone", q: "スマホ本体を分割払いで買っていますか？", options: [
      { v: "no", label: "いいえ（一括など）", ok: true },
      { v: "yes", label: "はい", ok: false, todo: "端末の分割払いも借入として記録されます。残りの額と、遅れがないかをCICで確かめる" }] },
    { key: "cards", q: "クレジットカードは何枚お持ちですか？", options: [
      { v: "few", label: "0〜2枚", ok: true },
      { v: "some", label: "3〜4枚", ok: false, todo: "使っていないカードの解約を検討する（利用枠が多いと、借りられる額が減ることがあります）" },
      { v: "many", label: "5枚以上", ok: false, todo: "使っていないカードの解約を検討する（利用枠が多いと、借りられる額が減ることがあります）" }] },
    { key: "revo", q: "リボ払い・キャッシング・カードローンの残りはありますか？", options: [
      { v: "no", label: "ない", ok: true },
      { v: "yes", label: "ある", ok: false, todo: "リボ・キャッシングの残りを先に減らせるか確かめる（返済の割合に入ります）" }] },
    { key: "loans", q: "車のローン・奨学金など、ほかの借入はありますか？", options: [
      { v: "no", label: "ない", ok: true },
      { v: "yes", label: "ある", ok: false, todo: "毎月の返済額を入力して、ほかの借入を含めた返済の割合を確かめる" }] },
    { key: "tenure", q: "今の会社で何年目ですか？", options: [
      { v: "lt1", label: "1年未満", ok: false, todo: "勤続が短いと慎重に見られることがあります。申し込める金融機関を担当と相談する" },
      { v: "y1", label: "1〜3年", ok: true },
      { v: "y3", label: "3年以上", ok: true }] },
    { key: "employ", q: "働き方はどれですか？", options: [
      { v: "regular", label: "正社員", ok: true },
      { v: "contract", label: "契約・派遣・パート", ok: false, todo: "契約の更新や勤続の実績を見られることがあります。扱いのある金融機関を選ぶ" },
      { v: "self", label: "個人事業主", ok: false, todo: "確定申告書（直近2〜3期分）をそろえて、所得の推移を確かめる" }] },
    { key: "apply", q: "この半年で、カードやローンを新しく申し込みましたか？", options: [
      { v: "no", label: "いいえ", ok: true },
      { v: "yes", label: "はい", ok: false, todo: "申し込みの記録は約6か月残ります。事前審査の前に、新しい申し込みは控える" }] },
    { key: "transfer", q: "1〜2年のうちに、転勤の予定はありますか？", options: [
      { v: "no", label: "ない", ok: true },
      { v: "maybe", label: "ありそう・わからない", ok: false, todo: "住宅ローンは自分が住む家が前提。転勤になったときの選択肢（⑤）を先に確かめる" }] },
    { key: "live", q: "買った家に、ご自分で住みますか？", options: [
      { v: "yes", label: "はい", ok: true },
      { v: "no", label: "いいえ（貸す・投資用）", ok: false, todo: "自分が住まない家（貸す・投資用）には、住宅ローンは使えません。別の方法を相談する" }] },
    { key: "health", q: "持病や通院を含めて、団信（団体信用生命保険）に入れそうですか？", options: [
      { v: "yes", label: "入れそう", ok: true },
      { v: "unknown", label: "持病がある・わからない", ok: false, todo: "団信の告知の内容を確かめる（引き受けの条件がゆるい団信を扱う金融機関もあります）" }] },
  ];
  function fitCheck(x, ans = {}) {
    const i = x.input;
    const auto = { employ: i.job === "self" ? "self" : null, transfer: i.transfer && i.transfer.on ? "maybe" : null, loans: i.debt && i.debt.monthly > 0 ? "yes" : null };
    const items = FIT_ITEMS.map((it) => {
      const given = it.options.some((o) => o.v === ans[it.key]) ? ans[it.key] : null;
      const answer = given || auto[it.key] || null, o = it.options.find((v) => v.v === answer);
      return { key: it.key, q: it.q, options: it.options, answer, auto: !given && !!auto[it.key], ok: o ? o.ok : null, todo: o && !o.ok ? o.todo : null, label: o ? o.label : null };
    });
    const answered = items.filter((v) => v.answer).length;
    const todos = items.filter((v) => v.todo).map((v) => ({ key: v.key, q: v.q, answer: v.label, todo: v.todo }));
    const summary = !answered ? "下の質問に答えると、事前審査の前に確かめることがわかります。"
      : todos.length ? `事前審査の前に確かめることが${todos.length}つあります。ひとつずつ整えてから申し込みましょう。決めるのは金融機関です。`
      : "今の答えでは、事前審査の前に確かめることは見つかりませんでした。実際は金融機関の審査で決まります。";
    return { items, answered, total: FIT_ITEMS.length, todos, numbers: gate(x).checks, summary,
      note: "※このチェックは目安で、合否を判定するものではありません。最後は金融機関が決めます。答えは保存せず、共有リンクにも入りません。" };
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
    if (i.debt.monthly > 0) {
      const r = i.income > 0 ? ((L.pmt + i.debt.monthly) * 12) / i.income : Infinity;
      checks.push({ key: "debt", label: "他の借入を含む返済比率（車・カード・リボ・奨学金も入る）", value: `${pct(r)}（目安 ${pct(lim)}以内・他の借入 毎月 ${man(i.debt.monthly, 1)}）`, ok: r <= lim });
    }
    const allOk = checks.every((c) => c.ok);
    return {
      passRate: PASS_RATE, checks, allOk,
      verdict: allOk ? "数字の目安の上では、土台に乗る可能性があります。ただし、実際は融資する金融機関が決めます。"
        : "目安を超える項目があります。借りる額・頭金・返済期間を見直してから確かめましょう。実際は融資する金融機関が決めます。",
      docs: screenDocs(x), flow: FLOW,
      lookAt: ["勤続年数・雇用形態（正社員・派遣など）", "他の借入（車のローン・カード・リボ・奨学金）", "返済の遅れがないか（信用情報）", "健康状態（団信に入れるか）", "物件の担保評価"],
      steps: [
        `⓪ まず自分で：CICで信用情報を取り寄せる（本人開示：ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円）。${CIC.why}`,
        `① できるか：本人確認書類（${SCREEN_DOCS[1].what}）と${screenDocs(x)[2].name}（${screenDocs(x)[2].what}）をそろえて、住宅ローンの事前審査（無料・購入の義務はありません）で、金融機関に借りられる額を確かめる`,
        `② その土台に乗ったら：通った金額の範囲で、やるか・やらないかを決める（このあと ${FLOW.slice(1).map((f) => f.name).join(" → ")}）`,
        "通らなかったら：理由になりそうな点（他の借入・勤続・頭金）を整えて時期を改める／賃貸のまま準備する",
      ],
    };
  }

  // ── 現場が必要としている知識（販売に必要な知識マトリクス・出現頻度順）──
  // ① 転勤：貸した場合（家賃−管理費5%−空室1か月/年）と、返済＋維持費をくらべる。売った場合は future の10年後。控除の扱いは国税庁の取り扱い（家族の住み方で変わる）
  function transfer(x) {
    const t = x.input.transfer, f = future(x);
    const netMonthly = t.leaseRent * 0.95 * 11 / 12, outMonthly = f.monthly.own;
    return {
      on: t.on,
      ask: ["転勤の頻度と、今後の見通し", "転勤のときは単身赴任か、家族と一緒か", "社宅・住宅手当の内容と、いつまで出るか", "定年後に住みたい地域（実家の近く・今の地域など）"],
      options: [
        { name: "単身赴任（ご家族が住み続ける）", credit: "住宅ローン控除はそのまま続く" },
        { name: "転勤の間だけ貸す", credit: "住んでいない間は控除が止まる。戻った翌年以降に再開" },
        { name: "売る", credit: "控除は終わる。売った場合の手元は下の目安" },
      ],
      creditNote: "家族全員で引っ越すと、その間は控除が止まり、控除の期間は延びない。戻って再び受けるには、引っ越す前に税務署へ「転任の命令等により居住しないこととなる旨の届出書」を出しておく。税制は変わるので税務署・税理士で確認",
      lease: { rent: t.leaseRent, netMonthly, outMonthly, gap: netMonthly - outMonthly,
        note: "貸すには金融機関の承諾が必要（住宅ローンは本人が住む前提。無断で貸すと一括返済を求められるおそれ）。家賃は管理費5%・空室1か月/年を引いた目安で、空室が続けばその分は持ち出し" },
      sale: f.points[0] ? { years: f.points[0].years, net: f.points[0].net, value: f.points[0].value, balance: f.points[0].balance } : null,
      axes: ["① 貸しやすい（駅に近い・需要のある間取り）", "② 売りやすい（立地が良く、価値が下がりにくい）", "③ 戻る場所になる（実家の近く・定年後に住みたい地域）"],
      ng: ["×「貸せば家賃でローンが払えます」→ 空室や管理費のリスクがある", "×「控除は必ず続きます」→ 家族全員で転居すれば、その間は止まる", "×「黙って貸しても大丈夫」→ 契約違反のおそれ。必ず金融機関の承諾"],
    };
  }
  function transferLine(x) {
    const t = transfer(x), L = t.lease, sg = (v) => (v < 0 ? `毎月 ${man(-v, 1)} の持ち出し` : `毎月 ${man(v, 1)} の手元`);
    return `転勤したら：①単身赴任（控除はそのまま）②転勤の間だけ貸す（家賃 ${man(L.rent, 1)} → 管理費・空室を引いて ${man(L.netMonthly, 1)}、返済＋維持費 ${man(L.outMonthly, 1)} とくらべて ${sg(L.gap)}。金融機関の承諾が必要）③売る（${t.sale ? `${t.sale.years}年後に売った場合の手元の目安 ${t.sale.net < 0 ? "−" + man(-t.sale.net) : man(t.sale.net)}` : "立地と時期で変わる"}）`;
  }
  // ④ 借入：リボ・カードローンなど他の借入は、事前審査の前に整理する。段階を分けて不安を小さくする
  function debtPlan(x) {
    const m = x.input.debt.monthly;
    return { monthly: m, yearly: m * 12,
      steps: [
        { name: "借入を整理", what: m > 0 ? `他の借入 毎月 ${man(m, 1)}（年 ${man(m * 12)}）。リボ・カードローンは金利が高いので、できるものは先に返す・残高を減らす（返済比率に入る）` : "リボ・カードローン・車のローン・奨学金がないか確かめる（あれば返済比率に入る）" },
        { name: "CICで確認", what: `本人開示（ネット${CIC.methods[0].fee}円）で、遅れや申し込みの記録を自分で確かめる` },
        { name: "事前審査", what: "無料・購入の義務なし。借りられる額の目安がわかる" },
        { name: "本審査", what: "物件が決まってから。事前審査と同じ内容で、書類と物件の評価を見られる" },
      ] };
  }
  // ⑤ 金利：上がった場合の毎月と総額。変動と固定のちがい（5年ルール・125%ルールの有無は金融機関で異なる）
  function rateRisk(x) {
    const L = x.loan, o = x.input.own;
    const rows = [0.005, 0.01, 0.02].map((add) => { const pmt = payment(L.amount, o.rate + add, o.years); return { add, pmt, extraMonthly: pmt - L.pmt, extraTotal: (pmt - L.pmt) * L.months }; });
    return { rate: o.rate, pmt: L.pmt, rows,
      types: [
        { name: "変動金利", good: "今は金利が低め", watch: "金利が上がると返済が増える（下がることもある）。返済額の見直しのルール（5年ルール・125%ルール）は金融機関で異なる" },
        { name: "固定金利", good: "返済額が最後まで変わらない", watch: "変動より金利が高め。金利が下がっても返済は減らない" },
      ],
      tip: "金利が上がっても払える額で借りる・繰上げ返済の余力を残す・どちらにするかは家計と性格で決める" };
  }
  function rateLine(x) {
    const r = rateRisk(x);
    return `金利が上がったら（変動金利の場合）：${r.rows.map((v) => `+${(v.add * 100).toFixed(1)}% → 毎月 ${man(v.pmt, 1)}（+${man(v.extraMonthly, 1)}）`).join("・")}。固定金利は返済が変わらないかわりに金利が高め`;
  }
  // ③ NISAとの違い：どちらも元本保証なし。「どちらか」ではなく両方使える
  function nisaCompare(x) {
    const pf = x.portfolio, i = x.input;
    return {
      rows: [
        { label: "目的", own: "住む場所＋資産", nisa: "お金を増やす" },
        { label: "お金の出どころ", own: "家賃のかわりに返済する", nisa: "家賃とは別に積み立てる" },
        { label: "価格の変動", own: "上下する（元本保証なし）", nisa: "上下する（元本保証なし）" },
        { label: "税", own: "住宅ローン控除（払った税金の範囲で戻る）", nisa: "運用益が非課税" },
        { label: "換金しやすさ", own: "売るのに時間と費用がかかる", nisa: "比較的すぐ" },
        { label: "もしものとき", own: "団信で残りのローンがなくなる", nisa: "その時の残高" },
      ],
      now: { nisa: pf.now.nisa, monthly: i.nisa.monthly, at65: pf.at65.own.nisa },
      both: `家で住居費を固め、NISAで老後を上乗せする——両方使えます（今の積立 毎月 ${man(i.nisa.monthly, 1)} を続けた場合、${i.retireAge}歳で ${man(pf.at65.own.nisa)}・年${(i.nisa.rate * 100).toFixed(0)}%の仮定）`,
    };
  }
  // ② 家族（親）への説明：早めに同席してもらう。親の不安には数字で答え、決めるのはご本人とご家族
  function familyTalk(x) {
    const L = x.loan, bb = bubble(x);
    return {
      process: ["最初の面談で「ご家族（ご両親）にも相談しますか」と聞いておく", "2回目からはご家族も同席（オンラインでも）", "同じ資料・提案書をご家族にも渡す（共有リンクにお名前は入らない）", "ご両親の不安（バブルのころの記憶など）には、当時と今の金利の数字で答える", "最後に決めるのは、ご本人とご家族"],
      show: [`毎月の返済 ${man(L.pmt, 1)} と完済の年齢（${L.endAge}歳）`, `家の価値が下がる場合（下落シナリオ）も一緒に見せる`, `団信で、万一のときローンが残らない`, `1990年前後の金利 8.5% なら毎月 ${man(bb.bank, 1)}、今の計画は ${man(bb.now, 1)}`],
      decide: "決めるのは、ご本人とご家族です。私たちは数字をそろえてお手伝いします",
    };
  }
  // 販売に必要な知識マトリクス（出現頻度順）。where＝LIFE ROUTE のどこで見せるか
  const KNOWLEDGE = {
    tiers: [
      { name: "Tier 1 必須", note: "全担当者が即答できるレベル", items: [
        { name: "賃貸と購入のくらべ", where: "② 一生の住居費（消えるお金）・比較の表", answer: "合計ではなく「消えるお金」でくらべる。持ち家の合計には家の代金が入っている" },
        { name: "老後資金・資産形成", where: "③ 65歳から・④ 準備", answer: "老後の毎月の不足×年数＝その人の「老後2000万円問題」。持たないなら毎月いくら積み立てるか" },
        { name: "住宅ローン全般", where: "⑥ できるか・資料「進め方」", answer: "返済比率（400万円未満30%・以上35%）・年収の7倍・80歳完済。決めるのは金融機関" },
        { name: "保険（生命・医療）", where: "⑤ もしものとき（団信と生命保険）", answer: "団信はローンの残りを守る（返すほど減る）。生命保険は家族の生活費。返している間は見直せる場合あり" },
      ] },
      { name: "Tier 2 標準", note: "月1回以上使う知識", items: [
        { name: "投資用不動産", where: "営業の知識（このパネル）", answer: "住宅ローンは本人が住む家のため。投資用は別のローン・別の審査で、空室・修繕のリスクがある" },
        { name: "既存借入・リボ", where: "⑥ 他の借入を含む返済比率", answer: "車・カード・リボ・奨学金も返済比率に入る。リボ・カードローンは先に整理してから事前審査" },
        { name: "NISA・iDeCo", where: "④ NISAとの違い", answer: "どちらも元本保証なし。家は住む場所＋資産、NISAは増やす。両方使える" },
        { name: "出口戦略（売る・貸す）", where: "② 比較の表（売った場合の手元）・⑤ 転勤", answer: "売った場合の手元＝家の価値−ローン残高−売却費用。早い年はマイナスもある" },
        { name: "事前審査の進め方", where: "⑥ そろえる書類・審査のあとの流れ", answer: "CIC → 事前審査（無料・義務なし）→ 内見 → 売買契約 → 本審査 → 金消契約 → 決済" },
      ] },
      { name: "Tier 3 応用", note: "差がつく知識", items: [
        { name: "転勤リスク", where: "⑤ 転勤したら（転勤ありのお客様）", answer: "単身赴任・貸す・売るの3つ。貸すなら金融機関の承諾。控除は家族全員が転居すると止まる" },
        { name: "返済シミュレーション", where: "② 比較の表・資料「毎月の家賃…」", answer: "毎月の返済＋税金・保険・修繕を今の家賃とならべる" },
        { name: "団信", where: "⑤ 団信と生命保険", answer: "一般団信は金利に含まれ別払いなし。がん・3大疾病は金利上乗せ" },
        { name: "リフォーム・修繕", where: "② 内訳（修繕）", answer: "修繕は年15万円（20年目から1.5倍）と仮定。中古は購入前に状態を確認" },
        { name: "金融機関（地銀・労金）", where: "営業の知識（このパネル）", answer: "金利・審査の見方・団信は金融機関ごとに違う。地域の地銀・労金も含めて比べる" },
        { name: "私募債・社債", where: "営業の知識（このパネル）", answer: "不動産で決まらないときの別の選択肢。元本保証なし・途中で売りにくい。断定・勧誘はしない" },
      ] },
      { name: "Tier 4 専門", note: "武器になる知識", items: [
        { name: "CIC（信用情報）", where: "⑥ ⓪ CICを取り寄せる", answer: `本人開示 ネット${CIC.methods[0].fee}円・郵送${CIC.methods[1].fee.toLocaleString()}円。審査の前に自分で確かめる` },
        { name: "金利（変動と固定）", where: "⑤ 金利が上がったら", answer: "変動は低いが上がることがある、固定は変わらないが高め。上がっても払える額で借りる" },
        { name: "住宅ローン控除", where: "資料「住宅ローン控除」", answer: "残高×0.7%・払った税金の範囲で戻る。制度上の上限と実際の見込みを分けて話す" },
      ] },
    ],
    gaps: [
      { name: "転勤リスクを数字で", fix: "⑤「転勤したら」：貸したら毎月いくら（持ち出し/手元）・売ったらいくら・控除の扱い" },
      { name: "ご家族（親）への説明", fix: "⑧「ご家族と一緒に」：早めに同席・同じ資料を渡す・親の不安には当時と今の金利で" },
      { name: "NISAとの違い", fix: "④「NISAとの違い」：どちらも元本保証なし・役割が違う・両方使える" },
      { name: "借入不安を段階的に", fix: "⑥「他の借入を含む返済比率」と、整理 → CIC → 事前審査 → 本審査" },
      { name: "金利上昇の説明", fix: "⑤「金利が上がったら」：+0.5/+1/+2%の毎月と、変動・固定のちがい" },
    ],
  };

  // くらべ方：持ち家の合計には「家そのものの代金」（払ったあと自分の家として残る）が入っている。
  // 消えるお金＝賃貸は家賃の全部、持ち家は合計から家の代金を引いた分（利息・税金・保険・修繕・諸費用・買うまでの家賃−控除）
  function costCompare(x) {
    const o = x.input.own, b = x.breakdown.own, L = x.loan;
    const paid = L.amount > 0 ? Math.min(1, b.principal.amount / L.amount) : 1;
    const house = Math.min(o.price, o.down + (o.price - o.down) * paid);
    const ownLoan = L.pmt, ownUpkeep = (o.propTax + o.ins + o.repairYear) / 12;
    return {
      rent: { total: x.life.rent, spent: x.life.rent },
      own: { total: x.life.own, house, spent: x.life.own - house,
        items: [["利息", b.interest.amount], ["固定資産税・都市計画税", b.tax.amount], ["火災・地震保険", b.ins.amount], ["修繕", b.repair.amount], ["買うまでの家賃", b.preRent.amount], ["住宅ローン控除で戻る", -b.credit.amount]]
          .map(([label, amount]) => ({ label, amount })) },
      monthly: { rent: x.years[0].rentMonthly, ownLoan, ownUpkeep, own: ownLoan + ownUpkeep },
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
    const g = gate(x), bb = bubble(x), fc = fixedCost(x), rc = recommend(x), cc = costCompare(x), ec = economy(x);
    const intro = { title: "¥ 節約するなら、いちばん大きな固定費から",
      say: `日本は「節約しなさい」と言われて育つ国です。では、何を節約すると一番効くでしょうか。答えは、毎月いちばん大きな固定費＝住まい（家賃）です。家賃は住まいの対価で、同時にオーナーのローンの返済や将来の備えにもつながっています。同じ住まいのお金を、家賃として払い続けるか、自分の資産に変えていくか。一緒に数字で見ていきましょう。`,
      show: (fc.rent ? `今の家賃 毎月 ${man(fc.rent, 1)}（手取りの約${Math.round(fc.share * 100)}%・手取りは概算 毎月 ${man(fc.takeHome, 1)}）／1年で ${man(fc.yearly)}／` : `今の家賃 なし（実家など）。家賃がかからない今は、貯金と住まいの準備ができる時期です／`) + `${fc.to65 ? `${i.retireAge}歳まで払い続けると ${man(fc.to65)}、${i.lifeEnd}歳までで ${man(fc.toEnd)}` : `${i.lifeEnd}歳までに払う家賃 ${man(fc.toEnd)}`}（更新料こみ・家財保険は含まない）／家賃の行き先：オーナーのローンの返済・管理や修繕・固定資産税など → 残りがオーナーの収益（空室や修繕で赤字になる場合もあります）`,
      ask: "毎月の固定費で、いちばん大きいものは何ですか。その家賃は、誰の将来の備えになっていると思いますか。" };
    const six = { title: "⑥ まず「できるか」を確かめる（区切り）",
      say: `ここで一度、区切りをつけます。住宅ローンは、借りたい人や私たちが決めるのではなく、融資する金融機関が決めます。当社で審査を申し込んだ方のうち、通るのは${PASS_RATE.of}人中${PASS_RATE.low}〜${PASS_RATE.high}人ほどです（目安）。ですから、やるか・やらないかを決める前に、まず「できるか」をこちらで確認させてください。その土台に乗ったら、やるか・やらないかを決めていただければ大丈夫です。できるかわからないまま決めても意味がないので、お客様のお時間を無駄にしないための順番です。`,
      show: g.checks.map((c) => `${c.ok ? "○" : "△"} ${c.label} ${c.value}`).join("／") + `／${g.verdict}${i.debt.monthly > 0 ? `／他の借入の整理：${debtPlan(x).steps.map((v) => v.name).join(" → ")}` : ""}／金融機関が見ること：${g.lookAt.join("・")}／${g.steps[0]}／そろえる書類：${g.docs.map((v) => `${v.name}（${v.what}）`).join("・")}／${trust(x).title}${trust(x).sub}${trust(x).big}（${trust(x).note.replace("※", "")}）／このあとの流れ：${FLOW.map((f) => f.name).join(" → ")}`,
      ask: "事前審査を受けてみませんか（無料・購入の義務はありません）。買うかどうかを決めるのはあなたです。" };
    const seven = wt.length ? { title: "⑧「今はいい」と思ったら", say: "待つこと自体は悪いことではありません。大事なのは、待つ理由と、待つ間に払うお金・遅れる完済年齢を知ったうえで決めることです。",
      show: wt.slice(1).map((r) => `${r.years}年待つと：待つ間の家賃 ${man(r.rentWhileWaiting)}・完済 ${r.payoffAge}歳${r.loanYearsAfterRetire ? `（${i.retireAge}歳を過ぎて${r.loanYearsAfterRetire}年返済）` : ""}・毎月 ${man(r.pmt, 1)}・住宅ローンの審査の返済比率 ${Math.round(r.screen.ratio * 100)}%（目安 ${Math.round(r.screen.limit * 100)}%以内${r.screen.ok ? "" : "を超える"}${r.screen.shorter ? "・返済期間が短くなる" : ""}）`).join("／") +
        "。年齢が上がるほど返済期間が短くなり、健康状態によっては団信に入れず、審査が通りにくくなる場合があります" +
        (wu ? `／仮に3年の間に金利が0.5%上がった場合、毎月 ${man(wu.pmt, 1)}（下がる場合もあります）` : "") +
        `／親御さまの頃（1990年前後）とは条件が違います：同じ ${man(x.loan.amount)}・${i.own.years}年でも、当時の金利 8.5%なら毎月 ${man(bb.bank, 1)}、公庫 5.5%でも ${man(bb.public, 1)}。今の計画（${(i.own.rate * 100).toFixed(1)}%）は ${man(bb.now, 1)}。当時は値上がりを見込んだ買い方が多かったが、今回は値上がりをあてにせず、住むために払える範囲で考えます（値下がりもありうるので⑦の下落シナリオも一緒に）`,
      ask: "待つ理由は何ですか。その理由がなくなるのはいつ頃ですか。" } : null;
    if (seven) seven.show += `／ご家族と一緒に：${familyTalk(x).process.slice(0, 3).join("→")}。${familyTalk(x).decide}`;
    return [intro, zero,
      { title: "① これからの暮らしの段階", say: sh
          ? `今は社宅で家賃が抑えられていますが、${sh.until > 0 ? `社宅はだいたい${sh.until}歳ごろまでです` : `社宅を出る年齢の決まりはありません。ただ、社宅に住めるのは会社にお勤めの間だけで、定年（${i.retireAge}歳）までです`}。出たあとは、ふつうの家賃を${i.lifeEnd}歳まで払うことになります。社宅の間は、貯金と住まいの準備ができる時期です。`
          : single
          ? `ひとりで暮らしていく場合も、家賃は一生続きます。今の働き方のまま${i.retireAge}歳を迎え、そのあとも${i.lifeEnd}歳まで住まいは必要です。持ち家なら、結婚しても住み続ける・貸す・売るを選べます。`
          : `家賃は暮らしの段階で変わります。${stages.join(" → ")} と進むと、広い部屋が必要な時期に家賃も上がります。`,
        show: (sh ? `社宅 ${manY(sh.self)}（${sh.endTxt}）→ 社宅を出たあと ${manY(sh.after)}（毎月 ${manY(sh.jump)}・年 ${manY(sh.jump * 12)} 増える。家賃は当社のお客様の平均）／` : "") +
          (x.input.family.marryAge != null ? `ひとり ${rentTxt(i.rent.single)} → 2人 ${i.rent.couple ? man(i.rent.couple, 1) : "（ひとりと同じ）"} → 子育て ${i.rent.family ? man(i.rent.family, 1) : "（2人と同じ）"} → 老後 ${rentTxt(i.rent.old)}（毎月）` : `ひとり ${rentTxt(i.rent.single)}${i.rent.single === RENT_AVG.single ? "（当社のお客様の家賃の平均）" : ""} → 老後 ${rentTxt(i.rent.old)}（毎月）`),
        ask: sh ? `社宅を出るのは何歳ごろの予定ですか。出たあと、どこに住みたいですか。` : single ? "これからも、ひとりで自由に暮らしていきたいですか。結婚したら、住まいはどうしたいですか。" : "結婚・お子さま・働き方は、何歳ごろにどうなっていたいですか。" },
      { title: "② 一生でかかる住まいのお金", say: `今から${i.lifeEnd}歳まで、住まいには一生お金がかかります。賃貸は家賃を払い続け、持ち家は返済が終わったあとは税金・保険・修繕だけになります。合計だけだと持ち家が高く見えますが、持ち家には「家そのものの代金」が入っていて、払い終わった家は自分のものとして残ります。なので「消えるお金」どうしでくらべます。`,
        show: `消えるお金で比べると　賃貸のまま ${man(cc.rent.spent)}／持ち家 ${man(cc.own.spent)}（合計 ${man(cc.own.total)} のうち 家の代金 ${man(cc.own.house)} は自分の家として残る）。毎月の住居費　今の家賃 ${man(cc.monthly.rent, 1)}／買ったあと ${man(cc.monthly.own, 1)}（返済 ${man(cc.monthly.ownLoan, 1)}＋税金・保険・修繕 ${man(cc.monthly.ownUpkeep, 1)}）。一生の住居費　賃貸のまま ${man(x.life.rent)}／持ち家 ${man(x.life.own)}（${o.buyAge}歳で${man(o.price)}の家を買った場合）。持ち家のうち 税金（固定資産税・都市計画税）${man(x.breakdown.own.tax.amount)}・保険（火災・地震）${man(x.breakdown.own.ins.amount)}・利息 ${man(x.breakdown.own.interest.amount)}、住宅ローン控除で戻る税金 ${man(x.credit.total)}（${x.credit.label}・${x.credit.years}年）。賃貸の家財保険 ${man(x.breakdown.rent.ins.amount)}・更新料 ${man(x.renew.total)}（${x.renew.every}年ごとに家賃${x.renew.months}か月分、${i.lifeEnd}歳までに${x.renew.times}回。うち${i.retireAge}歳から ${man(x.renew.old)}）`,
        ask: "一生の住まいのお金を、今まで計算したことはありますか。税金や保険まで含めて考えたことはありますか。" },
      { title: `③ ${i.retireAge}歳からの${x.old.years}年`, say: single
          ? `${i.retireAge}歳からは、ひとり分の年金が収入の中心です。賃貸のままだと、その年金から家賃を払い続けることになります。持ち家は${x.loan.endAge}歳で返済が終わる計画です。`
          : `${i.retireAge}歳からは年金が収入の中心です。賃貸のままだと、年金から家賃を払い続けることになります。持ち家は${x.loan.endAge}歳で返済が終わる計画です。`,
        show: `${workLoanLine(x)}／年金（概算）毎月 ${man(x.pension.monthly, 1)}／毎月の支出　賃貸 ${man(r.outMonthly, 1)}・持ち家 ${man(w.outMonthly, 1)}／毎月の不足　賃貸 ${man(r.gapMonthly, 1)}・持ち家 ${man(w.gapMonthly, 1)}／${ec.vs2000.line}`,
        ask: "老後の住まいは、どこで、どんな家に住んでいたいですか。" },
      { title: "④ 持たないなら、いくら準備が必要か", say: `賃貸のままでも、老後の家賃のぶんを今から準備できれば大丈夫です。そのために必要な金額を見てみましょう。`,
        show: `${i.retireAge}歳までに準備したいお金　賃貸のまま ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)} の積立）／持ち家 ${man(x.prepare.ownNeed)}（毎月 ${man(x.prepare.monthlyOwn, 1)}）／${ec.line}／NISAとの違い：${nisaCompare(x).rows.map((r) => `${r.label}（家：${r.own}／NISA：${r.nisa}）`).slice(0, 4).join("・")}。${nisaCompare(x).both}`,
        ask: `毎月 ${man(x.prepare.monthlyRent, 1)} を${i.retireAge}歳まで積み立て続けられそうですか。` },
      single ? { title: "⑤ もしものとき", say: `ひとりで暮らす場合、いちばんの心配は「年を取ってからの住まい」です。高齢のひとり暮らしは、年齢や保証人を理由に賃貸の入居を断られることがあります。持ち家なら、返済が終わったあとは住む場所が確保できます。住宅ローンには団体信用生命保険（団信）が付くので、万一のときもローンが親や兄弟に残りません。金利が上がると返済が増える点は持ち家の注意点です。`,
        show: `${rentScreenLine(x)}／${danshinLine(x)}／老後ひとりで払う家賃 ${i.rent.old ? `毎月 ${man(i.rent.old, 1)}（${x.old.years}年で ${man(x.old.rent.rentTotal)}）` : "なし"}／団信：万一のときの残りのローン ${man(x.whatIf.danshinLoanAfter)}／金利が1%上がったら毎月の返済 ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}／${ECONOMY.savingsIns}／${rateLine(x)}${i.transfer.on ? "／" + transferLine(x) : ""}`,
        ask: "ひとりで年を重ねたとき、どこに住んでいたいですか。金利が上がったときの備えはありますか。" } :
      { title: "⑤ もしものとき", say: `住宅ローンには団体信用生命保険（団信）が付き、万一のときは残りのローンが保険で返済され、家族に住まいが残ります。そのぶん、今の生命保険を見直せる場合があります。賃貸の場合、家族は家賃を払い続けます。高齢になると、年齢を理由に賃貸の入居を断られることもあります。金利が上がると返済が増える点は持ち家の注意点です。`,
        show: `${rentScreenLine(x)}／${danshinLine(x)}／団信：万一のときの残りのローン ${man(x.whatIf.danshinLoanAfter)}（賃貸なら家族は毎月 ${man(x.whatIf.danshinRentContinues, 1)} を払い続ける）／金利が1%上がったら毎月の返済 ${man(x.whatIf.pmt, 1)} → ${man(x.whatIf.rateUpPmt, 1)}／${ECONOMY.savingsIns}／${rateLine(x)}${i.transfer.on ? "／" + transferLine(x) : ""}`,
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
    if (spaceImage(x)) step("space", { headline: "買うのは、家だけじゃない。自分の空間だ", visual: "space",
      lead: "一人だからこそ、部屋の使い方は自由。いまの自分にも、これからの自分にも。",
      kpis: [k("今の家賃（毎月）", fc.rent ? man(fc.rent, 1) : "なし", fc.rent ? "借りている部屋" : "実家など", "rent"),
        k("持ち家の毎月の返済", man(x.loan.pmt, 1), `${x.loan.buyAge}歳で買い ${x.loan.endAge}歳で完済`, "own")],
      points: ["部屋の使い方・内装・庭を、自分で決められる", "在宅の仕事部屋・趣味の部屋・将来の同居や賃貸にも使い方を変えられる", "そのぶん、修繕や管理は自分で。費用は次のページから数字でお見せします"],
      notes: { say: "家を買うというと、お金の話になりがちですが、まず暮らしの話です。一人だからこそ、部屋をどう使うかは自由です。趣味の部屋、仕事に集中する部屋、くつろぐ部屋。いまの家賃と、持ち家の毎月の返済を並べておきます。", ask: "もし部屋がひとつ増えたら、何に使いたいですか？" } });
    step("fixed", { headline: "節約するなら、いちばん大きな固定費から", visual: "fixed",
      lead: fc.rent ? `毎月の家賃は手取りの約${Math.round(fc.share * 100)}%。その家賃は、オーナーのローンの返済や将来の備えになっています。` : "今は家賃なし。家を出ると、いちばん大きな固定費＝家賃が始まります。",
      kpis: [k("今の家賃（毎月）", fc.rent ? man(fc.rent, 1) : "なし", fc.rent ? `手取りの約${Math.round(fc.share * 100)}%` : "実家など", "rent"),
        k(fc.to65 ? `${i.retireAge}歳まで払い続けると` : `${i.lifeEnd}歳までの家賃`, man(fc.to65 || fc.toEnd), `${i.lifeEnd}歳までで ${man(fc.toEnd)}`, "rent")],
      points: rentImage(x).single
        ? ["家賃は住まいの対価。オーナーのローンの返済・管理・修繕・税金にあてられます", "自分が戸建てを持つと：① 暮らしに合わせて使う　② 返済を通じて借入残高を減らす　③ 将来の売却・賃貸も選択肢に", "購入には税金・修繕費などが必要です。売却価格や賃貸収入は、立地や建物の状態によって変わります"]
        : ["家賃は住まいの対価。受け取った家賃は、オーナーのローンの返済・管理・修繕・税金にあてられます", "同じ住まいのお金を、家賃として払い続けるか、自分の資産に変えていくか"], notes: note("¥") });
    step("conclusion", { headline: buy ? "結論：あなたには、購入をおすすめします" : "結論：今は賃貸のまま、準備を進めましょう", visual: buy ? "asset" : "recommend",
      lead: buy ? `持ち家が有利な項目が${rc.favor}つ。${rc.verdict === "buy" ? "まず事前審査で、この計画が通るか確かめましょう。" : "△の項目を見直し、事前審査で確かめてから進めましょう。"}` : `持ち家が有利な項目は${rc.favor}つ。条件（買う年齢・価格・頭金）が変われば、もう一度くらべます。`,
      kpis: [k("持ち家が有利な項目", `4つ中${rc.favor}つ`, "", buy ? "own" : ""), k("毎月の返済（持ち家）", man(x.loan.pmt, 1), `${x.loan.buyAge}歳で買い ${x.loan.endAge}歳で完済`, "own"),
        ...(buy ? [k("家の代金（自分の家に残る）", man(costCompare(x).own.house), "返した元金＋頭金", "own")] : [])],
      points: buy ? [`消えるお金でくらべると　賃貸のまま ${man(costCompare(x).rent.spent)}／持ち家 ${man(costCompare(x).own.spent)}`, "家賃のかわりに返した元金が、家の代金として残ります", "家の価値は上がることも下がることもあります"] : [],
      notes: note("⑦") });
    const fu = future(x);
    step("future", { headline: buy ? fu.title : "毎月の家賃と返済、10年後・20年後をくらべると", visual: "future", lead: fu.sub,
      kpis: [k("今の家賃（毎月）", man(fu.monthly.rent, 1), "住むための支払い", "rent"), k("買った場合（毎月）", man(fu.monthly.own, 1), `返済 ${man(fu.monthly.loan, 1)}＋維持費 ${man(fu.monthly.upkeep, 1)}`, "own"),
      ],
      points: [fu.catch, "金額は概算。頭金・諸費用・税金・保険・修繕がかかり、家の価値は下がる場合もあります"],
      notes: { say: `${fu.sub}毎月の家賃と、買った場合の返済と維持費を並べ、10年後・20年後に何が残るかを見ます。家賃は住むための支払いで、住宅ローンは住みながら自分の家を持つための支払いです。ただし、頭金・諸費用・税金・保険・修繕がかかり、家の価値は下がることもあります。`,
        ask: "10年後・20年後、どこで、どんな暮らしをしていたいですか。" } });
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
    if (i.transfer.on) {
      const tf = transfer(x);
      step("transfer", { headline: "転勤になっても、選べる道は3つ", visual: "transfer",
        lead: "単身赴任・転勤の間だけ貸す・売る。どれを選んでも困らない物件を選んでおきます。",
        kpis: [k(tf.lease.gap < 0 ? "貸した場合の持ち出し（毎月・目安）" : "貸した場合の手元（毎月・目安）", man(Math.abs(tf.lease.gap), 1), `家賃 ${man(tf.lease.rent, 1)}−管理費・空室 vs 返済＋維持費`, tf.lease.gap < 0 ? "rent" : "own"),
          ...(tf.sale ? [k(`${tf.sale.years}年後に売った場合の手元`, tf.sale.net < 0 ? "−" + man(-tf.sale.net) : man(tf.sale.net), "家の価値−残高−売却費用", tf.sale.net < 0 ? "rent" : "own")] : [])],
        points: ["貸すには金融機関の承諾が必要", "家族全員で転居すると、その間は住宅ローン控除が止まる", ...tf.axes.slice(0, 1)],
        notes: { say: "転勤の可能性があっても、家の使い方は3つあります。単身赴任でご家族が住み続けるか、転勤の間だけ貸すか、売るかです。貸す場合は金融機関の承諾が必要で、空室や管理費のリスクもあります。", ask: tf.ask.join("／") } });
    }
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
      points: [trust(x).title, trust(x).big, g.verdict], notes: { ...note("⑥"), more: trust(x).talk.join("") } });
    const sp = screenPrep(x);
    step("prep", { headline: "審査の前に、自分の信用を知る", visual: "prep",
      lead: "返済の遅れなどの記録がなくても、審査の基準で通らないことがあります。まず信用情報を確かめます。",
      kpis: [k("審査が通るのは（当社の目安）", `${PASS_RATE.of}人中${PASS_RATE.low}〜${PASS_RATE.high}人`), k("信用情報（CIC）の取り寄せ", `${CIC.methods[0].fee}円`, "スマホから・ネット開示")],
      points: [sp.catch, "承認は本審査・融資を保証しません。家を買う義務もありません"],
      notes: { say: `${sp.white}カードやスマホ本体の分割払いの遅れは記録に残ることがありますし、記録がなくても、カードの利用枠や勤続年数、物件の評価で通らないことがあります。まずCICで、ご自分の信用情報を見てみましょう。スマホから${CIC.methods[0].fee}円で取り寄せられます。結果が出ても、使うか、今は持っておくかは、お客様が決めることです。`,
        ask: "最近、カードやスマホの支払いが遅れたことはありますか。わからなければ、一緒にCICで確かめましょう。" } });
    slides.push({ kind: "next", key: "next", headline: "次の一歩", steps: P.pages[3].nextSteps,
      contact: [meta.company || DEFAULT_COMPANY, meta.staff ? "担当：" + meta.staff : "", meta.tel ? "TEL " + meta.tel : ""].filter(Boolean).join("　"), notes: NOTES.slice(0, 4) });
    return { slides, verdict: rc.verdict };
  }

  // お客様にお渡しする提案書（A4・4ページ）。数字はすべて compute の結果から
  // 年齢別の比較：今・買う年齢・10年ごと・定年・最後の年齢で、住まいのお金の累計（賃貸のまま／持ち家）
  function ageTable(x) {
    const i = x.input, set = new Set([i.age, i.own.buyAge, i.retireAge, i.lifeEnd]);
    for (let a = Math.ceil((i.age + 1) / 10) * 10; a < i.lifeEnd; a += 10) set.add(a);
    const ages = [...set].filter((a) => a >= i.age && a <= i.lifeEnd).sort((a, b) => a - b);
    let cr = 0, co = 0;
    const cum = new Map();
    for (const y of x.years) { cr += y.rentYear; co += y.ownYear; cum.set(y.age, [cr, co]); }
    return ages.map((age) => { const [rent, own] = cum.get(age) || [cr, co]; return { age, rent, own, diff: rent - own }; });
  }
  // 計算の条件：入力した数字と、計算の仮定（お名前は入れない）
  function conditions(x) {
    const i = x.input, o = i.own, f = i.family, pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
    const fam = f.marryAge == null ? "結婚しない・未定" : `${f.marryAge}歳で結婚` + (f.kids ? `・子ども${f.kids}人（第1子 ${f.firstKidAge}歳）` : "") + (i.partnerIncome ? `・パートナー年収 ${man(i.partnerIncome)}` : "");
    const rentTxt = (v) => (v ? manY(v) : "なし");
    return [
      { group: "あなたのこと", items: [["年齢", i.age + "歳"], ["年収（税込）", man(i.income)], ["年収の上がり方", i.raise ? `年${pct(i.raise)}（仮定）` : "上がらない"], ["貯金", man(i.savings)],
        ["定年と再雇用", i.reemploy && i.reemploy.age < i.retireAge ? `${i.reemploy.age}歳で定年・${i.retireAge}歳まで年収の${Math.round(i.reemploy.rate * 10)}割（仮定）` : `${i.retireAge}歳まで今の働き方`], ["暮らし", fam]] },
      { group: "NISA・保険", items: [["NISA", `残高 ${man(i.nisa.balance)}・毎月 ${man(i.nisa.monthly, 1)}・利回り年${pct(i.nisa.rate, 0)}（仮定・元本保証なし）`],
        ["生命保険", i.lifeIns.monthly ? `毎月 ${man(i.lifeIns.monthly, 1)}・保障 ${man(i.lifeIns.cover)}` : "なし"]] },
      { group: "賃貸のまま", items: [["家賃（毎月）", x.shataku ? `社宅 自己負担 ${manY(x.shataku.self)}（${x.shataku.endTxt}）→ ひとり ${rentTxt(i.rent.single)}` : `ひとり ${rentTxt(i.rent.single)}・2人 ${rentTxt(i.rent.couple)}・子育て ${rentTxt(i.rent.family)}・老後 ${rentTxt(i.rent.old)}`],
        ["更新料・家財保険", `${i.rent.renewMonths ? `家賃の${i.rent.renewMonths}か月分を${i.rent.renewEvery}年ごと` : "更新料なし"}・家財保険 年${man(i.rent.insYear, 1)}`]] },
      { group: "持ち家（買う場合）", items: [["物件価格", man(o.price)], ["買う年齢", o.buyAge + "歳"], ["住宅ローン", `金利 年${pct(o.rate)}（全期間同じと仮定）・返済 ${o.years}年（${o.years * 12}回）・頭金 ${o.down ? man(o.down) : "なし"}`],
        ["諸費用", `物件価格の${pct(o.costRate, 0)}（${o.financeCosts ? "ローンに含める" : "現金で払う"}）`], ["住宅ローン控除", (CREDIT_KINDS[o.kind] || {}).label || "—"],
        ["税金・保険・修繕（年）", `固定資産税 ${man(o.propTax, 1)}・火災地震保険 ${man(o.ins, 1)}・修繕 ${man(o.repairYear, 1)}（${o.repairUpAfter}年目から${o.repairUpRate}倍）`]] },
      { group: "老後", items: [["老後の生活費（住居費を除く・毎月）", `ひとり ${manY(i.oldLiving.single)}・夫婦 ${manY(i.oldLiving.couple)}`], ["年金（概算・毎月）", man(x.pension.monthly, 1)], ["計算する期間", `今から${i.lifeEnd}歳まで`]] },
    ];
  }
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
      profile: `${i.age}歳・年収 ${man(i.income)}・貯金 ${man(i.savings)}・${x.shataku ? `社宅（自己負担 ${manY(x.shataku.self)}・${x.shataku.until > 0 ? x.shataku.until + "歳まで" : "定年まで"}）・` : ""}${single ? "おひとりで暮らす前提" : (i.family.marryAge + "歳で結婚" + (i.family.kids ? `・お子さま${i.family.kids}人` : ""))}・${i.own.buyAge}歳で ${man(i.own.price)} の家を買った場合`,
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
          `持たない場合に${i.retireAge}歳までに準備したいお金 ${man(x.prepare.rentNeed)}（毎月 ${man(x.prepare.monthlyRent, 1)} の積立）＝あなたの「老後2000万円問題」（持ち家なら ${man(x.old.own.need)}）`,
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
          `本人確認書類（${SCREEN_DOCS[1].what}）と${screenDocs(x)[2].name}（${screenDocs(x)[2].what}）をそろえ、住宅ローンの事前審査で借りられる額を確かめる（無料・購入の義務はありません）`,
          `事前審査のあとの流れ：${FLOW.slice(1).map((f) => f.name).join(" → ")}。事前審査は家を買う約束ではありません——${trust(x).big}`,
          "ねんきんネットで、ご自身の年金の見込額を確かめる",
          "条件（エリア・広さ・駐車場・毎月の上限）を書き出して、物件を見る",
          single ? "今は賃貸のまま、老後の家賃のための積立を始める" : "今は賃貸のまま、ご家族で話し合う時間をとる",
          "今回は見送り、状況が変わったら（転勤・結婚・貯金）もう一度試算する",
        ] },
    ];
    const appendix = [
      { no: 5, title: "年齢別の比較（住まいのお金の累計）", lead: `今から${i.lifeEnd}歳まで、同じ物差しで住まいにかかるお金を足していくと、こうなります（持ち家は控除後・家の価値は含めない）。`, table: ageTable(x) },
      { no: 6, title: "計算の条件と注意事項", lead: "この提案書の数字は、次の条件と仮定から計算した概算です。条件が変われば結果も変わります。", conditions: conditions(x), notes: NOTES.slice() },
    ];
    return { cover, pages, appendix, notes: NOTES.slice() };
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
    if (sh && sh.end > i.age) ev.push({ age: sh.end, label: sh.until > 0 ? "社宅を出る" : "社宅を出る（定年）", stat: `家賃 ${manY(sh.self)}→${manY(sh.after)}（毎月 +${manY(sh.jump)}）` });
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
    `物価：総務省 2026年9月分 +${(ECONOMY.cpi.rate * 100).toFixed(1)}%（生鮮食品を除く）。預金：メガバンク普通預金 年${(ECONOMY.deposit.rate * 100).toFixed(1)}%（2026年11月から）。老後2000万円問題：金融審議会 報告書（2019年）の当時の平均の夫婦の計算。数字は変わるので最新で確認。試算は物価一定。`,
    "諸費用（物件価格の7%と仮定）には、登記費用・不動産取得税・印紙税・ローン手数料・仲介手数料などが含まれる。固定資産税・都市計画税は物件・地域で変わる。",
  ];

  return { HOWTO, GUIDE_KEYS, guide, FIT_ITEMS, fitCheck, screenPrep, trust, transfer, debtPlan, rateRisk, nisaCompare, familyTalk, KNOWLEDGE, future, assetImage, ECONOMY, economy, costCompare, SCREEN_DOCS, FLOW, ageTable, conditions, spaceImage, ASK_FIELDS, askFields, missing, rentImage, deck, recommend, fixedCost, BUBBLE, bubble, danshin, DANSHIN_OPTIONS, CIC, PASS_RATE, gate, APP, DEFAULT_COMPANY, home, RENT_AVG, proposal, preset, PRESETS, AVG_SALARY, FORBIDDEN, PENSION, CREDIT_KINDS, payment, balanceAfter, pension, estimateTax, defaults, compute, talk, NOTES, man, STAGE_LABEL };
});
