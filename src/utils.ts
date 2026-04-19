/**
 * Creates a compact unique id for local records.
 */
export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns an ISO timestamp for persistence.
 */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/**
 * Trims a string and returns undefined when it becomes empty.
 */
export function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
