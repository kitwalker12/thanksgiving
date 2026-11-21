import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type Bag = {
  pool?: pg.Pool;
  local?: Promise<PGlite>;
  queue?: Promise<unknown>;
};

const bag: Bag = ((globalThis as { __potluckDb?: Bag }).__potluckDb ??= {});

export type Sql = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (databaseUrl !== "") {
    bag.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await bag.pool.query(text, params)).rows as T[];
  }
  return enqueue(async () => {
    const db = await localDb();
    return (await db.query<T>(text, params)).rows;
  });
}

export async function withTransaction<T>(fn: (query: Sql) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    bag.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const client = await bag.pool.connect();
    try {
      await client.query("begin");
      const query = (async (text: string, params: unknown[] = []) => {
        const res = await client.query(text, params);
        return res.rows as Record<string, unknown>[];
      }) as Sql;
      const result = await fn(query);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // The original error is the one to surface.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return enqueue(async () => {
    const db = await localDb();
    return db.transaction(async (tx) => {
      const query = (async (text: string, params: unknown[] = []) => {
        const result = await tx.query(text, params);
        return result.rows as Record<string, unknown>[];
      }) as Sql;
      return fn(query);
    });
  });
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const previous = bag.queue ?? Promise.resolve();
  const run = previous.then(fn, fn);
  bag.queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function localDb(): Promise<PGlite> {
  bag.local ??= startLocal().catch((error: unknown) => {
    bag.local = undefined;
    throw error;
  });
  return bag.local;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  return db;
}
