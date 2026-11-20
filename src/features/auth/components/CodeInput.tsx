import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Called once all 6 digits are filled */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/** Six single-digit boxes with paste, arrow keys and backspace support. */
export function CodeInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }: Props) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!value) inputs.current[0]?.focus();
  }, [value]);

  const update = (next: string[]) => {
    const joined = next.join("");
    onChange(joined);
    if (joined.length === LENGTH && next.every(Boolean)) onComplete?.(joined);
  };

  const setDigit = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[i] = v;
    update(next);
    if (v && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    update(Array.from({ length: LENGTH }, (_, i) => text[i] ?? ""));
    inputs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "h-14 w-full min-w-0 rounded-2xl border bg-bg text-center font-display text-2xl font-bold transition focus:outline-none focus:ring-4 focus:ring-gold/15",
            d ? "border-gold/60" : "border-line",
            invalid && "border-danger/60",
          )}
        />
      ))}
    </div>
  );
}

