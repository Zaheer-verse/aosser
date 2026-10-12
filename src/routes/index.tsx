import { useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, FileText, Film, ImageIcon, LockKeyhole, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { DropZone } from "@/components/drop-zone";
import { FileCard } from "@/components/file-card";
import { ModeToggle } from "@/components/mode-toggle";
import { PressDock } from "@/components/press-dock";
import { SiteHeader } from "@/components/site-header";
import { useQueue } from "@/store/queue";

export const Route = createFileRoute("/")({ component: Home });

const FORMATS = [
  {
    icon: ImageIcon,
    title: "Images",
    extensions: "JPG · PNG · WebP · AVIF",
    detail: "Lighter images, with a before-and-after preview.",
  },
  {
    icon: Film,
    title: "Video",
    extensions: "MP4 · MOV · WebM",
    detail: "Smaller clips, processed on your device.",
  },
  {
    icon: FileText,
    title: "Documents",
    extensions: "PDF · DOCX",
    detail: "Trim document weight for easier sharing.",
  },
];

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
        toast.success(
          added === 1 ? "File added to your workspace." : `${added} files added to your workspace.`,
        );
      }
    },
    [addFiles],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files?.length && !busy) handleFiles(Array.from(files));
    };
    const preventNavigation = (event: DragEvent) => event.preventDefault();
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", preventNavigation);
    window.addEventListener("drop", preventNavigation);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", preventNavigation);
      window.removeEventListener("drop", preventNavigation);
    };
  }, [handleFiles, busy]);

  return (
    <>
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-fg"
      >
        Skip to workspace
      </a>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <SiteHeader />
        <main>
          <div className="grid items-start gap-10 py-10 sm:py-14 lg:grid-cols-12 lg:gap-14 lg:py-16">
            <section className="reveal lg:col-span-5 lg:pt-6">
              <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
                <span className="h-px w-6 bg-muted" aria-hidden="true" /> A lighter way to share
              </p>
              <h1 className="max-w-lg text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Compress files.
                <br />
                <span className="text-sage">Keep control.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
                Make images, videos and documents easier to send. Everything is compressed right
                here, on your device.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-sage" aria-hidden="true" /> No file uploads
                </span>
                <span className="flex items-center gap-2">
                  <ArrowDownToLine className="size-4 text-sage" aria-hidden="true" /> Yours to
                  download
                </span>
              </div>
              <div className="mt-10 hidden border-t border-border pt-6 lg:block">
                <p className="text-xs font-semibold uppercase tracking-widest text-subtle">
                  Simple by design
                </p>
                <ol className="mt-5 space-y-5">
                  {[
                    ["01", "Bring your files", "Add one file or a whole collection."],
                    ["02", "Find the right balance", "Choose quality or a smaller file size."],
                    ["03", "Take the lighter version", "Save individually or together as a ZIP."],
                  ].map(([number, title, copy]) => (
                    <li key={number} className="flex gap-4">
                      <span className="pt-0.5 text-xs font-semibold tabular-nums text-subtle">
                        {number}
                      </span>
                      <div>
                        <p className="text-sm font-bold">{title}</p>
                        <p className="mt-1 text-sm text-muted">{copy}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section
              id="workspace"
              aria-labelledby="workspace-title"
              className="reveal reveal-2 min-w-0 rounded-xl bg-bg-elevated shadow-workbench ring-1 ring-border lg:col-span-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-7">
                <h2 id="workspace-title" className="text-base font-bold tracking-tight">
                  Your workspace
                </h2>
                <span className="flex items-center gap-1.5 text-xs font-medium text-sage">
                  <ShieldCheck className="size-4" aria-hidden="true" /> Private by default
                </span>
              </div>
              <div className="space-y-6 p-5 sm:p-7">
                <DropZone onFiles={handleFiles} disabled={busy} />
                <ModeToggle value={mode} onChange={setMode} disabled={busy} />
                {jobs.length > 0 ? (
                  <section aria-label="Your files" className="space-y-3" aria-live="polite">
                    <div className="flex items-center justify-between border-t border-border pt-5">
                      <h3 className="text-sm font-semibold">Your files</h3>
                      <span className="text-xs tabular-nums text-muted">
                        {jobs.length} {jobs.length === 1 ? "file" : "files"}
                      </span>
                    </div>
                    {jobs.map((job) => (
                      <FileCard key={job.id} job={job} onRemove={removeJob} />
                    ))}
                  </section>
                ) : (
                  <p className="border-t border-border pt-5 text-center text-xs leading-relaxed text-muted">
                    Add your files, choose a setting, and press to compress.
                    <br />
                    Your original files are never overwritten.
                  </p>
                )}
                <PressDock
                  jobs={jobs}
                  busy={busy}
                  onPress={() => void pressAll()}
                  onCancel={cancelPress}
                />
              </div>
            </section>
          </div>

          <section
            id="formats"
            aria-labelledby="formats-title"
            className="border-t border-border py-9 sm:py-12"
          >
            <div className="mb-7 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="formats-title" className="text-lg font-bold tracking-tight">
                Made for your everyday files.
              </h2>
              <p className="text-sm text-muted">Up to 1 GB per file</p>
            </div>
            <div className="grid gap-7 sm:grid-cols-3 sm:gap-8">
              {FORMATS.map(({ icon: Icon, title, extensions, detail }) => (
                <div key={title} className="flex gap-3">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-muted"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-bold">
                      {title}{" "}
                      <span className="ml-2 text-xs font-medium text-subtle">{extensions}</span>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <details className="mt-8 text-sm text-muted">
              <summary className="w-fit cursor-pointer rounded-sm py-2 font-medium text-fg">
                Good to know before you compress
              </summary>
              <p className="mt-2 max-w-3xl leading-relaxed">
                Results depend on the file. Already optimized files may stay the same size. Large
                videos take longer and require a browser with supported video codecs. Some PDF
                compression can flatten pages. Keep your original when editing, searchable text or
                accessibility is important.
              </p>
            </details>
          </section>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-muted">
          <p>
            <span className="font-bold text-fg">Aosser</span> · Less to carry. More to share.
          </p>
          <span>Open source · MIT License</span>
        </footer>
      </div>
      <Toaster
        theme="light"
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "bg-bg-elevated text-fg border-border shadow-border font-sans",
          },
        }}
      />
    </>
  );
}
