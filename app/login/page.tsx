"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");

    try {
      const supabase = createSupabaseBrowserClient();
      const email = username.includes("@") ? username : `${username}@ofek-radar.local`;
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,active")
        .eq("id", data.user.id)
        .single();
      if (profileError || !profile?.active) throw new Error("החשבון אינו פעיל או שאינו מוגדר במערכת");

      router.push(profile.role === "interviewer" ? "/interviewer" : "/cycles");
      router.refresh();
    } catch {
      setError("שם המשתמש או הסיסמה אינם נכונים");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login" dir="rtl">
      <section className="login-hero">
        <div className="rings" />
        <div className="login-copy">
          <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={632} height={223} priority />
          <h1>מערכת ניהול מחזורי ראיונות ומיון מועמדים</h1>
          <p>פלטפורמה מרכזית למדור איתור ומיון — קליטת מועמדים, שאלונים, שיבוץ ראיונות, חוות דעת ומעקב אחר התהליך המלא במקום אחד.</p>
        </div>
      </section>
      <section className="login-side">
        <form className="login-card" onSubmit={submit} autoComplete="on">
          <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={260} height={92} style={{ width: 260, height: "auto", display: "block", margin: "0 auto 24px" }} />
          <div className="field"><label>שם משתמש</label><input className="input" name="username" placeholder="הזן/י שם משתמש" autoComplete="username" required /></div>
          <div className="field"><label>סיסמה</label><input className="input" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required /></div>
          {error && <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} disabled={loading}>{loading ? "מתחבר/ת..." : "התחברות"}</button>
        </form>
      </section>
    </div>
  );
}
