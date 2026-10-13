export const formatPercent = (ratio: number | null | undefined) =>
  ratio == null ? "—" : new Intl.NumberFormat(undefined, { style: "percent" }).format(ratio);

export const formatDays = (days: number | null | undefined) =>
  days == null ? "—" : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(days)} d`;
