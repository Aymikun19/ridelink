export type Role = "customer" | "driver";

export type VehicleType = "sedan" | "suv" | "minivan" | "tricycle" | "motorcycle";

export const VEHICLE_TYPES: { value: VehicleType; label: string; seats: number }[] = [
  { value: "sedan", label: "Car (sedan or hatchback)", seats: 4 },
  { value: "suv", label: "SUV", seats: 6 },
  { value: "minivan", label: "Minivan or bus", seats: 8 },
  { value: "tricycle", label: "Tricycle (keke)", seats: 3 },
  { value: "motorcycle", label: "Motorcycle (okada)", seats: 1 },
];

export function vehicleTypeLabel(t: VehicleType | null | undefined) {
  return VEHICLE_TYPES.find((v) => v.value === t)?.label.replace(/ \(.*\)$/, "") ?? "";
}

export type RideStatus = "requested" | "accepted" | "arrived" | "in_progress" | "completed" | "cancelled";

export const ACTIVE_STATUSES: RideStatus[] = ["requested", "accepted", "arrived", "in_progress"];

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  plate_number: string | null;
  avatar_url: string | null;
  vehicle_type: VehicleType | null;
  vehicle_year: number | null;
  vehicle_seats: number | null;
  vehicle_photo_url: string | null;
  driver_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: RideStatus;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_m: number | null;
  duration_s: number | null;
  notes: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  customer_rating: number | null;
  customer_feedback: string | null;
  requested_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface NearbyRequest {
  id: string;
  customer_id: string;
  customer_name: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_m: number | null;
  duration_s: number | null;
  notes: string | null;
  requested_at: string;
  pickup_distance_km: number;
}

export interface DriverStatus {
  driver_id: string;
  is_online: boolean;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  updated_at: string;
}

export type MessageKind = "text" | "voice";

export interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
  read_at: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string | null;
  role: Role | null;
  kind: MessageKind;
  title: string;
  body: string | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
  sort_order: number;
  created_at: string;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
}

export type DocumentStatus = "incomplete" | "submitted" | "approved" | "rejected";

export interface DriverDocuments {
  driver_id: string;
  license_number: string | null;
  license_expiry: string | null;
  license_photo_path: string | null;
  registration_number: string | null;
  registration_doc_path: string | null;
  insurance_doc_path: string | null;
  status: DocumentStatus;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface Conversation {
  ride_id: string;
  status: RideStatus;
  requested_at: string;
  pickup_address: string;
  dropoff_address: string;
  counterpart_id: string;
  counterpart_name: string | null;
  counterpart_avatar: string | null;
  last_kind: MessageKind | null;
  last_body: string | null;
  last_sender: string | null;
  last_at: string;
  unread: number;
}
