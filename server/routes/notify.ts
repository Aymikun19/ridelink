import { Router } from "express";
import { z } from "zod";
import { requireUser, type AuthedRequest } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { sendRideUpdateEmail } from "../lib/email.js";
import { HttpError } from "../lib/errors.js";

export const notifyRouter = Router();

const copy = {
  accepted: (driver: string) => ({
    title: "A driver accepted your ride",
    message: `${driver} accepted your ride request and is heading to your pickup point.`,
  }),
  arrived: (driver: string) => ({
    title: "Your driver has arrived",
    message: `${driver} is waiting at your pickup point.`,
  }),
  completed: (driver: string) => ({
    title: "Trip completed",
    message: `Your trip with ${driver} is complete. You can rate the trip in the app.`,
  }),
} as const;

/**
 * Sends an email to the customer about a status change. Only the assigned driver can trigger it,
 * and only for the status the ride is actually in, so it cannot be used to spam.
 */
notifyRouter.post("/ride/:id", requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({ event: z.enum(["accepted", "arrived", "completed"]) })
      .safeParse(req.body);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success || !id.success) throw new HttpError(400, "Invalid request");
    const { event } = parsed.data;
    const db = supabaseAdmin();

    const { data: ride, error } = await db
      .from("rides")
      .select("id, status, driver_id, customer:profiles!rides_customer_id_fkey(email), driver:profiles!rides_driver_id_fkey(full_name)")
      .eq("id", id.data)
      .maybeSingle();
    if (error) throw error;
    if (!ride || ride.driver_id !== req.userId) throw new HttpError(404, "Ride not found");
    if (ride.status !== event) throw new HttpError(409, "Ride status does not match this notification");

    const customer = ride.customer as unknown as { email: string } | null;
    const driver = ride.driver as unknown as { full_name: string | null } | null;
    if (!customer?.email) throw new HttpError(404, "Customer not found");

    const content = copy[event](driver?.full_name?.trim() || "Your driver");
    await sendRideUpdateEmail(customer.email, { ...content, rideId: ride.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
