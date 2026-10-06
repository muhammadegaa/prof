export const SAMPLE_RATE = 16000;

const SPEECH_RMS = 0.02;
const SILENCE_MS = 1100;
const MAX_MS = 30000;
const MIN_SPEECH_MS = 250;

function downsample(input: Float32Array, from: number, to: number) {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)];
  return out;
}

export function encodeWav(samples: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([buf], { type: "audio/wav" });
}

export type Mic = {
  stream: MediaStream;
  ctx: AudioContext;
  stop: () => void;
  /** Record one utterance. In "auto" mode it starts on speech and ends on silence; in "manual" mode `finish()` ends it. */
  record: (mode: "auto" | "manual", onLevel: (rms: number) => void) => { done: Promise<Blob | null>; finish: () => void; cancel: () => void };
};

export async function openMic(): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  let handler: ((data: Float32Array) => void) | null = null;
  proc.onaudioprocess = (e) => handler?.(new Float32Array(e.inputBuffer.getChannelData(0)));

  return {
    stream,
    ctx,
    stop: () => {
      handler = null;
      proc.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
    record: (mode, onLevel) => {
      const chunks: Float32Array[] = [];
      let started = mode === "manual";
      let speechMs = 0;
      let silenceMs = 0;
      let totalMs = 0;
      let resolve!: (b: Blob | null) => void;
      const done = new Promise<Blob | null>((r) => (resolve = r));

      const end = (keep: boolean) => {
        handler = null;
        if (!keep || !chunks.length) return resolve(null);
        const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
        let o = 0;
        chunks.forEach((c) => { all.set(c, o); o += c.length; });
        resolve(encodeWav(downsample(all, ctx.sampleRate, SAMPLE_RATE), SAMPLE_RATE));
      };

      handler = (data) => {
        const ms = (data.length / ctx.sampleRate) * 1000;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        onLevel(rms);
        totalMs += ms;
        const loud = rms > SPEECH_RMS;

        if (mode === "auto") {
          if (!started && loud) started = true;
          if (!started) return;
          chunks.push(data);
          if (loud) { speechMs += ms; silenceMs = 0; } else silenceMs += ms;
          if (silenceMs >= SILENCE_MS) return end(speechMs >= MIN_SPEECH_MS);
        } else {
          chunks.push(data);
        }
        if (totalMs >= MAX_MS) end(true);
      };

      return { done, finish: () => end(true), cancel: () => end(false) };
    },
  };
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Create an audio element and unlock it inside a user gesture so later playback is allowed on iOS. */
export async function unlockedAudio() {
  const el = new Audio();
  el.src = SILENT_WAV;
  await el.play().catch(() => {});
  return el;
}

export function playBlob(el: HTMLAudioElement, blob: Blob) {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    el.src = url;
    el.onended = () => { URL.revokeObjectURL(url); resolve(); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("audio playback failed")); };
    el.play().catch(reject);
  });
}
