import {
  STRUCTURE_PROFILES,
  PROPERTY_PROFILES,
  AREA_PROFILES,
  BANK_PROFILES,
  type StructureType,
  type PropertyType,
  type AreaTier,
  type BankProfile,
} from "./constants";

export interface ValuationInput {
  propertyType: PropertyType;
  areaTier: AreaTier;
  landAreaSqm: number; // 土地面積（㎡）
  buildingAreaSqm: number; // 延床面積（㎡）。土地のみの場合は 0
  rosenkaPerSqm: number; // 路線価（円/㎡）。未取得時は公示価格 × 0.8 等で代用
  structure: StructureType | null; // 土地のみは null
  buildingAgeYears: number; // 築年数。土地のみは 0
  annualRentIncome: number; // 想定年間家賃収入（円）。0 なら収益評価をスキップ
  askingPriceYen: number; // 売出し価格（円）
}

export interface BankResult {
  bankId: string;
  label: string;
  category: BankProfile["category"];
  estimatedValuationYen: number; // 銀行評価額（積算 × weightCost + 収益 × weightIncome）
  loanToValueRatio: number;
  estimatedLoanYen: number; // 融資想定額
  ownFundsRequiredYen: number; // 自己資金（売出価格 − 融資想定）
  feasible: boolean; // 耐用年数残などで融資可能か
  judgement: "A" | "B" | "C"; // A: フルローン余地 / B: ほぼフィット / C: 厳しい
  note: string;
}

export interface ValuationResult {
  cost: {
    landValuationYen: number;
    buildingValuationYen: number;
    totalYen: number;
    remainingLifeYears: number;
  };
  income: {
    capRatePercent: number;
    valuationYen: number;
    applies: boolean;
  };
  banks: BankResult[];
  summary: {
    bestBankId: string;
    bestLoanYen: number;
    minOwnFundsYen: number;
    overallJudgement: "A" | "B" | "C";
  };
}

function round(yen: number): number {
  return Math.round(yen);
}

function calcCostApproach(input: ValuationInput) {
  const area = AREA_PROFILES[input.areaTier];

  const landValuation =
    input.rosenkaPerSqm * input.landAreaSqm * area.landValueMultiplier;

  let buildingValuation = 0;
  let remainingLifeYears = 0;

  if (input.structure && input.buildingAreaSqm > 0) {
    const profile = STRUCTURE_PROFILES[input.structure];
    const replacementCost = profile.replacementCostPerSqm * input.buildingAreaSqm;
    remainingLifeYears = Math.max(
      0,
      profile.legalLifeYears - input.buildingAgeYears
    );
    buildingValuation =
      replacementCost * (remainingLifeYears / profile.legalLifeYears);
  }

  return {
    landValuationYen: round(landValuation),
    buildingValuationYen: round(buildingValuation),
    totalYen: round(landValuation + buildingValuation),
    remainingLifeYears,
  };
}

function calcIncomeApproach(input: ValuationInput) {
  const propProfile = PROPERTY_PROFILES[input.propertyType];
  const area = AREA_PROFILES[input.areaTier];
  const adjustedCapRate = propProfile.defaultCapRate + area.capRateAdjustment;

  if (!propProfile.appliesIncomeApproach || input.annualRentIncome <= 0 || adjustedCapRate <= 0) {
    return {
      capRatePercent: adjustedCapRate,
      valuationYen: 0,
      applies: false,
    };
  }

  const valuation = input.annualRentIncome / (adjustedCapRate / 100);
  return {
    capRatePercent: Math.round(adjustedCapRate * 10) / 10,
    valuationYen: round(valuation),
    applies: true,
  };
}

function judge(
  askingPrice: number,
  loanAmount: number
): "A" | "B" | "C" {
  if (askingPrice <= 0) return "C";
  const coverage = loanAmount / askingPrice;
  if (coverage >= 1.0) return "A";
  if (coverage >= 0.85) return "B";
  return "C";
}

function calcBank(
  bank: BankProfile,
  costTotal: number,
  incomeTotal: number,
  remainingLife: number,
  askingPrice: number
): BankResult {
  const incomeWeighted = incomeTotal > 0 ? incomeTotal : costTotal;
  const valuation =
    costTotal * bank.weightCost + incomeWeighted * bank.weightIncome;

  const feasible = remainingLife >= bank.minLegalLifeRemaining;
  const loan = feasible ? valuation * bank.loanToValueRatio : 0;
  const ownFunds = Math.max(0, askingPrice - loan);

  return {
    bankId: bank.id,
    label: bank.label,
    category: bank.category,
    estimatedValuationYen: round(valuation),
    loanToValueRatio: bank.loanToValueRatio,
    estimatedLoanYen: round(loan),
    ownFundsRequiredYen: round(ownFunds),
    feasible,
    judgement: feasible ? judge(askingPrice, loan) : "C",
    note: bank.note,
  };
}

export function calculateValuation(input: ValuationInput): ValuationResult {
  const cost = calcCostApproach(input);
  const income = calcIncomeApproach(input);

  const banks = BANK_PROFILES.map((b) =>
    calcBank(b, cost.totalYen, income.valuationYen, cost.remainingLifeYears, input.askingPriceYen)
  );

  const feasibleBanks = banks.filter((b) => b.feasible);
  const ranked = (feasibleBanks.length > 0 ? feasibleBanks : banks).slice().sort(
    (a, b) => b.estimatedLoanYen - a.estimatedLoanYen
  );
  const best = ranked[0];

  const overallJudgement: "A" | "B" | "C" =
    banks.some((b) => b.judgement === "A")
      ? "A"
      : banks.some((b) => b.judgement === "B")
      ? "B"
      : "C";

  return {
    cost,
    income,
    banks,
    summary: {
      bestBankId: best.bankId,
      bestLoanYen: best.estimatedLoanYen,
      minOwnFundsYen: best.ownFundsRequiredYen,
      overallJudgement,
    },
  };
}
