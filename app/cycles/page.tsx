import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { demoCycles } from "@/lib/demo-data";

export default function CyclesPage() {
  const totalCandidates = demoCycles.reduce((sum, c) => sum + c.candidates, 0);
  const active = demoCycles.filter((c) => c.status === "פעיל" || c.status === "בתכנון").length;
  const completed = demoCycles.filter((c) => c.status === "הושלם").length;
  const weekly = demoCycles.reduce((sum, c) => sum + c.interviewsThisWeek, 0);

  return (
    <AppShell
      title="מחזורי ראיונות"
      subtitle="ניהול ומעקב אחר כלל מחזורי הראיונות הפעילים והארכיוניים"
      actions={
        <Link href="/cycles/new" className="btn btn-primary">
          <Plus size={17} /> פתיחת מחזור חדש
        </Link>
      }
    >
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="מחזורים פעילים / בתכנון" value={active} accent />
        <StatCard label="סה״כ מועמדים במחזורים" value={totalCandidates} />
        <StatCard label="ראיונות השבוע" value={weekly} />
        <StatCard label="מחזורים שהושלמו" value={completed} />
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 360 }} placeholder="חיפוש לפי שם מחזור..." />
        <select className="select" style={{ maxWidth: 170 }} defaultValue="all">
          <option value="all">סטטוס: הכל</option>
          <option>פעיל</option>
          <option>בתכנון</option>
          <option>הושלם</option>
        </select>
        <select className="select" style={{ maxWidth: 150 }} defaultValue="2026">
          <option>2026</option>
          <option>2025</option>
        </select>
      </div>

      <div className="grid grid-3">
        {demoCycles.map((cycle) => (
          <article key={cycle.id} className="card cycle-card">
            <div className="row between">
              <div>
                <h3>{cycle.name}</h3>
                <div className="meta">
                  {cycle.start}–{cycle.end}
                </div>
              </div>
              <StatusBadge status={cycle.status} />
            </div>

            <div className="cycle-kpis">
              <span>{cycle.candidates} מועמדים</span>
              <span>{cycle.interviewers} מראיינים</span>
            </div>

            <div className="row between">
              <span className="stat-label">התקדמות</span>
              <b className={cycle.progress === 100 ? "" : "accent"}>{cycle.progress}%</b>
            </div>
            <div className="progress">
              <div style={{ width: `${cycle.progress}%`, background: cycle.progress === 100 ? "var(--success)" : "var(--accent)" }} />
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <Link className="btn btn-primary" href={`/cycles/${cycle.id}`}>
                פתיחה
              </Link>
              <Link className="btn" href={`/cycles/new?edit=${cycle.id}`}>
                עריכה
              </Link>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
