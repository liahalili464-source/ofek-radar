"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { QuestionType, QuestionnaireQuestion } from "@/lib/types";

const TEMPLATE_MODE = "__template__";

const questionnaireTemplate: QuestionnaireQuestion[] = [
  { id: "template_full_name", fieldKey: "full_name", label: "שם מלא", type: "short_text", required: true, mapsToCandidateField: "full_name" },
  { id: "template_national_id", fieldKey: "national_id", label: "תעודת זהות", type: "short_text", required: true, mapsToCandidateField: "national_id" },
  { id: "template_phone", fieldKey: "phone", label: "טלפון", type: "phone", required: true, mapsToCandidateField: "phone" },
  { id: "template_city", fieldKey: "city", label: "עיר מגורים", type: "short_text", required: false, mapsToCandidateField: "city" },
  { id: "template_education", fieldKey: "education", label: "השכלה", type: "long_text", required: false },
  { id: "template_skills", fieldKey: "skills", label: "באילו שפות/טכנולוגיות יש לך ניסיון?", type: "multi_choice", required: true, options: ["Python", "JavaScript", "C++", "C#", "Java", "SQL", "Linux", "DevOps"] },
  { id: "template_motivation", fieldKey: "motivation", label: "למה מעניין אותך להשתלב ביחידה טכנולוגית?", type: "long_text", required: true },
];

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

type Cycle = { id: string; name: string; status: string };
type QuestionnaireRow = { id: string; title: string; active_version: number };
type QuestionRow = { id: string; field_key: string; label: string; field_type: QuestionType; required: boolean; options: string[]; position: number; maps_to_candidate_field: string | null };

function nextId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function cycleStatusLabel(status: string) {
  if (status === "active") return "פעיל";
  if (status === "draft") return "בתכנון";
  if (status === "completed") return "סגור";
  if (status === "archived") return "ארכיון";
  return status;
}

export default function QuestionnairePage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState(TEMPLATE_MODE);
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>(questionnaireTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: cycleError } = await supabase.from("cycles").select("id,name,status").order("starts_on", { ascending: false });
      if (cycleError) {
        if (!cancelled) { setError(cycleError.message); setLoading(false); }
        return;
      }
      const list = (data || []) as Cycle[];
      if (!cancelled) {
        setCycles(list);
        const preferred = list.find((c) => c.status === "active") || list.find((c) => c.status === "draft");
        setCycleId(preferred?.id || TEMPLATE_MODE);
        if (!preferred) {
          setQuestionnaireId(null);
          setVersion(1);
          setQuestions(questionnaireTemplate);
          setLoading(false);
        }
      }
    }
    loadCycles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cycleId === TEMPLATE_MODE) {
      setQuestionnaireId(null);
      setVersion(1);
      setQuestions(questionnaireTemplate);
      setSaved(false);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    async function loadQuestionnaire() {
      setLoading(true);
      setSaved(false);
      setError("");
      const supabase = createSupabaseBrowserClient();
      let { data: questionnaire, error: questionnaireError } = await supabase.from("questionnaires").select("id,title,active_version").eq("cycle_id", cycleId).maybeSingle();
      if (questionnaireError) {
        if (!cancelled) { setError(questionnaireError.message); setLoading(false); }
        return;
      }

      if (!questionnaire) {
        const { data: created, error: createError } = await supabase.from("questionnaires").insert({ cycle_id: cycleId, title: "שאלון מועמד", active_version: 1 }).select("id,title,active_version").single();
        if (createError || !created) {
          if (!cancelled) { setError(createError?.message || "יצירת השאלון נכשלה"); setLoading(false); }
          return;
        }
        questionnaire = created as QuestionnaireRow;
        const seedRows = questionnaireTemplate.map((q, index) => ({
          questionnaire_id: questionnaire!.id,
          version: 1,
          field_key: q.fieldKey,
          label: q.label,
          field_type: q.type,
          required: q.required,
          options: q.options || [],
          position: index,
          maps_to_candidate_field: q.mapsToCandidateField || null,
        }));
        const { error: seedError } = await supabase.from("questionnaire_questions").insert(seedRows);
        if (seedError) {
          if (!cancelled) { setError(seedError.message); setLoading(false); }
          return;
        }
      }

      const q = questionnaire as QuestionnaireRow;
      const { data: questionData, error: questionError } = await supabase.from("questionnaire_questions").select("id,field_key,label,field_type,required,options,position,maps_to_candidate_field").eq("questionnaire_id", q.id).eq("version", q.active_version).order("position");
      if (questionError) {
        if (!cancelled) { setError(questionError.message); setLoading(false); }
        return;
      }
      const mapped = ((questionData || []) as QuestionRow[]).map((row) => ({
        id: row.id,
        fieldKey: row.field_key,
        label: row.label,
        type: row.field_type,
        required: row.required,
        options: row.options || [],
        mapsToCandidateField: row.maps_to_candidate_field || undefined,
      }));
      if (!cancelled) {
        setQuestionnaireId(q.id);
        setVersion(q.active_version);
        setQuestions(mapped);
        setLoading(false);
      }
    }
    loadQuestionnaire();
    return () => { cancelled = true; };
  }, [cycleId]);

  const selectedCycle = useMemo(() => cycles.find((c) => c.id === cycleId) || null, [cycles, cycleId]);
  const templateMode = cycleId === TEMPLATE_MODE;
  const cycleLocked = selectedCycle?.status === "completed" || selectedCycle?.status === "archived";
  const canEdit = !templateMode && !cycleLocked;

  function patch(id: string, values: Partial<QuestionnaireQuestion>) {
    if (!canEdit) return;
    setSaved(false);
    setQuestions((current) => current.map((q) => q.id === id ? { ...q, ...values } : q));
  }

  function addQuestion() {
    if (!canEdit) return;
    setSaved(false);
    const id = nextId();
    setQuestions((current) => [...current, { id, fieldKey: id, label: "שאלה חדשה", type: "short_text", required: false }]);
  }

  function remove(id: string) {
    if (!canEdit) return;
    setSaved(false);
    setQuestions((current) => current.filter((q) => q.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    if (!canEdit) return;
    setSaved(false);
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function duplicate(question: QuestionnaireQuestion) {
    if (!canEdit) return;
    setSaved(false);
    setQuestions((current) => [...current, { ...question, id: nextId(), fieldKey: `${question.fieldKey}_copy_${Date.now()}`, label: `${question.label} - עותק` }]);
  }

  async function saveVersion() {
    if (!canEdit || !questionnaireId || !questions.length) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const nextVersion = version + 1;
      const rows = questions.map((q, index) => ({
        questionnaire_id: questionnaireId,
        version: nextVersion,
        field_key: q.fieldKey,
        label: q.label.trim() || `שאלה ${index + 1}`,
        field_type: q.type,
        required: q.required,
        options: q.options || [],
        position: index,
        maps_to_candidate_field: q.mapsToCandidateField || null,
      }));
      const { error: insertError } = await supabase.from("questionnaire_questions").insert(rows);
      if (insertError) throw insertError;
      const { error: updateError } = await supabase.from("questionnaires").update({ active_version: nextVersion }).eq("id", questionnaireId);
      if (updateError) throw updateError;
      setVersion(nextVersion);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת השאלון נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const displayName = templateMode ? "תבנית השאלון הכללית" : selectedCycle?.name || "מחזור";

  return (
    <AppShell
      title="שאלון מועמד"
      subtitle={templateMode ? "תצוגה של השאלון גם כשאין מחזור פתוח" : `${displayName} · גרסה פעילה ${version}`}
      actions={canEdit ? <button className="btn btn-primary" disabled={saving || loading || !questionnaireId} onClick={saveVersion}><Save size={17} /> {saving ? "שומר..." : "שמירה ופרסום גרסה חדשה"}</button> : undefined}
    >
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>איזה שאלון להציג?</label>
          <select className="select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value={TEMPLATE_MODE}>תבנית השאלון הכללית</option>
            {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycleStatusLabel(cycle.status)}</option>)}
          </select>
        </div>
      </section>

      {templateMode && <div className="notice" style={{ marginBottom: 16 }}><b>תצוגה ללא מחזור</b><div className="stat-label" style={{ marginTop: 4 }}>זו תבנית ברירת המחדל של השאלון. אפשר לצפות בה גם כשאין כרגע מחזור פעיל. כדי לערוך ולפרסם שאלון בפועל, בחרי מחזור בתכנון או מחזור פעיל.</div></div>}
      {cycleLocked && <div className="notice warning" style={{ marginBottom: 16 }}><b>המחזור סגור לקריאה בלבד</b><div className="stat-label" style={{ marginTop: 4 }}>אפשר לראות את השאלון כפי שהיה במחזור הזה, אבל לא לשנות אותו.</div></div>}
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="notice success" style={{ marginBottom: 16 }}>✓ גרסה {version} פורסמה. קישורים לשאלון ישתמשו מעכשיו בגרסה הזו.</div>}

      {loading ? <div className="notice">טוען שאלון...</div> : (
        <div className="grid grid-2">
          <section className="grid">
            {questions.map((question, index) => (
              <article className="card question-card" key={question.id}>
                <div className="drag-handle">{index + 1}</div>
                <div>
                  <div className="grid grid-2">
                    <div className="field"><label>נוסח השאלה</label><input className="input" value={question.label} disabled={!canEdit} onChange={(e) => patch(question.id, { label: e.target.value })} /></div>
                    <div className="field"><label>סוג שדה</label><select className="select" value={question.type} disabled={!canEdit} onChange={(e) => patch(question.id, { type: e.target.value as QuestionType })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
                  </div>
                  {(question.type === "single_choice" || question.type === "multi_choice") && <div className="field"><label>אפשרויות</label><input className="input" disabled={!canEdit} value={(question.options ?? []).join(", ")} onChange={(e) => patch(question.id, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>}
                  <div className="grid grid-2">
                    <div className="field"><label>מיפוי לכרטיס מועמד</label><select className="select" disabled={!canEdit} value={question.mapsToCandidateField ?? ""} onChange={(e) => patch(question.id, { mapsToCandidateField: e.target.value || undefined })}>{candidateFields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <label className="checkbox-row" style={{ alignSelf: "center", paddingTop: 16 }}><input type="checkbox" disabled={!canEdit} checked={question.required} onChange={(e) => patch(question.id, { required: e.target.checked })} /><b>שדה חובה</b></label>
                  </div>
                </div>
                {canEdit && <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-icon btn-small" onClick={() => move(index, -1)} aria-label="למעלה"><ArrowUp size={16} /></button>
                  <button className="btn btn-icon btn-small" onClick={() => move(index, 1)} aria-label="למטה"><ArrowDown size={16} /></button>
                  <button className="btn btn-icon btn-small" onClick={() => duplicate(question)} aria-label="שכפול"><Copy size={16} /></button>
                  <button className="btn btn-icon btn-small btn-danger" onClick={() => remove(question.id)} aria-label="מחיקה"><Trash2 size={16} /></button>
                </div>}
              </article>
            ))}
            {canEdit && <button className="btn" onClick={addQuestion}><Plus size={17} /> הוספת שאלה</button>}
          </section>

          <aside className="grid" style={{ alignContent: "start" }}>
            <section className="card">
              <div className="row between"><h2 className="section-title">כך המועמד/ת יראו את השאלון</h2><span className="badge">{questions.length} שאלות</span></div>
              <div className="grid">
                {questions.map((question) => <div className="preview-field" key={question.id}><b>{question.label}{question.required ? " *" : ""}</b><div style={{ marginTop: 9 }}>{question.type === "long_text" ? <textarea rows={3} disabled placeholder="תשובה..." /> : question.type === "yes_no" ? <div className="row"><label><input type="radio" disabled /> כן</label><label><input type="radio" disabled /> לא</label></div> : question.type === "single_choice" || question.type === "multi_choice" ? <div className="row wrap">{(question.options ?? []).map((o) => <span className="badge" key={o}>{o}</span>)}</div> : <input className="input" disabled placeholder={typeLabels[question.type]} />}</div></div>)}
              </div>
            </section>
            <section className="card">
              <h2 className="section-title">גישה למועמדים</h2>
              <p className="section-subtitle">כשהשאלון משויך למחזור ולמועמד/ת, נוצר עבורו קישור אישי שאפשר לשלוח בוואטסאפ. המועמד/ת לא צריכים שם משתמש או סיסמה.</p>
              <span className="badge ok">גישה דרך קישור אישי</span>
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
