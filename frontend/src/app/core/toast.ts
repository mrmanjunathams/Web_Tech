import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

/** Small notifications shown in the corner (rendered by the Toasts component). */
@Injectable({ providedIn: 'root' })
export class Toast {
  private nextId = 0;
  readonly items = signal<ToastMessage[]>([]);

  show(text: string, kind: ToastMessage['kind'] = 'info', ms = 3500): void {
    const id = this.nextId++;
    this.items.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success = (text: string) => this.show(text, 'success');
  error = (text: string) => this.show(text, 'error', 5000);

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
