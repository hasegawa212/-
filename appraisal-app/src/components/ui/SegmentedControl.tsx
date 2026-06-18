interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** ラジオ的に1つ選ぶトグル群 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-brand-200/70 bg-white/70 p-1 shadow-card backdrop-blur">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-b from-brand-600 to-brand-700 text-cream shadow-luxe ring-1 ring-gold-400/40"
                : "text-brand-400 hover:text-brand-600"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
