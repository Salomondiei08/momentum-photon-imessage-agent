# Momentum

> An iMessage-native accountability agent that remembers your commitments, checks in automatically, and pushes you toward the next concrete move.

Momentum is a more serious Photon prototype now. It onboards users by text, stores durable memory in SQLite, schedules morning and evening routines, tracks streaks and unfinished promises, and uses OpenAI when available without depending on it to remain useful.

## One-Line Pitch

`Momentum is the accountability coach you can text like a friend, and it actually remembers what you promised.`

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Messaging | `@photon-ai/imessage-kit` | Native iMessage send/read/watch flow on macOS |
| Runtime | Node.js + TypeScript | Strict local development and simple deployment story |
| Persistence | `better-sqlite3` | Durable local storage for profiles, goals, journal history, scheduler state, and dedupe records |
| AI | OpenAI Responses API | Sharper, memory-aware coaching with retry and fallback |
| Scheduling | Photon `MessageScheduler` | Daily check-ins, evening reflections, and Sunday recap prompts |
| Testing | Jest + `ts-jest` | Fast verification of onboarding, parsing, duplicate protection, and persistence |

## Product Card

| Field | Value |
| --- | --- |
| Name | `Momentum` |
| Category | Personal utility |
| Interface | iMessage only |
| Best user | Someone trying to follow through on one important goal |
| Core promise | Turn vague intention into recurring accountability over text |
| Modes | `coach`, `planner`, `review` |
| Styles | `gentle`, `strict`, `tactical` |
| Durable memory | Goals, priorities, promises, reflections, streaks, scheduler state, processed message IDs |

## What Makes It Serious

- Text-based onboarding flow for first-time users
- SQLite-backed persistence instead of a JSON prototype file
- Duplicate-message protection using stored iMessage GUIDs
- Daily morning check-ins, evening reflections, and Sunday weekly recap prompts
- Streak tracking and best-streak tracking
- Last-promise tracking so unfinished commitments stay visible
- Procrastination-pattern detection from recent behavior
- OpenAI retry logic with deterministic fallback if the model call fails
- Structured JSON logging for runtime events
- `--dry-run` and `--healthcheck` modes for safer verification
- Prompt version tracking so behavior changes are explicit

## Conversation Flow

### Onboarding

```text
You: I want to finally ship my portfolio
Momentum: Locked in: I want to finally ship my portfolio. What time should I nudge you every morning?

You: 8am
Momentum: Perfect. I’ll check in at 08:00. Do you want accountability that is gentle, strict, or tactical?

You: tactical
Momentum: Set to tactical. Last onboarding step: what is today’s priority?

You: finish the hero case study
Momentum: You’re set. Today’s priority is finish the hero case study. I’ll keep the thread going from here.
```

### Ongoing Use

```text
You: stuck avoiding outreach
Momentum: Quick truth: you have been circling this without a win. Send one ugly outreach message in the next 15 minutes, then text me "done sent one".

You: done sent one
Momentum: Count that as real progress. Keep the streak alive by naming the next action before the day ends.
```

## Commands

- `goal ship my portfolio refresh`
- `priority finish the case study outline`
- `promise send two outreach messages`
- `done sent the draft`
- `stuck avoiding outreach`
- `reflect I overplanned and under-shipped`
- `nudge 8am`
- `mode planner`
- `style strict`
- `recap`
- `status`
- `help`

Anything else is treated as conversation and passed through the coaching layer with memory and behavior signals attached.

## Architecture

```text
src/
  index.ts                 Runtime entrypoint + dry-run/healthcheck support
  momentum-agent.ts        Onboarding, command routing, streaks, routines, duplicate protection
  coach.ts                 OpenAI-backed coach with retry + fallback coach
  logger.ts                Structured JSON logger
  parser.ts                Text command parsing helpers
  store/sqlite-store.ts    SQLite persistence for profiles, goals, journal, meta, processed GUIDs
__tests__/
  momentum-agent.test.ts   Onboarding, dedupe, weekly recap
  parser.test.ts           Command/time parsing
  sqlite-store.test.ts     Restart-safe persistence
```

## Setup

1. Install dependencies.

```bash
npm install
```

2. Give your terminal or IDE Full Disk Access on macOS so Photon can read the Messages database.

3. Create your env file.

```bash
cp .env.example .env
```

4. Configure it.

```bash
OPENAI_API_KEY=your_rotated_key_here
OPENAI_MODEL=gpt-4.1-mini
AGENT_NAME=Momentum
MOMENTUM_DB_FILE=./data/momentum.sqlite
PROMPT_VERSION=2026-04-19-serious-v1
```

## Run Modes

Build first:

```bash
npm run build
```

Live mode:

```bash
npm start
```

Dry-run mode:

```bash
npm run dry-run
```

Health check:

```bash
npm run healthcheck
```

## Validation

- `npm test`
- `npm run build`

## Notes

- Without `OPENAI_API_KEY`, Momentum still works using the fallback coach.
- Scheduler state is persisted in SQLite alongside user memory.
- The app is intentionally text-first: no companion UI, no dashboard, no setup screen.
- If an API key was pasted into chat or committed anywhere, rotate it before using the project.
