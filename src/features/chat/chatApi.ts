import { supabase } from "@/lib/supabase";
import { VOICE_BUCKET } from "@/lib/config";
import type { Conversation, Message, MessageTemplate, Role } from "@/types";

function extFor(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

function baseMime(mime: string) {
  // Storage checks allowed types against the base type, without codec params
  const base = mime.split(";")[0].trim();
  return base === "audio/x-m4a" ? "audio/mp4" : base || "audio/webm";
}

export async function listMessages(rideId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendText(rideId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ ride_id: rideId, sender_id: senderId, kind: "text", body: body.trim() })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

async function uploadAudio(path: string, blob: Blob) {
  // Blob bodies are sent as multipart and the server reads the Blob's own type,
  // so normalise it (MediaRecorder reports e.g. "audio/webm;codecs=opus").
  const type = baseMime(blob.type);
  const file = blob.type === type ? blob : new Blob([blob], { type });
  const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}

export async function sendVoice(rideId: string, senderId: string, blob: Blob, durationMs: number) {
  const path = `rides/${rideId}/${crypto.randomUUID()}.${extFor(blob.type)}`;
  await uploadAudio(path, blob);
  const { data, error } = await supabase
    .from("messages")
    .insert({ ride_id: rideId, sender_id: senderId, kind: "voice", audio_path: path, audio_duration_ms: Math.round(durationMs) })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

/** Sends a saved voice template by copying the audio into the ride's folder. */
export async function sendVoiceTemplate(rideId: string, senderId: string, template: MessageTemplate) {
  if (!template.audio_path) throw new Error("This template has no audio");
  const ext = template.audio_path.split(".").pop() || "webm";
  const path = `rides/${rideId}/${crypto.randomUUID()}.${ext}`;
  const { error: copyErr } = await supabase.storage.from(VOICE_BUCKET).copy(template.audio_path, path);
  if (copyErr) throw copyErr;
  const { data, error } = await supabase
    .from("messages")
    .insert({ ride_id: rideId, sender_id: senderId, kind: "voice", audio_path: path, audio_duration_ms: template.audio_duration_ms })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markRead(rideId: string) {
  await supabase.rpc("mark_messages_read", { p_ride: rideId });
  announceMessagesChanged();
}

const urlCache = new Map<string, { url: string; expires: number }>();

export async function audioUrl(path: string) {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Could not load audio");
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

/* ---------------- Templates ---------------- */

export async function listTemplates() {
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("user_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageTemplate[];
}

export async function createTextTemplate(userId: string, role: Role | null, title: string, body: string) {
  const { data, error } = await supabase
    .from("message_templates")
    .insert({ user_id: userId, role, kind: "text", title: title.trim(), body: body.trim(), sort_order: Date.now() % 1_000_000 })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageTemplate;
}

export async function createVoiceTemplate(userId: string, role: Role | null, title: string, blob: Blob, durationMs: number) {
  const path = `templates/${userId}/${crypto.randomUUID()}.${extFor(blob.type)}`;
  await uploadAudio(path, blob);
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      user_id: userId,
      role,
      kind: "voice",
      title: title.trim(),
      audio_path: path,
      audio_duration_ms: Math.round(durationMs),
      sort_order: Date.now() % 1_000_000,
    })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(VOICE_BUCKET).remove([path]);
    throw error;
  }
  return data as MessageTemplate;
}

export async function updateTextTemplate(id: string, title: string, body: string) {
  const { data, error } = await supabase
    .from("message_templates")
    .update({ title: title.trim(), body: body.trim() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageTemplate;
}

export async function deleteTemplate(t: MessageTemplate) {
  const { error } = await supabase.from("message_templates").delete().eq("id", t.id);
  if (error) throw error;
  if (t.audio_path) await supabase.storage.from(VOICE_BUCKET).remove([t.audio_path]);
}

/* ---------------- Inbox ---------------- */

export async function listConversations() {
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

/** Fired when messages arrive or are read, so the unread badge refreshes. */
export const MESSAGES_CHANGED = "rl:messages-changed";
export function announceMessagesChanged() {
  window.dispatchEvent(new Event(MESSAGES_CHANGED));
}
