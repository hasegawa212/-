// 住宅ローン審査エンジン（銀行の審査の流れを再現した目安）
// 足切り（ノックアウト）→ 定量チェック → 担保評価 → スコアリング（格付）→ 判定 → 融資可能額 → 稟議所見
// 実際の審査基準は金融機関ごとに異なり非公開。ここは一般的な考え方に基づく「目安」で、承認を約束しない。
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.LSA = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 審査基準（「基準」タブで変えられる）。単位: 年収は万円、金利は%
  const POLICY = {
    ageMin: 20,            // 申込時の年齢
    ageMax: 70,
    payoffAgeMax: 80,      // 完済時の年齢
    termMax: 35,           // 最長の返済期間（年）
    stressRate: 3.5,       // 審査金利（返済比率を出すときの金利）
    dti: [                 // 年収帯ごとの返済比率の上限（審査金利で計算）
      { under: 300, max: 25 },
      { under: 400, max: 30 },
      { under: Infinity, max: 35 },
    ],
    multipleMax: 7,        // 年収倍率の上限（借入額÷年収）
    multipleHard: 9,       // これを超えると減額でも難しい
    minIncome: 150,        // 最低年収
    tenureEmployee: 1,     // 会社員の勤続年数（年）
    tenureSelf: 3,         // 自営業・経営者の事業年数（確定申告の期数）
    ltvMax: 100,           // 担保評価に対する借入の上限（%）
    ltvWithCosts: 110,     // 諸費用を含めた上限（%）
    cashingRate: 0,        // キャッシング枠を毎月の返済に算入する率（%/月、0=算入しない）
    jointShare: 50,        // 収入合算で算入する割合（%）
  };

  const EMPLOY = {
    public:    { label: "公務員",               score: 200, self: false },
    large:     { label: "正社員（上場・大企業）", score: 180, self: false },
    regular:   { label: "正社員（中小企業）",     score: 150, self: false },
    contract:  { label: "契約社員・派遣社員",     score: 70,  self: false },
    owner:     { label: "会社経営者・役員",       score: 110, self: true },
    self:      { label: "自営業・個人事業主",     score: 90,  self: true },
    part:      { label: "パート・アルバイト",     score: 40,  self: false },
  };

  const PROPERTY = {
    newHouse:  { label: "新築戸建" },
    usedHouse: { label: "中古戸建" },
    newMansion:{ label: "新築マンション" },
    usedMansion:{ label: "中古マンション" },
    landBuild: { label: "土地＋注文住宅" },
  };

  const LATE = {
    none:   { label: "なし", score: 150 },
    past:   { label: "1年以上前にあり（解消済み）", score: 110 },
    recent: { label: "直近1年以内にあり（60日以内）", score: 40 },
    jiko:   { label: "61日以上の延滞・代位弁済・債務整理・破産（異動）", score: 0, knockout: true },
  };
  const APPLY = {
    low:  { label: "0〜2件", penalty: 0 },
    mid:  { label: "3〜4件", penalty: 40 },
    high: { label: "5件以上", penalty: 90 },
  };
  const DANSHIN = {
    ok:    { label: "加入できる（告知事項なし）" },
    wide:  { label: "告知事項あり（ワイド団信を検討）" },
    no:    { label: "加入できない" },
  };

  const SAMPLE = {
    age: 32, employ: "regular", tenure: 6, income: 480, incomePrev: 460,
    jointIncome: 0, family: 3,
    price: 3480, down: 300, costs: 250, financeCosts: false, term: 35, rate: 0.9,
    property: "newHouse", builtYears: 0, oldQuake: false, saikenchiku: false, collateral: 0,
    car: 2.5, card: 0, scholarship: 1.2, revo: 0, other: 0, cashing: 0,
    late: "none", apply: "low", phoneLate: false, taxLate: false, danshin: "ok",
  };

  const r1 = (v) => Math.round(v * 10) / 10;
  const man = (v) => (v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("ja-JP") + "万円");
  const yen = (v) => Math.round(v).toLocaleString("ja-JP") + "円";

  // 元利均等: 借入 p(万円)・年利 rate(%)・n 年 → 毎月の返済（万円）
  function pmt(p, rate, n) {
    const i = rate / 100 / 12, k = n * 12;
    if (k <= 0) return Infinity;
    return i === 0 ? p / k : (p * i) / (1 - Math.pow(1 + i, -k));
  }
  // 毎月 m(万円) 返せるときの借入額
  function pv(m, rate, n) {
    const i = rate / 100 / 12, k = n * 12;
    if (m <= 0 || k <= 0) return 0;
    return i === 0 ? m * k : (m * (1 - Math.pow(1 + i, -k))) / i;
  }

  function dtiLimit(income, P) {
    for (const t of P.dti) if (income < t.under) return t.max;
    return P.dti[P.dti.length - 1].max;
  }

  // 担保評価率（物件価格に対する%）。木造の耐用年数22年・旧耐震などを反映した目安
  function collateralRate(x) {
    const y = Math.max(0, +x.builtYears || 0);
    let r;
    switch (x.property) {
      case "newHouse": case "landBuild": r = 90; break;
      case "newMansion": r = 90; break;
      case "usedHouse": r = y < 10 ? 85 : y < 20 ? 75 : y < 30 ? 65 : 55; break;
      case "usedMansion": r = y < 20 ? 85 : y < 30 ? 75 : 65; break;
      default: r = 80;
    }
    if (x.oldQuake) r -= 10;
    return r;
  }

  // 審査に使う年収: 会社員は直近、自営業・経営者は直近2期の低いほう。収入合算は割合をかけて足す
  function incomeUsed(x, P) {
    const e = EMPLOY[x.employ] || EMPLOY.regular;
    const latest = +x.income || 0, prev = +x.incomePrev || latest;
    const own = e.self ? Math.min(latest, prev) : latest;
    return own + (+x.jointIncome || 0) * P.jointShare / 100;
  }

  function otherDebtMonthly(x, P) {
    const fixed = ["car", "card", "scholarship", "revo", "other"].reduce((s, k) => s + (+x[k] || 0), 0);
    return fixed + (+x.cashing || 0) * P.cashingRate / 100;
  }

  function screen(input, policy) {
    const P = Object.assign({}, POLICY, policy || {});
    const x = Object.assign({}, SAMPLE, input || {});
    const e = EMPLOY[x.employ] || EMPLOY.regular;
    const late = LATE[x.late] || LATE.none;
    const apply = APPLY[x.apply] || APPLY.low;

    const income = incomeUsed(x, P);
    const loan = Math.max(0, x.price - x.down + (x.financeCosts ? x.costs : 0));
    const termCap = Math.max(0, Math.min(P.termMax, P.payoffAgeMax - x.age));
    const term = Math.min(x.term, termCap) || 0;
    const payoffAge = x.age + x.term;
    const debt = otherDebtMonthly(x, P);
    const limit = dtiLimit(income, P);

    const mStress = pmt(loan, P.stressRate, x.term);
    const mActual = pmt(loan, x.rate, x.term);
    const dti = income > 0 ? ((mStress + debt) * 12) / income * 100 : Infinity;
    const dtiActual = income > 0 ? ((mActual + debt) * 12) / income * 100 : Infinity;
    const multiple = income > 0 ? loan / income : Infinity;
    const cRate = collateralRate(x);
    const collateral = +x.collateral > 0 ? +x.collateral : x.price * cRate / 100;
    const ltvLimit = x.financeCosts ? P.ltvWithCosts : P.ltvMax;
    const ltv = collateral > 0 ? loan / collateral * 100 : Infinity;
    const tenureMin = e.self ? P.tenureSelf : P.tenureEmployee;
    const drop = x.incomePrev > 0 ? (x.incomePrev - x.income) / x.incomePrev * 100 : 0;

    // ① 足切り（ひとつでも当たれば否決）
    const knockouts = [];
    if (x.age < P.ageMin || x.age > P.ageMax) knockouts.push(`申込年齢 ${x.age}歳（${P.ageMin}〜${P.ageMax}歳）`);
    if (late.knockout) knockouts.push("信用情報に異動（61日以上の延滞・代位弁済・債務整理・破産）");
    if (x.danshin === "no") knockouts.push("団体信用生命保険に加入できない");
    if (x.saikenchiku) knockouts.push("再建築不可の物件（担保として不適格）");
    if (income < P.minIncome) knockouts.push(`年収 ${man(income)}（最低 ${man(P.minIncome)}）`);
    if (termCap <= 0) knockouts.push(`完済年齢の上限 ${P.payoffAgeMax}歳 までに返済期間がとれない`);

    // ② 定量チェック（項目・基準・実績・判定 ok/warn/ng）
    const st = (ok, warn) => (ok ? "ok" : warn ? "warn" : "ng");
    const checks = [
      { key: "dti", label: "返済比率（審査金利）", rule: `${limit}%以下（審査金利${P.stressRate}%）`,
        value: r1(dti) + "%", status: st(dti <= limit, dti <= limit + 5) },
      { key: "multiple", label: "年収倍率", rule: `${P.multipleMax}倍以下`,
        value: r1(multiple) + "倍", status: st(multiple <= P.multipleMax, multiple <= P.multipleHard) },
      { key: "payoff", label: "完済時年齢", rule: `${P.payoffAgeMax}歳以下`,
        value: payoffAge + "歳", status: st(payoffAge <= P.payoffAgeMax - 5, payoffAge <= P.payoffAgeMax) },
      { key: "tenure", label: e.self ? "事業年数（確定申告）" : "勤続年数", rule: `${tenureMin}年以上`,
        value: x.tenure + "年", status: st(x.tenure >= tenureMin, x.tenure >= tenureMin / 2) },
      { key: "ltv", label: "担保掛目（借入÷担保評価）", rule: `${ltvLimit}%以下`,
        value: r1(ltv) + "%", status: st(ltv <= ltvLimit, ltv <= ltvLimit + 15) },
      { key: "income", label: "所得の安定性（前年比）", rule: "減少20%未満",
        value: (drop > 0 ? "−" : "+") + r1(Math.abs(drop)) + "%", status: st(drop < 10, drop < 20) },
      { key: "credit", label: "信用情報（自己申告）", rule: "延滞・異動なし",
        value: late.label, status: late.knockout ? "ng" : x.late === "recent" ? "warn" : x.phoneLate ? "warn" : "ok" },
      { key: "apply", label: "直近6か月の申込件数", rule: "2件以下",
        value: apply.label, status: st(x.apply === "low", x.apply === "mid") },
      { key: "danshin", label: "団体信用生命保険", rule: "加入できること",
        value: (DANSHIN[x.danshin] || DANSHIN.ok).label, status: x.danshin === "ok" ? "ok" : x.danshin === "wide" ? "warn" : "ng" },
    ];
    if (e.self) checks.push({ key: "tax", label: "税金の納付", rule: "滞納なし", value: x.taxLate ? "滞納あり" : "滞納なし", status: x.taxLate ? "ng" : "ok" });
    if (x.oldQuake) checks.push({ key: "quake", label: "耐震基準", rule: "新耐震（1981年6月以降）", value: "旧耐震", status: "warn" });

    // ③ 融資可能額（いちばん厳しい制約で決まる）
    const byDti = pv(income * limit / 100 / 12 - debt, P.stressRate, term);
    const byMultiple = income * P.multipleMax;
    const byCollateral = collateral * ltvLimit / 100;
    const caps = [
      { key: "dti", label: "返済比率", value: byDti },
      { key: "multiple", label: "年収倍率", value: byMultiple },
      { key: "collateral", label: "担保評価", value: byCollateral },
    ];
    const bind = caps.reduce((a, b) => (b.value < a.value ? b : a));
    const maxLoan = knockouts.length ? 0 : Math.max(0, Math.floor(bind.value / 10) * 10);

    // ④ スコアリング（定量1000点 → 格付）
    const ratioUse = dti / limit;
    const parts = [
      { label: "雇用形態", got: e.score, max: 200 },
      { label: e.self ? "事業年数" : "勤続年数", got: x.tenure >= 10 ? 120 : x.tenure >= 5 ? 100 : x.tenure >= 3 ? 80 : x.tenure >= 1 ? 55 : 20, max: 120 },
      { label: "年収", got: income >= 1000 ? 150 : income >= 700 ? 130 : income >= 500 ? 110 : income >= 400 ? 90 : income >= 300 ? 65 : 40, max: 150 },
      { label: "返済比率の余裕", got: ratioUse <= 0.6 ? 200 : ratioUse <= 0.8 ? 160 : ratioUse <= 1 ? 110 : ratioUse <= 1.15 ? 40 : 0, max: 200 },
      { label: "年収倍率", got: multiple <= 5 ? 100 : multiple <= 6 ? 80 : multiple <= 7 ? 60 : multiple <= 8 ? 30 : 0, max: 100 },
      { label: "自己資金", got: x.down / x.price >= 0.2 ? 80 : x.down / x.price >= 0.1 ? 60 : x.down > 0 ? 40 : 20, max: 80 },
      { label: "信用情報", got: Math.max(0, late.score - apply.penalty - (x.phoneLate ? 50 : 0)), max: 150 },
      { label: "完済時年齢", got: payoffAge <= 70 ? 50 : payoffAge <= 75 ? 40 : payoffAge <= 80 ? 20 : 0, max: 50 },
    ];
    const raw = parts.reduce((s, p) => s + p.got, 0);
    const rawMax = parts.reduce((s, p) => s + p.max, 0);
    const score = Math.round(raw / rawMax * 1000);
    const grade = score >= 800 ? "A" : score >= 650 ? "B" : score >= 500 ? "C" : score >= 350 ? "D" : "E";

    // ⑤ 判定
    const ng = checks.filter((c) => c.status === "ng");
    const warn = checks.filter((c) => c.status === "warn");
    const amountNg = ng.filter((c) => ["dti", "multiple", "ltv"].includes(c.key));
    const otherNg = ng.filter((c) => !["dti", "multiple", "ltv"].includes(c.key));
    let decision;
    if (knockouts.length || grade === "E") decision = "reject";
    else if (otherNg.length) decision = "hold";
    else if (amountNg.length || loan > maxLoan) decision = maxLoan >= loan * 0.5 ? "conditional" : "reject";
    else if (grade === "D") decision = "hold";
    else if (grade === "C" || warn.length >= 3) decision = "conditional";
    else decision = "approve";

    const DEC = {
      approve: { label: "承認見込み", short: "承認", tone: "ok" },
      conditional: { label: "条件付き承認見込み", short: "条件付", tone: "warn" },
      hold: { label: "要再検討（保留）", short: "保留", tone: "hold" },
      reject: { label: "否決見込み", short: "否決", tone: "ng" },
    };

    // ⑥ 条件・所見
    const conditions = [];
    if (loan > maxLoan && maxLoan > 0) conditions.push(`借入額を ${man(maxLoan)} 以内に減額（希望 ${man(loan)}、${bind.label}で上限）`);
    if (debt > 0 && checks.find((c) => c.key === "dti").status !== "ok") conditions.push(`他の借入（毎月 ${r1(debt)}万円）の完済・減額`);
    if (x.danshin === "wide") conditions.push("ワイド団信など引受基準の緩い団信での申込み");
    if (grade === "C") conditions.push("金利の優遇幅が小さくなる・保証料が上乗せになる場合あり");
    if (x.apply !== "low") conditions.push("申込みを1〜2行に絞り、新たなカード・ローンの申込みを控える");
    if (x.late === "recent" || x.phoneLate) conditions.push("延滞の経緯の説明と、本人開示（CIC）での確認");
    if (x.oldQuake) conditions.push("耐震基準適合証明など物件の書類確認");
    if (warn.find((c) => c.key === "tenure")) conditions.push("勤続年数・事業年数を満たしてからの申込みを検討");

    const strengths = [];
    if (e.score >= 150) strengths.push(`雇用が安定（${e.label}）`);
    if (x.tenure >= 5) strengths.push(`${e.self ? "事業" : "勤続"} ${x.tenure}年`);
    if (dti <= limit * 0.8) strengths.push(`返済比率に余裕（${r1(dti)}% / 上限${limit}%）`);
    if (x.down / x.price >= 0.1) strengths.push(`自己資金 ${man(x.down)}（物件価格の${Math.round(x.down / x.price * 100)}%）`);
    if (x.late === "none" && x.apply === "low" && !x.phoneLate) strengths.push("信用情報に問題の申告なし");
    if (payoffAge <= 70) strengths.push(`完済 ${payoffAge}歳（定年前後に完済）`);

    const concerns = knockouts.slice();
    checks.filter((c) => c.status !== "ok").forEach((c) => concerns.push(`${c.label}：${c.value}（基準 ${c.rule}）`));

    // ⑦ 改善シミュレーション（条件を変えたら判定がどう変わるか）
    const whatIf = [];
    if (!input || !input.__nested) {
      const run = (label, patch) => {
        const r = screen(Object.assign({}, x, patch, { __nested: true }), P);
        if (r.decision !== decision || r.maxLoan !== maxLoan) whatIf.push({ label, decision: r.decision, decisionLabel: DEC[r.decision].label, maxLoan: r.maxLoan, score: r.score });
      };
      if (debt > 0) run("他の借入をすべて完済した場合", { car: 0, card: 0, scholarship: 0, revo: 0, other: 0, cashing: 0 });
      if (x.term < termCap) run(`返済期間を${termCap}年にした場合`, { term: termCap });
      if (loan > maxLoan && maxLoan > 0) run(`借入額を${man(maxLoan)}にした場合（頭金を増やす）`, { down: x.down + (loan - maxLoan) });
      if (!x.jointIncome) run("配偶者の年収200万円を収入合算した場合", { jointIncome: 200 });
      if (x.apply !== "low") run("申込件数を2件以下に絞った場合", { apply: "low" });
    }

    return {
      input: x, policy: P, decision, decisionInfo: DEC[decision], knockouts, checks,
      income, loan, term, payoffAge, debt, limit,
      monthly: { actual: mActual, stress: mStress, debt },
      dti, dtiActual, multiple, collateral, collateralRate: +x.collateral > 0 ? null : cRate, ltv, ltvLimit,
      caps, bind, maxLoan, parts, score, grade, conditions, strengths, concerns, whatIf,
      total: mActual * x.term * 12, interest: mActual * x.term * 12 - loan,
    };
  }

  const NOTE = "この結果は、一般的な住宅ローン審査の考え方に基づく目安です。実際の審査基準は金融機関ごとに異なり公開されていません。承認・融資を約束するものではなく、最終的な判断は金融機関が行います。信用情報は自己申告で、照会はしていません。";

  return { POLICY, EMPLOY, PROPERTY, LATE, APPLY, DANSHIN, SAMPLE, NOTE, pmt, pv, dtiLimit, collateralRate, incomeUsed, screen, man, yen, r1 };
});
