import { AlertTriangle } from "lucide-react";
import type { BatchResultRow, BatchVerdict } from "@/lib/valuation";
import { formatYen } from "@/lib/format";

const VERDICT_META: Record<BatchVerdict, { label: string; cls: string }> = {
  undervalued: { label: "割安", cls: "bg-emerald-100 text-emerald-700" },
  fair: { label: "適正", cls: "bg-slate-100 text-slate-600" },
  overvalued: { label: "割高", cls: "bg-rose-100 text-rose-700" },
};

interface Props {
  rows: BatchResultRow[] | null;
  errors: string[];
}

export function BatchResultPanel({ rows, errors }: Props) {
  if (!rows) return null;

  const sumAsking = rows.reduce((s, r) => s + r.askingPrice, 0);
  const sumEstimate = rows.reduce((s, r) => s + r.estimate, 0);
  const avgDev = sumEstimate > 0 ? ((sumAsking - sumEstimate) / sumEstimate) * 100 : 0;

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            読み取れなかった行（{errors.length}件）
          </div>
          <ul className="space-y-0.5 text-xs text-amber-700">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">物件</th>
                  <th className="px-4 py-2.5 font-medium">エリア</th>
                  <th className="px-4 py-2.5 text-right font-medium">提案価格</th>
                  <th className="px-4 py-2.5 text-right font-medium">モデル査定</th>
                  <th className="px-4 py-2.5 text-right font-medium">乖離</th>
                  <th className="px-4 py-2.5 text-center font-medium">判定</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const meta = VERDICT_META[r.verdict];
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.city}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {formatYen(r.askingPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                        {formatYen(r.estimate)}
                        <span className="block text-[10px] text-slate-400">
                          {formatYen(r.low)}〜{formatYen(r.high)}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          r.deviationPct > 0 ? "text-rose-500" : "text-emerald-600"
                        }`}
                      >
                        {r.deviationPct >= 0 ? "+" : ""}
                        {r.deviationPct.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                  <td className="px-4 py-2.5" colSpan={2}>
                    合計 {rows.length} 件
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(sumAsking)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatYen(sumEstimate)}</td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      avgDev > 0 ? "text-rose-500" : "text-emerald-600"
                    }`}
                  >
                    {avgDev >= 0 ? "+" : ""}
                    {avgDev.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
            判定基準：査定額より5%以上安い＝割安／±はおおむね適正／10%以上高い＝割高。モデル査定は原価ベースの概算のため、リフォーム・実需プレミアム分は割高側に出ます。
          </p>
        </div>
      )}
    </div>
  );
}
