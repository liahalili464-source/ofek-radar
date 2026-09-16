"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";

type Stats = { cycle?: { name: string }; candidates: number; units: number; interviews: number; completed: number; evaluations: number; questionnaires: number; ranked: number; surveys: number };

const stages = [
  { key: "questionnaires", title: "1. השאלונים הושלמו", text: "ממלא נתוני שאלון וכרטיסי מועמד ומוסיף תמונות דמה." },
  { key: "interviews", title: "2. הראיונות הסתיימו", text: "יוצר את כל הראיונות מול היחידות, ציונים וחוות דעת שונות." },
  { key: "rankings", title: "3. דירוגי היחידות הושלמו", text: "מייצר לכל מועמד סדר העדפות 1–8, כדי לבדוק את מסכי הסיכום והשיבוץ." },
  { key: "placements", title: "4. בוצעו שיבוצים", text: "משבץ את מועמדי הדמה בין היחידות כדי לבדוק סיכום, הפצה וייצוא." },
  { key: "satisfaction", title: "5. התקבלו סקרי שביעות רצון", text: "ממלא משובים מגוונים כדי שמסך סיכום הסקר יציג נתונים אמיתיים למראה." },
] as const;

export function DemoCycleSimulator() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const r = await fetch("/api/maintenance/demo", { cache: "no-store" });
    if (r.ok) setStats(await r.json());
  }
  useEffect(() => { refresh(); }, []);

  async function run(stage: string) {
    if (stage === "reset" && !window.confirm("לאפס את כל נתוני ההרצה במחזור הדמה? מועמדי הדמה עצמם יישארו.")) return;
    setBusy(stage); setMessage("");
    try {
      const r = await fetch("/api/maintenance/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "ERROR");
      await refresh();
      setMessage(stage === "reset" ? "מחזור הדמה אופס. אפשר להתחיל את ההרצה מחדש." : "השלב הושלם. עכשיו אפשר להיכנס למסכים ולראות את הנתונים.");
    } catch { setMessage("לא הצלחנו להריץ את השלב. נסי שוב."); }
    finally { setBusy(null); }
  }

  return <section className="card" style={{ marginBottom: 18, borderColor: "rgba(34,211,238,.38)" }}>
    <div className="row between wrap" style={{ gap: 12, marginBottom: 18 }}>
      <div><div className="row" style={{ gap: 8 }}><Sparkles size={19} /><h2 className="section-title" style={{ margin: 0 }}>סימולטור מחזור דמה</h2></div><div className="stat-label" style={{ marginTop: 5 }}>{stats?.cycle?.name || "מחזור בדיקה"} · רק לחשבון IT</div></div>
      <button className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("reset")}><RotateCcw size={15} /> איפוס מחזור הדמה</button>
    </div>

    {stats && <div className="kpi-strip" style={{ marginBottom: 18 }}>
      <div className="kpi"><b>{stats.candidates}</b><span>מועמדים</span></div><div className="kpi"><b>{stats.questionnaires}</b><span>שאלונים</span></div><div className="kpi"><b>{stats.completed}</b><span>ראיונות שהושלמו</span></div><div className="kpi"><b>{stats.evaluations}</b><span>חוות דעת</span></div><div className="kpi"><b>{stats.ranked}</b><span>דירוגי יחידות</span></div><div className="kpi"><b>{stats.surveys}</b><span>סקרי שביעות רצון</span></div>
    </div>}

    <div style={{ display: "grid", gap: 9 }}>
      {stages.map((stage) => <div key={stage.key} className="notice" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 14, padding: 15 }}>
        <div><b style={{ display: "block", marginBottom: 3 }}>{stage.title}</b><span className="stat-label">{stage.text}</span></div>
        <button className="btn btn-primary btn-small" disabled={Boolean(busy)} onClick={() => run(stage.key)}>{busy === stage.key ? "מריץ..." : "הרצת השלב"}</button>
      </div>)}
    </div>
    {message && <div className="notice success" style={{ marginTop: 14 }}><CheckCircle2 size={16} /> {message}</div>}
  </section>;
}
