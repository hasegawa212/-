// 審査に使う年収。会社員は直近、自営業・経営者は型の基準（3期平均／2期の低いほう／直近）、収入合算は割合をかけて足す
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const SELF = ["self", "owner"];
  const BASIS = { avg3: "直近3期の平均", min2: "直近2期の低いほう", latest: "直近の年収" };

  function incomeUsed(x, P) {
    const latest = +x.income || 0;
    let own = latest, basis = "直近の年収";
    if (SELF.includes(x.employ)) {
      const years = [latest, +x.incomePrev || 0, +x.incomePrev2 || 0];
      if (P.incomeBasis === "avg3") {
        const got = years.filter((v) => v > 0);
        own = got.length ? got.reduce((s, v) => s + v, 0) / got.length : 0;
      } else if (P.incomeBasis === "min2") {
        own = years[1] > 0 ? Math.min(years[0], years[1]) : years[0];
      }
      basis = BASIS[P.incomeBasis] || basis;
    }
    const jt = x.jointType || "none";
    const share = jt === "guarantor" ? P.jointGuarantor : jt === "codebtor" ? P.jointCodebtor : 0;
    const joint = (+x.jointIncome || 0) * share / 100;
    return { own, joint, total: own + joint, basis, share };
  }

  return { incomeUsed };
});
