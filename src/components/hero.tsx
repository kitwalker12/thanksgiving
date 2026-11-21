import type { ReactNode } from "react";
import { CalendarIcon, PinIcon, Pumpkin, Sprig } from "./marks";

export type HeroFact = {
  icon: "when" | "where";
  text: string;
  detail?: string;
  href?: string;
};

function safeMap(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.hostname !== "www.google.com") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function Hero({
  eyebrow,
  title,
  facts = [],
  notes,
  compact = false,
  showPlaceholder = false,
  children,
}: {
  eyebrow: string;
  title: string;
  facts?: HeroFact[];
  notes?: string;
  compact?: boolean;
  showPlaceholder?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={compact ? "hero compact" : "hero"}>
      <Sprig className="sprig left" />
      <Sprig className="sprig right" />
      <div className="hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="rule" aria-hidden="true">
          <span />
          <Pumpkin />
          <span />
        </div>
        {facts.length > 0 ? (
          <div className="facts">
            {facts.map((fact) => {
              const href = safeMap(fact.href);
              return (
                <p key={fact.icon}>
                  {fact.icon === "when" ? <CalendarIcon /> : <PinIcon />}
                  <span>
                    {fact.text}
                    {fact.detail ? (
                      <>
                        <br />
                        {fact.detail}
                      </>
                    ) : null}
                    {href ? (
                      <>
                        {" "}
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          Directions
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              );
            })}
          </div>
        ) : showPlaceholder ? (
          <p className="hero-notes">Time and place coming soon.</p>
        ) : null}
        {notes ? <p className="hero-notes">{notes}</p> : null}
        {children ? <div className="hero-links">{children}</div> : null}
      </div>
    </header>
  );
}
