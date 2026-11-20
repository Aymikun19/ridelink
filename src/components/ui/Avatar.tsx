import { useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Avatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-elevated font-display text-sm font-bold text-gold",
        className,
      )}
    >
      {src && !failed ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
