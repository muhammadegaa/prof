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
Each conversation gets: my goal, the active bet, the last 10 decisions, the last 10 wins, open tasks, today's commitment and the current streak. It states drift in one sentence with the reason, then follows my decision, with one exception: bet switching (see Accountability).

### Proactive loop (v1 core)
The app starts conversations; I do not have to remember to open it.
1. **Morning:** it asks for the one money-ward action I will do today (a £ event, a buyer conversation, a public post, or something shipped to strangers). It proposes one based on the active bet's next action and my open drafts. I confirm or change it by voice. This becomes today's commitment.
2. **Prepare overnight:** before the morning push, a scheduled job drafts what the commitment needs (message, post, follow-up, payment link) and queues it in Actions. It sends nothing.
3. **Evening:** it asks whether the commitment is done. "Done" logs a win and extends the streak. "Not done" starts the re-plan.
4. **Weekly review (Sunday):** what moved, what did not, the streak, and one commitment for Monday.

### Accountability
- **Missed commitment:** it names what was missed in one sentence with the reason it matters, then proposes a smaller version for tonight. It does not re-argue past misses.
- **Streak:** consecutive days with at least one money-ward action. Shown on Home.
- **Escalation:** after two missed days in a row, the push cap rises from 3 to 4 a day until I reply once. It resets on a reply.
- **Block bet switching:** before it logs a new active bet, it asks me to finish the current bet or kill it with evidence. I can override with "switch anyway" plus one line of reason, which it logs. The block exists to make the swap explicit, not to forbid it.

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
- Morning commitment push and evening check-in push, at times I set. Plus event pushes: a bet's kill date within 3 days, a queued draft unapproved for 24 hours.
- Hard cap: 3 pushes a day, 4 under escalation. Weekday pushes only before 09:00 or after 18:00; weekends any time. All values are in `lib/config.ts` and Settings.
- A push opens the Talk screen with the question already asked, so one tap starts the conversation.
- Pushes that I ignore for 3 days in a row stop, and the app says so on Home instead of continuing silently.
- Scheduler: not verified. The Vercel free plan may allow only daily cron jobs. Plan is a GitHub Actions schedule or Cloud Scheduler calling a secret-protected endpoint; confirmed in M5.

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
| M5 | Proactive loop | Morning push arrives on the home-screen app and opens Talk with the commitment question. Answering sets today's commitment. Overnight job queues a draft for it without sending. Evening push asks for the result; "done" logs a win and the streak goes up. "Not done" produces a smaller commitment for tonight. Caps and quiet hours hold in tests: a 4th push on one day is not sent, a weekday push at 12:00 is not sent. Scheduler confirmed to fire at the configured minutes in production. |
| M5b | Accountability | Two missed days raise the cap to 4; one reply resets it. Sunday review contains this week's real events. Logging a new bet is refused until the current one is finished or killed, and "switch anyway" with a reason logs and proceeds. Three ignored days stop pushes and Home says so. |
| M6 | Improve and data controls | A weekly practice task is proposed from recent records. Delete-all-data removes every record for my user. A transcript older than 90 days is removed by the job (tested with a backdated record). |
| M7 | 4-week use review | I use it for 4 weeks. Report: wins logged through it, actions approved vs rejected, what I stopped using. Paid-version decision made from this. |

## Out of scope for v1
Multi-user, billing for others, X API posting, writing NOW.md directly, hands-free as the only voice mode, skill self-ratings, hours tracking, any sending or posting without my tap (auto-send is a v2 decision after the 4-week review).

## Open items for me
- Confirm Stripe account is ready for payment links (test mode is enough until M4 passes).
- Domain for Resend: which one.
- Daily check-in time and daily spend cap.
