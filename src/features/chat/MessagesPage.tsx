import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AudioLines, MessageSquare, MessagesSquare, Zap } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { LogoLoader } from "@/components/ui/LogoLoader";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { statusMeta } from "@/features/rides/status";
import type { Conversation } from "@/types";
import { listConversations, MESSAGES_CHANGED } from "./chatApi";
import { QuickRepliesManager } from "./QuickReplies";

type Tab = "chats" | "replies";

export function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "replies" ? "replies" : "chats";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Inbox</p>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Messages</h1>

      <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
        {(
          [
            ["chats", "Chats", MessagesSquare],
            ["replies", "Quick replies", Zap],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setParams(key === "chats" ? {} : { tab: key }, { replace: true })}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === key ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === "chats" ? <Conversations /> : <QuickRepliesManager />}</div>
    </div>
  );
}

function Conversations() {
  const { profile } = useAuth();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      listConversations()
        .then(setList)
        .catch((e) => setError(e.message));
    load();
    window.addEventListener(MESSAGES_CHANGED, load);
    const poll = window.setInterval(load, 20000);
    return () => {
      window.removeEventListener(MESSAGES_CHANGED, load);
      window.clearInterval(poll);
    };
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!list) return <LogoLoader className="py-16" />;
  if (!list.length) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-5 w-5" />}
        title="No conversations yet"
        body={
          profile?.role === "driver"
            ? "When you accept a ride, you can message the customer here."
            : "Once a driver accepts your ride, you can message them here."
        }
        action={
          <Link to="/app">
            <Button variant="secondary">{profile?.role === "driver" ? "Go to dashboard" : "Book a ride"}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {list.map((c) => {
        const mine = c.last_sender === profile?.id;
        const preview = !c.last_kind
          ? "No messages yet"
          : c.last_kind === "voice"
            ? "Voice note"
            : (c.last_body ?? "");
        const active = ["accepted", "arrived", "in_progress"].includes(c.status);
        return (
          <Link
            key={c.ride_id}
            to={`/ride/${c.ride_id}`}
            state={{ openChat: true }}
            className={cn(
              "flex items-center gap-4 rounded-3xl border bg-surface p-4 transition hover:border-gold/40",
              c.unread > 0 ? "border-gold/40" : "border-line",
            )}
          >
            <Avatar name={c.counterpart_name} src={c.counterpart_avatar} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.counterpart_name || "Unnamed"}</p>
                {active && <Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>}
              </div>
              <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-sm", c.unread > 0 ? "text-fg" : "text-muted")}>
                {c.last_kind === "voice" && <AudioLines className="h-3.5 w-3.5 shrink-0 text-gold" />}
                <span className="truncate">
                  {mine && c.last_kind ? "You: " : ""}
                  {preview}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-subtle">To {c.dropoff_address}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-xs text-subtle">{timeAgo(c.last_at)}</span>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-[#0b0b0b]">
                  {c.unread}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
