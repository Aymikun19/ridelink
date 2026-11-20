import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AudioLines, Mic, Plus, Settings2, Sparkles, Type } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { formatClock } from "@/lib/format";
import type { MessageTemplate, RideStatus } from "@/types";
import { createTextTemplate, createVoiceTemplate, listTemplates } from "./chatApi";
import { TextTemplateEditor, VoiceTemplateEditor } from "./QuickReplies";

/** Built-in replies that fit each stage of a trip, most useful first. */
const contextual: Record<"driver" | "customer", Partial<Record<RideStatus, string[]>>> = {
  driver: {
    accepted: ["On my way", "Running late", "Confirm location"],
    arrived: ["Arrived", "Confirm location"],
  },
  customer: {
    accepted: ["Where are you", "Call me", "Wait please"],
    arrived: ["Coming out", "Wait please"],
  },
};

interface Props {
  onPick: (t: MessageTemplate) => void;
  disabled?: boolean;
  rideStatus?: RideStatus;
}

/** Suggested replies for the chat: trip-stage suggestions first, then the user's own, then the rest. */
export function TemplateChips({ onPick, disabled, rideStatus }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [creating, setCreating] = useState<null | "choose" | "text" | "voice">(null);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const ordered = useMemo(() => {
    const wanted = (profile?.role && rideStatus && contextual[profile.role][rideStatus]) || [];
    const rank = (t: MessageTemplate) => {
      const i = t.user_id === null ? wanted.indexOf(t.title) : -1;
      if (i >= 0) return i;
      if (t.user_id) return 100;
      return 200;
    };
    return [...templates].sort((a, b) => rank(a) - rank(b));
  }, [templates, profile?.role, rideStatus]);

  const saved = (t: MessageTemplate) => {
    setTemplates((list) => [...list, t]);
    setCreating(null);
    toast({ tone: "success", title: "Quick reply saved", body: "Tap it to send." });
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="inline-flex shrink-0 items-center gap-1 pr-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">
          <Sparkles className="h-3 w-3 text-gold" /> Suggested
        </span>
        {ordered.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t)}
            title={t.kind === "text" ? (t.body ?? "") : "Send this voice reply"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-fg transition hover:border-gold/60 hover:text-gold disabled:opacity-50"
          >
            {t.kind === "voice" && <AudioLines className="h-3.5 w-3.5 text-gold" />}
            {t.title}
            {t.kind === "voice" && t.audio_duration_ms ? <span className="text-subtle">{formatClock(t.audio_duration_ms)}</span> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreating("choose")}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/60 hover:text-gold"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
        <Link
          to="/messages?tab=replies"
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-muted hover:text-fg"
          aria-label="Manage quick replies"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Modal open={creating === "choose"} onClose={() => setCreating(null)} title="New quick reply">
        <p className="mb-4 text-sm text-muted">Save something you say often. It will be suggested in every chat.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCreating("text")}
            className="flex flex-col items-start gap-2 rounded-2xl border border-line p-4 text-left hover:border-gold/60"
          >
            <Type className="h-5 w-5 text-gold" />
            <span className="font-semibold">Text</span>
            <span className="text-xs text-muted">Type a message</span>
          </button>
          <button
            onClick={() => setCreating("voice")}
            className="flex flex-col items-start gap-2 rounded-2xl border border-line p-4 text-left hover:border-gold/60"
          >
            <Mic className="h-5 w-5 text-gold" />
            <span className="font-semibold">Voice</span>
            <span className="text-xs text-muted">Record it once</span>
          </button>
        </div>
      </Modal>

      {creating === "text" && profile && (
        <TextTemplateEditor
          onClose={() => setCreating(null)}
          onSave={async (title, body) => saved(await createTextTemplate(profile.id, profile.role, title, body))}
        />
      )}
      {creating === "voice" && profile && (
        <VoiceTemplateEditor
          onClose={() => setCreating(null)}
          onSave={async (title, blob, ms) => saved(await createVoiceTemplate(profile.id, profile.role, title, blob, ms))}
        />
      )}
    </>
  );
}
