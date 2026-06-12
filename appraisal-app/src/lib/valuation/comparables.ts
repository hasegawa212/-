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
  // 水戸市（中古マンション）▼ 実物件（マイソク）: 水戸赤塚・RC・70.58㎡・3LDK・築2007・2,180万(売出/リフォーム済)
  { city: "水戸市", propertyType: "apartment", totalPrice: 21800000, landArea: 0, buildingArea: 70.58, buildAge: 18, walkMinutes: 12, tradeYear: 2026 },
  // 水戸市（戸建）
  // ▼ 実成約（登記簿で築年確認済み）: 水戸市鯉淵町・2016新築・土地234.79/建物89.42・駅遠
  { city: "水戸市", propertyType: "house", totalPrice: 22500000, landArea: 234.79, buildingArea: 89.42, buildAge: 6, walkMinutes: 25, tradeYear: 2022 },
  // ▼ 実成約（重要事項説明書）: 水戸市藤が原3-12-5・2019新築(築7)・土地290.86/建物105.98(木造)・駅遠
  { city: "水戸市", propertyType: "house", totalPrice: 28500000, landArea: 290.86, buildingArea: 105.98, buildAge: 7, walkMinutes: 25, tradeYear: 2026 },
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
  // ▼ 実成約（重要事項説明書・登記）: 宇都宮市清原台5-14-27・2004新築(築22)・土地232.13/建物105.16(木造)・駅遠
  { city: "宇都宮市", propertyType: "house", totalPrice: 27500000, landArea: 232.13, buildingArea: 105.16, buildAge: 22, walkMinutes: 25, tradeYear: 2025 },
  { city: "宇都宮市", propertyType: "house", totalPrice: 26500000, landArea: 185, buildingArea: 102, buildAge: 14, walkMinutes: 14, tradeYear: 2024 },
  { city: "宇都宮市", propertyType: "house", totalPrice: 29000000, landArea: 200, buildingArea: 108, buildAge: 9, walkMinutes: 12, tradeYear: 2023 },
  // 牛久市（戸建）
  // ▼ 実成約（重要事項説明書）: 牛久市南7-53-35・2006新築(築20)・土地331.87/建物104.43(軽量鉄骨)・駅遠
  { city: "牛久市", propertyType: "house", totalPrice: 23000000, landArea: 331.87, buildingArea: 104.43, buildAge: 20, walkMinutes: 22, tradeYear: 2026 },
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

  // ▼ 実成約（売買契約書・ドライブ一括取込）。築年・駅は契約書に記載が無いものは
  //   築15年・徒歩20分を仮置き（判明分は実値）。価格は総額（土地+建物）。
  { city: "ひたちなか市", propertyType: "house", totalPrice: 16300000, landArea: 200.01, buildingArea: 101.02, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 津田東1丁目
  { city: "ひたちなか市", propertyType: "house", totalPrice: 19800000, landArea: 265.74, buildingArea: 130.83, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 市毛445-8
  { city: "ひたちなか市", propertyType: "house", totalPrice: 21800000, landArea: 218, buildingArea: 126.23, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 中根字六ツ野（軽量鉄骨）
  { city: "小山市", propertyType: "house", totalPrice: 17990000, landArea: 151.82, buildingArea: 87.76, buildAge: 8, walkMinutes: 18, tradeYear: 2025 }, // 間々田（2017新築）
  { city: "小山市", propertyType: "house", totalPrice: 17000000, landArea: 164.51, buildingArea: 110.0, buildAge: 15, walkMinutes: 18, tradeYear: 2025 }, // 東城南2丁目
  { city: "宇都宮市", propertyType: "house", totalPrice: 18000000, landArea: 183.79, buildingArea: 88.19, buildAge: 20, walkMinutes: 25, tradeYear: 2025 }, // 鶴田町（2005新築・駅遠）
  { city: "石岡市", propertyType: "house", totalPrice: 21800000, landArea: 288.9, buildingArea: 77.01, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 東大橋
  { city: "土浦市", propertyType: "house", totalPrice: 17490000, landArea: 170.67, buildingArea: 123.66, buildAge: 15, walkMinutes: 18, tradeYear: 2025 }, // 上高津新町
  { city: "その他（茨城県）", propertyType: "house", totalPrice: 25850000, landArea: 212.01, buildingArea: 84.25, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 東海村須和間
  { city: "その他（栃木県）", propertyType: "house", totalPrice: 25850000, landArea: 208.47, buildingArea: 122.84, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 高根沢町宝積寺
  { city: "その他（埼玉県）", propertyType: "house", totalPrice: 13500000, landArea: 151.37, buildingArea: 90.88, buildAge: 15, walkMinutes: 20, tradeYear: 2025 }, // 寄居町富田下台
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
