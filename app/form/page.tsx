"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  BASE_PRIORITY_FIELD_KEYS,
  FILE_UPLOAD_FIELD_KEYS,
  OS_FIELD_KEYS,
  PROGRAMMING_FIELD_KEYS,
} from "@/lib/questionnaire-template";

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
  if (code === "FILE_TOO_LARGE") return "הקובץ גדול מהמותר. בדקו את מגבלת הגודל שמופיעה ליד השדה.";
  if (code === "UPLOAD_FAILED") return "העלאת הקובץ נכשלה. נסו שוב.";
  if (code === "DUPLICATE_BASE_PREFERENCE") return "יש לבחור בסיס שונה בכל אחת משלוש העדיפויות.";
  return "לא הצלחנו להשלים את הפעולה. נסו שוב בעוד רגע.";
}

function valueAsString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function fileHint(fieldKey: string, candidateName: string) {
  if (fieldKey === "photo_upload") return `יש לצרף תמונה. מומלץ לקרוא לקובץ: ${candidateName} - תמונה`;
  if (fieldKey === "grades_upload") return `יש לצרף גיליון ציונים, עד 100MB. מומלץ לקרוא לקובץ: ${candidateName} - גיליון ציונים`;
  if (fieldKey === "cv_upload") return `יש לצרף קורות חיים, עד 100MB. מומלץ לקרוא לקובץ: ${candidateName} - קורות חיים`;
  if (fieldKey === "personal_questionnaire_upload") return `יש לצרף שאלון אישי לעתודאים, עד 10MB. מומלץ לקרוא לקובץ: ${candidateName} - שאלון אישי לעתודאים`;
  return "";
}

function isStoredFile(value: unknown) {
  return typeof value === "string" && value.startsWith("storage:");
}

export default function PermanentQuestionnairePage() {
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const sortedQuestions = useMemo(() => form ? [...form.questions].sort((a, b) => a.position - b.position) : [], [form]);

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

  async function uploadFile(fieldKey: string, file: File) {
    const body = new FormData();
    body.append("phone", phone);
    body.append("fieldKey", fieldKey);
    body.append("file", file);
    const response = await fetch("/api/questionnaire/public/file", { method: "POST", body });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "UPLOAD_FAILED");
    return String(json.value || "");
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
        if (FILE_UPLOAD_FIELD_KEYS.has(question.field_key)) {
          const uploaded = data.get(question.field_key);
          const file = uploaded instanceof File && uploaded.size > 0 ? uploaded : null;
          const existing = form.prefill?.[question.field_key];
          if (file) answers[question.field_key] = await uploadFile(question.field_key, file);
          else if (typeof existing === "string" && existing) answers[question.field_key] = existing;
          else if (question.required) throw new Error("FILE_REQUIRED");
          else answers[question.field_key] = "";
          continue;
        }

        if (question.field_type === "multi_choice") answers[question.field_key] = data.getAll(question.field_key).map(String);
        else answers[question.field_key] = String(data.get(question.field_key) ?? "");
      }

      const baseValues = BASE_PRIORITY_FIELD_KEYS.map((key) => String(answers[key] || "")).filter(Boolean);
      if (baseValues.length === BASE_PRIORITY_FIELD_KEYS.length && new Set(baseValues).size !== baseValues.length) throw new Error("DUPLICATE_BASE_PREFERENCE");

      const response = await fetch("/api/questionnaire/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", phone, answers }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "SUBMIT_FAILED");
      setSubmitted(true);
    } catch (e) {
      const code = e instanceof Error ? e.message : undefined;
      setError(code === "FILE_REQUIRED" ? "יש לצרף את כל קבצי החובה לפני השליחה." : errorText(code));
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

  function renderMatrix(title: string, questionKeys: string[]): ReactNode {
    if (!form) return null;
    const rows = questionKeys.map((key) => form.questions.find((q) => q.field_key === key)).filter(Boolean) as PublicQuestion[];
    if (!rows.length) return null;
    const options = rows[0].options || [];
    return (
      <section className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ marginTop: 0 }}>{title}{rows.some((q) => q.required) ? " *" : ""}</h3>
        <div className="table-wrap">
          <table className="table" style={{ minWidth: Math.max(640, 160 + options.length * 135) }}>
            <thead><tr><th></th>{options.map((option) => <th key={option}>{option}</th>)}</tr></thead>
            <tbody>{rows.map((question) => {
              const initial = valueAsString(form.prefill?.[question.field_key]);
              return <tr key={question.id}><td><b>{question.label}</b></td>{options.map((option) => <td key={option} style={{ textAlign: "center" }}><input type="radio" name={question.field_key} value={option} defaultChecked={initial === option} required={question.required} aria-label={`${question.label} - ${option}`} /></td>)}</tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderQuestion(question: PublicQuestion): ReactNode {
    if (!form) return null;
    const initial = form.prefill?.[question.field_key];
    const selectedValues = Array.isArray(initial) ? initial.map(String) : [];
    const isPhone = question.maps_to_candidate_field === "phone";
    const fileField = FILE_UPLOAD_FIELD_KEYS.has(question.field_key);

    return (
      <div className="field card" key={question.id} style={{ marginBottom: 0 }}>
        <label style={{ fontSize: 16 }}>{question.label}{question.required ? " *" : ""}</label>
        {fileField ? (
          <>
            <div className="stat-label" style={{ marginBottom: 8 }}>{fileHint(question.field_key, form.candidateName)}</div>
            {isStoredFile(initial) && <div className="notice success" style={{ marginBottom: 10 }}>✓ כבר קיים קובץ. אפשר לבחור קובץ חדש כדי להחליף אותו.</div>}
            <input
              className="input"
              name={question.field_key}
              type="file"
              required={question.required && !isStoredFile(initial)}
              accept={question.field_key === "photo_upload" ? "image/*" : ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
            />
          </>
        ) : question.field_type === "long_text" ? (
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
  }

  function renderQuestions() {
    const grouped = new Set([...BASE_PRIORITY_FIELD_KEYS, ...PROGRAMMING_FIELD_KEYS, ...OS_FIELD_KEYS]);
    const nodes: ReactNode[] = [];
    for (const question of sortedQuestions) {
      if (question.field_key === BASE_PRIORITY_FIELD_KEYS[0]) {
        nodes.push(<div key="base-matrix" style={{ gridColumn: "1 / -1" }}>{renderMatrix("עדיפות בסיס", BASE_PRIORITY_FIELD_KEYS)}</div>);
        continue;
      }
      if (question.field_key === PROGRAMMING_FIELD_KEYS[0]) {
        nodes.push(<div key="programming-matrix" style={{ gridColumn: "1 / -1" }}>{renderMatrix("שפות תכנות - רמת היכרות", PROGRAMMING_FIELD_KEYS)}</div>);
        continue;
      }
      if (question.field_key === OS_FIELD_KEYS[0]) {
        nodes.push(<div key="os-matrix" style={{ gridColumn: "1 / -1" }}>{renderMatrix("מערכת הפעלה - רמת היכרות", OS_FIELD_KEYS)}</div>);
        continue;
      }
      if (grouped.has(question.field_key)) continue;
      nodes.push(renderQuestion(question));
    }
    return nodes;
  }

  return (
    <main style={{ minHeight: "100vh", padding: "34px 18px", maxWidth: 980, margin: "0 auto" }}>
      <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={230} height={82} priority style={{ width: 230, height: "auto", display: "block", margin: "0 auto 24px" }} />

      {!form ? (
        <section className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ marginTop: 0 }}>שאלון מועמד</h1>
          <form onSubmit={identify} style={{ marginTop: 22 }}>
            <div className="field">
              <label>מספר טלפון</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0501234567" required autoFocus />
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
        <section>
          <div className="card row between wrap" style={{ marginBottom: 18 }}>
            <div><h1 style={{ margin: 0 }}>{form.title}</h1><div className="muted" style={{ marginTop: 5 }}>{form.cycleName}</div></div>
            <button className="btn btn-small" type="button" onClick={changeCandidate}>חזרה</button>
          </div>

          <div className="card" style={{ marginBottom: 18 }}><h2 style={{ fontSize: 20, margin: 0 }}>שלום {form.candidateName}</h2></div>
          {form.previouslySubmitted && <div className="notice" style={{ marginBottom: 18 }}>השאלון כבר מולא בעבר. אפשר לעדכן פרטים שהשתנו ולשלוח שוב.</div>}
          {error && <div className="notice danger" style={{ marginBottom: 18 }}>{error}</div>}

          <form onSubmit={submitQuestionnaire}>
            <div className="grid grid-2">{renderQuestions()}</div>
            <button className="btn btn-primary" disabled={submitting} style={{ width: "100%", marginTop: 18 }}>{submitting ? "שומר ושולח..." : "שליחת השאלון"}</button>
          </form>
        </section>
      )}
    </main>
  );
}
