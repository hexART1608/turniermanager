// Spotify Connect / Web Playback SDK.  Die Anmeldung läuft als PKCE-Flow;
// dadurch ist kein Client-Secret in dieser Browser-App nötig.
import { KEYS, readJson, writeJson, removeKey } from './storage';
import { toasts } from './toast.svelte';

const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-modify-public playlist-modify-private';
const PKCE_VERIFIER = `${KEYS.spotify}.verifier`;
const PKCE_STATE = `${KEYS.spotify}.state`;
const TOKENS = `${KEYS.spotify}.tokens`;

interface Tokens { access: string; refresh?: string; expiresAt: number }
interface SpotifyItem { uri?: string; name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } }
export interface SearchTrack { uri: string; name: string; artist: string; image?: string }
interface Playback { is_playing: boolean; progress_ms: number; item?: SpotifyItem; device?: { id: string; name: string; volume_percent?: number }; shuffle_state?: boolean }

interface WebPlayer {
  activateElement?(): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  addListener(event: string, callback: (data: any) => void): void;
}

declare global {
  interface Window {
    Spotify?: { Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => WebPlayer };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const random = (length = 64) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
};
const challenge = async (value: string) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const configuredId = () => (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || (readJson(`${KEYS.spotify}.clientId`) as string | null) || '';
const redirectUri = () => `${location.origin}${location.pathname}`;
const asTokens = (value: unknown): Tokens | null => {
  const v = value as Partial<Tokens> | null;
  return v && typeof v.access === 'string' && typeof v.expiresAt === 'number' ? v as Tokens : null;
};

class Spotify {
  online = $state(typeof navigator !== 'undefined' ? navigator.onLine : false);
  clientId = $state(configuredId());
  connected = $state(false);
  loading = $state(false);
  playerReady = $state(false);
  browserDeviceId = $state<string | null>(null);
  current = $state<Playback | null>(null);
  playlistUrl = $state((readJson(`${KEYS.spotify}.playlist`) as string | null) ?? '');
  error = $state<string | null>(null);
  results = $state.raw<SearchTrack[]>([]);
  searching = $state(false);
  searched = $state('');
  playlistTracks = $state.raw<SearchTrack[]>([]);
  playlistLoading = $state(false);
  /** Playlist-ID, deren Titel in playlistTracks stehen */
  playlistLoaded = $state<string | null>(null);
  private tokens: Tokens | null = asTokens(readJson(TOKENS));
  private player: WebPlayer | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  // Absenkung bei Signalen: Lautstärke vor dem Absenken (null = nicht abgesenkt)
  private baseVolume: number | null = null;
  private outVolume = 0.6;
  private duckLevel = 0.15;
  private duckTimers: ReturnType<typeof setTimeout>[] = [];
  private ramp: ReturnType<typeof setInterval> | null = null;

  get configured() { return !!this.clientId; }
  get playing() { return this.current?.is_playing ?? false; }
  get title() { return this.current?.item?.name ?? 'Keine Wiedergabe'; }
  get artist() { return this.current?.item?.artists?.map(a => a.name).join(', ') ?? ''; }
  get artwork() { return this.current?.item?.album?.images?.[0]?.url; }
  get volume() { return this.baseVolume ?? (this.current?.device?.volume_percent ?? 60) / 100; }
  get ducked() { return this.baseVolume !== null; }
  get hasOutput() { return !!this.browserDeviceId || !!this.current?.device?.id; }

  async init() {
    addEventListener('online', this.setOnline);
    addEventListener('offline', this.setOnline);
    await this.finishLogin();
    if (this.tokens && this.online) await this.start();
  }

  destroy() {
    removeEventListener('online', this.setOnline);
    removeEventListener('offline', this.setOnline);
    if (this.poll) clearInterval(this.poll);
    this.player?.disconnect();
  }

  private setOnline = () => { this.online = navigator.onLine; if (this.online && this.tokens) void this.start(); };

  setClientId(value: string) {
    this.clientId = value.trim();
    if (this.clientId) writeJson(`${KEYS.spotify}.clientId`, this.clientId);
    else removeKey(`${KEYS.spotify}.clientId`);
  }

  async login() {
    if (!this.online) return;
    if (!this.clientId) { this.error = 'Bitte zuerst die Spotify Client-ID eintragen.'; return; }
    const verifier = random();
    const state = random(32);
    sessionStorage.setItem(PKCE_VERIFIER, verifier);
    sessionStorage.setItem(PKCE_STATE, state);
    const url = new URL(AUTH);
    url.search = new URLSearchParams({ client_id: this.clientId, response_type: 'code', redirect_uri: redirectUri(), scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: await challenge(verifier) }).toString();
    location.assign(url);
  }

  private async finishLogin() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const authError = params.get('error');
    if (!code && !authError) return;
    const clearUrl = () => history.replaceState({}, '', redirectUri());
    if (authError) { this.error = `Spotify-Anmeldung: ${authError}`; clearUrl(); return; }
    const verifier = sessionStorage.getItem(PKCE_VERIFIER);
    const state = sessionStorage.getItem(PKCE_STATE);
    if (!verifier || !state || state !== params.get('state') || !this.clientId) { this.error = 'Die Spotify-Anmeldung konnte nicht sicher bestätigt werden.'; clearUrl(); return; }
    try {
      const body = new URLSearchParams({ client_id: this.clientId, grant_type: 'authorization_code', code: code!, redirect_uri: redirectUri(), code_verifier: verifier });
      const response = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (!response.ok) throw new Error('Token konnte nicht abgerufen werden.');
      this.storeTokens(await response.json());
    } catch (err) { this.error = err instanceof Error ? err.message : 'Spotify-Anmeldung fehlgeschlagen.'; }
    sessionStorage.removeItem(PKCE_VERIFIER); sessionStorage.removeItem(PKCE_STATE); clearUrl();
  }

  private storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
    this.tokens = { access: data.access_token, refresh: data.refresh_token ?? this.tokens?.refresh, expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
    writeJson(TOKENS, this.tokens);
    this.connected = true; this.error = null;
  }

  private async accessToken() {
    if (!this.tokens) return null;
    if (this.tokens.expiresAt > Date.now()) return this.tokens.access;
    if (!this.tokens.refresh || !this.clientId) { this.logout(); return null; }
    const body = new URLSearchParams({ client_id: this.clientId, grant_type: 'refresh_token', refresh_token: this.tokens.refresh });
    const response = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) { this.logout(); return null; }
    this.storeTokens(await response.json());
    return this.tokens!.access;
  }

  private async request(path: string, init: RequestInit = {}, tolerate404 = false) {
    const token = await this.accessToken();
    if (!token) throw new Error('Bitte erneut bei Spotify anmelden.');
    const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    if (response.status === 401) { this.logout(); throw new Error('Spotify-Anmeldung abgelaufen.'); }
    if (response.status === 403) throw new Error('Spotify verweigert den Player-Zugriff (403). Dafür brauchst du Spotify Premium; bei einer Developer-App muss dein Konto außerdem unter „Users Management“ freigegeben sein.');
    if (response.status === 404 && tolerate404) return response;
    if (response.status === 404) throw new Error(`Spotify findet für diese Aktion kein Ausgabegerät (404, ${path}). Erst warten, bis „Diesen Browser verwenden“ aktiv ist, diesen Knopf drücken und dann die Playlist starten.`);
    if (!response.ok && response.status !== 204) {
      const body = await response.clone().json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ? `Spotify: ${body.error.message}` : `Spotify meldet Fehler ${response.status}.`);
    }
    return response;
  }

  private async start() {
    if (this.loading || !this.tokens) return;
    this.loading = true;
    try {
      await this.loadSdk();
      this.createPlayer();
      this.connected = true;
      await this.refresh();
      this.poll ??= setInterval(() => void this.refresh(), 3000);
    } catch (err) { this.error = err instanceof Error ? err.message : 'Spotify konnte nicht verbunden werden.'; }
    finally { this.loading = false; }
  }

  private loadSdk(): Promise<void> {
    if (window.Spotify) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const old = window.onSpotifyWebPlaybackSDKReady;
      const timer = setTimeout(() => reject(new Error('Das Spotify-SDK wurde nicht geladen (sdk.scdn.co blockiert oder offline?).')), 10000);
      window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timer); old?.(); resolve(); };
      if (!document.querySelector('script[data-spotify-sdk]')) {
        const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.async = true; s.dataset.spotifySdk = 'true'; s.onerror = () => reject(new Error('Spotify Player konnte nicht geladen werden.')); document.head.append(s);
      }
    });
  }

  private createPlayer() {
    if (this.player || !window.Spotify) return;
    this.player = new window.Spotify.Player({ name: 'Turniermanager im Browser', getOAuthToken: cb => { void this.accessToken().then(t => cb(t ?? '')); }, volume: 0.6 });
    this.player.addListener('ready', ({ device_id }) => { this.browserDeviceId = device_id; this.playerReady = true; });
    this.player.addListener('not_ready', () => { this.playerReady = false; });
    this.player.addListener('player_state_changed', () => { void this.refresh(); });
    this.player.addListener('account_error', ({ message }) => { this.error = message || 'Spotify Premium wird für die Browser-Wiedergabe benötigt.'; });
    this.player.addListener('initialization_error', ({ message }) => { this.error = `Browserplayer nicht verfügbar (${message}). Dieser Browser unterstützt keine DRM-Wiedergabe (Widevine) – z. B. Chrome oder Edge verwenden.`; });
    this.player.addListener('authentication_error', ({ message }) => { this.error = `Spotify-Authentifizierung für den Browserplayer fehlgeschlagen (${message}). Bitte abmelden und neu verbinden.`; });
    this.player.addListener('playback_error', ({ message }) => { this.error = `Spotify-Wiedergabefehler: ${message}`; });
    setTimeout(() => { if (!this.playerReady && !this.error) this.error = 'Der Spotify-Browserplayer meldet sich nicht. Häufige Ursachen: kein Spotify Premium, Browser ohne Widevine/DRM (z. B. Firefox/Chromium ohne Widevine), Werbeblocker blockiert sdk.scdn.co, oder Anmeldung ohne Scope „streaming“ – dann abmelden und neu anmelden.'; }, 10000);
    void this.player.connect().then(ok => { if (!ok && !this.error) this.error = 'Der Spotify-Browserplayer konnte keine Verbindung herstellen.'; });
  }

  async useBrowser() {
    if (!this.browserDeviceId) { this.error = 'Der Spotify-Browserplayer ist noch nicht bereit.'; return; }
    // Autoplay-Freigabe des Browsers (muss im Klick-Ereignis passieren).
    try { await this.player?.activateElement?.(); } catch { /* ignorieren */ }
    // Das Gerät ist bei Spotify oft erst nach einigen Sekunden in der Geräteliste.
    for (let i = 0; i < 8; i++) {
      const r = await this.request('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [this.browserDeviceId], play: this.playing }) }, true);
      if (r.status !== 404) break;
      await new Promise(res => setTimeout(res, 800));
    }
    await this.refresh();
  }

  async refresh() {
    if (!this.tokens || !this.online) return;
    try {
      const r = await this.request('/me/player');
      this.current = r.status === 204 ? null : await r.json() as Playback;
    } catch (err) { this.error = err instanceof Error ? err.message : 'Spotify-Status nicht verfügbar.'; }
  }

  async toggle() { if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.togglePlay(); else await this.request(`/me/player/${this.playing ? 'pause' : 'play'}`, { method: 'PUT' }); await this.refresh(); }
  async stop() { await this.request('/me/player/pause', { method: 'PUT' }, true); await this.refresh(); }
  async next() { if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.nextTrack(); else await this.request('/me/player/next', { method: 'POST' }); await this.refresh(); }
  async previous() { if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.previousTrack(); else await this.request('/me/player/previous', { method: 'POST' }); await this.refresh(); }
  private get onBrowser() { return this.playerReady && this.current?.device?.id === this.browserDeviceId; }
  /** Lautstärke setzen, ohne den Status neu zu laden (für die Absenkung). */
  private async push(v: number) {
    this.outVolume = v;
    try {
      if (this.onBrowser) await this.player?.setVolume(v);
      else await this.request(`/me/player/volume?volume_percent=${Math.round(v * 100)}`, { method: 'PUT' }, true);
    } catch { /* Absenkung ist nur Komfort – Fehler nicht anzeigen */ }
  }
  async setVolume(value: number) {
    const v = Math.max(0, Math.min(1, value));
    if (this.baseVolume !== null) { this.baseVolume = v; await this.push(v * this.duckLevel); return; } // während eines Signals: neuen Wert merken
    await this.push(v);
    await this.refresh();
  }

  /**
   * Absenkung bei Signalen: `windows` sind Zeiträume (ms, Date.now()), in denen leiser gespielt wird.
   * Im Browserplayer weich ausgeblendet, bei anderen Geräten ein einzelner API-Aufruf je Richtung.
   */
  applyDucks(windows: { from: number; to: number }[], level: number) {
    for (const t of this.duckTimers) clearTimeout(t);
    this.duckTimers = [];
    this.duckLevel = Math.max(0.0001, level);
    const now = Date.now();
    const merged: { from: number; to: number }[] = [];
    for (const w of [...windows].filter(w => w.to > now).sort((a, b) => a.from - b.from)) {
      const last = merged[merged.length - 1];
      if (last && w.from <= last.to) last.to = Math.max(last.to, w.to); else merged.push({ ...w });
    }
    let low = false;
    for (const w of merged) {
      if (w.from <= now) low = true;
      else this.duckTimers.push(setTimeout(() => this.fade(true, 250), w.from - now));
      this.duckTimers.push(setTimeout(() => this.fade(false, 700), w.to - now));
    }
    if (low) this.fade(true, 250);
    else if (this.baseVolume !== null) this.fade(false, 400);
  }

  private fade(down: boolean, ms: number) {
    if (this.ramp) { clearInterval(this.ramp); this.ramp = null; }
    if (down) {
      if (!this.connected || !this.hasOutput) return;
      if (this.baseVolume === null) { this.baseVolume = this.volume; this.outVolume = this.baseVolume; }
    } else if (this.baseVolume === null) return;
    const base = this.baseVolume!;
    const target = down ? base * this.duckLevel : base;
    const from = this.outVolume;
    const finish = () => {
      if (!down) { this.baseVolume = null; setTimeout(() => void this.refresh(), 800); }
    };
    if (!this.onBrowser) { void this.push(target).then(finish); return; }
    const steps = Math.max(1, Math.round(ms / 50));
    let i = 0;
    this.ramp = setInterval(() => {
      i++;
      void this.push(from + (target - from) * Math.min(1, i / steps));
      if (i >= steps) { clearInterval(this.ramp!); this.ramp = null; finish(); }
    }, 50);
  }
  // ---------- Lieder suchen und hinzufügen ----------

  /** Roher API-Aufruf ohne die Standard-Fehlertexte (für Suche und Playlist-Änderung). */
  private async api(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    if (!token) throw new Error('Bitte erneut bei Spotify anmelden.');
    const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    if (r.status === 401) { this.logout(); throw new Error('Spotify-Anmeldung abgelaufen.'); }
    return r;
  }

  private async errorText(r: Response) {
    const body = await r.clone().json().catch(() => null) as { error?: { message?: string } } | null;
    return body?.error?.message ?? `Fehler ${r.status}`;
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) { this.results = []; this.searched = ''; return; }
    this.searching = true;
    try {
      const r = await this.api(`/search?type=track&limit=8&q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error(`Spotify-Suche: ${await this.errorText(r)}`);
      const data = await r.json() as { tracks?: { items?: { uri: string; name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } }[] } };
      this.results = (data.tracks?.items ?? []).filter(Boolean).map(t => ({
        uri: t.uri, name: t.name, artist: (t.artists ?? []).map(a => a.name).join(', '),
        image: t.album?.images?.[t.album.images.length - 1]?.url,
      }));
      this.searched = q;
    } finally { this.searching = false; }
  }

  /** Titel der eingetragenen Playlist laden (bis 300). */
  async loadPlaylist() {
    const id = this.playlistId;
    if (!id || !this.tokens || !this.online) return;
    this.playlistLoading = true;
    const out: SearchTrack[] = [];
    try {
      for (let offset = 0; offset < 300; offset += 50) {
        const q = `limit=50&offset=${offset}`;
        let r = await this.api(`/playlists/${id}/items?${q}`);
        if (r.status === 404 || r.status === 405) r = await this.api(`/playlists/${id}/tracks?${q}`);
        if (!r.ok) throw new Error(r.status === 403 || r.status === 404 ? 'Die Titel dieser Playlist lassen sich nicht abrufen (privat oder nicht freigegeben).' : `Spotify: ${await this.errorText(r)}`);
        type T = { uri?: string; name?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } };
        const data = await r.json() as { items?: { track?: T | null; item?: T | null }[]; next?: string | null };
        for (const it of data.items ?? []) {
          const t = it.track ?? it.item;
          if (t?.uri && t.name) out.push({ uri: t.uri, name: t.name, artist: (t.artists ?? []).map(a => a.name).join(', '), image: t.album?.images?.[t.album.images.length - 1]?.url });
        }
        if (!data.next) break;
      }
      this.playlistTracks = out;
    } catch (err) {
      this.playlistTracks = out;
      this.error = err instanceof Error ? err.message : 'Playlist konnte nicht geladen werden.';
    } finally {
      this.playlistLoaded = id;
      this.playlistLoading = false;
    }
  }

  /** Einen Titel der Playlist abspielen (Playlist läuft danach weiter). */
  async playTrack(track: SearchTrack) {
    const id = this.playlistId;
    if (!id) return;
    const device = this.browserDeviceId ?? this.current?.device?.id;
    const r = await this.request(`/me/player/play${device ? `?device_id=${encodeURIComponent(device)}` : ''}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: `spotify:playlist:${id}`, offset: { uri: track.uri } }) }, true);
    if (r.status === 404) throw new Error('Kein aktives Spotify-Gerät – bitte „Diesen Rechner nutzen“ drücken.');
    await this.refresh();
  }

  get playlistId() { return this.playlistUrl.match(/(?:playlist[/:])([A-Za-z0-9]+)/)?.[1] ?? null; }

  async addToPlaylist(track: SearchTrack) {
    const id = this.playlistId;
    if (!id) throw new Error('Zuerst oben den Link der Playlist einfügen, in die das Lied soll.');
    const body = JSON.stringify({ uris: [track.uri] });
    const headers = { 'Content-Type': 'application/json' };
    // Spotify stellt die Endpunkte gerade von „tracks“ auf „items“ um – beide probieren
    let r = await this.api(`/playlists/${id}/items`, { method: 'POST', headers, body });
    if (r.status === 404 || r.status === 405) r = await this.api(`/playlists/${id}/tracks`, { method: 'POST', headers, body });
    if (r.status === 403) throw new Error('Spotify erlaubt das Ändern dieser Playlist nicht. Es geht nur bei eigenen oder gemeinsamen Playlists – und nach einmal Abmelden und neu Anmelden (neue Berechtigung).');
    if (!r.ok) throw new Error(`Spotify: ${await this.errorText(r)}`);
    toasts.show('success', `„${track.name}“ zur Playlist hinzugefügt.`);
    void this.loadPlaylist();
  }

  async queueTrack(track: SearchTrack) {
    const device = this.browserDeviceId ?? this.current?.device?.id;
    const r = await this.api(`/me/player/queue?uri=${encodeURIComponent(track.uri)}${device ? `&device_id=${encodeURIComponent(device)}` : ''}`, { method: 'POST' });
    if (r.status === 404) throw new Error('Kein aktives Spotify-Gerät – erst eine Playlist starten.');
    if (!r.ok) throw new Error(`Spotify: ${await this.errorText(r)}`);
    toasts.show('success', `„${track.name}“ kommt als Nächstes.`);
  }

  async setShuffle(value: boolean) { await this.request(`/me/player/shuffle?state=${value}`, { method: 'PUT' }); await this.refresh(); }
  async playPlaylist() {
    const id = this.playlistUrl.match(/(?:playlist[/:])([A-Za-z0-9]+)/)?.[1];
    if (!id) { this.error = 'Bitte einen Spotify-Playlist-Link einfügen.'; return; }
    if (!this.hasOutput) { this.error = 'Noch kein Spotify-Ausgabegerät bereit. Bitte warten, bis „Diesen Browser verwenden“ aktiv ist, und diesen Knopf zuerst drücken.'; return; }
    writeJson(`${KEYS.spotify}.playlist`, this.playlistUrl);
    if (this.browserDeviceId) await this.useBrowser();
    // Spotify Connect übernimmt Gerätewechsel asynchron. Mit device_id wird die Playlist
    // trotzdem direkt an den gerade erzeugten Browserplayer gesendet (kein 404 „No active device“).
    const device = this.browserDeviceId ?? this.current?.device?.id;
    const target = device ? `?device_id=${encodeURIComponent(device)}` : '';
    const play = () => this.request(`/me/player/play${target}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: `spotify:playlist:${id}` }) }, true);
    let r = await play();
    for (let i = 0; i < 6 && r.status === 404; i++) { await new Promise(res => setTimeout(res, 1000)); r = await play(); }
    void this.loadPlaylist();
    if (r.status === 404) throw new Error('Spotify kennt den Browserplayer noch nicht. Bitte „Diesen Browser verwenden“ erneut drücken und in 2–3 Sekunden nochmal starten.');
    await this.refresh();
  }

  logout() {
    this.player?.disconnect(); this.player = null; this.tokens = null; this.connected = false; this.playerReady = false; this.browserDeviceId = null; this.current = null; this.results = []; this.playlistTracks = []; this.playlistLoaded = null; removeKey(TOKENS); toasts.show('info', 'Von Spotify abgemeldet.');
  }
}

export const spotify = new Spotify();
