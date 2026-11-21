"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="sheet">
      <div className="sheet-inner">
        <h1 className="display">The table didn't load.</h1>
        <p>Give it another try in a moment.</p>
        <button className="btn" type="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
