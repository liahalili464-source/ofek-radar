"use client";

import Image from "next/image";
import { FormEvent, use, useEffect, useState } from "react";

type PublicQuestion = {
  id: string;
  field_key: string;
  label: string;
  field_type: "short_text" | "long_text" | "number" | "single_choice" | "multi_choice" | "date" | "yes_no" | "phone" | "email";
  required: boolean;
  options: string[];
  position: number;
};

type PublicForm = {
  questionnaire_id: string;
  title: string;
  version: number;
  candidate_name: string;
  questions: PublicQuestion[];
};

export default function PublicQuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/questionnaire/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError("הקישור לשאלון אינו תקין, פג תוקף או שכבר נעשה בו שימוש.");
        setLoading(false);
        return;
      }
      setForm(json as PublicForm);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError("");
    try {
      const data = new FormData(e.currentTarget);
      const answers: Record<string, string | string[]> = {};
      form.questions.forEach((q) => {
        if (q.field_type === "multi_choice") answers[q.field_key] = data.getAll(q.field_key).map(String);
        else answers[q.field_key] = String(data.get(q.field_key) ?? "");
      });
      const response = await fetch(`/api/questionnaire/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "SUBMIT_FAILED");
      setSubmitted(true);
    } catch {
      setError("לא הצלחנו לשמור את השאלון. נסו שוב או פנו למדור איתור ומיון.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "34px 18px", maxWidth: 820, margin: "0 auto" }}>
      <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={230} height={82} style={{ width: 230, height: "auto", display: "block", margin: "0 auto 24px" }} />
      <section className="card">
        {loading ? <div className="empty">טוען שאלון...</div> : error && !form ? <div className="empty"><h1>לא ניתן לפתוח את השאלון</h1><p>{error}</p></div> : submitted ? (
          <div className="empty">
            <div style={{ fontSize: 44, color: "var(--success)" }}>✓</div>
            <h1>השאלון התקבל</h1>
            <p>תודה. התשובות נשמרו ויצורפו לכרטיס המועמד שלך.</p>
          </div>
        ) : form ? (
          <form onSubmit={submit}>
            <h1 style={{ marginTop: 0 }}>{form.title}</h1>
            <p className="muted">שלום {form.candidate_name}. אין צורך בשם משתמש או סיסמה — הקישור שקיבלת מזהה את השאלון שלך באופן מאובטח.</p>
            <p className="muted">הפרטים יצורפו לכרטיס המועמד ויהיו זמינים רק לצוות המיון וליחידות המורשות בתהליך.</p>
            {error && <div className="notice danger" style={{ marginTop: 16 }}>{error}</div>}
            <div className="grid" style={{ marginTop: 24 }}>
              {[...(form.questions || [])].sort((a, b) => a.position - b.position).map((q) => (
                <div className="field" key={q.id}>
                  <label>{q.label}{q.required ? " *" : ""}</label>
                  {q.field_type === "long_text" ? <textarea name={q.field_key} rows={4} required={q.required} /> :
                    q.field_type === "single_choice" ? <div className="row wrap">{(q.options || []).map((o) => <label className="checkbox-row" key={o}><input type="radio" name={q.field_key} value={o} required={q.required} /> {o}</label>)}</div> :
                      q.field_type === "multi_choice" ? <div className="row wrap">{(q.options || []).map((o) => <label className="checkbox-row" key={o}><input type="checkbox" name={q.field_key} value={o} /> {o}</label>)}</div> :
                        q.field_type === "yes_no" ? <div className="row"><label className="checkbox-row"><input type="radio" name={q.field_key} value="כן" required={q.required} /> כן</label><label className="checkbox-row"><input type="radio" name={q.field_key} value="לא" required={q.required} /> לא</label></div> :
                          <input className="input" name={q.field_key} required={q.required} type={q.field_type === "date" ? "date" : q.field_type === "number" ? "number" : q.field_type === "email" ? "email" : q.field_type === "phone" ? "tel" : "text"} />}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" disabled={submitting} style={{ width: "100%", marginTop: 10 }}>{submitting ? "שולח..." : "שליחת השאלון"}</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
