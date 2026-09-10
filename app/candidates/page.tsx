"use client";

import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type CandidateRow = {
  id: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  status: string;
  questionnaireDone: boolean;
  interviewCount: number;
  completedInterviewCount: number;
  pendingEvaluationCount: number;
};

type CycleOption = { id: string; name: string; status: string };
type UnitOption = { id: string; name: string };
type PriorityConfig = { starred: boolean; unitId?: string | null; note?: string };
type AdminConfig = { priorities?: Record<string, PriorityConfig> };
type CandidateJoin = {
  candidate_id: string;
  status: string;
  candidates: { id: string; full_name: string; phone: string | null; city: string | null } | { id: string; full_name: string; phone: string | null; city: string | null }[] | null;
};
type CycleUnitJoin = { units: { id: string; name: string } | { id: string; name: string }[] | null };

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

const statusLabels: Record<string, string> = {
  new: "חדש",
  questionnaire_completed: "שאלון הושלם",
  scheduled: "שובץ",
  waiting_interview: "ממתין לראיון",
  review: "בדיקת חו״ד",
  completed: "הושלם",
};

function displayStatus(status: string) {
  return statusLabels[status] || status;
}

function cycleStatusLabel(status: string) {
  if (status === "active") return "פעיל";
  if (status === "draft") return "בתכנון";
  if (status === "completed") return "סגור";
  if (status === "archived") return "ארכיון";
  return status;
}

export default function CandidatesPage() {
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [cycleUnits, setCycleUnits] = useState<UnitOption[]>([]);
  const [priorities, setPriorities] = useState<Record<string, PriorityConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCity, setNewCity] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [priorityCandidateId, setPriorityCandidateId] = useState("");
  const [priorityStarred, setPriorityStarred] = useState(true);
  const [priorityUnitId, setPriorityUnitId] = useState("");
  const [priorityNote, setPriorityNote] = useState("");
  const [prioritySaving, setPrioritySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: cycleError } = await supabase.from("cycles").select("id,name,status").order("starts_on", { ascending: false });
      if (cycleError) {
        if (!cancelled) { setError(cycleError.message); setLoading(false); }
        return;
      }
      const list = (data || []) as CycleOption[];
      if (!cancelled) {
        setCycles(list);
        const preferred = list.find((c) => c.status === "active") || list.find((c) => c.status === "draft") || list[0];
        setCycleId(preferred?.id || "");
        if (!preferred) setLoading(false);
      }
    }
    loadCycles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    async function loadCandidates() {
      setLoading(true);
      setError("");
      setPriorityCandidateId("");
      const supabase = createSupabaseBrowserClient();
      const [membersRes, responsesRes, interviewsRes, evaluationsRes, unitsRes, configRes] = await Promise.all([
        supabase.from("cycle_candidates").select("candidate_id,status,candidates(id,full_name,phone,city)").eq("cycle_id", cycleId),
        supabase.from("questionnaire_responses").select("candidate_id").eq("cycle_id", cycleId),
        supabase.from("interviews").select("id,candidate_id,status").eq("cycle_id", cycleId),
        supabase.from("evaluations").select("interview_id"),
        supabase.from("cycle_units").select("units(id,name)").eq("cycle_id", cycleId),
        fetch(`/api/admin/cycle-config?cycleId=${encodeURIComponent(cycleId)}`),
      ]);
      const firstError = membersRes.error || responsesRes.error || interviewsRes.error || evaluationsRes.error || unitsRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setRows([]); setLoading(false); }
        return;
      }

      const responseSet = new Set((responsesRes.data || []).map((x) => x.candidate_id));
      const evaluationSet = new Set((evaluationsRes.data || []).map((x) => x.interview_id));
      const interviews = interviewsRes.data || [];
      const normalized = ((membersRes.data || []) as unknown as CandidateJoin[]).flatMap((member) => {
        const candidate = one(member.candidates);
        if (!candidate) return [];
        const candidateInterviews = interviews.filter((i) => i.candidate_id === candidate.id);
        const completed = candidateInterviews.filter((i) => i.status === "completed");
        return [{
          id: candidate.id,
          fullName: candidate.full_name,
          phone: candidate.phone,
          city: candidate.city,
          status: member.status,
          questionnaireDone: responseSet.has(candidate.id),
          interviewCount: candidateInterviews.length,
          completedInterviewCount: completed.length,
          pendingEvaluationCount: completed.filter((i) => !evaluationSet.has(i.id)).length,
        }];
      });
      const unitRows = ((unitsRes.data || []) as unknown as CycleUnitJoin[]).flatMap((row) => {
        const unit = one(row.units);
        return unit ? [unit] : [];
      });
      const config = configRes.ok ? await configRes.json() as AdminConfig : {};
      if (!cancelled) {
        setRows(normalized);
        setCycleUnits(unitRows);
        setPriorities(config.priorities || {});
        setLoading(false);
      }
    }
    loadCandidates();
    return () => { cancelled = true; };
  }, [cycleId, refreshKey]);

  async function addCandidate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cycleId) return;
    const phone = normalizePhone(newPhone);
    if (!newName.trim() || phone.length < 9) {
      setError("יש להזין שם ומספר טלפון תקין.");
      return;
    }
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: existing, error: existingError } = await supabase.from("candidates").select("id").eq("phone", phone).limit(2);
      if (existingError) throw existingError;
      if ((existing || []).length > 1) throw new Error("מספר הטלפון מופיע יותר מפעם אחת במערכת.");

      let candidateId = existing?.[0]?.id as string | undefined;
      if (candidateId) {
        const { error: updateError } = await supabase.from("candidates").update({ full_name: newName.trim(), city: newCity.trim() || null, updated_at: new Date().toISOString() }).eq("id", candidateId);
        if (updateError) throw updateError;
      } else {
        const { data: created, error: createError } = await supabase.from("candidates").insert({
          national_id: `phone:${phone}`,
          full_name: newName.trim(),
          phone,
          city: newCity.trim() || null,
          source_data: {},
        }).select("id").single();
        if (createError || !created) throw createError || new Error("יצירת המועמד/ת נכשלה");
        candidateId = created.id;
      }

      const { error: membershipError } = await supabase.from("cycle_candidates").upsert({ cycle_id: cycleId, candidate_id: candidateId }, { onConflict: "cycle_id,candidate_id" });
      if (membershipError) throw membershipError;
      setSuccess(`${newName.trim()} נוסף/ה למחזור.`);
      setNewName("");
      setNewPhone("");
      setNewCity("");
      setShowAdd(false);
      setRefreshKey((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הוספת המועמד/ת נכשלה");
    } finally {
      setAdding(false);
    }
  }

  function openPriority(candidate: CandidateRow) {
    const current = priorities[candidate.id];
    setPriorityCandidateId(candidate.id);
    setPriorityStarred(current?.starred ?? true);
    setPriorityUnitId(current?.unitId || "");
    setPriorityNote(current?.note || "");
    setError("");
    setSuccess("");
  }

  async function savePriority() {
    if (!cycleId || !priorityCandidateId) return;
    setPrioritySaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/cycle-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, priority: { candidateId: priorityCandidateId, starred: priorityStarred, unitId: priorityUnitId || null, note: priorityNote } }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "שמירת ההעדפה נכשלה");
      setPriorities(json.priorities || {});
      const candidate = rows.find((row) => row.id === priorityCandidateId);
      setSuccess(priorityStarred ? `ההעדפה עבור ${candidate?.fullName || "המועמד/ת"} נשמרה.` : "סימון ההעדפה הוסר.");
      setPriorityCandidateId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת ההעדפה נכשלה");
    } finally {
      setPrioritySaving(false);
    }
  }

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const filtered = useMemo(() => rows.filter((candidate) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [candidate.fullName, candidate.phone || "", candidate.city || ""].some((value) => value.toLowerCase().includes(q));
    const matchesPriority = !priorityOnly || priorities[candidate.id]?.starred === true;
    return matchesSearch && matchesPriority && (status === "all" || candidate.status === status);
  }), [rows, search, status, priorityOnly, priorities]);

  const questionnaires = rows.filter((r) => r.questionnaireDone).length;
  const scheduled = rows.filter((r) => r.interviewCount > 0).length;
  const pendingEvaluations = rows.reduce((sum, r) => sum + r.pendingEvaluationCount, 0);
  const currentCycle = cycles.find((c) => c.id === cycleId);
  const priorityCandidate = rows.find((row) => row.id === priorityCandidateId);
  const unitNameById = new Map(cycleUnits.map((unit) => [unit.id, unit.name]));

  return (
    <AppShell
      title="מועמדים"
      actions={<button className="btn btn-primary" disabled={!cycleId} onClick={() => { setShowAdd((x) => !x); setError(""); setSuccess(""); }}><Plus size={17} /> {showAdd ? "ביטול" : "הוספת מועמד"}</button>}
    >
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="notice success" style={{ marginBottom: 16 }}>{success}</div>}

      {showAdd && <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="section-title">הוספת מועמד/ת ידנית</h2>
        <form onSubmit={addCandidate}>
          <div className="grid grid-3">
            <div className="field"><label>שם מלא</label><input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
            <div className="field"><label>טלפון</label><input className="input" dir="ltr" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="0501234567" required /></div>
            <div className="field"><label>עיר</label><input className="input" value={newCity} onChange={(e) => setNewCity(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" disabled={adding}>{adding ? "מוסיף..." : "הוספה למחזור"}</button>
        </form>
      </section>}

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap">
          <div className="field" style={{ margin: 0, minWidth: 310 }}>
            <label>מחזור להצגה</label>
            <select className="select" value={cycleId} onChange={(e) => { setCycleId(e.target.value); setSearch(""); setStatus("all"); setPriorityOnly(false); }}>
              {cycles.length === 0 && <option value="">אין מחזורים</option>}
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycleStatusLabel(cycle.status)}</option>)}
            </select>
          </div>
          {currentCycle && <span className={`badge ${currentCycle.status === "active" ? "ok" : ""}`}>{cycleStatusLabel(currentCycle.status)}</span>}
        </div>
      </section>

      {priorityCandidate && <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap"><div><h2 className="section-title" style={{ marginBottom: 4 }}>העדפה ניהולית — {priorityCandidate.fullName}</h2><div className="stat-label">הסימון וההערה מוצגים למנהלים בלבד.</div></div><button className="btn btn-small" onClick={() => setPriorityCandidateId("")}>סגירה</button></div>
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <label className="notice checkbox-row"><input type="checkbox" checked={priorityStarred} onChange={(e) => setPriorityStarred(e.target.checked)} /><span><b>מועמד/ת בעדיפות</b></span></label>
          <div className="field"><label>יחידה מועדפת / מיועדת</label><select className="select" value={priorityUnitId} onChange={(e) => setPriorityUnitId(e.target.value)}><option value="">ללא יחידה מסוימת</option>{cycleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
        </div>
        <div className="field"><label>סיבת העדפה / הערה למנהלים</label><textarea rows={3} value={priorityNote} onChange={(e) => setPriorityNote(e.target.value)} placeholder="לדוגמה: מפקד היחידה ביקש לקדם את המועמד/ת לשיבוץ ביחידה" /></div>
        <button className="btn btn-primary" disabled={prioritySaving} onClick={savePriority}>{prioritySaving ? "שומר..." : "שמירת העדפה"}</button>
      </section>}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="מועמדים במחזור" value={rows.length} accent />
        <StatCard label="שאלון הושלם" value={questionnaires} />
        <StatCard label="שובצו לראיונות" value={scheduled} />
        <StatCard label="חוות דעת פתוחות" value={pendingEvaluations} />
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 360 }} placeholder="חיפוש שם / טלפון / עיר..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">סטטוס: הכל</option>
          {statuses.map((s) => <option key={s} value={s}>{displayStatus(s)}</option>)}
        </select>
        <button className={`btn btn-small ${priorityOnly ? "btn-primary" : ""}`} onClick={() => setPriorityOnly((value) => !value)}><Star size={15} fill={priorityOnly ? "currentColor" : "none"} /> בעדיפות בלבד</button>
        {(search || status !== "all" || priorityOnly) && <button className="btn btn-small" onClick={() => { setSearch(""); setStatus("all"); setPriorityOnly(false); }}>ניקוי סינון</button>}
        <span className="stat-label" style={{ alignSelf: "center" }}>{filtered.length} מתוך {rows.length} מועמדים</span>
      </div>

      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מועמד/ת</th><th>טלפון</th><th>עיר</th><th>שאלון</th><th>ראיונות</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}>טוען מועמדים...</td></tr>}
              {!loading && filtered.map((candidate) => {
                const priority = priorities[candidate.id];
                const preferredUnit = priority?.unitId ? unitNameById.get(priority.unitId) : null;
                return <tr key={candidate.id}>
                  <td><div className="row" style={{ alignItems: "center", gap: 8 }}><button className="btn btn-icon btn-small" onClick={() => openPriority(candidate)} title={priority?.note || (priority?.starred ? "העדפה ניהולית" : "סימון העדפה")} aria-label="העדפה ניהולית"><Star size={17} fill={priority?.starred ? "currentColor" : "none"} /></button><div><b>{candidate.fullName}</b>{priority?.starred && <div className="stat-label">{preferredUnit ? `בעדיפות · ${preferredUnit}` : "בעדיפות ניהולית"}</div>}</div></div></td>
                  <td>{candidate.phone || "—"}</td>
                  <td>{candidate.city || "—"}</td>
                  <td><span className={`badge ${candidate.questionnaireDone ? "ok" : "warn"}`}>{candidate.questionnaireDone ? "הושלם" : "ממתין"}</span></td>
                  <td><b>{candidate.completedInterviewCount}/{candidate.interviewCount}</b>{candidate.pendingEvaluationCount > 0 && <div className="stat-label">{candidate.pendingEvaluationCount} חו״ד פתוחות</div>}</td>
                  <td><StatusBadge status={displayStatus(candidate.status)} /></td>
                  <td><Link href={`/candidates/${candidate.id}?cycle=${cycleId}`} className="btn btn-small btn-primary">פתיחת כרטיס</Link></td>
                </tr>;
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={7}><div className="empty">לא נמצאו מועמדים שמתאימים לסינון.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
