// Spiel-Timer. Gespeichert wird nur die Endzeit (endsAt) bzw. die Restzeit im Pausenzustand –
// jedes Fenster (Steuerung, Beamer) rechnet die Anzeige selbst aus. Kein Nachrichten-Takt
// mehr wie in der alten App (alle 10 ms in den localStorage).

import { LIMITS } from '../engine/types';
import { type Scheduled, type SoundKind, type SoundSource, audio, audioRunning, loadCustom, schedule, setVolume } from './sound';
import { music } from './music.svelte';
import { KEYS, readJson, writeJson } from './storage';

export interface TimerData {
  duration: number;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
}

export interface SoundSettings {
  sources: Record<SoundKind, SoundSource>;
  /** Spielende-Ton so viele Sekunden vor Ablauf (z. B. damit eine Hupe genau bei 0 endet) */
  endOffset: number;
  volume: number;
}

export const DEFAULT_DURATION = 4 * 60;

export function parseTimer(v: unknown): TimerData {
  const d: TimerData = { duration: DEFAULT_DURATION, running: false, endsAt: null, remainingMs: DEFAULT_DURATION * 1000 };
  if (typeof v !== 'object' || v === null) return d;
  const o = v as Record<string, unknown>;
  const duration = typeof o.duration === 'number' && o.duration >= LIMITS.matchSecondsMin && o.duration <= LIMITS.matchSecondsMax ? Math.round(o.duration) : d.duration;
  const running = o.running === true && typeof o.endsAt === 'number';
  const remainingMs = typeof o.remainingMs === 'number' ? Math.max(0, Math.min(LIMITS.matchSecondsMax * 1000, o.remainingMs)) : duration * 1000;
  return { duration, running, endsAt: running ? (o.endsAt as number) : null, remainingMs };
}

export function remainingAt(t: TimerData, now: number): number {
  return t.running && t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remainingMs;
}

export function formatClock(ms: number, tenths = false): string {
  const total = Math.ceil(ms / (tenths ? 100 : 1000)) * (tenths ? 100 : 1000);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return tenths ? `${base}.${Math.floor((total % 1000) / 100)}` : base;
}

function parseSound(v: unknown): SoundSettings {
  const d: SoundSettings = { sources: { start: 'builtin', half: 'builtin', end: 'builtin' }, endOffset: 0, volume: 0.8 };
  if (typeof v !== 'object' || v === null) return d;
  const o = v as Record<string, unknown>;
  const src = (o.sources ?? {}) as Record<string, unknown>;
  const pick = (k: SoundKind): SoundSource => (src[k] === 'custom' || src[k] === 'off' || src[k] === 'builtin' ? src[k] : 'builtin');
  return {
    sources: { start: pick('start'), half: pick('half'), end: pick('end') },
    endOffset: typeof o.endOffset === 'number' ? Math.max(0, Math.min(10, Math.round(o.endOffset))) : 0,
    volume: typeof o.volume === 'number' ? Math.max(0, Math.min(1, o.volume)) : d.volume,
  };
}

/** Einfache Uhr für Anzeigen; läuft über requestAnimationFrame. */
class Clock {
  now = $state(Date.now());
  private started = false;
  start() {
    if (this.started) return;
    this.started = true;
    const tick = () => { this.now = Date.now(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}
export const clock = new Clock();

interface Pending { kind: SoundKind; at: number; handle: Scheduled }

class Timer {
  data = $state.raw<TimerData>(parseTimer(readJson(KEYS.timer)));
  sound = $state.raw<SoundSettings>(parseSound(readJson(KEYS.sound)));
  customNames = $state<Partial<Record<SoundKind, string>>>({});
  private pending: Pending[] = [];

  get remaining() {
    return remainingAt(this.data, clock.now);
  }
  get expired() {
    return this.remaining === 0;
  }
  get fresh() {
    return !this.data.running && this.data.remainingMs === this.data.duration * 1000;
  }

  /** Steuerfenster: Ablauf überwachen, eigene Töne laden */
  connect() {
    clock.start();
    setInterval(() => {
      const d = this.data;
      if (d.running && d.endsAt !== null && Date.now() >= d.endsAt) this.set({ ...d, running: false, endsAt: null, remainingMs: 0 });
    }, 200);
    // Ein bei Neuladen weiterlaufender Timer bekommt seine Töne neu geplant
    // (sobald der Browser Audio erlaubt; sonst bleibt er stumm bis zum nächsten Klick).
    if (this.data.running) this.planSounds(false);
    // Nach dem Neuladen ist die Audio-Uhr bis zum ersten Klick angehalten. Signale, die
    // jetzt geplant würden, kämen um diese Zeit zu spät – daher beim ersten Klick neu planen.
    const wake = () => {
      void audio().resume().then(() => { if (this.data.running) this.planSounds(false); });
    };
    window.addEventListener('pointerdown', wake, { once: true, capture: true });
    window.addEventListener('keydown', wake, { once: true, capture: true });
    void this.loadCustomSounds();
    window.addEventListener('storage', e => {
      if (e.key === KEYS.timer && e.newValue) this.data = parseTimer(JSON.parse(e.newValue));
    });
  }

  async loadCustomSounds() {
    for (const k of ['start', 'half', 'end'] as SoundKind[]) {
      try {
        const rec = await loadCustom(k);
        this.customNames = { ...this.customNames, [k]: rec?.name };
      } catch (err) {
        console.error('Ton konnte nicht geladen werden', k, err);
      }
    }
  }

  private set(d: TimerData) {
    this.data = d;
    writeJson(KEYS.timer, d);
  }

  setSound(patch: Partial<SoundSettings>) {
    this.sound = parseSound({ ...this.sound, ...patch, sources: { ...this.sound.sources, ...(patch.sources ?? {}) } });
    writeJson(KEYS.sound, this.sound);
    setVolume(this.sound.volume);
  }

  private planToken = 0;

  /** Der Timer wartet noch auf den Startton (Musik wird zuerst leiser). */
  starting = $state(false);
  private startTimer: ReturnType<typeof setTimeout> | null = null;

  private cancelSounds(keepDucks = false) {
    this.planToken++;
    if (this.startTimer) { clearTimeout(this.startTimer); this.startTimer = null; }
    this.starting = false;
    const now = Date.now();
    for (const p of this.pending) if (p.at > now) p.handle.stop();
    this.pending = [];
    if (!keepDucks) music.cancelDucks();
  }

  private planSounds(withStart: boolean, keepDucks = false) {
    this.cancelSounds(keepDucks);
    setVolume(this.sound.volume);
    const d = this.data;
    if (!d.running || d.endsAt === null) return;
    if (!audioRunning()) {
      // Audio-Uhr startet gerade erst (erster Klick) oder wartet noch auf einen Klick
      // (nach dem Neuladen): erst planen, wenn sie läuft – sonst kämen die Töne zu spät.
      const token = this.planToken;
      const asked = Date.now();
      void audio().resume().then(() => {
        if (token === this.planToken && this.data.running) this.planSounds(withStart && Date.now() - asked < 1500);
      });
      return;
    }
    const now = Date.now();
    const rem = d.endsAt - now;
    const half = (d.duration * 1000) / 2;
    const endLead = this.sound.endOffset * 1000;
    const plan = (kind: SoundKind, delay: number) => {
      const handle = schedule(kind, this.sound.sources[kind], delay);
      this.pending.push({ kind, at: now + delay, handle });
      music.duck(delay, handle.duration);
    };
    if (withStart) plan('start', 0);
    if (rem > half + 50) plan('half', rem - half);
    if (rem > endLead) plan('end', rem - endLead);
  }

  start() {
    const d = this.data;
    if (d.running || this.starting) return;
    const base = d.remainingMs > 0 ? d.remainingMs : d.duration * 1000;
    const fromTop = base === d.duration * 1000;
    // Von vorn: erst wird die Musik leiser, dann ertönt der Startton, danach läuft die Zeit.
    const lead = fromTop && audioRunning() ? music.leadSeconds() : 0;
    if (lead > 0) {
      this.cancelSounds();
      setVolume(this.sound.volume);
      const delay = lead * 1000;
      const handle = schedule('start', this.sound.sources.start, delay);
      this.pending.push({ kind: 'start', at: Date.now() + delay, handle });
      music.duck(delay, handle.duration);
      this.starting = true;
      this.startTimer = setTimeout(() => {
        this.startTimer = null;
        this.starting = false;
        this.begin(base, false);
      }, delay + handle.duration * 1000);
      return;
    }
    this.begin(base, fromTop);
  }

  private begin(base: number, withStart: boolean) {
    this.set({ ...this.data, running: true, endsAt: Date.now() + base, remainingMs: base });
    this.planSounds(withStart, true);
  }

  pause() {
    const d = this.data;
    if (!d.running) return;
    this.cancelSounds();
    this.set({ ...d, running: false, endsAt: null, remainingMs: remainingAt(d, Date.now()) });
  }

  toggle() {
    if (this.starting) this.cancelSounds();
    else if (this.data.running) this.pause(); else this.start();
  }

  reset() {
    this.cancelSounds();
    this.set({ ...this.data, running: false, endsAt: null, remainingMs: this.data.duration * 1000 });
  }

  setDuration(seconds: number) {
    const s = Math.round(seconds);
    if (!(s >= LIMITS.matchSecondsMin && s <= LIMITS.matchSecondsMax)) return false;
    this.cancelSounds();
    this.set({ duration: s, running: false, endsAt: null, remainingMs: s * 1000 });
    return true;
  }

  /** ±Sekunden während des Laufs (z. B. Verletzungspause) */
  adjust(deltaSec: number) {
    const d = this.data;
    const rem = Math.max(1000, Math.min(LIMITS.matchSecondsMax * 1000, remainingAt(d, Date.now()) + deltaSec * 1000));
    if (d.running) {
      this.set({ ...d, endsAt: Date.now() + rem });
      this.planSounds(false);
    } else {
      this.set({ ...d, remainingMs: rem });
    }
  }
}

export const timer = new Timer();

/** Nur lesen (Beamer-Fenster) */
export function readTimer(): TimerData {
  return parseTimer(readJson(KEYS.timer));
}
