import { nextOccurrence, parseCommand, parseDailyTime, parseMode, parseStyle } from '../src/parser';

describe('parseCommand', () => {
  test('parses richer explicit commands', () => {
    expect(parseCommand('goal write the launch email')).toEqual({
      type: 'goal',
      value: 'write the launch email'
    });

    expect(parseCommand('nudge 8am')).toEqual({
      type: 'nudge',
      time: '8am'
    });

    expect(parseCommand('mode planner')).toEqual({
      type: 'mode',
      mode: 'planner'
    });

    expect(parseCommand('style strict')).toEqual({
      type: 'style',
      style: 'strict'
    });
  });

  test('treats everything else as chat', () => {
    expect(parseCommand('good morning, I am procrastinating')).toEqual({
      type: 'chat',
      value: 'good morning, I am procrastinating'
    });
  });
});

describe('parse helpers', () => {
  test('parses mode and style values', () => {
    expect(parseMode('planner')).toBe('planner');
    expect(parseStyle('gentle please')).toBe('gentle');
  });

  test('handles 12-hour time formats', () => {
    expect(parseDailyTime('8am')).toEqual({
      hour: 8,
      minute: 0,
      label: '08:00'
    });

    expect(parseDailyTime('6:45 pm')).toEqual({
      hour: 18,
      minute: 45,
      label: '18:45'
    });
  });

  test('rejects invalid times', () => {
    expect(parseDailyTime('25:00')).toBeNull();
    expect(parseDailyTime('nope')).toBeNull();
  });
});

describe('nextOccurrence', () => {
  test('rolls to tomorrow when the time already passed', () => {
    const now = new Date(Date.UTC(2026, 3, 19, 20, 0, 0));
    const next = nextOccurrence(8, 0, now);

    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
    expect(next.getDate()).toBe(20);
  });
});
