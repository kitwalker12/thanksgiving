"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Hero } from "@/components/hero";
import { send } from "@/lib/send";
import { TIME_ZONES, wallParts } from "@/lib/time";
import { CATEGORIES, takenCount, type Category, type Potluck, type PotluckEvent } from "@/lib/types";

type Draft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  placeName: string;
  placeAddress: string;
  notes: string;
};

type ItemDraft = {
  name: string;
  category: Category;
  details: string;
  needed: string;
};

function draftFrom(event: PotluckEvent): Draft {
  const start = wallParts(event.startsAt, event.timeZone);
  const end = wallParts(event.endsAt, event.timeZone);
  return {
    title: event.title,
    date: start.date,
    startTime: start.time,
    endTime: event.endsAt ? end.time : "",
    timeZone: event.timeZone,
    placeName: event.placeName,
    placeAddress: event.placeAddress,
    notes: event.notes,
  };
}

export function Console({ initial }: { initial: Potluck }) {
  const [potluck, setPotluck] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial.event));
  const [dish, setDish] = useState<ItemDraft>({ name: "", category: "side", details: "", needed: "1" });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<ItemDraft>({ name: "", category: "side", details: "", needed: "1" });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const incomplete = useMemo(
    () => !potluck.event.startsAt || !potluck.event.placeName,
    [potluck.event.placeName, potluck.event.startsAt],
  );

  function apply(next: Potluck | undefined) {
    if (!next) return;
    setPotluck(next);
  }

  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await send("/api/event", "POST", draft);
    setPending(false);
    if (!result.ok || !result.potluck) {
      setError(result.error ?? "Couldn't save that.");
      return;
    }
    apply(result.potluck);
    setDraft(draftFrom(result.potluck.event));
    setStatus("Saved. Friends will see this at the top of the page.");
  }

  async function addDish(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await send("/api/items", "POST", {
      kind: "request",
      name: dish.name,
      category: dish.category,
      details: dish.details,
      needed: Number(dish.needed),
    });
    setPending(false);
    if (!result.ok || !result.potluck) {
      setError(result.error ?? "Couldn't add that dish.");
      return;
    }
    apply(result.potluck);
    setDish({ name: "", category: dish.category, details: "", needed: "1" });
    setStatus("Dish added. It shows up as open until someone claims it.");
  }

  async function saveDish(id: string) {
    setPending(true);
    setError(null);
    const result = await send(`/api/items/${id}`, "PATCH", {
      name: edit.name,
      category: edit.category,
      details: edit.details,
      needed: Number(edit.needed),
    });
    setPending(false);
    if (!result.ok || !result.potluck) {
      setError(result.error ?? "Couldn't update that dish.");
      return;
    }
    apply(result.potluck);
    setEditing(null);
    setStatus("Dish updated.");
  }

  async function removeItem(id: string) {
    setPending(true);
    setError(null);
    const result = await send(`/api/items/${id}`, "DELETE");
    setPending(false);
    if (!result.ok || !result.potluck) {
      setError(result.error ?? "Couldn't remove that dish.");
      return;
    }
    apply(result.potluck);
    setConfirming(null);
    setStatus("Dish removed.");
  }

  async function removeClaim(id: string) {
    setPending(true);
    setError(null);
    const result = await send(`/api/claims/${id}`, "DELETE", {});
    setPending(false);
    if (!result.ok || !result.potluck) {
      setError(result.error ?? "Couldn't remove that signup.");
      return;
    }
    apply(result.potluck);
    setConfirming(null);
    setStatus("Signup removed.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/`);
      setError(null);
      setStatus("Link copied. Send it to anyone bringing a dish.");
    } catch {
      setError("Couldn't copy. Open the guest page and copy the address from the browser.");
    }
  }

  return (
    <>
      <Hero eyebrow="For the host" title="Hosting" compact>
        <Link href="/">View the table</Link>
      </Hero>
      <div className="sheet">
        <div className="sheet-inner" id="table">
          {status ? <p className="banner" role="status">{status}</p> : null}
          {error ? <p className="banner bad" role="alert">{error}</p> : null}
          <p className="footer-note">Friends only add their name on the guest page. This page stays with you.</p>
            <>
              {incomplete ? (
                <p className="hint">Add the time and place before you share the link, so people know when to show up.</p>
              ) : null}
              <form onSubmit={(event) => void saveEvent(event)}>
                <h2 className="block-title">The invitation</h2>
                <label className="field">
                  Hero title
                  <span className="help">The big line at the top. For example, Payal & Adi's Friendsgiving.</span>
                  <input
                    className="title-input"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    maxLength={80}
                    placeholder="Payal & Adi's Friendsgiving"
                    required
                  />
                </label>
                <label className="field">
                  Date
                  <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
                </label>
                <div className="times">
                  <label className="field">
                    Starts
                    <input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} />
                  </label>
                  <label className="field">
                    Ends
                    <input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
                  </label>
                </div>
                <label className="field">
                  Timezone
                  <span className="help">Friends see this clock time, with the timezone named, wherever they are.</span>
                  <select value={draft.timeZone} onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}>
                    {TIME_ZONES.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Place
                  <input
                    value={draft.placeName}
                    onChange={(event) => setDraft({ ...draft, placeName: event.target.value })}
                    maxLength={120}
                    placeholder="Our apartment"
                  />
                </label>
                <label className="field">
                  Address
                  <input
                    value={draft.placeAddress}
                    onChange={(event) => setDraft({ ...draft, placeAddress: event.target.value })}
                    maxLength={200}
                    placeholder="Street, city"
                  />
                </label>
                <label className="field">
                  Note
                  <textarea
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    maxLength={800}
                  />
                </label>
                <div className="form-actions">
                  <button className="btn" type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save details"}
                  </button>
                  <button className="btn secondary" type="button" onClick={() => void copyLink()}>
                    Copy guest link
                  </button>
                </div>
              </form>

              <form onSubmit={(event) => void addDish(event)}>
                <h2 className="block-title">Add a dish</h2>
                <label className="field">
                  Dish
                  <input value={dish.name} onChange={(event) => setDish({ ...dish, name: event.target.value })} maxLength={80} required placeholder="Green bean casserole" />
                </label>
                <label className="field">
                  Category
                  <select value={dish.category} onChange={(event) => setDish({ ...dish, category: event.target.value as Category })}>
                    {CATEGORIES.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Spots to fill
                  <span className="help">How many people need to bring this.</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    inputMode="numeric"
                    value={dish.needed}
                    onChange={(event) => setDish({ ...dish, needed: event.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  Note <span className="help">optional</span>
                  <input value={dish.details} onChange={(event) => setDish({ ...dish, details: event.target.value })} maxLength={240} />
                </label>
                <button className="btn" type="submit" disabled={pending}>
                  Add to the list
                </button>
              </form>

              <h2 className="block-title">On the list</h2>
              {potluck.items.length === 0 ? <p className="empty">No dishes yet.</p> : null}
              {potluck.items.map((item) => (
                <article key={item.id} className="dish" data-cat={item.category}>
                  <div className="dish-top">
                    <h3>{item.name}</h3>
                    {item.source === "guest" ? <span className="pill">Extra</span> : null}
                  </div>
                  {item.details ? <p className="details">{item.details}</p> : null}
                  <p className="progress">
                    {takenCount(item)} of {item.needed} covered
                  </p>
                  {item.claims.length > 0 ? (
                    <ul className="claims">
                      {item.claims.map((entry) => (
                        <li key={entry.id}>
                          <span>
                            {entry.guestName}
                            {entry.quantity > 1 ? ` · ${entry.quantity}` : ""}
                            {entry.note ? <span className="claim-note"> · {entry.note}</span> : null}
                          </span>
                          {confirming === entry.id ? (
                            <button type="button" className="linkish" disabled={pending} onClick={() => void removeClaim(entry.id)}>
                              Confirm remove
                            </button>
                          ) : (
                            <button type="button" className="linkish" onClick={() => setConfirming(entry.id)}>
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {editing === item.id ? (
                    <div className="editor">
                      <label className="field">
                        Dish
                        <input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} maxLength={80} />
                      </label>
                      <label className="field">
                        Category
                        <select value={edit.category} onChange={(event) => setEdit({ ...edit, category: event.target.value as Category })}>
                          {CATEGORIES.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Spots
                        <input type="number" min={1} max={12} value={edit.needed} onChange={(event) => setEdit({ ...edit, needed: event.target.value })} />
                      </label>
                      <label className="field">
                        Note
                        <input value={edit.details} onChange={(event) => setEdit({ ...edit, details: event.target.value })} maxLength={240} />
                      </label>
                      <div className="form-actions">
                        <button type="button" className="btn" disabled={pending} onClick={() => void saveDish(item.id)}>
                          Save dish
                        </button>
                        <button type="button" className="btn quiet" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-row">
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          setEditing(item.id);
                          setEdit({
                            name: item.name,
                            category: item.category,
                            details: item.details,
                            needed: String(item.needed),
                          });
                        }}
                      >
                        Edit
                      </button>
                      {confirming === `item:${item.id}` ? (
                        <button type="button" className="text-btn" disabled={pending} onClick={() => void removeItem(item.id)}>
                          Confirm remove
                        </button>
                      ) : (
                        <button type="button" className="text-btn" onClick={() => setConfirming(`item:${item.id}`)}>
                          Remove dish
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </>
        </div>
      </div>
    </>
  );
}
