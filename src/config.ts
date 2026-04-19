import path from 'node:path';

/**
 * Runtime configuration for the Momentum agent.
 */
export interface AppConfig {
  model: string;
  dataFile: string;
  systemName: string;
}

/**
 * Loads process-backed config with sensible local defaults.
 */
export function loadConfig(): AppConfig {
  return {
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    dataFile:
      process.env.MOMENTUM_DATA_FILE ??
      path.join(process.cwd(), 'data', 'momentum-state.json'),
    systemName: process.env.AGENT_NAME ?? 'Momentum'
  };
}
