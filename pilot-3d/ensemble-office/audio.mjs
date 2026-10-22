// Original synthesized local effects. No audio files, microphone or network.
const KINDS = { foot: [85, 0.055, 0.035], key: [950, 0.025, 0.012], chair: [155, 0.13, 0.018], cup: [1650, 0.1, 0.018], paper: [2100, 0.075, 0.01], coffee: [140, 0.25, 0.016] };
export class LocalActivityAudio {
  constructor({ contextFactory = () => new (window.AudioContext ?? window.webkitAudioContext)(), now = () => performance.now() / 1e3 } = {}) {
    this.factory = contextFactory;
    this.now = now;
    this.context = null;
    this.enabled = false;
    this.paused = false;
    this.disposed = false;
    this.voices = /* @__PURE__ */ new Set();
    this.last = /* @__PURE__ */ new Map();
    this.previous = /* @__PURE__ */ new Map();
    this.events = 0;
    this.dropped = 0;
    this.maxVoices = 0;
    this.errors = 0;
  }
  async enable(value) {
    if (this.disposed) return false;
    this.enabled = !!value;
    if (!value) {
      this.stop();
      await this.context?.suspend().catch(() => {
      });
      return false;
    }
    try {
      this.context ??= this.factory();
      if (!this.paused) await this.context.resume();
      return true;
    } catch {
      this.enabled = false;
      this.errors++;
      return false;
    }
  }
  pause(value) {
    this.paused = !!value;
    if (value) {
      this.stop();
      this.context?.suspend().catch(() => {
      });
    } else if (this.enabled) this.context?.resume().catch(() => {
      this.enabled = false;
      this.errors++;
    });
  }
  stop() {
    for (const voice of this.voices) {
      try {
        voice.osc.stop();
      } catch {
      }
      voice.osc.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
  }
  play(kind, minimum = 0.1) {
    const wall = this.now();
    if (!this.enabled || this.paused || this.disposed || !this.context || this.context.state !== "running") return false;
    if (wall - (this.last.get(kind) ?? -Infinity) < minimum || this.voices.size >= 12) {
      this.dropped++;
      return false;
    }
    this.last.set(kind, wall);
    const [hz, duration, volume] = KINDS[kind], ctx = this.context, osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime;
    osc.type = kind === "paper" || kind === "key" ? "triangle" : kind === "coffee" ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(hz, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, hz * 0.55), start + duration);
    gain.gain.setValueAtTime(1e-4, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 6e-3);
    gain.gain.exponentialRampToValueAtTime(1e-4, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    const voice = { osc, gain };
    this.voices.add(voice);
    this.maxVoices = Math.max(this.maxVoices, this.voices.size);
    osc.onended = () => {
      this.voices.delete(voice);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration + 0.01);
    this.events++;
    return true;
  }
  update(d) {
    if (this.disposed) return;
    const t = d.teamActivities;
    if (!t) return;
    let budget = 4;
    const emit = (kind, min) => {
      if (budget > 0 && this.play(kind, min)) budget--;
    };
    for (const [id, a] of Object.entries(t.actors ?? {})) {
      const p = this.previous.get(id), action = d.activities?.[id]?.action ?? "", stage = a.stage, cup = a.cup;
      if (action === "walk") emit("foot", 0.24);
      if (action === "typing" || a.kind === "role") emit("key", 0.2);
      if (p && stage !== p.stage && ["sit", "rise", "deskSit", "stand"].includes(stage)) emit("chair", 0.2);
      if (p && cup?.owner !== p.owner) emit("cup", 0.18);
      if (p && a.role?.stage !== p.role && a.role?.stage === "use" && ["nara", "min", "leo"].includes(id)) emit("paper", 0.3);
      this.previous.set(id, { stage, owner: cup?.owner, role: a.role?.stage });
    }
    if (t.coffee?.active.some((r) => r.phase === "brew")) emit("coffee", 0.45);
  }
  diagnostics() {
    return { source: "local-synthesis", enabled: this.enabled, paused: this.paused, contexts: this.context ? 1 : 0, voices: this.voices.size, maxVoices: this.maxVoices, events: this.events, dropped: this.dropped, errors: this.errors };
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.stop();
    await this.context?.close().catch(() => {
    });
    this.previous.clear();
    this.last.clear();
  }
}
