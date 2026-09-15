"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const MASTER_PREVIEW_CODE = "1905";

const ratingQuestions = [
  ["intake_experience", "איך היית מדרג את חווית הקליטה הכללית שלך ביחידה?"],
  ["info_clarity", "עד כמה הרגשת שהמידע שקיבלת היה ברור ומפורט?"],
  ["interviewer_professionalism", "עד כמה הרגשת שהמראיינים היו מקצועיים ונעימים?"],
  ["fairness", "עד כמה הרגשת שהתהליך היה הוגן ואובייקטיבי?"],
  ["questions_space", "עד כמה הרגשת שהיה לך מקום לשאול שאלות ולקבל תשובות מספקות?"],
] as const;

const openQuestions = [
  ["overall_feeling", "מה הייתה התחושה הכללית שלך לאורך תהליך המיון?"],
  ["contact_person", "האם הרגשת שיש לך איש קשר לפנות אליו במהלך התהליך? אם כן, פרט"],
  ["surprise", "מה הכי הפתיע אותך בתהליך המיון (לחיוב או לשלילה)?"],
  ["preserve", "נקודה אחת שהיית רוצה לראות נשמרת בתהליך (משהו שהיה חיובי במיוחד):"],
  ["improve", "נקודה אחת שהיית מציע לשפר בתהליך:"],
  ["additional", "האם יש לך המלצות כלליות או הערות נוספות שנרצה לשמוע?"],
] as const;

type Answers = Record<string, string | number>;
type SurveyData = { cycleName: string; prefill: Answers; previouslySubmitted: boolean; previewOnly?: boolean };

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

export default function SatisfactionPage() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function identify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const normalized = normalizePhone(phone);
    if (normalized !== MASTER_PREVIEW_CODE && normalized.length < 9) { setError("יש להזין מספר טלפון תקין."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/satisfaction/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", phone: normalized }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "NOT_FOUND");
      setPhone(normalized);
      setData(json as SurveyData);
      setAnswers((json.prefill || {}) as Answers);
    } catch {
      setError("לא נמצא מחזור מתאים למספר הטלפון הזה.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setError("");
    setSaved(false);
    const missingRating = ratingQuestions.some(([key]) => !Number(answers[key]));
    if (missingRating) { setError("יש להשלים את כל שאלות הדירוג."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/satisfaction/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", phone, answers }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "SAVE_FAILED");
      setSaved(true);
    } catch {
      setError("לא הצלחנו לשמור את הסקר. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#071b2d", padding: "32px 18px", color: "white" }} dir="rtl">
      <div style={{ width: "min(780px,100%)", margin: "0 auto" }}>
        <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={1619} height={971} unoptimized style={{ width: 220, height: 110, objectFit: "cover", objectPosition: "50% 42%", display: "block", margin: "0 auto 22px" }} />
        <section className="card" style={{ background: "#102f49", color: "white" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>סקר שביעות רצון</h1>
          <p className="stat-label" style={{ lineHeight: 1.7, marginTop: 0 }}>נשמח לשמוע את דעתך על תהליך הקליטה והמיון שעברת. המידע ישמש לשיפור מתמיד של התהליך ולשמירה על חוויית מועמד איכותית ומכבדת.</p>

          {!data && <form onSubmit={identify} style={{ marginTop: 20 }}>
            <div className="field"><label>מספר טלפון</label><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" required /></div>
            {error && <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "בודק..." : "המשך לסקר"}</button>
          </form>}

          {data && <div style={{ marginTop: 20 }}>
            {data.previewOnly && <div className="notice" style={{ marginBottom: 16 }}><b>תצוגת IT</b><div className="stat-label">מצב תצוגה בלבד — המשוב לא ישויך למועמד ולא ייכנס לנתוני המחזורים.</div></div>}
            <div className="notice" style={{ marginBottom: 18 }}><div className="stat-label">הסקר ישויך למחזור</div><b>{data.cycleName}</b></div>

            <h2 className="section-title">שאלות דירוג</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {ratingQuestions.map(([key, label]) => <div className="notice" key={key}>
                <b>{label}</b>
                <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((rating) => <label key={rating} className="btn btn-small" style={{ minWidth: 54, background: Number(answers[key]) === rating ? "var(--accent)" : undefined, color: Number(answers[key]) === rating ? "#032335" : undefined }}><input type="radio" name={key} value={rating} checked={Number(answers[key]) === rating} onChange={() => setAnswers((current) => ({ ...current, [key]: rating }))} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />{rating}</label>)}
                </div>
              </div>)}
            </div>

            <h2 className="section-title" style={{ marginTop: 24 }}>שאלות פתוחות</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {openQuestions.map(([key, label]) => <div className="field" key={key}><label>{label}</label><textarea rows={4} value={String(answers[key] || "")} onChange={(e) => setAnswers((current) => ({ ...current, [key]: e.target.value }))} /></div>)}
            </div>

            {error && <div className="notice danger" style={{ marginTop: 14 }}>{error}</div>}
            {saved && <div className="notice success" style={{ marginTop: 14 }}>✓ {data.previewOnly ? "התצוגה הושלמה — לא נשמרו נתונים." : "תודה, המשוב נשמר בהצלחה."}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={saving} onClick={submit}>{saving ? "שומר..." : data.previewOnly ? "בדיקת שליחה" : data.previouslySubmitted ? "עדכון המשוב" : "שליחת המשוב"}</button>
            <button className="btn btn-small" style={{ marginTop: 12 }} onClick={() => { setData(null); setSaved(false); setError(""); }}>שימוש במספר אחר</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
