import { useEffect, useState } from "react";
import { Clock, Flag, MapPin, Navigation, StickyNote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { REQUEST_POPUP_SECONDS } from "@/lib/config";
import { formatDistance, formatDuration, timeAgo } from "@/lib/format";
import type { LatLng } from "@/lib/geo";
import type { NearbyRequest } from "@/types";

interface Props {
  request: NearbyRequest;
  queued: number;
  driverPosition: LatLng | null;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
}

export function IncomingRequestModal({ request, queued, busy, onAccept, onDecline, onTimeout }: Props) {
  const [left, setLeft] = useState(REQUEST_POPUP_SECONDS);

  useEffect(() => {
    if (busy) return;
    const t = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (left <= 0) onTimeout();
  }, [left, onTimeout]);

  const pickupKm = request.pickup_distance_km;

  return (
    <Modal open dismissible={false} className="overflow-hidden p-0">
      <div className="relative h-1 w-full bg-line">
        <div
          className="absolute inset-y-0 left-0 w-full origin-left bg-gold"
          style={{ animation: `rl-shrink ${REQUEST_POPUP_SECONDS}s linear forwards`, animationPlayState: busy ? "paused" : "running" }}
        />
      </div>
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">New ride request</p>
            <p className="mt-1 text-sm text-muted">
              {left > 0 ? `${left}s to respond` : "Expired"}
              {queued > 0 && ` · ${queued} more waiting`}
            </p>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-gold" />
          </span>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <Avatar name={request.customer_name} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{request.customer_name || "Customer"}</p>
            <p className="text-xs text-muted">Requested {timeAgo(request.requested_at)}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-bg/50 p-4">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg" />
            <div className="min-w-0">
              <p className="text-xs text-subtle">Pickup · {formatDistance(pickupKm * 1000)} from you</p>
              <p className="text-sm font-medium leading-snug">{request.pickup_address}</p>
            </div>
          </div>
          <div className="ml-2 h-4 border-l border-dashed border-line" />
          <div className="flex gap-3">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="text-xs text-subtle">Drop-off</p>
              <p className="text-sm font-medium leading-snug">{request.dropoff_address}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          {request.distance_m != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
              <Navigation className="h-3.5 w-3.5" /> Trip {formatDistance(request.distance_m)}
            </span>
          )}
          {request.duration_s != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
              <Clock className="h-3.5 w-3.5" /> About {formatDuration(request.duration_s)}
            </span>
          )}
        </div>

        {request.notes && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-gold/10 p-3 text-sm text-fg">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            {request.notes}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={onDecline} disabled={busy}>
            Decline
          </Button>
          <Button variant="gold" size="lg" onClick={onAccept} loading={busy}>
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
}
