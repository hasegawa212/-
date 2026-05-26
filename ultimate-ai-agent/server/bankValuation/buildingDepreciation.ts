// 建物の減価曲線
//
// 旧実装: building_value = replacement × max(0, (legal - age) / legal)
//   → 法定耐用年数到達で価値ゼロ。実際の銀行・不動産鑑定の挙動と乖離。
//
// 新実装: 残価率 floor + 線形補完
//   building_value = replacement × max(residual, residual + (1 - residual) × (1 - age/legal))
//
// これにより:
//   - 築 0 年: 1.0
//   - 築 法定耐用年数: residual（10〜20%）
//   - 築 法定耐用年数以降: residual で頭打ち（再建築不要な構造躯体の残存価値）

export function buildingDepreciationFactor(
  ageYears: number,
  legalLifeYears: number,
  residualRatio: number
): number {
  if (ageYears <= 0) return 1.0;
  if (legalLifeYears <= 0) return residualRatio;
  if (ageYears >= legalLifeYears) return residualRatio;
  // 線形補完: 1.0 → residual
  return residualRatio + (1 - residualRatio) * (1 - ageYears / legalLifeYears);
}
