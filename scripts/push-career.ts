import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// usage: npm run push-career -- <email> <file>            (job-search progress, replaced each batch)
//        npm run push-profile -- <email> <file>          (stable profile: roles, skills, targets)
const args = process.argv.slice(2);
const i = args.indexOf("--field");
const field = i >= 0 ? args.splice(i, 2)[1] : "careerMd";
if (!["careerMd", "profileMd"].includes(field)) {
  console.error("--field must be careerMd or profileMd");
  process.exit(1);
}
const [email, file] = args;
if (!email || !file) {
  console.error("usage: npm run push-career -- <email> <file>   or   npm run push-profile -- <email> <file>");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)) });
const user = await getAuth().getUserByEmail(email.toLowerCase());
const text = readFileSync(file, "utf8");
await getFirestore().collection("users").doc(user.uid).set({ [field]: text, [`${field}UpdatedAt`]: new Date() }, { merge: true });
console.log("saved", field, text.length, "chars for", email);
