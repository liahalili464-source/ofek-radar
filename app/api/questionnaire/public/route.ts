import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type Candidate = {
  id: string;
  national_id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
};

type Cycle = {
  id: string;
  name: string;
  starts_on: string | null;
};

type Question = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  position: number;
  maps_to_candidate_field: string | null;
};

function normalizeNationalId(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

async function resolveCandidate(nationalId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id,national_id,full_name,phone,city")
    .eq("national_id", nationalId)
    .maybeSingle();

  if (candidateError) throw candidateError;
  if (!candidate) return { error: "CANDIDATE_NOT_FOUND" as const };

  const { data: activeCycles, error: cyclesError } = await supabase
    .from("cycles")
    .select("id,name,starts_on")
    .eq("status", "active")
    .order("starts_on", { ascending: false });

  if (cyclesError) throw cyclesError;
  if (!activeCycles?.length) return { error: "NO_ACTIVE_CYCLE" as const };

  const cycleIds = activeCycles.map((cycle) => cycle.id);
  const { data: memberships, error: membershipsError } = await supabase
    .from("cycle_candidates")
    .select("cycle_id,status")
    .eq("candidate_id", candidate.id)
    .in("cycle_id", cycleIds);

  if (membershipsError) throw membershipsError;
  const membershipByCycle = new Map((memberships || []).map((m) => [m.cycle_id, m]));
  const cycle = activeCycles.find((item) => membershipByCycle.has(item.id)) as Cycle | undefined;
  if (!cycle) return { error: "CANDIDATE_NOT_IN_ACTIVE_CYCLE" as const };

  const membership = membershipByCycle.get(cycle.id)!;
  const { data: questionnaire, error: questionnaireError } = await supabase
    .from("questionnaires")
    .select("id,title,active_version")
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (questionnaireError) throw questionnaireError;
  if (!questionnaire) return { error: "QUESTIONNAIRE_NOT_FOUND" as const };

  const { data: questions, error: questionsError } = await supabase
    .from("questionnaire_questions")
    .select("id,field_key,label,field_type,required,options,position,maps_to_candidate_field")
    .eq("questionnaire_id", questionnaire.id)
    .eq("version", questionnaire.active_version)
    .order("position", { ascending: true });

  if (questionsError) throw questionsError;

  return {
    supabase,
    candidate: candidate as Candidate,
    cycle,
    membership,
    questionnaire,
    questions: (questions || []) as Question[],
  };
}

function responseForError(code: string) {
  const status = code === "CANDIDATE_NOT_FOUND" || code === "CANDIDATE_NOT_IN_ACTIVE_CYCLE" ? 404 : 400;
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nationalId = normalizeNationalId(body.nationalId);
    if (nationalId.length < 5) return responseForError("INVALID_NATIONAL_ID");

    const resolved = await resolveCandidate(nationalId);
    if ("error" in resolved) return responseForError(resolved.error);

    const { supabase, candidate, cycle, membership, questionnaire, questions } = resolved;

    if (body.action === "load") {
      const { data: existingResponse, error: responseError } = await supabase
        .from("questionnaire_responses")
        .select("answers,submitted_at")
        .eq("questionnaire_id", questionnaire.id)
        .eq("candidate_id", candidate.id)
        .eq("cycle_id", cycle.id)
        .maybeSingle();
      if (responseError) throw responseError;

      const prefill: Record<string, unknown> = { ...(existingResponse?.answers || {}) };
      const candidateValues: Record<string, unknown> = {
        full_name: candidate.full_name,
        national_id: candidate.national_id,
        phone: candidate.phone,
        city: candidate.city,
      };

      for (const question of questions) {
        const mappedField = question.maps_to_candidate_field;
        if (mappedField && (prefill[question.field_key] === undefined || prefill[question.field_key] === "")) {
          prefill[question.field_key] = candidateValues[mappedField] ?? "";
        }
      }

      return NextResponse.json({
        title: questionnaire.title,
        cycleName: cycle.name,
        candidateName: candidate.full_name,
        questions,
        prefill,
        previouslySubmitted: Boolean(existingResponse),
      });
    }

    if (body.action !== "submit") return responseForError("INVALID_ACTION");

    const rawAnswers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, unknown>
      : {};
    const allowedKeys = new Set(questions.map((question) => question.field_key));
    const answers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawAnswers)) {
      if (allowedKeys.has(key)) answers[key] = value;
    }

    const candidateUpdates: Record<string, string> = {};
    for (const question of questions) {
      const mappedField = question.maps_to_candidate_field;
      if (!mappedField) continue;

      if (mappedField === "national_id") {
        answers[question.field_key] = candidate.national_id;
        continue;
      }

      if (["full_name", "phone", "city"].includes(mappedField)) {
        const value = answers[question.field_key];
        if (typeof value === "string" && value.trim()) candidateUpdates[mappedField] = value.trim();
      }
    }

    const { error: saveError } = await supabase.from("questionnaire_responses").upsert({
      questionnaire_id: questionnaire.id,
      candidate_id: candidate.id,
      cycle_id: cycle.id,
      version: questionnaire.active_version,
      answers,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "questionnaire_id,candidate_id,cycle_id" });
    if (saveError) throw saveError;

    if (Object.keys(candidateUpdates).length) {
      const { error: candidateUpdateError } = await supabase
        .from("candidates")
        .update({ ...candidateUpdates, updated_at: new Date().toISOString() })
        .eq("id", candidate.id);
      if (candidateUpdateError) throw candidateUpdateError;
    }

    if (membership.status === "new") {
      const { error: membershipError } = await supabase
        .from("cycle_candidates")
        .update({ status: "questionnaire_completed" })
        .eq("cycle_id", cycle.id)
        .eq("candidate_id", candidate.id);
      if (membershipError) throw membershipError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("public questionnaire error", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
