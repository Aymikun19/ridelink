import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Route } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { Ride } from "@/types";
import { listRideHistory } from "./rideApi";
import { RideListItem } from "./RideListItem";

const filters = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export function HistoryPage() {
  const { profile } = useAuth();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");

  useEffect(() => {
    if (!profile?.role) return;
    listRideHistory(profile.id, profile.role, 100)
      .then(setRides)
      .catch((e) => setError(e.message));
  }, [profile]);

  const shown = useMemo(() => (rides ?? []).filter((r) => filter === "all" || r.status === filter), [rides, filter]);

  if (error) return <p className="p-8 text-center text-danger">{error}</p>;
  if (!rides) return <FullPageSpinner />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Trips</p>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your ride history</h1>

      <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              filter === f.key ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {shown.length === 0 ? (
          <EmptyState
            icon={<Route className="h-5 w-5" />}
            title={rides.length ? "Nothing here" : "No trips yet"}
            body={
              rides.length
                ? "No rides match this filter."
                : profile?.role === "driver"
                  ? "Go online to start receiving ride requests."
                  : "Your completed and cancelled rides will show up here."
            }
            action={
              !rides.length && (
                <Link to="/app">
                  <Button variant="secondary">{profile?.role === "driver" ? "Go to dashboard" : "Book a ride"}</Button>
                </Link>
              )
            }
          />
        ) : (
          shown.map((r) => <RideListItem key={r.id} ride={r} />)
        )}
      </div>
    </div>
  );
}
