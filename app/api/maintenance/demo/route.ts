import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

const DEMO_CYCLE_NAME = "מחזור בדיקה – ספטמבר 2026";
const demoNotes = [
  "הציג/ה חשיבה מסודרת, סקרנות מקצועית ויכולת למידה טובה.",
  "תקשורת בין־אישית מצוינת. כדאי להעמיק מעט יותר בצד המקצועי.",
  "בלט/ה לטובה בפתרון בעיות וביכולת להסביר תהליך חשיבה.",
  "ראיון חיובי. התאמה טובה לאופי העשייה ביחידה.",
  "מועמד/ת רציני/ת ומוטיבציוני/ת, עם פוטנציאל התפתחות גבוה.",
];
const cities = ["תל אביב", "רמת גן", "פתח תקווה", "ראשון לציון", "חולון", "הרצליה", "כפר סבא", "גבעתיים"];

async function maintenanceContext() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: profile } = await session.from("profiles").select("username,role,active").eq("id", user.id).single();
  if (!profile?.active || profile.role !== "admin" || profile.username?.trim().toLowerCase() !== "lia") return null;
  return createSupabaseAdminClient();
}

async function getDemo(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: cycle } = await admin.from("cycles").select("id,name").eq("name", DEMO_CYCLE_NAME).maybeSingle();
  if (!cycle) throw new Error("DEMO_NOT_FOUND");
  const { data: candidates } = await admin.from("cycle_candidates").select("candidate_id,candidates(id,full_name,phone,city,source_data)").eq("cycle_id", cycle.id);
  const { data: units } = await admin.from("cycle_units").select("unit_id,interviewer_id,units(id,name)").eq("cycle_id", cycle.id);
  const { data: questionnaire } = await admin.from("questionnaires").select("id,active_version").eq("cycle_id", cycle.id).maybeSingle();
  return { cycle, candidates: candidates || [], units: units || [], questionnaire };
}

export async function GET() {
  try {
    const admin = await maintenanceContext();
    if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const { cycle, candidates, units, questionnaire } = await getDemo(admin);
    const [{ count: interviews }, { count: completed }, { count: evaluations }, { data: responses }] = await Promise.all([
      admin.from("interviews").select("id", { count: "exact", head: true }).eq("cycle_id", cycle.id),
      admin.from("interviews").select("id", { count: "exact", head: true }).eq("cycle_id", cycle.id).eq("status", "completed"),
      admin.from("evaluations").select("id,interviews!inner(cycle_id)", { count: "exact", head: true }).eq("interviews.cycle_id", cycle.id),
      questionnaire ? admin.from("questionnaire_responses").select("answers").eq("cycle_id", cycle.id).eq("questionnaire_id", questionnaire.id) : Promise.resolve({ data: [] }),
    ]);
    const responseRows = (responses || []) as { answers?: Record<string, unknown> }[];
    const ranked = responseRows.filter((r) => r.answers && typeof r.answers === "object" && "__unit_preferences" in r.answers).length;
    const surveys = responseRows.filter((r) => r.answers && typeof r.answers === "object" && "__satisfaction" in r.answers).length;
    return NextResponse.json({ cycle, candidates: candidates.length, units: units.length, interviews: interviews || 0, completed: completed || 0, evaluations: evaluations || 0, questionnaires: responseRows.length, ranked, surveys });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await maintenanceContext();
    if (!admin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const { stage } = await request.json();
    const { cycle, candidates, units, questionnaire } = await getDemo(admin);
    const candidateRows = candidates.map((row: any) => row.candidates).filter(Boolean);
    const unitRows = units.filter((row: any) => row.interviewer_id && row.units);
    if (!questionnaire) throw new Error("QUESTIONNAIRE_NOT_FOUND");

    if (stage === "reset") {
      const { data: demoInterviews } = await admin.from("interviews").select("id").eq("cycle_id", cycle.id);
      const ids = (demoInterviews || []).map((x) => x.id);
      if (ids.length) await admin.from("evaluations").delete().in("interview_id", ids);
      await admin.from("interviews").delete().eq("cycle_id", cycle.id);
      await admin.from("questionnaire_responses").delete().eq("cycle_id", cycle.id);
      await admin.from("cycle_candidates").update({ status: "new", target_unit_id: null }).eq("cycle_id", cycle.id);
      return NextResponse.json({ ok: true });
    }

    // Stage 1: realistic candidate cards + questionnaire answers + harmless demo portraits.
    for (let i = 0; i < candidateRows.length; i++) {
      const c = candidateRows[i];
      const source = { ...(c.source_data || {}), demo: true, "מוסד לימודים": ["אוניברסיטת תל אביב", "הטכניון", "אוניברסיטת בן גוריון", "אוניברסיטת בר אילן"][i % 4], "ממוצע תואר": 82 + (i % 12), "3 תכונות חזקות": ["למידה מהירה", "עבודת צוות", "חשיבה אנליטית"], "3 תכונות חלשות": ["פרפקציוניזם", "קושי להאציל", "חוסר סבלנות לפרטים חוזרים"] };
      await admin.from("candidates").update({ city: c.city || cities[i % cities.length], photo_url: `https://api.dicebear.com/9.x/notionists/png?seed=ofek-${i + 1}&size=256`, source_data: source }).eq("id", c.id);
      await admin.from("questionnaire_responses").upsert({ questionnaire_id: questionnaire.id, candidate_id: c.id, cycle_id: cycle.id, version: questionnaire.active_version, answers: { full_name: c.full_name, phone: c.phone, city: c.city || cities[i % cities.length], motivation: "מעניין אותי להשתלב בעשייה טכנולוגית משמעותית, ללמוד ולהתפתח מקצועית." }, submitted_at: new Date().toISOString() }, { onConflict: "questionnaire_id,candidate_id,cycle_id" });
      await admin.from("cycle_candidates").update({ status: "questionnaire_completed" }).eq("cycle_id", cycle.id).eq("candidate_id", c.id);
    }
    if (stage === "questionnaires") return NextResponse.json({ ok: true });

    // Stage 2: build/complete every candidate x unit interview and add realistic unit evaluations.
    const { data: oldInterviews } = await admin.from("interviews").select("id").eq("cycle_id", cycle.id);
    const oldIds = (oldInterviews || []).map((x) => x.id);
    if (oldIds.length) await admin.from("evaluations").delete().in("interview_id", oldIds);
    await admin.from("interviews").delete().eq("cycle_id", cycle.id);
    const interviewPayload: any[] = [];
    const base = new Date("2026-09-09T06:00:00.000Z");
    candidateRows.forEach((c: any, ci: number) => unitRows.forEach((u: any, ui: number) => {
      const start = new Date(base.getTime() + (ci * unitRows.length + ui) * 35 * 60000);
      interviewPayload.push({ cycle_id: cycle.id, candidate_id: c.id, unit_id: u.unit_id, interviewer_id: u.interviewer_id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60000).toISOString(), status: "completed", location: `חדר ${ui + 1}` });
    }));
    const { data: inserted, error: interviewError } = await admin.from("interviews").insert(interviewPayload).select("id,candidate_id,unit_id,interviewer_id");
    if (interviewError) throw interviewError;
    const evalPayload = (inserted || []).map((iv: any, i: number) => ({ interview_id: iv.id, interviewer_id: iv.interviewer_id, professional_score: 3 + (i % 3), personal_score: 3 + ((i + 1) % 3), recommendation: ["yes", "strong_yes", "maybe", "yes"][i % 4], notes: demoNotes[i % demoNotes.length], submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    if (evalPayload.length) { const { error } = await admin.from("evaluations").insert(evalPayload); if (error) throw error; }
    await admin.from("cycle_candidates").update({ status: "interviews_completed" }).eq("cycle_id", cycle.id);
    if (stage === "interviews") return NextResponse.json({ ok: true });

    // Stage 3: each candidate ranks all participating units differently.
    for (let i = 0; i < candidateRows.length; i++) {
      const c = candidateRows[i];
      const { data: response } = await admin.from("questionnaire_responses").select("answers,submitted_at").eq("questionnaire_id", questionnaire.id).eq("candidate_id", c.id).eq("cycle_id", cycle.id).maybeSingle();
      const current = response?.answers && typeof response.answers === "object" ? response.answers : {};
      const rotated = unitRows.map((u: any) => u.unit_id).slice(i % unitRows.length).concat(unitRows.map((u: any) => u.unit_id).slice(0, i % unitRows.length));
      await admin.from("questionnaire_responses").upsert({ questionnaire_id: questionnaire.id, candidate_id: c.id, cycle_id: cycle.id, version: questionnaire.active_version, answers: { ...current, __unit_preferences: { rankings: rotated.map((unitId: string, idx: number) => ({ unitId, rank: idx + 1 })), submittedAt: new Date().toISOString() } }, submitted_at: response?.submitted_at || new Date().toISOString() }, { onConflict: "questionnaire_id,candidate_id,cycle_id" });
    }
    if (stage === "rankings") return NextResponse.json({ ok: true });

    // Stage 4: create a balanced final placement so allocation/export screens have real content.
    for (let i = 0; i < candidateRows.length; i++) {
      await admin.from("cycle_candidates").update({ status: "placed", target_unit_id: unitRows[i % unitRows.length].unit_id }).eq("cycle_id", cycle.id).eq("candidate_id", candidateRows[i].id);
    }
    if (stage === "placements") return NextResponse.json({ ok: true });

    // Stage 5: add varied satisfaction responses for aggregate dashboards.
    for (let i = 0; i < candidateRows.length; i++) {
      const c = candidateRows[i];
      const { data: response } = await admin.from("questionnaire_responses").select("answers,submitted_at").eq("questionnaire_id", questionnaire.id).eq("candidate_id", c.id).eq("cycle_id", cycle.id).maybeSingle();
      const current = response?.answers && typeof response.answers === "object" ? response.answers : {};
      const score = 3 + (i % 3);
      const satisfaction = { intake_experience: score, info_clarity: 4 + (i % 2), interviewer_professionalism: 4 + ((i + 1) % 2), fairness: score, questions_space: 4 + (i % 2), overall_feeling: ["התהליך היה מסודר ונעים.", "היה יום אינטנסיבי אבל קיבלתי תמונה טובה של היחידות.", "הרגשתי שיש עם מי לדבר לאורך התהליך."][i % 3], contact_person: "כן, היה ברור למי ניתן לפנות.", surprise: i % 2 ? "הפתיעה לטובה האווירה בראיונות." : "הופתעתי מכמות המידע שקיבלתי על היחידות.", preserve: "את היחס האישי והמקצועי.", improve: i % 2 ? "להוסיף מעט יותר זמן בין ראיונות." : "לחדד מראש את לוח הזמנים.", additional: i % 3 === 0 ? "תודה לצוות על הליווי." : "" };
      await admin.from("questionnaire_responses").upsert({ questionnaire_id: questionnaire.id, candidate_id: c.id, cycle_id: cycle.id, version: questionnaire.active_version, answers: { ...current, __satisfaction: { answers: satisfaction, submittedAt: new Date().toISOString() } }, submitted_at: response?.submitted_at || new Date().toISOString() }, { onConflict: "questionnaire_id,candidate_id,cycle_id" });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("demo simulator", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "ERROR" }, { status: 500 });
  }
}
