export function Sprig({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 110" aria-hidden="true">
      <path
        d="M18 96c28-10 52-28 78-46 16-12 32-22 50-30"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="62" cy="62" rx="18" ry="9" transform="rotate(-28 62 62)" fill="currentColor" />
      <ellipse cx="92" cy="44" rx="20" ry="10" transform="rotate(-42 92 44)" fill="currentColor" />
      <ellipse cx="122" cy="26" rx="16" ry="8" transform="rotate(-55 122 26)" fill="currentColor" />
      <ellipse cx="78" cy="74" rx="14" ry="7" transform="rotate(18 78 74)" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function Pumpkin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 48" aria-hidden="true">
      <path d="M33 7c2 3.2 2.4 5.4 1.6 7" fill="none" stroke="#f0d48a" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="24" cy="29" rx="11" ry="13" fill="#c85b2c" />
      <ellipse cx="40" cy="29" rx="11" ry="13" fill="#c85b2c" />
      <ellipse cx="32" cy="28" rx="12" ry="15" fill="#e4843a" />
      <ellipse cx="32" cy="28" rx="6" ry="14" fill="#f0a04a" />
      <path d="M32 15c-.4 8-.2 16 .2 26" fill="none" stroke="#9a3f1d" strokeWidth="1.3" opacity="0.55" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3.2v4M16 3.2v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.15" fill="currentColor" />
    </svg>
  );
}
