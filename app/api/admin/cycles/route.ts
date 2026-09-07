import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

const DEFAULT_QUESTIONS = [
  { field_key: "full_name", label: "שם מלא", field_type: "short_text", required: true, maps_to_candidate_field: "full_name" },
  { field_key: "national_id", label: "תעודת זהות", field_type: "short_text", required: true, maps_to_candidate_field: "national_id" },
  { field_key: "phone", label: "טלפון", field_type: "phone", required: true, maps_to_candidate_field: "phone" },
  { field_key: "city", label: "עיר מגורים", field_type: "short_text", required: false, maps_to_candidate_field: "city" },
  { field_key: "education", label: "השכלה", field_type: "long_text", required: false, maps_to_candidate_field: null },
  { field_key: "skills", label: "באילו שפות/טכנולוגיות יש לך ניסיון?", field_type: "multi_choice", required: true, options: ["Python", "JavaScript", "C++", "C#", "Java", "SQL", "Linux", "DevOps"], maps_to_candidate_field: null },
  { field_key: "motivation", label: "למה מעניין אותך להשתלב ביחידה טכנולוגית?", field_type: "long_text", required: true, maps_to_candidate_field: null },
];

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
      const rows = body.units.map((u: { unitId: string; interviewerId?: string }) => ({
        cycle_id: cycle.id,
        unit_id: u.unitId,
        interviewer_id: u.interviewerId || null,
      }));
      const { error: unitsError } = await supabase.from("cycle_units").insert(rows);
      if (unitsError) throw unitsError;
    }

    if (Array.isArray(body.days) && body.days.length) {
      const rows = body.days.map((d: { date: string; start: string; end: string }) => ({
        cycle_id: cycle.id,
        interview_date: d.date,
        starts_at: d.start,
        ends_at: d.end,
      }));
      const { error: daysError } = await supabase.from("interview_days").insert(rows);
      if (daysError) throw daysError;
    }

    const { data: questionnaire, error: questionnaireError } = await supabase.from("questionnaires").insert({
      cycle_id: cycle.id,
      title: "שאלון מועמד",
      active_version: 1,
    }).select("id").single();
    if (questionnaireError || !questionnaire) throw questionnaireError || new Error("QUESTIONNAIRE_CREATE_FAILED");

    const questionRows = DEFAULT_QUESTIONS.map((q, index) => ({
      questionnaire_id: questionnaire.id,
      version: 1,
      field_key: q.field_key,
      label: q.label,
      field_type: q.field_type,
      required: q.required,
      options: "options" in q ? q.options || [] : [],
      position: index,
      maps_to_candidate_field: q.maps_to_candidate_field,
    }));
    const { error: questionsError } = await supabase.from("questionnaire_questions").insert(questionRows);
    if (questionsError) throw questionsError;

    return NextResponse.json({ cycle }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
