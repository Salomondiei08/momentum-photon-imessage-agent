import OpenAI from 'openai';

import type { Coach, CoachContext } from './types.js';

/**
 * Produces a useful response even when no model key is configured yet.
 */
export class FallbackCoach implements Coach {
  public async reply(context: CoachContext): Promise<string> {
    const goal = context.activeGoals[0]?.text ?? 'your goal';

    switch (context.intent) {
      case 'stuck':
        return `You’re stuck on "${context.latestMessage}". Try the smallest next move: spend 10 minutes on one concrete step toward ${goal}, then text me what happened.`;
      case 'celebrate':
        return `Nice work. That moves ${goal} forward. Want to lock in the next step so the streak stays alive?`;
      case 'planning':
        return `Locked in. I’ll treat "${context.latestMessage}" as today’s priority. If it helps, reply with "stuck ..." and I’ll help break it down.`;
      case 'check-in':
        return `Quick reset: what matters most today for ${goal}? Reply with "priority ..." and I’ll remember it.`;
      default:
        return `I’m tracking ${goal}. Tell me "goal ...", "priority ...", "done ...", or "stuck ..." and I’ll keep the thread moving.`;
    }
  }
}

/**
 * OpenAI-backed coach for warmer, more personalized replies.
 */
export class OpenAICoach implements Coach {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string
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
          lastCheckInAt: context.profile.lastCheckInAt,
          nudgeTime: context.profile.nudgeTime
        },
        activeGoals: context.activeGoals.map((goal) => goal.text),
        recentEntries: context.recentEntries.map((entry) => ({
          kind: entry.kind,
          text: entry.text,
          createdAt: entry.createdAt
        }))
      },
      null,
      2
    );

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are Momentum, an iMessage-native accountability coach. Reply in plain text only. Keep replies to 2-4 short sentences, specific, warm, and action-oriented. Reference memory when helpful, ask at most one follow-up question, and avoid sounding like an app menu.'
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
  }
}

/**
 * Returns the best available coach implementation for local runtime.
 */
export function createCoach(model: string): Coach {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAICoach(apiKey, model) : new FallbackCoach();
}
