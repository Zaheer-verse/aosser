import { useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import { DropZone } from "@/components/drop-zone";
import { FileCard } from "@/components/file-card";
import { ModeToggle } from "@/components/mode-toggle";
import { PressDock } from "@/components/press-dock";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { useQueue } from "@/store/queue";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const jobs = useQueue((s) => s.jobs);
  const mode = useQueue((s) => s.mode);
  const busy = useQueue((s) => s.busy);
  const setMode = useQueue((s) => s.setMode);
  const addFiles = useQueue((s) => s.addFiles);
  const removeJob = useQueue((s) => s.removeJob);
  const pressAll = useQueue((s) => s.pressAll);
  const cancelPress = useQueue((s) => s.cancelPress);

  const handleFiles = useCallback(
    (files: File[]) => {
      const { added, rejected } = addFiles(files);
      for (const reason of rejected) toast.error(reason);
      if (added && rejected.length === 0) {
        toast.success(added === 1 ? "File added to the press." : `${added} files added to the press.`);
      }
    },
    [addFiles],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length) handleFiles(Array.from(files));
    };
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  return (
    <main className="cutting-mat min-h-dvh">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10",
          jobs.length > 0 && "pb-32",
        )}
      >
        <div className="reveal">
          <SiteHeader />
        </div>

        <section className="reveal reveal-2 mt-10 sm:mt-14">
          <h1 className="max-w-xl font-display text-4xl font-medium leading-tight tracking-tight text-fg sm:text-5xl">
            Press files down. Keep what matters.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-normal text-muted">
            Choose a force, drop anything up to a gigabyte, and take a lighter copy. Nothing leaves this browser.
          </p>
        </section>

        <section className="reveal reveal-3 mt-8">
          <ModeToggle value={mode} onChange={setMode} disabled={busy} />
        </section>

        <section className="reveal reveal-4 mt-5">
          <DropZone onFiles={handleFiles} disabled={busy} />
        </section>

        {jobs.length > 0 && (
          <section className="mt-6 flex flex-col gap-3" aria-live="polite">
            {jobs.map((job) => (
              <FileCard key={job.id} job={job} onRemove={removeJob} />
            ))}
          </section>
        )}

        {jobs.length === 0 && (
          <ol className="mt-10 grid gap-4 text-sm text-muted sm:grid-cols-3">
            <li className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
              <p className="font-display text-base text-fg">1. Drop</p>
              <p className="mt-1 leading-normal">Image, video, PDF, or Word — up to 1 GB.</p>
            </li>
            <li className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
              <p className="font-display text-base text-fg">2. Choose force</p>
              <p className="mt-1 leading-normal">Balanced keeps the look. Strong squeezes hard.</p>
            </li>
            <li className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
              <p className="font-display text-base text-fg">3. Take the copy</p>
              <p className="mt-1 leading-normal">Download one file, or the whole stack as a zip.</p>
            </li>
          </ol>
        )}

        {jobs.length === 0 && (
          <footer className="mt-auto pt-12 text-xs text-subtle">
            Dosser compresses locally. Large videos may take a few minutes.
          </footer>
        )}
      </div>

      <PressDock jobs={jobs} busy={busy} onPress={() => void pressAll()} onCancel={cancelPress} />

      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "bg-bg-elevated text-fg border-border shadow-[var(--shadow-border)] font-sans",
          },
        }}
      />
    </main>
  );
}
