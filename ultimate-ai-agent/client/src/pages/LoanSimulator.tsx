import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type {
  LoanSimulationInput,
  LoanSimulationResult,
  PropertyKind,
  RepaymentMethod,
} from "@shared/types";
import { Button } from "@/components/ui/button";

const initialInput: LoanSimulationInput = {
  property: {
    priceYen: 40_000_000,
    kind: "usedHouse",
    ageYears: 15,
    prefecture: "茨城県",
    hasRoadAccessIssue: false,
  },
  ownFundsYen: 2_000_000,
  loanAmountYen: 0,
  loanTermYears: 35,
  repaymentMethod: "annuity",
  borrower: {
    ageYears: 40,
    annualIncomeYen: 5_000_000,
    employmentType: "salaryman",
    yearsOfEmployment: 5,
    existingDebtMonthlyYen: 0,
    isSingle: false,
    hasInsuranceConcern: false,
    hasCreditConcern: false,
  },
  prepaymentAmountYen: 0,
  prepaymentAfterYears: 10,
  prepaymentMode: "shorten",
  variableRateShockPercent: 0,
};

function yen(v: number): string {
  if (!isFinite(v)) return "—";
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)} 億円`;
  if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(0)} 万円`;
  return `${Math.round(v).toLocaleString()} 円`;
}

function riskColor(level: "high" | "medium" | "low"): string {
  return level === "high"
    ? "bg-red-100 text-red-800 border-red-300"
    : level === "medium"
    ? "bg-yellow-100 text-yellow-800 border-yellow-300"
    : "bg-blue-100 text-blue-800 border-blue-300";
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-700 bg-green-50";
  if (score >= 50) return "text-yellow-700 bg-yellow-50";
  if (score >= 25) return "text-orange-700 bg-orange-50";
  return "text-red-700 bg-red-50";
}

export default function LoanSimulator() {
  const [input, setInput] = useState<LoanSimulationInput>(initialInput);
  const [result, setResult] = useState<LoanSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"banks" | "products" | "risks">("banks");

  const simMutation = trpc.loanSimulator.simulate.useMutation({
    onSuccess: (data) => {
      setResult(data as unknown as LoanSimulationResult);
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const setProperty = <K extends keyof LoanSimulationInput["property"]>(
    key: K,
    value: LoanSimulationInput["property"][K]
  ) => {
    setInput((p) => ({ ...p, property: { ...p.property, [key]: value } }));
  };

  const setBorrower = <K extends keyof LoanSimulationInput["borrower"]>(
    key: K,
    value: LoanSimulationInput["borrower"][K]
  ) => {
    setInput((p) => ({ ...p, borrower: { ...p.borrower, [key]: value } }));
  };

  const numHandler = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(e.target.value === "" ? 0 : Number(e.target.value));

  const submit = () => simMutation.mutate(input);

  const passingBanks = result?.bankFitScores?.filter((b) => b.score >= 50) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">住宅ローン シミュレーター（プロ版）</h1>
        <p className="text-sm text-muted-foreground mt-1">
          27 行の実銀行データ + 30 件の自社否決事例から、属性・物件条件に合う銀行と否決リスクを提示します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 入力 */}
        <div className="lg:col-span-1 bg-card rounded-lg border p-5 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          <Section title="物件">
            <Field label="物件価格（円）">
              <NumberInput
                value={input.property.priceYen}
                onChange={numHandler((v) => setProperty("priceYen", v))}
              />
            </Field>
            <Field label="物件種別">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={input.property.kind}
                onChange={(e) => setProperty("kind", e.target.value as PropertyKind)}
              >
                <option value="newCondo">新築マンション</option>
                <option value="usedHouse">中古住宅</option>
                <option value="investment">投資用</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="築年数">
                <NumberInput
                  value={input.property.ageYears}
                  onChange={numHandler((v) => setProperty("ageYears", v))}
                />
              </Field>
              <Field label="都道府県">
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={input.property.prefecture}
                  onChange={(e) => setProperty("prefecture", e.target.value)}
                  placeholder="例: 茨城県"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={input.property.hasRoadAccessIssue}
                onChange={(e) => setProperty("hasRoadAccessIssue", e.target.checked)}
              />
              接道義務違反の可能性あり
            </label>
          </Section>

          <Section title="借入条件">
            <Field label="自己資金（円）">
              <NumberInput
                value={input.ownFundsYen}
                onChange={numHandler((v) => setInput((p) => ({ ...p, ownFundsYen: v })))}
              />
            </Field>
            <Field label="借入額（円・0 で物件価格 − 自己資金）">
              <NumberInput
                value={input.loanAmountYen}
                onChange={numHandler((v) => setInput((p) => ({ ...p, loanAmountYen: v })))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="返済期間（年）">
                <NumberInput
                  value={input.loanTermYears}
                  onChange={numHandler((v) => setInput((p) => ({ ...p, loanTermYears: v })))}
                />
              </Field>
              <Field label="返済方式">
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={input.repaymentMethod}
                  onChange={(e) =>
                    setInput((p) => ({ ...p, repaymentMethod: e.target.value as RepaymentMethod }))
                  }
                >
                  <option value="annuity">元利均等</option>
                  <option value="equalPrincipal">元金均等</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="借入人属性">
            <div className="grid grid-cols-2 gap-3">
              <Field label="年齢">
                <NumberInput
                  value={input.borrower.ageYears}
                  onChange={numHandler((v) => setBorrower("ageYears", v))}
                />
              </Field>
              <Field label="年収（円）">
                <NumberInput
                  value={input.borrower.annualIncomeYen}
                  onChange={numHandler((v) => setBorrower("annualIncomeYen", v))}
                />
              </Field>
            </div>
            <Field label="職業">
              <select
                className="w-full border rounded px-3 py-2 bg-background"
                value={input.borrower.employmentType}
                onChange={(e) =>
                  setBorrower("employmentType", e.target.value as LoanSimulationInput["borrower"]["employmentType"])
                }
              >
                <option value="salaryman">会社員</option>
                <option value="executive">役員</option>
                <option value="soleProprietor">個人事業主</option>
                <option value="companyOwner">法人代表者</option>
                <option value="other">その他</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="勤続年数">
                <NumberInput
                  value={input.borrower.yearsOfEmployment}
                  onChange={numHandler((v) => setBorrower("yearsOfEmployment", v))}
                />
              </Field>
              <Field label="他借入月返済（円）">
                <NumberInput
                  value={input.borrower.existingDebtMonthlyYen}
                  onChange={numHandler((v) => setBorrower("existingDebtMonthlyYen", v))}
                />
              </Field>
            </div>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={input.borrower.isSingle}
                  onChange={(e) => setBorrower("isSingle", e.target.checked)}
                />
                単身者
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={input.borrower.hasInsuranceConcern}
                  onChange={(e) => setBorrower("hasInsuranceConcern", e.target.checked)}
                />
                団信告知事項あり
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={input.borrower.hasCreditConcern}
                  onChange={(e) => setBorrower("hasCreditConcern", e.target.checked)}
                />
                個信記録の懸念あり
              </label>
            </div>
          </Section>

          <Section title="シミュレーション オプション">
            <Field label="繰上返済額（円）">
              <NumberInput
                value={input.prepaymentAmountYen}
                onChange={numHandler((v) => setInput((p) => ({ ...p, prepaymentAmountYen: v })))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="繰上タイミング（年後）">
                <NumberInput
                  value={input.prepaymentAfterYears}
                  onChange={numHandler((v) => setInput((p) => ({ ...p, prepaymentAfterYears: v })))}
                />
              </Field>
              <Field label="繰上モード">
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={input.prepaymentMode}
                  onChange={(e) =>
                    setInput((p) => ({ ...p, prepaymentMode: e.target.value as "shorten" | "reduce" }))
                  }
                >
                  <option value="shorten">期間短縮</option>
                  <option value="reduce">返済額軽減</option>
                </select>
              </Field>
            </div>
            <Field label="変動金利上昇シナリオ（%・5年後想定）">
              <NumberInput
                value={input.variableRateShockPercent}
                onChange={numHandler((v) =>
                  setInput((p) => ({ ...p, variableRateShockPercent: v }))
                )}
              />
            </Field>
          </Section>

          <Button onClick={submit} disabled={simMutation.isPending} className="w-full">
            {simMutation.isPending ? "計算中…" : "シミュレーション実行"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* 結果 */}
        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="bg-card rounded-lg border p-10 text-center text-muted-foreground">
              左の入力を埋めて「シミュレーション実行」を押してください。
              <br />
              <span className="text-xs">27 行の実銀行データ + 30 件の自社否決事例で審査します。</span>
            </div>
          ) : (
            <>
              {/* リスク警告（最上段・最重要） */}
              {result.riskAlerts.length > 0 && (
                <div className="space-y-2">
                  {result.riskAlerts.map((a, i) => (
                    <div key={i} className={`rounded-lg border-2 p-4 ${riskColor(a.riskLevel)}`}>
                      <div className="font-bold text-sm">
                        {a.riskLevel === "high" ? "⚠️ 高リスク" : a.riskLevel === "medium" ? "⚡ 中リスク" : "ℹ️ 注意"} —{" "}
                        {a.category}
                      </div>
                      <div className="text-sm mt-1">{a.message}</div>
                      <div className="text-sm mt-1 font-medium">推奨アクション: {a.recommendedAction}</div>
                      {a.similarCaseIds.length > 0 && (
                        <div className="text-xs mt-1 opacity-80">
                          類似過去事例: {a.similarCaseIds.join(", ")}（自社実績ベース）
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* タブ切替 */}
              <div className="flex gap-2 border-b">
                <TabButton active={activeTab === "banks"} onClick={() => setActiveTab("banks")}>
                  銀行マッチング（{passingBanks.length} 行通過）
                </TabButton>
                <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
                  商品別シミュ（{result.products.length}）
                </TabButton>
                <TabButton active={activeTab === "risks"} onClick={() => setActiveTab("risks")}>
                  否決統計
                </TabButton>
              </div>

              {activeTab === "banks" && (
                <div className="bg-card rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-4 py-2">スコア</th>
                        <th className="text-left px-4 py-2">銀行</th>
                        <th className="text-left px-4 py-2">区分</th>
                        <th className="text-right px-4 py-2">事前/本</th>
                        <th className="text-right px-4 py-2">審査金利</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bankFitScores.slice(0, 15).map((b) => (
                        <tr key={b.bankId} className="border-t">
                          <td className={`px-4 py-3 font-bold ${scoreColor(b.score)}`}>
                            {b.score}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{b.bankName}</div>
                            {b.matchReasons.length > 0 && (
                              <div className="text-xs text-green-700 mt-0.5">
                                ✓ {b.matchReasons.slice(0, 2).join(" / ")}
                              </div>
                            )}
                            {b.warnings.length > 0 && (
                              <div className="text-xs text-red-700 mt-0.5">
                                ✗ {b.warnings.slice(0, 2).join(" / ")}
                              </div>
                            )}
                            {b.strengths.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                強み: {b.strengths.slice(0, 2).join(" / ")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">{b.category}</td>
                          <td className="text-right px-4 py-3 text-xs">
                            {b.preliminaryReviewDays.min}〜{b.preliminaryReviewDays.max}日
                            <br />/ {b.fullReviewDays.min}〜{b.fullReviewDays.max}日
                          </td>
                          <td className="text-right px-4 py-3 text-xs">
                            {b.reviewRatePercent.min}〜{b.reviewRatePercent.max}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "products" && (
                <div className="bg-card rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-4 py-2">商品</th>
                        <th className="text-right px-4 py-2">月返済</th>
                        <th className="text-right px-4 py-2">総返済</th>
                        <th className="text-right px-4 py-2">利息</th>
                        <th className="text-center px-4 py-2">審査</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.products.map((p) => (
                        <tr key={p.productId} className="border-t">
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.bankLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.productLabel} / {p.effectiveRatePercent}%
                            </div>
                          </td>
                          <td className="text-right px-4 py-3 font-semibold">
                            {yen(p.monthlyPaymentYen)}
                          </td>
                          <td className="text-right px-4 py-3">{yen(p.totalPaymentYen)}</td>
                          <td className="text-right px-4 py-3 text-xs">{yen(p.totalInterestYen)}</td>
                          <td className="text-center px-4 py-3">
                            {p.screening.pass ? (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                                通過
                              </span>
                            ) : (
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800"
                                title={p.screening.reasons.join(" / ")}
                              >
                                NG
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "risks" && (
                <div className="bg-card rounded-lg border p-5 space-y-3">
                  <div className="text-sm">
                    自社過去 <strong>{result.rejectionStats.totalCases}</strong> 件の否決事例（
                    {result.rejectionStats.uniqueCustomers} 顧客）
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-2">最頻出パターン Top 5</div>
                    <ul className="space-y-1">
                      {result.rejectionStats.topPatterns.map((p, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span>{p.tag}</span>
                          <span className="font-mono">{p.count} 件</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 leading-relaxed">
                ※ 銀行プロファイルは「住宅ローン 金融機関別 審査スピード特徴」（社内運用実績）+「金融機関情報」地銀シート（実取引データ）から構築。
                否決事例は Slack 全期間遡り調査 30 件を匿名化（顧客 ID 化）。
                実際の融資条件は個別審査で変動します。
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
