import { basicAuthOk, unauthorized } from "@/lib/basic-auth";
import { assertBrowserWrite, fail, json, readJson } from "@/lib/http";
import { deleteItem, updateItem } from "@/lib/potluck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    if (!(await basicAuthOk(request.headers.get("authorization")))) return unauthorized();
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const { id } = await context.params;
    const result = await updateItem(id, body.value);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { potluck: result.potluck });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!(await basicAuthOk(request.headers.get("authorization")))) return unauthorized();
    const blocked = assertBrowserWrite(request);
    if (blocked) return blocked;
    const { id } = await context.params;
    const result = await deleteItem(id);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { potluck: result.potluck });
  } catch (error) {
    return fail(error);
  }
}
