import "server-only";

const NO_STORE = { "cache-control": "no-store" };

export function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export function fail(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const code =
    typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "error";
  if (/postgres:\/\/|DATABASE_URL/i.test(message)) console.error("request failed", code);
  else console.error("request failed", code, message.slice(0, 300));
  return json(500, { error: "Something went wrong. Try again." });
}

export function assertBrowserWrite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return json(403, { error: "That request was blocked." });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return json(400, { error: "Bad request." });
  if (origin) {
    try {
      if (new URL(origin).host !== host) return json(403, { error: "That request was blocked." });
    } catch {
      return json(400, { error: "Bad request." });
    }
  }
  return null;
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const blocked = assertBrowserWrite(request);
  if (blocked) return { ok: false, response: blocked };
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 20_000) {
    return { ok: false, response: json(413, { error: "That was too large." }) };
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, response: json(415, { error: "Bad request." }) };
  }
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: json(400, { error: "Bad request." }) };
  }
}

const buckets = new Map<string, { count: number; reset: number }>();

export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return ip.slice(0, 80);
}

export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 4000) buckets.clear();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}
