import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/geo";
import type { SavedPlace } from "@/types";

export async function listSavedPlaces() {
  const { data, error } = await supabase.from("saved_places").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SavedPlace[];
}

export async function savePlace(userId: string, label: string, place: Place) {
  const { data, error } = await supabase
    .from("saved_places")
    .insert({
      user_id: userId,
      label: label.trim(),
      address: [place.label, place.detail].filter(Boolean).join(", "),
      lat: place.lat,
      lng: place.lng,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SavedPlace;
}

export async function deleteSavedPlace(id: string) {
  const { error } = await supabase.from("saved_places").delete().eq("id", id);
  if (error) throw error;
}

export function toPlace(p: SavedPlace): Place {
  const [first, ...rest] = p.address.split(",").map((s) => s.trim());
  return { lat: p.lat, lng: p.lng, label: first || p.label, detail: rest.join(", ") || undefined };
}
