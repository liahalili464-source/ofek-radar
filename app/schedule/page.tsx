"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { demoCandidates, demoUnits } from "@/lib/demo-data";
import { capacityReport, generateSchedule, validateSchedule, type InterviewDay } from "@/lib/scheduling";

const extraNames = Array.from({ length: 80 }, (_, i) => `מועמד/ת ${String(i + 1).padStart(2, "0")}`);
const candidatePool = [...demoCandidates.map((c) => c.fullName), ...extraNames];

export default function SchedulePage() {
  const [count, setCount] = useState(50);
  const [duration, setDuration] = useState(30);
  const [unitCount, setUnitCount] = useState(6);
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState<InterviewDay[]>([
    { date: "2026-09-08", start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] },
    { date: "2026-09-09", start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] },
  ]);

  const input = useMemo(() => ({
    candidateNames: candidatePool.slice(0, count),
    units: demoUnits.slice(0, unitCount).map((u) => u.name),
    days,
    durationMinutes: duration,
  }), [count, days, duration, unitCount]);
  const report = useMemo(() => capacityReport(input), [input]);
  const schedule = useMemo(() => report.canGenerate ? generateSchedule(input) : [], [input, report.canGenerate]);
  const validation = useMemo(() => schedule.length ? validateSchedule(input, schedule) : null, [input, schedule]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof schedule>();
    schedule.forEach((item) => {
      const key = `${item.date}|${item.start}|${item.end}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()].slice(0, 8);
  }, [schedule]);

  function addDay() {
    setDays((current) => [...current, { date: `2026-09-${String(8 + current.length).padStart(2, "0")}`, start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] }]);
  }

  function removeDay(index: number) {
    setDays((current) => current.filter((_, i) => i !== index));
  }

  return (
    <AppShell title="שיבוץ ראיונות" subtitle="בדיקת קיבולת ויצירת לו״ז אוטומטי — כל מועמד פוגש כל יחידה ללא התנגשויות">
      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card"><div className="field"><label>מספר מועמדים</label><input className="input" type="number" min={1} max={80} value={count} onChange={(e) => { setCount(Number(e.target.value)); setSaved(false); }} /></div></div>
        <div className="card"><div className="field"><label>מספר יחידות פעילות</label><input className="input" type="number" min={1} max={demoUnits.length} value={unitCount} onChange={(e) => { setUnitCount(Number(e.target.value)); setSaved(false); }} /></div></div>
        <div className="card"><div className="field"><label>משך ראיון</label><select className="select" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setSaved(false); }}><option value={20}>20 דקות</option><option value={30}>30 דקות</option><option value={45}>45 דקות</option><option value={60}>60 דקות</option></select></div></div>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>ימי ראיונות</h2><div className="stat-label">הפסקת 12:30–13:00 אינה נחשבת בסלוטים</div></div><button className="btn btn-small" onClick={addDay}>+ הוספת יום</button></div>
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {days.map((day, index) => <div className="notice" key={`${day.date}-${index}`}><div className="row between"><div><b>{day.date}</b><div className="stat-label">{day.start}–{day.end} · הפסקה 12:30–13:00</div></div><button className="btn btn-small btn-danger" onClick={() => removeDay(index)}>הסרה</button></div></div>)}
        </div>
      </section>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="סה״כ ראיונות" value={report.totalInterviews} />
        <StatCard label="סלוטים מקבילים נדרשים" value={report.requiredRounds} />
        <StatCard label="סלוטים זמינים" value={report.availableRounds} accent />
        <StatCard label="מצב" value={<span style={{ fontSize: 21, color: report.canGenerate ? "var(--success)" : "var(--danger)" }}>{report.canGenerate ? "אפשר לשבץ" : "אין קיבולת"}</span>} />
      </div>

      {!report.canGenerate ? (
        <div className="notice danger" style={{ marginBottom: 18 }}>
          <b>⚠️ חסרים {report.missingRounds} סלוטים.</b>
          <div className="stat-label" style={{ marginTop: 5 }}>עם {count} מועמדים ו-{unitCount} יחידות, כל יחידה צריכה לראות {count} מועמדים. הוסיפי ימים, האריכי שעות או קצרי את הראיון.</div>
        </div>
      ) : (
        <div className="notice success" style={{ marginBottom: 18 }}>
          <b>✓ אפשר לייצר לוח תקין.</b> {validation?.valid ? "האלגוריתם עבר גם בדיקת כפילויות והתנגשויות." : ""}
        </div>
      )}

      {!!schedule.length && (
        <section className="card">
          <div className="row between" style={{ marginBottom: 16 }}>
            <div><h2 className="section-title" style={{ marginBottom: 4 }}>תצוגה מקדימה של הלוז</h2><div className="stat-label">מוצגים 8 הסלוטים הראשונים מתוך {report.requiredRounds}. בכל סלוט מתקיימים עד {unitCount} ראיונות במקביל.</div></div>
            <div className="row"><button className="btn">ייצוא Excel</button><button className="btn btn-primary" onClick={() => setSaved(true)}>אישור ושמירת הלוז</button></div>
          </div>
          <div className="grid">
            {grouped.map(([key, meetings]) => {
              const [date, start, end] = key.split("|");
              return <div className="schedule-slot" key={key}><div className="schedule-slot-head"><span>{date}</span><span>{start}–{end}</span></div><div className="schedule-grid">{meetings.map((m) => <div className="schedule-meeting" key={`${m.unit}-${m.candidate}`}><b>{m.unit}</b><div style={{ marginTop: 4 }}>{m.candidate}</div></div>)}</div></div>;
            })}
          </div>
          {saved && <div className="notice success" style={{ marginTop: 14 }}>✓ הלוח נשמר בדמו. בחיבור Supabase הוא ייכתב לטבלת interviews ויופיע מיד אצל כל מראיין/ת.</div>}
        </section>
      )}
    </AppShell>
  );
}
