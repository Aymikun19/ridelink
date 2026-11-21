import { Router } from "express";
import { z } from "zod";
import { requireUser, type AuthedRequest } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";

/*
 * Optional Google Places search. OpenStreetMap does not list many local businesses, so when
 * GOOGLE_MAPS_API_KEY is set the app also searches Google's places. The key stays on the server,
 * requests require a signed-in user, and each user is rate limited.
 */
export const placesRouter = Router();

const GOOGLE = "https://places.googleapis.com/v1";
const key = () => process.env.GOOGLE_MAPS_API_KEY || "";

// Simple per-user limiter (best effort; each serverless instance keeps its own window)
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();
function limit(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) throw new HttpError(429, "Too many searches. Wait a moment and try again.");
  recent.push(now);
  hits.set(userId, recent);
}

/*
 * GET /status reports whether Google search is configured. With ?check=1 it also makes one real
 * request so a bad key, a disabled API or missing billing shows up clearly. The check result is
 * cached for 10 minutes so the endpoint cannot be used to run up the bill.
 */
let lastCheck: { at: number; result: { ok: boolean; status?: number; reason?: string } } | null = null;

async function checkGoogle() {
  if (lastCheck && Date.now() - lastCheck.at < 10 * 60_000) return lastCheck.result;
  let result: { ok: boolean; status?: number; reason?: string };
  try {
    const r = await fetch(`${GOOGLE}/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
      body: JSON.stringify({ input: "Osogbo" }),
    });
    if (r.ok) result = { ok: true, status: r.status };
    else {
      const body = (await r.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
      result = { ok: false, status: r.status, reason: body.error?.message?.slice(0, 300) ?? body.error?.status };
    }
  } catch {
    result = { ok: false, reason: "Could not reach Google" };
  }
  lastCheck = { at: Date.now(), result };
  return result;
}

placesRouter.get("/status", async (req, res, next) => {
  try {
    const google = Boolean(key());
    if (google && req.query.check === "1") return res.json({ google, check: await checkGoogle() });
    res.json({ google });
  } catch (err) {
    next(err);
  }
});

const autocompleteSchema = z.object({
  input: z.string().trim().min(2).max(120),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  sessionToken: z.string().max(64).optional(),
});

interface GoogleSuggestion {
  placePrediction?: {
    placeId: string;
    text?: { text: string };
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    distanceMeters?: number;
  };
}

placesRouter.post("/autocomplete", requireUser, async (req: AuthedRequest, res, next) => {
  try {
    if (!key()) return res.json({ suggestions: [] });
    const parsed = autocompleteSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid search");
    limit(req.userId!);
    const { input, lat, lng, sessionToken } = parsed.data;

    const body: Record<string, unknown> = { input, languageCode: "en" };
    if (sessionToken) body.sessionToken = sessionToken;
    if (lat != null && lng != null) {
      // Prefer places near the user without excluding the rest of the world
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50_000 } };
      body.origin = { latitude: lat, longitude: lng };
    }

    const r = await fetch(`${GOOGLE}/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("Google autocomplete failed", r.status, await r.text().catch(() => ""));
      return res.json({ suggestions: [] });
    }
    const data = (await r.json()) as { suggestions?: GoogleSuggestion[] };
    const suggestions = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<GoogleSuggestion["placePrediction"]> => Boolean(p?.placeId))
      .slice(0, 6)
      .map((p) => ({
        placeId: p.placeId,
        label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        detail: p.structuredFormat?.secondaryText?.text,
        distanceM: p.distanceMeters,
      }));
    res.json({ suggestions });
  } catch (err) {
    next(err);
  }
});

const detailsSchema = z.object({
  placeId: z.string().min(5).max(300).regex(/^[A-Za-z0-9_-]+$/),
  sessionToken: z.string().max(64).optional(),
});

placesRouter.post("/details", requireUser, async (req: AuthedRequest, res, next) => {
  try {
    if (!key()) throw new HttpError(404, "Place search is not configured");
    const parsed = detailsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid place");
    limit(req.userId!);
    const { placeId, sessionToken } = parsed.data;
    const qs = new URLSearchParams({ languageCode: "en" });
    if (sessionToken) qs.set("sessionToken", sessionToken);

    const r = await fetch(`${GOOGLE}/places/${placeId}?${qs}`, {
      headers: { "X-Goog-Api-Key": key(), "X-Goog-FieldMask": "id,displayName,formattedAddress,location" },
    });
    if (!r.ok) {
      console.error("Google place details failed", r.status, await r.text().catch(() => ""));
      throw new HttpError(502, "Could not load that place. Try another result.");
    }
    const p = (await r.json()) as {
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    };
    if (!p.location) throw new HttpError(502, "That place has no map location");
    res.json({
      lat: p.location.latitude,
      lng: p.location.longitude,
      label: p.displayName?.text ?? p.formattedAddress ?? "Selected place",
      detail: p.formattedAddress,
    });
  } catch (err) {
    next(err);
  }
});
