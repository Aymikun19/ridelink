import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";
import { supabaseAdmin } from "./supabase.js";
import { sendCodeEmail, type CodePurpose } from "./email.js";
import { HttpError } from "./errors.js";

export const OTP_TTL_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(email: string, purpose: CodePurpose, code: string) {
  return createHmac("sha256", env.otpSecret).update(`${purpose}:${email}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Creates a 6-digit code for (email, purpose), enforces rate limits and emails it. */
export async function issueCode(email: string, purpose: CodePurpose) {
  const db = supabaseAdmin();
  const { data: existing, error: readErr } = await db
    .from("otp_codes")
    .select("last_sent_at, send_count, window_start")
    .eq("email", email)
    .eq("purpose", purpose)
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
    if (now - new Date(existing.window_start).getTime() < 60 * 60 * 1000) {
      if (existing.send_count >= MAX_SENDS_PER_HOUR) {
        throw new HttpError(429, "Too many codes requested. Try again in an hour.", "rate_limited");
      }
      sendCount = existing.send_count + 1;
      windowStart = existing.window_start;
    }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const { error } = await db.from("otp_codes").upsert(
    {
      email,
      purpose,
      code_hash: hashCode(email, purpose, code),
      expires_at: new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
      attempts: 0,
      last_sent_at: new Date(now).toISOString(),
      send_count: sendCount,
      window_start: windowStart,
    },
    { onConflict: "email,purpose" },
  );
  if (error) throw error;

  await sendCodeEmail(email, code, OTP_TTL_MINUTES, purpose);
}

/** Checks a code; on success it is consumed. Throws a user-readable HttpError otherwise. */
export async function consumeCode(email: string, purpose: CodePurpose, code: string) {
  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("otp_codes")
    .select("code_hash, expires_at, attempts")
    .eq("email", email)
    .eq("purpose", purpose)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new HttpError(400, "Request a new code to continue", "no_code");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(400, "This code has expired. Request a new one.", "expired");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many wrong attempts. Request a new code.", "locked");
  }
  if (!safeEqualHex(row.code_hash, hashCode(email, purpose, code))) {
    await db.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("email", email).eq("purpose", purpose);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new HttpError(
      400,
      left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one.",
      "invalid",
    );
  }
  await db.from("otp_codes").delete().eq("email", email).eq("purpose", purpose);
}

export interface AuthUserInfo {
  id: string;
  email_confirmed: boolean;
  has_password: boolean;
}

export async function findUserByEmail(email: string): Promise<AuthUserInfo | null> {
  const { data, error } = await supabaseAdmin().rpc("auth_user_by_email", { p_email: email });
  if (error) throw error;
  return ((data as AuthUserInfo[] | null) ?? [])[0] ?? null;
}
