"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Cycle = { id: string; name: string; status: string; starts_on: string | null };
type RatingSummary = { average: number | null; distribution: Record<string, number> };
type Summary = { responseCount: number; overallAverage: number | null; ratings: Record<string, RatingSummary>; open: Record<string, string[]> };

const ratingLabels: Record<string, string> = {
  intake_experience: "חווית הקליטה הכללית",
  info_clarity: "בהירות ופירוט המידע",
  interviewer_professionalism: "מקצועיות ונעימות המראיינים",
  fairness: "הוגנות ואובייקטיביות התהליך",
  questions_space: "מקום לשאול שאלות ולקבל תשובות",
};

const openLabels: Record<string, string> = {
  overall_feeling: "התחושה הכללית לאורך תהליך המיון",
  contact_person: "איש קשר במהלך התהליך",
  surprise: "מה הפתיע בתהליך",
  preserve: "נקודות לשימור",
  improve: "נקודות לשיפור",
  additional: "המלצות והערות נוספות",
};

export default function FeedbackPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: cycleError } = await supabase.from("cycles").select("id,name,status,starts_on").order("starts_on", { ascending: false });
      if (cycleError) { if (!cancelled) { setError(cycleError.message); setLoading(false); } return; }
      const rows = (data || []) as Cycle[];
      if (!cancelled) {
        setCycles(rows);
        setCycleId(rows[0]?.id || "");
        if (!rows.length) setLoading(false);
      }
    }
    loadCycles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    async function loadSummary() {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/admin/satisfaction?cycleId=${encodeURIComponent(cycleId)}`);
      const json = await response.json();
      if (!cancelled) {
        if (!response.ok) { setError(json.error || "לא ניתן לטעון את נתוני הסקר"); setSummary(null); }
        else setSummary(json as Summary);
        setLoading(false);
      }
    }
    loadSummary();
    return () => { cancelled = true; };
  }, [cycleId]);

  return (
    <AppShell title="סיכום סקר שביעות רצון">
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label>מחזור</label>
          <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
          </select>
        </div>
      </section>

      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      {loading && <div className="notice">טוען נתונים...</div>}
      {!loading && summary && <>
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          <section className="card"><div className="stat-label">מספר משיבים</div><div className="stat-value">{summary.responseCount}</div></section>
          <section className="card"><div className="stat-label">ממוצע שביעות רצון כללי</div><div className="stat-value">{summary.overallAverage ?? "—"}{summary.overallAverage !== null && <span style={{ fontSize: 18, marginInlineStart: 6 }}>/5</span>}</div></section>
        </div>

        <section className="card" style={{ marginBottom: 18 }}>
          <h2 className="section-title">שאלות דירוג</h2>
          {!summary.responseCount ? <div className="empty">עדיין אין תשובות לסקר במחזור הזה.</div> : <div className="grid grid-2">
            {Object.entries(ratingLabels).map(([key, label]) => {
              const item = summary.ratings[key];
              const total = item ? Object.values(item.distribution).reduce((sum, value) => sum + value, 0) : 0;
              return <div className="notice" key={key}>
                <div className="row between wrap"><b>{label}</b><span className="badge">ממוצע {item?.average ?? "—"}/5</span></div>
                <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
                  {[5, 4, 3, 2, 1].map((score) => {
                    const count = item?.distribution[String(score)] || 0;
                    const percent = total ? Math.round((count / total) * 100) : 0;
                    return <div key={score} style={{ display: "grid", gridTemplateColumns: "28px 1fr 60px", gap: 8, alignItems: "center" }}><span>{score}</span><div className="progress" style={{ marginTop: 0 }}><div style={{ width: `${percent}%` }} /></div><span className="stat-label">{count} · {percent}%</span></div>;
                  })}
                </div>
              </div>;
            })}
          </div>}
        </section>

        <section className="card">
          <h2 className="section-title">תשובות פתוחות</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {Object.entries(openLabels).map(([key, label]) => {
              const answers = summary.open[key] || [];
              return <div key={key}>
                <div className="row between wrap" style={{ marginBottom: 8 }}><b>{label}</b><span className="badge">{answers.length} תשובות</span></div>
                {!answers.length ? <div className="stat-label">אין תשובות בסעיף הזה.</div> : <div style={{ display: "grid", gap: 8 }}>{answers.map((answer, index) => <div className="notice" key={`${key}-${index}`} style={{ whiteSpace: "pre-wrap" }}>{answer}</div>)}</div>}
              </div>;
            })}
          </div>
        </section>
      </>}
    </AppShell>
  );
}
