import { cn } from "@/lib/cn";

/** Brand loader: the RideLink mark with a soft pulsing gold glow and a light sweep. */
export function LogoLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-5", className)} role="status" aria-live="polite">
      <div className="relative h-20 w-20">
        <span className="rl-glow absolute -inset-6 rounded-[2.5rem] bg-gold/35 blur-2xl" />
        <span className="rl-ring absolute -inset-2 rounded-[1.75rem] border border-gold/40" />
        <svg viewBox="0 0 64 64" className="relative h-20 w-20 overflow-hidden rounded-[1.25rem] shadow-2xl" aria-hidden>
          <defs>
            <linearGradient id="rl-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" fill="#0b0b0b" />
          <path className="rl-draw" d="M20 44V20h13a8 8 0 0 1 0 16h-6l10 8" fill="none" stroke="#c9a84c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="47" cy="22" r="4" fill="#fff" />
          <rect className="rl-sweep" x="-64" y="0" width="48" height="64" fill="url(#rl-sweep)" transform="skewX(-18)" />
        </svg>
      </div>
      {label && <p className="text-sm text-muted">{label}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}
