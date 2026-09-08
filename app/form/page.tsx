"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

type PublicQuestion = {
  id: string;
  field_key: string;
  label: string;
  field_type: "short_text" | "long_text" | "number" | "single_choice" | "multi_choice" | "date" | "yes_no" | "phone" | "email";
  required: boolean;
  options: string[];
  position: number;
  maps_to_candidate_field: string | null;
};

type PublicForm = {
  title: string;
  cycleName: string;
  candidateName: string;
  questions: PublicQuestion[];
  prefill: Record<string, unknown>;
  previouslySubmitted: boolean;
};

function errorText(code?: string) {
  if (code === "NO_ACTIVE_CYCLE" || code === "QUESTIONNAIRE_NOT_FOUND") return "השאלון אינו פתוח כרגע.";
  if (code === "CANDIDATE_NOT_FOUND" || code === "CANDIDATE_NOT_IN_ACTIVE_CYCLE") return "לא נמצאה התאמה למחזור הפעיל. בדקו את מספר הטלפון.";
  if (code === "AMBIGUOUS_PHONE") return "מספר הטלפון מופיע יותר מפעם אחת במחזור. פנו למדור איתור ומיון.";
  if (code === "INVALID_PHONE") return "יש להזין מספר טלפון תקין.";
  return "לא הצלחנו לפתוח את השאלון. נסו שוב בעוד רגע.";
}

function valueAsString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function PermanentQuestionnairePage() {
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function identify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSubmitted(false);
    try {
      const response = await fetch("/api/questionnaire/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load", phone }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "LOAD_FAILED");
      setForm(json as PublicForm);
    } catch (e) {
      setForm(null);
      setError(errorText(e instanceof Error ? e.message : undefined));
    } finally {
      setLoading(false);
    }
  }

  async function submitQuestionnaire(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError("");
    try {
      const data = new FormData(e.currentTarget);
      const answers: Record<string, string | string[]> = {};
      for (const question of form.questions) {
        if (question.field_type === "multi_choice") answers[question.field_key] = data.getAll(question.field_key).map(String);
        else answers[question.field_key] = String(data.get(question.field_key) ?? "");
      }

      const response = await fetch("/api/questionnaire/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", phone, answers }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "SUBMIT_FAILED");
      setSubmitted(true);
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : undefined));
    } finally {
      setSubmitting(false);
    }
  }

  function changeCandidate() {
    setForm(null);
    setSubmitted(false);
    setError("");
    setPhone("");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "34px 18px", maxWidth: 820, margin: "0 auto" }}>
      <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={230} height={82} priority style={{ width: 230, height: "auto", display: "block", margin: "0 auto 24px" }} />

      {!form ? (
        <section className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ marginTop: 0 }}>שאלון מועמד</h1>
          <form onSubmit={identify} style={{ marginTop: 22 }}>
            <div className="field">
              <label>מספר טלפון</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="0501234567"
                required
                autoFocus
              />
            </div>
            {error && <div className="notice danger" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "בודק..." : "המשך"}</button>
          </form>
        </section>
      ) : submitted ? (
        <section className="card">
          <div className="empty">
            <div style={{ fontSize: 44, color: "var(--success)" }}>✓</div>
            <h1>השאלון התקבל</h1>
            <p>תודה, הפרטים נשמרו.</p>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="row between wrap" style={{ marginBottom: 22 }}>
            <div>
              <h1 style={{ margin: 0 }}>{form.title}</h1>
              <div className="muted" style={{ marginTop: 5 }}>{form.cycleName}</div>
            </div>
            <button className="btn btn-small" type="button" onClick={changeCandidate}>חזרה</button>
          </div>

          <h2 style={{ fontSize: 20, margin: "0 0 20px" }}>שלום {form.candidateName}</h2>
          {form.previouslySubmitted && <div className="notice" style={{ marginBottom: 18 }}>השאלון כבר מולא בעבר. אפשר לעדכן את התשובות ולשלוח שוב.</div>}
          {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}

          <form onSubmit={submitQuestionnaire}>
            <div className="grid">
              {[...form.questions].sort((a, b) => a.position - b.position).map((question) => {
                const initial = form.prefill?.[question.field_key];
                const selectedValues = Array.isArray(initial) ? initial.map(String) : [];
                const isPhone = question.maps_to_candidate_field === "phone";

                return (
                  <div className="field" key={question.id}>
                    <label>{question.label}{question.required ? " *" : ""}</label>
                    {question.field_type === "long_text" ? (
                      <textarea name={question.field_key} rows={4} required={question.required} defaultValue={valueAsString(initial)} />
                    ) : question.field_type === "single_choice" ? (
                      <div className="row wrap">
                        {(question.options || []).map((option) => <label className="checkbox-row" key={option}><input type="radio" name={question.field_key} value={option} defaultChecked={valueAsString(initial) === option} required={question.required} /> {option}</label>)}
                      </div>
                    ) : question.field_type === "multi_choice" ? (
                      <div className="row wrap">
                        {(question.options || []).map((option) => <label className="checkbox-row" key={option}><input type="checkbox" name={question.field_key} value={option} defaultChecked={selectedValues.includes(option)} /> {option}</label>)}
                      </div>
                    ) : question.field_type === "yes_no" ? (
                      <div className="row">
                        <label className="checkbox-row"><input type="radio" name={question.field_key} value="כן" defaultChecked={valueAsString(initial) === "כן"} required={question.required} /> כן</label>
                        <label className="checkbox-row"><input type="radio" name={question.field_key} value="לא" defaultChecked={valueAsString(initial) === "לא"} required={question.required} /> לא</label>
                      </div>
                    ) : (
                      <input
                        className="input"
                        name={question.field_key}
                        required={question.required}
                        readOnly={isPhone}
                        defaultValue={valueAsString(initial)}
                        type={question.field_type === "date" ? "date" : question.field_type === "number" ? "number" : question.field_type === "email" ? "email" : question.field_type === "phone" ? "tel" : "text"}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" disabled={submitting} style={{ width: "100%", marginTop: 10 }}>{submitting ? "שולח..." : "שליחת השאלון"}</button>
          </form>
        </section>
      )}
    </main>
  );
}
