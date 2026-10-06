import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "./firebase-admin";
import { config } from "./config";

export type SessionUser = { uid: string; email: string };

const inviteCache = new Map<string, { ok: boolean; at: number }>();
const INVITE_TTL_MS = 60_000;

export async function isInvited(email: string) {
  const key = email.toLowerCase();
  const hit = inviteCache.get(key);
  if (hit && Date.now() - hit.at < INVITE_TTL_MS) return hit.ok;
  const snap = await db().collection(config.collections.invites).doc(key).get();
  inviteCache.set(key, { ok: snap.exists, at: Date.now() });
  return snap.exists;
}

export async function getUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(config.sessionCookie)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, false);
    if (!decoded.email || !(await isInvited(decoded.email))) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
