import { config } from "./config";
import { userRef } from "./context";
import { db } from "./firebase-admin";

export type WinType = "money" | "buyer" | "post" | "shipped" | "killed" | "other";
export type Win = { date: string; text: string; kind: string; type: WinType };
export type Decision = { date: string; text: string };
export type Bet = { name: string; summary: string; nextAction: string; killDate: string | null; daysLeft: number | null };

export const WIN_LABEL: Record<WinType, string> = {
  money: "Money in",
  buyer: "Buyer conversation",
  post: "Public post",
  shipped: "Shipped",
  killed: "Killed with evidence",
  other: "Other",
};

const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

function section(md: string, title: string) {
  const parts = md.split(/^## /m).slice(1);
  const hit = parts.find((p) => p.toLowerCase().startsWith(title.toLowerCase()));
  return hit ? hit.slice(hit.indexOf("\n") + 1) : "";
}

export function classify(kind: string, text: string): WinType {
  const k = `${kind} ${text}`.toLowerCase();
  if (/£\s?\d|£\s?in|money in|paid|payment|revenue/.test(kind.toLowerCase())) return "money";
  if (/killed/.test(kind.toLowerCase())) return "killed";
  if (/shipped/.test(kind.toLowerCase())) return "shipped";
  if (/contact|conversation|buyer|reply/.test(kind.toLowerCase())) return "buyer";
  if (/public post|post/.test(kind.toLowerCase())) return "post";
  if (/shipped/.test(k)) return "shipped";
  return "other";
}

export function parseWins(md: string): Win[] {
  return section(md, "Wins")
    .split("\n")
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l))
    .map((l) => {
      const cells = l.split("|").map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length);
      const [date, text = "", kind = ""] = cells;
      return { date, text: stripMd(text), kind: stripMd(kind), type: classify(kind, text) };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function parseDecisions(md: string): Decision[] {
  return section(md, "Log")
    .split("\n")
    .filter((l) => l.startsWith("- **"))
    .map((l) => {
      const m = l.match(/^- \*\*(\d{4}-\d{2}-\d{2})\*\*\s*[—-]\s*([\s\S]*)$/);
      return m ? { date: m[1], text: stripMd(m[2]) } : null;
    })
    .filter((d): d is Decision => !!d);
}

const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date());
const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / 86_400_000);
export const daysAgo = (date: string) => dayNum(todayStr()) - dayNum(date);

export function relativeDay(date: string) {
  const n = daysAgo(date);
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  return `${Math.round(n / 30)} months ago`;
}

export const shortDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));

/** Monday of the current week, as YYYY-MM-DD, in the app's timezone. */
export function weekStart() {
  const t = todayStr();
  const dow = (new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  return new Date((dayNum(t) - dow) * 86_400_000).toISOString().slice(0, 10);
}

export function parseBet(md: string): Bet | null {
  const rows = section(md, "The one active bet").split("\n");
  const cell = (name: string) => {
    const r = rows.find((l) => new RegExp(`^\\|\\s*\\*\\*${name}\\*\\*`, "i").test(l));
    return r ? r.split("|").slice(2, -1).join("|").trim() : "";
  };
  const bet = cell("Bet");
  if (!bet) return null;
  const m = bet.match(/^`?([^`:/]+?)\/?`?:\s*([\s\S]*)$/);
  const name = m ? m[1] : stripMd(bet).split(/[:.]/)[0];
  const summary = stripMd(m ? m[2] : bet);
  const kill = bet.match(/ends\s+\*\*([^*]+)\*\*/i)?.[1] ?? null;
  const ms = kill ? Date.parse(kill + " UTC") : NaN;
  const daysLeft = Number.isNaN(ms) ? null : Math.ceil(ms / 86_400_000) - dayNum(todayStr());
  return {
    name: name.trim().replace(/^./, (c) => c.toUpperCase()),
    summary,
    nextAction: stripMd(cell("Next action")),
    killDate: kill,
    daysLeft,
  };
}

export type Dashboard = {
  hasNow: boolean;
  updatedAt: string | null;
  target: string;
  bet: Bet | null;
  wins: Win[];
  decisions: Decision[];
  week: Record<WinType, number> & { total: number };
  lastWin: Win | null;
  voiceChosen: boolean;
  hasCalled: boolean;
  profile: { chars: number; updatedAt: string | null } | null;
  career: { chars: number; updatedAt: string | null } | null;
};

export async function getDashboard(uid: string): Promise<Dashboard> {
  const [snap, msg] = await Promise.all([
    userRef(uid).get(),
    db().collection(config.collections.messages).where("uid", "==", uid).limit(1).get(),
  ]);
  const d = snap.data();
  const md: string = d?.nowMd ?? "";
  const wins = md ? parseWins(md) : [];
  const start = weekStart();
  const week = { money: 0, buyer: 0, post: 0, shipped: 0, killed: 0, other: 0, total: 0 };
  for (const w of wins) if (w.date >= start && w.type !== "other") { week[w.type]++; week.total++; }
  return {
    hasNow: !!md,
    updatedAt: d?.nowUpdatedAt?.toDate?.().toISOString() ?? null,
    target: md ? stripMd(section(md, "The target")).split(/\s{2,}|\n/)[0] : "",
    bet: md ? parseBet(md) : null,
    wins,
    decisions: md ? parseDecisions(md) : [],
    week,
    lastWin: wins[0] ?? null,
    voiceChosen: !!(d?.voiceId || config.ttsVoiceId),
    hasCalled: !msg.empty,
    profile: d?.profileMd ? { chars: d.profileMd.length, updatedAt: d.profileMdUpdatedAt?.toDate?.().toISOString() ?? null } : null,
    career: d?.careerMd ? { chars: d.careerMd.length, updatedAt: d.careerMdUpdatedAt?.toDate?.().toISOString() ?? d.careerUpdatedAt?.toDate?.().toISOString() ?? null } : null,
  };
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: config.timezone }).format(new Date()));
  return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** A short version of long text: URLs dropped, cut at a sentence or word boundary. */
export function brief(text: string, max = 110) {
  const t = text.replace(/https?:\/\/\S+/g, "link").replace(/\s+/g, " ").trim();
  const sentence = t.match(/^.{20,}?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:(\s-]+$/, "") + "…";
}
