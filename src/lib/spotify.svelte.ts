// Spotify Connect / Web Playback SDK.  Die Anmeldung läuft als PKCE-Flow;
// dadurch ist kein Client-Secret in dieser Browser-App nötig.
import { KEYS, readJson, writeJson, removeKey } from './storage';
import { toasts } from './toast.svelte';

const AUTH = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing';
const PKCE_VERIFIER = `${KEYS.spotify}.verifier`;
const PKCE_STATE = `${KEYS.spotify}.state`;
const TOKENS = `${KEYS.spotify}.tokens`;

interface Tokens { access: string; refresh?: string; expiresAt: number }
interface SpotifyItem { name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } }
interface Playback { is_playing: boolean; progress_ms: number; item?: SpotifyItem; device?: { id: string; name: string; volume_percent?: number }; shuffle_state?: boolean }

interface WebPlayer {
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
  private tokens: Tokens | null = asTokens(readJson(TOKENS));
  private player: WebPlayer | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;

  get configured() { return !!this.clientId; }
  get playing() { return this.current?.is_playing ?? false; }
  get title() { return this.current?.item?.name ?? 'Keine Wiedergabe'; }
  get artist() { return this.current?.item?.artists?.map(a => a.name).join(', ') ?? ''; }
  get artwork() { return this.current?.item?.album?.images?.[0]?.url; }
  get volume() { return (this.current?.device?.volume_percent ?? 60) / 100; }
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

  private async request(path: string, init: RequestInit = {}) {
    const token = await this.accessToken();
    if (!token) throw new Error('Bitte erneut bei Spotify anmelden.');
    const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    if (response.status === 401) { this.logout(); throw new Error('Spotify-Anmeldung abgelaufen.'); }
    if (response.status === 403) throw new Error('Spotify verweigert den Player-Zugriff (403). Dafür brauchst du Spotify Premium; bei einer Developer-App muss dein Konto außerdem unter „Users Management“ freigegeben sein.');
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
      window.onSpotifyWebPlaybackSDKReady = () => { old?.(); resolve(); };
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
    void this.player.connect();
  }

  async useBrowser() {
    if (!this.browserDeviceId) { this.error = 'Der Spotify-Browserplayer ist noch nicht bereit.'; return; }
    await this.request('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [this.browserDeviceId], play: this.playing }) });
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
  async next() { if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.nextTrack(); else await this.request('/me/player/next', { method: 'POST' }); await this.refresh(); }
  async previous() { if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.previousTrack(); else await this.request('/me/player/previous', { method: 'POST' }); await this.refresh(); }
  async setVolume(value: number) { const v = Math.max(0, Math.min(1, value)); if (this.playerReady && this.current?.device?.id === this.browserDeviceId) await this.player?.setVolume(v); else await this.request(`/me/player/volume?volume_percent=${Math.round(v * 100)}`, { method: 'PUT' }); await this.refresh(); }
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
    await this.request(`/me/player/play${target}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: `spotify:playlist:${id}` }) });
    await this.refresh();
  }

  logout() {
    this.player?.disconnect(); this.player = null; this.tokens = null; this.connected = false; this.playerReady = false; this.browserDeviceId = null; this.current = null; removeKey(TOKENS); toasts.show('info', 'Von Spotify abgemeldet.');
  }
}

export const spotify = new Spotify();
