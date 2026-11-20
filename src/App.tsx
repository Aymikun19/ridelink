import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { RequireAuth } from "@/components/layout/guards";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { LandingPage } from "@/features/landing/LandingPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { SignupPage } from "@/features/auth/SignupPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { OnboardingPage } from "@/features/auth/OnboardingPage";
import { HomeRouter } from "@/features/rides/HomeRouter";

// Secondary screens are split into their own chunks.
const RidePage = lazy(() => import("@/features/rides/RidePage").then((m) => ({ default: m.RidePage })));
const HistoryPage = lazy(() => import("@/features/rides/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const TemplatesPage = lazy(() => import("@/features/chat/TemplatesPage").then((m) => ({ default: m.TemplatesPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));

function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-6xl font-extrabold text-gold">404</p>
      <p className="text-muted">This page does not exist.</p>
      <Link to="/">
        <Button variant="secondary">Go home</Button>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route
                  path="/onboarding"
                  element={
                    <RequireAuth allowNoRole>
                      <OnboardingPage />
                    </RequireAuth>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route path="/app" element={<HomeRouter />} />
                  <Route path="/ride/:id" element={<RidePage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
