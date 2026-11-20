import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Crosshair, Flag, History, LocateFixed, MapPin, MousePointerClick, Navigation, StickyNote } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { fetchRoute, reverseGeocode, type LatLng, type Place, type RouteInfo } from "@/lib/geo";
import { formatDistance, formatDuration, firstName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { MapView } from "@/features/map/MapView";
import { PlaceSearch } from "@/features/map/PlaceSearch";
import { useGeolocation } from "@/features/map/useGeolocation";
import type { Ride } from "@/types";
import { getActiveRide, listRideHistory, requestRide } from "./rideApi";
import { RideListItem } from "./RideListItem";
import { SavedPlacesBar } from "@/features/places/SavedPlacesBar";

type PinTarget = "pickup" | "dropoff" | null;

export function CustomerHome() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const geo = useGeolocation(true);

  const [checking, setChecking] = useState(true);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [pinTarget, setPinTarget] = useState<PinTarget>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<Ride[]>([]);
  const [locating, setLocating] = useState(false);

  // An active ride takes over the screen
  useEffect(() => {
    if (!profile) return;
    getActiveRide(profile.id, "customer")
      .then((r) => (r ? navigate(`/ride/${r.id}`, { replace: true }) : setChecking(false)))
      .catch(() => setChecking(false));
    listRideHistory(profile.id, "customer", 3).then(setRecent).catch(() => undefined);
  }, [profile, navigate]);

  // Default pickup to the current location once
  const me = geo.position;
  useEffect(() => {
    if (!me || pickup) return;
    let cancelled = false;
    reverseGeocode(me).then((p) => !cancelled && setPickup((cur) => cur ?? { ...p, detail: p.detail ?? "Current location" }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(me)]);

  // Route preview
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null);
      return;
    }
    const controller = new AbortController();
    setRouting(true);
    fetchRoute(pickup, dropoff, controller.signal)
      .then(setRoute)
      .catch(() => undefined)
      .finally(() => setRouting(false));
    return () => controller.abort();
  }, [pickup, dropoff]);

  const useMyLocation = async () => {
    if (!me) {
      geo.refresh();
      toast({ tone: "info", title: "Finding your location", body: geo.error ?? "Allow location access if your browser asks." });
      return;
    }
    setLocating(true);
    setPickup(await reverseGeocode(me));
    setLocating(false);
  };

  const onMapClick = async (point: LatLng) => {
    if (!pinTarget) return;
    const target = pinTarget;
    setPinTarget(null);
    const place = await reverseGeocode(point);
    if (target === "pickup") setPickup(place);
    else setDropoff(place);
  };

  const submit = async () => {
    if (!profile || !pickup || !dropoff) return;
    if (route && route.distanceM < 100) {
      toast({ tone: "error", title: "Pickup and drop-off are too close" });
      return;
    }
    setSubmitting(true);
    try {
      const ride = await requestRide({
        customerId: profile.id,
        pickup,
        dropoff,
        distanceM: route?.distanceM,
        durationS: route?.durationS,
        notes,
      });
      navigate(`/ride/${ride.id}`);
    } catch (err) {
      toast({ tone: "error", title: "Could not request ride", body: readableError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const mapPoints = useMemo(() => ({ pickup, dropoff }), [pickup, dropoff]);

  if (checking) return <FullPageSpinner label="Loading" />;

  return (
    <div className="relative flex flex-1 flex-col lg:flex-row">
      <div className="relative h-[42vh] min-h-72 lg:order-2 lg:h-auto lg:flex-1">
        <MapView
          className="absolute inset-0"
          pickup={mapPoints.pickup}
          dropoff={mapPoints.dropoff}
          me={me}
          route={route?.coordinates}
          onMapClick={pinTarget ? onMapClick : undefined}
        />
        {pinTarget && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center px-4">
            <div className="rl-pop pointer-events-auto flex items-center gap-3 rounded-full border border-gold/40 bg-elevated/95 px-4 py-2 text-sm shadow-xl backdrop-blur">
              <MousePointerClick className="h-4 w-4 text-gold" />
              Tap the map to set your {pinTarget === "pickup" ? "pickup" : "drop-off"}
              <button onClick={() => setPinTarget(null)} className="font-semibold text-muted hover:text-fg">
                Cancel
              </button>
            </div>
          </div>
        )}
        {geo.error && !me && (
          <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-line bg-elevated/95 p-3 text-xs text-muted backdrop-blur">
            {geo.error} You can still search for an address.
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-6 rounded-t-[2rem] border-t border-line bg-bg px-4 pb-8 pt-6 sm:px-6 lg:order-1 lg:mt-0 lg:w-[440px] lg:shrink-0 lg:overflow-y-auto lg:rounded-none lg:border-r lg:border-t-0 lg:pt-8 scrollbar-thin">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Book a ride</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {profile?.full_name ? `Where to, ${firstName(profile.full_name)}?` : "Where to?"}
        </h1>

        <div className="mt-6 space-y-3">
          <PlaceSearch
            value={pickup}
            onChange={setPickup}
            near={me}
            placeholder="Pickup location"
            icon={<MapPin className="h-4 w-4" />}
            extra={
              <div className="flex items-center gap-1 border-l border-line pl-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="rounded-full p-1.5 text-subtle hover:text-gold"
                  title="Use my location"
                  aria-label="Use my location"
                >
                  <LocateFixed className={cn("h-4 w-4", locating && "animate-pulse text-gold")} />
                </button>
                <button
                  type="button"
                  onClick={() => setPinTarget("pickup")}
                  className={cn("rounded-full p-1.5 hover:text-gold", pinTarget === "pickup" ? "text-gold" : "text-subtle")}
                  title="Pick on map"
                  aria-label="Pick pickup on map"
                >
                  <Crosshair className="h-4 w-4" />
                </button>
              </div>
            }
          />
          <PlaceSearch
            value={dropoff}
            onChange={setDropoff}
            near={pickup ?? me}
            placeholder="Where are you going?"
            icon={<Flag className="h-4 w-4 text-gold" />}
            extra={
              <div className="border-l border-line pl-2">
                <button
                  type="button"
                  onClick={() => setPinTarget("dropoff")}
                  className={cn("rounded-full p-1.5 hover:text-gold", pinTarget === "dropoff" ? "text-gold" : "text-subtle")}
                  title="Pick on map"
                  aria-label="Pick drop-off on map"
                >
                  <Crosshair className="h-4 w-4" />
                </button>
              </div>
            }
          />
          <SavedPlacesBar onPick={setDropoff} current={dropoff} />
        </div>

        {pickup && dropoff && (
          <Card className="rl-pop mt-5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-subtle">Trip estimate</p>
                {routing ? (
                  <p className="mt-1 text-sm text-muted">Calculating route</p>
                ) : route ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 font-display text-xl font-bold">
                      <Navigation className="h-4 w-4 text-gold" />
                      {formatDistance(route.distanceM)}
                    </span>
                    {route.durationS > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                        <Clock className="h-4 w-4" />
                        About {formatDuration(route.durationS)}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-subtle">Payment is arranged directly with your driver.</p>
          </Card>
        )}

        <div className="mt-4">
          {showNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              autoFocus
              placeholder="Note for the driver, e.g. gate colour or landmark"
              className="min-h-20 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm placeholder:text-subtle focus:border-gold/60 focus:outline-none"
            />
          ) : (
            <button onClick={() => setShowNotes(true)} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg">
              <StickyNote className="h-4 w-4" /> Add a note for the driver
            </button>
          )}
        </div>

        <Button
          variant="gold"
          size="lg"
          block
          className="mt-6"
          disabled={!pickup || !dropoff || routing}
          loading={submitting}
          onClick={submit}
          icon={!submitting && <ArrowRight className="h-5 w-5" />}
        >
          Request ride
        </Button>

        {recent.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Recent trips</p>
              <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
                <History className="h-4 w-4" /> All
              </Link>
            </div>
            <div className="space-y-2">
              {recent.map((r) => (
                <RideListItem key={r.id} ride={r} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
