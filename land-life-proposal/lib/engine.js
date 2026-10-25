// 計算エンジン（画面から独立・依存なし）
// Node：const LL = require("./engine")   ブラウザ：<script src="lib/rules.js"> → <script src="lib/engine.js"> で window.LL
// 住宅ローン／税額の概算／住宅ローン控除／住居費／土地・建物の価値／売却手取り／収入減少／3つの住まい方比較／物件の適合
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./rules"));
  else {
    root.LL = root.LL || {};
    Object.assign(root.LL, factory(root.LL.RULES));
  }
})(typeof self !== "undefined" ? self : this, function (R) {
  "use strict";

  // ───────── 表示用 ─────────
  const fmt = {
    yen: (v) => Math.round(v).toLocaleString("ja-JP") + "円",
    man: (v, d = 0) => (v / 10_000).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }) + "万円",
    manN: (v, d = 0) => (v / 10_000).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }),
    pct: (v, d = 1) => (v * 100).toFixed(d) + "%",
    signedMan: (v, d = 0) => (v >= 0 ? "＋" : "−") + (Math.abs(v) / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: d }) + "万円",
  };
  const date = (s) => (s ? new Date(s + "T00:00:00") : null);

  // ───────── 住宅ローン（元利均等） ─────────
  // 毎月返済額 = P × r × (1+r)^n ÷ {(1+r)^n − 1}
  function payment(P, rate, years) {
    const r = rate / 12, n = years * 12;
    if (P <= 0) return 0;
    if (r === 0) return P / n;
    const g = Math.pow(1 + r, n);
    return (P * r * g) / (g - 1);
  }
  // k回返済した後の残高
  function balanceAfter(P, rate, years, k) {
    const r = rate / 12, pm = payment(P, rate, years);
    k = Math.min(k, years * 12);
    if (r === 0) return Math.max(0, P - pm * k);
    const g = Math.pow(1 + r, k);
    return Math.max(0, P * g - (pm * (g - 1)) / r);
  }
  // 入居月に借入を実行し、翌月から返済すると仮定した「i年目（1始まり）の年末残高」
  function yearEndBalance(P, rate, years, moveInMonth, i) {
    return balanceAfter(P, rate, years, 12 - moveInMonth + 12 * (i - 1));
  }

  // ───────── 税額の概算（給与所得のみ・単身） ─────────
  function salaryDeduction(g, year) {
    const min = year <= 2027 ? 740_000 : 690_000; // 令和8・9年分は最低保障額に特例加算
    let f;
    if (g <= 1_625_000) f = 550_000;
    else if (g <= 1_800_000) f = g * 0.4 - 100_000;
    else if (g <= 3_600_000) f = g * 0.3 + 80_000;
    else if (g <= 6_600_000) f = g * 0.2 + 440_000;
    else if (g <= 8_500_000) f = g * 0.1 + 1_100_000;
    else f = 1_950_000;
    return Math.min(g, Math.max(min, f));
  }
  function basicDeductionIT(total, year) {
    if (total > 25_000_000) return 0;
    if (total > 24_500_000) return 160_000;
    if (total > 24_000_000) return 320_000;
    if (total > 23_500_000) return 480_000;
    if (year <= 2027) { // 令和8・9年分の特例
      if (total <= 4_890_000) return 1_040_000;
      if (total <= 6_550_000) return 670_000;
    }
    return 620_000;
  }
  function incomeTaxOf(t) {
    const B = [[1_950_000, 0.05, 0], [3_300_000, 0.1, 97_500], [6_950_000, 0.2, 427_500], [9_000_000, 0.23, 636_000],
      [18_000_000, 0.33, 1_536_000], [40_000_000, 0.4, 2_796_000], [Infinity, 0.45, 4_796_000]];
    const b = B.find((x) => t <= x[0]);
    return Math.max(0, Math.floor(t * b[1] - b[2]));
  }
  // conservative=true：2028年以降も令和8・9年分の特例が続くと仮定（税額＝控除できる余地を低めに見積もる）
  function estimateTax(gross, year, socialRate = 0.15, conservative = true) {
    if (conservative) year = Math.min(year, 2027);
    const totalIncome = Math.max(0, gross - salaryDeduction(gross, year));
    const social = gross * socialRate;
    const taxable = Math.floor(Math.max(0, totalIncome - social - basicDeductionIT(totalIncome, year)) / 1000) * 1000;
    const rtTaxable = Math.floor(Math.max(0, totalIncome - social - 430_000) / 1000) * 1000;
    const residentTax = Math.max(0, Math.floor(rtTaxable * 0.1 - 2_500)); // 所得割（調整控除は単身の概算）
    const incomeTax = incomeTaxOf(taxable);
    const takeHome = gross - social - incomeTax * 1.021 - residentTax - 5_000; // 復興特別所得税・均等割を含む概算
    return { totalIncome, incomeTax, taxable, residentTax, social, takeHome, estimated: true };
  }

  // ───────── 住宅ローン控除 ─────────
  function isSpecialHousehold(c) {
    const C = R.COMMON;
    if (c.under19Dep) return true;
    if (c.household === "married" && (c.age < C.specialAge || (c.spouseAge ?? 99) < C.specialAge)) return true;
    return false; // 単身者には自動で適用しない
  }
  function judge(c, p) {
    const C = R.COMMON, y = c.moveInYear, reasons = [], warnings = [], docs = [...R.DOCS.common];
    let perf = p.perf;
    const no = (msg) => ({ ok: false, limit: 0, years: 0, rate: C.rate, perf, special: false, reason: msg, warnings, docs, check: false });
    const years = R.RULES.filter((r) => y >= r.from && y <= r.to);
    if (!years.length) return no(`入居年${y}年は、このデータ（${R.BASIS_DATE}時点・2026〜2030年入居）の対象外です。`);
    if (p.fromRelative) return no("親族など生計を一にする人や特別な関係のある人からの取得は対象外です。");
    if (c.loanYears < C.minLoanYears) return no(`返済期間が${C.minLoanYears}年未満のため対象外です。`);
    if (p.floor < C.minFloor) return no(`床面積が${C.minFloor}㎡未満のため対象外です。`);
    if (p.moveInOK === false) return no(`取得から${C.moveInWithinMonths}か月以内に入居しない場合は対象外です。`);
    if (p.kind === "used" && p.builtDate && date(p.builtDate) < date(C.seismicBuiltFrom) && !p.seismicCert)
      return no("1981年以前の建築で、耐震基準に適合する証明がないため対象外です。");
    if (perf !== "other" && !p.certs) {
      warnings.push(`${R.PERF[perf]}を証明する書類がないため「その他の住宅」として判定しました。`);
      perf = "other";
    }
    if (p.kind === "new" && p.redZone && y >= C.redZoneNewFrom) return no(`${C.redZoneNewFrom}年以降に入居する災害レッドゾーン内の新築（建替えを除く）は対象外です。`);
    const rule = years.find((r) => r.kinds.includes(p.kind) && r.perf === perf);
    if (!rule) return no(`${R.KIND[p.kind]}・${R.PERF[perf]}は${y}年入居では対象外です。`);
    if (rule.cond) {
      const ok = (p.confirmDate && date(p.confirmDate) <= date(rule.cond.confirmBy)) || (p.builtDate && date(p.builtDate) <= date(rule.cond.builtBy));
      if (!ok) return no(rule.note.replace(/に限り.*/, "に限り対象です。条件を満たさないため対象外です。"));
      warnings.push(rule.note);
      docs.push(R.DOCS.confirm);
    }
    const sp = isSpecialHousehold(c);
    let limit = rule.limit[0], special = false;
    if (sp && rule.limit[1] > rule.limit[0]) {
      if (p.floor >= C.specialMinFloor) { limit = rule.limit[1]; special = true; }
      else warnings.push("子育て・若者夫婦世帯の上乗せは床面積50㎡以上が必要なため、一般の限度額で計算しました。");
    }
    if (p.floor < C.floorFullIncome) warnings.push(`床面積${C.minFloor}〜${C.floorFullIncome}㎡は、合計所得金額が1,000万円以下の年だけ控除できます。`);
    if (rule.check || p.kind === "resale") warnings.push("買取再販住宅の借入限度額は新築に準じて計算しています〔要確認〕。宅地建物取引業者が一定の改修を行い、取得から2年以内に販売したもの等が対象です。");
    if (R.DOCS[perf]) docs.push(R.DOCS[perf]);
    if (p.kind === "used" && p.builtDate && date(p.builtDate) < date(C.seismicBuiltFrom)) docs.push(R.DOCS.seismic);
    reasons.push(`${R.KIND[p.kind]}・${R.PERF[perf]}`);
    return { ok: true, limit, years: rule.years, rate: C.rate, perf, special, reason: reasons[0], warnings, docs, check: !!(rule.check || p.kind === "resale") };
  }
  // 年ごとの控除見込額。上限 = min(年末残高, 借入限度額, 取得対価) × 0.7%（100円未満切捨て）
  // 実際 = 所得税（控除前）→ 翌年度住民税（課税総所得金額等×5%・最高97,500円・所得割まで）の順に充当。控除しきれない額は加算しない
  function creditSimulate(c, p, loan) {
    const C = R.COMMON, j = judge(c, p);
    const rows = [];
    const n = Math.max(j.years, 13);
    const sched1 = yearEndBalance(loan.amount, loan.rate, loan.years, c.moveInMonth, 1);
    const scale = p.firstBalance ? p.firstBalance / sched1 : 1; // 年末残高を手入力した場合は返済計画をその比率で補正
    // 諸費用ローンなど、住宅の取得対価以外の借入は控除の対象外 → 年末残高を「住宅取得分の割合」で按分する
    const share = loan.amount > 0 ? Math.min(1, (loan.eligible ?? loan.amount) / loan.amount) : 0;
    for (let i = 1; i <= n; i++) {
      const year = c.moveInYear + i - 1;
      const balance = yearEndBalance(loan.amount, loan.rate, loan.years, c.moveInMonth, i) * scale;
      const tax = c.taxMode === "detail" && c.tax ? { ...c.tax, estimated: false } : estimateTax(c.gross, year, c.socialRate ?? 0.15);
      const inPeriod = j.ok && i <= j.years;
      let blocked = "";
      if (inPeriod && tax.totalIncome > C.incomeCap) blocked = "合計所得金額が2,000万円超の年";
      if (inPeriod && p.floor < C.floorFullIncome && tax.totalIncome > C.incomeCapSmall) blocked = "50㎡未満かつ合計所得1,000万円超の年";
      const eligibleBalance = balance * share;
      const base = inPeriod && !blocked ? Math.min(eligibleBalance, j.limit, p.price) : 0;
      const max = Math.floor((base * C.rate) / 100) * 100;
      const fromIT = Math.min(max, tax.incomeTax);
      const resCap = Math.min(C.residentCapMax, Math.floor(tax.taxable * C.residentCapRate), tax.residentTax);
      const fromRT = Math.min(max - fromIT, resCap);
      rows.push({ i, year, balance, eligibleBalance, inPeriod, blocked, base, max, fromIT, fromRT, unused: max - fromIT - fromRT, actual: fromIT + fromRT, tax });
    }
    const P = rows.filter((r) => r.inPeriod);
    const sum = (f, a = P) => a.reduce((s, r) => s + r[f], 0);
    return {
      judge: j, rows,
      first: P[0] ? P[0].actual : 0,
      firstMax: P[0] ? P[0].max : 0,
      laterAvg: P.length > 1 ? sum("actual", P.slice(1)) / (P.length - 1) : 0,
      totalMax: sum("max"), total: sum("actual"), totalIT: sum("fromIT"), totalRT: sum("fromRT"), totalUnused: sum("unused"),
      first10: sum("actual", P.slice(0, 10)),
      estimated: P.some((r) => r.tax.estimated),
    };
  }

  // ───────── 住居費 ─────────
  // 仲介手数料の上限（宅地建物取引業法の報酬告示、税込）
  function brokerFee(price) {
    let f;
    if (price <= 2_000_000) f = price * 0.05;
    else if (price <= 4_000_000) f = price * 0.04 + 20_000;
    else f = price * 0.03 + 60_000;
    return f * 1.1;
  }
  function ownMonthly(p, pmt) {
    const o = { loan: pmt, tax: p.propTaxYear / 12, ins: p.insYear / 12, repair: p.repairMonth };
    o.total = o.loan + o.tax + o.ins + o.repair;
    o.upkeep = o.total - o.loan;
    return o;
  }
  function rentMonthly(r) {
    const o = { rent: r.rent, renew: (r.rent * (r.renewMonths ?? 1)) / (r.renewEvery ?? 24), ins: (r.insYear ?? 20_000) / 12, park: r.parking ?? 0 };
    o.total = o.rent + o.renew + o.ins + o.park;
    return o;
  }
  function condoMonthly(m, loan) {
    const pmt = payment(Math.max(0, m.price - m.down), loan.rate, loan.years);
    const o = { loan: pmt, fees: m.fees, tax: m.propTaxYear / 12, ins: m.insYear / 12, park: m.parking };
    o.total = o.loan + o.fees + o.tax + o.ins + o.park;
    return o;
  }

  // ───────── 土地・建物の価値と売却 ─────────
  // 建物：t年後の価値 = 現在の建物価値 × max(下限, 1 − 年あたり減価 × t)。年あたり減価は「10年後に b10 になる」ように決める
  const SCENARIOS = [
    { key: "down", label: "下落", landRate: -0.01, b10Delta: -0.1 },
    { key: "flat", label: "横ばい", landRate: 0, b10Delta: 0 },
    { key: "up", label: "上昇", landRate: 0.01, b10Delta: 0.1 },
  ];
  const BLDG_FLOOR = 0.1;
  function valueAt(p, s, t) {
    const land = p.landPrice * Math.pow(1 + s.landRate, t);
    const b10 = Math.min(0.95, Math.max(0.05, p.b10 + s.b10Delta));
    const bldg = p.bldgPrice * Math.max(BLDG_FLOOR, 1 - ((1 - b10) / 10) * t);
    return { land, bldg, total: land + bldg };
  }
  function saleAt(p, s, t, loan, otherCost = 100_000) {
    const v = valueAt(p, s, t);
    const balance = balanceAfter(loan.amount, loan.rate, loan.years, 12 * t);
    const cost = brokerFee(v.total) + otherCost;
    return { ...v, cost, balance, net: v.total - cost - balance };
  }

  // ───────── 収入が減った場合 ─────────
  function incomeRisk(c, own, cashLeft, drops = [0, 0.2, 0.4]) {
    return drops.map((d) => {
      const gross = c.gross * (1 - d);
      const t = estimateTax(gross, c.moveInYear, c.socialRate ?? 0.15);
      const takeHomeM = t.takeHome / 12;
      const out = own.total + c.livingMonth + (c.existingMonthly || 0);
      const gap = takeHomeM - out;
      return { drop: d, gross, takeHomeM, loanRatio: own.loan / takeHomeM, housingRatio: own.total / takeHomeM, gap, months: gap < 0 ? cashLeft / -gap : Infinity };
    });
  }

  // ───────── 住宅ローン審査の返済比率（目安） ─────────
  // 返済比率 =（住宅ローンの年間返済［審査金利で計算］＋ 既存の借入の年間返済）÷ 年収
  // 基準は金融機関で異なる。既定はフラット35の基準（年収400万円未満30%・以上35%）
  function screening({ gross, existingMonthly = 0, loan, years, screenRate = 0.03, limits = [[4_000_000, 0.3], [Infinity, 0.35]] }) {
    const limit = limits.find((l) => gross < l[0])[1];
    const pm = payment(loan, screenRate, years);
    const ratio = gross > 0 ? (pm * 12 + existingMonthly * 12) / gross : Infinity;
    const room = Math.max(0, (gross * limit) / 12 - existingMonthly); // 住宅ローンに使える毎月の上限
    const r = screenRate / 12, n = years * 12, g = Math.pow(1 + r, n);
    const maxLoan = r === 0 ? room * n : (room * (g - 1)) / (r * g);
    return { ratio, limit, ok: ratio <= limit, maxLoan, screenRate };
  }
  // 毎月の返済額から買える物件価格を逆算（諸費用ローンありなら諸費用も借入に含める）
  function affordablePrice({ monthly, rate, years, down = 0, costRate = 0.07, financeCosts = false }) {
    const r = rate / 12, n = years * 12, g = Math.pow(1 + r, n);
    const loan = r === 0 ? monthly * n : (monthly * (g - 1)) / (r * g);
    const price = financeCosts ? (loan + down) / (1 + costRate) : loan + down;
    const cash = financeCosts ? down : down + price * costRate;
    return { price: Math.max(0, price), loan, cash };
  }

  // ───────── 賃貸・マンション・戸建ての比較（優先順位で重み付け） ─────────
  // 3=強み 2=条件しだいで良好 1=注意 0=該当しない（一般的な傾向。個別の物件で変わる）
  const AXES = [
    { key: "life", label: "生活価値（広さ・独立性）", rent: 1, condo: 2, house: 3 },
    { key: "cost", label: "資金負担の軽さ（初期・毎月）", rent: 3, condo: 1, house: 1 },
    { key: "freedom", label: "自由度（改修・使い方）", rent: 1, condo: 2, house: 3 },
    { key: "upkeep", label: "維持管理の手軽さ", rent: 3, condo: 2, house: 1 },
    { key: "asset", label: "資産性（立地・条件しだい）", rent: 0, condo: 2, house: 2 },
    { key: "liquidity", label: "流動性（住み替えやすさ）", rent: 3, condo: 2, house: 1 },
    { key: "future", label: "将来の選択肢（住む・売る・貸す）", rent: 1, condo: 2, house: 2 },
  ];
  function compare3(weights) {
    const opts = ["rent", "condo", "house"];
    const score = Object.fromEntries(opts.map((o) => [o, AXES.reduce((s, a) => s + a[o] * (weights[a.key] ?? 3), 0)]));
    const max = AXES.reduce((s, a) => s + 3 * (weights[a.key] ?? 3), 0);
    const rank = [...opts].sort((a, b) => score[b] - score[a]);
    return { score, max, rank };
  }

  // ───────── 物件の希望適合 ─────────
  // status: ok=合う / part=一部 / ng=合わない / unknown=未確認
  const WISHES = [
    { key: "budget", label: "毎月の住居費", test: (w, p, x) => (x.own.total <= w.value ? "ok" : x.own.total <= w.value * 1.1 ? "part" : "ng"), show: (w, p, x) => `希望 ${fmt.manN(w.value, 1)}万円以内／試算 ${fmt.manN(x.own.total, 1)}万円` },
    { key: "commute", label: "通勤時間", test: (w, p) => (p.attrs.commute == null ? "unknown" : p.attrs.commute <= w.value ? "ok" : p.attrs.commute <= w.value + 10 ? "part" : "ng"), show: (w, p) => `希望 ${w.value}分以内／物件 ${p.attrs.commute == null ? "未確認" : p.attrs.commute + "分"}` },
    { key: "floor", label: "広さ", test: (w, p) => (p.floor >= w.value ? "ok" : p.floor >= w.value * 0.9 ? "part" : "ng"), show: (w, p) => `希望 ${w.value}㎡以上／物件 ${p.floor}㎡` },
    { key: "parking", label: "駐車場", test: (w, p) => (p.attrs.parking >= w.value ? "ok" : "ng"), show: (w, p) => `希望 ${w.value}台／物件 ${p.attrs.parking}台` },
    { key: "study", label: "書斎・仕事部屋", test: (w, p) => (p.attrs.study === true ? "ok" : p.attrs.study === false ? "ng" : "unknown"), show: (w, p) => (p.attrs.study === true ? "独立した1部屋を確保できる" : p.attrs.study === false ? "確保しにくい" : "未確認") },
    { key: "garden", label: "庭・外の空間", test: (w, p) => (p.attrs.garden === true ? "ok" : p.attrs.garden === false ? "ng" : "unknown"), show: (w, p) => (p.attrs.garden === true ? "あり" : p.attrs.garden === false ? "なし" : "未確認") },
    { key: "pet", label: "ペット", test: (w, p) => (p.attrs.pet === true ? "ok" : p.attrs.pet === false ? "ng" : "unknown"), show: (w, p) => (p.attrs.pet === true ? "飼育できる（近隣への配慮は必要）" : p.attrs.pet === false ? "難しい" : "未確認") },
    { key: "energy", label: "省エネ性能", test: (w, p) => (p.certs && (p.perf === "zeh" || p.perf === "certified") ? "ok" : p.certs && p.perf === "energy" ? "part" : "unknown"), show: (w, p) => (p.certs ? R.PERF[p.perf] + "（証明書あり）" : "証明書が未確認") },
    { key: "hazard", label: "災害リスク", test: (w, p) => ({ low: "ok", mid: "part", high: "ng" })[p.attrs.hazard] || "unknown", show: (w, p) => ({ low: "ハザードマップ上のリスクは低い", mid: "一部の災害で注意が必要", high: "浸水・土砂などのリスクが高い" })[p.attrs.hazard] || "ハザードマップで未確認" },
    { key: "seismic", label: "耐震性", test: (w, p) => (p.kind !== "used" || (p.builtDate && date(p.builtDate) >= date("1982-01-01")) || p.seismicCert ? "ok" : "unknown"), show: (w, p) => (p.kind !== "used" ? "現行基準の新築" : p.builtDate && date(p.builtDate) >= date("1982-01-01") ? "1982年以降の建築（新耐震）" : p.seismicCert ? "耐震の証明あり" : "耐震の証明が未確認") },
  ];
  function fit(wishes, p, x) {
    return wishes.filter((w) => w.on !== false).map((w) => {
      const d = WISHES.find((v) => v.key === w.key);
      return { key: w.key, label: d.label, must: !!w.must, status: d.test(w, p, x), detail: d.show(w, p, x) };
    });
  }

  // ───────── まとめて計算 ─────────
  function compute(input) {
    const c = { ...input.customer, loanYears: input.loan.years };
    const tax = c.taxMode === "detail" && c.tax ? { ...c.tax, estimated: false, takeHome: estimateTax(c.gross, c.moveInYear, c.socialRate).takeHome } : estimateTax(c.gross, c.moveInYear, c.socialRate);
    const rent = rentMonthly({ rent: c.rent, parking: c.rentParking, insYear: c.rentInsYear });
    const condo = input.condo ? condoMonthly(input.condo, input.loan) : null;
    const props = input.props.map((p) => {
      const buyCost = p.price * p.buyCostRate;
      const eligible = Math.max(0, p.price - p.down);
      const loan = { amount: eligible + (p.financeCosts ? buyCost : 0), eligible, rate: input.loan.rate, years: input.loan.years };
      const pmt = payment(loan.amount, loan.rate, loan.years);
      const cashOut = p.down + (p.financeCosts ? 0 : buyCost);
      const cashLeft = c.savings - cashOut;
      const own = ownMonthly(p, pmt);
      const credit = creditSimulate(c, p, loan);
      const ten = {
        initial: cashOut, loan: pmt * 120, tax: p.propTaxYear * 10, ins: p.insYear * 10, repair: p.repairMonth * 120, credit: credit.first10,
      };
      ten.without = ten.initial + ten.loan + ten.tax + ten.ins + ten.repair;
      ten.with = ten.without - ten.credit;
      const balances = Array.from({ length: input.loan.years + 1 }, (_, t) => balanceAfter(loan.amount, loan.rate, loan.years, 12 * t));
      const values = SCENARIOS.map((s) => ({ ...s, path: balances.map((_, t) => valueAt(p, s, t).total) }));
      const sale = [5, 10, 20].map((t) => ({ t, byScen: SCENARIOS.map((s) => ({ ...s, ...saleAt(p, s, t, loan) })) }));
      const reserveTarget = (own.total + c.livingMonth) * 6;
      const x = { loan, pmt, buyCost, cashOut, cashLeft, own, credit, ten, balances, values, sale, reserveTarget };
      x.risk = incomeRisk(c, own, Math.max(0, cashLeft), input.drops);
      x.fit = fit(input.wishes || [], p, x);
      x.screen = screening({ gross: c.gross, existingMonthly: c.existingMonthly || 0, loan: loan.amount, years: loan.years, screenRate: input.screen?.rate ?? 0.03 });
      return { p, ...x };
    });
    const p0 = input.props[0];
    const afford = c.monthlyWish > 0 ? affordablePrice({ monthly: c.monthlyWish, rate: input.loan.rate, years: input.loan.years, down: p0.down, costRate: p0.buyCostRate, financeCosts: !!p0.financeCosts }) : null;
    return { input, c, tax, rent, condo, props, afford, compare: compare3(input.priorities || {}) };
  }

  // ───────── サンプル（資料・アプリの初期値） ─────────
  const SAMPLE = {
    customer: {
      name: "", age: 35, household: "single", spouseAge: null, under19Dep: false,
      gross: 5_500_000, socialRate: 0.15, rent: 100_000, rentParking: 0, rentInsYear: 20_000,
      savings: 6_000_000, livingMonth: 120_000, moveInYear: 2027, moveInMonth: 3,
      taxMode: "estimate", tax: { totalIncome: 3_960_000, incomeTax: 112_000, taxable: 2_095_000, residentTax: 268_000 },
    },
    loan: { rate: 0.015, years: 35 },
    props: [
      { id: "A", label: "新築戸建て", kind: "new", perf: "zeh", certs: true, price: 35_000_000, landPrice: 15_000_000, bldgPrice: 20_000_000,
        landArea: 100, floor: 85, builtDate: "2027-01-31", confirmDate: "2026-06-01", seismicCert: false, redZone: false, fromRelative: false, moveInOK: true,
        down: 3_000_000, buyCostRate: 0.07, propTaxYear: 120_000, insYear: 30_000, repairMonth: 15_000, b10: 0.5, firstBalance: null,
        attrs: { commute: 35, parking: 1, study: true, garden: true, pet: true, hazard: null } },
      { id: "B", label: "中古戸建て", kind: "used", perf: "other", certs: false, price: 25_000_000, landPrice: 15_000_000, bldgPrice: 10_000_000,
        landArea: 110, floor: 90, builtDate: "2012-03-31", confirmDate: "", seismicCert: false, redZone: false, fromRelative: false, moveInOK: true,
        down: 3_000_000, buyCostRate: 0.08, propTaxYear: 90_000, insYear: 30_000, repairMonth: 25_000, b10: 0.4, firstBalance: null,
        attrs: { commute: 40, parking: 2, study: true, garden: true, pet: true, hazard: null } },
    ],
    condo: { price: 30_000_000, down: 3_000_000, fees: 25_000, propTaxYear: 100_000, insYear: 15_000, parking: 10_000 },
    priorities: { life: 5, cost: 3, freedom: 4, upkeep: 2, asset: 3, liquidity: 2, future: 3 },
    wishes: [
      { key: "budget", value: 130_000, must: true }, { key: "commute", value: 30, must: false }, { key: "floor", value: 80, must: false },
      { key: "parking", value: 1, must: true }, { key: "study", must: true }, { key: "garden", must: false }, { key: "pet", must: false },
      { key: "energy", must: false }, { key: "hazard", must: true }, { key: "seismic", must: true },
    ],
    drops: [0, 0.2, 0.4],
  };

  return {
    fmt, payment, balanceAfter, yearEndBalance, salaryDeduction, basicDeductionIT, incomeTaxOf, estimateTax,
    isSpecialHousehold, judge, creditSimulate, brokerFee, ownMonthly, rentMonthly, condoMonthly,
    SCENARIOS, valueAt, saleAt, incomeRisk, screening, affordablePrice, AXES, compare3, WISHES, fit, compute, SAMPLE,
  };
});
