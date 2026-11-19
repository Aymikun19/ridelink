import type { RideStatus } from "@/types";

export const statusMeta: Record<RideStatus, { label: string; tone: "neutral" | "gold" | "success" | "danger" | "info" }> = {
  requested: { label: "Finding a driver", tone: "gold" },
  accepted: { label: "Driver on the way", tone: "info" },
  arrived: { label: "Driver has arrived", tone: "success" },
  in_progress: { label: "On trip", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const statusSteps: { key: RideStatus; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "arrived", label: "Driver arrived" },
  { key: "in_progress", label: "On trip" },
  { key: "completed", label: "Completed" },
];
