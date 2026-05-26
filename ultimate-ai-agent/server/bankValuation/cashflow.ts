// 収益還元・キャッシュフロー精緻化（PR #15）
//
// 旧モデル: グロス家賃 / 利回り = 評価額
// 新モデル: NOI / 利回り = 評価額
//   NOI = 実効家賃 × (1 - 運営費率)
//   実効家賃 = グロス家賃 × (1 - 空室率)
//
// さらに、銀行別に以下を算出:
//   月返済額（元利均等）
//   DSCR = (NOI / 12) / 月返済額

export interface CashFlowAssumptions {
  vacancyPercent: number; // 空室率（%）
  opexRatePercent: number; // 運営費率（家賃に対する %）
  assumedInterestPercent: number; // 想定金利（%）
  loanTermYears: number; // 返済期間（年）
}

export const DEFAULT_CF_ASSUMPTIONS: CashFlowAssumptions = {
  vacancyPercent: 10,
  opexRatePercent: 20,
  assumedInterestPercent: 2.5,
  loanTermYears: 25,
};

export interface IncomeBreakdown {
  grossIncomeYen: number;
  vacancyLossYen: number;
  effectiveIncomeYen: number;
  opexYen: number;
  noiYen: number;
  capRatePercent: number;
  valuationYen: number;
  applies: boolean;
}

export function calcIncomeBreakdown(
  grossAnnualRent: number,
  assumptions: CashFlowAssumptions,
  capRatePercent: number,
  appliesIncomeApproach: boolean
): IncomeBreakdown {
  const vacancyLoss = grossAnnualRent * (assumptions.vacancyPercent / 100);
  const effective = grossAnnualRent - vacancyLoss;
  const opex = effective * (assumptions.opexRatePercent / 100);
  const noi = Math.max(0, effective - opex);

  if (!appliesIncomeApproach || grossAnnualRent <= 0 || capRatePercent <= 0) {
    return {
      grossIncomeYen: Math.round(grossAnnualRent),
      vacancyLossYen: Math.round(vacancyLoss),
      effectiveIncomeYen: Math.round(effective),
      opexYen: Math.round(opex),
      noiYen: Math.round(noi),
      capRatePercent: Math.round(capRatePercent * 10) / 10,
      valuationYen: 0,
      applies: false,
    };
  }

  const valuation = noi / (capRatePercent / 100);

  return {
    grossIncomeYen: Math.round(grossAnnualRent),
    vacancyLossYen: Math.round(vacancyLoss),
    effectiveIncomeYen: Math.round(effective),
    opexYen: Math.round(opex),
    noiYen: Math.round(noi),
    capRatePercent: Math.round(capRatePercent * 10) / 10,
    valuationYen: Math.round(valuation),
    applies: true,
  };
}

/**
 * 元利均等返済の月返済額
 * P = (loan × r) / (1 - (1 + r)^-n)
 *   r: 月利
 *   n: 総返済回数
 */
export function monthlyMortgagePayment(
  loanYen: number,
  annualInterestPercent: number,
  termYears: number
): number {
  if (loanYen <= 0 || termYears <= 0) return 0;
  const r = annualInterestPercent / 12 / 100;
  const n = termYears * 12;
  if (r === 0) return loanYen / n;
  return (loanYen * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * DSCR = (NOI / 12) / 月返済額
 * 1.2 が銀行審査の最低ライン、1.5 以上が安全圏。
 */
export function calcDscr(noiYen: number, monthlyPaymentYen: number, otherDebtMonthlyYen: number): number {
  const totalDebt = monthlyPaymentYen + otherDebtMonthlyYen;
  if (totalDebt <= 0) return 0;
  return (noiYen / 12) / totalDebt;
}

export type DscrStatus = "healthy" | "caution" | "risky";

export function dscrStatus(dscr: number): DscrStatus {
  if (dscr >= 1.5) return "healthy";
  if (dscr >= 1.2) return "caution";
  return "risky";
}
