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
  cycles: { name: string } | { name: string }[] | null;
};

type InterviewView = {
  id: string;
  candidateId: string;
  candidateName: string;
  cycleName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  location: string | null;
  questionnaireDone: boolean;
  evaluationDone: boolean;
};

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

function timeRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export default function InterviewerPage() {
  const [unitName, setUnitName] = useState("יחידה");
  const [interviews, setInterviews] = useState<InterviewView[]>([]);
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
      const { data: profile, error: profileError } = await supabase.from("profiles").select("unit_id,full_name,username").eq("id", user.id).single();
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
        .select("id,candidate_id,cycle_id,starts_at,ends_at,status,location,candidates(full_name),cycles(name)")
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
        candidateIds.length ? supabase.from("questionnaire_responses").select("candidate_id").in("candidate_id", candidateIds) : Promise.resolve({ data: [], error: null }),
        interviewIds.length ? supabase.from("evaluations").select("interview_id").in("interview_id", interviewIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const responseSet = new Set((responsesRes.data || []).map((x) => x.candidate_id));
      const evaluationSet = new Set((evaluationsRes.data || []).map((x) => x.interview_id));
      const normalized: InterviewView[] = interviewRows.map((x) => ({
        id: x.id,
        candidateId: x.candidate_id,
        candidateName: one(x.candidates)?.full_name || "מועמד/ת",
        cycleName: one(x.cycles)?.name || "מחזור",
        startsAt: x.starts_at,
        endsAt: x.ends_at,
        status: x.status,
        location: x.location,
        questionnaireDone: responseSet.has(x.candidate_id),
        evaluationDone: evaluationSet.has(x.id),
      }));
      if (!cancelled) setInterviews(normalized);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const today = useMemo(() => interviews.filter((x) => sameLocalDay(x.startsAt)).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)), [interviews]);
  const completedToday = today.filter((x) => x.status === "completed").length;
  const remainingToday = today.filter((x) => x.status !== "completed" && x.status !== "cancelled" && x.status !== "no_show").length;
  const nextInterview = interviews.find((x) => new Date(x.endsAt) >= now && x.status === "scheduled") || null;
  const pendingEvaluations = interviews.filter((x) => x.status === "completed" && !x.evaluationDone);
  const cycleName = nextInterview?.cycleName || today[0]?.cycleName || interviews.at(-1)?.cycleName || "אין מחזור פעיל";

  return (
    <AppShell title={`הראיונות שלי — ${unitName}`} subtitle={cycleName}>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="ראיונות היום" value={today.length} accent />
        <StatCard label="הושלמו" value={completedToday} />
        <StatCard label="נשארו" value={remainingToday} />
        <StatCard label="הראיון הבא" value={<span style={{ fontSize: 22 }}>{nextInterview ? formatTime(nextInterview.startsAt) : "—"}</span>} />
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}
      {loading && <div className="notice" style={{ marginBottom: 18 }}>טוען את הראיונות של היחידה...</div>}

      <div className="grid grid-2">
        <section className="card flush">
          <div style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">סדר היום</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>שעה</th><th>מועמד/ת</th><th>מיקום</th><th>סטטוס</th><th></th></tr></thead>
              <tbody>
                {!loading && today.length === 0 && <tr><td colSpan={5}><div className="empty">אין ראיונות להיום.</div></td></tr>}
                {today.map((x) => <tr key={x.id}>
                  <td><b>{formatTime(x.startsAt)}</b></td>
                  <td>{x.candidateName}</td>
                  <td>{x.location || "—"}</td>
                  <td><StatusBadge status={x.status === "scheduled" ? "מתוכנן" : x.status === "completed" ? "בוצע" : x.status} /></td>
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
              <div className="row between"><div><h3 style={{ margin: 0, fontSize: 24 }}>{nextInterview.candidateName}</h3><div className="stat-label">{timeRange(nextInterview.startsAt, nextInterview.endsAt)}{nextInterview.location ? ` · ${nextInterview.location}` : ""}</div></div><span className="badge warn">מתוכנן</span></div>
              <div className="grid grid-2" style={{ marginTop: 18 }}><div className="notice"><div className="stat-label">מחזור</div><b>{nextInterview.cycleName}</b></div><div className="notice"><div className="stat-label">שאלון</div><b style={{ color: nextInterview.questionnaireDone ? "var(--success)" : "var(--warning)" }}>{nextInterview.questionnaireDone ? "הושלם" : "טרם הושלם"}</b></div></div>
              <Link className="btn btn-primary" href={`/interviewer/candidates/${nextInterview.candidateId}?interview=${nextInterview.id}`} style={{ width: "100%", marginTop: 14 }}>פתיחת כרטיס והתחלת ראיון</Link>
            </> : <div className="empty">אין ראיון קרוב.</div>}
          </section>

          <section className="card">
            <h2 className="section-title">חוות דעת פתוחות</h2>
            <p className="section-subtitle">ראיונות שבוצעו ועדיין לא נשמרה עבורם חוות דעת.</p>
            <div className="grid">
              {pendingEvaluations.slice(0, 5).map((x) => <div className="notice row between" key={x.id}><div><b>{x.candidateName}</b><div className="stat-label">{new Intl.DateTimeFormat("he-IL").format(new Date(x.startsAt))} · {formatTime(x.startsAt)}</div></div><Link className="btn btn-small" href={`/interviewer/candidates/${x.candidateId}?interview=${x.id}&tab=evaluation`}>השלמת חו״ד</Link></div>)}
              {!loading && pendingEvaluations.length === 0 && <div className="empty">אין חוות דעת פתוחות.</div>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
