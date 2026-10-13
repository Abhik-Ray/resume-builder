import type { BarDatum } from "../../components/charts/BarChart";
import type { WeeklyRow } from "../../db/stats";

export const WEEKS_SHOWN = 12;
const DAY_MS = 86_400_000;

// Monday of the week containing `date`, as YYYY-MM-DD (matches date_trunc('week'))
const weekStart = (date: Date) => {
  const day = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day))
    .toISOString()
    .slice(0, 10);
};

// The last WEEKS_SHOWN weeks, with empty weeks as zero so gaps show
export const fillWeeks = (rows: WeeklyRow[], now = new Date()): BarDatum[] => {
  const counts = new Map(rows.map((r) => [r.week, r.applications ?? 0]));
  const current = Date.parse(weekStart(now));
  return Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const week = new Date(current - (WEEKS_SHOWN - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10);
    const date = new Date(`${week}T00:00:00Z`);
    return {
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }),
      value: counts.get(week) ?? 0,
    };
  });
};
