"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  Settings,
  Users,
  UserRoundSearch,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const nav = [
  { href: "/cycles", label: "מחזורי ראיונות", icon: LayoutDashboard },
  { href: "/candidates", label: "מועמדים", icon: Users },
  { href: "/schedule", label: "שיבוץ ראיונות", icon: CalendarDays },
  { href: "/questionnaire", label: "שאלון", icon: FileQuestion },
  { href: "/users", label: "ניהול משתמשים", icon: UserRoundSearch },
  { href: "/interviewer", label: "הראיונות שלי", icon: ClipboardList },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

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
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/cycles" aria-label="OFEK RADAR home">
          <Image className="logo" src="/ofek-radar-logo.png" alt="OFEK RADAR" width={632} height={223} priority />
        </Link>
        <nav className="nav">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== "/cycles" && path.startsWith(`${href}/`)) || (href === "/cycles" && path.startsWith("/cycles"));
            return (
              <Link key={href} href={href} className={active ? "active" : ""}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">רכ</div>
          <div>
            <b>רותם כהן</b>
            <div>מדור איתור ומיון</div>
          </div>
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
