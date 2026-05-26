import { db } from "../db";
import { bankValuationDeals, bankProfileCalibrations } from "../../drizzle/schema";
import { eq, and, isNotNull, inArray } from "drizzle-orm";

// 校正発動の最低サンプル数（脱属人化原則⑤に合わせ明示）
export const MIN_SAMPLES_FOR_CALIBRATION = 3;

export interface CalibrationSnapshot {
  bankId: string;
  sampleCount: number;
  loanMultiplier: number; // 予測融資 → 実融資 比（例 0.92 = 予測より 8% 低い）
  valuationMultiplier: number; // 予測評価 → 実評価 比
  effectiveLtv: number; // 実 LTV
  meanActualValuationYen: number;
  meanActualLoanYen: number;
  meanPredictedValuationYen: number;
  meanPredictedLoanYen: number;
  computedAt: string;
  // 校正が有効かどうか（最小サンプル満たすか）
  active: boolean;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * 特定の銀行 ID の校正値を実績データから再計算し、DB に永続化する。
 * 対象は dealStatus が 'approved' または 'closed' の案件（rejected と pending は除外）。
 */
export async function recomputeCalibrationFor(bankId: string): Promise<CalibrationSnapshot> {
  const rows = await db
    .select()
    .from(bankValuationDeals)
    .where(
      and(
        eq(bankValuationDeals.actualBankId, bankId),
        isNotNull(bankValuationDeals.actualLoanYen),
        isNotNull(bankValuationDeals.actualValuationYen),
        inArray(bankValuationDeals.dealStatus, ["approved", "closed"])
      )
    );

  const pairs = rows
    .map((r) => {
      const result =
        typeof r.resultJson === "string" ? JSON.parse(r.resultJson) : (r.resultJson as any);
      const bankSnap = result.banks?.find((b: any) => b.bankId === bankId);
      if (!bankSnap) return null;
      return {
        predictedValuation: bankSnap.estimatedValuationYen as number,
        predictedLoan: bankSnap.estimatedLoanYen as number,
        actualValuation: r.actualValuationYen as number,
        actualLoan: r.actualLoanYen as number,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.predictedLoan > 0 && p.predictedValuation > 0);

  const sampleCount = pairs.length;

  if (sampleCount === 0) {
    // データなし → デフォルトに戻す（既存レコード削除）
    await db.delete(bankProfileCalibrations).where(eq(bankProfileCalibrations.bankId, bankId));
    return {
      bankId,
      sampleCount: 0,
      loanMultiplier: 1,
      valuationMultiplier: 1,
      effectiveLtv: 0,
      meanActualValuationYen: 0,
      meanActualLoanYen: 0,
      meanPredictedValuationYen: 0,
      meanPredictedLoanYen: 0,
      computedAt: new Date().toISOString(),
      active: false,
    };
  }

  const loanRatios = pairs.map((p) => p.actualLoan / p.predictedLoan);
  const valRatios = pairs.map((p) => p.actualValuation / p.predictedValuation);
  const ltvs = pairs.map((p) => p.actualLoan / p.actualValuation);

  const loanMultiplier = avg(loanRatios);
  const valuationMultiplier = avg(valRatios);
  const effectiveLtv = avg(ltvs);

  const meanActualValuation = avg(pairs.map((p) => p.actualValuation));
  const meanActualLoan = avg(pairs.map((p) => p.actualLoan));
  const meanPredictedValuation = avg(pairs.map((p) => p.predictedValuation));
  const meanPredictedLoan = avg(pairs.map((p) => p.predictedLoan));

  const computedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  // upsert
  const existing = await db
    .select()
    .from(bankProfileCalibrations)
    .where(eq(bankProfileCalibrations.bankId, bankId))
    .limit(1);

  const values = {
    bankId,
    sampleCount,
    loanMultiplierX1000: Math.round(loanMultiplier * 1000),
    valuationMultiplierX1000: Math.round(valuationMultiplier * 1000),
    effectiveLtvX1000: Math.round(effectiveLtv * 1000),
    meanActualValuationYen: Math.round(meanActualValuation),
    meanActualLoanYen: Math.round(meanActualLoan),
    meanPredictedValuationYen: Math.round(meanPredictedValuation),
    meanPredictedLoanYen: Math.round(meanPredictedLoan),
    computedAt,
  };

  if (existing.length > 0) {
    await db
      .update(bankProfileCalibrations)
      .set(values)
      .where(eq(bankProfileCalibrations.bankId, bankId));
  } else {
    await db.insert(bankProfileCalibrations).values(values);
  }

  return {
    bankId,
    sampleCount,
    loanMultiplier,
    valuationMultiplier,
    effectiveLtv,
    meanActualValuationYen: Math.round(meanActualValuation),
    meanActualLoanYen: Math.round(meanActualLoan),
    meanPredictedValuationYen: Math.round(meanPredictedValuation),
    meanPredictedLoanYen: Math.round(meanPredictedLoan),
    computedAt,
    active: sampleCount >= MIN_SAMPLES_FOR_CALIBRATION,
  };
}

/**
 * 全銀行の校正値を取得（計算時に適用）
 */
export async function getCalibrations(): Promise<Map<string, CalibrationSnapshot>> {
  const rows = await db.select().from(bankProfileCalibrations);
  const map = new Map<string, CalibrationSnapshot>();
  for (const r of rows) {
    map.set(r.bankId, {
      bankId: r.bankId,
      sampleCount: r.sampleCount,
      loanMultiplier: r.loanMultiplierX1000 / 1000,
      valuationMultiplier: r.valuationMultiplierX1000 / 1000,
      effectiveLtv: r.effectiveLtvX1000 / 1000,
      meanActualValuationYen: r.meanActualValuationYen,
      meanActualLoanYen: r.meanActualLoanYen,
      meanPredictedValuationYen: r.meanPredictedValuationYen,
      meanPredictedLoanYen: r.meanPredictedLoanYen,
      computedAt: r.computedAt,
      active: r.sampleCount >= MIN_SAMPLES_FOR_CALIBRATION,
    });
  }
  return map;
}

export async function listCalibrations(): Promise<CalibrationSnapshot[]> {
  const map = await getCalibrations();
  return Array.from(map.values()).sort((a, b) => b.sampleCount - a.sampleCount);
}

/**
 * 全銀行の校正値を全実績から再計算する（バッチ用）
 */
export async function recomputeAllCalibrations(): Promise<CalibrationSnapshot[]> {
  const rows = await db
    .select({ bankId: bankValuationDeals.actualBankId })
    .from(bankValuationDeals)
    .where(
      and(
        isNotNull(bankValuationDeals.actualBankId),
        inArray(bankValuationDeals.dealStatus, ["approved", "closed"])
      )
    );
  const ids = Array.from(new Set(rows.map((r) => r.bankId).filter((b): b is string => !!b)));
  const results: CalibrationSnapshot[] = [];
  for (const id of ids) {
    results.push(await recomputeCalibrationFor(id));
  }
  return results;
}
