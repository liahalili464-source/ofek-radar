"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return (
    <AppShell title="הגדרות" subtitle="ברירות מחדל למחזורים, ראיונות והתנהגות המערכת">
      <div className="grid grid-2">
        <section className="card">
          <h2 className="section-title">ברירות מחדל לראיונות</h2>
          <div className="field"><label>משך ראיון ברירת מחדל</label><select className="select" defaultValue="30"><option>20</option><option>30</option><option>45</option><option>60</option></select></div>
          <div className="grid grid-2"><div className="field"><label>שעת התחלה</label><input className="input" type="time" defaultValue="09:00" /></div><div className="field"><label>שעת סיום</label><input className="input" type="time" defaultValue="16:00" /></div></div>
          <div className="grid grid-2"><div className="field"><label>תחילת הפסקה</label><input className="input" type="time" defaultValue="12:30" /></div><div className="field"><label>סיום הפסקה</label><input className="input" type="time" defaultValue="13:00" /></div></div>
        </section>
        <section className="card">
          <h2 className="section-title">תהליך מועמד</h2>
          {["יובא למערכת", "שאלון נשלח", "שאלון הושלם", "שובץ לראיונות", "ראיונות הושלמו", "החלטה התקבלה"].map((x, i) => <div className="notice row between" key={x} style={{ marginBottom: 8 }}><span><b>{i + 1}. {x}</b></span><span className="badge">פעיל</span></div>)}
        </section>
      </div>
      <div className="row" style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setSaved(true)}>שמירת הגדרות</button>{saved && <span className="badge ok">✓ נשמר</span>}</div>
    </AppShell>
  );
}
