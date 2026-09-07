"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
      const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      if (hasSupabase) {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase-client");
        const supabase = createSupabaseBrowserClient();
        const email = username.includes("@") ? username : `${username}@ofek-radar.local`;
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        router.push(profile?.role === "interviewer" ? "/interviewer" : "/cycles");
      } else {
        router.push(username.toLowerCase().includes("interviewer") ? "/interviewer" : "/cycles");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login" dir="rtl">
      <section className="login-hero"><div className="rings" /><div className="login-copy">
        <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={632} height={223} priority />
        <h1>מערכת ניהול מחזורי ראיונות ומיון מועמדים</h1>
        <p>פלטפורמה מרכזית למדור איתור ומיון — קליטת מועמדים, שאלונים, שיבוץ ראיונות, חוות דעת ומעקב אחר התהליך המלא במקום אחד.</p>
      </div></section>
      <section className="login-side">
        <form className="login-card" onSubmit={submit}>
          <Image src="/ofek-radar-logo.png" alt="OFEK RADAR" width={260} height={92} style={{ width: 260, height: "auto", display: "block", margin: "0 auto 24px" }} />
          <div className="field"><label>שם משתמש</label><input className="input" name="username" placeholder="הזן/י שם משתמש" defaultValue="admin" autoComplete="username" /></div>
          <div className="field"><label>סיסמה</label><input className="input" name="password" type="password" placeholder="••••••••" defaultValue="demo1234" autoComplete="current-password" /></div>
          <div className="row between" style={{ margin: "8px 0 22px" }}><label className="row"><input type="checkbox" /> זכור אותי</label><span className="accent" style={{ fontWeight: 800 }}>שכחתי סיסמה</span></div>
          {error && <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "מתחבר/ת..." : "התחברות"}</button>
          <div className="notice" style={{ marginTop: 14, background: "rgba(255,255,255,.03)" }}><b>דמו:</b><div className="stat-label">admin → צד מנהל · interviewer1 → צד מראיין. כל סיסמה עובדת כל עוד Supabase לא מחובר.</div></div>
        </form>
      </section>
    </div>
  );
}
