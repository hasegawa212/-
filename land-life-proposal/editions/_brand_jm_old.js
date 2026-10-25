// 会社情報（スライド・アプリ・提案書で共通）。ここだけ直せば全体に反映される。
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else (root.JM = root.JM || {}).BRAND = m;
})(typeof self !== "undefined" ? self : this, function () {
  return {
    name: "株式会社ジャパンマネジメント",
    nameEn: "JAPAN MANAGEMENT",
    site: "japan-mgmt.co.jp",
    tel: "〔要確認〕",            // 公式の電話番号に差し替え
    hours: "〔要確認〕",
    license: "〔要確認〕",        // 物件の紹介・仲介を行う場合は宅地建物取引業の免許番号（または提携先の表示）
    staff: "担当：＿＿＿＿＿＿",
  };
});
