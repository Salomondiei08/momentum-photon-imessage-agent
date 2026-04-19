import type { ParsedCommand } from './types.js';
import { cleanText } from './utils.js';

/**
 * Parses plain-text iMessage input into a narrow command set.
 */
export function parseCommand(input: string): ParsedCommand {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { type: 'help' };
  }

  if (lower === 'help' || lower === 'menu') {
    return { type: 'help' };
  }

  if (lower === 'status' || lower === 'summary') {
    return { type: 'status' };
  }

  if (lower.startsWith('goal ')) {
    return { type: 'goal', value: cleanText(text.slice(5)) };
  }

  if (lower.startsWith('priority ')) {
    return { type: 'priority', value: cleanText(text.slice(9)) };
  }

  if (lower.startsWith('done ')) {
    return { type: 'done', value: cleanText(text.slice(5)) };
  }

  if (lower.startsWith('stuck ')) {
    return { type: 'stuck', value: cleanText(text.slice(6)) };
  }

  const nudgeMatch = text.match(/^nudge\s+(.+)$/i);
  if (nudgeMatch) {
    return { type: 'nudge', time: cleanText(nudgeMatch[1]) };
  }

  return { type: 'chat', value: text };
}

/**
 * Parses a simple daily local time like `8am`, `08:30`, or `6:45 pm`.
 */
export function parseDailyTime(input: string): { hour: number; minute: number; label: string } | null {
  const raw = input.trim().toLowerCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3];

  if (minute > 59 || hour > 23 || hour < 0) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  }

  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  };
}

/**
 * Computes the next occurrence of a daily time after `now`.
 */
export function nextOccurrence(hour: number, minute: number, now: Date = new Date()): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}
