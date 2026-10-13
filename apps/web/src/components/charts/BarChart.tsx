import { useId, useState } from "react";
import { cn } from "../../lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

interface ChartProps {
  title: string;
  // What one unit is, for the tooltip and table: "applications"
  unit: string;
  data: BarDatum[];
  className?: string;
}

const formatValue = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);

// Tooltip contents: value first, label after; text tokens, never the series color
const TooltipBody = ({ datum, unit }: { datum: BarDatum; unit: string }) => (
  <>
    <strong className="font-semibold">{formatValue(datum.value)}</strong>{" "}
    <span className="text-muted-foreground">
      {unit} · {datum.label}
    </span>
  </>
);

// Every chart has the same numbers as a table, so nothing depends on seeing the bars
const TableView = ({ title, unit, data }: Omit<ChartProps, "className">) => (
  <details className="text-xs">
    <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
    <table className="mt-2 w-full">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 font-medium">Label</th>
          <th className="py-1 text-right font-medium capitalize">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label} className="border-t">
            <td className="py-1">{d.label}</td>
            <td className="py-1 text-right tabular-nums">{d.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </details>
);

// Horizontal bars, one per row, growing from a shared left baseline. Value at the tip.
export const HorizontalBarChart = ({ title, unit, data, className }: ChartProps) => {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className={cn("flex flex-col gap-3", className)} aria-labelledby={titleId}>
      <figcaption id={titleId} className="text-sm font-semibold">
        {title}
      </figcaption>
      <ul className="flex flex-col gap-2">
        {data.map((datum, index) => (
          <li key={datum.label} className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
            <span className="truncate text-muted-foreground">{datum.label}</span>
            <div
              className="relative flex items-center gap-2"
              // The whole row is the hit target, larger than the bar
              tabIndex={0}
              role="img"
              aria-label={`${datum.label}: ${datum.value} ${unit}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <div
                className="h-5 rounded-r bg-viz-series"
                style={{ width: `${(datum.value / max) * 85}%`, minWidth: datum.value ? 4 : 0 }}
              />
              <span className="tabular-nums">{formatValue(datum.value)}</span>
              {active === index && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 rounded-md border bg-popover px-2 py-1 whitespace-nowrap text-popover-foreground shadow-sm"
                >
                  <TooltipBody datum={datum} unit={unit} />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <TableView title={title} unit={unit} data={data} />
    </figure>
  );
};

// Columns over time from a hairline baseline; only the latest and the peak carry a label
export const ColumnChart = ({ title, unit, data, className }: ChartProps) => {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const labelled = new Set([peak, data.length - 1]);
  return (
    <figure className={cn("flex flex-col gap-3", className)} aria-labelledby={titleId}>
      <figcaption id={titleId} className="text-sm font-semibold">
        {title}
      </figcaption>
      <div className="flex h-40 items-end gap-0.5 border-b border-viz-grid">
        {data.map((datum, index) => (
          <div
            key={datum.label}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
            tabIndex={0}
            role="img"
            aria-label={`${datum.label}: ${datum.value} ${unit}`}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            {labelled.has(index) && (
              <span className="mb-1 text-[10px] tabular-nums">{formatValue(datum.value)}</span>
            )}
            <div
              className="w-full max-w-6 rounded-t bg-viz-series"
              style={{ height: `${(datum.value / max) * 80}%` }}
            />
            {active === index && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
              >
                <TooltipBody datum={datum} unit={unit} />
              </span>
            )}
          </div>
        ))}
      </div>
      {data.length > 0 && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{data[0].label}</span>
          {data.length > 1 && <span>{data[data.length - 1].label}</span>}
        </div>
      )}
      <TableView title={title} unit={unit} data={data} />
    </figure>
  );
};
