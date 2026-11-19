import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CheckCheck, MessageSquare, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { readableError } from "@/lib/supabase";
import { useToast } from "@/providers/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import type { MessageTemplate, Profile } from "@/types";
import { sendText, sendVoice, sendVoiceTemplate } from "./chatApi";
import type { useMessages } from "./useMessages";
import { useRecorder } from "./useRecorder";
import { AudioPlayer } from "./AudioPlayer";
import { MicButton, VoiceRecorderBar } from "./VoiceRecorderBar";
import { TemplateChips } from "./TemplateChips";

interface Props {
  chat: ReturnType<typeof useMessages>;
  rideId: string;
  me: Profile;
  counterpart: Profile | null;
  /** Read-only once the ride is over */
  readOnly?: boolean;
  className?: string;
}

export function ChatPanel({ chat, rideId, me, counterpart, readOnly, className }: Props) {
  const toast = useToast();
  const { messages, loading, upsert } = chat;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const recorder = useRecorder();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (recorder.error) toast({ tone: "error", title: "Voice note", body: recorder.error });
  }, [recorder.error, toast]);

  const run = async (fn: () => Promise<void>) => {
    setSending(true);
    try {
      await fn();
    } catch (err) {
      toast({ tone: "error", title: "Message not sent", body: readableError(err) });
    } finally {
      setSending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    void run(async () => {
      upsert(await sendText(rideId, me.id, body));
      setText("");
    });
  };

  const sendRecording = (blob: Blob, ms: number) =>
    run(async () => {
      upsert(await sendVoice(rideId, me.id, blob, ms));
      recorder.reset();
    });

  const pickTemplate = (t: MessageTemplate) =>
    run(async () => {
      if (t.kind === "text" && t.body) upsert(await sendText(rideId, me.id, t.body));
      else if (t.kind === "voice") upsert(await sendVoiceTemplate(rideId, me.id, t));
    });

  const otherName = counterpart?.full_name?.split(" ")[0] || (me.role === "driver" ? "the customer" : "your driver");

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-3 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center py-10 text-muted">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center text-muted">
            <MessageSquare className="mb-3 h-6 w-6 text-gold" />
            <p className="text-sm">
              {readOnly ? "No messages were exchanged on this ride." : `Send a message or voice note to ${otherName}.`}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-3xl px-4 py-2.5",
                    mine ? "rounded-br-lg bg-gold text-[#0b0b0b]" : "rounded-bl-lg border border-line bg-elevated",
                  )}
                >
                  {m.kind === "text" ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                  ) : (
                    <AudioPlayer path={m.audio_path} durationMs={m.audio_duration_ms} tone={mine ? "mine" : "theirs"} />
                  )}
                  <p className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-[#0b0b0b]/60" : "text-subtle")}>
                    {formatTime(m.created_at)}
                    {mine && (m.read_at ? <CheckCheck className="h-3 w-3" aria-label="Read" /> : <Check className="h-3 w-3" aria-label="Sent" />)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!readOnly && (
        <div className="space-y-2 border-t border-line pt-3">
          {recorder.state === "idle" && <TemplateChips onPick={pickTemplate} disabled={sending} />}
          {recorder.state === "idle" ? (
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${otherName}`}
                maxLength={2000}
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-bg/60 px-4 text-sm placeholder:text-subtle focus:border-gold/60 focus:outline-none"
              />
              {text.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-[#0b0b0b] disabled:opacity-60"
                  aria-label="Send message"
                >
                  {sending ? <Spinner className="h-4 w-4" /> : <SendHorizontal className="h-5 w-5" />}
                </button>
              ) : (
                <MicButton onClick={recorder.start} disabled={sending} />
              )}
            </form>
          ) : (
            <VoiceRecorderBar recorder={recorder} onSend={sendRecording} sending={sending} />
          )}
        </div>
      )}
    </div>
  );
}
