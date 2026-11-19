import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/cn";
import type { LatLng } from "@/lib/geo";
import { carIcon, dropoffIcon, meIcon, pickupIcon } from "./markers";

export interface MapViewProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: (LatLng & { heading?: number | null }) | null;
  me?: LatLng | null;
  route?: [number, number][] | null;
  /** Extra points (e.g. nearby requests) rendered as pickup pins */
  extraPickups?: Array<LatLng & { id: string }>;
  onMapClick?: (point: LatLng) => void;
  /** Re-fit bounds when this key changes */
  fitKey?: string;
  className?: string;
  /** Used when nothing is set yet. Falls back to Lagos, Nigeria. */
  fallbackCenter?: LatLng;
}

const DEFAULT_CENTER: LatLng = { lat: 6.5244, lng: 3.3792 };

const tiles = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

function FitBounds({ points, fitKey }: { points: LatLng[]; fitKey?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15), { animate: true });
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function MapView({
  pickup,
  dropoff,
  driver,
  me,
  route,
  extraPickups,
  onMapClick,
  fitKey,
  className,
  fallbackCenter,
}: MapViewProps) {
  const { theme } = useTheme();

  const points = useMemo(() => {
    const list: LatLng[] = [];
    if (pickup) list.push(pickup);
    if (dropoff) list.push(dropoff);
    if (driver) list.push(driver);
    if (!list.length && me) list.push(me);
    extraPickups?.forEach((p) => list.push(p));
    return list;
  }, [pickup, dropoff, driver, me, extraPickups]);

  const center = points[0] ?? fallbackCenter ?? DEFAULT_CENTER;
  const computedKey =
    fitKey ??
    [pickup, dropoff, me && !pickup ? me : null]
      .map((p) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : "-"))
      .join("|") + `|${extraPickups?.length ?? 0}`;

  return (
    <div className={cn("overflow-hidden", className ?? "relative")}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          key={theme}
          url={tiles[theme]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <InvalidateOnResize />
        <FitBounds points={points} fitKey={computedKey} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {route && route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: "#0b0b0b", weight: 8, opacity: theme === "dark" ? 0.6 : 0.15 }} />
            <Polyline positions={route} pathOptions={{ color: "#c9a84c", weight: 4.5, opacity: 0.95 }} />
          </>
        )}
        {me && <Marker position={[me.lat, me.lng]} icon={meIcon} />}
        {extraPickups?.map((p) => <Marker key={p.id} position={[p.lat, p.lng]} icon={pickupIcon} />)}
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
        {driver && <Marker position={[driver.lat, driver.lng]} icon={carIcon(driver.heading)} />}
      </MapContainer>
    </div>
  );
}
