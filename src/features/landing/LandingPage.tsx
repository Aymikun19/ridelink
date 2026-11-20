import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BellRing,
  Car,
  KeyRound,
  MapPinned,
  MessageSquareText,
  Moon,
  Navigation,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Logo } from "@/components/ui/Logo";
import { APP_NAME } from "@/lib/config";

const features = [
  { icon: MapPinned, title: "Live map and satellite view", body: "Watch your driver move toward you in real time on a street map or satellite imagery, with route and arrival estimate." },
  { icon: BellRing, title: "Instant request alerts", body: "Drivers get a popup, a chime and a system notification the moment a ride is requested nearby." },
  { icon: MessageSquareText, title: "In-ride messaging", body: "Chat inside every trip with read receipts. No need to share numbers if you do not want to." },
  { icon: AudioLines, title: "Voice notes", body: "Hold a quick voice conversation when typing is not practical, like while driving." },
  { icon: KeyRound, title: "Secure accounts", body: "Sign up with a password confirmed by email, or log in with a one-time code. Forgotten passwords are reset with an emailed code." },
  { icon: Navigation, title: "Reusable templates", body: "Save the replies and voice notes you send most, then send them with one tap." },
];

const steps = {
  customer: [
    "Set your pickup with GPS, search or a tap on the map",
    "Choose where you are going and request",
    "Track your driver and chat until you arrive",
  ],
  driver: [
    "Add your vehicle and go online",
    "Accept requests from the popup or the open list",
    "Navigate, update status and complete the trip",
  ],
};

function RouteArt() {
  return (
    <svg viewBox="0 0 520 420" className="h-full w-full" aria-hidden>
      {/* street grid */}
      <g className="text-fg" stroke="currentColor" strokeOpacity="0.08" strokeWidth="10" strokeLinecap="round">
        <path d="M-10 90 H530" />
        <path d="M-10 230 H530" />
        <path d="M-10 350 H530" />
        <path d="M90 -10 V430" />
        <path d="M250 -10 V430" />
        <path d="M410 -10 V430" />
        <path d="M-10 400 L180 -10" />
      </g>
      {/* route */}
      <path d="M90 350 V230 H250 V90 H410" fill="none" stroke="#0b0b0b" strokeOpacity="0.35" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 350 V230 H250 V90 H410" fill="none" stroke="#c9a84c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* pickup */}
      <g transform="translate(90 350)">
        <circle r="26" fill="#c9a84c" opacity="0.15" className="rl-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
        <circle r="13" className="fill-fg" stroke="#0b0b0b" strokeWidth="3" />
        <circle r="5" className="fill-bg" />
      </g>
      {/* car */}
      <g transform="translate(250 160)">
        <circle r="20" fill="#0b0b0b" stroke="#c9a84c" strokeWidth="3" />
        <path d="M0 -10 L8 9 L0 4 L-8 9 Z" fill="#c9a84c" />
      </g>
      {/* drop-off */}
      <g transform="translate(410 90)">
        <path d="M0 22s18-16 18-30A18 18 0 0 0-18-8c0 14 18 30 18 30z" fill="#c9a84c" stroke="#0b0b0b" strokeWidth="3" />
        <rect x="-6" y="-14" width="12" height="12" rx="2" fill="#0b0b0b" />
      </g>
    </svg>
  );
}

export function LandingPage() {
  const { session, loading } = useAuth();
  const { theme, toggle } = useTheme();
  if (!loading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Logo />
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-gold hover:bg-fg/5"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-fg sm:inline-flex">
              Log in
            </Link>
            <Link to="/signup" className="rounded-full bg-fg px-5 py-2 text-sm font-semibold text-bg hover:opacity-90">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid">
        <div className="glow-gold pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/5 px-3 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Ride hailing with built-in chat and voice
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Get where you are going, <span className="font-serif font-normal italic text-gold">together.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {APP_NAME} connects people who need a ride with drivers nearby. Request in seconds, follow the car on a live map and
              talk through messages or voice notes until you arrive.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-7 font-semibold text-bg transition hover:opacity-90"
              >
                Book a ride <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-line bg-fg/5 px-7 font-semibold transition hover:bg-fg/10"
              >
                Drive with us <ArrowUpRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-[52/42] w-full max-w-lg rounded-[2.5rem] border border-line bg-surface/70 p-4 shadow-2xl backdrop-blur">
            <div className="h-full w-full overflow-hidden rounded-[2rem] border border-line bg-bg">
              <RouteArt />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">What is inside</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a trip needs, <span className="font-serif font-normal italic text-gold">nothing it does not.</span>
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-gold/40">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-gold transition group-hover:bg-gold group-hover:text-[#0b0b0b]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-20 sm:px-8 md:grid-cols-2">
          {(
            [
              ["customer", "For riders", UserRound],
              ["driver", "For drivers", Car],
            ] as const
          ).map(([key, title, Icon]) => (
            <div key={key} className="rounded-[2rem] border border-line bg-bg p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-[#0b0b0b]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-2xl font-bold">{title}</h3>
              </div>
              <ol className="mt-8 space-y-5">
                {steps[key].map((s, i) => (
                  <li key={s} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line font-display text-sm font-bold text-gold">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-muted">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-grid">
        <div className="glow-gold pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Ready when <span className="font-serif font-normal italic text-gold">you are.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted">Create a free account to request your first ride or start driving.</p>
          <Link
            to="/signup"
            className="mt-10 inline-flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-8 font-semibold text-bg transition hover:opacity-90"
          >
            Get started <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-subtle sm:flex-row sm:px-8">
          <Logo />
          <p>Map data from OpenStreetMap contributors.</p>
        </div>
      </footer>
    </div>
  );
}
