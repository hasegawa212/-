// 住宅ローン プロ仕様シミュレータ計算ロジック
import { LOAN_PRODUCTS, MISC_COST_RATE, type LoanProduct } from "./loanProducts";

export type RepaymentMethod = "annuity" | "equalPrincipal"; // 元利均等 / 元金均等
export type PropertyKind = "newCondo" | "usedHouse" | "investment";

export interface LoanSimulationInput {
  propertyPriceYen: number;
  ownFundsYen: number; // 頭金
  loanAmountYen: number; // 借入希望額（未指定なら propertyPrice - ownFunds）
  loanTermYears: number;
  borrowerAgeYears: number;
  annualIncomeYen: number;
  existingDebtMonthlyYen: number;
  repaymentMethod: RepaymentMethod;
  propertyKind: PropertyKind;
  // 繰上返済（任意）
  prepayment?: {
    amountYen: number; // 繰上額
    afterYears: number; // 何年後に実行するか
    mode: "shorten" | "reduce"; // 期間短縮 / 返済額軽減
  };
  // 変動金利の上昇シナリオ（任意）
  variableRateShockPercent?: number; // 例: 1.0 で +1%（5 年後から適用と仮定）
}

export interface LoanProductResult {
  productId: string;
  bankLabel: string;
  productLabel: string;
  effectiveRatePercent: number; // 団信込みの実効金利
  baseRatePercent: number;
  monthlyPaymentYen: number;
  totalPaymentYen: number;
  totalInterestYen: number;
  miscCostYen: number;
  totalCashOutYen: number; // 自己資金 + 諸費用 + 総返済 - 借入額
  // 審査
  screening: {
    pass: boolean;
    completionAge: number;
    completionAgePass: boolean;
    loanToIncomeRatio: number;
    loanToIncomePass: boolean;
    repaymentBurdenRatio: number;
    repaymentBurdenPass: boolean;
    reasons: string[];
  };
  // 内訳
  monthlyPaymentBreakdown?: {
    firstYear: number;
    lastYear: number;
  };
  prepaymentEffect?: {
    monthlySavingYen: number;
    totalSavingYen: number;
    shortenMonths: number;
  };
  shockScenario?: {
    monthlyAfterShockYen: number;
    additionalTotalYen: number;
  };
}

export interface LoanSimulationResult {
  resolvedLoanAmountYen: number;
  miscCostYen: number;
  products: LoanProductResult[];
  recommendation: {
    bestProductId: string;
    reason: string;
  };
}

function round(n: number): number {
  return Math.round(n);
}

// 元利均等 月返済額
function annuityMonthly(loan: number, annualRatePercent: number, termMonths: number): number {
  if (loan <= 0 || termMonths <= 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return loan / termMonths;
  return (loan * r) / (1 - Math.pow(1 + r, -termMonths));
}

// 元金均等 月初〜月末 平均（参考用）→ ここでは初回月返済額を返す
function equalPrincipalFirstMonth(loan: number, annualRatePercent: number, termMonths: number): number {
  if (loan <= 0 || termMonths <= 0) return 0;
  const principalPerMonth = loan / termMonths;
  const firstMonthInterest = (loan * annualRatePercent) / 12 / 100;
  return principalPerMonth + firstMonthInterest;
}

function equalPrincipalLastMonth(loan: number, annualRatePercent: number, termMonths: number): number {
  if (loan <= 0 || termMonths <= 0) return 0;
  const principalPerMonth = loan / termMonths;
  const lastMonthInterest = (principalPerMonth * annualRatePercent) / 12 / 100;
  return principalPerMonth + lastMonthInterest;
}

function equalPrincipalTotal(loan: number, annualRatePercent: number, termMonths: number): number {
  const r = annualRatePercent / 12 / 100;
  const principalPerMonth = loan / termMonths;
  // 利息合計 = 元金 × r × (n+1) / 2
  const totalInterest = principalPerMonth * r * ((termMonths * (termMonths + 1)) / 2);
  return loan + totalInterest;
}

function calcMiscCost(propertyPrice: number, kind: PropertyKind): number {
  const rate = MISC_COST_RATE[kind] ?? 0.06;
  return propertyPrice * rate;
}

function screenProduct(
  product: LoanProduct,
  loanAmount: number,
  monthlyPayment: number,
  borrowerAge: number,
  annualIncome: number,
  existingDebtMonthly: number,
  termYears: number
): LoanProductResult["screening"] {
  const completionAge = borrowerAge + termYears;
  const completionAgePass = completionAge <= product.maxCompletionAgeYears;

  const loanToIncomeRatio = annualIncome > 0 ? loanAmount / annualIncome : Infinity;
  const loanToIncomePass = loanToIncomeRatio <= product.maxLoanToIncomeRatio;

  const annualPayment = (monthlyPayment + existingDebtMonthly) * 12;
  const repaymentBurdenRatio = annualIncome > 0 ? annualPayment / annualIncome : Infinity;

  // フラット 35 は年収 400 万未満で 30% / 以上で 35%
  let burdenLimit = product.maxRepaymentBurdenRatio;
  if (product.id.startsWith("flat") && annualIncome < 4_000_000) {
    burdenLimit = 0.3;
  }
  const repaymentBurdenPass = repaymentBurdenRatio <= burdenLimit;

  const reasons: string[] = [];
  if (!completionAgePass) {
    reasons.push(`完済時年齢 ${completionAge} 歳が上限 ${product.maxCompletionAgeYears} 歳を超過`);
  }
  if (!loanToIncomePass) {
    reasons.push(
      `年収倍率 ${loanToIncomeRatio.toFixed(1)} 倍が上限 ${product.maxLoanToIncomeRatio} 倍を超過`
    );
  }
  if (!repaymentBurdenPass) {
    reasons.push(
      `返済比率 ${(repaymentBurdenRatio * 100).toFixed(1)}% が上限 ${(burdenLimit * 100).toFixed(0)}% を超過`
    );
  }

  return {
    pass: completionAgePass && loanToIncomePass && repaymentBurdenPass,
    completionAge,
    completionAgePass,
    loanToIncomeRatio: Math.round(loanToIncomeRatio * 10) / 10,
    loanToIncomePass,
    repaymentBurdenRatio: Math.round(repaymentBurdenRatio * 1000) / 1000,
    repaymentBurdenPass,
    reasons,
  };
}

function calcPrepaymentEffect(
  loan: number,
  effectiveRate: number,
  termMonths: number,
  monthlyPayment: number,
  totalPayment: number,
  prepayment: NonNullable<LoanSimulationInput["prepayment"]>
): NonNullable<LoanProductResult["prepaymentEffect"]> {
  const r = effectiveRate / 12 / 100;
  const elapsedMonths = prepayment.afterYears * 12;
  // 繰上時の残債を計算（元利均等前提）
  let remaining = loan;
  if (r > 0) {
    remaining = monthlyPayment * (1 - Math.pow(1 + r, -(termMonths - elapsedMonths))) / r;
  } else {
    remaining = loan - monthlyPayment * elapsedMonths;
  }
  remaining = Math.max(0, remaining - prepayment.amountYen);

  const remainingMonths = termMonths - elapsedMonths;

  if (prepayment.mode === "shorten") {
    // 期間短縮: 月返済額そのまま、期間が縮む
    if (remaining <= 0) {
      return {
        monthlySavingYen: 0,
        totalSavingYen: round(totalPayment - (monthlyPayment * elapsedMonths + prepayment.amountYen)),
        shortenMonths: remainingMonths,
      };
    }
    // 新しい返済期間を二分探索
    let lo = 1, hi = remainingMonths;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const required = annuityMonthly(remaining, effectiveRate, mid);
      if (required <= monthlyPayment) hi = mid;
      else lo = mid + 1;
    }
    const newRemainingMonths = lo;
    const shortenMonths = remainingMonths - newRemainingMonths;
    const newTotal =
      monthlyPayment * elapsedMonths + prepayment.amountYen + monthlyPayment * newRemainingMonths;
    return {
      monthlySavingYen: 0,
      totalSavingYen: round(totalPayment - newTotal),
      shortenMonths,
    };
  } else {
    // 返済額軽減: 期間そのまま、月返済額が下がる
    const newMonthly = annuityMonthly(remaining, effectiveRate, remainingMonths);
    const monthlySaving = monthlyPayment - newMonthly;
    const newTotal =
      monthlyPayment * elapsedMonths + prepayment.amountYen + newMonthly * remainingMonths;
    return {
      monthlySavingYen: round(monthlySaving),
      totalSavingYen: round(totalPayment - newTotal),
      shortenMonths: 0,
    };
  }
}

function calcShockScenario(
  loan: number,
  baseRate: number,
  shockPercent: number,
  termMonths: number,
  baselineMonthly: number,
  baselineTotal: number
): NonNullable<LoanProductResult["shockScenario"]> {
  // 5 年経過後に金利が上昇すると仮定
  const elapsedMonths = 60;
  const r = baseRate / 12 / 100;
  let remaining = loan;
  if (r > 0) {
    remaining = baselineMonthly * (1 - Math.pow(1 + r, -(termMonths - elapsedMonths))) / r;
  } else {
    remaining = loan - baselineMonthly * elapsedMonths;
  }
  const newRate = baseRate + shockPercent;
  const remainingMonths = termMonths - elapsedMonths;
  const newMonthly = annuityMonthly(remaining, newRate, remainingMonths);
  const newTotal = baselineMonthly * elapsedMonths + newMonthly * remainingMonths;
  return {
    monthlyAfterShockYen: round(newMonthly),
    additionalTotalYen: round(newTotal - baselineTotal),
  };
}

function simulateProduct(
  product: LoanProduct,
  input: LoanSimulationInput,
  loanAmount: number,
  miscCost: number
): LoanProductResult {
  const termYears = Math.min(input.loanTermYears, product.maxLoanTermYears);
  const termMonths = termYears * 12;

  const effectiveRate =
    product.baseRatePercent + (product.groupCreditInsuranceIncluded ? 0 : product.groupCreditInsuranceExtraPercent);

  let monthlyPayment: number;
  let totalPayment: number;
  let totalInterest: number;
  let monthlyBreakdown: LoanProductResult["monthlyPaymentBreakdown"] | undefined;

  if (input.repaymentMethod === "equalPrincipal") {
    const firstMonth = equalPrincipalFirstMonth(loanAmount, effectiveRate, termMonths);
    const lastMonth = equalPrincipalLastMonth(loanAmount, effectiveRate, termMonths);
    monthlyPayment = firstMonth; // 初回が最大なので審査基準として用いる
    totalPayment = equalPrincipalTotal(loanAmount, effectiveRate, termMonths);
    totalInterest = totalPayment - loanAmount;
    monthlyBreakdown = {
      firstYear: round(firstMonth),
      lastYear: round(lastMonth),
    };
  } else {
    monthlyPayment = annuityMonthly(loanAmount, effectiveRate, termMonths);
    totalPayment = monthlyPayment * termMonths;
    totalInterest = totalPayment - loanAmount;
  }

  const screening = screenProduct(
    product,
    loanAmount,
    monthlyPayment,
    input.borrowerAgeYears,
    input.annualIncomeYen,
    input.existingDebtMonthlyYen,
    termYears
  );

  // 総支出 = 自己資金 + 諸費用 + 総返済
  const totalCashOut = input.ownFundsYen + miscCost + totalPayment;

  const result: LoanProductResult = {
    productId: product.id,
    bankLabel: product.bankLabel,
    productLabel: product.productLabel,
    effectiveRatePercent: Math.round(effectiveRate * 1000) / 1000,
    baseRatePercent: product.baseRatePercent,
    monthlyPaymentYen: round(monthlyPayment),
    totalPaymentYen: round(totalPayment),
    totalInterestYen: round(totalInterest),
    miscCostYen: round(miscCost),
    totalCashOutYen: round(totalCashOut),
    screening,
    monthlyPaymentBreakdown: monthlyBreakdown,
  };

  if (input.prepayment && input.prepayment.amountYen > 0) {
    result.prepaymentEffect = calcPrepaymentEffect(
      loanAmount,
      effectiveRate,
      termMonths,
      monthlyPayment,
      totalPayment,
      input.prepayment
    );
  }

  if (
    input.variableRateShockPercent !== undefined &&
    input.variableRateShockPercent > 0 &&
    product.productType === "variable"
  ) {
    result.shockScenario = calcShockScenario(
      loanAmount,
      effectiveRate,
      input.variableRateShockPercent,
      termMonths,
      monthlyPayment,
      totalPayment
    );
  }

  return result;
}

export function simulateLoan(input: LoanSimulationInput): LoanSimulationResult {
  const loanAmount = Math.max(
    0,
    input.loanAmountYen > 0 ? input.loanAmountYen : input.propertyPriceYen - input.ownFundsYen
  );
  const miscCost = calcMiscCost(input.propertyPriceYen, input.propertyKind);

  const products = LOAN_PRODUCTS.map((p) => simulateProduct(p, input, loanAmount, miscCost));

  // 推奨: 審査通過 + 総返済額最少
  const passing = products.filter((p) => p.screening.pass);
  const ranked = (passing.length > 0 ? passing : products)
    .slice()
    .sort((a, b) => a.totalPaymentYen - b.totalPaymentYen);
  const best = ranked[0];

  return {
    resolvedLoanAmountYen: round(loanAmount),
    miscCostYen: round(miscCost),
    products,
    recommendation: {
      bestProductId: best.productId,
      reason:
        passing.length > 0
          ? `審査通過商品の中で総返済額が最少（${best.bankLabel} / ${best.productLabel}）`
          : `審査通過商品なし。属性緩和または借入額減を検討（最少返済は ${best.bankLabel}）`,
    },
  };
}
