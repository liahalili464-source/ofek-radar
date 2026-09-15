import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

const RATING_KEYS = ["intake_experience", "info_clarity", "interviewer_professionalism", "fairness", "questions_space"] as const;
const TEXT_KEYS = ["overall_feeling", "contact_person", "surprise", "preserve", "improve", "additional"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const cycleId = new URL(request.url).searchParams.get("cycleId")?.trim();
    if (!cycleId) return NextResponse.json({ error: "CYCLE_REQUIRED" }, { status: 400 });

    const { data: rows, error } = await supabase.from("questionnaire_responses").select("answers").eq("cycle_id", cycleId);
    if (error) throw error;

    const surveys = (rows || []).flatMap((row) => {
      if (!isObject(row.answers)) return [];
      const satisfaction = row.answers.__satisfaction;
      if (!isObject(satisfaction) || !isObject(satisfaction.answers)) return [];
      return [satisfaction.answers];
    });

    const ratings: Record<string, { average: number | null; distribution: Record<string, number> }> = {};
    for (const key of RATING_KEYS) {
      const values = surveys.map((survey) => Number(survey[key])).filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
      const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      values.forEach((value) => { distribution[String(value) as keyof typeof distribution] += 1; });
      ratings[key] = {
        average: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null,
        distribution,
      };
    }

    const open: Record<string, string[]> = {};
    for (const key of TEXT_KEYS) {
      open[key] = surveys.map((survey) => typeof survey[key] === "string" ? survey[key].trim() : "").filter(Boolean);
    }

    const allAverages = Object.values(ratings).map((item) => item.average).filter((value): value is number => value !== null);
    const overallAverage = allAverages.length ? Number((allAverages.reduce((sum, value) => sum + value, 0) / allAverages.length).toFixed(2)) : null;

    return NextResponse.json({ responseCount: surveys.length, overallAverage, ratings, open });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
