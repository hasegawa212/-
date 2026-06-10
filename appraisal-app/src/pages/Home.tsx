import { useState } from "react";
import { Home as HomeIcon, Car, TrendingUp } from "lucide-react";
import { RealEstateForm } from "@/components/RealEstateForm";
import { CarForm } from "@/components/CarForm";
import { ResultPanel } from "@/components/ResultPanel";
import { MarketReference } from "@/components/MarketReference";
import { InvestmentForm } from "@/components/InvestmentForm";
import { InvestmentResultPanel } from "@/components/InvestmentResultPanel";
import { BatchForm } from "@/components/BatchForm";
import { BatchResultPanel } from "@/components/BatchResultPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { AppraisalResult, InvestmentResult, BatchResultRow } from "@/lib/valuation";

type Tab = "realEstate" | "car" | "invest";
type RealEstateMode = "single" | "batch";

export function Home() {
  const [tab, setTab] = useState<Tab>("realEstate");
  const [reMode, setReMode] = useState<RealEstateMode>("single");
  const [result, setResult] = useState<AppraisalResult | null>(null);
  const [invResult, setInvResult] = useState<InvestmentResult | null>(null);
  const [batchRows, setBatchRows] = useState<BatchResultRow[] | null>(null);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  function resetResults() {
    setResult(null);
    setInvResult(null);
    setBatchRows(null);
    setBatchErrors([]);
  }

  function switchTab(next: Tab) {
    setTab(next);
    resetResults();
  }

  function switchMode(next: RealEstateMode) {
    setReMode(next);
    resetResults();
  }

  function handleBatch(rows: BatchResultRow[], errors: string[]) {
    setBatchRows(rows);
    setBatchErrors(errors);
  }

  const hint =
    tab === "invest"
      ? "東京23区の賃料相場と連携"
      : tab === "realEstate" && reMode === "batch"
        ? "マイソク貼り付けで一括査定"
        : "その場で概算額を算出";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            査
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">本物査定アプリ</h1>
            <p className="text-xs text-slate-400">不動産・自動車の査定＋投資利回り評価</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <SegmentedControl
            options={[
              { value: "realEstate", label: "🏠 不動産査定" },
              { value: "car", label: "🚗 車査定" },
              { value: "invest", label: "📈 投資利回り" },
            ]}
            value={tab}
            onChange={(v) => switchTab(v as Tab)}
          />
          <span className="hidden text-sm text-slate-400 sm:flex sm:items-center sm:gap-1.5">
            {tab === "realEstate" ? (
              <HomeIcon className="h-4 w-4" />
            ) : tab === "car" ? (
              <Car className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {hint}
          </span>
        </div>

        {tab === "realEstate" && (
          <div className="mb-5">
            <SegmentedControl
              options={[
                { value: "single", label: "単一査定" },
                { value: "batch", label: "一括査定（マイソク）" },
              ]}
              value={reMode}
              onChange={(v) => switchMode(v as RealEstateMode)}
            />
          </div>
        )}

        {tab === "realEstate" && reMode === "batch" ? (
          <div className="space-y-6">
            <BatchForm onResult={handleBatch} />
            <BatchResultPanel rows={batchRows} errors={batchErrors} />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                {tab === "realEstate" && <RealEstateForm onResult={setResult} />}
                {tab === "car" && <CarForm onResult={setResult} />}
                {tab === "invest" && <InvestmentForm onResult={setInvResult} />}
              </div>
              <div>
                {tab === "invest" ? (
                  <InvestmentResultPanel result={invResult} />
                ) : (
                  <ResultPanel result={result} title={tab === "realEstate" ? "不動産" : "お車"} />
                )}
              </div>
            </div>

            {tab === "realEstate" && (
              <div className="mt-6">
                <MarketReference estimate={result?.estimate ?? null} />
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          ※ 本アプリの査定額・利回りは公開データに基づく概算シミュレーションであり、実際の売買・買取価格や投資成果を保証するものではありません。
        </p>
      </main>
    </div>
  );
}
