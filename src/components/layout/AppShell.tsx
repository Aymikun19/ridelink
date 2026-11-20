import { NavLink, Outlet } from "react-router-dom";
import { History, Home, MessagesSquare, Moon, Sun, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { useUnreadCount } from "@/features/chat/useUnreadCount";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { DriverProvider, useOptionalDriver } from "@/features/driver/DriverProvider";
import { GlobalAlerts } from "./GlobalAlerts";

const nav = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/history", label: "Trips", icon: History },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/profile", label: "Profile", icon: UserRound },
];

function OnlinePill() {
  const driver = useOptionalDriver();
  if (!driver) return null;
  return (
    <span
      className={cn(
        "hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex",
        driver.online ? "border-success/40 text-success" : "border-line text-muted",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", driver.online ? "bg-success" : "bg-subtle")} />
      {driver.online ? "Online" : "Offline"}
    </span>
  );
}

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cn("flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-[#0b0b0b]", className)}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Shell() {
  const { theme, toggle } = useTheme();
  const { profile } = useAuth();
  const unread = useUnreadCount();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[700] h-16 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Logo to="/app" />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    "inline-flex items-center gap-2",
                    isActive ? "bg-fg/10 text-fg" : "text-muted hover:text-fg",
                  )
                }
              >
                {n.label}
                {n.to === "/messages" && <UnreadDot count={unread} />}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <OnlinePill />
            <button
              onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-gold transition hover:bg-fg/5"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/profile" aria-label="Your profile" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
              <Avatar name={profile?.full_name} src={profile?.avatar_url} className="h-9 w-9 text-xs" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col pb-16 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-[700] grid grid-cols-4 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive ? "text-gold" : "text-muted")
            }
          >
            <span className="relative">
              <n.icon className="h-5 w-5" />
              {n.to === "/messages" && <UnreadDot count={unread} className="absolute -right-2.5 -top-1.5" />}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <GlobalAlerts />
    </div>
  );
}

export function AppShell() {
  const { profile } = useAuth();
  if (profile?.role === "driver") {
    return (
      <DriverProvider>
        <Shell />
      </DriverProvider>
    );
  }
  return <Shell />;
}
