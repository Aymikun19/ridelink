import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AudioLines, Settings2 } from "lucide-react";
import { formatClock } from "@/lib/format";
import type { MessageTemplate } from "@/types";
import { listTemplates } from "./chatApi";

interface Props {
  onPick: (t: MessageTemplate) => void;
  disabled?: boolean;
}

/** Horizontal strip of quick replies (text and saved voice notes). */
export function TemplateChips({ onPick, disabled }: Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  if (!templates.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(t)}
          title={t.kind === "text" ? (t.body ?? "") : "Send saved voice note"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-medium text-fg transition hover:border-gold/60 hover:text-gold disabled:opacity-50"
        >
          {t.kind === "voice" && <AudioLines className="h-3.5 w-3.5 text-gold" />}
          {t.title}
          {t.kind === "voice" && t.audio_duration_ms ? (
            <span className="text-subtle">{formatClock(t.audio_duration_ms)}</span>
          ) : null}
        </button>
      ))}
      <Link
        to="/templates"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:text-fg"
      >
        <Settings2 className="h-3.5 w-3.5" /> Manage
      </Link>
    </div>
  );
}
