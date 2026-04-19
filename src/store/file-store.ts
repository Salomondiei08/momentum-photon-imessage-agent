import fs from 'node:fs/promises';
import path from 'node:path';

import type { AgentState, MemoryStore } from '../types.js';

const EMPTY_STATE: AgentState = {
  goals: {},
  profiles: {},
  journal: []
};

/**
 * Persists the agent's lightweight memory to a local JSON file.
 */
export class FileMemoryStore implements MemoryStore {
  constructor(private readonly filePath: string) {}

  public async read(): Promise<AgentState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as AgentState;
      return {
        goals: parsed.goals ?? {},
        profiles: parsed.profiles ?? {},
        journal: parsed.journal ?? [],
        scheduler: parsed.scheduler
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return EMPTY_STATE;
      }
      throw error;
    }
  }

  public async write(state: AgentState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}
