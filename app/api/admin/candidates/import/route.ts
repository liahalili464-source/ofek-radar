import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

type ImportRow = { fullName: string; phone: string; city?: string; photoUrl?: string; sourceData?: Record<string, unknown> };

function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin();
    const body = await request.json();
    const cycleId = String(body.cycleId || "");
    const rows = (Array.isArray(body.rows) ? body.rows : []) as ImportRow[];
    const fileName = String(body.fileName || "candidates.xlsx");
    const mapping = body.mapping ?? {};
    if (!cycleId || !rows.length) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    let imported = 0;
    const rejected: { phone?: string; reason: string }[] = [];

    for (const row of rows) {
      const phone = normalizePhone(row.phone);
      const fullName = String(row.fullName || "").trim();
      if (!phone || !fullName) { rejected.push({ phone, reason: "MISSING_REQUIRED_FIELD" }); continue; }

      const { data: existingRows, error: existingError } = await supabase
        .from("candidates")
        .select("id")
        .eq("phone", phone)
        .limit(2);
      if (existingError) { rejected.push({ phone, reason: existingError.message }); continue; }
      if ((existingRows || []).length > 1) { rejected.push({ phone, reason: "DUPLICATE_PHONE" }); continue; }

      let candidateId = existingRows?.[0]?.id as string | undefined;
      if (candidateId) {
        const { error: updateError } = await supabase.from("candidates").update({
          full_name: fullName,
          phone,
          city: row.city || null,
          photo_url: row.photoUrl || null,
          source_data: row.sourceData ?? {},
          updated_at: new Date().toISOString(),
        }).eq("id", candidateId);
        if (updateError) { rejected.push({ phone, reason: updateError.message }); continue; }
      } else {
        const internalId = `phone:${phone}`;
        const { data: candidate, error: candidateError } = await supabase.from("candidates").upsert({
          national_id: internalId,
          full_name: fullName,
          phone,
          city: row.city || null,
          photo_url: row.photoUrl || null,
          source_data: row.sourceData ?? {},
          updated_at: new Date().toISOString(),
        }, { onConflict: "national_id" }).select("id").single();
        if (candidateError || !candidate) { rejected.push({ phone, reason: candidateError?.message || "UPSERT_FAILED" }); continue; }
        candidateId = candidate.id;
      }

      const { error: cycleError } = await supabase.from("cycle_candidates").upsert({ cycle_id: cycleId, candidate_id: candidateId }, { onConflict: "cycle_id,candidate_id" });
      if (cycleError) { rejected.push({ phone, reason: cycleError.message }); continue; }
      imported++;
    }

    await supabase.from("import_batches").insert({ cycle_id: cycleId, file_name: fileName, row_count: rows.length, imported_count: imported, rejected_count: rejected.length, column_mapping: mapping, imported_by: user.id });
    return NextResponse.json({ imported, rejected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
