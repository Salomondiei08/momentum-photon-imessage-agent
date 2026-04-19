import { MessageScheduler, type Message } from '@photon-ai/imessage-kit';

import { Logger } from './logger.js';
import { nextOccurrence, parseCommand, parseDailyTime, parseMode, parseStyle } from './parser.js';
import type {
  AccountabilityStyle,
  AgentMode,
  AgentState,
  BehaviorSignals,
  Coach,
  CoachIntent,
  GoalRecord,
  JournalEntry,
  MemoryStore,
  PersonProfile
} from './types.js';
import { addHours, createId, dayKey, nextWeekdayOccurrence, nowIso } from './utils.js';

interface RuntimeServices {
  store: MemoryStore;
  coach: Coach;
  scheduler: MessageScheduler;
  systemName: string;
  promptVersion: string;
  logger: Logger;
}

export class MomentumAgent {
  constructor(private readonly services: RuntimeServices) {}

  public async handleMessage(message: Message): Promise<string | null> {
    if (message.isFromMe || message.isReaction) {
      return null;
    }

    const incomingText = message.text?.trim();
    if (!incomingText) {
      return 'I work best with text. Tell me your goal, priority, or where you are stuck.';
    }

    const state = await this.services.store.read();
    if (state.processedMessages.some((record) => record.guid === message.guid)) {
      this.services.logger.info('duplicate_message_skipped', {
        guid: message.guid,
        sender: message.sender
      });
      return null;
    }

    state.promptVersion = this.services.promptVersion;
    const profile = this.getOrCreateProfile(state, message);
    const command = parseCommand(incomingText);

    this.markProcessed(state, message);

    let reply: string;
    if (profile.onboardingStep !== 'complete' && command.type !== 'help' && command.type !== 'status') {
      reply = await this.handleOnboarding(state, profile, incomingText, command);
    } else {
      switch (command.type) {
        case 'help':
          reply = this.helpText();
          break;
        case 'goal':
          reply = await this.handleGoal(state, profile, command.value);
          break;
        case 'priority':
          reply = await this.handlePriority(state, profile, command.value);
          break;
        case 'promise':
          reply = await this.handlePromise(state, profile, command.value);
          break;
        case 'done':
          reply = await this.handleDone(state, profile, command.value);
          break;
        case 'status':
          reply = this.handleStatus(state, profile);
          break;
        case 'nudge':
          reply = await this.handleNudge(state, profile, command.time);
          break;
        case 'mode':
          reply = await this.handleMode(state, profile, command.mode);
          break;
        case 'style':
          reply = await this.handleStyle(state, profile, command.style);
          break;
        case 'recap':
          reply = this.buildWeeklySummary(state, profile);
          break;
        case 'reflect':
          reply = await this.handleReflection(state, profile, command.value);
          break;
        case 'stuck':
          reply = await this.handleCoach(state, profile, command.value ?? incomingText, 'stuck', 'stuck');
          break;
        case 'chat':
        default:
          reply = await this.handleCoach(
            state,
            profile,
            command.value ?? incomingText,
            this.inferIntent(incomingText),
            'note'
          );
          break;
      }
    }

    await this.services.store.write(state);
    return reply;
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
      activeGoalIds: [],
      onboardingStep: 'goal',
      mode: 'coach',
      accountabilityStyle: 'tactical',
      streakCount: 0,
      bestStreak: 0,
      promptVersion: this.services.promptVersion
    };
    state.profiles[message.sender] = created;
    return created;
  }

  private async handleOnboarding(
    state: AgentState,
    profile: PersonProfile,
    incomingText: string,
    command: ReturnType<typeof parseCommand>
  ): Promise<string> {
    if (profile.onboardingStep === 'goal') {
      const goalText = command.type === 'goal' ? command.value : incomingText;
      if (!goalText) {
        return 'What is the main goal you want me to keep you accountable for?';
      }

      await this.setGoal(state, profile, goalText);
      profile.onboardingStep = 'nudge';
      this.pushEntry(state, profile.sender, 'onboarding', 'Collected initial goal');
      return `Locked in: ${goalText}. What time should I nudge you every morning? Reply with something like "8am".`;
    }

    if (profile.onboardingStep === 'nudge') {
      const rawTime = command.type === 'nudge' ? command.time : incomingText;
      const parsed = rawTime ? parseDailyTime(rawTime) : null;
      if (!parsed) {
        return 'Give me a daily check-in time like "8am" or "18:30".';
      }

      this.scheduleRoutines(state, profile, parsed.hour, parsed.minute);
      profile.nudgeTime = parsed.label;
      profile.onboardingStep = 'style';
      this.pushEntry(state, profile.sender, 'onboarding', `Set morning routine ${parsed.label}`);
      return `Perfect. I’ll check in at ${parsed.label}. Do you want accountability that is gentle, strict, or tactical?`;
    }

    if (profile.onboardingStep === 'style') {
      const style = command.type === 'style' ? command.style : parseStyle(incomingText);
      if (!style) {
        return 'Pick one style: gentle, strict, or tactical.';
      }

      profile.accountabilityStyle = style;
      profile.onboardingStep = 'priority';
      this.pushEntry(state, profile.sender, 'style', style);
      return `Set to ${style}. Last onboarding step: what is today’s priority?`;
    }

    const priorityText = command.type === 'priority' ? command.value : incomingText;
    if (!priorityText) {
      return 'What is the one thing you want to move today?';
    }

    this.applyPriority(profile, priorityText);
    profile.onboardingStep = 'complete';
    this.pushEntry(state, profile.sender, 'check-in', priorityText);
    return `You’re set. Today’s priority is ${priorityText}. I’ll keep the thread going from here.`;
  }

  private async handleGoal(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    if (!value) {
      return 'Send "goal ..." with the thing you want me to keep you accountable for.';
    }

    await this.setGoal(state, profile, value);
    return `Locked in: ${value}. I’ll treat that as your main goal until you change it.`;
  }

  private async setGoal(state: AgentState, profile: PersonProfile, value: string): Promise<void> {
    const goal: GoalRecord = {
      id: createId('goal'),
      sender: profile.sender,
      text: value,
      createdAt: nowIso()
    };

    for (const active of this.activeGoals(state, profile)) {
      active.completedAt = nowIso();
    }

    state.goals[goal.id] = goal;
    profile.activeGoalIds = [goal.id];
    this.pushEntry(state, profile.sender, 'goal', value);
  }

  private async handlePriority(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    if (!value) {
      return 'Send "priority ..." with the one thing you want to move today.';
    }

    this.applyPriority(profile, value);
    this.pushEntry(state, profile.sender, 'check-in', value);
    return `Today’s priority is ${value}. I’ll use that as your promise unless you set a new one.`;
  }

  private async handlePromise(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    if (!value) {
      return 'Send "promise ..." with the commitment you want me to hold onto.';
    }

    profile.lastPromise = value;
    profile.lastPromiseAt = nowIso();
    this.pushEntry(state, profile.sender, 'promise', value);
    return `Promise logged: ${value}. I’ll follow up on it.`;
  }

  private async handleDone(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    const text = value?.trim() ? value : profile.lastPromise ?? profile.lastPriority ?? 'made progress';
    profile.lastDoneAt = nowIso();
    this.bumpStreak(profile);
    this.pushEntry(state, profile.sender, 'win', text);
    return this.handleCoach(state, profile, text, 'celebrate', 'win');
  }

  private handleStatus(state: AgentState, profile: PersonProfile): string {
    const goals = this.activeGoals(state, profile);
    const goalLine = goals.length > 0 ? goals.map((goal) => goal.text).join('; ') : 'No active goal yet';
    const priorityLine = profile.lastPriority ?? 'No priority logged yet';
    const promiseLine = profile.lastPromise ?? 'No active promise';
    const routines = profile.nudgeTime
      ? `Morning ${profile.nudgeTime}, evening ${profile.eveningReflectionTime}, weekly ${profile.weeklyReviewTime}`
      : 'No routines set';

    return [
      `Goal: ${goalLine}`,
      `Priority: ${priorityLine}`,
      `Promise: ${promiseLine}`,
      `Mode: ${profile.mode}`,
      `Style: ${profile.accountabilityStyle}`,
      `Streak: ${profile.streakCount} day(s), best ${profile.bestStreak}`,
      `Routines: ${routines}`,
      `Prompt version: ${profile.promptVersion}`
    ].join('\n');
  }

  private async handleNudge(state: AgentState, profile: PersonProfile, time?: string): Promise<string> {
    if (!time) {
      return 'Send "nudge 8am" or "nudge 18:30" and I’ll rebuild your daily routines.';
    }

    const parsed = parseDailyTime(time);
    if (!parsed) {
      return 'I could not read that time. Try "nudge 8am" or "nudge 18:30".';
    }

    this.scheduleRoutines(state, profile, parsed.hour, parsed.minute);
    profile.nudgeTime = parsed.label;
    this.pushEntry(state, profile.sender, 'nudge', parsed.label);
    return `Daily routines reset. Morning check-in at ${profile.nudgeTime}, evening reflection at ${profile.eveningReflectionTime}, weekly recap at ${profile.weeklyReviewTime}.`;
  }

  private async handleMode(state: AgentState, profile: PersonProfile, mode?: AgentMode): Promise<string> {
    if (!mode) {
      return 'Choose a mode with "mode coach", "mode planner", or "mode review".';
    }

    profile.mode = mode;
    this.pushEntry(state, profile.sender, 'mode', mode);
    return `Mode set to ${mode}.`;
  }

  private async handleStyle(
    state: AgentState,
    profile: PersonProfile,
    style?: AccountabilityStyle
  ): Promise<string> {
    if (!style) {
      return 'Choose a style with "style gentle", "style strict", or "style tactical".';
    }

    profile.accountabilityStyle = style;
    this.pushEntry(state, profile.sender, 'style', style);
    return `Style set to ${style}.`;
  }

  private async handleReflection(state: AgentState, profile: PersonProfile, value?: string): Promise<string> {
    const text = value ?? 'I reflected on the day.';
    profile.lastReflectionAt = nowIso();
    this.pushEntry(state, profile.sender, 'reflection', text);
    return this.handleCoach(state, profile, text, 'reflection', 'reflection');
  }

  private async handleCoach(
    state: AgentState,
    profile: PersonProfile,
    value: string,
    intent: CoachIntent,
    journalKind: JournalEntry['kind']
  ): Promise<string> {
    profile.lastCheckInAt = nowIso();
    profile.promptVersion = this.services.promptVersion;
    if (journalKind !== 'win') {
      this.pushEntry(state, profile.sender, journalKind, value);
    }

    return this.services.coach.reply({
      profile,
      activeGoals: this.activeGoals(state, profile),
      recentEntries: this.recentEntries(state, profile),
      latestMessage: value,
      intent,
      signals: this.computeSignals(state, profile),
      weeklySummary: intent === 'review' ? this.buildWeeklySummary(state, profile) : undefined
    });
  }

  private helpText(): string {
    return [
      `${this.services.systemName} is your text-only accountability agent.`,
      'Commands: "goal ...", "priority ...", "promise ...", "done ...", "stuck ...", "reflect ...", "nudge 8am", "mode planner", "style strict", "recap", "status".'
    ].join('\n');
  }

  private scheduleRoutines(state: AgentState, profile: PersonProfile, hour: number, minute: number): void {
    if (profile.morningScheduleId) {
      this.services.scheduler.cancel(profile.morningScheduleId);
    }
    if (profile.eveningScheduleId) {
      this.services.scheduler.cancel(profile.eveningScheduleId);
    }
    if (profile.weeklyReviewScheduleId) {
      this.services.scheduler.cancel(profile.weeklyReviewScheduleId);
    }

    const morning = nextOccurrence(hour, minute);
    const evening = addHours(new Date(morning), 12);
    const weekly = nextWeekdayOccurrence(0, 18, 0);
    const goal = this.activeGoals(state, profile)[0]?.text ?? 'your goal';

    profile.morningScheduleId = this.services.scheduler.scheduleRecurring({
      to: profile.sender,
      content: `Morning check-in: what is the next concrete move for ${goal}?`,
      startAt: morning,
      interval: 'daily'
    });

    profile.eveningScheduleId = this.services.scheduler.scheduleRecurring({
      to: profile.sender,
      content: `Evening reflection: what moved, what slipped, and what is tomorrow's first move for ${goal}?`,
      startAt: evening,
      interval: 'daily'
    });

    profile.weeklyReviewScheduleId = this.services.scheduler.scheduleRecurring({
      to: profile.sender,
      content: `Sunday recap: what did you actually finish this week, what kept stalling, and what is next week's one focus?`,
      startAt: weekly,
      interval: 'weekly'
    });

    profile.eveningReflectionTime = `${String(evening.getHours()).padStart(2, '0')}:${String(evening.getMinutes()).padStart(2, '0')}`;
    profile.weeklyReviewTime = 'Sun 18:00';
    state.scheduler = this.services.scheduler.export();
  }

  private applyPriority(profile: PersonProfile, value: string): void {
    profile.lastPriority = value;
    profile.lastPromise = value;
    profile.lastPromiseAt = nowIso();
    profile.lastCheckInAt = nowIso();
  }

  private buildWeeklySummary(state: AgentState, profile: PersonProfile): string {
    const weeklyEntries = this.recentEntries(state, profile).filter(
      (entry) => new Date(entry.createdAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000
    );
    const wins = weeklyEntries.filter((entry) => entry.kind === 'win');
    const stuck = weeklyEntries.filter((entry) => entry.kind === 'stuck');
    const reflections = weeklyEntries.filter((entry) => entry.kind === 'reflection');
    const goal = this.activeGoals(state, profile)[0]?.text ?? 'No active goal';

    return [
      `Weekly recap for ${goal}:`,
      `Wins: ${wins.length > 0 ? wins.map((entry) => entry.text).slice(-3).join('; ') : 'none logged'}`,
      `Stuck points: ${stuck.length > 0 ? stuck.map((entry) => entry.text).slice(-2).join('; ') : 'none logged'}`,
      `Reflections: ${reflections.length > 0 ? reflections.map((entry) => entry.text).slice(-2).join('; ') : 'none logged'}`,
      `Current streak: ${profile.streakCount} day(s), best ${profile.bestStreak}`,
      `Last promise: ${profile.lastPromise ?? 'none'}`
    ].join('\n');
  }

  private activeGoals(state: AgentState, profile: PersonProfile): GoalRecord[] {
    return profile.activeGoalIds
      .map((goalId) => state.goals[goalId])
      .filter((goal): goal is GoalRecord => Boolean(goal && !goal.completedAt));
  }

  private recentEntries(state: AgentState, profile: PersonProfile): JournalEntry[] {
    return state.journal.filter((entry) => entry.sender === profile.sender).slice(-12);
  }

  private computeSignals(state: AgentState, profile: PersonProfile): BehaviorSignals {
    const recentEntries = this.recentEntries(state, profile);
    const wins = recentEntries.filter((entry) => entry.kind === 'win').length;
    const frictionEntries = recentEntries.filter(
      (entry) =>
        entry.kind === 'stuck' ||
        (entry.kind === 'note' && /(later|tomorrow|avoid|procrastinat|stalled|blocked)/i.test(entry.text))
    );
    const lastPromiseTime = profile.lastPromiseAt ? new Date(profile.lastPromiseAt).getTime() : 0;
    const lastDoneTime = profile.lastDoneAt ? new Date(profile.lastDoneAt).getTime() : 0;

    return {
      procrastinationPattern: frictionEntries.length >= 2 && wins === 0,
      unfinishedPromise: lastPromiseTime > lastDoneTime ? profile.lastPromise : undefined,
      streakAtRisk: profile.lastWinDate ? dayKey(profile.lastWinDate) !== dayKey(new Date()) : true,
      recentWins: wins
    };
  }

  private inferIntent(text: string): CoachIntent {
    const lower = text.toLowerCase();

    if (lower.includes('stuck') || lower.includes('blocked') || lower.includes('avoid')) {
      return 'stuck';
    }
    if (lower.includes('done') || lower.includes('finished') || lower.includes('won')) {
      return 'celebrate';
    }
    if (lower.includes('reflect') || lower.includes('today felt')) {
      return 'reflection';
    }
    if (lower.includes('review') || lower.includes('recap')) {
      return 'review';
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
    state.journal = state.journal.slice(-1000);
  }

  private markProcessed(state: AgentState, message: Message): void {
    state.processedMessages = [
      {
        guid: message.guid,
        sender: message.sender,
        receivedAt: nowIso(message.date)
      },
      ...state.processedMessages.filter((record) => record.guid !== message.guid)
    ].slice(0, 500);
  }

  private bumpStreak(profile: PersonProfile): void {
    const today = dayKey(new Date());
    if (profile.lastWinDate === today) {
      return;
    }

    const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    profile.streakCount = profile.lastWinDate === yesterday ? profile.streakCount + 1 : 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streakCount);
    profile.lastWinDate = today;
  }
}
