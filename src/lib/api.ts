import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Network problem. Check your connection and try again.", 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || "Request failed", res.status, json.code);
  return json as T;
}

type Sent = { ok: true; expiresInMinutes: number; resendAfterSeconds: number };

export const api = {
  requestOtp: (email: string) => request<Sent>("/auth/request-otp", { email }),
  verifyOtp: (email: string, code: string) =>
    request<{ ok: true; email: string; tokenHash: string }>("/auth/verify-otp", { email, code }),
  signup: (fullName: string, email: string, password: string) => request<Sent>("/auth/signup", { fullName, email, password }),
  resendVerification: (email: string) => request<Sent>("/auth/resend-verification", { email }),
  verifySignup: (email: string, code: string) => request<{ ok: true }>("/auth/verify-signup", { email, code }),
  forgotPassword: (email: string) => request<Sent>("/auth/forgot-password", { email }),
  resetPassword: (email: string, code: string, password: string) =>
    request<{ ok: true }>("/auth/reset-password", { email, code, password }),
  notifyRide: (rideId: string, event: "accepted" | "arrived" | "completed") =>
    request<{ ok: true }>(`/notify/ride/${rideId}`, { event }, true),
};
