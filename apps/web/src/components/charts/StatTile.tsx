// A single headline number: label, value and an optional note
export const StatTile = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-2xl font-semibold">{value}</span>
    {note && <span className="text-xs text-muted-foreground">{note}</span>}
  </div>
);
