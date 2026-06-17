import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  appraiseHybrid,
  AREA_GROUPS,
  CITY_OPTIONS,
  STRUCTURE_SPEC,
  type AppraisalResult,
  type Grade,
  type PropertyType,
  type Structure,
} from "@/lib/valuation";
import { Field, Select, TextInput } from "./ui/Field";
import { SegmentedControl } from "./ui/SegmentedControl";

interface Props {
  onResult: (result: AppraisalResult) => void;
}

const PROPERTY_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "house", label: "戸建" },
  { value: "apartment", label: "マンション" },
  { value: "land", label: "土地" },
];

const GRADE_OPTIONS: { value: Grade; label: string }[] = [
  { value: "standard", label: "標準" },
  { value: "high", label: "上位グレード" },
  { value: "luxury", label: "ハイグレード" },
];

export function RealEstateForm({ onResult }: Props) {
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [city, setCity] = useState(CITY_OPTIONS[0]);
  const [landArea, setLandArea] = useState("150");
  const [buildingArea, setBuildingArea] = useState("100");
  const [buildAge, setBuildAge] = useState("10");
  const [structure, setStructure] = useState<Structure>("wood");
  const [walkMinutes, setWalkMinutes] = useState("10");
  const [grade, setGrade] = useState<Grade>("standard");
  const [renovated, setRenovated] = useState(false);

  const showLand = propertyType !== "apartment";
  const showBuilding = propertyType !== "land";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onResult(
      appraiseHybrid({
        propertyType,
        city,
        landArea: showLand ? Number(landArea) || 0 : 0,
        buildingArea: showBuilding ? Number(buildingArea) || 0 : 0,
        buildAge: showBuilding ? Number(buildAge) || 0 : 0,
        structure,
        walkMinutes: Number(walkMinutes) || 0,
        grade: showBuilding ? grade : undefined,
        renovated: showBuilding ? renovated : false,
      })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-brand-200/60 bg-white p-6 shadow-card">
      <Field label="物件種別">
        <SegmentedControl options={PROPERTY_OPTIONS} value={propertyType} onChange={setPropertyType} />
      </Field>

      <Field label="所在地（茨城県・首都圏）" htmlFor="re-city">
        <Select id="re-city" value={city} onChange={(e) => setCity(e.target.value)}>
          {AREA_GROUPS.map((g) => (
            <optgroup key={g.region} label={g.region}>
              {g.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        {showLand && (
          <Field label="土地面積（㎡）" htmlFor="re-land">
            <TextInput
              id="re-land"
              type="number"
              min="0"
              value={landArea}
              onChange={(e) => setLandArea(e.target.value)}
            />
          </Field>
        )}
        {showBuilding && (
          <Field label={propertyType === "apartment" ? "専有面積（㎡）" : "建物面積（㎡）"} htmlFor="re-building">
            <TextInput
              id="re-building"
              type="number"
              min="0"
              value={buildingArea}
              onChange={(e) => setBuildingArea(e.target.value)}
            />
          </Field>
        )}
      </div>

      {showBuilding && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="築年数（年）" htmlFor="re-age">
            <TextInput
              id="re-age"
              type="number"
              min="0"
              value={buildAge}
              onChange={(e) => setBuildAge(e.target.value)}
            />
          </Field>
          {propertyType === "house" && (
            <Field label="建物構造" htmlFor="re-structure">
              <Select
                id="re-structure"
                value={structure}
                onChange={(e) => setStructure(e.target.value as Structure)}
              >
                {(Object.keys(STRUCTURE_SPEC) as Structure[]).map((s) => (
                  <option key={s} value={s}>
                    {STRUCTURE_SPEC[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      <Field label="最寄駅まで徒歩（分）" htmlFor="re-walk" hint="駅から遠いほど評価は下がります。">
        <TextInput
          id="re-walk"
          type="number"
          min="0"
          value={walkMinutes}
          onChange={(e) => setWalkMinutes(e.target.value)}
        />
      </Field>

      {showBuilding && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="内装グレード" htmlFor="re-grade">
            <Select id="re-grade" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="リフォーム/リノベ">
            <label className="flex h-[38px] items-center gap-2.5 text-sm text-brand-700">
              <input
                type="checkbox"
                checked={renovated}
                onChange={(e) => setRenovated(e.target.checked)}
                className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-gold-400"
              />
              リフォーム/リノベ済み
            </label>
          </Field>
        </div>
      )}

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-2.5 text-sm font-semibold text-cream shadow-luxe ring-1 ring-gold-400/30 transition hover:from-brand-700 hover:to-brand-800"
      >
        <Calculator className="h-4 w-4" />
        査定する
      </button>
    </form>
  );
}
