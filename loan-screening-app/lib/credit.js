// 信用情報（自己申告）: CIC・JICC・KSC（全銀協）の3機関。異動・官報は足切り、申込件数は機関ごとの最大値
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BUREAUS = [
    { key: "cic", label: "CIC", window: "6か月", note: "クレジットカード・割賦（スマホ本体を含む）" },
    { key: "jicc", label: "JICC", window: "6か月", note: "消費者金融・カードローン" },
    { key: "ksc", label: "KSC（全銀協）", window: "1年", note: "銀行のローン・官報情報" },
  ];
  const LATE = {
    none: { label: "なし", rank: 0, score: 150 },
    past: { label: "1年以上前にあり（解消済み）", rank: 1, score: 110 },
    recent: { label: "直近1年以内にあり（60日以内）", rank: 2, score: 40 },
    jiko: { label: "異動（61日以上の延滞・代位弁済・債務整理）", rank: 3, score: 0 },
  };
  const LATE_KEYS = Object.keys(LATE);

  function creditSummary(x) {
    const c = x.credit || {};
    let worst = "none", applyMax = 0, kanpo = false;
    const items = BUREAUS.map((b) => {
      const v = c[b.key] || {};
      const late = LATE[v.late] ? v.late : "none";
      const apply = Math.max(0, +v.apply || 0);
      if (LATE[late].rank > LATE[worst].rank) worst = late;
      applyMax = Math.max(applyMax, apply);
      if (b.key === "ksc" && v.kanpo) kanpo = true;
      return { key: b.key, label: b.label, window: b.window, late, lateLabel: LATE[late].label, apply, kanpo: b.key === "ksc" ? !!v.kanpo : undefined };
    });
    return { items, worstLate: worst, applyMax, kanpo, knockout: worst === "jiko" || kanpo };
  }

  return { BUREAUS, LATE, LATE_KEYS, creditSummary };
});
