import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Modal, Offcanvas } from 'bootstrap';
import { Auth } from './core/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App implements AfterViewInit, OnDestroy {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  private readonly modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private readonly menuEl = viewChild.required<ElementRef<HTMLElement>>('menuEl');
  /** Sign in / sign up chooser shown by MY ACCOUNT when signed out. */
  protected accountModal!: Modal;
  /** Mobile navigation menu. */
  protected menu!: Offcanvas;

  protected readonly links = [
    { path: '/', label: 'HOME' },
    { path: '/blog', label: 'BLOG' },
    { path: '/cate', label: 'CATEGORY' },
    { path: '/rewards', label: 'REWARDS' },
    { path: '/gallery', label: 'IMAGE POOL' },
    { path: '/aboutme', label: 'ABOUT US' },
  ];

  protected readonly tags = [
    'Modeling', 'Fashion', 'Travel', 'Vacation', 'See', 'Ocean', 'Office', 'Home',
    'Nature', 'Art', 'Animals', 'Women', 'News', 'Workout', 'Exercise',
  ];

  constructor() {
    this.auth.load();
  }

  ngAfterViewInit(): void {
    this.accountModal = new Modal(this.modalEl().nativeElement);
    this.menu = new Offcanvas(this.menuEl().nativeElement);
  }

  ngOnDestroy(): void {
    this.accountModal?.dispose();
    this.menu?.dispose();
  }

  protected go(path: string): void {
    this.accountModal.hide();
    this.menu.hide();
    this.router.navigateByUrl(path);
  }

  protected async logout(): Promise<void> {
    this.menu.hide();
    await this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
