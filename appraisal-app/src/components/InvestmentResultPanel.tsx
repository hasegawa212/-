import { Info, TrendingUp } from "lucide-react";
import type { InvestmentResult } from "@/lib/valuation";
import { formatYenFull } from "@/lib/format";

const RATING_META: Record<
  InvestmentResult["rating"],
  { label: string; badge: string; gradient: string }
> = {
  good: { label: "◎ 良好", badge: "bg-emerald-100 text-emerald-700", gradient: "from-emerald-600 to-emerald-700" },
  fair: { label: "○ 普通", badge: "bg-amber-100 text-amber-700", gradient: "from-amber-500 to-amber-600" },
  poor: { label: "✕ 要注意", badge: "bg-rose-100 text-rose-700", gradient: "from-rose-500 to-rose-600" },
};

interface Props {
  result: InvestmentResult | null;
}

export function InvestmentResultPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <TrendingUp className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-400">
          条件を入力して「利回りを評価する」を押すと、
          <br />
          表面利回り・月次収支がここに表示されます。
        </p>
      </div>
    );
  }

  const meta = RATING_META[result.rating];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-br ${meta.gradient} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-80">表面利回り</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
        </div>
        <p className="mt-1 text-4xl font-bold tracking-tight">{result.grossYield.toFixed(2)}%</p>
        <div className="mt-2 flex gap-6 text-sm opacity-90">
          <span>実質利回り {result.netYield.toFixed(2)}%</span>
          <span>
            月次収支 {result.monthlyCashflow >= 0 ? "+" : ""}
            {result.monthlyCashflow.toLocaleString()}円
          </span>
        </div>
      </div>

      <div className="p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">収支の内訳（月額）</h3>
        <ul className="divide-y divide-slate-100">
          {result.breakdown.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                {item.detail && <p className="text-xs text-slate-400">{item.detail}</p>}
              </div>
              <p
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  item.amount < 0 ? "text-rose-500" : "text-slate-800"
                }`}
              >
                {formatYenFull(item.amount)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3">
          {result.notes.map((note, i) => (
            <p key={i} className="flex gap-1.5 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{note}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
