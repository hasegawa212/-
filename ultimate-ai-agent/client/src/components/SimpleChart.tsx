import { cn } from "@/lib/utils";

interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  maxValue?: number;
  className?: string;
  barColor?: string;
}

export function SimpleBarChart({ data, maxValue, className, barColor = "bg-primary" }: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("space-y-2", className)}>
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-16 text-right truncate">{item.label}</span>
          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-12">{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  className?: string;
}

export function SimplePieChart({ data, size = 160, className }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  let cumulativePercent = 0;
  const segments = data.map((item) => {
    const percent = (item.value / total) * 100;
    const segment = {
      ...item,
      percent,
      offset: cumulativePercent,
    };
    cumulativePercent += percent;
    return segment;
  });

  // CSS conic gradient approach
  const gradient = segments
    .map((s) => `${s.color} ${s.offset}% ${s.offset + s.percent}%`)
    .join(", ");

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div
        className="rounded-full flex-shrink-0"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradient})`,
        }}
      />
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs">
              {s.label}: {s.value.toLocaleString()} ({s.percent.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
