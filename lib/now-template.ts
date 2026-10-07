/** A blank NOW.md the user fills in. Importing is refused while any [FILL IN ...] is left. */
export function nowTemplate(today: string) {
  return `# NOW

## The target

**[FILL IN: your goal in one line, e.g. One stranger pays. Deadline 31 Dec 2026.]**

## The one active bet

| | |
|---|---|
| **Bet** | \`[FILL IN: short name]\`: [FILL IN: one sentence on what you are building and who pays]. Time box [FILL IN: e.g. 3 weeks], ends **[FILL IN: e.g. 25 Oct 2026]**. |
| **Next action** | [FILL IN: the single next thing you will do, with a time if you have one] |

## Wins

Add a row each time something real happens. The Kind column decides how it is counted:
first contact, shipped, public post, killed w/ evidence, or £ in.

| Date | Win | Kind |
|---|---|---|

## Log

- **${today}** — Started using profcareer. Active bet: [FILL IN: short name].
`;
}
