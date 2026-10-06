import { config } from "./config";

const BASE = "https://openrouter.ai/api/v1";

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[]) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: config.llmModel,
      messages,
      max_tokens: config.maxReplyTokens,
      usage: { include: true },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter chat ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  const costUsd: number = json.usage?.cost ?? 0;
  return { text: text.trim(), costUsd };
}

export async function transcribe(audioBase64: string, format: "wav" | "mp3" = "wav") {
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: config.sttModel,
      input_audio: { data: audioBase64, format },
      language: "en",
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter transcribe ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { text: String(json.text ?? "").trim(), costUsd: Number(json.usage?.cost ?? 0) };
}
