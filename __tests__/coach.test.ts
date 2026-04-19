import { FallbackCoach } from '../src/coach';
import type { CoachContext, WeeklySummaryContext } from '../src/types';

function baseContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    profile: {
      sender: '+15555550123',
      activeGoalIds: ['goal_1'],
      onboardingStep: 'complete',
      mode: 'coach',
      accountabilityStyle: 'strict',
      streakCount: 2,
      bestStreak: 4,
      promptVersion: 'test-prompt',
      lastPromise: 'send the outreach'
    },
    activeGoals: [
      {
        id: 'goal_1',
        sender: '+15555550123',
        text: 'ship the demo',
        createdAt: '2026-04-19T00:00:00.000Z'
      }
    ],
    recentEntries: [],
    latestMessage: 'good morning',
    intent: 'check-in',
    signals: {
      procrastinationPattern: false,
      unfinishedPromise: 'send the outreach',
      streakAtRisk: true,
      recentWins: 0
    },
    ...overrides
  };
}

describe('FallbackCoach', () => {
  test('follows up on unfinished promises during check-ins', async () => {
    const coach = new FallbackCoach();
    const reply = await coach.reply(baseContext());

    expect(reply).toContain('close the loop on your promise');
    expect(reply).toContain('send the outreach');
  });

  test('creates a usable weekly summary without OpenAI', async () => {
    const coach = new FallbackCoach();
    const summaryContext: WeeklySummaryContext = {
      profile: baseContext().profile,
      activeGoals: baseContext().activeGoals,
      recentEntries: [],
      signals: baseContext().signals,
      baseSummary: 'Wins: sent the draft.'
    };

    const summary = await coach.summarizeWeekly(summaryContext);
    expect(summary).toContain('Weekly recap for ship the demo');
    expect(summary).toContain('Unfinished promise');
  });
});
