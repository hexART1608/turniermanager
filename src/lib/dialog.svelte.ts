// Bestätigungsdialog als Promise statt window.confirm (blockiert nicht, passt zum Design).
export interface DialogRequest {
  title: string;
  text?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  /** optionales Kontrollkästchen, z. B. „Spieler übernehmen“ */
  checkbox?: { label: string; checked: boolean };
  resolve: (r: { ok: boolean; checked: boolean }) => void;
}

class Dialogs {
  current = $state<DialogRequest | null>(null);

  ask(opts: Omit<DialogRequest, 'resolve'>): Promise<{ ok: boolean; checked: boolean }> {
    this.current?.resolve({ ok: false, checked: false });
    return new Promise(resolve => {
      this.current = { ...opts, resolve: r => { this.current = null; resolve(r); } };
    });
  }

  async confirm(opts: Omit<DialogRequest, 'resolve' | 'checkbox'>): Promise<boolean> {
    return (await this.ask(opts)).ok;
  }
}

export const dialogs = new Dialogs();
