import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import type { Ride } from "@/types";
import { statusSteps } from "./status";

const stamp: Record<string, keyof Ride> = {
  requested: "requested_at",
  accepted: "accepted_at",
  arrived: "arrived_at",
  in_progress: "started_at",
  completed: "completed_at",
};

export function StatusTimeline({ ride }: { ride: Ride }) {
  const currentIndex = statusSteps.findIndex((s) => s.key === ride.status);
  return (
    <ol className="flex items-start">
      {statusSteps.map((step, i) => {
        const done = ride.status !== "cancelled" && i <= currentIndex;
        const current = i === currentIndex && ride.status !== "completed";
        const at = ride[stamp[step.key]] as string | null;
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", i <= currentIndex && ride.status !== "cancelled" ? "bg-gold" : "bg-line")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px]",
                done ? "border-gold bg-gold text-[#0b0b0b]" : "border-line bg-surface text-subtle",
                current && "ring-4 ring-gold/20",
              )}
            >
              {done && !current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[11px] leading-tight", done ? "text-fg" : "text-subtle")}>{step.label}</span>
            {at && done && <span className="text-[10px] text-subtle">{formatTime(at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
