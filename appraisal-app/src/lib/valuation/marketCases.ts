// 首都圏 不動産相場の参考事例
//
// 出典: 株式会社マーシャルアーツ向け「市場調査資料」（株式会社フォーバル 首都圏第二支店, 2023/01/23）
// 同資料が引用する各種公開統計（首都圏の新築/中古マンション・戸建ての平均価格等）をもとに、
// 査定結果を相場感と突き合わせるための参考データとして収録する。
// ※ いずれも首都圏（1都3県）の市場平均で、本アプリ標準の茨城県エリアとは水準が異なる点に注意。

export interface MarketCase {
  /** 物件種別 */
  category: "新築マンション" | "中古マンション" | "新築戸建て" | "中古戸建て";
  /** 対象エリア */
  area: string;
  /** 平均価格（円） */
  avgPrice: number;
  /** ㎡単価（円）。データがある場合のみ */
  unitPricePerSqm?: number;
  /** 集計時点 */
  period: string;
  /** 補足 */
  note?: string;
}

/** 出典表記（UI 下部に表示する） */
export const MARKET_SOURCE =
  "出典: 市場調査資料（株式会社フォーバル, 2023年1月）／首都圏 1都3県の市場平均";

/** 首都圏 全体の参考相場（種別ごとの平均） */
export const MARKET_CASES: MarketCase[] = [
  {
    category: "新築マンション",
    area: "首都圏",
    avgPrice: 60350000,
    unitPricePerSqm: 898000,
    period: "2022年11月",
    note: "戸当たり平均。供給量は前年同月比で半減し価格は高止まり。",
  },
  {
    category: "中古マンション",
    area: "首都圏",
    avgPrice: 48070000,
    period: "2022年11月",
    note: "2021年5月以降の連続上昇が一服し、前月比ほぼ横ばい。",
  },
  {
    category: "新築戸建て",
    area: "首都圏",
    avgPrice: 41700000,
    period: "2022年11月",
    note: "8エリア全てで2017年以降の最高額を更新。",
  },
  {
    category: "中古戸建て",
    area: "首都圏",
    avgPrice: 37410000,
    period: "2022年3月",
    note: "新築価格の上昇を背景に中古を検討する層が増加傾向。",
  },
];

/** 中古マンションの都県別 相場（首都圏内の地域差の目安） */
export const CONDO_BY_PREFECTURE: { prefecture: string; avgPrice: number; period: string }[] = [
  { prefecture: "東京都", avgPrice: 63990000, period: "2022年11月" },
  { prefecture: "神奈川県", avgPrice: 36590000, period: "2022年11月" },
  { prefecture: "埼玉県", avgPrice: 30090000, period: "2022年11月" },
  { prefecture: "千葉県", avgPrice: 27320000, period: "2022年11月" },
];
