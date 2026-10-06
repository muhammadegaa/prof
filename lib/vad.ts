export type VadConfig = { silenceMs: number; minSpeechMs: number; maxMs: number };
export const defaultVad: VadConfig = { silenceMs: 800, minSpeechMs: 200, maxMs: 30000 };

/** Level above which a frame counts as the user speaking, relative to the room's quiet level. */
export const speechThreshold = (baseline: number) => Math.max(0.012, baseline * 3);
/** Higher gate used while the agent is talking, so its own voice leaking into the mic does not cut it off. */
export const bargeThreshold = (baseline: number) => Math.max(0.05, baseline * 8);

export type VadEvent = "none" | "start" | "end" | "discard";

export class UtteranceTracker {
  private speechMs = 0;
  private silenceMs = 0;
  private totalMs = 0;
  started: boolean;

  constructor(private cfg: VadConfig = defaultVad, primed = false) {
    this.started = primed;
    if (primed) this.speechMs = cfg.minSpeechMs;
  }

  feed(loud: boolean, ms: number): VadEvent {
    this.totalMs += ms;
    let ev: VadEvent = "none";
    if (!this.started) {
      if (!loud) return "none";
      this.started = true;
      ev = "start";
    }
    if (loud) {
      this.speechMs += ms;
      this.silenceMs = 0;
    } else {
      this.silenceMs += ms;
    }
    if (this.silenceMs >= this.cfg.silenceMs) return this.speechMs >= this.cfg.minSpeechMs ? "end" : "discard";
    if (this.totalMs >= this.cfg.maxMs) return "end";
    return ev;
  }
}

/** Learns the room's quiet level: averages the first calibration window, then drifts slowly on quiet frames. */
export class Baseline {
  private sum = 0;
  private ms = 0;
  value = 0.004;
  constructor(private calibrateMs = 600) {}
  get ready() { return this.ms >= this.calibrateMs; }
  feed(rms: number, frameMs: number, quiet: boolean) {
    if (!this.ready) {
      this.sum += rms * frameMs;
      this.ms += frameMs;
      if (this.ready) this.value = Math.max(0.002, this.sum / this.ms);
    } else if (quiet) {
      this.value = this.value * 0.98 + rms * 0.02;
    }
  }
}
