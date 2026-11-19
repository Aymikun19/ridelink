import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { searchPlaces, type LatLng, type Place } from "@/lib/geo";
import { cn } from "@/lib/cn";

interface PlaceSearchProps {
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  icon: ReactNode;
  near?: LatLng | null;
  extra?: ReactNode;
  autoFocus?: boolean;
}

export function PlaceSearch({ value, onChange, placeholder, icon, near, extra, autoFocus }: PlaceSearchProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setQuery(value?.label ?? "");
  }, [value]);

  useEffect(() => {
    if (!editing.current) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    // Debounced to respect the geocoder's rate limits.
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchPlaces(q, near, controller.signal));
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 550);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, near]);

  const pick = (p: Place) => {
    editing.current = false;
    setQuery(p.label);
    setOpen(false);
    setResults([]);
    onChange(p);
  };

  return (
    <div className="relative">
      <div className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-bg/60 px-4 focus-within:border-gold/60 focus-within:ring-4 focus-within:ring-gold/10">
        <span className="shrink-0 text-subtle">{icon}</span>
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            editing.current = true;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-subtle" />}
        {value && !loading && (
          <button
            type="button"
            onClick={() => {
              editing.current = false;
              setQuery("");
              onChange(null);
            }}
            className="text-subtle hover:text-fg"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {extra}
      </div>

      {open && (results.length > 0 || error) && (
        <div className="rl-pop absolute inset-x-0 top-full z-[600] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-line bg-elevated p-1.5 shadow-2xl scrollbar-thin">
          {error && <p className="px-3 py-2 text-sm text-danger">{error}</p>}
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-fg/5")}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.label}</span>
                {r.detail && <span className="block truncate text-xs text-muted">{r.detail}</span>}
              </span>
            </button>
          ))}
          <p className="px-3 pb-1 pt-2 text-[10px] text-subtle">Search by OpenStreetMap</p>
        </div>
      )}
    </div>
  );
}
