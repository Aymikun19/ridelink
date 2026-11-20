import { useEffect, useState } from "react";

/** Seconds left before a code can be re-sent. */
export function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}

/** Pulls "wait 42s" out of a rate-limit error so the timer matches the server. */
export function waitSeconds(message: string) {
  const m = message.match(/wait (\d+)s/);
  return m ? Number(m[1]) : 0;
}
