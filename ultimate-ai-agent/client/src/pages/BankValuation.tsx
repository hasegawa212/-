import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type {
  ValuationInput,
  ValuationResult,
  StructureType,
  PropertyType,
  AreaTier,
  RoadFrontageType,
  LandParcelDetail,
} from "@shared/types";
import { Button } from "@/components/ui/button";

const initialLandDetail: LandParcelDetail = {
  frontageM: 10,
  depthM: 15,
  kagechiPercent: 0,
  roadFrontageType: "single",
  accessWidthM: 10,
  roadWidthM: 5,
  floorAreaRatioPercent: 200,
};

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
  landDetail: initialLandDetail,
};

const ROAD_FRONTAGE_OPTIONS: { value: RoadFrontageType; label: string }[] = [
  { value: "single", label: "単一路線（標準）" },
  { value: "corner", label: "角地（側方路線あり）" },
  { value: "semiCorner", label: "準角地" },
  { value: "twoSides", label: "二方路線" },
];

function yen(v: number): string {
  if (!isFinite(v)) return "—";
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)} 億円`;
  if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(0)} 万円`;
  return `${Math.round(v).toLocaleString()} 円`;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loadDealId = searchParams.get("loadDealId");

  const [input, setInput] = useState<ValuationInput>(initialInput);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDealCode, setSavedDealCode] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const metaQuery = trpc.bankValuation.metadata.useQuery();
  const calcMutation = trpc.bankValuation.calculate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSavedDealCode(null);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  // 履歴から呼び戻し
  const loadDealQuery = trpc.bankValuationDeals.get.useQuery(
    { id: Number(loadDealId) },
    { enabled: !!loadDealId }
  );
  useEffect(() => {
    if (loadDealQuery.data) {
      setInput(loadDealQuery.data.input);
      setResult(loadDealQuery.data.result);
      setTitle(loadDealQuery.data.title);
      setSavedDealCode(loadDealQuery.data.dealCode);
    }
  }, [loadDealQuery.data]);

  const createDealMutation = trpc.bankValuationDeals.create.useMutation({
    onSuccess: (data) => {
      setSavedDealCode(data.dealCode);
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

  const handleLandDetail = <K extends keyof LandParcelDetail>(
    key: K,
    value: LandParcelDetail[K]
  ) => {
    setInput((prev) => ({ ...prev, landDetail: { ...prev.landDetail, [key]: value } }));
  };

  const handleLandDetailNumber = (key: keyof LandParcelDetail) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const v = e.target.value === "" ? 0 : Number(e.target.value);
    handleLandDetail(key, v as LandParcelDetail[typeof key]);
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
    return result.banks.slice().sort((a, b) => b.estimatedLoanYen - a.estimatedLoanYen);
  }, [result]);

  if (!metaQuery.data) return <div className="p-6">読み込み中…</div>;
  const meta = metaQuery.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold">銀行評価額シミュレーター</h1>
          <p className="text-sm text-muted-foreground mt-1">
            物件情報を入力すると、積算・収益評価から銀行別の融資想定額と A/B/C 判定を出します。
            国税庁 路線価補正（奥行・間口・形状・接道）を反映した実物件レベルの土地評価に対応。
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/deal-history")}>
          案件履歴 / 実績
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 入力フォーム */}
        <div className="lg:col-span-1 bg-card rounded-lg border p-5 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
          <Section title="物件種別 / エリア">
            <Field label="物件種別">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={input.propertyType}
                onChange={(e) => handleChange("propertyType", e.target.value as PropertyType)}
              >
                {meta.propertyTypes.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="エリア種別">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={input.areaTier}
                onChange={(e) => handleChange("areaTier", e.target.value as AreaTier)}
              >
                {meta.areaTiers.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="土地基本">
            <Field label="土地面積（㎡）">
              <NumberInput value={input.landAreaSqm} onChange={handleNumber("landAreaSqm")} />
            </Field>
            <Field label="路線価（円/㎡）">
              <NumberInput value={input.rosenkaPerSqm} onChange={handleNumber("rosenkaPerSqm")} />
              <Hint>不明な場合は 公示価格 × 0.8 で代用</Hint>
            </Field>
          </Section>

          <Section title="土地詳細（路線価補正）">
            <div className="grid grid-cols-2 gap-3">
              <Field label="間口（m）">
                <NumberInput
                  value={input.landDetail.frontageM}
                  onChange={handleLandDetailNumber("frontageM")}
                />
              </Field>
              <Field label="奥行（m）">
                <NumberInput
                  value={input.landDetail.depthM}
                  onChange={handleLandDetailNumber("depthM")}
                />
              </Field>
            </div>
            <Field label="形状（かげ地割合 %）">
              <NumberInput
                value={input.landDetail.kagechiPercent}
                onChange={handleLandDetailNumber("kagechiPercent")}
              />
              <Hint>整形地は 0、欠けが大きいほど補正率↑</Hint>
            </Field>
            <Field label="接道タイプ">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={input.landDetail.roadFrontageType}
                onChange={(e) =>
                  handleLandDetail("roadFrontageType", e.target.value as RoadFrontageType)
                }
              >
                {ROAD_FRONTAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="接道幅員（m）">
                <NumberInput
                  value={input.landDetail.accessWidthM}
                  onChange={handleLandDetailNumber("accessWidthM")}
                />
                <Hint>2m 未満は再建築不可</Hint>
              </Field>
              <Field label="前面道路幅員（m）">
                <NumberInput
                  value={input.landDetail.roadWidthM}
                  onChange={handleLandDetailNumber("roadWidthM")}
                />
                <Hint>4m 未満は 2 項道路</Hint>
              </Field>
            </div>
            <Field label="容積率（%）">
              <NumberInput
                value={input.landDetail.floorAreaRatioPercent}
                onChange={handleLandDetailNumber("floorAreaRatioPercent")}
              />
              <Hint>消化率が低いと建物評価が減価</Hint>
            </Field>
          </Section>

          {!isLandOnly && (
            <Section title="建物">
              <Field label="建物構造">
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={input.structure ?? "wood"}
                  onChange={(e) => handleChange("structure", e.target.value as StructureType)}
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
                <Hint>満室想定</Hint>
              </Field>
            </Section>
          )}

          <Section title="価格">
            <Field label="売出価格（円）">
              <NumberInput
                value={input.askingPriceYen}
                onChange={handleNumber("askingPriceYen")}
              />
            </Field>
          </Section>

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
              <div className={`rounded-lg border-2 p-5 ${judgementColor(result.summary.overallJudgement)}`}>
                <div className="text-sm font-medium">総合判定</div>
                <div className="text-2xl font-bold mt-1">
                  {judgementLabel(result.summary.overallJudgement)}
                </div>
                <div className="text-sm mt-2">
                  最良条件：{meta.banks.find((b) => b.id === result.summary.bestBankId)?.label} /
                  融資想定 {yen(result.summary.bestLoanYen)} / 自己資金 {yen(result.summary.minOwnFundsYen)}
                </div>
              </div>

              {/* 案件保存 */}
              <div className="bg-card rounded-lg border p-4 flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  className="flex-1 min-w-[200px] border rounded px-3 py-2 bg-background text-sm"
                  placeholder="物件メモ（例: A 区 ◯◯町 中古一棟）"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Button
                  onClick={() =>
                    createDealMutation.mutate({
                      title: title || "（メモなし）",
                      input,
                      result,
                      note: "",
                    })
                  }
                  disabled={createDealMutation.isPending || !!savedDealCode}
                >
                  {savedDealCode
                    ? `保存済 (${savedDealCode})`
                    : createDealMutation.isPending
                    ? "保存中…"
                    : "この計算結果を案件として保存"}
                </Button>
                {savedDealCode && (
                  <Button variant="outline" onClick={() => navigate("/deal-history")}>
                    履歴を見る
                  </Button>
                )}
              </div>

              {/* 土地評価 詳細 */}
              <Card title="積算評価額 — 土地（路線価補正の内訳）">
                <div className="space-y-1.5 text-sm">
                  <Row
                    label="路線価ベース（路線価 × 面積）"
                    value={yen(result.cost.landBreakdown.baseLandValueYen)}
                  />
                  <FactorRow
                    label="奥行価格補正率"
                    factor={result.cost.landBreakdown.depthPriceFactor}
                  />
                  <FactorRow
                    label="間口狭小補正率"
                    factor={result.cost.landBreakdown.narrowFrontageFactor}
                  />
                  <FactorRow
                    label="奥行長大補正率"
                    factor={result.cost.landBreakdown.depthRatioFactor}
                  />
                  <FactorRow
                    label="不整形地補正率"
                    factor={result.cost.landBreakdown.irregularShapeFactor}
                  />
                  <FactorRow
                    label="側方／二方路線加算"
                    factor={1 + result.cost.landBreakdown.roadFrontageAddition}
                  />
                  <FactorRow
                    label={`接道補正（${result.cost.landBreakdown.roadAccessNote}）`}
                    factor={result.cost.landBreakdown.roadAccessFactor}
                  />
                  <Row
                    label="補正後（路線価補正の積）"
                    value={`× ${result.cost.landBreakdown.combinedAdjustmentFactor}`}
                  />
                  <Row
                    label="補正後 土地評価"
                    value={yen(result.cost.landBreakdown.adjustedLandValueYen)}
                  />
                  <Row
                    label={`エリア補正（× ${result.cost.landBreakdown.areaMultiplier}）`}
                    value={yen(result.cost.landBreakdown.finalLandValueYen)}
                    emphasize
                  />
                </div>
              </Card>

              {/* 建物 + 収益 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="積算評価額 — 建物（減価内訳）">
                  {result.cost.buildingReplacementCostBaseYen > 0 && (
                    <>
                      <Row
                        label="再調達原価（全国平均）"
                        value={yen(result.cost.buildingReplacementCostBaseYen)}
                      />
                      <FactorRow
                        label={`地域別建築費補正（× ${result.cost.buildingBuildCostMultiplier.toFixed(2)}）`}
                        factor={result.cost.buildingBuildCostMultiplier}
                      />
                      <Row
                        label="再調達原価（補正後）"
                        value={yen(result.cost.buildingReplacementCostAdjustedYen)}
                      />
                      <Row
                        label={`減価率（残価率 ${pct(result.cost.buildingResidualRatio)} floor）`}
                        value={`× ${result.cost.buildingDepreciationFactor.toFixed(3)}`}
                      />
                    </>
                  )}
                  <Row
                    label={`残存耐用年数 / 法定 ${result.cost.buildingLegalLifeYears} 年`}
                    value={`${result.cost.remainingLifeYears} 年`}
                  />
                  {result.cost.buildingFarUtilization < 1 && (
                    <>
                      <Row
                        label="容積率消化率"
                        value={pct(result.cost.buildingFarUtilization)}
                      />
                      <Row
                        label="消化率補正"
                        value={`× ${result.cost.buildingFarFactor}`}
                      />
                    </>
                  )}
                  <Row
                    label="建物評価"
                    value={yen(result.cost.buildingValuationYen)}
                    emphasize
                  />
                  <Row
                    label="積算合計（土地 + 建物）"
                    value={yen(result.cost.totalYen)}
                    emphasize
                  />
                </Card>
                <Card title="収益還元評価額">
                  {result.income.applies ? (
                    <>
                      <Row
                        label="採用還元利回り"
                        value={`${result.income.capRatePercent} %`}
                      />
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
                          <div className="text-xs text-muted-foreground mt-0.5">{b.note}</div>
                          {b.calibrationApplied && (
                            <div className="text-xs text-blue-700 mt-0.5">
                              📊 実績校正済（{b.calibrationSampleCount} 件、補正 ×{b.calibrationMultiplier.toFixed(3)}）
                            </div>
                          )}
                          {!b.feasible && (
                            <div className="text-xs text-red-600 mt-0.5">
                              耐用年数残不足のため対象外
                            </div>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">{yen(b.estimatedValuationYen)}</td>
                        <td className="text-right px-4 py-3">
                          {Math.round(b.loanToValueRatio * 100)}%
                        </td>
                        <td className="text-right px-4 py-3 font-semibold">
                          {yen(b.estimatedLoanYen)}
                        </td>
                        <td className="text-right px-4 py-3">{yen(b.ownFundsRequiredYen)}</td>
                        <td className="text-center px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${judgementColor(b.judgement)}`}
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
                ※ 路線価補正は国税庁「土地及び土地の上に存する権利の評価明細書」付表に準拠（普通住宅地区）。
                掛け目・耐用年数・再調達原価は標準値であり、実融資条件は個別審査・属性・取引履歴で変動します。
                仕入れ判断は本数値をベースに、実際の銀行ヒアリング（事前申込）で確定してください。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground border-b pb-1">{title}</h3>
      {children}
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
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
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

function FactorRow({ label, factor }: { label: string; factor: number }) {
  if (Math.abs(factor - 1) < 0.0001) {
    return (
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>× 1.000（補正なし）</span>
      </div>
    );
  }
  const delta = factor - 1;
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className={delta < 0 ? "text-red-600" : "text-green-700"}>
        × {factor.toFixed(3)}（{sign}{(delta * 100).toFixed(1)}%）
      </span>
    </div>
  );
}
