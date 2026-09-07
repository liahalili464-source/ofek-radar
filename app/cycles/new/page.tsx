"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ExcelImporter, type NormalizedCandidateRow } from "@/components/excel-importer";
import { demoUnits } from "@/lib/demo-data";
import { capacityReport, type InterviewDay } from "@/lib/scheduling";

export default function NewCyclePage() {
  const [candidateRows, setCandidateRows] = useState<NormalizedCandidateRow[]>([]);
  const [candidateCount, setCandidateCount] = useState(58);
  const [selected, setSelected] = useState<string[]>(demoUnits.slice(0, 6).map((u) => u.name));
  const [duration, setDuration] = useState(30);
  const [days, setDays] = useState<InterviewDay[]>([
    { date: "2026-09-08", start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] },
    { date: "2026-09-09", start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] },
  ]);

  const actualCount = candidateRows.length || candidateCount;
  const input = useMemo(() => ({
    candidateNames: Array.from({ length: actualCount }, (_, i) => `מועמד ${i + 1}`),
    units: selected,
    days,
    durationMinutes: duration,
  }), [actualCount, days, duration, selected]);
  const report = capacityReport(input);

  function toggleUnit(unit: string) {
    setSelected((current) => current.includes(unit) ? current.filter((u) => u !== unit) : [...current, unit]);
  }

  function updateDay(index: number, patch: Partial<InterviewDay>) {
    setDays((current) => current.map((d, i) => i === index ? { ...d, ...patch } : d));
  }

  function addDay() {
    setDays((current) => [...current, { date: "2026-09-10", start: "09:00", end: "16:00", breaks: [{ start: "12:30", end: "13:00" }] }]);
  }

  return (
    <AppShell title="פתיחת מחזור חדש" subtitle="הגדרת המחזור, העלאת מועמדים, בחירת יחידות והכנת תשתית לשיבוץ">
      <div className="stepper">
        {["פרטי מחזור", "מועמדים", "שאלון", "יחידות", "זמינות", "בדיקת קיבולת", "יצירת לוז"].map((x, i) => (
          <div key={x} className={`step ${i < 2 ? "done" : i === 2 ? "active" : ""}`}>{i + 1}. {x}</div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="grid">
          <section className="card">
            <h2 className="section-title">1. פרטי המחזור</h2>
            <div className="field"><label>שם המחזור</label><input className="input" defaultValue="מחזור ספטמבר 2026" /></div>
            <div className="grid grid-2">
              <div className="field"><label>שנת גיוס</label><input className="input" type="number" defaultValue="2026" /></div>
              <div className="field"><label>סטטוס ראשוני</label><select className="select" defaultValue="draft"><option value="draft">בתכנון</option><option value="active">פעיל</option></select></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>תאריך התחלה</label><input className="input" type="date" defaultValue="2026-09-01" /></div>
              <div className="field"><label>תאריך סיום</label><input className="input" type="date" defaultValue="2026-09-21" /></div>
            </div>
          </section>

          <section className="card">
            <div className="row between"><div><h2 className="section-title" style={{ marginBottom: 4 }}>2. מועמדים</h2><div className="stat-label">Excel → מיפוי עמודות → בדיקת ת.ז כפולות → ייבוא</div></div><span className="badge">{actualCount} מועמדים</span></div>
            <div style={{ marginTop: 16 }}><ExcelImporter onImport={(rows) => { setCandidateRows(rows); setCandidateCount(rows.length); }} /></div>
          </section>
        </div>

        <div className="grid">
          <section className="card">
            <div className="row between"><h2 className="section-title">3. שאלון מועמד</h2><Link href="/questionnaire" className="btn btn-small">עריכת השאלון</Link></div>
            <div className="notice">
              <b>שאלון ברירת המחדל של המחזור</b>
              <div className="stat-label" style={{ marginTop: 5 }}>7 שאלות · שם, ת.ז, טלפון, עיר, השכלה, טכנולוגיות ומוטיבציה</div>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">4. יחידות משתתפות</h2>
            <div className="grid grid-2">
              {demoUnits.map((unit) => (
                <label key={unit.id} className="notice checkbox-row">
                  <input type="checkbox" checked={selected.includes(unit.name)} onChange={() => toggleUnit(unit.name)} />
                  <span><b>{unit.name}</b><div className="stat-label">{unit.interviewer}</div></span>
                </label>
              ))}
            </div>
            <p className="stat-label">נבחרו {selected.length} יחידות מתוך {demoUnits.length}</p>
          </section>

          <section className="card">
            <div className="row between"><h2 className="section-title">5. ימי ראיונות</h2><button className="btn btn-small" onClick={addDay}>+ הוספת יום</button></div>
            <div className="field"><label>משך כל ראיון</label><select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}><option value={20}>20 דקות</option><option value={30}>30 דקות</option><option value={45}>45 דקות</option><option value={60}>60 דקות</option></select></div>
            <div className="grid">
              {days.map((day, index) => (
                <div className="notice" key={`${day.date}-${index}`}>
                  <div className="grid grid-3">
                    <div className="field"><label>תאריך</label><input className="input" type="date" value={day.date} onChange={(e) => updateDay(index, { date: e.target.value })} /></div>
                    <div className="field"><label>התחלה</label><input className="input" type="time" value={day.start} onChange={(e) => updateDay(index, { start: e.target.value })} /></div>
                    <div className="field"><label>סיום</label><input className="input" type="time" value={day.end} onChange={(e) => updateDay(index, { end: e.target.value })} /></div>
                  </div>
                  <div className="stat-label">הפסקה: 12:30–13:00</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className={`card ${report.canGenerate ? "" : ""}`} style={{ marginTop: 16 }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 5 }}>6. בדיקת קיבולת</h2>
            <div className="stat-label">המערכת בודקת לפני השיבוץ אם התכנית בכלל אפשרית.</div>
          </div>
          <span className={`badge ${report.canGenerate ? "ok" : "danger"}`}>{report.canGenerate ? "אפשר לשבץ" : "אין מספיק קיבולת"}</span>
        </div>
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="notice"><div className="stat-label">מועמדים</div><b>{actualCount}</b></div>
          <div className="notice"><div className="stat-label">סה״כ ראיונות</div><b>{report.totalInterviews}</b></div>
          <div className="notice"><div className="stat-label">סלוטים נדרשים</div><b>{report.requiredRounds}</b></div>
          <div className="notice"><div className="stat-label">סלוטים זמינים</div><b className="accent">{report.availableRounds}</b></div>
        </div>
        {!report.canGenerate && <div className="notice danger" style={{ marginTop: 14 }}>⚠️ חסרים {report.missingRounds} סלוטים. אפשר להוסיף יום, להאריך שעות או לקצר את משך הראיון.</div>}
      </section>

      <div className="row" style={{ justifyContent: "flex-start", marginTop: 20 }}>
        <Link href="/schedule" className={`btn ${report.canGenerate ? "btn-primary" : ""}`}>המשך ליצירת לוח ראיונות</Link>
        <Link href="/cycles" className="btn">שמירה כטיוטה</Link>
      </div>
    </AppShell>
  );
}
