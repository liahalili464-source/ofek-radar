import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server";

const DEMO_CYCLE_NAME = "מחזור בדיקה – ספטמבר 2026";
const DEMO_NATIONAL_ID = "999999999";

const demoQuestions = [
  { field_key: "full_name", label: "שם מלא", field_type: "short_text", required: true, options: [], position: 0, maps_to_candidate_field: "full_name" },
  { field_key: "national_id", label: "תעודת זהות", field_type: "short_text", required: true, options: [], position: 1, maps_to_candidate_field: "national_id" },
  { field_key: "phone", label: "טלפון", field_type: "phone", required: true, options: [], position: 2, maps_to_candidate_field: "phone" },
  { field_key: "city", label: "עיר מגורים", field_type: "short_text", required: false, options: [], position: 3, maps_to_candidate_field: "city" },
  { field_key: "motivation", label: "למה מעניין אותך להשתלב ביחידה?", field_type: "long_text", required: true, options: [], position: 4, maps_to_candidate_field: null },
];

type ProfileUnitJoin = {
  id: string;
  unit_id: string | null;
  units: { id: string; name: string; active: boolean } | { id: string; name: string; active: boolean }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function interviewIso(index: number, end = false) {
  const totalMinutes = 9 * 60 + index * 30 + (end ? 30 : 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(`2026-09-09T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+03:00`).toISOString();
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

export async function POST() {
  try {
    const { user } = await requireAdmin();
    const admin = createSupabaseAdminClient();

    await cleanupExistingDemo();

    const { data: candidate, error: candidateError } = await admin
      .from("candidates")
      .upsert({
        national_id: DEMO_NATIONAL_ID,
        full_name: "מועמדת בדיקה",
        phone: "0500000000",
        city: "תל אביב",
        source_data: {
          "שם מלא": "מועמדת בדיקה",
          "תעודת זהות": DEMO_NATIONAL_ID,
          "טלפון": "0500000000",
          "עיר": "תל אביב",
          "הערה": "נתוני בדיקה בלבד",
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "national_id" })
      .select("id,national_id,full_name")
      .single();
    if (candidateError || !candidate) throw candidateError || new Error("CANDIDATE_CREATE_FAILED");

    const { data: cycle, error: cycleError } = await admin
      .from("cycles")
      .insert({
        name: DEMO_CYCLE_NAME,
        recruitment_year: 2026,
        starts_on: "2026-09-08",
        ends_on: "2026-09-12",
        status: "active",
        interview_duration_minutes: 30,
        created_by: user.id,
      })
      .select("id,name")
      .single();
    if (cycleError || !cycle) throw cycleError || new Error("CYCLE_CREATE_FAILED");

    const { error: membershipError } = await admin
      .from("cycle_candidates")
      .insert({ cycle_id: cycle.id, candidate_id: candidate.id, status: "new" });
    if (membershipError) throw membershipError;

    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("id,unit_id,units(id,name,active)")
      .eq("role", "interviewer")
      .eq("active", true)
      .not("unit_id", "is", null);
    if (profileError) throw profileError;

    const usableAccounts = ((profileRows || []) as unknown as ProfileUnitJoin[]).filter((row) => row.unit_id && one(row.units)?.active);
    if (!usableAccounts.length) throw new Error("NO_UNIT_ACCOUNTS");

    const { error: cycleUnitsError } = await admin
      .from("cycle_units")
      .insert(usableAccounts.map((row) => ({ cycle_id: cycle.id, unit_id: row.unit_id, interviewer_id: row.id })));
    if (cycleUnitsError) throw cycleUnitsError;

    const { error: dayError } = await admin
      .from("interview_days")
      .insert({ cycle_id: cycle.id, interview_date: "2026-09-09", starts_at: "09:00", ends_at: "15:00" });
    if (dayError) throw dayError;

    const { error: interviewsError } = await admin
      .from("interviews")
      .insert(usableAccounts.map((row, index) => ({
        cycle_id: cycle.id,
        candidate_id: candidate.id,
        unit_id: row.unit_id,
        interviewer_id: row.id,
        starts_at: interviewIso(index),
        ends_at: interviewIso(index, true),
        status: "scheduled",
        location: "חדר בדיקה",
      })));
    if (interviewsError) throw interviewsError;

    const { data: questionnaire, error: questionnaireError } = await admin
      .from("questionnaires")
      .insert({ cycle_id: cycle.id, title: "שאלון מועמד", active_version: 1 })
      .select("id")
      .single();
    if (questionnaireError || !questionnaire) throw questionnaireError || new Error("QUESTIONNAIRE_CREATE_FAILED");

    const { error: questionError } = await admin
      .from("questionnaire_questions")
      .insert(demoQuestions.map((question) => ({ questionnaire_id: questionnaire.id, version: 1, ...question })));
    if (questionError) throw questionError;

    return NextResponse.json({
      ok: true,
      cycle: { id: cycle.id, name: cycle.name },
      candidate: { nationalId: candidate.national_id, name: candidate.full_name },
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
    const admin = createSupabaseAdminClient();
    await cleanupExistingDemo();

    const { data: candidate } = await admin.from("candidates").select("id").eq("national_id", DEMO_NATIONAL_ID).maybeSingle();
    if (candidate) {
      const { count } = await admin.from("cycle_candidates").select("cycle_id", { count: "exact", head: true }).eq("candidate_id", candidate.id);
      if ((count || 0) === 0) await admin.from("candidates").delete().eq("id", candidate.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DEMO_DELETE_FAILED";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
