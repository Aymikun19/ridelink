import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Place } from "@/lib/geo";
import { ACTIVE_STATUSES, type NearbyRequest, type Ride, type RideStatus } from "@/types";

export async function requestRide(input: {
  customerId: string;
  pickup: Place;
  dropoff: Place;
  distanceM?: number | null;
  durationS?: number | null;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("rides")
    .insert({
      customer_id: input.customerId,
      pickup_address: [input.pickup.label, input.pickup.detail].filter(Boolean).join(", "),
      pickup_lat: input.pickup.lat,
      pickup_lng: input.pickup.lng,
      dropoff_address: [input.dropoff.label, input.dropoff.detail].filter(Boolean).join(", "),
      dropoff_lat: input.dropoff.lat,
      dropoff_lng: input.dropoff.lng,
      distance_m: input.distanceM ?? null,
      duration_s: input.durationS || null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Ride;
}

export async function getRide(id: string) {
  const { data, error } = await supabase.from("rides").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Ride | null;
}

export async function getActiveRide(userId: string, role: "customer" | "driver") {
  const column = role === "customer" ? "customer_id" : "driver_id";
  const statuses = role === "customer" ? ACTIVE_STATUSES : ACTIVE_STATUSES.filter((s) => s !== "requested");
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq(column, userId)
    .in("status", statuses)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Ride | null;
}

export async function listRideHistory(userId: string, role: "customer" | "driver", limit = 50) {
  const column = role === "customer" ? "customer_id" : "driver_id";
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq(column, userId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Ride[];
}

export async function countCompletedSince(userId: string, role: "customer" | "driver", since?: Date) {
  const column = role === "customer" ? "customer_id" : "driver_id";
  let q = supabase.from("rides").select("id", { count: "exact", head: true }).eq(column, userId).eq("status", "completed");
  if (since) q = q.gte("completed_at", since.toISOString());
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function nearbyRequests(lat: number, lng: number, radiusKm: number) {
  const { data, error } = await supabase.rpc("nearby_ride_requests", { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
  if (error) throw error;
  return (data ?? []) as NearbyRequest[];
}

function notify(rideId: string, event: "accepted" | "arrived" | "completed") {
  // Email is a courtesy; in-app realtime is the primary channel, so failures are only logged.
  api.notifyRide(rideId, event).catch((err) => console.warn("[notify]", err.message));
}

export async function acceptRide(id: string) {
  const { data, error } = await supabase.rpc("accept_ride", { p_ride: id });
  if (error) throw error;
  notify(id, "accepted");
  return data as Ride;
}

export async function declineRide(id: string) {
  const { error } = await supabase.rpc("decline_ride", { p_ride: id });
  if (error) throw error;
}

export async function advanceRide(id: string, status: Extract<RideStatus, "arrived" | "in_progress" | "completed">) {
  const { data, error } = await supabase.rpc("advance_ride", { p_ride: id, p_status: status });
  if (error) throw error;
  if (status !== "in_progress") notify(id, status);
  return data as Ride;
}

export async function cancelRide(id: string, reason?: string) {
  const { data, error } = await supabase.rpc("cancel_ride", { p_ride: id, p_reason: reason || null });
  if (error) throw error;
  return data as Ride;
}

export async function rateRide(id: string, rating: number, feedback?: string) {
  const { data, error } = await supabase.rpc("rate_ride", { p_ride: id, p_rating: rating, p_feedback: feedback || null });
  if (error) throw error;
  return data as Ride;
}
