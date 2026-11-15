export type ToastKind = 'info' | 'success' | 'error' | 'warning';
export interface Toast { id: number; kind: ToastKind; text: string; action?: { label: string; run: () => void } }

let seq = 0;

class Toasts {
  list = $state<Toast[]>([]);

  show(kind: ToastKind, text: string, action?: Toast['action'], ms = kind === 'error' ? 7000 : 3800) {
    const id = ++seq;
    this.list = [...this.list.slice(-3), { id, kind, text, action }];
    setTimeout(() => this.dismiss(id), ms);
    return id;
  }
  dismiss(id: number) {
    this.list = this.list.filter(t => t.id !== id);
  }
}

export const toasts = new Toasts();
