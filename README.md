# Momentum

> An iMessage-native accountability agent that remembers your commitments, checks in automatically, and pushes you toward the next concrete move.

Momentum is a serious Photon prototype for personal accountability over iMessage. It onboards users by text, stores durable memory in SQLite, tracks goals and unfinished promises, runs scheduled morning and evening routines, generates weekly recaps, and can be inspected locally through an admin CLI.

## One-Line Pitch

`Momentum is the accountability coach you can text like a friend, and it actually remembers what you promised.`

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Messaging | `@photon-ai/imessage-kit` | Native iMessage send/read/watch flow on macOS |
| Runtime | Node.js + TypeScript | Strict local development with a simple operational setup |
| Persistence | `better-sqlite3` | Durable storage for profiles, goals, journal history, scheduler state, and dedupe records |
| AI | OpenAI Responses API | Sharper coaching replies and cleaner weekly summaries |
| Scheduling | Photon `MessageScheduler` | Daily check-ins, evening reflections, and Sunday recap prompts |
| Ops | Structured JSON logs + admin CLI | Easier debugging and local state inspection |
| Testing | Jest + `ts-jest` | Fast verification of onboarding, dedupe, summaries, and persistence |

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
- SQLite-backed persistence instead of a prototype JSON file
- Duplicate-message protection using stored iMessage GUIDs
- Daily morning check-ins, evening reflections, and Sunday recap prompts
- Streak tracking and best-streak tracking
- Last-promise tracking so unfinished commitments stay visible
- Stronger follow-up behavior when a promise is still open
- LLM-generated weekly recap output with deterministic fallback
- OpenAI retry logic with fallback coaching if the model call fails
- Structured JSON logging for runtime events
- `--dry-run` and `--healthcheck` support
- Local admin CLI for inspecting users and recent memory
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
You: promise send two outreach messages
Momentum: Promise logged: send two outreach messages. I’ll follow up on it.

You: good morning
Momentum: Quick truth: before you add something new, close the loop on your promise to send two outreach messages. What is the smallest version of that you can finish today?

You: recap
Momentum: This week you moved the portfolio case study forward, but outreach kept slipping. Best next focus: finish one outreach block early this week before adding new tasks.
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

## Operational Features

### Runtime modes

- `npm start` for the live iMessage watcher
- `npm run dry-run` to process messages without sending replies
- `npm run healthcheck` to validate config and local readiness

### Admin CLI

Inspect the SQLite-backed local state after building:

```bash
npm run admin -- users
npm run admin -- profile +15555550123
npm run admin -- recent +15555550123
```

## Architecture

```text
src/
  index.ts                 Runtime entrypoint + dry-run/healthcheck support
  admin.ts                 Local admin CLI for user/profile/journal inspection
  momentum-agent.ts        Onboarding, command routing, streaks, routines, dedupe
  coach.ts                 OpenAI-backed coach + fallback coach + weekly summaries
  logger.ts                Structured JSON logger
  parser.ts                Text command parsing helpers
  store/sqlite-store.ts    SQLite persistence for profiles, goals, journal, meta, processed GUIDs
__tests__/
  coach.test.ts
  momentum-agent.test.ts
  parser.test.ts
  sqlite-store.test.ts
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
PROMPT_VERSION=2026-04-19-serious-v2
```

## Run

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
