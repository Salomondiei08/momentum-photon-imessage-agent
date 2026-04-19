import { MessageScheduler, type Message } from '@photon-ai/imessage-kit';

import { parseCommand, parseDailyTime, nextOccurrence } from './parser.js';
import type {
  AgentState,
  Coach,
  CoachIntent,
  GoalRecord,
  JournalEntry,
  MemoryStore,
  PersonProfile
} from './types.js';
import { createId, nowIso } from './utils.js';

interface RuntimeServices {
  store: MemoryStore;
  coach: Coach;
  scheduler: MessageScheduler;
  systemName: string;
  persistScheduler: () => Promise<void>;
}

/**
 * Coordinates command parsing, persistence, and coach replies for iMessage input.
 */
export class MomentumAgent {
  constructor(private readonly services: RuntimeServices) {}

  /**
   * Handles one incoming message and returns the text reply to send.
   */
  public async handleMessage(message: Message): Promise<string | null> {
    if (message.isFromMe || message.isReaction) {
      return null;
    }

    const incomingText = message.text?.trim();
    if (!incomingText) {
      return 'I work best with text. Try "goal run three times this week" or "stuck avoiding outreach".';
    }

    const state = await this.services.store.read();
    const profile = this.getOrCreateProfile(state, message);
    const command = parseCommand(incomingText);

    switch (command.type) {
      case 'help':
        return this.helpText();
      case 'goal':
        return this.handleGoal(state, profile, command.value);
      case 'priority':
        return this.handlePriority(state, profile, command.value);
      case 'done':
        return this.handleDone(state, profile, command.value);
      case 'status':
        return this.handleStatus(state, profile);
      case 'nudge':
        return this.handleNudge(state, profile, command.time);
      case 'stuck':
        return this.handleCoach(state, profile, command.value ?? incomingText, 'stuck', 'stuck');
      case 'chat':
        return this.handleCoach(state, profile, command.value ?? incomingText, this.inferIntent(incomingText), 'note');
      default:
        return this.helpText();
    }
  }

  private getOrCreateProfile(state: AgentState, message: Message): PersonProfile {
    const existing = state.profiles[message.sender];
    if (existing) {
      if (!existing.displayName && message.senderName) {
        existing.displayName = message.senderName;
      }
      return existing;
    }

    const created: PersonProfile = {
      sender: message.sender,
      displayName: message.senderName ?? undefined,
      activeGoalIds: []
    };
    state.profiles[message.sender] = created;
    return created;
  }

  private async handleGoal(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    if (!value) {
      return 'Send "goal ..." with the thing you want me to keep you accountable for.';
    }

    const goal: GoalRecord = {
      id: createId('goal'),
      text: value,
      createdAt: nowIso()
    };

    state.goals[goal.id] = goal;
    profile.activeGoalIds = [goal.id];
    this.pushEntry(state, profile.sender, 'goal', value);
    await this.services.store.write(state);

    return `Locked in: ${value}. I’ll treat that as your main goal until you change it.`;
  }

  private async handlePriority(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    if (!value) {
      return 'Send "priority ..." with the one thing you want to move today.';
    }

    profile.lastPriority = value;
    profile.lastCheckInAt = nowIso();
    this.pushEntry(state, profile.sender, 'check-in', value);
    await this.services.store.write(state);

    return `Today’s priority is ${value}. I’ll remember that when you text back later.`;
  }

  private async handleDone(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    const text = value ?? 'made progress';
    return this.handleCoach(state, profile, text, 'celebrate', 'win');
  }

  private async handleStatus(state: AgentState, profile: PersonProfile): Promise<string> {
    const goals = this.activeGoals(state, profile);
    const goalLine = goals.length > 0 ? goals.map((goal) => goal.text).join('; ') : 'No active goal yet';
    const priorityLine = profile.lastPriority ?? 'No priority logged yet';
    const nudgeLine = profile.nudgeTime ? `Daily nudge at ${profile.nudgeTime}` : 'No daily nudge set';

    return [`Goal: ${goalLine}`, `Priority: ${priorityLine}`, `Nudge: ${nudgeLine}`].join('\n');
  }

  private async handleNudge(state: AgentState, profile: PersonProfile, time?: string): Promise<string> {
    if (!time) {
      return 'Send "nudge 8am" or "nudge 18:30" and I’ll set a daily accountability text.';
    }

    const parsed = parseDailyTime(time);
    if (!parsed) {
      return 'I could not read that time. Try "nudge 8am" or "nudge 18:30".';
    }

    if (profile.nudgeScheduleId) {
      this.services.scheduler.cancel(profile.nudgeScheduleId);
    }

    const goal = this.activeGoals(state, profile)[0]?.text ?? 'your goal';
    const scheduleId = this.services.scheduler.scheduleRecurring({
      to: profile.sender,
      content: `Daily check-in: what is the next concrete move for ${goal}?`,
      startAt: nextOccurrence(parsed.hour, parsed.minute),
      interval: 'daily'
    });

    profile.nudgeTime = parsed.label;
    profile.nudgeScheduleId = scheduleId;
    this.pushEntry(state, profile.sender, 'nudge', parsed.label);
    state.scheduler = this.services.scheduler.export();
    await this.services.store.write(state);

    return `Daily nudge set for ${parsed.label}.`;
  }

  private async handleCoach(
    state: AgentState,
    profile: PersonProfile,
    value: string,
    intent: CoachIntent,
    journalKind: JournalEntry['kind']
  ): Promise<string> {
    this.pushEntry(state, profile.sender, journalKind, value);
    profile.lastCheckInAt = nowIso();
    await this.services.store.write(state);

    const reply = await this.services.coach.reply({
      profile,
      activeGoals: this.activeGoals(state, profile),
      recentEntries: state.journal.filter((entry) => entry.sender === profile.sender).slice(-6),
      latestMessage: value,
      intent
    });

    return reply;
  }

  private helpText(): string {
    return [
      `${this.services.systemName} keeps you honest by text.`,
      'Try: "goal ...", "priority ...", "done ...", "stuck ...", "nudge 8am", or "status".'
    ].join('\n');
  }

  private activeGoals(state: AgentState, profile: PersonProfile): GoalRecord[] {
    return profile.activeGoalIds
      .map((goalId) => state.goals[goalId])
      .filter((goal): goal is GoalRecord => Boolean(goal && !goal.completedAt));
  }

  private inferIntent(text: string): CoachIntent {
    const lower = text.toLowerCase();

    if (lower.includes('stuck') || lower.includes('blocked') || lower.includes('avoid')) {
      return 'stuck';
    }
    if (lower.includes('done') || lower.includes('finished') || lower.includes('won')) {
      return 'celebrate';
    }
    if (lower.includes('today') || lower.includes('plan') || lower.includes('priority')) {
      return 'planning';
    }
    if (lower.includes('check in') || lower.includes('good morning')) {
      return 'check-in';
    }
    return 'general';
  }

  private pushEntry(state: AgentState, sender: string, kind: JournalEntry['kind'], text: string): void {
    state.journal.push({
      id: createId('entry'),
      sender,
      kind,
      text,
      createdAt: nowIso()
    });
    state.journal = state.journal.slice(-200);
  }
}
