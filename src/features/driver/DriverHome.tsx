import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flag, LocateFixed, MapPin, Power, Radar, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapView } from "@/features/map/MapView";
import { DRIVER_REQUEST_RADIUS_KM } from "@/lib/config";
import { formatDistance, formatDuration, firstName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { countCompletedSince } from "@/features/rides/rideApi";
import { statusMeta } from "@/features/rides/status";
import { useDriver } from "./DriverProvider";

export function DriverHome() {
  const { profile } = useAuth();
  const { online, toggling, setOnline, geo, requests, refreshRequests, activeRide, accept, decline, busyId } = useDriver();
  const [stats, setStats] = useState<{ today: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    Promise.all([countCompletedSince(profile.id, "driver", startOfDay), countCompletedSince(profile.id, "driver")])
      .then(([today, total]) => setStats({ today, total }))
      .catch(() => setStats(null));
  }, [profile, activeRide?.id]);

  const pins = useMemo(() => requests.map((r) => ({ id: r.id, lat: r.pickup_lat, lng: r.pickup_lng })), [requests]);

  const profileIncomplete = !profile?.full_name || !profile?.plate_number;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative h-[38vh] min-h-64 lg:order-2 lg:h-auto lg:flex-1">
        <MapView className="absolute inset-0" me={geo.position} extraPickups={online && !activeRide ? pins : undefined} />
        {online && !activeRide && (
          <div className="absolute left-3 top-3 z-[500] inline-flex items-center gap-2 rounded-full border border-line bg-elevated/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur">
            <Radar className="h-3.5 w-3.5 text-gold" /> Listening within {DRIVER_REQUEST_RADIUS_KM} km
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-6 rounded-t-[2rem] border-t border-line bg-bg px-4 pb-10 pt-6 sm:px-6 lg:order-1 lg:mt-0 lg:h-[calc(100dvh-4rem)] lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:rounded-none lg:border-r lg:border-t-0 lg:pt-8 scrollbar-thin">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Driver</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {profile?.full_name ? `Hello, ${firstName(profile.full_name)}` : "Driver dashboard"}
        </h1>

        {profileIncomplete && (
          <Card className="mt-5 border-gold/40 bg-gold/5 p-4">
            <p className="text-sm font-semibold">Finish your driver profile</p>
            <p className="mt-1 text-sm text-muted">Customers need your name and plate number to find you.</p>
            <Link to="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">
              Complete profile <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        )}

        {activeRide ? (
          <Link to={`/ride/${activeRide.id}`} className="mt-6 block">
            <Card className="rl-pop border-gold/50 p-5 transition hover:border-gold">
              <div className="flex items-center justify-between">
                <Badge tone="gold" dot>
                  Active ride · {statusMeta[activeRide.status].label}
                </Badge>
                <ArrowRight className="h-5 w-5 text-gold" />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{activeRide.pickup_address}</span>
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 shrink-0 text-gold" /> <span className="truncate">{activeRide.dropoff_address}</span>
              </p>
            </Card>
          </Link>
        ) : (
          <Card className={cn("mt-6 overflow-hidden p-0 transition", online && "border-success/40")}>
            <div className="flex items-center gap-4 p-5">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  online ? "bg-success/15 text-success" : "bg-fg/5 text-muted",
                )}
              >
                {online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{online ? "You are online" : "You are offline"}</p>
                <p className="text-sm text-muted">
                  {online ? "New requests will pop up with a sound." : "Go online to start receiving ride requests."}
                </p>
              </div>
            </div>
            <div className="border-t border-line p-4">
              <Button
                block
                size="lg"
                variant={online ? "secondary" : "gold"}
                loading={toggling}
                onClick={() => setOnline(!online)}
                icon={<Power className="h-5 w-5" />}
              >
                {online ? "Go offline" : "Go online"}
              </Button>
              {online && geo.error && <p className="mt-3 text-xs text-danger">{geo.error}</p>}
              {online && !geo.position && !geo.error && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <LocateFixed className="h-3.5 w-3.5 animate-pulse" /> Waiting for your location
                </p>
              )}
            </div>
          </Card>
        )}

        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-subtle">Completed today</p>
              <p className="mt-1 font-display text-2xl font-bold">{stats.today}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-subtle">All-time trips</p>
              <p className="mt-1 font-display text-2xl font-bold">{stats.total}</p>
            </Card>
          </div>
        )}

        {online && !activeRide && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Open requests</h2>
              <button
                onClick={async () => {
                  setRefreshing(true);
                  await refreshRequests();
                  setRefreshing(false);
                }}
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh
              </button>
            </div>
            {requests.length === 0 ? (
              <EmptyState
                icon={<Radar className="h-5 w-5" />}
                title="No requests nearby right now"
                body="Stay online. You will hear a chime and see a popup the moment someone requests a ride near you."
              />
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <Card key={r.id} className="rl-pop p-4">
                    <div className="mb-3 flex items-center justify-between text-xs text-subtle">
                      <span className="font-medium text-fg">{r.customer_name || "Customer"}</span>
                      <span>{timeAgo(r.requested_at)}</span>
                    </div>
                    <p className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {r.pickup_address}
                        <span className="block text-xs text-subtle">{formatDistance(r.pickup_distance_km * 1000)} from you</span>
                      </span>
                    </p>
                    <p className="mt-2 flex items-start gap-2 text-sm">
                      <Flag className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <span>
                        {r.dropoff_address}
                        {r.distance_m != null && (
                          <span className="block text-xs text-subtle">
                            Trip {formatDistance(r.distance_m)}
                            {r.duration_s ? ` · about ${formatDuration(r.duration_s)}` : ""}
                          </span>
                        )}
                      </span>
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="secondary" onClick={() => decline(r.id)} disabled={busyId === r.id}>
                        Decline
                      </Button>
                      <Button size="sm" variant="gold" onClick={() => accept(r.id)} loading={busyId === r.id}>
                        Accept
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
