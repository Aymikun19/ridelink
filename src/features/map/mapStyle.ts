import { useSyncExternalStore } from "react";

export type MapStyle = "streets" | "satellite";

const KEY = "ridelink-map-style";
const listeners = new Set<() => void>();

function read(): MapStyle {
  try {
    return localStorage.getItem(KEY) === "satellite" ? "satellite" : "streets";
  } catch {
    return "streets";
  }
}

let current: MapStyle = typeof window === "undefined" ? "streets" : read();

export function setMapStyle(next: MapStyle) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: keep in memory only */
  }
  listeners.forEach((l) => l());
}

/** Shared across every map on the page, remembered per device. */
export function useMapStyle(): MapStyle {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "streets",
  );
}

/*
 * Street tiles default to OpenStreetMap (dark mode = colour filter). Satellite imagery is Esri World
 * Imagery with Esri's road and place labels on top. Override with VITE_TILE_URL / VITE_TILE_URL_DARK /
 * VITE_TILE_ATTRIBUTION and VITE_SATELLITE_URL / VITE_SATELLITE_ATTRIBUTION for a keyed provider.
 */
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const tiles = {
  streets: {
    light: import.meta.env.VITE_TILE_URL || OSM_URL,
    dark: import.meta.env.VITE_TILE_URL_DARK || import.meta.env.VITE_TILE_URL || OSM_URL,
    attribution: import.meta.env.VITE_TILE_ATTRIBUTION || OSM_ATTRIBUTION,
    filterDark: !import.meta.env.VITE_TILE_URL_DARK,
    maxZoom: 19,
  },
  satellite: {
    url: import.meta.env.VITE_SATELLITE_URL || `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution:
      import.meta.env.VITE_SATELLITE_ATTRIBUTION ||
      'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
    labels: import.meta.env.VITE_SATELLITE_URL
      ? []
      : [
          `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
          `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
        ],
    maxZoom: 19,
  },
};
