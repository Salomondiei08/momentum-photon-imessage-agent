import { jest } from '@jest/globals';
import type { MessageScheduler } from '@photon-ai/imessage-kit';

import type { AgentState, Coach, MemoryStore } from '../src/types';
import { MomentumAgent } from '../src/momentum-agent';

function createStore(initial?: AgentState): MemoryStore {
  let state =
    initial ?? {
      goals: {},
      profiles: {},
      journal: []
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

function createMessage(text: string) {
  return {
    id: 'm1',
    guid: 'g1',
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

describe('MomentumAgent', () => {
  test('stores a goal and confirms it', async () => {
    const store = createStore();
    const coach: Coach = { reply: jest.fn().mockResolvedValue('coach reply') };
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
      persistScheduler: async () => {}
    });

    const reply = await agent.handleMessage(createMessage('goal finish the application'));
    expect(reply).toContain('Locked in: finish the application');

    const state = await store.read();
    const profile = state.profiles['+15555550123'];
    expect(profile.activeGoalIds).toHaveLength(1);
  });

  test('schedules a recurring nudge', async () => {
    const store = createStore({
      goals: {
        goal_1: {
          id: 'goal_1',
          text: 'ship the demo',
          createdAt: '2026-04-19T00:00:00.000Z'
        }
      },
      profiles: {
        '+15555550123': {
          sender: '+15555550123',
          activeGoalIds: ['goal_1']
        }
      },
      journal: []
    });

    const coach: Coach = { reply: jest.fn().mockResolvedValue('coach reply') };
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
      persistScheduler: async () => {}
    });

    const reply = await agent.handleMessage(createMessage('nudge 8am'));
    expect(reply).toBe('Daily nudge set for 08:00.');
    expect((scheduler as unknown as { scheduleRecurring: jest.Mock }).scheduleRecurring).toHaveBeenCalled();
  });
});
