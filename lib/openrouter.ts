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

export type StreamPart = { text: string } | { costUsd: number; final: true };

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<StreamPart> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: config.llmModel, messages, max_tokens: config.maxReplyTokens, stream: true, usage: { include: true } }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenRouter chat ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let costUsd = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content;
        if (t) yield { text: t };
        if (j.usage?.cost) costUsd = j.usage.cost;
      } catch {}
    }
  }
  yield { costUsd, final: true };
}
