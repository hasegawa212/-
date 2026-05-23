// 国税庁 財産評価基本通達に準拠した路線価補正
// 普通住宅地区（最も一般的）の値を採用。商業地区等は将来拡張。
// 出典: 国税庁「土地及び土地の上に存する権利の評価明細書」付表

// ----- 奥行価格補正率（普通住宅地区） -----
// 奥行距離（m）の上限 → 補正率
const DEPTH_PRICE_TABLE_NORMAL_RESIDENTIAL: Array<[number, number]> = [
  [4, 0.9],
  [6, 0.92],
  [8, 0.95],
  [10, 0.97],
  [24, 1.0],
  [28, 0.99],
  [32, 0.98],
  [36, 0.97],
  [40, 0.96],
  [44, 0.95],
  [48, 0.94],
  [52, 0.93],
  [56, 0.92],
  [60, 0.91],
  [64, 0.9],
  [68, 0.89],
  [72, 0.88],
  [76, 0.87],
  [80, 0.86],
  [84, 0.85],
  [88, 0.84],
  [92, 0.83],
  [96, 0.82],
  [100, 0.81],
];

export function depthPriceFactor(depthM: number): number {
  if (depthM <= 0) return 1.0;
  for (const [upper, factor] of DEPTH_PRICE_TABLE_NORMAL_RESIDENTIAL) {
    if (depthM < upper) return factor;
  }
  return 0.8; // 100m 超
}

// ----- 間口狭小補正率（普通住宅地区） -----
export function narrowFrontageFactor(frontageM: number): number {
  if (frontageM <= 0) return 1.0;
  if (frontageM < 4) return 0.9;
  if (frontageM < 6) return 0.94;
  if (frontageM < 8) return 0.97;
  return 1.0;
}

// ----- 奥行長大補正率（普通住宅地区） -----
// 奥行 / 間口 比率に応じた補正
export function depthRatioFactor(depthM: number, frontageM: number): number {
  if (frontageM <= 0) return 1.0;
  const ratio = depthM / frontageM;
  if (ratio < 2) return 1.0;
  if (ratio < 3) return 0.98;
  if (ratio < 4) return 0.96;
  if (ratio < 5) return 0.94;
  if (ratio < 6) return 0.92;
  if (ratio < 7) return 0.9;
  if (ratio < 8) return 0.88;
  return 0.86;
}

// ----- 不整形地補正率（普通住宅地区） -----
// かげ地割合（仮定矩形に対する欠損割合）に応じた補正
// 普通住宅地区・地積区分 A（500㎡未満）の代表値
export function irregularShapeFactor(kagechiPercent: number): number {
  if (kagechiPercent < 10) return 1.0;
  if (kagechiPercent < 15) return 0.98;
  if (kagechiPercent < 20) return 0.97;
  if (kagechiPercent < 25) return 0.95;
  if (kagechiPercent < 30) return 0.93;
  if (kagechiPercent < 35) return 0.92;
  if (kagechiPercent < 40) return 0.9;
  if (kagechiPercent < 45) return 0.88;
  if (kagechiPercent < 50) return 0.85;
  if (kagechiPercent < 55) return 0.82;
  if (kagechiPercent < 60) return 0.79;
  if (kagechiPercent < 65) return 0.75;
  return 0.7;
}

// ----- 接道タイプ加算 -----
// 角地・準角地・二方路線
export type RoadFrontageType = "single" | "corner" | "semiCorner" | "twoSides";

export function roadFrontageAddition(type: RoadFrontageType): number {
  // 普通住宅地区
  switch (type) {
    case "corner":
      return 0.03; // 側方路線影響加算
    case "semiCorner":
      return 0.02;
    case "twoSides":
      return 0.02; // 二方路線影響加算
    case "single":
    default:
      return 0;
  }
}

// ----- 接道義務（建築基準法 42 条）違反による減価 -----
// 接道幅員と道路幅員から再建築可否を判定
// 接道幅員 < 2m: 再建築不可 → 0.5（市場流通価値は半減程度）
// 道路幅員 < 4m（2 項道路）: セットバック義務 → 概算 0.95
export function roadAccessFactor(input: {
  accessWidthM: number; // 接道幅員（敷地と道路の接する長さ）
  roadWidthM: number; // 前面道路幅員
}): { factor: number; note: string } {
  if (input.accessWidthM < 2) {
    return { factor: 0.5, note: "再建築不可（接道 2m 未満）" };
  }
  if (input.roadWidthM < 4) {
    return { factor: 0.95, note: "2 項道路（セットバック要・約 5% 減価）" };
  }
  return { factor: 1.0, note: "適法接道" };
}

// ----- 容積率消化率（建物が容積率を使い切っていない減価補正） -----
// 一棟・収益物件では参考程度。0.5 未満で軽い減価
export function farUtilizationFactor(
  buildingAreaSqm: number,
  landAreaSqm: number,
  farPercent: number
): { utilization: number; factor: number } {
  if (landAreaSqm <= 0 || farPercent <= 0) {
    return { utilization: 1, factor: 1 };
  }
  const allowedFloor = landAreaSqm * (farPercent / 100);
  const utilization = buildingAreaSqm / allowedFloor;
  if (utilization >= 0.7) return { utilization, factor: 1 };
  if (utilization >= 0.5) return { utilization, factor: 0.98 };
  if (utilization >= 0.3) return { utilization, factor: 0.95 };
  return { utilization, factor: 0.92 };
}
