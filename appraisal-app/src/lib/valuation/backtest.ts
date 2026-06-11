import { appraiseHybrid } from "./comparables";
import type { RealEstateInput } from "./types";

// 査定エンジンのバックテスト・ハーネス
//
// 実成約価格の集合に対してハイブリッド査定を走らせ、誤差指標（MAPE/MAE/±15%命中率）を返す。
// ACTUAL_SAMPLES は暫定の例示データ。tools/fetch_transactions.py で取得した
// 実成約データに差し替えると、実測ベースの精度評価になる。

export interface BacktestSample {
  /** 実成約価格（円） */
  actual: number;
  input: RealEstateInput;
  label?: string;
}

export interface BacktestRow {
  label: string;
  actual: number;
  estimate: number;
  /** |推定 − 実績| / 実績 × 100 */
  errorPct: number;
}

export interface BacktestReport {
  n: number;
  /** 平均絶対誤差率（%） */
  mape: number;
  /** 平均絶対誤差（円） */
  mae: number;
  /** 誤差±15%以内に収まった割合（%） */
  within15: number;
  rows: BacktestRow[];
}

export function runBacktest(samples: BacktestSample[], compWeight = 0.55): BacktestReport {
  const rows: BacktestRow[] = samples.map((s, i) => {
    const estimate = appraiseHybrid(s.input, undefined, compWeight).estimate;
    const errorPct = s.actual > 0 ? (Math.abs(estimate - s.actual) / s.actual) * 100 : 0;
    return { label: s.label ?? `#${i + 1}`, actual: s.actual, estimate, errorPct };
  });
  const n = rows.length;
  const mape = n ? rows.reduce((a, r) => a + r.errorPct, 0) / n : 0;
  const mae = n ? rows.reduce((a, r) => a + Math.abs(r.estimate - r.actual), 0) / n : 0;
  const within15 = n ? (rows.filter((r) => r.errorPct <= 15).length / n) * 100 : 0;
  return { n, mape, mae, within15, rows };
}

export interface BlendOptimization {
  /** MAPE を最小化する事例比較の重み（0〜1） */
  bestWeight: number;
  /** 最適重みでの MAPE（%） */
  bestMape: number;
  /** 既定重み(0.55)での MAPE（%） */
  baselineMape: number;
}

/**
 * 事例比較の重み compWeight を 0〜1 でグリッド探索し、MAPE を最小化する値を返す。
 * 実成約データを反映した後に実行すると、最適なブレンド比が分かる。
 */
export function optimizeCompWeight(
  samples: BacktestSample[],
  step = 0.05
): BlendOptimization {
  let bestWeight = 0.55;
  let bestMape = Infinity;
  for (let w = 0; w <= 1.0001; w += step) {
    const weight = Math.round(w * 100) / 100;
    const { mape } = runBacktest(samples, weight);
    if (mape < bestMape) {
      bestMape = mape;
      bestWeight = weight;
    }
  }
  return { bestWeight, bestMape, baselineMape: runBacktest(samples, 0.55).mape };
}

/** 例示用の実成約サンプル（実データは fetch_transactions.py で置換） */
export const ACTUAL_SAMPLES: BacktestSample[] = [
  {
    label: "水戸市 戸建",
    actual: 31000000,
    input: { propertyType: "house", city: "水戸市", landArea: 175, buildingArea: 105, buildAge: 12, structure: "wood", walkMinutes: 12 },
  },
  {
    label: "つくば市 戸建",
    actual: 36500000,
    input: { propertyType: "house", city: "つくば市", landArea: 160, buildingArea: 105, buildAge: 12, structure: "wood", walkMinutes: 14 },
  },
  {
    label: "ひたちなか市 戸建",
    actual: 25500000,
    input: { propertyType: "house", city: "ひたちなか市", landArea: 185, buildingArea: 102, buildAge: 14, structure: "wood", walkMinutes: 18 },
  },
  {
    label: "宇都宮市 戸建",
    actual: 27500000,
    input: { propertyType: "house", city: "宇都宮市", landArea: 190, buildingArea: 105, buildAge: 12, structure: "wood", walkMinutes: 13 },
  },
  {
    label: "東京23区 中古マンション",
    actual: 66000000,
    input: { propertyType: "apartment", city: "東京23区（その他）", landArea: 0, buildingArea: 70, buildAge: 12, structure: "rc", walkMinutes: 6 },
  },
];
