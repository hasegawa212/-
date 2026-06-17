import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import type { Deal, DealStatus } from "@shared/types";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS: { value: DealStatus; label: string; color: string }[] = [
  { value: "pending", label: "検討中", color: "bg-gray-100 text-gray-800" },
  { value: "approved", label: "融資承認", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "見送り", color: "bg-red-100 text-red-800" },
  { value: "closed", label: "クロージング完了", color: "bg-blue-100 text-blue-800" },
];

function yen(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)} 億円`;
  if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(0)} 万円`;
  return `${Math.round(v).toLocaleString()} 円`;
}

function delta(predicted: number, actual: number | null): string {
  if (actual === null) return "—";
  const diff = actual - predicted;
  const pct = predicted > 0 ? (diff / predicted) * 100 : 0;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${yen(diff)}（${sign}${pct.toFixed(1)}%）`;
}

function statusBadge(s: DealStatus) {
  const opt = STATUS_OPTIONS.find((o) => o.value === s);
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${opt?.color ?? ""}`}>
      {opt?.label ?? s}
    </span>
  );
}

const BANK_LABEL: Record<string, string> = {
  megabank: "メガバンク",
  regional: "地方銀行",
  shinkin: "信用金庫",
  nonbank: "ノンバンク",
};

export default function DealHistory() {
  const navigate = useNavigate();
  const dealsQuery = trpc.bankValuationDeals.list.useQuery();
  const calibQuery = trpc.bankCalibration.list.useQuery();
  const recomputeMutation = trpc.bankCalibration.recomputeAll.useMutation({
    onSuccess: () => calibQuery.refetch(),
  });
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  if (dealsQuery.isLoading) return <div className="p-6">読み込み中…</div>;

  const deals = dealsQuery.data ?? [];
  const calibData = calibQuery.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold">案件履歴 / 実績</h1>
          <p className="text-sm text-muted-foreground mt-1">
            銀行評価額シミュレーターで保存した案件一覧。実際の融資結果を記録すると、予測 vs 実績の差が見えます。
            実績が {calibData?.minSamples ?? 3} 件以上溜まった銀行は、自動で予測値が校正されます。
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/bank-valuation")}>
          ← シミュレーターに戻る
        </Button>
      </div>

      {/* 学習状況 */}
      {calibData && (
        <div className="bg-card rounded-lg border p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">📊 実績ベース 学習状況</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => recomputeMutation.mutate()}
              disabled={recomputeMutation.isPending}
            >
              {recomputeMutation.isPending ? "再計算中…" : "再計算"}
            </Button>
          </div>
          {calibData.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              校正対象データなし。融資承認 or クロージング完了の実績を記録すると学習されます。
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2">銀行</th>
                  <th className="text-right px-3 py-2">サンプル</th>
                  <th className="text-right px-3 py-2">融資補正</th>
                  <th className="text-right px-3 py-2">評価補正</th>
                  <th className="text-right px-3 py-2">実効 LTV</th>
                  <th className="text-center px-3 py-2">状態</th>
                </tr>
              </thead>
              <tbody>
                {calibData.items.map((c) => (
                  <tr key={c.bankId} className="border-t">
                    <td className="px-3 py-2">{BANK_LABEL[c.bankId] ?? c.bankId}</td>
                    <td className="text-right px-3 py-2">{c.sampleCount} 件</td>
                    <td className="text-right px-3 py-2 font-mono">
                      × {c.loanMultiplier.toFixed(3)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono">
                      × {c.valuationMultiplier.toFixed(3)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono">
                      {(c.effectiveLtv * 100).toFixed(1)}%
                    </td>
                    <td className="text-center px-3 py-2">
                      {c.active ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          適用中
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          サンプル不足
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {deals.length === 0 ? (
        <div className="bg-card rounded-lg border p-10 text-center text-muted-foreground">
          まだ案件が保存されていません。シミュレーターで計算結果を保存してください。
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2">案件 ID / メモ</th>
                <th className="text-right px-4 py-2">予測 最良融資</th>
                <th className="text-right px-4 py-2">実際 融資</th>
                <th className="text-right px-4 py-2">差分</th>
                <th className="text-center px-4 py-2">状態</th>
                <th className="text-center px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-muted-foreground">{d.dealCode}</div>
                    <div className="font-medium mt-0.5">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      保存: {d.createdAt}
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">{yen(d.result.summary.bestLoanYen)}</td>
                  <td className="text-right px-4 py-3 font-semibold">{yen(d.actualLoanYen)}</td>
                  <td className="text-right px-4 py-3 text-xs">
                    {delta(d.result.summary.bestLoanYen, d.actualLoanYen)}
                  </td>
                  <td className="text-center px-4 py-3">{statusBadge(d.dealStatus)}</td>
                  <td className="text-center px-4 py-3 space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/bank-valuation?loadDealId=${d.id}`)}
                    >
                      開く
                    </Button>
                    <Button size="sm" onClick={() => setEditingDeal(d)}>
                      実績入力
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingDeal && (
        <ActualEditor
          deal={editingDeal}
          onClose={() => setEditingDeal(null)}
          onSaved={() => {
            dealsQuery.refetch();
            calibQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

function ActualEditor({
  deal,
  onClose,
  onSaved,
}: {
  deal: Deal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    actualBankName: deal.actualBankName ?? "",
    actualBankId: deal.actualBankId ?? "",
    actualValuationYen: deal.actualValuationYen ?? 0,
    actualLoanYen: deal.actualLoanYen ?? 0,
    actualInterestRatePercent: deal.actualInterestRatePercent ?? 0,
    dealStatus: deal.dealStatus,
    note: deal.note,
  });

  const recordMutation = trpc.bankValuationDeals.recordActual.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const deleteMutation = trpc.bankValuationDeals.delete.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{deal.dealCode}</div>
            <h2 className="font-semibold text-lg">{deal.title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="実取引銀行名">
              <input
                type="text"
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.actualBankName}
                onChange={(e) => setForm({ ...form, actualBankName: e.target.value })}
                placeholder="例: 横浜銀行"
              />
            </Field>
            <Field label="銀行区分 ID">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.actualBankId}
                onChange={(e) => setForm({ ...form, actualBankId: e.target.value })}
              >
                <option value="">— 未選択 —</option>
                <option value="megabank">メガバンク</option>
                <option value="regional">地方銀行</option>
                <option value="shinkin">信用金庫</option>
                <option value="nonbank">ノンバンク</option>
              </select>
            </Field>
            <Field label="実 銀行評価額（円）">
              <input
                type="number"
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.actualValuationYen}
                onChange={(e) =>
                  setForm({ ...form, actualValuationYen: Number(e.target.value) || 0 })
                }
              />
              <Hint>予測: {yen(deal.result.banks[0]?.estimatedValuationYen)}（最初の銀行）</Hint>
            </Field>
            <Field label="実 融資承認額（円）">
              <input
                type="number"
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.actualLoanYen}
                onChange={(e) =>
                  setForm({ ...form, actualLoanYen: Number(e.target.value) || 0 })
                }
              />
              <Hint>予測最良: {yen(deal.result.summary.bestLoanYen)}</Hint>
            </Field>
            <Field label="金利（%）">
              <input
                type="number"
                step="0.01"
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.actualInterestRatePercent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actualInterestRatePercent: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
            <Field label="案件状態">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={form.dealStatus}
                onChange={(e) =>
                  setForm({ ...form, dealStatus: e.target.value as DealStatus })
                }
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="メモ">
            <textarea
              className="w-full border rounded px-3 py-2 bg-background"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="交渉経緯・条件等"
            />
          </Field>
        </div>

        <div className="p-5 border-t flex justify-between gap-2">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              if (confirm(`案件 ${deal.dealCode} を削除しますか？`)) {
                deleteMutation.mutate({ id: deal.id });
              }
            }}
          >
            削除
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={() =>
                recordMutation.mutate({
                  id: deal.id,
                  actualBankId: form.actualBankId || null,
                  actualBankName: form.actualBankName || null,
                  actualValuationYen: form.actualValuationYen || null,
                  actualLoanYen: form.actualLoanYen || null,
                  actualInterestRatePercent: form.actualInterestRatePercent || null,
                  dealStatus: form.dealStatus,
                  note: form.note,
                })
              }
              disabled={recordMutation.isPending}
            >
              {recordMutation.isPending ? "保存中…" : "実績を保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
}
