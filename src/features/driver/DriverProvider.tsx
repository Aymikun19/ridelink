import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, readableError } from "@/lib/supabase";
import { haversineMeters, type LatLng } from "@/lib/geo";
import {
  DRIVER_REQUEST_RADIUS_KM,
  LOCATION_WRITE_INTERVAL_MS,
  LOCATION_WRITE_MIN_METERS,
} from "@/lib/config";
import { playRequestAlert, unlockAudio } from "@/lib/sound";
import { ensureNotificationPermission, systemNotify } from "@/lib/browserNotify";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useGeolocation, type GeoState } from "@/features/map/useGeolocation";
import { acceptRide, declineRide, getActiveRide, nearbyRequests } from "@/features/rides/rideApi";
import { getDriverDocuments } from "./documentsApi";
import type { NearbyRequest, Ride } from "@/types";
import { IncomingRequestModal } from "./IncomingRequestModal";

interface DriverState {
  online: boolean;
  toggling: boolean;
  setOnline: (next: boolean) => Promise<void>;
  geo: GeoState;
  requests: NearbyRequest[];
  refreshRequests: () => Promise<void>;
  activeRide: Ride | null;
  accept: (id: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  busyId: string | null;
}

const DriverContext = createContext<DriverState | null>(null);

export function DriverProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const driverId = profile?.id;

  const [online, setOnlineState] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [requests, setRequests] = useState<NearbyRequest[]>([]);
  const [popupQueue, setPopupQueue] = useState<NearbyRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const geo = useGeolocation(online || Boolean(activeRide));
  const position = geo.position;
  const positionRef = useRef<LatLng | null>(null);
  positionRef.current = position;

  const seen = useRef(new Set<string>());

  // Initial state: online flag and any active ride
  useEffect(() => {
    if (!driverId) return;
    supabase
      .from("driver_status")
      .select("is_online")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => setOnlineState(Boolean(data?.is_online)));
    getActiveRide(driverId, "driver").then(setActiveRide).catch(() => undefined);
  }, [driverId]);

  // Keep the active ride in sync
  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel(`driver-rides-${driverId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `driver_id=eq.${driverId}` }, (payload) => {
        const ride = payload.new as Ride;
        if (["accepted", "arrived", "in_progress"].includes(ride.status)) setActiveRide(ride);
        else setActiveRide((cur) => (cur?.id === ride.id ? null : cur));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId]);

  // When the customer cancels, the driver loses read access to the row, so poll the active ride as a safety net.
  useEffect(() => {
    if (!driverId || !activeRide) return;
    const t = window.setInterval(() => {
      getActiveRide(driverId, "driver").then((r) => {
        if (!r && activeRide) {
          toast({ tone: "error", title: "Ride ended", body: "The customer cancelled this ride." });
        }
        setActiveRide(r);
      });
    }, 15000);
    return () => window.clearInterval(t);
  }, [driverId, activeRide, toast]);

  // Write location (throttled by time and distance)
  const lastWrite = useRef<{ at: number; pos: LatLng | null }>({ at: 0, pos: null });
  useEffect(() => {
    if (!driverId || !position || !(online || activeRide)) return;
    const now = Date.now();
    const movedEnough = !lastWrite.current.pos || haversineMeters(lastWrite.current.pos, position) >= LOCATION_WRITE_MIN_METERS;
    if (now - lastWrite.current.at < LOCATION_WRITE_INTERVAL_MS && !movedEnough) return;
    if (now - lastWrite.current.at < 2000) return;
    lastWrite.current = { at: now, pos: position };
    // Query builders are lazy: they only run once awaited or then()'d.
    supabase
      .from("driver_status")
      .upsert({
        driver_id: driverId,
        is_online: online,
        lat: position.lat,
        lng: position.lng,
        heading: position.heading,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) {
          console.warn("[location]", error.message);
          lastWrite.current.at = 0; // retry on the next fix
        }
      });
  }, [driverId, position, online, activeRide]);

  const refreshRequests = useCallback(async () => {
    const pos = positionRef.current;
    if (!pos || !online || activeRide) {
      setRequests([]);
      return;
    }
    try {
      const list = await nearbyRequests(pos.lat, pos.lng, DRIVER_REQUEST_RADIUS_KM);
      setRequests(list);
      // Drop popups for rides that were taken by someone else
      const ids = new Set(list.map((r) => r.id));
      setPopupQueue((q) => q.filter((r) => ids.has(r.id)));
      // Surface any request we have not alerted for yet (e.g. created while we were loading)
      const fresh = list.filter((r) => !seen.current.has(r.id));
      if (fresh.length) {
        fresh.forEach((r) => seen.current.add(r.id));
        setPopupQueue((q) => [...q, ...fresh.filter((r) => !q.some((x) => x.id === r.id))]);
      }
    } catch (err) {
      console.warn("[requests]", err);
    }
  }, [online, activeRide]);

  // Poll + react to the first position fix
  const hasPosition = Boolean(position);
  useEffect(() => {
    if (!online || activeRide || !hasPosition) return;
    void refreshRequests();
    const t = window.setInterval(refreshRequests, 20000);
    return () => window.clearInterval(t);
  }, [online, activeRide, hasPosition, refreshRequests]);

  // Realtime: new or re-opened requests
  useEffect(() => {
    if (!driverId || !online || activeRide) return;
    const handle = (ride: Ride) => {
      if (ride.status !== "requested" || ride.driver_id) return;
      const pos = positionRef.current;
      if (!pos) return;
      const km = haversineMeters(pos, { lat: ride.pickup_lat, lng: ride.pickup_lng }) / 1000;
      if (km > DRIVER_REQUEST_RADIUS_KM) return;
      // Fetch through the RPC so declined rides are excluded and the customer name is included
      void refreshRequests();
    };
    const channel = supabase
      .channel(`requests-${driverId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rides" }, (p) => handle(p.new as Ride))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides" }, (p) => handle(p.new as Ride))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, online, activeRide, refreshRequests]);

  // Alert when a new popup arrives
  const topId = popupQueue[0]?.id;
  useEffect(() => {
    const top = popupQueue[0];
    if (!top) return;
    playRequestAlert();
    if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
    systemNotify("New ride request", `Pickup: ${top.pickup_address}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topId]);

  const setOnline = useCallback(
    async (next: boolean) => {
      if (!driverId) return;
      setToggling(true);
      try {
        if (next) {
          unlockAudio();
          void ensureNotificationPermission();
          const docs = await getDriverDocuments(driverId);
          if (!docs || !["submitted", "approved"].includes(docs.status)) {
            toast({
              tone: "error",
              title: "Finish your driver details first",
              body: "Add your vehicle, photos and licence before going online.",
              action: { label: "Open checklist", onClick: () => navigate("/driver/documents") },
            });
            return;
          }
        }
        const pos = positionRef.current;
        const { error } = await supabase.from("driver_status").upsert({
          driver_id: driverId,
          is_online: next,
          ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setOnlineState(next);
        if (!next) {
          setRequests([]);
          setPopupQueue([]);
        }
      } catch (err) {
        toast({ tone: "error", title: "Could not update status", body: readableError(err) });
      } finally {
        setToggling(false);
      }
    },
    [driverId, profile, toast, navigate],
  );

  const accept = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const ride = await acceptRide(id);
        setActiveRide(ride);
        setPopupQueue([]);
        setRequests([]);
        navigate(`/ride/${ride.id}`);
      } catch (err) {
        toast({ tone: "error", title: "Could not accept", body: readableError(err) });
        setPopupQueue((q) => q.filter((r) => r.id !== id));
        void refreshRequests();
      } finally {
        setBusyId(null);
      }
    },
    [navigate, toast, refreshRequests],
  );

  const decline = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await declineRide(id);
      } catch (err) {
        console.warn(err);
      } finally {
        setPopupQueue((q) => q.filter((r) => r.id !== id));
        setRequests((list) => list.filter((r) => r.id !== id));
        setBusyId(null);
      }
    },
    [],
  );

  const dismissPopup = useCallback((id: string) => setPopupQueue((q) => q.filter((r) => r.id !== id)), []);

  const value = useMemo(
    () => ({ online, toggling, setOnline, geo, requests, refreshRequests, activeRide, accept, decline, busyId }),
    [online, toggling, setOnline, geo, requests, refreshRequests, activeRide, accept, decline, busyId],
  );

  return (
    <DriverContext.Provider value={value}>
      {children}
      {popupQueue[0] && !activeRide && (
        <IncomingRequestModal
          key={popupQueue[0].id}
          request={popupQueue[0]}
          queued={popupQueue.length - 1}
          driverPosition={position}
          busy={busyId === popupQueue[0].id}
          onAccept={() => accept(popupQueue[0].id)}
          onDecline={() => decline(popupQueue[0].id)}
          onTimeout={() => dismissPopup(popupQueue[0].id)}
        />
      )}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error("useDriver must be used inside DriverProvider");
  return ctx;
}

/** Returns the driver context when rendered inside DriverProvider, otherwise null. */
export function useOptionalDriver() {
  return useContext(DriverContext);
}
