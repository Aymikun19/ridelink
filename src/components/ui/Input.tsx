import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-2xl border border-line bg-surface px-4 text-sm text-fg placeholder:text-subtle transition " +
  "focus:outline-none focus:border-gold/60 focus:ring-4 focus:ring-gold/10 disabled:opacity-60";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">{label}</span>}
      <span className="relative block">
        {leading && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(field, "h-12", leading ? "pl-11" : undefined, trailing ? "pr-11" : undefined, error && "border-danger/60", className)}
          {...rest}
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </span>
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-subtle">{hint}</span>
      ) : null}
    </label>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">{label}</span>}
      <textarea ref={ref} id={inputId} className={cn(field, "min-h-24 py-3 resize-none", className)} {...rest} />
      {hint && <span className="mt-1.5 block text-xs text-subtle">{hint}</span>}
    </label>
  );
});
