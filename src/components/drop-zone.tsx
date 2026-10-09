import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { ACCEPT_ATTR } from "@/lib/compress";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const take = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!disabled) setOver(true);
  };

  const onDragLeave = (event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setOver(false);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    take(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative w-full rounded-2xl p-1.5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        over && "shadow-[var(--shadow-border-hover)]",
        disabled && "opacity-60",
      )}
    >
      <label
        className={cn(
          "relative block cursor-pointer overflow-hidden rounded-xl bg-bg-well px-6 py-12 sm:px-10 sm:py-16",
          "transition-[background-color] duration-[var(--motion-fast)]",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/50",
          over && "bg-bg-elevated",
          disabled && "pointer-events-none",
        )}
      >
        {mounted && (
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPT_ATTR}
            multiple
            disabled={disabled}
            onChange={(event) => {
              take(event.target.files);
              event.target.value = "";
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-3 rounded-lg border border-dashed border-border" />
        <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-lg bg-bg-elevated text-primary shadow-[var(--shadow-border)]">
            <FileUp className="size-6" strokeWidth={1.6} />
          </span>
          <p className="font-display text-2xl font-medium tracking-tight text-fg text-balance sm:text-3xl">
            Drop a file to press
          </p>
          <p className="mt-3 max-w-md text-sm leading-normal text-muted text-pretty">
            Images, video, PDFs, and Word documents. Up to 1 GB each, pressed on this device.
          </p>
          <span className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg">
            Browse files
          </span>
        </div>
      </label>
    </div>
  );
}
