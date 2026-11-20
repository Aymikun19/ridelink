import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { passwordProblem } from "@/lib/password";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthHeading, AuthShell } from "./components/AuthShell";
import { CodeInput } from "./components/CodeInput";
import { PasswordField } from "./components/PasswordField";
import { AuthRedirect } from "./useAuthRedirect";
import { useCooldown, waitSeconds } from "./useCooldown";

export function ForgotPasswordPage() {
  const location = useLocation();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();
  const pwProblem = passwordProblem(password);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      const wait = waitSeconds(message);
      if (wait) setCooldown(wait);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      const res = await api.forgotPassword(email.trim());
      setCooldown(res.resendAfterSeconds);
      setStep("reset");
    });
  };

  const reset = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pwProblem || code.length < 6) return;
    void run(async () => {
      await api.resetPassword(email.trim(), code, password);
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
    });
  };

  const backToLogin = (
    <Link to="/login" className="font-semibold text-fg hover:text-gold">
      Back to log in
    </Link>
  );

  if (step === "reset") {
    return (
      <AuthShell footer={backToLogin}>
        <AuthRedirect />
        <button onClick={() => setStep("email")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Change email
        </button>
        <AuthHeading
          title="Set a new password"
          sub={
            <>
              If an account exists for <span className="font-medium text-fg">{email}</span>, we sent it a 6-digit code.
            </>
          }
        />
        <form onSubmit={reset} className="space-y-5" noValidate>
          <CodeInput value={code} onChange={setCode} disabled={busy} invalid={Boolean(error)} />
          <PasswordField
            name="new-password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters, with a number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showStrength
            error={touched ? pwProblem : null}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length < 6 || !password}>
            Reset password and log in
          </Button>
          <p className="text-center text-sm text-muted">
            Did not get it?{" "}
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="font-semibold text-fg hover:text-gold disabled:text-subtle">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={backToLogin}>
      <AuthRedirect />
      <AuthHeading
        eyebrow="Password reset"
        title="Forgot your"
        accent="password?"
        sub="Enter your email and we will send you a code to set a new one. This also works if you signed up with an email code and never set a password."
      />
      <form onSubmit={sendCode} className="space-y-4">
        <Input
          type="email"
          name="email"
          label="Email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leading={<Mail className="h-4 w-4" />}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" block loading={busy} icon={!busy && <ArrowRight className="h-5 w-5" />}>
          Send reset code
        </Button>
      </form>
    </AuthShell>
  );
}
