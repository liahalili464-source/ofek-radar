import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isLegacyDefaultQuestionnaire, questionnaireTemplate } from "@/lib/questionnaire-template";

type Candidate = {
  id: string;
  national_id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  photo_url: string | null;
  source_data: Record<string, unknown> | null;
};

type Cycle = { id: string; name: string; starts_on: string | null };
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
type Membership = { cycle_id: string; candidate_id: string; status: string };
type ResolveSuccess = {
  ok: true;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  candidate: Candidate;
  cycle: Cycle;
  membership: Membership;
  questionnaire: { id: string; title: string; active_version: number };
  questions: Question[];
};
type ResolveFailure = {
  ok: false;
  error: "CANDIDATE_NOT_FOUND" | "NO_ACTIVE_CYCLE" | "CANDIDATE_NOT_IN_ACTIVE_CYCLE" | "QUESTIONNAIRE_NOT_FOUND" | "AMBIGUOUS_PHONE";
};
type ResolveResult = ResolveSuccess | ResolveFailure;

function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

function effectiveQuestions(rows: Question[]) {
  const filtered = rows.filter((question) => question.field_key !== "national_id" && question.maps_to_candidate_field !== "national_id");
  if (filtered.length && !isLegacyDefaultQuestionnaire(filtered.map((q) => q.field_key))) return filtered;
  return questionnaireTemplate.map((q, index) => ({
    id: q.id,
    field_key: q.fieldKey,
    label: q.label,
    field_type: q.type,
    required: q.required,
    options: q.options || [],
    position: index,
    maps_to_candidate_field: q.mapsToCandidateField || null,
  }));
}

async function resolveCandidate(phone: string): Promise<ResolveResult> {
  const supabase = createSupabaseAdminClient();
  const { data: activeCycleData, error: cyclesError } = await supabase.from("cycles").select("id,name,starts_on").eq("status", "active").order("starts_on", { ascending: false });
  if (cyclesError) throw cyclesError;
  const activeCycles = (activeCycleData || []) as Cycle[];
  if (!activeCycles.length) return { ok: false, error: "NO_ACTIVE_CYCLE" };

  const cycleIds = activeCycles.map((cycle) => cycle.id);
  const { data: membershipData, error: membershipsError } = await supabase.from("cycle_candidates").select("cycle_id,candidate_id,status").in("cycle_id", cycleIds);
  if (membershipsError) throw membershipsError;
  const memberships = (membershipData || []) as Membership[];
  const candidateIds = [...new Set(memberships.map((membership) => membership.candidate_id))];
  if (!candidateIds.length) return { ok: false, error: "CANDIDATE_NOT_IN_ACTIVE_CYCLE" };

  const { data: candidateData, error: candidateError } = await supabase.from("candidates").select("id,national_id,full_name,phone,city,photo_url,source_data").in("id", candidateIds);
  if (candidateError) throw candidateError;
  const matchingCandidates = ((candidateData || []) as Candidate[]).filter((candidate) => normalizePhone(candidate.phone) === phone);
  if (!matchingCandidates.length) return { ok: false, error: "CANDIDATE_NOT_FOUND" };
  if (matchingCandidates.length > 1) return { ok: false, error: "AMBIGUOUS_PHONE" };

  const candidate = matchingCandidates[0];
  const candidateMemberships = memberships.filter((membership) => membership.candidate_id === candidate.id);
  const membershipByCycle = new Map(candidateMemberships.map((membership) => [membership.cycle_id, membership]));
  const cycle = activeCycles.find((item) => membershipByCycle.has(item.id));
  if (!cycle) return { ok: false, error: "CANDIDATE_NOT_IN_ACTIVE_CYCLE" };
  const membership = membershipByCycle.get(cycle.id);
  if (!membership) return { ok: false, error: "CANDIDATE_NOT_IN_ACTIVE_CYCLE" };

  const { data: questionnaireData, error: questionnaireError } = await supabase.from("questionnaires").select("id,title,active_version").eq("cycle_id", cycle.id).maybeSingle();
  if (questionnaireError) throw questionnaireError;
  if (!questionnaireData) return { ok: false, error: "QUESTIONNAIRE_NOT_FOUND" };
  const questionnaire = questionnaireData as ResolveSuccess["questionnaire"];

  const { data: questionData, error: questionsError } = await supabase.from("questionnaire_questions")
    .select("id,field_key,label,field_type,required,options,position,maps_to_candidate_field")
    .eq("questionnaire_id", questionnaire.id)
    .eq("version", questionnaire.active_version)
    .order("position", { ascending: true });
  if (questionsError) throw questionsError;
  const questions = effectiveQuestions((questionData || []) as Question[]);
  return { ok: true, supabase, candidate, cycle, membership, questionnaire, questions };
}

function responseForError(code: string) {
  const status = ["CANDIDATE_NOT_FOUND", "CANDIDATE_NOT_IN_ACTIVE_CYCLE"].includes(code) ? 404 : 400;
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    if (phone.length < 9) return responseForError("INVALID_PHONE");

    const resolved = await resolveCandidate(phone);
    if (!resolved.ok) return responseForError(resolved.error);
    const { supabase, candidate, cycle, membership, questionnaire, questions } = resolved;

    if (body.action === "load") {
      const { data: existingResponse, error: responseError } = await supabase.from("questionnaire_responses")
        .select("answers,submitted_at")
        .eq("questionnaire_id", questionnaire.id)
        .eq("candidate_id", candidate.id)
        .eq("cycle_id", cycle.id)
        .maybeSingle();
      if (responseError) throw responseError;

      const storedAnswers = existingResponse?.answers;
      const prefill: Record<string, unknown> = storedAnswers && typeof storedAnswers === "object" && !Array.isArray(storedAnswers)
        ? { ...(storedAnswers as Record<string, unknown>) }
        : {};
      const candidateValues: Record<string, unknown> = { full_name: candidate.full_name, phone: candidate.phone, city: candidate.city, photo_url: candidate.photo_url };

      for (const question of questions) {
        const mappedField = question.maps_to_candidate_field;
        if (!mappedField || (prefill[question.field_key] !== undefined && prefill[question.field_key] !== "")) continue;
        if (mappedField.startsWith("source:")) {
          prefill[question.field_key] = candidate.source_data?.[mappedField.slice(7)] ?? "";
        } else {
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

    const rawAnswers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers as Record<string, unknown> : {};
    const allowedKeys = new Set(questions.map((question) => question.field_key));
    const answers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawAnswers)) if (allowedKeys.has(key)) answers[key] = value;

    const candidateUpdates: Record<string, string> = {};
    const sourceUpdates: Record<string, unknown> = { ...(candidate.source_data || {}) };
    let sourceChanged = false;

    for (const question of questions) {
      const mappedField = question.maps_to_candidate_field;
      const value = answers[question.field_key];
      if (!mappedField) continue;

      if (mappedField.startsWith("source:")) {
        const sourceKey = mappedField.slice(7);
        if (sourceKey) {
          sourceUpdates[sourceKey] = value;
          sourceChanged = true;
        }
        continue;
      }

      if (!["full_name", "phone", "city", "photo_url"].includes(mappedField)) continue;
      if (typeof value === "string" && value.trim()) {
        candidateUpdates[mappedField] = mappedField === "phone" ? normalizePhone(value) : value.trim();
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

    if (Object.keys(candidateUpdates).length || sourceChanged) {
      const updatePayload: Record<string, unknown> = { ...candidateUpdates, updated_at: new Date().toISOString() };
      if (sourceChanged) updatePayload.source_data = sourceUpdates;
      const { error: candidateUpdateError } = await supabase.from("candidates").update(updatePayload).eq("id", candidate.id);
      if (candidateUpdateError) throw candidateUpdateError;
    }

    if (membership.status === "new") {
      const { error: membershipError } = await supabase.from("cycle_candidates").update({ status: "questionnaire_completed" }).eq("cycle_id", cycle.id).eq("candidate_id", candidate.id);
      if (membershipError) throw membershipError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("public questionnaire error", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
