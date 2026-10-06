import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("usage: npm run invite -- <email> <password>");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)) });
const auth = getAuth();
const key = email.toLowerCase();

const existing = await auth.getUserByEmail(key).catch(() => null);
if (existing) await auth.updateUser(existing.uid, { password });
else await auth.createUser({ email: key, password });

await getFirestore().collection("invites").doc(key).set({ createdAt: new Date() });
console.log(existing ? "updated" : "created", key);
