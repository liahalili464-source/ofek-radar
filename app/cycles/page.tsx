"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type CycleRow = {
  id: string;
  name: string;
  recruitment_year: number;
  starts_on: string | null;
  ends_on: string | null;
  status: "draft" | "active" | "completed" | "archived";
};

type CycleView = CycleRow & {
  candidates: number;
  units: number;
  totalInterviews: number;
  completedInterviews: number;
  interviewsThisWeek: number;
  progress: number;
};

const statusLabel: Record<CycleRow["status"], string> = {
  draft: "בתכנון",
  active: "פעיל",
  completed: "סגור",
  archived: "ארכיון",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`));
}

export default function CyclesPage() {
  const [cycles, setCycles] = useState<CycleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const [cyclesRes, candidatesRes, unitsRes, interviewsRes] = await Promise.all([
        supabase.from("cycles").select("id,name,recruitment_year,starts_on,ends_on,status").order("starts_on", { ascending: false }),
        supabase.from("cycle_candidates").select("cycle_id,candidate_id"),
        supabase.from("cycle_units").select("cycle_id,unit_id"),
        supabase.from("interviews").select("cycle_id,status,starts_at"),
      ]);
      const firstError = cyclesRes.error || candidatesRes.error || unitsRes.error || interviewsRes.error;
      if (firstError) {
        if (!cancelled) setError(firstError.message);
        setLoading(false);
        return;
      }

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const rows = ((cyclesRes.data || []) as CycleRow[]).map((cycle) => {
        const candidates = (candidatesRes.data || []).filter((x) => x.cycle_id === cycle.id).length;
        const units = (unitsRes.data || []).filter((x) => x.cycle_id === cycle.id).length;
        const interviews = (interviewsRes.data || []).filter((x) => x.cycle_id === cycle.id);
        const completedInterviews = interviews.filter((x) => x.status === "completed").length;
        const interviewsThisWeek = interviews.filter((x) => {
          const date = new Date(x.starts_at);
          return date >= weekStart && date < weekEnd;
        }).length;
        const progress = interviews.length ? Math.round((completedInterviews / interviews.length) * 100) : 0;
        return { ...cycle, candidates, units, totalInterviews: interviews.length, completedInterviews, interviewsThisWeek, progress };
      });
      if (!cancelled) setCycles(rows);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const years = useMemo(() => [...new Set(cycles.map((c) => c.recruitment_year))].sort((a, b) => b - a), [cycles]);
  const filtered = useMemo(() => cycles.filter((cycle) => {
    const matchesSearch = cycle.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || cycle.status === status;
    const matchesYear = year === "all" || String(cycle.recruitment_year) === year;
    return matchesSearch && matchesStatus && matchesYear;
  }), [cycles, search, status, year]);

  const totalCandidates = cycles.reduce((sum, c) => sum + c.candidates, 0);
  const active = cycles.filter((c) => c.status === "active" || c.status === "draft").length;
  const completed = cycles.filter((c) => c.status === "completed").length;
  const weekly = cycles.reduce((sum, c) => sum + c.interviewsThisWeek, 0);

  return (
    <AppShell
      title="מחזורי ראיונות"
      subtitle="ניהול ומעקב אחר כלל מחזורי הראיונות הפעילים והסגורים"
      actions={<Link href="/cycles/new" className="btn btn-primary"><Plus size={17} /> פתיחת מחזור חדש</Link>}
    >
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="מחזורים פעילים / בתכנון" value={active} accent />
        <StatCard label="סה״כ מועמדים במחזורים" value={totalCandidates} />
        <StatCard label="ראיונות השבוע" value={weekly} />
        <StatCard label="מחזורים סגורים" value={completed} />
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 360 }} placeholder="חיפוש לפי שם מחזור..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">סטטוס: הכל</option>
          <option value="active">פעיל</option>
          <option value="draft">בתכנון</option>
          <option value="completed">סגור</option>
          <option value="archived">ארכיון</option>
        </select>
        <select className="select" style={{ maxWidth: 160 }} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">שנה: הכל</option>
          {years.map((y) => <option value={String(y)} key={y}>{y}</option>)}
        </select>
        {(search || status !== "all" || year !== "all") && <button className="btn btn-small" onClick={() => { setSearch(""); setStatus("all"); setYear("all"); }}>ניקוי סינון</button>}
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? <div className="empty">טוען מחזורים...</div> : filtered.length === 0 ? <div className="empty">לא נמצאו מחזורים שמתאימים לסינון.</div> : (
        <div className="grid grid-3">
          {filtered.map((cycle) => (
            <article key={cycle.id} className="card cycle-card">
              <div className="row between">
                <div>
                  <h3>{cycle.name}</h3>
                  <div className="meta">{formatDate(cycle.starts_on)}–{formatDate(cycle.ends_on)}</div>
                </div>
                <StatusBadge status={statusLabel[cycle.status]} />
              </div>

              <div className="cycle-kpis">
                <span>{cycle.candidates} מועמדים</span>
                <span>{cycle.units} יחידות</span>
              </div>

              <div className="row between">
                <span className="stat-label">התקדמות לפי ראיונות</span>
                <b className={cycle.progress === 100 ? "" : "accent"}>{cycle.progress}%</b>
              </div>
              <div className="progress"><div style={{ width: `${cycle.progress}%`, background: cycle.progress === 100 ? "var(--success)" : "var(--accent)" }} /></div>

              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn btn-primary" href={`/cycles/${cycle.id}`}>פתיחה</Link>
                <Link className="btn" href={`/cycles/new?edit=${cycle.id}`}>עריכה</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
