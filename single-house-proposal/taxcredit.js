// 住宅ローン控除（住宅借入金等特別控除）シミュレーション・エンジン
// 依存なし。Node（build.js / test.js）とブラウザ（simulator.html）の両方で同じ計算を使う。
// 制度の基準日：2026年10月（令和8年度税制改正後・令和8〜12年入居）。
// 年ごとの控除額は「年末残高 × 0.7%」を上限に、その年の所得税 → 翌年度の住民税（上限あり）の順に充当する。
// 控除しきれない額は「受け取れる金額」に含めない。
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TaxCredit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BASIS_DATE = "2026年10月";
  const RATE = 0.007;
  const RESIDENT_CAP = 97_500;      // 住民税からの控除上限（所得税の課税総所得金額等×5%、最高97,500円）
  const RESIDENT_CAP_RATE = 0.05;

  const KIND = { new: "新築", used: "中古（既存）", resale: "買取再販" };
  const PERF = {
    certified: "認定長期優良・低炭素住宅",
    zeh: "ZEH水準省エネ住宅",
    energy: "省エネ基準適合住宅",
    other: "その他の住宅",
  };

  // 借入限度額・控除期間（令和8〜12年入居）。[一般世帯, 子育て・若者夫婦世帯]
  // 出典：財務省「令和8年度税制改正の大綱」、国土交通省「住宅ローン減税」、国税庁 No.1211-1 ほか
  const TABLE = {
    new: {
      certified: { limit: [45_000_000, 50_000_000], years: 13 },
      zeh: { limit: [35_000_000, 45_000_000], years: 13 },
      energy: { limit: [20_000_000, 30_000_000], years: 13 },   // 2028年以降入居は経過措置のみ（judge参照）
      other: { limit: [20_000_000, 20_000_000], years: 10 },    // 2023年までに建築確認 等の場合のみ
    },
    used: {
      certified: { limit: [35_000_000, 45_000_000], years: 13 },
      zeh: { limit: [35_000_000, 45_000_000], years: 13 },
      energy: { limit: [20_000_000, 30_000_000], years: 13 },
      other: { limit: [20_000_000, 20_000_000], years: 10 },
    },
  };

  const ymd = (s) => (s ? new Date(s + "T00:00:00") : null);
  const yen = (v) => Math.round(v).toLocaleString("ja-JP") + "円";

  // ───────── 適用判定 ─────────
  function judge(p) {
    const reasons = [], warnings = [], docs = [];
    const y = p.moveInYear;
    let perf = p.perf;
    const kind = p.kind;
    const out = (msg) => ({ ok: false, limit: 0, years: 0, perf, special: false, reasons: [...reasons, msg], warnings, docs });

    if (y < 2026 || y > 2030) return out("入居年が対象期間（2026〜2030年）外です。過年度の条件は別途確認が必要です。");
    if (p.fromRelative) return out("生計を一にする親族など特別な関係のある者からの取得は対象外です。");
    if (p.loanYears < 10) return out("借入の返済期間が10年未満のため対象外です。");
    if (p.floor < 40) return out("床面積が40㎡未満のため対象外です。");
    if (kind === "used" && !p.seismicOK) return out("1981年以前の建築で耐震基準への適合が証明できないため対象外です（耐震基準適合証明書等が必要）。");
    if (perf !== "other" && !p.certs) {
      warnings.push(`${PERF[perf]}を証明する書類がないため「その他の住宅」として判定しました。`);
      perf = "other";
    }

    const special = !!(p.under19Dep || (p.married && (p.age < 40 || (p.spouseAge ?? 99) < 40)));
    const base = TABLE[kind === "used" ? "used" : "new"][perf];
    let limit = base.limit[0], years = base.years, useSpecial = false;
    if (special && base.limit[1] > base.limit[0]) {
      if (p.floor >= 50) { limit = base.limit[1]; useSpecial = true; }
      else warnings.push("子育て・若者夫婦世帯の上乗せは床面積50㎡以上が必要なため、一般世帯の限度額で計算しました。");
    }

    if (kind === "new") {
      if (p.redZone && y >= 2028) return out("2028年以降に入居する災害レッドゾーン内の新築（建替えを除く）は対象外です。");
      const cd = ymd(p.confirmDate), bd = ymd(p.builtDate);
      if (perf === "energy" && y >= 2028) {
        if ((cd && cd <= ymd("2027-12-31")) || (bd && bd <= ymd("2028-06-30"))) {
          limit = 20_000_000; years = 10; useSpecial = false;
          warnings.push("2028年以降入居の省エネ基準適合住宅：2027年末までの建築確認（または2028年6月末までの建築）の経過措置として、2,000万円・10年で計算しました。");
          docs.push("建築確認済証・検査済証の写し、または登記事項証明書（経過措置の確認用）");
        } else return out("2028年以降に入居する新築の省エネ基準適合住宅は、2027年末までに建築確認を受けたもの等を除き対象外です。");
      }
      if (perf === "other") {
        if ((cd && cd <= ymd("2023-12-31")) || (bd && bd <= ymd("2024-06-30"))) {
          warnings.push("省エネ基準を満たさない新築は、2023年末までの建築確認（または2024年6月末までの建築）の場合に限り2,000万円・10年です。");
          docs.push("建築確認済証の写し、または登記事項証明書（2023年末以前の建築確認等の確認用）");
        } else return out("省エネ基準を満たさない新築住宅（2024年以降に建築確認）は対象外です。");
      }
    }
    if (kind === "resale") warnings.push("買取再販住宅は宅地建物取引業者が一定の増改築等を行い取得から2年以内に再販売したもの等が対象です。借入限度額の扱いは新築に準じて計算していますが、適用前に最新の国税庁資料で〔要確認〕。");
    if (p.floor < 50) warnings.push("床面積40㎡以上50㎡未満は、その年の合計所得金額が1,000万円以下の年のみ控除を受けられます。");

    docs.push("住宅ローンの年末残高等証明書（金融機関から毎年発行）", "登記事項証明書（土地・建物）", "売買契約書または工事請負契約書の写し");
    if (perf === "certified") docs.push("長期優良住宅・低炭素建築物の認定通知書の写し（＋住宅用家屋証明書 等）");
    if (perf === "zeh" || perf === "energy") docs.push("住宅省エネルギー性能証明書 または 建設住宅性能評価書の写し");
    if (kind === "used" && p.builtYear && p.builtYear < 1982) docs.push("耐震基準適合証明書・建設住宅性能評価書（耐震等級）・既存住宅売買瑕疵保険の付保証明書のいずれか");

    reasons.push(`${KIND[kind]}・${PERF[perf]}：借入限度額${(limit / 10_000).toLocaleString()}万円・控除期間${years}年${useSpecial ? "（子育て・若者夫婦世帯の上乗せ）" : ""}`);
    return { ok: true, limit, years, perf, special: useSpecial, reasons, warnings, docs };
  }

  // ───────── 税額の概算（給与所得者・単身を想定） ─────────
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
  function incomeTax(t) {
    const B = [[1_950_000, 0.05, 0], [3_300_000, 0.1, 97_500], [6_950_000, 0.2, 427_500], [9_000_000, 0.23, 636_000],
      [18_000_000, 0.33, 1_536_000], [40_000_000, 0.4, 2_796_000], [Infinity, 0.45, 4_796_000]];
    const b = B.find((x) => t <= x[0]);
    return Math.max(0, Math.floor(t * b[1] - b[2]));
  }
  // 戻り値：合計所得金額、所得税額（住宅ローン控除前・復興特別所得税を除く）、課税総所得金額等、住民税所得割額
  // conservative=true：2028年以降も令和8・9年分の控除特例が続くと仮定し、税額（＝控除できる余地）を低めに見積もる
  function estimateTax(gross, year, socialRate = 0.15, conservative = true) {
    if (conservative) year = Math.min(year, 2027);
    const total = Math.max(0, gross - salaryDeduction(gross, year));
    const si = gross * socialRate;
    const taxable = Math.floor(Math.max(0, total - si - basicDeductionIT(total, year)) / 1000) * 1000;
    const rtTaxable = Math.floor(Math.max(0, total - si - 430_000) / 1000) * 1000;
    const rt = Math.max(0, Math.floor(rtTaxable * 0.1 - 2_500)); // 調整控除は単身の概算値
    return { totalIncome: total, incomeTax: incomeTax(taxable), taxable, residentTax: rt, estimated: true };
  }

  // ───────── 返済スケジュール ─────────
  function payment(P, rate, years) {
    const r = rate / 12, n = years * 12;
    if (r === 0) return P / n;
    const g = Math.pow(1 + r, n);
    return (P * r * g) / (g - 1);
  }
  function balanceAfter(P, rate, years, k) {
    const r = rate / 12, pm = payment(P, rate, years);
    if (r === 0) return Math.max(0, P - pm * k);
    const g = Math.pow(1 + r, k);
    return Math.max(0, P * g - (pm * (g - 1)) / r);
  }

  // ───────── 年次シミュレーション ─────────
  // p: { moveInYear, moveInMonth, age, married, spouseAge, under19Dep, gross, socialRate,
  //      taxMode:'estimate'|'detail', detail:{totalIncome,incomeTax,taxable,residentTax},
  //      loan, loanYears, rate, price, floor, kind, perf, certs, confirmDate, builtDate, builtYear,
  //      seismicOK, redZone, fromRelative }
  function simulate(p) {
    const j = judge(p);
    const pmt = payment(p.loan, p.rate, p.loanYears);
    const rows = [];
    const firstPayments = 12 - p.moveInMonth; // 入居月に借入実行・翌月から返済と仮定
    const n = Math.max(j.years, 13);
    for (let i = 0; i < n; i++) {
      const year = p.moveInYear + i;
      const k = Math.min(p.loanYears * 12, firstPayments + 12 * i);
      const bal = balanceAfter(p.loan, p.rate, p.loanYears, k);
      const tax = p.taxMode === "detail" && p.detail ? { ...p.detail, estimated: false } : estimateTax(p.gross, year, p.socialRate ?? 0.15, p.conservative !== false);
      const inPeriod = j.ok && i < j.years;
      let blocked = "";
      if (inPeriod && tax.totalIncome > 20_000_000) blocked = "合計所得金額2,000万円超";
      if (inPeriod && p.floor < 50 && tax.totalIncome > 10_000_000) blocked = "床面積50㎡未満かつ合計所得1,000万円超";
      const base = inPeriod && !blocked ? Math.min(bal, j.limit, p.price) : 0;
      const max = Math.floor((base * RATE) / 100) * 100;
      const fromIT = Math.min(max, tax.incomeTax);
      const resCap = Math.min(RESIDENT_CAP, Math.floor(tax.taxable * RESIDENT_CAP_RATE), tax.residentTax);
      const fromRT = Math.min(max - fromIT, resCap);
      rows.push({ i: i + 1, year, balance: bal, inPeriod, blocked, base, max, fromIT, fromRT, unused: max - fromIT - fromRT, actual: fromIT + fromRT, tax });
    }
    const P = rows.filter((r) => r.inPeriod);
    const sum = (f) => P.reduce((a, r) => a + r[f], 0);
    return {
      judge: j, pmt, rows,
      first: P[0] ? P[0].actual : 0,
      laterAvg: P.length > 1 ? P.slice(1).reduce((a, r) => a + r.actual, 0) / (P.length - 1) : 0,
      totalMax: sum("max"), totalActual: sum("actual"), totalIT: sum("fromIT"), totalRT: sum("fromRT"), totalUnused: sum("unused"),
      estimated: P.some((r) => r.tax.estimated),
    };
  }

  return { BASIS_DATE, RATE, RESIDENT_CAP, KIND, PERF, TABLE, judge, simulate, estimateTax, payment, balanceAfter, salaryDeduction, basicDeductionIT, incomeTax, yen };
});
