import { Component, ElementRef, effect, inject } from '@angular/core';
import { Confirm } from '../core/confirm';

@Component({
  selector: 'app-confirm-dialog',
  host: { '(document:keydown.escape)': 'confirm.request() && confirm.answer(false)' },
  template: `
    @if (confirm.request(); as r) {
      <div class="palette-backdrop" (click)="confirm.answer(false)"></div>
      <div class="confirm glass" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <span class="confirm__icon" [class.confirm__icon--danger]="r.danger"><span class="ms">{{ r.danger ? 'delete_forever' : 'help' }}</span></span>
        <h2 id="confirm-title">{{ r.title }}</h2>
        @if (r.text) { <p id="confirm-text" class="muted">{{ r.text }}</p> }
        <div class="confirm__actions">
          <button type="button" class="btn-ghost" (click)="confirm.answer(false)">Cancel</button>
          <button type="button" class="btn-x" [class.btn-x--danger]="r.danger" (click)="confirm.answer(true)">{{ r.okLabel }}</button>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(Confirm);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      if (this.confirm.request()) queueMicrotask(() => this.host.querySelector<HTMLElement>('.confirm .btn-x')?.focus());
    });
  }
}
