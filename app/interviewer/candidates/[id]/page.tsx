"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
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
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
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
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
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
      const params = new URLSearchParams(window.location.search);
      const requestedInterviewId = params.get("interview");
      if (params.get("tab") === "evaluation") setActiveTab("evaluation");

      const { data: candidateData, error: candidateError } = await supabase.from("candidates").select("id,national_id,full_name,phone,city,photo_url").eq("id", id).single();
      if (candidateError || !candidateData) {
        if (!cancelled) { setError(candidateError?.message || "אין הרשאה לצפות במועמד/ת"); setLoading(false); }
        return;
      }

      let interviewQuery = supabase.from("interviews").select("id,cycle_id,starts_at,ends_at,status,location,cycles(name)").eq("candidate_id", id).order("starts_at", { ascending: false }).limit(1);
      if (requestedInterviewId) interviewQuery = supabase.from("interviews").select("id,cycle_id,starts_at,ends_at,status,location,cycles(name)").eq("id", requestedInterviewId).limit(1);
      const { data: interviewRows, error: interviewError } = await interviewQuery;
      if (interviewError || !interviewRows?.length) {
        if (!cancelled) { setError(interviewError?.message || "לא נמצא ראיון של היחידה עבור המועמד/ת"); setLoading(false); }
        return;
      }
      const currentInterview = (interviewRows[0] as unknown) as Interview;

      const [responseRes, evaluationRes] = await Promise.all([
        supabase.from("questionnaire_responses").select("answers").eq("candidate_id", id).eq("cycle_id", currentInterview.cycle_id).maybeSingle(),
        supabase.from("evaluations").select("professional_score,personal_score,recommendation,notes").eq("interview_id", currentInterview.id).maybeSingle(),
      ]);

      if (!cancelled) {
        setCandidate(candidateData as Candidate);
        setInterview(currentInterview);
        setAnswers((responseRes.data?.answers as Record<string, unknown> | undefined) || null);
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

  async function markStarted() {
    if (!interview) return;
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.from("interviews").update({ status: "scheduled" }).eq("id", interview.id);
    if (updateError) setError(updateError.message);
  }

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
              <h2 style={{ margin: 0 }}>{candidate.full_name}</h2>
              <div className="stat-label">ת.ז {candidate.national_id}{candidate.phone ? ` · ${candidate.phone}` : ""}{candidate.city ? ` · ${candidate.city}` : ""}</div>
            </div>
            <div className="row wrap"><StatusBadge status={interview.status === "completed" ? "בוצע" : "מתוכנן"} /><span className="badge">{formatDateTime(interview.starts_at)}</span></div>
          </div>
        </section>

        <div className="tabs">
          <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>פרטים ושאלון</button>
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
            <div className="notice" style={{ marginTop: 8 }}><div className="stat-label">מועד הראיון</div><b>{formatDateTime(interview.starts_at)}</b>{interview.location && <div className="stat-label" style={{ marginTop: 4 }}>{interview.location}</div>}</div>
            {interview.status !== "completed" && <button className="btn btn-primary" onClick={() => { markStarted(); setActiveTab("evaluation"); }} style={{ width: "100%", marginTop: 14 }}>התחלת ראיון</button>}
          </section>

          <section className="card">
            <h2 className="section-title">תשובות לשאלון</h2>
            {!answers ? <div className="notice warning">השאלון טרם הושלם.</div> : <div className="grid">
              {Object.entries(answers).map(([key, value]) => <div className="preview-field" key={key}><div className="stat-label">{key}</div><b>{Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</b></div>)}
            </div>}
          </section>
        </div>}

        {activeTab === "evaluation" && <section className="card" style={{ maxWidth: 900 }}>
          <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>חוות דעת לראיון</h2><div className="stat-label">החוות דעת נשמרת עבור חשבון היחידה בלבד.</div></div>{saved && <span className="badge ok">✓ נשמר</span>}</div>
          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="field"><label>ציון מקצועי</label><select className="select" value={professionalScore} onChange={(e) => setProfessionalScore(Number(e.target.value))}>{[1,2,3,4,5].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="field"><label>ציון אישי</label><select className="select" value={personalScore} onChange={(e) => setPersonalScore(Number(e.target.value))}>{[1,2,3,4,5].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
          </div>
          <div className="field"><label>המלצה</label><select className="select" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>{Object.entries(recommendationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label>הערות</label><textarea rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="התרשמות, חוזקות, הסתייגויות ונקודות להמשך..." /></div>
          <button className="btn btn-primary" disabled={saving} onClick={saveEvaluation}>{saving ? "שומר..." : "שמירת חוות דעת וסיום ראיון"}</button>
        </section>}
      </>}
    </AppShell>
  );
}
