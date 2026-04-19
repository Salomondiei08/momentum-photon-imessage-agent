import 'dotenv/config';

import { IMessageSDK, MessageScheduler, loggerPlugin } from '@photon-ai/imessage-kit';

import { createCoach } from './coach.js';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { MomentumAgent } from './momentum-agent.js';
import { SqliteMemoryStore } from './store/sqlite-store.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger();
  const store = new SqliteMemoryStore(config.databaseFile);
  const coach = createCoach(config.model, logger);
  const state = await store.read();

  if (process.argv.includes('--healthcheck')) {
    logger.info('healthcheck_ok', {
      databaseFile: config.databaseFile,
      model: config.model,
      promptVersion: config.promptVersion,
      dryRun: config.dryRun
    });
    return;
  }

  const sdk = new IMessageSDK({
    debug: process.env.DEBUG === '1',
    plugins: [loggerPlugin({ level: 'info' })]
  });

  const scheduler = new MessageScheduler(sdk, { debug: process.env.DEBUG === '1' });
  if (state.scheduler) {
    scheduler.import(state.scheduler);
  }

  const agent = new MomentumAgent({
    store,
    coach,
    scheduler,
    systemName: config.systemName,
    promptVersion: config.promptVersion,
    logger
  });

  const persistScheduler = async (): Promise<void> => {
    const nextState = await store.read();
    nextState.scheduler = scheduler.export();
    await store.write(nextState);
  };

  await persistScheduler();

  await sdk.startWatching({
    onDirectMessage: async (message) => {
      try {
        const reply = await agent.handleMessage(message);
        if (!reply) {
          return;
        }

        logger.info('reply_ready', {
          sender: message.sender,
          guid: message.guid,
          dryRun: config.dryRun
        });

        if (config.dryRun) {
          logger.info('dry_run_reply', {
            sender: message.sender,
            reply
          });
          return;
        }

        await sdk.send(message.sender, reply);
        await persistScheduler();
      } catch (error) {
        logger.error('message_handler_error', {
          sender: message.sender,
          guid: message.guid,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
    onError: (error) => {
      logger.error('watcher_error', {
        error: error.message
      });
    }
  });

  logger.info('watcher_started', {
    systemName: config.systemName,
    databaseFile: config.databaseFile,
    promptVersion: config.promptVersion,
    dryRun: config.dryRun
  });

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
  const logger = new Logger();
  logger.error('fatal_error', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  process.exit(1);
});
