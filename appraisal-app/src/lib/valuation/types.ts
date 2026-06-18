// 査定エンジンの共通型定義

/** 査定結果の内訳1項目（透明性のため、各加減算を明示する） */
export interface BreakdownItem {
  /** 項目名（例: 土地価格、築年数による減価） */
  label: string;
  /** 表示用の補足（例: 120㎡ × 72,000円/㎡） */
  detail?: string;
  /** 金額（円）。加点はプラス、減点はマイナスで保持する */
  amount: number;
}

/** すべての査定エンジンが返す共通の結果フォーマット */
export interface AppraisalResult {
  /** 査定額の中央値（円・1万円単位に丸め） */
  estimate: number;
  /** 査定額レンジの下限（円） */
  low: number;
  /** 査定額レンジの上限（円） */
  high: number;
  /** 計算根拠の内訳 */
  breakdown: BreakdownItem[];
  /** 利用者向けの注意書き */
  notes: string[];
}

// ───────────────────────── 不動産 ─────────────────────────

export type PropertyType = "house" | "land" | "apartment";
export type Structure = "wood" | "steel" | "rc";
/** 内装グレード（建物価値の補正に使用） */
export type Grade = "standard" | "high" | "luxury";

export interface RealEstateInput {
  propertyType: PropertyType;
  /** CITY_LAND_PRICE のキー */
  city: string;
  /** 土地面積（㎡）。マンションは 0 */
  landArea: number;
  /** 建物（マンションは専有）面積（㎡）。土地のみは 0 */
  buildingArea: number;
  /** 築年数（年）。土地のみは 0 */
  buildAge: number;
  /** 建物構造。土地のみは無視される */
  structure: Structure;
  /** 最寄駅まで徒歩（分） */
  walkMinutes: number;
  /** リフォーム/リノベーション済みか（建物価値を加点）。任意 */
  renovated?: boolean;
  /** 内装グレード（建物価値を補正）。任意・既定は standard */
  grade?: Grade;
}

// ───────────────────────── 自動車 ─────────────────────────

export interface CarInput {
  /** 新車時価格（円）。車種テーブルまたは手入力 */
  newPrice: number;
  /** 初度登録年（西暦） */
  firstYear: number;
  /** 査定基準年（西暦） */
  currentYear: number;
  /** 走行距離（km） */
  mileageKm: number;
  /** メーカー名（MAKER_FACTOR のキー） */
  maker: string;
  /** 修復歴の有無 */
  repairHistory: boolean;
  /** 車検残（月） */
  inspectionMonthsLeft: number;
  /** 車種別リセール補正（人気・球数による値持ち）。任意・既定1.0 */
  resaleFactor?: number;
}
