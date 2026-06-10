import { Building2, TrendingUp } from "lucide-react";
import {
  MARKET_CASES,
  CONDO_BY_PREFECTURE,
  MARKET_SOURCE,
  type MarketCase,
} from "@/lib/valuation";
import { formatYen } from "@/lib/format";

/** 査定結果（中央値）に最も近い参考事例を返す。結果が無ければ null。 */
function nearestCase(estimate: number | null): MarketCase | null {
  if (estimate == null) return null;
  return MARKET_CASES.reduce((best, c) =>
    Math.abs(c.avgPrice - estimate) < Math.abs(best.avgPrice - estimate) ? c : best
  );
}

interface Props {
  /** 査定額（円）。あれば最も近い事例をハイライトする */
  estimate?: number | null;
}

/** 首都圏の不動産相場の参考事例パネル（出典: マーシャルアーツ市場調査資料） */
export function MarketReference({ estimate = null }: Props) {
  const near = nearestCase(estimate);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-800">参考：首都圏の不動産相場事例</h3>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        査定額の妥当性を相場と照らし合わせるための参考データです。
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MARKET_CASES.map((c) => {
          const highlighted = near?.category === c.category;
          return (
            <div
              key={c.category}
              className={`rounded-xl border p-3 transition ${
                highlighted
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-100"
                  : "border-slate-200 bg-slate-50"
              }`}
              title={c.note}
            >
              <p className="text-[11px] font-medium text-slate-500">{c.category}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                {formatYen(c.avgPrice)}
              </p>
              {c.unitPricePerSqm && (
                <p className="text-[11px] text-slate-400">
                  ㎡単価 {Math.round(c.unitPricePerSqm / 10000)}万円
                </p>
              )}
              <p className="mt-1 text-[10px] text-slate-400">{c.period}</p>
            </div>
          );
        })}
      </div>

      {near && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          査定額 {formatYen(estimate!)} は、首都圏の「{near.category}」平均（{formatYen(near.avgPrice)}）に近い水準です。
        </p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-600">中古マンション 都県別相場</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONDO_BY_PREFECTURE.map((p) => (
            <div key={p.prefecture} className="flex flex-col rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-[11px] text-slate-500">{p.prefecture}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-800">
                {formatYen(p.avgPrice)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[10px] text-slate-400">{MARKET_SOURCE}</p>
    </section>
  );
}
