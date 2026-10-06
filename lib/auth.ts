import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, db } from "./firebase-admin";
import { config } from "./config";

export type SessionUser = { uid: string; email: string };

export async function isInvited(email: string) {
  const snap = await db().collection(config.collections.invites).doc(email.toLowerCase()).get();
  return snap.exists;
}

export async function getUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(config.sessionCookie)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
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
