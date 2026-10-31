// 社外秘：当社の住宅ローン審査の実績（金融機関ごとの集計だけ。お客様の情報は入れない）
// 出典: Slack #21_住宅ローン審査報告（否決一覧 2024/7〜2026/4）、#37・#05・#16、営業報告ログ（2026/3〜9）
// 数え方: 申込みごとに 通過（事前承認・本承認・金消・決済）／否決 を1回ずつ。事前と本審査は別に数える
// type は審査エンジンの型（lib/policy.js の PRESETS）。areas は営業地域の目安（各金融機関で確認する）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const DATA_AS_OF = "2026-10-31";
  const LENDERS = [
    { name: "中央労働金庫", type: "rokin", areas: ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川", "山梨"], pass: 13, reject: 4, broker: "増子建設", note: "当社の申込みでいちばん実績が多い。契約・派遣社員でも勤続を見て通っている。会員（労働組合・生協など）の勤労者が対象か確認" },
    { name: "水戸信用金庫", type: "shinkin", areas: ["茨城"], pass: 11, reject: 5, broker: "増子建設", alt: "東洋建設ホーム（グループ会社。関係を開示）", note: "茨城の県央・県北・県南。勝田・牛久・大みか・多賀・阿見の各支店に実績" },
    { name: "栃木銀行", type: "regional", areas: ["栃木", "茨城"], pass: 7, reject: 2, broker: "増子建設", note: "宇都宮・小山のローンプラザに実績。他の借入のおまとめが条件になった例あり" },
    { name: "東邦銀行", type: "regional", areas: ["福島", "茨城"], pass: 6, reject: 1, broker: "増子建設", note: "水戸支店・いわき営業部に実績" },
    { name: "筑波銀行", type: "regional", areas: ["茨城"], pass: 3, reject: 1, broker: "増子建設", note: "完済80歳まで" },
    { name: "結城信用金庫", type: "shinkin", areas: ["茨城", "栃木"], pass: 3, reject: 1, broker: "増子建設", alt: "東洋建設ホーム（グループ会社。関係を開示）", note: "茨城の県西（結城・常総・下妻・笠間）。本申込みから本承認が速い" },
    { name: "SBIアルヒ", type: "net", areas: ["全国"], pass: 3, reject: 2, broker: "増子建設", note: "団信の告知事項で否決の例あり" },
    { name: "群馬銀行", type: "regional", areas: ["群馬", "栃木", "埼玉"], pass: 2, reject: 1, broker: "増子建設", note: "独自の保証会社を持つ" },
    { name: "鹿沼信用金庫", type: "shinkin", areas: ["栃木"], pass: 2, reject: 0, broker: "増子建設", note: "宇都宮（戸祭）。50年ローンで返済比率をクリアした例" },
    { name: "福島銀行", type: "regional", areas: ["福島", "茨城"], pass: 2, reject: 0, broker: "増子建設", note: "" },
    { name: "足利小山信用金庫", type: "shinkin", areas: ["栃木"], pass: 1, reject: 1, broker: "増子建設", note: "小山・下野・足利" },
    { name: "大光銀行", type: "regional", areas: ["新潟", "埼玉"], pass: 1, reject: 0, broker: "", note: "" },
    { name: "JA", type: "regional", areas: ["茨城", "栃木", "愛知"], pass: 1, reject: 6, broker: "増子建設", note: "単身を理由に否決、保証会社2社とも否決の例。転居が多い人は否決の例" },
    { name: "茨城県信用組合", type: "regional", areas: ["茨城"], pass: 0, reject: 5, broker: "", note: "当社の申込みでは通過なし（接道・充て物など物件での否決も）" },
    { name: "常陽銀行", type: "regional", areas: ["茨城"], pass: 0, reject: 2, broker: "", note: "当社の申込みでは通過なし" },
    { name: "住信SBIネット銀行", type: "net", areas: ["全国"], pass: 0, reject: 2, broker: "", note: "雇用契約書なしで否決の例" },
    { name: "烏山信用金庫", type: "shinkin", areas: ["栃木"], pass: 0, reject: 2, broker: "", note: "" },
  ];
  return { DATA_AS_OF, LENDERS };
});
