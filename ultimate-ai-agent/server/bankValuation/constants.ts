// 建物構造ごとの法定耐用年数（年）と再調達原価（万円/㎡）
// 出典: 国税庁 耐用年数表 + 不動産業界の標準的な再調達原価レンジ（2026 年水準）

export type StructureType = "wood" | "lightSteel" | "heavySteel" | "rc" | "src";

export interface StructureProfile {
  label: string;
  legalLifeYears: number;
  replacementCostPerSqm: number; // 円/㎡
}

export const STRUCTURE_PROFILES: Record<StructureType, StructureProfile> = {
  wood: {
    label: "木造",
    legalLifeYears: 22,
    replacementCostPerSqm: 150_000,
  },
  lightSteel: {
    label: "軽量鉄骨造（4mm 以下）",
    legalLifeYears: 27,
    replacementCostPerSqm: 170_000,
  },
  heavySteel: {
    label: "重量鉄骨造（4mm 超）",
    legalLifeYears: 34,
    replacementCostPerSqm: 220_000,
  },
  rc: {
    label: "RC（鉄筋コンクリート）造",
    legalLifeYears: 47,
    replacementCostPerSqm: 250_000,
  },
  src: {
    label: "SRC（鉄骨鉄筋コンクリート）造",
    legalLifeYears: 47,
    replacementCostPerSqm: 280_000,
  },
};

// 物件種別ごとの標準還元利回り（%）
// 都心/郊外で振れるため、エリア係数で微調整する
export type PropertyType =
  | "apartmentUnit" // 区分マンション
  | "wholeApartment" // 一棟アパート
  | "wholeMansion" // 一棟マンション
  | "detachedHouse" // 戸建
  | "landOnly"; // 土地のみ

export interface PropertyProfile {
  label: string;
  defaultCapRate: number; // 還元利回り（%）
  appliesIncomeApproach: boolean; // 収益還元評価を行うか
}

export const PROPERTY_PROFILES: Record<PropertyType, PropertyProfile> = {
  apartmentUnit: { label: "区分マンション", defaultCapRate: 5.0, appliesIncomeApproach: true },
  wholeApartment: { label: "一棟アパート", defaultCapRate: 7.5, appliesIncomeApproach: true },
  wholeMansion: { label: "一棟マンション", defaultCapRate: 6.5, appliesIncomeApproach: true },
  detachedHouse: { label: "戸建", defaultCapRate: 6.0, appliesIncomeApproach: false },
  landOnly: { label: "土地のみ", defaultCapRate: 0, appliesIncomeApproach: false },
};

// エリア種別ごとの係数（路線価→評価ベース価格の補正、利回りの上振れ下振れ）
export type AreaTier = "tokyo23" | "majorCity" | "suburb" | "rural";

export interface AreaProfile {
  label: string;
  landValueMultiplier: number; // 路線価ベース × 倍率
  capRateAdjustment: number; // %ポイント加算
}

export const AREA_PROFILES: Record<AreaTier, AreaProfile> = {
  tokyo23: { label: "東京 23 区", landValueMultiplier: 1.25, capRateAdjustment: -1.0 },
  majorCity: { label: "政令市・主要都市部", landValueMultiplier: 1.15, capRateAdjustment: -0.3 },
  suburb: { label: "郊外・地方都市", landValueMultiplier: 1.0, capRateAdjustment: 0.5 },
  rural: { label: "地方・郡部", landValueMultiplier: 0.9, capRateAdjustment: 1.5 },
};

// 銀行種別ごとのプロファイル
// 掛け目（LTV）は積算評価額に対する融資割合の標準値
export interface BankProfile {
  id: string;
  label: string;
  category: "megabank" | "regional" | "shinkin" | "nonbank";
  loanToValueRatio: number; // 0.0 〜 1.0
  weightCost: number; // 積算評価の重み (0〜1)
  weightIncome: number; // 収益評価の重み (0〜1)
  minLegalLifeRemaining: number; // 残存耐用年数の最低条件（年）
  note: string;
}

export const BANK_PROFILES: BankProfile[] = [
  {
    id: "megabank",
    label: "メガバンク（三菱 UFJ / 三井住友 / みずほ）",
    category: "megabank",
    loanToValueRatio: 0.7,
    weightCost: 0.8,
    weightIncome: 0.2,
    minLegalLifeRemaining: 10,
    note: "積算重視。耐用年数残 10 年以下は融資困難。",
  },
  {
    id: "regional",
    label: "地方銀行（横浜銀行 / 千葉銀行 等）",
    category: "regional",
    loanToValueRatio: 0.75,
    weightCost: 0.6,
    weightIncome: 0.4,
    minLegalLifeRemaining: 5,
    note: "積算 + 収益併用。地元エリアで条件が緩む。",
  },
  {
    id: "shinkin",
    label: "信用金庫（西武信金 / 城南信金 等）",
    category: "shinkin",
    loanToValueRatio: 0.8,
    weightCost: 0.4,
    weightIncome: 0.6,
    minLegalLifeRemaining: 0,
    note: "収益重視。古築・耐用年数オーバーでも可能性あり。",
  },
  {
    id: "nonbank",
    label: "ノンバンク（オリックス / SBI 等）",
    category: "nonbank",
    loanToValueRatio: 0.85,
    weightCost: 0.3,
    weightIncome: 0.7,
    minLegalLifeRemaining: 0,
    note: "評価緩め、金利高め。耐用年数超でも対応可。",
  },
];
