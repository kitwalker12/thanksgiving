import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, basicAuthOk, tooManyAuthFails, unauthorized } from "./lib/basic-auth";

function needsAuth(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/api/event" && method !== "GET" && method !== "HEAD") return true;
  if (/^\/api\/items\/[^/]+$/.test(pathname) && (method === "PATCH" || method === "DELETE")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  if (!needsAuth(request)) return NextResponse.next();
  if (await basicAuthOk(request.headers.get("authorization"))) return NextResponse.next();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (adminConfigured() && tooManyAuthFails(ip)) {
    return new NextResponse("Too many tries. Wait a few minutes.", {
      status: 429,
      headers: { "cache-control": "no-store", "retry-after": "60", "content-type": "text/plain; charset=utf-8" },
    });
  }
  return unauthorized();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/event", "/api/items/:path*"],
};
