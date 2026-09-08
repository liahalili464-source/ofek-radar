import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server";

const DEMO_CYCLE_NAME = "מחזור בדיקה – ספטמבר 2026";
const TEST_NATIONAL_ID = "999999999";
const demoNames = ["מועמדת בדיקה", "נועה לוי", "עומר כהן", "מאיה אברהם", "דניאל פרץ", "יובל ביטון", "שחר אלון", "תמר אדרי", "איתי בן דוד", "רוני מלכה", "עידו שקד", "נטע גולן"];
const demoCities = ["תל אביב", "רמת גן", "פתח תקווה", "ראשון לציון", "חולון", "הרצליה", "כפר סבא", "גבעתיים", "רעננה", "רחובות", "מודיעין", "נס ציונה"];

const demoCandidates = demoNames.map((fullName, index) => ({
  nationalId: String(Number(TEST_NATIONAL_ID) - index),
  fullName,
  phone: `050000${String(index).padStart(4, "0")}`,
  city: demoCities[index],
}));

const demoQuestions = [
  { field_key: "full_name", label: "שם מלא", field_type: "short_text", required: true, options: [], position: 0, maps_to_candidate_field: "full_name" },
  { field_key: "phone", label: "טלפון", field_type: "phone", required: true, options: [], position: 1, maps_to_candidate_field: "phone" },
  { field_key: "city", label: "עיר מגורים", field_type: "short_text", required: false, options: [], position: 2, maps_to_candidate_field: "city" },
  { field_key: "motivation", label: "למה מעניין אותך להשתלב ביחידה?", field_type: "long_text", required: true, options: [], position: 3, maps_to_candidate_field: null },
];

type ProfileUnitJoin = {
  id: string;
  unit_id: string | null;
  units: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
};

type CreatedCandidate = { id: string; national_id: string; full_name: string; phone: string | null };

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function interviewIso(round: number, end = false) {
  const day = round < 6 ? "2026-09-09" : "2026-09-10";
  const slot = round % 6;
  const totalMinutes = 9 * 60 + slot * 30 + (end ? 30 : 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(`${day}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+03:00`).toISOString();
}

async function cleanupExistingDemo() {
  const admin = createSupabaseAdminClient();
  const { data: cycles, error } = await admin.from("cycles").select("id").eq("name", DEMO_CYCLE_NAME);
  if (error) throw error;
  for (const cycle of cycles || []) {
    const { error: responseDeleteError } = await admin.from("questionnaire_responses").delete().eq("cycle_id", cycle.id);
    if (responseDeleteError) throw responseDeleteError;
    const { error: cycleDeleteError } = await admin.from("cycles").delete().eq("id", cycle.id);
    if (cycleDeleteError) throw cycleDeleteError;
  }
}

async function cleanupDemoCandidates() {
  const admin = createSupabaseAdminClient();
  for (const demo of demoCandidates) {
    const { data: candidate } = await admin.from("candidates").select("id").eq("national_id", demo.nationalId).maybeSingle();
    if (!candidate) continue;
    const { count } = await admin.from("cycle_candidates").select("cycle_id", { count: "exact", head: true }).eq("candidate_id", candidate.id);
    if ((count || 0) === 0) {
      const { error } = await admin.from("candidates").delete().eq("id", candidate.id);
      if (error) throw error;
    }
  }
}

export async function POST() {
  try {
    const { user } = await requireAdmin();
    const admin = createSupabaseAdminClient();
    await cleanupExistingDemo();
    await cleanupDemoCandidates();

    const now = new Date().toISOString();
    const { data: candidateRows, error: candidateError } = await admin.from("candidates").upsert(
      demoCandidates.map((candidate, index) => ({
        national_id: candidate.nationalId,
        full_name: candidate.fullName,
        phone: candidate.phone,
        city: candidate.city,
        source_data: {
          "שם מלא": candidate.fullName,
          "טלפון": candidate.phone,
          "עיר": candidate.city,
          "מגמת לימוד": index % 2 === 0 ? "מדעי המחשב" : "אלקטרוניקה",
          "ציון מיון": 82 + (index % 8),
          "הערה": "נתוני בדיקה בלבד",
        },
        updated_at: now,
      })),
      { onConflict: "national_id" }
    ).select("id,national_id,full_name,phone");
    if (candidateError || !candidateRows?.length) throw candidateError || new Error("CANDIDATE_CREATE_FAILED");

    const createdCandidates = candidateRows as CreatedCandidate[];
    const candidateByNationalId = new Map(createdCandidates.map((candidate) => [candidate.national_id, candidate]));
    const orderedCandidates = demoCandidates.map((demo) => candidateByNationalId.get(demo.nationalId)).filter(Boolean) as CreatedCandidate[];
    if (orderedCandidates.length !== demoCandidates.length) throw new Error("CANDIDATE_CREATE_FAILED");

    const { data: cycle, error: cycleError } = await admin.from("cycles").insert({
      name: DEMO_CYCLE_NAME,
      recruitment_year: 2026,
      starts_on: "2026-09-08",
      ends_on: "2026-09-12",
      status: "active",
      interview_duration_minutes: 30,
      created_by: user.id,
    }).select("id,name").single();
    if (cycleError || !cycle) throw cycleError || new Error("CYCLE_CREATE_FAILED");

    const { error: membershipError } = await admin.from("cycle_candidates").insert(
      orderedCandidates.map((candidate) => ({ cycle_id: cycle.id, candidate_id: candidate.id, status: "new" }))
    );
    if (membershipError) throw membershipError;

    const { data: profileRows, error: profileError } = await admin.from("profiles")
      .select("id,unit_id,units(id,name,active)")
      .eq("role", "interviewer")
      .eq("active", true)
      .not("unit_id", "is", null);
    if (profileError) throw profileError;

    const usableAccounts = ((profileRows || []) as unknown as ProfileUnitJoin[]).filter((row) => row.unit_id && one(row.units)?.active);
    if (!usableAccounts.length) throw new Error("NO_UNIT_ACCOUNTS");
    if (usableAccounts.length > orderedCandidates.length) throw new Error("TOO_MANY_UNITS_FOR_DEMO");

    const { error: cycleUnitsError } = await admin.from("cycle_units").insert(
      usableAccounts.map((row) => ({ cycle_id: cycle.id, unit_id: row.unit_id, interviewer_id: row.id }))
    );
    if (cycleUnitsError) throw cycleUnitsError;

    const { error: dayError } = await admin.from("interview_days").insert([
      { cycle_id: cycle.id, interview_date: "2026-09-09", starts_at: "09:00", ends_at: "12:00" },
      { cycle_id: cycle.id, interview_date: "2026-09-10", starts_at: "09:00", ends_at: "12:00" },
    ]);
    if (dayError) throw dayError;

    const interviewRows: Array<Record<string, unknown>> = [];
    for (let round = 0; round < orderedCandidates.length; round++) {
      usableAccounts.forEach((account, unitIndex) => {
        const candidate = orderedCandidates[(round + unitIndex) % orderedCandidates.length];
        interviewRows.push({
          cycle_id: cycle.id,
          candidate_id: candidate.id,
          unit_id: account.unit_id,
          interviewer_id: account.id,
          starts_at: interviewIso(round),
          ends_at: interviewIso(round, true),
          status: "scheduled",
          location: `חדר ${unitIndex + 1}`,
        });
      });
    }
    const { error: interviewsError } = await admin.from("interviews").insert(interviewRows);
    if (interviewsError) throw interviewsError;

    const { data: questionnaire, error: questionnaireError } = await admin.from("questionnaires")
      .insert({ cycle_id: cycle.id, title: "שאלון מועמד", active_version: 1 })
      .select("id")
      .single();
    if (questionnaireError || !questionnaire) throw questionnaireError || new Error("QUESTIONNAIRE_CREATE_FAILED");

    const { error: questionError } = await admin.from("questionnaire_questions").insert(
      demoQuestions.map((question) => ({ questionnaire_id: questionnaire.id, version: 1, ...question }))
    );
    if (questionError) throw questionError;

    const testCandidate = orderedCandidates[0];
    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      candidate: { phone: testCandidate.phone, name: testCandidate.full_name },
      candidateCount: orderedCandidates.length,
      interviewCount: interviewRows.length,
      unitCount: usableAccounts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DEMO_CREATE_FAILED";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    await cleanupExistingDemo();
    await cleanupDemoCandidates();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DEMO_DELETE_FAILED";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
