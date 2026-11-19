import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
}

export function Modal({ open, onClose, title, children, className, dismissible = true }: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissible ? onClose : undefined} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("rl-pop relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl", className)}
      >
        {(title || (dismissible && onClose)) && (
          <div className="mb-4 flex items-center justify-between gap-4">
            {title && <h3 className="font-display text-lg font-bold">{title}</h3>}
            {dismissible && onClose && (
              <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-muted hover:bg-fg/5 hover:text-fg" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
