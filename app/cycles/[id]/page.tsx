"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Cycle = { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string };
type UnitRel = { name: string } | { name: string }[] | null;
type CycleUnit = { unit_id: string; units: UnitRel };
type CandidateRel = { full_name: string } | { full_name: string }[] | null;
type Interview = { id: string; candidate_id: string; unit_id: string; starts_at: string; status: string; candidates: CandidateRel; units: UnitRel };
type Member = { candidate_id: string; status: string; candidates: CandidateRel };

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function statusLabel(status: string) {
  if (status === "active") return "פעיל";
  if (status === "draft") return "בתכנון";
  if (status === "completed") return "סגור";
  if (status === "archived") return "ארכיון";
  if (status === "scheduled") return "מתוכנן";
  if (status === "cancelled") return "בוטל";
  if (status === "no_show") return "לא הגיע/ה";
  return status;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL").format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function CycleSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [units, setUnits] = useState<CycleUnit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [responseCandidateIds, setResponseCandidateIds] = useState<Set<string>>(new Set());
  const [evaluationInterviewIds, setEvaluationInterviewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const [cycleRes, unitsRes, membersRes, interviewsRes, responsesRes] = await Promise.all([
        supabase.from("cycles").select("id,name,starts_on,ends_on,status").eq("id", id).single(),
        supabase.from("cycle_units").select("unit_id,units(name)").eq("cycle_id", id),
        supabase.from("cycle_candidates").select("candidate_id,status,candidates(full_name)").eq("cycle_id", id),
        supabase.from("interviews").select("id,candidate_id,unit_id,starts_at,status,candidates(full_name),units(name)").eq("cycle_id", id).order("starts_at"),
        supabase.from("questionnaire_responses").select("candidate_id").eq("cycle_id", id),
      ]);
      const firstError = cycleRes.error || unitsRes.error || membersRes.error || interviewsRes.error || responsesRes.error;
      if (firstError || !cycleRes.data) {
        if (!cancelled) { setError(firstError?.message || "המחזור לא נמצא"); setLoading(false); }
        return;
      }
      const interviewRows = (interviewsRes.data || []) as unknown as Interview[];
      const ids = interviewRows.map((x) => x.id);
      const evaluationsRes = ids.length ? await supabase.from("evaluations").select("interview_id").in("interview_id", ids) : { data: [], error: null };
      if (evaluationsRes.error) {
        if (!cancelled) { setError(evaluationsRes.error.message); setLoading(false); }
        return;
      }
      if (!cancelled) {
        setCycle(cycleRes.data as Cycle);
        setUnits((unitsRes.data || []) as unknown as CycleUnit[]);
        setMembers((membersRes.data || []) as unknown as Member[]);
        setInterviews(interviewRows);
        setResponseCandidateIds(new Set((responsesRes.data || []).map((x) => x.candidate_id)));
        setEvaluationInterviewIds(new Set((evaluationsRes.data || []).map((x) => x.interview_id)));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const completedInterviews = interviews.filter((x) => x.status === "completed").length;
  const completedEvaluations = interviews.filter((x) => evaluationInterviewIds.has(x.id)).length;
  const totalInterviews = interviews.length;
  const progress = totalInterviews ? Math.round((completedInterviews / totalInterviews) * 100) : 0;

  const unitProgress = useMemo(() => units.map((unit) => {
    const unitInterviews = interviews.filter((x) => x.unit_id === unit.unit_id && x.status !== "cancelled");
    const completed = unitInterviews.filter((x) => x.status === "completed").length;
    const evaluations = unitInterviews.filter((x) => evaluationInterviewIds.has(x.id)).length;
    const noShows = unitInterviews.filter((x) => x.status === "no_show").length;
    const total = unitInterviews.length;
    const interviewProgress = total ? Math.round((completed / total) * 100) : 0;
    const evaluationProgress = total ? Math.round((evaluations / total) * 100) : 0;
    const pendingEvaluations = Math.max(0, completed - evaluations);
    return {
      unitId: unit.unit_id,
      name: one(unit.units)?.name || "יחידה",
      total,
      completed,
      remaining: Math.max(0, total - completed - noShows),
      noShows,
      evaluations,
      pendingEvaluations,
      interviewProgress,
      evaluationProgress,
    };
  }), [units, interviews, evaluationInterviewIds]);

  const upcoming = useMemo(() => interviews.filter((x) => x.status === "scheduled" && new Date(x.starts_at) >= new Date()).slice(0, 8), [interviews]);
  const attention = useMemo(() => members.filter((m) => !responseCandidateIds.has(m.candidate_id) || interviews.some((x) => x.candidate_id === m.candidate_id && x.status === "completed" && !evaluationInterviewIds.has(x.id))).slice(0, 8), [members, responseCandidateIds, interviews, evaluationInterviewIds]);

  if (loading) return <AppShell title="מחזור"><div className="notice">טוען נתוני מחזור...</div></AppShell>;

  return (
    <AppShell
      title={cycle?.name || "מחזור"}
      subtitle={cycle ? `${formatDate(cycle.starts_on)}–${formatDate(cycle.ends_on)}` : undefined}
      actions={<div className="row wrap"><Link href={`/schedule?cycle=${id}`} className="btn btn-primary">שיבוץ ראיונות</Link><Link href={`/cycles/new?edit=${id}`} className="btn">עריכת מחזור</Link><Link href="/cycles" className="btn">כל המחזורים</Link></div>}
    >
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {!cycle ? <div className="empty">לא ניתן להציג את המחזור.</div> : <>
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <StatCard label="מועמדים במחזור" value={members.length} />
          <StatCard label="שאלונים הושלמו" value={`${responseCandidateIds.size}/${members.length}`} accent />
          <StatCard label="ראיונות שבוצעו" value={`${completedInterviews}/${totalInterviews}`} />
          <StatCard label="חוות דעת התקבלו" value={`${completedEvaluations}/${totalInterviews}`} />
        </div>

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="row between wrap" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>תמונת מצב של המחזור</h2>
              <div className="stat-label">התקדמות כוללת לפי הראיונות שבוצעו בכל היחידות</div>
            </div>
            <StatusBadge status={statusLabel(cycle.status)} />
          </div>
          <div className="row between"><b style={{ fontSize: 24 }}>{progress}%</b><span className="stat-label">{Math.max(0, totalInterviews - completedInterviews)} ראיונות נשארו</span></div>
          <div className="progress" style={{ height: 10 }}><div style={{ width: `${progress}%` }} /></div>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            <div className="notice"><div className="stat-label">יחידות במחזור</div><b>{units.length}</b></div>
            <div className="notice"><div className="stat-label">ממתינים לשאלון</div><b>{Math.max(0, members.length - responseCandidateIds.size)}</b></div>
            <div className="notice"><div className="stat-label">חוות דעת פתוחות</div><b>{Math.max(0, completedInterviews - completedEvaluations)}</b></div>
          </div>
        </section>

        <section className="card flush" style={{ marginBottom: 16 }}>
          <div className="row between wrap" style={{ padding: 20, paddingBottom: 10 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>התקדמות לפי יחידה</h2>
              <div className="stat-label">כאן אפשר לראות מי סיימה, מי בפער וכמה חוות דעת עדיין חסרות בכל יחידה.</div>
            </div>
            <Link href={`/schedule?cycle=${id}`} className="btn btn-small">פתיחת לוח הראיונות</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>יחידה</th><th>ראיונות</th><th style={{ minWidth: 210 }}>התקדמות ראיונות</th><th>חוות דעת</th><th style={{ minWidth: 210 }}>התקדמות חו״ד</th><th>דורש טיפול</th><th>מצב</th></tr></thead>
              <tbody>
                {unitProgress.map((unit) => {
                  const done = unit.total > 0 && unit.interviewProgress === 100 && unit.pendingEvaluations === 0;
                  const started = unit.completed > 0 || unit.evaluations > 0;
                  return <tr key={unit.unitId}>
                    <td><b>{unit.name}</b></td>
                    <td><b>{unit.completed}/{unit.total}</b><div className="stat-label">{unit.remaining} נשארו{unit.noShows ? ` · ${unit.noShows} לא הגיעו` : ""}</div></td>
                    <td><div className="row between"><span className="stat-label">{unit.interviewProgress}%</span></div><div className="progress"><div style={{ width: `${unit.interviewProgress}%` }} /></div></td>
                    <td><b>{unit.evaluations}/{unit.total}</b></td>
                    <td><div className="row between"><span className="stat-label">{unit.evaluationProgress}%</span></div><div className="progress"><div style={{ width: `${unit.evaluationProgress}%`, background: unit.evaluationProgress === 100 ? "var(--success)" : "var(--accent)" }} /></div></td>
                    <td>{unit.pendingEvaluations > 0 ? <span className="badge warn">{unit.pendingEvaluations} חו״ד חסרות</span> : <span className="badge ok">אין פערים</span>}</td>
                    <td><span className={`badge ${done ? "ok" : started ? "warn" : ""}`}>{done ? "הושלם" : started ? "בתהליך" : "טרם התחיל"}</span></td>
                  </tr>;
                })}
                {!unitProgress.length && <tr><td colSpan={7}><div className="empty">עדיין לא נבחרו יחידות למחזור.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-2">
          <section className="card flush">
            <div className="row between" style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">ראיונות קרובים</h2><Link className="btn btn-small" href={`/schedule?cycle=${id}`}>פתיחת לוח מלא</Link></div>
            <div className="table-wrap"><table className="table"><thead><tr><th>מועד</th><th>מועמד/ת</th><th>יחידה</th><th>סטטוס</th></tr></thead><tbody>
              {upcoming.map((x) => <tr key={x.id}><td>{formatDateTime(x.starts_at)}</td><td>{one(x.candidates)?.full_name || "מועמד/ת"}</td><td>{one(x.units)?.name || "יחידה"}</td><td><StatusBadge status={statusLabel(x.status)} /></td></tr>)}
              {!upcoming.length && <tr><td colSpan={4}><div className="empty">אין ראיונות קרובים להצגה.</div></td></tr>}
            </tbody></table></div>
          </section>

          <section className="card">
            <div className="row between"><h2 className="section-title">דורש טיפול</h2><Link href={`/candidates`} className="btn btn-small">כל המועמדים</Link></div>
            <div className="grid">
              {attention.map((m) => <Link href={`/candidates/${m.candidate_id}?cycle=${id}`} className="notice row between" key={m.candidate_id}><div><b>{one(m.candidates)?.full_name || "מועמד/ת"}</b><div className="stat-label">{!responseCandidateIds.has(m.candidate_id) ? "שאלון טרם הושלם" : "נדרשת השלמת חוות דעת"}</div></div><span className="badge warn">לטיפול</span></Link>)}
              {!attention.length && <div className="empty">אין כרגע פריטים שדורשים טיפול.</div>}
            </div>
          </section>
        </div>
      </>}
    </AppShell>
  );
}
