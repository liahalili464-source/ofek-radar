"use client";

import * as XLSX from "xlsx";
import { ClipboardCopy, Download, Search, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type Cycle = { id: string; name: string; status: string; starts_on: string | null };
type Unit = { id: string; name: string };
type CandidateJoin = {
  candidate_id: string;
  status: string;
  target_unit_id: string | null;
  candidates: { id: string; full_name: string; phone: string | null; city: string | null } | { id: string; full_name: string; phone: string | null; city: string | null }[] | null;
};
type UnitJoin = { unit_id: string; units: Unit | Unit[] | null };
type Interview = { id: string; candidate_id: string; unit_id: string; status: string };
type Evaluation = { interview_id: string; professional_score: number | null; personal_score: number | null; recommendation: string | null };
type ResponseRow = { candidate_id: string; answers: unknown };
type Priority = { starred: boolean; unitId?: string | null; note?: string };
type AdminConfig = { allocations?: Record<string, number>; priorities?: Record<string, Priority> };
type CandidateView = {
  id: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  status: string;
  targetUnitId: string | null;
  preferences: string[];
  averageScore: number | null;
  unitScores: Record<string, number>;
  completedInterviews: number;
  totalInterviews: number;
  ready: boolean;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractRankings(value: unknown) {
  if (!isObject(value)) return [] as string[];
  const raw = isObject(value.__unit_preferences) ? value.__unit_preferences : null;
  if (!raw || !Array.isArray(raw.rankings)) return [] as string[];
  return raw.rankings
    .flatMap((item) => {
      if (!isObject(item)) return [];
      const unitId = typeof item.unitId === "string" ? item.unitId : "";
      const rank = Number(item.rank);
      return unitId && Number.isFinite(rank) ? [{ unitId, rank }] : [];
    })
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.unitId);
}

function cycleStatusLabel(status: string) {
  if (status === "active") return "פעיל";
  if (status === "draft") return "בתכנון";
  if (status === "completed") return "סגור";
  if (status === "archived") return "ארכיון";
  return status;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "מחזור";
}

export default function PlacementPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [priorities, setPriorities] = useState<Record<string, Priority>>({});
  const [draftPlacement, setDraftPlacement] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [onlyReady, setOnlyReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCycles() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: cycleError } = await supabase.from("cycles").select("id,name,status,starts_on").order("starts_on", { ascending: false });
      if (cycleError) {
        if (!cancelled) { setError(cycleError.message); setLoading(false); }
        return;
      }
      const list = (data || []) as Cycle[];
      if (!cancelled) {
        setCycles(list);
        const preferred = list.find((cycle) => cycle.status === "active") || list.find((cycle) => cycle.status === "draft") || list[0];
        setCycleId(preferred?.id || "");
        if (!preferred) setLoading(false);
      }
    }
    loadCycles();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    async function loadPlacement() {
      setLoading(true);
      setError("");
      setSuccess("");
      const supabase = createSupabaseBrowserClient();
      const [membersRes, unitsRes, responsesRes, interviewsRes, evaluationsRes, configRes] = await Promise.all([
        supabase.from("cycle_candidates").select("candidate_id,status,target_unit_id,candidates(id,full_name,phone,city)").eq("cycle_id", cycleId),
        supabase.from("cycle_units").select("unit_id,units(id,name)").eq("cycle_id", cycleId),
        supabase.from("questionnaire_responses").select("candidate_id,answers").eq("cycle_id", cycleId),
        supabase.from("interviews").select("id,candidate_id,unit_id,status").eq("cycle_id", cycleId),
        supabase.from("evaluations").select("interview_id,professional_score,personal_score,recommendation"),
        fetch(`/api/admin/cycle-config?cycleId=${encodeURIComponent(cycleId)}`, { cache: "no-store" }),
      ]);

      const firstError = membersRes.error || unitsRes.error || responsesRes.error || interviewsRes.error || evaluationsRes.error;
      if (firstError) {
        if (!cancelled) { setError(firstError.message); setCandidates([]); setUnits([]); setLoading(false); }
        return;
      }

      const unitRows = ((unitsRes.data || []) as unknown as UnitJoin[]).flatMap((row) => {
        const unit = one(row.units);
        return unit ? [unit] : [];
      });
      const interviews = (interviewsRes.data || []) as Interview[];
      const evaluations = (evaluationsRes.data || []) as Evaluation[];
      const evalByInterview = new Map(evaluations.map((evaluation) => [evaluation.interview_id, evaluation]));
      const responseByCandidate = new Map(((responsesRes.data || []) as ResponseRow[]).map((response) => [response.candidate_id, response.answers]));

      const normalized = ((membersRes.data || []) as unknown as CandidateJoin[]).flatMap((member) => {
        const candidate = one(member.candidates);
        if (!candidate) return [];
        const candidateInterviews = interviews.filter((interview) => interview.candidate_id === candidate.id && interview.status !== "cancelled");
        const completed = candidateInterviews.filter((interview) => interview.status === "completed");
        const scoreValues: number[] = [];
        const scoresByUnit = new Map<string, number[]>();

        for (const interview of completed) {
          const evaluation = evalByInterview.get(interview.id);
          if (!evaluation) continue;
          const parts = [evaluation.professional_score, evaluation.personal_score].filter((score): score is number => typeof score === "number");
          if (!parts.length) continue;
          const score = parts.reduce((sum, item) => sum + item, 0) / parts.length;
          scoreValues.push(score);
          scoresByUnit.set(interview.unit_id, [...(scoresByUnit.get(interview.unit_id) || []), score]);
        }

        const unitScores: Record<string, number> = {};
        for (const [unitId, scores] of scoresByUnit.entries()) unitScores[unitId] = scores.reduce((sum, item) => sum + item, 0) / scores.length;
        const averageScore = scoreValues.length ? scoreValues.reduce((sum, item) => sum + item, 0) / scoreValues.length : null;

        return [{
          id: candidate.id,
          fullName: candidate.full_name,
          phone: candidate.phone,
          city: candidate.city,
          status: member.status,
          targetUnitId: member.target_unit_id,
          preferences: extractRankings(responseByCandidate.get(candidate.id)),
          averageScore,
          unitScores,
          completedInterviews: completed.length,
          totalInterviews: candidateInterviews.length,
          ready: candidateInterviews.length > 0 && completed.length === candidateInterviews.length,
        } satisfies CandidateView];
      });

      const config = configRes.ok ? await configRes.json() as AdminConfig : {};
      if (!cancelled) {
        setUnits(unitRows);
        setCandidates(normalized);
        setAllocations(config.allocations || {});
        setPriorities(config.priorities || {});
        setDraftPlacement(Object.fromEntries(normalized.map((candidate) => [candidate.id, candidate.targetUnitId || ""])));
        setLoading(false);
      }
    }
    loadPlacement();
    return () => { cancelled = true; };
  }, [cycleId]);

  const unitNameById = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);
  const assignedCountByUnit = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const unit of units) counts[unit.id] = 0;
    for (const candidate of candidates) if (candidate.targetUnitId) counts[candidate.targetUnitId] = (counts[candidate.targetUnitId] || 0) + 1;
    return counts;
  }, [units, candidates]);

  function hasDefinedAllocation(unitId: string) {
    return Object.prototype.hasOwnProperty.call(allocations, unitId);
  }

  function hasCapacity(unitId: string, candidateId?: string) {
    if (!hasDefinedAllocation(unitId)) return true;
    const allocation = allocations[unitId] || 0;
    const assigned = assignedCountByUnit[unitId] || 0;
    const alreadyThere = candidates.find((candidate) => candidate.id === candidateId)?.targetUnitId === unitId;
    return alreadyThere || assigned < allocation;
  }

  function suggestedUnit(candidate: CandidateView) {
    const priority = priorities[candidate.id];
    if (priority?.starred && priority.unitId && unitNameById.has(priority.unitId) && hasCapacity(priority.unitId, candidate.id)) return priority.unitId;
    const preferred = candidate.preferences.find((unitId) => unitNameById.has(unitId) && hasCapacity(unitId, candidate.id));
    if (preferred) return preferred;
    const bestScored = Object.entries(candidate.unitScores)
      .filter(([unitId]) => unitNameById.has(unitId) && hasCapacity(unitId, candidate.id))
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (bestScored) return bestScored;
    return units.find((unit) => hasCapacity(unit.id, candidate.id))?.id || units[0]?.id || "";
  }

  async function savePlacement(candidate: CandidateView) {
    const selectedUnitId = draftPlacement[candidate.id] || "";
    if (selectedUnitId && hasDefinedAllocation(selectedUnitId) && !hasCapacity(selectedUnitId, candidate.id)) {
      const unitName = unitNameById.get(selectedUnitId) || "היחידה";
      if (!window.confirm(`ההקצאה של ${unitName} כבר מלאה. לשבץ בכל זאת?`)) return;
    }

    setSavingId(candidate.id);
    setError("");
    setSuccess("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("cycle_candidates")
        .update({ target_unit_id: selectedUnitId || null })
        .eq("cycle_id", cycleId)
        .eq("candidate_id", candidate.id);
      if (updateError) throw updateError;
      setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, targetUnitId: selectedUnitId || null } : item));
      setSuccess(selectedUnitId ? `${candidate.fullName} שובץ/ה ל${unitNameById.get(selectedUnitId) || "יחידה"}.` : `השיבוץ של ${candidate.fullName} נוקה.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת השיבוץ נכשלה");
    } finally {
      setSavingId(null);
    }
  }

  function acceptSuggestion(candidate: CandidateView) {
    const suggestion = suggestedUnit(candidate);
    if (!suggestion) return;
    setDraftPlacement((current) => ({ ...current, [candidate.id]: suggestion }));
  }

  function exportExcel() {
    const cycle = cycles.find((item) => item.id === cycleId);
    const rows = candidates.map((candidate) => ({
      "שם מלא": candidate.fullName,
      "טלפון": candidate.phone || "",
      "עיר": candidate.city || "",
      "שיבוץ סופי": candidate.targetUnitId ? unitNameById.get(candidate.targetUnitId) || "" : "טרם שובץ",
      "עדיפות 1": candidate.preferences[0] ? unitNameById.get(candidate.preferences[0]) || "" : "",
      "עדיפות 2": candidate.preferences[1] ? unitNameById.get(candidate.preferences[1]) || "" : "",
      "עדיפות 3": candidate.preferences[2] ? unitNameById.get(candidate.preferences[2]) || "" : "",
      "ממוצע ראיונות": candidate.averageScore == null ? "" : Number(candidate.averageScore.toFixed(2)),
      "העדפה ניהולית": priorities[candidate.id]?.unitId ? unitNameById.get(priorities[candidate.id].unitId || "") || "" : "",
      "הערת מנהל": priorities[candidate.id]?.note || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "שיבוצים");
    XLSX.writeFile(workbook, `שיבוצים - ${safeFileName(cycle?.name || "מחזור")}.xlsx`);
  }

  async function copyDistributionList() {
    const sections = units.map((unit) => {
      const assigned = candidates.filter((candidate) => candidate.targetUnitId === unit.id);
      return `${unit.name}\n${assigned.length ? assigned.map((candidate) => `• ${candidate.fullName}${candidate.phone ? ` — ${candidate.phone}` : ""}`).join("\n") : "אין משובצים"}`;
    });
    await navigator.clipboard.writeText(sections.join("\n\n"));
    setSuccess("רשימת ההפצה הועתקה ללוח.");
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...candidates]
      .filter((candidate) => !query || [candidate.fullName, candidate.phone || "", candidate.city || ""].some((value) => value.toLowerCase().includes(query)))
      .filter((candidate) => !onlyUnassigned || !candidate.targetUnitId)
      .filter((candidate) => !onlyReady || candidate.ready)
      .sort((a, b) => Number(Boolean(b.targetUnitId)) - Number(Boolean(a.targetUnitId)) || Number(Boolean(priorities[b.id]?.starred)) - Number(Boolean(priorities[a.id]?.starred)) || a.fullName.localeCompare(b.fullName, "he"));
  }, [candidates, search, onlyUnassigned, onlyReady, priorities]);

  const totalAllocations = units.reduce((sum, unit) => sum + (hasDefinedAllocation(unit.id) ? allocations[unit.id] || 0 : 0), 0);
  const assigned = candidates.filter((candidate) => candidate.targetUnitId).length;
  const unassigned = candidates.length - assigned;
  const freeAllocations = Math.max(0, totalAllocations - assigned);
  const currentCycle = cycles.find((cycle) => cycle.id === cycleId);
  const suggestions = candidates.filter((candidate) => !candidate.targetUnitId && suggestedUnit(candidate)).slice(0, 3);

  return (
    <AppShell
      title="שיבוץ ליחידות"
      subtitle="שיבוץ סופי של מועמדים ליחידות לפי חוות דעת, העדפות והקצאות"
      actions={<>
        <button className="btn" onClick={copyDistributionList} disabled={!candidates.length}><ClipboardCopy size={16} /> העתקת רשימת הפצה</button>
        <button className="btn btn-primary" onClick={exportExcel} disabled={!candidates.length}><Download size={16} /> ייצוא לאקסל</button>
      </>}
    >
      {error && <div className="notice danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="notice success" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="card stat-card"><div className="stat-label">מועמדים במחזור</div><div className="stat-value">{candidates.length}</div></div>
        <div className="card stat-card"><div className="stat-label">יחידות משתתפות</div><div className="stat-value">{units.length}</div></div>
        <div className="card stat-card"><div className="stat-label">שובצו</div><div className="stat-value accent">{assigned}</div></div>
        <div className="card stat-card"><div className="stat-label">ממתינים לשיבוץ</div><div className="stat-value">{unassigned}</div><div className="stat-hint">{totalAllocations ? `${freeAllocations} הקצאות פנויות לפי ההגדרה הנוכחית` : "ניתן לשבץ ידנית גם ללא הקצאות מוגדרות"}</div></div>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row wrap" style={{ alignItems: "end" }}>
          <div className="field" style={{ margin: 0, minWidth: 260 }}>
            <label>מחזור</label>
            <select className="select" value={cycleId} onChange={(e) => { setCycleId(e.target.value); setSearch(""); setOnlyReady(false); setOnlyUnassigned(false); }}>
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} · {cycleStatusLabel(cycle.status)}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 250 }}>
            <label>חיפוש</label>
            <div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", right: 13, top: 13, color: "var(--muted)" }} /><input className="input" style={{ paddingRight: 38 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="שם, טלפון או עיר" /></div>
          </div>
          <label className="checkbox-row" style={{ minHeight: 42 }}><input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} /> רק לא משובצים</label>
          <label className="checkbox-row" style={{ minHeight: 42 }}><input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> רק מי שסיימו ראיונות</label>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(330px,.75fr)", gap: 18, alignItems: "start", minWidth: 0 }}>
        <section className="card flush" style={{ minWidth: 0 }}>
          <div className="row between wrap" style={{ padding: "20px 20px 10px" }}>
            <div><h2 className="section-title" style={{ marginBottom: 3 }}>מועמדים לשיבוץ</h2><div className="stat-label">{loading ? "טוען..." : `${filtered.length} מועמדים מוצגים`}</div></div>
            {currentCycle && <span className="badge">{currentCycle.name}</span>}
          </div>
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 1120 }}>
              <thead><tr><th>מועמד/ת</th><th>ראיונות</th><th>דירוג יחידות</th><th>ממוצע</th><th>העדפה ניהולית</th><th>הצעה</th><th>שיבוץ סופי</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8}>טוען...</td></tr>}
                {!loading && filtered.map((candidate) => {
                  const priority = priorities[candidate.id];
                  const suggestion = suggestedUnit(candidate);
                  const placementChanged = (draftPlacement[candidate.id] || "") !== (candidate.targetUnitId || "");
                  return <tr key={candidate.id}>
                    <td><div className="row" style={{ gap: 7 }}>{priority?.starred && <Star size={15} fill="currentColor" style={{ color: "var(--warning)", flex: "0 0 auto" }} />}<div><b>{candidate.fullName}</b><div className="stat-label" dir="ltr" style={{ textAlign: "right" }}>{candidate.phone || candidate.city || ""}</div></div></div></td>
                    <td><span className={`badge ${candidate.ready ? "ok" : ""}`}>{candidate.completedInterviews}/{candidate.totalInterviews || "—"}</span></td>
                    <td>{candidate.preferences.length ? <div className="row wrap" style={{ gap: 5 }}>{candidate.preferences.slice(0, 3).map((unitId, index) => <span className="badge" key={`${unitId}-${index}`}>{index + 1}. {unitNameById.get(unitId) || "יחידה"}</span>)}</div> : <span className="stat-label">טרם מולא</span>}</td>
                    <td>{candidate.averageScore == null ? <span className="stat-label">—</span> : <b>{candidate.averageScore.toFixed(1)}</b>}</td>
                    <td>{priority?.starred ? <div><b>{priority.unitId ? unitNameById.get(priority.unitId) || "העדפה ניהולית" : "מסומן בעדיפות"}</b>{priority.note && <div className="stat-label" style={{ maxWidth: 180 }}>{priority.note}</div>}</div> : <span className="stat-label">—</span>}</td>
                    <td>{suggestion ? <button className="btn btn-small" type="button" onClick={() => acceptSuggestion(candidate)}><Sparkles size={14} /> {unitNameById.get(suggestion)}</button> : <span className="stat-label">—</span>}</td>
                    <td><select className="select" style={{ minWidth: 150 }} value={draftPlacement[candidate.id] || ""} onChange={(e) => setDraftPlacement((current) => ({ ...current, [candidate.id]: e.target.value }))}><option value="">טרם שובץ</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></td>
                    <td><button className="btn btn-small btn-primary" disabled={!placementChanged || savingId === candidate.id} onClick={() => savePlacement(candidate)}>{savingId === candidate.id ? "שומר..." : "שמור"}</button></td>
                  </tr>;
                })}
                {!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="empty">אין מועמדים שמתאימים לסינון.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <section className="card">
            <div className="row between" style={{ marginBottom: 14 }}><h2 className="section-title" style={{ margin: 0 }}>יחידות והקצאות</h2><span className="badge">{units.length} יחידות</span></div>
            <div style={{ display: "grid", gap: 10 }}>
              {units.map((unit) => {
                const assignedToUnit = candidates.filter((candidate) => candidate.targetUnitId === unit.id);
                const defined = hasDefinedAllocation(unit.id);
                const allocation = allocations[unit.id] || 0;
                const remaining = defined ? allocation - assignedToUnit.length : null;
                return <div className="notice" key={unit.id} style={{ padding: 13 }}>
                  <div className="row between"><b>{unit.name}</b>{defined ? <span className={`badge ${remaining != null && remaining < 0 ? "danger" : remaining === 0 ? "warn" : "ok"}`}>{remaining != null && remaining < 0 ? `${Math.abs(remaining)} מעל ההקצאה` : `${remaining} נותרו`}</span> : <span className="badge">ללא הקצאה</span>}</div>
                  <div className="row" style={{ marginTop: 8, gap: 18 }}><span className="stat-label">שובצו <b style={{ color: "var(--text)" }}>{assignedToUnit.length}</b></span><span className="stat-label">הקצאות <b style={{ color: "var(--text)" }}>{defined ? allocation : "—"}</b></span></div>
                  {assignedToUnit.length > 0 && <div className="stat-label" style={{ marginTop: 8 }}>{assignedToUnit.slice(0, 4).map((candidate) => candidate.fullName).join(" · ")}{assignedToUnit.length > 4 ? ` · ועוד ${assignedToUnit.length - 4}` : ""}</div>}
                </div>;
              })}
              {!units.length && !loading && <div className="empty">לא הוגדרו יחידות למחזור.</div>}
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ marginBottom: 14 }}><Sparkles size={18} className="accent" /><h2 className="section-title" style={{ margin: 0 }}>הצעות לשיבוץ</h2></div>
            <div className="stat-label" style={{ marginBottom: 12 }}>הצעה בלבד. השיבוץ לא נשמר עד ללחיצה על „שמור” בטבלה.</div>
            <div style={{ display: "grid", gap: 8 }}>
              {suggestions.map((candidate) => {
                const unitId = suggestedUnit(candidate);
                return <div className="notice" key={candidate.id}><div className="row between wrap"><div><b>{candidate.fullName}</b><div className="stat-label">{unitNameById.get(unitId) || "יחידה"}</div></div><button className="btn btn-small" onClick={() => acceptSuggestion(candidate)}>בחר הצעה</button></div></div>;
              })}
              {!suggestions.length && <div className="empty">אין כרגע הצעות פתוחות.</div>}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
