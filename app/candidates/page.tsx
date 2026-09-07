import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { demoCandidates } from "@/lib/demo-data";

export default function CandidatesPage() {
  return (
    <AppShell title="מועמדים" subtitle="רשימת המועמדים במחזור הפעיל, סטטוס שאלון, ראיונות וחוות דעת">
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="סה״כ במחזור" value={58} accent />
        <StatCard label="שאלון הושלם" value={49} />
        <StatCard label="שובצו לראיונות" value={41} />
        <StatCard label="ממתינים לחוות דעת" value={17} />
      </div>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 330 }} placeholder="חיפוש שם / ת.ז / טלפון..." />
        <select className="select" style={{ maxWidth: 210 }}><option>סטטוס: הכל</option><option>חדש</option><option>שובץ</option><option>ממתין לראיון</option><option>בדיקת חו״ד</option></select>
        <select className="select" style={{ maxWidth: 220 }}><option>יחידת יעד: הכל</option><option>יחידה 8200</option><option>יחידה 81</option><option>מפא״ת</option></select>
      </div>
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מועמד/ת</th><th>ת.ז</th><th>טלפון</th><th>עיר</th><th>יחידת יעד</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {demoCandidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td><b>{candidate.fullName}</b></td>
                  <td>{candidate.nationalId}</td>
                  <td>{candidate.phone}</td>
                  <td>{candidate.city}</td>
                  <td>{candidate.targetUnit}</td>
                  <td><StatusBadge status={candidate.status} /></td>
                  <td><Link href={`/candidates/${candidate.id}`} className="btn btn-small btn-primary">פתיחת כרטיס</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
