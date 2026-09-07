import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Demo mode: when Supabase is not configured, keep the prototype fully navigable.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const publicPath = pathname === "/login" || pathname.startsWith("/form/") || pathname.startsWith("/api/questionnaire/");

  if (!user && !publicPath) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", user.id).single();
    if (!profile?.active) {
      await supabase.auth.signOut();
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      return NextResponse.redirect(redirect);
    }
    if (pathname === "/login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = profile?.role === "interviewer" ? "/interviewer" : "/cycles";
      return NextResponse.redirect(redirect);
    }
    const adminOnly = ["/cycles", "/candidates", "/schedule", "/questionnaire", "/users", "/settings"];
    if (profile?.role === "interviewer" && adminOnly.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/interviewer";
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ofek-radar-logo.png).*)"],
};
