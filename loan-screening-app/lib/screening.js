// 住宅ローン審査エンジン v3（銀行・信用金庫・フラット35と保証会社の審査ラインを再現した目安）
// 本人確認・反社 → 信用情報（3機関）→ 申込人 → 収入 → 返済能力 → 担保・物件 → 保証会社判定 → 書類 → 決裁
// 実際の審査基準は金融機関ごとに異なり公開されていない。結果は承認を約束せず、最終判断は金融機関が行う。
(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const deps = isNode
    ? Object.assign({}, require("./policy.js"), require("./income.js"), require("./credit.js"), require("./collateral.js"), require("./flat35.js"), require("./fees.js"))
    : root.LSA;
  const m = factory(deps);
  if (isNode) module.exports = Object.assign({}, deps, m);
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";
  const { resolvePolicy, incomeUsed, creditSummary, LATE, appraise, eligibility, PROPERTY, flatRate, guaranteeCost, adminFee, GUARANTOR_NOTE, FEE_TYPE } = D;

  const ENGINE_VERSION = "3.0.0";

  const EMPLOY = {
    public: { label: "公務員", score: 200, self: false, kind: "employee" },
    large: { label: "正社員（上場・大企業）", score: 180, self: false, kind: "employee" },
    regular: { label: "正社員（中小企業）", score: 150, self: false, kind: "employee" },
    contract: { label: "契約社員・派遣社員", score: 70, self: false, kind: "irregular" },
    part: { label: "パート・アルバイト", score: 40, self: false, kind: "irregular" },
    owner: { label: "会社経営者・役員", score: 110, self: true, kind: "owner" },
    self: { label: "自営業・個人事業主", score: 90, self: true, kind: "self" },
  };
  const APPLY_PENALTY = (n) => (n <= 2 ? 0 : n <= 4 ? 40 : 90);
  const NATIONALITY = { jp: "日本国籍", pr: "外国籍（永住権あり）", other: "外国籍（永住権なし）" };
  const DANSHIN = { ok: "加入できる（告知事項なし）", wide: "告知事項あり（ワイド団信を検討）", no: "加入できない" };
  const JOINT = { none: "なし", guarantor: "連帯保証", codebtor: "連帯債務" };
  const STAGE = { pre: "事前審査", main: "本審査" };

  const SAMPLE = {
    stage: "pre",
    age: 32, nationality: "jp", employ: "regular", tenure: 6,
    income: 480, incomePrev: 460, incomePrev2: 440, corpLoss: 0, jointType: "none", jointIncome: 0,
    price: 3480, down: 300, costs: 250, financeCosts: false, term: 35, rate: 0.9, flatRate: 3.46, feeType: "rate", purpose: "own",
    kids: 0, youngCouple: false, flatS: "none", inArea: true,
    property: "newHouse", builtYears: 0, structure: "wood", landArea: 120, rosenka: 90000, floor: 100,
    road: 4, zone: "urban", leasehold: false, overBuild: false, oldQuake: false, saikenchiku: false, collateral: 0,
    car: 2.5, card: 0, scholarship: 1.2, revo: 0, other: 0, cashing: 0,
    credit: { cic: { late: "none", apply: 1 }, jicc: { late: "none", apply: 0 }, ksc: { late: "none", apply: 1, kanpo: false } },
    phoneLate: false, taxLate: false, danshin: "ok", antisocial: false,
    docs: { income: false, id: false, property: false, contract: false, danshin: false, tax: false, corp: false, fit: false },
  };

  const DEC = {
    approve: { label: "承認見込み", short: "承認", tone: "ok" },
    conditional: { label: "条件付き承認見込み", short: "条件付", tone: "warn" },
    hold: { label: "要再検討（保留）", short: "保留", tone: "hold" },
    reject: { label: "否決見込み", short: "否決", tone: "ng" },
  };

  const NOTE = "この結果は、一般的な住宅ローン審査の考え方に基づく目安です。実際の審査基準は金融機関ごとに異なり公開されていません。承認・融資を約束するものではなく、最終的な判断は金融機関が行います。信用情報は自己申告で、照会はしていません。";

  const r1 = (v) => Math.round(v * 10) / 10;
  const man = (v) => (v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("ja-JP") + "万円");
  const yen = (v) => (isFinite(v) ? Math.round(v).toLocaleString("ja-JP") + "円" : "—");

  function pmt(p, rate, n) {
    const i = rate / 100 / 12, k = n * 12;
    if (k <= 0) return Infinity;
    return i === 0 ? p / k : (p * i) / (1 - Math.pow(1 + i, -k));
  }
  function pv(m, rate, n) {
    const i = rate / 100 / 12, k = n * 12;
    if (m <= 0 || k <= 0) return 0;
    return i === 0 ? m * k : (m * (1 - Math.pow(1 + i, -k))) / i;
  }
  function dtiLimit(income, P) {
    for (const t of P.dti) if (income < t.under) return t.max;
    return P.dti[P.dti.length - 1].max;
  }

  // 入力と基準から決まる短いハッシュ（審査記録用）。キーを並べ替えて同じ入力なら同じ値にする
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
    return JSON.stringify(v === Infinity ? "Inf" : v);
  }
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  }

  // 必要書類（職業・型ごと）。key は入力の docs のキー
  function docsRequired(x, P) {
    const e = EMPLOY[x.employ] || EMPLOY.regular;
    const v = x.docs || {};
    const list = [{ key: "id", label: "本人確認書類（運転免許証・マイナンバーカードなど）" }];
    if (e.kind === "self") {
      list.push({ key: "income", label: "確定申告書（直近3期分）" });
      list.push({ key: "tax", label: "納税証明書（その1・その2）" });
    } else if (e.kind === "owner") {
      list.push({ key: "income", label: "源泉徴収票（役員報酬）・確定申告書" });
      list.push({ key: "corp", label: "法人の決算書（直近3期分）" });
      list.push({ key: "tax", label: "納税証明書（個人・法人）" });
    } else {
      list.push({ key: "income", label: "源泉徴収票（前年分）・住民税決定通知書" });
    }
    list.push({ key: "property", label: "物件資料（重要事項説明書・登記事項証明書・公図・測量図・建物図面）" });
    list.push({ key: "contract", label: "売買契約書（工事請負契約書）" });
    if (P.danshinRequired || x.danshin !== "no") list.push({ key: "danshin", label: "団体信用生命保険の申込書・告知書" });
    if ((P.docsExtra || []).length) list.push({ key: "fit", label: P.docsExtra.join("・") });
    const loan = Math.max(0, (+x.price || 0) - (+x.down || 0) + (x.financeCosts ? +x.costs || 0 : 0));
    if (P.memberThreshold > 0 && loan > P.memberThreshold) list.push({ key: "member", label: "出資金の払込み（会員加入）" });
    return list.map((d) => Object.assign(d, { verified: !!v[d.key] }));
  }

  function screen(input, policy, opts) {
    const P = resolvePolicy(policy && typeof policy === "object" ? policy : policy || "megabank");
    const x = Object.assign({}, SAMPLE, input || {});
    x.credit = Object.assign({}, SAMPLE.credit, x.credit || {});
    x.docs = Object.assign({}, SAMPLE.docs, x.docs || {});
    const o = opts || {};
    // フラット35: 融資率（借入÷物件価格）で金利が決まり、適用金利は flatRate から作る
    let flat = null;
    if (P.isFlat) {
      const loan0 = Math.max(0, x.price - x.down + (x.financeCosts ? x.costs : 0));
      flat = flatRate(x, P, x.price > 0 ? loan0 / x.price * 100 : Infinity);
      x.rate = flat.rate;
    }
    const nested = !!o.nested;
    const e = EMPLOY[x.employ] || EMPLOY.regular;
    const stage = STAGE[x.stage] ? x.stage : "pre";
    const st = (ok, warn) => (ok ? "ok" : warn ? "warn" : "ng");
    const knockouts = [];

    // ---------- ① 本人確認・反社 ----------
    const kyc = [];
    kyc.push({ key: "antisocial", label: "反社会的勢力の照会", rule: "該当しないこと", value: x.antisocial ? "該当" : "該当なし", status: x.antisocial ? "ng" : "ok" });
    if (x.antisocial) knockouts.push("反社会的勢力に該当（取引不可）");
    kyc.push(stage === "main"
      ? { key: "id", label: "本人確認（犯罪収益移転防止法）", rule: "原本で確認済み", value: x.docs.id ? "確認済み" : "未確認", status: x.docs.id ? "ok" : "ng" }
      : { key: "id", label: "本人確認（犯罪収益移転防止法）", rule: "本審査で原本確認", value: "事前審査（自己申告）", status: "ok" });

    // ---------- ② 信用情報 ----------
    const cs = creditSummary(x);
    const credit = cs.items.map((b) => ({
      key: "bureau_" + b.key, label: `${b.label} の延滞・異動`, rule: "延滞・異動なし", value: b.lateLabel,
      status: b.late === "jiko" ? "ng" : b.late === "recent" ? "warn" : "ok",
    }));
    if (cs.worstLate === "jiko") knockouts.push("信用情報に異動（61日以上の延滞・代位弁済・債務整理）");
    credit.push({ key: "kanpo", label: "官報情報（破産・個人再生）", rule: "登録なし", value: cs.kanpo ? "登録あり" : "なし", status: cs.kanpo ? "ng" : "ok" });
    if (cs.kanpo) knockouts.push("官報情報（破産・個人再生）の登録あり");
    credit.push({ key: "apply", label: "申込情報（ローン・カードの申込件数）", rule: "2件以下（機関ごとの最大値）", value: cs.applyMax + "件", status: st(cs.applyMax <= 2, cs.applyMax <= 4) });
    credit.push({ key: "phone", label: "スマホ本体代金の支払い", rule: "遅れなし", value: x.phoneLate ? "遅れあり" : "遅れなし", status: x.phoneLate ? "warn" : "ok" });
    if (e.self) credit.push({ key: "tax", label: "税金の納付", rule: "滞納なし", value: x.taxLate ? "滞納あり" : "滞納なし", status: x.taxLate ? "ng" : "ok" });

    // ---------- ③ 申込人 ----------
    const termCap = Math.max(0, Math.min(P.termMax, P.payoffAgeMax - x.age));
    const term = Math.min(x.term, termCap) || 0;
    const payoffAge = x.age + x.term;
    const tenureMin = e.self ? P.tenureSelf : P.tenureEmployee;
    const person = [];
    const ageOk = x.age >= P.ageMin && x.age <= P.ageMax;
    person.push({ key: "age", label: "申込時の年齢", rule: `${P.ageMin}〜${P.ageMax}歳`, value: x.age + "歳", status: ageOk ? "ok" : "ng" });
    if (!ageOk) knockouts.push(`申込年齢 ${x.age}歳（${P.ageMin}〜${P.ageMax}歳）`);
    const nat = NATIONALITY[x.nationality] ? x.nationality : "jp";
    const natSt = nat === "other" ? (P.nonPR === "ng" ? "ng" : "warn") : "ok";
    person.push({ key: "nationality", label: "国籍・在留資格", rule: P.nonPR === "ng" ? "日本国籍または永住権" : "永住権がない場合は個別に確認", value: NATIONALITY[nat], status: natSt });
    if (natSt === "ng") knockouts.push("外国籍で永住権がない（この型では取り扱わない）");
    const irregular = e.kind === "irregular";
    person.push({ key: "employ", label: "雇用形態", rule: P.contractOk ? "正社員・公務員・自営業など（契約・派遣は個別）" : "正社員・公務員・自営業など", value: e.label,
      status: irregular ? (P.contractOk || P.id === "flat35" ? "warn" : "ng") : "ok" });
    if (P.id === "flat35" && irregular) person[person.length - 1].status = "ok";
    person.push({ key: "tenure", label: e.self ? "事業年数（確定申告）" : "勤続年数", rule: tenureMin > 0 ? `${tenureMin}年以上` : "問わない", value: x.tenure + "年",
      status: st(x.tenure >= tenureMin, x.tenure >= tenureMin / 2) });
    if (P.requireArea) {
      person.push({ key: "area", label: "営業地域", rule: "営業地域内に住む・勤める（物件も地域内）", value: x.inArea === false ? "地域外" : "地域内", status: x.inArea === false ? "ng" : "ok" });
      if (x.inArea === false) knockouts.push("信用金庫の営業地域外（会員資格の対象外）");
    }
    const dan = DANSHIN[x.danshin] ? x.danshin : "ok";
    const danSt = dan === "ok" ? "ok" : dan === "wide" ? "warn" : P.danshinRequired ? "ng" : "warn";
    person.push({ key: "danshin", label: "団体信用生命保険", rule: P.danshinRequired ? "加入できること" : P.isFlat ? "任意（新機構団信は金利に含む。入らなければ金利−0.2%）" : "任意（加入しない場合は保障を別に）", value: DANSHIN[dan], status: danSt });
    if (dan === "no" && P.danshinRequired) knockouts.push("団体信用生命保険に加入できない");

    // ---------- ④ 収入 ----------
    const inc = incomeUsed(x, P);
    const income = inc.total;
    const incomeChecks = [];
    incomeChecks.push({ key: "minIncome", label: "審査年収", rule: P.minIncome > 0 ? `${P.minIncome}万円以上（${inc.basis}）` : `基準なし（${inc.basis}）`, value: man(income), status: income >= P.minIncome && income > 0 ? "ok" : "ng" });
    if (income < P.minIncome || income <= 0) knockouts.push(`審査年収 ${man(income)}（最低 ${man(P.minIncome)}）`);
    const drop = x.incomePrev > 0 ? (x.incomePrev - x.income) / x.incomePrev * 100 : 0;
    incomeChecks.push({ key: "stability", label: "所得の安定性（前年比）", rule: "減少20%未満", value: (drop > 0 ? "−" : "+") + r1(Math.abs(drop)) + "%", status: st(drop < 10, drop < 20) });
    if (e.kind === "owner") {
      const loss = Math.max(0, Math.min(3, +x.corpLoss || 0));
      incomeChecks.push({ key: "corp", label: "法人の決算（直近3期）", rule: "赤字なし", value: loss ? `赤字 ${loss}期` : "黒字", status: loss === 0 ? "ok" : loss === 1 ? "warn" : "ng" });
    }
    if (x.jointType && x.jointType !== "none" && x.jointIncome > 0) {
      incomeChecks.push({ key: "joint", label: "収入合算", rule: `${JOINT[x.jointType]}は${inc.share}%を算入`, value: `${man(x.jointIncome)} → ${man(inc.joint)}`, status: "ok" });
    }

    // ---------- ⑤ 返済能力 ----------
    const loan = Math.max(0, x.price - x.down + (x.financeCosts ? x.costs : 0));
    const sRate = P.stressRate == null ? x.rate : P.stressRate;
    const debt = ["car", "card", "scholarship", "revo", "other"].reduce((s, k) => s + (+x[k] || 0), 0) + (+x.cashing || 0) * P.cardLimitRate / 100;
    const limit = dtiLimit(income, P);
    const mStress = pmt(loan, sRate, x.term);
    const mActual = pmt(loan, x.rate, x.term);
    const dti = income > 0 ? ((mStress + debt) * 12) / income * 100 : Infinity;
    const dtiActual = income > 0 ? ((mActual + debt) * 12) / income * 100 : Infinity;
    const multiple = income > 0 ? loan / income : Infinity;
    if (termCap <= 0) knockouts.push(`完済年齢の上限 ${P.payoffAgeMax}歳 までに返済期間がとれない`);
    const capacity = [
      { key: "dti", label: "返済負担率", rule: `${limit}%以下（${P.stressRate == null ? "実際の金利" : "審査金利"} ${sRate}%）`, value: r1(dti) + "%", status: st(dti <= limit, dti <= limit + 5) },
      { key: "multiple", label: "年収倍率（借入÷年収）", rule: isFinite(P.multipleMax) ? `${P.multipleMax}倍以下` : "基準なし", value: r1(multiple) + "倍",
        status: isFinite(P.multipleMax) ? st(multiple <= P.multipleMax, multiple <= P.multipleHard) : "ok" },
      { key: "payoff", label: "完済時の年齢", rule: `${P.payoffAgeMax}歳以下`, value: payoffAge + "歳", status: st(payoffAge <= P.payoffAgeMax - 5, payoffAge <= P.payoffAgeMax) },
      { key: "loanRange", label: "借入額", rule: `${man(P.loanMin)}以上 ${man(P.loanMax)}以下`, value: man(loan), status: loan >= P.loanMin && loan <= P.loanMax ? "ok" : "ng" },
    ];
    if (P.termMin > 1) capacity.push({ key: "termRange", label: "返済期間", rule: `${P.termMin}年以上 ${P.termMax}年以下`, value: x.term + "年", status: x.term >= P.termMin && x.term <= P.termMax ? "ok" : "ng" });

    // ---------- ⑥ 担保・物件 ----------
    const ap = appraise(x, P);
    const el = eligibility(x, P);
    knockouts.push(...el.knockouts);
    const ltvLimit = x.financeCosts ? P.ltvWithCosts : P.ltvMax;
    const byPrice = P.ltvBase === "price";
    const ltvBaseValue = byPrice ? x.price : ap.value;
    const ltv = ltvBaseValue > 0 ? loan / ltvBaseValue * 100 : Infinity;
    const property = [{ key: "ltv", label: byPrice ? "融資率（借入÷物件価格）" : `担保掛目（借入÷担保評価・${ap.method}）`, rule: `${ltvLimit}%以下${byPrice && isFinite(P.highLtv.over) ? `（${P.highLtv.over}%超は金利+${P.highLtv.add}%）` : ""}`, value: r1(ltv) + "%",
      status: byPrice ? (ltv <= ltvLimit ? (ltv > P.highLtv.over ? "warn" : "ok") : "ng") : st(ltv <= ltvLimit, ltv <= ltvLimit + 15) }].concat(el.checks);
    if (x.financeCosts && P.ltvWithCosts <= P.ltvMax) property.push({ key: "costs", label: "諸費用の借入", rule: "この型では諸費用は借入に含めない", value: "含める", status: "warn" });

    // ---------- 融資可能額 ----------
    const byDti = pv(income * limit / 100 / 12 - debt, sRate, term);
    const byMultiple = isFinite(P.multipleMax) ? income * P.multipleMax : Infinity;
    const byCollateral = ltvBaseValue * ltvLimit / 100;
    const caps = [
      { key: "dti", label: "返済負担率", value: byDti },
      { key: "multiple", label: "年収倍率", value: byMultiple },
      { key: "collateral", label: byPrice ? "融資率（物件価格）" : "担保評価", value: byCollateral },
      { key: "limit", label: "借入額の上限", value: P.loanMax },
    ];
    const bind = caps.reduce((a, b) => (b.value < a.value ? b : a));
    const maxLoan = knockouts.length ? 0 : Math.max(0, Math.floor(bind.value / 10) * 10);

    // ---------- ⑦ スコア・保証会社 ----------
    const ratioUse = dti / limit;
    const creditScore = Math.max(0, LATE[cs.worstLate].score - APPLY_PENALTY(cs.applyMax) - (x.phoneLate ? 50 : 0) - (cs.kanpo ? 150 : 0));
    const parts = [
      { label: "雇用形態", got: e.score, max: 200 },
      { label: e.self ? "事業年数" : "勤続年数", got: x.tenure >= 10 ? 120 : x.tenure >= 5 ? 100 : x.tenure >= 3 ? 80 : x.tenure >= 1 ? 55 : 20, max: 120 },
      { label: "年収", got: income >= 1000 ? 150 : income >= 700 ? 130 : income >= 500 ? 110 : income >= 400 ? 90 : income >= 300 ? 65 : 40, max: 150 },
      { label: "返済負担率の余裕", got: ratioUse <= 0.6 ? 200 : ratioUse <= 0.8 ? 160 : ratioUse <= 1 ? 110 : ratioUse <= 1.15 ? 40 : 0, max: 200 },
      { label: "年収倍率", got: multiple <= 5 ? 100 : multiple <= 6 ? 80 : multiple <= 7 ? 60 : multiple <= 8 ? 30 : 0, max: 100 },
      { label: "自己資金", got: x.down / x.price >= 0.2 ? 80 : x.down / x.price >= 0.1 ? 60 : x.down > 0 ? 40 : 20, max: 80 },
      { label: "信用情報", got: creditScore, max: 150 },
      { label: "完済時の年齢", got: payoffAge <= 70 ? 50 : payoffAge <= 75 ? 40 : payoffAge <= 80 ? 20 : 0, max: 50 },
    ];
    const score = Math.round(parts.reduce((s, p) => s + p.got, 0) / parts.reduce((s, p) => s + p.max, 0) * 1000);
    const grade = score >= 800 ? "A" : score >= 650 ? "B" : score >= 500 ? "C" : score >= 350 ? "D" : "E";
    const g = P.guarantee[grade];
    const gc = guaranteeCost(x, P, grade, loan, x.term); // 費用は希望額で計算
    const guarantee = g
      ? { grade, fee: gc.rateAdd, add: g.add, label: g.label, rate: x.rate + g.add + gc.rateAdd, feeType: gc.feeType, lump: gc.lump, guarantor: P.guarantor.label }
      : { grade, fee: null, add: null, label: "取扱い不可", rate: null, feeType: gc.feeType, lump: 0, guarantor: P.guarantor.label };
    const admin = adminFee(P, loan);
    const fees = { guarantee: gc, admin, total: gc.lump + admin, adminLabel: P.adminFee.type === "rate" ? `借入額の${P.adminFee.value}%` : "定額" };
    const gt = P.guarantor.type;
    const gChecks = [
      { key: "guarantor", label: "保証機関", rule: gt === "none" ? "保証会社を使わない" : gt === "waived" ? "保証料は取らない（事務手数料型）" : "金融機関とは別に保証審査", value: P.guarantor.label, status: "ok" },
      { key: "grade", label: P.isFlat ? "審査の格付（金利差なし）" : "保証の格付", rule: P.isFlat ? "機構の基準で判定" : "B以上が標準（C以下は優遇縮小）", value: knockouts.length ? "—" : `${grade}（${score}点）`,
        status: knockouts.length ? "ng" : grade === "A" || grade === "B" ? "ok" : grade === "C" ? "warn" : "ng" },
      { key: "feeType", label: "保証料の支払い方法", rule: gt === "none" || gt === "waived" ? "保証料なし" : "金利上乗せ型か一括前払い型を選ぶ",
        value: gt === "none" ? "不要" : gt === "waived" ? "なし（事務手数料 " + yen(admin) + "）" : gc.feeType === "lump" ? `一括前払い ${yen(gc.lump)}` : `金利上乗せ +${gc.rateAdd}%`, status: "ok" },
    ];

    // ---------- ⑧ 書類 ----------
    const docs = docsRequired(x, P);
    const pending = docs.filter((d) => !d.verified);
    const docChecks = stage === "main"
      ? docs.map((d) => ({ key: "doc_" + d.key, label: d.label, rule: "原本・写しを確認済み", value: d.verified ? "確認済み" : "未確認", status: d.verified ? "ok" : "ng" }))
      : [{ key: "doc_pre", label: "必要書類", rule: "本審査で確認", value: `${docs.length}点（事前審査では自己申告）`, status: "ok" }];

    // ---------- 判定 ----------
    const judged = [kyc, credit, person, incomeChecks, capacity, property].flat();
    const amountKeys = ["dti", "multiple", "ltv", "loanRange"];
    const ng = judged.filter((c) => c.status === "ng");
    const warn = judged.filter((c) => c.status === "warn");
    const amountNg = ng.filter((c) => amountKeys.includes(c.key));
    const otherNg = ng.filter((c) => !amountKeys.includes(c.key) && !(c.key === "id" && stage === "main"));
    const docsPending = stage === "main" && (pending.length > 0 || !x.docs.id);
    let decision, holdReason = null;
    if (knockouts.length || grade === "E") decision = "reject";
    else if (otherNg.length) { decision = "hold"; holdReason = "基準を満たさない項目があります"; }
    else if (amountNg.length || loan > maxLoan) decision = maxLoan >= loan * 0.5 ? "conditional" : "reject";
    else if (docsPending) { decision = "hold"; holdReason = "書類の確認待ち"; }
    else if (grade === "D") { decision = "hold"; holdReason = "格付Dのため個別に判断"; }
    else if (grade === "C" || warn.length >= 3) decision = "conditional";
    else decision = "approve";
    if (decision === "conditional" && docsPending) holdReason = "書類の確認待ち";

    // ---------- ⑨ 決裁 ----------
    const amount = Math.min(loan, maxLoan || loan);
    let level = P.authority.findIndex((a) => amount <= a.upTo);
    if (level < 0) level = P.authority.length - 1;
    const exception = (decision === "approve" || decision === "conditional") && warn.length > 0;
    if (exception) level = Math.min(level + 1, P.authority.length - 1);
    const authority = { level, max: P.authority.length - 1, label: P.authority[level].label, exception, reason: exception ? `例外承認（△ ${warn.length}件）を含むため1段上の決裁` : "金額による決裁" };

    const stageStatus = (cs2) => (cs2.some((c) => c.status === "ng") ? "ng" : cs2.some((c) => c.status === "warn") ? "warn" : "ok");
    const stages = [
      { key: "kyc", label: "本人確認・反社", checks: kyc },
      { key: "credit", label: "信用情報（CIC・JICC・KSC）", checks: credit },
      { key: "person", label: "申込人", checks: person },
      { key: "income", label: "収入", checks: incomeChecks },
      { key: "capacity", label: "返済能力", checks: capacity },
      { key: "property", label: "担保・物件", checks: property },
      { key: "guarantee", label: "保証会社の判定", checks: gChecks },
      { key: "docs", label: "書類", checks: docChecks },
      { key: "authority", label: "決裁", checks: [{ key: "authority", label: "決裁権限", rule: "借入額と例外の有無で決まる", value: authority.label, status: "ok" }] },
    ].map((s) => Object.assign(s, { status: s.key === "docs" && stage === "pre" ? "skip" : stageStatus(s.checks) }));

    // ---------- 所見 ----------
    const conditions = [];
    if (loan > maxLoan && maxLoan > 0) conditions.push(`借入額を ${man(maxLoan)} 以内に減額（希望 ${man(loan)}、${bind.label}で上限）`);
    if (debt > 0 && capacity[0].status !== "ok") conditions.push(`他の借入（毎月 ${r1(debt)}万円）の完済・減額`);
    if (dan === "wide") conditions.push("ワイド団信など引受基準の緩い団信での申込み");
    if (grade === "C" && !knockouts.length) conditions.push(`保証料・金利の上乗せ（目安 +${r1((g.fee + g.add) * 100) / 100}%）`);
    if (cs.applyMax > 2) conditions.push("申込みを1〜2行に絞り、新たなカード・ローンの申込みを控える");
    if (cs.worstLate === "recent" || x.phoneLate) conditions.push("延滞の経緯の説明と、本人開示（CIC・JICC・KSC）での確認");
    if (x.oldQuake) conditions.push("耐震基準適合証明書など物件の書類確認");
    if (person.find((c) => c.key === "tenure").status === "warn") conditions.push("勤続年数・事業年数を満たしてからの申込みを検討");
    if (stage === "main" && pending.length) conditions.push(`書類の確認（未確認 ${pending.length}点）`);
    if (P.memberThreshold > 0 && loan > P.memberThreshold && !knockouts.length) conditions.push(`借入が${man(P.memberThreshold)}を超えるため、会員（出資金の払込み）への加入`);
    if (flat && flat.highLtv) conditions.push(`融資率が${P.highLtv.over}%を超えるため金利が+${P.highLtv.add}%（頭金を増やすと下がる）`);

    const strengths = [];
    if (e.score >= 150) strengths.push(`雇用が安定（${e.label}）`);
    if (x.tenure >= 5) strengths.push(`${e.self ? "事業" : "勤続"} ${x.tenure}年`);
    if (dti <= limit * 0.8) strengths.push(`返済負担率に余裕（${r1(dti)}% / 上限${limit}%）`);
    if (x.down / x.price >= 0.1) strengths.push(`自己資金 ${man(x.down)}（物件価格の${Math.round(x.down / x.price * 100)}%）`);
    if (cs.worstLate === "none" && cs.applyMax <= 2 && !x.phoneLate && !cs.kanpo) strengths.push("信用情報（3機関）に問題の申告なし");
    if (payoffAge <= 70) strengths.push(`完済 ${payoffAge}歳（定年前後に完済）`);
    if (ltv <= 80) strengths.push(`担保に余裕（掛目 ${r1(ltv)}%）`);

    const concerns = knockouts.slice();
    judged.filter((c) => c.status !== "ok" && !(stage === "main" && c.key === "id")).forEach((c) => concerns.push(`${c.label}：${c.value}（基準 ${c.rule}）`));
    if (stage === "main" && pending.length) concerns.push(`未確認の書類 ${pending.length}点`);

    // ---------- 条件を変えると ----------
    const whatIf = [];
    if (!nested) {
      const run = (label, patch) => {
        const r = screenWithPolicySwitch(Object.assign({}, x, patch), P, { nested: true, now: o.now });
        if (r.decision !== decision || r.maxLoan !== maxLoan) whatIf.push({ label, decision: r.decision, decisionLabel: DEC[r.decision].label, maxLoan: r.maxLoan, score: r.score });
      };
      if (debt > 0) run("他の借入をすべて完済した場合", { car: 0, card: 0, scholarship: 0, revo: 0, other: 0, cashing: 0 });
      if (x.term < termCap) run(`返済期間を${termCap}年にした場合`, { term: termCap });
      if (loan > maxLoan && maxLoan > 0) run(`借入額を${man(maxLoan)}にした場合（頭金を増やす）`, { down: x.down + (loan - maxLoan) });
      if (!x.jointIncome || x.jointType === "none") run("配偶者の年収200万円を連帯債務で収入合算した場合", { jointType: "codebtor", jointIncome: 200 });
      if (cs.applyMax > 2) run("申込件数を2件以下に絞った場合", { credit: Object.fromEntries(Object.entries(x.credit).map(([k, v]) => [k, Object.assign({}, v, { apply: Math.min(+v.apply || 0, 1) })])) });
      if (P.id !== "flat35") run("フラット35型で審査した場合", { __policy: "flat35" });
    }

    const audit = {
      at: o.now || new Date().toISOString(),
      engine: ENGINE_VERSION, policyId: P.id, policyLabel: P.label, policyVersion: P.version, stage,
      inputHash: hash(stable({ x, P })), decision, grade, score,
    };

    return {
      input: x, policy: P, stage, stageLabel: STAGE[stage], decision, decisionInfo: DEC[decision], holdReason, knockouts, stages,
      checks: judged, income, incomeBasis: inc.basis, loan, term, payoffAge, debt, limit, stressRate: sRate,
      monthly: { actual: mActual, stress: mStress, debt }, dti, dtiActual, multiple,
      collateral: ap.value, appraisal: ap, collateralRate: ap.rate, ltv, ltvLimit,
      caps, bind, maxLoan, parts, score, grade, guarantee, authority, docsRequired: docs,
      conditions, strengths, concerns, whatIf, audit, note: NOTE, flat, fees, guarantorNote: GUARANTOR_NOTE,
      total: mActual * x.term * 12, interest: mActual * x.term * 12 - loan,
    };
  }

  // 「フラット35型で審査した場合」のように、条件を変えると同時に型も変えるための入口
  const screenRaw = screen;
  function screenWithPolicySwitch(input, policy, opts) {
    if (input && input.__policy) { const p = input.__policy; const i = Object.assign({}, input); delete i.__policy; return screenRaw(i, p, opts); }
    return screenRaw(input, policy, opts);
  }

  return {
    ENGINE_VERSION, EMPLOY, NATIONALITY, DANSHIN, JOINT, STAGE, SAMPLE, NOTE, DEC,
    pmt, pv, dtiLimit, docsRequired, screen: screenWithPolicySwitch, man, yen, r1,
  };
});
