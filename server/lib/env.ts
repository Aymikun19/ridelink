function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return process.env.SUPABASE_URL || required("VITE_SUPABASE_URL");
  },
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  get resendFrom() {
    return process.env.RESEND_FROM || "RideLink <onboarding@resend.dev>";
  },
  get otpSecret() {
    return required("OTP_SECRET");
  },
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
  },
  appName: "RideLink",
};
