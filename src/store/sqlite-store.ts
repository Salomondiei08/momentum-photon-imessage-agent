import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import type { AgentState, GoalRecord, JournalEntry, MemoryStore, PersonProfile, ProcessedMessageRecord } from '../types.js';

const EMPTY_STATE: AgentState = {
  goals: {},
  profiles: {},
  journal: [],
  processedMessages: [],
  promptVersion: 'unknown'
};

/**
 * SQLite-backed persistence for user profiles, goals, journal entries, and scheduler state.
 */
export class SqliteMemoryStore implements MemoryStore {
  private readonly db: Database.Database;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  public async read(): Promise<AgentState> {
    const profiles = this.db.prepare('SELECT sender, json FROM profiles').all() as Array<{
      sender: string;
      json: string;
    }>;
    const goals = this.db.prepare('SELECT id, json FROM goals').all() as Array<{ id: string; json: string }>;
    const journal = this.db
      .prepare('SELECT json FROM journal_entries ORDER BY created_at ASC')
      .all() as Array<{ json: string }>;
    const processed = this.db
      .prepare('SELECT guid, sender, received_at FROM processed_messages ORDER BY received_at DESC LIMIT 500')
      .all() as Array<{ guid: string; sender: string; received_at: string }>;
    const schedulerRow = this.db
      .prepare("SELECT value FROM meta WHERE key = 'scheduler'")
      .get() as { value: string } | undefined;
    const promptVersionRow = this.db
      .prepare("SELECT value FROM meta WHERE key = 'promptVersion'")
      .get() as { value: string } | undefined;

    return {
      profiles: Object.fromEntries(
        profiles.map((row) => [row.sender, JSON.parse(row.json) as PersonProfile])
      ),
      goals: Object.fromEntries(goals.map((row) => [row.id, JSON.parse(row.json) as GoalRecord])),
      journal: journal.map((row) => JSON.parse(row.json) as JournalEntry),
      processedMessages: processed.map(
        (row) =>
          ({
            guid: row.guid,
            sender: row.sender,
            receivedAt: row.received_at
          }) satisfies ProcessedMessageRecord
      ),
      promptVersion: promptVersionRow?.value ?? EMPTY_STATE.promptVersion,
      scheduler: schedulerRow ? (JSON.parse(schedulerRow.value) as AgentState['scheduler']) : undefined
    };
  }

  public async write(state: AgentState): Promise<void> {
    const transaction = this.db.transaction((nextState: AgentState) => {
      this.db.prepare('DELETE FROM profiles').run();
      this.db.prepare('DELETE FROM goals').run();
      this.db.prepare('DELETE FROM journal_entries').run();
      this.db.prepare('DELETE FROM processed_messages').run();

      const insertProfile = this.db.prepare(
        'INSERT INTO profiles (sender, json, updated_at) VALUES (@sender, @json, @updatedAt)'
      );
      const insertGoal = this.db.prepare(
        'INSERT INTO goals (id, sender, json, created_at) VALUES (@id, @sender, @json, @createdAt)'
      );
      const insertJournal = this.db.prepare(
        'INSERT INTO journal_entries (id, sender, kind, created_at, json) VALUES (@id, @sender, @kind, @createdAt, @json)'
      );
      const insertProcessed = this.db.prepare(
        'INSERT INTO processed_messages (guid, sender, received_at) VALUES (@guid, @sender, @receivedAt)'
      );
      const upsertMeta = this.db.prepare(
        'INSERT INTO meta (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );

      for (const profile of Object.values(nextState.profiles)) {
        insertProfile.run({
          sender: profile.sender,
          json: JSON.stringify(profile),
          updatedAt: new Date().toISOString()
        });
      }

      for (const goal of Object.values(nextState.goals)) {
        insertGoal.run({
          id: goal.id,
          sender: goal.sender,
          json: JSON.stringify(goal),
          createdAt: goal.createdAt
        });
      }

      for (const entry of nextState.journal.slice(-1000)) {
        insertJournal.run({
          id: entry.id,
          sender: entry.sender,
          kind: entry.kind,
          createdAt: entry.createdAt,
          json: JSON.stringify(entry)
        });
      }

      for (const record of nextState.processedMessages.slice(0, 500)) {
        insertProcessed.run(record);
      }

      upsertMeta.run({
        key: 'scheduler',
        value: JSON.stringify(nextState.scheduler ?? { scheduled: [], recurring: [] })
      });
      upsertMeta.run({
        key: 'promptVersion',
        value: nextState.promptVersion
      });
    });

    transaction(state);
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        sender TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processed_messages (
        guid TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        received_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
}
