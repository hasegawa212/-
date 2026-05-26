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
