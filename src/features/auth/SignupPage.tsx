import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, User } from "lucide-react";
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

export function SignupPage() {
  const [step, setStep] = useState<"form" | "verify">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [code, setCode] = useState("");
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pwProblem) return;
    void run(async () => {
      const res = await api.signup(fullName.trim(), email.trim(), password);
      setCooldown(res.resendAfterSeconds);
      setCode("");
      setStep("verify");
    });
  };

  const verify = (value: string) =>
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

  if (step === "verify") {
    return (
      <AuthShell>
        <AuthRedirect />
        <button onClick={() => setStep("form")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <AuthHeading
          eyebrow="Step 2 of 2"
          title="Confirm your email"
          sub={
            <>
              Enter the 6-digit code we sent to <span className="font-medium text-fg">{email}</span>.
            </>
          }
        />
        <div className="space-y-5">
          <CodeInput value={code} onChange={setCode} onComplete={verify} disabled={busy} invalid={Boolean(error)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button size="lg" block loading={busy} disabled={code.length < 6} onClick={() => verify(code)}>
            Create account
          </Button>
          <p className="text-center text-sm text-muted">
            Did not get it?{" "}
            <button
              disabled={cooldown > 0 || busy}
              onClick={() =>
                run(async () => {
                  const res = await api.resendVerification(email.trim());
                  setCooldown(res.resendAfterSeconds);
                })
              }
              className="font-semibold text-fg hover:text-gold disabled:text-subtle"
            >
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
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-fg hover:text-gold">
            Log in
          </Link>
        </>
      }
    >
      <AuthRedirect />
      <AuthHeading eyebrow="Step 1 of 2" title="Create your" accent="account" sub="You will choose whether you ride or drive next." />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          name="name"
          label="Full name"
          autoComplete="name"
          autoFocus
          required
          maxLength={80}
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leading={<User className="h-4 w-4" />}
        />
        <Input
          type="email"
          name="email"
          label="Email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leading={<Mail className="h-4 w-4" />}
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters, with a number"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showStrength
          error={touched ? pwProblem : null}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          size="lg"
          block
          loading={busy}
          disabled={!fullName.trim() || !email.trim() || !password}
          icon={!busy && <ArrowRight className="h-5 w-5" />}
        >
          Continue
        </Button>
        <p className="text-center text-xs text-subtle">We will email you a code to confirm your address.</p>
      </form>
    </AuthShell>
  );
}
