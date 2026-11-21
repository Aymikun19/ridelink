import { supabase } from "./supabase";

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
 * Search combines several sources so it works anywhere in the world:
 *  - Google Places (through our server, only when GOOGLE_MAPS_API_KEY is set): best coverage of
 *    local businesses, many of which are not in OpenStreetMap.
 *  - Photon (komoot) and Nominatim: free OpenStreetMap geocoders. Photon is better at partial
 *    names; Nominatim is better at full addresses.
 * Results are biased toward the user's position but never limited to a country.
 * Routing uses the public OSRM server. Point these at your own instances for heavy traffic (see README).
 */
const NOMINATIM = import.meta.env.VITE_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON = import.meta.env.VITE_PHOTON_URL || "https://photon.komoot.io";
const OSRM = import.meta.env.VITE_OSRM_URL || "https://router.project-osrm.org";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
}

export type SuggestionSource = "google" | "osm" | "coords";

/** A search result. Google results only get coordinates once picked (see resolveSuggestion). */
export interface Suggestion {
  key: string;
  label: string;
  detail?: string;
  source: SuggestionSource;
  place?: Place;
  placeId?: string;
}

function splitLabel(display: string, name?: string): { label: string; detail?: string } {
  const parts = display.split(",").map((p) => p.trim());
  const label = name || parts[0] || display;
  const detail = parts.slice(name ? 0 : 1).filter((p) => p !== label).slice(0, 3).join(", ");
  return { label, detail: detail || undefined };
}

const unique = (items: (string | undefined)[]) =>
  items.filter((v, i, all): v is string => Boolean(v) && all.indexOf(v) === i);

/** Reads "lat, lng" or a Google Maps link that contains coordinates. */
export function parseCoordinates(text: string): LatLng | null {
  const t = text.trim();
  const patterns = [
    /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { lat, lng };
  }
  return null;
}

async function searchPhoton(query: string, near: LatLng | null | undefined, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: "7", lang: "en" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error("Photon unavailable");
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features ?? []).map((f) => {
    const p = f.properties;
    const street = unique([p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street]);
    const label = p.name || street[0] || p.city || p.state || p.country || "Unnamed place";
    const detail = unique([p.name ? street[0] : undefined, p.locality ?? p.district, p.city, p.state, p.country])
      .filter((d) => d !== label)
      .slice(0, 3)
      .join(", ");
    return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label, detail: detail || undefined };
  });
}

async function searchNominatim(query: string, near: LatLng | null | undefined, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "6", addressdetails: "0" });
  if (near) {
    const d = 0.6; // prefer roughly 60 km around the user without excluding anywhere else
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal, headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Nominatim unavailable");
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), ...splitLabel(r.display_name, r.name) }));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function searchPlaces(
  query: string,
  near?: LatLng | null,
  signal?: AbortSignal,
  sessionToken?: string,
): Promise<Suggestion[]> {
  const coords = parseCoordinates(query);
  if (coords) {
    return [
      {
        key: `c:${coords.lat},${coords.lng}`,
        label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        detail: "Exact coordinates",
        source: "coords",
        place: { ...coords, label: "Pinned location", detail: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` },
      },
    ];
  }

  const [google, photon, nominatim] = await Promise.allSettled([
    googleAutocomplete(query, near, sessionToken),
    searchPhoton(query, near, signal),
    searchNominatim(query, near, signal),
  ]);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const out: Suggestion[] = [];
  if (google.status === "fulfilled") {
    for (const g of google.value) {
      out.push({ key: `g:${g.placeId}`, label: g.label, detail: g.detail, source: "google", placeId: g.placeId });
    }
  }

  const osm: Place[] = [];
  for (const list of [photon, nominatim]) {
    if (list.status !== "fulfilled") continue;
    for (const p of list.value) {
      const dup = osm.some((o) => norm(o.label) === norm(p.label) && haversineMeters(o, p) < 250);
      if (!dup) osm.push(p);
    }
  }
  if (near) osm.sort((a, b) => haversineMeters(near, a) - haversineMeters(near, b));
  const googleLabels = new Set(out.map((g) => norm(g.label)));
  for (const p of osm) {
    if (googleLabels.has(norm(p.label))) continue;
    out.push({ key: `o:${p.lat},${p.lng}`, label: p.label, detail: p.detail, source: "osm", place: p });
  }

  if (!out.length && [google, photon, nominatim].every((r) => r.status === "rejected")) {
    throw new Error("Location search is unavailable right now. Check your connection.");
  }
  return out.slice(0, 8);
}

/** Turns a picked suggestion into a place with coordinates. */
export async function resolveSuggestion(s: Suggestion, sessionToken?: string): Promise<Place> {
  if (s.place) return s.place;
  if (!s.placeId) throw new Error("That result has no location");
  return googleDetails(s.placeId, sessionToken);
}

/* Google Places, proxied through /api/places so the key never reaches the browser */

let googleEnabled: Promise<boolean> | null = null;
export function googleSearchEnabled() {
  googleEnabled ??= fetch("/api/places/status")
    .then((r) => (r.ok ? r.json() : { google: false }))
    .then((j: { google?: boolean }) => Boolean(j.google))
    .catch(() => false);
  return googleEnabled;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

async function googleAutocomplete(
  input: string,
  near: LatLng | null | undefined,
  sessionToken?: string,
): Promise<{ placeId: string; label: string; detail?: string }[]> {
  if (!(await googleSearchEnabled())) return [];
  const res = await fetch("/api/places/autocomplete", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ input, sessionToken, ...(near ? { lat: near.lat, lng: near.lng } : {}) }),
  });
  if (!res.ok) throw new Error("Google search unavailable");
  const json = (await res.json()) as { suggestions?: { placeId: string; label: string; detail?: string }[] };
  return json.suggestions ?? [];
}

async function googleDetails(placeId: string, sessionToken?: string): Promise<Place> {
  const res = await fetch("/api/places/details", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ placeId, sessionToken }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Could not load that place");
  return json as Place;
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
