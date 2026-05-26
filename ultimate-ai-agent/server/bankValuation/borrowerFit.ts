import type { BankProfile } from "./constants";

export type EmploymentType =
  | "salaryman" // 給与所得者（会社員）
  | "executive" // 役員（中堅・大企業）
  | "soleProprietor" // 個人事業主
  | "companyOwner" // 法人代表者
  | "other";

export interface BorrowerAttributes {
  annualIncomeYen: number; // 年収（円）。0 で属性未指定
  employmentType: EmploymentType;
  yearsOfEmployment: number; // 勤続年数 or 開業年数
  ownFundsYen: number; // 自己資金（円）
  otherDebtMonthlyYen: number; // 他借入の月返済（円）
}

export const DEFAULT_BORROWER: BorrowerAttributes = {
  annualIncomeYen: 0,
  employmentType: "salaryman",
  yearsOfEmployment: 0,
  ownFundsYen: 0,
  otherDebtMonthlyYen: 0,
};

/**
 * 銀行ごとの借入人適合度（0〜1）。属性未指定（年収 0）の場合は 1.0（補正なし）。
 *
 * スコア算出ロジック（脱属人化原則⑤に基づく明示判断基準）:
 *   1. 年収スコア（最大 0.6）
 *   2. 職業スコア（最大 0.2）
 *   3. 勤続スコア（最大 0.1）
 *   4. 自己資金比率ボーナス（最大 0.1）
 */
export function calcBorrowerFit(
  bank: BankProfile,
  attrs: BorrowerAttributes,
  askingPriceYen: number
): {
  score: number;
  incomeScore: number;
  employmentScore: number;
  tenureScore: number;
  ownFundsBonus: number;
  note: string;
} {
  // 属性未指定 → 補正なし
  if (attrs.annualIncomeYen <= 0) {
    return {
      score: 1.0,
      incomeScore: 0,
      employmentScore: 0,
      tenureScore: 0,
      ownFundsBonus: 0,
      note: "借入人属性未入力（デフォルト評価）",
    };
  }

  const income = attrs.annualIncomeYen;
  const cat = bank.category;

  // ===== 1. 年収スコア（銀行カテゴリ別の閾値） =====
  let incomeScore = 0;
  if (cat === "megabank") {
    // メガバンク: 年収 800万+ が標準、1000万+ で最大、500万未満は厳しい
    if (income >= 10_000_000) incomeScore = 0.6;
    else if (income >= 8_000_000) incomeScore = 0.55;
    else if (income >= 6_000_000) incomeScore = 0.45;
    else if (income >= 5_000_000) incomeScore = 0.35;
    else incomeScore = 0.2;
  } else if (cat === "regional") {
    // 地銀: 500万+ で標準
    if (income >= 8_000_000) incomeScore = 0.6;
    else if (income >= 5_000_000) incomeScore = 0.55;
    else if (income >= 4_000_000) incomeScore = 0.45;
    else if (income >= 3_000_000) incomeScore = 0.35;
    else incomeScore = 0.25;
  } else if (cat === "shinkin") {
    // 信金: 地域密着・属性柔軟。300万+ で十分
    if (income >= 5_000_000) incomeScore = 0.6;
    else if (income >= 3_000_000) incomeScore = 0.55;
    else if (income >= 2_000_000) incomeScore = 0.45;
    else incomeScore = 0.35;
  } else {
    // nonbank: 年収依存度は低い
    if (income >= 5_000_000) incomeScore = 0.6;
    else if (income >= 3_000_000) incomeScore = 0.5;
    else incomeScore = 0.4;
  }

  // ===== 2. 職業スコア（銀行カテゴリ別の好み） =====
  let employmentScore = 0;
  const e = attrs.employmentType;
  if (cat === "megabank") {
    if (e === "salaryman" || e === "executive") employmentScore = 0.2;
    else if (e === "companyOwner") employmentScore = 0.1;
    else if (e === "soleProprietor") employmentScore = 0.05;
    else employmentScore = 0;
  } else if (cat === "regional") {
    if (e === "salaryman" || e === "executive" || e === "companyOwner") employmentScore = 0.18;
    else if (e === "soleProprietor") employmentScore = 0.12;
    else employmentScore = 0.05;
  } else if (cat === "shinkin") {
    // 信金は自営業に強い
    if (e === "soleProprietor" || e === "companyOwner") employmentScore = 0.2;
    else if (e === "salaryman" || e === "executive") employmentScore = 0.15;
    else employmentScore = 0.05;
  } else {
    // nonbank: ほぼ無差別
    employmentScore = 0.15;
  }

  // ===== 3. 勤続スコア =====
  let tenureScore = 0;
  if (attrs.yearsOfEmployment >= 5) tenureScore = 0.1;
  else if (attrs.yearsOfEmployment >= 3) tenureScore = 0.07;
  else if (attrs.yearsOfEmployment >= 1) tenureScore = 0.04;

  // ===== 4. 自己資金比率ボーナス =====
  let ownFundsBonus = 0;
  if (askingPriceYen > 0) {
    const ratio = attrs.ownFundsYen / askingPriceYen;
    if (ratio >= 0.3) ownFundsBonus = 0.1;
    else if (ratio >= 0.2) ownFundsBonus = 0.07;
    else if (ratio >= 0.1) ownFundsBonus = 0.04;
  }

  const total = Math.min(1.0, incomeScore + employmentScore + tenureScore + ownFundsBonus);

  return {
    score: Math.round(total * 1000) / 1000,
    incomeScore,
    employmentScore,
    tenureScore,
    ownFundsBonus,
    note: `年収 ${(income / 10000).toFixed(0)} 万円 / ${employmentLabel(e)} / 勤続 ${attrs.yearsOfEmployment} 年`,
  };
}

export function employmentLabel(e: EmploymentType): string {
  switch (e) {
    case "salaryman":
      return "会社員（給与所得者）";
    case "executive":
      return "役員";
    case "soleProprietor":
      return "個人事業主";
    case "companyOwner":
      return "法人代表者";
    case "other":
      return "その他";
  }
}

/**
 * 借入人適合度を LTV 補正に変換する。
 *   score 1.0 → LTV そのまま
 *   score 0.5 → LTV ×0.75（半減ではなく緩やかに）
 * 公式: ltvFactor = 0.5 + 0.5 × score
 */
export function borrowerLtvAdjustment(score: number): number {
  return 0.5 + 0.5 * score;
}
