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
  const profile = typeof data?.profileMd === "string" ? data.profileMd.slice(0, 6000) : "";
  const career = typeof data?.careerMd === "string" ? data.careerMd.slice(0, 5000) : "";
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, dateStyle: "full" }).format(new Date());

  const rules = [
    "You are the voice agent of Ega. He works full time and has about 10-15 hours a week for his own work.",
    "He runs two tracks: building income of his own, and a job search for a product manager role with a new visa sponsor. Use the matching context below.",
    "You are on a live voice call with him. Reply in one to three short sentences, like a person talking. No lists, no markdown. Ask at most one question at a time.",
    "Write plainly. No metaphors, slogans, or 'it's not X, it's Y'. Say each thing once.",
    "Push him toward actions that count: for his own work, money in, buyer conversations, public posts, things shipped; for the job search, human conversations started and applications confirmed.",
    "If he asks you to draft something (a message, a reply, a note), say it aloud in one or two lines using the context and the outreach rules. If you lack a fact, name it in one sentence and draft around it. Never send anything for him.",
    "Hard rule for any outreach draft to a recruiter or hiring contact: exactly two lines, the first is a question about the role, and neither line mentions visa, sponsorship or immigration.",
    "If he drifts from the active bet, say so in one sentence with the reason, then follow his decision.",
    "Use only facts from the context below. If something is not in the context, say 'not in my records'. Do not invent numbers, names, or dates. Never state or ask about his current salary.",
    `Today is ${today}.`,
  ].join("\n");

  const parts = [rules];
  if (now) {
    parts.push(
      "",
      "CONTEXT FROM NOW.md (his own work)",
      `Target:\n${now.target}`,
      `Active bet:\n${now.bet}`,
      `Latest wins (newest first):\n${now.wins.slice(0, 10).join("\n")}`,
      `Recent log:\n${now.log.slice(0, 6).join("\n")}`,
    );
  } else {
    parts.push("", "Context: no NOW.md has been imported yet. If he asks about his own project, tell him to import it in Settings.");
  }
  if (profile) parts.push("", "CAREER PROFILE (stable facts about him)", profile);
  if (career) parts.push("", "JOB SEARCH STATUS (latest snapshot; use when he asks about applications, offers or the job)", career);
  return parts.join("\n");
}
