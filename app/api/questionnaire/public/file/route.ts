import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { FILE_UPLOAD_FIELD_KEYS } from "@/lib/questionnaire-template";

const BUCKET = "candidate-questionnaire-files";
const MAX_BYTES = 100 * 1024 * 1024;

function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9א-ת._-]+/g, "-").replace(/-+/g, "-").slice(-120) || "file";
}

async function resolveCandidate(phone: string) {
  const supabase = createSupabaseAdminClient();
  const { data: cycles, error: cycleError } = await supabase.from("cycles").select("id").eq("status", "active").order("starts_on", { ascending: false });
  if (cycleError) throw cycleError;
  const cycleIds = (cycles || []).map((c) => c.id);
  if (!cycleIds.length) return null;

  const { data: memberships, error: membershipError } = await supabase.from("cycle_candidates").select("cycle_id,candidate_id").in("cycle_id", cycleIds);
  if (membershipError) throw membershipError;
  const candidateIds = [...new Set((memberships || []).map((m) => m.candidate_id))];
  if (!candidateIds.length) return null;

  const { data: candidates, error: candidateError } = await supabase.from("candidates").select("id,phone").in("id", candidateIds);
  if (candidateError) throw candidateError;
  const matches = (candidates || []).filter((candidate) => normalizePhone(candidate.phone) === phone);
  if (matches.length !== 1) return null;

  const candidate = matches[0];
  const membership = (memberships || []).find((m) => m.candidate_id === candidate.id && cycleIds.includes(m.cycle_id));
  if (!membership) return null;
  return { supabase, candidateId: candidate.id, cycleId: membership.cycle_id };
}

async function ensureBucket(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [
      "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const phone = normalizePhone(form.get("phone"));
    const fieldKey = String(form.get("fieldKey") || "");
    const file = form.get("file");

    if (phone.length < 9) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    if (!FILE_UPLOAD_FIELD_KEYS.has(fieldKey)) return NextResponse.json({ error: "INVALID_FIELD" }, { status: 400 });
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    if (fieldKey === "personal_questionnaire_upload" && file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });

    const resolved = await resolveCandidate(phone);
    if (!resolved) return NextResponse.json({ error: "CANDIDATE_NOT_FOUND" }, { status: 404 });
    const { supabase, candidateId, cycleId } = resolved;
    await ensureBucket(supabase);

    const path = `${cycleId}/${candidateId}/${fieldKey}/${Date.now()}-${safeName(file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    return NextResponse.json({ value: `storage:${BUCKET}/${path}`, fileName: file.name });
  } catch (error) {
    console.error("questionnaire file upload error", error);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
