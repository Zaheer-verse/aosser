import { create } from "zustand";
import { createDownloadUrl } from "@/lib/download";
import { compressFile, detectKind, MAX_BYTES, type FileKind, type PressMode } from "@/lib/compress";

export type JobStatus = "queued" | "pressing" | "done" | "error";

export type Job = {
  id: string;
  file: File;
  kind: FileKind;
  status: JobStatus;
  progress: number;
  originalSize: number;
  result?: Blob;
  resultName?: string;
  resultSize?: number;
  resultUrl?: string;
  keptOriginal?: boolean;
  error?: string;
  previewUrl?: string;
};

type QueueState = {
  jobs: Job[];
  mode: PressMode;
  busy: boolean;
  setMode: (mode: PressMode) => void;
  addFiles: (files: File[]) => { added: number; rejected: string[] };
  removeJob: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
  pressAll: () => Promise<void>;
  cancelPress: () => void;
};

const controllers = new Map<string, AbortController>();
let pressGeneration = 0;

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageOf(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "Canceled.";
  if (err instanceof Error && err.message) return err.message;
  return "Could not compress this file.";
}

function revokeJobUrls(job: Job) {
  if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
  if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
}

export const useQueue = create<QueueState>((set, get) => ({
  jobs: [],
  mode: "balanced",
  busy: false,
  setMode: (mode) => set({ mode }),
  addFiles: (files) => {
    const rejected: string[] = [];
    const next: Job[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} is over 1 GB.`);
        continue;
      }
      if (file.size <= 0) {
        rejected.push(`${file.name} is empty.`);
        continue;
      }
      const kind = detectKind(file);
      if (!kind) {
        rejected.push(`${file.name} is not an image, video, PDF, or Word file.`);
        continue;
      }
      const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
      next.push({
        id: makeId(),
        file,
        kind,
        status: "queued",
        progress: 0,
        originalSize: file.size,
        previewUrl,
      });
    }
    if (next.length) set((state) => ({ jobs: [...state.jobs, ...next] }));
    return { added: next.length, rejected };
  },
  removeJob: (id) => {
    controllers.get(id)?.abort();
    controllers.delete(id);
    set((state) => {
      const job = state.jobs.find((item) => item.id === id);
      if (job) revokeJobUrls(job);
      return { jobs: state.jobs.filter((item) => item.id !== id) };
    });
  },
  clearDone: () => {
    set((state) => {
      for (const job of state.jobs) {
        if (job.status === "done") revokeJobUrls(job);
      }
      return { jobs: state.jobs.filter((job) => job.status !== "done") };
    });
  },
  clearAll: () => {
    pressGeneration += 1;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    set((state) => {
      for (const job of state.jobs) revokeJobUrls(job);
      return { jobs: [], busy: false };
    });
  },
  cancelPress: () => {
    pressGeneration += 1;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    set((state) => ({
      busy: false,
      jobs: state.jobs.map((job) =>
        job.status === "pressing" ? { ...job, status: "queued", progress: 0 } : job,
      ),
    }));
  },
  pressAll: async () => {
    if (get().busy) return;
    const generation = ++pressGeneration;
    set({ busy: true });
    const pending = get().jobs.filter((job) => job.status === "queued" || job.status === "error");
    for (const job of pending) {
      if (generation !== pressGeneration) break;
      if (!get().jobs.some((item) => item.id === job.id)) continue;
      const controller = new AbortController();
      controllers.set(job.id, controller);
      set((state) => ({
        jobs: state.jobs.map((item) =>
          item.id === job.id
            ? { ...item, status: "pressing", progress: 0.02, error: undefined }
            : item,
        ),
      }));
      try {
        const result = await compressFile(
          job.file,
          job.kind,
          get().mode,
          (progress) => {
            if (
              generation !== pressGeneration ||
              controller.signal.aborted ||
              controllers.get(job.id) !== controller
            )
              return;
            set((state) => ({
              jobs: state.jobs.map((item) => (item.id === job.id ? { ...item, progress } : item)),
            }));
          },
          controller.signal,
        );
        if (generation !== pressGeneration) break;
        if (controller.signal.aborted || !get().jobs.some((item) => item.id === job.id)) continue;
        const resultUrl = createDownloadUrl(result.blob);
        set((state) => ({
          jobs: state.jobs.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: "done",
                  progress: 1,
                  result: result.blob,
                  resultName: result.filename,
                  resultSize: result.blob.size,
                  resultUrl,
                  keptOriginal: result.keptOriginal,
                }
              : item,
          ),
        }));
      } catch (err) {
        if (generation !== pressGeneration) break;
        set((state) => ({
          jobs: state.jobs.map((item) =>
            item.id === job.id
              ? { ...item, status: "error", progress: 0, error: messageOf(err) }
              : item,
          ),
        }));
      } finally {
        if (controllers.get(job.id) === controller) controllers.delete(job.id);
      }
    }
    if (generation === pressGeneration) set({ busy: false });
  },
}));
