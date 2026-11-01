import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <section>
      <div class="fcont">
        <div class="form-cont">
          <h4>Login to know.</h4>
          <p>more about you.</p>
          <a routerLink="/signup">New here? Sign Up</a>
        </div>
        <div class="form">
          <h1>Sign In</h1>
          <form #f="ngForm" (ngSubmit)="submit()" novalidate>
            <input type="text" id="username" [(ngModel)]="username" name="username" required placeholder="Username" autocomplete="username">
            <input type="password" id="password" [(ngModel)]="password" name="password" required placeholder="Password" autocomplete="current-password">
            @if (error()) { <p class="text-danger">{{ error() }}</p> }
            <input type="submit" id="submit" name="signin" [value]="loading() ? 'Signing in...' : 'SignIn'" [disabled]="f.invalid || loading()">
          </form>
          <a routerLink="/signup">Don't have an account? Sign Up</a>
        </div>
      </div>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected username = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login({ username: this.username, password: this.password });
      await this.router.navigateByUrl('/myacc');
    } catch (err) {
      this.error.set(errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
