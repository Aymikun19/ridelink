import { Mic, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { formatClock } from "@/lib/format";
import { MAX_VOICE_NOTE_MS } from "@/lib/config";
import { AudioPlayer } from "./AudioPlayer";
import type { useRecorder } from "./useRecorder";

interface Props {
  recorder: ReturnType<typeof useRecorder>;
  onSend: (blob: Blob, durationMs: number) => void;
  sending?: boolean;
  sendLabel?: string;
}

/** Inline bar shown while recording or reviewing a voice note. */
export function VoiceRecorderBar({ recorder, onSend, sending, sendLabel = "Send" }: Props) {
  const { state, elapsed, level, blob, stop, reset } = recorder;
  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-full border border-danger/40 bg-danger/5 py-1.5 pl-4 pr-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
        </span>
        <span className="text-sm font-medium tabular-nums">{formatClock(elapsed)}</span>
        <div className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-danger/70 transition-all duration-100"
              style={{ height: `${Math.max(12, Math.min(100, level * 100 * (0.5 + Math.abs(Math.sin(i + elapsed / 180)))))}%` }}
            />
          ))}
        </div>
        <span className="hidden text-xs text-subtle sm:inline">max {formatClock(MAX_VOICE_NOTE_MS)}</span>
        <button onClick={reset} className="rounded-full p-2 text-muted hover:text-fg" aria-label="Discard recording">
          <Trash2 className="h-4 w-4" />
        </button>
        <button onClick={stop} className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white" aria-label="Stop recording">
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  if (state === "recorded" && blob) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-line bg-elevated py-1.5 pl-3 pr-1.5">
        <div className="flex-1">
          <AudioPlayer src={previewUrl} durationMs={elapsed} />
        </div>
        <button onClick={reset} className="rounded-full p-2 text-muted hover:text-danger" aria-label="Discard recording">
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSend(blob, elapsed)}
          disabled={sending}
          className="flex h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {sending ? "Sending" : sendLabel}
        </button>
      </div>
    );
  }

  return null;
}

export function MicButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-fg transition hover:border-gold/60 hover:text-gold disabled:opacity-50"
      aria-label="Record voice note"
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
