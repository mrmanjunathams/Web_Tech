import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { BlogPost, displayName } from '../core/api';
import { Posts } from '../core/posts';
import { Theme } from '../core/theme';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: string;
  group: 'Pages' | 'Actions' | 'Stories';
  run: () => void;
}

/** Ctrl/⌘+K (or "/") quick switcher for pages, actions and stories. */
@Component({
  selector: 'app-command-palette',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    @if (open()) {
      <div class="palette-backdrop" (click)="close()"></div>
      <div class="palette glass" role="dialog" aria-modal="true" aria-label="Search">
        <div class="palette__search">
          <span class="ms">search</span>
          <input type="text" placeholder="Search stories, pages, actions…" [value]="query()"
                 (input)="setQuery($event)" (keydown)="onKey($event)" aria-label="Search" autocomplete="off">
          <kbd>Esc</kbd>
        </div>
        <ul class="palette__list" role="listbox">
          @for (c of results(); track c.id; let i = $index) {
            @if (i === 0 || results()[i - 1].group !== c.group) { <li class="palette__group">{{ c.group }}</li> }
            <li role="option" class="palette__item" [class.is-active]="i === active()" [attr.aria-selected]="i === active()"
                (mouseenter)="active.set(i)" (click)="exec(c)">
              <span class="ms">{{ c.icon }}</span>
              <span class="palette__label">{{ c.label }}</span>
              <span class="palette__hint">{{ c.hint }}</span>
            </li>
          } @empty {
            <li class="palette__empty">No matches for "{{ query() }}"</li>
          }
        </ul>
        <div class="palette__foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span></div>
      </div>
    }
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly posts = inject(Posts);
  private readonly auth = inject(Auth);
  private readonly theme = inject(Theme);

  readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly stories = signal<BlogPost[]>([]);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private loaded = false;

  private readonly commands = computed<Command[]>(() => {
    const go = (path: string) => () => this.router.navigateByUrl(path);
    const signedIn = !!this.auth.user();
    const pages: Command[] = [
      { id: 'p-home', label: 'Home', hint: 'Start page', icon: 'home', group: 'Pages', run: go('/') },
      { id: 'p-blog', label: 'Featured stories', hint: 'Blog', icon: 'auto_stories', group: 'Pages', run: go('/blog') },
      { id: 'p-cate', label: 'Explore', hint: 'All stories by category', icon: 'explore', group: 'Pages', run: go('/cate') },
      { id: 'p-rewards', label: 'Leaderboard', hint: 'Top writers', icon: 'military_tech', group: 'Pages', run: go('/rewards') },
      { id: 'p-gallery', label: 'Image Pool', hint: 'Pictures for your story', icon: 'photo_library', group: 'Pages', run: go('/gallery') },
      { id: 'p-about', label: 'About us', hint: 'Our story', icon: 'info', group: 'Pages', run: go('/aboutme') },
    ];
    const actions: Command[] = [
      { id: 'a-write', label: 'Write a new story', hint: signedIn ? 'Editor' : 'Sign in first', icon: 'edit_square', group: 'Actions', run: go('/writeblog') },
      { id: 'a-theme', label: 'Toggle light / dark', hint: 'Theme', icon: 'contrast', group: 'Actions', run: () => this.theme.toggle() },
      ...(signedIn
        ? [{ id: 'a-acc', label: 'My dashboard', hint: displayName(this.auth.user()!), icon: 'space_dashboard', group: 'Actions' as const, run: go('/myacc') }]
        : [
            { id: 'a-login', label: 'Sign in', hint: 'Account', icon: 'login', group: 'Actions' as const, run: go('/login') },
            { id: 'a-signup', label: 'Create account', hint: 'Free', icon: 'person_add', group: 'Actions' as const, run: go('/signup') },
          ]),
    ];
    const stories: Command[] = this.stories().map((b) => ({
      id: 's-' + b._id, label: b.title, hint: `${b.authName || b.auth} · ${b.cate}`, icon: 'article', group: 'Stories', run: go('/post/' + b._id),
    }));
    return [...pages, ...actions, ...stories];
  });

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.commands();
    if (!q) return all.filter((c) => c.group !== 'Stories').concat(all.filter((c) => c.group === 'Stories').slice(0, 5));
    return all.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)).slice(0, 30);
  });

  constructor() {
    effect(() => {
      if (this.open()) queueMicrotask(() => this.host.querySelector('input')?.focus());
    });
  }

  show(): void {
    this.query.set('');
    this.active.set(0);
    this.open.set(true);
    if (!this.loaded) {
      this.loaded = true;
      Promise.all([this.posts.featured(), this.posts.all()])
        .then(([f, a]) => this.stories.set([...f, ...a]))
        .catch(() => (this.loaded = false));
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected setQuery(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected exec(c: Command): void {
    this.close();
    c.run();
  }

  protected onGlobalKey(e: KeyboardEvent): void {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.open() ? this.close() : this.show();
    } else if (e.key === '/' && !typing && !this.open()) {
      e.preventDefault();
      this.show();
    } else if (e.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.update((i) => (i + 1) % Math.max(n, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update((i) => (i - 1 + n) % Math.max(n, 1)); }
    else if (e.key === 'Enter') {
      const c = this.results()[this.active()];
      if (c) this.exec(c);
    }
  }
}
