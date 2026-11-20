import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Input";
import { passwordScore } from "@/lib/password";
import { cn } from "@/lib/cn";

export function PasswordField({ showStrength, value, ...rest }: InputProps & { showStrength?: boolean; value: string }) {
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const tones = ["bg-danger", "bg-danger", "bg-gold", "bg-success", "bg-success"];
  return (
    <div>
      <Input
        {...rest}
        value={value}
        type={visible ? "text" : "password"}
        leading={<Lock className="h-4 w-4" />}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded-full p-1.5 text-subtle hover:text-fg"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      {showStrength && value && (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= score ? tones[score] : "bg-line")} />
            ))}
          </div>
          <span className="w-16 text-right text-xs text-muted">{labels[score]}</span>
        </div>
      )}
    </div>
  );
}
