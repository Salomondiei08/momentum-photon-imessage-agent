import 'dotenv/config';

import { IMessageSDK, MessageScheduler, loggerPlugin } from '@photon-ai/imessage-kit';

import { createCoach } from './coach.js';
import { loadConfig } from './config.js';
import { MomentumAgent } from './momentum-agent.js';
import { FileMemoryStore } from './store/file-store.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new FileMemoryStore(config.dataFile);
  const coach = createCoach(config.model);
  const state = await store.read();

  const sdk = new IMessageSDK({
    debug: process.env.DEBUG === '1',
    plugins: [loggerPlugin({ level: 'info' })]
  });

  const scheduler = new MessageScheduler(sdk, { debug: process.env.DEBUG === '1' });
  if (state.scheduler) {
    scheduler.import(state.scheduler);
  }

  const persistScheduler = async (): Promise<void> => {
    const nextState = await store.read();
    nextState.scheduler = scheduler.export();
    await store.write(nextState);
  };

  const agent = new MomentumAgent({
    store,
    coach,
    scheduler,
    systemName: config.systemName,
    persistScheduler
  });

  await persistScheduler();

  await sdk.startWatching({
    onDirectMessage: async (message) => {
      const reply = await agent.handleMessage(message);
      if (reply) {
        await sdk.send(message.sender, reply);
      }
    },
    onError: (error) => {
      console.error('[momentum] watcher error', error);
    }
  });

  console.log(`[momentum] live and watching as ${config.systemName}`);

  const shutdown = async (): Promise<void> => {
    await persistScheduler();
    scheduler.destroy();
    sdk.stopWatching();
    await sdk.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error('[momentum] fatal error', error);
  process.exit(1);
});
