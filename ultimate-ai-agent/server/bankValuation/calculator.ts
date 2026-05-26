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

export interface LandParcelDetail {
  frontageM: number; // 間口（道路に接する幅・m）。0 で補正なし
  depthM: number; // 奥行（m）。0 で補正なし
  kagechiPercent: number; // かげ地割合（%）。0 で整形地扱い
  roadFrontageType: RoadFrontageType; // 単一路線 / 角地 / 準角地 / 二方路
  accessWidthM: number; // 接道幅員（m）。0 で未指定
  roadWidthM: number; // 前面道路幅員（m）。0 で未指定
  floorAreaRatioPercent: number; // 容積率（%）。0 で消化率補正スキップ
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
  landDetail: LandParcelDetail; // 詳細補正用。すべて 0 で旧来挙動
}

export interface LandValuationBreakdown {
  rosenkaPerSqm: number;
  baseLandValueYen: number; // 路線価 × 面積
  depthPriceFactor: number;
  narrowFrontageFactor: number;
  depthRatioFactor: number;
  irregularShapeFactor: number;
  roadFrontageAddition: number;
  roadAccessFactor: number;
  roadAccessNote: string;
  combinedAdjustmentFactor: number; // 全補正の積
  adjustedLandValueYen: number; // 補正後土地評価額
  areaMultiplier: number; // エリアによる路線価→実勢補正
  finalLandValueYen: number; // adjustedLandValueYen × areaMultiplier
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
  // 実績校正
  rawEstimatedValuationYen: number; // 校正前
  rawEstimatedLoanYen: number; // 校正前
  calibrationApplied: boolean;
  calibrationMultiplier: number; // 適用された倍率（融資）
  calibrationSampleCount: number;
}

export interface ValuationResult {
  cost: {
    landValuationYen: number;
    landBreakdown: LandValuationBreakdown;
    buildingValuationYen: number;
    buildingFarUtilization: number; // 容積率消化率
    buildingFarFactor: number; // 消化率補正
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

function calcLandValuation(input: ValuationInput): LandValuationBreakdown {
  const area = AREA_PROFILES[input.areaTier];
  const baseLandValue = input.rosenkaPerSqm * input.landAreaSqm;

  const d = input.landDetail;

  // 各補正率
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

  // 路線価補正の積（加算は最後）
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

  let buildingValuation = 0;
  let remainingLifeYears = 0;
  let farUtilization = 1;
  let farFactor = 1;

  if (input.structure && input.buildingAreaSqm > 0) {
    const profile = STRUCTURE_PROFILES[input.structure];
    const replacementCost = profile.replacementCostPerSqm * input.buildingAreaSqm;
    remainingLifeYears = Math.max(
      0,
      profile.legalLifeYears - input.buildingAgeYears
    );
    const ageBased = replacementCost * (remainingLifeYears / profile.legalLifeYears);

    // 容積率消化率補正
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
  calibration: CalibrationHint | undefined
): BankResult {
  const incomeWeighted = incomeTotal > 0 ? incomeTotal : costTotal;
  const rawValuation =
    costTotal * bank.weightCost + incomeWeighted * bank.weightIncome;

  const feasible = remainingLife >= bank.minLegalLifeRemaining;
  const rawLoan = feasible ? rawValuation * bank.loanToValueRatio : 0;

  // 実績校正の適用（active 状態のみ）
  const calibActive = !!calibration?.active;
  const loanMult = calibActive ? calibration!.loanMultiplier : 1;
  const valMult = calibActive ? calibration!.valuationMultiplier : 1;

  const valuation = rawValuation * valMult;
  const loan = rawLoan * loanMult;
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
    rawEstimatedValuationYen: round(rawValuation),
    rawEstimatedLoanYen: round(rawLoan),
    calibrationApplied: calibActive,
    calibrationMultiplier: Math.round(loanMult * 1000) / 1000,
    calibrationSampleCount: calibration?.sampleCount ?? 0,
  };
}

export function calculateValuation(
  input: ValuationInput,
  calibrations?: Map<string, CalibrationHint>
): ValuationResult {
  const cost = calcCostApproach(input);
  const income = calcIncomeApproach(input);

  const banks = BANK_PROFILES.map((b) =>
    calcBank(
      b,
      cost.totalYen,
      income.valuationYen,
      cost.remainingLifeYears,
      input.askingPriceYen,
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
    },
  };
}
