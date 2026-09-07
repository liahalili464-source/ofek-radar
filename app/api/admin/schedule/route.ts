import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await request.json();
    const interviews = Array.isArray(body.interviews) ? body.interviews : [];
    if (!interviews.length) return NextResponse.json({ error: "NO_INTERVIEWS" }, { status: 400 });

    const payload = interviews.map((x: Record<string, unknown>) => ({
      cycle_id: x.cycleId,
      candidate_id: x.candidateId,
      unit_id: x.unitId,
      interviewer_id: x.interviewerId,
      starts_at: x.startsAt,
      ends_at: x.endsAt,
      location: x.location || null,
      status: "scheduled",
    }));
    const { data, error } = await supabase.from("interviews").upsert(payload, { onConflict: "cycle_id,candidate_id,unit_id" }).select("id");
    if (error) throw error;
    return NextResponse.json({ saved: data?.length ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
