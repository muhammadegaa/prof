import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import { config } from "./config";

const day = () => new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(new Date());
const ref = (uid: string) => db().collection(config.collections.spend).doc(`${uid}_${day()}`);

export class SpendCapError extends Error {}

export async function assertUnderCap(uid: string) {
  const snap = await ref(uid).get();
  const spent = (snap.data()?.gbp as number | undefined) ?? 0;
  if (spent >= config.dailySpendCapGbp) {
    throw new SpendCapError(`Daily spend cap of £${config.dailySpendCapGbp} reached (£${spent.toFixed(2)} used).`);
  }
}

export async function addSpend(uid: string, gbp: number) {
  await ref(uid).set({ gbp: FieldValue.increment(gbp), updatedAt: new Date() }, { merge: true });
}

export const usdToGbp = (usd: number) => usd * config.usdToGbp;
