// Töne für den Timer. Eingebaute Signale werden mit Web Audio erzeugt (keine Dateien nötig),
// eigene Dateien liegen in IndexedDB (localStorage wäre für Audio zu klein – das war in der
// alten App die Ursache für „Speichern fehlgeschlagen“).
// Alle Töne werden auf der AudioContext-Uhr vorausgeplant: Die läuft auch weiter, wenn das
// Fenster im Hintergrund liegt und der Browser setTimeout drosselt.

export type SoundKind = 'start' | 'half' | 'end';
export type SoundSource = 'builtin' | 'custom' | 'off';

export const SOUND_LABELS: Record<SoundKind, string> = {
  start: 'Spielbeginn',
  half: 'Halbzeit',
  end: 'Spielende',
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Muss aus einem Klick heraus aufgerufen werden (Autoplay-Regeln der Browser). */
export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setVolume(v: number) {
  audio();
  master!.gain.value = Math.max(0, Math.min(1, v));
}

export interface Scheduled { stop(): void }

type Voice = { osc: OscillatorNode; gain: GainNode };

function tone(at: number, freq: number, dur: number, type: OscillatorType, peak: number, voices: Voice[], glideTo?: number) {
  const c = audio();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.setValueAtTime(peak, at + Math.max(0.02, dur - 0.06));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  voices.push({ osc, gain });
}

/** Schiedsrichterpfiff-artig, mit Triller */
function whistle(at: number, dur: number, voices: Voice[]) {
  const c = audio();
  const osc = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2900, at);
  lfo.frequency.value = 28;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
  gain.gain.setValueAtTime(0.35, at + dur - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master!);
  osc.start(at); lfo.start(at);
  osc.stop(at + dur + 0.02); lfo.stop(at + dur + 0.02);
  voices.push({ osc, gain }, { osc: lfo, gain: lfoGain });
}

function builtin(kind: SoundKind, at: number): Voice[] {
  const v: Voice[] = [];
  if (kind === 'start') {
    whistle(at, 0.28, v);
    whistle(at + 0.4, 0.7, v);
  } else if (kind === 'half') {
    tone(at, 880, 0.55, 'sine', 0.45, v);
    tone(at, 1760, 0.4, 'sine', 0.12, v);
    tone(at + 0.32, 660, 0.9, 'sine', 0.45, v);
    tone(at + 0.32, 1320, 0.6, 'sine', 0.1, v);
  } else {
    // Hupe: zwei verstimmte Sägezähne, dazu ein Schlusspfiff
    tone(at, 233, 1.6, 'sawtooth', 0.22, v);
    tone(at, 236, 1.6, 'sawtooth', 0.22, v);
    tone(at, 466, 1.6, 'square', 0.06, v);
    whistle(at + 1.75, 1.1, v);
  }
  return v;
}

const buffers = new Map<SoundKind, AudioBuffer>();

export async function loadCustom(kind: SoundKind): Promise<{ name: string } | null> {
  const rec = await idbGet(kind);
  if (!rec) { buffers.delete(kind); return null; }
  const buf = await audio().decodeAudioData(await rec.blob.arrayBuffer());
  buffers.set(kind, buf);
  return { name: rec.name };
}

export async function saveCustom(kind: SoundKind, file: File): Promise<void> {
  // erst dekodieren: so fällt eine kaputte Datei sofort auf
  const buf = await audio().decodeAudioData(await file.arrayBuffer());
  await idbPut(kind, { name: file.name, blob: file });
  buffers.set(kind, buf);
}

export async function deleteCustom(kind: SoundKind): Promise<void> {
  await idbDelete(kind);
  buffers.delete(kind);
}

export function hasCustom(kind: SoundKind) {
  return buffers.has(kind);
}

/** Plant einen Ton in `delayMs` Millisekunden ein (0 = sofort). */
export function schedule(kind: SoundKind, source: SoundSource, delayMs: number): Scheduled {
  if (source === 'off') return { stop() {} };
  const c = audio();
  const at = c.currentTime + Math.max(0, delayMs) / 1000;
  const buf = source === 'custom' ? buffers.get(kind) : undefined;
  if (buf) {
    const node = c.createBufferSource();
    node.buffer = buf;
    node.connect(master!);
    node.start(at);
    return { stop: () => { try { node.stop(); } catch { /* schon beendet */ } } };
  }
  const voices = builtin(kind, at);
  return {
    stop: () => voices.forEach(({ osc }) => { try { osc.stop(); } catch { /* schon beendet */ } }),
  };
}

// ---------- IndexedDB ----------

interface SoundRecord { name: string; blob: Blob }
const DB = 'turniermanager';
const STORE = 'sounds';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => { resolve(req.result); d.close(); };
    req.onerror = () => { reject(req.error); d.close(); };
  });
}

const idbGet = (k: SoundKind) => tx<SoundRecord | undefined>('readonly', s => s.get(k));
const idbPut = (k: SoundKind, v: SoundRecord) => tx('readwrite', s => s.put(v, k));
const idbDelete = (k: SoundKind) => tx('readwrite', s => s.delete(k));
