"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type CandidateRow = {
  id: string;
  nationalId: string;
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
type CandidateJoin = {
  candidate_id: string;
  status: string;
  candidates: { id: string; national_id: string; full_name: string; phone: string | null; city: string | null } | { id: string; national_id: string; full_name: string; phone: string | null; city: string | null }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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
  if (status === "completed") return "הושלם";
  if (status === "archived") return "ארכיון";
  return status;
}

export default function CandidatesPage() {
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

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
      const supabase = createSupabaseBrowserClient();
      const [membersRes, responsesRes, interviewsRes, evaluationsRes] = await Promise.all([
        supabase.from("cycle_candidates").select("candidate_id,status,candidates(id,national_id,full_name,phone,city)").eq("cycle_id", cycleId),
        supabase.from("questionnaire_responses").select("candidate_id").eq("cycle_id", cycleId),
        supabase.from("interviews").select("id,candidate_id,status").eq("cycle_id", cycleId),
        supabase.from("evaluations").select("interview_id"),
      ]);
      const firstError = membersRes.error || responsesRes.error || interviewsRes.error || evaluationsRes.error;
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
          nationalId: candidate.national_id,
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
      if (!cancelled) { setRows(normalized); setLoading(false); }
    }
    loadCandidates();
    return () => { cancelled = true; };
  }, [cycleId]);

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const filtered = useMemo(() => rows.filter((candidate) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [candidate.fullName, candidate.nationalId, candidate.phone || "", candidate.city || ""].some((value) => value.toLowerCase().includes(q));
    return matchesSearch && (status === "all" || candidate.status === status);
  }), [rows, search, status]);

  const questionnaires = rows.filter((r) => r.questionnaireDone).length;
  const scheduled = rows.filter((r) => r.interviewCount > 0).length;
  const pendingEvaluations = rows.reduce((sum, r) => sum + r.pendingEvaluationCount, 0);
  const currentCycle = cycles.find((c) => c.id === cycleId);

  return (
    <AppShell title="מועמדים" subtitle="העבודה מתבצעת לפי מחזור, והמחזורים הקודמים נשמרים לצפייה היסטורית.">
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap">
          <div className="field" style={{ margin: 0, minWidth: 310 }}>
            <label>מחזור להצגה</label>
            <select className="select" value={cycleId} onChange={(e) => { setCycleId(e.target.value); setSearch(""); setStatus("all"); }}>
              {cycles.length === 0 && <option value="">אין מחזורים</option>}
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycleStatusLabel(cycle.status)}</option>)}
            </select>
          </div>
          {currentCycle && <span className={`badge ${currentCycle.status === "active" ? "ok" : ""}`}>{cycleStatusLabel(currentCycle.status)}</span>}
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="מועמדים במחזור" value={rows.length} accent />
        <StatCard label="שאלון הושלם" value={questionnaires} />
        <StatCard label="שובצו לראיונות" value={scheduled} />
        <StatCard label="חוות דעת פתוחות" value={pendingEvaluations} />
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 360 }} placeholder="חיפוש שם / ת.ז / טלפון / עיר..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">סטטוס: הכל</option>
          {statuses.map((s) => <option key={s} value={s}>{displayStatus(s)}</option>)}
        </select>
        {(search || status !== "all") && <button className="btn btn-small" onClick={() => { setSearch(""); setStatus("all"); }}>ניקוי סינון</button>}
        <span className="stat-label" style={{ alignSelf: "center" }}>{filtered.length} מתוך {rows.length} מועמדים</span>
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מועמד/ת</th><th>ת.ז</th><th>טלפון</th><th>עיר</th><th>שאלון</th><th>ראיונות</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}>טוען מועמדים...</td></tr>}
              {!loading && filtered.map((candidate) => (
                <tr key={candidate.id}>
                  <td><b>{candidate.fullName}</b></td>
                  <td>{candidate.nationalId}</td>
                  <td>{candidate.phone || "—"}</td>
                  <td>{candidate.city || "—"}</td>
                  <td><span className={`badge ${candidate.questionnaireDone ? "ok" : "warn"}`}>{candidate.questionnaireDone ? "הושלם" : "ממתין"}</span></td>
                  <td><b>{candidate.completedInterviewCount}/{candidate.interviewCount}</b>{candidate.pendingEvaluationCount > 0 && <div className="stat-label">{candidate.pendingEvaluationCount} חו״ד פתוחות</div>}</td>
                  <td><StatusBadge status={displayStatus(candidate.status)} /></td>
                  <td><Link href={`/candidates/${candidate.id}?cycle=${cycleId}`} className="btn btn-small btn-primary">פתיחת כרטיס</Link></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="empty">לא נמצאו מועמדים שמתאימים לסינון.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
