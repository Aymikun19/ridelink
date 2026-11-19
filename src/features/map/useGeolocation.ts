import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export interface GeoState {
  position: (LatLng & { heading: number | null; accuracy: number }) | null;
  error: string | null;
  supported: boolean;
}

function describe(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) return "Location permission was denied. Enable it in your browser settings.";
  if (err.code === err.POSITION_UNAVAILABLE) return "Your location is unavailable right now.";
  return "Getting your location took too long.";
}

/** Watches the device location while `enabled` is true. */
export function useGeolocation(enabled = true): GeoState & { refresh: () => void } {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const [state, setState] = useState<GeoState>({ position: null, error: supported ? null : "Location is not supported on this device.", supported });
  const watchId = useRef<number | null>(null);

  const onPos = useCallback((p: GeolocationPosition) => {
    setState((s) => ({
      ...s,
      error: null,
      position: {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        heading: p.coords.heading,
        accuracy: p.coords.accuracy,
      },
    }));
  }, []);
  const onErr = useCallback((e: GeolocationPositionError) => setState((s) => ({ ...s, error: describe(e) })), []);

  useEffect(() => {
    if (!enabled || !supported) return;
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled, supported, onPos, onErr]);

  const refresh = useCallback(() => {
    if (!supported) return;
    navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, timeout: 15000 });
  }, [supported, onPos, onErr]);

  return { ...state, refresh };
}
