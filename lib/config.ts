const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};

export const config = {
  appName: "profcareer",
  userName: process.env.USER_NAME ?? "Ega",
  sessionCookie: "pc_session",
  sessionDays: num(process.env.SESSION_DAYS, 5),
  firestoreLocation: process.env.FIRESTORE_LOCATION ?? "europe-west2",
  timezone: process.env.APP_TIMEZONE ?? "Europe/London",
  collections: { invites: "invites", users: "users", messages: "messages", spend: "spend" },

  llmModel: process.env.LLM_MODEL ?? "anthropic/claude-haiku-4.5",
  sttModel: process.env.STT_MODEL ?? "openai/gpt-4o-mini-transcribe",
  ttsModel: process.env.TTS_MODEL ?? "eleven_v4_turbo",
  ttsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  ttsFormat: process.env.TTS_FORMAT ?? "mp3_44100_64",
  historyMessages: num(process.env.HISTORY_MESSAGES, 20),
  maxReplyTokens: num(process.env.MAX_REPLY_TOKENS, 220),

  // Spend cap. Prices below are estimates, not verified against vendor price pages.
  dailySpendCapGbp: num(process.env.DAILY_SPEND_CAP_GBP, 2),
  usdToGbp: num(process.env.USD_TO_GBP, 0.75),
  sttCostUsdPerCall: num(process.env.STT_COST_USD_PER_CALL, 0.002),
  ttsCostGbpPerChar: num(process.env.TTS_COST_GBP_PER_CHAR, 0.0003),
};
