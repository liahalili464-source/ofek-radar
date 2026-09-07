import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin();
    const body = await request.json();
    const { data: cycle, error } = await supabase.from("cycles").insert({
      name: body.name,
      recruitment_year: body.recruitmentYear,
      starts_on: body.startsOn || null,
      ends_on: body.endsOn || null,
      interview_duration_minutes: body.durationMinutes || 30,
      created_by: user.id,
      status: body.status || "draft",
    }).select().single();
    if (error) throw error;

    if (Array.isArray(body.units) && body.units.length) {
      const rows = body.units.map((u: { unitId: string; interviewerId?: string }) => ({ cycle_id: cycle.id, unit_id: u.unitId, interviewer_id: u.interviewerId || null }));
      const { error: unitsError } = await supabase.from("cycle_units").insert(rows);
      if (unitsError) throw unitsError;
    }
    if (Array.isArray(body.days) && body.days.length) {
      const rows = body.days.map((d: { date: string; start: string; end: string }) => ({ cycle_id: cycle.id, interview_date: d.date, starts_at: d.start, ends_at: d.end }));
      const { error: daysError } = await supabase.from("interview_days").insert(rows);
      if (daysError) throw daysError;
    }
    return NextResponse.json({ cycle }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
