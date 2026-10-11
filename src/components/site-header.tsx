import { ShieldCheck } from "lucide-react";
import { PressMark } from "./press-mark";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-bg-elevated shadow-[var(--shadow-border)]">
          <PressMark className="size-6" />
        </span>
        <div>
          <p className="font-display text-xl font-medium tracking-tight text-fg">Aosser</p>
          <p className="text-xs text-muted">The press for heavy files</p>
        </div>
      </div>
      <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
        <ShieldCheck className="size-3.5" strokeWidth={1.75} />
        Stays on this device
      </p>
    </header>
  );
}
