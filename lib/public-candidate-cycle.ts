import { createSupabaseAdminClient } from "@/lib/supabase-server";

export function normalizePublicPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

type Candidate = { id: string; full_name: string; phone: string | null };
type Membership = { cycle_id: string; candidate_id: string };
type Cycle = { id: string; name: string; starts_on: string | null; ends_on: string | null; status: string };

export async function resolveLatestCandidateCycle(rawPhone: unknown) {
  const phone = normalizePublicPhone(rawPhone);
  if (phone.length < 9) return { ok: false as const, error: "INVALID_PHONE" as const };

  const supabase = createSupabaseAdminClient();
  const { data: candidateRows, error: candidateError } = await supabase
    .from("candidates")
    .select("id,full_name,phone")
    .not("phone", "is", null);
  if (candidateError) throw candidateError;

  const matchingCandidates = ((candidateRows || []) as Candidate[]).filter((candidate) => normalizePublicPhone(candidate.phone) === phone);
  if (!matchingCandidates.length) return { ok: false as const, error: "CANDIDATE_NOT_FOUND" as const };

  const candidateIds = matchingCandidates.map((candidate) => candidate.id);
  const { data: membershipRows, error: membershipError } = await supabase
    .from("cycle_candidates")
    .select("cycle_id,candidate_id")
    .in("candidate_id", candidateIds);
  if (membershipError) throw membershipError;
  const memberships = (membershipRows || []) as Membership[];
  if (!memberships.length) return { ok: false as const, error: "CANDIDATE_NOT_IN_CYCLE" as const };

  const cycleIds = [...new Set(memberships.map((membership) => membership.cycle_id))];
  const { data: cycleRows, error: cycleError } = await supabase
    .from("cycles")
    .select("id,name,starts_on,ends_on,status")
    .in("id", cycleIds);
  if (cycleError) throw cycleError;

  const cycles = ((cycleRows || []) as Cycle[]).sort((a, b) => {
    const aDate = a.starts_on || a.ends_on || "0000-00-00";
    const bDate = b.starts_on || b.ends_on || "0000-00-00";
    return bDate.localeCompare(aDate);
  });
  const cycle = cycles[0];
  if (!cycle) return { ok: false as const, error: "CANDIDATE_NOT_IN_CYCLE" as const };

  const membership = memberships.find((item) => item.cycle_id === cycle.id);
  if (!membership) return { ok: false as const, error: "CANDIDATE_NOT_IN_CYCLE" as const };
  const candidate = matchingCandidates.find((item) => item.id === membership.candidate_id);
  if (!candidate) return { ok: false as const, error: "CANDIDATE_NOT_FOUND" as const };

  const { data: questionnaire, error: questionnaireError } = await supabase
    .from("questionnaires")
    .select("id,active_version")
    .eq("cycle_id", cycle.id)
    .maybeSingle();
  if (questionnaireError) throw questionnaireError;
  if (!questionnaire) return { ok: false as const, error: "QUESTIONNAIRE_NOT_FOUND" as const };

  return { ok: true as const, supabase, phone, candidate, cycle, questionnaire };
}
