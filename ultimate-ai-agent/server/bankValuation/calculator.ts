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
import {
  depthPriceFactor,
  narrowFrontageFactor,
  depthRatioFactor,
  irregularShapeFactor,
  roadFrontageAddition,
  roadAccessFactor,
  farUtilizationFactor,
  type RoadFrontageType,
} from "./rosenkaAdjustments";
import { buildingDepreciationFactor } from "./buildingDepreciation";
import {
  DEFAULT_CF_ASSUMPTIONS,
  calcIncomeBreakdown,
  monthlyMortgagePayment,
  calcDscr,
  dscrStatus,
  type CashFlowAssumptions,
  type IncomeBreakdown,
  type DscrStatus,
} from "./cashflow";
import {
  calcBorrowerFit,
  borrowerLtvAdjustment,
  DEFAULT_BORROWER,
  type BorrowerAttributes,
} from "./borrowerFit";

export interface LandParcelDetail {
  frontageM: number;
  depthM: number;
  kagechiPercent: number;
  roadFrontageType: RoadFrontageType;
  accessWidthM: number;
  roadWidthM: number;
  floorAreaRatioPercent: number;
}

export interface ValuationInput {
  propertyType: PropertyType;
  areaTier: AreaTier;
  landAreaSqm: number;
  buildingAreaSqm: number;
  rosenkaPerSqm: number;
  structure: StructureType | null;
  buildingAgeYears: number;
  annualRentIncome: number;
  askingPriceYen: number;
  landDetail: LandParcelDetail;
  cashFlow: CashFlowAssumptions;
  otherDebtMonthlyYen?: number;
  borrower: BorrowerAttributes;
}

export interface LandValuationBreakdown {
  rosenkaPerSqm: number;
  baseLandValueYen: number;
  depthPriceFactor: number;
  narrowFrontageFactor: number;
  depthRatioFactor: number;
  irregularShapeFactor: number;
  roadFrontageAddition: number;
  roadAccessFactor: number;
  roadAccessNote: string;
  combinedAdjustmentFactor: number;
  adjustedLandValueYen: number;
  areaMultiplier: number;
  finalLandValueYen: number;
}

export interface BankResult {
  bankId: string;
  label: string;
  category: BankProfile["category"];
  estimatedValuationYen: number;
  loanToValueRatio: number;
  estimatedLoanYen: number;
  ownFundsRequiredYen: number;
  feasible: boolean;
  judgement: "A" | "B" | "C";
  note: string;
  // 実績校正（PR #12）
  rawEstimatedValuationYen: number;
  rawEstimatedLoanYen: number;
  calibrationApplied: boolean;
  calibrationMultiplier: number;
  calibrationSampleCount: number;
  // CF（PR #15）
  monthlyPaymentYen: number;
  dscr: number;
  dscrStatus: DscrStatus;
  assumedInterestPercent: number;
  loanTermYears: number;
  // 借入人適合度（PR #14）
  borrowerFitScore: number;
  borrowerLtvFactor: number;
  baseLoanToValueRatio: number;
  borrowerNote: string;
}

export interface ValuationResult {
  cost: {
    landValuationYen: number;
    landBreakdown: LandValuationBreakdown;
    buildingValuationYen: number;
    buildingFarUtilization: number;
    buildingFarFactor: number;
    totalYen: number;
    remainingLifeYears: number;
    buildingReplacementCostBaseYen: number;
    buildingReplacementCostAdjustedYen: number;
    buildingBuildCostMultiplier: number;
    buildingDepreciationFactor: number;
    buildingResidualRatio: number;
    buildingLegalLifeYears: number;
  };
  income: IncomeBreakdown;
  banks: BankResult[];
  summary: {
    bestBankId: string;
    bestLoanYen: number;
    minOwnFundsYen: number;
    overallJudgement: "A" | "B" | "C";
    bestMonthlyPaymentYen: number;
    bestDscr: number;
  };
}

function round(yen: number): number {
  return Math.round(yen);
}

function calcLandValuation(input: ValuationInput): LandValuationBreakdown {
  const area = AREA_PROFILES[input.areaTier];
  const baseLandValue = input.rosenkaPerSqm * input.landAreaSqm;

  const d = input.landDetail;

  const fDepthPrice = d.depthM > 0 ? depthPriceFactor(d.depthM) : 1.0;
  const fNarrow = d.frontageM > 0 ? narrowFrontageFactor(d.frontageM) : 1.0;
  const fDepthRatio =
    d.depthM > 0 && d.frontageM > 0 ? depthRatioFactor(d.depthM, d.frontageM) : 1.0;
  const fIrregular = irregularShapeFactor(d.kagechiPercent);
  const addRoadFrontage = roadFrontageAddition(d.roadFrontageType);
  const access =
    d.accessWidthM > 0 || d.roadWidthM > 0
      ? roadAccessFactor({ accessWidthM: d.accessWidthM, roadWidthM: d.roadWidthM })
      : { factor: 1.0, note: "未指定" };

  const combined =
    fDepthPrice *
    fNarrow *
    fDepthRatio *
    fIrregular *
    access.factor *
    (1 + addRoadFrontage);

  const adjustedLandValue = baseLandValue * combined;
  const finalLandValue = adjustedLandValue * area.landValueMultiplier;

  return {
    rosenkaPerSqm: input.rosenkaPerSqm,
    baseLandValueYen: round(baseLandValue),
    depthPriceFactor: fDepthPrice,
    narrowFrontageFactor: fNarrow,
    depthRatioFactor: fDepthRatio,
    irregularShapeFactor: fIrregular,
    roadFrontageAddition: addRoadFrontage,
    roadAccessFactor: access.factor,
    roadAccessNote: access.note,
    combinedAdjustmentFactor: Math.round(combined * 10000) / 10000,
    adjustedLandValueYen: round(adjustedLandValue),
    areaMultiplier: area.landValueMultiplier,
    finalLandValueYen: round(finalLandValue),
  };
}

function calcCostApproach(input: ValuationInput) {
  const landBreakdown = calcLandValuation(input);
  const landValuation = landBreakdown.finalLandValueYen;
  const area = AREA_PROFILES[input.areaTier];

  let buildingValuation = 0;
  let remainingLifeYears = 0;
  let farUtilization = 1;
  let farFactor = 1;
  let replacementCostBase = 0;
  let replacementCostAdjusted = 0;
  let depreciationFactor = 1;
  let residualRatio = 0;
  let buildCostMultiplier = area.buildCostMultiplier;
  let legalLifeYears = 0;

  if (input.structure && input.buildingAreaSqm > 0) {
    const profile = STRUCTURE_PROFILES[input.structure];
    legalLifeYears = profile.legalLifeYears;
    residualRatio = profile.residualRatio;

    replacementCostBase = profile.replacementCostPerSqm * input.buildingAreaSqm;
    replacementCostAdjusted = replacementCostBase * area.buildCostMultiplier;

    remainingLifeYears = Math.max(0, profile.legalLifeYears - input.buildingAgeYears);

    depreciationFactor = buildingDepreciationFactor(
      input.buildingAgeYears,
      profile.legalLifeYears,
      profile.residualRatio
    );
    const ageBased = replacementCostAdjusted * depreciationFactor;

    if (input.landDetail.floorAreaRatioPercent > 0 && input.landAreaSqm > 0) {
      const u = farUtilizationFactor(
        input.buildingAreaSqm,
        input.landAreaSqm,
        input.landDetail.floorAreaRatioPercent
      );
      farUtilization = Math.round(u.utilization * 1000) / 1000;
      farFactor = u.factor;
      buildingValuation = ageBased * u.factor;
    } else {
      buildingValuation = ageBased;
    }
  }

  return {
    landValuationYen: landValuation,
    landBreakdown,
    buildingValuationYen: round(buildingValuation),
    buildingFarUtilization: farUtilization,
    buildingFarFactor: farFactor,
    totalYen: round(landValuation + buildingValuation),
    remainingLifeYears,
    buildingReplacementCostBaseYen: round(replacementCostBase),
    buildingReplacementCostAdjustedYen: round(replacementCostAdjusted),
    buildingBuildCostMultiplier: buildCostMultiplier,
    buildingDepreciationFactor: Math.round(depreciationFactor * 10000) / 10000,
    buildingResidualRatio: residualRatio,
    buildingLegalLifeYears: legalLifeYears,
  };
}

function calcIncomeApproach(input: ValuationInput): IncomeBreakdown {
  const propProfile = PROPERTY_PROFILES[input.propertyType];
  const area = AREA_PROFILES[input.areaTier];
  const adjustedCapRate = propProfile.defaultCapRate + area.capRateAdjustment;
  const cf = input.cashFlow ?? DEFAULT_CF_ASSUMPTIONS;

  return calcIncomeBreakdown(
    input.annualRentIncome,
    cf,
    adjustedCapRate,
    propProfile.appliesIncomeApproach
  );
}

function judge(askingPrice: number, loanAmount: number): "A" | "B" | "C" {
  if (askingPrice <= 0) return "C";
  const coverage = loanAmount / askingPrice;
  if (coverage >= 1.0) return "A";
  if (coverage >= 0.85) return "B";
  return "C";
}

export interface CalibrationHint {
  bankId: string;
  loanMultiplier: number;
  valuationMultiplier: number;
  sampleCount: number;
  active: boolean;
}

function calcBank(
  bank: BankProfile,
  costTotal: number,
  incomeTotal: number,
  remainingLife: number,
  askingPrice: number,
  noiYen: number,
  cf: CashFlowAssumptions,
  otherDebtMonthlyYen: number,
  borrower: BorrowerAttributes,
  calibration: CalibrationHint | undefined
): BankResult {
  const incomeWeighted = incomeTotal > 0 ? incomeTotal : costTotal;
  const rawValuation =
    costTotal * bank.weightCost + incomeWeighted * bank.weightIncome;

  // 借入人適合度
  const fit = calcBorrowerFit(bank, borrower, askingPrice);
  const borrowerFactor = borrowerLtvAdjustment(fit.score);
  const ltvAfterBorrower = bank.loanToValueRatio * borrowerFactor;

  const feasible = remainingLife >= bank.minLegalLifeRemaining;
  const rawLoan = feasible ? rawValuation * ltvAfterBorrower : 0;

  // 実績校正
  const calibActive = !!calibration?.active;
  const loanMult = calibActive ? calibration!.loanMultiplier : 1;
  const valMult = calibActive ? calibration!.valuationMultiplier : 1;

  const valuation = rawValuation * valMult;
  const loan = rawLoan * loanMult;
  const ownFunds = Math.max(0, askingPrice - loan);

  // CF
  const monthlyPayment = monthlyMortgagePayment(
    loan,
    cf.assumedInterestPercent,
    cf.loanTermYears
  );
  const dscr = noiYen > 0 ? calcDscr(noiYen, monthlyPayment, otherDebtMonthlyYen) : 0;

  return {
    bankId: bank.id,
    label: bank.label,
    category: bank.category,
    estimatedValuationYen: round(valuation),
    loanToValueRatio: Math.round(ltvAfterBorrower * 1000) / 1000,
    estimatedLoanYen: round(loan),
    ownFundsRequiredYen: round(ownFunds),
    feasible,
    judgement: feasible ? judge(askingPrice, loan) : "C",
    note: bank.note,
    rawEstimatedValuationYen: round(rawValuation),
    rawEstimatedLoanYen: round(rawLoan),
    calibrationApplied: calibActive,
    calibrationMultiplier: Math.round(loanMult * 1000) / 1000,
    calibrationSampleCount: calibration?.sampleCount ?? 0,
    monthlyPaymentYen: round(monthlyPayment),
    dscr: Math.round(dscr * 100) / 100,
    dscrStatus: dscrStatus(dscr),
    assumedInterestPercent: cf.assumedInterestPercent,
    loanTermYears: cf.loanTermYears,
    borrowerFitScore: fit.score,
    borrowerLtvFactor: Math.round(borrowerFactor * 1000) / 1000,
    baseLoanToValueRatio: bank.loanToValueRatio,
    borrowerNote: fit.note,
  };
}

export function calculateValuation(
  input: ValuationInput,
  calibrations?: Map<string, CalibrationHint>
): ValuationResult {
  const cost = calcCostApproach(input);
  const income = calcIncomeApproach(input);
  const cf = input.cashFlow ?? DEFAULT_CF_ASSUMPTIONS;
  const borrower = input.borrower ?? DEFAULT_BORROWER;
  // 他借入は borrower 優先、未指定なら top-level
  const otherDebtMonthly =
    borrower.otherDebtMonthlyYen > 0
      ? borrower.otherDebtMonthlyYen
      : (input.otherDebtMonthlyYen ?? 0);

  const banks = BANK_PROFILES.map((b) =>
    calcBank(
      b,
      cost.totalYen,
      income.valuationYen,
      cost.remainingLifeYears,
      input.askingPriceYen,
      income.noiYen,
      cf,
      otherDebtMonthly,
      borrower,
      calibrations?.get(b.id)
    )
  );

  const feasibleBanks = banks.filter((b) => b.feasible);
  const ranked = (feasibleBanks.length > 0 ? feasibleBanks : banks)
    .slice()
    .sort((a, b) => b.estimatedLoanYen - a.estimatedLoanYen);
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
      bestMonthlyPaymentYen: best.monthlyPaymentYen,
      bestDscr: best.dscr,
    },
  };
}
