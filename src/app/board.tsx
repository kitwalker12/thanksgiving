"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Hero, type HeroFact } from "@/components/hero";
import { send } from "@/lib/send";
import { mapsUrl, scheduleParts } from "@/lib/time";
import { CATEGORIES, namesMatch, spotsLeft, takenCount, type Category, type Item, type Potluck } from "@/lib/types";

const NAME_KEY = "friendsgiving-name";

type Filter = "all" | "open" | "covered";
type Sheet = { type: "claim"; itemId: string } | { type: "bring" } | null;

function progressLabel(item: Item): string {
  const taken = takenCount(item);
  if (taken <= 0) return "Still open";
  if (taken >= item.needed) return "Covered";
  return `${taken} of ${item.needed} covered`;
}

export function Board({ initial }: { initial: Potluck }) {
  const [potluck, setPotluck] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [dish, setDish] = useState("");
  const [category, setCategory] = useState<Category>("side");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  function updateName(value: string) {
    setName(value);
    localStorage.setItem(NAME_KEY, value);
  }

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    const stamp = revision.current;
    try {
      const response = await fetch("/api/potluck");
      if (!response.ok) return;
      const data = (await response.json()) as { potluck?: Potluck };
      if (pendingRef.current || stamp !== revision.current) return;
      if (data.potluck) setPotluck(data.potluck);
    } catch {
      // Keep the dishes already on screen.
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [sheet]);

  async function claim(item: Item) {
    const guestName = name.trim();
    if (!guestName) {
      setError("Add your name so people know who's bringing it.");
      return;
    }
    const quantity = Math.max(1, Math.min(qty, spotsLeft(item)));
    revision.current += 1;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const result = await send(`/api/items/${item.id}/claim`, "POST", { guestName, quantity, note });
    if (result.potluck) setPotluck(result.potluck);
    pendingRef.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that. Try again.");
      return;
    }
    updateName(guestName);
    setStatus(`You're down for ${item.name}. Come back as ${guestName} to claim another.`);
    setSheet(null);
    setNote("");
    setQty(1);
  }

  async function bring(event: FormEvent) {
    event.preventDefault();
    const guestName = name.trim();
    if (!guestName) {
      setError("Add your name so people know who's bringing it.");
      return;
    }
    if (!dish.trim()) {
      setError("Name the dish.");
      return;
    }
    revision.current += 1;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const result = await send("/api/items", "POST", {
      kind: "bringing",
      name: dish,
      category,
      details: note,
      guestName,
    });
    if (result.potluck) setPotluck(result.potluck);
    pendingRef.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't add that. Try again.");
      return;
    }
    updateName(guestName);
    setStatus(`${dish.trim()} is on the table under ${guestName}. Use the same name next time.`);
    setSheet(null);
    setDish("");
    setNote("");
  }

  async function release(claimId: string) {
    const guestName = name.trim();
    if (!guestName) {
      setError("Add your name to change a signup.");
      return;
    }
    revision.current += 1;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const result = await send(`/api/claims/${claimId}`, "DELETE", { guestName });
    if (result.potluck) setPotluck(result.potluck);
    pendingRef.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't undo that.");
      return;
    }
    setStatus("Taken off your list.");
  }

  const when = scheduleParts(potluck.event);
  const facts: HeroFact[] = [];
  if (when) facts.push({ icon: "when", text: when.date, detail: when.time });
  if (potluck.event.placeName || potluck.event.placeAddress) {
    const address = potluck.event.placeAddress;
    const place = potluck.event.placeName;
    facts.push({
      icon: "where",
      text: place || address,
      detail: place && address ? address : undefined,
      href: mapsUrl(address || place),
    });
  }

  const visible = potluck.items.filter((item) => {
    const open = spotsLeft(item) > 0;
    if (filter === "open") return open;
    if (filter === "covered") return !open;
    return true;
  });
  const groups = CATEGORIES.map((entry) => ({
    ...entry,
    items: visible.filter((item) => item.category === entry.id),
  })).filter((group) => group.items.length > 0);
  const openSpots = potluck.items.reduce((sum, item) => sum + spotsLeft(item), 0);
  const yours = potluck.items.flatMap((item) =>
    item.claims.filter((entry) => namesMatch(entry.guestName, name)).map((entry) => ({ item, claim: entry })),
  );
  const claimItem = sheet?.type === "claim" ? potluck.items.find((item) => item.id === sheet.itemId) : undefined;
  const claimLeft = claimItem ? spotsLeft(claimItem) : 0;

  return (
    <>
      <Hero
        eyebrow="Pull up a chair"
        title={potluck.event.title}
        facts={facts}
        notes={potluck.event.notes}
        showPlaceholder={facts.length === 0}
      />
      <section className="sheet" id="table">
        <div className="sheet-inner roomy">
          <noscript>Turn on JavaScript to claim a dish or add your own.</noscript>
          <label className="field">
            Your name
            <span className="help">Remembered on this phone. Come back and use the same name to claim another dish.</span>
            <input
              value={name}
              onChange={(event) => updateName(event.target.value)}
              autoComplete="name"
              maxLength={40}
              placeholder="Jordan"
            />
          </label>
          {yours.length > 0 ? (
            <section className="yours">
              <h3>You're bringing</h3>
              <ul className="claims">
                {yours.map(({ item, claim: entry }) => (
                  <li key={entry.id}>
                    <span>
                      {item.name}
                      {entry.quantity > 1 ? ` · ${entry.quantity}` : ""}
                    </span>
                    <button type="button" className="linkish" onClick={() => void release(entry.id)} disabled={pending}>
                      Never mind
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="section-head">
            <h2>The table</h2>
            <p>
              {openSpots === 0
                ? "Every requested dish is covered. You can still bring something extra."
                : `${openSpots} spot${openSpots === 1 ? "" : "s"} still open`}
            </p>
          </div>
          {status ? <p className="banner" role="status">{status}</p> : null}
          {error && !sheet ? <p className="banner bad" role="alert">{error}</p> : null}
          <div className="chips">
            {(
              [
                ["all", "All"],
                ["open", "Still open"],
                ["covered", "Covered"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          {groups.length === 0 ? (
            <p className="empty">
              {potluck.items.length === 0
                ? "Nothing is on the list yet. Bring something you love, or ask the host to add dishes."
                : "Nothing in this view."}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.id} className="group">
                <h3 className="group-title">{group.label}</h3>
                {group.items.map((item) => {
                  const taken = takenCount(item);
                  const open = spotsLeft(item) > 0;
                  const pct = item.needed === 0 ? 0 : Math.min(100, Math.round((taken / item.needed) * 100));
                  return (
                    <article key={item.id} className={open ? "dish" : "dish covered"} data-cat={item.category}>
                      <div className="dish-top">
                        <h3>{item.name}</h3>
                        {item.source === "guest" ? <span className="pill">Extra</span> : null}
                      </div>
                      {item.details ? <p className="details">{item.details}</p> : null}
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <p className="progress">{progressLabel(item)}</p>
                      {item.claims.length > 0 ? (
                        <ul className="claims">
                          {item.claims.map((entry) => (
                            <li key={entry.id}>
                              <span>
                                {entry.guestName}
                                {entry.quantity > 1 ? ` is bringing ${entry.quantity}` : " is bringing this"}
                                {entry.note ? <span className="claim-note"> · {entry.note}</span> : null}
                              </span>
                              {namesMatch(entry.guestName, name) ? (
                                <button type="button" className="linkish" onClick={() => void release(entry.id)} disabled={pending}>
                                  Never mind
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {open ? (
                        <button
                          type="button"
                          className="btn block"
                          onClick={() => {
                            setError(null);
                            setNote("");
                            setQty(1);
                            setSheet({ type: "claim", itemId: item.id });
                          }}
                        >
                          I'll bring this
                          <span className="sr-only"> {item.name}</span>
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            ))
          )}
          <p className="footer-note">Bringing something that isn't listed? Add it with the button below.</p>
          <div className="dock">
            <button
              type="button"
              className="btn block"
              onClick={() => {
                setError(null);
                setNote("");
                setDish("");
                setSheet({ type: "bring" });
              }}
            >
              Bring something else
            </button>
          </div>
        </div>
      </section>
      {sheet ? (
        <div className="overlay">
          <button type="button" className="backdrop" aria-label="Close" onClick={() => setSheet(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="sheet-title" className="sheet-panel">
            <div className="grabber" />
            {sheet.type === "claim" && claimItem ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void claim(claimItem);
                }}
              >
                <h2 id="sheet-title">I'll bring {claimItem.name}</h2>
                {error ? <p className="banner bad" role="alert">{error}</p> : null}
                <label className="field">
                  Your name
                  <input id="guest-name" value={name} onChange={(event) => updateName(event.target.value)} autoComplete="name" maxLength={40} required />
                </label>
                {claimLeft > 1 ? (
                  <div className="field">
                    How many
                    <div className="stepper">
                      <button type="button" aria-label="Fewer" onClick={() => setQty((value) => Math.max(1, value - 1))}>
                        –
                      </button>
                      <strong>{Math.min(qty, claimLeft)}</strong>
                      <button type="button" aria-label="More" onClick={() => setQty((value) => Math.min(claimLeft, value + 1))}>
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
                <label className="field">
                  Note <span className="help">optional</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={160} placeholder="Vegetarian, has pecans…" />
                </label>
                <button className="btn block" type="submit" disabled={pending || claimLeft < 1}>
                  {pending ? "Saving..." : "Count me in"}
                </button>
              </form>
            ) : sheet.type === "claim" ? (
              <>
                <h2 id="sheet-title">That dish is gone</h2>
                <button type="button" className="btn" onClick={() => setSheet(null)}>
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={(event) => void bring(event)}>
                <h2 id="sheet-title">Bring something else</h2>
                {error ? <p className="banner bad" role="alert">{error}</p> : null}
                <label className="field">
                  What are you bringing?
                  <input value={dish} onChange={(event) => setDish(event.target.value)} maxLength={80} required placeholder="Pecan pie" />
                </label>
                <label className="field">
                  Category
                  <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                    {CATEGORIES.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Your name
                  <input value={name} onChange={(event) => updateName(event.target.value)} autoComplete="name" maxLength={40} required />
                </label>
                <label className="field">
                  Note <span className="help">optional</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder="Has walnuts, needs the oven…" />
                </label>
                <button className="btn block" type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Add it to the table"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
