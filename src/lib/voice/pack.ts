// Das Sprachpaket (Piper-Engine + Stimme, ca. 93 MB) liegt auf dem Server unter voices/ und wird
// erst auf Wunsch geladen. Danach steckt es im Cache-Speicher des Browsers; der Service Worker
// liefert es von dort aus, damit die Sprachansage auch ohne Netz funktioniert.

export const VOICE_CACHE = 'voice-pack-v1';

export interface PackFile { name: string; size: number }
export interface PackManifest { voice: string; name: string; license: string; files: PackFile[]; total: number }

export const voiceUrl = (name: string) => new URL(`voices/${name}`, new URL(import.meta.env.BASE_URL, location.href)).href;

const TYPES: Record<string, string> = { js: 'application/javascript', wasm: 'application/wasm', json: 'application/json' };
export const typeOf = (name: string) => TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
