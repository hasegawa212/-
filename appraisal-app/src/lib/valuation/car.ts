import { AGE_RESIDUAL_CURVE, MAKER_FACTOR } from "./data";
import type { AppraisalResult, BreakdownItem, CarInput } from "./types";

/** 1万円単位に丸める */
function roundToMan(value: number): number {
  return Math.round(value / 10000) * 10000;
}

/** 値を [min, max] に収める */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 経過年数に対する残価率を、AGE_RESIDUAL_CURVE から線形補間で求める。
 * カーブの範囲外は端点で頭打ち（下限0.03）。
 */
export function ageResidualRate(years: number): number {
  const curve = AGE_RESIDUAL_CURVE;
  if (years <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (years >= last[0]) return last[1];

  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i];
    const [x1, y1] = curve[i + 1];
    if (years >= x0 && years <= x1) {
      const t = (years - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

/**
 * 走行距離による補正係数。
 * 標準を年1万kmとし、それより多ければ減点・少なければ加点。
 * 過度な振れを避けるため [0.6, 1.25] でクランプする。
 */
export function mileageFactor(mileageKm: number, ageYears: number): number {
  const expected = Math.max(1, ageYears) * 10000;
  const diff = mileageKm - expected;
  return clamp(1 - diff / 300000, 0.6, 1.25);
}

/**
 * 自動車の概算買取査定額を算出する。
 *
 * 査定額 = 新車価格 × 年式残価率 × 走行距離補正 × メーカー補正
 *          ×（修復歴あり 0.6）＋ 車検残ボーナス
 */
export function appraiseCar(input: CarInput): AppraisalResult {
  const age = Math.max(0, input.currentYear - input.firstYear);
  const ageRate = ageResidualRate(age);
  const mFactor = mileageFactor(input.mileageKm, age);
  const makerFactor = MAKER_FACTOR[input.maker] ?? MAKER_FACTOR["その他"];
  const repairFactor = input.repairHistory ? 0.6 : 1;

  const breakdown: BreakdownItem[] = [];
  const notes: string[] = [];

  const base = input.newPrice * ageRate;
  breakdown.push({
    label: "年式評価",
    detail: `新車${input.newPrice.toLocaleString()}円 × 残価率${(ageRate * 100).toFixed(0)}%（${age}年落ち）`,
    amount: base,
  });

  const afterMileage = base * mFactor;
  breakdown.push({
    label: "走行距離補正",
    detail: `${input.mileageKm.toLocaleString()}km → 係数${mFactor.toFixed(2)}`,
    amount: afterMileage - base,
  });

  const afterMaker = afterMileage * makerFactor;
  breakdown.push({
    label: "メーカー補正",
    detail: `${input.maker} → 係数${makerFactor.toFixed(2)}`,
    amount: afterMaker - afterMileage,
  });

  let value = afterMaker;
  if (input.repairHistory) {
    const afterRepair = value * repairFactor;
    breakdown.push({
      label: "修復歴による減額",
      detail: "修復歴あり → 係数0.60",
      amount: afterRepair - value,
    });
    value = afterRepair;
    notes.push("修復歴ありの車両は市場評価が大きく下がるため、40%相当を減額しています。");
  }

  // 車検残ボーナス（最大24か月で頭打ち、車検費用相当の最大5万円）
  const inspectionBonus = Math.round((clamp(input.inspectionMonthsLeft, 0, 24) / 24) * 50000);
  if (inspectionBonus > 0) {
    breakdown.push({
      label: "車検残ボーナス",
      detail: `車検残${input.inspectionMonthsLeft}か月`,
      amount: inspectionBonus,
    });
    value += inspectionBonus;
  }

  // 下限: 新車価格の3%（解体・部品価値の下支え）
  const floor = input.newPrice * 0.03;
  if (value < floor) {
    notes.push("算定額が下限を下回ったため、部品・スクラップ価値として下限額を採用しています。");
    value = floor;
  }

  const estimate = roundToMan(value);
  // 装備・色・市場需給の不確実性として ±10% をレンジとする
  const low = roundToMan(estimate * 0.9);
  const high = roundToMan(estimate * 1.1);

  notes.push("実際の買取額は内外装の状態・装備・市場相場により変動します。");

  return { estimate, low, high, breakdown, notes };
}
