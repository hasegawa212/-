// ジャパンマネジメント版（合同会社JAPANマネジメント）：お金の相談の視点で「持つ意味」と資金計画を丁寧に説明する版
(function (root, factory) {
  const m = factory(typeof module === "object" && module.exports ? require("../lib/engine") : root.LL);
  if (typeof module === "object" && module.exports) module.exports = m;
  else ((root.LL = root.LL || {}).EDITIONS = root.LL.EDITIONS || {})[m.id] = m;
})(typeof self !== "undefined" ? self : this, function (LL) {
  const sample = JSON.parse(JSON.stringify(LL.SAMPLE));
  sample.customer.existingMonthly = 0;
  sample.customer.monthlyWish = 0;
  sample.screen = { rate: 0.03 };
  return {
    id: "japan-mgmt",
    label: "ジャパンマネジメント版",
    // 会社情報は公式サイト japan-mgmt.co.jp の「会社情報」による（2026年10月確認。代表：佐藤 黎亮）
    brand: {
      name: "合同会社JAPANマネジメント",
      nameEn: "JAPAN MANAGEMENT",
      site: "japan-mgmt.co.jp",
      tel: "03-6914-4887",
      address: "〒186-0011 東京都国立市谷保四丁目20-1 JUNメビウス国立1F",
      hours: "平日 11:00〜19:00／土日祝 10:00〜20:00",
      closed: "毎週水曜日・隔週火曜日",
      license: "〔要確認〕（物件の紹介・仲介を行う場合は宅地建物取引業の免許番号、または提携先の表示）",
      staff: "担当：＿＿＿＿＿＿",
    },
    // 写真はグループ会社の施工写真のため「イメージ写真」と表示する
    photoCaption: "イメージ写真",
    photoNote: "写真はすべてイメージ写真です。試算に用いた物件・ご提案物件の写真ではありません。",
    sample,
    focus: 0,
    comfortRatio: 0.25,
    lead: { p02: "誰かに合わせなくていい。家の使い方を、すべて自分で決められる。" },
    scenes: [
      ["LuGuitar", "趣味", "好きなものを、広げたままにできる部屋。"],
      ["LuLaptop", "仕事", "生活と切り離して、集中できる書斎。"],
      ["LuSun", "休日", "車の手入れ、庭でコーヒー、何もしない贅沢。"],
    ],
    personas: [
      ["LuLaptop", "在宅ワーク派", "仕事と生活を分けたい", ["書斎にできる独立した個室", "通信回線（光回線の引き込み）", "日当たり・静かさ（前面道路の交通量）"]],
      ["LuCar", "車・バイク派", "道具も遊びも、自由に動きたい", ["敷地内の駐車スペース（台数・形）", "前面道路の幅と出し入れのしやすさ", "外の水栓・収納・作業スペース"]],
      ["LuPawPrint", "ペットと暮らす派", "家族のように一緒に過ごしたい", ["庭・外の空間と周囲の環境", "床・壁の素材（傷・におい対策）", "動物病院・散歩道までの距離"]],
    ],
    checkLoan: ["ローン審査", "借入可能額と返済負担の確認", "金融機関の事前審査"],
    steps: [
      ["LuEye", "物件見学", "昼と夜、平日と休日に。日当たり・音・周辺の雰囲気を自分の目で。"],
      ["LuCalculator", "資金計画のご相談", "源泉徴収票をもとに、返済・控除・予備資金を詳しく計算。"],
      ["LuMapPin", "現地・書類の確認", "ハザード・接道・再建築・性能証明を一緒に確認。"],
      ["LuCalendarCheck", "次回のご提案", "希望に合う物件を比べてご提案。見送りも大切な選択肢です。"],
    ],
    support: "お金の不安をなくすことは、人生の自由を取り戻すこと。住宅と家計・老後資金をまとめてご相談いただけます。",
    extraNotes: {},
  };
});
