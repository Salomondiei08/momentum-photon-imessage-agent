import type { RecurringMessage, ScheduledMessage } from '@photon-ai/imessage-kit';

export type CoachIntent =
  | 'check-in'
  | 'stuck'
  | 'celebrate'
  | 'planning'
  | 'review'
  | 'reflection'
  | 'general';

export type AgentMode = 'coach' | 'planner' | 'review';
export type AccountabilityStyle = 'gentle' | 'strict' | 'tactical';
export type OnboardingStep = 'goal' | 'nudge' | 'style' | 'priority' | 'complete';

export interface GoalRecord {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
  completedAt?: string;
}

export interface JournalEntry {
  id: string;
  sender: string;
  kind:
    | 'goal'
    | 'check-in'
    | 'win'
    | 'stuck'
    | 'note'
    | 'nudge'
    | 'reflection'
    | 'weekly-recap'
    | 'onboarding'
    | 'promise'
    | 'mode'
    | 'style';
  text: string;
  createdAt: string;
}

export interface PersonProfile {
  sender: string;
  displayName?: string;
  activeGoalIds: string[];
  onboardingStep: OnboardingStep;
  mode: AgentMode;
  accountabilityStyle: AccountabilityStyle;
  nudgeTime?: string;
  eveningReflectionTime?: string;
  weeklyReviewTime?: string;
  morningScheduleId?: string;
  eveningScheduleId?: string;
  weeklyReviewScheduleId?: string;
  lastPriority?: string;
  lastPromise?: string;
  lastPromiseAt?: string;
  lastCheckInAt?: string;
  lastDoneAt?: string;
  lastReflectionAt?: string;
  streakCount: number;
  bestStreak: number;
  lastWinDate?: string;
  promptVersion: string;
}

export interface ProcessedMessageRecord {
  guid: string;
  sender: string;
  receivedAt: string;
}

export interface AgentState {
  goals: Record<string, GoalRecord>;
  profiles: Record<string, PersonProfile>;
  journal: JournalEntry[];
  processedMessages: ProcessedMessageRecord[];
  promptVersion: string;
  scheduler?: {
    scheduled: ScheduledMessage[];
    recurring: RecurringMessage[];
  };
}

export interface ParsedCommand {
  type:
    | 'help'
    | 'goal'
    | 'done'
    | 'stuck'
    | 'priority'
    | 'status'
    | 'nudge'
    | 'mode'
    | 'style'
    | 'recap'
    | 'reflect'
    | 'promise'
    | 'chat';
  value?: string;
  time?: string;
  mode?: AgentMode;
  style?: AccountabilityStyle;
}

export interface BehaviorSignals {
  procrastinationPattern: boolean;
  unfinishedPromise?: string;
  streakAtRisk: boolean;
  recentWins: number;
}

export interface CoachContext {
  profile: PersonProfile;
  activeGoals: GoalRecord[];
  recentEntries: JournalEntry[];
  latestMessage: string;
  intent: CoachIntent;
  signals: BehaviorSignals;
  weeklySummary?: string;
}

export interface WeeklySummaryContext {
  profile: PersonProfile;
  activeGoals: GoalRecord[];
  recentEntries: JournalEntry[];
  signals: BehaviorSignals;
  baseSummary: string;
}

export interface Coach {
  reply(context: CoachContext): Promise<string>;
  summarizeWeekly(context: WeeklySummaryContext): Promise<string>;
}

export interface MemoryStore {
  read(): Promise<AgentState>;
  write(state: AgentState): Promise<void>;
}
