import { cn } from "@/lib/utils";
import type { PressMode } from "@/lib/compress";

const MODES: { id: PressMode; label: string; copy: string }[] = [
  { id: "balanced", label: "Balanced", copy: "Keep more detail. A good place to start." },
  { id: "strong", label: "Strong", copy: "Go smaller. Some quality may change." },
];

export function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: PressMode;
  onChange: (mode: PressMode) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-subtle">02</span> Choose compression
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((mode) => (
          <label
            key={mode.id}
            className={cn(
              "relative flex cursor-pointer gap-3 rounded-md border p-4 transition-colors",
              value === mode.id
                ? "border-primary bg-primary/5 text-fg"
                : "border-border bg-bg-elevated text-fg hover:bg-bg-well",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="compression-mode"
              value={mode.id}
              checked={value === mode.id}
              onChange={() => onChange(mode.id)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{mode.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{mode.copy}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
