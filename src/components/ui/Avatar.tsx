import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated font-display text-sm font-bold text-gold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
