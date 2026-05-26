// 実銀行プロファイル — 実取引データから構築
//
// 出典:
//   - 「住宅ローン 金融機関別 審査スピード 特徴シート」（20 銀行・MOUSE AI 審査データ + 社内運用実績）
//   - 「金融機関情報」地銀シート（11 行・実取引時の審査金利・返済比率・保証会社）
//   - 「銀行審査否決案件一覧」30 件（パターン学習）
//
// 既存の汎用 4 カテゴリプロファイル（megabank/regional/shinkin/nonbank）を補完する
// 「実銀行データセット」。住所・物件・属性から具体的な銀行候補を提示できる。

export type BankCategory =
  | "megabank"
  | "regional"
  | "shinkin"
  | "creditUnion"
  | "labor"
  | "ja"
  | "internet"
  | "publicFlat"
  | "nonbank";

export interface RealBankProfile {
  id: string;
  name: string;
  category: BankCategory;
  // 取扱エリア（都道府県・市町村）
  serviceAreas: string[];
  // 審査スピード（営業日）
  preliminaryReviewDays: { min: number; max: number };
  fullReviewDays: { min: number; max: number };
  // 審査金利（%・実取引時の代表値）
  reviewRatePercent: { min: number; max: number };
  // 年収・返済比率（実審査時の閾値）
  // tier A: 標準審査 / tier B: 緩和審査
  minAnnualIncomeYen: number;
  repaymentBurdenRatio: { under400m: number; over400m: number };
  // 保証会社
  guaranteeCompanies: string[];
  hasProperLending: boolean; // プロパー融資の有無
  // 強み（通りやすい属性）
  strengths: string[];
  // 注意事項・備考
  notes: string[];
}

export const REAL_BANK_PROFILES: RealBankProfile[] = [
  // ===== 地銀（茨城・栃木中心） =====
  {
    id: "joyo",
    name: "常陽銀行",
    category: "regional",
    serviceAreas: ["茨城県", "栃木県（宇都宮）", "水戸市", "日立市", "ひたちなか市"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.5, max: 3.0 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["めぶき信用保証", "全国保証", "SMBCファイナンス"],
    hasProperLending: false,
    strengths: ["茨城県内物件に強い", "日立・水戸エリアの取り扱い厚い", "ひたちなかローンプラザ土日営業"],
    notes: [],
  },
  {
    id: "tsukuba",
    name: "筑波銀行",
    category: "regional",
    serviceAreas: ["茨城県（南部）", "つくば市", "土浦市"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.8, max: 3.2 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["茨城南部に強い", "常陽と並行申込◎"],
    notes: [],
  },
  {
    id: "ashikaga",
    name: "足利銀行",
    category: "regional",
    serviceAreas: ["栃木県", "宇都宮市", "小山市"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.8, max: 3.0 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["栃木県内物件◎", "宇都宮・小山エリアに強い"],
    notes: [],
  },
  {
    id: "tochigi",
    name: "栃木銀行",
    category: "regional",
    serviceAreas: ["栃木県（全域）"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.0, max: 3.0 },
    minAnnualIncomeYen: 1_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["かんそうしん", "全国保証"],
    hasProperLending: true,
    strengths: ["栃木県全域", "陽東ローンプラザは専門窓口で対応早い"],
    notes: ["中間省略は可能だが三者間の契約書全て提出", "東京の仲介には消極的傾向"],
  },
  {
    id: "chiba",
    name: "千葉銀行",
    category: "regional",
    serviceAreas: ["千葉県"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.8, max: 3.0 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["ちばぎん保証"],
    hasProperLending: false,
    strengths: ["千葉県内に強い"],
    notes: [],
  },
  {
    id: "chibakogyo",
    name: "千葉興業銀行",
    category: "regional",
    serviceAreas: ["千葉県"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 1.8, max: 3.2 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["ちば興銀カードサービス株式会社"],
    hasProperLending: false,
    strengths: ["千葉県内"],
    notes: [],
  },
  {
    id: "toho",
    name: "東邦銀行",
    category: "regional",
    serviceAreas: ["福島県"],
    preliminaryReviewDays: { min: 3, max: 5 },
    fullReviewDays: { min: 7, max: 14 },
    reviewRatePercent: { min: 2.725, max: 2.725 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["東邦信用㈱"],
    hasProperLending: false,
    strengths: ["赤字でないこと"],
    notes: ["複写式申込", "ネット申込もあるが個人信用しか見ない"],
  },

  // ===== 信用金庫 =====
  {
    id: "mitoshinkin",
    name: "水戸信用金庫",
    category: "shinkin",
    serviceAreas: ["茨城県（中心）"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 1.5, max: 3.5 },
    minAnnualIncomeYen: 2_500_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["しんきん保証"],
    hasProperLending: false,
    strengths: ["積算評価で柔軟", "再審査・特例対応◎", "築古物件にも柔軟"],
    notes: ["過去に否決事例多数（牛久・日立・ひたちなか）", "充て物審査で否決リスク"],
  },
  {
    id: "yuukishinkin",
    name: "結城信用金庫",
    category: "shinkin",
    serviceAreas: ["茨城県", "栃木県（小山支店）"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 2.47, max: 2.47 },
    minAnnualIncomeYen: 1_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: ["しんきん保証", "全国保証"],
    hasProperLending: false,
    strengths: ["年収条件緩い", "中間省略は可能（三者間の契約書全て提出）"],
    notes: [],
  },
  {
    id: "ibarakikenshinkumi",
    name: "茨城県信用組合",
    category: "creditUnion",
    serviceAreas: ["茨城県"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 2.0, max: 3.5 },
    minAnnualIncomeYen: 2_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["積算評価◎", "築古・地方物件にも柔軟"],
    notes: ["接道義務違反物件で否決事例あり"],
  },
  {
    id: "tokyobayshinkin",
    name: "東京ベイ信用金庫",
    category: "shinkin",
    serviceAreas: ["千葉県（東京ベイエリア）"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 2.0, max: 3.5 },
    minAnnualIncomeYen: 2_500_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["しんきん保証", "全国保証"],
    hasProperLending: false,
    strengths: [],
    notes: [],
  },

  // ===== 労金 =====
  {
    id: "rokin",
    name: "中央労働金庫（ろうきん）",
    category: "labor",
    serviceAreas: ["関東全域"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 10, max: 20 },
    reviewRatePercent: { min: 1.5, max: 3.0 },
    minAnnualIncomeYen: 2_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["公務員・労組員に厚遇", "ペアローン◎", "転職直後でも相談可"],
    notes: ["充て物審査で否決事例あり"],
  },

  // ===== JA =====
  {
    id: "ja-tochigi",
    name: "JA（栃木県農業協同組合）",
    category: "ja",
    serviceAreas: ["栃木県"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 2.0, max: 3.0 },
    minAnnualIncomeYen: 2_500_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: ["栃木県農業信用基金協会", "共同住宅ローン"],
    hasProperLending: false,
    strengths: ["中間省略可", "農業従事者優遇"],
    notes: [],
  },

  // ===== ネット銀行 =====
  {
    id: "rakuten",
    name: "楽天銀行",
    category: "internet",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 3, max: 7 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 0.5, max: 1.5 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["金利低い", "WEB完結", "諸費用込み可"],
    notes: ["雇用契約書必須"],
  },
  {
    id: "sumishin-sbi",
    name: "住信SBIネット銀行",
    category: "internet",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 28 },
    reviewRatePercent: { min: 0.3, max: 1.5 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["金利最安水準", "団信充実", "諸費用ローン可"],
    notes: ["雇用契約書必須（在籍証明書では否決事例あり）"],
  },
  {
    id: "auj",
    name: "auじぶん銀行",
    category: "internet",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 0.3, max: 1.5 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["金利最安クラス", "au系セット割"],
    notes: [],
  },
  {
    id: "paypaybank",
    name: "PayPay銀行",
    category: "internet",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 0.4, max: 1.5 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["金利低", "完全ネット"],
    notes: [],
  },
  {
    id: "ion",
    name: "イオン銀行",
    category: "internet",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 5, max: 10 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 0.5, max: 2.0 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["諸費用込み対応", "団信◎"],
    notes: [],
  },

  // ===== メガバンク =====
  {
    id: "mufg",
    name: "三菱UFJ銀行",
    category: "megabank",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 7, max: 14 },
    fullReviewDays: { min: 14, max: 28 },
    reviewRatePercent: { min: 0.4, max: 2.0 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["ブランド安心感", "大口可"],
    notes: [],
  },
  {
    id: "smbc",
    name: "三井住友銀行",
    category: "megabank",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 7, max: 14 },
    fullReviewDays: { min: 14, max: 28 },
    reviewRatePercent: { min: 0.4, max: 2.0 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["ブランド安心感"],
    notes: [],
  },
  {
    id: "mizuho",
    name: "みずほ銀行",
    category: "megabank",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 7, max: 14 },
    fullReviewDays: { min: 14, max: 28 },
    reviewRatePercent: { min: 0.4, max: 2.0 },
    minAnnualIncomeYen: 4_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["ブランド安心感"],
    notes: [],
  },

  // ===== 公的系 =====
  {
    id: "aruhi-flat35",
    name: "フラット35 / ARUHI",
    category: "publicFlat",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 5, max: 7 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 1.85, max: 2.5 },
    minAnnualIncomeYen: 1_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["全期間固定", "属性柔軟", "自営・転職直後OK", "2,500万まで推奨"],
    notes: ["団信告知事項あれば日本モーゲージへ"],
  },
  {
    id: "flat50",
    name: "フラット50",
    category: "publicFlat",
    serviceAreas: ["全国（長期優良住宅）"],
    preliminaryReviewDays: { min: 5, max: 7 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 2.25, max: 2.8 },
    minAnnualIncomeYen: 1_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.35 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["最長 50 年返済", "月返済圧縮可"],
    notes: ["長期優良住宅対象"],
  },

  // ===== ノンバンク =====
  {
    id: "orix",
    name: "オリックス銀行",
    category: "nonbank",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 7, max: 14 },
    fullReviewDays: { min: 14, max: 28 },
    reviewRatePercent: { min: 1.5, max: 3.5 },
    minAnnualIncomeYen: 5_000_000,
    repaymentBurdenRatio: { under400m: 0.3, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["投資用住宅ローンに強い", "セカンドハウス可"],
    notes: [],
  },
  {
    id: "sbj",
    name: "SBJ銀行",
    category: "nonbank",
    serviceAreas: ["全国"],
    preliminaryReviewDays: { min: 7, max: 14 },
    fullReviewDays: { min: 14, max: 21 },
    reviewRatePercent: { min: 1.0, max: 3.0 },
    minAnnualIncomeYen: 3_000_000,
    repaymentBurdenRatio: { under400m: 0.35, over400m: 0.4 },
    guaranteeCompanies: [],
    hasProperLending: false,
    strengths: ["外国籍・自営柔軟", "諸費用込み可"],
    notes: [],
  },
];

/**
 * エリアに対応する銀行を抽出
 */
export function filterBanksByArea(prefecture: string | null): RealBankProfile[] {
  if (!prefecture) return REAL_BANK_PROFILES;
  return REAL_BANK_PROFILES.filter((b) =>
    b.serviceAreas.some((a) => a.includes(prefecture) || a === "全国" || a === "関東全域")
  );
}

/**
 * 属性条件に合致する銀行をスコアリング
 */
export interface BankFitScore {
  bank: RealBankProfile;
  score: number; // 0〜100
  matchReasons: string[];
  warnings: string[];
}

export function scoreBankFit(
  bank: RealBankProfile,
  attrs: {
    annualIncomeYen: number;
    propertyArea: string | null;
    employmentType: "salaryman" | "executive" | "soleProprietor" | "companyOwner" | "other";
    yearsOfEmployment: number;
    hasInsuranceConcern: boolean; // 団信告知事項
    hasCreditConcern: boolean; // 個信記録
    isSingle: boolean;
    propertyHasRoadAccessIssue: boolean;
    propertyAge: number; // 築年数
  }
): BankFitScore {
  let score = 50;
  const matchReasons: string[] = [];
  const warnings: string[] = [];

  // エリアマッチ
  if (attrs.propertyArea) {
    const areaMatch = bank.serviceAreas.some(
      (a) => a.includes(attrs.propertyArea!) || a === "全国" || a === "関東全域"
    );
    if (areaMatch) {
      score += 15;
      matchReasons.push("エリア対応");
    } else {
      score -= 30;
      warnings.push("エリア対象外の可能性");
    }
  }

  // 年収
  if (attrs.annualIncomeYen >= bank.minAnnualIncomeYen) {
    score += 10;
    matchReasons.push(`年収 ${(attrs.annualIncomeYen / 10000).toFixed(0)} 万円 ≥ 最低 ${(bank.minAnnualIncomeYen / 10000).toFixed(0)} 万円`);
  } else {
    score -= 25;
    warnings.push(`最低年収 ${(bank.minAnnualIncomeYen / 10000).toFixed(0)} 万円を下回る`);
  }

  // 属性別
  if (attrs.employmentType === "soleProprietor" || attrs.employmentType === "companyOwner") {
    if (bank.category === "shinkin" || bank.category === "creditUnion" || bank.category === "publicFlat" || bank.id === "sbj") {
      score += 10;
      matchReasons.push("自営業に柔軟");
    } else if (bank.category === "megabank" || bank.category === "internet") {
      score -= 15;
      warnings.push("自営業には厳しめ");
    }
  }

  if (attrs.hasInsuranceConcern) {
    if (bank.category === "publicFlat") {
      score += 15;
      matchReasons.push("団信告知あっても機構団信で対応可");
    } else if (bank.category === "internet") {
      score -= 30;
      warnings.push("団信告知事項で否決リスク大（過去 SBI 銀行で実例）");
    }
  }

  if (attrs.hasCreditConcern) {
    if (bank.category === "nonbank" || bank.category === "publicFlat") {
      score += 5;
      matchReasons.push("個信記録があっても相対的に柔軟");
    } else {
      score -= 20;
      warnings.push("個信記録は厳しめに見られる");
    }
  }

  if (attrs.isSingle) {
    if (bank.category === "shinkin" || bank.category === "creditUnion") {
      score -= 10;
      warnings.push("単身者は信金で否決事例あり");
    }
  }

  if (attrs.propertyHasRoadAccessIssue) {
    if (bank.id === "ibarakikenshinkumi") {
      score -= 25;
      warnings.push("過去に接道義務違反で否決事例あり");
    } else if (bank.strengths.some((s) => s.includes("積算"))) {
      score += 5;
      matchReasons.push("積算評価柔軟・接道問題も場合により可");
    }
  }

  if (attrs.propertyAge > 30) {
    if (bank.strengths.some((s) => s.includes("築古"))) {
      score += 10;
      matchReasons.push("築古物件に柔軟");
    } else if (bank.category === "megabank") {
      score -= 15;
      warnings.push("築古はメガバンクでは厳しい");
    }
  }

  if (attrs.yearsOfEmployment < 1) {
    if (bank.id === "rokin" || bank.category === "publicFlat") {
      score += 10;
      matchReasons.push("転職直後でも相談可");
    } else {
      score -= 15;
      warnings.push("勤続 1 年未満は厳しめ");
    }
  }

  return {
    bank,
    score: Math.max(0, Math.min(100, score)),
    matchReasons,
    warnings,
  };
}
