import type { BreakdownItem } from "./types";
import { estimateMonthlyRent } from "./wardRents";

// 投資用区分マンションの利回り評価エンジン
//
// 価格・エリア（東京23区）・専有面積から想定家賃を推定（SUUMO連携の wardRents を使用）し、
// 表面利回り・実質利回り・月次収支を算出して投資妙味を判定する。

export interface InvestmentInput {
  /** 物件価格（円） */
  price: number;
  /** 東京23区（WARD_RENT_PER_SQM のキー）。家賃推定に使う */
  ward: string;
  /** 専有面積（㎡） */
  areaSqm: number;
  /** 実際の月額家賃（円）。未指定ならエリア相場から推定する */
  monthlyRent?: number;
  /** 管理費＋修繕積立金（円/月） */
  monthlyCost: number;
  /** ローン返済額（円/月）。現金購入は 0 */
  monthlyLoan: number;
}

export type InvestmentRating = "good" | "fair" | "poor";

export interface InvestmentResult {
  /** 採用した月額家賃（円） */
  monthlyRent: number;
  /** 家賃の出所 */
  rentSource: "input" | "estimated";
  /** 表面利回り（%） */
  grossYield: number;
  /** 実質利回り（NOI / 価格, %） */
  netYield: number;
  /** 月次キャッシュフロー（円） */
  monthlyCashflow: number;
  /** 年間キャッシュフロー（円） */
  annualCashflow: number;
  /** 総合判定 */
  rating: InvestmentRating;
  breakdown: BreakdownItem[];
  notes: string[];
}

/** 表面利回りと月次収支から投資妙味を判定する */
export function rateInvestment(grossYield: number, monthlyCashflow: number): InvestmentRating {
  if (grossYield >= 5 && monthlyCashflow >= 0) return "good";
  if (grossYield < 3.5 || monthlyCashflow <= -20000) return "poor";
  return "fair";
}

/** 投資区分の利回り・収支を評価する */
export function evaluateInvestment(input: InvestmentInput): InvestmentResult {
  const notes: string[] = [];

  // 家賃: 入力があれば優先、なければエリア相場から推定
  let monthlyRent = input.monthlyRent ?? 0;
  let rentSource: "input" | "estimated" = "input";
  if (!input.monthlyRent || input.monthlyRent <= 0) {
    monthlyRent = estimateMonthlyRent(input.ward, input.areaSqm);
    rentSource = "estimated";
    notes.push(
      `家賃はSUUMO連携の${input.ward}相場（㎡単価 × ${input.areaSqm}㎡）から推定しています。実賃料が分かる場合は入力すると精度が上がります。`
    );
  }

  const annualRent = monthlyRent * 12;
  const annualCost = input.monthlyCost * 12;
  const noi = annualRent - annualCost;

  const grossYield = input.price > 0 ? (annualRent / input.price) * 100 : 0;
  const netYield = input.price > 0 ? (noi / input.price) * 100 : 0;
  const monthlyCashflow = monthlyRent - input.monthlyCost - input.monthlyLoan;
  const annualCashflow = monthlyCashflow * 12;

  const breakdown: BreakdownItem[] = [
    {
      label: rentSource === "estimated" ? "想定家賃（相場推定）" : "月額家賃",
      detail: `年間 ${annualRent.toLocaleString()}円`,
      amount: monthlyRent,
    },
    {
      label: "管理費・修繕積立金",
      detail: `年間 ${annualCost.toLocaleString()}円`,
      amount: -input.monthlyCost,
    },
  ];
  if (input.monthlyLoan > 0) {
    breakdown.push({
      label: "ローン返済",
      detail: "月額",
      amount: -input.monthlyLoan,
    });
  }
  breakdown.push({
    label: "月次キャッシュフロー",
    detail: monthlyCashflow >= 0 ? "黒字" : "赤字（持ち出し）",
    amount: monthlyCashflow,
  });

  const rating = rateInvestment(grossYield, monthlyCashflow);
  if (rating === "poor") {
    notes.push("表面利回りが低い、または月次収支が大きく赤字です。インカム単体では回らず、売却益・節税効果に依存する構造の可能性があります。");
  } else if (rating === "good") {
    notes.push("表面利回り・月次収支ともに良好で、インカムが回る堅実型です。");
  }

  return {
    monthlyRent,
    rentSource,
    grossYield,
    netYield,
    monthlyCashflow,
    annualCashflow,
    rating,
    breakdown,
    notes,
  };
}
