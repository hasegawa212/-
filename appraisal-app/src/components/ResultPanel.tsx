import { TrendingUp, Info } from "lucide-react";
import type { AppraisalResult } from "@/lib/valuation";
import { formatYen, formatYenFull } from "@/lib/format";

interface ResultPanelProps {
  result: AppraisalResult | null;
  title: string;
}

export function ResultPanel({ result, title }: ResultPanelProps) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <TrendingUp className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-400">
          項目を入力して「査定する」を押すと、
          <br />
          ここに概算査定額が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white">
        <p className="text-sm/relaxed opacity-80">{title}の概算査定額</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{formatYen(result.estimate)}</p>
        <p className="mt-2 text-sm opacity-90">
          想定レンジ：{formatYen(result.low)} 〜 {formatYen(result.high)}
        </p>
        <div className="mt-3 h-2 w-full rounded-full bg-white/25">
          <div className="h-2 w-2/3 rounded-full bg-white/80" />
        </div>
      </div>

      <div className="p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">計算の内訳</h3>
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
