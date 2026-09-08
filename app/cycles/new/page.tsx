"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExcelImporter, type NormalizedCandidateRow } from "@/components/excel-importer";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { capacityReport, type InterviewDay } from "@/lib/scheduling";

type Unit = { id: string; name: string; code: string | null };
type UnitAccount = { id: string; unit_id: string | null };
type CycleStatus = "draft" | "active" | "completed";
type ExistingCycle = { id: string; name: string; recruitment_year: number; starts_on: string | null; ends_on: string | null; status: CycleStatus | "archived"; interview_duration_minutes: number };
type ExistingUnit = { unit_id: string };
type ExistingDay = { interview_date: string; starts_at: string; ends_at: string };

function addDays(date: string, amount: number) {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day + amount);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function NewCyclePage() {
  const router = useRouter();
  const [editId, setEditId] = useState("");
  const [name, setName] = useState("");
  const [recruitmentYear, setRecruitmentYear] = useState(new Date().getFullYear());
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [status, setStatus] = useState<CycleStatus>("draft");
  const [candidateRows, setCandidateRows] = useState<NormalizedCandidateRow[]>([]);
  const [existingCandidateCount, setExistingCandidateCount] = useState(0);
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
    async function load() {
      const currentEditId = new URLSearchParams(window.location.search).get("edit") || "";
      setEditId(currentEditId);
      const supabase = createSupabaseBrowserClient();
      const [unitsRes, accountsRes] = await Promise.all([
        supabase.from("units").select("id,name,code").eq("active", true).order("name"),
        supabase.from("profiles").select("id,unit_id").eq("role", "interviewer").eq("active", true),
      ]);
      const firstError = unitsRes.error || accountsRes.error;
      if (firstError) { if (!cancelled) { setError(firstError.message); setLoading(false); } return; }
      if (!cancelled) { setUnits((unitsRes.data || []) as Unit[]); setAccounts((accountsRes.data || []) as UnitAccount[]); }

      if (currentEditId) {
        const [cycleRes, cycleUnitsRes, daysRes, candidatesRes] = await Promise.all([
          supabase.from("cycles").select("id,name,recruitment_year,starts_on,ends_on,status,interview_duration_minutes").eq("id", currentEditId).single(),
          supabase.from("cycle_units").select("unit_id").eq("cycle_id", currentEditId),
          supabase.from("interview_days").select("interview_date,starts_at,ends_at").eq("cycle_id", currentEditId).order("interview_date"),
          supabase.from("cycle_candidates").select("candidate_id", { count: "exact", head: true }).eq("cycle_id", currentEditId),
        ]);
        const editError = cycleRes.error || cycleUnitsRes.error || daysRes.error || candidatesRes.error;
        if (editError || !cycleRes.data) { if (!cancelled) { setError(editError?.message || "לא ניתן לטעון את המחזור"); setLoading(false); } return; }
        const cycle = cycleRes.data as ExistingCycle;
        if (!cancelled) {
          setName(cycle.name); setRecruitmentYear(cycle.recruitment_year); setStartsOn(cycle.starts_on || ""); setEndsOn(cycle.ends_on || "");
          setStatus(cycle.status === "archived" ? "completed" : cycle.status); setDuration(cycle.interview_duration_minutes || 30);
          setSelectedUnitIds(((cycleUnitsRes.data || []) as ExistingUnit[]).map((x) => x.unit_id));
          setDays(((daysRes.data || []) as ExistingDay[]).map((d) => ({ date: d.interview_date, start: d.starts_at.slice(0, 5), end: d.ends_at.slice(0, 5), breaks: [{ start: "12:00", end: "13:00" }] })));
          setExistingCandidateCount(candidatesRes.count || 0);
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const accountByUnit = useMemo(() => new Map(accounts.filter((a) => a.unit_id).map((a) => [a.unit_id as string, a.id])), [accounts]);
  const selectedUnits = useMemo(() => units.filter((u) => selectedUnitIds.includes(u.id)), [units, selectedUnitIds]);
  const candidateCount = editId ? existingCandidateCount : candidateRows.length;
  const input = useMemo(() => ({ candidateNames: Array.from({ length: candidateCount }, (_, i) => `candidate-${i}`), units: selectedUnitIds, days, durationMinutes: duration }), [candidateCount, selectedUnitIds, days, duration]);
  const report = useMemo(() => capacityReport(input), [input]);

  function handleStartDate(value: string) {
    setStartsOn(value);
    if (!value) return;
    const nextDay = addDays(value, 1);
    setEndsOn((current) => !current || current <= value ? nextDay : current);
  }
  function toggleUnit(unitId: string) { setSelectedUnitIds((current) => current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId]); }
  function updateDay(index: number, patch: Partial<InterviewDay>) { setDays((current) => current.map((d, i) => i === index ? { ...d, ...patch } : d)); }
  function updateBreak(index: number, field: "start" | "end", value: string) {
    setDays((current) => current.map((d, i) => i === index ? { ...d, breaks: [{ start: field === "start" ? value : d.breaks?.[0]?.start || "12:00", end: field === "end" ? value : d.breaks?.[0]?.end || "13:00" }] } : d));
  }
  function addDay() {
    setDays((current) => {
      const nextDate = current.length ? addDays(current[current.length - 1].date, 1) : (startsOn || new Date().toISOString().slice(0, 10));
      return [...current, { date: nextDate, start: "09:00", end: "16:00", breaks: [{ start: "12:00", end: "13:00" }] }];
    });
  }
  function removeDay(index: number) { setDays((current) => current.filter((_, i) => i !== index)); }

  async function saveCycle(destination: "summary" | "schedule", forceDraft = false) {
    setError("");
    if (!name.trim()) { setError("יש להזין שם למחזור."); return; }
    if (!recruitmentYear) { setError("יש להזין שנת גיוס."); return; }
    if (startsOn && endsOn && endsOn <= startsOn) { setError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה."); return; }
    if (destination === "schedule" && !candidateCount) { setError("כדי ליצור לוח ראיונות יש לייבא קודם מועמדים למחזור."); return; }
    if (destination === "schedule" && !selectedUnitIds.length) { setError("יש לבחור לפחות יחידה אחת למחזור."); return; }
    if (destination === "schedule" && !days.length) { setError("יש להגדיר לפחות יום ראיונות אחד."); return; }
    const invalidBreak = days.find((d) => d.breaks?.[0] && d.breaks[0].end <= d.breaks[0].start);
    if (invalidBreak) { setError("שעת סיום ההפסקה חייבת להיות אחרי שעת ההתחלה."); return; }

    const missingAccounts = selectedUnits.filter((u) => !accountByUnit.has(u.id));
    if (missingAccounts.length) { setError(`ליחידות ${missingAccounts.map((u) => u.name).join(", ")} אין חשבון יחידה פעיל.`); return; }

    setSaving(true);
    try {
      const payload = {
        id: editId || undefined, name: name.trim(), recruitmentYear, startsOn: startsOn || null, endsOn: endsOn || null, durationMinutes: duration,
        status: forceDraft ? "draft" : status,
        units: selectedUnits.map((u) => ({ unitId: u.id, interviewerId: accountByUnit.get(u.id) })),
        days: days.map((d) => ({ date: d.date, start: d.start, end: d.end })),
      };
      const cycleResponse = await fetch("/api/admin/cycles", { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const cycleJson = await cycleResponse.json();
      if (!cycleResponse.ok) throw new Error(cycleJson.error === "END_DATE_MUST_BE_AFTER_START_DATE" ? "תאריך הסיום חייב להיות אחרי תאריך ההתחלה." : (cycleJson.error || "שמירת המחזור נכשלה"));
      const cycleId = (cycleJson.cycle?.id || editId) as string | undefined;
      if (!cycleId) throw new Error("לא התקבל מזהה למחזור");

      if (!editId && candidateRows.length) {
        const importResponse = await fetch("/api/admin/candidates/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId, rows: candidateRows, fileName: "candidates.xlsx" }) });
        const importJson = await importResponse.json();
        if (!importResponse.ok) throw new Error(importJson.error || "ייבוא המועמדים נכשל");
        if (importJson.rejected?.length) setError(`${importJson.imported} מועמדים נשמרו, ${importJson.rejected.length} שורות לא יובאו.`);
      }

      const shouldGoToSchedule = destination === "schedule" && status !== "completed" && !forceDraft;
      router.push(shouldGoToSchedule ? `/schedule?cycle=${cycleId}` : `/cycles/${cycleId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת המחזור נכשלה");
      setSaving(false);
    }
  }

  const title = editId ? "עריכת מחזור" : "פתיחת מחזור חדש";

  return (
    <AppShell title={title}>
      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card"><h2 className="section-title">1. פרטי המחזור</h2><div className="field"><label>שם המחזור</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: מחזור אוקטובר 2026" /></div><div className="grid grid-2"><div className="field"><label>שנת גיוס</label><input className="input" type="number" value={recruitmentYear} onChange={(e) => setRecruitmentYear(Number(e.target.value))} /></div><div className="field"><label>סטטוס</label><select className="select" value={status} onChange={(e) => setStatus(e.target.value as CycleStatus)}><option value="draft">בתכנון</option><option value="active">פעיל</option><option value="completed">סגור</option></select></div></div><div className="grid grid-2"><div className="field"><label>תאריך התחלה</label><input className="input" type="date" value={startsOn} onChange={(e) => handleStartDate(e.target.value)} /></div><div className="field"><label>תאריך סיום</label><input className="input" type="date" value={endsOn} min={startsOn ? addDays(startsOn, 1) : undefined} onChange={(e) => setEndsOn(e.target.value)} /></div></div></section>
          <section className="card"><div className="row between"><h2 className="section-title" style={{ marginBottom: 4 }}>2. מועמדים במחזור</h2><span className="badge">{candidateCount} מועמדים</span></div>{editId ? <div className="notice" style={{ marginTop: 16 }}><b>{existingCandidateCount} מועמדים כבר משויכים למחזור</b></div> : <div style={{ marginTop: 16 }}><ExcelImporter onImport={setCandidateRows} /></div>}</section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card"><div className="row between"><h2 className="section-title" style={{ marginBottom: 4 }}>3. יחידות משתתפות</h2><span className="badge">{selectedUnitIds.length} נבחרו</span></div><div className="grid grid-2" style={{ marginTop: 14 }}>{loading && <div className="notice">טוען יחידות...</div>}{!loading && units.map((unit) => { const hasAccount = accountByUnit.has(unit.id); return <label key={unit.id} className="notice checkbox-row" style={{ opacity: hasAccount ? 1 : .55 }}><input type="checkbox" disabled={!hasAccount || status === "completed"} checked={selectedUnitIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} /><span><b>{unit.name}</b>{!hasAccount && <div className="stat-label">חסר חשבון יחידה</div>}</span></label>; })}</div>{status === "completed" && <div className="notice warning" style={{ marginTop: 14 }}>מחזור סגור נשמר לצפייה היסטורית. כדי לשנות שיבוץ או יחידות, החזירי אותו קודם לסטטוס פעיל.</div>}</section>

          <section className="card"><div className="row between"><h2 className="section-title">4. ימי ראיונות</h2><button className="btn btn-small" disabled={status === "completed"} onClick={addDay}>+ הוספת יום</button></div><div className="field"><label>משך כל ראיון</label><select className="select" disabled={status === "completed"} value={duration} onChange={(e) => setDuration(Number(e.target.value))}><option value={20}>20 דקות</option><option value={30}>30 דקות</option><option value={45}>45 דקות</option><option value={60}>60 דקות</option></select></div><div className="grid">{days.map((day, index) => <div className="notice" key={`${day.date}-${index}`}><div className="grid grid-3"><div className="field"><label>תאריך</label><input className="input" type="date" min={startsOn || undefined} max={endsOn || undefined} disabled={status === "completed"} value={day.date} onChange={(e) => updateDay(index, { date: e.target.value })} /></div><div className="field"><label>התחלה</label><input className="input" type="time" disabled={status === "completed"} value={day.start} onChange={(e) => updateDay(index, { start: e.target.value })} /></div><div className="field"><label>סיום</label><input className="input" type="time" disabled={status === "completed"} value={day.end} onChange={(e) => updateDay(index, { end: e.target.value })} /></div></div><div className="grid grid-2"><div className="field"><label>תחילת הפסקה</label><input className="input" type="time" disabled={status === "completed"} value={day.breaks?.[0]?.start || "12:00"} onChange={(e) => updateBreak(index, "start", e.target.value)} /></div><div className="field"><label>סיום הפסקה</label><input className="input" type="time" disabled={status === "completed"} value={day.breaks?.[0]?.end || "13:00"} onChange={(e) => updateBreak(index, "end", e.target.value)} /></div></div><button className="btn btn-small btn-danger" disabled={status === "completed"} onClick={() => removeDay(index)}>הסרה</button></div>)}{!days.length && <div className="empty">לא הוגדרו עדיין ימי ראיונות.</div>}</div></section>

          <section className="card"><div className="row between"><h2 className="section-title" style={{ marginBottom: 4 }}>5. בדיקת קיבולת</h2><span className={`badge ${report.canGenerate ? "ok" : "warn"}`}>{report.canGenerate ? "אפשר לשבץ" : "נדרשות התאמות"}</span></div><div className="grid grid-4" style={{ marginTop: 16 }}><div className="notice"><div className="stat-label">מועמדים</div><b>{candidateCount}</b></div><div className="notice"><div className="stat-label">יחידות</div><b>{selectedUnitIds.length}</b></div><div className="notice"><div className="stat-label">סה״כ ראיונות</div><b>{report.totalInterviews}</b></div><div className="notice"><div className="stat-label">זמני ראיון זמינים</div><b>{report.availableRounds}</b></div></div>{!report.canGenerate && candidateCount > 0 && selectedUnitIds.length > 0 && status !== "completed" && <div className="notice warning" style={{ marginTop: 14 }}>הוסיפי ימי ראיונות, האריכי שעות או קצרי את משך הראיון כדי לאפשר שיבוץ מלא.</div>}</section>
        </div>
      </div>

      <div className="row wrap" style={{ justifyContent: "flex-start", marginTop: 20 }}>{editId ? <><button className="btn btn-primary" disabled={saving} onClick={() => saveCycle("summary")}>{saving ? "שומר..." : status === "completed" ? "שמירת המחזור כסגור" : "שמירת שינויים"}</button>{status !== "completed" && <button className="btn" disabled={saving || !report.canGenerate} onClick={() => saveCycle("schedule")}>שמירה והמשך לשיבוץ</button>}</> : <>{status !== "completed" && <button className="btn btn-primary" disabled={saving || !report.canGenerate} onClick={() => saveCycle("schedule")}>{saving ? "שומר..." : "שמירת המחזור והמשך לשיבוץ"}</button>}<button className={status === "completed" ? "btn btn-primary" : "btn"} disabled={saving} onClick={() => saveCycle("summary", status !== "completed")}>{status === "completed" ? "שמירת מחזור סגור" : "שמירה כטיוטה"}</button></>}</div>
    </AppShell>
  );
}
