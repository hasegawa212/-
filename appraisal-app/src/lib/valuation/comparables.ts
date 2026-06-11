import { walkFactor, appraiseRealEstate } from "./realEstate";
import { formatYen } from "../format";
import type { AppraisalResult, PropertyType, RealEstateInput } from "./types";

// 取引事例比較法（簡易AVM）
//
// 近傍の成約事例（同一エリア・同一種別）の㎡単価を、対象物件の築年・駅距離・規模に
// 補正して当てはめ、原価法とブレンドして査定額の精度を上げる。
//
// SAMPLE_COMPS は国交省「不動産情報ライブラリ（取引価格情報）」由来を想定した
// 概算サンプル。tools/fetch_transactions.py を実行すると実成約データで置き換わる。

export interface TransactionComp {
  city: string; // CITY_LAND_PRICE のキー（エリア）
  propertyType: PropertyType;
  /** 成約総額（円） */
  totalPrice: number;
  /** 土地面積（㎡）。マンションは 0 */
  landArea: number;
  /** 建物（専有）面積（㎡）。土地のみは 0 */
  buildingArea: number;
  /** 築年（年） */
  buildAge: number;
  /** 最寄駅徒歩（分） */
  walkMinutes: number;
  /** 成約年 */
  tradeYear: number;
}

/** 概算サンプルの成約事例（実データは fetch_transactions.py で置換） */
export const SAMPLE_COMPS: TransactionComp[] = [
  // 水戸市（戸建）
  { city: "水戸市", propertyType: "house", totalPrice: 30500000, landArea: 170, buildingArea: 105, buildAge: 12, walkMinutes: 12, tradeYear: 2024 },
  { city: "水戸市", propertyType: "house", totalPrice: 27800000, landArea: 155, buildingArea: 98, buildAge: 18, walkMinutes: 15, tradeYear: 2023 },
  { city: "水戸市", propertyType: "house", totalPrice: 34000000, landArea: 200, buildingArea: 115, buildAge: 8, walkMinutes: 10, tradeYear: 2024 },
  // つくば市（戸建）
  { city: "つくば市", propertyType: "house", totalPrice: 38000000, landArea: 165, buildingArea: 108, buildAge: 10, walkMinutes: 12, tradeYear: 2024 },
  { city: "つくば市", propertyType: "house", totalPrice: 33500000, landArea: 150, buildingArea: 100, buildAge: 15, walkMinutes: 18, tradeYear: 2023 },
  // ひたちなか市（戸建）
  { city: "ひたちなか市", propertyType: "house", totalPrice: 24500000, landArea: 180, buildingArea: 100, buildAge: 16, walkMinutes: 20, tradeYear: 2024 },
  { city: "ひたちなか市", propertyType: "house", totalPrice: 27000000, landArea: 190, buildingArea: 105, buildAge: 12, walkMinutes: 15, tradeYear: 2023 },
  // 宇都宮市（戸建）
  { city: "宇都宮市", propertyType: "house", totalPrice: 26500000, landArea: 185, buildingArea: 102, buildAge: 14, walkMinutes: 14, tradeYear: 2024 },
  { city: "宇都宮市", propertyType: "house", totalPrice: 29000000, landArea: 200, buildingArea: 108, buildAge: 9, walkMinutes: 12, tradeYear: 2023 },
  // 横浜市・川崎市（戸建）
  { city: "横浜市・川崎市", propertyType: "house", totalPrice: 46000000, landArea: 135, buildingArea: 98, buildAge: 13, walkMinutes: 10, tradeYear: 2024 },
  { city: "横浜市・川崎市", propertyType: "house", totalPrice: 42000000, landArea: 120, buildingArea: 92, buildAge: 18, walkMinutes: 12, tradeYear: 2023 },
  // 東京23区（その他）（マンション）
  { city: "東京23区（その他）", propertyType: "apartment", totalPrice: 62000000, landArea: 0, buildingArea: 68, buildAge: 14, walkMinutes: 7, tradeYear: 2024 },
  { city: "東京23区（その他）", propertyType: "apartment", totalPrice: 71000000, landArea: 0, buildingArea: 72, buildAge: 9, walkMinutes: 5, tradeYear: 2024 },
  // 東京23区（都心部）（マンション）
  { city: "東京23区（都心部）", propertyType: "apartment", totalPrice: 98000000, landArea: 0, buildingArea: 60, buildAge: 12, walkMinutes: 6, tradeYear: 2024 },
  { city: "東京23区（都心部）", propertyType: "apartment", totalPrice: 88000000, landArea: 0, buildingArea: 55, buildAge: 16, walkMinutes: 5, tradeYear: 2023 },
  // 横浜市・川崎市（マンション）
  { city: "横浜市・川崎市", propertyType: "apartment", totalPrice: 42000000, landArea: 0, buildingArea: 68, buildAge: 14, walkMinutes: 8, tradeYear: 2024 },
  { city: "横浜市・川崎市", propertyType: "apartment", totalPrice: 48000000, landArea: 0, buildingArea: 72, buildAge: 10, walkMinutes: 6, tradeYear: 2024 },
  // 土浦市（戸建）
  { city: "土浦市", propertyType: "house", totalPrice: 26000000, landArea: 175, buildingArea: 105, buildAge: 13, walkMinutes: 14, tradeYear: 2024 },
  { city: "土浦市", propertyType: "house", totalPrice: 23000000, landArea: 160, buildingArea: 98, buildAge: 18, walkMinutes: 18, tradeYear: 2023 },
  // 日立市（戸建）
  { city: "日立市", propertyType: "house", totalPrice: 21000000, landArea: 200, buildingArea: 100, buildAge: 16, walkMinutes: 20, tradeYear: 2024 },
  { city: "日立市", propertyType: "house", totalPrice: 19500000, landArea: 185, buildingArea: 95, buildAge: 20, walkMinutes: 22, tradeYear: 2023 },
  // さいたま市（戸建）
  { city: "さいたま市", propertyType: "house", totalPrice: 43000000, landArea: 125, buildingArea: 100, buildAge: 12, walkMinutes: 12, tradeYear: 2024 },
  { city: "さいたま市", propertyType: "house", totalPrice: 39000000, landArea: 115, buildingArea: 95, buildAge: 16, walkMinutes: 14, tradeYear: 2023 },
  // 千葉市（戸建）
  { city: "千葉市", propertyType: "house", totalPrice: 34000000, landArea: 140, buildingArea: 102, buildAge: 14, walkMinutes: 13, tradeYear: 2024 },
  { city: "千葉市", propertyType: "house", totalPrice: 30500000, landArea: 130, buildingArea: 96, buildAge: 18, walkMinutes: 16, tradeYear: 2023 },
];

/** 築年による緩い価値逓減係数（事例比較の補正用・下限0.5） */
function ageMultiplier(age: number): number {
  return Math.max(0.5, 1 - age * 0.012);
}

/** 事例比較で使う規模指標（戸建・土地は土地面積、マンションは専有面積） */
function sizeMetric(c: { propertyType: PropertyType; landArea: number; buildingArea: number }): number {
  return c.propertyType === "apartment" ? c.buildingArea : c.landArea;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface ComparableResult {
  estimate: number;
  /** 採用した事例数 */
  n: number;
  /** 補正後の規模あたり単価の中央値（円） */
  unitMedian: number;
}

/**
 * 取引事例比較法による評価。同一エリア・同一種別の事例が2件以上必要。
 * 各事例の規模あたり単価を、対象の駅距離・築年に補正して中央値を採用する。
 */
export function appraiseByComparables(
  input: RealEstateInput,
  comps: TransactionComp[] = SAMPLE_COMPS
): ComparableResult | null {
  const subjectSize = sizeMetric(input);
  if (subjectSize <= 0) return null;

  const matches = comps.filter(
    (c) =>
      c.city === input.city &&
      c.propertyType === input.propertyType &&
      sizeMetric(c) > 0 &&
      c.totalPrice > 0
  );
  if (matches.length < 2) return null;

  const sWalk = walkFactor(input.walkMinutes);
  const sAge = ageMultiplier(input.buildAge);

  const adjustedUnits = matches.map((c) => {
    const unit = c.totalPrice / sizeMetric(c);
    const walkAdj = sWalk / walkFactor(c.walkMinutes);
    // 土地のみは築年補正なし
    const ageAdj = input.propertyType === "land" ? 1 : sAge / ageMultiplier(c.buildAge);
    return unit * walkAdj * ageAdj;
  });

  const unitMedian = median(adjustedUnits);
  const estimate = Math.round((unitMedian * subjectSize) / 10000) * 10000;
  return { estimate, n: matches.length, unitMedian };
}

/**
 * ハイブリッド査定：原価法と取引事例比較法をブレンドする。
 * 事例が十分にあれば事例比較に `compWeight`（既定0.55）の重みを置き、無ければ原価法のみ。
 * compWeight はバックテスト（backtest.ts の optimizeCompWeight）で最適化できる。
 */
export function appraiseHybrid(
  input: RealEstateInput,
  comps: TransactionComp[] = SAMPLE_COMPS,
  compWeight = 0.55
): AppraisalResult {
  const cost = appraiseRealEstate(input);
  const comp = appraiseByComparables(input, comps);
  if (!comp) {
    cost.notes = [
      ...cost.notes,
      "近傍の成約事例が不足しているため、原価法のみで算定しています（事例が増えると精度が上がります）。",
    ];
    return cost;
  }

  const w = Math.min(1, Math.max(0, compWeight));
  const blended = Math.round((comp.estimate * w + cost.estimate * (1 - w)) / 10000) * 10000;
  const low = Math.round((blended * 0.9) / 10000) * 10000;
  const high = Math.round((blended * 1.1) / 10000) * 10000;

  return {
    estimate: blended,
    low,
    high,
    breakdown: cost.breakdown,
    notes: [
      ...cost.notes,
      `取引事例比較法（成約${comp.n}件・補正後㎡単価中央値 ${Math.round(comp.unitMedian).toLocaleString()}円）では ${formatYen(comp.estimate)} と算定。`,
      `原価法 ${formatYen(cost.estimate)} とブレンド（事例${Math.round(w * 100)}%・原価${Math.round((1 - w) * 100)}%）し、最終査定額 ${formatYen(blended)} としています。`,
    ],
  };
}
