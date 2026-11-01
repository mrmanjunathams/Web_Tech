import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  text: string;
  okLabel: string;
  danger: boolean;
}

/** In-app replacement for window.confirm(), rendered by the ConfirmDialog component. */
@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolve?: (ok: boolean) => void;

  ask(options: Partial<ConfirmRequest> & Pick<ConfirmRequest, 'title'>): Promise<boolean> {
    this.resolve?.(false);
    this.request.set({ text: '', okLabel: 'Confirm', danger: false, ...options });
    return new Promise((resolve) => (this.resolve = resolve));
  }

  answer(ok: boolean): void {
    this.request.set(null);
    this.resolve?.(ok);
    this.resolve = undefined;
  }
}
