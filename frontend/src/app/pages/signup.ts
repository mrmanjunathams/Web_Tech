import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { AuthArt } from '../shared/auth-art';

const LEVELS = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent'];

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink, AuthArt],
  template: `
    <section class="auth container-x">
      <app-auth-art quote="You can make anything by writing." by="C.S. Lewis" />
      <div class="auth__panel glass">
        <p class="eyebrow">Join free</p>
        <h1 class="display display--sm">Your stories <span class="text-grad">deserve a stage</span></h1>
        <form #f="ngForm" (ngSubmit)="submit()" novalidate class="auth__form">
          <label class="field">
            <span class="field__label">Your name <small class="muted">shown on your stories</small></span>
            <span class="input-icon"><span class="ms">badge</span>
              <input type="text" class="input-x" name="name" placeholder="e.g. Asha Rao" [(ngModel)]="name" #n="ngModel"
                     required maxlength="60" pattern=".*\\S.*" autocomplete="name">
            </span>
            @if (n.dirty && n.invalid) { <small class="field__error">Please enter your name (up to 60 characters).</small> }
          </label>
          <label class="field">
            <span class="field__label">Username <small class="muted">for signing in</small></span>
            <span class="input-icon"><span class="ms">alternate_email</span>
              <input type="text" class="input-x" name="username" placeholder="your_username" [(ngModel)]="username" #u="ngModel"
                     required minlength="3" maxlength="30" pattern="[A-Za-z0-9_.\\-]+" autocomplete="username">
            </span>
            @if (u.dirty && u.invalid) { <small class="field__error">3–30 characters: letters, numbers, . _ -</small> }
          </label>
          <label class="field">
            <span class="field__label">Email</span>
            <span class="input-icon"><span class="ms">mail</span>
              <input type="email" class="input-x" name="email" placeholder="you@example.com" [(ngModel)]="email" #e="ngModel" required email autocomplete="email">
            </span>
            @if (e.dirty && e.invalid) { <small class="field__error">Please enter a valid email.</small> }
          </label>
          <label class="field">
            <span class="field__label">Password</span>
            <span class="input-icon"><span class="ms">lock</span>
              <input [type]="show() ? 'text' : 'password'" class="input-x" name="password" placeholder="At least 6 characters"
                     [ngModel]="password()" (ngModelChange)="password.set($event)" required minlength="6" maxlength="128" autocomplete="new-password">
              <button type="button" class="icon-btn" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><span class="ms">{{ show() ? 'visibility_off' : 'visibility' }}</span></button>
            </span>
            @if (password()) {
              <span class="strength" [attr.data-level]="strength()">
                <span class="strength__bars"><i></i><i></i><i></i><i></i></span>
                <small>{{ levels[strength()] }}</small>
              </span>
            }
          </label>
          @if (error()) { <p class="form-msg form-msg--error" role="alert">{{ error() }}</p> }
          <button type="submit" name="submit" class="btn-x btn-x--lg w-100" [disabled]="f.invalid || loading()">
            {{ loading() ? 'Creating your account…' : 'Create account' }}<span class="ms">arrow_forward</span>
          </button>
        </form>
        <p class="auth__switch muted">Already have an account? <a routerLink="/login">Sign in</a></p>
      </div>
    </section>
  `,
})
export class Signup {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected name = '';
  protected username = '';
  protected email = '';
  protected readonly password = signal('');
  protected readonly show = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly levels = LEVELS;

  /** 0 (too short) to 4 (excellent). */
  protected readonly strength = computed(() => {
    const p = this.password();
    if (p.length < 6) return 0;
    let score = 1;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(score, 4);
  });

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signup({ username: this.username, name: this.name.trim(), email: this.email, password: this.password() });
      this.toast.success(`Welcome to Bloggerbytes, ${this.name.trim()}!`);
      await this.router.navigateByUrl('/myacc');
    } catch (err) {
      this.error.set(errorMessage(err, 'Sign up failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
