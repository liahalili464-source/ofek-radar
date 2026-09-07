"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { defaultQuestions } from "@/lib/demo-data";
import { useLocalStorageState } from "@/lib/demo-store";
import type { QuestionType, QuestionnaireQuestion } from "@/lib/types";

const typeLabels: Record<QuestionType, string> = {
  short_text: "טקסט קצר",
  long_text: "טקסט ארוך",
  number: "מספר",
  single_choice: "בחירה יחידה",
  multi_choice: "בחירה מרובה",
  date: "תאריך",
  yes_no: "כן / לא",
  phone: "טלפון",
  email: "אימייל",
};

const candidateFields = [
  ["", "ללא מיפוי"],
  ["full_name", "שם מלא"],
  ["national_id", "תעודת זהות"],
  ["phone", "טלפון"],
  ["city", "עיר"],
];

function nextId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function QuestionnairePage() {
  const [questions, setQuestions] = useLocalStorageState<QuestionnaireQuestion[]>("ofek-radar-questionnaire", defaultQuestions);
  const [saved, setSaved] = useLocalStorageState("ofek-radar-questionnaire-version", 1);

  function patch(id: string, values: Partial<QuestionnaireQuestion>) {
    setQuestions((current) => current.map((q) => q.id === id ? { ...q, ...values } : q));
  }

  function addQuestion() {
    const id = nextId();
    setQuestions((current) => [...current, { id, fieldKey: id, label: "שאלה חדשה", type: "short_text", required: false }]);
  }

  function remove(id: string) {
    setQuestions((current) => current.filter((q) => q.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function duplicate(question: QuestionnaireQuestion) {
    setQuestions((current) => [...current, { ...question, id: nextId(), fieldKey: `${question.fieldKey}_copy`, label: `${question.label} - עותק` }]);
  }

  return (
    <AppShell
      title="בונה שאלון"
      subtitle={`שאלון מועמד · גרסה ${saved} · המנהל/ת יכול/ה לערוך בלי שינוי קוד`}
      actions={<Link href="/form/demo" className="btn">תצוגת מועמד</Link>}
    >
      <div className="grid grid-2">
        <section className="grid">
          {questions.map((question, index) => (
            <article className="card question-card" key={question.id}>
              <div className="drag-handle">{index + 1}</div>
              <div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>נוסח השאלה</label>
                    <input className="input" value={question.label} onChange={(e) => patch(question.id, { label: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>סוג שדה</label>
                    <select className="select" value={question.type} onChange={(e) => patch(question.id, { type: e.target.value as QuestionType })}>
                      {Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </div>
                </div>

                {(question.type === "single_choice" || question.type === "multi_choice") && (
                  <div className="field">
                    <label>אפשרויות — מופרדות בפסיקים</label>
                    <input className="input" value={(question.options ?? []).join(", ")} onChange={(e) => patch(question.id, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                  </div>
                )}

                <div className="grid grid-2">
                  <div className="field">
                    <label>מיפוי לכרטיס מועמד</label>
                    <select className="select" value={question.mapsToCandidateField ?? ""} onChange={(e) => patch(question.id, { mapsToCandidateField: e.target.value || undefined })}>
                      {candidateFields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <label className="checkbox-row" style={{ alignSelf: "center", paddingTop: 16 }}>
                    <input type="checkbox" checked={question.required} onChange={(e) => patch(question.id, { required: e.target.checked })} />
                    <b>שדה חובה</b>
                  </label>
                </div>
              </div>
              <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-icon btn-small" onClick={() => move(index, -1)} aria-label="למעלה"><ArrowUp size={16} /></button>
                <button className="btn btn-icon btn-small" onClick={() => move(index, 1)} aria-label="למטה"><ArrowDown size={16} /></button>
                <button className="btn btn-icon btn-small" onClick={() => duplicate(question)} aria-label="שכפול"><Copy size={16} /></button>
                <button className="btn btn-icon btn-small btn-danger" onClick={() => remove(question.id)} aria-label="מחיקה"><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          <button className="btn" onClick={addQuestion}><Plus size={17} /> הוספת שאלה</button>
        </section>

        <aside className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="row between"><h2 className="section-title">תצוגה מקדימה</h2><span className="badge">{questions.length} שאלות</span></div>
            <div className="grid">
              {questions.map((question) => (
                <div className="preview-field" key={question.id}>
                  <b>{question.label}{question.required ? " *" : ""}</b>
                  <div style={{ marginTop: 9 }}>
                    {question.type === "long_text" ? <textarea rows={3} disabled placeholder="תשובה..." /> :
                      question.type === "yes_no" ? <div className="row"><label><input type="radio" disabled /> כן</label><label><input type="radio" disabled /> לא</label></div> :
                        question.type === "single_choice" || question.type === "multi_choice" ? <div className="row wrap">{(question.options ?? []).slice(0, 5).map((o) => <span className="badge" key={o}>{o}</span>)}</div> :
                          <input className="input" disabled placeholder={typeLabels[question.type]} />}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">פרסום גרסה</h2>
            <p className="section-subtitle">כאשר שאלון כבר נשלח למועמדים, שומרים את הגרסה הקודמת ויוצרים גרסה חדשה לעריכות.</p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => setSaved((v) => v + 1)}>פרסום כגרסה {saved + 1}</button>
              <span className="badge ok">גרסה פעילה: {saved}</span>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
