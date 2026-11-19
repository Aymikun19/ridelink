import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { FullPageSpinner } from "@/components/ui/Spinner";

/** Requires a session and a chosen role. */
export function RequireAuth({ children, allowNoRole }: { children: ReactNode; allowNoRole?: boolean }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner label="Loading" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <FullPageSpinner label="Setting up your account" />;
  if (!profile.role && !allowNoRole) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
