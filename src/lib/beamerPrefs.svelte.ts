// Einstellungen für die Beamer-Anzeige (Wartebild vor dem Start). Gespeichert wie alles im localStorage;
// das Beamer-Fenster bekommt Änderungen über das storage-Ereignis.
import { KEYS, readJson, writeJson } from './storage';

export type WaitStyle = 'simple' | 'neon' | 'rally' | 'wall' | 'cards' | 'aurora';

export const WAIT_STYLES: { id: WaitStyle; title: string; text: string }[] = [
  { id: 'simple', title: 'Einfach', text: 'Logo, Turniername und Spielerzahl – ruhig und ohne Bewegung (Standard)' },
  { id: 'neon', title: 'Laserfeld', text: 'Ein Neon-Spielfeld zeichnet sich selbst, flackert auf und lädt sich auf' },
  { id: 'rally', title: 'Ballwechsel', text: 'Zwei Spieler schlagen auf einem Feld von oben einen endlosen Ballwechsel' },
  { id: 'wall', title: 'Spielerwand', text: 'Alle angemeldeten Namen als leuchtende Karten, neue Spieler poppen auf' },
  { id: 'cards', title: 'Infokarten', text: 'Wechselnde Karten: Spielform, Felder, Runden, Spieler, Ablauf' },
  { id: 'aurora', title: 'Nordlicht', text: 'Weich wandernde Farbflächen in den Vereinsfarben – ganz ruhig' },
];

export interface BeamerPrefs {
  style: WaitStyle;
  /** Vereinslogo statt Federball */
  clubLogo: boolean;
  /** Kapsel „Gleich geht’s los …“ (nicht bei „Einfach“) */
  soon: boolean;
  /** Laufband mit den Spielernamen (nicht bei „Einfach“ und „Spielerwand“) */
  ticker: boolean;
}

export const DEFAULT_PREFS: BeamerPrefs = { style: 'simple', clubLogo: true, soon: true, ticker: true };

export function parsePrefs(v: unknown): BeamerPrefs {
  if (typeof v !== 'object' || v === null) return { ...DEFAULT_PREFS };
  const o = v as Record<string, unknown>;
  const style = WAIT_STYLES.some(s => s.id === o.style) ? (o.style as WaitStyle) : DEFAULT_PREFS.style;
  const flag = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  return { style, clubLogo: flag(o.clubLogo, true), soon: flag(o.soon, true), ticker: flag(o.ticker, true) };
}

class BeamerPrefsStore {
  value = $state.raw<BeamerPrefs>(parsePrefs(readJson(KEYS.beamer)));

  set(patch: Partial<BeamerPrefs>) {
    this.value = parsePrefs({ ...this.value, ...patch });
    writeJson(KEYS.beamer, this.value);
  }

  /** Beamer-Fenster: Änderungen aus dem Steuerfenster übernehmen. Gibt die Abmeldefunktion zurück. */
  listen(): () => void {
    const on = (e: StorageEvent) => {
      if (e.key === KEYS.beamer) this.value = parsePrefs(e.newValue ? JSON.parse(e.newValue) : null);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }
}

export const beamerPrefs = new BeamerPrefsStore();
