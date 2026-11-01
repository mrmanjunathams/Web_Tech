import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { displayName, errorMessage } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { AuthArt } from '../shared/auth-art';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthArt],
  template: `
    <section class="auth container-x">
      <app-auth-art />
      <div class="auth__panel glass">
        <p class="eyebrow">Welcome back</p>
        <h1 class="display display--sm">Sign in to <span class="text-grad">keep writing</span></h1>
        <form #f="ngForm" (ngSubmit)="submit()" novalidate class="auth__form">
          <label class="field">
            <span class="field__label">Username</span>
            <span class="input-icon"><span class="ms">alternate_email</span>
              <input type="text" id="username" class="input-x" [(ngModel)]="username" name="username" required autocomplete="username" placeholder="your_username">
            </span>
          </label>
          <label class="field">
            <span class="field__label">Password</span>
            <span class="input-icon"><span class="ms">lock</span>
              <input [type]="show() ? 'text' : 'password'" id="password" class="input-x" [(ngModel)]="password" name="password" required autocomplete="current-password" placeholder="••••••••">
              <button type="button" class="icon-btn" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><span class="ms">{{ show() ? 'visibility_off' : 'visibility' }}</span></button>
            </span>
          </label>
          @if (error()) { <p class="form-msg form-msg--error" role="alert">{{ error() }}</p> }
          <button type="submit" id="submit" class="btn-x btn-x--lg w-100" [disabled]="f.invalid || loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}<span class="ms">arrow_forward</span>
          </button>
        </form>
        <p class="auth__switch muted">New to Bloggerbytes? <a routerLink="/signup">Create a free account</a></p>
      </div>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  protected username = '';
  protected password = '';
  protected readonly show = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login({ username: this.username, password: this.password });
      const user = this.auth.user();
      this.toast.success(`Welcome back, ${user ? displayName(user) : this.username}!`);
      await this.router.navigateByUrl('/myacc');
    } catch (err) {
      this.error.set(errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
