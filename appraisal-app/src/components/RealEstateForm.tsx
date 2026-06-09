import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  appraiseRealEstate,
  CITY_OPTIONS,
  STRUCTURE_SPEC,
  type AppraisalResult,
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

export function RealEstateForm({ onResult }: Props) {
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [city, setCity] = useState(CITY_OPTIONS[0]);
  const [landArea, setLandArea] = useState("150");
  const [buildingArea, setBuildingArea] = useState("100");
  const [buildAge, setBuildAge] = useState("10");
  const [structure, setStructure] = useState<Structure>("wood");
  const [walkMinutes, setWalkMinutes] = useState("10");

  const showLand = propertyType !== "apartment";
  const showBuilding = propertyType !== "land";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onResult(
      appraiseRealEstate({
        propertyType,
        city,
        landArea: showLand ? Number(landArea) || 0 : 0,
        buildingArea: showBuilding ? Number(buildingArea) || 0 : 0,
        buildAge: showBuilding ? Number(buildAge) || 0 : 0,
        structure,
        walkMinutes: Number(walkMinutes) || 0,
      })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Field label="物件種別">
        <SegmentedControl options={PROPERTY_OPTIONS} value={propertyType} onChange={setPropertyType} />
      </Field>

      <Field label="所在地（茨城県）" htmlFor="re-city">
        <Select id="re-city" value={city} onChange={(e) => setCity(e.target.value)}>
          {CITY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
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
