import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { LocateFixed, Map as MapIcon, Minus, Plus, Satellite } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LatLng } from "@/lib/geo";
import { setMapStyle, useMapStyle } from "./mapStyle";

interface Props {
  points: LatLng[];
  me?: LatLng | null;
}

const btn =
  "flex h-10 w-10 items-center justify-center text-fg transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";

export function MapControls({ points, me }: Props) {
  const map = useMap();
  const style = useMapStyle();
  const ref = useRef<HTMLDivElement>(null);

  // Clicks on the controls must not reach the map (which may be in pick-a-point mode)
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  const recenter = () => {
    const list = points.length ? points : me ? [me] : [];
    if (!list.length) return;
    if (list.length === 1) map.setView([list[0].lat, list[0].lng], Math.max(map.getZoom(), 16), { animate: true });
    else map.fitBounds(L.latLngBounds(list.map((p) => [p.lat, p.lng] as [number, number])), { padding: [56, 56], maxZoom: 17 });
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-10 right-3 z-[500] flex flex-col items-end gap-2 lg:bottom-8"
    >
      <div className="flex overflow-hidden rounded-full border border-line bg-elevated/95 p-1 shadow-lg backdrop-blur">
        {(
          [
            ["streets", "Map", MapIcon],
            ["satellite", "Satellite", Satellite],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapStyle(key)}
            aria-pressed={style === key}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              style === key ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-elevated/95 shadow-lg backdrop-blur">
        <button type="button" className={btn} onClick={() => map.zoomIn()} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={() => map.zoomOut()} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" className={btn} onClick={recenter} aria-label="Recentre map">
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
