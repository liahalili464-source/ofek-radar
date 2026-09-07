export function StatCard({
  label,
  value,
  accent = false,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? "accent" : ""}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
