import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { supabaseConfigured } from "@/lib/supabase";
import { useTheme } from "@/providers/ThemeProvider";

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="relative flex min-h-full flex-col bg-grid">
      <div className="glow-gold pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-gold hover:bg-fg/5"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          {!supabaseConfigured && (
            <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.
            </div>
          )}
          <div className="rl-pop rounded-[2rem] border border-line bg-surface/80 p-7 shadow-2xl backdrop-blur sm:p-9">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, accent, sub }: { eyebrow?: string; title: string; accent?: string; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>}
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
        {title} {accent && <span className="font-serif font-normal italic text-gold">{accent}</span>}
      </h1>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </div>
  );
}
