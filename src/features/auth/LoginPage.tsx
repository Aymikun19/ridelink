import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, KeyRound, Mail, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { AuthHeading, AuthShell } from "./components/AuthShell";
import { CodeInput } from "./components/CodeInput";
import { PasswordField } from "./components/PasswordField";
import { AuthRedirect } from "./useAuthRedirect";
import { useCooldown, waitSeconds } from "./useCooldown";

type Mode = "password" | "code";
type Step = "form" | "code" | "verify-email";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useCooldown();

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

  const loginWithPassword = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!authError) return;
      if (/not confirmed/i.test(authError.message)) {
        setCode("");
        setStep("verify-email");
        try {
          const res = await api.resendVerification(email.trim());
          setCooldown(res.resendAfterSeconds);
        } catch (err) {
          // A code was sent moments ago (cooldown): the one already in their inbox still works.
          const wait = waitSeconds((err as Error).message);
          if (!wait) throw err;
          setCooldown(wait);
        }
        return;
      }
      throw new Error(/invalid login credentials/i.test(authError.message) ? "Email or password is incorrect." : authError.message);
    });
  };

  const sendLoginCode = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      try {
        const res = await api.requestOtp(email.trim());
        setCooldown(res.resendAfterSeconds);
      } finally {
        setCode("");
        setStep("code");
      }
    });
  };

  const verifyLoginCode = (value: string) =>
    run(async () => {
      try {
        const { tokenHash } = await api.verifyOtp(email.trim(), value);
        const { error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (authError) throw authError;
      } catch (err) {
        setCode("");
        throw err;
      }
    });

  const verifyEmail = (value: string) =>
    run(async () => {
      try {
        await api.verifySignup(email.trim(), value);
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } catch (err) {
        setCode("");
        throw err;
      }
    });

  const resend = () =>
    run(async () => {
      const res = step === "verify-email" ? await api.resendVerification(email.trim()) : await api.requestOtp(email.trim());
      setCooldown(res.resendAfterSeconds);
    });

  if (step !== "form") {
    const verifying = step === "verify-email";
    return (
      <AuthShell>
        <AuthRedirect />
        <button
          onClick={() => {
            setStep("form");
            setError(null);
          }}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <AuthHeading
          title={verifying ? "Confirm your email" : "Check your inbox"}
          sub={
            <>
              {verifying ? "Your email is not confirmed yet. " : ""}We sent a 6-digit code to{" "}
              <span className="font-medium text-fg">{email}</span>. It expires in 10 minutes.
            </>
          }
        />
        <div className="space-y-5">
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={verifying ? verifyEmail : verifyLoginCode}
            disabled={busy}
            invalid={Boolean(error)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            size="lg"
            block
            loading={busy}
            disabled={code.length < 6}
            onClick={() => (verifying ? verifyEmail(code) : verifyLoginCode(code))}
          >
            {verifying ? "Confirm and log in" : "Verify and continue"}
          </Button>
          <p className="text-center text-sm text-muted">
            Did not get it?{" "}
            <button disabled={cooldown > 0 || busy} onClick={resend} className="font-semibold text-fg hover:text-gold disabled:text-subtle">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <>
          New to RideLink?{" "}
          <Link to="/signup" className="font-semibold text-fg hover:text-gold">
            Create an account
          </Link>
        </>
      }
    >
      <AuthRedirect />
      <AuthHeading eyebrow="Log in" title="Welcome" accent="back" sub="Log in to book a ride or start driving." />

      <div className="mb-6 grid grid-cols-2 rounded-full border border-line bg-bg/60 p-1">
        {(
          [
            ["password", "Password", KeyRound],
            ["code", "Email code", MailCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition",
              mode === key ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={mode === "password" ? loginWithPassword : sendLoginCode} className="space-y-4">
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
        {mode === "password" && (
          <div>
            <PasswordField
              name="password"
              label="Password"
              autoComplete="current-password"
              required
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="mt-2 text-right">
              <Link to="/forgot-password" state={{ email }} className="text-sm font-medium text-muted hover:text-gold">
                Forgot password?
              </Link>
            </div>
          </div>
        )}
        {mode === "code" && <p className="text-sm text-muted">We will email you a 6-digit code. No password needed.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" block loading={busy} icon={!busy && <ArrowRight className="h-5 w-5" />}>
          {mode === "password" ? "Log in" : "Send code"}
        </Button>
      </form>
    </AuthShell>
  );
}
