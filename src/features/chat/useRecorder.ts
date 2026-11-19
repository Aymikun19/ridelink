import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_NOTE_MS } from "@/lib/config";

export type RecorderState = "idle" | "recording" | "recorded";

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Microphone recorder with a live level meter and duration limit. */
export function useRecorder(maxMs = MAX_VOICE_NOTE_MS) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const tick = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const finalDuration = useRef(0);

  const cleanup = useCallback(() => {
    if (tick.current) window.clearInterval(tick.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    tick.current = null;
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const mimeType = pickMime();
      const rec = new MediaRecorder(media, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        finalDuration.current = Date.now() - startedAt.current;
        const out = new Blob(chunks.current, { type: rec.mimeType || mimeType || "audio/webm" });
        cleanup();
        if (finalDuration.current < 700 || out.size === 0) {
          setState("idle");
          setError("Recording was too short.");
          return;
        }
        setBlob(out);
        setElapsed(finalDuration.current);
        setState("recorded");
      };
      recorder.current = rec;

      // Level meter
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        audioCtx.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* meter is optional */
      }

      startedAt.current = Date.now();
      setElapsed(0);
      rec.start(250);
      setState("recording");
      tick.current = window.setInterval(() => {
        const ms = Date.now() - startedAt.current;
        setElapsed(ms);
        if (ms >= maxMs) stop();
      }, 200);
    } catch (err) {
      cleanup();
      const name = (err as Error).name;
      setError(name === "NotAllowedError" ? "Microphone permission was denied." : "Could not access the microphone.");
      setState("idle");
    }
  }, [cleanup, maxMs, stop]);

  const reset = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cleanup();
    setBlob(null);
    setElapsed(0);
    setState("idle");
  }, [cleanup]);

  return { state, elapsed, level, blob, error, start, stop, reset, durationMs: finalDuration.current || elapsed };
}
