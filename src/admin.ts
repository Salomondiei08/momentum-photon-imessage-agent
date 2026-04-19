import 'dotenv/config';

import { loadConfig } from './config.js';
import { SqliteMemoryStore } from './store/sqlite-store.js';

function formatSender(sender: string, displayName?: string): string {
  return displayName ? `${displayName} (${sender})` : sender;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new SqliteMemoryStore(config.databaseFile);
  const state = await store.read();
  const [, , command = 'users', senderArg] = process.argv;

  if (command === 'users') {
    const profiles = Object.values(state.profiles);
    if (profiles.length === 0) {
      console.log('No users found.');
      return;
    }

    for (const profile of profiles) {
      const activeGoals = profile.activeGoalIds
        .map((goalId) => state.goals[goalId]?.text)
        .filter(Boolean)
        .join('; ');
      console.log(
        [
          formatSender(profile.sender, profile.displayName),
          `goal=${activeGoals || 'none'}`,
          `priority=${profile.lastPriority ?? 'none'}`,
          `promise=${profile.lastPromise ?? 'none'}`,
          `streak=${profile.streakCount}`,
          `mode=${profile.mode}`,
          `style=${profile.accountabilityStyle}`
        ].join(' | ')
      );
    }
    return;
  }

  if (!senderArg) {
    console.log('Usage: npm run admin -- users');
    console.log('Usage: npm run admin -- profile <sender>');
    console.log('Usage: npm run admin -- recent <sender>');
    return;
  }

  const profile = state.profiles[senderArg];
  if (!profile) {
    console.log(`No profile found for ${senderArg}`);
    return;
  }

  if (command === 'profile') {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  if (command === 'recent') {
    const recent = state.journal.filter((entry) => entry.sender === senderArg).slice(-20);
    console.log(JSON.stringify(recent, null, 2));
    return;
  }

  console.log(`Unknown command: ${command}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown admin error');
  process.exit(1);
});
