import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { audioUrl } from "./chatApi";

interface Props {
  /** Storage path (resolved to a signed URL) or a local object URL */
  path?: string | null;
  src?: string | null;
  durationMs?: number | null;
  tone?: "mine" | "theirs";
}

// Deterministic bar heights so each note has its own waveform look.
function bars(seed: string, count = 28) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    h = (h * 1103515245 + 12345 + i) >>> 0;
    return 0.25 + ((h >>> 16) % 1000) / 1333;
  });
}

let current: HTMLAudioElement | null = null;

export function AudioPlayer({ path, src, durationMs, tone = "theirs" }: Props) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);
  const [failed, setFailed] = useState(false);
  const shape = bars(path ?? src ?? "x");

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = async () => {
    if (playing && audio.current) {
      audio.current.pause();
      return;
    }
    try {
      if (!audio.current) {
        setLoading(true);
        const url = src ?? (path ? await audioUrl(path) : null);
        if (!url) throw new Error("missing");
        const el = new Audio(url);
        el.preload = "auto";
        el.onplay = () => setPlaying(true);
        el.onpause = () => setPlaying(false);
        el.onended = () => {
          setPlaying(false);
          setProgress(0);
        };
        el.ontimeupdate = () => {
          const d = Number.isFinite(el.duration) ? el.duration : duration;
          if (d) setProgress(el.currentTime / d);
        };
        el.onloadedmetadata = () => Number.isFinite(el.duration) && setDuration(el.duration);
        audio.current = el;
      }
      if (current && current !== audio.current) current.pause();
      current = audio.current;
      await audio.current.play();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const mine = tone === "mine";
  return (
    <div className="flex min-w-52 items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
          mine ? "bg-[#0b0b0b] text-gold" : "bg-gold text-[#0b0b0b]",
          failed && "opacity-50",
        )}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]">
        {shape.map((v, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-colors",
              i / shape.length <= progress
                ? mine ? "bg-[#0b0b0b]" : "bg-gold"
                : mine ? "bg-[#0b0b0b]/30" : "bg-fg/25",
            )}
            style={{ height: `${v * 100}%` }}
          />
        ))}
      </div>
      <span className={cn("w-10 text-right text-xs tabular-nums", mine ? "text-[#0b0b0b]/70" : "text-muted")}>
        {failed ? "Error" : formatClock((playing || progress > 0 ? progress * duration : duration) * 1000)}
      </span>
    </div>
  );
}
