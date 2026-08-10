/**
 * Pure scheduling helpers shared by the UI and the server trigger endpoints.
 */

export type Recurrence = "every_15m" | "hourly" | "every_6h" | "daily" | "weekly";
export type TriggerKind = "recurring" | "webhook";

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string; cron: string }[] = [
  { value: "every_15m", label: "Every 15 minutes", cron: "*/15 * * * *" },
  { value: "hourly", label: "Hourly", cron: "0 * * * *" },
  { value: "every_6h", label: "Every 6 hours", cron: "0 */6 * * *" },
  { value: "daily", label: "Daily at 09:00 UTC", cron: "0 9 * * *" },
  { value: "weekly", label: "Weekly (Mon 09:00 UTC)", cron: "0 9 * * 1" },
];

const MINUTE = 60_000;

export const INTERVAL_MS: Record<Recurrence, number> = {
  every_15m: 15 * MINUTE,
  hourly: 60 * MINUTE,
  every_6h: 6 * 60 * MINUTE,
  daily: 24 * 60 * MINUTE,
  weekly: 7 * 24 * 60 * MINUTE,
};

export function cronFor(recurrence: Recurrence): string {
  return RECURRENCE_OPTIONS.find((r) => r.value === recurrence)?.cron ?? "0 * * * *";
}

export function recurrenceLabel(recurrence: Recurrence): string {
  return RECURRENCE_OPTIONS.find((r) => r.value === recurrence)?.label ?? recurrence;
}

/** Next fire time, always strictly in the future relative to `from`. */
export function nextRunAt(recurrence: Recurrence, from: Date = new Date()): Date {
  const step = INTERVAL_MS[recurrence] ?? INTERVAL_MS.hourly;
  return new Date(from.getTime() + step);
}

export function isDue(nextRunIso: string, now: Date = new Date()): boolean {
  const t = Date.parse(nextRunIso);
  return Number.isFinite(t) && t <= now.getTime();
}

export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never";
  const diff = Date.parse(iso) - now.getTime();
  if (!Number.isFinite(diff)) return "unknown";
  const abs = Math.abs(diff);
  const mins = Math.round(abs / MINUTE);
  const unit =
    mins < 60 ? `${mins}m` : mins < 60 * 24 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}
