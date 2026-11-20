import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { HttpError } from "../lib/errors.js";
import { OTP_TTL_MINUTES, RESEND_COOLDOWN_SECONDS, consumeCode, findUserByEmail, issueCode } from "../lib/otp.js";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code from your email");
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");
const fullName = z.string().trim().min(2, "Enter your full name").max(80);

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid request");
  return r.data;
}

const sent = { ok: true, expiresInMinutes: OTP_TTL_MINUTES, resendAfterSeconds: RESEND_COOLDOWN_SECONDS } as const;

/** One-time login token the browser exchanges with supabase.auth.verifyOtp({ token_hash, type: "email" }). */
async function loginToken(address: string) {
  const db = supabaseAdmin();
  let link = await db.auth.admin.generateLink({ type: "magiclink", email: address });
  if (link.error) {
    const created = await db.auth.admin.createUser({ email: address, email_confirm: true });
    if (created.error && !/already/i.test(created.error.message)) throw created.error;
    link = await db.auth.admin.generateLink({ type: "magiclink", email: address });
    if (link.error) throw link.error;
  }
  return link.data.properties.hashed_token;
}

export const authRouter = Router();

/* ---------------- Sign in with an email code ---------------- */

authRouter.post("/request-otp", async (req, res, next) => {
  try {
    const body = parse(z.object({ email }), req.body);
    await issueCode(body.email, "login");
    res.json(sent);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const body = parse(z.object({ email, code }), req.body);
    await consumeCode(body.email, "login", body.code);
    res.json({ ok: true, email: body.email, tokenHash: await loginToken(body.email) });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Sign up with a password ---------------- */

authRouter.post("/signup", async (req, res, next) => {
  try {
    const body = parse(z.object({ fullName, email, password }), req.body);
    const db = supabaseAdmin();
    const existing = await findUserByEmail(body.email);

    if (existing?.email_confirmed) {
      throw new HttpError(409, "An account with this email already exists. Log in or reset your password.", "exists");
    }
    if (existing) {
      // Started sign-up before but never confirmed: take the latest details.
      const { error } = await db.auth.admin.updateUserById(existing.id, {
        password: body.password,
        user_metadata: { full_name: body.fullName },
      });
      if (error) throw error;
      await db.from("profiles").update({ full_name: body.fullName }).eq("id", existing.id);
    } else {
      const { error } = await db.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: false,
        user_metadata: { full_name: body.fullName },
      });
      if (error) throw error;
    }

    await issueCode(body.email, "signup");
    res.json(sent);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-verification", async (req, res, next) => {
  try {
    const body = parse(z.object({ email }), req.body);
    const user = await findUserByEmail(body.email);
    if (user && !user.email_confirmed) await issueCode(body.email, "signup");
    res.json(sent);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-signup", async (req, res, next) => {
  try {
    const body = parse(z.object({ email, code }), req.body);
    const user = await findUserByEmail(body.email);
    if (!user) throw new HttpError(400, "Sign up again to continue", "no_user");
    await consumeCode(body.email, "signup", body.code);
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, { email_confirm: true });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Forgot password ---------------- */

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const body = parse(z.object({ email }), req.body);
    const user = await findUserByEmail(body.email);
    // Same answer whether or not the account exists, so emails cannot be probed.
    if (user) await issueCode(body.email, "reset");
    res.json(sent);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const body = parse(z.object({ email, code, password }), req.body);
    const user = await findUserByEmail(body.email);
    if (!user) throw new HttpError(400, "Incorrect code. Request a new one.", "invalid");
    await consumeCode(body.email, "reset", body.code);
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
      password: body.password,
      email_confirm: true,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
