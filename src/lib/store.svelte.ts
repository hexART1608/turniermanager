// Zentraler Turnierstand der Steuer-Ansicht: jede Änderung läuft über run(), wird
// gespeichert und kann rückgängig gemacht werden. Andere Fenster (Beamer, zweiter Tab)
// bekommen Änderungen über das storage-Ereignis.

import { ActionError } from '../engine/actions';
import { parseTournament } from '../engine/io';
import { type Tournament, newTournament } from '../engine/types';
import { KEYS, readJson, writeJson } from './storage';
import { toasts } from './toast.svelte';

const UNDO_LIMIT = 60;

export function loadTournament(): Tournament {
  const raw = readJson(KEYS.state);
  if (raw === null) return newTournament();
  try {
    return parseTournament(raw);
  } catch (err) {
    console.error('Gespeicherter Stand unlesbar', err);
    // nicht überschreiben, sondern beiseitelegen
    writeJson(`${KEYS.state}.unlesbar.${Date.now()}`, raw);
    return newTournament();
  }
}

interface UndoEntry { label: string; t: Tournament }

class TournamentStore {
  t = $state.raw<Tournament>(loadTournament());
  undoStack = $state.raw<UndoEntry[]>([]);
  saveFailed = $state(false);
  otherControlWindow = $state(false);

  private channel: BroadcastChannel | null = null;
  private readonly windowId = Math.random().toString(36).slice(2);

  /** Führt eine Änderung aus. Liefert false (mit Meldung), wenn sie abgelehnt wurde. */
  run(label: string, fn: (t: Tournament) => Tournament): boolean {
    let next: Tournament;
    try {
      next = fn(this.t);
    } catch (err) {
      if (err instanceof ActionError) toasts.show('error', err.message);
      else {
        console.error(err);
        toasts.show('error', `Unerwarteter Fehler: ${err instanceof Error ? err.message : String(err)}`);
      }
      return false;
    }
    if (next === this.t) return true;
    this.undoStack = [...this.undoStack.slice(-(UNDO_LIMIT - 1)), { label, t: this.t }];
    this.t = next;
    this.persist();
    return true;
  }

  /** Stand komplett ersetzen (Import, neues Turnier) – ebenfalls rückgängig machbar. */
  replace(label: string, t: Tournament) {
    this.run(label, () => t);
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get undoLabel() {
    return this.undoStack[this.undoStack.length - 1]?.label ?? '';
  }

  undo() {
    const last = this.undoStack[this.undoStack.length - 1];
    if (!last) return;
    this.undoStack = this.undoStack.slice(0, -1);
    this.t = last.t;
    this.persist();
    toasts.show('info', `Rückgängig: ${last.label}`);
  }

  private persist() {
    const ok = writeJson(KEYS.state, this.t);
    if (!ok && !this.saveFailed) {
      toasts.show('error', 'Der Stand konnte nicht im Browser gespeichert werden. Bitte jetzt über das Menü exportieren!');
    }
    this.saveFailed = !ok;
  }

  /** Einmal beim Start der Steuer-Ansicht aufrufen. */
  connect() {
    window.addEventListener('storage', e => {
      if (e.key !== KEYS.state || e.newValue === null) return;
      try {
        this.t = parseTournament(JSON.parse(e.newValue));
        this.undoStack = [];
      } catch { /* fremder/kaputter Stand – ignorieren */ }
    });
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('turniermanager-steuerung');
    this.channel.onmessage = e => {
      const msg = e.data as { type: string; from: string };
      if (msg.from === this.windowId) return;
      if (msg.type === 'hello') this.channel?.postMessage({ type: 'here', from: this.windowId });
      if (msg.type === 'hello' || msg.type === 'here') this.otherControlWindow = true;
      if (msg.type === 'bye') this.otherControlWindow = false;
    };
    this.channel.postMessage({ type: 'hello', from: this.windowId });
    window.addEventListener('pagehide', () => this.channel?.postMessage({ type: 'bye', from: this.windowId }));
  }
}

export const store = new TournamentStore();
