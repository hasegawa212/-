import { appraiseHybrid, SAMPLE_COMPS, type TransactionComp } from "./comparables";
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

// ───────── 実成約のLeave-One-Outバックテスト ─────────
// 登録済みの実成約（SAMPLE_COMPS に入っているもの）をそのまま当てると
// 「自分で自分を当てる」リークになる。各物件を事例から除外して査定し、
// 実価格と比較することで、公平な実測精度（MAPE等）を測る。

/** 登録済み実成約（売買契約書・重要事項説明書・登記より）。actual=成約/売出総額 */
export const REAL_SALES: BacktestSample[] = [
  { label: "水戸市鯉淵町(戸建)", actual: 22500000, input: { propertyType: "house", city: "水戸市", landArea: 234.79, buildingArea: 89.42, buildAge: 6, structure: "wood", walkMinutes: 25 } },
  { label: "水戸市藤が原(戸建)", actual: 28500000, input: { propertyType: "house", city: "水戸市", landArea: 290.86, buildingArea: 105.98, buildAge: 7, structure: "wood", walkMinutes: 25 } },
  { label: "水戸市赤塚(マンション)", actual: 21800000, input: { propertyType: "apartment", city: "水戸市", landArea: 0, buildingArea: 70.58, buildAge: 18, structure: "rc", walkMinutes: 12 } },
  { label: "牛久市南7(戸建)", actual: 23000000, input: { propertyType: "house", city: "牛久市", landArea: 331.87, buildingArea: 104.43, buildAge: 20, structure: "steel", walkMinutes: 22 } },
  { label: "宇都宮市清原台(戸建)", actual: 27500000, input: { propertyType: "house", city: "宇都宮市", landArea: 232.13, buildingArea: 105.16, buildAge: 22, structure: "wood", walkMinutes: 25 } },
  { label: "宇都宮市鶴田町(戸建)", actual: 18000000, input: { propertyType: "house", city: "宇都宮市", landArea: 183.79, buildingArea: 88.19, buildAge: 20, structure: "wood", walkMinutes: 25 } },
  { label: "ひたちなか市津田東(戸建)", actual: 16300000, input: { propertyType: "house", city: "ひたちなか市", landArea: 200.01, buildingArea: 101.02, buildAge: 15, structure: "wood", walkMinutes: 20 } },
  { label: "ひたちなか市市毛(戸建)", actual: 19800000, input: { propertyType: "house", city: "ひたちなか市", landArea: 265.74, buildingArea: 130.83, buildAge: 15, structure: "wood", walkMinutes: 20 } },
  { label: "ひたちなか市中根(戸建)", actual: 21800000, input: { propertyType: "house", city: "ひたちなか市", landArea: 218, buildingArea: 126.23, buildAge: 15, structure: "steel", walkMinutes: 20 } },
  { label: "小山市間々田(戸建)", actual: 17990000, input: { propertyType: "house", city: "小山市", landArea: 151.82, buildingArea: 87.76, buildAge: 8, structure: "wood", walkMinutes: 18 } },
  { label: "小山市東城南(戸建)", actual: 17000000, input: { propertyType: "house", city: "小山市", landArea: 164.51, buildingArea: 110, buildAge: 15, structure: "wood", walkMinutes: 18 } },
  { label: "石岡市東大橋(戸建)", actual: 21800000, input: { propertyType: "house", city: "石岡市", landArea: 288.9, buildingArea: 77.01, buildAge: 15, structure: "wood", walkMinutes: 20 } },
  { label: "土浦市上高津(戸建)", actual: 17490000, input: { propertyType: "house", city: "土浦市", landArea: 170.67, buildingArea: 123.66, buildAge: 15, structure: "wood", walkMinutes: 18 } },
  { label: "東海村須和間(戸建)", actual: 25850000, input: { propertyType: "house", city: "東海村", landArea: 212.01, buildingArea: 84.25, buildAge: 15, structure: "wood", walkMinutes: 20 } },
  { label: "高根沢町宝積寺(戸建)", actual: 25850000, input: { propertyType: "house", city: "高根沢町", landArea: 208.47, buildingArea: 122.84, buildAge: 15, structure: "wood", walkMinutes: 20 } },
  { label: "寄居町富田下台(戸建)", actual: 13500000, input: { propertyType: "house", city: "寄居町", landArea: 151.37, buildingArea: 90.88, buildAge: 15, structure: "wood", walkMinutes: 20 } },
];

/** ある実成約サンプルに対応する事例を SAMPLE_COMPS から除外する（リーク防止） */
function excludeSelf(s: BacktestSample, comps: TransactionComp[]): TransactionComp[] {
  return comps.filter(
    (c) =>
      !(
        c.city === s.input.city &&
        c.propertyType === s.input.propertyType &&
        Math.abs(c.totalPrice - s.actual) < 1 &&
        Math.abs(c.buildingArea - s.input.buildingArea) < 0.6
      )
  );
}

/**
 * Leave-One-Out バックテスト。各サンプルを事例から除外して appraiseHybrid で査定し、
 * 実価格との誤差（MAPE/MAE/±15%命中率）を返す。
 */
export function runBacktestLOO(
  samples: BacktestSample[] = REAL_SALES,
  comps: TransactionComp[] = SAMPLE_COMPS,
  compWeight = 0.55
): BacktestReport {
  const rows: BacktestRow[] = samples.map((s, i) => {
    const estimate = appraiseHybrid(s.input, excludeSelf(s, comps), compWeight).estimate;
    const errorPct = s.actual > 0 ? (Math.abs(estimate - s.actual) / s.actual) * 100 : 0;
    return { label: s.label ?? `#${i + 1}`, actual: s.actual, estimate, errorPct };
  });
  const n = rows.length;
  const mape = n ? rows.reduce((a, r) => a + r.errorPct, 0) / n : 0;
  const mae = n ? rows.reduce((a, r) => a + Math.abs(r.estimate - r.actual), 0) / n : 0;
  const within15 = n ? (rows.filter((r) => r.errorPct <= 15).length / n) * 100 : 0;
  return { n, mape, mae, within15, rows };
}
