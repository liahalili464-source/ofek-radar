import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { resolveLatestCandidateCycle } from "@/lib/public-candidate-cycle";

const MASTER_PREVIEW_CODE = "1905";

type Interview = { unit_id: string; status: string };
type Unit = { id: string; name: string };
type Ranking = { unitId: string; rank: number };

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawPhone = String(body.phone ?? "").replace(/\D/g, "");

    if (rawPhone === MASTER_PREVIEW_CODE) {
      if (body.action === "load") {
        const supabase = createSupabaseAdminClient();
        const { data: unitRows, error: unitError } = await supabase
          .from("units")
          .select("id,name")
          .eq("active", true)
          .order("name");
        if (unitError) throw unitError;

        return NextResponse.json({
          candidateName: "Lia",
          cycleName: "תצוגת IT · ללא שיוך למחזור",
          ready: true,
          pendingInterviews: 0,
          units: (unitRows || []) as Unit[],
          rankings: [],
          previouslySubmitted: false,
          previewOnly: true,
        });
      }
      if (body.action === "submit") return NextResponse.json({ ok: true, previewOnly: true });
      return errorResponse("INVALID_ACTION");
    }

    const resolved = await resolveLatestCandidateCycle(body.phone);
    if (!resolved.ok) return errorResponse(resolved.error, resolved.error === "CANDIDATE_NOT_FOUND" ? 404 : 400);
    const { supabase, candidate, cycle, questionnaire } = resolved;

    const { data: interviewRows, error: interviewError } = await supabase
      .from("interviews")
      .select("unit_id,status")
      .eq("cycle_id", cycle.id)
      .eq("candidate_id", candidate.id)
      .neq("status", "cancelled");
    if (interviewError) throw interviewError;

    const interviews = (interviewRows || []) as Interview[];
    const pending = interviews.filter((interview) => interview.status === "scheduled");
    const completedUnitIds = [...new Set(interviews.filter((interview) => interview.status === "completed").map((interview) => interview.unit_id))];
    const ready = interviews.length > 0 && pending.length === 0 && completedUnitIds.length > 0;

    const { data: unitRows, error: unitError } = completedUnitIds.length
      ? await supabase.from("units").select("id,name").in("id", completedUnitIds)
      : { data: [], error: null };
    if (unitError) throw unitError;
    const unitNameById = new Map(((unitRows || []) as Unit[]).map((unit) => [unit.id, unit.name]));
    const units = completedUnitIds.map((unitId) => ({ id: unitId, name: unitNameById.get(unitId) || "יחידה" }));

    const { data: existingResponse, error: responseError } = await supabase
      .from("questionnaire_responses")
      .select("answers,submitted_at")
      .eq("questionnaire_id", questionnaire.id)
      .eq("candidate_id", candidate.id)
      .eq("cycle_id", cycle.id)
      .maybeSingle();
    if (responseError) throw responseError;
    const existingAnswers = isObject(existingResponse?.answers) ? existingResponse.answers : {};
    const storedPreference = isObject(existingAnswers.__unit_preferences) ? existingAnswers.__unit_preferences : null;
    const existingRankings = storedPreference && Array.isArray(storedPreference.rankings) ? storedPreference.rankings : [];

    if (body.action === "load") {
      return NextResponse.json({
        candidateName: candidate.full_name,
        cycleName: cycle.name,
        ready,
        pendingInterviews: pending.length,
        units,
        rankings: existingRankings,
        previouslySubmitted: existingRankings.length > 0,
      });
    }

    if (body.action !== "submit") return errorResponse("INVALID_ACTION");
    if (!ready) return errorResponse("INTERVIEWS_NOT_COMPLETED");

    const rawRankings = Array.isArray(body.rankings) ? body.rankings : [];
    const rankings: Ranking[] = rawRankings.flatMap((item: unknown) => {
      if (!isObject(item)) return [];
      const unitId = typeof item.unitId === "string" ? item.unitId : "";
      const rank = Number(item.rank);
      return unitId && Number.isInteger(rank) ? [{ unitId, rank }] : [];
    });

    const allowedUnits = new Set(completedUnitIds);
    const unitIds = rankings.map((item) => item.unitId);
    const ranks = rankings.map((item) => item.rank);
    const valid = rankings.length === completedUnitIds.length
      && unitIds.every((unitId) => allowedUnits.has(unitId))
      && new Set(unitIds).size === rankings.length
      && new Set(ranks).size === rankings.length
      && ranks.every((rank) => rank >= 1 && rank <= completedUnitIds.length);
    if (!valid) return errorResponse("INVALID_RANKING");

    const nextAnswers = {
      ...existingAnswers,
      __unit_preferences: {
        rankings: rankings.sort((a, b) => a.rank - b.rank),
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
    console.error("candidate ranking error", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
