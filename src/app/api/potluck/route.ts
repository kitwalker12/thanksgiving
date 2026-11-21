import { getPotluck } from "@/lib/potluck";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json(200, { potluck: await getPotluck() });
  } catch (error) {
    return fail(error);
  }
}
