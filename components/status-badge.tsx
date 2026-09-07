export function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const cls =
    lower.includes("הושלם") || lower.includes("בוצע") || lower.includes("פעיל") || lower.includes("שובץ")
      ? "ok"
      : lower.includes("מלא") || lower.includes("בוטל") || lower.includes("לא מומלץ")
        ? "danger"
        : lower.includes("ממתין") || lower.includes("תכנון") || lower.includes("בדיקת")
          ? "warn"
          : "";
  return <span className={`badge ${cls}`}>{status}</span>;
}
