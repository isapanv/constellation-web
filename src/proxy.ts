import { NextResponse, type NextRequest } from "next/server";

/**
 * Кабинет только для вошедших. Здесь проверяем лишь наличие cookie — быстро и без базы.
 * Настоящую проверку сессии делает API (401), а AuthGuard на клиенте уводит на вход.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has("sz_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/projects/:path*", "/team-search/:path*", "/calendar/:path*", "/profile/:path*", "/work-style/:path*", "/portfolio/:path*", "/onboarding/:path*"],
};
