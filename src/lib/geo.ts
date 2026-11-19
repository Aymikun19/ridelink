export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  label: string;
  detail?: string;
}

export interface RouteInfo {
  distanceM: number;
  durationS: number;
  /** [lat, lng] pairs for drawing a polyline */
  coordinates: [number, number][];
}

export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/*
 * Geocoding uses OpenStreetMap Nominatim and routing uses the public OSRM server.
 * Both are free and keyless, which is ideal for development. For production traffic,
 * point these at your own instances or a paid provider (see README).
 */
const NOMINATIM = import.meta.env.VITE_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const OSRM = import.meta.env.VITE_OSRM_URL || "https://router.project-osrm.org";
const COUNTRY_CODES = import.meta.env.VITE_GEOCODE_COUNTRIES || ""; // e.g. "ng"

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

function splitLabel(display: string, name?: string): { label: string; detail?: string } {
  const parts = display.split(",").map((p) => p.trim());
  const label = name || parts[0] || display;
  const detail = parts.slice(name ? 0 : 1).filter((p) => p !== label).slice(0, 3).join(", ");
  return { label, detail: detail || undefined };
}

export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "6", addressdetails: "0" });
  if (COUNTRY_CODES) params.set("countrycodes", COUNTRY_CODES);
  if (near) {
    const d = 0.6; // bias results to roughly 60 km around the user
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal, headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Location search is unavailable right now");
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), ...splitLabel(r.display_name, r.name) }));
}

export async function reverseGeocode(point: LatLng): Promise<Place> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    format: "jsonv2",
    zoom: "18",
  });
  try {
    const res = await fetch(`${NOMINATIM}/reverse?${params}`, { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error();
    const r = (await res.json()) as NominatimResult;
    return { ...point, ...splitLabel(r.display_name, r.name) };
  } catch {
    return { ...point, label: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` };
  }
}

export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteInfo> {
  const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error();
    return {
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      coordinates: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    // Routing service unreachable: fall back to a straight line so the app keeps working.
    return {
      distanceM: Math.round(haversineMeters(from, to)),
      durationS: 0,
      coordinates: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
    };
  }
}

export function directionsUrl(to: LatLng, from?: LatLng | null) {
  const params = new URLSearchParams({ api: "1", destination: `${to.lat},${to.lng}`, travelmode: "driving" });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}
