import { useCallback, useEffect, useState, type DragEvent } from "react";
import { ArrowUpFromLine, Plus } from "lucide-react";
import { ACCEPT_ATTR } from "@/lib/compress";
import { cn } from "@/lib/utils";

type DropZoneProps = { onFiles: (files: File[]) => void; disabled?: boolean };

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [over, setOver] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const take = useCallback(
    (list: FileList | File[] | null) => {
      if (list?.length) onFiles(Array.from(list));
    },
    [onFiles],
  );

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!disabled) setOver(true);
  };
  const onDragLeave = (event: DragEvent) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return;
    setOver(false);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) take(event.dataTransfer.files);
  };

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-subtle">01</span> Add your files
      </p>
      <label
        className={cn(
          "relative flex cursor-pointer flex-col items-center rounded-lg border border-dashed px-5 py-9 text-center transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-4",
          over
            ? "border-primary bg-primary/10"
            : "border-border bg-bg-well/60 hover:border-primary/50 hover:bg-bg-well",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {mounted && (
          <input
            type="file"
            aria-label="Choose files to compress"
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
        <ArrowUpFromLine
          className="mb-4 size-7 text-primary"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="text-lg font-bold tracking-tight">
          {over ? "Drop them here" : "Drop files here"}
        </span>
        <span className="mt-1 text-sm text-muted">or choose them from your device</span>
        <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-fg">
          <Plus className="size-4" aria-hidden="true" /> Browse files
        </span>
        <span className="mt-5 text-xs text-muted">
          Images, videos, PDFs & Word · Up to 1 GB each
        </span>
      </label>
    </div>
  );
}
