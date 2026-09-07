"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Users,
  UserRoundSearch,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const adminNav = [
  { href: "/cycles", label: "מחזורי ראיונות", icon: LayoutDashboard },
  { href: "/candidates", label: "מועמדים", icon: Users },
  { href: "/schedule", label: "שיבוץ ראיונות", icon: CalendarDays },
  { href: "/questionnaire", label: "שאלון", icon: FileQuestion },
  { href: "/users", label: "יחידות והרשאות", icon: UserRoundSearch },
];

const interviewerNav = [
  { href: "/interviewer", label: "הראיונות שלי", icon: ClipboardList },
  { href: "/interviewer/candidates", label: "המועמדים שלי", icon: Users },
];

type Viewer = {
  username: string;
  fullName: string;
  role: "admin" | "interviewer";
  unitName: string | null;
};

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadViewer() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username,full_name,role,unit_id")
        .eq("id", user.id)
        .single();
      if (!profile || cancelled) return;

      let unitName: string | null = null;
      if (profile.unit_id) {
        const { data: unit } = await supabase.from("units").select("name").eq("id", profile.unit_id).single();
        unitName = unit?.name ?? null;
      }
      if (!cancelled) {
        setViewer({
          username: profile.username,
          fullName: profile.full_name,
          role: profile.role,
          unitName,
        });
      }
    }
    loadViewer();
    return () => { cancelled = true; };
  }, []);

  const nav = viewer?.role === "interviewer" ? interviewerNav : adminNav;
  const homeHref = viewer?.role === "interviewer" ? "/interviewer" : "/cycles";
  const displayName = viewer?.role === "interviewer"
    ? (viewer.unitName || viewer.fullName || viewer.username)
    : (viewer?.fullName || "מדור איתור ומיון");
  const displaySub = viewer?.role === "interviewer" ? "חשבון יחידה" : "מדור איתור ומיון";
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join(""), [displayName]);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={homeHref} aria-label="OFEK RADAR home">
          <Image className="logo" src="/ofek-radar-logo.png" alt="OFEK RADAR" width={632} height={223} priority />
        </Link>
        <nav className="nav">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/interviewer"
              ? path === "/interviewer"
              : path === href || path.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer" style={{ gap: 10 }}>
          <div className="sidebar-user-avatar">{initials || "OR"}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{displayName}</b>
            <div>{displaySub}</div>
          </div>
          <button className="btn btn-small" onClick={logout} title="התנתקות" aria-label="התנתקות"><LogOut size={15} /></button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="title">
            <div className="eyebrow">OFEK RADAR · מערכת איתור ומיון</div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">
            {actions}
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
