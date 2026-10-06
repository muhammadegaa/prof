import { Baseline, UtteranceTracker, bargeThreshold, defaultVad, speechThreshold } from "./vad";

export const SAMPLE_RATE = 16000;

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

export type Frame = { data: Float32Array; rms: number; ms: number };

export type Mic = {
  stop: () => void;
  setMuted: (m: boolean) => void;
  onFrame: (fn: (f: Frame, gate: number) => void) => () => void;
  /** Resolves with one finished utterance. `primed` means the user is already mid-speech (after an interruption). */
  recordUtterance: (opts?: { primed?: boolean }) => { done: Promise<Blob>; cancel: () => void };
  /** Resolves when the user speaks over the agent for about 300 ms. */
  waitForBarge: () => { promise: Promise<void>; cancel: () => void };
};

const PREROLL_FRAMES = 4;

/**
 * Must be called synchronously inside a tap handler (before any await) so iOS lets the audio context run.
 */
export function openMic(): Promise<Mic> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  void ctx.resume();

  return navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    .then(async (stream) => {
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);

      const baseline = new Baseline(600);
      const listeners = new Set<(f: Frame, gate: number) => void>();
      const preroll: Float32Array[] = [];
      let muted = false;
      let agentSpeaking = false;

      proc.onaudioprocess = (e) => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0));
        const ms = (data.length / ctx.sampleRate) * 1000;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = muted ? 0 : Math.sqrt(sum / data.length);
        const gate = agentSpeaking ? bargeThreshold(baseline.value) : speechThreshold(baseline.value);
        if (!agentSpeaking) baseline.feed(rms, ms, rms <= gate);
        preroll.push(data);
        if (preroll.length > PREROLL_FRAMES) preroll.shift();
        const frame = { data, rms, ms };
        listeners.forEach((fn) => fn(frame, gate));
      };

      const toBlob = (chunks: Float32Array[]) => {
        const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
        let o = 0;
        chunks.forEach((c) => { all.set(c, o); o += c.length; });
        return encodeWav(downsample(all, ctx.sampleRate, SAMPLE_RATE), SAMPLE_RATE);
      };

      const mic: Mic = {
        stop: () => {
          listeners.clear();
          proc.onaudioprocess = null;
          proc.disconnect();
          source.disconnect();
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
        },
        setMuted: (m) => { muted = m; },
        onFrame: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

        recordUtterance: ({ primed = false } = {}) => {
          agentSpeaking = false;
          let tracker = new UtteranceTracker(defaultVad, primed);
          let chunks: Float32Array[] = primed ? [...preroll] : [];
          let resolve!: (b: Blob) => void;
          const done = new Promise<Blob>((r) => (resolve = r));
          const off = mic.onFrame((f, gate) => {
            const ev = tracker.feed(f.rms > gate, f.ms);
            if (ev === "start") chunks = [...preroll];
            else if (tracker.started) chunks.push(f.data);
            if (ev === "end") { off(); resolve(toBlob(chunks)); }
            if (ev === "discard") { tracker = new UtteranceTracker(defaultVad, false); chunks = []; }
          });
          return { done, cancel: off };
        },

        waitForBarge: () => {
          agentSpeaking = true;
          let loudMs = 0;
          let resolve!: () => void;
          const promise = new Promise<void>((r) => (resolve = r));
          const off = mic.onFrame((f, gate) => {
            loudMs = f.rms > gate ? loudMs + f.ms : 0;
            if (loudMs >= 300) { off(); resolve(); }
          });
          return { promise, cancel: () => { off(); agentSpeaking = false; } };
        },
      };
      return mic;
    })
    .catch((e) => { void ctx.close(); throw e; });
}

const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Call synchronously in a tap handler: starts a silent clip so later playback is allowed on iOS. */
export function unlockAudio() {
  const el = new Audio();
  el.src = SILENT_WAV;
  void el.play().catch(() => {});
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

/** Speaks sentences in order. Each sentence is fetched as soon as it is queued, so later ones are ready when earlier ones end. */
export class SpeechQueue {
  private tail: Promise<void> = Promise.resolve();
  private ctl = new AbortController();
  private gen = 0;
  private cancelled: Promise<void>;
  private fireCancel!: () => void;
  error: Error | null = null;

  constructor(private audio: HTMLAudioElement) {
    this.cancelled = new Promise<void>((r) => (this.fireCancel = r));
  }

  enqueue(text: string, onPlay?: () => void) {
    const gen = this.gen;
    const signal = this.ctl.signal;
    const blob = fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Voice failed (${r.status})`);
      return r.blob();
    });
    blob.catch(() => {});
    this.tail = this.tail
      .then(async () => {
        if (gen !== this.gen) return;
        const b = await blob;
        if (gen !== this.gen) return;
        onPlay?.();
        await playBlob(this.audio, b);
      })
      .catch((e: Error) => { if (gen === this.gen && e.name !== "AbortError") this.error = e; });
  }

  /** Resolves when everything queued has been spoken, or when the queue is cancelled. */
  idle() { return Promise.race([this.tail, this.cancelled]); }

  cancel() {
    this.gen++;
    this.ctl.abort();
    this.ctl = new AbortController();
    this.audio.pause();
    this.tail = Promise.resolve();
    this.fireCancel();
    this.cancelled = new Promise<void>((r) => (this.fireCancel = r));
  }
}
