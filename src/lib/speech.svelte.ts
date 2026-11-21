// Sprachansage der Runden mit dem Sprachpaket (Piper, Stimme „Thorsten“), unabhängig von
// den Stimmen des Browsers. Das Paket wird auf Wunsch einmal geladen und liegt dann im Browser.
import { audio, playBuffer, setVolume, type Scheduled } from './sound';
import { KEYS, readJson, writeJson } from './storage';
import { music } from './music.svelte';
import { timer } from './timer.svelte';
import { normalizeSpeech } from './voice/level';
import { type PackManifest, VOICE_CACHE, typeOf, voiceUrl } from './voice/pack';

interface Prefs { enabled: boolean; pause: boolean; volume: number }
type Status = 'checking' | 'missing' | 'available' | 'installing' | 'ready' | 'error';

function parsePrefs(raw: unknown): Prefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Prefs>;
  return { enabled: o.enabled === true, pause: o.pause !== false, volume: typeof o.volume === 'number' ? Math.max(0.5, Math.min(3, o.volume)) : 1.5 };
}

class Speech {
  prefs = $state<Prefs>(parsePrefs(readJson(KEYS.speech)));
  status = $state<Status>('checking');
  manifest = $state.raw<PackManifest | null>(null);
  progress = $state(0);
  error = $state('');
  speaking = $state(false);

  private worker: Worker | null = null;
  private workerReady: Promise<void> | null = null;
  private calls = new Map<number, { ok(v: { samples: Float32Array; rate: number } | undefined): void; fail(e: Error): void }>();
  private nextId = 1;
  private chain: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private playing: Scheduled | null = null;
  private token = 0;

  get ready() { return this.status === 'ready'; }
  get active() { return this.prefs.enabled && this.ready; }

  setPrefs(patch: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...patch };
    writeJson(KEYS.speech, this.prefs);
  }

  /** Prüft, ob das Paket schon im Browser liegt oder auf dem Server angeboten wird. */
  async init() {
    try {
      const cache = await caches.open(VOICE_CACHE);
      const hit = await cache.match(voiceUrl('manifest.json'));
      if (hit) { this.manifest = await hit.json() as PackManifest; this.status = 'ready'; return; }
    } catch { /* Cache-Speicher nicht verfügbar */ }
    try {
      // der Typ im Header ist egal (ältere nginx-Einstellungen liefern application/octet-stream); es zählt der Inhalt
      const res = await fetch(voiceUrl('manifest.json'), { cache: 'no-store' });
      if (!res.ok) throw new Error('kein Paket');
      const m = JSON.parse(await res.text()) as PackManifest;
      if (!Array.isArray(m.files) || !m.voice) throw new Error('kein Paket');
      this.manifest = m;
      this.status = 'available';
    } catch {
      this.status = 'missing';
    }
  }

  async install() {
    if (this.status === 'installing' || !this.manifest) return;
    const m = this.manifest;
    this.status = 'installing';
    this.progress = 0;
    this.error = '';
    try {
      void navigator.storage?.persist?.();
      const cache = await caches.open(VOICE_CACHE);
      let loaded = 0;
      for (const f of m.files) {
        const res = await fetch(voiceUrl(f.name), { cache: 'no-store' });
        if (!res.ok || !res.body) throw new Error(`${f.name}: Server antwortet mit ${res.status}`);
        const reader = res.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value as Uint8Array<ArrayBuffer>);
          size += value.length;
          loaded += value.length;
          this.progress = Math.min(1, loaded / m.total);
        }
        if (size !== f.size) throw new Error(`${f.name}: unvollständig geladen`);
        await cache.put(voiceUrl(f.name), new Response(new Blob(chunks), { headers: { 'Content-Type': typeOf(f.name) } }));
      }
      // Marker zuletzt: erst jetzt gilt das Paket als vollständig
      await cache.put(voiceUrl('manifest.json'), new Response(JSON.stringify(m), { headers: { 'Content-Type': 'application/json' } }));
      this.status = 'ready';
    } catch (err) {
      await caches.delete(VOICE_CACHE).catch(() => undefined);
      this.error = err instanceof Error ? err.message : String(err);
      this.status = 'error';
    }
  }

  async remove() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.workerReady = null;
    this.cache.clear();
    await caches.delete(VOICE_CACHE).catch(() => undefined);
    this.setPrefs({ enabled: false });
    await this.init();
  }

  // ---------- Synthese ----------

  private call(msg: Record<string, unknown>) {
    return new Promise<{ samples: Float32Array; rate: number } | undefined>((ok, fail) => {
      const id = this.nextId++;
      this.calls.set(id, { ok, fail });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  private ensureWorker(): Promise<void> {
    if (!this.workerReady) {
      this.worker = new Worker(new URL('./voice/piper.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; error?: string; samples?: Float32Array; rate?: number }>) => {
        const c = this.calls.get(e.data.id);
        if (!c) return;
        this.calls.delete(e.data.id);
        if (e.data.ok) c.ok(e.data.samples ? { samples: e.data.samples, rate: e.data.rate! } : undefined);
        else c.fail(new Error(e.data.error));
      };
      this.worker.onerror = ev => { for (const c of this.calls.values()) c.fail(new Error(ev.message)); this.calls.clear(); };
      const base = new URL(import.meta.env.BASE_URL, location.href).href;
      this.workerReady = this.call({ type: 'init', base, voice: this.manifest?.voice ?? 'de_DE-thorsten-medium' }).then(() => undefined);
      this.workerReady.catch(() => { this.worker?.terminate(); this.worker = null; this.workerReady = null; });
    }
    return this.workerReady;
  }

  /** Erzeugt (oder holt aus dem Zwischenspeicher) die Sprachausgabe für einen Text. */
  private render(text: string): Promise<AudioBuffer> {
    const hit = this.cache.get(text);
    if (hit) return Promise.resolve(hit);
    let p = this.pending.get(text);
    if (!p) {
      // eine Synthese nach der anderen, sonst belegen mehrere den Prozessor gleichzeitig
      p = this.chain.then(async () => {
        await this.ensureWorker();
        const r = await this.call({ type: 'synth', text });
        if (!r) throw new Error('Keine Sprachausgabe erhalten');
        normalizeSpeech(r.samples);
        const buf = audio().createBuffer(1, r.samples.length, r.rate);
        buf.copyToChannel(r.samples as Float32Array<ArrayBuffer>, 0);
        this.cache.set(text, buf);
        while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value as string);
        return buf;
      });
      this.chain = p.catch(() => undefined);
      this.pending.set(text, p);
      void p.finally(() => this.pending.delete(text)).catch(() => undefined);
    }
    return p;
  }

  /** Im Hintergrund vorbereiten (z. B. die nächste Runde), damit die Ansage sofort kommt. */
  prepare(text: string) {
    if (!this.active || !text) return;
    void this.render(text).catch(() => undefined);
  }

  stop() {
    this.token++;
    this.playing?.stop();
    this.playing = null;
    this.speaking = false;
  }

  /** Spricht den Text; die Musik wird währenddessen leiser. */
  async speak(text: string): Promise<boolean> {
    if (!this.ready || !text) return false;
    this.stop();
    const mine = this.token;
    audio(); // innerhalb des Klicks starten (Autoplay-Regeln)
    setVolume(timer.sound.volume);
    this.speaking = true;
    try {
      const buf = await this.render(text);
      if (mine !== this.token) return false;
      setVolume(timer.sound.volume);
      const p = playBuffer(buf, this.prefs.volume);
      this.playing = p;
      music.duck(0, p.duration);
      setTimeout(() => { if (this.playing === p) { this.playing = null; this.speaking = false; } }, p.duration * 1000 + 100);
      return true;
    } catch (err) {
      if (mine === this.token) {
        this.speaking = false;
        const msg = err instanceof Error ? err.message : String(err);
        // WebAssembly wird von strengen Sicherheitsregeln (CSP) des Servers blockiert
        this.error = /wasm|WebAssembly|Content Security|CSP|unsafe-eval/i.test(msg)
          ? `${msg} – Der Server erlaubt WebAssembly noch nicht: einmalig „sudo bash deploy/install.sh“ ausführen.`
          : msg;
      }
      return false;
    }
  }
}

export const speech = new Speech();
