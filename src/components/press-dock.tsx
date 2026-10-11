import { Download, LoaderCircle, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createArchive } from "@/lib/archive";
import { createDownloadUrl } from "@/lib/download";
import { formatBytes, savingsRatio } from "@/lib/format";
import type { Job } from "@/store/queue";
import { Button, buttonVariants } from "./ui/button";

function ArchiveDownload({ jobs }: { jobs: Job[] }) {
  const [url, setUrl] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const archiveUrl = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      generation.current += 1;
      if (archiveUrl.current) URL.revokeObjectURL(archiveUrl.current);
    },
    [],
  );

  const prepare = async () => {
    if (preparing) return;
    const current = generation.current;
    setPreparing(true);
    setError(undefined);
    try {
      const blob = await createArchive(
        jobs.flatMap((job) =>
          job.result && job.resultName ? [{ blob: job.result, filename: job.resultName }] : [],
        ),
      );
      // Completed files may have changed during archive preparation.
      if (current !== generation.current) return;
      archiveUrl.current = createDownloadUrl(blob);
      setUrl(archiveUrl.current);
    } catch (err) {
      if (current !== generation.current) return;
      const message =
        err instanceof Error
          ? err.message
          : "Could not prepare the ZIP. Try downloading files individually.";
      setError(message);
      toast.error(message);
    } finally {
      if (current === generation.current) setPreparing(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {url ? (
        <a
          href={url}
          download="aosser-pressed.zip"
          className={buttonVariants({ variant: "secondary", size: "md" })}
          onClick={() =>
            toast.info("Download requested. Check the Downloads folder in your browser.")
          }
        >
          <Download className="size-4" /> Download all
        </a>
      ) : (
        <Button variant="secondary" size="md" disabled={preparing} onClick={() => void prepare()}>
          {preparing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {preparing ? "Preparing ZIP…" : error ? "Retry ZIP" : "Prepare ZIP"}
        </Button>
      )}
      <p className="max-w-xs text-xs text-muted" role="status">
        {url
          ? "ZIP ready. Click Download all to save it."
          : preparing
            ? "Preparing your files for download."
            : (error ?? "Prepare the ZIP, then click to download.")}
      </p>
    </div>
  );
}

export function PressDock({
  jobs,
  busy,
  onPress,
  onCancel,
}: {
  jobs: Job[];
  busy: boolean;
  onPress: () => void;
  onCancel: () => void;
}) {
  const ready = jobs.filter((job) => job.status === "queued" || job.status === "error");
  const done = jobs.filter(
    (job) => job.status === "done" && job.result && job.resultUrl && job.resultName,
  );
  const original = jobs.reduce((sum, job) => sum + job.originalSize, 0);
  const pressed = jobs.reduce((sum, job) => sum + (job.resultSize ?? job.originalSize), 0);
  const hasPressed = done.length > 0;
  const single = done.length === 1 ? done[0] : null;
  if (jobs.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-10 rounded-2xl p-1.5 shadow-[var(--shadow-border)] backdrop-blur-sm">
      <div className="flex flex-col gap-3 rounded-xl bg-bg-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">
            {busy ? "Pressing files" : hasPressed ? "Pressed and ready" : "Ready to press"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            <span className="tabular-nums">{formatBytes(original)}</span>
            {hasPressed && (
              <>
                <span className="mx-1.5 text-subtle">→</span>
                <span className="tabular-nums text-fg">{formatBytes(pressed)}</span>
                <span className="mx-1.5 text-subtle">/</span>
                <span className="tabular-nums text-sage">
                  −{Math.round(savingsRatio(original, pressed) * 100)}%
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {single && (
            <a
              href={single.resultUrl}
              download={single.resultName}
              className={buttonVariants({ variant: "secondary", size: "md" })}
              onClick={() =>
                toast.info("Download requested. Check the Downloads folder in your browser.")
              }
            >
              <Download className="size-4" /> Save file
            </a>
          )}
          {done.length > 1 && (
            <ArchiveDownload
              key={done.map((job) => `${job.id}:${job.resultUrl}`).join("|")}
              jobs={done}
            />
          )}
          {busy ? (
            <Button variant="secondary" size="md" onClick={onCancel}>
              <Square className="size-3.5 fill-current" /> Stop
            </Button>
          ) : (
            <Button size="md" disabled={ready.length === 0} onClick={onPress}>
              Press{" "}
              {ready.length > 0 ? `${ready.length} file${ready.length === 1 ? "" : "s"}` : "files"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
