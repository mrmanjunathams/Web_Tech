import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { displayName } from './core/api';
import { Auth } from './core/auth';
import { Theme } from './core/theme';
import { Toast } from './core/toast';
import { Avatar } from './shared/avatar';
import { CommandPalette } from './shared/command-palette';
import { ConfirmDialog } from './shared/confirm-dialog';
import { Newsletter } from './shared/newsletter';
import { Toasts } from './shared/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, CommandPalette, ConfirmDialog, Newsletter, Toasts],
  templateUrl: './app.html',
  host: { '(window:scroll)': 'onScroll()', '(document:click)': 'menuOpen.set(false)' },
})
export class App {
  protected readonly auth = inject(Auth);
  protected readonly theme = inject(Theme);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);

  protected readonly scrolled = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  protected readonly year = new Date().getFullYear();
  protected readonly name = displayName;

  protected readonly links = [
    { path: '/', label: 'Home', exact: true },
    { path: '/blog', label: 'Stories', exact: false },
    { path: '/cate', label: 'Explore', exact: false },
    { path: '/rewards', label: 'Leaderboard', exact: false },
    { path: '/gallery', label: 'Image Pool', exact: false },
    { path: '/aboutme', label: 'About', exact: false },
  ];

  protected readonly tags = ['Travel', 'Art', 'Ocean', 'Office', 'Women', 'TechByte', 'Animals', 'Vacation', 'Nature', 'Fashion'];

  constructor() {
    this.auth.load();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.mobileOpen.set(false);
        this.menuOpen.set(false);
      }
    });
  }

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  protected toggleMenu(e: Event): void {
    e.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.toast.success('Signed out. See you soon!');
    this.router.navigateByUrl('/');
  }
}
