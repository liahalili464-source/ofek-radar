"use client";

import { MessageSquareText, Sparkles, TriangleAlert, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Cycle = { id: string; name: string; status: string; starts_on: string | null };
type RatingSummary = { average: number | null; distribution: Record<string, number> };
type Summary = { responseCount: number; overallAverage: number | null; ratings: Record<string, RatingSummary>; open: Record<string, string[]> };

const ratingLabels: Record<string, string> = {
  intake_experience: "חוויית הקליטה",
  info_clarity: "בהירות המידע",
  interviewer_professionalism: "מקצועיות המראיינים",
  fairness: "הוגנות התהליך",
  questions_space: "מקום לשאלות",
};

const openLabels: Record<string, string> = {
  overall_feeling: "התחושה הכללית לאורך התהליך",
  contact_person: "איש קשר במהלך התהליך",
  surprise: "מה הפתיע בתהליך",
  preserve: "מה כדאי לשמר",
  improve: "מה כדאי לשפר",
  additional: "הערות והמלצות נוספות",
};

function scoreTone(value: number | null) {
  if (value == null) return "";
  if (value >= 4) return "ok";
  if (value >= 3) return "warn";
  return "danger";
}

export default function FeedbackPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState<string | null>("improve");

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: cycleError } = await supabase.from("cycles").select("id,name,status,starts_on").order("starts_on", { ascending: false });
      if (cycleError) { if (!cancelled) { setError(cycleError.message); setLoading(false); } return; }
      const rows = (data || []) as Cycle[];
      if (!cancelled) {
        setCycles(rows);
        const preferred = rows.find((cycle) => cycle.status === "active") || rows[0];
        setCycleId(preferred?.id || "");
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

  const ranked = useMemo(() => {
    if (!summary) return [];
    return Object.entries(ratingLabels)
      .map(([key, label]) => ({ key, label, average: summary.ratings[key]?.average ?? null }))
      .filter((item) => item.average != null)
      .sort((a, b) => (b.average || 0) - (a.average || 0));
  }, [summary]);

  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const openCount = summary ? Object.values(summary.open).reduce((sum, answers) => sum + answers.length, 0) : 0;

  return (
    <AppShell title="סקר שביעות רצון" subtitle="תמונת מצב על חוויית המועמדים מתהליך המיון">
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ gap: 16 }}>
          <div className="field" style={{ minWidth: 280, maxWidth: 430, marginBottom: 0 }}>
            <label>מחזור</label>
            <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
            </select>
          </div>
          <div className="stat-label" style={{ maxWidth: 520 }}>המסך הזה מציג משוב על חוויית תהליך המיון בלבד. דירוג היחידות של כל מועמד מוצג בכרטיס המועמד ובמסך „שיבוץ ליחידות”.</div>
        </div>
      </section>

      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      {loading && <div className="notice">טוען נתונים...</div>}

      {!loading && summary && !summary.responseCount && <section className="card"><div className="empty">עדיין אין תשובות לסקר במחזור הזה.</div></section>}

      {!loading && summary && summary.responseCount > 0 && <>
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <section className="card stat-card"><div className="row between"><div className="stat-label">משיבים</div><Users size={18} className="accent" /></div><div className="stat-value">{summary.responseCount}</div></section>
          <section className="card stat-card"><div className="stat-label">שביעות רצון כללית</div><div className="stat-value accent">{summary.overallAverage ?? "—"}<span style={{ fontSize: 17, marginInlineStart: 5 }}>/5</span></div></section>
          <section className="card stat-card"><div className="row between"><div className="stat-label">הנקודה החזקה</div><Sparkles size={18} className="accent" /></div><div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>{strongest?.label || "—"}</div>{strongest && <span className="badge ok" style={{ marginTop: 8 }}>{strongest.average}/5</span>}</section>
          <section className="card stat-card"><div className="row between"><div className="stat-label">דורש תשומת לב</div><TriangleAlert size={18} /></div><div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>{weakest?.label || "—"}</div>{weakest && <span className={`badge ${scoreTone(weakest.average)}`} style={{ marginTop: 8 }}>{weakest.average}/5</span>}</section>
        </div>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="row between wrap" style={{ marginBottom: 16 }}><div><h2 className="section-title" style={{ marginBottom: 3 }}>איך המועמדים חוו את התהליך</h2><div className="stat-label">ממוצע לכל מדד מתוך 5</div></div></div>
          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(ratingLabels).map(([key, label]) => {
              const item = summary.ratings[key];
              const average = item?.average ?? null;
              const percent = average == null ? 0 : Math.max(0, Math.min(100, (average / 5) * 100));
              return <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(180px,260px) 1fr 72px", gap: 14, alignItems: "center" }}>
                <b>{label}</b>
                <div className="progress" style={{ marginTop: 0 }}><div style={{ width: `${percent}%` }} /></div>
                <span className={`badge ${scoreTone(average)}`} style={{ justifySelf: "end" }}>{average ?? "—"}/5</span>
              </div>;
            })}
          </div>
        </section>

        <section className="card">
          <div className="row between wrap" style={{ marginBottom: 16 }}><div><h2 className="section-title" style={{ marginBottom: 3 }}>מה המועמדים כתבו</h2><div className="stat-label">תגובות פתוחות מהסקר · {openCount} תשובות</div></div><MessageSquareText size={19} className="accent" /></div>
          <div style={{ display: "grid", gap: 9 }}>
            {Object.entries(openLabels).map(([key, label]) => {
              const answers = summary.open[key] || [];
              const expanded = openSection === key;
              return <div className="notice" key={key} style={{ padding: 0, overflow: "hidden" }}>
                <button type="button" onClick={() => setOpenSection(expanded ? null : key)} style={{ width: "100%", padding: 13, border: 0, background: "transparent", color: "inherit", cursor: "pointer", textAlign: "right" }}>
                  <div className="row between"><b>{label}</b><span className="badge">{answers.length}</span></div>
                </button>
                {expanded && <div style={{ padding: "0 13px 13px", display: "grid", gap: 8 }}>
                  {!answers.length ? <div className="stat-label">אין תשובות בסעיף הזה.</div> : answers.map((answer, index) => <div key={`${key}-${index}`} style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{answer}</div>)}
                </div>}
              </div>;
            })}
          </div>
        </section>
      </>}
    </AppShell>
  );
}
