// フラット35の金利（2026年10月時点の公開情報にもとづく目安。最新は住宅金融支援機構と取扱金融機関で確認）
// 融資率（借入÷物件価格）9割超は上乗せ、団信に入らなければ −0.2%、子育てプラス・S のポイントで当初の金利を引下げ
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FLAT_S = { none: { label: "使わない", pt: 0 }, b: { label: "フラット35S 金利Bプラン", pt: 1 }, a: { label: "フラット35S 金利Aプラン", pt: 2 }, zeh: { label: "フラット35S（ZEH）", pt: 3 } };
  const DANSHIN_CUT = 0.2;   // 新機構団信に入らない場合に下がる金利
  const PT_CUT = 0.25;       // 1ポイントあたりの引下げ
  const r2 = (v) => Math.round(v * 1000) / 1000;

  // 子育てプラス: 18歳未満の子1人につき1pt。子がいなくても夫婦のどちらかが40歳未満なら1pt
  function flatPoints(x) {
    const kids = Math.max(0, +x.kids || 0);
    const care = kids > 0 ? kids : x.youngCouple ? 1 : 0;
    return care + (FLAT_S[x.flatS] || FLAT_S.none).pt;
  }

  // 1ptにつき当初5年0.25%（最大1.0%）。5pt以上は 6〜10年目に (pt−4)×0.25%
  function flatReduction(pt) {
    if (!(pt > 0)) return [];
    const out = [{ from: 1, to: 5, cut: r2(Math.min(pt, 4) * PT_CUT) }];
    if (pt > 4) out.push({ from: 6, to: 10, cut: r2((pt - 4) * PT_CUT) });
    return out;
  }

  function flatRate(x, P, ltv) {
    const highLtv = ltv > P.highLtv.over;
    const baseRate = r2((+x.flatRate || 0) + (highLtv ? P.highLtv.add : 0));
    const noDanshin = x.danshin === "no";
    const rate = r2(baseRate - (noDanshin ? DANSHIN_CUT : 0));
    const points = flatPoints(x);
    const reduction = flatReduction(points);
    const firstRate = r2(rate - (reduction[0] ? reduction[0].cut : 0));
    return { ltv, highLtv, baseRate, rate, noDanshin, points, reduction, firstRate, s: (FLAT_S[x.flatS] || FLAT_S.none).label };
  }

  return { FLAT_S, flatPoints, flatReduction, flatRate };
});
