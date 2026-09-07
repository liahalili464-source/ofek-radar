import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("profiles").select("id,username,full_name,role,active,unit_id,units(name)").order("role").order("username");
    if (error) throw error;
    return NextResponse.json({ users: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "interviewer";
    const unitId = body.unitId || null;
    if (!username || !fullName || password.length < 8) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const email = username.includes("@") ? username : `${username}@ofek-radar.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, full_name: fullName } });
    if (error || !data.user) throw error ?? new Error("USER_CREATE_FAILED");

    const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, username, full_name: fullName, role, unit_id: unitId, active: true });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return NextResponse.json({ id: data.user.id, username, fullName, role, unitId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireAdmin();
    const body = await request.json();
    const id = String(body.id || "");
    if (!id || typeof body.active !== "boolean") return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (id === user.id && body.active === false) return NextResponse.json({ error: "CANNOT_DISABLE_SELF" }, { status: 400 });

    const { data, error } = await supabase
      .from("profiles")
      .update({ active: body.active })
      .eq("id", id)
      .select("id,active")
      .single();
    if (error) throw error;
    return NextResponse.json({ user: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
