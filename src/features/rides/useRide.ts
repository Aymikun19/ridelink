import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DriverStatus, Profile, Ride } from "@/types";
import { getRide } from "./rideApi";

/** Loads a ride, the other party's profile, and keeps both plus driver location live. */
export function useRide(rideId: string | undefined, viewerId: string | undefined) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [counterpart, setCounterpart] = useState<Profile | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!rideId) return;
    try {
      const r = await getRide(rideId);
      setRide(r);
      if (!r) setError("This ride does not exist or you do not have access to it.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // Ride updates
  useEffect(() => {
    if (!rideId) return;
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, (payload) => {
        setRide(payload.new as Ride);
      })
      .subscribe((status) => {
        // Re-sync after reconnects so no update is missed.
        if (status === "SUBSCRIBED") void reload();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rideId, reload]);

  // Safety net if the realtime socket drops (e.g. flaky mobile data): re-sync active rides periodically.
  const isActive = ride ? !["completed", "cancelled"].includes(ride.status) : false;
  useEffect(() => {
    if (!rideId || !isActive) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 12000);
    return () => window.clearInterval(t);
  }, [rideId, isActive, reload]);

  const counterpartId = ride && viewerId ? (ride.customer_id === viewerId ? ride.driver_id : ride.customer_id) : null;

  useEffect(() => {
    if (!counterpartId) {
      setCounterpart(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", counterpartId)
      .maybeSingle()
      .then(({ data }) => setCounterpart((data as Profile) ?? null));
  }, [counterpartId]);

  // Live driver location for the customer while the trip is active
  const watchDriverId =
    ride && viewerId === ride.customer_id && ride.driver_id && ["accepted", "arrived", "in_progress"].includes(ride.status)
      ? ride.driver_id
      : null;

  useEffect(() => {
    if (!watchDriverId) {
      setDriverStatus(null);
      return;
    }
    let live = false;
    const fetchStatus = () =>
      supabase
        .from("driver_status")
        .select("*")
        .eq("driver_id", watchDriverId)
        .maybeSingle()
        .then(({ data }) => data && setDriverStatus(data as DriverStatus));
    void fetchStatus();
    const poll = window.setInterval(() => {
      if (!live && document.visibilityState === "visible") void fetchStatus();
    }, 10000);

    const channel = supabase
      .channel(`driver-loc-${watchDriverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_status", filter: `driver_id=eq.${watchDriverId}` },
        (payload) => payload.new && setDriverStatus(payload.new as DriverStatus),
      )
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
      });
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [watchDriverId]);

  return { ride, setRide, counterpart, driverStatus, loading, error, reload };
}
