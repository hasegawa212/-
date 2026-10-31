// 社外秘：住宅ローンの保証会社（保証機関）と、各金融機関が使う保証会社
// 金融機関の審査とは別に、保証会社が審査する。銀行を変えても保証会社が同じなら、同じ判断になりやすい
// src: 社内記録（Slack #05・#16・#21・#上層部 の審査報告）／公開情報（金融機関・JAの商品概要、報道）／要確認
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const GUARANTORS = {
    zenkoku: { name: "全国保証", kind: "独立系（最大手）", note: "地銀・信金・信組・JAなど提携先が広い。ここで否決されると、全国保証を使う他の金融機関でも同じ判断になりやすい" },
    shinkin: { name: "しんきん保証基金", kind: "信用金庫の系統", note: "信用金庫の主な保証機関。業者（売主・仲介）も審査し、業者を理由に否決された例がある（社内記録 2026/8）" },
    rokin: { name: "日本労働者信用基金協会", kind: "労働金庫の系統", note: "労働金庫の保証機関。会員（労働組合・生協など）の構成員は保証料が下がる場合がある" },
    noukyou: { name: "茨城県農業信用基金協会", kind: "JAの系統（公的）", note: "茨城のJAの保証機関の一つ" },
    khl: { name: "協同住宅ローン", kind: "JAの系統", note: "JAの保証機関の一つ。JAは2社のどちらかで保証審査をする" },
    mebuki: { name: "めぶき信用保証", kind: "銀行系", note: "常陽銀行の保証会社" },
    touhou: { name: "東邦信用保証", kind: "銀行系", note: "東邦銀行の保証会社（全国保証のルートもある）" },
    saison: { name: "クレディセゾン", kind: "独立系", note: "栃木銀行と住宅ローンの保証で提携（2024年2月から）。ほかの保証ルートは要確認" },
    gunma: { name: "群馬保証", kind: "銀行系", note: "群馬銀行の保証会社" },
    sbi: { name: "SBI信用保証・MG保証", kind: "独立系", note: "SBIアルヒなどの保証会社" },
  };
  // 金融機関 → 保証会社（src 付き）
  const LENDER_GUARANTORS = {
    中央労働金庫: [{ id: "rokin", src: "公開情報" }],
    水戸信用金庫: [{ id: "shinkin", src: "社内記録" }, { id: "zenkoku", src: "要確認" }],
    結城信用金庫: [{ id: "shinkin", src: "公開情報" }, { id: "zenkoku", src: "要確認" }],
    鹿沼信用金庫: [{ id: "shinkin", src: "公開情報" }, { id: "zenkoku", src: "要確認" }],
    足利小山信用金庫: [{ id: "shinkin", src: "社内記録" }, { id: "zenkoku", src: "要確認" }],
    烏山信用金庫: [{ id: "shinkin", src: "公開情報" }, { id: "zenkoku", src: "要確認" }],
    筑波銀行: [{ id: "zenkoku", src: "社内記録" }],
    茨城県信用組合: [{ id: "zenkoku", src: "社内記録" }],
    東邦銀行: [{ id: "touhou", src: "社内記録" }, { id: "zenkoku", src: "社内記録" }],
    JA: [{ id: "noukyou", src: "公開情報" }, { id: "khl", src: "公開情報" }],
    常陽銀行: [{ id: "mebuki", src: "公開情報" }],
    栃木銀行: [{ id: "saison", src: "公開情報" }],
    群馬銀行: [{ id: "gunma", src: "社内記録" }],
    SBIアルヒ: [{ id: "sbi", src: "社内記録" }],
  };
  return { GUARANTORS, LENDER_GUARANTORS };
});
