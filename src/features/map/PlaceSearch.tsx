import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crosshair, Loader2, MapPin, Navigation, SearchX, X } from "lucide-react";
import { resolveSuggestion, searchPlaces, type LatLng, type Place, type Suggestion } from "@/lib/geo";
import { cn } from "@/lib/cn";

interface PlaceSearchProps {
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder: string;
  icon: ReactNode;
  near?: LatLng | null;
  extra?: ReactNode;
  autoFocus?: boolean;
  /** Offered when nothing matches, so the user can drop a pin instead */
  onPickOnMap?: () => void;
}

function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PlaceSearch({ value, onChange, placeholder, icon, near, extra, autoFocus, onPickOnMap }: PlaceSearchProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);
  // Groups one search with its pick, which keeps Google billing per session rather than per keystroke
  const session = useRef(newSessionToken());

  useEffect(() => {
    if (!editing.current) setQuery(value?.label ?? "");
  }, [value]);

  // Only the rough area matters for biasing; avoid re-searching on every small GPS update
  const nearKey = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : "";

  useEffect(() => {
    if (!editing.current) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    // Debounced to respect the geocoders' rate limits
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchPlaces(q, near, controller.signal, session.current));
        setSearched(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nearKey]);

  const pick = async (s: Suggestion) => {
    setResolving(s.key);
    setError(null);
    try {
      const place = await resolveSuggestion(s, session.current);
      editing.current = false;
      setQuery(place.label);
      setOpen(false);
      setResults([]);
      setSearched(false);
      session.current = newSessionToken();
      onChange(place);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResolving(null);
    }
  };

  const hasGoogle = results.some((r) => r.source === "google");
  const hasOsm = results.some((r) => r.source === "osm");
  const noMatches = searched && !loading && !error && results.length === 0;

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
              setResults([]);
              setSearched(false);
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

      {open && (results.length > 0 || error || noMatches) && (
        <div className="rl-pop absolute inset-x-0 top-full z-[600] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-elevated p-1.5 shadow-2xl scrollbar-thin">
          {error && <p className="px-3 py-2 text-sm text-danger">{error}</p>}

          {noMatches && (
            <div className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <div>
                <p className="font-medium">No matches for "{query.trim()}"</p>
                <p className="mt-0.5 text-xs text-muted">
                  Try adding the area or city, paste coordinates or a Google Maps link, or set it on the map.
                </p>
              </div>
            </div>
          )}

          {results.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={resolving !== null}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-fg/5 disabled:opacity-60")}
            >
              {resolving === r.key ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gold" />
              ) : r.source === "coords" ? (
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.label}</span>
                {r.detail && <span className="block truncate text-xs text-muted">{r.detail}</span>}
              </span>
            </button>
          ))}

          {onPickOnMap && (searched || error) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                onPickOnMap();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-fg/5 hover:text-fg"
            >
              <Crosshair className="h-4 w-4 shrink-0" />
              Not listed? Set it on the map
            </button>
          )}

          {(hasGoogle || hasOsm) && (
            <p className="px-3 pb-1 pt-2 text-[10px] text-subtle">
              {hasGoogle && hasOsm
                ? "Results from Google Maps and OpenStreetMap"
                : hasGoogle
                  ? "Results from Google Maps"
                  : "Results from OpenStreetMap"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
