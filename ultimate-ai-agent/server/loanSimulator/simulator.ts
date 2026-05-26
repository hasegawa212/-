// 住宅ローン シミュレーター オーケストレータ
//
// 入力: LoanSimulationInput（shared/types.ts）
// 出力: LoanSimulationResult（商品別 + 銀行別フィット + 否決リスク警告 + 統計）
//
// 統合する 3 つのモジュール:
//   - loanCalculator: 商品別の月返済・総返済・審査基準計算
//   - realBankProfiles: 27 行の実銀行データへのマッチング
//   - rejectionCases: 過去 30 件の否決パターンとの照合

import { simulateLoan as simulateProducts, type LoanSimulationInput as LegacyInput } from "./loanCalculator";
import { REAL_BANK_PROFILES, scoreBankFit, type BankFitScore } from "./realBankProfiles";
import { REJECTION_CASES, getRejectionStats, type RejectionTag } from "./rejectionCases";

export interface SimulatorInputV2 {
  property: {
    priceYen: number;
    kind: "newCondo" | "usedHouse" | "investment";
    ageYears: number;
    prefecture: string;
    hasRoadAccessIssue: boolean;
  };
  ownFundsYen: number;
  loanAmountYen: number;
  loanTermYears: number;
  repaymentMethod: "annuity" | "equalPrincipal";
  borrower: {
    ageYears: number;
    annualIncomeYen: number;
    employmentType: "salaryman" | "executive" | "soleProprietor" | "companyOwner" | "other";
    yearsOfEmployment: number;
    existingDebtMonthlyYen: number;
    isSingle: boolean;
    hasInsuranceConcern: boolean;
    hasCreditConcern: boolean;
  };
  prepaymentAmountYen: number;
  prepaymentAfterYears: number;
  prepaymentMode: "shorten" | "reduce";
  variableRateShockPercent: number;
}

export interface RiskAlert {
  riskLevel: "high" | "medium" | "low";
  category: string;
  message: string;
  similarCaseIds: string[];
  recommendedAction: string;
}

function detectRisks(input: SimulatorInputV2): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  // 1. 接道問題（過去：松本様 #4）
  if (input.property.hasRoadAccessIssue) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("property_road_access"));
    alerts.push({
      riskLevel: "high",
      category: "物件起因",
      message: "接道義務違反の可能性。過去に同種事案で茨城県信用組合が否決した実例あり。",
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "物件振替を検討するか、積算評価柔軟な信用金庫で再申込を推奨",
    });
  }

  // 2. 雇用形態リスク
  if (input.borrower.employmentType === "other" || input.borrower.yearsOfEmployment < 1) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("borrower_employment"));
    alerts.push({
      riskLevel: "medium",
      category: "属性起因",
      message: "雇用形態または勤続年数が不安定。過去に雇用契約書なしで住信 SBI 銀行が否決した実例あり。",
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "労金（ろうきん）or フラット 35 へ申込推奨。在籍証明書は不可の場合もある点に注意",
    });
  }

  // 3. 自営業
  if (input.borrower.employmentType === "soleProprietor") {
    alerts.push({
      riskLevel: "low",
      category: "属性",
      message: "自営業の場合、メガバンク・ネット銀行は厳しめ。信用金庫・フラット 35 を優先するのが王道。",
      similarCaseIds: [],
      recommendedAction: "信用金庫（水戸信金・茨城県信組）or フラット 35 を本命に",
    });
  }

  // 4. 単身者
  if (input.borrower.isSingle) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("borrower_single"));
    alerts.push({
      riskLevel: "medium",
      category: "属性起因",
      message: "単身者懸念。過去に埼玉縣信用金庫で同種事案の否決実例あり。",
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "信用金庫より地銀・SBI 系を優先",
    });
  }

  // 5. 団信告知事項
  if (input.borrower.hasInsuranceConcern) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("borrower_dansin_kokuji"));
    alerts.push({
      riskLevel: "high",
      category: "団信",
      message: "団信告知事項あり。過去に SBI 銀行で否決し ARUHI 不可・日本モーゲージで精査した実例あり。",
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "団信告知不要のフラット 35（機構団信）or 日本モーゲージへ",
    });
  }

  // 6. 個信記録
  if (input.borrower.hasCreditConcern) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("borrower_kojin_shin"));
    alerts.push({
      riskLevel: "high",
      category: "個信",
      message: "個信記録の懸念。JICC・KSC・CIC 照会の事前確認推奨。",
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "ノンバンク（SBJ / オリックス）or フラット 35 を主軸に",
    });
  }

  // 7. 物件価格 vs 評価ギャップ
  const loanAmount =
    input.loanAmountYen > 0 ? input.loanAmountYen : input.property.priceYen - input.ownFundsYen;
  const loanToIncomeRatio = input.borrower.annualIncomeYen > 0 ? loanAmount / input.borrower.annualIncomeYen : 999;
  if (loanToIncomeRatio > 8) {
    alerts.push({
      riskLevel: "high",
      category: "返済能力",
      message: `年収倍率 ${loanToIncomeRatio.toFixed(1)} 倍は大半の銀行で上限超過。`,
      similarCaseIds: [],
      recommendedAction: "借入額を圧縮（自己資金増 or 物件価格見直し）。フラット 35 は 10 倍までで唯一の選択肢",
    });
  }

  // 8. 完済時年齢
  const completionAge = input.borrower.ageYears + input.loanTermYears;
  if (completionAge > 80) {
    alerts.push({
      riskLevel: "high",
      category: "完済時年齢",
      message: `完済時年齢 ${completionAge} 歳は 80 歳上限を超過。`,
      similarCaseIds: [],
      recommendedAction: `返済期間を ${80 - input.borrower.ageYears} 年以下に短縮`,
    });
  }

  // 9. 連続否決リスク（属性に深刻な問題がある場合の警告）
  let riskFactors = 0;
  if (input.borrower.hasInsuranceConcern) riskFactors++;
  if (input.borrower.hasCreditConcern) riskFactors++;
  if (input.borrower.yearsOfEmployment < 1) riskFactors++;
  if (input.borrower.employmentType === "other") riskFactors++;
  if (input.property.hasRoadAccessIssue) riskFactors++;
  if (loanToIncomeRatio > 7) riskFactors++;
  if (riskFactors >= 3) {
    const similar = REJECTION_CASES.filter((c) => c.tags.includes("borrower_all_failed"));
    alerts.push({
      riskLevel: "high",
      category: "総合",
      message: `リスク要因 ${riskFactors} 個重複。過去に「全行・全保証会社で申込不可」事例あり（CUST-B：5 連続否決）。`,
      similarCaseIds: similar.map((c) => c.caseId),
      recommendedAction: "物件種別変更（中古戸建等）・自己資金増・属性改善を先行検討",
    });
  }

  return alerts;
}

function getTopRejectionPatterns(): Array<{ tag: string; count: number }> {
  const stats = getRejectionStats();
  return Object.entries(stats.byTag)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

const TAG_LABEL: Record<RejectionTag | string, string> = {
  property_road_access: "接道義務違反",
  property_atemono: "充て物審査",
  property_kosenfuka: "再建築不可",
  property_kakaku: "物件価格不適合",
  borrower_employment: "雇用契約不備",
  borrower_single: "単身者懸念",
  borrower_dansin_kokuji: "団信告知",
  borrower_kojin_shin: "個信記録",
  borrower_all_failed: "全行否決",
  product_mismatch: "商品要件不一致",
  unknown: "詳細未把握",
};

export function simulateLoanFull(input: SimulatorInputV2) {
  // 1) 商品別シミュレーション
  const legacyInput: LegacyInput = {
    propertyPriceYen: input.property.priceYen,
    ownFundsYen: input.ownFundsYen,
    loanAmountYen: input.loanAmountYen,
    loanTermYears: input.loanTermYears,
    borrowerAgeYears: input.borrower.ageYears,
    annualIncomeYen: input.borrower.annualIncomeYen,
    existingDebtMonthlyYen: input.borrower.existingDebtMonthlyYen,
    repaymentMethod: input.repaymentMethod,
    propertyKind: input.property.kind,
    prepayment:
      input.prepaymentAmountYen > 0
        ? {
            amountYen: input.prepaymentAmountYen,
            afterYears: input.prepaymentAfterYears,
            mode: input.prepaymentMode,
          }
        : undefined,
    variableRateShockPercent:
      input.variableRateShockPercent > 0 ? input.variableRateShockPercent : undefined,
  };
  const productResult = simulateProducts(legacyInput);

  // 2) 実銀行マッチング
  const fitScores: BankFitScore[] = REAL_BANK_PROFILES.map((b) =>
    scoreBankFit(b, {
      annualIncomeYen: input.borrower.annualIncomeYen,
      propertyArea: input.property.prefecture || null,
      employmentType: input.borrower.employmentType,
      yearsOfEmployment: input.borrower.yearsOfEmployment,
      hasInsuranceConcern: input.borrower.hasInsuranceConcern,
      hasCreditConcern: input.borrower.hasCreditConcern,
      isSingle: input.borrower.isSingle,
      propertyHasRoadAccessIssue: input.property.hasRoadAccessIssue,
      propertyAge: input.property.ageYears,
    })
  ).sort((a, b) => b.score - a.score);

  // 3) 否決リスク警告
  const alerts = detectRisks(input);

  // 4) 否決統計
  const stats = getRejectionStats();
  const topPatterns = getTopRejectionPatterns().map((p) => ({
    tag: TAG_LABEL[p.tag] ?? p.tag,
    count: p.count,
  }));

  return {
    ...productResult,
    bankFitScores: fitScores.map((f) => ({
      bankId: f.bank.id,
      bankName: f.bank.name,
      category: f.bank.category,
      score: f.score,
      matchReasons: f.matchReasons,
      warnings: f.warnings,
      preliminaryReviewDays: f.bank.preliminaryReviewDays,
      fullReviewDays: f.bank.fullReviewDays,
      reviewRatePercent: f.bank.reviewRatePercent,
      strengths: f.bank.strengths,
      notes: f.bank.notes,
    })),
    riskAlerts: alerts,
    rejectionStats: {
      totalCases: stats.totalCases,
      uniqueCustomers: stats.uniqueCustomers,
      topPatterns,
    },
  };
}
