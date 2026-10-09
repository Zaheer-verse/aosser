const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const digits = i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${UNITS[i]}`;
}

export function formatPercent(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct}%`;
}

export function savingsRatio(original: number, next: number): number {
  if (original <= 0) return 0;
  return Math.max(0, 1 - next / original);
}

export function stemAndExt(filename: string): { stem: string; ext: string } {
  const trimmed = filename.trim();
  const idx = trimmed.lastIndexOf(".");
  if (idx <= 0) return { stem: trimmed || "file", ext: "" };
  return { stem: trimmed.slice(0, idx), ext: trimmed.slice(idx + 1).toLowerCase() };
}

export function pressedName(original: string, nextExt: string): string {
  const { stem } = stemAndExt(original);
  const clean = stem.replace(/[-_.]?(pressed|dosser|compressed|min)$/i, "");
  return `${clean}-pressed.${nextExt}`;
}
