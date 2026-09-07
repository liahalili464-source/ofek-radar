"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";

type UnitRel = { name: string } | { name: string }[] | null;
type Account = {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "interviewer";
  active: boolean;
  unit_id: string | null;
  units: UnitRel;
};

function unitNameOf(units: UnitRel) {
  if (!units) return null;
  return Array.isArray(units) ? units[0]?.name ?? null : units.name;
}

export default function UsersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "טעינת החשבונות נכשלה");
    else setAccounts(json.users || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(account: Account) {
    setBusyId(account.id);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, active: !account.active }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error === "CANNOT_DISABLE_SELF" ? "אי אפשר להשבית את חשבון המנהל שמחובר כרגע." : (json.error || "העדכון נכשל"));
    else setAccounts((current) => current.map((x) => x.id === account.id ? { ...x, active: json.user.active } : x));
    setBusyId(null);
  }

  const unitAccounts = accounts.filter((a) => a.role === "interviewer");
  const admins = accounts.filter((a) => a.role === "admin");

  return (
    <AppShell title="יחידות והרשאות" subtitle="חשבונות הכניסה הקבועים הם של היחידות. שם המראיין בפועל נקבע בנפרד בכל מחזור.">
      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="section-title">איך זה עובד</h2>
        <div className="notice">
          לכל יחידה יש חשבון קבוע אחד למערכת. לדוגמה, חשבון <b>handasa</b> שייך ליחידת הנדסה — לא לאדם מסוים. במחזור עצמו אפשר יהיה לרשום ידנית מי המראיין/ת בפועל באותו מחזור, בלי ליצור יוזר חדש בכל פעם.
        </div>
      </section>

      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="card flush" style={{ marginBottom: 18 }}>
        <div style={{ padding: 20, paddingBottom: 8 }}>
          <h2 className="section-title">חשבונות יחידה</h2>
          <div className="stat-label">{unitAccounts.length} יחידות מחוברות למערכת</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>יחידה</th><th>שם משתמש</th><th>סוג חשבון</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5}>טוען...</td></tr>}
              {!loading && unitAccounts.map((a) => {
                const unitName = unitNameOf(a.units) || a.full_name;
                return <tr key={a.id}>
                  <td><b>{unitName}</b></td>
                  <td dir="ltr" style={{ textAlign: "right" }}>{a.username}</td>
                  <td>חשבון יחידה</td>
                  <td><span className={`badge ${a.active ? "ok" : ""}`}>{a.active ? "פעיל" : "מושבת"}</span></td>
                  <td><button className="btn btn-small" disabled={busyId === a.id} onClick={() => toggle(a)}>{a.active ? "השבתה" : "הפעלה"}</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flush">
        <div style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">מנהלי מערכת</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>שם</th><th>שם משתמש</th><th>הרשאה</th><th>סטטוס</th></tr></thead>
            <tbody>{admins.map((a) => <tr key={a.id}><td><b>{a.full_name}</b></td><td>{a.username}</td><td>מנהל/ת מדור</td><td><span className={`badge ${a.active ? "ok" : ""}`}>{a.active ? "פעיל" : "מושבת"}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
