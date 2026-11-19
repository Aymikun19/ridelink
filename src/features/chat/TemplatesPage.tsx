import { useEffect, useState, type FormEvent } from "react";
import { AudioLines, Lock, Mic, Pencil, Plus, Trash2, Type } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { readableError } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { MessageTemplate } from "@/types";
import {
  createTextTemplate,
  createVoiceTemplate,
  deleteTemplate,
  listTemplates,
  updateTextTemplate,
} from "./chatApi";
import { AudioPlayer } from "./AudioPlayer";
import { useRecorder } from "./useRecorder";
import { VoiceRecorderBar } from "./VoiceRecorderBar";

type Editor = { mode: "text"; template?: MessageTemplate } | { mode: "voice" } | null;

export function TemplatesPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch((err) => {
        setTemplates([]);
        toast({ tone: "error", title: "Could not load templates", body: readableError(err) });
      });
  }, [toast]);

  if (!profile || !templates) return <FullPageSpinner />;

  const builtIn = templates.filter((t) => t.user_id === null);
  const mine = templates.filter((t) => t.user_id === profile.id);

  const remove = async (t: MessageTemplate) => {
    if (!window.confirm(`Delete the template "${t.title}"?`)) return;
    setDeleting(t.id);
    try {
      await deleteTemplate(t);
      setTemplates((list) => list?.filter((x) => x.id !== t.id) ?? null);
    } catch (err) {
      toast({ tone: "error", title: "Could not delete", body: readableError(err) });
    } finally {
      setDeleting(null);
    }
  };

  const saved = (t: MessageTemplate) => {
    setTemplates((list) => {
      if (!list) return [t];
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) {
        const copy = list.slice();
        copy[i] = t;
        return copy;
      }
      return [...list, t];
    });
    setEditor(null);
    toast({ tone: "success", title: "Template saved" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Messaging</p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Quick replies <span className="font-serif font-normal italic text-gold">and</span> voice templates
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Save messages you send often. They appear as one-tap chips in every ride chat. Voice templates let you record a note
          once and reuse it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button icon={<Type className="h-4 w-4" />} onClick={() => setEditor({ mode: "text" })}>
            New text template
          </Button>
          <Button variant="secondary" icon={<Mic className="h-4 w-4" />} onClick={() => setEditor({ mode: "voice" })}>
            Record voice template
          </Button>
        </div>
      </div>

      <section className="mb-10">
        <SectionTitle eyebrow="Yours" title="Your templates" />
        {mine.length === 0 ? (
          <EmptyState
            icon={<Plus className="h-5 w-5" />}
            title="No custom templates yet"
            body="Create a text reply or record a voice note to reuse during rides."
          />
        ) : (
          <div className="grid gap-3">
            {mine.map((t) => (
              <TemplateRow
                key={t.id}
                t={t}
                actions={
                  <>
                    {t.kind === "text" && (
                      <button
                        onClick={() => setEditor({ mode: "text", template: t })}
                        className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg"
                        aria-label="Edit template"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(t)}
                      disabled={deleting === t.id}
                      className="rounded-full p-2 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      aria-label="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {builtIn.length > 0 && (
        <section>
          <SectionTitle eyebrow="Included" title="Built-in quick replies" />
          <div className="grid gap-3">
            {builtIn.map((t) => (
              <TemplateRow key={t.id} t={t} actions={<Lock className="mr-2 h-4 w-4 text-subtle" aria-label="Built-in" />} />
            ))}
          </div>
        </section>
      )}

      {editor?.mode === "text" && (
        <TextTemplateEditor
          template={editor.template}
          onClose={() => setEditor(null)}
          onSave={async (title, body) => {
            const t = editor.template
              ? await updateTextTemplate(editor.template.id, title, body)
              : await createTextTemplate(profile.id, profile.role, title, body);
            saved(t);
          }}
        />
      )}
      {editor?.mode === "voice" && (
        <VoiceTemplateEditor
          onClose={() => setEditor(null)}
          onSave={async (title, blob, ms) => saved(await createVoiceTemplate(profile.id, profile.role, title, blob, ms))}
        />
      )}
    </div>
  );
}

function TemplateRow({ t, actions }: { t: MessageTemplate; actions: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line",
          t.kind === "voice" ? "text-gold" : "text-fg",
        )}
      >
        {t.kind === "voice" ? <AudioLines className="h-4 w-4" /> : <Type className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.title}</p>
        {t.kind === "text" ? (
          <p className="truncate text-sm text-muted">{t.body}</p>
        ) : (
          <div className="mt-1 max-w-xs">
            <AudioPlayer path={t.audio_path} durationMs={t.audio_duration_ms} />
          </div>
        )}
      </div>
      <div className="flex items-center">{actions}</div>
    </Card>
  );
}

function TextTemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template?: MessageTemplate;
  onClose: () => void;
  onSave: (title: string, body: string) => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await onSave(title, body);
    } catch (err) {
      toast({ tone: "error", title: "Could not save", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={template ? "Edit text template" : "New text template"}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Chip label" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="At the gate" required autoFocus />
        <Textarea
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder="I am waiting at the main gate."
          hint={`${body.length}/500`}
          required
        />
        <Button type="submit" block loading={saving} disabled={!title.trim() || !body.trim()}>
          Save template
        </Button>
      </form>
    </Modal>
  );
}

function VoiceTemplateEditor({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (title: string, blob: Blob, ms: number) => Promise<void>;
}) {
  const toast = useToast();
  const recorder = useRecorder(60_000);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (blob: Blob, ms: number) => {
    if (!title.trim()) {
      toast({ tone: "error", title: "Add a label first" });
      return;
    }
    setSaving(true);
    try {
      await onSave(title, blob, ms);
    } catch (err) {
      toast({ tone: "error", title: "Could not save", body: readableError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        recorder.reset();
        onClose();
      }}
      title="Record voice template"
    >
      <div className="space-y-5">
        <Input label="Chip label" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Directions to my gate" autoFocus />
        {recorder.state === "idle" ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line py-8">
            <button
              onClick={recorder.start}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-[#0b0b0b] transition hover:scale-105"
              aria-label="Start recording"
            >
              <Mic className="h-7 w-7" />
            </button>
            <p className="text-sm text-muted">Tap to record, up to 1 minute</p>
            {recorder.error && <p className="text-sm text-danger">{recorder.error}</p>}
          </div>
        ) : (
          <VoiceRecorderBar recorder={recorder} onSend={save} sending={saving} sendLabel="Save" />
        )}
      </div>
    </Modal>
  );
}
