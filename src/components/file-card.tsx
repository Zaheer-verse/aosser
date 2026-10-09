import { Download, FileText, Film, ImageIcon, Trash2, TriangleAlert } from "lucide-react";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import { kindLabel } from "@/lib/compress";
import { formatBytes, formatPercent, savingsRatio } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Job } from "@/store/queue";
import { Button, buttonVariants } from "./ui/button";

const KIND_ICON = {
  image: ImageIcon,
  video: Film,
  pdf: FileText,
  docx: FileText,
} as const;

export function FileCard({ job, onRemove }: { job: Job; onRemove: (id: string) => void }) {
  const Icon = KIND_ICON[job.kind];
  const saved =
    job.status === "done" && job.resultSize != null
      ? savingsRatio(job.originalSize, job.resultSize)
      : 0;
  const canDownload = job.status === "done" && job.resultUrl && job.resultName;

  return (
    <article className="rounded-xl p-1 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-4 rounded-lg bg-bg-elevated p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-bg-well shadow-[var(--shadow-border)]">
            {job.previewUrl ? (
              <img
                src={job.previewUrl}
                alt=""
                className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-muted">
                <Icon className="size-5" strokeWidth={1.6} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{job.file.name}</p>
            <p className="mt-1 text-xs text-muted">
              {kindLabel(job.kind)}
              <span className="mx-1.5 text-subtle">/</span>
              <span className="tabular-nums">{formatBytes(job.originalSize)}</span>
              {job.status === "done" && job.resultSize != null && (
                <>
                  <span className="mx-1.5 text-subtle">→</span>
                  <span className="tabular-nums text-fg">{formatBytes(job.resultSize)}</span>
                </>
              )}
            </p>
          </div>
          <StatusSlot job={job} saved={saved} />
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted"
            aria-label={`Remove ${job.file.name}`}
            onClick={() => onRemove(job.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {job.status === "done" && job.kind === "image" && job.previewUrl && job.resultUrl && (
          <CompareSlider before={job.previewUrl} after={job.resultUrl} />
        )}

        {canDownload && (
          <a
            href={job.resultUrl}
            download={job.resultName}
            className={cn(
              buttonVariants({ variant: "primary", size: "md" }),
              "w-full min-w-0 max-w-full",
            )}
            onClick={() =>
              toast.info("Download requested. Check the Downloads folder in your browser.")
            }
          >
            <Download className="size-4" />
            <span className="min-w-0 truncate">Download {job.resultName}</span>
          </a>
        )}
      </div>
      {job.status === "pressing" && (
        <div className="px-4 pb-3 pt-1">
          <div className="h-1 overflow-hidden rounded-full bg-bg-well">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      {job.status === "error" && job.error && (
        <p className="flex items-start gap-2 px-4 pb-3 text-xs text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{job.error}</span>
        </p>
      )}
    </article>
  );
}

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(58);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const next = ((event.clientX - box.left) / box.width) * 100;
    setPos(Math.min(94, Math.max(6, next)));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") setPos((value) => Math.max(6, value - 4));
    if (event.key === "ArrowRight") setPos((value) => Math.min(94, value + 4));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="slider"
        aria-label="Compare original and pressed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
        }}
        className="relative aspect-video cursor-ew-resize touch-none overflow-hidden rounded-md bg-bg-well outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <img
          src={before}
          alt="Original"
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
        <img
          src={after}
          alt="Pressed"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: `${pos}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-press)]"
          style={{ left: `${pos}%` }}
        >
          <span className="text-xs font-medium" aria-hidden>
            ↔
          </span>
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-bg/80 px-2 py-1 text-xs text-fg">
          Original
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-bg/80 px-2 py-1 text-xs text-fg">
          Pressed
        </span>
      </div>
      <p className="text-xs text-muted">
        Drag the line to check the pressed copy against the original.
      </p>
    </div>
  );
}

function StatusSlot({ job, saved }: { job: Job; saved: number }) {
  if (job.status === "pressing") {
    return (
      <p className="shrink-0 text-xs font-medium tabular-nums text-muted">
        {Math.round(job.progress * 100)}%
      </p>
    );
  }
  if (job.status === "done") {
    if (job.keptOriginal) {
      return <p className="shrink-0 text-xs font-medium text-muted">Already compact</p>;
    }
    return (
      <p className="shrink-0 font-display text-lg font-medium tabular-nums tracking-tight text-sage">
        −{formatPercent(saved)}
      </p>
    );
  }
  if (job.status === "error") {
    return <p className="shrink-0 text-xs font-medium text-danger">Failed</p>;
  }
  return <p className="shrink-0 text-xs font-medium text-subtle">Ready</p>;
}
