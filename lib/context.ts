import { db } from "./firebase-admin";
import { config } from "./config";

export type NowParsed = { target: string; bet: string; wins: string[]; log: string[] };

function section(md: string, title: string) {
  const parts = md.split(/^## /m).slice(1);
  const hit = parts.find((p) => p.toLowerCase().startsWith(title.toLowerCase()));
  return hit ? hit.slice(hit.indexOf("\n") + 1).trim() : "";
}

export function parseNow(md: string): NowParsed {
  const wins = section(md, "Wins")
    .split("\n")
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l))
    .map((l) => l.replace(/\s+/g, " ").trim());
  const log = section(md, "Log")
    .split("\n")
    .filter((l) => l.startsWith("- **"))
    .map((l) => l.trim());
  return { target: section(md, "The target"), bet: section(md, "The one active bet"), wins, log };
}

export const userRef = (uid: string) => db().collection(config.collections.users).doc(uid);

export async function buildSystemPrompt(uid: string) {
  const data = (await userRef(uid).get()).data();
  const now = data?.now as NowParsed | undefined;
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, dateStyle: "full" }).format(new Date());

  const rules = [
    "You are the voice agent of Ega, a solo founder with a 9-5 job and about 10-15 hours a week for his own work.",
    "His goal: build his own revenue and become a solopreneur while keeping the stable job.",
    "You are on a live voice call with him. Reply in one to three short sentences, like a person talking. No lists, no markdown. Ask at most one question at a time.",
    "Write plainly. No metaphors, slogans, or 'it's not X, it's Y'. Say each thing once.",
    "Push him toward money-ward actions: money in, buyer conversations, public posts that reach strangers, things shipped where strangers can reach them.",
    "If he drifts from the active bet, say so in one sentence with the reason, then follow his decision.",
    "Use only facts from the context below. If something is not in the context, say 'not in my records'. Do not invent numbers, names, or dates.",
    `Today is ${today}.`,
  ].join("\n");

  if (!now) return `${rules}\n\nContext: no NOW.md has been imported yet. Tell him to paste it in Settings if he asks about his bet or wins.`;

  return [
    rules,
    "",
    "CONTEXT FROM NOW.md",
    `Target:\n${now.target}`,
    `Active bet:\n${now.bet}`,
    `Latest wins (newest first):\n${now.wins.slice(0, 10).join("\n")}`,
    `Recent log:\n${now.log.slice(0, 6).join("\n")}`,
  ].join("\n");
}
