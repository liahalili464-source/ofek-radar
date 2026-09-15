"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

const MASTER_PREVIEW_CODE = "1905";

type Unit = { id: string; name: string };
type Ranking = { unitId: string; rank: number };
type RankingData = {
  candidateName: string;
  cycleName: string;
  ready: boolean;
  pendingInterviews: number;
  units: Unit[];
  rankings: Ranking[];
  previouslySubmitted: boolean;
  previewOnly?: boolean;
};

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

export default function RankPage() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<RankingData | null>(null);
  const [rankByUnit, setRankByUnit] = useState<Record<string, number | "">>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const selectedRanks = useMemo(() => new Set(Object.values(rankByUnit).filter((rank): rank is number => typeof rank === "number")), [rankByUnit]);
  const complete = Boolean(data?.ready && data.units.every((unit) => typeof rankByUnit[unit.id] === "number"));

  async function identify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const normalized = normalizePhone(phone);
    if (normalized !== MASTER_PREVIEW_CODE && normalized.length < 9) { setError("יש להזין מספר טלפון תקין."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/candidate/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load", phone: normalized }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "לא ניתן לזהות את המועמד/ת");
      const next = json as RankingData;
      setData(next);
      setPhone(normalized);
      const initial: Record<string, number | ""> = {};
      next.units.forEach((unit) => { initial[unit.id] = ""; });
      next.rankings.forEach((ranking) => { if (ranking.unitId in initial) initial[ranking.unitId] = ranking.rank; });
      setRankByUnit(initial);
    } catch {
      setError("לא נמצא מחזור מתאים למספר הטלפון הזה.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!data || !complete) return;
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const rankings = data.units.map((unit) => ({ unitId: unit.id, rank: Number(rankByUnit[unit.id]) }));
      const response = await fetch("/api/candidate/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", phone, rankings }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "שמירת הדירוג נכשלה");
      setSaved(true);
    } catch {
      setError("לא הצלחנו לשמור את הדירוג. בדקי שכל יחידה קיבלה עדיפות שונה.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#071b2d", padding: "32px 18px", color: "white" }} dir="rtl">
      <div style={{ width: "min(720px,100%)", margin: "0 auto" }}>
        <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={1619} height={971} unoptimized style={{ width: 220, height: 110, objectFit: "cover", objectPosition: "50% 42%", display: "block", margin: "0 auto 22px" }} />
        <section className="card" style={{ background: "#102f49", color: "white" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>דירוג יחידות</h1>
          <div className="stat-label" style={{ marginBottom: 20 }}>הדירוג נפתח לאחר סיום הראיונות שלך במחזור.</div>

          {!data && <form onSubmit={identify}>
            <div className="field"><label>מספר טלפון</label><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" required /></div>
            {error && <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "בודק..." : "המשך"}</button>
          </form>}

          {data && <>
            {data.previewOnly && <div className="notice" style={{ marginBottom: 16 }}><b>תצוגת IT</b><div className="stat-label">מצב תצוגה בלבד — שום דירוג לא ישויך למועמד או למחזור.</div></div>}
            <div className="notice" style={{ marginBottom: 16 }}><b>{data.candidateName}</b><div className="stat-label">{data.cycleName}</div></div>
            {!data.ready ? <div className="notice warning">הדירוג עדיין לא פתוח. {data.pendingInterviews > 0 ? `נותרו ${data.pendingInterviews} ראיונות שטרם הושלמו.` : "יש להשלים את תהליך הראיונות לפני הדירוג."}</div> : <>
              <div style={{ display: "grid", gap: 10 }}>
                {data.units.map((unit) => <div className="notice" key={unit.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 14, alignItems: "center" }}>
                  <b>{unit.name}</b>
                  <select className="select" value={rankByUnit[unit.id] ?? ""} onChange={(e) => setRankByUnit((current) => ({ ...current, [unit.id]: e.target.value ? Number(e.target.value) : "" }))}>
                    <option value="">בחירת עדיפות</option>
                    {data.units.map((_, index) => { const rank = index + 1; const takenByAnother = selectedRanks.has(rank) && rankByUnit[unit.id] !== rank; return <option key={rank} value={rank} disabled={takenByAnother}>עדיפות {rank}</option>; })}
                  </select>
                </div>)}
              </div>
              {error && <div className="notice danger" style={{ marginTop: 14 }}>{error}</div>}
              {saved && <div className="notice success" style={{ marginTop: 14 }}>✓ {data.previewOnly ? "התצוגה הושלמה — לא נשמרו נתונים." : "הדירוג נשמר בהצלחה."}</div>}
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={!complete || saving} onClick={submit}>{saving ? "שומר..." : data.previewOnly ? "בדיקת שליחה" : data.previouslySubmitted ? "עדכון הדירוג" : "שמירת הדירוג"}</button>
            </>}
            <button className="btn btn-small" style={{ marginTop: 14 }} onClick={() => { setData(null); setSaved(false); setError(""); }}>שימוש במספר אחר</button>
          </>}
        </section>
      </div>
    </main>
  );
}
