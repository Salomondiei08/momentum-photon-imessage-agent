import type { AccountabilityStyle, AgentMode, ParsedCommand } from './types.js';
import { cleanText } from './utils.js';

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

  if (lower === 'recap' || lower === 'weekly recap' || lower === 'review me') {
    return { type: 'recap' };
  }

  if (lower.startsWith('goal ')) {
    return { type: 'goal', value: cleanText(text.slice(5)) };
  }

  if (lower.startsWith('priority ')) {
    return { type: 'priority', value: cleanText(text.slice(9)) };
  }

  if (lower.startsWith('promise ')) {
    return { type: 'promise', value: cleanText(text.slice(8)) };
  }

  if (lower.startsWith('done')) {
    return { type: 'done', value: cleanText(text.slice(4)) };
  }

  if (lower.startsWith('stuck ')) {
    return { type: 'stuck', value: cleanText(text.slice(6)) };
  }

  if (lower.startsWith('reflect ')) {
    return { type: 'reflect', value: cleanText(text.slice(8)) };
  }

  const nudgeMatch = text.match(/^nudge\s+(.+)$/i);
  if (nudgeMatch) {
    return { type: 'nudge', time: cleanText(nudgeMatch[1]) };
  }

  const modeMatch = text.match(/^mode\s+(.+)$/i);
  if (modeMatch) {
    const mode = parseMode(modeMatch[1]);
    return mode ? { type: 'mode', mode } : { type: 'chat', value: text };
  }

  const styleMatch = text.match(/^style\s+(.+)$/i);
  if (styleMatch) {
    const style = parseStyle(styleMatch[1]);
    return style ? { type: 'style', style } : { type: 'chat', value: text };
  }

  return { type: 'chat', value: text };
}

export function parseMode(input: string): AgentMode | null {
  const normalized = input.trim().toLowerCase();

  if (normalized.includes('coach')) {
    return 'coach';
  }
  if (normalized.includes('planner') || normalized.includes('plan')) {
    return 'planner';
  }
  if (normalized.includes('review')) {
    return 'review';
  }

  return null;
}

export function parseStyle(input: string): AccountabilityStyle | null {
  const normalized = input.trim().toLowerCase();

  if (normalized.includes('gentle')) {
    return 'gentle';
  }
  if (normalized.includes('strict')) {
    return 'strict';
  }
  if (normalized.includes('tactical')) {
    return 'tactical';
  }

  return null;
}

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

export function nextOccurrence(hour: number, minute: number, now: Date = new Date()): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}
