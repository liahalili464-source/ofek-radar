"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Candidate = {
  id: string;
  national_id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  photo_url: string | null;
  source_data: Record<string, unknown> | null;
};

type Interview = {
  id: string;
  cycle_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  location: string | null;
  cycles: { name: string } | { name: string }[] | null;
};

type Evaluation = {
  professional_score: number | null;
  personal_score: number | null;
  recommendation: string | null;
  notes: string | null;
  updated_at?: string | null;
};

type QuestionnaireResponse = {
  questionnaire_id: string;
  version: number;
  answers: Record<string, unknown>;
  submitted_at: string;
};

type Question = {
  field_key: string;
  label: string;
  position: number;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((x) => String(x)).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  return String(value);
}

function interviewStatusLabel(status: string) {
  if (status === "completed") return "בוצע";
  if (status === "scheduled") return "מתוכנן";
  if (status === "cancelled") return "בוטל";
  if (status === "no_show") return "לא הגיע/ה";
  return status;
}

const recommendationLabels: Record<string, string> = {
  strong_yes: "מומלץ מאוד",
  yes: "מומלץ",
  maybe: "מתלבט/ת",
  no: "לא מומלץ",
};

export default function InterviewerCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [response, setResponse] = useState<QuestionnaireResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [professionalScore, setProfessionalScore] = useState(4);
  const [personalScore, setPersonalScore] = useState(4);
  const [recommendation, setRecommendation] = useState("yes");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const supabase = createSupabaseBrowserClient();
      const queryParams = new URLSearchParams(window.location.search);
      const requestedInterviewId = queryParams.get("interview");
      if (queryParams.get("tab") === "evaluation") setActiveTab("evaluation");

      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("id,national_id,full_name,phone,city,photo_url,source_data")
        .eq("id", id)
        .single();
      if (candidateError || !candidateData) {
        if (!cancelled) { setError(candidateError?.message || "אין הרשאה לצפות במועמד/ת"); setLoading(false); }
        return;
      }

      let interviewQuery = supabase
        .from("interviews")
        .select("id,cycle_id,starts_at,ends_at,status,location,cycles(name)")
        .eq("candidate_id", id)
        .order("starts_at", { ascending: false })
        .limit(1);
      if (requestedInterviewId) {
        interviewQuery = supabase
          .from("interviews")
          .select("id,cycle_id,starts_at,ends_at,status,location,cycles(name)")
          .eq("id", requestedInterviewId)
          .limit(1);
      }

      const { data: interviewRows, error: interviewError } = await interviewQuery;
      if (interviewError || !interviewRows?.length) {
        if (!cancelled) { setError(interviewError?.message || "לא נמצא ראיון של היחידה עבור המועמד/ת"); setLoading(false); }
        return;
      }
      const currentInterview = interviewRows[0] as unknown as Interview;

      const [responseRes, evaluationRes] = await Promise.all([
        supabase
          .from("questionnaire_responses")
          .select("questionnaire_id,version,answers,submitted_at")
          .eq("candidate_id", id)
          .eq("cycle_id", currentInterview.cycle_id)
          .maybeSingle(),
        supabase
          .from("evaluations")
          .select("professional_score,personal_score,recommendation,notes,updated_at")
          .eq("interview_id", currentInterview.id)
          .maybeSingle(),
      ]);

      const questionnaireResponse = responseRes.data as QuestionnaireResponse | null;
      let questionRows: Question[] = [];
      if (questionnaireResponse) {
        const { data: questionData } = await supabase
          .from("questionnaire_questions")
          .select("field_key,label,position")
          .eq("questionnaire_id", questionnaireResponse.questionnaire_id)
          .eq("version", questionnaireResponse.version)
          .order("position", { ascending: true });
        questionRows = (questionData || []) as Question[];
      }

      if (!cancelled) {
        setCandidate(candidateData as Candidate);
        setInterview(currentInterview);
        setResponse(questionnaireResponse);
        setQuestions(questionRows);
        const evaluation = evaluationRes.data as Evaluation | null;
        if (evaluation) {
          setProfessionalScore(evaluation.professional_score || 4);
          setPersonalScore(evaluation.personal_score || 4);
          setRecommendation(evaluation.recommendation || "yes");
          setNotes(evaluation.notes || "");
          setSaved(true);
        }
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const sourceEntries = useMemo(() => {
    if (!candidate?.source_data) return [];
    return Object.entries(candidate.source_data).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");
  }, [candidate]);

  const questionnaireEntries = useMemo(() => {
    if (!response?.answers) return [];
    const labels = new Map(questions.map((q) => [q.field_key, q.label]));
    const order = new Map(questions.map((q, index) => [q.field_key, index]));
    return Object.entries(response.answers)
      .map(([key, value]) => ({ key, label: labels.get(key) || key, value, order: order.get(key) ?? 9999 }))
      .sort((a, b) => a.order - b.order);
  }, [questions, response]);

  async function saveEvaluation() {
    if (!interview) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("אין משתמש מחובר");
      const { error: evaluationError } = await supabase.from("evaluations").upsert({
        interview_id: interview.id,
        interviewer_id: user.id,
        professional_score: professionalScore,
        personal_score: personalScore,
        recommendation,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "interview_id" });
      if (evaluationError) throw evaluationError;

      const { error: interviewError } = await supabase.from("interviews").update({ status: "completed" }).eq("id", interview.id);
      if (interviewError) throw interviewError;
      setInterview({ ...interview, status: "completed" });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת חוות הדעת נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell title="כרטיס מועמד"><div className="notice">טוען כרטיס מועמד...</div></AppShell>;

  return (
    <AppShell title="כרטיס מועמד" subtitle={one(interview?.cycles || null)?.name || "מחזור"} actions={<Link href="/interviewer" className="btn">חזרה לראיונות שלי</Link>}>
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {!candidate || !interview ? <div className="empty">לא ניתן להציג את הכרטיס.</div> : <>
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="row between wrap">
            <div>
              <div className="stat-label" style={{ marginBottom: 4 }}>מועמד/ת</div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{candidate.full_name}</h2>
              <div className="stat-label" style={{ marginTop: 6 }}>ת.ז {candidate.national_id}{candidate.phone ? ` · ${candidate.phone}` : ""}{candidate.city ? ` · ${candidate.city}` : ""}</div>
            </div>
            <div className="row wrap">
              <StatusBadge status={interviewStatusLabel(interview.status)} />
              <span className={`badge ${response ? "ok" : "warn"}`}>{response ? "שאלון הושלם" : "שאלון חסר"}</span>
              <span className="badge">{formatDateTime(interview.starts_at)}</span>
            </div>
          </div>
        </section>

        <div className="tabs">
          <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>כרטיס מועמד</button>
          <button className={`tab ${activeTab === "questionnaire" ? "active" : ""}`} onClick={() => setActiveTab("questionnaire")}>שאלון</button>
          <button className={`tab ${activeTab === "evaluation" ? "active" : ""}`} onClick={() => setActiveTab("evaluation")}>חוות דעת</button>
        </div>

        {activeTab === "overview" && <div className="grid grid-2">
          <section className="card">
            <h2 className="section-title">פרטים בסיסיים</h2>
            <div className="grid grid-2">
              <div className="field"><label>שם מלא</label><div className="preview-field">{candidate.full_name}</div></div>
              <div className="field"><label>תעודת זהות</label><div className="preview-field">{candidate.national_id}</div></div>
              <div className="field"><label>טלפון</label><div className="preview-field">{candidate.phone || "—"}</div></div>
              <div className="field"><label>עיר</label><div className="preview-field">{candidate.city || "—"}</div></div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">הראיון של היחידה</h2>
            <div className="grid grid-2">
              <div className="notice"><div className="stat-label">מועד</div><b>{formatDateTime(interview.starts_at)}</b></div>
              <div className="notice"><div className="stat-label">מיקום</div><b>{interview.location || "לא הוגדר"}</b></div>
              <div className="notice"><div className="stat-label">סטטוס</div><b>{interviewStatusLabel(interview.status)}</b></div>
              <div className="notice"><div className="stat-label">חוות דעת</div><b>{saved ? "נשמרה" : "טרם נשמרה"}</b></div>
            </div>
            <button className="btn btn-primary" onClick={() => setActiveTab("evaluation")} style={{ width: "100%", marginTop: 14 }}>{saved ? "פתיחת חוות הדעת" : "מעבר למילוי חוות דעת"}</button>
          </section>

          <section className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="row between wrap"><h2 className="section-title" style={{ marginBottom: 0 }}>מידע שהתקבל בקובץ המועמדים</h2><span className="badge">{sourceEntries.length} שדות</span></div>
            {sourceEntries.length === 0 ? <div className="empty">אין מידע נוסף מקובץ המקור.</div> : <div className="grid grid-3" style={{ marginTop: 16 }}>
              {sourceEntries.map(([key, value]) => <div className="preview-field" key={key}><div className="stat-label">{key}</div><b>{displayValue(value)}</b></div>)}
            </div>}
          </section>
        </div>}

        {activeTab === "questionnaire" && <section className="card" style={{ maxWidth: 1100 }}>
          <div className="row between wrap">
            <div><h2 className="section-title" style={{ marginBottom: 4 }}>תשובות לשאלון</h2>{response && <div className="stat-label">נשלח ב-{formatDateTime(response.submitted_at)}</div>}</div>
            <span className={`badge ${response ? "ok" : "warn"}`}>{response ? "הושלם" : "טרם הושלם"}</span>
          </div>
          {!response ? <div className="notice warning" style={{ marginTop: 16 }}>המועמד/ת עדיין לא מילא/ה את השאלון.</div> : <div className="grid grid-2" style={{ marginTop: 18 }}>
            {questionnaireEntries.map((item) => <div className="preview-field" key={item.key}><div className="stat-label">{item.label}</div><b>{displayValue(item.value)}</b></div>)}
          </div>}
        </section>}

        {activeTab === "evaluation" && <section className="card" style={{ maxWidth: 900 }}>
          <div className="row between wrap">
            <div><h2 className="section-title" style={{ marginBottom: 4 }}>חוות דעת לראיון</h2><div className="stat-label">החוות דעת נשמרת תחת חשבון היחידה ובקשר לראיון הזה.</div></div>
            {saved && <span className="badge ok">✓ נשמר</span>}
          </div>
          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="field"><label>ציון מקצועי</label><select className="select" value={professionalScore} onChange={(e) => setProfessionalScore(Number(e.target.value))}>{[1,2,3,4,5].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="field"><label>ציון אישי</label><select className="select" value={personalScore} onChange={(e) => setPersonalScore(Number(e.target.value))}>{[1,2,3,4,5].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          </div>
          <div className="field"><label>המלצה</label><select className="select" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>{Object.entries(recommendationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label>הערות והתרשמות</label><textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="חוזקות, הסתייגויות, התרשמות מקצועית ואישית ונקודות להמשך..." /></div>
          <div className="row wrap">
            <button className="btn btn-primary" disabled={saving} onClick={saveEvaluation}>{saving ? "שומר..." : saved ? "עדכון חוות דעת" : "שמירת חוות דעת וסיום ראיון"}</button>
            <button className="btn" onClick={() => setActiveTab("overview")}>חזרה לכרטיס</button>
          </div>
        </section>}
      </>}
    </AppShell>
  );
}
