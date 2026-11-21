import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export interface GeoState {
  position: (LatLng & { heading: number | null; accuracy: number }) | null;
  error: string | null;
  supported: boolean;
  /** True while waiting for the first fix */
  locating: boolean;
}

function isWindows() {
  return typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
}

function describe(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) {
    return "Location permission is blocked for this site. Click the icon at the left of the address bar, allow Location, then reload.";
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return isWindows()
      ? "Your device could not find its location. Turn on Location in Windows Settings > Privacy & security > Location, and allow desktop apps to use it."
      : "Your device could not find its location. Check that location services are turned on.";
  }
  return "Finding your location is taking longer than usual.";
}

/**
 * Watches the device location while `enabled` is true.
 *
 * Laptops and desktops have no GPS, and asking only for a high-accuracy fix often times out there.
 * So we first ask for a quick approximate fix (Wi-Fi / network based, cached up to 10 minutes),
 * then keep a high-accuracy watch running to sharpen it. If the high-accuracy watch fails we fall
 * back to a low-accuracy watch instead of giving up. An error is only shown while we have no position.
 */
export function useGeolocation(enabled = true): GeoState & { refresh: () => void } {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const secure = typeof window === "undefined" || window.isSecureContext;
  const [state, setState] = useState<GeoState>({
    position: null,
    error: !supported
      ? "Location is not supported on this device."
      : !secure
        ? "Location only works on a secure (https) address."
        : null,
    supported: supported && secure,
    locating: false,
  });
  const watchId = useRef<number | null>(null);
  const lowWatchId = useRef<number | null>(null);
  const hasPosition = useRef(false);

  const onPos = useCallback((p: GeolocationPosition) => {
    hasPosition.current = true;
    setState((s) => {
      // Ignore a less accurate reading arriving after a better, recent one
      const prev = s.position;
      if (prev && p.coords.accuracy > prev.accuracy * 3 && p.coords.accuracy > 200) return s;
      return {
        ...s,
        error: null,
        locating: false,
        position: {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: p.coords.heading,
          accuracy: p.coords.accuracy,
        },
      };
    });
  }, []);

  const onErr = useCallback((e: GeolocationPositionError) => {
    // Keep showing the last known position; only surface the error when we have nothing
    if (hasPosition.current && e.code !== e.PERMISSION_DENIED) return;
    setState((s) => ({ ...s, locating: false, error: describe(e) }));
  }, []);

  const startLowAccuracyWatch = useCallback(() => {
    if (lowWatchId.current != null) return;
    lowWatchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 30_000,
    });
  }, [onPos, onErr]);

  useEffect(() => {
    if (!enabled || !state.supported) return;
    setState((s) => (s.position ? s : { ...s, locating: true }));

    // 1. Quick approximate fix
    navigator.geolocation.getCurrentPosition(onPos, () => undefined, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60_000,
      timeout: 10_000,
    });

    // 2. Precise watch, with a low-accuracy fallback if it fails
    watchId.current = navigator.geolocation.watchPosition(
      onPos,
      (e) => {
        if (e.code === e.PERMISSION_DENIED) return onErr(e);
        startLowAccuracyWatch();
        onErr(e);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 25_000 },
    );

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (lowWatchId.current != null) navigator.geolocation.clearWatch(lowWatchId.current);
      watchId.current = null;
      lowWatchId.current = null;
    };
  }, [enabled, state.supported, onPos, onErr, startLowAccuracyWatch]);

  const refresh = useCallback(() => {
    if (!state.supported) return;
    setState((s) => ({ ...s, locating: !s.position, error: s.position ? s.error : null }));
    navigator.geolocation.getCurrentPosition(
      onPos,
      () =>
        navigator.geolocation.getCurrentPosition(onPos, onErr, {
          enableHighAccuracy: false,
          maximumAge: 10 * 60_000,
          timeout: 20_000,
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  }, [state.supported, onPos, onErr]);

  return { ...state, refresh };
}
