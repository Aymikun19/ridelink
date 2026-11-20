import { supabase } from "./supabase";

/** Uploads an image to a public bucket under the user's folder and returns its public URL. */
export async function uploadPublicImage(bucket: "avatars" | "vehicles", userId: string, blob: Blob) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of a previously uploaded public file, given its public URL. */
export function removePublicImage(bucket: "avatars" | "vehicles", publicUrl: string | null | undefined) {
  const path = publicUrl?.split(`/${bucket}/`)[1];
  if (path) void supabase.storage.from(bucket).remove([decodeURIComponent(path)]);
}

/** Downscales an image file to at most `max` px on its long side, as JPEG. PDFs pass through. */
export async function shrinkImage(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), "image/jpeg", 0.85),
  );
}
