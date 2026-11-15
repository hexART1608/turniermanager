// Oberflächen-Zustand und Abläufe, die mehrere Komponenten brauchen (Menü, Tastatur).

import { freshTournament } from '../engine/actions';
import { ImportError, importText, parseTournament, toExport } from '../engine/io';
import { dialogs } from './dialog.svelte';
import { KEYS, readJson, writeJson } from './storage';
import { store } from './store.svelte';
import { timer } from './timer.svelte';
import { toasts } from './toast.svelte';

export type Tab = 'play' | 'ranking' | 'players' | 'history' | 'stats';

class Ui {
  tab = $state<Tab>('play');
  soundOpen = $state(false);
  /** offene Modals (Tastenkürzel sind dann aus) */
  modals = $state(0);
  theme = $state<'dark' | 'light'>(readJson(KEYS.theme) === 'light' ? 'light' : 'dark');

  get modalOpen() {
    return this.modals > 0 || dialogs.current !== null;
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = this.theme;
    writeJson(KEYS.theme, this.theme);
  }
}

export const ui = new Ui();

let beamerWin: Window | null = null;

export function openBeamer(view = 'auto') {
  const url = `${location.pathname}#/beamer?view=${view}`;
  if (beamerWin && !beamerWin.closed && view === 'auto') {
    beamerWin.focus();
    return;
  }
  const w = window.open(url, view === 'auto' ? 'turnier-beamer' : `turnier-beamer-${view}`, 'popup,width=1280,height=720');
  if (!w) {
    toasts.show('error', 'Das Beamer-Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
    return;
  }
  if (view === 'auto') beamerWin = w;
}

function slug(s: string) {
  return s.toLocaleLowerCase('de').replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c]!).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turnier';
}

export function exportTournament() {
  const t = store.t;
  const blob = new Blob([JSON.stringify(toExport(t), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(t.settings.name)}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toasts.show('success', 'Turnier exportiert.');
}

export function importTournament() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;
  // im Dokument halten: ein nur im Speicher liegendes Feld kann vor der Auswahl weggeräumt werden
  document.body.appendChild(input);
  input.addEventListener('cancel', () => input.remove());
  input.onchange = async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const { tournament, legacy, timerSeconds } = importText(await file.text());
      const ok = await dialogs.confirm({
        title: 'Turnier importieren?',
        text: `„${tournament.settings.name}“ mit ${tournament.players.length} Spielern und ${tournament.rounds.length} Runden ersetzt den aktuellen Stand. Mit „Rückgängig“ kommst du zurück.${legacy ? '\n\nDie Datei stammt aus der alten Version und wird umgewandelt.' : ''}`,
        confirm: 'Importieren',
      });
      if (!ok) return;
      store.replace('Import', tournament);
      if (timerSeconds) timer.setDuration(timerSeconds);
      toasts.show('success', 'Import erfolgreich.');
    } catch (err) {
      toasts.show('error', err instanceof ImportError ? err.message : 'Die Datei konnte nicht gelesen werden.');
    }
  };
  input.click();
}

export async function startNewTournament() {
  const t = store.t;
  const r = await dialogs.ask({
    title: 'Neues Turnier anlegen?',
    text: t.rounds.length
      ? 'Das aktuelle Turnier wird beendet und als Sicherung aufbewahrt. Tipp: vorher exportieren, um es dauerhaft zu behalten.'
      : 'Der aktuelle Stand wird als Sicherung aufbewahrt.',
    confirm: 'Neues Turnier',
    danger: true,
    checkbox: { label: 'Spielerliste und Einstellungen übernehmen', checked: true },
  });
  if (!r.ok) return;
  writeJson(KEYS.backup, t);
  timer.reset();
  store.replace('Neues Turnier', freshTournament(t, r.checked));
  ui.tab = 'play';
}

export function backupAvailable(): boolean {
  const raw = readJson(KEYS.backup);
  if (!raw) return false;
  try { return parseTournament(raw).players.length > 0; } catch { return false; }
}

export async function restoreBackup() {
  try {
    const b = parseTournament(readJson(KEYS.backup));
    const ok = await dialogs.confirm({
      title: 'Vorheriges Turnier wiederherstellen?',
      text: `„${b.settings.name}“ mit ${b.players.length} Spielern und ${b.rounds.length} Runden ersetzt den aktuellen Stand.`,
      confirm: 'Wiederherstellen',
    });
    if (ok) store.replace('Wiederherstellen', b);
  } catch {
    toasts.show('error', 'Keine lesbare Sicherung vorhanden.');
  }
}
