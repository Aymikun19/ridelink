import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Bell, CheckCircle2, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "info" | "success" | "error" | "message";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

type ToastInput = Omit<Toast, "id" | "duration" | "tone"> & { tone?: ToastTone; duration?: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

const icons = {
  info: Bell,
  success: CheckCircle2,
  error: AlertCircle,
  message: MessageSquare,
};

const accents = {
  info: "text-gold",
  success: "text-success",
  error: "text-danger",
  message: "text-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const t: Toast = { tone: "info", duration: 5000, ...input, id };
      setToasts((all) => [...all.slice(-3), t]);
      window.setTimeout(() => dismiss(id), t.duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex flex-col items-center gap-2 px-3 sm:right-4 sm:left-auto sm:top-4 sm:items-end">
          {toasts.map((t) => {
            const Icon = icons[t.tone];
            return (
              <div
                key={t.id}
                role="status"
                className="rl-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-elevated/95 p-4 shadow-xl backdrop-blur"
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", accents[t.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{t.body}</p>}
                  {t.action && (
                    <button
                      onClick={() => {
                        t.action!.onClick();
                        dismiss(t.id);
                      }}
                      className="mt-2 text-sm font-semibold text-gold hover:underline"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
