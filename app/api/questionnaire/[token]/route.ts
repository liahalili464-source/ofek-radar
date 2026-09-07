import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { data, error } = await anonClient().rpc("get_public_questionnaire", { p_token: token });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ERROR" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { data, error } = await anonClient().rpc("submit_public_questionnaire", { p_token: token, p_answers: body.answers ?? {} });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ERROR" }, { status: 400 });
  }
}
