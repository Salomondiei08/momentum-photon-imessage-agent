import { jest } from '@jest/globals';
import type { MessageScheduler } from '@photon-ai/imessage-kit';

import { Logger } from '../src/logger';
import { MomentumAgent } from '../src/momentum-agent';
import type { AgentState, Coach, MemoryStore } from '../src/types';

function createStore(initial?: Partial<AgentState>): MemoryStore {
  let state: AgentState = {
    goals: {},
    profiles: {},
    journal: [],
    processedMessages: [],
    promptVersion: 'test-prompt',
    ...initial
  };

  return {
    async read() {
      return structuredClone(state);
    },
    async write(nextState) {
      state = structuredClone(nextState);
    }
  };
}

function createMessage(text: string, guid = 'g1') {
  return {
    id: 'm1',
    guid,
    text,
    sender: '+15555550123',
    senderName: 'Ava',
    chatId: 'chat-1',
    isGroupChat: false,
    service: 'iMessage',
    isRead: false,
    isFromMe: false,
    isReaction: false,
    reactionType: null,
    isReactionRemoval: false,
    associatedMessageGuid: null,
    attachments: [],
    date: new Date('2026-04-19T10:00:00Z')
  } as const;
}

function createAgent(store: MemoryStore, coachReply = 'coach reply') {
  const coach: Coach = { reply: jest.fn().mockResolvedValue(coachReply) };
  const scheduler = {
    scheduleRecurring: jest.fn().mockReturnValue('sched_1'),
    cancel: jest.fn(),
    export: jest.fn().mockReturnValue({ scheduled: [], recurring: [] })
  } as unknown as MessageScheduler;

  const agent = new MomentumAgent({
    store,
    coach,
    scheduler,
    systemName: 'Momentum',
    promptVersion: 'test-prompt',
    logger: new Logger()
  });

  return { agent, coach, scheduler };
}

describe('MomentumAgent', () => {
  test('guides a new user through onboarding', async () => {
    const store = createStore();
    const { agent, scheduler } = createAgent(store);

    const goalReply = await agent.handleMessage(createMessage('Get my portfolio shipped', 'g1'));
    expect(goalReply).toContain('What time should I nudge you every morning');

    const timeReply = await agent.handleMessage(createMessage('8am', 'g2'));
    expect(timeReply).toContain('gentle, strict, or tactical');

    const styleReply = await agent.handleMessage(createMessage('tactical', 'g3'));
    expect(styleReply).toContain('today’s priority');

    const priorityReply = await agent.handleMessage(createMessage('finish the hero case study', 'g4'));
    expect(priorityReply).toContain('You’re set');

    const state = await store.read();
    expect(state.profiles['+15555550123'].onboardingStep).toBe('complete');
    expect((scheduler as unknown as { scheduleRecurring: jest.Mock }).scheduleRecurring).toHaveBeenCalledTimes(3);
  });

  test('skips duplicate messages by guid', async () => {
    const store = createStore({
      profiles: {
        '+15555550123': {
          sender: '+15555550123',
          activeGoalIds: [],
          onboardingStep: 'complete',
          mode: 'coach',
          accountabilityStyle: 'tactical',
          streakCount: 0,
          bestStreak: 0,
          promptVersion: 'test-prompt'
        }
      }
    });
    const { agent, coach } = createAgent(store);

    await agent.handleMessage(createMessage('stuck on outreach', 'same-guid'));
    const duplicateReply = await agent.handleMessage(createMessage('stuck on outreach', 'same-guid'));

    expect(duplicateReply).toBeNull();
    expect((coach.reply as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  test('builds a weekly recap summary', async () => {
    const store = createStore({
      goals: {
        goal_1: {
          id: 'goal_1',
          sender: '+15555550123',
          text: 'ship the demo',
          createdAt: '2026-04-12T00:00:00.000Z'
        }
      },
      profiles: {
        '+15555550123': {
          sender: '+15555550123',
          activeGoalIds: ['goal_1'],
          onboardingStep: 'complete',
          mode: 'review',
          accountabilityStyle: 'tactical',
          streakCount: 3,
          bestStreak: 5,
          lastPromise: 'send the draft',
          promptVersion: 'test-prompt'
        }
      },
      journal: [
        {
          id: 'e1',
          sender: '+15555550123',
          kind: 'win',
          text: 'sent the draft',
          createdAt: new Date().toISOString()
        },
        {
          id: 'e2',
          sender: '+15555550123',
          kind: 'stuck',
          text: 'avoided outreach',
          createdAt: new Date().toISOString()
        }
      ]
    });
    const { agent } = createAgent(store);

    const reply = await agent.handleMessage(createMessage('recap', 'g5'));
    expect(reply).toContain('Weekly recap for ship the demo');
    expect(reply).toContain('Current streak: 3 day(s)');
  });
});
