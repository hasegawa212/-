import { useState } from "react";
import { Home as HomeIcon, Car } from "lucide-react";
import { RealEstateForm } from "@/components/RealEstateForm";
import { CarForm } from "@/components/CarForm";
import { ResultPanel } from "@/components/ResultPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { AppraisalResult } from "@/lib/valuation";

type Tab = "realEstate" | "car";

export function Home() {
  const [tab, setTab] = useState<Tab>("realEstate");
  const [result, setResult] = useState<AppraisalResult | null>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setResult(null);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            査
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">本物査定アプリ</h1>
            <p className="text-xs text-slate-400">不動産・自動車のオンライン概算査定</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <SegmentedControl
            options={[
              { value: "realEstate", label: "🏠 不動産査定" },
              { value: "car", label: "🚗 車査定" },
            ]}
            value={tab}
            onChange={(v) => switchTab(v as Tab)}
          />
          <span className="hidden text-sm text-slate-400 sm:flex sm:items-center sm:gap-1.5">
            {tab === "realEstate" ? <HomeIcon className="h-4 w-4" /> : <Car className="h-4 w-4" />}
            その場で概算額を算出
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            {tab === "realEstate" ? (
              <RealEstateForm onResult={setResult} />
            ) : (
              <CarForm onResult={setResult} />
            )}
          </div>
          <div>
            <ResultPanel result={result} title={tab === "realEstate" ? "不動産" : "お車"} />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          ※ 本アプリの査定額は公開データに基づく概算シミュレーションであり、実際の売買・買取価格を保証するものではありません。
        </p>
      </main>
    </div>
  );
}
