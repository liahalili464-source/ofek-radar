import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MaintenancePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,role,active")
    .eq("id", user.id)
    .single();

  const isMaintenance = profile?.active && profile.role === "admin" && profile.username?.trim().toLowerCase() === "lia";
  if (!isMaintenance) redirect("/cycles");

  const publicScreens = [
    { href: "/form", title: "שאלון מועמד", description: "השאלון המקדים שממלאים המועמדים לפני הראיונות." },
    { href: "/rank", title: "דירוג יחידות", description: "המסך שנפתח למועמד אחרי שסיים את כל הראיונות." },
    { href: "/satisfaction", title: "סקר שביעות רצון", description: "טופס המשוב שממלאים המועמדים בסוף התהליך." },
    { href: "/feedback", title: "סיכום סקר שביעות רצון", description: "מסך המנהל שמרכז את נתוני המשוב לפי מחזור." },
  ];

  return (
    <AppShell title="תחזוקת מערכת" subtitle="גישת IT פרטית למסכי המערכת ולתצוגות המועמד">
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ marginBottom: 14 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>תצוגות מועמד</h2>
            <div className="stat-label">הקישורים האלה נגישים רק לך מתוך ממשק התחזוקה. במסכים עצמם עדיין נשמרת לוגיקת הזיהוי לפי מספר טלפון.</div>
          </div>
          <span className="badge ok">גישת IT</span>
        </div>

        <div className="grid grid-2">
          {publicScreens.map((screen) => (
            <Link key={screen.href} href={screen.href} target="_blank" className="notice" style={{ display: "block", padding: 18 }}>
              <b style={{ display: "block", fontSize: 17, marginBottom: 5 }}>{screen.title}</b>
              <span className="stat-label">{screen.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">גישה ניהולית מלאה</h2>
        <div className="grid grid-3">
          <Link className="notice" href="/cycles"><b>מחזורי ראיונות</b><div className="stat-label">יצירה, עריכה וסיכום מחזורים</div></Link>
          <Link className="notice" href="/candidates"><b>מועמדים</b><div className="stat-label">צפייה ועריכת פרטי מועמדים</div></Link>
          <Link className="notice" href="/schedule"><b>שיבוץ ראיונות</b><div className="stat-label">ניהול לוחות הראיונות</div></Link>
          <Link className="notice" href="/questionnaire"><b>שאלון</b><div className="stat-label">ניהול שאלון המועמדים</div></Link>
          <Link className="notice" href="/feedback"><b>נתוני שביעות רצון</b><div className="stat-label">סיכום וניתוח משובי מועמדים</div></Link>
          <Link className="notice" href="/users"><b>יחידות והרשאות</b><div className="stat-label">ניהול המשתמשים הרגילים במערכת</div></Link>
        </div>
      </section>
    </AppShell>
  );
}
