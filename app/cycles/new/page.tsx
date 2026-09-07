"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExcelImporter, type NormalizedCandidateRow } from "@/components/excel-importer";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { capacityReport, type InterviewDay } from "@/lib/scheduling";

type Unit = { id: string; name: string; code: string | null };
type UnitAccount = { id: string; unit_id: string | null };

export default function NewCyclePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [recruitmentYear, setRecruitmentYear] = useState(new Date().getFullYear());
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [candidateRows, setCandidateRows] = useState<NormalizedCandidateRow[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [accounts, setAccounts] = useState<UnitAccount[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [days, setDays] = useState<InterviewDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadUnits() {
      const supabase = createSupabaseBrowserClient();
      const [unitsRes, accountsRes] = await Promise.all([
        supabase.from("units").select("id,name,code").eq("active", true).order("name"),
        supabase.from("profiles").select("id,unit_id").eq("role", "interviewer").eq("active", true),
      ]);
      const firstError = unitsRes.error || accountsRes.error;
      if (!cancelled) {
        if (firstError) setError(firstError.message);
        else {
          setUnits((unitsRes.data || []) as Unit[]);
          setAccounts((accountsRes.data || []) as UnitAccount[]);
        }
        setLoading(false);
      }
    }
    loadUnits();
    return () => { cancelled = true; };
  }, []);

  const accountByUnit = useMemo(() => new Map(accounts.filter((a) => a.unit_id).map((a) => [a.unit_id as string, a.id])), [accounts]);
  const selectedUnits = useMemo(() => units.filter((u) => selectedUnitIds.includes(u.id)), [units, selectedUnitIds]);
  const input = useMemo(() => ({
    candidateNames: candidateRows.map((row) => row.nationalId),
    units: selectedUnitIds,
    days,
    durationMinutes: duration,
  }), [candidateRows, selectedUnitIds, days, duration]);
  const report = useMemo(() => capacityReport(input), [input]);

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((current) => current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]);
  }

  function updateDay(index: number, patch: Partial<InterviewDay>) {
    setDays((current) => current.map((d, i) => i === index ? { ...d, ...patch } : d));
  }

  function addDay() {
    const base = endsOn || startsOn || new Date().toISOString().slice(0, 10);
    setDays((current) => [...current, { date: current.at(-1)?.date || base, start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] }]);
  }

  function removeDay(index: number) {
    setDays((current) => current.filter((_, i) => i !== index));
  }

  async function saveCycle(goToSchedule: boolean) {
    setError("");
    if (!name.trim()) { setError("יש להזין שם למחזור."); return; }
    if (!recruitmentYear) { setError("יש להזין שנת גיוס."); return; }
    if (goToSchedule && !candidateRows.length) { setError("כדי ליצור לוח ראיונות יש לייבא קודם מועמדים למחזור."); return; }
    if (goToSchedule && !selectedUnitIds.length) { setError("יש לבחור לפחות יחידה אחת למחזור."); return; }
    if (goToSchedule && !days.length) { setError("יש להגדיר לפחות יום ראיונות אחד."); return; }

    const missingAccounts = selectedUnits.filter((u) => !accountByUnit.has(u.id));
    if (missingAccounts.length) {
      setError(`ליחידות ${missingAccounts.map((u) => u.name).join(", ")} אין חשבון יחידה פעיל.`);
      return;
    }

    setSaving(true);
    try {
      const cycleResponse = await fetch("/api/admin/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          recruitmentYear,
          startsOn: startsOn || null,
          endsOn: endsOn || null,
          durationMinutes: duration,
          status: goToSchedule ? status : "draft",
          units: selectedUnits.map((u) => ({ unitId: u.id, interviewerId: accountByUnit.get(u.id) })),
          days: days.map((d) => ({ date: d.date, start: d.start, end: d.end })),
        }),
      });
      const cycleJson = await cycleResponse.json();
      if (!cycleResponse.ok) throw new Error(cycleJson.error || "יצירת המחזור נכשלה");
      const cycleId = cycleJson.cycle?.id as string | undefined;
      if (!cycleId) throw new Error("לא התקבל מזהה למחזור");

      if (candidateRows.length) {
        const importResponse = await fetch("/api/admin/candidates/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleId, rows: candidateRows, fileName: "candidates.xlsx" }),
        });
        const importJson = await importResponse.json();
        if (!importResponse.ok) throw new Error(importJson.error || "ייבוא המועמדים נכשל");
        if (importJson.rejected?.length) setError(`${importJson.imported} מועמדים נשמרו, ${importJson.rejected.length} שורות לא יובאו.`);
      }

      router.push(goToSchedule ? `/schedule?cycle=${cycleId}` : `/cycles/${cycleId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת המחזור נכשלה");
      setSaving(false);
    }
  }

  return (
    <AppShell title="פתיחת מחזור חדש" subtitle="הגדרת המחזור, ייבוא המועמדים, בחירת היחידות וימי הראיונות">
      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="grid grid-2">
        <div className="grid">
          <section className="card">
            <h2 className="section-title">1. פרטי המחזור</h2>
            <div className="field"><label>שם המחזור</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: מחזור אוקטובר 2026" /></div>
            <div className="grid grid-2">
              <div className="field"><label>שנת גיוס</label><input className="input" type="number" value={recruitmentYear} onChange={(e) => setRecruitmentYear(Number(e.target.value))} /></div>
              <div className="field"><label>סטטוס</label><select className="select" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")}><option value="draft">בתכנון</option><option value="active">פעיל</option></select></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>תאריך התחלה</label><input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></div>
              <div className="field"><label>תאריך סיום</label><input className="input" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
            </div>
          </section>

          <section className="card">
            <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>2. מועמדים במחזור</h2><div className="stat-label">העלאת Excel, התאמת עמודות ובדיקת ת.ז כפולות</div></div><span className="badge">{candidateRows.length} מועמדים</span></div>
            <div style={{ marginTop: 16 }}><ExcelImporter onImport={setCandidateRows} /></div>
          </section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>3. יחידות משתתפות</h2><div className="stat-label">הלוח ייווצר רק עבור היחידות שתסמני כאן.</div></div><span className="badge">{selectedUnitIds.length} נבחרו</span></div>
            <div className="grid grid-2" style={{ marginTop: 14 }}>
              {loading && <div className="notice">טוען יחידות...</div>}
              {!loading && units.map((unit) => {
                const hasAccount = accountByUnit.has(unit.id);
                return <label key={unit.id} className="notice checkbox-row" style={{ opacity: hasAccount ? 1 : .55 }}>
                  <input type="checkbox" disabled={!hasAccount} checked={selectedUnitIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} />
                  <span><b>{unit.name}</b><div className="stat-label">{hasAccount ? "חשבון יחידה פעיל" : "חסר חשבון יחידה"}</div></span>
                </label>;
              })}
            </div>
          </section>

          <section className="card">
            <div className="row between"><h2 className="section-title">4. ימי ראיונות</h2><button className="btn btn-small" onClick={addDay}>+ הוספת יום</button></div>
            <div className="field"><label>משך כל ראיון</label><select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}><option value={20}>20 דקות</option><option value={30}>30 דקות</option><option value={45}>45 דקות</option><option value={60}>60 דקות</option></select></div>
            <div className="grid">
              {days.map((day, index) => <div className="notice" key={`${day.date}-${index}`}>
                <div className="grid grid-3">
                  <div className="field"><label>תאריך</label><input className="input" type="date" value={day.date} onChange={(e) => updateDay(index, { date: e.target.value })} /></div>
                  <div className="field"><label>התחלה</label><input className="input" type="time" value={day.start} onChange={(e) => updateDay(index, { start: e.target.value })} /></div>
                  <div className="field"><label>סיום</label><input className="input" type="time" value={day.end} onChange={(e) => updateDay(index, { end: e.target.value })} /></div>
                </div>
                <div className="row between"><div className="stat-label">הפסקה: 12:30–13:00</div><button className="btn btn-small btn-danger" onClick={() => removeDay(index)}>הסרה</button></div>
              </div>)}
              {!days.length && <div className="empty">לא הוגדרו עדיין ימי ראיונות.</div>}
            </div>
          </section>

          <section className="card">
            <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>5. בדיקת קיבולת</h2><div className="stat-label">כל מועמד/ת צריך/ה לפגוש כל יחידה שנבחרה.</div></div><span className={`badge ${report.canGenerate ? "ok" : "warn"}`}>{report.canGenerate ? "אפשר לשבץ" : "נדרשות התאמות"}</span></div>
            <div className="grid grid-4" style={{ marginTop: 16 }}>
              <div className="notice"><div className="stat-label">מועמדים</div><b>{candidateRows.length}</b></div>
              <div className="notice"><div className="stat-label">יחידות</div><b>{selectedUnitIds.length}</b></div>
              <div className="notice"><div className="stat-label">סה״כ ראיונות</div><b>{report.totalInterviews}</b></div>
              <div className="notice"><div className="stat-label">סלוטים זמינים</div><b>{report.availableRounds}</b></div>
            </div>
            {!report.canGenerate && candidateRows.length > 0 && selectedUnitIds.length > 0 && <div className="notice warning" style={{ marginTop: 14 }}>הוסיפי ימי ראיונות, האריכי שעות או קצרי את משך הראיון כדי לאפשר שיבוץ מלא.</div>}
          </section>
        </div>
      </div>

      <div className="row wrap" style={{ justifyContent: "flex-start", marginTop: 20 }}>
        <button className="btn btn-primary" disabled={saving || !report.canGenerate} onClick={() => saveCycle(true)}>{saving ? "שומר..." : "שמירת המחזור והמשך לשיבוץ"}</button>
        <button className="btn" disabled={saving} onClick={() => saveCycle(false)}>שמירה כטיוטה</button>
      </div>
    </AppShell>
  );
}
