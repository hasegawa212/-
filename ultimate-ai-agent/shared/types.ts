import { z } from "zod";

// Message roles
export const MessageRole = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

// Message schema
export const MessageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  role: MessageRole,
  content: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// Conversation schema
export const ConversationSchema = z.object({
  id: z.number(),
  title: z.string(),
  agentId: z.string().nullable(),
  model: z.string(),
  systemPrompt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Agent definition
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  model: z.string().default("gpt-4o-mini"),
  tools: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4096),
  isActive: z.boolean().default(true),
});
export type Agent = z.infer<typeof AgentSchema>;

// Chat request
export const ChatRequestSchema = z.object({
  conversationId: z.number().optional(),
  message: z.string().min(1),
  agentId: z.string().optional(),
  model: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Chat response
export const ChatResponseSchema = z.object({
  conversationId: z.number(),
  message: MessageSchema,
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// RAG Document
export const RAGDocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  source: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export type RAGDocument = z.infer<typeof RAGDocumentSchema>;

// Workflow
export const WorkflowSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      config: z.record(z.unknown()),
    })
  ),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// ===== 銀行評価額シミュレーター =====

export const StructureTypeSchema = z.enum([
  "wood",
  "steelLight",   // 軽量鉄骨 3mm 以下（PR #13 で追加）
  "lightSteel",   // 軽量鉄骨 3〜4mm（旧キー互換）
  "heavySteel",
  "rc",
  "src",
]);
export type StructureType = z.infer<typeof StructureTypeSchema>;

export const PropertyTypeSchema = z.enum([
  "apartmentUnit",
  "wholeApartment",
  "wholeMansion",
  "detachedHouse",
  "landOnly",
]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const AreaTierSchema = z.enum(["tokyo23", "majorCity", "suburb", "rural"]);
export type AreaTier = z.infer<typeof AreaTierSchema>;

export const RoadFrontageTypeSchema = z.enum([
  "single",
  "corner",
  "semiCorner",
  "twoSides",
]);
export type RoadFrontageType = z.infer<typeof RoadFrontageTypeSchema>;

export const LandParcelDetailSchema = z.object({
  frontageM: z.number().min(0).default(0),
  depthM: z.number().min(0).default(0),
  kagechiPercent: z.number().min(0).max(100).default(0),
  roadFrontageType: RoadFrontageTypeSchema.default("single"),
  accessWidthM: z.number().min(0).default(0),
  roadWidthM: z.number().min(0).default(0),
  floorAreaRatioPercent: z.number().min(0).max(1300).default(0),
});
export type LandParcelDetail = z.infer<typeof LandParcelDetailSchema>;

// ★ PR #15 キャッシュフロー
export const CashFlowAssumptionsSchema = z.object({
  vacancyPercent: z.number().min(0).max(100).default(10),
  opexRatePercent: z.number().min(0).max(100).default(20),
  assumedInterestPercent: z.number().min(0).max(20).default(2.5),
  loanTermYears: z.number().min(1).max(50).default(25),
});
export type CashFlowAssumptions = z.infer<typeof CashFlowAssumptionsSchema>;

export const DEFAULT_CF_ASSUMPTIONS: CashFlowAssumptions = {
  vacancyPercent: 10,
  opexRatePercent: 20,
  assumedInterestPercent: 2.5,
  loanTermYears: 25,
};

// ★ PR #14 借入人属性
export const EmploymentTypeSchema = z.enum([
  "salaryman",
  "executive",
  "soleProprietor",
  "companyOwner",
  "other",
]);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const BorrowerAttributesSchema = z.object({
  annualIncomeYen: z.number().min(0).default(0),
  employmentType: EmploymentTypeSchema.default("salaryman"),
  yearsOfEmployment: z.number().min(0).default(0),
  ownFundsYen: z.number().min(0).default(0),
  otherDebtMonthlyYen: z.number().min(0).default(0),
});
export type BorrowerAttributes = z.infer<typeof BorrowerAttributesSchema>;

export const DEFAULT_BORROWER_ATTRIBUTES: BorrowerAttributes = {
  annualIncomeYen: 0,
  employmentType: "salaryman",
  yearsOfEmployment: 0,
  ownFundsYen: 0,
  otherDebtMonthlyYen: 0,
};

export const ValuationInputSchema = z.object({
  propertyType: PropertyTypeSchema,
  areaTier: AreaTierSchema,
  landAreaSqm: z.number().min(0),
  buildingAreaSqm: z.number().min(0),
  rosenkaPerSqm: z.number().min(0),
  structure: StructureTypeSchema.nullable(),
  buildingAgeYears: z.number().min(0).max(120),
  annualRentIncome: z.number().min(0).default(0),
  askingPriceYen: z.number().min(0),
  landDetail: LandParcelDetailSchema.default({
    frontageM: 0,
    depthM: 0,
    kagechiPercent: 0,
    roadFrontageType: "single",
    accessWidthM: 0,
    roadWidthM: 0,
    floorAreaRatioPercent: 0,
  }),
  cashFlow: CashFlowAssumptionsSchema.default(DEFAULT_CF_ASSUMPTIONS),
  otherDebtMonthlyYen: z.number().min(0).default(0),
  borrower: BorrowerAttributesSchema.default(DEFAULT_BORROWER_ATTRIBUTES),
});
export type ValuationInput = z.infer<typeof ValuationInputSchema>;

export const DscrStatusSchema = z.enum(["healthy", "caution", "risky"]);
export type DscrStatus = z.infer<typeof DscrStatusSchema>;

export const BankResultSchema = z.object({
  bankId: z.string(),
  label: z.string(),
  category: z.enum(["megabank", "regional", "shinkin", "nonbank"]),
  estimatedValuationYen: z.number(),
  loanToValueRatio: z.number(),
  estimatedLoanYen: z.number(),
  ownFundsRequiredYen: z.number(),
  feasible: z.boolean(),
  judgement: z.enum(["A", "B", "C"]),
  note: z.string(),
  // 実績校正（PR #12 で追加）
  rawEstimatedValuationYen: z.number().default(0),
  rawEstimatedLoanYen: z.number().default(0),
  calibrationApplied: z.boolean().default(false),
  calibrationMultiplier: z.number().default(1),
  calibrationSampleCount: z.number().default(0),
  // ★ PR #15 キャッシュフロー
  monthlyPaymentYen: z.number().default(0),
  dscr: z.number().default(0),
  dscrStatus: DscrStatusSchema.default("risky"),
  assumedInterestPercent: z.number().default(2.5),
  loanTermYears: z.number().default(25),
  // ★ PR #14 借入人適合度
  borrowerFitScore: z.number().default(1),
  borrowerLtvFactor: z.number().default(1),
  baseLoanToValueRatio: z.number().default(0),
  borrowerNote: z.string().default(""),
});
export type BankResult = z.infer<typeof BankResultSchema>;

export const CalibrationSnapshotSchema = z.object({
  bankId: z.string(),
  sampleCount: z.number(),
  loanMultiplier: z.number(),
  valuationMultiplier: z.number(),
  effectiveLtv: z.number(),
  meanActualValuationYen: z.number(),
  meanActualLoanYen: z.number(),
  meanPredictedValuationYen: z.number(),
  meanPredictedLoanYen: z.number(),
  computedAt: z.string(),
  active: z.boolean(),
});
export type CalibrationSnapshot = z.infer<typeof CalibrationSnapshotSchema>;

export const IncomeBreakdownSchema = z.object({
  grossIncomeYen: z.number().default(0),
  vacancyLossYen: z.number().default(0),
  effectiveIncomeYen: z.number().default(0),
  opexYen: z.number().default(0),
  noiYen: z.number().default(0),
  capRatePercent: z.number(),
  valuationYen: z.number(),
  applies: z.boolean(),
});
export type IncomeBreakdown = z.infer<typeof IncomeBreakdownSchema>;

export const LandValuationBreakdownSchema = z.object({
  rosenkaPerSqm: z.number(),
  baseLandValueYen: z.number(),
  depthPriceFactor: z.number(),
  narrowFrontageFactor: z.number(),
  depthRatioFactor: z.number(),
  irregularShapeFactor: z.number(),
  roadFrontageAddition: z.number(),
  roadAccessFactor: z.number(),
  roadAccessNote: z.string(),
  combinedAdjustmentFactor: z.number(),
  adjustedLandValueYen: z.number(),
  areaMultiplier: z.number(),
  finalLandValueYen: z.number(),
});
export type LandValuationBreakdown = z.infer<typeof LandValuationBreakdownSchema>;

export const ValuationResultSchema = z.object({
  cost: z.object({
    landValuationYen: z.number(),
    landBreakdown: LandValuationBreakdownSchema,
    buildingValuationYen: z.number(),
    buildingFarUtilization: z.number(),
    buildingFarFactor: z.number(),
    totalYen: z.number(),
    remainingLifeYears: z.number(),
    // ★ PR #13 で追加: 建物評価の内訳
    buildingReplacementCostBaseYen: z.number().default(0),
    buildingReplacementCostAdjustedYen: z.number().default(0),
    buildingBuildCostMultiplier: z.number().default(1),
    buildingDepreciationFactor: z.number().default(1),
    buildingResidualRatio: z.number().default(0.1),
    buildingLegalLifeYears: z.number().default(0),
  }),
  income: IncomeBreakdownSchema, // ★ PR #15 で詳細化
  banks: z.array(BankResultSchema),
  summary: z.object({
    bestBankId: z.string(),
    bestLoanYen: z.number(),
    minOwnFundsYen: z.number(),
    overallJudgement: z.enum(["A", "B", "C"]),
    bestMonthlyPaymentYen: z.number().default(0),
    bestDscr: z.number().default(0),
  }),
});
export type ValuationResult = z.infer<typeof ValuationResultSchema>;

// ===== 案件保存・実績記録 =====

export const DealStatusSchema = z.enum(["pending", "approved", "rejected", "closed"]);
export type DealStatus = z.infer<typeof DealStatusSchema>;

export const DealSchema = z.object({
  id: z.number(),
  dealCode: z.string(),
  title: z.string(),
  input: ValuationInputSchema,
  result: ValuationResultSchema,
  actualBankId: z.string().nullable(),
  actualBankName: z.string().nullable(),
  actualValuationYen: z.number().nullable(),
  actualLoanYen: z.number().nullable(),
  actualInterestRatePercent: z.number().nullable(), // 表示用は %、DB は ×100 で保管
  dealStatus: DealStatusSchema,
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Deal = z.infer<typeof DealSchema>;

export const CreateDealSchema = z.object({
  dealCode: z.string().min(1).optional(), // 未指定なら自動採番
  title: z.string().min(1),
  input: ValuationInputSchema,
  result: ValuationResultSchema,
  note: z.string().default(""),
});
export type CreateDealInput = z.infer<typeof CreateDealSchema>;

export const RecordActualSchema = z.object({
  id: z.number(),
  actualBankId: z.string().nullable().optional(),
  actualBankName: z.string().nullable().optional(),
  actualValuationYen: z.number().nullable().optional(),
  actualLoanYen: z.number().nullable().optional(),
  actualInterestRatePercent: z.number().nullable().optional(),
  dealStatus: DealStatusSchema.optional(),
  note: z.string().optional(),
});
export type RecordActualInput = z.infer<typeof RecordActualSchema>;

// ===== 住宅ローンシミュレーター（実銀行データ + 否決パターン学習） =====

export const PropertyKindSchema = z.enum(["newCondo", "usedHouse", "investment"]);
export type PropertyKind = z.infer<typeof PropertyKindSchema>;

export const RepaymentMethodSchema = z.enum(["annuity", "equalPrincipal"]);
export type RepaymentMethod = z.infer<typeof RepaymentMethodSchema>;

export const LoanBorrowerProfileSchema = z.object({
  ageYears: z.number().min(18).max(80).default(40),
  annualIncomeYen: z.number().min(0).default(5_000_000),
  employmentType: z
    .enum(["salaryman", "executive", "soleProprietor", "companyOwner", "other"])
    .default("salaryman"),
  yearsOfEmployment: z.number().min(0).default(5),
  existingDebtMonthlyYen: z.number().min(0).default(0),
  isSingle: z.boolean().default(false),
  hasInsuranceConcern: z.boolean().default(false), // 団信告知事項
  hasCreditConcern: z.boolean().default(false), // 個信記録
});
export type LoanBorrowerProfile = z.infer<typeof LoanBorrowerProfileSchema>;

export const LoanPropertyInfoSchema = z.object({
  priceYen: z.number().min(0).default(40_000_000),
  kind: PropertyKindSchema.default("usedHouse"),
  ageYears: z.number().min(0).default(15),
  prefecture: z.string().default(""), // 任意の都道府県名（"茨城県" 等）
  hasRoadAccessIssue: z.boolean().default(false), // 接道義務違反
});
export type LoanPropertyInfo = z.infer<typeof LoanPropertyInfoSchema>;

export const LoanSimulationInputSchema = z.object({
  property: LoanPropertyInfoSchema.default({
    priceYen: 40_000_000,
    kind: "usedHouse",
    ageYears: 15,
    prefecture: "",
    hasRoadAccessIssue: false,
  }),
  ownFundsYen: z.number().min(0).default(2_000_000),
  loanAmountYen: z.number().min(0).default(0), // 0 で property.priceYen - ownFundsYen を使用
  loanTermYears: z.number().min(1).max(50).default(35),
  repaymentMethod: RepaymentMethodSchema.default("annuity"),
  borrower: LoanBorrowerProfileSchema.default({
    ageYears: 40,
    annualIncomeYen: 5_000_000,
    employmentType: "salaryman",
    yearsOfEmployment: 5,
    existingDebtMonthlyYen: 0,
    isSingle: false,
    hasInsuranceConcern: false,
    hasCreditConcern: false,
  }),
  prepaymentAmountYen: z.number().min(0).default(0),
  prepaymentAfterYears: z.number().min(0).default(10),
  prepaymentMode: z.enum(["shorten", "reduce"]).default("shorten"),
  variableRateShockPercent: z.number().min(0).max(10).default(0),
});
export type LoanSimulationInput = z.infer<typeof LoanSimulationInputSchema>;

export const LoanScreeningSchema = z.object({
  pass: z.boolean(),
  completionAge: z.number(),
  completionAgePass: z.boolean(),
  loanToIncomeRatio: z.number(),
  loanToIncomePass: z.boolean(),
  repaymentBurdenRatio: z.number(),
  repaymentBurdenPass: z.boolean(),
  reasons: z.array(z.string()),
});

export const LoanProductResultSchema = z.object({
  productId: z.string(),
  bankLabel: z.string(),
  productLabel: z.string(),
  effectiveRatePercent: z.number(),
  baseRatePercent: z.number(),
  monthlyPaymentYen: z.number(),
  totalPaymentYen: z.number(),
  totalInterestYen: z.number(),
  miscCostYen: z.number(),
  totalCashOutYen: z.number(),
  screening: LoanScreeningSchema,
  monthlyPaymentBreakdown: z
    .object({ firstYear: z.number(), lastYear: z.number() })
    .optional(),
  prepaymentEffect: z
    .object({
      monthlySavingYen: z.number(),
      totalSavingYen: z.number(),
      shortenMonths: z.number(),
    })
    .optional(),
  shockScenario: z
    .object({ monthlyAfterShockYen: z.number(), additionalTotalYen: z.number() })
    .optional(),
});
export type LoanProductResult = z.infer<typeof LoanProductResultSchema>;

export const BankFitScoreSchema = z.object({
  bankId: z.string(),
  bankName: z.string(),
  category: z.string(),
  score: z.number(),
  matchReasons: z.array(z.string()),
  warnings: z.array(z.string()),
  preliminaryReviewDays: z.object({ min: z.number(), max: z.number() }),
  fullReviewDays: z.object({ min: z.number(), max: z.number() }),
  reviewRatePercent: z.object({ min: z.number(), max: z.number() }),
  strengths: z.array(z.string()),
  notes: z.array(z.string()),
});
export type BankFitScoreData = z.infer<typeof BankFitScoreSchema>;

export const RejectionRiskAlertSchema = z.object({
  riskLevel: z.enum(["high", "medium", "low"]),
  category: z.string(),
  message: z.string(),
  similarCaseIds: z.array(z.string()),
  recommendedAction: z.string(),
});
export type RejectionRiskAlert = z.infer<typeof RejectionRiskAlertSchema>;

export const LoanSimulationResultSchema = z.object({
  resolvedLoanAmountYen: z.number(),
  miscCostYen: z.number(),
  products: z.array(LoanProductResultSchema),
  recommendation: z.object({
    bestProductId: z.string(),
    reason: z.string(),
  }),
  // 実銀行マッチング（PR で追加）
  bankFitScores: z.array(BankFitScoreSchema),
  // 否決パターンリスク警告
  riskAlerts: z.array(RejectionRiskAlertSchema),
  // 否決統計
  rejectionStats: z.object({
    totalCases: z.number(),
    uniqueCustomers: z.number(),
    topPatterns: z.array(z.object({ tag: z.string(), count: z.number() })),
  }),
});
export type LoanSimulationResult = z.infer<typeof LoanSimulationResultSchema>;

// Analytics
export const AnalyticsSchema = z.object({
  totalConversations: z.number(),
  totalMessages: z.number(),
  totalTokensUsed: z.number(),
  averageResponseTime: z.number(),
  topAgents: z.array(
    z.object({
      agentId: z.string(),
      name: z.string(),
      messageCount: z.number(),
    })
  ),
});
export type Analytics = z.infer<typeof AnalyticsSchema>;
