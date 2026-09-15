import { NextResponse } from "next/server";
import { resolveLatestCandidateCycle } from "@/lib/public-candidate-cycle";

const RATING_KEYS = ["intake_experience", "info_clarity", "interviewer_professionalism", "fairness", "questions_space"] as const;
const TEXT_KEYS = ["overall_feeling", "contact_person", "surprise", "preserve", "improve", "additional"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resolved = await resolveLatestCandidateCycle(body.phone);
    if (!resolved.ok) return errorResponse(resolved.error, resolved.error === "CANDIDATE_NOT_FOUND" ? 404 : 400);
    const { supabase, candidate, cycle, questionnaire } = resolved;

    const { data: existingResponse, error: responseError } = await supabase
      .from("questionnaire_responses")
      .select("answers,submitted_at")
      .eq("questionnaire_id", questionnaire.id)
      .eq("candidate_id", candidate.id)
      .eq("cycle_id", cycle.id)
      .maybeSingle();
    if (responseError) throw responseError;

    const existingAnswers = isObject(existingResponse?.answers) ? existingResponse.answers : {};
    const storedSurvey = isObject(existingAnswers.__satisfaction) ? existingAnswers.__satisfaction : null;

    if (body.action === "load") {
      return NextResponse.json({
        cycleName: cycle.name,
        prefill: storedSurvey?.answers && isObject(storedSurvey.answers) ? storedSurvey.answers : {},
        previouslySubmitted: Boolean(storedSurvey),
      });
    }

    if (body.action !== "submit") return errorResponse("INVALID_ACTION");
    const rawAnswers = isObject(body.answers) ? body.answers : {};
    const answers: Record<string, unknown> = {};

    for (const key of RATING_KEYS) {
      const rating = Number(rawAnswers[key]);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return errorResponse("INVALID_RATING");
      answers[key] = rating;
    }
    for (const key of TEXT_KEYS) {
      answers[key] = typeof rawAnswers[key] === "string" ? rawAnswers[key].trim().slice(0, 3000) : "";
    }

    const nextAnswers = {
      ...existingAnswers,
      __satisfaction: {
        answers,
        submittedAt: new Date().toISOString(),
      },
    };

    const { error: saveError } = await supabase.from("questionnaire_responses").upsert({
      questionnaire_id: questionnaire.id,
      candidate_id: candidate.id,
      cycle_id: cycle.id,
      version: questionnaire.active_version,
      answers: nextAnswers,
      submitted_at: existingResponse?.submitted_at || new Date().toISOString(),
    }, { onConflict: "questionnaire_id,candidate_id,cycle_id" });
    if (saveError) throw saveError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("satisfaction survey error", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
