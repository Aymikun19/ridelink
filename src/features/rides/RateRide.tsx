import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { cn } from "@/lib/cn";
import type { Ride } from "@/types";
import { rateRide } from "./rideApi";

export function RateRide({ ride, onRated }: { ride: Ride; onRated: (r: Ride) => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  if (ride.customer_rating) {
    return (
      <div className="flex items-center gap-1 text-gold">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn("h-5 w-5", i < ride.customer_rating! ? "fill-current" : "opacity-30")} />
        ))}
        <span className="ml-2 text-sm text-muted">You rated this trip</span>
      </div>
    );
  }

  const submit = async () => {
    setSaving(true);
    try {
      onRated(await rateRide(ride.id, rating, feedback));
      toast({ tone: "success", title: "Thanks for the feedback" });
    } catch (err) {
      toast({ tone: "error", title: "Could not save rating", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold">How was your trip?</p>
      <div className="mt-3 flex gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 5 }, (_, i) => (
          <button key={i} onMouseEnter={() => setHover(i + 1)} onClick={() => setRating(i + 1)} aria-label={`${i + 1} stars`}>
            <Star className={cn("h-8 w-8 text-gold transition", i < (hover || rating) ? "fill-current" : "opacity-30")} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className="rl-pop mt-4 space-y-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={500}
            placeholder="Anything to add? (optional)"
            className="min-h-20 w-full resize-none rounded-2xl border border-line bg-bg/50 px-4 py-3 text-sm placeholder:text-subtle focus:border-gold/60 focus:outline-none"
          />
          <Button variant="gold" onClick={submit} loading={saving}>
            Submit rating
          </Button>
        </div>
      )}
    </div>
  );
}
