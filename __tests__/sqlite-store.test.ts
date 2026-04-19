import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SqliteMemoryStore } from '../src/store/sqlite-store';
import type { AgentState } from '../src/types';

describe('SqliteMemoryStore', () => {
  test('persists state across store instances', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-store-'));
    const dbFile = path.join(tempDir, 'momentum.sqlite');
    const store = new SqliteMemoryStore(dbFile);

    const initialState: AgentState = {
      goals: {
        goal_1: {
          id: 'goal_1',
          sender: '+15555550123',
          text: 'ship the demo',
          createdAt: '2026-04-19T00:00:00.000Z'
        }
      },
      profiles: {
        '+15555550123': {
          sender: '+15555550123',
          activeGoalIds: ['goal_1'],
          onboardingStep: 'complete',
          mode: 'planner',
          accountabilityStyle: 'strict',
          streakCount: 2,
          bestStreak: 4,
          promptVersion: 'test-prompt'
        }
      },
      journal: [
        {
          id: 'entry_1',
          sender: '+15555550123',
          kind: 'win',
          text: 'sent the draft',
          createdAt: '2026-04-19T01:00:00.000Z'
        }
      ],
      processedMessages: [
        {
          guid: 'g1',
          sender: '+15555550123',
          receivedAt: '2026-04-19T01:00:00.000Z'
        }
      ],
      promptVersion: 'test-prompt',
      scheduler: {
        scheduled: [],
        recurring: []
      }
    };

    await store.write(initialState);

    const recovered = new SqliteMemoryStore(dbFile);
    const nextState = await recovered.read();

    expect(nextState.profiles['+15555550123'].mode).toBe('planner');
    expect(nextState.goals.goal_1.text).toBe('ship the demo');
    expect(nextState.processedMessages[0].guid).toBe('g1');
    expect(nextState.promptVersion).toBe('test-prompt');
  });
});
