import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";
import { listMessages, markRead } from "./chatApi";

/**
 * Live message list for a ride. Messages are only marked read while `active`
 * (chat visible) and the tab is in the foreground.
 */
export function useMessages(rideId: string | undefined, viewerId: string | undefined, enabled: boolean, active: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(active);
  activeRef.current = active;

  const upsert = useCallback((m: Message) => {
    setMessages((list) => {
      const i = list.findIndex((x) => x.id === m.id);
      if (i >= 0) {
        const copy = list.slice();
        copy[i] = m;
        return copy;
      }
      return [...list, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  useEffect(() => {
    if (!rideId || !enabled) return;
    let cancelled = false;
    const load = () =>
      listMessages(rideId)
        .then((list) => !cancelled && setMessages(list))
        .finally(() => !cancelled && setLoading(false));

    let live = false;
    const channel = supabase
      .channel(`messages-${rideId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ride_id=eq.${rideId}` }, (p) => {
        const m = p.new as Message;
        upsert(m);
        if (m.sender_id !== viewerId && activeRef.current && document.visibilityState === "visible") void markRead(rideId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `ride_id=eq.${rideId}` }, (p) =>
        upsert(p.new as Message),
      )
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
        if (live) void load();
      });

    // Fallback polling while the realtime channel is not connected
    void load();
    const poll = window.setInterval(() => {
      if (!live && document.visibilityState === "visible") void load();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [rideId, viewerId, enabled, upsert]);

  const unread = messages.filter((m) => m.sender_id !== viewerId && !m.read_at).length;

  useEffect(() => {
    if (!rideId || !enabled || !active) return;
    const mark = () => document.visibilityState === "visible" && void markRead(rideId);
    if (unread > 0) mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [rideId, enabled, active, unread]);

  return { messages, loading, upsert, unread };
}
