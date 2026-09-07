import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";

const interviews = [
  { time: "09:00", name: "נועה אביטן", id: "1", status: "ממתין", room: "חדר 3" },
  { time: "09:30", name: "דניאל שמעוני", id: "2", status: "ממתין", room: "חדר 3" },
  { time: "10:00", name: "עידן בר-און", id: "3", status: "ממתין", room: "חדר 3" },
  { time: "10:30", name: "רוני כספי", id: "4", status: "ממתין", room: "חדר 3" },
  { time: "11:00", name: "תום גולן", id: "5", status: "ממתין", room: "חדר 3" },
];

export default function InterviewerPage() {
  return (
    <AppShell title="הראיונות שלי" subtitle="אלון פרץ · יחידה 8200 · מחזור ספטמבר 2026">
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="ראיונות היום" value={5} accent />
        <StatCard label="הושלמו" value={0} />
        <StatCard label="נשארו" value={5} />
        <StatCard label="הראיון הבא" value={<span style={{ fontSize: 22 }}>09:00</span>} />
      </div>

      <div className="grid grid-2">
        <section className="card flush">
          <div style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">סדר היום</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>שעה</th><th>מועמד/ת</th><th>חדר</th><th>סטטוס</th><th></th></tr></thead>
              <tbody>{interviews.map((x) => <tr key={x.time}><td><b>{x.time}</b></td><td>{x.name}</td><td>{x.room}</td><td><StatusBadge status={x.status} /></td><td><Link className="btn btn-small btn-primary" href={`/candidates/${x.id}`}>פתיחת כרטיס</Link></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <h2 className="section-title">הראיון הבא</h2>
            <div className="row between"><div><h3 style={{ margin: 0, fontSize: 24 }}>נועה אביטן</h3><div className="stat-label">09:00–09:30 · חדר 3</div></div><span className="badge warn">בעוד 18 דק׳</span></div>
            <div className="grid grid-2" style={{ marginTop: 18 }}><div className="notice"><div className="stat-label">תחום</div><b>פיתוח תוכנה</b></div><div className="notice"><div className="stat-label">שאלון</div><b style={{ color: "var(--success)" }}>הושלם</b></div></div>
            <Link className="btn btn-primary" href="/candidates/1" style={{ width: "100%", marginTop: 14 }}>פתיחת כרטיס והתחלת ראיון</Link>
          </section>
          <section className="card">
            <h2 className="section-title">חוות דעת פתוחות</h2>
            <p className="section-subtitle">ראיונות שכבר בוצעו ועדיין לא נשלחה עבורם חוות דעת.</p>
            <div className="notice row between"><div><b>יעל רוזן</b><div className="stat-label">ראיון מאתמול · 14:30</div></div><button className="btn btn-small">השלמת חו״ד</button></div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
