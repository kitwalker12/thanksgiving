import { callerKey, fail, json, readJson, tooMany } from "@/lib/http";
import { claimItem } from "@/lib/potluck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (tooMany(`claim:${callerKey(request)}`, 40, 10 * 60 * 1000)) {
      return json(429, { error: "Too many signups just now. Wait a minute and try again." }, { "retry-after": "60" });
    }
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const { id } = await context.params;
    const result = await claimItem(id, body.value);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { potluck: result.potluck });
  } catch (error) {
    return fail(error);
  }
}
