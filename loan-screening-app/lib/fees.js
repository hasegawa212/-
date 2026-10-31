// 保証料と事務手数料。保証料は「金利上乗せ型」か「一括前払い型」。フラット35（保証会社なし）とネット銀行型（保証料なし）は0
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const FEE_TYPE = { rate: "金利上乗せ型（毎月の金利に含める）", lump: "一括前払い型（借入時に払う）" };

  // loan: 万円、term: 年。一括前払いは 表の額（円／100万円・35年）× 借入額 × 期間/35 の目安
  function guaranteeCost(x, P, grade, loan, term) {
    const g = P.guarantor;
    if (g.type === "none" || g.type === "waived") return { type: g.type, feeType: null, lump: 0, rateAdd: 0, label: g.label };
    const feeType = x.feeType === "lump" ? "lump" : "rate";
    const per = g.lumpPer100[grade];
    const row = P.guarantee[grade];
    if (per == null || !row) return { type: g.type, feeType, lump: 0, rateAdd: 0, label: g.label, unavailable: true };
    if (feeType === "lump") return { type: g.type, feeType, lump: Math.round(per * (loan / 100) * (term / 35)), rateAdd: 0, label: g.label };
    return { type: g.type, feeType, lump: 0, rateAdd: row.fee, label: g.label };
  }

  function adminFee(P, loan) {
    return P.adminFee.type === "rate" ? Math.round(loan * 10000 * P.adminFee.value / 100) : P.adminFee.value;
  }

  return { FEE_TYPE, guaranteeCost, adminFee };
});
