import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Check, UserRound } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import type { Role } from "@/types";
import { ProfileForm, cleanFields, toFields } from "@/features/profile/ProfileForm";

const options: { role: Role; title: string; body: string; icon: typeof Car }[] = [
  { role: "customer", title: "I need rides", body: "Request a driver, track them live and chat during the trip.", icon: UserRound },
  { role: "driver", title: "I drive", body: "Go online, get request alerts nearby and pick up customers.", icon: Car },
];

export function OnboardingPage() {
  const { profile, updateProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<"role" | "details">("role");

  if (profile?.role) return <Navigate to="/app" replace />;

  return (
    <div className="relative flex min-h-full flex-col bg-grid">
      <div className="glow-gold pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="relative mx-auto w-full max-w-xl flex-1 px-5 pb-16 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Step {step === "role" ? 1 : 2} of 2</p>
        {step === "role" ? (
          <>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              How will you use <span className="font-serif font-normal italic text-gold">RideLink?</span>
            </h1>
            <p className="mt-2 text-muted">This cannot be changed later, so pick the one that fits. Use a separate email for the other role.</p>
            <div className="mt-8 grid gap-3">
              {options.map((o) => (
                <button
                  key={o.role}
                  onClick={() => setRole(o.role)}
                  className={cn(
                    "flex items-center gap-4 rounded-3xl border bg-surface p-5 text-left transition",
                    role === o.role ? "border-gold ring-4 ring-gold/10" : "border-line hover:border-fg/30",
                  )}
                >
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line", role === o.role ? "bg-gold text-[#0b0b0b]" : "text-gold")}>
                    <o.icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-lg font-bold">{o.title}</span>
                    <span className="block text-sm text-muted">{o.body}</span>
                  </span>
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", role === o.role ? "border-gold bg-gold text-[#0b0b0b]" : "border-line")}>
                    {role === o.role && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
            <button
              disabled={!role}
              onClick={() => setStep("details")}
              className="mt-8 h-13 w-full rounded-full bg-fg font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              Continue
            </button>
          </>
        ) : (
          role && (
            <>
              <button onClick={() => setStep("role")} className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
                {role === "driver" ? "Your driver details" : "Your details"}
              </h1>
              <p className="mb-8 mt-2 text-muted">
                {role === "driver" ? "Customers see your name, vehicle and plate when you accept their ride." : "Your driver sees your first name."}
              </p>
              <ProfileForm
                role={role}
                initial={toFields(profile)}
                submitLabel="Finish setup"
                onSubmit={async (f) => {
                  try {
                    await updateProfile({ ...cleanFields(f, role), role });
                    navigate("/app", { replace: true });
                  } catch (err) {
                    toast({ tone: "error", title: "Could not save", body: readableError(err) });
                  }
                }}
              />
            </>
          )
        )}
      </main>
    </div>
  );
}
