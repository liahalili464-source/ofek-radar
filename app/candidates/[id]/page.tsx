"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { demoCandidates } from "@/lib/demo-data";

export default function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [saved, setSaved] = useState(false);
  const { id } = use(params);
  const candidate = demoCandidates.find((c) => c.id === id) ?? demoCandidates[0];

  return (
    <AppShell title="כרטיס מועמד" subtitle="מחזור ספטמבר 2026" actions={<Link href="/candidates" className="btn">חזרה לרשימה</Link>}>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="row between wrap">
          <div className="row">
            <div style={{ width: 62, height: 62, borderRadius: 13, border: "1px solid var(--accent)", background: "var(--accent-soft)", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>
              {candidate.fullName.split(" ").map((x) => x[0]).join("")}
            </div>
            <div><h2 style={{ margin: 0 }}>{candidate.fullName}</h2><div className="stat-label">ת.ז {candidate.nationalId} · {candidate.phone} · {candidate.city}</div></div>
          </div>
          <div className="row wrap"><span className="badge">{candidate.targetUnit}</span><StatusBadge status={candidate.status} /></div>
        </div>
      </section>

      <div className="tabs">
        {[['overview','פרטים ושאלון'],['interviews','ראיונות'],['evaluations','חוות דעת'],['timeline','ציר זמן']].map(([key,label]) => <button key={key} className={`tab ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>{label}</button>)}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-2">
          <section className="card">
            <h2 className="section-title">פרטים ממקור הנתונים</h2>
            <div className="grid grid-2">
              <div className="field"><label>שם מלא</label><div className="preview-field">{candidate.fullName}</div></div>
              <div className="field"><label>תעודת זהות</label><div className="preview-field">{candidate.nationalId}</div></div>
              <div className="field"><label>טלפון</label><div className="preview-field">{candidate.phone}</div></div>
              <div className="field"><label>עיר</label><div className="preview-field">{candidate.city}</div></div>
            </div>
            <div className="notice warning">המידע היבש נשמר בנפרד מנתוני השאלון, כך שאפשר לזהות סתירות ולעדכן באופן מבוקר.</div>
          </section>
          <section className="card">
            <h2 className="section-title">סיכום שאלון</h2>
            <div className="field"><label>השכלה</label><div>{candidate.education ?? "טרם הוזן"}</div></div>
            <div className="field"><label>ניסיון קודם</label><div>{candidate.experience ?? "טרם הוזן"}</div></div>
            <div className="field"><label>שפות / טכנולוגיות</label><div className="row wrap">{(candidate.skills ?? []).map((s) => <span className="badge" key={s}>{s}</span>)}</div></div>
            <div className="field"><label>מוטיבציה</label><div>{candidate.motivation ?? "טרם הוזן"}</div></div>
          </section>
        </div>
      )}

      {activeTab === "interviews" && (
        <section className="card">
          <h2 className="section-title">ראיונות במחזור</h2>
          <div className="table-wrap"><table className="table"><thead><tr><th>יחידה</th><th>מראיין/ת</th><th>תאריך</th><th>שעה</th><th>סטטוס</th></tr></thead><tbody>
            {[['יחידה 8200','אלון פרץ','08.09.2026','09:00','בוצע'],['יחידה 81','מיכל לוי','08.09.2026','11:00','בוצע'],['מפא״ת','דנה אלמוג','09.09.2026','10:30','מתוכנן'],['תקשוב','רוני כספי','09.09.2026','13:30','מתוכנן']].map((r,i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td><StatusBadge status={r[4]} /></td></tr>)}
          </tbody></table></div>
        </section>
      )}

      {activeTab === "evaluations" && (
        <div className="grid grid-2">
          <section className="card">
            <h2 className="section-title">הזנת חוות דעת</h2>
            <div className="grid grid-2">
              <div className="field"><label>ציון מקצועי</label><select className="select" defaultValue="4"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
              <div className="field"><label>ציון אישי</label><select className="select" defaultValue="5"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
            </div>
            <div className="field"><label>המלצה</label><select className="select"><option>מומלץ מאוד</option><option>מומלץ</option><option>מתלבט</option><option>לא מומלץ</option></select></div>
            <div className="field"><label>הערות</label><textarea rows={6} placeholder="התרשמות, נקודות חוזקה, הסתייגויות..." /></div>
            <div className="row"><button className="btn btn-primary" onClick={() => setSaved(true)}>שמירת חוות דעת</button>{saved && <span className="badge ok">✓ נשמר בדמו</span>}</div>
          </section>
          <section className="card">
            <h2 className="section-title">חוות דעת שכבר התקבלו</h2>
            {[['יחידה 8200','5','מומלץ מאוד','יכולת למידה גבוהה וחשיבה שיטתית.'],['יחידה 81','4','מומלץ','בסיס מקצועי טוב, כדאי להעמיק ברשתות.']].map((r) => <div className="notice" style={{ marginBottom: 10 }} key={r[0]}><div className="row between"><b>{r[0]}</b><span className="badge ok">{r[2]}</span></div><div className="stat-label" style={{ margin: '7px 0' }}>ציון מקצועי: {r[1]}/5</div><div>{r[3]}</div></div>)}
          </section>
        </div>
      )}

      {activeTab === "timeline" && (
        <section className="card">
          <h2 className="section-title">ציר זמן</h2>
          <div className="timeline">
            {[['02.09.2026','מועמד יובא למערכת','קובץ Excel'],['03.09.2026','שאלון הושלם','הטופס המקוון נשלח ונקלט'],['05.09.2026','שובץ לראיונות','נוצר לוח ללא התנגשויות'],['08.09.2026','ראיון ביחידה 8200 בוצע','חוות דעת התקבלה'],['09.09.2026','ראיון מפא״ת','מתוכנן ל-10:30']].map(([date,title,desc]) => <div className="timeline-item" key={`${date}-${title}`}><div className="timeline-dot"/><div><b>{title}</b><div className="stat-label">{date} · {desc}</div></div></div>)}
          </div>
        </section>
      )}
    </AppShell>
  );
}
