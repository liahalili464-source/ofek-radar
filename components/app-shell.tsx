"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  Eye,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Users,
  UserRoundSearch,
  Wrench,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const adminNav = [
  { href: "/cycles", label: "מחזורי ראיונות", icon: LayoutDashboard },
  { href: "/candidates", label: "מועמדים", icon: Users },
  { href: "/schedule", label: "שיבוץ ראיונות", icon: CalendarDays },
  { href: "/placement", label: "שיבוץ ליחידות", icon: Boxes },
  { href: "/questionnaire", label: "שאלון", icon: FileQuestion },
  { href: "/feedback", label: "סקר שביעות רצון", icon: BarChart3 },
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

type UnitOption = { id: string; name: string; interviewerId: string };
type PreviewRole = "it" | "admin" | "interviewer";

const PREVIEW_ROLE_KEY = "ofek-radar-preview-role";
const PREVIEW_UNIT_KEY = "ofek-radar-preview-unit";

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
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [previewRole, setPreviewRole] = useState<PreviewRole>("it");
  const [previewUnit, setPreviewUnit] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

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

      if (profile.role === "admin" && profile.username?.trim().toLowerCase() === "lia") {
        const { data: interviewerProfiles } = await supabase
          .from("profiles")
          .select("id,unit_id")
          .eq("role", "interviewer")
          .eq("active", true);
        const unitIds = [...new Set((interviewerProfiles || []).map((x) => x.unit_id).filter(Boolean))] as string[];
        const { data: unitRows } = unitIds.length
          ? await supabase.from("units").select("id,name").in("id", unitIds)
          : { data: [] };
        const names = new Map((unitRows || []).map((u) => [u.id, u.name]));
        const options = (interviewerProfiles || [])
          .filter((p) => p.unit_id && names.has(p.unit_id))
          .map((p) => ({ id: p.unit_id as string, name: names.get(p.unit_id as string) as string, interviewerId: p.id }))
          .sort((a, b) => a.name.localeCompare(b.name, "he"));
        if (!cancelled) {
          setUnits(options);
          const storedRole = window.sessionStorage.getItem(PREVIEW_ROLE_KEY) as PreviewRole | null;
          const storedUnit = window.sessionStorage.getItem(PREVIEW_UNIT_KEY) || "";
          if (storedRole === "admin" || storedRole === "interviewer") setPreviewRole(storedRole);
          if (storedUnit && options.some((u) => u.id === storedUnit)) setPreviewUnit(storedUnit);
        }
      }
    }
    loadViewer();
    return () => { cancelled = true; };
  }, []);

  const isMaintenance = viewer?.role === "admin" && viewer.username?.trim().toLowerCase() === "lia";
  const effectiveRole = isMaintenance && previewRole === "interviewer" ? "interviewer" : viewer?.role;
  const nav = effectiveRole === "interviewer"
    ? interviewerNav
    : isMaintenance
      ? [...adminNav, { href: "/maintenance", label: "תחזוקת מערכת", icon: Wrench }]
      : adminNav;
  const homeHref = effectiveRole === "interviewer" ? "/interviewer" : "/cycles";
  const selectedUnit = units.find((u) => u.id === previewUnit);
  const displayName = effectiveRole === "interviewer"
    ? (isMaintenance && selectedUnit ? selectedUnit.name : (viewer?.unitName || viewer?.fullName || viewer?.username || "יחידה"))
    : (viewer?.fullName || "מדור איתור ומיון");
  const displaySub = isMaintenance && previewRole !== "it"
    ? `תצוגה מקדימה · ${previewRole === "admin" ? "מנהל/ת" : selectedUnit?.name || "יחידה מראיינת"}`
    : effectiveRole === "interviewer"
      ? "חשבון יחידה"
      : isMaintenance
        ? "צוות תחזוקה · גישת IT"
        : "מדור איתור ומיון";
  const initials = useMemo(() => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join(""), [displayName]);

  function setPreview(role: PreviewRole, unitId = previewUnit) {
    setPreviewRole(role);
    window.sessionStorage.setItem(PREVIEW_ROLE_KEY, role);
    if (role === "interviewer") {
      const nextUnit = unitId || units[0]?.id || "";
      setPreviewUnit(nextUnit);
      window.sessionStorage.setItem(PREVIEW_UNIT_KEY, nextUnit);
      const unit = units.find((u) => u.id === nextUnit);
      const params = new URLSearchParams();
      if (unit) {
        params.set("previewUnit", unit.id);
        params.set("previewInterviewer", unit.interviewerId);
      }
      router.push(`/interviewer?${params.toString()}`);
    } else {
      if (role === "it") window.sessionStorage.removeItem(PREVIEW_UNIT_KEY);
      router.push(role === "admin" ? "/cycles" : "/maintenance");
    }
    setPreviewOpen(false);
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.sessionStorage.removeItem(PREVIEW_ROLE_KEY);
    window.sessionStorage.removeItem(PREVIEW_UNIT_KEY);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={homeHref} aria-label="OFEK RADAR home" style={{ display: "block" }}>
          <Image
            src="/ofek-radar-logo.svg"
            alt="OFEK RADAR"
            width={1619}
            height={971}
            priority
            style={{ width: 178, height: 90, objectFit: "contain", display: "block", margin: "0 auto 24px" }}
          />
        </Link>
        {isMaintenance && (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <button className="btn" style={{ width: "100%", justifyContent: "center", gap: 7 }} onClick={() => setPreviewOpen((v) => !v)}>
              <Eye size={16} /> צפייה כ־
            </button>
            {previewOpen && (
              <div className="card" style={{ position: "absolute", zIndex: 50, top: "calc(100% + 8px)", right: 0, left: 0, padding: 12, boxShadow: "0 18px 50px rgba(0,0,0,.35)" }}>
                <button className="btn btn-small" style={{ width: "100%", marginBottom: 7 }} onClick={() => setPreview("it")}>IT</button>
                <button className="btn btn-small" style={{ width: "100%", marginBottom: 7 }} onClick={() => setPreview("admin")}>מנהל/ת</button>
                <div className="field" style={{ margin: 0 }}>
                  <label>יחידה מראיינת</label>
                  <select className="select" value={previewUnit} onChange={(e) => setPreview("interviewer", e.target.value)}>
                    <option value="">בחרי יחידה...</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
        <nav className="nav">
          {nav.map(({ href, label, icon: Icon }) => {
            const previewQuery = isMaintenance && previewRole === "interviewer" && selectedUnit
              ? `?previewUnit=${selectedUnit.id}&previewInterviewer=${selectedUnit.interviewerId}`
              : "";
            const targetHref = href.startsWith("/interviewer") ? `${href}${previewQuery}` : href;
            const active = href === "/interviewer"
              ? path === "/interviewer"
              : path === href || path.startsWith(`${href}/`);
            return (
              <Link key={href} href={targetHref} className={active ? "active" : ""}>
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
        {isMaintenance && previewRole !== "it" && (
          <div className="notice" style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderColor: "var(--accent)" }}>
            <div><Eye size={16} style={{ verticalAlign: "middle", marginLeft: 7 }} /><b>מצב תצוגה:</b> {previewRole === "admin" ? "מנהל/ת" : `יחידה מראיינת · ${selectedUnit?.name || "בחרי יחידה"}`} <span className="stat-label">· תצוגת IT, ללא החלפת משתמש</span></div>
            <button className="btn btn-small" onClick={() => setPreview("it")}><X size={14} /> חזרה ל־IT</button>
          </div>
        )}
        <div className="topbar">
          <div className="title">
            <div className="eyebrow">OFEK RADAR · מערכת איתור ומיון</div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
}
