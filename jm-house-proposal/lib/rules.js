// 住宅ローン控除の制度データ（入居年ごとに更新できる形）
// 税制改正があったら、このファイルの RULES / COMMON を書き換えるだけでよい（計算ロジックは engine.js）。
//
// 基準日：2026年10月時点（令和8年度税制改正後）
// 出典：財務省「令和8年度税制改正の大綱」(2025/12/26閣議決定)、国土交通省「住宅ローン減税」(2026年6月更新)、
//       国税庁 タックスアンサー No.1211-1（新築等）・No.1211-2（買取再販）・No.1211-3（既存住宅）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else (root.JM = root.JM || {}).RULES = m;
})(typeof self !== "undefined" ? self : this, function () {
  const BASIS_DATE = "2026年10月";

  // kind: new=新築 / resale=買取再販 / used=中古（既存）
  // perf: certified=認定長期優良・低炭素 / zeh=ZEH水準省エネ / energy=省エネ基準適合 / other=その他
  // limit: [一般世帯, 子育て・若者夫婦世帯]  years: 控除期間
  // cond: 追加条件。confirmBy=この日までに建築確認 / builtBy=この日までに建築（登記上） のどちらかを満たすこと
  // check: true = 一次資料で確認しきれていない（画面・資料に〔要確認〕を出す）
  const RULES = [
    // ── 新築・買取再販 ──
    { from: 2026, to: 2030, kinds: ["new", "resale"], perf: "certified", limit: [45_000_000, 50_000_000], years: 13 },
    { from: 2026, to: 2030, kinds: ["new", "resale"], perf: "zeh", limit: [35_000_000, 45_000_000], years: 13 },
    { from: 2026, to: 2027, kinds: ["new", "resale"], perf: "energy", limit: [20_000_000, 30_000_000], years: 13 },
    { from: 2028, to: 2030, kinds: ["new"], perf: "energy", limit: [20_000_000, 20_000_000], years: 10,
      cond: { confirmBy: "2027-12-31", builtBy: "2028-06-30" },
      note: "2028年以降の入居は、2027年末までに建築確認（または2028年6月末までに建築）したものに限り2,000万円・10年" },
    { from: 2028, to: 2030, kinds: ["resale"], perf: "energy", limit: [20_000_000, 30_000_000], years: 13, check: true },
    { from: 2026, to: 2030, kinds: ["new"], perf: "other", limit: [20_000_000, 20_000_000], years: 10,
      cond: { confirmBy: "2023-12-31", builtBy: "2024-06-30" },
      note: "省エネ基準を満たさない新築は、2023年末までに建築確認（または2024年6月末までに建築）したものに限り2,000万円・10年" },
    { from: 2026, to: 2030, kinds: ["resale"], perf: "other", limit: [20_000_000, 20_000_000], years: 10 },
    // ── 中古（既存住宅） ──
    { from: 2026, to: 2030, kinds: ["used"], perf: "certified", limit: [35_000_000, 45_000_000], years: 13 },
    { from: 2026, to: 2030, kinds: ["used"], perf: "zeh", limit: [35_000_000, 45_000_000], years: 13 },
    { from: 2026, to: 2030, kinds: ["used"], perf: "energy", limit: [20_000_000, 30_000_000], years: 13 },
    { from: 2026, to: 2030, kinds: ["used"], perf: "other", limit: [20_000_000, 20_000_000], years: 10 },
  ];

  // 全区分に共通の要件
  const COMMON = {
    rate: 0.007,                      // 控除率
    minFloor: 40,                     // 床面積（㎡）
    floorFullIncome: 50,              // 40〜50㎡は合計所得 incomeCapSmall 以下の年のみ
    incomeCapSmall: 10_000_000,
    incomeCap: 20_000_000,            // 合計所得金額の上限
    minLoanYears: 10,                 // 返済期間
    moveInWithinMonths: 6,            // 取得から入居までの期間
    seismicBuiltFrom: "1982-01-01",   // 中古：この日以降の建築（登記上）なら耐震の証明不要
    redZoneNewFrom: 2028,             // この入居年以降、災害レッドゾーン内の新築（建替え除く）は対象外
    specialMinFloor: 50,              // 子育て・若者夫婦世帯の上乗せは50㎡以上
    specialAge: 40,                   // 若者夫婦：夫婦のいずれかが40歳未満
    specialChildAge: 19,              // 子育て：19歳未満の扶養親族
    residentCapRate: 0.05,            // 住民税から控除できる上限：所得税の課税総所得金額等×5%
    residentCapMax: 97_500,           //                              最高97,500円
    residentCapCheck: true,           // 2026年以降も同じ上限が続くかは〔要確認〕
  };

  const KIND = { new: "新築", resale: "買取再販", used: "中古（既存）" };
  const PERF = { certified: "認定長期優良・低炭素住宅", zeh: "ZEH水準省エネ住宅", energy: "省エネ基準適合住宅", other: "その他の住宅" };
  const DOCS = {
    common: ["住宅ローンの年末残高等証明書（金融機関が毎年発行）", "登記事項証明書（土地・建物）", "売買契約書・工事請負契約書の写し"],
    certified: "長期優良住宅・低炭素建築物の認定通知書の写し",
    zeh: "住宅省エネルギー性能証明書 または 建設住宅性能評価書の写し（ZEH水準）",
    energy: "住宅省エネルギー性能証明書 または 建設住宅性能評価書の写し（省エネ基準）",
    seismic: "耐震基準適合証明書・建設住宅性能評価書（耐震等級）・既存住宅売買瑕疵保険の付保証明書のいずれか（1981年以前の建築）",
    confirm: "建築確認済証・検査済証の写し、または登記事項証明書（経過措置の確認用）",
  };
  const SOURCES = [
    "財務省「令和8年度税制改正の大綱」",
    "国土交通省「住宅ローン減税」",
    "国税庁 タックスアンサー No.1211-1／1211-2／1211-3",
  ];
  return { BASIS_DATE, RULES, COMMON, KIND, PERF, DOCS, SOURCES };
});
