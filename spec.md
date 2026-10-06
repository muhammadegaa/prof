# profcareer: voice agent for becoming a solopreneur

Status: draft for approval. No code until approved.

## Goal
A phone app I talk to by voice to discuss, decide, execute and improve, so that I get my own revenue while keeping a stable 9-5. Progress is measured in money-ward events.

## User
Only me in v1. Invite-only, one account. The data model keeps a `userId` on every record so a second user is possible later, but no multi-user or billing code is built. Paid version: decided after 4 weeks of my own use.

## Status in NOW.md
This is a tool for running my bets, not a bet. Solo stays the active bet. Build time box: about 2 weeks. The app takes no money itself; its revenue effect comes from helping me get a stranger to pay on the active bet.

## Stack (decided in the prompt)
- Next.js App Router, TypeScript, Vercel, installable PWA for iPhone.
- Firebase free tier: Auth (email + password, invite list in Firestore), Firestore in `europe-west2`, Admin SDK only on the server, client rules deny everything.
- OpenRouter for LLM and speech-to-text. ElevenLabs for voice. Model and voice IDs are checked against live APIs before use (not verified yet).
- Web push for the daily check-in, triggered by a scheduled job.
- All settings from env vars with defaults in `lib/config.ts`, documented in `.env.example`.

## Features

### Talk
Hands-free turn taking: the app detects when I stop speaking, transcribes, sends to the LLM, and speaks the reply. A setting switches to hold-to-talk if hands-free misbehaves on iOS. Every spoken turn also appears as text.

### Discuss
Each conversation gets: my goal, the active bet, the last 10 decisions, the last 10 wins, open tasks. It states drift once, in one sentence with the reason, then follows my decision. It does not ask me to justify a bet switch.

### Execute
Without approval (internal writes only): log a win, log a decision, create or complete a task, save a draft.

With an approval tap each time (anything leaving the app or touching money):
- Draft a post or outreach message. For X, v1 opens the compose link with the text prefilled; I tap post. X API is not used in v1 (price and terms not verified).
- Send an email from my own domain through Resend, after approval.
- Create a Stripe payment link, after approval.
- Generate the NOW.md Wins/Log rows as text for me to paste. The app never writes to NOW.md.

Each action shows exactly what will be sent or created before the tap, and records the result.

### Improve
Tracks selling, writing and shipping as skills. Proposes one small practice task per week from my recent activity. No self-rating in v1.

### Progress
Weekly money-ward score on the home screen, ranked as in NOW.md: £ in, buyer conversations, public posts that reached strangers, things shipped where strangers can reach them, things killed with evidence. Research and planning are not counted.

## Memory
- Structured records: goal, bets, decisions, wins, tasks, skills, drafts, action log.
- Conversations: a short summary kept indefinitely, full transcript kept 90 days then deleted by a scheduled job.
- NOW.md: one-way import. I paste the file into a settings screen; the app parses Target, Active bet, Wins, Log into records. Wins logged in the app are exported back as paste text.

## Contact
One push notification per day at a time I set. One extra reminder when a bet's kill date is within 3 days. Nothing else.

## Known problems to handle from the start
- `package.json` `overrides` for `jose` to `^5.10.0` (ESM-only jose broke firebase-admin on Vercel).
- Vercel Root Directory set correctly before the first deploy.
- Email + password auth only (no magic links on iOS home-screen apps).
- Push only works from the home-screen app on iOS 16.4+. The app shows install instructions if opened in Safari.
- Navigation between all screens in the UI, since there is no URL bar.
- Any GitHub Actions `run:` line containing `Authorization: Bearer` is a block scalar.
- ElevenLabs v4 promotional pricing ends 12 October 2026; cost after that is not verified.

## Risks to check
- Personal and career data, UK GDPR: stored in Firestore `europe-west2`; transcripts sent to OpenRouter and ElevenLabs. Need a privacy note for myself, a delete-all-data button, and the 90-day transcript expiry.
- Vendor terms: Resend free tier limits, Stripe account status, OpenRouter model availability. All not verified.
- Hands-free voice detection on iOS PWA (microphone permission, audio unlock after first tap). Tested on a real iPhone, not the simulator.
- Cost: no per-day cap yet. M1 sets a daily spend cap in config.

## Milestones
Each check runs against the real deployed app and real services.

| # | Milestone | Check |
|---|---|---|
| M0 | Deploy skeleton | Login with email + password works on my iPhone home-screen app at the Vercel URL. A second email not on the invite list is rejected. Firestore client rules deny a direct client read. |
| M1 | Text chat with context | After pasting NOW.md, asking "what is my active bet and next action?" returns the right values. Daily spend cap blocks calls once exceeded (tested with a low cap). |
| M2 | Voice loop | I say a sentence on the iPhone, hear a spoken reply, see both as text. Measured round-trip latency recorded in the report. Hold-to-talk toggle works. |
| M3 | Internal actions | By voice: "log a win: first reply received". A Firestore win record exists; the weekly score changes; undo works. |
| M4 | Approval actions | A drafted X post opens compose with the right text. A Resend email arrives at my own second address only after I tap approve, and not before. A Stripe payment link is created in test mode and opens. Rejecting an action sends nothing. |
| M5 | Push and daily check-in | A push arrives on the home-screen app at the configured time, once per day. Kill-date reminder fires in a test with a date 2 days out. |
| M6 | Improve and data controls | A weekly practice task is proposed from recent records. Delete-all-data removes every record for my user. A transcript older than 90 days is removed by the job (tested with a backdated record). |
| M7 | 4-week use review | I use it for 4 weeks. Report: wins logged through it, actions approved vs rejected, what I stopped using. Paid-version decision made from this. |

## Out of scope for v1
Multi-user, billing for others, X API posting, writing NOW.md directly, hands-free as the only voice mode, skill self-ratings, hours tracking.

## Open items for me
- Confirm Stripe account is ready for payment links (test mode is enough until M4 passes).
- Domain for Resend: which one.
- Daily check-in time and daily spend cap.
