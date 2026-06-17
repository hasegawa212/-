import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  evaluateInvestment,
  WARD_RENT_WARDS,
  type InvestmentResult,
} from "@/lib/valuation";
import { Field, Select, TextInput } from "./ui/Field";

interface Props {
  onResult: (result: InvestmentResult) => void;
}

export function InvestmentForm({ onResult }: Props) {
  const [price, setPrice] = useState("25800000");
  const [ward, setWard] = useState(WARD_RENT_WARDS[0]);
  const [areaSqm, setAreaSqm] = useState("25");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("12000");
  const [monthlyLoan, setMonthlyLoan] = useState("90000");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onResult(
      evaluateInvestment({
        price: Number(price) || 0,
        ward,
        areaSqm: Number(areaSqm) || 0,
        monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
        monthlyCost: Number(monthlyCost) || 0,
        monthlyLoan: Number(monthlyLoan) || 0,
      })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-brand-200/60 bg-white p-6 shadow-card">
      <Field label="物件価格（円）" htmlFor="inv-price">
        <TextInput
          id="inv-price"
          type="number"
          min="0"
          step="100000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="エリア（東京23区）" htmlFor="inv-ward">
          <Select id="inv-ward" value={ward} onChange={(e) => setWard(e.target.value)}>
            {WARD_RENT_WARDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="専有面積（㎡）" htmlFor="inv-area">
          <TextInput
            id="inv-area"
            type="number"
            min="0"
            step="0.5"
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="月額家賃（円）"
        htmlFor="inv-rent"
        hint="空欄ならエリア相場（SUUMO連携）から自動推定します。"
      >
        <TextInput
          id="inv-rent"
          type="number"
          min="0"
          step="1000"
          placeholder="未入力で相場推定"
          value={monthlyRent}
          onChange={(e) => setMonthlyRent(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="管理費・修繕積立金（円/月）" htmlFor="inv-cost">
          <TextInput
            id="inv-cost"
            type="number"
            min="0"
            step="1000"
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(e.target.value)}
          />
        </Field>
        <Field label="ローン返済（円/月）" htmlFor="inv-loan" hint="現金購入は0。">
          <TextInput
            id="inv-loan"
            type="number"
            min="0"
            step="1000"
            value={monthlyLoan}
            onChange={(e) => setMonthlyLoan(e.target.value)}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-2.5 text-sm font-semibold text-cream shadow-luxe ring-1 ring-gold-400/30 transition hover:from-brand-700 hover:to-brand-800"
      >
        <Calculator className="h-4 w-4" />
        利回りを評価する
      </button>
    </form>
  );
}
