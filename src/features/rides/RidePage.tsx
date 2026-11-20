import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Car,
  CircleCheck,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Play,
  StickyNote,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { directionsUrl, fetchRoute, haversineMeters, type LatLng, type RouteInfo } from "@/lib/geo";
import { formatDateTime, formatDistance, formatDuration, firstName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { MapView } from "@/features/map/MapView";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { useMessages } from "@/features/chat/useMessages";
import { useOptionalDriver } from "@/features/driver/DriverProvider";
import type { Profile, Ride } from "@/types";
import { advanceRide, cancelRide } from "./rideApi";
import { RateRide } from "./RateRide";
import { StatusTimeline } from "./StatusTimeline";
import { statusMeta } from "./status";
import { useRide } from "./useRide";

type Tab = "trip" | "chat";

const LIVE: Ride["status"][] = ["accepted", "arrived", "in_progress"];

export function RidePage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const driverCtx = useOptionalDriver();
  const { ride, setRide, counterpart, driverStatus, loading, error } = useRide(id, profile?.id);

  const [tab, setTab] = useState<Tab>("trip");
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [eta, setEta] = useState<RouteInfo | null>(null);

  const isDriver = profile?.role === "driver";
  const chatEnabled = Boolean(ride?.driver_id) && (isDriver ? ride?.driver_id === profile?.id : true);
  const chat = useMessages(ride?.id, profile?.id, chatEnabled, tab === "chat");

  // Driver lost the ride (they cancelled and it went back to the pool)
  useEffect(() => {
    if (isDriver && ride && ride.driver_id !== profile?.id && ride.status === "requested") {
      navigate("/app", { replace: true });
    }
  }, [isDriver, ride, profile?.id, navigate]);

  const pickup = useMemo(() => (ride ? { lat: ride.pickup_lat, lng: ride.pickup_lng } : null), [ride?.pickup_lat, ride?.pickup_lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const dropoff = useMemo(() => (ride ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng } : null), [ride?.dropoff_lat, ride?.dropoff_lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where is the driver right now?
  const driverPos: (LatLng & { heading?: number | null }) | null = useMemo(() => {
    if (!ride || !LIVE.includes(ride.status)) return null;
    if (isDriver) return driverCtx?.geo.position ?? null;
    if (driverStatus?.lat != null && driverStatus?.lng != null)
      return { lat: driverStatus.lat, lng: driverStatus.lng, heading: driverStatus.heading };
    return null;
  }, [ride, isDriver, driverCtx?.geo.position, driverStatus]);

  // Full trip route (pickup to drop-off)
  useEffect(() => {
    if (!pickup || !dropoff) return;
    const c = new AbortController();
    fetchRoute(pickup, dropoff, c.signal).then(setRoute).catch(() => undefined);
    return () => c.abort();
  }, [pickup, dropoff]);

  // Live ETA from driver to the next stop, refreshed at most every 30 s or after ~150 m of movement
  const lastEta = useRef<{ at: number; from: LatLng | null; status: string }>({ at: 0, from: null, status: "" });
  useEffect(() => {
    if (!ride || !driverPos || !pickup || !dropoff) {
      setEta(null);
      return;
    }
    if (!["accepted", "in_progress"].includes(ride.status)) {
      setEta(null);
      return;
    }
    const target = ride.status === "accepted" ? pickup : dropoff;
    const prev = lastEta.current;
    const moved = prev.from ? haversineMeters(prev.from, driverPos) : Infinity;
    if (prev.status === ride.status && Date.now() - prev.at < 30_000 && moved < 150) return;
    lastEta.current = { at: Date.now(), from: driverPos, status: ride.status };
    const c = new AbortController();
    fetchRoute(driverPos, target, c.signal).then(setEta).catch(() => undefined);
    return () => c.abort();
  }, [ride, driverPos, pickup, dropoff]);

  if (!profile) return null;
  if (loading) return <FullPageSpinner label="Loading ride" />;
  if (error || !ride) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="font-display text-xl font-bold">Ride unavailable</p>
        <p className="mt-2 text-muted">{error ?? "This ride could not be found."}</p>
        <Link to="/app" className="mt-6 inline-block">
          <Button variant="secondary">Back home</Button>
        </Link>
      </div>
    );
  }

  const meta = statusMeta[ride.status];
  const live = LIVE.includes(ride.status);
  const ended = ride.status === "completed" || ride.status === "cancelled";
  const showChatTab = Boolean(ride.driver_id);
  const mapRoute = live && eta && ride.status === "accepted" ? eta.coordinates : route?.coordinates;

  const run = async (fn: () => Promise<Ride>, success?: string) => {
    setBusy(true);
    try {
      const r = await fn();
      setRide(r);
      if (success) toast({ tone: "success", title: success });
      return r;
    } catch (err) {
      toast({ tone: "error", title: "Action failed", body: readableError(err) });
    } finally {
      setBusy(false);
    }
  };

  const headline = getHeadline(ride, isDriver, counterpart, eta);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Map */}
      <div className="relative h-[38vh] min-h-64 lg:order-2 lg:h-auto lg:flex-1">
        <MapView
          className="absolute inset-0"
          pickup={pickup}
          dropoff={dropoff}
          driver={driverPos}
          route={mapRoute}
          fitKey={`${ride.status}-${driverPos ? "d" : "n"}`}
        />
        <Link
          to={isDriver ? "/app" : "/history"}
          className="absolute left-3 top-3 z-[500] flex h-10 w-10 items-center justify-center rounded-full border border-line bg-elevated/95 shadow-lg backdrop-blur hover:text-gold"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {isDriver && live && pickup && dropoff && (
          <a
            href={directionsUrl(ride.status === "in_progress" ? dropoff : pickup, driverPos)}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full border border-line bg-elevated/95 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur hover:text-gold"
          >
            <Navigation className="h-4 w-4" /> Navigate <ExternalLink className="h-3.5 w-3.5 text-subtle" />
          </a>
        )}
      </div>

      {/* Panel */}
      <div className="relative z-10 -mt-6 flex min-h-0 flex-col rounded-t-[2rem] border-t border-line bg-bg lg:order-1 lg:mt-0 lg:h-[calc(100dvh-4rem)] lg:w-[460px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0">
        <div className="px-5 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={meta.tone} dot={live || ride.status === "requested"}>
              {meta.label}
            </Badge>
            <span className="text-xs text-subtle">{formatDateTime(ride.requested_at)}</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight">{headline.title}</h1>
          {headline.sub && <p className="mt-1 text-sm text-muted">{headline.sub}</p>}

          {showChatTab && (
            <div className="mt-5 grid grid-cols-2 rounded-full border border-line bg-surface p-1">
              {(["trip", "chat"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "relative flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition",
                    tab === t ? "bg-fg text-bg" : "text-muted hover:text-fg",
                  )}
                >
                  {t === "trip" ? <Car className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  {t === "trip" ? "Trip" : "Chat"}
                  {t === "chat" && chat.unread > 0 && tab !== "chat" && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-[#0b0b0b]">
                      {chat.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "chat" && showChatTab ? (
          <ChatPanel
            chat={chat}
            rideId={ride.id}
            me={profile}
            counterpart={counterpart}
            readOnly={ended}
            className="h-[55vh] px-5 pb-5 sm:px-6 lg:h-auto lg:flex-1"
          />
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-8 pt-5 sm:px-6 scrollbar-thin">
            {ride.status === "requested" && !isDriver && <Searching since={ride.requested_at} />}

            {ride.status !== "cancelled" && ride.status !== "requested" && (
              <Card className="p-4">
                <StatusTimeline ride={ride} />
              </Card>
            )}

            {counterpart && ride.driver_id && (
              <CounterpartCard
                person={counterpart}
                isDriverView={isDriver}
                onChat={() => setTab("chat")}
                unread={chat.unread}
                showContact={!ended}
              />
            )}

            <Card className="space-y-3 p-4">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs text-subtle">Pickup</p>
                  <p className="text-sm font-medium">{ride.pickup_address}</p>
                </div>
              </div>
              <div className="ml-2 h-3 border-l border-dashed border-line" />
              <div className="flex gap-3">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div>
                  <p className="text-xs text-subtle">Drop-off</p>
                  <p className="text-sm font-medium">{ride.dropoff_address}</p>
                </div>
              </div>
              {(ride.distance_m != null || ride.duration_s != null) && (
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
                  {ride.distance_m != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
                      <Navigation className="h-3.5 w-3.5" /> {formatDistance(ride.distance_m)}
                    </span>
                  )}
                  {ride.duration_s != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
                      <Clock className="h-3.5 w-3.5" /> About {formatDuration(ride.duration_s)}
                    </span>
                  )}
                </div>
              )}
              {ride.notes && (
                <p className="flex gap-2 rounded-2xl bg-gold/10 p-3 text-sm">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {ride.notes}
                </p>
              )}
            </Card>

            {ride.status === "cancelled" && (
              <Card className="flex gap-3 border-danger/30 p-4">
                <XCircle className="h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold">
                    Cancelled {ride.cancelled_by === profile.id ? "by you" : ride.cancelled_by === ride.customer_id ? "by the customer" : ""}
                  </p>
                  {ride.cancel_reason && <p className="mt-1 text-sm text-muted">Reason: {ride.cancel_reason}</p>}
                  {ride.cancelled_at && <p className="mt-1 text-xs text-subtle">{formatDateTime(ride.cancelled_at)}</p>}
                </div>
              </Card>
            )}

            {ride.status === "completed" && (
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <CircleCheck className="h-6 w-6 text-success" />
                  <div>
                    <p className="font-semibold">Trip completed</p>
                    {ride.completed_at && <p className="text-xs text-subtle">{formatDateTime(ride.completed_at)}</p>}
                  </div>
                </div>
                {!isDriver ? (
                  <RateRide ride={ride} onRated={setRide} />
                ) : ride.customer_rating ? (
                  <p className="text-sm text-muted">
                    The customer rated this trip {ride.customer_rating} out of 5.
                    {ride.customer_feedback && <span className="mt-2 block italic">"{ride.customer_feedback}"</span>}
                  </p>
                ) : (
                  <p className="text-sm text-muted">The customer has not rated this trip yet.</p>
                )}
              </Card>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-1">
              {isDriver && ride.status === "accepted" && (
                <Button variant="gold" size="lg" block loading={busy} onClick={() => run(() => advanceRide(ride.id, "arrived"), "Customer notified that you have arrived")} icon={<MapPin className="h-5 w-5" />}>
                  I have arrived
                </Button>
              )}
              {isDriver && ride.status === "arrived" && (
                <Button variant="gold" size="lg" block loading={busy} onClick={() => run(() => advanceRide(ride.id, "in_progress"))} icon={<Play className="h-5 w-5" />}>
                  Start trip
                </Button>
              )}
              {isDriver && ride.status === "in_progress" && (
                <Button variant="success" size="lg" block loading={busy} onClick={() => run(() => advanceRide(ride.id, "completed"), "Trip completed")} icon={<CircleCheck className="h-5 w-5" />}>
                  Complete trip
                </Button>
              )}
              {(isDriver ? ["accepted", "arrived"] : ["requested", "accepted", "arrived"]).includes(ride.status) && (
                <Button variant="ghost" block onClick={() => setCancelOpen(true)} disabled={busy}>
                  Cancel ride
                </Button>
              )}
              {ended && (
                <Link to="/app" className="block">
                  <Button variant="secondary" block>
                    {isDriver ? "Back to dashboard" : "Book another ride"}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <CancelModal
        open={cancelOpen}
        isDriver={isDriver}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          const r = await run(() => cancelRide(ride.id, reason), "Ride cancelled");
          setCancelOpen(false);
          if (r && isDriver) navigate("/app", { replace: true });
        }}
      />
    </div>
  );
}

function getHeadline(ride: Ride, isDriver: boolean, counterpart: Profile | null, eta: RouteInfo | null) {
  const name = firstName(counterpart?.full_name) || (isDriver ? "The customer" : "Your driver");
  const etaText = eta
    ? eta.durationS
      ? `About ${formatDuration(eta.durationS)} away (${formatDistance(eta.distanceM)})`
      : `${formatDistance(eta.distanceM)} away`
    : undefined;
  switch (ride.status) {
    case "requested":
      return { title: "Finding you a driver", sub: "Nearby drivers are being notified now." };
    case "accepted":
      return isDriver
        ? { title: `Head to ${name}'s pickup`, sub: etaText }
        : { title: `${name} is on the way`, sub: etaText ?? "Waiting for the driver's location" };
    case "arrived":
      return isDriver
        ? { title: `Waiting for ${name}`, sub: "Let them know you are here with a quick message." }
        : { title: `${name} has arrived`, sub: "Meet your driver at the pickup point." };
    case "in_progress":
      return { title: "On the way to the destination", sub: etaText };
    case "completed":
      return { title: "You have arrived", sub: undefined };
    case "cancelled":
      return { title: "This ride was cancelled", sub: undefined };
  }
}

function Searching({ since }: { since: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 15000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gold text-[#0b0b0b]">
          <Car className="h-5 w-5" />
        </span>
      </div>
      <div>
        <p className="font-semibold">Searching nearby drivers</p>
        <p className="text-sm text-muted">Requested {timeAgo(since)}. You will be notified when a driver accepts.</p>
      </div>
    </Card>
  );
}

function CounterpartCard({
  person,
  isDriverView,
  onChat,
  unread,
  showContact,
}: {
  person: Profile;
  isDriverView: boolean;
  onChat: () => void;
  unread: number;
  showContact: boolean;
}) {
  const vehicle = [person.vehicle_color, person.vehicle_make, person.vehicle_model].filter(Boolean).join(" ");
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={person.full_name} src={person.avatar_url} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-subtle">{isDriverView ? "Customer" : "Your driver"}</p>
          <p className="truncate font-semibold">{person.full_name || "Name not set"}</p>
          {!isDriverView && vehicle && <p className="truncate text-sm text-muted">{vehicle}</p>}
        </div>
        {!isDriverView && person.plate_number && (
          <span className="rounded-xl border-2 border-fg/80 bg-fg px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-bg">
            {person.plate_number}
          </span>
        )}
      </div>
      {showContact && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onChat} icon={<MessageSquare className="h-4 w-4" />}>
            Message{unread > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-[11px] text-[#0b0b0b]">{unread}</span>}
          </Button>
          {person.phone ? (
            <a href={`tel:${person.phone}`} className="block">
              <Button variant="secondary" block icon={<Phone className="h-4 w-4" />}>
                Call
              </Button>
            </a>
          ) : (
            <Button variant="secondary" disabled icon={<Phone className="h-4 w-4" />}>
              No phone
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

const customerReasons = ["Driver is taking too long", "Changed my plans", "Booked by mistake", "Found another ride"];
const driverReasons = ["Customer not at pickup", "Vehicle problem", "Pickup too far", "Customer asked me to cancel"];

function CancelModal({
  open,
  isDriver,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isDriver: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const reasons = isDriver ? driverReasons : customerReasons;
  return (
    <Modal open={open} onClose={onClose} title="Cancel this ride?">
      <p className="text-sm text-muted">
        {isDriver
          ? "The request goes back to nearby drivers so the customer can still get a ride."
          : "Your driver will be notified straight away."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              reason === r ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:text-fg",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          Keep ride
        </Button>
        <Button variant="danger" loading={busy} onClick={() => onConfirm(reason)}>
          Cancel ride
        </Button>
      </div>
    </Modal>
  );
}
