import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || "http://localhost:54321", anonKey || "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Turns a Postgres / PostgREST error into a sentence a user can read. */
export function readableError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  if (!message) return fallback;
  if (message.includes("one_active_ride_per_customer")) return "You already have an active ride.";
  if (message.includes("one_active_ride_per_driver")) return "You already have an active ride.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Network problem. Check your connection and try again.";
  return message;
}
