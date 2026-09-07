"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { defaultQuestions } from "@/lib/demo-data";
import { useLocalStorageState } from "@/lib/demo-store";
import type { QuestionnaireQuestion } from "@/lib/types";

export default function PublicQuestionnairePage() {
  const [questions] = useLocalStorageState<QuestionnaireQuestion[]>("ofek-radar-questionnaire", defaultQuestions);
  const [submitted, setSubmitted] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <main style={{ minHeight: "100vh", padding: "34px 18px", maxWidth: 820, margin: "0 auto" }}>
      <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={230} height={82} style={{ width: 230, height: "auto", display: "block", margin: "0 auto 24px" }} />
      <section className="card">
        {!submitted ? (
          <form onSubmit={submit}>
            <h1 style={{ marginTop: 0 }}>שאלון מועמד — מחזור ספטמבר 2026</h1>
            <p className="muted">הפרטים שתזינו יצורפו לכרטיס המועמד ויהיו זמינים לצוות המיון ולמראיינים המורשים בתהליך.</p>
            <div className="grid" style={{ marginTop: 24 }}>
              {questions.map((q) => (
                <div className="field" key={q.id}>
                  <label>{q.label}{q.required ? " *" : ""}</label>
                  {q.type === "long_text" ? <textarea rows={4} required={q.required} /> :
                    q.type === "single_choice" ? <div className="row wrap">{(q.options ?? []).map((o) => <label className="checkbox-row" key={o}><input type="radio" name={q.id} required={q.required} /> {o}</label>)}</div> :
                      q.type === "multi_choice" ? <div className="row wrap">{(q.options ?? []).map((o) => <label className="checkbox-row" key={o}><input type="checkbox" /> {o}</label>)}</div> :
                        q.type === "yes_no" ? <div className="row"><label className="checkbox-row"><input type="radio" name={q.id} /> כן</label><label className="checkbox-row"><input type="radio" name={q.id} /> לא</label></div> :
                          <input className="input" required={q.required} type={q.type === "date" ? "date" : q.type === "number" ? "number" : q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"} />}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 10 }}>שליחת השאלון</button>
          </form>
        ) : (
          <div className="empty">
            <div style={{ fontSize: 44 }}>✓</div>
            <h1>השאלון התקבל</h1>
            <p>תודה. התשובות נשמרו ויצורפו לכרטיס המועמד.</p>
          </div>
        )}
      </section>
    </main>
  );
}
