# profcareer

Voice agent on the phone for becoming a solopreneur. Spec: `spec.md`.

- Production: https://profcareer.vercel.app
- Stack: Next.js (App Router, TypeScript) on Vercel, Firebase Auth + Firestore (`prof-65a48`, europe-west2).
- Setup: copy `.env.example` to `.env.local`, fill it in, `npm install`, `npm run dev`.
- Invite a user: `npm run invite -- <email> <password>`.
