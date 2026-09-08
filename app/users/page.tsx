"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type UnitRel = { name: string } | { name: string }[] | null;
type Unit = { id: string; name: string; code: string | null; active: boolean };
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

function userErrorText(code?: string) {
  if (code === "INVALID_INPUT") return "יש למלא שם ושם משתמש. סיסמה חדשה חייבת להכיל לפחות 8 תווים.";
  if (code === "UNIT_REQUIRED") return "יש לבחור יחידה לחשבון יחידה.";
  if (code === "USERNAME_EXISTS") return "שם המשתמש כבר קיים במערכת.";
  if (code === "UNIT_ACCOUNT_EXISTS") return "כבר קיים חשבון ליחידה הזו.";
  if (code === "INVALID_UNIT") return "היחידה שנבחרה אינה פעילה.";
  return code || "הפעולה נכשלה";
}

export default function UsersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"interviewer" | "admin">("interviewer");
  const [unitId, setUnitId] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "טעינת החשבונות נכשלה");
    else {
      setAccounts(json.users || []);
      setUnits(json.units || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(account: Account) {
    setBusyId(account.id);
    setError("");
    setSuccess("");
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

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, username, password, role, unitId: role === "interviewer" ? unitId : null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "USER_CREATE_FAILED");
      setSuccess(`החשבון ${username} נוצר בהצלחה.`);
      setFullName("");
      setUsername("");
      setPassword("");
      setUnitId("");
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(userErrorText(e instanceof Error ? e.message : undefined));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(account: Account) {
    setEditing(account);
    setEditFullName(account.full_name);
    setEditUsername(account.username);
    setEditPassword("");
    setShowCreate(false);
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditing(null);
    setEditFullName("");
    setEditUsername("");
    setEditPassword("");
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setEditingBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          fullName: editFullName,
          username: editUsername,
          password: editPassword || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "USER_UPDATE_FAILED");
      setAccounts((current) => current.map((account) => account.id === editing.id ? {
        ...account,
        full_name: json.user.full_name,
        username: json.user.username,
      } : account));
      setSuccess(`החשבון ${json.user.username} עודכן בהצלחה.`);
      cancelEdit();
    } catch (e) {
      setError(userErrorText(e instanceof Error ? e.message : undefined));
    } finally {
      setEditingBusy(false);
    }
  }

  const unitAccounts = accounts.filter((a) => a.role === "interviewer");
  const admins = accounts.filter((a) => a.role === "admin");
  const usedUnitIds = useMemo(() => new Set(unitAccounts.map((a) => a.unit_id).filter(Boolean)), [unitAccounts]);
  const availableUnits = units.filter((unit) => !usedUnitIds.has(unit.id));

  return (
    <AppShell
      title="יחידות והרשאות"
      subtitle="ניהול חשבונות היחידות והרשאות הגישה למערכת"
      actions={<button className="btn btn-primary" onClick={() => { setShowCreate((value) => !value); cancelEdit(); setError(""); setSuccess(""); }}>{showCreate ? "ביטול" : "+ הוספת משתמש"}</button>}
    >
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="notice success" style={{ marginBottom: 16 }}>{success}</div>}

      {showCreate && <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="section-title">הוספת משתמש</h2>
        <form onSubmit={createAccount}>
          <div className="grid grid-2">
            <div className="field"><label>שם</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            <div className="field"><label>סוג חשבון</label><select className="select" value={role} onChange={(e) => { const next = e.target.value as "interviewer" | "admin"; setRole(next); if (next === "admin") setUnitId(""); }}><option value="interviewer">חשבון יחידה</option><option value="admin">מנהל/ת מדור</option></select></div>
            {role === "interviewer" && <div className="field"><label>יחידה</label><select className="select" value={unitId} onChange={(e) => setUnitId(e.target.value)} required><option value="">בחירת יחידה</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>}
            <div className="field"><label>שם משתמש</label><input className="input" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required /></div>
            <div className="field"><label>סיסמה</label><input className="input" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></div>
          </div>
          <button className="btn btn-primary" disabled={creating}>{creating ? "יוצר..." : "יצירת משתמש"}</button>
        </form>
      </section>}

      {editing && <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 3 }}>עריכת משתמש</h2>
            <div className="stat-label">{editing.role === "interviewer" ? unitNameOf(editing.units) || editing.full_name : "מנהל/ת מדור"}</div>
          </div>
          <button className="btn btn-small" type="button" onClick={cancelEdit}>ביטול</button>
        </div>
        <form onSubmit={saveEdit}>
          <div className="grid grid-3">
            <div className="field"><label>שם</label><input className="input" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required /></div>
            <div className="field"><label>שם משתמש</label><input className="input" dir="ltr" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required /></div>
            <div className="field"><label>סיסמה חדשה</label><input className="input" dir="ltr" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="להשאיר ריק אם לא משנים" /></div>
          </div>
          <button className="btn btn-primary" disabled={editingBusy}>{editingBusy ? "שומר..." : "שמירת שינויים"}</button>
        </form>
      </section>}

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
                  <td><div className="row wrap"><button className="btn btn-small" onClick={() => startEdit(a)}>עריכה</button><button className="btn btn-small" disabled={busyId === a.id} onClick={() => toggle(a)}>{a.active ? "השבתה" : "הפעלה"}</button></div></td>
                </tr>;
              })}
              {!loading && unitAccounts.length === 0 && <tr><td colSpan={5}><div className="empty">אין חשבונות יחידה.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flush">
        <div style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">מנהלי מערכת</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>שם</th><th>שם משתמש</th><th>הרשאה</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>{admins.map((a) => <tr key={a.id}><td><b>{a.full_name}</b></td><td dir="ltr" style={{ textAlign: "right" }}>{a.username}</td><td>מנהל/ת מדור</td><td><span className={`badge ${a.active ? "ok" : ""}`}>{a.active ? "פעיל" : "מושבת"}</span></td><td><div className="row wrap"><button className="btn btn-small" onClick={() => startEdit(a)}>עריכה</button><button className="btn btn-small" disabled={busyId === a.id} onClick={() => toggle(a)}>{a.active ? "השבתה" : "הפעלה"}</button></div></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
