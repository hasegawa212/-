import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  appraiseCar,
  CAR_MODELS,
  MAKER_OPTIONS,
  type AppraisalResult,
} from "@/lib/valuation";
import { Field, Select, TextInput } from "./ui/Field";

interface Props {
  onResult: (result: AppraisalResult) => void;
}

const CURRENT_YEAR = new Date().getFullYear();

export function CarForm({ onResult }: Props) {
  const [modelIndex, setModelIndex] = useState("0");
  const [newPrice, setNewPrice] = useState(String(CAR_MODELS[0].newPrice));
  const [maker, setMaker] = useState(CAR_MODELS[0].maker);
  const [firstYear, setFirstYear] = useState(String(CURRENT_YEAR - 5));
  const [mileageKm, setMileageKm] = useState("50000");
  const [repairHistory, setRepairHistory] = useState(false);
  const [inspectionMonthsLeft, setInspectionMonthsLeft] = useState("12");

  /** 車種プリセットを選ぶと新車価格・メーカーを自動補完 */
  function handleModelChange(value: string) {
    setModelIndex(value);
    const idx = Number(value);
    if (idx >= 0 && CAR_MODELS[idx]) {
      setNewPrice(String(CAR_MODELS[idx].newPrice));
      setMaker(CAR_MODELS[idx].maker);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onResult(
      appraiseCar({
        newPrice: Number(newPrice) || 0,
        firstYear: Number(firstYear) || CURRENT_YEAR,
        currentYear: CURRENT_YEAR,
        mileageKm: Number(mileageKm) || 0,
        maker,
        repairHistory,
        inspectionMonthsLeft: Number(inspectionMonthsLeft) || 0,
      })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Field label="車種（プリセット）" htmlFor="car-model" hint="選ぶと新車価格とメーカーが自動入力されます。">
        <Select id="car-model" value={modelIndex} onChange={(e) => handleModelChange(e.target.value)}>
          <option value="-1">手入力する</option>
          {CAR_MODELS.map((m, i) => (
            <option key={`${m.maker}-${m.model}`} value={i}>
              {m.maker} {m.model}（新車 {(m.newPrice / 10000).toLocaleString()}万円）
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="メーカー" htmlFor="car-maker">
          <Select id="car-maker" value={maker} onChange={(e) => setMaker(e.target.value)}>
            {MAKER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="新車時価格（円）" htmlFor="car-price">
          <TextInput
            id="car-price"
            type="number"
            min="0"
            step="10000"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="初度登録年（西暦）" htmlFor="car-year">
          <TextInput
            id="car-year"
            type="number"
            min="1980"
            max={String(CURRENT_YEAR)}
            value={firstYear}
            onChange={(e) => setFirstYear(e.target.value)}
          />
        </Field>
        <Field label="走行距離（km）" htmlFor="car-mileage">
          <TextInput
            id="car-mileage"
            type="number"
            min="0"
            step="1000"
            value={mileageKm}
            onChange={(e) => setMileageKm(e.target.value)}
          />
        </Field>
      </div>

      <Field label="車検残（月）" htmlFor="car-inspection">
        <TextInput
          id="car-inspection"
          type="number"
          min="0"
          max="36"
          value={inspectionMonthsLeft}
          onChange={(e) => setInspectionMonthsLeft(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={repairHistory}
          onChange={(e) => setRepairHistory(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        修復歴あり（事故による骨格部位の修正・交換）
      </label>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Calculator className="h-4 w-4" />
        査定する
      </button>
    </form>
  );
}
