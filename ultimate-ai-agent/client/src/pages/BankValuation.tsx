import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import type {
  ValuationInput,
  ValuationResult,
  StructureType,
  PropertyType,
  AreaTier,
} from "@shared/types";
import { Button } from "@/components/ui/button";

const initialInput: ValuationInput = {
  propertyType: "wholeApartment",
  areaTier: "majorCity",
  landAreaSqm: 150,
  buildingAreaSqm: 200,
  rosenkaPerSqm: 120_000,
  structure: "wood",
  buildingAgeYears: 15,
  annualRentIncome: 7_200_000,
  askingPriceYen: 80_000_000,
};

function yen(v: number): string {
  if (!isFinite(v)) return "—";
  if (Math.abs(v) >= 100_000_000) {
    return `${(v / 100_000_000).toFixed(2)} 億円`;
  }
  if (Math.abs(v) >= 10_000) {
    return `${(v / 10_000).toFixed(0)} 万円`;
  }
  return `${Math.round(v).toLocaleString()} 円`;
}

function judgementColor(j: "A" | "B" | "C"): string {
  return j === "A"
    ? "bg-green-100 text-green-800 border-green-300"
    : j === "B"
    ? "bg-yellow-100 text-yellow-800 border-yellow-300"
    : "bg-red-100 text-red-800 border-red-300";
}

function judgementLabel(j: "A" | "B" | "C"): string {
  return j === "A"
    ? "A：フルローン余地あり（仕入優先）"
    : j === "B"
    ? "B：ほぼ評価フィット（条件交渉次第）"
    : "C：評価不足（自己資金 or 見送り）";
}

export default function BankValuation() {
  const [input, setInput] = useState<ValuationInput>(initialInput);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metaQuery = trpc.bankValuation.metadata.useQuery();
  const calcMutation = trpc.bankValuation.calculate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const isLandOnly = input.propertyType === "landOnly";

  const handleChange = <K extends keyof ValuationInput>(
    key: K,
    value: ValuationInput[K]
  ) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const handleNumber = (key: keyof ValuationInput) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const v = e.target.value === "" ? 0 : Number(e.target.value);
    setInput((prev) => ({ ...prev, [key]: v }) as ValuationInput);
  };

  const submit = () => {
    const payload: ValuationInput = {
      ...input,
      structure: isLandOnly ? null : input.structure,
      buildingAreaSqm: isLandOnly ? 0 : input.buildingAreaSqm,
      buildingAgeYears: isLandOnly ? 0 : input.buildingAgeYears,
    };
    calcMutation.mutate(payload);
  };

  const sortedBanks = useMemo(() => {
    if (!result) return [];
    return result.banks
      .slice()
      .sort((a, b) => b.estimatedLoanYen - a.estimatedLoanYen);
  }, [result]);

  if (!metaQuery.data) {
    return <div className="p-6">読み込み中…</div>;
  }
  const meta = metaQuery.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">銀行評価額シミュレーター</h1>
        <p className="text-sm text-muted-foreground mt-1">
          物件情報を入力すると、積算・収益評価から銀行別の融資想定額と A/B/C 判定を出します。仕入れ会議の事前スクリーニング用。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 入力フォーム */}
        <div className="lg:col-span-1 bg-card rounded-lg border p-5 space-y-4">
          <h2 className="font-semibold">物件情報</h2>

          <Field label="物件種別">
            <select
              className="w-full border rounded px-3 py-2 bg-background"
              value={input.propertyType}
              onChange={(e) =>
                handleChange("propertyType", e.target.value as PropertyType)
              }
            >
              {meta.propertyTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="エリア種別">
            <select
              className="w-full border rounded px-3 py-2 bg-background"
              value={input.areaTier}
              onChange={(e) =>
                handleChange("areaTier", e.target.value as AreaTier)
              }
            >
              {meta.areaTiers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="土地面積（㎡）">
            <NumberInput value={input.landAreaSqm} onChange={handleNumber("landAreaSqm")} />
          </Field>

          <Field label="路線価（円/㎡）">
            <NumberInput value={input.rosenkaPerSqm} onChange={handleNumber("rosenkaPerSqm")} />
            <Hint>不明な場合は 公示価格 × 0.8 や周辺取引事例から推定</Hint>
          </Field>

          {!isLandOnly && (
            <>
              <Field label="建物構造">
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={input.structure ?? "wood"}
                  onChange={(e) =>
                    handleChange("structure", e.target.value as StructureType)
                  }
                >
                  {meta.structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}（耐用 {s.legalLifeYears} 年）
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="延床面積（㎡）">
                <NumberInput
                  value={input.buildingAreaSqm}
                  onChange={handleNumber("buildingAreaSqm")}
                />
              </Field>

              <Field label="築年数">
                <NumberInput
                  value={input.buildingAgeYears}
                  onChange={handleNumber("buildingAgeYears")}
                />
              </Field>

              <Field label="想定年間家賃収入（円）">
                <NumberInput
                  value={input.annualRentIncome}
                  onChange={handleNumber("annualRentIncome")}
                />
                <Hint>満室想定。空室考慮済み収入を入れる場合は実効値を</Hint>
              </Field>
            </>
          )}

          <Field label="売出価格（円）">
            <NumberInput
              value={input.askingPriceYen}
              onChange={handleNumber("askingPriceYen")}
            />
          </Field>

          <Button onClick={submit} disabled={calcMutation.isPending} className="w-full">
            {calcMutation.isPending ? "計算中…" : "評価額を算出"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* 結果 */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="bg-card rounded-lg border p-10 text-center text-muted-foreground">
              左の入力フォームを埋めて「評価額を算出」を押してください。
            </div>
          ) : (
            <>
              {/* 総合判定 */}
              <div
                className={`rounded-lg border-2 p-5 ${judgementColor(
                  result.summary.overallJudgement
                )}`}
              >
                <div className="text-sm font-medium">総合判定</div>
                <div className="text-2xl font-bold mt-1">
                  {judgementLabel(result.summary.overallJudgement)}
                </div>
                <div className="text-sm mt-2">
                  最良条件：{meta.banks.find((b) => b.id === result.summary.bestBankId)?.label}{" "}
                  / 融資想定 {yen(result.summary.bestLoanYen)} / 自己資金{" "}
                  {yen(result.summary.minOwnFundsYen)}
                </div>
              </div>

              {/* 評価額の内訳 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="積算評価額">
                  <Row label="土地" value={yen(result.cost.landValuationYen)} />
                  <Row label="建物" value={yen(result.cost.buildingValuationYen)} />
                  <Row label="残存耐用年数" value={`${result.cost.remainingLifeYears} 年`} />
                  <Row
                    label="合計"
                    value={yen(result.cost.totalYen)}
                    emphasize
                  />
                </Card>
                <Card title="収益還元評価額">
                  {result.income.applies ? (
                    <>
                      <Row label="採用還元利回り" value={`${result.income.capRatePercent} %`} />
                      <Row
                        label="評価額"
                        value={yen(result.income.valuationYen)}
                        emphasize
                      />
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      物件種別 or 家賃未入力のため、収益還元は適用しません。
                    </div>
                  )}
                </Card>
              </div>

              {/* 銀行別 */}
              <div className="bg-card rounded-lg border overflow-hidden">
                <div className="px-5 py-3 border-b font-semibold">
                  銀行別 融資想定（融資額が大きい順）
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2">銀行種別</th>
                      <th className="text-right px-4 py-2">評価額</th>
                      <th className="text-right px-4 py-2">掛け目</th>
                      <th className="text-right px-4 py-2">融資想定</th>
                      <th className="text-right px-4 py-2">自己資金</th>
                      <th className="text-center px-4 py-2">判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBanks.map((b) => (
                      <tr key={b.bankId} className="border-t">
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {b.note}
                          </div>
                          {!b.feasible && (
                            <div className="text-xs text-red-600 mt-0.5">
                              耐用年数残不足のため対象外
                            </div>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">
                          {yen(b.estimatedValuationYen)}
                        </td>
                        <td className="text-right px-4 py-3">
                          {Math.round(b.loanToValueRatio * 100)}%
                        </td>
                        <td className="text-right px-4 py-3 font-semibold">
                          {yen(b.estimatedLoanYen)}
                        </td>
                        <td className="text-right px-4 py-3">
                          {yen(b.ownFundsRequiredYen)}
                        </td>
                        <td className="text-center px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${judgementColor(
                              b.judgement
                            )}`}
                          >
                            {b.judgement}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 leading-relaxed">
                ※ 本シミュレーターは標準的な掛け目・耐用年数・再調達原価から算出した目安です。
                実融資条件は個別審査・属性・取引履歴で変動します。
                仕入れ判断は本数値をベースに、実際の銀行ヒアリング（事前申込）で確定してください。
              </div>
            </>
          )}
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

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="number"
      className="w-full border rounded px-3 py-2 bg-background"
      value={value}
      onChange={onChange}
      min={0}
    />
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground mt-1">{children}</p>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="font-semibold mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={emphasize ? "font-bold text-lg" : "font-medium"}>{value}</span>
    </div>
  );
}
