import { useEffect, useState, type FormEvent } from "react";
import { Briefcase, Home, MapPin, Star } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import type { Place } from "@/lib/geo";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { SavedPlace } from "@/types";
import { listSavedPlaces, savePlace, toPlace } from "./placesApi";

const iconFor = (label: string) => {
  const l = label.toLowerCase();
  if (l === "home" || l.includes("hostel") || l.includes("house")) return Home;
  if (l === "work" || l.includes("office")) return Briefcase;
  return MapPin;
};

interface Props {
  /** Fills the drop-off (or pickup) when a saved place is tapped */
  onPick: (place: Place) => void;
  /** The place the user can save, usually the current drop-off */
  current: Place | null;
}

/** One-tap chips for saved places plus a "Save" action for the current place. */
export function SavedPlacesBar({ onPick, current }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listSavedPlaces().then(setPlaces).catch(() => setPlaces([]));
  }, []);

  const alreadySaved =
    current && places.some((p) => Math.abs(p.lat - current.lat) < 1e-5 && Math.abs(p.lng - current.lng) < 1e-5);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !current || !label.trim()) return;
    setSaving(true);
    try {
      const saved = await savePlace(profile.id, label, current);
      setPlaces((list) => [...list, saved]);
      setOpen(false);
      setLabel("");
      toast({ tone: "success", title: `Saved as ${saved.label}` });
    } catch (err) {
      toast({ tone: "error", title: "Could not save place", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!places.length && !current) return null;

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {places.map((p) => {
          const Icon = iconFor(p.label);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(toPlace(p))}
              title={p.address}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:border-gold/60 hover:text-gold"
            >
              <Icon className="h-3.5 w-3.5 text-gold" />
              {p.label}
            </button>
          );
        })}
        {current && !alreadySaved && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-fg"
          >
            <Star className="h-3.5 w-3.5" /> Save this place
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Save this place">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">{current && [current.label, current.detail].filter(Boolean).join(", ")}</p>
          <div className="flex flex-wrap gap-2">
            {["Home", "Work", "School", "Gym"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLabel(s)}
                className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:border-gold/60 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
          <Input label="Name" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="e.g. Home" autoFocus required />
          <Button type="submit" block loading={saving} disabled={!label.trim()}>
            Save place
          </Button>
        </form>
      </Modal>
    </>
  );
}
