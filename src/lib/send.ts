import type { Potluck } from "./types";

export type SendResult = {
  ok: boolean;
  status: number;
  error?: string;
  potluck?: Potluck;
};

export async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the table. Check your connection and try again." };
  }
  const data = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    potluck?: Potluck;
  };
  return {
    ok: response.ok,
    status: response.status,
    error:
      typeof data.error === "string"
        ? data.error
        : undefined,
    potluck: data.potluck,
  };
}
