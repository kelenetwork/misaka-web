import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/apply", "/forgot", "/api/auth", "/api/apply"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets / Next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Public routes
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check better-auth session cookie presence (we don't validate here — API guards do that).
  // Just redirect anonymous users to login on protected pages.
  const cookies = req.cookies;
  const hasSession = cookies.get("better-auth.session_token") || cookies.get("__Secure-better-auth.session_token");

  if (!hasSession) {
    // For API routes, return 401 JSON (API guard already does this; this is fallback)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
