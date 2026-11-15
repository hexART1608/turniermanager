// localStorage teilen sich alle Apps unter buchstabenklau.ddns.net – daher eigener Präfix.
export const KEYS = {
  state: 'turniermanager.v1.state',
  timer: 'turniermanager.v1.timer',
  sound: 'turniermanager.v1.sound',
  backup: 'turniermanager.v1.backup',
  theme: 'turniermanager.v1.theme',
  beamer: 'turniermanager.v1.beamer',
} as const;

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** true = gespeichert; false = Speicher voll/gesperrt */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen', key, err);
    return false;
  }
}

export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* egal */ }
}
