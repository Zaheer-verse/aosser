import { cn } from "@/lib/utils";

export function PressMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-primary", className)}
      fill="none"
      aria-hidden
    >
      <rect x="7" y="3.5" width="18" height="3.5" rx="1" fill="currentColor" opacity="0.28" />
      <rect x="4" y="9" width="24" height="3" rx="1.2" fill="currentColor" />
      <rect
        x="8"
        y="15"
        width="16"
        height="12"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 21h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
