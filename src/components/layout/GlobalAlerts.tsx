import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { playPing } from "@/lib/sound";
import { systemNotify } from "@/lib/browserNotify";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Message, Ride } from "@/types";

const customerCopy: Partial<Record<Ride["status"], { title: string; body: string }>> = {
  accepted: { title: "Driver found", body: "A driver accepted your ride and is on the way." },
  arrived: { title: "Your driver has arrived", body: "Head to the pickup point." },
  in_progress: { title: "Trip started", body: "Enjoy the ride." },
  completed: { title: "Trip completed", body: "Tap to rate your trip." },
};

/**
 * App-wide popups: new chat messages (when that chat is not open) and ride status
 * changes for customers. Driver request popups live in DriverProvider.
 */
export function GlobalAlerts() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const lastStatus = useRef(new Map<string, string>());

  useEffect(() => {
    if (!profile?.role) return;
    const me = profile.id;

    const channel = supabase
      .channel(`alerts-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.sender_id === me) return;
        const onRide = pathRef.current === `/ride/${m.ride_id}`;
        playPing();
        const body = m.kind === "voice" ? "Sent you a voice note" : (m.body ?? "");
        systemNotify("New message", body, () => navigate(`/ride/${m.ride_id}`));
        if (!onRide) {
          toast({
            tone: "message",
            title: "New message",
            body,
            action: { label: "Open chat", onClick: () => navigate(`/ride/${m.ride_id}`) },
          });
        }
      });

    if (profile.role === "customer") {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `customer_id=eq.${me}` }, (p) => {
        const ride = p.new as Ride;
        const prev = lastStatus.current.get(ride.id);
        if (prev === ride.status) return;
        lastStatus.current.set(ride.id, ride.status);

        // Driver released the ride: it is back to searching
        const copy =
          ride.status === "requested" && prev && prev !== "requested"
            ? { title: "Finding another driver", body: "Your driver had to cancel. We are looking for someone else." }
            : customerCopy[ride.status];
        if (!copy) return;
        playPing();
        systemNotify(copy.title, copy.body, () => navigate(`/ride/${ride.id}`));
        toast({
          tone: ride.status === "completed" || ride.status === "arrived" ? "success" : "info",
          title: copy.title,
          body: copy.body,
          action: pathRef.current === `/ride/${ride.id}` ? undefined : { label: "View ride", onClick: () => navigate(`/ride/${ride.id}`) },
        });
      });
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, toast, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
