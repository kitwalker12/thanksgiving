import "server-only";
import { cache } from "react";
import { sql, withTransaction, type Sql } from "./db";
import { isTimeZone, parseWall, type TimeZoneId } from "./time";
import { CATEGORIES, namesMatch, type Category, type Claim, type Item, type Potluck } from "./types";

export type ActionResult =
  | { ok: true; potluck: Potluck }
  | { ok: false; status: number; error: string };

const MAX_ITEMS = 150;

type Clean = { value: string; tooLong: boolean };

function cleanLine(value: unknown, max: number): Clean {
  if (typeof value !== "string") return { value: "", tooLong: false };
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(cleaned);
  return { value: chars.slice(0, max).join(""), tooLong: chars.length > max };
}

function cleanNote(value: unknown, max: number): Clean {
  if (typeof value !== "string") return { value: "", tooLong: false };
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  const chars = Array.from(cleaned);
  return { value: chars.slice(0, max).join(""), tooLong: chars.length > max };
}

function asInt(value: unknown, min: number, max: number): number | null {
  const number =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

function asCategory(value: unknown): Category | null {
  if (typeof value !== "string") return null;
  return CATEGORIES.some((entry) => entry.id === value) ? (value as Category) : null;
}

function bodyOf(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function integer(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function iso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function rank(category: Category): number {
  return { main: 0, side: 1, dessert: 2, drink: 3, supplies: 4, other: 5 }[category];
}

async function load(query: Sql): Promise<Potluck> {
  const events = await query(
    "select title, starts_at, ends_at, time_zone, place_name, place_address, notes from event where id = 1",
  );
  const eventRow = events[0];
  if (!eventRow) throw new Error("missing event");
  const itemRows = await query("select id, name, category, details, needed, source from items");
  const claimRows = await query(
    "select id, item_id, guest_name, quantity, note from claims order by created_at asc",
  );
  const claims = new Map<string, Claim[]>();
  for (const row of claimRows) {
    const itemId = text(row.item_id);
    const list = claims.get(itemId) ?? [];
    list.push({
      id: text(row.id),
      guestName: text(row.guest_name),
      quantity: integer(row.quantity),
      note: text(row.note),
    });
    claims.set(itemId, list);
  }
  const items: Item[] = itemRows.map((row) => {
    const category = asCategory(row.category) ?? "other";
    const source = row.source === "guest" ? "guest" : "host";
    return {
      id: text(row.id),
      name: text(row.name),
      category,
      details: text(row.details),
      needed: integer(row.needed),
      source,
      claims: claims.get(text(row.id)) ?? [],
    };
  });
  items.sort((a, b) => {
    const byCategory = rank(a.category) - rank(b.category);
    if (byCategory !== 0) return byCategory;
    return a.name.localeCompare(b.name);
  });
  const timeZone = text(eventRow.time_zone);
  return {
    event: {
      title: text(eventRow.title),
      startsAt: iso(eventRow.starts_at),
      endsAt: iso(eventRow.ends_at),
      timeZone: isTimeZone(timeZone) ? timeZone : "America/New_York",
      placeName: text(eventRow.place_name),
      placeAddress: text(eventRow.place_address),
      notes: text(eventRow.notes),
    },
    items,
  };
}

let seeding: Promise<void> | null = null;

function ensureSeed(): Promise<void> {
  seeding ??= seed().catch((error: unknown) => {
    seeding = null;
    throw error;
  });
  return seeding;
}

async function seed(): Promise<void> {
  await withTransaction(async (query) => {
    const inserted = await query(
      `insert into event (id, title, starts_at, ends_at, time_zone, place_name, place_address, notes)
       values (1, $1, null, null, $2, '', '', $3)
       on conflict (id) do nothing
       returning id`,
      [
        "Friendsgiving",
        "America/New_York",
        "Come hungry. If a dish has nuts or gluten, a little note on the signup helps.",
      ],
    );
    if (inserted.length === 0) return;
    const starters: Array<[string, Category, string, number]> = [
      ["Baked mac and cheese", "main", "A pan is plenty", 1],
      ["Sourdough stuffing", "side", "Herbs and celery welcome", 1],
      ["Mashed potatoes", "side", "", 1],
      ["Green beans", "side", "", 1],
      ["Cranberry-orange relish", "side", "", 1],
      ["Pumpkin pie", "dessert", "", 1],
      ["Apple cider", "drink", "A jug or a couple of bottles", 2],
      ["Plates, cups, and napkins", "supplies", "", 1],
    ];
    for (const [name, category, details, needed] of starters) {
      await query(
        "insert into items (id, name, category, details, needed, source) values ($1, $2, $3, $4, $5, 'host')",
        [crypto.randomUUID(), name, category, details, needed],
      );
    }
  });
}

async function readFresh(): Promise<Potluck> {
  await ensureSeed();
  return load(sql);
}

export const getPotluck = cache(readFresh);

async function finish(
  outcome: { ok: false; status: number; error: string } | { ok: true },
): Promise<ActionResult> {
  if (!outcome.ok) return outcome;
  return { ok: true, potluck: await readFresh() };
}

type ParsedItem =
  | { ok: true; name: string; category: Category; details: string; needed: number }
  | { ok: false; status: number; error: string };

function parseItem(input: unknown, guest = false): ParsedItem {
  const body = bodyOf(input);
  const name = cleanLine(body.name, 80);
  if (!name.value) return { ok: false, status: 400, error: "Name the dish." };
  if (name.tooLong) return { ok: false, status: 400, error: "Keep the dish name under 80 characters." };
  const category = asCategory(body.category);
  if (!category) return { ok: false, status: 400, error: "Pick a category." };
  const details = cleanNote(body.details, 240);
  if (details.tooLong) return { ok: false, status: 400, error: "Keep that note a little shorter." };
  const needed = guest ? 1 : asInt(body.needed, 1, 12);
  if (needed == null) return { ok: false, status: 400, error: "Spots should be a number from 1 to 12." };
  return { ok: true, name: name.value, category, details: details.value, needed };
}

function parseGuest(
  body: Record<string, unknown>,
): { ok: true; guestName: string; note: string } | { ok: false; status: number; error: string } {
  const guestName = cleanLine(body.guestName, 40);
  if (!guestName.value) {
    return { ok: false, status: 400, error: "Add your name so people know who's bringing it." };
  }
  if (guestName.tooLong) return { ok: false, status: 400, error: "Keep your name under 40 characters." };
  const note = cleanNote(body.note, 160);
  if (note.tooLong) return { ok: false, status: 400, error: "Keep that note a little shorter." };
  return { ok: true, guestName: guestName.value, note: note.value };
}

export async function updateEvent(input: unknown): Promise<ActionResult> {
  await ensureSeed();
  const body = bodyOf(input);
  const title = cleanLine(body.title, 80);
  if (!title.value) return { ok: false, status: 400, error: "Add a hero title." };
  if (title.tooLong) return { ok: false, status: 400, error: "Keep the hero title under 80 characters." };
  const placeName = cleanLine(body.placeName, 120);
  if (placeName.tooLong) return { ok: false, status: 400, error: "Keep the place name shorter." };
  const placeAddress = cleanLine(body.placeAddress, 200);
  if (placeAddress.tooLong) return { ok: false, status: 400, error: "Keep the address shorter." };
  const notes = cleanNote(body.notes, 800);
  if (notes.tooLong) return { ok: false, status: 400, error: "Keep the note under 800 characters." };
  const zone = typeof body.timeZone === "string" ? body.timeZone : "";
  if (!isTimeZone(zone)) return { ok: false, status: 400, error: "Pick a timezone." };
  const timeZone: TimeZoneId = zone;
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (date || startTime || endTime) {
    if (!date) return { ok: false, status: 400, error: "Add the date." };
    if (!startTime) return { ok: false, status: 400, error: "Add a start time." };
    startsAt = parseWall(date, startTime, timeZone);
    if (!startsAt) return { ok: false, status: 400, error: "That start time doesn't work in this timezone." };
    if (endTime) {
      endsAt = parseWall(date, endTime, timeZone);
      if (!endsAt) return { ok: false, status: 400, error: "That end time doesn't work in this timezone." };
      if (endsAt.getTime() <= startsAt.getTime()) {
        return { ok: false, status: 400, error: "The end time should be after the start." };
      }
    }
  }
  await sql(
    "update event set title = $1, starts_at = $2, ends_at = $3, time_zone = $4, place_name = $5, place_address = $6, notes = $7 where id = 1",
    [
      title.value,
      startsAt ? startsAt.toISOString() : null,
      endsAt ? endsAt.toISOString() : null,
      timeZone,
      placeName.value,
      placeAddress.value,
      notes.value,
    ],
  );
  return { ok: true, potluck: await readFresh() };
}

async function itemCount(query: Sql): Promise<number> {
  const rows = await query("select count(*)::int as n from items");
  return integer(rows[0]?.n);
}

export async function addHostItem(input: unknown): Promise<ActionResult> {
  await ensureSeed();
  const parsed = parseItem(input);
  if (!parsed.ok) return parsed;
  const outcome = await withTransaction(async (query) => {
    if ((await itemCount(query)) >= MAX_ITEMS) {
      return { ok: false as const, status: 400, error: "The list is full." };
    }
    await query(
      "insert into items (id, name, category, details, needed, source) values ($1, $2, $3, $4, $5, 'host')",
      [crypto.randomUUID(), parsed.name, parsed.category, parsed.details, parsed.needed],
    );
    return { ok: true as const };
  });
  return finish(outcome);
}

export async function addGuestItem(input: unknown): Promise<ActionResult> {
  await ensureSeed();
  const raw = bodyOf(input);
  if (typeof raw.details !== "string" && typeof raw.note === "string") raw.details = raw.note;
  const parsed = parseItem(raw, true);
  if (!parsed.ok) return parsed;
  const guest = parseGuest(raw);
  if (!guest.ok) return guest;
  const outcome = await withTransaction(async (query) => {
    if ((await itemCount(query)) >= MAX_ITEMS) {
      return { ok: false as const, status: 400, error: "The list is full." };
    }
    const itemId = crypto.randomUUID();
    const claimId = crypto.randomUUID();
    await query(
      "insert into items (id, name, category, details, needed, source) values ($1, $2, $3, $4, 1, 'guest')",
      [itemId, parsed.name, parsed.category, parsed.details],
    );
    await query(
      "insert into claims (id, item_id, guest_name, quantity, note) values ($1, $2, $3, 1, '')",
      [claimId, itemId, guest.guestName],
    );
    return { ok: true as const };
  });
  return finish(outcome);
}

export async function updateItem(itemId: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(itemId)) return { ok: false, status: 404, error: "That dish is no longer on the list." };
  const parsed = parseItem(input);
  if (!parsed.ok) return parsed;
  const outcome = await withTransaction(async (query) => {
    const items = await query("select id from items where id = $1 for update", [itemId]);
    if (!items[0]) return { ok: false as const, status: 404, error: "That dish is no longer on the list." };
    const takenRows = await query("select coalesce(sum(quantity), 0)::int as taken from claims where item_id = $1", [
      itemId,
    ]);
    if (parsed.needed < integer(takenRows[0]?.taken)) {
      return { ok: false as const, status: 409, error: "People have already claimed more spots than that." };
    }
    await query("update items set name = $1, category = $2, details = $3, needed = $4 where id = $5", [
      parsed.name,
      parsed.category,
      parsed.details,
      parsed.needed,
      itemId,
    ]);
    return { ok: true as const };
  });
  return finish(outcome);
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  if (!isUuid(itemId)) return { ok: false, status: 404, error: "That dish is no longer on the list." };
  const rows = await sql("delete from items where id = $1 returning id", [itemId]);
  if (rows.length === 0) return { ok: false, status: 404, error: "That dish is no longer on the list." };
  return { ok: true, potluck: await readFresh() };
}

export async function claimItem(itemId: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(itemId)) return { ok: false, status: 404, error: "That dish is no longer on the list." };
  const body = bodyOf(input);
  const guest = parseGuest(body);
  if (!guest.ok) return guest;
  const quantity = asInt(body.quantity ?? 1, 1, 12);
  if (quantity == null) return { ok: false, status: 400, error: "Pick how many you're bringing." };
  const outcome = await withTransaction(async (query) => {
    const items = await query("select needed from items where id = $1 for update", [itemId]);
    if (!items[0]) return { ok: false as const, status: 404, error: "That dish is no longer on the list." };
    const takenRows = await query("select coalesce(sum(quantity), 0)::int as taken from claims where item_id = $1", [
      itemId,
    ]);
    const remaining = integer(items[0].needed) - integer(takenRows[0]?.taken);
    if (quantity > remaining) {
      return {
        ok: false as const,
        status: 409,
        error: remaining <= 0 ? "Someone just claimed the last spot." : `Only ${remaining} left.`,
      };
    }
    const id = crypto.randomUUID();
    await query("insert into claims (id, item_id, guest_name, quantity, note) values ($1, $2, $3, $4, $5)", [
      id,
      itemId,
      guest.guestName,
      quantity,
      guest.note,
    ]);
    return { ok: true as const };
  });
  return finish(outcome);
}

export async function releaseClaim(claimId: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(claimId)) return { ok: false, status: 404, error: "That signup is already gone." };
  const guestName = cleanLine(bodyOf(input).guestName, 40);
  if (guestName.tooLong) return { ok: false, status: 400, error: "Keep your name under 40 characters." };
  const outcome = await withTransaction(async (query) => {
    const rows = await query("select item_id, guest_name from claims where id = $1 for update", [claimId]);
    const row = rows[0];
    if (!row) return { ok: false as const, status: 404, error: "That signup is already gone." };
    if (guestName.value && !namesMatch(guestName.value, text(row.guest_name))) {
      return { ok: false as const, status: 403, error: "That signup is under a different name." };
    }
    const itemId = text(row.item_id);
    await query("delete from claims where id = $1", [claimId]);
    const items = await query("select source from items where id = $1", [itemId]);
    const left = await query("select count(*)::int as n from claims where item_id = $1", [itemId]);
    if (items[0]?.source === "guest" && integer(left[0]?.n) === 0) {
      await query("delete from items where id = $1", [itemId]);
    }
    return { ok: true as const };
  });
  return finish(outcome);
}
