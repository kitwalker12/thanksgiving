import { fail, json, readJson } from "@/lib/http";
import { updateEvent } from "@/lib/potluck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const result = await updateEvent(body.value);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { potluck: result.potluck });
  } catch (error) {
    return fail(error);
  }
}
