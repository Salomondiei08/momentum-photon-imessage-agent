import path from 'node:path';

export interface AppConfig {
  model: string;
  databaseFile: string;
  systemName: string;
  promptVersion: string;
  dryRun: boolean;
}

export function loadConfig(): AppConfig {
  return {
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    databaseFile:
      process.env.MOMENTUM_DB_FILE ?? path.join(process.cwd(), 'data', 'momentum.sqlite'),
    systemName: process.env.AGENT_NAME ?? 'Momentum',
    promptVersion: process.env.PROMPT_VERSION ?? '2026-04-19-serious-v1',
    dryRun: process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  };
}
