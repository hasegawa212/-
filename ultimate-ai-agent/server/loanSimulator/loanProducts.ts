// 住宅ローン商品プロファイル（2026 年代表値）
// 出典: 各行の公開金利情報・住宅金融支援機構フラット 35 の標準金利
//
// プロ水準の審査再現のため、銀行別の主要商品と審査基準を内蔵する。
// 実取引条件は個別案件で変動するため、必ず銀行ヒアリングで確定すること。

export type LoanProductType =
  | "variable" // 変動金利
  | "fixed10" // 固定 10 年
  | "fixed20" // 固定 20 年
  | "fixed35" // 固定 35 年（全期間固定）
  | "flat35" // フラット 35
  | "flat50"; // フラット 50

export interface LoanProduct {
  id: string;
  bankId: "megabank" | "regional" | "shinkin" | "nonbank" | "jhf";
  bankLabel: string;
  productType: LoanProductType;
  productLabel: string;
  // 金利（×100 で整数保管・2026 年代表値）
  baseRatePercent: number;
  // 審査基準
  maxLoanTermYears: number;
  maxCompletionAgeYears: number; // 完済時年齢
  maxLoanToIncomeRatio: number; // 年収倍率（借入÷年収）
  maxRepaymentBurdenRatio: number; // 返済比率（年返済÷年収）
  // 団信
  groupCreditInsuranceIncluded: boolean; // 団信が金利に含まれるか
  groupCreditInsuranceExtraPercent: number; // 上乗せが必要なら ×100 で
  note: string;
}

export const LOAN_PRODUCTS: LoanProduct[] = [
  // ===== メガバンク =====
  {
    id: "mega-variable",
    bankId: "megabank",
    bankLabel: "メガバンク（三菱 UFJ / 三井住友 / みずほ）",
    productType: "variable",
    productLabel: "変動金利",
    baseRatePercent: 0.375,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 8.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "店頭金利からの優遇後想定。属性次第で 0.345〜0.5%。5 年ルール・125%ルール適用。",
  },
  {
    id: "mega-fixed10",
    bankId: "megabank",
    bankLabel: "メガバンク",
    productType: "fixed10",
    productLabel: "固定 10 年",
    baseRatePercent: 1.2,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 8.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "10 年固定後は変動 or 再固定へ。",
  },
  {
    id: "mega-fixed35",
    bankId: "megabank",
    bankLabel: "メガバンク",
    productType: "fixed35",
    productLabel: "全期間固定",
    baseRatePercent: 1.95,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 8.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "金利上昇リスクなし。",
  },
  // ===== 地方銀行 =====
  {
    id: "regional-variable",
    bankId: "regional",
    bankLabel: "地方銀行（横浜銀行 / 千葉銀行 等）",
    productType: "variable",
    productLabel: "変動金利",
    baseRatePercent: 0.5,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 7.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "地元エリア優遇あり。属性により 0.4〜0.7%。",
  },
  {
    id: "regional-fixed10",
    bankId: "regional",
    bankLabel: "地方銀行",
    productType: "fixed10",
    productLabel: "固定 10 年",
    baseRatePercent: 1.35,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 7.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "",
  },
  // ===== 信用金庫 =====
  {
    id: "shinkin-variable",
    bankId: "shinkin",
    bankLabel: "信用金庫（西武信金 / 城南信金 等）",
    productType: "variable",
    productLabel: "変動金利",
    baseRatePercent: 0.85,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 79,
    maxLoanToIncomeRatio: 7.0,
    maxRepaymentBurdenRatio: 0.4,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0,
    note: "属性柔軟・自営業 OK。地域密着型。",
  },
  // ===== フラット 35 =====
  {
    id: "flat35-standard",
    bankId: "jhf",
    bankLabel: "住宅金融支援機構 フラット 35",
    productType: "flat35",
    productLabel: "フラット 35（団信込）",
    baseRatePercent: 1.85,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 10.0, // 年収倍率は緩い
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0.28, // 機構団信付きの上乗せ
    note: "全期間固定。年収 400 万未満は 30%、以上は 35% が返済比率上限。",
  },
  {
    id: "flat50",
    bankId: "jhf",
    bankLabel: "住宅金融支援機構 フラット 50",
    productType: "flat50",
    productLabel: "フラット 50",
    baseRatePercent: 2.25,
    maxLoanTermYears: 50,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 10.0,
    maxRepaymentBurdenRatio: 0.35,
    groupCreditInsuranceIncluded: true,
    groupCreditInsuranceExtraPercent: 0.28,
    note: "長期間で月返済を抑制（長期優良住宅対象）。",
  },
  // ===== ノンバンク =====
  {
    id: "nonbank-variable",
    bankId: "nonbank",
    bankLabel: "ノンバンク（オリックス / SBI 等）",
    productType: "variable",
    productLabel: "変動金利",
    baseRatePercent: 1.5,
    maxLoanTermYears: 35,
    maxCompletionAgeYears: 80,
    maxLoanToIncomeRatio: 9.0, // 緩い
    maxRepaymentBurdenRatio: 0.4,
    groupCreditInsuranceIncluded: false,
    groupCreditInsuranceExtraPercent: 0.3,
    note: "属性緩・金利高め。団信は別途加入要。",
  },
];

/**
 * 諸費用率（物件価格に対する比率）
 * - 新築マンション: 3〜6%
 * - 中古住宅: 6〜9%
 * - 投資用一棟: 7〜10%
 * (登録免許税・印紙代・司法書士報酬・事務手数料・保証料・火災保険・不動産取得税)
 */
export const MISC_COST_RATE: Record<string, number> = {
  newCondo: 0.04,
  usedHouse: 0.075,
  investment: 0.085,
};
