import { Component, inject } from '@angular/core';
import { Toast } from '../core/toast';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toast.items(); track t.id) {
        <div class="toast-x glass" [class]="'toast-x--' + t.kind">
          <span class="ms">{{ t.kind === 'success' ? 'check_circle' : t.kind === 'error' ? 'error' : 'info' }}</span>
          <span>{{ t.text }}</span>
          <button type="button" class="icon-btn" aria-label="Dismiss" (click)="toast.dismiss(t.id)"><span class="ms">close</span></button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly toast = inject(Toast);
}
