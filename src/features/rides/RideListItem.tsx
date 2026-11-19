import { Link } from "react-router-dom";
import { ChevronRight, Flag, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDistance } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Ride } from "@/types";
import { statusMeta } from "./status";

export function RideListItem({ ride, compact }: { ride: Ride; compact?: boolean }) {
  const meta = statusMeta[ride.status];
  return (
    <Link
      to={`/ride/${ride.id}`}
      className={cn(
        "group flex items-center gap-4 rounded-3xl border border-line bg-surface transition hover:border-gold/40",
        compact ? "p-3.5" : "p-5",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{ride.status === "requested" ? "Searching" : meta.label}</Badge>
          <span className="text-xs text-subtle">{formatDateTime(ride.requested_at)}</span>
          {ride.distance_m != null && <span className="text-xs text-subtle">· {formatDistance(ride.distance_m)}</span>}
          {ride.customer_rating != null && (
            <span className="inline-flex items-center gap-0.5 text-xs text-gold">
              <Star className="h-3 w-3 fill-current" /> {ride.customer_rating}
            </span>
          )}
        </div>
        <p className="flex items-center gap-2 truncate text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-subtle" />
          <span className="truncate">{ride.pickup_address}</span>
        </p>
        <p className="flex items-center gap-2 truncate text-sm">
          <Flag className="h-3.5 w-3.5 shrink-0 text-gold" />
          <span className="truncate">{ride.dropoff_address}</span>
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-fg" />
    </Link>
  );
}
