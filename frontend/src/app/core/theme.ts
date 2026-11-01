import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

type Mode = 'dark' | 'light';
const KEY = 'bb-theme';

/** Light/dark theme, persisted per browser. Defaults to the OS preference. */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly doc = inject(DOCUMENT);
  readonly mode = signal<Mode>(this.initial());

  constructor() {
    effect(() => {
      const mode = this.mode();
      this.doc.documentElement.dataset['theme'] = mode;
      try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable */ }
    });
  }

  toggle(): void {
    this.mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  private initial(): Mode {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* storage unavailable */ }
    return this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
