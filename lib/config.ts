const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};

export const config = {
  appName: "profcareer",
  sessionCookie: "pc_session",
  sessionDays: num(process.env.SESSION_DAYS, 5),
  firestoreLocation: process.env.FIRESTORE_LOCATION ?? "europe-west2",
  collections: { invites: "invites" },
};
