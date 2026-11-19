import { Router } from "express";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../lib/env.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { sendOtpEmail } from "../lib/email.js";
import { HttpError } from "../lib/errors.js";

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function hashCode(email: string, code: string) {
  return createHmac("sha256", env.otpSecret).update(`${email}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const authRouter = Router();

/** Step 1: email a 6 digit code. */
authRouter.post("/request-otp", async (req, res, next) => {
  try {
    const parsed = z.object({ email: emailSchema }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Enter a valid email address");
    const { email } = parsed.data;
    const db = supabaseAdmin();

    const { data: existing, error: readErr } = await db
      .from("otp_codes")
      .select("last_sent_at, send_count, window_start")
      .eq("email", email)
      .maybeSingle();
    if (readErr) throw readErr;

    const now = Date.now();
    let sendCount = 1;
    let windowStart = new Date(now).toISOString();

    if (existing) {
      const sinceLast = (now - new Date(existing.last_sent_at).getTime()) / 1000;
      if (sinceLast < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - sinceLast);
        throw new HttpError(429, `Please wait ${wait}s before requesting another code`, "cooldown");
      }
      const windowAge = now - new Date(existing.window_start).getTime();
      if (windowAge < 60 * 60 * 1000) {
        if (existing.send_count >= MAX_SENDS_PER_HOUR) {
          throw new HttpError(429, "Too many codes requested. Try again in an hour.", "rate_limited");
        }
        sendCount = existing.send_count + 1;
        windowStart = existing.window_start;
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const { error: upsertErr } = await db.from("otp_codes").upsert({
      email,
      code_hash: hashCode(email, code),
      expires_at: new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
      send_count: sendCount,
      window_start: windowStart,
    });
    if (upsertErr) throw upsertErr;

    await sendOtpEmail(email, code, OTP_TTL_MINUTES);
    res.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES, resendAfterSeconds: RESEND_COOLDOWN_SECONDS });
  } catch (err) {
    next(err);
  }
});

/**
 * Step 2: check the code, then mint a one-time Supabase token hash.
 * The browser exchanges it with supabase.auth.verifyOtp({ token_hash, type: "email" })
 * ("email" accepts both first-sign-up and returning-user tokens), so the session is a normal Supabase session and RLS works with auth.uid().
 */
authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const parsed = z
      .object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/) })
      .safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Enter the 6 digit code from your email");
    const { email, code } = parsed.data;
    const db = supabaseAdmin();

    const { data: row, error } = await db
      .from("otp_codes")
      .select("code_hash, expires_at, attempts")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new HttpError(400, "Request a new code to continue", "no_code");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new HttpError(400, "This code has expired. Request a new one.", "expired");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new HttpError(429, "Too many wrong attempts. Request a new code.", "locked");
    }

    if (!safeEqualHex(row.code_hash, hashCode(email, code))) {
      await db.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("email", email);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      throw new HttpError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one.", "invalid");
    }

    await db.from("otp_codes").delete().eq("email", email);

    let link = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) {
      // First sign-in: create the user (email is verified by the code we just checked).
      const created = await db.auth.admin.createUser({ email, email_confirm: true });
      if (created.error && !/already/i.test(created.error.message)) throw created.error;
      link = await db.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error) throw link.error;
    }

    res.json({ ok: true, email, tokenHash: link.data.properties.hashed_token });
  } catch (err) {
    next(err);
  }
});
