export function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

export function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function dayKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function nextWeekdayOccurrence(
  weekday: number,
  hour: number,
  minute: number,
  now: Date = new Date()
): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const delta = (weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + delta);

  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}
