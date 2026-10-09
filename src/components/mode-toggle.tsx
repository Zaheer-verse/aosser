import { cn } from "@/lib/utils";
import type { PressMode } from "@/lib/compress";

const MODES: {
  id: PressMode;
  label: string;
  kicker: string;
  copy: string;
  bars: number;
}[] = [
  {
    id: "balanced",
    label: "Balanced",
    kicker: "Keep the likeness",
    copy: "Sharp enough to share. Typical 40–70% smaller.",
    bars: 2,
  },
  {
    id: "strong",
    label: "Strong",
    kicker: "Squeeze hard",
    copy: "Maximum shrink. Softer, much lighter.",
    bars: 3,
  },
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
    <div role="radiogroup" aria-label="Press force" className="grid gap-3 sm:grid-cols-2">
      {MODES.map((mode) => {
        const selected = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={cn(
              "rounded-xl p-1 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              "active:not-disabled:scale-[0.98]",
              selected && "shadow-[var(--shadow-border-hover)]",
            )}
          >
            <div
              className={cn(
                "rounded-lg bg-bg-elevated px-4 py-4 sm:px-5 sm:py-5",
                selected && "bg-bg-well",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">
                    {mode.kicker}
                  </p>
                  <p className="mt-1 font-display text-xl font-medium tracking-tight text-fg">
                    {mode.label}
                  </p>
                </div>
                <ForceBars count={mode.bars} active={selected} />
              </div>
              <p className="mt-3 text-sm leading-normal text-muted text-pretty">{mode.copy}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const BAR_H = ["h-3", "h-5", "h-7"] as const;

function ForceBars({ count, active }: { count: number; active: boolean }) {
  return (
    <span className="flex h-8 items-end gap-1" aria-hidden>
      {BAR_H.map((height, i) => (
        <span
          key={height}
          className={cn(
            "w-1.5 rounded-full transition-colors duration-[var(--motion-quick)]",
            height,
            i < count ? (active ? "bg-primary" : "bg-muted") : "bg-border",
          )}
        />
      ))}
    </span>
  );
}
