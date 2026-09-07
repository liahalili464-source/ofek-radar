"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type InterviewJoin = {
  id: string;
  candidate_id: string;
  cycle_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  candidates: { full_name: string } | { full_name: string }[] | null;
  cycles: { name: string; status: string } | { name: string; status: string }[] | null;
};

type InterviewView = {
  id: string;
  candidateId: string;
  candidateName: string;
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  startsAt: string;
  endsAt: string;
  status: string;
  location: string | null;
  questionnaireDone: boolean;
  evaluationDone: boolean;
};

type ViewMode = "today" | "upcoming" | "cycle" | "attention";

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function sameLocalDay(value: string, now = new Date()) {
  const d = new Date(value);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function timeRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

function statusLabel(status: string) {
  if (status === "scheduled") return "מתוכנן";
  if (status === "completed") return "בוצע";
  if (status === "cancelled") return "בוטל";
  if (status === "no_show") return "לא הגיע/ה";
  return status;
}

export default function InterviewerPage() {
  const [unitName, setUnitName] = useState("יחידה");
  const [interviews, setInterviews] = useState<InterviewView[]>([]);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (!cancelled) { setError("לא נמצא משתמש מחובר"); setLoading(false); }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("unit_id,full_name,username")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) {
        if (!cancelled) { setError(profileError?.message || "לא נמצא פרופיל"); setLoading(false); }
        return;
      }

      if (profile.unit_id) {
        const { data: unit } = await supabase.from("units").select("name").eq("id", profile.unit_id).single();
        if (!cancelled) setUnitName(unit?.name || profile.full_name || profile.username);
      } else if (!cancelled) {
        setUnitName(profile.full_name || profile.username);
      }

      const { data: interviewData, error: interviewError } = await supabase
        .from("interviews")
        .select("id,candidate_id,cycle_id,starts_at,ends_at,status,location,candidates(full_name),cycles(name,status)")
        .eq("interviewer_id", user.id)
        .order("starts_at", { ascending: true });
      if (interviewError) {
        if (!cancelled) { setError(interviewError.message); setLoading(false); }
        return;
      }

      const interviewRows = (interviewData || []) as unknown as InterviewJoin[];
      const candidateIds = [...new Set(interviewRows.map((x) => x.candidate_id))];
      const interviewIds = interviewRows.map((x) => x.id);
      const [responsesRes, evaluationsRes] = await Promise.all([
        candidateIds.length
          ? supabase.from("questionnaire_responses").select("candidate_id,cycle_id").in("candidate_id", candidateIds)
          : Promise.resolve({ data: [], error: null }),
        interviewIds.length
          ? supabase.from("evaluations").select("interview_id").in("interview_id", interviewIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const responseSet = new Set((responsesRes.data || []).map((x) => `${x.cycle_id}|${x.candidate_id}`));
      const evaluationSet = new Set((evaluationsRes.data || []).map((x) => x.interview_id));
      const normalized: InterviewView[] = interviewRows.map((x) => {
        const cycle = one(x.cycles);
        return {
          id: x.id,
          candidateId: x.candidate_id,
          candidateName: one(x.candidates)?.full_name || "מועמד/ת",
          cycleId: x.cycle_id,
          cycleName: cycle?.name || "מחזור",
          cycleStatus: cycle?.status || "",
          startsAt: x.starts_at,
          endsAt: x.ends_at,
          status: x.status,
          location: x.location,
          questionnaireDone: responseSet.has(`${x.cycle_id}|${x.candidate_id}`),
          evaluationDone: evaluationSet.has(x.id),
        };
      });

      if (!cancelled) {
        setInterviews(normalized);
        const now = Date.now();
        const preferred = normalized.find((x) => x.cycleStatus === "active" && new Date(x.endsAt).getTime() >= now)
          || normalized.find((x) => new Date(x.endsAt).getTime() >= now)
          || normalized.at(-1);
        setSelectedCycle(preferred?.cycleId || "");
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const cycleOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; status: string }>();
    interviews.forEach((x) => map.set(x.cycleId, { id: x.cycleId, name: x.cycleName, status: x.cycleStatus }));
    return [...map.values()].reverse();
  }, [interviews]);

  const cycleInterviews = useMemo(
    () => interviews.filter((x) => !selectedCycle || x.cycleId === selectedCycle),
    [interviews, selectedCycle]
  );

  const now = new Date();
  const today = useMemo(
    () => cycleInterviews.filter((x) => sameLocalDay(x.startsAt)).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [cycleInterviews]
  );
  const completedInCycle = cycleInterviews.filter((x) => x.status === "completed").length;
  const pendingEvaluations = cycleInterviews.filter((x) => x.status === "completed" && !x.evaluationDone);
  const questionnaireMissing = cycleInterviews.filter((x) => x.status === "scheduled" && !x.questionnaireDone);
  const nextInterview = cycleInterviews.find((x) => new Date(x.endsAt) >= now && x.status === "scheduled") || null;
  const selectedCycleName = cycleOptions.find((x) => x.id === selectedCycle)?.name || "אין מחזור פעיל";

  const visibleInterviews = useMemo(() => {
    const sorted = [...cycleInterviews].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    if (viewMode === "today") return sorted.filter((x) => sameLocalDay(x.startsAt));
    if (viewMode === "upcoming") return sorted.filter((x) => new Date(x.endsAt) >= new Date() && x.status === "scheduled");
    if (viewMode === "attention") return sorted.filter((x) => (x.status === "completed" && !x.evaluationDone) || (x.status === "scheduled" && !x.questionnaireDone));
    return sorted;
  }, [cycleInterviews, viewMode]);

  return (
    <AppShell title={`הראיונות שלי — ${unitName}`} subtitle={selectedCycleName}>
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, minWidth: 280 }}>
          <label>מחזור</label>
          <select className="select" value={selectedCycle} onChange={(e) => setSelectedCycle(e.target.value)} disabled={loading || !cycleOptions.length}>
            {!cycleOptions.length && <option value="">אין מחזורים זמינים</option>}
            {cycleOptions.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.status === "active" ? " · פעיל" : ""}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <div className="row wrap" style={{ alignSelf: "end" }}>
          <button className={`btn btn-small ${viewMode === "today" ? "btn-primary" : ""}`} onClick={() => setViewMode("today")}>היום</button>
          <button className={`btn btn-small ${viewMode === "upcoming" ? "btn-primary" : ""}`} onClick={() => setViewMode("upcoming")}>הקרובים</button>
          <button className={`btn btn-small ${viewMode === "cycle" ? "btn-primary" : ""}`} onClick={() => setViewMode("cycle")}>כל המחזור</button>
          <button className={`btn btn-small ${viewMode === "attention" ? "btn-primary" : ""}`} onClick={() => setViewMode("attention")}>דורש טיפול</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="ראיונות במחזור" value={cycleInterviews.length} accent />
        <StatCard label="הושלמו" value={completedInCycle} />
        <StatCard label="חוות דעת פתוחות" value={pendingEvaluations.length} />
        <StatCard label="הראיון הבא" value={<span style={{ fontSize: 22 }}>{nextInterview ? `${formatDate(nextInterview.startsAt)} · ${formatTime(nextInterview.startsAt)}` : "—"}</span>} />
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      {loading && <div className="notice" style={{ marginBottom: 18 }}>טוען את הראיונות של היחידה...</div>}

      <div className="grid grid-2" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(320px,.75fr)" }}>
        <section className="card flush">
          <div className="row between wrap" style={{ padding: 20, paddingBottom: 10 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 3 }}>{viewMode === "today" ? "סדר היום" : viewMode === "upcoming" ? "ראיונות קרובים" : viewMode === "attention" ? "ראיונות שדורשים טיפול" : "כל ראיונות המחזור"}</h2>
              <div className="stat-label">{visibleInterviews.length} ראיונות מוצגים</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>תאריך</th><th>שעה</th><th>מועמד/ת</th><th>שאלון</th><th>מיקום</th><th>סטטוס</th><th></th></tr></thead>
              <tbody>
                {!loading && visibleInterviews.length === 0 && <tr><td colSpan={7}><div className="empty">אין ראיונות להצגה במסנן הזה.</div></td></tr>}
                {visibleInterviews.map((x) => <tr key={x.id}>
                  <td>{formatDate(x.startsAt)}</td>
                  <td><b>{formatTime(x.startsAt)}</b></td>
                  <td><b>{x.candidateName}</b></td>
                  <td><span className={`badge ${x.questionnaireDone ? "ok" : "warn"}`}>{x.questionnaireDone ? "הושלם" : "חסר"}</span></td>
                  <td>{x.location || "—"}</td>
                  <td><StatusBadge status={statusLabel(x.status)} /></td>
                  <td><Link className="btn btn-small btn-primary" href={`/interviewer/candidates/${x.candidateId}?interview=${x.id}`}>פתיחת כרטיס</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <h2 className="section-title">הראיון הבא</h2>
            {nextInterview ? <>
              <div className="row between wrap">
                <div>
                  <h3 style={{ margin: 0, fontSize: 24 }}>{nextInterview.candidateName}</h3>
                  <div className="stat-label">{formatDate(nextInterview.startsAt)} · {timeRange(nextInterview.startsAt, nextInterview.endsAt)}{nextInterview.location ? ` · ${nextInterview.location}` : ""}</div>
                </div>
                <span className="badge warn">מתוכנן</span>
              </div>
              <div className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="notice"><div className="stat-label">שאלון</div><b style={{ color: nextInterview.questionnaireDone ? "var(--success)" : "var(--warning)" }}>{nextInterview.questionnaireDone ? "הושלם" : "טרם הושלם"}</b></div>
                <div className="notice"><div className="stat-label">חוות דעת</div><b>{nextInterview.evaluationDone ? "נשמרה" : "פתוחה"}</b></div>
              </div>
              <Link className="btn btn-primary" href={`/interviewer/candidates/${nextInterview.candidateId}?interview=${nextInterview.id}`} style={{ width: "100%", marginTop: 14 }}>פתיחת כרטיס מועמד</Link>
            </> : <div className="empty">אין ראיון קרוב במחזור הזה.</div>}
          </section>

          <section className="card">
            <div className="row between"><h2 className="section-title" style={{ marginBottom: 0 }}>דורש טיפול</h2><span className={`badge ${(pendingEvaluations.length + questionnaireMissing.length) ? "warn" : "ok"}`}>{pendingEvaluations.length + questionnaireMissing.length}</span></div>
            <div className="grid" style={{ marginTop: 16 }}>
              {pendingEvaluations.slice(0, 4).map((x) => <div className="notice row between" key={`eval-${x.id}`}><div><b>{x.candidateName}</b><div className="stat-label">חוות דעת טרם נשמרה</div></div><Link className="btn btn-small" href={`/interviewer/candidates/${x.candidateId}?interview=${x.id}&tab=evaluation`}>השלמת חו״ד</Link></div>)}
              {questionnaireMissing.slice(0, 4).map((x) => <div className="notice row between" key={`questionnaire-${x.id}`}><div><b>{x.candidateName}</b><div className="stat-label">שאלון מועמד טרם הושלם</div></div><Link className="btn btn-small" href={`/interviewer/candidates/${x.candidateId}?interview=${x.id}`}>פתיחת כרטיס</Link></div>)}
              {!loading && pendingEvaluations.length === 0 && questionnaireMissing.length === 0 && <div className="empty">אין פריטים פתוחים כרגע.</div>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
