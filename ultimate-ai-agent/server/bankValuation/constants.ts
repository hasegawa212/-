// 建物構造ごとの法定耐用年数（年）、再調達原価（円/㎡）、残価率
// 出典: 国税庁 耐用年数表（住宅用）+ 不動産業界の標準的な再調達原価レンジ（2026 年水準）
//
// 残価率（residualRatio）:
//   経過年数が法定耐用年数を超えても 0 にはならず、構造躯体の残存価値として
//   再調達原価の一定割合を残す（積算評価の標準的手法）。

export type StructureType =
  | "wood"
  | "steelLight" // 軽量鉄骨造（骨格材肉厚 3mm 以下）
  | "lightSteel" // 軽量鉄骨造（骨格材肉厚 3〜4mm）旧表記の互換キー
  | "heavySteel" // 重量鉄骨造（骨格材肉厚 4mm 超）
  | "rc"
  | "src";

export interface StructureProfile {
  label: string;
  legalLifeYears: number;
  replacementCostPerSqm: number; // 円/㎡（全国平均ベース、エリア倍率で補正）
  residualRatio: number; // 法定耐用年数経過後の残価率（0〜1）
}

export const STRUCTURE_PROFILES: Record<StructureType, StructureProfile> = {
  wood: {
    label: "木造（住宅用）",
    legalLifeYears: 22,
    replacementCostPerSqm: 180_000,
    residualRatio: 0.1,
  },
  steelLight: {
    label: "軽量鉄骨造 3mm 以下（プレハブ住宅 等）",
    legalLifeYears: 19,
    replacementCostPerSqm: 200_000,
    residualRatio: 0.1,
  },
  lightSteel: {
    label: "軽量鉄骨造 3〜4mm（住宅用）",
    legalLifeYears: 27,
    replacementCostPerSqm: 220_000,
    residualRatio: 0.1,
  },
  heavySteel: {
    label: "重量鉄骨造 4mm 超（住宅用）",
    legalLifeYears: 34,
    replacementCostPerSqm: 270_000,
    residualRatio: 0.15,
  },
  rc: {
    label: "RC（鉄筋コンクリート）造",
    legalLifeYears: 47,
    replacementCostPerSqm: 300_000,
    residualRatio: 0.15,
  },
  src: {
    label: "SRC（鉄骨鉄筋コンクリート）造",
    legalLifeYears: 47,
    replacementCostPerSqm: 350_000,
    residualRatio: 0.2,
  },
};

// 物件種別ごとの標準還元利回り（%）
export type PropertyType =
  | "apartmentUnit"
  | "wholeApartment"
  | "wholeMansion"
  | "detachedHouse"
  | "landOnly";

export interface PropertyProfile {
  label: string;
  defaultCapRate: number;
  appliesIncomeApproach: boolean;
}

export const PROPERTY_PROFILES: Record<PropertyType, PropertyProfile> = {
  apartmentUnit: { label: "区分マンション", defaultCapRate: 5.0, appliesIncomeApproach: true },
  wholeApartment: { label: "一棟アパート", defaultCapRate: 7.5, appliesIncomeApproach: true },
  wholeMansion: { label: "一棟マンション", defaultCapRate: 6.5, appliesIncomeApproach: true },
  detachedHouse: { label: "戸建", defaultCapRate: 6.0, appliesIncomeApproach: false },
  landOnly: { label: "土地のみ", defaultCapRate: 0, appliesIncomeApproach: false },
};

// エリアごとの係数
//   landValueMultiplier: 路線価 → 実勢価格 補正（既存）
//   capRateAdjustment: 還元利回りの上振れ下振れ %ポイント（既存）
//   buildCostMultiplier: 再調達原価の地域差（東京は高い・地方は安い）★ PR #13 で追加
export type AreaTier = "tokyo23" | "majorCity" | "suburb" | "rural";

export interface AreaProfile {
  label: string;
  landValueMultiplier: number;
  capRateAdjustment: number;
  buildCostMultiplier: number;
}

export const AREA_PROFILES: Record<AreaTier, AreaProfile> = {
  tokyo23: {
    label: "東京 23 区",
    landValueMultiplier: 1.25,
    capRateAdjustment: -1.0,
    buildCostMultiplier: 1.15,
  },
  majorCity: {
    label: "政令市・主要都市部",
    landValueMultiplier: 1.15,
    capRateAdjustment: -0.3,
    buildCostMultiplier: 1.0,
  },
  suburb: {
    label: "郊外・地方都市",
    landValueMultiplier: 1.0,
    capRateAdjustment: 0.5,
    buildCostMultiplier: 0.95,
  },
  rural: {
    label: "地方・郡部",
    landValueMultiplier: 0.9,
    capRateAdjustment: 1.5,
    buildCostMultiplier: 0.9,
  },
};

// 銀行種別ごとのプロファイル
export interface BankProfile {
  id: string;
  label: string;
  category: "megabank" | "regional" | "shinkin" | "nonbank";
  loanToValueRatio: number;
  weightCost: number;
  weightIncome: number;
  minLegalLifeRemaining: number;
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
