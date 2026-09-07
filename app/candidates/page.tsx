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
  targetUnit: string | null;
  questionnaireDone: boolean;
  interviewCount: number;
  completedInterviewCount: number;
  pendingEvaluationCount: number;
};

type CycleOption = { id: string; name: string; status: string };

type CandidateJoin = {
  candidate_id: string;
  status: string;
  target_unit_id: string | null;
  candidates: { id: string; national_id: string; full_name: string; phone: string | null; city: string | null } | { id: string; national_id: string; full_name: string; phone: string | null; city: string | null }[] | null;
  units: { name: string } | { name: string }[] | null;
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

export default function CandidatesPage() {
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [unit, setUnit] = useState("all");

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
        supabase.from("cycle_candidates").select("candidate_id,status,target_unit_id,candidates(id,national_id,full_name,phone,city),units(name)").eq("cycle_id", cycleId),
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
        const pendingEvaluationCount = completed.filter((i) => !evaluationSet.has(i.id)).length;
        return [{
          id: candidate.id,
          nationalId: candidate.national_id,
          fullName: candidate.full_name,
          phone: candidate.phone,
          city: candidate.city,
          status: member.status,
          targetUnit: one(member.units)?.name ?? null,
          questionnaireDone: responseSet.has(candidate.id),
          interviewCount: candidateInterviews.length,
          completedInterviewCount: completed.length,
          pendingEvaluationCount,
        }];
      });
      if (!cancelled) setRows(normalized);
      setLoading(false);
    }
    loadCandidates();
    return () => { cancelled = true; };
  }, [cycleId]);

  const units = useMemo(() => [...new Set(rows.map((r) => r.targetUnit).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "he")), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);
  const filtered = useMemo(() => rows.filter((candidate) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [candidate.fullName, candidate.nationalId, candidate.phone || "", candidate.city || ""].some((value) => value.toLowerCase().includes(q));
    const matchesStatus = status === "all" || candidate.status === status;
    const matchesUnit = unit === "all" || candidate.targetUnit === unit;
    return matchesSearch && matchesStatus && matchesUnit;
  }), [rows, search, status, unit]);

  const questionnaires = rows.filter((r) => r.questionnaireDone).length;
  const scheduled = rows.filter((r) => r.interviewCount > 0).length;
  const pendingEvaluations = rows.reduce((sum, r) => sum + r.pendingEvaluationCount, 0);

  return (
    <AppShell title="מועמדים" subtitle="רשימת המועמדים במחזור, סטטוס שאלון, ראיונות וחוות דעת">
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="סה״כ במחזור" value={rows.length} accent />
        <StatCard label="שאלון הושלם" value={questionnaires} />
        <StatCard label="שובצו לראיונות" value={scheduled} />
        <StatCard label="ממתינים לחוות דעת" value={pendingEvaluations} />
      </div>

      <div className="toolbar">
        <select className="select" style={{ maxWidth: 260 }} value={cycleId} onChange={(e) => { setCycleId(e.target.value); setSearch(""); setStatus("all"); setUnit("all"); }}>
          {cycles.length === 0 && <option value="">אין מחזורים</option>}
          {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 330 }} placeholder="חיפוש שם / ת.ז / טלפון..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 210 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">סטטוס: הכל</option>
          {statuses.map((s) => <option key={s} value={s}>{displayStatus(s)}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 220 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="all">יחידת יעד: הכל</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {(search || status !== "all" || unit !== "all") && <button className="btn btn-small" onClick={() => { setSearch(""); setStatus("all"); setUnit("all"); }}>ניקוי סינון</button>}
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מועמד/ת</th><th>ת.ז</th><th>טלפון</th><th>עיר</th><th>יחידת יעד</th><th>שאלון</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}>טוען מועמדים...</td></tr>}
              {!loading && filtered.map((candidate) => (
                <tr key={candidate.id}>
                  <td><b>{candidate.fullName}</b></td>
                  <td>{candidate.nationalId}</td>
                  <td>{candidate.phone || "—"}</td>
                  <td>{candidate.city || "—"}</td>
                  <td>{candidate.targetUnit || "—"}</td>
                  <td><span className={`badge ${candidate.questionnaireDone ? "ok" : "warn"}`}>{candidate.questionnaireDone ? "הושלם" : "ממתין"}</span></td>
                  <td><StatusBadge status={displayStatus(candidate.status)} /></td>
                  <td><Link href={`/candidates/${candidate.id}`} className="btn btn-small btn-primary">פתיחת כרטיס</Link></td>
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
