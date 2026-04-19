# Momentum

> The accountability coach you text like a friend when you need to follow through.

Momentum is an iMessage-native agent built with Photon. You text it a goal, today’s priority, or where you are stuck, and it replies with context-aware coaching that remembers what you said last time.

## Why this works

- Personal utility: this is something you can actually text tomorrow morning.
- Conversation-native: no web app, no dashboard, no extra UI, just Messages.
- Explainable in one sentence: "It is an accountability coach that keeps the thread going over text."

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Messaging | `@photon-ai/imessage-kit` | Native iMessage read/send/watch flow on macOS |
| Runtime | Node.js + TypeScript | Fast local iteration with strict typing |
| Memory | Local JSON store | Lightweight persistence for goals, check-ins, and nudges |
| Coaching | OpenAI Responses API | More human, contextual replies when `OPENAI_API_KEY` is set |
| Fallback | Deterministic coach logic | Useful even without a model key |
| Testing | Jest + `ts-jest` | Focused coverage for parser and agent behavior |

## Agent Card

| Field | Value |
| --- | --- |
| Name | `Momentum` |
| Category | Personal utility |
| Interface | iMessage only |
| Core job | Keep someone accountable to one active goal |
| Best use | Morning check-ins, daily priority setting, stuck moments |
| Memory | Goal, recent check-ins, wins, daily nudge time |
| One-line pitch | "Text Momentum your goal and it keeps nudging you forward." |

## What it can do

- Track a user’s current goal
- Remember today’s priority
- Respond to wins and stuck moments with coaching
- Send a recurring daily nudge like `nudge 8am`
- Keep context from previous messages so the conversation feels continuous
- Run without OpenAI, then upgrade gracefully when a key is added

## Sample Conversation

```text
You: goal ship my portfolio refresh
Momentum: Locked in: ship my portfolio refresh. I’ll treat that as your main goal until you change it.

You: priority finish the case study outline
Momentum: Today’s priority is finish the case study outline. I’ll remember that when you text back later.

You: stuck avoiding outreach because I do not know what to say
Momentum: Start smaller than your brain wants. Draft one ugly message to one person and send it before you edit it into oblivion. Want me to help you write that first line?

You: nudge 8am
Momentum: Daily nudge set for 08:00.
```

## Commands

- `goal ship my portfolio refresh`
- `priority finish the case study outline`
- `done sent the draft`
- `stuck avoiding outreach because I do not know what to say`
- `nudge 8am`
- `status`
- `help`

Anything else is treated as a normal conversational message and routed through the coach with recent memory attached.

## Project Structure

```text
src/
  index.ts               Photon watcher entrypoint
  momentum-agent.ts      Command handling + coaching orchestration
  coach.ts               OpenAI-backed and fallback coaching
  parser.ts              Text command parsing
  store/file-store.ts    Local JSON persistence
__tests__/
  parser.test.ts
  momentum-agent.test.ts
```

## Setup

1. Install dependencies.

```bash
npm install
```

2. Give your terminal or IDE Full Disk Access on macOS so Photon can access the Messages database.

3. Create a local env file.

```bash
cp .env.example .env
```

4. Add your settings.

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
AGENT_NAME=Momentum
```

5. Build and start the agent.

```bash
npm run build
npm start
```

## Development

```bash
npm test
npm run dev
```

## Validation

- `npm test`
- `npm run build`

## Notes

- This project is intentionally text-first and has no companion UI.
- Scheduler state is persisted alongside the rest of the local memory.
- Without `OPENAI_API_KEY`, the agent still works using the fallback coach.
