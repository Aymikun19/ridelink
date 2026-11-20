import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

/** Sends signed-in users on to the app (or where they were headed). */
export function AuthRedirect() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading || !session) return null;
  const from = (location.state as { from?: string } | null)?.from;
  return <Navigate to={from && !["/login", "/signup", "/forgot-password"].includes(from) ? from : "/app"} replace />;
}
