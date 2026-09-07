import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { demoCandidates, demoCycles, demoUnits } from "@/lib/demo-data";

const daySchedule = [
  ["09:00", "נועה אביטן", "יחידה 8200", "מתוכנן"],
  ["09:00", "דניאל שמעוני", "יחידה 81", "מתוכנן"],
  ["09:00", "עידן בר-און", "ממ״ר", "מתוכנן"],
  ["09:30", "רוני כספי", "יחידה 8200", "מתוכנן"],
  ["09:30", "תום גולן", "יחידה 81", "מתוכנן"],
  ["10:00", "שירה מזרחי", "מפא״ת", "מתוכנן"],
];

export default async function CycleSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cycle = demoCycles.find((c) => c.id === id) ?? demoCycles[0];
  const completedCandidates = Math.round((cycle.candidates * cycle.progress) / 100);
  const totalInterviews = cycle.candidates * cycle.interviewers;
  const doneInterviews = Math.round((totalInterviews * cycle.progress) / 100);

  return (
    <AppShell
      title={cycle.name}
      subtitle={`סיכום מחזור · ${cycle.start}–${cycle.end}`}
      actions={<Link href={`/cycles/new?edit=${cycle.id}`} className="btn">עריכת מחזור</Link>}
    >
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="מועמדים במחזור" value={cycle.candidates} />
        <StatCard label="מועמדים שהשלימו" value={completedCandidates} accent />
        <StatCard label="ראיונות שבוצעו" value={`${doneInterviews}/${totalInterviews}`} />
        <StatCard label="יחידות פעילות" value={cycle.interviewers} />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>תמונת מצב</h2>
              <div className="stat-label">התקדמות המחזור לפי ראיונות שהושלמו</div>
            </div>
            <StatusBadge status={cycle.status} />
          </div>
          <div className="row between"><b>{cycle.progress}%</b><span className="stat-label">{totalInterviews - doneInterviews} ראיונות נשארו</span></div>
          <div className="progress" style={{ height: 10 }}><div style={{ width: `${cycle.progress}%` }} /></div>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            <div className="notice"><div className="stat-label">שאלונים הושלמו</div><b>{Math.min(cycle.candidates, completedCandidates + 9)}</b></div>
            <div className="notice"><div className="stat-label">חוות דעת התקבלו</div><b>{Math.max(0, doneInterviews - 8)}</b></div>
            <div className="notice"><div className="stat-label">ממתינים להחלטה</div><b>11</b></div>
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <h2 className="section-title">יחידות במחזור</h2>
            <Link href="/schedule" className="btn btn-small">לשיבוץ</Link>
          </div>
          <div className="grid grid-2">
            {demoUnits.slice(0, Math.min(6, cycle.interviewers)).map((u) => (
              <div className="notice" key={u.id}>
                <b>{u.name}</b>
                <div className="stat-label">מראיין/ת: {u.interviewer}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="card">
          <div className="row between"><h2 className="section-title">לוח ראיונות קרוב</h2><Link className="btn btn-small btn-primary" href="/schedule">פתיחת לוח מלא</Link></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>שעה</th><th>מועמד/ת</th><th>יחידה</th><th>סטטוס</th></tr></thead>
              <tbody>{daySchedule.map(([time, name, unit, status], i) => <tr key={`${time}-${i}`}><td><b>{time}</b></td><td>{name}</td><td>{unit}</td><td><StatusBadge status={status} /></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="row between"><h2 className="section-title">מועמדים שדורשים טיפול</h2><Link href="/candidates" className="btn btn-small">כל המועמדים</Link></div>
          <div className="grid">
            {demoCandidates.slice(0, 5).map((c) => (
              <Link href={`/candidates/${c.id}`} className="notice row between" key={c.id}>
                <div><b>{c.fullName}</b><div className="stat-label">{c.targetUnit}</div></div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
