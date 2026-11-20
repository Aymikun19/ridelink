import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { listConversations, MESSAGES_CHANGED } from "./chatApi";

/** Total unread messages across all rides, for the nav badge. */
export function useUnreadCount() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile?.role) return;
    let cancelled = false;
    let timer: number | undefined;
    const load = () => {
      window.clearTimeout(timer);
      // Debounced: several events often arrive together.
      timer = window.setTimeout(() => {
        listConversations()
          .then((list) => !cancelled && setCount(list.reduce((n, c) => n + c.unread, 0)))
          .catch(() => undefined);
      }, 400);
    };
    load();
    const poll = window.setInterval(load, 45000);
    window.addEventListener(MESSAGES_CHANGED, load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener(MESSAGES_CHANGED, load);
    };
  }, [profile?.id, profile?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return count;
}
