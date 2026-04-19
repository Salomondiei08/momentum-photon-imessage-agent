import type { RecurringMessage, ScheduledMessage } from '@photon-ai/imessage-kit';

/**
 * A high-level coaching category used to shape responses.
 */
export type CoachIntent = 'check-in' | 'stuck' | 'celebrate' | 'planning' | 'general';

/**
 * A stored goal for a single sender.
 */
export interface GoalRecord {
  id: string;
  text: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * A lightweight conversation memory item.
 */
export interface JournalEntry {
  id: string;
  sender: string;
  kind: 'goal' | 'check-in' | 'win' | 'stuck' | 'note' | 'nudge';
  text: string;
  createdAt: string;
}

/**
 * A sender's current profile and preferences.
 */
export interface PersonProfile {
  sender: string;
  displayName?: string;
  activeGoalIds: string[];
  nudgeTime?: string;
  nudgeScheduleId?: string;
  lastPriority?: string;
  lastCheckInAt?: string;
}

/**
 * Persisted agent state.
 */
export interface AgentState {
  goals: Record<string, GoalRecord>;
  profiles: Record<string, PersonProfile>;
  journal: JournalEntry[];
  scheduler?: {
    scheduled: ScheduledMessage[];
    recurring: RecurringMessage[];
  };
}

/**
 * Parsed user input for the accountability agent.
 */
export interface ParsedCommand {
  type:
    | 'help'
    | 'goal'
    | 'done'
    | 'stuck'
    | 'priority'
    | 'status'
    | 'nudge'
    | 'chat';
  value?: string;
  time?: string;
}

/**
 * Context passed into the coach for richer memory-aware replies.
 */
export interface CoachContext {
  profile: PersonProfile;
  activeGoals: GoalRecord[];
  recentEntries: JournalEntry[];
  latestMessage: string;
  intent: CoachIntent;
}

/**
 * Contract used by the agent to generate memory-aware coaching replies.
 */
export interface Coach {
  reply(context: CoachContext): Promise<string>;
}

/**
 * Shared store contract for testing and runtime.
 */
export interface MemoryStore {
  read(): Promise<AgentState>;
  write(state: AgentState): Promise<void>;
}
