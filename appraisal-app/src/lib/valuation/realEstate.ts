import { CITY_LAND_PRICE, STRUCTURE_SPEC, APARTMENT_UNIT_MULTIPLIER } from "./data";
import type { AppraisalResult, BreakdownItem, RealEstateInput } from "./types";

/** 1万円単位に丸める */
function roundToMan(value: number): number {
  return Math.round(value / 10000) * 10000;
}

/**
 * 最寄駅までの徒歩分数による立地補正係数。
 * 駅近ほど価格は上振れ、遠いほど下振れする。
 */
export function walkFactor(min: number): number {
  if (min <= 3) return 1.12;
  if (min <= 5) return 1.08;
  if (min <= 10) return 1.0;
  if (min <= 15) return 0.93;
  if (min <= 20) return 0.86;
  return 0.8;
}

/**
 * 建物の残存価値率（定額法・下限10%）。
 * 築年数が法定耐用年数に達しても、躯体や設備の残存価値として10%を残す。
 */
export function buildingResidualRate(age: number, usefulLife: number): number {
  const rate = 1 - age / usefulLife;
  return Math.max(0.1, rate);
}

/**
 * 不動産（戸建・土地・マンション）の概算査定額を算出する。
 *
 * - 戸建: 土地価格（面積×地価×駅補正）＋ 建物価格（面積×再調達単価×残存率）
 * - 土地: 土地価格のみ
 * - マンション: 専有面積 × エリア相場単価 × 残存率 × 駅補正
 */
export function appraiseRealEstate(input: RealEstateInput): AppraisalResult {
  const cityPrice = CITY_LAND_PRICE[input.city] ?? CITY_LAND_PRICE["その他（茨城県）"];
  const wf = walkFactor(input.walkMinutes);
  const breakdown: BreakdownItem[] = [];
  const notes: string[] = [];

  let total = 0;

  if (input.propertyType === "apartment") {
    const unit = Math.round(cityPrice * APARTMENT_UNIT_MULTIPLIER);
    // マンションはRC造として残存率を計算
    const residual = buildingResidualRate(input.buildAge, STRUCTURE_SPEC.rc.usefulLife);
    const value = input.buildingArea * unit * residual * wf;
    total = value;
    breakdown.push({
      label: "マンション本体価格",
      detail: `${input.buildingArea}㎡ × ${unit.toLocaleString()}円/㎡ × 残存率${(residual * 100).toFixed(0)}%`,
      amount: input.buildingArea * unit * residual,
    });
    breakdown.push({
      label: "立地補正（最寄駅徒歩）",
      detail: `徒歩${input.walkMinutes}分 → 係数${wf.toFixed(2)}`,
      amount: value - input.buildingArea * unit * residual,
    });
    notes.push("マンションは専有面積ベースの相場単価から概算しています（土地持分・管理状態は未考慮）。");
  } else {
    // 土地価格（戸建・土地共通）
    const landValue = input.landArea * cityPrice * wf;
    total += landValue;
    breakdown.push({
      label: "土地価格",
      detail: `${input.landArea}㎡ × ${cityPrice.toLocaleString()}円/㎡ × 駅補正${wf.toFixed(2)}`,
      amount: landValue,
    });

    if (input.propertyType === "house") {
      const spec = STRUCTURE_SPEC[input.structure];
      const residual = buildingResidualRate(input.buildAge, spec.usefulLife);
      const buildingValue = input.buildingArea * spec.rebuildUnit * residual;
      total += buildingValue;
      breakdown.push({
        label: `建物価格（${spec.label}）`,
        detail: `${input.buildingArea}㎡ × ${spec.rebuildUnit.toLocaleString()}円/㎡ × 残存率${(residual * 100).toFixed(0)}%（築${input.buildAge}年/耐用${spec.usefulLife}年）`,
        amount: buildingValue,
      });
      if (input.buildAge >= spec.usefulLife) {
        notes.push(`築年数が法定耐用年数（${spec.usefulLife}年）を超えているため、建物は下限の残存価値（10%）で評価しています。`);
      }
    }
  }

  const estimate = roundToMan(total);
  // 個別要因（リフォーム履歴・日当たり・接道など）の不確実性として ±8% をレンジとする
  const low = roundToMan(estimate * 0.92);
  const high = roundToMan(estimate * 1.08);

  notes.push("地価は各エリアの公開地価水準をもとにした概算で、実際の査定額は現地調査により変動します。");

  return { estimate, low, high, breakdown, notes };
}
