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
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white/70 p-8 text-center">
        <TrendingUp className="mb-3 h-10 w-10 text-gold-300" />
        <p className="text-sm text-brand-400">
          項目を入力して「査定する」を押すと、
          <br />
          ここに概算査定額が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200/60 bg-white shadow-card">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-7 text-cream">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(420px 160px at 90% 0%, #c9a74e, transparent 60%)" }} />
        <p className="font-display text-[11px] uppercase tracking-widest2 text-gold-300">{title}の概算査定額</p>
        <p className="mt-2 font-display text-[2.6rem] leading-none font-semibold tracking-tight text-cream">
          {formatYen(result.estimate)}
        </p>
        <p className="mt-3 text-sm text-cream/75">
          想定レンジ：{formatYen(result.low)} 〜 {formatYen(result.high)}
        </p>
        <div className="mt-4 h-px w-full rounded-full bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
      </div>

      <div className="p-6">
        <h3 className="mb-3 font-display text-xs uppercase tracking-widest2 text-brand-500">計算の内訳</h3>
        <ul className="divide-y divide-brand-100">
          {result.breakdown.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-brand-700">{item.label}</p>
                {item.detail && <p className="text-xs text-brand-400">{item.detail}</p>}
              </div>
              <p
                className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
                  item.amount < 0 ? "text-rose-500" : "text-brand-800"
                }`}
              >
                {formatYenFull(item.amount)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 rounded-lg border border-gold-100 bg-gold-50/60 p-3">
          {result.notes.map((note, i) => (
            <p key={i} className="flex gap-1.5 text-xs text-brand-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
              <span>{note}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
