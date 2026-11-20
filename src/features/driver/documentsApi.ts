import { supabase } from "@/lib/supabase";
import { shrinkImage } from "@/lib/uploads";
import type { DriverDocuments, Profile } from "@/types";

const BUCKET = "driver-docs";

export async function getDriverDocuments(driverId: string) {
  const { data, error } = await supabase.from("driver_documents").select("*").eq("driver_id", driverId).maybeSingle();
  if (error) throw error;
  return data as DriverDocuments | null;
}

export async function saveDriverDocuments(driverId: string, patch: Partial<DriverDocuments>) {
  const { driver_id: _d, status: _s, review_note: _r, reviewed_at: _ra, submitted_at: _sa, updated_at: _u, ...allowed } = patch;
  const { data, error } = await supabase
    .from("driver_documents")
    .upsert({ driver_id: driverId, ...allowed }, { onConflict: "driver_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as DriverDocuments;
}

export async function uploadDriverDocument(driverId: string, kind: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("That file is larger than 10 MB.");
  const body = await shrinkImage(file);
  if (body.size > 5 * 1024 * 1024) throw new Error("That file is still larger than 5 MB after compression.");
  const ext = body.type === "application/pdf" ? "pdf" : "jpg";
  const path = `${driverId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: body.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function documentUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export function removeDriverDocument(path: string | null | undefined) {
  if (path) void supabase.storage.from(BUCKET).remove([path]);
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/** Mirrors the completeness rule in the database trigger, for showing progress. */
export function driverChecklist(p: Profile, d: DriverDocuments | null): ChecklistItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { key: "avatar", label: "Profile photo", done: Boolean(p.avatar_url) },
    { key: "vehicle_type", label: "Vehicle type", done: Boolean(p.vehicle_type) },
    { key: "vehicle", label: "Make, model, colour and plate", done: Boolean(p.vehicle_make && p.vehicle_model && p.vehicle_color && p.plate_number) },
    { key: "vehicle_photo", label: "Vehicle photo", done: Boolean(p.vehicle_photo_url) },
    { key: "license", label: "Driver's licence number and expiry", done: Boolean(d?.license_number && d.license_expiry && d.license_expiry > today) },
    { key: "license_photo", label: "Driver's licence photo", done: Boolean(d?.license_photo_path) },
    { key: "registration", label: "Vehicle registration number and document", done: Boolean(d?.registration_number && d.registration_doc_path) },
  ];
}
