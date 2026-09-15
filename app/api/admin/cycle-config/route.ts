import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

const CONFIG_FILE = "__ofek_admin_config__";

type PriorityConfig = {
  starred: boolean;
  unitId?: string | null;
  note?: string;
};

type CycleMeta = {
  arrivalDates: string[];
  populationType: string;
};

type AdminConfig = {
  version: 1;
  allocations: Record<string, number>;
  priorities: Record<string, PriorityConfig>;
  cycleMeta: CycleMeta;
};

function emptyConfig(): AdminConfig {
  return { version: 1, allocations: {}, priorities: {}, cycleMeta: { arrivalDates: [], populationType: "" } };
}

function normalizeDate(value: unknown) {
  const date = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeConfig(value: unknown): AdminConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyConfig();
  const raw = value as Record<string, unknown>;
  const allocations: Record<string, number> = {};
  if (raw.allocations && typeof raw.allocations === "object" && !Array.isArray(raw.allocations)) {
    for (const [unitId, amount] of Object.entries(raw.allocations as Record<string, unknown>)) {
      const number = Number(amount);
      if (Number.isFinite(number) && number >= 0) allocations[unitId] = Math.floor(number);
    }
  }

  const priorities: Record<string, PriorityConfig> = {};
  if (raw.priorities && typeof raw.priorities === "object" && !Array.isArray(raw.priorities)) {
    for (const [candidateId, priority] of Object.entries(raw.priorities as Record<string, unknown>)) {
      if (!priority || typeof priority !== "object" || Array.isArray(priority)) continue;
      const item = priority as Record<string, unknown>;
      if (item.starred !== true) continue;
      priorities[candidateId] = {
        starred: true,
        unitId: typeof item.unitId === "string" && item.unitId ? item.unitId : null,
        note: typeof item.note === "string" ? item.note : "",
      };
    }
  }

  const rawMeta = raw.cycleMeta && typeof raw.cycleMeta === "object" && !Array.isArray(raw.cycleMeta)
    ? raw.cycleMeta as Record<string, unknown>
    : {};
  const arrivalDates = Array.isArray(rawMeta.arrivalDates)
    ? [...new Set(rawMeta.arrivalDates.map(normalizeDate).filter(Boolean))].sort()
    : [];
  const populationType = typeof rawMeta.populationType === "string" ? rawMeta.populationType.trim().slice(0, 120) : "";

  return { version: 1, allocations, priorities, cycleMeta: { arrivalDates, populationType } };
}

async function loadConfig(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], cycleId: string) {
  const { data, error } = await supabase
    .from("import_batches")
    .select("id,column_mapping")
    .eq("cycle_id", cycleId)
    .eq("file_name", CONFIG_FILE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { rowId: data?.id as string | undefined, config: normalizeConfig(data?.column_mapping) };
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const cycleId = new URL(request.url).searchParams.get("cycleId")?.trim();
    if (!cycleId) return NextResponse.json({ error: "CYCLE_REQUIRED" }, { status: 400 });
    const { config } = await loadConfig(supabase, cycleId);
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireAdmin();
    const body = await request.json();
    const cycleId = typeof body.cycleId === "string" ? body.cycleId.trim() : "";
    if (!cycleId) return NextResponse.json({ error: "CYCLE_REQUIRED" }, { status: 400 });

    const { rowId, config: current } = await loadConfig(supabase, cycleId);
    const next: AdminConfig = {
      ...current,
      allocations: { ...current.allocations },
      priorities: { ...current.priorities },
      cycleMeta: { ...current.cycleMeta, arrivalDates: [...current.cycleMeta.arrivalDates] },
    };

    if (body.allocations && typeof body.allocations === "object" && !Array.isArray(body.allocations)) {
      next.allocations = {};
      for (const [unitId, amount] of Object.entries(body.allocations as Record<string, unknown>)) {
        const number = Number(amount);
        if (Number.isFinite(number) && number >= 0) next.allocations[unitId] = Math.floor(number);
      }
    }

    if (body.cycleMeta && typeof body.cycleMeta === "object" && !Array.isArray(body.cycleMeta)) {
      const meta = body.cycleMeta as Record<string, unknown>;
      const arrivalDates = Array.isArray(meta.arrivalDates)
        ? [...new Set(meta.arrivalDates.map(normalizeDate).filter(Boolean))].sort()
        : next.cycleMeta.arrivalDates;
      const populationType = typeof meta.populationType === "string"
        ? meta.populationType.trim().slice(0, 120)
        : next.cycleMeta.populationType;
      next.cycleMeta = { arrivalDates, populationType };
    }

    if (body.priority && typeof body.priority === "object" && !Array.isArray(body.priority)) {
      const priority = body.priority as Record<string, unknown>;
      const candidateId = typeof priority.candidateId === "string" ? priority.candidateId.trim() : "";
      if (!candidateId) return NextResponse.json({ error: "CANDIDATE_REQUIRED" }, { status: 400 });
      if (priority.starred === true) {
        next.priorities[candidateId] = {
          starred: true,
          unitId: typeof priority.unitId === "string" && priority.unitId ? priority.unitId : null,
          note: typeof priority.note === "string" ? priority.note.trim().slice(0, 1500) : "",
        };
      } else {
        delete next.priorities[candidateId];
      }
    }

    if (rowId) {
      const { error } = await supabase.from("import_batches").update({ column_mapping: next }).eq("id", rowId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("import_batches").insert({
        cycle_id: cycleId,
        file_name: CONFIG_FILE,
        row_count: 0,
        imported_count: 0,
        rejected_count: 0,
        column_mapping: next,
        imported_by: user.id,
      });
      if (error) throw error;
    }

    return NextResponse.json(next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
