"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { capacityReport, generateSchedule, validateSchedule, type InterviewDay } from "@/lib/scheduling";

type Cycle = { id: string; name: string; status: string; interview_duration_minutes: number };
type Unit = { id: string; name: string; code: string | null };
type UnitAccount = { id: string; unit_id: string | null };
type CandidateJoin = { candidate_id: string; candidates: { id: string; full_name: string; national_id: string } | { id: string; full_name: string; national_id: string }[] | null };
type Candidate = { id: string; fullName: string; nationalId: string };

type ExistingCycleUnit = { unit_id: string };
type ExistingDay = { interview_date: string; starts_at: string; ends_at: string };

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function dateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function SchedulePage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [accounts, setAccounts] = useState<UnitAccount[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [days, setDays] = useState<InterviewDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const supabase = createSupabaseBrowserClient();
      const [cyclesRes, unitsRes, accountsRes] = await Promise.all([
        supabase.from("cycles").select("id,name,status,interview_duration_minutes").order("starts_on", { ascending: false }),
        supabase.from("units").select("id,name,code").eq("active", true).order("name"),
        supabase.from("profiles").select("id,unit_id").eq("role", "interviewer").eq("active", true),
      ]);
      const firstError = cyclesRes.error || unitsRes.error || accountsRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setLoading(false); }
        return;
      }
      const cycleRows = (cyclesRes.data || []) as Cycle[];
      if (!cancelled) {
        setCycles(cycleRows);
        setUnits((unitsRes.data || []) as Unit[]);
        setAccounts((accountsRes.data || []) as UnitAccount[]);
        const preferred = cycleRows.find((c) => c.status === "active") || cycleRows.find((c) => c.status === "draft") || cycleRows[0];
        setCycleId(preferred?.id || "");
        if (!preferred) setLoading(false);
      }
    }
    loadInitial();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    async function loadCycle() {
      setLoading(true);
      setSaved(false);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const cycle = cycles.find((c) => c.id === cycleId);
      if (cycle) setDuration(cycle.interview_duration_minutes || 30);
      const [candidateRes, unitRes, dayRes] = await Promise.all([
        supabase.from("cycle_candidates").select("candidate_id,candidates(id,full_name,national_id)").eq("cycle_id", cycleId),
        supabase.from("cycle_units").select("unit_id").eq("cycle_id", cycleId),
        supabase.from("interview_days").select("interview_date,starts_at,ends_at").eq("cycle_id", cycleId).order("interview_date"),
      ]);
      const firstError = candidateRes.error || unitRes.error || dayRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setLoading(false); }
        return;
      }
      const candidateRows = ((candidateRes.data || []) as unknown as CandidateJoin[]).flatMap((row) => {
        const c = one(row.candidates);
        return c ? [{ id: c.id, fullName: c.full_name, nationalId: c.national_id }] : [];
      });
      const currentDays = ((dayRes.data || []) as ExistingDay[]).map((d) => ({
        date: d.interview_date,
        start: d.starts_at.slice(0, 5),
        end: d.ends_at.slice(0, 5),
        breaks: [{ start: "12:30", end: "13:00" }],
      }));
      if (!cancelled) {
        setCandidates(candidateRows);
        setSelectedUnitIds(((unitRes.data || []) as ExistingCycleUnit[]).map((x) => x.unit_id));
        setDays(currentDays);
        setLoading(false);
      }
    }
    loadCycle();
    return () => { cancelled = true; };
  }, [cycleId, cycles]);

  const selectedUnits = useMemo(() => units.filter((u) => selectedUnitIds.includes(u.id)), [units, selectedUnitIds]);
  const candidateNameById = useMemo(() => new Map(candidates.map((c) => [c.id, c.fullName])), [candidates]);
  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const accountByUnit = useMemo(() => new Map(accounts.filter((a) => a.unit_id).map((a) => [a.unit_id as string, a.id])), [accounts]);

  const input = useMemo(() => ({
    candidateNames: candidates.map((c) => c.id),
    units: selectedUnits.map((u) => u.id),
    days,
    durationMinutes: duration,
  }), [candidates, selectedUnits, days, duration]);
  const report = useMemo(() => capacityReport(input), [input]);
  const schedule = useMemo(() => report.canGenerate ? generateSchedule(input) : [], [input, report.canGenerate]);
  const validation = useMemo(() => schedule.length ? validateSchedule(input, schedule) : null, [input, schedule]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof schedule>();
    schedule.forEach((item) => {
      const key = `${item.date}|${item.start}|${item.end}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()];
  }, [schedule]);

  function toggleUnit(id: string) {
    setSaved(false);
    setSelectedUnitIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function addDay() {
    const lastDate = days.at(-1)?.date;
    const next = lastDate ? new Date(`${lastDate}T12:00:00`) : new Date();
    if (lastDate) next.setDate(next.getDate() + 1);
    const date = next.toISOString().slice(0, 10);
    setDays((current) => [...current, { date, start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] }]);
    setSaved(false);
  }

  function updateDay(index: number, patch: Partial<InterviewDay>) {
    setDays((current) => current.map((d, i) => i === index ? { ...d, ...patch } : d));
    setSaved(false);
  }

  function removeDay(index: number) {
    setDays((current) => current.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function saveSchedule() {
    if (!cycleId || !schedule.length || !validation?.valid) return;
    const unitsWithoutAccount = selectedUnits.filter((u) => !accountByUnit.has(u.id));
    if (unitsWithoutAccount.length) {
      setError(`לא ניתן לשמור: ליחידות ${unitsWithoutAccount.map((u) => u.name).join(", ")} אין חשבון יחידה פעיל.`);
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteUnitsError } = await supabase.from("cycle_units").delete().eq("cycle_id", cycleId);
      if (deleteUnitsError) throw deleteUnitsError;
      const { error: insertUnitsError } = await supabase.from("cycle_units").insert(selectedUnits.map((u) => ({ cycle_id: cycleId, unit_id: u.id, interviewer_id: accountByUnit.get(u.id) })));
      if (insertUnitsError) throw insertUnitsError;

      const { error: deleteDaysError } = await supabase.from("interview_days").delete().eq("cycle_id", cycleId);
      if (deleteDaysError) throw deleteDaysError;
      if (days.length) {
        const { error: insertDaysError } = await supabase.from("interview_days").insert(days.map((d) => ({ cycle_id: cycleId, interview_date: d.date, starts_at: d.start, ends_at: d.end })));
        if (insertDaysError) throw insertDaysError;
      }
      const { error: cycleUpdateError } = await supabase.from("cycles").update({ interview_duration_minutes: duration }).eq("id", cycleId);
      if (cycleUpdateError) throw cycleUpdateError;

      const payload = schedule.map((item) => ({
        cycleId,
        candidateId: item.candidate,
        unitId: item.unit,
        interviewerId: accountByUnit.get(item.unit),
        startsAt: dateTimeToIso(item.date, item.start),
        endsAt: dateTimeToIso(item.date, item.end),
      }));
      const response = await fetch("/api/admin/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviews: payload }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "שמירת הלוז נכשלה");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת הלוז נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="שיבוץ ראיונות" subtitle="בחירת מחזור ויחידות בפועל, בדיקת קיבולת ויצירת לו״ז ללא התנגשויות">
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="grid grid-3">
          <div className="field"><label>מחזור</label><select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{cycles.length === 0 && <option value="">אין מחזורים</option>}{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label>מועמדים במחזור</label><div className="preview-field"><b>{candidates.length}</b> מועמדים</div></div>
          <div className="field"><label>משך ראיון</label><select className="select" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setSaved(false); }}><option value={20}>20 דקות</option><option value={30}>30 דקות</option><option value={45}>45 דקות</option><option value={60}>60 דקות</option></select></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>יחידות פעילות במחזור</h2><div className="stat-label">סמני בדיוק אילו יחידות משתתפות במחזור הזה. הלוז ייבנה רק עבורן.</div></div><span className="badge">{selectedUnits.length} נבחרו</span></div>
        <div className="grid grid-4" style={{ marginTop: 14 }}>
          {units.map((unit) => {
            const hasAccount = accountByUnit.has(unit.id);
            return <label className="notice checkbox-row" key={unit.id} style={{ opacity: hasAccount ? 1 : .6 }}>
              <input type="checkbox" checked={selectedUnitIds.includes(unit.id)} disabled={!hasAccount} onChange={() => toggleUnit(unit.id)} />
              <span><b>{unit.name}</b><div className="stat-label">{hasAccount ? "חשבון יחידה מחובר" : "חסר חשבון יחידה"}</div></span>
            </label>;
          })}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>ימי ראיונות</h2><div className="stat-label">אפשר לשנות תאריך ושעות. כרגע הפסקת 12:30–13:00 לא נספרת כסלוט.</div></div><button className="btn btn-small" onClick={addDay}>+ הוספת יום</button></div>
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {days.map((day, index) => <div className="notice" key={`${day.date}-${index}`}>
            <div className="grid grid-3">
              <div className="field"><label>תאריך</label><input className="input" type="date" value={day.date} onChange={(e) => updateDay(index, { date: e.target.value })} /></div>
              <div className="field"><label>התחלה</label><input className="input" type="time" value={day.start} onChange={(e) => updateDay(index, { start: e.target.value })} /></div>
              <div className="field"><label>סיום</label><input className="input" type="time" value={day.end} onChange={(e) => updateDay(index, { end: e.target.value })} /></div>
            </div>
            <button className="btn btn-small btn-danger" onClick={() => removeDay(index)}>הסרת יום</button>
          </div>)}
          {!days.length && <div className="empty">עדיין לא הוגדרו ימי ראיונות למחזור.</div>}
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="סה״כ ראיונות" value={report.totalInterviews} />
        <StatCard label="סלוטים מקבילים נדרשים" value={report.requiredRounds} />
        <StatCard label="סלוטים זמינים" value={report.availableRounds} accent />
        <StatCard label="מצב" value={<span style={{ fontSize: 21, color: report.canGenerate ? "var(--success)" : "var(--danger)" }}>{report.canGenerate ? "אפשר לשבץ" : "אין קיבולת"}</span>} />
      </div>

      {loading && <div className="notice" style={{ marginBottom: 18 }}>טוען נתוני מחזור...</div>}
      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      {!loading && !report.canGenerate && <div className="notice danger" style={{ marginBottom: 18 }}><b>לא ניתן לייצר לוז כרגע.</b><div className="stat-label" style={{ marginTop: 5 }}>{!candidates.length ? "אין מועמדים במחזור. " : ""}{!selectedUnits.length ? "לא נבחרו יחידות. " : ""}{days.length && report.missingRounds ? `חסרים ${report.missingRounds} סלוטים.` : !days.length ? "לא הוגדרו ימי ראיונות." : ""}</div></div>}
      {!loading && report.canGenerate && <div className="notice success" style={{ marginBottom: 18 }}><b>✓ אפשר לייצר לוח תקין.</b> {validation?.valid ? `כל ${report.totalInterviews} הראיונות נוצרו ללא כפילויות או התנגשויות.` : ""}</div>}

      {!!schedule.length && (
        <section className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <div><h2 className="section-title" style={{ marginBottom: 4 }}>תצוגה מקדימה של הלוז</h2><div className="stat-label">{candidates.length} מועמדים × {selectedUnits.length} יחידות = {report.totalInterviews} ראיונות</div></div>
            <button className="btn btn-primary" disabled={saving} onClick={saveSchedule}>{saving ? "שומר..." : "אישור ושמירת הלוז"}</button>
          </div>
          <div className="grid">
            {grouped.slice(0, 12).map(([key, meetings]) => {
              const [date, start, end] = key.split("|");
              return <div className="schedule-slot" key={key}><div className="schedule-slot-head"><span>{date}</span><span>{start}–{end}</span></div><div className="schedule-grid">{meetings.map((m) => <div className="schedule-meeting" key={`${m.unit}-${m.candidate}`}><b>{unitNameById.get(m.unit) || m.unit}</b><div style={{ marginTop: 4 }}>{candidateNameById.get(m.candidate) || m.candidate}</div></div>)}</div></div>;
            })}
          </div>
          {grouped.length > 12 && <div className="stat-label" style={{ marginTop: 12 }}>מוצגים 12 הסלוטים הראשונים מתוך {grouped.length}. כל הלוז יישמר.</div>}
          {saved && <div className="notice success" style={{ marginTop: 14 }}>✓ הלוז נשמר במערכת ויופיע בצד של חשבונות היחידות הרלוונטיות.</div>}
        </section>
      )}
    </AppShell>
  );
}
