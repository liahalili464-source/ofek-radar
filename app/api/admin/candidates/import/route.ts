import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

type ImportRow = { fullName: string; nationalId: string; phone?: string; city?: string; photoUrl?: string; sourceData?: Record<string, unknown> };

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
    const rejected: { nationalId?: string; reason: string }[] = [];

    for (const row of rows) {
      const nationalId = String(row.nationalId || "").replace(/\D/g, "");
      const fullName = String(row.fullName || "").trim();
      if (!nationalId || !fullName) { rejected.push({ nationalId, reason: "MISSING_REQUIRED_FIELD" }); continue; }

      const { data: candidate, error: candidateError } = await supabase.from("candidates").upsert({
        national_id: nationalId,
        full_name: fullName,
        phone: row.phone || null,
        city: row.city || null,
        photo_url: row.photoUrl || null,
        source_data: row.sourceData ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: "national_id" }).select("id").single();
      if (candidateError || !candidate) { rejected.push({ nationalId, reason: candidateError?.message || "UPSERT_FAILED" }); continue; }

      const { error: cycleError } = await supabase.from("cycle_candidates").upsert({ cycle_id: cycleId, candidate_id: candidate.id }, { onConflict: "cycle_id,candidate_id" });
      if (cycleError) { rejected.push({ nationalId, reason: cycleError.message }); continue; }
      imported++;
    }

    await supabase.from("import_batches").insert({ cycle_id: cycleId, file_name: fileName, row_count: rows.length, imported_count: imported, rejected_count: rejected.length, column_mapping: mapping, imported_by: user.id });
    return NextResponse.json({ imported, rejected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
