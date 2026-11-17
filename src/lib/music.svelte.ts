// Musik während des Turniers: lokale Dateien, im Browser abgespielt.
//
// Kette: <audio> → MediaElementSource → duckGain → Lautsprecher. Die Lautstärke regelt das
// <audio>-Element, die Absenkung bei Signalen regelt duckGain – und zwar auf der Uhr des
// AudioContext vorausgeplant, wie die Signale selbst (läuft auch im Hintergrund-Tab genau).
//
// Herkunft der Titel:
// - Ordner (Chrome/Edge): Ordner-Handle in IndexedDB, nach dem Neuladen ein Klick „Freigeben“
// - einzelne Titel: Datei als Blob in IndexedDB, sofort wieder da
// - Ordner ohne Ordner-API (Firefox): nur bis zum Schließen der Seite

import { audio, audioRunning } from './sound';
import { idbDelete, idbGet, idbPut } from './idb';
import { KEYS, readJson, writeJson } from './storage';
import { toasts } from './toast.svelte';
import { spotify } from './spotify.svelte';

export const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i;

type FsDir = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission(o: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'read' }): Promise<PermissionState>;
};

export interface Track {
  id: string;
  name: string;
  kind: 'file' | 'dir' | 'session';
  /** bei kind=dir: Ordner und Pfad darin */
  dirId?: string;
  path?: string;
}

interface DirRecord { id: string; name: string; handle: FsDir }

interface Prefs { volume: number; shuffle: boolean; duck: boolean; duckLevel: number; /** Sekunden leiser vor bzw. nach dem Signal */ duckBefore: number; duckAfter: number; currentId: string | null }

function parsePrefs(v: unknown): Prefs {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const num = (x: unknown, d: number) => (typeof x === 'number' && x >= 0 && x <= 1 ? x : d);
  const sec = (x: unknown, d: number) => (typeof x === 'number' && x >= 0 && x <= 20 ? x : d);
  return {
    volume: num(o.volume, 0.6),
    shuffle: o.shuffle === true,
    duck: o.duck !== false,
    duckLevel: num(o.duckLevel, 0.15),
    duckBefore: sec(o.duckBefore, 1),
    duckAfter: sec(o.duckAfter, 1),
    currentId: typeof o.currentId === 'string' ? o.currentId : null,
  };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const strip = (n: string) => n.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

export const canPickFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

interface Duck { at: number; dur: number }

class Music {
  tracks = $state.raw<Track[]>([]);
  /** Ordner, deren Zugriff nach dem Neuladen erst wieder erlaubt werden muss */
  locked = $state.raw<DirRecord[]>([]);
  prefs = $state<Prefs>(parsePrefs(readJson(KEYS.music)));
  currentId = $state<string | null>(null);
  playing = $state(false);
  position = $state(0);
  duration = $state(0);
  ducked = $state(false);
  panelOpen = $state(false);
  loaded = $state(false);

  private el: HTMLAudioElement | null = null;
  private duckGain: GainNode | null = null;
  private dirs = new Map<string, DirRecord>();
  private session = new Map<string, File>();
  private url: string | null = null;
  private order: string[] = [];
  private history: string[] = [];
  private ducks: Duck[] = [];
  private failures = 0;
  private loadSeq = 0;

  get current(): Track | undefined {
    return this.tracks.find(t => t.id === this.currentId);
  }

  // ---------- Laden / Speichern ----------

  async init() {
    try {
      const saved = (await idbGet<Track[]>('musicMeta', 'playlist')) ?? [];
      const dirs = (await idbGet<DirRecord[]>('musicMeta', 'dirs')) ?? [];
      for (const d of dirs) this.dirs.set(d.id, d);
      const locked: DirRecord[] = [];
      for (const d of dirs) {
        try {
          if ((await d.handle.queryPermission({ mode: 'read' })) !== 'granted') locked.push(d);
        } catch { locked.push(d); }
      }
      this.locked = locked;
      this.tracks = saved.filter(t => t.kind === 'file' || (t.kind === 'dir' && t.dirId && this.dirs.has(t.dirId)));
      this.currentId = this.tracks.some(t => t.id === this.prefs.currentId) ? this.prefs.currentId : (this.tracks[0]?.id ?? null);
      this.rebuildOrder();
    } catch (err) {
      console.error('Musikliste konnte nicht geladen werden', err);
    }
    this.loaded = true;
  }

  private async persist() {
    try {
      await idbPut('musicMeta', 'playlist', this.tracks.filter(t => t.kind !== 'session'));
      const used = new Set(this.tracks.map(t => t.dirId).filter(Boolean));
      for (const id of [...this.dirs.keys()]) if (!used.has(id)) this.dirs.delete(id);
      await idbPut('musicMeta', 'dirs', [...this.dirs.values()]);
    } catch (err) {
      console.error(err);
      toasts.show('error', 'Die Musikliste konnte nicht gespeichert werden.');
    }
  }

  private savePrefs() {
    this.prefs.currentId = this.currentId;
    writeJson(KEYS.music, $state.snapshot(this.prefs));
  }

  // ---------- Titel hinzufügen ----------

  async addFiles(files: File[]) {
    const audioFiles = files.filter(f => AUDIO_EXT.test(f.name) || f.type.startsWith('audio/'));
    if (!audioFiles.length) { toasts.show('warning', 'Keine Audiodateien ausgewählt.'); return; }
    const added: Track[] = [];
    for (const f of audioFiles) {
      const id = uid();
      try {
        await idbPut('musicFiles', id, f);
        added.push({ id, name: strip(f.name), kind: 'file' });
      } catch {
        this.session.set(id, f);
        added.push({ id, name: strip(f.name), kind: 'session' });
      }
    }
    this.append(added);
    const sessionOnly = added.filter(t => t.kind === 'session').length;
    toasts.show(sessionOnly ? 'warning' : 'success', `${added.length} ${added.length === 1 ? 'Titel' : 'Titel'} hinzugefügt.${sessionOnly ? `\n${sessionOnly} davon nur bis zum Schließen (Speicher voll).` : ''}`);
  }

  /** Ordner per Ordner-API (Chrome/Edge). Gleicher Ordner nochmal = neu einlesen. */
  async pickFolder() {
    let handle: FsDir;
    try {
      handle = await (window as unknown as { showDirectoryPicker(o: object): Promise<FsDir> }).showDirectoryPicker({ id: 'turnier-musik', mode: 'read' });
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') toasts.show('error', 'Der Ordner konnte nicht geöffnet werden.');
      return;
    }
    let existing: DirRecord | undefined;
    for (const d of this.dirs.values()) {
      try { if (await d.handle.isSameEntry(handle)) existing = d; } catch { /* ignorieren */ }
    }
    const rec: DirRecord = existing ? { ...existing, handle } : { id: uid(), name: handle.name, handle };
    const paths: string[] = [];
    try {
      await this.scan(handle, '', paths);
    } catch (err) {
      console.error(err);
      toasts.show('error', 'Der Ordner konnte nicht vollständig gelesen werden.');
    }
    if (!paths.length) { toasts.show('warning', `In „${handle.name}“ wurden keine Audiodateien gefunden.`); return; }
    paths.sort(collator.compare);
    this.dirs.set(rec.id, rec);
    this.locked = this.locked.filter(d => d.id !== rec.id);
    const keep = existing ? this.tracks.filter(t => t.dirId === rec.id) : [];
    const byPath = new Map(keep.map(t => [t.path, t]));
    const fresh = paths.map(p => byPath.get(p) ?? { id: uid(), name: strip(p.split('/').pop()!), kind: 'dir' as const, dirId: rec.id, path: p });
    if (existing) {
      const removedCurrent = this.currentId && !fresh.some(t => t.id === this.currentId) && this.current?.dirId === rec.id;
      const others = this.tracks.filter(t => t.dirId !== rec.id);
      this.tracks = [...others, ...fresh];
      if (removedCurrent) this.stop();
      this.rebuildOrder();
      void this.persist();
      toasts.show('success', `„${rec.name}“ neu eingelesen: ${fresh.length} Titel.`);
    } else {
      this.append(fresh);
      toasts.show('success', `„${rec.name}“: ${fresh.length} Titel hinzugefügt.`);
    }
  }

  private async scan(dir: FsDir, prefix: string, out: string[], depth = 0) {
    if (depth > 6) return;
    for await (const entry of dir.values()) {
      if (entry.name.startsWith('.')) continue;
      if (entry.kind === 'file' && AUDIO_EXT.test(entry.name)) out.push(prefix + entry.name);
      else if (entry.kind === 'directory') await this.scan(entry as FsDir, `${prefix}${entry.name}/`, out, depth + 1);
    }
  }

  /** Ordner über <input webkitdirectory> (Browser ohne Ordner-API): nur für diese Sitzung */
  addSessionFolder(files: File[]) {
    const list = files.filter(f => AUDIO_EXT.test(f.name)).sort((a, b) => collator.compare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
    if (!list.length) { toasts.show('warning', 'In diesem Ordner sind keine Audiodateien.'); return; }
    const added = list.map(f => {
      const id = uid();
      this.session.set(id, f);
      return { id, name: strip(f.name), kind: 'session' as const };
    });
    this.append(added);
    toasts.show('warning', `${added.length} Titel hinzugefügt – in diesem Browser nur bis zum Schließen der Seite.`);
  }

  private append(added: Track[]) {
    this.tracks = [...this.tracks, ...added];
    this.currentId ??= added[0]?.id ?? null;
    this.rebuildOrder();
    void this.persist();
    this.savePrefs();
  }

  /** Gesperrte Ordner nach dem Neuladen wieder freigeben (braucht einen Klick). */
  async unlock() {
    const still: DirRecord[] = [];
    for (const d of this.locked) {
      try {
        if ((await d.handle.requestPermission({ mode: 'read' })) !== 'granted') still.push(d);
      } catch { still.push(d); }
    }
    this.locked = still;
    if (still.length) toasts.show('warning', `Kein Zugriff auf: ${still.map(d => d.name).join(', ')}`);
  }

  isLocked(t: Track) {
    return t.kind === 'dir' && this.locked.some(d => d.id === t.dirId);
  }

  async remove(id: string) {
    const t = this.tracks.find(x => x.id === id);
    if (!t) return;
    const wasCurrent = id === this.currentId;
    const wasPlaying = this.playing;
    const idx = this.tracks.indexOf(t);
    this.tracks = this.tracks.filter(x => x.id !== id);
    this.session.delete(id);
    if (t.kind === 'file') void idbDelete('musicFiles', id).catch(() => {});
    this.rebuildOrder();
    if (wasCurrent) {
      const next = this.tracks[Math.min(idx, this.tracks.length - 1)];
      this.unload();
      this.currentId = next?.id ?? null;
      if (next && wasPlaying) void this.play(next.id);
    }
    void this.persist();
    this.savePrefs();
  }

  async clear() {
    this.stop();
    for (const t of this.tracks) if (t.kind === 'file') void idbDelete('musicFiles', t.id).catch(() => {});
    this.tracks = [];
    this.session.clear();
    this.dirs.clear();
    this.locked = [];
    this.currentId = null;
    this.rebuildOrder();
    void this.persist();
    this.savePrefs();
  }

  // ---------- Abspielen ----------

  private ensureChain() {
    if (this.el) return;
    const c = audio();
    const el = new Audio();
    el.preload = 'auto';
    el.volume = this.prefs.volume;
    const src = c.createMediaElementSource(el);
    this.duckGain = c.createGain();
    src.connect(this.duckGain).connect(c.destination);
    el.addEventListener('timeupdate', () => { this.position = el.currentTime; });
    el.addEventListener('durationchange', () => { this.duration = Number.isFinite(el.duration) ? el.duration : 0; });
    el.addEventListener('playing', () => { this.playing = true; this.failures = 0; });
    el.addEventListener('pause', () => { this.playing = false; });
    el.addEventListener('ended', () => { void this.next(true); });
    el.addEventListener('error', () => { void this.onError(); });
    this.el = el;
    // Der AudioContext läuft evtl. erst nach diesem Klick an – dann Absenkungen nachtragen
    c.addEventListener('statechange', () => this.applyDucks());
    void c.resume().then(() => this.applyDucks());
  }

  private async fileFor(t: Track): Promise<Blob> {
    if (t.kind === 'session') {
      const f = this.session.get(t.id);
      if (!f) throw new Error('nicht mehr verfügbar');
      return f;
    }
    if (t.kind === 'file') {
      const b = await idbGet<Blob>('musicFiles', t.id);
      if (!b) throw new Error('Datei fehlt im Speicher');
      return b;
    }
    const d = this.dirs.get(t.dirId!);
    if (!d) throw new Error('Ordner fehlt');
    if (this.isLocked(t)) throw new Error('locked');
    const parts = t.path!.split('/');
    let dir: FileSystemDirectoryHandle = d.handle;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
    return (await dir.getFileHandle(parts[parts.length - 1]!)).getFile();
  }

  private unload() {
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    this.position = 0;
    this.duration = 0;
    this.playing = false;
  }

  async play(id?: string) {
    this.ensureChain();
    const target = id ?? this.currentId ?? this.order[0];
    const t = this.tracks.find(x => x.id === target);
    if (!t) { if (!this.tracks.length) toasts.show('info', 'Die Playlist ist leer – Ordner oder Titel hinzufügen.'); return; }
    if (t.id === this.currentId && this.url && this.el!.src) {
      await this.el!.play().catch(err => this.playFailed(err));
      return;
    }
    if (this.isLocked(t)) {
      await this.unlock();
      if (this.isLocked(t)) return;
    }
    const seq = ++this.loadSeq;
    if (this.currentId && this.currentId !== t.id) this.history = [...this.history.slice(-50), this.currentId];
    this.currentId = t.id;
    this.savePrefs();
    let blob: Blob;
    try {
      blob = await this.fileFor(t);
    } catch (err) {
      console.error(err);
      if (seq === this.loadSeq) await this.onError();
      return;
    }
    if (seq !== this.loadSeq) return; // inzwischen anderer Titel gewählt
    this.unload();
    this.url = URL.createObjectURL(blob);
    this.el!.src = this.url;
    await this.el!.play().catch(err => this.playFailed(err));
  }

  private playFailed(err: unknown) {
    if ((err as DOMException)?.name === 'AbortError') return; // durch Titelwechsel abgebrochen
    console.error(err);
    if ((err as DOMException)?.name === 'NotAllowedError') toasts.show('info', 'Zum Abspielen bitte einmal auf ▶ klicken.');
  }

  private async onError() {
    this.failures++;
    const name = this.current?.name ?? 'Titel';
    if (this.failures >= Math.min(5, this.tracks.length)) {
      this.failures = 0;
      this.unload();
      toasts.show('error', 'Mehrere Titel ließen sich nicht abspielen – Wiedergabe angehalten.');
      return;
    }
    toasts.show('warning', `„${name}“ lässt sich nicht abspielen und wird übersprungen.`);
    await this.next(true);
  }

  pause() {
    this.el?.pause();
  }

  toggle() {
    if (this.playing) this.pause(); else void this.play();
  }

  stop() {
    this.loadSeq++;
    this.unload();
  }

  async next(auto = false) {
    if (!this.tracks.length) return;
    const pos = this.order.indexOf(this.currentId ?? '');
    let nextId = this.order[(pos + 1) % this.order.length]!;
    if (this.prefs.shuffle && pos === this.order.length - 1) {
      this.rebuildOrder(true);
      nextId = this.order[0] === this.currentId && this.order.length > 1 ? this.order[1]! : this.order[0]!;
    }
    if (auto || this.playing) await this.play(nextId);
    else { this.select(nextId); }
  }

  async prev() {
    if (!this.tracks.length) return;
    // wie bei Musikplayern üblich: nach 3 s erst an den Anfang
    if (this.el && this.el.currentTime > 3) { this.el.currentTime = 0; return; }
    let prevId: string | undefined;
    if (this.prefs.shuffle) {
      while (this.history.length && !prevId) {
        const h = this.history.pop()!;
        if (this.tracks.some(t => t.id === h)) prevId = h;
      }
    }
    if (!prevId) {
      const pos = this.order.indexOf(this.currentId ?? '');
      prevId = this.order[(pos - 1 + this.order.length) % this.order.length];
    }
    if (!prevId) return;
    const hist = this.history;
    if (this.playing) await this.play(prevId); else this.select(prevId);
    this.history = hist; // Zurück soll die Historie nicht wieder auffüllen
  }

  private select(id: string) {
    this.stop();
    this.currentId = id;
    this.savePrefs();
  }

  seek(seconds: number) {
    if (this.el && Number.isFinite(seconds)) this.el.currentTime = Math.max(0, Math.min(seconds, this.duration || 0));
  }

  setVolume(v: number) {
    this.prefs.volume = Math.max(0, Math.min(1, v));
    if (this.el) this.el.volume = this.prefs.volume;
    this.savePrefs();
  }

  setShuffle(on: boolean) {
    this.prefs.shuffle = on;
    this.rebuildOrder(true);
    this.savePrefs();
  }

  setDuck(patch: Partial<Pick<Prefs, 'duck' | 'duckLevel' | 'duckBefore' | 'duckAfter'>>) {
    Object.assign(this.prefs, patch);
    this.savePrefs();
    this.applyDucks();
  }

  private rebuildOrder(reshuffle = false) {
    const ids = this.tracks.map(t => t.id);
    if (!this.prefs.shuffle) { this.order = ids; return; }
    if (!reshuffle && this.order.length === ids.length && ids.every(id => this.order.includes(id))) return;
    const rest = ids.filter(id => id !== this.currentId);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    this.order = this.currentId && ids.includes(this.currentId) ? [this.currentId, ...rest] : rest;
  }

  // ---------- Absenkung bei Signalen ----------

  /** Ein Signal kommt in `delayMs` und klingt `durationSec` lang. */
  duck(delayMs: number, durationSec: number) {
    if (durationSec <= 0) return;
    const now = Date.now();
    this.ducks = [...this.ducks.filter(d => d.at + d.dur * 1000 + this.prefs.duckAfter * 1000 + 2000 > now), { at: now + delayMs, dur: durationSec }];
    this.applyDucks();
  }

  cancelDucks() {
    this.ducks = [];
    this.applyDucks();
  }

  /** Alle bekannten Absenkungen auf die Audio-Uhr legen (auch nachträglich, wenn die Musik erst später startet). */
  private applyDucks() {
    const now = Date.now();
    const before = this.prefs.duckBefore * 1000;
    const after = this.prefs.duckAfter * 1000;
    const wins = this.prefs.duck
      ? this.ducks.filter(d => d.at + d.dur * 1000 + after > now).map(d => ({ from: d.at - before, to: d.at + d.dur * 1000 + after }))
      : [];
    spotify.applyDucks(wins, this.prefs.duckLevel);
    this.trackDuckState();
    if (!this.duckGain || !audioRunning()) return;
    const c = audio();
    const g = this.duckGain.gain;
    const toCtx = (ms: number) => c.currentTime + (ms - now) / 1000;
    g.cancelScheduledValues(c.currentTime);
    g.setValueAtTime(g.value, c.currentTime);
    if (!this.prefs.duck) { g.setTargetAtTime(1, c.currentTime, 0.15); this.ducked = false; return; }
    const level = Math.max(0.0001, this.prefs.duckLevel);
    // aktuell in einer Absenkung? Dann sofort runter
    let lowNow = false;
    for (const d of [...this.ducks].sort((a, b) => a.at - b.at)) {
      const start = d.at - before;
      const end = d.at + d.dur * 1000 + after;
      if (end <= now) continue;
      if (start <= now) lowNow = true;
      g.setTargetAtTime(level, Math.max(c.currentTime, toCtx(start)), 0.08);
      g.setTargetAtTime(1, toCtx(end), 0.35);
    }
    if (!lowNow) g.setTargetAtTime(1, c.currentTime, 0.15);
  }

  private duckTimer: ReturnType<typeof setInterval> | null = null;
  private trackDuckState() {
    // nur für die Anzeige („Musik leiser“) – das Leiserwerden selbst steuert die Audio-Uhr
    this.duckTimer ??= setInterval(() => {
      const now = Date.now();
      this.ducked = this.prefs.duck && this.ducks.some(d => d.at - this.prefs.duckBefore * 1000 <= now && d.at + d.dur * 1000 + this.prefs.duckAfter * 1000 > now);
    }, 200);
  }
}

export const music = new Music();

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
