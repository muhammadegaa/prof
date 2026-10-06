import { config } from "./config";

const BASE = "https://api.elevenlabs.io/v1";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not set");
  return k;
}

export async function speak(text: string, voiceId: string) {
  if (!voiceId) throw new Error("No voice selected. Choose one in Settings.");
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}/stream?output_format=${config.ttsFormat}`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: config.ttsModel }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

export type Voice = { id: string; name: string; previewUrl: string | null; description: string };

export async function listVoices(): Promise<Voice[]> {
  const res = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": key() } });
  if (!res.ok) throw new Error(`ElevenLabs voices ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return (json.voices as Array<Record<string, unknown>>).map((v) => ({
    id: String(v.voice_id),
    name: String(v.name),
    previewUrl: (v.preview_url as string) ?? null,
    description: Object.values((v.labels as Record<string, string>) ?? {}).join(", "),
  }));
}
