import { Link } from "react-router-dom";
import { APP_NAME } from "@/lib/config";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-fg" />
      <path d="M18 44V20h14a8 8 0 0 1 0 16h-6l10 8" fill="none" stroke="#c9a84c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="22" r="4" className="fill-bg" />
    </svg>
  );
}

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
