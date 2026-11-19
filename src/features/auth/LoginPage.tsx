import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

const LENGTH = 6;

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!loading && session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/app"} replace />;
  }

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.requestOtp(email);
      setStep("code");
      setDigits(Array(LENGTH).fill(""));
      setCooldown(res.resendAfterSeconds);
      window.setTimeout(() => inputs.current[0]?.focus(), 50);
    } catch (err) {
      setError((err as Error).message);
      const m = (err as ApiError).message?.match(/wait (\d+)s/);
      if (m) {
        setCooldown(Number(m[1]));
        setStep("code");
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const { tokenHash } = await api.verifyOtp(email, code);
      const { error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
      if (authError) throw authError;
      // AuthProvider picks up the session and the redirect above takes over.
    } catch (err) {
      setError((err as Error).message);
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = v;
    setDigits(next);
    if (v && i < LENGTH - 1) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: LENGTH }, (_, i) => text[i] ?? "");
    setDigits(next);
    inputs.current[Math.min(text.length, LENGTH - 1)]?.focus();
    if (text.length === LENGTH) void verify(text);
  };

  return (
    <div className="relative flex min-h-full flex-col bg-grid">
      <div className="glow-gold pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          {!supabaseConfigured && (
            <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.
            </div>
          )}
          <div className="rounded-[2rem] border border-line bg-surface/80 p-7 shadow-2xl backdrop-blur sm:p-9">
            {step === "email" ? (
              <form onSubmit={sendCode} className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Sign in</p>
                  <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                    Welcome <span className="font-serif font-normal italic text-gold">aboard</span>
                  </h1>
                  <p className="mt-2 text-sm text-muted">Enter your email and we will send you a 6 digit code. No password needed.</p>
                </div>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leading={<Mail className="h-4 w-4" />}
                  error={error}
                />
                <Button type="submit" size="lg" block loading={busy} icon={!busy && <ArrowRight className="h-5 w-5" />}>
                  Send code
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <button
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
                >
                  <ArrowLeft className="h-4 w-4" /> Change email
                </button>
                <div>
                  <h1 className="font-display text-3xl font-bold tracking-tight">Check your inbox</h1>
                  <p className="mt-2 text-sm text-muted">
                    We sent a code to <span className="font-medium text-fg">{email}</span>. It expires in 10 minutes.
                  </p>
                </div>
                <div className="flex justify-between gap-2">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={d}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      disabled={busy}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => onKey(i, e)}
                      onPaste={onPaste}
                      aria-label={`Digit ${i + 1}`}
                      className={cn(
                        "h-14 w-full min-w-0 rounded-2xl border bg-bg text-center font-display text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-gold/15",
                        d ? "border-gold/60" : "border-line",
                        error && "border-danger/60",
                      )}
                    />
                  ))}
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button size="lg" block loading={busy} disabled={digits.some((d) => !d)} onClick={() => verify(digits.join(""))}>
                  Verify and continue
                </Button>
                <p className="text-center text-sm text-muted">
                  Did not get it?{" "}
                  <button disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="font-semibold text-fg hover:text-gold disabled:text-subtle">
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
