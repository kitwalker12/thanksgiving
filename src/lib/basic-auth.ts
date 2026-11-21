const fails = new Map<string, { count: number; reset: number }>();

function expectedUser(): string {
  return process.env.ADMIN_USERNAME?.trim() ?? "";
}

function expectedPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function adminConfigured(): boolean {
  const user = expectedUser();
  const password = expectedPassword().trim();
  return user.length >= 1 && user.length <= 64 && !user.includes(":") && password.length >= 8 && password.length <= 128;
}

async function digest(value: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(hash);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

export async function basicAuthOk(authorization: string | null): Promise<boolean> {
  const user = expectedUser();
  const password = expectedPassword().trim();
  if (!adminConfigured()) return false;
  if (!authorization || authorization.length > 2000 || !authorization.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    const bytes = Uint8Array.from(atob(authorization.slice(6).trim()), (char) => char.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return false;
  }
  const split = decoded.indexOf(":");
  if (split < 0) return false;
  const gotUser = decoded.slice(0, split);
  const gotPassword = decoded.slice(split + 1);
  const userOk = equalBytes(await digest(gotUser), await digest(user));
  const passwordOk = equalBytes(await digest(gotPassword), await digest(password));
  return userOk && passwordOk;
}

export function tooManyAuthFails(ip: string): boolean {
  const now = Date.now();
  const key = ip.slice(0, 80) || "local";
  if (fails.size > 4000) fails.clear();
  const bucket = fails.get(key);
  if (!bucket || bucket.reset < now) {
    fails.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 12;
}

export function unauthorized(): Response {
  if (!adminConfigured()) {
    return new Response("Hosting is not unlocked yet.", {
      status: 401,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("Sign in to host this potluck.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Hosting", charset="UTF-8"',
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
