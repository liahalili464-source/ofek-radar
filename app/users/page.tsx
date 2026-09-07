"use client";

import { FormEvent, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { demoUnits } from "@/lib/demo-data";
import { useLocalStorageState } from "@/lib/demo-store";

type DemoUser = { id: string; fullName: string; username: string; role: "admin" | "interviewer"; unit: string; active: boolean };
const initialUsers: DemoUser[] = [
  { id: "1", fullName: "רותם כהן", username: "rotem.cohen", role: "admin", unit: "מדור איתור ומיון", active: true },
  ...demoUnits.map((u, i) => ({ id: `u${i + 2}`, fullName: u.interviewer ?? "מראיין", username: `interviewer${i + 1}`, role: "interviewer" as const, unit: u.name, active: true })),
];

export default function UsersPage() {
  const [users, setUsers] = useLocalStorageState<DemoUser[]>("ofek-radar-users", initialUsers);
  const [showForm, setShowForm] = useState(false);

  function addUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const role = String(fd.get("role")) as "admin" | "interviewer";
    setUsers((current) => [...current, {
      id: `u_${Date.now()}`,
      fullName: String(fd.get("fullName")),
      username: String(fd.get("username")),
      role,
      unit: role === "admin" ? "מדור איתור ומיון" : String(fd.get("unit")),
      active: true,
    }]);
    setShowForm(false);
    e.currentTarget.reset();
  }

  return (
    <AppShell title="ניהול משתמשים" subtitle="יצירת מנהלים ומראיינים ושיוך כל מראיין ליחידה" actions={<button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}><UserPlus size={17} /> משתמש חדש</button>}>
      {showForm && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 className="section-title">הוספת משתמש</h2>
          <form onSubmit={addUser}>
            <div className="grid grid-4">
              <div className="field"><label>שם מלא</label><input className="input" name="fullName" required /></div>
              <div className="field"><label>שם משתמש</label><input className="input" name="username" required placeholder="name.surname" /></div>
              <div className="field"><label>הרשאה</label><select className="select" name="role" defaultValue="interviewer"><option value="interviewer">מראיין/ת</option><option value="admin">מנהל/ת מדור</option></select></div>
              <div className="field"><label>יחידה</label><select className="select" name="unit">{demoUnits.map((u) => <option key={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div className="row"><button className="btn btn-primary"><Plus size={16} /> יצירת משתמש</button><span className="stat-label">ב-Supabase האמיתי המערכת תיצור גם חשבון Auth וסיסמה זמנית.</span></div>
          </form>
        </section>
      )}

      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>שם</th><th>שם משתמש</th><th>הרשאה</th><th>יחידה</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>{users.map((u) => <tr key={u.id}><td><b>{u.fullName}</b></td><td>{u.username}</td><td>{u.role === "admin" ? "מנהל/ת מדור" : "מראיין/ת"}</td><td>{u.unit}</td><td><span className={`badge ${u.active ? "ok" : ""}`}>{u.active ? "פעיל" : "מושבת"}</span></td><td><button className="btn btn-small" onClick={() => setUsers((current) => current.map((x) => x.id === u.id ? { ...x, active: !x.active } : x))}>{u.active ? "השבתה" : "הפעלה"}</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
