import { callerKey, fail, json, readJson, tooMany } from "@/lib/http";
import { addGuestItem, addHostItem } from "@/lib/potluck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const record =
      typeof body.value === "object" && body.value !== null ? (body.value as { kind?: unknown }) : {};
    if (record.kind === "bringing") {
      if (tooMany(`bring:${callerKey(request)}`, 20, 10 * 60 * 1000)) {
        return json(429, { error: "Too many dishes just now. Wait a minute and try again." }, { "retry-after": "60" });
      }
      const result = await addGuestItem(body.value);
      if (!result.ok) return json(result.status, { error: result.error });
      return json(200, { potluck: result.potluck });
    }
    const result = await addHostItem(body.value);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { potluck: result.potluck });
  } catch (error) {
    return fail(error);
  }
}
