"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, GripVertical, Send, ShieldCheck } from "lucide-react";
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
  const [orderedUnitIds, setOrderedUnitIds] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const orderedUnits = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.units.map((unit) => [unit.id, unit]));
    return orderedUnitIds.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  }, [data, orderedUnitIds]);

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
      const rankedIds = [...next.rankings].sort((a, b) => a.rank - b.rank).map((ranking) => ranking.unitId).filter((id) => next.units.some((unit) => unit.id === id));
      const remaining = next.units.map((unit) => unit.id).filter((id) => !rankedIds.includes(id));
      setOrderedUnitIds([...rankedIds, ...remaining]);
      setStep(1);
    } catch {
      setError("לא נמצא מחזור מתאים למספר הטלפון הזה.");
    } finally {
      setLoading(false);
    }
  }

  function moveUnit(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedUnitIds.length) return;
    setOrderedUnitIds((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setOrderedUnitIds((current) => {
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
    setDraggedId(null);
  }

  async function submit() {
    if (!data || orderedUnitIds.length !== data.units.length) return;
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const rankings = orderedUnitIds.map((unitId, index) => ({ unitId, rank: index + 1 }));
      const response = await fetch("/api/candidate/ranking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", phone, rankings }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "שמירת הדירוג נכשלה");
      setSaved(true);
      setStep(3);
    } catch {
      setError("לא הצלחנו לשמור את הדירוג. אפשר לנסות שוב.");
    } finally {
      setSaving(false);
    }
  }

  const shell: React.CSSProperties = { minHeight: "100vh", background: "radial-gradient(circle at 50% -20%, #123d5b 0, #071b2d 46%, #051625 100%)", padding: "24px 18px 42px", color: "white" };
  const panel: React.CSSProperties = { background: "rgba(16,47,73,.88)", border: "1px solid rgba(57,191,229,.22)", borderRadius: 20, boxShadow: "0 22px 70px rgba(0,0,0,.22)" };

  return (
    <main style={shell} dir="rtl">
      <div style={{ width: "min(1120px,100%)", margin: "0 auto" }}>
        <Image src="/ofek-radar-logo.png" alt="Ofek Radar" width={1619} height={971} unoptimized style={{ width: 205, height: 102, objectFit: "cover", objectPosition: "50% 42%", display: "block", margin: "0 auto 14px" }} />

        {!data && <section style={{ ...panel, width: "min(620px,100%)", margin: "0 auto", padding: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}><h1 style={{ margin: "0 0 8px", fontSize: 31 }}>דירוג יחידות</h1><div className="stat-label">לאחר סיום כל הראיונות תוכלו לדרג את היחידות לפי סדר ההעדפה שלכם.</div></div>
          <form onSubmit={identify}>
            <div className="field"><label>מספר טלפון</label><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" required /></div>
            {error && <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "בודק..." : "המשך"}</button>
          </form>
        </section>}

        {data && <>
          <section style={{ ...panel, padding: "28px clamp(18px,4vw,42px) 22px", marginBottom: 18 }}>
            <div className="row between wrap" style={{ gap: 12, marginBottom: 22 }}>
              <div><h1 style={{ margin: "0 0 5px", fontSize: "clamp(27px,4vw,38px)" }}>דירוג יחידות</h1><div className="stat-label">{data.candidateName} · {data.cycleName}</div></div>
              {data.previewOnly && <span className="badge ok">תצוגת IT · לא נשמר מידע</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", alignItems: "start", maxWidth: 700, margin: "0 auto" }}>
              {[{ n: 1, t: "דירוג יחידות" }, { n: 2, t: "בדיקת הסדר" }, { n: 3, t: "שליחה" }].map((item, index) => {
                const active = step === item.n; const done = step > item.n;
                return <div key={item.n} style={{ textAlign: "center", position: "relative" }}>
                  {index > 0 && <div style={{ position: "absolute", top: 17, right: "-50%", width: "100%", height: 2, background: done || active ? "#20c6e8" : "rgba(255,255,255,.15)" }} />}
                  <div style={{ width: 36, height: 36, borderRadius: 99, margin: "0 auto 7px", display: "grid", placeItems: "center", position: "relative", zIndex: 1, fontWeight: 800, color: active || done ? "#052237" : "#c1d0db", background: active || done ? "#55daf2" : "#284a63", border: "1px solid rgba(255,255,255,.18)" }}>{done ? <Check size={18} /> : item.n}</div>
                  <b style={{ fontSize: 13, color: active || done ? "#5fe1f6" : "#8ba4b6" }}>{item.t}</b>
                </div>;
              })}
            </div>
          </section>

          {!data.ready ? <section style={{ ...panel, padding: 28 }}><div className="notice warning">הדירוג עדיין לא פתוח. {data.pendingInterviews > 0 ? `נותרו ${data.pendingInterviews} ראיונות שטרם הושלמו.` : "יש להשלים את תהליך הראיונות לפני הדירוג."}</div></section> : step === 1 ? <section style={{ ...panel, padding: "24px clamp(14px,3vw,28px)" }}>
            <div style={{ marginBottom: 18 }}><h2 style={{ margin: "0 0 5px", fontSize: 23 }}>דרגו את {data.units.length} היחידות לפי סדר ההעדפה שלכם</h2><div className="stat-label">היחידה במקום 1 היא העדיפות הגבוהה ביותר. גררו את השורות או השתמשו בחצים.</div></div>
            <div style={{ display: "grid", gap: 9 }}>
              {orderedUnits.map((unit, index) => <div key={unit.id} draggable onDragStart={() => setDraggedId(unit.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(unit.id)} style={{ display: "grid", gridTemplateColumns: "42px 58px minmax(0,1fr) auto", gap: 11, alignItems: "center", padding: "11px 13px", borderRadius: 15, border: draggedId === unit.id ? "1px solid #5ee4f7" : "1px solid rgba(129,187,218,.18)", background: index < 3 ? "rgba(255,255,255,.075)" : "rgba(5,27,45,.36)", cursor: "grab" }}>
                <GripVertical size={19} color="#7fa3b8" />
                <div style={{ width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", fontSize: 20, fontWeight: 900, color: "#062033", background: index === 0 ? "#ffe49a" : index === 1 ? "#9ce8fa" : index === 2 ? "#ffd0bb" : "#dce8f0" }}>{index + 1}</div>
                <div><b style={{ fontSize: 18 }}>{unit.name}</b>{index === 0 && <div className="stat-label">העדיפות הראשונה שלך</div>}</div>
                <div className="row" style={{ gap: 6 }}><button className="btn btn-small" type="button" disabled={index === 0} onClick={() => moveUnit(index, -1)} aria-label="העלה"><ArrowUp size={16} /></button><button className="btn btn-small" type="button" disabled={index === orderedUnits.length - 1} onClick={() => moveUnit(index, 1)} aria-label="הורד"><ArrowDown size={16} /></button></div>
              </div>)}
            </div>
            <div className="row between wrap" style={{ marginTop: 22 }}><button className="btn btn-small" onClick={() => { setData(null); setSaved(false); setError(""); }}>שימוש במספר אחר</button><button className="btn btn-primary" style={{ minWidth: 230 }} onClick={() => setStep(2)}>המשך לבדיקת הסדר <ChevronLeft size={17} /></button></div>
          </section> : step === 2 ? <section style={{ ...panel, padding: "28px clamp(18px,4vw,38px)" }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}><ShieldCheck size={38} color="#55daf2" style={{ marginBottom: 8 }} /><h2 style={{ margin: "0 0 6px", fontSize: 27 }}>זה סדר ההעדפות שלך</h2><div className="stat-label">כדאי לעבור עליו פעם נוספת לפני השליחה הסופית.</div></div>
            <div style={{ width: "min(680px,100%)", margin: "0 auto", display: "grid", gap: 8 }}>
              {orderedUnits.map((unit, index) => <div key={unit.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 12, alignItems: "center", padding: "12px 15px", borderRadius: 14, background: "rgba(5,27,45,.42)", border: "1px solid rgba(129,187,218,.16)" }}><div style={{ width: 42, height: 42, borderRadius: 99, display: "grid", placeItems: "center", fontWeight: 900, color: index < 3 ? "#062033" : "white", background: index === 0 ? "#ffe49a" : index === 1 ? "#9ce8fa" : index === 2 ? "#ffd0bb" : "#294c65" }}>{index + 1}</div><b style={{ fontSize: 18 }}>{unit.name}</b></div>)}
            </div>
            {error && <div className="notice danger" style={{ margin: "16px auto 0", maxWidth: 680 }}>{error}</div>}
            <div className="row between wrap" style={{ width: "min(680px,100%)", margin: "22px auto 0" }}><button className="btn" onClick={() => setStep(1)}><ChevronRight size={17} /> חזרה לעריכה</button><button className="btn btn-primary" style={{ minWidth: 230 }} disabled={saving} onClick={submit}>{saving ? "שולח..." : data.previewOnly ? "בדיקת שליחה" : data.previouslySubmitted ? "עדכון ושליחה" : "שליחה סופית"} <Send size={16} /></button></div>
          </section> : <section style={{ ...panel, padding: "46px 24px", textAlign: "center" }}>
            <div style={{ width: 66, height: 66, borderRadius: 99, background: "rgba(74,222,128,.14)", border: "1px solid rgba(74,222,128,.35)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Check size={32} color="#70e59a" /></div>
            <h2 style={{ margin: "0 0 8px", fontSize: 29 }}>{data.previewOnly ? "תצוגת השליחה הושלמה" : "הדירוג נשלח בהצלחה"}</h2>
            <div className="stat-label" style={{ maxWidth: 520, margin: "0 auto 22px" }}>{data.previewOnly ? "זהו מסך התוצאה שהמועמד יראה. במצב IT לא נשמרו נתונים." : "תודה. סדר ההעדפות שלך נשמר ויועבר כחלק מתהליך השיבוץ."}</div>
            <div style={{ width: "min(520px,100%)", margin: "0 auto", display: "grid", gap: 7, textAlign: "right" }}>{orderedUnits.slice(0, 3).map((unit, index) => <div className="notice" key={unit.id}><b>{index + 1}. {unit.name}</b></div>)}</div>
            {data.previouslySubmitted && !data.previewOnly && <button className="btn" style={{ marginTop: 20 }} onClick={() => { setStep(1); setSaved(false); }}>עדכון הדירוג</button>}
            {data.previewOnly && <button className="btn" style={{ marginTop: 20 }} onClick={() => { setStep(1); setSaved(false); }}>חזרה לתצוגת הדירוג</button>}
          </section>}
        </>}
      </div>
    </main>
  );
}
