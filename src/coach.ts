import OpenAI from 'openai';

import { Logger } from './logger.js';
import type { BehaviorSignals, Coach, CoachContext, WeeklySummaryContext } from './types.js';

function buildSystemPrompt(context: CoachContext): string {
  return [
    'You are Momentum, an iMessage-native accountability coach.',
    'Reply in plain text only.',
    'Keep replies to 2-4 short sentences.',
    'Be specific, useful, and slightly opinionated.',
    'Always push toward a concrete next action.',
    'Reference prior commitments when they matter.',
    'Ask at most one follow-up question.',
    `Mode: ${context.profile.mode}.`,
    `Accountability style: ${context.profile.accountabilityStyle}.`,
    `Prompt version: ${context.profile.promptVersion}.`
  ].join(' ');
}

function summarizeSignals(signals: BehaviorSignals): string {
  return JSON.stringify(signals, null, 2);
}

/**
 * Produces useful coaching even when model access fails.
 */
export class FallbackCoach implements Coach {
  public async reply(context: CoachContext): Promise<string> {
    const goal = context.activeGoals[0]?.text ?? 'your current goal';
    const promise = context.signals.unfinishedPromise;
    const styleLead =
      context.profile.accountabilityStyle === 'strict'
        ? 'Quick truth:'
        : context.profile.accountabilityStyle === 'tactical'
          ? 'Plan:'
          : 'Small reset:';

    if (context.intent === 'review' || context.profile.mode === 'review') {
      return context.weeklySummary ?? `You are working on ${goal}. Your streak is ${context.profile.streakCount} day${context.profile.streakCount === 1 ? '' : 's'}.`;
    }

    if (context.intent === 'reflection') {
      return `${styleLead} capture one thing that worked and one thing you would change tomorrow. That keeps ${goal} from becoming vague motivation.`;
    }

    if (context.intent === 'stuck') {
      return `${styleLead} shrink the task until it feels almost too small. Spend 10 minutes on one visible step toward ${goal}${promise ? `, especially the promise to ${promise}` : ''}, then text me the result.`;
    }

    if (context.intent === 'celebrate') {
      return `${styleLead} count that as real progress. Keep the streak alive by naming the next action for ${goal} before the day ends.`;
    }

    if ((context.intent === 'check-in' || context.intent === 'general') && promise) {
      return `${styleLead} before you add something new, close the loop on your promise to ${promise}. What is the smallest version of that you can finish today?`;
    }

    if (context.profile.mode === 'planner' || context.intent === 'planning') {
      return `${styleLead} turn this into one concrete move for today. Time-box 25 minutes, finish the ugliest useful version, and report back with "done ..." when it ships.`;
    }

    if (context.signals.procrastinationPattern) {
      return `${styleLead} you have been circling this for a few messages without a win. Stop refining the plan and do one uncomfortable action toward ${goal} in the next 15 minutes.`;
    }

    return `${styleLead} the next useful move for ${goal} is to pick one concrete task and commit to it in a single sentence.`;
  }

  public async summarizeWeekly(context: WeeklySummaryContext): Promise<string> {
    const goal = context.activeGoals[0]?.text ?? 'your goal';
    const unfinished = context.signals.unfinishedPromise
      ? `Unfinished promise: ${context.signals.unfinishedPromise}.`
      : 'No unfinished promise is currently tracked.';

    return [
      `Weekly recap for ${goal}:`,
      context.baseSummary,
      unfinished,
      `Recent wins logged: ${context.signals.recentWins}.`,
      'Best next focus: choose one commitment you can finish early this week.'
    ].join('\n');
  }
}

/**
 * OpenAI-backed coach with retry and graceful fallback.
 */
export class OpenAICoach implements Coach {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly fallback: Coach,
    private readonly logger: Logger
  ) {
    this.client = new OpenAI({ apiKey });
  }

  public async reply(context: CoachContext): Promise<string> {
    const memory = JSON.stringify(
      {
        profile: {
          sender: context.profile.sender,
          displayName: context.profile.displayName,
          lastPriority: context.profile.lastPriority,
          lastPromise: context.profile.lastPromise,
          lastCheckInAt: context.profile.lastCheckInAt,
          streakCount: context.profile.streakCount,
          bestStreak: context.profile.bestStreak,
          mode: context.profile.mode,
          accountabilityStyle: context.profile.accountabilityStyle
        },
        activeGoals: context.activeGoals.map((goal) => goal.text),
        recentEntries: context.recentEntries.map((entry) => ({
          kind: entry.kind,
          text: entry.text,
          createdAt: entry.createdAt
        })),
        signals: summarizeSignals(context.signals),
        weeklySummary: context.weeklySummary
      },
      null,
      2
    );

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await this.client.responses.create({
          model: this.model,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: buildSystemPrompt(context)
                }
              ]
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Intent: ${context.intent}\nLatest message: ${context.latestMessage}\nMemory:\n${memory}`
                }
              ]
            }
          ]
        });

        return response.output_text.trim();
      } catch (error) {
        this.logger.warn('openai_retry', {
          attempt,
          model: this.model,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempt === 3) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }

    this.logger.warn('openai_fallback', {
      model: this.model,
      sender: context.profile.sender
    });
    return this.fallback.reply(context);
  }

  public async summarizeWeekly(context: WeeklySummaryContext): Promise<string> {
    const memory = JSON.stringify(
      {
        profile: {
          sender: context.profile.sender,
          displayName: context.profile.displayName,
          streakCount: context.profile.streakCount,
          bestStreak: context.profile.bestStreak,
          lastPromise: context.profile.lastPromise,
          accountabilityStyle: context.profile.accountabilityStyle
        },
        activeGoals: context.activeGoals.map((goal) => goal.text),
        recentEntries: context.recentEntries.map((entry) => ({
          kind: entry.kind,
          text: entry.text,
          createdAt: entry.createdAt
        })),
        signals: summarizeSignals(context.signals),
        baseSummary: context.baseSummary
      },
      null,
      2
    );

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await this.client.responses.create({
          model: this.model,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'You write concise weekly accountability recaps for an iMessage-native coach. Plain text only. Be crisp, honest, and motivating. Include what moved, what stalled, and the single best next focus.'
                }
              ]
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: memory
                }
              ]
            }
          ]
        });

        return response.output_text.trim();
      } catch (error) {
        this.logger.warn('openai_weekly_retry', {
          attempt,
          model: this.model,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempt === 3) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }

    return this.fallback.summarizeWeekly(context);
  }
}

export function createCoach(model: string, logger: Logger): Coach {
  const fallback = new FallbackCoach();
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAICoach(apiKey, model, fallback, logger) : fallback;
}
