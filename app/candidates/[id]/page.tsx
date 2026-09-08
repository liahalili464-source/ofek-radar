"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Candidate = {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  source_data: Record<string, unknown> | null;
  created_at: string;
};

type CycleRel = { id: string; name: string; status: string; starts_on: string | null } | { id: string; name: string; status: string; starts_on: string | null }[] | null;
type Membership = { cycle_id: string; status: string; cycles: CycleRel };
type UnitRel = { name: string } | { name: string }[] | null;
type Interview = { id: string; starts_at: string; ends_at: string; status: string; location: string | null; unit_id: string; units: UnitRel };
type Evaluation = { interview_id: string; professional_score: number | null; personal_score: number | null; recommendation: string | null; notes: string | null; submitted_at: string; };
type QuestionnaireResponse = { questionnaire_id: string; version: number; answers: Record<string, unknown>; submitted_at: string };
type Question = { field_key: string; label: string; position: number };

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  return String(value);
}

function interviewStatus(status: string) {
  if (status === "scheduled") return "מתוכנן";
  if (status === "completed") return "בוצע";
  if (status === "cancelled") return "בוטל";
  if (status === "no_show") return "לא הגיע/ה";
  return status;
}

function cycleStatus(status: string) {
  if (status === "active") return "פעיל";
  if (status === "draft") return "בתכנון";
  if (status === "completed") return "סגור";
  if (status === "archived") return "ארכיון";
  return status;
}

const recommendationLabels: Record<string, string> = {
  strong_yes: "מומלץ מאוד",
  yes: "מומלץ",
  maybe: "מתלבט/ת",
  no: "לא מומלץ",
};

export default function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState("overview");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [response, setResponse] = useState<QuestionnaireResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const [candidateRes, membershipsRes] = await Promise.all([
        supabase.from("candidates").select("id,full_name,phone,city,source_data,created_at").eq("id", id).single(),
        supabase.from("cycle_candidates").select("cycle_id,status,cycles(id,name,status,starts_on)").eq("candidate_id", id),
      ]);
      const firstError = candidateRes.error || membershipsRes.error;
      if (firstError || !candidateRes.data) {
        if (!cancelled) { setError(firstError?.message || "המועמד/ת לא נמצאו"); setLoading(false); }
        return;
      }
      const membershipRows = (membershipsRes.data || []) as unknown as Membership[];
      const requested = new URLSearchParams(window.location.search).get("cycle");
      const preferred = membershipRows.find((m) => m.cycle_id === requested)
        || membershipRows.find((m) => one(m.cycles)?.status === "active")
        || [...membershipRows].sort((a, b) => String(one(b.cycles)?.starts_on || "").localeCompare(String(one(a.cycles)?.starts_on || "")))[0];
      if (!cancelled) {
        setCandidate(candidateRes.data as Candidate);
        setMemberships(membershipRows);
        setCycleId(preferred?.cycle_id || "");
        if (!preferred) setLoading(false);
      }
    }
    loadBase();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    async function loadCycleData() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const [interviewsRes, responseRes] = await Promise.all([
        supabase.from("interviews").select("id,starts_at,ends_at,status,location,unit_id,units(name)").eq("candidate_id", id).eq("cycle_id", cycleId).order("starts_at"),
        supabase.from("questionnaire_responses").select("questionnaire_id,version,answers,submitted_at").eq("candidate_id", id).eq("cycle_id", cycleId).maybeSingle(),
      ]);
      const firstError = interviewsRes.error || responseRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setLoading(false); }
        return;
      }

      const interviewRows = (interviewsRes.data || []) as unknown as Interview[];
      const interviewIds = interviewRows.map((x) => x.id);
      const evaluationRes = interviewIds.length
        ? await supabase.from("evaluations").select("interview_id,professional_score,personal_score,recommendation,notes,submitted_at").in("interview_id", interviewIds)
        : { data: [], error: null };
      if (evaluationRes.error) {
        if (!cancelled) { setError(evaluationRes.error.message); setLoading(false); }
        return;
      }

      const questionnaireResponse = responseRes.data as QuestionnaireResponse | null;
      let questionRows: Question[] = [];
      if (questionnaireResponse) {
        const { data } = await supabase.from("questionnaire_questions")
          .select("field_key,label,position")
          .eq("questionnaire_id", questionnaireResponse.questionnaire_id)
          .eq("version", questionnaireResponse.version)
          .order("position");
        questionRows = (data || []) as Question[];
      }

      if (!cancelled) {
        setInterviews(interviewRows);
        setEvaluations((evaluationRes.data || []) as Evaluation[]);
        setResponse(questionnaireResponse);
        setQuestions(questionRows);
        setLoading(false);
      }
    }
    loadCycleData();
    return () => { cancelled = true; };
  }, [cycleId, id]);

  const selectedMembership = memberships.find((m) => m.cycle_id === cycleId);
  const selectedCycle = one(selectedMembership?.cycles || null);
  const evaluationByInterview = useMemo(() => new Map(evaluations.map((e) => [e.interview_id, e])), [evaluations]);
  const sourceEntries = useMemo(() => Object.entries(candidate?.source_data || {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ""), [candidate]);
  const questionnaireEntries = useMemo(() => {
    if (!response) return [];
    const labels = new Map(questions.map((q) => [q.field_key, q.label]));
    const order = new Map(questions.map((q, i) => [q.field_key, i]));
    return Object.entries(response.answers || {}).map(([key, value]) => ({ key, label: labels.get(key) || key, value, order: order.get(key) ?? 9999 })).sort((a, b) => a.order - b.order);
  }, [questions, response]);

  if (loading && !candidate) return <AppShell title="כרטיס מועמד"><div className="notice">טוען כרטיס מועמד...</div></AppShell>;

  return (
    <AppShell title="כרטיס מועמד" subtitle={selectedCycle?.name || "היסטוריית מועמד"} actions={<Link href="/candidates" className="btn">חזרה לרשימה</Link>}>
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {!candidate ? <div className="empty">לא ניתן להציג את הכרטיס.</div> : <>
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="row between wrap">
            <div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{candidate.full_name}</h2>
              <div className="stat-label" style={{ marginTop: 6 }}>{candidate.phone || "ללא טלפון"}{candidate.city ? ` · ${candidate.city}` : ""}</div>
            </div>
            <div className="row wrap">
              {selectedCycle && <span className={`badge ${selectedCycle.status === "active" ? "ok" : ""}`}>{cycleStatus(selectedCycle.status)}</span>}
              {selectedMembership && <StatusBadge status={selectedMembership.status} />}
            </div>
          </div>
        </section>

        {memberships.length > 0 && <section className="card" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 420 }}><label>מחזור</label><select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>{memberships.map((m) => { const c = one(m.cycles); return <option key={m.cycle_id} value={m.cycle_id}>{c?.name || "מחזור"} · {cycleStatus(c?.status || "")}</option>; })}</select></div>
        </section>}

        <div className="tabs">
          {[['overview','פרטים'],['questionnaire','שאלון'],['interviews','ראיונות'],['evaluations','חוות דעת'],['timeline','ציר זמן']].map(([key,label]) => <button key={key} className={`tab ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>{label}</button>)}
        </div>

        {loading ? <div className="notice">טוען את נתוני המחזור...</div> : <>
          {activeTab === "overview" && <div className="grid grid-2">
            <section className="card">
              <h2 className="section-title">פרטים בסיסיים</h2>
              <div className="grid grid-2">
                <div className="field"><label>שם מלא</label><div className="preview-field">{candidate.full_name}</div></div>
                <div className="field"><label>טלפון</label><div className="preview-field">{candidate.phone || "—"}</div></div>
                <div className="field"><label>עיר</label><div className="preview-field">{candidate.city || "—"}</div></div>
              </div>
            </section>
            <section className="card">
              <h2 className="section-title">שאלון</h2>
              {response
                ? <div className="notice success"><b>הושלם</b><div className="stat-label" style={{ marginTop: 4 }}>{formatDateTime(response.submitted_at)}</div></div>
                : <div className="notice warning"><b>ממתין למילוי</b></div>}
            </section>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="row between wrap"><h2 className="section-title" style={{ marginBottom: 0 }}>מידע מקובץ המועמדים</h2><span className="badge">{sourceEntries.length} שדות</span></div>
              {sourceEntries.length === 0 ? <div className="empty">אין מידע נוסף מקובץ המקור.</div> : <div className="grid grid-3" style={{ marginTop: 16 }}>{sourceEntries.map(([key, value]) => <div className="preview-field" key={key}><div className="stat-label">{key}</div><b>{displayValue(value)}</b></div>)}</div>}
            </section>
          </div>}

          {activeTab === "questionnaire" && <section className="card">
            <div className="row between wrap"><div><h2 className="section-title" style={{ marginBottom: 4 }}>תשובות לשאלון</h2>{response && <div className="stat-label">הושלם ב-{formatDateTime(response.submitted_at)}</div>}</div><span className={`badge ${response ? "ok" : "warn"}`}>{response ? "הושלם" : "ממתין"}</span></div>
            {!response ? <div className="notice warning" style={{ marginTop: 16 }}>השאלון עדיין לא הושלם.</div> : <div className="grid grid-2" style={{ marginTop: 18 }}>{questionnaireEntries.map((x) => <div className="preview-field" key={x.key}><div className="stat-label">{x.label}</div><b>{displayValue(x.value)}</b></div>)}</div>}
          </section>}

          {activeTab === "interviews" && <section className="card flush">
            <div style={{ padding: 20, paddingBottom: 8 }}><h2 className="section-title">ראיונות במחזור</h2></div>
            <div className="table-wrap"><table className="table"><thead><tr><th>יחידה</th><th>תאריך ושעה</th><th>מיקום</th><th>סטטוס</th><th>חוות דעת</th></tr></thead><tbody>
              {interviews.map((x) => <tr key={x.id}><td><b>{one(x.units)?.name || "יחידה"}</b></td><td>{formatDateTime(x.starts_at)}</td><td>{x.location || "—"}</td><td><StatusBadge status={interviewStatus(x.status)} /></td><td>{evaluationByInterview.has(x.id) ? <span className="badge ok">התקבלה</span> : <span className="badge warn">ממתינה</span>}</td></tr>)}
              {interviews.length === 0 && <tr><td colSpan={5}><div className="empty">עדיין לא נוצרו ראיונות במחזור הזה.</div></td></tr>}
            </tbody></table></div>
          </section>}

          {activeTab === "evaluations" && <div className="grid grid-2">
            {interviews.map((x) => { const evaluation = evaluationByInterview.get(x.id); return <section className="card" key={x.id}><div className="row between"><h2 className="section-title" style={{ marginBottom: 0 }}>{one(x.units)?.name || "יחידה"}</h2><span className={`badge ${evaluation ? "ok" : "warn"}`}>{evaluation ? "התקבלה" : "ממתינה"}</span></div>{evaluation ? <div className="grid" style={{ marginTop: 16 }}><div className="grid grid-2"><div className="notice"><div className="stat-label">מקצועי</div><b>{evaluation.professional_score ?? "—"}/5</b></div><div className="notice"><div className="stat-label">אישי</div><b>{evaluation.personal_score ?? "—"}/5</b></div></div><div className="notice"><div className="stat-label">המלצה</div><b>{recommendationLabels[evaluation.recommendation || ""] || "—"}</b></div><div className="preview-field"><div className="stat-label">הערות</div><div>{evaluation.notes || "—"}</div></div></div> : <div className="empty">חוות הדעת עדיין לא נשמרה.</div>}</section>; })}
            {interviews.length === 0 && <div className="empty">אין ראיונות במחזור הזה.</div>}
          </div>}

          {activeTab === "timeline" && <section className="card">
            <h2 className="section-title">ציר זמן במחזור</h2>
            <div className="timeline">
              {response && <div className="timeline-item"><div className="timeline-dot"/><div><b>שאלון הושלם</b><div className="stat-label">{formatDateTime(response.submitted_at)}</div></div></div>}
              {interviews.map((x) => <div className="timeline-item" key={x.id}><div className="timeline-dot"/><div><b>ראיון — {one(x.units)?.name || "יחידה"}</b><div className="stat-label">{formatDateTime(x.starts_at)} · {interviewStatus(x.status)}</div></div></div>)}
              {!response && interviews.length === 0 && <div className="empty">עדיין אין אירועים להצגה במחזור הזה.</div>}
            </div>
          </section>}
        </>}
      </>}
    </AppShell>
  );
}
