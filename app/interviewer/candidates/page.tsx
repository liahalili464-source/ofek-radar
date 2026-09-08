"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type CandidateRel = {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
} | {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
}[] | null;

type CycleRel = { id: string; name: string; status: string } | { id: string; name: string; status: string }[] | null;

type InterviewRow = {
  id: string;
  candidate_id: string;
  cycle_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  candidates: CandidateRel;
  cycles: CycleRel;
};

type CandidateView = {
  interviewId: string;
  candidateId: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  startsAt: string;
  status: string;
  questionnaireDone: boolean;
  evaluationDone: boolean;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "scheduled") return "מתוכנן";
  if (status === "completed") return "בוצע";
  if (status === "cancelled") return "בוטל";
  if (status === "no_show") return "לא הגיע/ה";
  return status;
}

export default function InterviewerCandidatesPage() {
  const [rows, setRows] = useState<CandidateView[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [search, setSearch] = useState("");
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

      const { data: interviewData, error: interviewError } = await supabase
        .from("interviews")
        .select("id,candidate_id,cycle_id,starts_at,ends_at,status,location,candidates(id,full_name,phone,city),cycles(id,name,status)")
        .eq("interviewer_id", user.id)
        .order("starts_at", { ascending: true });
      if (interviewError) {
        if (!cancelled) { setError(interviewError.message); setLoading(false); }
        return;
      }

      const interviewRows = (interviewData || []) as unknown as InterviewRow[];
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

      const firstError = responsesRes.error || evaluationsRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setLoading(false); }
        return;
      }

      const responseSet = new Set((responsesRes.data || []).map((x) => `${x.cycle_id}|${x.candidate_id}`));
      const evaluationSet = new Set((evaluationsRes.data || []).map((x) => x.interview_id));
      const normalized = interviewRows.flatMap((row) => {
        const candidate = one(row.candidates);
        const cycle = one(row.cycles);
        if (!candidate || !cycle) return [];
        return [{
          interviewId: row.id,
          candidateId: row.candidate_id,
          fullName: candidate.full_name,
          phone: candidate.phone,
          city: candidate.city,
          cycleId: row.cycle_id,
          cycleName: cycle.name,
          cycleStatus: cycle.status,
          startsAt: row.starts_at,
          status: row.status,
          questionnaireDone: responseSet.has(`${row.cycle_id}|${row.candidate_id}`),
          evaluationDone: evaluationSet.has(row.id),
        } satisfies CandidateView];
      });

      if (!cancelled) {
        setRows(normalized);
        const preferred = normalized.find((x) => x.cycleStatus === "active") || normalized.find((x) => new Date(x.startsAt) >= new Date()) || normalized.at(-1);
        setCycleId(preferred?.cycleId || "");
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const cycles = useMemo(() => {
    const map = new Map<string, { id: string; name: string; status: string }>();
    rows.forEach((row) => map.set(row.cycleId, { id: row.cycleId, name: row.cycleName, status: row.cycleStatus }));
    return [...map.values()].reverse();
  }, [rows]);

  const cycleRows = useMemo(() => rows.filter((row) => !cycleId || row.cycleId === cycleId), [rows, cycleId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cycleRows.filter((row) => !q || [row.fullName, row.phone || "", row.city || ""].some((value) => value.toLowerCase().includes(q)));
  }, [cycleRows, search]);

  const completed = cycleRows.filter((x) => x.status === "completed").length;
  const questionnaires = cycleRows.filter((x) => x.questionnaireDone).length;
  const evaluations = cycleRows.filter((x) => x.evaluationDone).length;
  const selectedCycleName = cycles.find((x) => x.id === cycleId)?.name || "אין מחזור פעיל";

  return (
    <AppShell title="המועמדים שלי" subtitle={selectedCycleName} actions={<Link href="/interviewer" className="btn">לסדר היום</Link>}>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row wrap">
          <div className="field" style={{ margin: 0, minWidth: 290 }}>
            <label>מחזור</label>
            <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)} disabled={loading || !cycles.length}>
              {!cycles.length && <option value="">אין מחזורים זמינים</option>}
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.status === "active" ? " · פעיל" : ""}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 300, flex: 1 }}>
            <label>חיפוש</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="שם / טלפון / עיר..." />
          </div>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="מועמדים ליחידה" value={cycleRows.length} accent />
        <StatCard label="שאלון הושלם" value={`${questionnaires}/${cycleRows.length}`} />
        <StatCard label="ראיונות שבוצעו" value={`${completed}/${cycleRows.length}`} />
        <StatCard label="חוות דעת נשמרו" value={`${evaluations}/${cycleRows.length}`} />
      </div>

      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      <section className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מועמד/ת</th><th>טלפון</th><th>מועד הראיון</th><th>שאלון</th><th>חוות דעת</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}>טוען מועמדים...</td></tr>}
              {!loading && filtered.map((row) => <tr key={row.interviewId}>
                <td><b>{row.fullName}</b><div className="stat-label">{row.city || ""}</div></td>
                <td>{row.phone || "—"}</td>
                <td>{formatDateTime(row.startsAt)}</td>
                <td><span className={`badge ${row.questionnaireDone ? "ok" : "warn"}`}>{row.questionnaireDone ? "הושלם" : "חסר"}</span></td>
                <td><span className={`badge ${row.evaluationDone ? "ok" : "warn"}`}>{row.evaluationDone ? "נשמרה" : "פתוחה"}</span></td>
                <td><StatusBadge status={statusLabel(row.status)} /></td>
                <td><Link className="btn btn-small btn-primary" href={`/interviewer/candidates/${row.candidateId}?interview=${row.interviewId}`}>פתיחת כרטיס</Link></td>
              </tr>)}
              {!loading && !filtered.length && <tr><td colSpan={7}><div className="empty">לא נמצאו מועמדים להצגה.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
